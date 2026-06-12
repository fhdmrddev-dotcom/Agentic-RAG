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

from app.models.harness import WorkflowDefinition

# harness_audit.event_type CHECK (migration 059 = 9 kinds; migration 069 = +7 emit
# kinds → 16; migration 070 = +6 judge/publish/policy/ask_user-approval kinds → 22
# total). Validate in code so a typo fails fast in tests, not as a Postgres 23514
# mid-run (Pitfall 6). MUST stay IN LOCKSTEP with the 069 + 070 CHECK — a mismatch is
# the exact fail-fast this set exists for (Phase 101.1 D-12 / Phase 102 D-12).
_AUDIT_EVENT_TYPES = frozenset(
    {
        # 059 — the 9 original harness lifecycle/gate kinds:
        "phase_started",
        "phase_completed",
        "phase_transition",
        "gate_passed",
        "gate_failed",
        "tool_refused",
        "run_started",
        "run_completed",
        "run_failed",
        # 069 (Phase 101.1 D-12) — the 7 emit-transition kinds:
        "emit_forced",
        "emit_recovered",
        "emit_validated",
        "emit_rejected",
        "emit_rendered",
        "emit_integrity_failed",
        "emit_failed",
        # 070 (Phase 102 GATE-01/QUAL-01) — judge/publish/policy/ask_user-approval receipts:
        "judge_verdict",
        "publish_attempted",
        "publish_blocked",
        "publish_succeeded",
        "policy_applied",
        "validator_ask_user_approved",
    }
)


# ── run creation (Phase 092 MODE-01 / Q5 — the net-new atomic transaction) ───
async def create_workflow_run(
    pool: asyncpg.Pool,
    *,
    thread_id: UUID,
    definition_id: UUID,
    definition: WorkflowDefinition,
    inputs: dict,
    model: str | None,
    user_id: UUID,
) -> UUID:
    """Atomically create a workflow run + its phase rows + set the thread anchor.

    The ONLY live-app path that creates a workflow run (RESEARCH Landmine 3 — no
    ``INSERT INTO workflow_phases`` existed anywhere in ``backend/app`` before this).
    All three writes run inside ONE transaction in FK-safe order (Landmine 9):

      1. INSERT workflow_runs (status='active', persists ``inputs``+``model`` —
         SEED-047) → RETURNING id
      2. one INSERT workflow_phases per PhaseSpec, in ``phase_index`` order,
         status='pending'
      3. UPDATE threads.active_workflow_run_id = <new run id>  (the lock anchor)

    The workflow_runs INSERT MUST precede the threads UPDATE because
    ``threads.active_workflow_run_id`` FKs to ``workflow_runs.id`` (full-schema.sql).

    This is a NET-NEW transaction mechanic — no in-file precedent existed; the
    standard asyncpg ``acquire() -> transaction()`` form is lifted here and the
    three writes go through the acquired connection (``con``), not the pool.

    RLS (file header contract): this helper runs as service role; owner-scoping
    lives UPSTREAM in the route (the send_message handler already ownership-checked
    the thread and resolved the definition under the user's RLS). The run-owner
    ``user_id`` (resolved from the route's ``current_user``) IS persisted on the
    workflow_runs row (Phase 092-05 F1) — it is the trusted owner stamp that the
    resume path (_build_resume_context) and every harness_audit write read back.
    ``$N`` placeholders only; ``json.dumps(inputs)`` + ``$3::jsonb`` (this file
    does NOT use a pool JSONB codec — mirror complete_phase :240).

    Returns the new workflow_run id.
    """
    async with pool.acquire() as con:
        async with con.transaction():
            run_id = await con.fetchval(
                """
                INSERT INTO workflow_runs (thread_id, definition_id, status, inputs, model, user_id)
                VALUES ($1, $2, 'active', $3::jsonb, $4, $5)
                RETURNING id
                """,
                thread_id,
                definition_id,
                json.dumps(inputs),
                model,
                user_id,
            )
            for ps in sorted(definition.phases, key=lambda p: p.phase_index):
                await con.execute(
                    """
                    INSERT INTO workflow_phases (workflow_run_id, phase_index, slug, status)
                    VALUES ($1, $2, $3, 'pending')
                    """,
                    run_id,
                    ps.phase_index,
                    ps.slug,
                )
            await con.execute(
                "UPDATE threads SET active_workflow_run_id = $2 WHERE id = $1",
                thread_id,
                run_id,
            )
    return run_id


