"""Harness state-machine engine (Phase 091 / HARNESS-01 + HARNESS-03).

``run_workflow`` is a hand-rolled async transition loop (NO LangGraph — raw
asyncio per CLAUDE.md) that drives a published :class:`WorkflowDefinition`
through its phases in ``phase_index`` order over the Phase 090 tables. The LLM
NEVER selects the next phase — the backend does, by index. This is the whole
correctness bar of the milestone (HARNESS-01).

The strict 2-phase write (HARNESS-03, the highest-risk surface) is delegated to
``db/workflows.py``:
  1. ``mark_phase_active`` — DURABLE active BEFORE any work runs.
  2. execute (dispatched by phase_type via ``PHASE_TYPE_REGISTRY`` — the SEAM).
  3. ``complete_phase`` — flip to ``completed`` AND write output in ONE atomic
     UPDATE, ONLY after the output is durable.
A phase whose execution raises mid-work is left ``active`` (never ``completed``)
so a later sweep re-runs it — the crash-leaves-active resume contract.

DISPATCH SEAM:
  - ``PHASE_TYPE_REGISTRY`` : dispatch-by-phase_type → Plan 03 registers the 5
    real executors. Empty here → :class:`PhaseTypeNotRegistered`.

VALIDATION GATES (HARNESS-04 / Plan 05): ``_run_phase_with_gates`` wraps each
phase in a bounded-retry loop — run under a wall-clock cap (``asyncio.wait_for``,
``_DEFAULT_PHASE_WALL_CLOCK`` sized from real knobs), run the validation gates,
and on failure retry up to the validator's ``max_retries`` (≤ 3 total, never
loops — SC#3) feeding the error back via ``ctx.retry_feedback`` (PRODUCER side;
Plan 03 executors CONSUME it). On exhaustion the ``on_failure`` routes: ``fail_run``
(D-07, keep partials + plain reason) or ``skip_to_phase:<slug>`` (D-09); unknown
→ fail_run (fail-safe). Every attempt audits + emits ``gate_failed`` (D-08).

Completion semantics (D-10 / D-11): on success the FINAL phase's output IS the
assistant chat message verbatim — there is NO extra synthesis LLM call. The
engine sets ``ctx.final_output`` to the last phase's output; Plan 03's executors
return the chat-ready payload and the existing message-insert path persists it.

WRITE-before-EMIT (D-v2.5-03): every durable DB write precedes its SSE ``_emit``;
Postgres is truth, the ``run:{run_id}`` stream is a hint consumers reconcile.
"""

from __future__ import annotations

import asyncio
import json
from collections import namedtuple
from typing import Callable
from uuid import UUID

from app.config import settings
from app.db.workflows import (
    advance_current_phase,
    complete_phase,
    fail_phase,
    finish_run,
    load_run_phases,
    mark_phase_active,
    skip_phase,
    write_audit,
)
from app.models.harness import WorkflowDefinition

# NOTE: ``run_gates`` (harness.validators) and ``parse_skip_target``
# (harness.reachability) are imported LAZILY inside the functions that use them.
# A top-level import of anything under the ``app.services.harness`` PACKAGE runs
# that package's ``__init__`` → ``phase_types.register_all()`` → which imports
# back from THIS module before ``PHASE_TYPE_REGISTRY`` is bound (circular import).
# The lazy import (the same pattern phase_types uses for the engine) breaks it.

__all__ = ["run_workflow", "PHASE_TYPE_REGISTRY", "PhaseTypeNotRegistered"]


# ── SEAMS ────────────────────────────────────────────────────────────────────
class PhaseTypeNotRegistered(KeyError):
    """Raised when a phase_type has no executor in PHASE_TYPE_REGISTRY (Plan 03)."""


# Dispatch-by-phase_type SEAM. Plan 03 registers the 5 real executors here and
# flips the dispatch tests live; this plan ships it EMPTY (tests inject stubs).
PHASE_TYPE_REGISTRY: dict[str, Callable] = {}

