"""Phase 234 (LIB-08 / SURF-01 / VIS-05) — Folder Watches & Source Sync API endpoints.

Exposes CRUD and lifecycle operations on connector_watches:
- POST /watches: Create a new scheduled watch
- GET /watches: List watches owned by caller/org
- GET /watches/{watch_id}: Get watch details + tracked item mirror
- PATCH /watches/{watch_id}: Update interval, pause/resume, destination folder
- DELETE /watches/{watch_id}: Remove a watch (optional document purge)
- POST /watches/{watch_id}/sync: Trigger immediate sync check
- POST /watches/{watch_id}/purge: Purge missing/disconnected documents (VIS-05 / SC#3)

Phase 235 (SURF-02 / SURF-03) adds two reads:
- GET /watches/{watch_id}/runs: What each recent tick actually did
- GET /health: The ONE stopped verdict, plus whether the reader is genuinely running

⭐ WHY THE VERDICT LIVES HERE AND NOT IN `knowledge_health.py` (RESEARCH §6.2). Three measured
reasons: `connector_watches` has a working `authenticated` SELECT policy so this route needs no
service-role carve-out, and mounting it there would break that module's docstring claim of ONE
auditable rationale; the verdict is polled from every page over the asyncpg pool path this
module already uses, which `knowledge_health.py` has no dependency on at all; and this module is
the domain owner — `GET /sources/health` belongs beside `GET /sources/watches`.
"""
from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from starlette.concurrency import run_in_threadpool
from supabase import Client

from app.config import settings
from app.db.watches import (
    create_watch,
    delete_watch,
    get_watch,
    get_watch_items,
    list_sync_runs,
    list_watches,
    recent_runs_by_watch,
    update_watch,
)
from app.dependencies import (
    get_current_user,
    get_pg_pool,
    get_user_supabase_client,
    resolve_active_org_or_none,
)
from app.models.source import (
    SourceHealthResponse,
    StoppedSourceResponse,
    SyncRunResponse,
    WatchCreateRequest,
    WatchDetailResponse,
    WatchItemResponse,
    WatchPurgeResponse,
    WatchResponse,
    WatchSyncResponse,
    WatchUpdateRequest,
)
from app.services.sources.failure_cause import SOFT_FAILURE_THRESHOLD
from app.services.sources.health_verdict import verdict_for_runs

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


# ══ Phase 235 (SURF-02 / SURF-03 · D-235-05 / D-235-12 / D-235-21) ════════════════════════

#: How many stored ticks the verdict needs per watch. ⚠ DERIVED from the imported threshold
#: rather than typed as a literal: if the debounce ever moves, a window that stayed at 5 would
#: silently truncate the streak and under-report stopped sources. The `+ 1` buys the row
#: BELOW the streak, which is where `last_good_at` usually is.
#:
#: ⚠ HONEST CAVEAT: `last_good_at` is "the newest success WITHIN this window". A source that
#: has failed more times than the window is deep reports `None`, which reads the same as
#: "never succeeded". The per-watch history route below is the unbounded answer, and the card
#: is what renders it.
_HEALTH_RUN_WINDOW = max(5, SOFT_FAILURE_THRESHOLD + 1)


@router.get(
    "/watches/{watch_id}/runs",
    response_model=list[SyncRunResponse],
)
async def list_watch_sync_runs(
    watch_id: UUID,
    limit: int = Query(default=200, ge=1, le=500),
    current_user: dict = Depends(get_current_user),
    pool=Depends(get_pg_pool),
):
    """SURF-02 — what each recent tick of this watch actually did, newest first.

    ⛔ T-235-18 — THE OWNER PREDICATE IS IN BOTH LAYERS ON PURPOSE. `get_watch(..., user_id=)`
    checks it here, and `list_sync_runs` carries `AND user_id = $2` in its own SQL. The asyncpg
    pool path is NOT RLS-gated — migration 172's policies protect PostgREST, not this
    connection — so a `watch_id` guessed in the path would otherwise read another tenant's
    history. 404-not-403 on the miss, matching every ownership miss in this module: absence
    over refusal, because a 403 confirms the id exists.
    """
    user_id = _as_uuid(current_user["id"])
    existing = await get_watch(pool, watch_id, user_id=user_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Watch not found.",
        )

    return await list_sync_runs(pool, watch_id, user_id=user_id, limit=limit)


