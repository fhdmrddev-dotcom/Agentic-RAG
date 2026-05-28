"""Phase 085 D-085-23 — REST endpoints for thread-scoped panel data.

Consumed by Phase 086 (StreamsProvider reconcile-on-thread-switch via fetch
per D-v2.5-03) + Phase 087 (Panel UI).

Endpoints:
  - GET /threads/{thread_id}/todos                — current todo list (D-085-22)
  - GET /threads/{thread_id}/ask_user/pending     — pending ask_user prompts (D-085-05)
  - GET /threads/{thread_id}/tasks                — sub-agent run index (D-085-14)

All endpoints follow the existing thread-scoped pattern from
``backend/app/api/workspace.py`` (Phase 084, D-08): a small
``_verify_thread_ownership`` helper short-circuits to 404 (NOT 403) on
cross-user attempts per D-062-12 (never leak resource existence), then
the body issues RLS-aware reads via supabase-py / asyncpg.

Sync supabase-py calls are wrapped via ``aexec`` (Phase 058 D-058-03 — runs
``execute()`` in a threadpool). The jsonb @> / parent_run_id subquery paths
route through the asyncpg pool from ``get_pg_pool`` because supabase-py
cannot natively express those filters.
"""
from __future__ import annotations

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client

from app.dependencies import get_current_user, get_pg_pool, get_supabase
from app.utils.db import aexec

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/threads/{thread_id}",
    tags=["panel"],
)


async def _verify_thread_ownership(
    thread_id: str,
    current_user: dict,
    supabase: Client,
) -> None:
    """Verify the authenticated user owns this thread. Raises 404 on failure.

    Uses 404 not 403 to prevent existence-leak (D-062-12 convention) — every
    Phase 085 GET endpoint goes through this gate. Mirrors the exact shape from
    workspace.py:27-49.
    """
    resp = await aexec(
        supabase.table("threads")
        .select("id")
        .eq("id", thread_id)
        .eq("user_id", current_user["id"])
        .maybe_single()
    )
    row = resp.data if resp is not None else None
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Thread not found",
        )


@router.get("/todos")
async def get_thread_todos(
    thread_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """Phase 085 D-085-23 — current canonical todo list for the thread.

    Returns the list sorted by ``(order_index ASC, created_at ASC)``. Each row
    is reshaped from the DB column ``todo_id`` to the wire-format key ``id``
    so the response matches the ``todo_updated`` SSE event payload shape
    (RESEARCH §F).
    """
    await _verify_thread_ownership(thread_id, current_user, supabase)
    resp = await aexec(
        supabase.table("todos")
        .select("todo_id, content, status, parent_id, order_index, created_at, updated_at")
        .eq("thread_id", thread_id)
        .order("order_index")
        .order("created_at")
    )
    rows = resp.data or []
    return [
        {
            "id": r["todo_id"],
            "content": r["content"],
            "status": r["status"],
            "parent_id": r["parent_id"],
            "order_index": r["order_index"],
            "created_at": r["created_at"],
            "updated_at": r["updated_at"],
        }
        for r in rows
    ]