# Per-phase wall-clock cap default, sized from existing knobs (D-12): a phase
# making up to harness_phase_max_steps bounded LLM calls must allow >= N x the
# per-call timeout. Read off Settings so an operator can override via env without
# code change. Per-phase override is ``phase.config.wall_clock_seconds``.
_DEFAULT_PHASE_WALL_CLOCK = settings.harness_phase_wall_clock_seconds

# Per-phase STEP cap default (D-12). The cap itself is enforced INSIDE the
# executor (run_task_sub_agent's max_steps in Plan 03's llm_agent path); the
# engine surfaces the default here + onto ctx so the executor and the engine
# agree on the bound. Aligned to the Explorer=8 convention via Settings.
_DEFAULT_PHASE_MAX_STEPS = settings.harness_phase_max_steps

# Outputs larger than this spill to the workspace-files bucket (path-only), so
# the workflow_phases.output jsonb never bloats (T-091-07 / Pattern 3).
_OUTPUT_INLINE_LIMIT = 64 * 1024  # 64 KB


async def _emit(redis, run_id: UUID, type: str, **fields) -> None:
    """One canonical XADD to ``run:{run_id}`` (mirrors threads.py:139)."""
    await redis.xadd(
        f"run:{run_id}",
        {"data": json.dumps({"type": type, **fields})},
        maxlen=10000,
        approximate=True,
    )


def _persist_output(output: dict) -> dict:
    """Return the inline output dict, or a path-only spill dict if it's too large.

    Large outputs spill to the ``workspace-files`` bucket (path-only) so
    ``workflow_phases.output`` jsonb never bloats (Pattern 3 / T-091-07). The
    bucket write itself is wired by the Plan 03 executors that produce large
    blobs; here we keep the size gate + the path-only contract so the engine's
    durable write stays bounded.
    """
    try:
        serialized = json.dumps(output)
    except (TypeError, ValueError):
        # Non-JSON-serializable output is a phase-executor bug (Plan 03 owns the
        # return shape); surface it rather than silently store nothing.
        raise
    if len(serialized) > _OUTPUT_INLINE_LIMIT:
        # Path-only spill: the blob goes to workspace-files; output jsonb keeps
        # only the pointer. Plan 03 supplies the concrete bucket path.
        spilled_path = output.get("_spilled_path") if isinstance(output, dict) else None
        return {"_spilled_path": spilled_path or "workspace-files://pending"}
    return output


async def _execute_phase(phase, accumulated_outputs: dict, ctx) -> dict:
    """Dispatch a phase to its executor via the registry SEAM (Plan 03 fills it)."""
    phase_type = phase.config.phase_type
    executor = PHASE_TYPE_REGISTRY.get(phase_type)
    if executor is None:
        raise PhaseTypeNotRegistered(
            f"no executor registered for phase_type {phase_type!r} "
            f"(Plan 03 registers the 5 real executors)"
        )
    return await executor(phase, accumulated_outputs, ctx)


# ── on_failure routing (Plan 05 / D-07/D-08/D-09) ────────────────────────────
# The outcome of running a phase through its bounded-retry gate loop.
#   kind == "completed"  → output is durable-ready; advance to the next phase.
#   kind == "skip_to"    → jump to target_slug (D-09); this phase is `skipped`.
#   kind == "fail_run"   → the run is `failed`; stop cleanly keeping partials (D-07).
PhaseOutcome = namedtuple("PhaseOutcome", ["kind", "output", "target_slug", "reason"])

# on_failure dispositions (ValidatorSpec.on_failure). UNKNOWN values route to
# fail_run (fail-safe — T-091-18 mitigation).
_OnFailure = namedtuple("_OnFailure", ["kind", "target_slug"])


def _parse_on_failure(on_failure: str) -> _OnFailure:
    """Parse a failing validator's ``on_failure`` disposition.

    Recognizes ``fail_run`` (the D-07 baseline), ``retry`` (retry exhausted ⇒ falls
    back to fail_run unless a skip_to_phase is configured), and
    ``skip_to_phase:<slug>`` (D-09). ANY unrecognized value routes to ``fail_run``
    (fail-safe, T-091-18).
    """
    from app.services.harness.reachability import parse_skip_target

    target = parse_skip_target(on_failure)
    if target is not None:
        return _OnFailure("skip_to_phase", target)
    if on_failure in ("fail_run", "retry"):
        # `retry` here means "retries are exhausted" → D-07 baseline (fail_run).
        return _OnFailure("fail_run", None)
    return _OnFailure("fail_run", None)  # unknown → fail-safe


