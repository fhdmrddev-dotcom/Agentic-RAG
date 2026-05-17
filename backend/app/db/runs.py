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
) -> None:
    """Insert a new runs row at request entry (Phase 073 - replaces threads.py:974 aexec).

    Schema constraints (supabase/full-schema.sql:459-473):
      - status: NOT NULL, CHECK IN ('streaming','completed','failed','cancelled','timed_out')
      - model: NOT NULL
      - provider: NOT NULL (Pitfall 6 - _resolved_provider must always be set)
      - started_at: DEFAULT now() - omitted here so Postgres fills it
      - input_tokens / output_tokens / completed_at / message_id / error: left NULL until finalize
    """
    await pool.execute(
        """
        INSERT INTO runs (run_id, thread_id, user_id, status, model, provider)
        VALUES ($1, $2, $3, $4, $5, $6)
        """,
        run_id,
        thread_id,
        user_id,
        status,
        model,
        provider,
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
) -> UUID:
    """Insert an assistant message row (Phase 073 - replaces threads.py:1310 aexec).

    Returns the inserted message id (UUID) via the SQL RETURNING clause, so
    _persist_assistant_message can cache it for the runs UPDATE message_id
    column (Phase 061 D-061-05 contract).

    JSONB codec (D-073-06) registered on the pool init means tool_calls /
    source_refs flow as plain Python lists - NO per-call serialization.

    role is hardcoded to 'assistant' (this helper is named ...assistant_message;
    the schema CHECK constraint enforces role IN ('user','assistant')).
    """
    return await pool.fetchval(
        """
        INSERT INTO messages (
            thread_id, user_id, role, content,
            tool_calls, source_refs,
            confidence_level, confidence_avg_similarity, confidence_disclaimer
        )
        VALUES ($1, $2, 'assistant', $3, $4, $5, $6, $7, $8)
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
    )
