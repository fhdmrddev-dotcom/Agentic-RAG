"""Phase 085 D-085-17..22 — write_todos full-state-replace service.

Single async entry point ``replace_todos`` overwrites all todos for a thread in
one asyncpg transaction (DELETE all + INSERT new). Concurrent writers can't
interleave thanks to Postgres MVCC — last writer wins by commit order.

Validation runs BEFORE the DELETE so a malformed payload never wipes state.
"""
from __future__ import annotations

import logging
import time
from typing import TYPE_CHECKING
from uuid import UUID

if TYPE_CHECKING:
    import asyncpg

logger = logging.getLogger(__name__)


_ALLOWED_STATUS = {"pending", "in_progress", "completed"}


class TodosValidationError(ValueError):
    """Raised when todo payload validation fails before the DB transaction starts.

    The dispatcher handler converts this to a ``ToolResult`` error string so the
    LLM gets a clear retry hint without exposing internal exception details.
    """


async def replace_todos(
    pool: "asyncpg.Pool",
    thread_id: UUID,
    todos: list[dict],
) -> dict:
    """Full-state-replace per D-085-18.

    Pre-validates every todo (status in enum, id + content required) BEFORE the
    DELETE so a malformed payload never wipes state. Then within ONE asyncpg
    transaction: DELETE all rows for the thread, then INSERT the new list.

    Empty ``todos`` is supported — clears all rows for the thread and returns
    ``{"accepted": 0, "version": <ms-timestamp>}``.

    Args:
        pool: asyncpg pool (jsonb codec registered at init per D-073-06; not
            used here but pool is passed for consistency with other services).
        thread_id: parent thread UUID.
        todos: list of dicts with keys ``id`` (str), ``content`` (str),
            ``status`` (str in {pending, in_progress, completed}),
            ``parent_id`` (str | None, optional), ``order_index`` (int, optional).

    Returns:
        ``{"accepted": <count>, "version": <ms-timestamp>}`` per D-085-17.

    Raises:
        TodosValidationError: payload validation failed; transaction did NOT run.
    """
    for t in todos:
        if not isinstance(t, dict):
            raise TodosValidationError(
                "each todo must be an object with id, content, status"
            )
        if not t.get("id") or not t.get("content"):
            raise TodosValidationError("each todo requires id and content")
        if t.get("status") not in _ALLOWED_STATUS:
            raise TodosValidationError(
                f"invalid status {t.get('status')!r}; "
                f"must be one of {sorted(_ALLOWED_STATUS)}"
            )

    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute(
                "DELETE FROM todos WHERE thread_id = $1",
                thread_id,
            )
            if todos:
                rows = [
                    (
                        thread_id,
                        t["id"],
                        t["content"],
                        t["status"],
                        t.get("parent_id"),
                        int(t.get("order_index", 0)),
                    )
                    for t in todos
                ]
                await conn.executemany(
                    """INSERT INTO todos
                       (thread_id, todo_id, content, status, parent_id, order_index)
                       VALUES ($1, $2, $3, $4, $5, $6)""",
                    rows,
                )
    return {"accepted": len(todos), "version": int(time.time() * 1000)}


# Phase 138 RUN-01b (D-03) — exact honesty marker appended to still-open todos on
# a genuinely-clean run end. LEADING SPACE so it joins as a suffix; the dash is an
# EM-DASH (—, U+2014). Single source of truth for BOTH the append and the
# no-stack detection (D-04) — never edit one without the other.
_RUN_ENDED_MARKER = " (run ended — not completed)"


async def reconcile_open_todos_on_run_end(
    pool: "asyncpg.Pool",
    thread_id: UUID,
    emit=None,
    redis=None,
    run_id=None,
) -> None:
    """RUN-01b: on a genuinely-clean run end, mark still-open todos as not completed.

    When a run ends cleanly (the CALLER gates on that — see threads.py's
    ``_shielded_finalize`` / ``spawn_continuation_run._finalize``) but pending or
    in_progress todos remain on the list, the Workspace TODOS panel would otherwise
    read as permanently stuck. This appends a plain-text honesty marker to each
    open todo's ``content`` (D-01/D-02/D-03) — the marker rides on the existing text
    field so there is zero schema/enum/frontend change. It NEVER flips ``status`` to
    completed (honesty guardrail — an open item is never silently auto-completed).

    Behaviour:
      * Full-state-replace via ``replace_todos`` is the ONLY mutation path (S1) —
        completed items pass through untouched; open items get the content marker.
      * The marker never stacks (D-04): an item already carrying the suffix is
        detected and skipped.
      * No-op is byte-clean (D-14): when nothing is open (or every open item is
        already marked) there is NO ``replace_todos`` call and NO emit.
      * Forward-only (D-06) — this only affects the run that just ended.
      * Best-effort by contract: the caller additionally wraps this so it can never
        raise into the byte-locked finalizer; the no-op path here does not raise.

    Args:
        pool: asyncpg pool.
        thread_id: the run's own thread UUID (never request-supplied here).
        emit: optional module-level ``_emit`` callable ``(redis, run_id, event, **kw)``
            — when provided AND a change occurred, a ``todo_updated`` event is
            re-emitted with the full canonical list (S2), mirroring
            ``_handle_write_todos`` exactly.
        redis: redis client for the emit (unused when ``emit`` is None).
        run_id: run id for the emit (unused when ``emit`` is None).
    """
    # 1. Re-SELECT the canonical list — SAME ordering as _handle_write_todos (S2).
    rows = await pool.fetch(
        "SELECT todo_id AS id, content, status, parent_id, order_index "
        "FROM todos WHERE thread_id = $1 ORDER BY order_index, created_at",
        thread_id,
    )
    todos = [dict(r) for r in rows]
    _marker_bare = _RUN_ENDED_MARKER.strip()
    changed = False
    for t in todos:
        # D-02: pending AND in_progress get the IDENTICAL suffix (one code path).
        if t["status"] in ("pending", "in_progress") and not t["content"].rstrip().endswith(_marker_bare):
            t["content"] = t["content"] + _RUN_ENDED_MARKER
            # D-01 honesty guardrail: status is left UNCHANGED — never auto-complete.
            changed = True

    # D-14: nothing open, or every open item already marked → do NOTHING
    # (no replace_todos, no emit — Deep Mode stays byte-identical).
    if not changed:
        return

    # S1 full-state-replace — hand back the FULL list; completed items are untouched.
    await replace_todos(pool, thread_id, todos)

    # 2. Re-select + emit todo_updated — IDENTICAL wire shape to every other todo
    #    update (S2), so the live SSE consumer's TodosSection re-renders honestly.
    if emit is not None:
        rows2 = await pool.fetch(
            "SELECT todo_id AS id, content, status, parent_id, order_index "
            "FROM todos WHERE thread_id = $1 ORDER BY order_index, created_at",
            thread_id,
        )
        await emit(redis, run_id, "todo_updated", todos=[dict(r) for r in rows2])