async def list_published_workflows(
    pool: asyncpg.Pool, *, user_id: UUID, project_folder_id: UUID | None = None
) -> list[dict]:
    """Published workflow definitions visible to a user (the picker feed).

    Mirrors the RESEARCH Q5 RLS-mirroring predicate: ``status='published'`` AND
    (``is_global`` OR ``created_by = $1``) — a user never sees another user's
    unpublished or private definitions (T-092-07). Returns the id/slug/name the
    picker needs. ``$N`` placeholders only.

    PROJECT BINDING (Phase 098 / PROJ-01, D-03): when ``project_folder_id`` is
    supplied, the result is additionally filtered to definitions whose JSONB
    ``definition->>'project_folder_id'`` equals that folder — the queryable
    half of "a project (folder) owns a library of workflows". This is a
    JSONB-path predicate on the existing ``definition`` column: NO new column,
    NO expression index, ZERO migration (RESEARCH §5/§6 — sufficient at current
    scale). The user-scope clause is evaluated FIRST and the project filter is
    AND-appended, so it can only NARROW, never widen, visibility (T-098-09 /
    V4 — a caller cannot see another user's private workflow by guessing a
    ``project_folder_id``). The value is bound as a positional ``$N`` parameter
    as ``str(project_folder_id)`` because ``definition->>'key'`` yields TEXT —
    never string-interpolated into the SQL (T-098-10 / V5; only the placeholder
    INDEX ``$N`` — a code-derived int — is f-string-built). When omitted the
    query is byte-identical to the pre-098 full published list (backward
    compatible).
    """
    sql = (
        "SELECT id, slug, name FROM workflow_definitions "
        "WHERE status = 'published' AND (is_global = true OR created_by = $1)"
    )
    params: list = [user_id]
    if project_folder_id is not None:
        params.append(str(project_folder_id))  # definition->>'key' returns TEXT → bind str
        sql += f" AND definition->>'project_folder_id' = ${len(params)}"
    sql += " ORDER BY name"
    rows = await pool.fetch(sql, *params)
    return [dict(r) for r in rows]


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


# ── resume sweep reads (HARNESS-03 / Plan 04) ────────────────────────────────
async def find_resumable_runs(pool: asyncpg.Pool) -> list[dict]:
    """Stranded runs to re-run on startup (HARNESS-03 startup sweep).

    A stranded run is one whose run row is still ``active``/``paused`` AND is the
    thread's CURRENT run (``threads.active_workflow_run_id = wr.id``) AND has a
    ``workflow_phases`` row left ``status='active'`` — a phase a restart killed
    mid-work (its output was never durable, so re-running it from the top is the
    correct, idempotent resume point — HARNESS-03 2-phase write).

    COLUMN CONTRACT (BLOCKER): the ``threads`` anchor is the threads-table column
    ``active_workflow_run_id`` (per-thread, not a global flag); the
    ``workflow_phases`` EXISTS sub-select keys by ``workflow_run_id`` (migration
    058:16 — a bare ``wp.run_id`` would raise Postgres 42703). The owner FK chain
    (workflow_runs.thread_id -> threads.user_id) closes T-091-23 cross-user reads.
    """
    rows = await pool.fetch(
        """
        SELECT wr.id AS run_id, wr.thread_id, wr.current_phase_id, wr.inputs, t.user_id
        FROM workflow_runs wr
        JOIN threads t ON t.id = wr.thread_id
        WHERE wr.status IN ('active', 'paused')
          AND t.active_workflow_run_id = wr.id
          AND EXISTS (
            SELECT 1 FROM workflow_phases wp
            WHERE wp.workflow_run_id = wr.id
              AND wp.status = 'active'
          )
        """
    )
    return [dict(r) for r in rows]


