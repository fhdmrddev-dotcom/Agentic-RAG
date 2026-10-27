"""asyncpg-backed write helpers for the runs + messages tables (Phase 073 — D-073-05).

These three helpers replace the three SC-named aexec() call sites in
backend/app/api/threads.py (replaced by Plan 04):
  - insert_run                -> threads.py:974   (runs INSERT at request entry)
  - finalize_run              -> threads.py:2651  (runs UPDATE inside _shielded_finalize)
  - insert_assistant_message  -> threads.py:1310  (messages INSERT inside _persist_assistant_message)

Every cold-path call site STAYS on aexec per D-073-04.

JSONB codec (D-073-06) is registered on the pool at init time via
app.dependencies._init_pg_connection — call sites here pass plain Python
dicts/lists for tool_calls / source_refs. No per-call serialization here.

SECURITY (T-073-02): ALL value substitutions use $N positional placeholders.
No f-strings or string-interpolation methods on SQL strings, ever. asyncpg's
native parameter binding makes SQL injection impossible at this layer.

Phase 163 (D-05) — org posture of this module (the agent-loop async writer path):
  * This module runs on the RAW service-role asyncpg pool (get_pg_pool → the
    postgres/BYPASSRLS role). It has NO auth.uid() (it executes off the request,
    inside the detached producer/agent-loop task), so it is NOT converted to the
    per-request user-JWT client — the request-seam swap (D-03) covers the REST path.
  * ~~WRITES stay org-safe WITHOUT threading org_id: insert_run / insert_assistant_message
    OMIT org_id → the mig-106 BEFORE-INSERT autofill triggers (runs_autofill_org_id /
    messages autofill-from-parent-thread) stamp it from the parent.~~ finalize_run is a
    PK-keyed UPDATE (WHERE run_id = $1, globally unique) — no cross-org ambiguity.
    ⚠ CORRECTED 268 (D-268-07 / D-268-22 / SEED-314) — the struck sentence is kept, not deleted,
    because it was true only for a person in ONE org. The mig-106 trigger picks
    ``SELECT org_id FROM org_members WHERE user_id = … LIMIT 1`` with no ORDER BY, so for a
    two-org user it guesses, and a turn sent with a validated ``X-Org-Id`` of B landed its run and
    messages in A. Both writers now take an optional ``org_id``: the send path passes the
    validated active org explicitly; ``None`` still falls to the trigger (it short-circuits only on
    ``NEW.org_id IS NOT NULL``), so a single-org / no-header caller is byte-identical. A sub-agent
    row copies its PARENT's org in SQL (``insert_run``), never the trigger's guess.
  * OWNERSHIP READS are widened org-aware as defense-in-depth: load_cap_paused_tool_calls
    accepts an optional org_id and adds `AND org_id = $2` when the caller has org context
    (belt-and-suspenders on the service-role path — D-14), else stays byte-identical.
"""

from datetime import datetime
from uuid import UUID

import asyncpg


async def insert_run(
    pool: asyncpg.Pool,
    *,
    run_id: UUID,
    thread_id: UUID,
    user_id: UUID,
    status: str,
    model: str,
    provider: str,
    spawned_by_worker: str | None = None,
    parent_run_id: UUID | None = None,
    org_id: UUID | None = None,
    expert_id: UUID | None = None,
) -> None:
    """Insert a new runs row at request entry (Phase 073 - replaces threads.py:974 aexec).

    Phase 268 (METER-08 / D-268-05 / D-268-07 / D-268-19) — the ONE place a run is born, so the
    ONE place its attribution is stamped:

      - ``expert_attributed`` is written ``true`` IN SQL on every row, never bound — no caller
        can forget it or pass ``false``. ``false`` (the mig-197 default) means only "Not recorded
        (before 268)".
      - A ROOT row (``parent_run_id`` None) takes ``expert_id`` as passed (the access-checked
        ``ThreadScoping.born_for_bundle_id`` on the Deep send path; ``None`` = No Expert for
        harness / eval / golden / resume shells) and ``org_id`` as passed (``None`` falls to the
        mig-106 trigger — byte-identical for single-org callers).
      - A SUB-AGENT row copies its PARENT's ``org_id``, ``expert_id`` and ``expert_attributed``
        in the same statement (``LEFT JOIN public.runs p``). The call site passes nothing, so it
        cannot pass a second value that disagrees. If the parent row is missing, the root rules
        apply to the NULL join (org falls to the trigger; attributed stays true).
      - ``test_268_insert_run_sites.py`` pins every caller of this function with a disposition.

    Schema constraints (supabase/full-schema.sql:459-473):
      - status: NOT NULL, CHECK IN ('streaming','completed','failed','cancelled','timed_out')
      - model: NOT NULL
      - provider: NOT NULL (Pitfall 6 - _resolved_provider must always be set)
      - started_at: DEFAULT now() - omitted here so Postgres fills it
      - input_tokens / output_tokens / completed_at / message_id / error: left NULL until finalize
      - spawned_by_worker: nullable TEXT, OS PID of the worker that created the run (Phase 079 / D-PRD-12)
      - parent_run_id: nullable UUID FK to runs.run_id (Phase 085 / D-085-14), non-null
        for sub-agent runs spawned via the ``task`` tool. Column added by migration 055
        (ON DELETE SET NULL — deleting a parent does NOT cascade to child rows).
        Default ``None`` preserves backward compat for all existing top-level callers.
    """
    await pool.execute(
        """
        INSERT INTO runs (run_id, thread_id, user_id, status, model, provider,
                          spawned_by_worker, parent_run_id,
                          org_id, expert_id, expert_attributed)
        SELECT $1::uuid, $2::uuid, $3::uuid, $4::text, $5::text, $6::text, $7::text, $8::uuid,
               COALESCE(p.org_id, $9::uuid),
               CASE WHEN $8::uuid IS NULL THEN $10::uuid ELSE p.expert_id END,
               CASE WHEN $8::uuid IS NULL THEN true ELSE COALESCE(p.expert_attributed, true) END
        FROM (SELECT 1) one
        LEFT JOIN public.runs p ON p.run_id = $8::uuid
        """,
        run_id,
        thread_id,
        user_id,
        status,
        model,
        provider,
        spawned_by_worker,
        parent_run_id,
        org_id,
        expert_id,
    )