def _failing_on_failure(phase, gate) -> str:
    """The ``on_failure`` of the validator that produced this gate failure.

    ``run_gates`` returns the first failing GateResult; we don't get the index back,
    so we re-derive the disposition from the phase's validators. With the common
    single-validator phase this is exact; with multiple validators we use the first
    validator carrying a non-baseline disposition (skip_to_phase) when present, else
    the first validator's on_failure — the routing intent of the gate set.
    """
    validators = list(getattr(phase, "validators", None) or [])
    if not validators:
        return "fail_run"
    for v in validators:
        if v.on_failure.startswith("skip_to_phase:"):
            return v.on_failure
    return validators[0].on_failure


async def _run_phase_with_gates(
    phase,
    accumulated_outputs: dict,
    ctx,
    *,
    run_id: UUID,
    pool,
    redis,
    wall_clock: int,
) -> PhaseOutcome:
    """Execute a phase under a bounded-retry gate loop (HARNESS-04 — the SC#3 bar).

    Runs the phase under a wall-clock cap (``asyncio.wait_for``), runs its
    validation gates, and on failure retries up to the failing validator's
    ``max_retries`` (default 2 → 3 total attempts) — feeding the validator error
    back into the next attempt via ``ctx.retry_feedback`` (the PRODUCER side; the
    Plan 03 LLM executors are the CONSUMER, round-trip proven in 07-T2). The bound
    is HARD: a deterministically-failing gate reaches ``failed`` in ≤ 3 attempts and
    NEVER loops; a consecutive-identical output short-circuits even faster (retrying
    won't help). Every attempt writes a ``gate_failed`` audit row AND emits a
    ``gate_failed`` SSE event (D-08 visible retries). On exhaustion the failing
    validator's ``on_failure`` routes: ``fail_run`` (D-07 baseline) or
    ``skip_to_phase:<slug>`` (D-09); an unknown value fails safe to ``fail_run``.

    Returns a :class:`PhaseOutcome`; the caller (``run_workflow``) commits the
    durable side-effects (complete/skip/fail) so the 2-phase write stays in the
    main loop.
    """
    # Lazy import (breaks the harness-package import cycle — see module note).
    from app.services.harness.validators import run_gates

    # max_retries comes from the failing validator (default 2). When the phase has
    # validators they share the bound in practice; use the first validator's.
    validators = list(getattr(phase, "validators", None) or [])
    phase_max_retries = validators[0].max_retries if validators else 2

    attempt = 0
    last_output = None
    while True:
        # Execute under the wall-clock cap. A hanging phase fails cleanly at the
        # timeout and drives the SAME on_failure routing as a gate failure (D-12).
        try:
            output = await asyncio.wait_for(
                _execute_phase(phase, accumulated_outputs, ctx),
                timeout=wall_clock,
            )
        except asyncio.TimeoutError:
            gate_error = f"wall_clock_timeout after {wall_clock}s"
            # Treat the timeout as a terminal gate failure: audit + emit, then route.
            await write_audit(
                pool, run_id, "gate_failed",
                {"phase": phase.slug, "attempt": attempt, "error": gate_error},
            )
            await _emit(
                redis, run_id, "gate_failed",
                phase=phase.slug, attempt=attempt, error=gate_error,
            )
            return _route_on_failure(phase, gate_error, attempt)

        gate = await run_gates(phase, output, ctx)
        if gate.passed:
            if validators:
                await write_audit(pool, run_id, "gate_passed", {"phase": phase.slug})
            # Clear the retry feedback so a downstream phase isn't polluted.
            _clear_retry_feedback(ctx)
            return PhaseOutcome("completed", output, None, None)

        # ── gate failed ──────────────────────────────────────────────────────
        # Consecutive-identical short-circuit: re-running produced the SAME output,
        # so retrying cannot help — treat as exhausted (T-091-16, the SC#3 net).
        identical = output == last_output
        last_output = output

        await write_audit(
            pool, run_id, "gate_failed",
            {"phase": phase.slug, "attempt": attempt, "error": gate.error_message},
        )
        await _emit(
            redis, run_id, "gate_failed",
            phase=phase.slug, attempt=attempt, error=gate.error_message,
        )

        exhausted = identical or attempt >= phase_max_retries
        if not exhausted:
            attempt += 1
            # PRODUCER side: feed the validator error into the next attempt's prompt
            # (the Plan 03 executors append ctx.retry_feedback). D-08 visible.
            try:
                ctx.retry_feedback = (
                    f"Previous output failed validation: {gate.error_message}. Fix it."
                )
            except (AttributeError, TypeError):
                pass  # immutable stub ctx in some unit tests
            continue

        # Exhausted → on_failure routing.
        _clear_retry_feedback(ctx)
        return _route_on_failure(phase, gate.error_message, attempt)


