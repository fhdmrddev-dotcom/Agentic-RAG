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

SEAMS this plan establishes (filled by later plans):
  - ``PHASE_TYPE_REGISTRY`` : dispatch-by-phase_type → Plan 03 registers the 5
    real executors. Empty here → :class:`PhaseTypeNotRegistered`.
  - ``_run_gates``          : validation gates + bounded retry → Plan 05 fills it
    (no-op pass here).
  - wall-clock cap          : ``asyncio.wait_for`` around the execute call; the
    default is ``_DEFAULT_PHASE_WALL_CLOCK`` (Plan 05 sizes it from real knobs).

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


async def _run_gates(phase, output: dict, ctx) -> bool:
    """Validation-gate SEAM — Plan 05 implements gates + bounded retry.

    No-op pass here so the transition loop is testable end-to-end this plan.
    """
    return True


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
    is left ``active`` — the exception propagates so the producer's finalizer
    (Plan 05 owns the deliberate fail_run path) handles it; the engine never
    marks a crashed phase ``completed`` or ``failed`` from the generic path.
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

    last_output: dict = {}
    for i, row in enumerate(ordered):
        status = row.get("status")
        if status in ("completed", "skipped"):
            # Idempotent resume — already done, don't re-run.
            if status == "completed":
                last_output = accumulated_outputs.get(row["slug"], {})
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

        # 2. Execute under a wall-clock cap (the SEAM dispatches by phase_type).
        #    A raise here propagates: the phase stays `active` (never completed).
        output = await asyncio.wait_for(
            _execute_phase(phase, accumulated_outputs, ctx),
            timeout=wall_clock,
        )

        # Validation gates (Plan 05 fills this seam + the bounded retry around it).
        await _run_gates(phase, output, ctx)

        # 3. Complete ONLY after output is durable — ONE atomic UPDATE.
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
