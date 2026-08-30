"""Phase 217.1 (BE-6) — checked queries CRUD + evaluation trigger.

Routes:

  GET    /checked-queries                        list the caller's checked queries
  POST   /checked-queries                        create a checked query
  PATCH  /checked-queries/{id}                   edit the question / expected document
  DELETE /checked-queries/{id}                   delete a checked query
  POST   /checked-queries/{id}/check             evaluate ONE query (BackgroundTasks)
  POST   /checked-queries/check-all              evaluate ALL the caller's queries (BackgroundTasks)

OWNER-SCOPING IS BELT-AND-SUSPENDERS BEHIND RLS (same idiom as ``skill_test_cases.py``):
the per-request user-JWT client is the PRIMARY runtime gate; the app-code ``.eq("user_id",
current_user["id"])`` on EVERY query is the D-14 second layer. A non-matching id returns 404
(never 403 — don't leak existence).

``expected_document_id`` is verified via ``_verify_owned_document`` (404, not 403) so a forged
id pointing at another user's document cannot be probed through the rank result.

``user_id`` comes from the authenticated caller, NEVER the request body.

Read-only by construction: no service-role client is used or needed.
"""
from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from supabase import Client

from app.dependencies import get_current_user, get_user_supabase_client
from app.models.checked_query import CheckedQueryCreate, CheckedQueryResponse, CheckedQueryUpdate
from app.services.checked_query_service import evaluate_check
from app.utils.db import aexec

router = APIRouter(prefix="/checked-queries", tags=["checked-queries"])


def _verify_owned_document(supabase: Client, document_id: str, user_id: str) -> None:
    """Raise 404 unless ``document_id`` exists AND is owned by ``user_id``.

    The owner gate for the create path: a checked query can only reference a document the
    caller IS allowed to see (otherwise the rank result would probe existence). 404 (never 403)
    on a miss so a cross-user document's existence is not leaked.
    """
    result = (
        supabase.table("documents")
        .select("id")
        .eq("id", document_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")


def _row_to_response(row: dict) -> CheckedQueryResponse:
    return CheckedQueryResponse(
        id=row["id"],
        user_id=row["user_id"],
        question=row["question"],
        expected_document_id=row["expected_document_id"],
        last_rank=row.get("last_rank"),
        previous_rank=row.get("previous_rank"),
        checked_at=(
            datetime.fromisoformat(row["checked_at"]) if row.get("checked_at") else None
        ),
        created_at=datetime.fromisoformat(row["created_at"]),
        updated_at=datetime.fromisoformat(row["updated_at"]),
        org_id=row["org_id"],
    )


@router.get("", response_model=list[CheckedQueryResponse])
async def list_checked_queries(
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
):
    """Return the caller's checked queries."""
    res = await aexec(
        supabase.table("checked_queries")
        .select("*")
        .eq("user_id", current_user["id"])
        .order("created_at", desc=True)
    )
    return [_row_to_response(r) for r in (res.data or [])]


@router.post("", response_model=CheckedQueryResponse, status_code=status.HTTP_201_CREATED)
async def create_checked_query(
    body: CheckedQueryCreate,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
):
    """Create a checked query for the caller."""
    _verify_owned_document(supabase, body.expected_document_id, current_user["id"])

    res = await aexec(
        supabase.table("checked_queries")
        .insert({
            "user_id": current_user["id"],
            "question": body.question,
            "expected_document_id": body.expected_document_id,
        })
    )
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create checked query")
    return _row_to_response(res.data[0])


@router.patch("/{query_id}", response_model=CheckedQueryResponse)
async def update_checked_query(
    query_id: str,
    body: CheckedQueryUpdate,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
):
    """Edit a checked query — only the caller's own rows may be updated."""
    update: dict[str, str] = {}
    if body.question is not None:
        update["question"] = body.question
    if body.expected_document_id is not None:
        _verify_owned_document(supabase, body.expected_document_id, current_user["id"])
        update["expected_document_id"] = body.expected_document_id

    if not update:
        # No fields to update → return the current state
        res = await aexec(
            supabase.table("checked_queries")
            .select("*")
            .eq("id", query_id)
            .eq("user_id", current_user["id"])
            .limit(1)
            .execute(),
        )
        if not res.data:
            raise HTTPException(status_code=404, detail="Checked query not found")
        return _row_to_response(res.data[0])

    res = await aexec(
        supabase.table("checked_queries")
        .update(update)
        .eq("id", query_id)
        .eq("user_id", current_user["id"])
        .execute(),
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Checked query not found")
    return _row_to_response(res.data[0])


@router.delete("/{query_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_checked_query(
    query_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
):
    """Delete the caller's own checked query."""
    res = await aexec(
        supabase.table("checked_queries")
        .delete()
        .eq("id", query_id)
        .eq("user_id", current_user["id"])
        .execute(),
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Checked query not found")


@router.post("/{query_id}/check", response_model=CheckedQueryResponse)
async def check_one_query(
    query_id: str,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
):
    """Evaluate ONE checked query and return the current snapshot immediately.

    The actual evaluation runs via BackgroundTasks — the caller receives the row's current
    state before the evaluation completes.
    """
    # Fetch the row to get the question + expected_document_id
    res = await aexec(
        supabase.table("checked_queries")
        .select("*")
        .eq("id", query_id)
        .eq("user_id", current_user["id"])
        .limit(1)
        .execute(),
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Checked query not found")
    row = res.data[0]

    user_settings: dict | None = None
    try:
        from app.models.user_settings import get_user_settings
        settings = await get_user_settings(current_user["id"])
        user_settings = settings
    except Exception:
        user_settings = None

    background_tasks.add_task(
        evaluate_check,
        supabase,
        current_user["id"],
        query_id,
        row["question"],
        row["expected_document_id"],
        user_settings,
    )

    return _row_to_response(row)


@router.post("/check-all", response_model=list[CheckedQueryResponse])
async def check_all_queries(
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
):
    """Queue evaluation of ALL the caller's checked queries, return the current list.

    Each query is evaluated individually — a large set may take a while.
    """
    res = await aexec(
        supabase.table("checked_queries")
        .select("*")
        .eq("user_id", current_user["id"])
        .execute(),
    )
    rows = res.data or []

    user_settings: dict | None = None
    try:
        from app.models.user_settings import get_user_settings
        settings = await get_user_settings(current_user["id"])
        user_settings = settings
    except Exception:
        user_settings = None

    for row in rows:
        background_tasks.add_task(
            evaluate_check,
            supabase,
            current_user["id"],
            row["id"],
            row["question"],
            row["expected_document_id"],
            user_settings,
        )

    return [_row_to_response(r) for r in rows]