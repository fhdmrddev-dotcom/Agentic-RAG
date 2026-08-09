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
route through the per-request ``get_user_pg_connection`` (Phase 163 D-02 — SET
LOCAL ROLE authenticated, RLS-enforced) because supabase-py cannot natively
express those filters.
"""
from __future__ import annotations

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from supabase import Client

# Phase 163 (D-02/D-03): all three panel reads are request-scoped → the RLS-enforced
# per-request user-JWT client (supabase) + get_user_pg_connection for the jsonb/subquery
# reads that supabase-py can't express (SET LOCAL ROLE authenticated). No producer path.
from app.dependencies import (
    get_current_user,
    get_user_pg_connection,
    get_user_supabase_client,
)
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
    supabase: Client = Depends(get_user_supabase_client),
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


# Terminal workflow_runs statuses (byte-matched to threads.py:815
# _TERMINAL_WORKFLOW and the workflow_runs_status_check CHECK constraint).
_TERMINAL_WORKFLOW_STATUSES = ("completed", "failed", "cancelled")


async def _prompt_run_is_live(pool, run_id_text: str | None) -> bool:
    """D-06 (BUG-260605-01): liveness of the run that owns an ask_user prompt.

    The prompt payload's ``run_id`` lives in ONE of two ID namespaces (the F10
    dual namespace, runs.py:521-567): a ``workflow_runs.id`` (harness
    llm_human_input prompts) or a ``runs.run_id`` (Deep ask_user prompts).
    Resolve in that order and apply the namespace's own liveness rule:

      - harness: live iff status is non-terminal AND the run is still the
        thread's ``active_workflow_run_id`` anchor — mirroring the runs.py
        anchor-confirm a submit would hit (a non-anchor prompt 404s there, so
        serving it is dishonest).
      - Deep: live iff ``runs.status = 'streaming'`` (a pending Deep prompt
        only exists while the agent loop blocks inside a streaming run).
      - unknown/legacy (neither namespace resolves, or no run_id at all):
        fail OPEN — never break legacy prompts (Pitfall 6).

    This only NARROWS the owner-scoped row set the caller already fetched
    (ownership gate runs first, unchanged); the lookups read run STATUS for
    prompts the user owns — no cross-user reads (T-096-03-02). Constant query
    strings, $-parameterized ids only (T-096-03-03); the uuid columns are
    compared via ``::text`` casts so malformed ids can never raise.
    """
    if not run_id_text:
        return True  # legacy prompt rows carry no run_id — fail-open
    wf_row = await pool.fetchrow(
        """
        SELECT wr.status, t.active_workflow_run_id
        FROM workflow_runs wr
        LEFT JOIN threads t ON t.id = wr.thread_id
        WHERE wr.id::text = $1
        """,
        run_id_text,
    )
    if wf_row is not None:
        if wf_row["status"] in _TERMINAL_WORKFLOW_STATUSES:
            return False
        anchor = wf_row["active_workflow_run_id"]
        return anchor is not None and str(anchor) == str(run_id_text)
    deep_row = await pool.fetchrow(
        "SELECT status FROM runs WHERE run_id::text = $1",
        run_id_text,
    )
    if deep_row is not None:
        return deep_row["status"] == "streaming"
    return True  # unknown namespace — fail-open (never eat legacy prompts)


@router.get("/ask_user/pending")
async def get_pending_ask_user(
    thread_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
):
    """Phase 085 D-085-23 — ask_user_prompt rows without a matching ask_user_response.

    Uses asyncpg directly for the jsonb ``@>`` containment scan + ``NOT EXISTS``
    subquery (supabase-py doesn't natively express these). Per RESEARCH §D.4.

    RLS is enforced via the thread-ownership gate (the supabase-py SELECT in
    ``_verify_thread_ownership`` runs under the service-role chain that respects
    the threads-table RLS policies). The subsequent asyncpg query filters by
    thread_id explicitly — combining the ownership gate with the explicit
    thread_id filter closes the cross-user disclosure threat (T-085-T19).
    """
    await _verify_thread_ownership(thread_id, current_user, supabase)
    # Phase 163 (D-02): the jsonb @> / NOT-EXISTS scan + the per-prompt liveness
    # reads (_prompt_run_is_live) run under RLS on the per-request user-JWT connection
    # (SET LOCAL ROLE authenticated) — no more connectionless BYPASSRLS pool. The
    # ownership gate above already 404'd a non-owner; the thread_id filter + RLS combine
    # to keep this owner-scoped. `conn` is passed where `pool` was (asyncpg Connection
    # exposes the same fetch/fetchrow — _prompt_run_is_live is duck-typed over both).
    async with get_user_pg_connection(request, current_user) as conn:
        rows = await conn.fetch(
            """
            SELECT m.id, m.tool_calls, m.created_at
            FROM messages m
            WHERE m.thread_id = $1
              AND m.role = 'system'
              AND m.tool_calls @> '[{"kind": "ask_user_prompt"}]'::jsonb
              AND NOT EXISTS (
                SELECT 1 FROM messages r
                WHERE r.thread_id = m.thread_id
                  AND r.role = 'system'
                  AND r.tool_calls @> '[{"kind": "ask_user_response"}]'::jsonb
                  AND r.tool_calls->0->>'tool_call_id' = m.tool_calls->0->>'tool_call_id'
              )
            ORDER BY m.created_at ASC
            """,
            UUID(thread_id),
        )
        result = []
        for r in rows:
            tcs = r["tool_calls"] or []
            payload = tcs[0] if tcs else {}
            # D-06 (BUG-260605-01): liveness filter — never return a prompt whose
            # owning run is dead (BOTH ID namespaces; legacy prompts fail open).
            # Closes every historical orphan the terminal-site cleanup (new runs,
            # harness_engine.py) can never touch. Pending prompts per thread are
            # ~0-2, so the per-prompt status lookups are negligible.
            if not await _prompt_run_is_live(conn, payload.get("run_id")):
                continue
            result.append({
                "message_id": str(r["id"]),
                "tool_call_id": payload.get("tool_call_id"),
                "prompt": payload.get("prompt"),
                "options": payload.get("options"),
                "timeout_seconds": payload.get("timeout_seconds"),
                "run_id": payload.get("run_id"),
                # D-12: the prior-phase draft the user is confirming (defensive .get —
                # older prompt rows predate the draft field → None, harmless).
                "draft": payload.get("draft"),
                "created_at": r["created_at"].isoformat() if r["created_at"] else None,
            })
        return result


@router.get("/tasks")
async def get_thread_tasks(
    thread_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
):
    """Phase 085 D-085-23 — sub-agent run index for Phase 087 drill-down.

    Returns runs whose ``parent_run_id`` is a run owned by the current user in
    this thread. Per RESEARCH §D.5. Frontend joins with ``sub_agent_start`` SSE
    payload for description/tools/max_steps (those live in messages.tool_calls
    on the parent's stream).

    The subquery ``parent_run_id IN (SELECT run_id FROM runs WHERE thread_id =
    $1 AND user_id = $2)`` is the cross-thread + cross-user gate — sub-agents
    only show up for parents the caller owns in this thread (T-085-T19,
    FC#9).
    """
    await _verify_thread_ownership(thread_id, current_user, supabase)
    # Phase 163 (D-02): the sub-agent index read runs under RLS on the per-request
    # user-JWT connection (SET LOCAL ROLE authenticated). The subquery's explicit
    # thread_id + user_id gate stays as belt-and-suspenders (D-14) alongside RLS.
    async with get_user_pg_connection(request, current_user) as conn:
        rows = await conn.fetch(
            """
            SELECT r.run_id AS sub_run_id, r.started_at, r.completed_at,
                   r.status, r.model, r.provider, r.parent_run_id
            FROM runs r
            WHERE r.parent_run_id IN (
              SELECT run_id FROM runs
              WHERE thread_id = $1 AND user_id = $2
            )
            ORDER BY r.started_at DESC
            """,
            UUID(thread_id), UUID(current_user["id"]),
        )
        return [
            {
                "sub_run_id": str(r["sub_run_id"]),
                "parent_run_id": str(r["parent_run_id"]) if r["parent_run_id"] else None,
                "status": r["status"],
                "model": r["model"],
                "provider": r["provider"],
                "started_at": r["started_at"].isoformat() if r["started_at"] else None,
                "completed_at": r["completed_at"].isoformat() if r["completed_at"] else None,
            }
            for r in rows
        ]