@router.get(
    "/health",
    response_model=SourceHealthResponse,
)
async def get_source_health(
    request: Request,
    current_user: dict = Depends(get_current_user),
    pool=Depends(get_pg_pool),
):
    """SURF-03 / D-235-05 — the ONE place the stopped verdict is decided.

    The rail badge, the Library Health row and the source card all read this. The threshold is
    applied here and nowhere else, so they cannot disagree.
    """
    user_id = _as_uuid(current_user["id"])

    # ⛔ D-235-21 / RESEARCH C-4 — THE LIVE READER, NEVER THE CONFIG FLAG.
    # `main.py:571` gates the loop's start on the watch-process setting, but `:587-589` catches
    # a failed start, logs it, sets the service to None and lets the app continue — so that
    # setting can still read `true` while nothing whatsoever is running. Reading it here would
    # reproduce BUG-260906-02's overclaim one level up, inside the phase whose entire job is to
    # stop overclaiming. `main.py:591` publishes the real answer, and this is it.
    # ⚠ The setting's NAME is deliberately absent from this entire module — its absence is the
    #   grep-able guard, and a mention in prose reads to that grep exactly like a use.
    #   `test_source_health_verdict.py::test_health_route_never_mentions_the_config_flag` is
    #   the executable half; the name it forbids is spelled out THERE, not here.
    #
    # The fact being read is `app.state.watch_service` — set by `main.py:591` to the live
    # service, or to None when the start was skipped or failed.
    #
    # ⚠ `getattr(..., None)` rather than plain attribute access: Starlette's `State` RAISES
    # `AttributeError` for a key that was never set, and an app whose lifespan never ran has
    # not set this one. A 500 there would be the poll every page makes, failing — when the
    # honest answer is simply "not running".
    reader_running = getattr(request.app.state, "watch_service", None) is not None

    watches = await list_watches(pool, user_id=user_id)

    # ⭐ T-235-19 — ONE windowed query for the whole roster, served by
    # `idx_connector_sync_runs_watch_time`. This endpoint is polled from every page by every
    # signed-in user; a per-watch round trip (the shape `_enrich_watch_rows` already suffers
    # from) would make the poll an amplification target as the roster grows.
    watch_ids = [w["id"] for w in watches if w.get("id")]
    runs_by_watch = (
        await recent_runs_by_watch(
            pool, watch_ids, user_id=user_id, per_watch=_HEALTH_RUN_WINDOW
        )
        if watch_ids
        else {}
    )

    stopped: list[StoppedSourceResponse] = []
    stopped_conn_ids: list[UUID] = []
    for watch in watches:
        # ⛔ T-235-21 — PER-ROW ISOLATION. One unprojectable watch must not 500 the endpoint the
        # whole app shell polls. This is SEED-239's shape at a second list; log and skip, so the
        # other sources still get their verdict.
        try:
            verdict = verdict_for_runs(runs_by_watch.get(str(watch["id"]), []))
            # A `never_read` verdict is NOT stopped and does not appear here — a watch created
            # and never ticked has not read yet, which is a different sentence the surface owns.
            if not verdict.stopped:
                continue
            stopped.append(
                StoppedSourceResponse(
                    watch_id=_as_uuid(watch["id"]),
                    source_folder_name=watch.get("source_folder_name") or "",
                    connection_name=None,
                    cause=verdict.cause or "unknown",
                    hard=verdict.hard,
                    stopped_since=verdict.stopped_since,
                    last_good_at=verdict.last_good_at,
                )
            )
            if watch.get("connection_id"):
                stopped_conn_ids.append(_as_uuid(watch["connection_id"]))
        except Exception:  # noqa: BLE001
            logger.exception(
                "Skipping watch %s in source health verdict", watch.get("id")
            )

    # Connection names, in ONE query, and only for the watches that actually stopped — which is
    # zero rows on a healthy instance. The name is for the sentence, never for the verdict.
    if stopped_conn_ids:
        try:
            async with pool.acquire() as con:
                rows = await con.fetch(
                    "SELECT id, name FROM connector_connections WHERE id = ANY($1::uuid[])",
                    list(set(stopped_conn_ids)),
                )
            names = {str(r["id"]): r["name"] for r in rows}
            by_watch_conn = {
                str(w["id"]): str(w["connection_id"])
                for w in watches
                if w.get("id") and w.get("connection_id")
            }
            stopped = [
                s.model_copy(
                    update={"connection_name": names.get(by_watch_conn.get(str(s.watch_id), ""))}
                )
                for s in stopped
            ]
        except Exception:  # noqa: BLE001
            # A missing name costs a sentence a noun. It must never cost the verdict.
            logger.exception("Failed to resolve connection names for stopped sources")

    return SourceHealthResponse(
        stopped=stopped,
        reader_running=reader_running,
        # ⚠ D-235-12 — an INSTANCE-level fact, stated ONCE. When the reader is off the per-watch
        # rows stay honest without each claiming to be individually broken: marking every watch
        # stopped would make the rail badge count N broken sources when nothing is wrong with
        # any of them.
        poll_interval_seconds=settings.watch_poll_interval_seconds,
    )
