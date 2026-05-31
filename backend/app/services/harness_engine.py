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
import logging
from collections import namedtuple
from datetime import datetime, timezone
from typing import Callable
from uuid import UUID

from app.config import settings
from app.db.workflows import (
    advance_current_phase,
    ask_user_response_exists,
    claim_run,
    complete_phase,
    fail_phase,
    find_resumable_runs,
    finish_run,
    get_active_phase,
    get_pending_ask_user,
    load_run_phases,
    mark_phase_active,
    skip_phase,
    write_audit,
)
from app.models.harness import WorkflowDefinition
from app.services.ask_user_service import resume_pending_prompt

logger = logging.getLogger(__name__)

# NOTE: ``run_gates`` (harness.validators) and ``parse_skip_target``
# (harness.reachability) are imported LAZILY inside the functions that use them.
# A top-level import of anything under the ``app.services.harness`` PACKAGE runs
# that package's ``__init__`` → ``phase_types.register_all()`` → which imports
# back from THIS module before ``PHASE_TYPE_REGISTRY`` is bound (circular import).
# The lazy import (the same pattern phase_types uses for the engine) breaks it.


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
    """Return the output dict to durably persist — NEVER discarding the payload.

    CR-02 fix (091-REVIEW): the prior version returned
    ``{"_spilled_path": "workspace-files://pending"}`` for outputs > 64 KB, but NO
    phase executor ever supplies a real ``_spilled_path`` (the bucket-write path
    was never wired). The result silently DESTROYED any large phase output —
    ``workflow_phases.output`` kept only a dead pointer string, and a resumed
    downstream phase (or the final chat message) read the placeholder instead of
    the real text. Correctness (no lost output) outranks jsonb size.

    Policy: store the FULL output inline. jsonb can hold it — the 64 KB cap is an
    OPTIMIZATION, not a hard storage limit. If a real ``_spilled_path`` is ever
    supplied by a future bucket-spill path, honor it (path-only); otherwise keep
    the payload inline and log a debug note that bucket spill is not yet wired.
    Bucket spill remains a future optimization, NOT a correctness dependency.
    """
    try:
        serialized = json.dumps(output)
    except (TypeError, ValueError):
        # Non-JSON-serializable output is a phase-executor bug (Plan 03 owns the
        # return shape); surface it rather than silently store nothing.
        raise
    if len(serialized) > _OUTPUT_INLINE_LIMIT:
        # A real spill pointer (future optimization) is honored if present...
        spilled_path = output.get("_spilled_path") if isinstance(output, dict) else None
        if spilled_path:
            return {"_spilled_path": spilled_path}
        # ...otherwise store inline. NEVER drop the payload (CR-02).
        logger.debug(
            "harness phase output is %d bytes (> %d inline limit); storing inline "
            "(bucket spill not yet wired — payload preserved, no data loss)",
            len(serialized),
            _OUTPUT_INLINE_LIMIT,
        )
        return output
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


