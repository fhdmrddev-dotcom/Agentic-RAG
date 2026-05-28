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