async def link_run_message(
    pool: asyncpg.Pool,
    *,
    run_id: UUID,
    message_id: UUID,
) -> None:
    """Link a run to its assistant message the moment the message is saved (BUG-261015-05).

    ``finalize_run`` also writes ``message_id``, but only at end-of-stream. Work that runs after
    the answer is saved (the suggestions call) left a window where a messages fetch returned the
    reply with ``run_id = null``, and the chat rendered it beside the live streaming copy. The
    ``message_id IS NULL`` guard never re-points a run that is already linked.
    """
    await pool.execute(
        "UPDATE runs SET message_id = $2 WHERE run_id = $1 AND message_id IS NULL",
        run_id,
        message_id,
    )


async def finalize_run(
    pool: asyncpg.Pool,
    *,
    run_id: UUID,
    status: str,
    error: str | None,
    completed_at: datetime,
    message_id: UUID | None,
    input_tokens: int | None,
    output_tokens: int | None,
) -> None:
    """Finalize a runs row at end-of-stream (Phase 073 - replaces threads.py:2651 aexec).

    TOKEN-COL-01 (D-073-07 / D-073-09):
      - input_tokens / output_tokens may be None (NULL write) if the SDK never
        surfaced usage on any iteration. Callers that detect this case MUST
        emit ``logger.warning('runs.usage missing for run=%s provider=%s model=%s', ...)``
        BEFORE calling finalize_run with None/None.
      - When non-None, the values are the SUM across all LLM iterations in the run.

    error column is TEXT (not JSONB) per supabase/full-schema.sql:471.
    """
    await pool.execute(
        """
        UPDATE runs
        SET status = $2,
            error = $3,
            completed_at = $4,
            message_id = $5,
            input_tokens = $6,
            output_tokens = $7
        WHERE run_id = $1
        """,
        run_id,
        status,
        error,
        completed_at,
        message_id,
        input_tokens,
        output_tokens,
    )


async def load_cap_paused_tool_calls(
    pool: asyncpg.Pool, thread_id: UUID, *, org_id: UUID | None = None
) -> list[dict]:
    """The persisted dropped tool calls from the LATEST cap-pause carrier row.

    Phase 092 (092-03 / SC#4). At the iteration cap, ``persist_cap_paused``
    (agent_loop.py) writes a durable ``role='system'`` carrier row whose
    ``tool_calls`` jsonb tags each dropped call ``kind='iteration_cap_paused'``
    (name + arguments + tool_call_id). The Continue endpoint reads them back here
    so the continuation CONSUMES the EXACT calls (re-executes them) instead of
    re-dropping or starting fresh — SC#4.

    Scans the carrier the /pending way (system rows are filtered from /snapshot),
    keyed by the run's thread, newest first. Returns ``[]`` when no carrier exists.
    ``$N`` placeholders only (T-073-02).

    Phase 163 (D-05 / D-14): this runs on the service-role pool (no auth.uid()). When
    the caller has org context (``org_id`` — e.g. continue_run threads it from the
    RLS-verified run row), an ``AND org_id = $2`` predicate is added as belt-and-
    suspenders org-scoping on the BYPASSRLS path. ``org_id=None`` keeps the read
    byte-identical (back-compat for any caller without org context).
    """
    if org_id is not None:
        row = await pool.fetchrow(
            """
            SELECT tool_calls
            FROM messages
            WHERE thread_id = $1
              AND org_id = $2
              AND role = 'system'
              AND tool_calls @> '[{"kind": "iteration_cap_paused"}]'::jsonb
            ORDER BY created_at DESC
            LIMIT 1
            """,
            thread_id, org_id,
        )
    else:
        row = await pool.fetchrow(
            """
            SELECT tool_calls
            FROM messages
            WHERE thread_id = $1
              AND role = 'system'
              AND tool_calls @> '[{"kind": "iteration_cap_paused"}]'::jsonb
            ORDER BY created_at DESC
            LIMIT 1
            """,
            thread_id,
        )
    if row is None:
        return []
    # Phase 292.1 (D-07, Pitfall 2): an empty-queue pause writes ONE name-less marker entry so the
    # filter above still matches THAT pause (an empty array would fall through to an older pause and
    # re-run its stale calls). The marker is not a call: drop it, so Continue dispatches nothing.
    return [tc for tc in (row["tool_calls"] or []) if isinstance(tc, dict) and tc.get("name")]