async def get_active_phase(pool: asyncpg.Pool, run_id: UUID) -> dict | None:
    """The single ``status='active'`` phase row for a stranded run (resume target).

    RUN-KEYED read → ``workflow_run_id`` (NOT ``run_id`` — column does not exist
    on workflow_phases; would raise Postgres 42703). Returns id/slug/phase_index/
    status/output, or ``None`` if no phase is active (already advanced).
    """
    row = await pool.fetchrow(
        """
        SELECT id, slug, phase_index, status, output
        FROM workflow_phases
        WHERE workflow_run_id = $1 AND status = 'active'
        ORDER BY phase_index
        LIMIT 1
        """,
        run_id,
    )
    return dict(row) if row is not None else None


async def ask_user_response_exists(
    pool: asyncpg.Pool, run_id: UUID, tool_call_id: str
) -> bool:
    """True iff a durable ask_user RESPONSE row exists for ``tool_call_id``.

    MIRRORS the panel.py ``/ask_user/pending`` raw query (the NOT-EXISTS half),
    INVERTED: instead of finding prompts WITHOUT a response, we ask whether a
    response row for THIS ``tool_call_id`` exists. The distinguishing shape (from
    runs.py ``/ask_user_response`` step 2 — the durable insert):
      - ``role = 'system'``  (Phase 086: system rows are FILTERED from /snapshot —
        we scan them DIRECTLY the /pending way, NOT the snapshot path)
      - ``tool_calls @> '[{"kind": "ask_user_response"}]'::jsonb``  (the RESPONSE
        kind — the prompt row carries ``kind='ask_user_prompt'`` instead)
      - ``tool_calls->0->>'tool_call_id' = $1``  (the per-call id match)

    The scan is keyed off the run's thread via the workflow_runs FK so it stays
    owner-scoped. True ⇒ answered (resume must NOT re-ask); False ⇒ pending
    (resume re-subscribes + re-emits, subscribe-before-emit).

    RUN-SCOPING (WR-06, 091-08): the response row (runs.py /ask_user_response)
    stores ``kind``/``tool_call_id``/``response_text``/``choice_index`` but NOT a
    ``run_id`` — so we cannot filter the response itself by run. Instead we require
    that a matching PROMPT row (which DOES carry ``run_id`` —
    phase_types.py:331) for the SAME ``tool_call_id`` belongs to THIS run
    (``p.tool_calls->0->>'run_id' = $1::text``). This disambiguates a thread that
    has had multiple workflow runs: the answer counts only when it answers a prompt
    this run issued — not merely the latest answer in the thread.
    """
    found = await pool.fetchval(
        """
        SELECT EXISTS (
            SELECT 1
            FROM messages r
            JOIN workflow_runs wr ON wr.thread_id = r.thread_id
            JOIN messages p
              ON p.thread_id = wr.thread_id
             AND p.role = 'system'
             AND p.tool_calls @> '[{"kind": "ask_user_prompt"}]'::jsonb
             AND p.tool_calls->0->>'tool_call_id' = $2
             AND p.tool_calls->0->>'run_id' = $1::text
            WHERE wr.id = $1
              AND r.role = 'system'
              AND r.tool_calls @> '[{"kind": "ask_user_response"}]'::jsonb
              AND r.tool_calls->0->>'tool_call_id' = $2
        )
        """,
        run_id,
        tool_call_id,
    )
    return bool(found)


