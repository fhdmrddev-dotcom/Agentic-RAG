"""Phase 234 (LIB-08 / SURF-01 / VIS-05) — Folder Watches & Source Sync API endpoints.

Exposes CRUD and lifecycle operations on connector_watches:
- POST /watches: Create a new scheduled watch
- GET /watches: List watches owned by caller/org
- GET /watches/{watch_id}: Get watch details + tracked item mirror
- PATCH /watches/{watch_id}: Update interval, pause/resume, destination folder
- DELETE /watches/{watch_id}: Remove a watch (optional document purge)
- POST /watches/{watch_id}/sync: Trigger immediate sync check
- POST /watches/{watch_id}/purge: Purge missing/disconnected documents (VIS-05 / SC#3)
"""
from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from starlette.concurrency import run_in_threadpool
from supabase import Client

from app.db.watches import (
    create_watch,
    delete_watch,
    get_watch,
    get_watch_items,
    list_watches,
    update_watch,
)
from app.dependencies import (
    get_current_user,
    get_pg_pool,
    get_user_supabase_client,
    resolve_active_org_or_none,
)
from app.models.source import (
    WatchCreateRequest,
    WatchDetailResponse,
    WatchItemResponse,
    WatchPurgeResponse,
    WatchResponse,
    WatchSyncResponse,
    WatchUpdateRequest,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sources", tags=["sources"])


def _as_uuid(val: Any) -> UUID:
    return val if isinstance(val, UUID) else UUID(str(val))


async def _enrich_watch_rows(pool: Any, rows: list[dict]) -> list[dict]:
    """Attach item_count, connection_name, and service_id to watch records."""
    if not rows or not pool:
        return rows

    enriched = []
    async with pool.acquire() as con:
        for r in rows:
            record = dict(r)
            wid = record.get("id")
            conn_id = record.get("connection_id")

            # 1. Count items
            count = await con.fetchval(
                "SELECT COUNT(*) FROM connector_watch_items WHERE watch_id = $1",
                wid,
            )
            record["item_count"] = count or 0

            # 2. Lookup connection details
            if conn_id:
                conn_row = await con.fetchrow(
                    "SELECT name, service_id FROM connector_connections WHERE id = $1",
                    conn_id,
                )
                if conn_row:
                    record["connection_name"] = conn_row["name"]
                    record["service_id"] = conn_row["service_id"]

            if not record.get("last_status"):
                record["last_status"] = "pending"

            enriched.append(record)
    return enriched


@router.post(
    "/watches",
    response_model=WatchResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_folder_watch(
    req: WatchCreateRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
    pool=Depends(get_pg_pool),
):
    """Create a new folder watch for an external connection."""
    user_id = _as_uuid(current_user["id"])
    active_org_str = await resolve_active_org_or_none(request, current_user)
    org_id = _as_uuid(active_org_str) if active_org_str else None

    # Verify connection exists and is accessible
    conn_res = await run_in_threadpool(
        lambda: supabase.table("connector_connections")
        .select("id, name, service_id, org_id")
        .eq("id", str(req.connection_id))
        .maybe_single()
        .execute()
    )
    if not conn_res or not conn_res.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Connection not found or not accessible.",
        )
    conn_data = conn_res.data

    row = await create_watch(
        pool,
        user_id=user_id,
        connection_id=req.connection_id,
        source_folder_id=req.source_folder_id,
        source_folder_name=req.source_folder_name,
        org_id=org_id,
        source_drive_id=req.source_drive_id,
        library_folder_id=req.library_folder_id,
        interval_minutes=req.interval_minutes,
    )
    if not row:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create folder watch.",
        )

    res = dict(row)
    res["item_count"] = 0
    res["connection_name"] = conn_data.get("name")
    res["service_id"] = conn_data.get("service_id")
    return res


@router.get(
    "/watches",
    response_model=list[WatchResponse],
)
async def list_folder_watches(
    current_user: dict = Depends(get_current_user),
    pool=Depends(get_pg_pool),
):
    """List all watches owned by the current user."""
    user_id = _as_uuid(current_user["id"])
    rows = await list_watches(pool, user_id=user_id)
    enriched = await _enrich_watch_rows(pool, rows)
    return enriched


@router.get(
    "/watches/{watch_id}",
    response_model=WatchDetailResponse,
)
async def get_folder_watch(
    watch_id: UUID,
    current_user: dict = Depends(get_current_user),
    pool=Depends(get_pg_pool),
):
    """Get watch details along with tracked mirror items."""
    user_id = _as_uuid(current_user["id"])
    row = await get_watch(pool, watch_id, user_id=user_id)
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Watch not found.",
        )

    enriched_list = await _enrich_watch_rows(pool, [row])
    record = enriched_list[0]

    raw_items = await get_watch_items(pool, watch_id)
    record["items"] = raw_items
    return record