async def run_is_cap_paused(conn, run_id: UUID, *, org_id: UUID | None = None) -> bool:
    """Is this run paused at the tool-round limit, the way the system actually records a pause?

    292.1-REVIEW CR-01 / CR-02 — the ONE home of this predicate (the Continue endpoint's SEED-324
    409 and the typed-continue gate both call it). ⛔ ``runs.status`` alone cannot answer it: a
    FIRST-turn pause finalizes as ``completed`` BY DESIGN (run_producer: the pause fact lives in
    ``result_sink["cap_disposition"]`` and in the carrier row; Phase 250 LOCK-2 /
    test_250_reconciler_gate / test_244 pin that). Only a continuation that re-pauses writes
    ``cap_paused``. So a run is paused when:

      * ``status = 'cap_paused'`` (a continuation re-paused), OR
      * ``status = 'completed'`` AND it is a root run (never a sub-agent row) AND it was never
        continued (``continues_used = 0`` — a continued run that ends ``completed`` finished; one
        that re-paused reads ``cap_paused``) AND the thread's LATEST cap carrier was written at or
        after this run's ``started_at`` AND no newer root run started in the thread since (the 244
        rule: the pause belongs to the latest run or to nobody).

    ``conn`` is anything with ``fetchrow`` (the service pool or a per-request user connection).
    ``org_id`` org-scopes the carrier read the way ``load_cap_paused_tool_calls`` does; ``None``
    leaves it unscoped. ``$N`` placeholders only (T-073-02). A missing row is not paused.
    """
    row = await conn.fetchrow(
        """
        SELECT COALESCE(
            r.status = 'cap_paused'
            OR (
                r.status = 'completed'
                AND r.parent_run_id IS NULL
                AND COALESCE(r.continues_used, 0) = 0
                AND (
                    SELECT max(m.created_at)
                    FROM messages m
                    WHERE m.thread_id = r.thread_id
                      AND ($2::uuid IS NULL OR m.org_id = $2::uuid)
                      AND m.role = 'system'
                      AND m.tool_calls @> '[{"kind": "iteration_cap_paused"}]'::jsonb
                ) >= r.started_at
                AND NOT EXISTS (
                    SELECT 1
                    FROM runs n
                    WHERE n.thread_id = r.thread_id
                      AND n.parent_run_id IS NULL
                      AND n.run_id <> r.run_id
                      AND n.started_at > r.started_at
                )
            ),
            false
        ) AS paused
        FROM runs r
        WHERE r.run_id = $1
        """,
        run_id, org_id,
    )
    return bool(row is not None and row["paused"])


async def insert_assistant_message(
    pool: asyncpg.Pool,
    *,
    thread_id: UUID,
    user_id: UUID,
    content: str,
    tool_calls: list[dict] | None = None,
    source_refs: list[dict] | None = None,
    confidence_level: str | None = None,
    confidence_avg_similarity: float | None = None,
    confidence_disclaimer: str | None = None,
    reasoning_content: str | None = None,
    origin: str = "deep",
    org_id: UUID | None = None,
) -> UUID:
    """Insert an assistant message row (Phase 073 - replaces threads.py:1310 aexec).

    Returns the inserted message id (UUID) via the SQL RETURNING clause, so
    _persist_assistant_message can cache it for the runs UPDATE message_id
    column (Phase 061 D-061-05 contract).

    JSONB codec (D-073-06) registered on the pool init means tool_calls /
    source_refs flow as plain Python lists - NO per-call serialization.

    role is hardcoded to 'assistant' (this helper is named ...assistant_message;
    the schema CHECK constraint enforces role IN ('user','assistant')).

    Phase 268 (D-268-07 / D-268-22): ``org_id`` is the turn's validated active org, bound as
    ``$11``. ``None`` binds NULL, and the mig-106 trigger still fills it (it short-circuits only
    on ``NEW.org_id IS NOT NULL``) — byte-identical for single-org / no-header callers.
    """
    return await pool.fetchval(
        """
        INSERT INTO messages (
            thread_id, user_id, role, content,
            tool_calls, source_refs,
            confidence_level, confidence_avg_similarity, confidence_disclaimer,
            reasoning_content, origin, org_id
        )
        VALUES ($1, $2, 'assistant', $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id
        """,
        thread_id,
        user_id,
        content,
        tool_calls,
        source_refs,
        confidence_level,
        confidence_avg_similarity,
        confidence_disclaimer,
        reasoning_content,
        origin,
        org_id,
    )