def _route_on_failure(phase, error_message: str, attempt: int) -> PhaseOutcome:
    """Map an exhausted/timed-out gate failure to a :class:`PhaseOutcome`."""
    disposition = _parse_on_failure(_failing_on_failure(phase, None))
    reason = (
        f"Phase {phase.phase_index + 1} ({phase.slug}) gate failed after "
        f"{attempt + 1} attempt(s): {error_message}"
    )
    if disposition.kind == "skip_to_phase":
        return PhaseOutcome("skip_to", None, disposition.target_slug, reason)
    return PhaseOutcome("fail_run", None, None, reason)


def _clear_retry_feedback(ctx) -> None:
    """Clear ``ctx.retry_feedback`` so it never leaks into a later phase's prompt."""
    try:
        ctx.retry_feedback = None
    except (AttributeError, TypeError):
        pass


async def run_workflow(
    run_id: UUID,
    definition: WorkflowDefinition,
    ctx,
    *,
    pool,
    redis,
) -> None:
    """Drive a run through its phases in ``phase_index`` order (HARNESS-01).

    The 2-phase write (mark active before work, complete only after durable
    output) is the resumability core (HARNESS-03). A phase that raises mid-work
    is left ``active`` — the exception propagates so a later sweep re-runs it; the
    engine never marks a crashed phase ``completed`` from the generic path.

    Validation gates (HARNESS-04) run per phase via ``_run_phase_with_gates``: the
    bounded-retry loop reaches ``failed`` in ≤ 3 attempts and NEVER loops (the SC#3
    bar). On exhaustion the ``on_failure`` routing either fails the run cleanly
    keeping completed phases' outputs with a plain reason (D-07), or jumps to a
    ``skip_to_phase`` target (D-09).
    """
    rows = await load_run_phases(pool, run_id)
    # Resumed runs see prior outputs: seed accumulated_outputs from completed rows.
    accumulated_outputs: dict[str, dict] = {}
    for r in rows:
        if r.get("status") == "completed":
            accumulated_outputs[r["slug"]] = r.get("output") or {}

    # Map the parsed definition's PhaseSpec by slug so we dispatch on the typed
    # config while iterating the durable rows in phase_index order.
    spec_by_slug = {p.slug: p for p in definition.phases}
    ordered = sorted(rows, key=lambda r: r["phase_index"])
    index_by_slug = {row["slug"]: i for i, row in enumerate(ordered)}

    last_output: dict = {}
    # Index-driven loop (not a for-each) so skip_to_phase can jump the cursor (D-09).
    i = 0
    while i < len(ordered):
        row = ordered[i]
        status = row.get("status")
        if status in ("completed", "skipped"):
            # Idempotent resume — already done, don't re-run.
            if status == "completed":
                last_output = accumulated_outputs.get(row["slug"], {})
            i += 1
            continue

        phase = spec_by_slug[row["slug"]]
        phase_id = row["id"]
        wall_clock = (
            getattr(phase.config, "wall_clock_seconds", None) or _DEFAULT_PHASE_WALL_CLOCK
        )

        # 1. DURABLE active BEFORE any work (Pitfall 1).
        await mark_phase_active(pool, phase_id)
        # WRITE-before-EMIT.
        await write_audit(
            pool,
            run_id,
            "phase_started",
            {"phase": phase.slug, "phase_index": phase.phase_index},
        )
        await _emit(
            redis,
            run_id,
            "phase_started",
            phase=phase.slug,
            phase_index=phase.phase_index,
            phase_type=phase.config.phase_type,
        )

        # 2. Execute under the bounded-retry gate loop (wall-clock cap + gates +
        #    on_failure routing live inside). The step cap is enforced INSIDE the
        #    executor (run_task_sub_agent max_steps, Plan 03) — both caps present.
        outcome = await _run_phase_with_gates(
            phase,
            accumulated_outputs,
            ctx,
            run_id=run_id,
            pool=pool,
            redis=redis,
            wall_clock=wall_clock,
        )

        # ── fail_run: keep completed phases' outputs, stop cleanly, plain reason ─
        if outcome.kind == "fail_run":
            await fail_phase(pool, phase_id, outcome.reason)
            # Completed phases' outputs are ALREADY durable — finish_run does NOT
            # touch them (D-07). The run flips to `failed`; nothing silently dropped.
            await finish_run(pool, run_id, "failed")
            await write_audit(pool, run_id, "run_failed", {"reason": outcome.reason})
            await _emit(redis, run_id, "run_failed", reason=outcome.reason)
            return  # stop — no further phases

        # ── skip_to_phase: mark this phase skipped, jump the cursor (D-09) ──────
        if outcome.kind == "skip_to":
            await skip_phase(pool, phase_id)
            await write_audit(
                pool, run_id, "phase_transition",
                {"from": phase.slug, "to": outcome.target_slug, "via": "skip_to_phase"},
            )
            await _emit(
                redis, run_id, "phase_transition",
                from_phase=phase.slug, to_phase=outcome.target_slug, via="skip_to_phase",
            )
            target_i = index_by_slug.get(outcome.target_slug)
            if target_i is None:
                # Runtime guard: lint catches dangling skips at publish, but a
                # target missing at runtime fails safe to fail_run (T-091-18).
                reason = (
                    f"skip_to_phase target {outcome.target_slug!r} does not exist "
                    f"at runtime (phase {phase.slug})"
                )
                await finish_run(pool, run_id, "failed")
                await write_audit(pool, run_id, "run_failed", {"reason": reason})
                await _emit(redis, run_id, "run_failed", reason=reason)
                return
            i = target_i
            continue

        # ── completed: persist output (2-phase write step 2), advance ──────────
        output = outcome.output
        durable_output = _persist_output(output)
        await complete_phase(pool, phase_id, durable_output)
        accumulated_outputs[phase.slug] = output
        last_output = output

        # 4. Advance current_phase + audit/emit the transition.
        next_phase_id = ordered[i + 1]["id"] if i + 1 < len(ordered) else None
        await advance_current_phase(pool, run_id, next_phase_id)
        await write_audit(
            pool,
            run_id,
            "phase_completed",
            {"phase": phase.slug, "phase_index": phase.phase_index},
        )
        await _emit(
            redis,
            run_id,
            "phase_completed",
            phase=phase.slug,
            phase_index=phase.phase_index,
        )
        if next_phase_id is not None:
            await write_audit(
                pool,
                run_id,
                "phase_transition",
                {"from": phase.slug, "to": ordered[i + 1]["slug"]},
            )
            await _emit(
                redis,
                run_id,
                "phase_transition",
                from_phase=phase.slug,
                to_phase=ordered[i + 1]["slug"],
            )
        i += 1

    # ── Completion (D-10 / D-11): final phase output IS the chat message ──────
    # No extra synthesis LLM call. Plan 03's executors return the chat-ready
    # payload; the existing message-insert path persists ctx.final_output.
    try:
        ctx.final_output = last_output
    except (AttributeError, TypeError):
        pass  # ctx may be an immutable stub in unit tests

    # Mirror _shielded_finalize ordering: durable run-status UPDATE BEFORE the
    # terminal _emit.
    await finish_run(pool, run_id, "completed")
    await write_audit(pool, run_id, "run_completed", {"run_id": str(run_id)})
    await _emit(redis, run_id, "run_completed", status="completed")