def _failing_on_failure(phase, failed_idx: int | None) -> str:
    """The ``on_failure`` of the validator that produced this gate failure.

    WR-03 (091-08): ``run_gates`` now threads the FAILING validator's index back
    (``GateResult.validator_index``); the engine passes it here as ``failed_idx`` so
    the disposition comes from the SAME validator whose ``max_retries`` bounded the
    retry loop. When the index is known we index ``phase.validators[failed_idx]``
    directly. When it is None (e.g. a wall-clock timeout — no gate ran) we fall back
    to the prior heuristic: the first validator carrying a ``skip_to_phase``
    disposition if any, else the first validator's ``on_failure``.
    """
    validators = list(getattr(phase, "validators", None) or [])
    if not validators:
        return "fail_run"
    if failed_idx is not None and 0 <= failed_idx < len(validators):
        return validators[failed_idx].on_failure
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
    _audit_user_id: UUID | None,
    stream_run_id: UUID | None = None,
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
    # Facet B (092-07): gate_failed events are engine _emit sites too — route them
    # to the producer stream (run:{stream_run_id}) while gate_failed write_audit
    # stays keyed on the workflow ``run_id`` (the _emit / write_audit pair are
    # separate call sites taking distinct ids — the decoupling is mechanically
    # clean). Default to the workflow run_id when called without the kwarg
    # (back-compat for direct unit callers).
    stream_run_id = stream_run_id or run_id

    # Lazy import (breaks the harness-package import cycle — see module note).
    from app.services.harness.validators import run_gates

    # WR-03 (091-08): the retry bound AND the on_failure disposition must come from
    # the SAME failing validator. We don't know which validator fails until the gate
    # runs, so seed the bound from validators[0] and REBIND it to the failing
    # validator's max_retries the moment run_gates reports the failing index — so a
    # multi-validator phase where validators[0].max_retries differs from the
    # routing validator's no longer pairs a wrong bound with a wrong route.
    validators = list(getattr(phase, "validators", None) or [])
    phase_max_retries = validators[0].max_retries if validators else 2
    failed_idx: int | None = None

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
                pool, run_id, user_id=_audit_user_id, event_type="gate_failed",
                metadata={"phase": phase.slug, "attempt": attempt, "error": gate_error},
            )
            await _emit(redis, stream_run_id, "gate_failed",
                phase=phase.slug, attempt=attempt, error=gate_error,
            )
            # A wall-clock timeout has no failing-validator index (the phase hung
            # before gates ran) → failed_idx stays None → routing uses the phase's
            # disposition heuristic (skip_to_phase-bearing validator else first).
            return _route_on_failure(phase, gate_error, attempt, failed_idx)

        gate = await run_gates(phase, output, ctx)
        if gate.passed:
            if validators:
                await write_audit(
                    pool, run_id, user_id=_audit_user_id,
                    event_type="gate_passed", metadata={"phase": phase.slug},
                )
            # Clear the retry feedback so a downstream phase isn't polluted.
            _clear_retry_feedback(ctx)
            return PhaseOutcome("completed", output, None, None)

        # ── gate failed ──────────────────────────────────────────────────────
        # WR-03: rebind the retry bound to the FAILING validator the first time we
        # learn its index (run_gates threads it back on GateResult), so the bound
        # and the route both come from the same validator.
        if gate.validator_index is not None and 0 <= gate.validator_index < len(validators):
            failed_idx = gate.validator_index
            phase_max_retries = validators[failed_idx].max_retries

        # Consecutive-identical short-circuit: re-running produced the SAME output,
        # so retrying cannot help — treat as exhausted (T-091-16, the SC#3 net).
        identical = output == last_output
        last_output = output

        await write_audit(
            pool, run_id, user_id=_audit_user_id, event_type="gate_failed",
            metadata={"phase": phase.slug, "attempt": attempt, "error": gate.error_message},
        )
        await _emit(redis, stream_run_id, "gate_failed",
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

        # Exhausted → on_failure routing (from the SAME failing validator, WR-03).
        _clear_retry_feedback(ctx)
        return _route_on_failure(phase, gate.error_message, attempt, failed_idx)


def _route_on_failure(
    phase, error_message: str, attempt: int, failed_idx: int | None = None
) -> PhaseOutcome:
    """Map an exhausted/timed-out gate failure to a :class:`PhaseOutcome`.

    ``failed_idx`` (WR-03) is the index of the validator that failed — both the
    retry bound and this routing disposition derive from that same validator.
    """
    disposition = _parse_on_failure(_failing_on_failure(phase, failed_idx))
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
    stream_run_id: UUID | None = None,
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
    # Phase 092-05 F1: the run-owner id every harness_audit write must bind
    # (harness_audit.user_id is NOT NULL). Live runs set ctx.current_user from the
    # route; the resume path's _build_resume_context reads back the persisted
    # workflow_runs.user_id. A unit stub without current_user resolves to None.
    _audit_user_id = (
        (ctx.current_user or {}).get("id")
        if getattr(ctx, "current_user", None)
        else None
    )

    # Facet B (092-07): every engine SSE event must reach the PRODUCER stream the
    # frontend watches (run:{producer_run_id}), NOT run:{workflow_run_id} (a stream
    # nobody subscribes to). The explicit ``stream_run_id`` (passed by the live
    # kickoff + both resume paths) wins; otherwise resolve it from
    # ``ctx.producer_run_id`` (live/resume safe once the producer row is minted),
    # falling back to ``run_id`` only for legacy unit stubs with no producer id.
    # write_audit / finish_run / load_run_phases / _load_run_definition STAY on the
    # workflow ``run_id`` (F1/F2 shape preserved).
    stream_run_id = stream_run_id or getattr(ctx, "producer_run_id", None) or run_id

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
            user_id=_audit_user_id,
            event_type="phase_started",
            metadata={"phase": phase.slug, "phase_index": phase.phase_index},
        )
        await _emit(redis, stream_run_id,
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
            _audit_user_id=_audit_user_id,
            stream_run_id=stream_run_id,
        )

        # ── fail_run: keep completed phases' outputs, stop cleanly, plain reason ─
        if outcome.kind == "fail_run":
            await fail_phase(pool, phase_id, outcome.reason)
            # Completed phases' outputs are ALREADY durable — finish_run does NOT
            # touch them (D-07). The run flips to `failed`; nothing silently dropped.
            await finish_run(pool, run_id, "failed")
            await write_audit(
                pool, run_id, user_id=_audit_user_id,
                event_type="run_failed", metadata={"reason": outcome.reason},
            )
            await _emit(redis, stream_run_id, "run_failed", reason=outcome.reason)
            return  # stop — no further phases

        # ── skip_to_phase: mark this phase skipped, jump the cursor (D-09) ──────
        if outcome.kind == "skip_to":
            await skip_phase(pool, phase_id)
            await write_audit(
                pool, run_id, user_id=_audit_user_id, event_type="phase_transition",
                metadata={"from": phase.slug, "to": outcome.target_slug, "via": "skip_to_phase"},
            )
            await _emit(redis, stream_run_id, "phase_transition",
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
                await write_audit(
                    pool, run_id, user_id=_audit_user_id,
                    event_type="run_failed", metadata={"reason": reason},
                )
                await _emit(redis, stream_run_id, "run_failed", reason=reason)
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
            user_id=_audit_user_id,
            event_type="phase_completed",
            metadata={"phase": phase.slug, "phase_index": phase.phase_index},
        )
        await _emit(redis, stream_run_id,
            "phase_completed",
            phase=phase.slug,
            phase_index=phase.phase_index,
        )
        if next_phase_id is not None:
            await write_audit(
                pool,
                run_id,
                user_id=_audit_user_id,
                event_type="phase_transition",
                metadata={"from": phase.slug, "to": ordered[i + 1]["slug"]},
            )
            await _emit(redis, stream_run_id,
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
    await write_audit(
        pool, run_id, user_id=_audit_user_id,
        event_type="run_completed", metadata={"run_id": str(run_id)},
    )
    await _emit(redis, stream_run_id, "run_completed", status="completed")


# ── HARNESS-03 startup sweep (Plan 04) ────────────────────────────────────────
async def _load_run_definition(pool, run_id: UUID) -> WorkflowDefinition | None:
    """Parse a run's published :class:`WorkflowDefinition` from the DB.

    Joins ``workflow_runs.definition_id`` → ``workflow_definitions.definition``
    (the FULL WorkflowDefinition jsonb, migration 056:23) and parses it. Returns
    ``None`` if the run or its definition is gone (a defensively-handled edge —
    the sweep skips it rather than crashing startup).
    """
    row = await pool.fetchrow(
        """
        SELECT wd.definition
        FROM workflow_runs wr
        JOIN workflow_definitions wd ON wd.id = wr.definition_id
        WHERE wr.id = $1
        """,
        run_id,
    )
    if row is None or not row.get("definition"):
        return None
    definition = row["definition"]
    if isinstance(definition, str):
        definition = json.loads(definition)
    return WorkflowDefinition.model_validate(definition)


async def _build_resume_context(run, redis, pool):
    """Build the minimal run-identity ctx bag the engine threads through on resume.

    Mirrors the live producer ctx surface (run_id / thread_id / redis / pool /
    user / emit) so ``run_workflow`` and the phase executors find their substrate.
    The executors read this bag via ``getattr`` with safe defaults (Plan 03), so a
    minimal bag is sufficient for the index-driven loop; richer per-run fields
    (folder scope, user_settings) are absent on resume and default to None — the
    re-run reads its inputs from the durable accumulated phase outputs.

    Facet C (092-07): the original producer ``runs`` row was finalized at the
    crash and its ``run:{id}`` stream EXPIREd; no producer-id column persists, so
    we MINT a fresh producer-shell ``runs`` row here (status='streaming',
    parent_run_id=None, NON-NULL placeholder model/provider — the shell never makes
    an LLM call) and set ``producer_run_id`` to it. The resumed sub-agents'
    ``parent_run_id`` FK now resolves (Facet A) and resumed events route to
    ``run:{producer_run_id}`` (Facet B). ``ctx.run_id`` stays the workflow_run id
    (audit/terminal/definition/resume-match). The caller (``resume_stranded_workflows``)
    MUST terminalize this shell on every exit path (no stranded streaming row → the
    F2 self-heal is never defeated).
    """
    from types import SimpleNamespace
    from uuid import uuid4
    from app.db.runs import insert_run

    _producer_id = uuid4()
    _thread_id = run["thread_id"]
    _user_id = run.get("user_id")
    await insert_run(
        pool,
        run_id=_producer_id,
        thread_id=_thread_id if isinstance(_thread_id, UUID) else UUID(str(_thread_id)),
        user_id=_user_id if isinstance(_user_id, UUID) else UUID(str(_user_id)),
        status="streaming",
        # model/provider are NOT NULL (db/runs.py); the shell is never used for an
        # LLM call so the placeholder cannot misroute any provider's sub-agent.
        model="unknown", provider="unknown",
        parent_run_id=None,
    )

    return SimpleNamespace(
        run_id=run["run_id"],
        producer_run_id=_producer_id,
        thread_id=str(run["thread_id"]),
        # 092-07: coerce to str, mirroring str(run["thread_id"]) above. On the
        # resume path run["user_id"] is an asyncpg pgproto.UUID OBJECT (not a
        # str like the live auth dict). task_service.insert_run does
        # UUID(parent_ctx.current_user["id"]) — UUID(<UUID object>) raises
        # AttributeError ('UUID' has no 'replace'). Match the live contract
        # (current_user["id"] is a str). user_id None → resume can't proceed.
        current_user={
            "id": str(run["user_id"]) if run.get("user_id") is not None else None
        },
        redis=redis,
        pool=pool,
        emit=_emit,
        retry_feedback=None,
    )


async def _resume_run(run_id: UUID, definition: WorkflowDefinition, ctx, *, pool, redis) -> None:
    """Re-drive a claimed stranded run through the engine (rides run_workflow).

    ``run_workflow`` skips ``completed``/``skipped`` phases and re-runs the ``active``
    one from the top (Plan 02 idempotent load) — an active phase's output was never
    durable, so re-running is the correct resume point with no double side-effect
    (an llm_agent re-run forks a fresh sub_run_id; the old partial is orphaned
    harmlessly — Pitfall 5). The completion/failure path inside run_workflow already
    mirrors ``_shielded_finalize`` (durable terminal status BEFORE the terminal emit).
    """
    await run_workflow(run_id, definition, ctx, pool=pool, redis=redis)


async def resume_stranded_workflows(*, pool, redis) -> int:
    """Startup sweep: re-run runs left ``active`` by a restart (HARNESS-03).

    For each stranded run (``find_resumable_runs`` — anchored on the per-thread
    ``threads.active_workflow_run_id``, with a ``status='active'`` workflow_phases
    row):

      1. ``claim_run`` (CAS) — only ONE worker resumes each run (Pitfall 7); with
         WORKER_COUNT=2 the loser skips. Idempotent + atomic.
      2. Inspect the active phase. If it is an ``llm_human_input`` phase mid-ask:
           - ANSWERED (``ask_user_response_exists`` True): the answer is durable →
             do NOT re-ask; let ``run_workflow`` re-run the phase, which re-reads
             the durable answer and proceeds.
           - PENDING (False): ``resume_pending_prompt`` re-SUBSCRIBES + re-SADDs +
             re-EMITs the SAME prompt (subscribe-before-emit, Pitfall 2) and blocks
             on the answer BEFORE handing back to the loop.
      3. Re-drive via ``_resume_run`` → ``run_workflow``, riding the same engine
         machinery a fresh run uses (single producer per run).

    Returns the count of runs this worker resumed (for the lifespan log). Never
    re-runs a run it did not claim (the OQ6 anti-pattern: no unclaimed re-run loop).
    """
    resumed = 0
    runs = await find_resumable_runs(pool)
    for run in runs:
        run_id = run["run_id"]
        # 1. CAS claim — single-producer-per-run (Pitfall 7). Loser skips.
        #    The lease (claimed_at) is the real CAS (CR-01): the winner stamps it,
        #    a racing sibling sees the fresh stamp → 0 rows → skips. A crash
        #    mid-resume becomes re-claimable once harness_resume_lease_seconds expires.
        if not await claim_run(pool, run_id, settings.harness_resume_lease_seconds):
            continue

        # 2. ask_user resume branch: answered → proceed; pending → re-emit + block.
        active = await get_active_phase(pool, run_id)
        if active is not None and _is_llm_human_input(active):
            tool_call_id = _active_tool_call_id(active)
            if tool_call_id is not None:
                answered = await ask_user_response_exists(pool, run_id, tool_call_id)
                if not answered:
                    pending = await get_pending_ask_user(pool, run_id)
                    if pending is not None and pending.get("tool_call_id"):
                        await resume_pending_prompt(
                            redis,
                            run_id,
                            pending["tool_call_id"],
                            pending.get("prompt") or "",
                            pending.get("options") or [],
                            pending.get("timeout_seconds")
                            or settings.ask_user_max_timeout_seconds,
                        )
                # answered → fall through; run_workflow re-reads the durable answer.

        # 3. Load the definition + ctx and re-drive (rides run_workflow).
        definition = await _load_run_definition(pool, run_id)
        ctx = await _build_resume_context(run, redis, pool)
        # Facet C (092-07): MANDATORY resume finalizer — terminalize the
        # producer-shell minted in _build_resume_context on EVERY exit path
        # (success/exception/cancel), mirroring the F2 terminalize at
        # threads.py. Without it a crashed/cancelled resume strands a
        # status='streaming' row that becomes the thread's latest runs row, so the
        # reconcile F2 self-heal (ORDER BY started_at DESC LIMIT 1) reads
        # 'streaming' → lock_is_stale=False → re-wedges the thread (the exact class
        # F2 closed). The point is TERMINAL (not the exact status).
        _redrive_failed = False
        try:
            await _resume_run(run_id, definition, ctx, pool=pool, redis=redis)
        except Exception:
            _redrive_failed = True
            raise
        finally:
            _pid = getattr(ctx, "producer_run_id", None)
            if _pid is not None:
                try:
                    from app.db.runs import finalize_run
                    await finalize_run(
                        pool,
                        run_id=_pid,
                        status="failed" if _redrive_failed else "completed",
                        error="resume re-drive failed" if _redrive_failed else None,
                        completed_at=datetime.now(timezone.utc),
                        message_id=None,
                        input_tokens=None,
                        output_tokens=None,
                    )
                except Exception:
                    logger.exception(
                        "resume producer-shell finalize failed for %s", _pid
                    )
        resumed += 1

    return resumed


def _is_llm_human_input(active_phase: dict) -> bool:
    """True if the active phase row is an ``llm_human_input`` phase.

    The row may carry a ``config`` dict (phase_type) or expose the type via its
    stored output; we check the config phase_type first, then fall back to the
    presence of a stored ``tool_call_id`` in the output (the llm_human_input
    executor stores it — Plan 03).
    """
    config = active_phase.get("config")
    if isinstance(config, dict) and config.get("phase_type") == "llm_human_input":
        return True
    output = active_phase.get("output")
    if isinstance(output, dict) and "tool_call_id" in output:
        return True
    return False


def _active_tool_call_id(active_phase: dict) -> str | None:
    """The ask_user ``tool_call_id`` stored by the llm_human_input executor (Plan 03)."""
    output = active_phase.get("output")
    if isinstance(output, dict):
        return output.get("tool_call_id")
    return None


__all__ = [
    "run_workflow",
    "PHASE_TYPE_REGISTRY",
    "PhaseTypeNotRegistered",
    "resume_stranded_workflows",
]