async def get_pending_ask_user(pool: asyncpg.Pool, run_id: UUID) -> dict | None:
    """The durable ``ask_user_prompt`` row's payload for a run's active prompt.

    Scans the ``role='system'`` prompt rows (the /pending way, NOT the filtered
    /snapshot path) for this run's thread and returns the LATEST prompt's
    ``tool_calls[0]`` payload (tool_call_id, prompt, options, timeout_seconds) so
    resume re-emits the SAME prompt. Returns ``None`` if no prompt row exists.

    RUN-SCOPING (WR-05, 091-08): the prompt row stores the issuing ``run_id`` at
    ``tool_calls->0->>'run_id'`` (phase_types.py:331). We filter on it
    (``= $1::text``) so a thread with MULTIPLE workflow runs (or multiple prompts)
    re-emits the prompt that actually belongs to THIS run — not merely the newest
    prompt in the thread (which could be a different run's question, making resume
    re-emit the wrong tool_call_id).
    """
    row = await pool.fetchrow(
        """
        SELECT m.tool_calls
        FROM messages m
        JOIN workflow_runs wr ON wr.thread_id = m.thread_id
        WHERE wr.id = $1
          AND m.role = 'system'
          AND m.tool_calls @> '[{"kind": "ask_user_prompt"}]'::jsonb
          AND m.tool_calls->0->>'run_id' = $1::text
        ORDER BY m.created_at DESC
        LIMIT 1
        """,
        run_id,
    )
    if row is None:
        return None
    tcs = row["tool_calls"] or []
    payload = tcs[0] if tcs else {}
    return {
        "tool_call_id": payload.get("tool_call_id"),
        "prompt": payload.get("prompt"),
        "options": payload.get("options"),
        "timeout_seconds": payload.get("timeout_seconds"),
    }


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