@router.patch(
    "/watches/{watch_id}",
    response_model=WatchResponse,
)
async def update_folder_watch(
    watch_id: UUID,
    req: WatchUpdateRequest,
    current_user: dict = Depends(get_current_user),
    pool=Depends(get_pg_pool),
):
    """Update cadence, active toggle, or destination folder."""
    user_id = _as_uuid(current_user["id"])
    row = await update_watch(
        pool,
        watch_id,
        user_id=user_id,
        interval_minutes=req.interval_minutes,
        is_active=req.is_active,
        library_folder_id=req.library_folder_id,
        clear_library_folder=req.clear_library_folder,
    )
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Watch not found or unauthorized.",
        )

    enriched_list = await _enrich_watch_rows(pool, [row])
    return enriched_list[0]


@router.delete(
    "/watches/{watch_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_folder_watch(
    watch_id: UUID,
    purge_documents: bool = Query(default=False),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
    pool=Depends(get_pg_pool),
):
    """Delete a folder watch and optionally purge its ingested documents."""
    user_id = _as_uuid(current_user["id"])
    existing = await get_watch(pool, watch_id, user_id=user_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Watch not found or unauthorized.",
        )

    if purge_documents:
        items = await get_watch_items(pool, watch_id)
        doc_ids = [str(it["document_id"]) for it in items if it.get("document_id")]
        if doc_ids:
            try:
                await run_in_threadpool(
                    lambda: supabase.table("documents")
                    .delete()
                    .in_("id", doc_ids)
                    .execute()
                )
            except Exception as err:
                logger.warning("Error purging documents for watch %s: %s", watch_id, err)

    deleted = await delete_watch(pool, watch_id, user_id=user_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Watch not found or unauthorized.",
        )


@router.post(
    "/watches/{watch_id}/sync",
    response_model=WatchSyncResponse,
)
async def trigger_watch_sync(
    watch_id: UUID,
    current_user: dict = Depends(get_current_user),
    pool=Depends(get_pg_pool),
):
    """Trigger an immediate check for the watch by setting next_run_at = now()."""
    user_id = _as_uuid(current_user["id"])
    existing = await get_watch(pool, watch_id, user_id=user_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Watch not found or unauthorized.",
        )

    async with pool.acquire() as con:
        await con.execute(
            """
            UPDATE connector_watches
            SET next_run_at = now(),
                leased_until = NULL,
                updated_at = now()
            WHERE id = $1 AND user_id = $2
            """,
            watch_id,
            user_id,
        )

    return WatchSyncResponse(
        status="scheduled",
        message=f"Watch {watch_id} scheduled for immediate sync.",
    )


@router.post(
    "/watches/{watch_id}/purge",
    response_model=WatchPurgeResponse,
)
async def purge_missing_watch_documents(
    watch_id: UUID,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
    pool=Depends(get_pg_pool),
):
    """VIS-05 / SC#3: Explicitly purge files that are missing at source or disconnected."""
    user_id = _as_uuid(current_user["id"])
    existing = await get_watch(pool, watch_id, user_id=user_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Watch not found or unauthorized.",
        )

    # 1. Query items that are in missing or unauthorized state
    async with pool.acquire() as con:
        items = await con.fetch(
            """
            SELECT id, document_id
            FROM connector_watch_items
            WHERE watch_id = $1
              AND state IN ('missing', 'unauthorized')
            """,
            watch_id,
        )

    doc_ids = [str(r["document_id"]) for r in items if r.get("document_id")]
    item_ids = [r["id"] for r in items]

    purged_count = 0
    if doc_ids:
        try:
            del_res = await run_in_threadpool(
                lambda: supabase.table("documents")
                .delete()
                .in_("id", doc_ids)
                .execute()
            )
            purged_count = len(doc_ids)
        except Exception as err:
            logger.warning("Failed to delete documents during purge for watch %s: %s", watch_id, err)

    if item_ids:
        async with pool.acquire() as con:
            await con.execute(
                "DELETE FROM connector_watch_items WHERE id = ANY($1::uuid[])",
                item_ids,
            )

    return WatchPurgeResponse(
        status="ok",
        purged_count=purged_count,
        message=f"Successfully purged {purged_count} missing or disconnected files.",
    )
