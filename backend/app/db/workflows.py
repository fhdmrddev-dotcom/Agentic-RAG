"""asyncpg-backed helpers for the harness workflow tables (Phase 091 / HARNESS-03).

These typed helpers mirror ``backend/app/db/runs.py`` (the D-073 asyncpg hot-path
precedent): an asyncpg pool, parameterized ``$N`` placeholders only (no f-strings
on SQL — T-073-02 / T-091-03), and small return shapes the Phase 091 engine
(``harness_engine.run_workflow``) consumes.

COLUMN-NAME CONTRACT (BLOCKER fix — migration 058:16, full-schema.sql:716):
  On ``workflow_phases`` the run foreign-key column is ``workflow_run_id`` (NOT a
  bare ``run_id``). Every RUN-KEYED read against ``workflow_phases`` therefore
  filters ``WHERE workflow_run_id=$1``; querying ``WHERE run_id=$1`` would raise
  Postgres 42703 (undefined_column) at runtime while ordering-only mock unit
  tests stay green. PHASE-KEYED writes filter ``WHERE id=$1`` and are correct.

  ``harness_audit`` DOES have a plain ``run_id`` column (migration 059) — that is
  a different table and its ``run_id`` predicate is correct. The ``workflow_runs``
  helpers are keyed by that table's own ``id`` column.

SECURITY (T-091-03 / V4 access control): the engine runs as service role
(bypasses RLS). Every run-keyed query is scoped by ``workflow_run_id`` (which is
owner-scoped through the workflow_runs -> threads.user_id FK chain); the engine
never accepts a run_id it did not receive from the owning thread's producer spawn.

2-PHASE WRITE (HARNESS-03 / Pitfall 1): ``mark_phase_active`` makes the phase
durably ``active`` BEFORE any work runs; ``complete_phase`` flips to ``completed``
AND writes ``output`` in ONE atomic UPDATE, ONLY after the output is durable. A
phase that crashes mid-work is left ``active`` (never ``completed``), so a later
sweep re-runs it.
"""

from __future__ import annotations

import json
from uuid import UUID

import asyncpg

# harness_audit.event_type CHECK (migration 059, 9 kinds). Validate in code so a
# typo fails fast in tests, not as a Postgres 23514 mid-run (Pitfall 6).
_AUDIT_EVENT_TYPES = frozenset(
    {
        "phase_started",
        "phase_completed",
        "phase_transition",
        "gate_passed",
        "gate_failed",
        "tool_refused",
        "run_started",
        "run_completed",
        "run_failed",
    }
)


# ── workflow_phases reads (RUN-KEYED → workflow_run_id) ──────────────────────
async def load_run_phases(pool: asyncpg.Pool, run_id: UUID) -> list[dict]:
    """All phases for a run, in ``phase_index`` order (resumability substrate).

    RUN-KEYED read → ``workflow_run_id`` (NOT ``run_id`` — that column does not
    exist on workflow_phases; would raise Postgres 42703).
    """
    rows = await pool.fetch(
        """
        SELECT id, slug, phase_index, status, output
        FROM workflow_phases
        WHERE workflow_run_id = $1
        ORDER BY phase_index
        """,
        run_id,
    )
    return [dict(r) for r in rows]


# ── workflow_phases writes (PHASE-KEYED → id) ────────────────────────────────
async def mark_phase_active(pool: asyncpg.Pool, phase_id: UUID) -> None:
    """Flip a phase to ``active`` BEFORE its work runs (Pitfall 1: durable-first).

    PHASE-KEYED write → ``WHERE id=$1``.
    """
    await pool.execute(
        "UPDATE workflow_phases SET status='active', updated_at=now() WHERE id = $1",
        phase_id,
    )