async def fail_phase(
    pool: asyncpg.Pool, phase_id: UUID, reason: str, output: dict | None = None
) -> None:
    """Mark a phase ``failed`` with the failure reason in ``output`` (Plan 05).

    101.1 review WR-02: ``output`` (optional, ADDITIVE — both pre-existing callers
    pass nothing and are byte-identical) persists the FULL failure output dict
    alongside the reason — e.g. the cited ``field_map`` an honest emit failure
    carries (D-08: a non-opening render never loses the extracted data). Without
    it the in-memory field-map was dropped on every honest failure, contradicting
    the user-facing "the cited field-map is preserved" copy. ``_failure_reason``
    always wins on a key collision (it is the status-repair scripts' key).
    PHASE-KEYED write → ``WHERE id=$1``.
    """
    payload: dict = {**(output or {}), "_failure_reason": reason}
    await pool.execute(
        "UPDATE workflow_phases SET status='failed', output=$2::jsonb, updated_at=now() WHERE id = $1",
        phase_id,
        json.dumps(payload),
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
    """Terminal run status write (``completed`` / ``failed``) + lock-clear (SC#2).

    workflow_runs table, keyed by its own ``id``. Mirror ``_shielded_finalize``:
    this durable UPDATE happens BEFORE the terminal SSE sentinel.

    Phase 092 (092-03 / SC#2, MODE-02): this is the SINGLE authoritative clear
    site for the ``threads.active_workflow_run_id`` anchor on the workflow_runs
    side (Landmine 5 — clear exactly once across the two run rows). The producer's
    runs-row ``finalize_run`` does NOT also clear it for a harness send — the
    anchor FKs to ``workflow_runs.id``, so this run_id IS the FK target. Both
    writes ride ONE transaction so a terminal run can never leave a dangling
    Harness lock (a crash between the two would otherwise strand the thread). The
    anchor-clear is idempotent: a re-run finds 0 matching rows and no-ops.
    """
    async with pool.acquire() as con:
        async with con.transaction():
            await con.execute(
                "UPDATE workflow_runs SET status = $2 WHERE id = $1",
                run_id,
                status,
            )
            # Clear the per-thread lock anchor in the SAME transaction — no
            # dangling lock survives a terminal run (SC#2). Keyed by the FK
            # target (= this run id), so it only clears the thread this run owns.
            await con.execute(
                "UPDATE threads SET active_workflow_run_id = NULL "
                "WHERE active_workflow_run_id = $1",
                run_id,
            )


async def claim_run(
    pool: asyncpg.Pool, run_id: UUID, lease_seconds: int
) -> bool:
    """CAS-claim a run for single-producer execution via a ``claimed_at`` lease.

    CR-01 fix (091-REVIEW): the prior claim did ``SET status='active' WHERE status
    IN ('active','paused')`` — but ``find_resumable_runs`` already returns ``active``
    rows, so the status never left the claimable set and BOTH WORKER_COUNT=2 workers
    matched the WHERE and got a RETURNING row → the run was re-driven twice (the
    exact Pitfall-7 double-execution this is meant to prevent).

    The real CAS stamps the migration-062 ``claimed_at`` lease and only matches when
    the lease is UNSET or EXPIRED::

        UPDATE workflow_runs
        SET claimed_at = now()
        WHERE id = $1
          AND status IN ('active', 'paused')
          AND (claimed_at IS NULL OR claimed_at < now() - $2::interval)
        RETURNING id

    The winner stamps a fresh ``claimed_at``; a racing loser sees that fresh value →
    0 rows → returns False. A crash-mid-resume run becomes re-claimable once the
    lease (``lease_seconds`` — a named engine/config constant, NOT a magic literal)
    expires, so a dead worker's claim never strands the run forever. ``status`` is
    untouched (the lease is orthogonal to status); ``find_resumable_runs`` keeps
    anchoring on ``status IN ('active','paused')``. workflow_runs table, keyed by id.

    ``lease_seconds`` is passed as a Postgres interval via ``make_interval`` so the
    parameter stays a plain ``$N`` (no f-string on SQL — T-091-03).
    """
    row = await pool.fetchrow(
        """
        UPDATE workflow_runs
        SET claimed_at = now()
        WHERE id = $1
          AND status IN ('active', 'paused')
          AND (claimed_at IS NULL OR claimed_at < now() - make_interval(secs => $2))
        RETURNING id
        """,
        run_id,
        lease_seconds,
    )
    return row is not None


# ── harness_audit (this table's own column IS run_id — correct) ──────────────
async def write_audit(
    pool: asyncpg.Pool,
    run_id: UUID,
    *,
    user_id: UUID | None,
    event_type: str,
    metadata: dict,
) -> None:
    """INSERT one ``harness_audit`` row (INSERT-only RLS).

    ``event_type`` MUST be one of the 22 kinds in the 059 + 069 + 070 CHECK (9
    harness lifecycle/gate kinds + 7 Phase-101.1 emit-transition kinds + 6
    Phase-102 judge/publish/policy/ask_user-approval receipt kinds) — asserted
    here against ``_AUDIT_EVENT_TYPES`` so a typo fails fast in tests (ValueError),
    not as a Postgres 23514 mid-run (Pitfall 6). The ``harness_audit`` table's
    own foreign-key column IS ``run_id`` — this predicate is correct.

    Phase 092-05 F1: ``harness_audit.user_id`` is NOT NULL, but this INSERT
    previously OMITTED it — the first audit write of any live run raised
    ``NotNullViolationError`` and killed the run before any phase executed (the
    bug was mock-only-invisible until the first live run in Phase 092). The
    run-owner ``user_id`` (threaded from ``ctx.current_user`` at every call site)
    is now bound explicitly. It is keyword-only so no caller can re-introduce the
    omission silently.
    """
    if event_type not in _AUDIT_EVENT_TYPES:
        raise ValueError(
            f"write_audit event_type must be one of the 22 harness_audit kinds "
            f"(059 + 069 + 070), got {event_type!r}"
        )
    await pool.execute(
        "INSERT INTO harness_audit (run_id, user_id, event_type, metadata) "
        "VALUES ($1, $2, $3, $4::jsonb)",
        run_id,
        user_id,
        event_type,
        json.dumps(metadata),
    )