async def complete_phase(pool: asyncpg.Pool, phase_id: UUID, output: dict) -> None:
    """Flip to ``completed`` AND write ``output`` in ONE atomic UPDATE.

    Called ONLY after the output is durable. The status flip and the output
    write are a single statement (never two) so a crash between them is
    impossible — the resumability invariant (HARNESS-03).
    PHASE-KEYED write → ``WHERE id=$1``.
    """
    await pool.execute(
        "UPDATE workflow_phases SET status='completed', output=$2::jsonb, updated_at=now() WHERE id = $1",
        phase_id,
        json.dumps(output),
    )


async def fail_phase(pool: asyncpg.Pool, phase_id: UUID, reason: str) -> None:
    """Mark a phase ``failed`` with the failure reason in ``output`` (Plan 05).

    PHASE-KEYED write → ``WHERE id=$1``.
    """
    await pool.execute(
        "UPDATE workflow_phases SET status='failed', output=$2::jsonb, updated_at=now() WHERE id = $1",
        phase_id,
        json.dumps({"_failure_reason": reason}),
    )


async def skip_phase(pool: asyncpg.Pool, phase_id: UUID) -> None:
    """Mark a phase ``skipped`` (skip_to_phase routing — Plan 05).

    PHASE-KEYED write → ``WHERE id=$1``.
    """
    await pool.execute(
        "UPDATE workflow_phases SET status='skipped', updated_at=now() WHERE id = $1",
        phase_id,
    )


# ── workflow_runs writes (keyed by the runs table's own id) ──────────────────
async def advance_current_phase(
    pool: asyncpg.Pool, run_id: UUID, next_phase_id: UUID | None
) -> None:
    """Point ``workflow_runs.current_phase_id`` at the next phase (or NULL on last).

    workflow_runs table, keyed by its own ``id``.
    """
    await pool.execute(
        "UPDATE workflow_runs SET current_phase_id = $2 WHERE id = $1",
        run_id,
        next_phase_id,
    )


async def finish_run(pool: asyncpg.Pool, run_id: UUID, status: str) -> None:
    """Terminal run status write (``completed`` / ``failed``).

    workflow_runs table, keyed by its own ``id``. Mirror ``_shielded_finalize``:
    this durable UPDATE happens BEFORE the terminal SSE sentinel.
    """
    await pool.execute(
        "UPDATE workflow_runs SET status = $2 WHERE id = $1",
        run_id,
        status,
    )


async def claim_run(pool: asyncpg.Pool, run_id: UUID) -> bool:
    """CAS-claim a run for single-producer execution (Pitfall 7).

    ``UPDATE ... SET status='active' WHERE id=$1 AND status IN ('active','paused')
    RETURNING id``. Returns True iff a row came back (this worker won the claim).
    Plan 04 calls this before a resume sweep re-runs the run so two workers never
    double-execute it. workflow_runs table, keyed by its own ``id``.
    """
    row = await pool.fetchrow(
        """
        UPDATE workflow_runs
        SET status = 'active'
        WHERE id = $1 AND status IN ('active', 'paused')
        RETURNING id
        """,
        run_id,
    )
    return row is not None


# ── harness_audit (this table's own column IS run_id — correct) ──────────────
async def write_audit(
    pool: asyncpg.Pool, run_id: UUID, event_type: str, metadata: dict
) -> None:
    """INSERT one ``harness_audit`` row (INSERT-only RLS).

    ``event_type`` MUST be one of the 9 kinds in the 059 CHECK — asserted here
    against ``_AUDIT_EVENT_TYPES`` so a typo fails fast in tests (ValueError),
    not as a Postgres 23514 mid-run (Pitfall 6). The ``harness_audit`` table's
    own foreign-key column IS ``run_id`` — this predicate is correct.
    """
    if event_type not in _AUDIT_EVENT_TYPES:
        raise ValueError(
            f"write_audit event_type must be one of the 9 harness_audit kinds, "
            f"got {event_type!r}"
        )
    await pool.execute(
        "INSERT INTO harness_audit (run_id, event_type, metadata) VALUES ($1, $2, $3::jsonb)",
        run_id,
        event_type,
        json.dumps(metadata),
    )
