"""Phase 234 (LIB-08 / SURF-01 / VIS-05) — Folder Watches & Source Sync API endpoints.

Exposes CRUD and lifecycle operations on connector_watches:
- POST /watches: Create a new folder watch on a recurring cadence
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
from datetime import datetime, timezone
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
    last_success_by_watch,
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


def _started_at(row: dict[str, Any]) -> datetime | None:
    val = row.get("started_at")
    return val if isinstance(val, datetime) else None



#: The identity a degraded row falls back to when even the raw row cannot supply one. A row
#: with no readable `id` is not droppable — dropping it is the omission this boundary exists to
#: prevent — so it is returned under a sentinel that is obviously not a real watch.
_UNIDENTIFIED_WATCH = UUID(int=0)


def _degraded_watch_record(raw: Any, exc: Exception) -> dict:
    """Project the least a caller needs to be TOLD a source could not be read.

    ⛔ T-235-23 — `degraded_reason` reaches a screen, so it is a fixed token plus the exception's
    CLASS NAME. Never `str(exc)`: a driver message routinely carries a table name, a connection
    string or a provider URL, and none of those belong on a member's screen. The full exception
    is logged by the caller with `logger.exception`, which is where detail belongs.
    """
    row = raw if isinstance(raw, dict) else {}

    def _uuid_or(value: Any, fallback: UUID | None) -> UUID | None:
        try:
            return _as_uuid(value) if value is not None else fallback
        except (ValueError, AttributeError, TypeError):
            return fallback

    return {
        "id": _uuid_or(row.get("id"), _UNIDENTIFIED_WATCH),
        "user_id": _uuid_or(row.get("user_id"), _UNIDENTIFIED_WATCH),
        "connection_id": _uuid_or(row.get("connection_id"), _UNIDENTIFIED_WATCH),
        "org_id": _uuid_or(row.get("org_id"), None),
        # The NAME is what lets the surface say WHICH source could not be read, so it is read
        # defensively rather than assumed present.
        "source_folder_id": str(row.get("source_folder_id") or ""),
        "source_folder_name": str(row.get("source_folder_name") or ""),
        "degraded": True,
        "degraded_reason": f"projection_failed:{type(exc).__name__}",
    }


async def _enrich_watch_rows(pool: Any, rows: list[dict]) -> list[dict]:
    """Attach item_count, connection_name, and service_id to watch records.

    ⛔ EVERY ROW IS PROJECTED INSIDE ITS OWN BOUNDARY (`SEED-239` / D-235-13). The callers below
    declare `response_model=list[WatchResponse]` and FastAPI validates the WHOLE list, so a
    single row that raises here — or that comes back in a shape the model rejects — used to be a
    500 for every watch the caller owns. That is not hypothetical: `SEED-239` measured one
    malformed `config` making all nine of a user's connections unreadable at once.

    The failing row is returned as a NAMED degraded record, never dropped: a source that
    vanishes from its own list is exactly the silence `LIB-10` forbids, and it is worse than an
    error page because nothing on screen says anything is missing.

    ⚠ This is the same boundary shape `connector_service.list_connections` needs when `SEED-239`
    is fixed at its root. That fix stays with the seed; only the observable half lands here.
    """
    if not rows or not pool:
        return rows

    enriched = []
    async with pool.acquire() as con:
        for r in rows:
            try:
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
            except Exception as exc:
                # The detail goes to the LOG, the fact goes to the SCREEN.
                logger.exception(
                    "Could not project watch row %s; returning it degraded",
                    r.get("id") if isinstance(r, dict) else r,
                )
                enriched.append(_degraded_watch_record(r, exc))
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
    request: Request,
    current_user: dict = Depends(get_current_user),
    pool=Depends(get_pg_pool),
):
    """Ask the reader to check this watch on its next tick (BUG-260906-02 / D-235-14).

    ⛔ D-235-15 — THIS ROUTE DOES NOT DO THE LISTING, AND MUST NOT. It sets `next_run_at = now()`
    and returns; `WatchService._poll_loop` performs the read. The poke is deliberately safe
    across multiple uvicorn workers (`claim_due_watches` holds the claim exclusivity), and an
    inline listing here would hold a web worker for the length of a Drive listing and re-open
    exactly the concurrency problem that claim was built to solve. The defect this route had was
    that it OVERCLAIMED, never that it was asynchronous.

    ⛔ AND IT NO LONGER PROMISES WORK NOTHING WILL DO. The reply used to describe the REQUEST —
    the same sentence whether or not a reader existed to consume the poke. Measured on the
    operator's machine: `next_run_at` carried a click from 27 minutes earlier, `last_run_at` was
    `None`, and the watch had never run once. Because the button reported success, the operator
    reasonably concluded the loop was working and the FILE was the problem.
    """
    user_id = _as_uuid(current_user["id"])
    existing = await get_watch(pool, watch_id, user_id=user_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Watch not found or unauthorized.",
        )

    # ⛔ THE LIVE READER, NOT THE INSTANCE'S CONFIGURATION (D-235-21). `main.py:587-589` swallows
    # a failed start and leaves the flag reading true, so the flag is not the fact — only the
    # object on `app.state` is. `getattr(..., None)` because a probe app (and any app whose
    # lifespan never ran) has no such attribute at all, and a plain access would 500 the route.
    #
    # ⛔ T-235-26 — this runs AFTER the ownership check on purpose: a refusal that preceded the
    # 404 would answer "does this watch id exist?" for a caller who does not own it.
    reader_running = getattr(request.app.state, "watch_service", None) is not None
    if not reader_running:
        # ⛔ Nothing is written. Poking a column no process reads is the false promise itself.
        # ⛔ T-235-22 — the subject of this sentence is this SERVER, never the caller's folder
        # or their connection, and it never names an operator configuration key. The marked
        # operator half of the instance statement lives in the frontend vocabulary leaf.
        return WatchSyncResponse(
            status="refused",
            message=(
                "Automatic reading is switched off on this server, so this check cannot be "
                "asked for. The cause is this instance's configuration."
            ),
            reader_running=False,
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

    # ⚠ `asked_at` is resolved here rather than read back with a `RETURNING` clause, so the
    # statement above stays byte-for-byte the one that shipped. It differs from the database's
    # own `now()` by the round trip only, and the authoritative column is what `GET
    # /sources/watches` returns — this value exists so the surface can render the pending state
    # (D-235-16) without a second request.
    asked_at = datetime.now(timezone.utc)
    return WatchSyncResponse(
        status="asked",
        message=(
            f"Watch {watch_id} will be checked on the reader's next pass."
        ),
        next_run_at=asked_at,
        next_check_within_seconds=settings.watch_poll_interval_seconds,
        reader_running=True,
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
#: ⭐ THE WINDOW BOUNDS THE VERDICT, AND ONLY THE VERDICT. "Is this source stopped?" is decided
#: from the LEADING failure streak, so five rows is all it ever needs. The last-good INSTANT is
#: a different question with a different reach, and it is answered UNBOUNDED, at the single
#: enrichment site in `get_source_health` below, for the stopped rows the window could not
#: answer for. ⚠ The symbol is named THERE and nowhere else in this module, so a grep for the
#: DAL function returns the import and exactly one call — which is how "one call site" stays
#: checkable rather than asserted.
#:
#: ⚠ WHY THE WINDOW WAS NOT SIMPLY WIDENED to cover both (gap G2, Phase 235 plan 14). This
#: endpoint is polled from every page by every signed-in user. Growing `per_watch` multiplies
#: rows read on EVERY poll for EVERY healthy source, to answer a question only STOPPED sources
#: ask — and it would still be a window, so it would still have an edge, just further out. The
#: aggregate instead runs once, over the already-stopped ids only: zero extra rows on a healthy
#: instance, and no query at all when nothing is stopped.
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

    # Pre-fetch connection metadata (name, is_enabled, updated_at) in ONE query (WATCH-03)
    conn_ids = [w["connection_id"] for w in watches if w.get("connection_id")]
    conn_info: dict[str, dict] = {}
    if conn_ids:
        try:
            async with pool.acquire() as con:
                c_rows = await con.fetch(
                    "SELECT id, name, is_enabled, updated_at FROM connector_connections WHERE id = ANY($1::uuid[])",
                    list(set(conn_ids)),
                )
            conn_info = {str(r["id"]): dict(r) for r in c_rows}
        except Exception:
            logger.exception("Failed to fetch connection states in health check")

    stopped: list[StoppedSourceResponse] = []
    for watch in watches:
        # ⛔ T-235-21 — PER-ROW ISOLATION. One unprojectable watch must not 500 the endpoint the
        # whole app shell polls. This is SEED-239's shape at a second list; log and skip, so the
        # other sources still get their verdict.
        try:
            conn_id_str = str(watch.get("connection_id") or "")
            c_meta = conn_info.get(conn_id_str)

            # WATCH-03 (BUG-260909-03): If the connection was switched off (is_enabled == False),
            # report immediately as stopped with cause "connection_disabled" without waiting for next watch run cycle.
            if c_meta and c_meta.get("is_enabled") is False:
                runs = runs_by_watch.get(str(watch["id"]), [])
                last_good = next(
                    (_started_at(r) for r in runs if r.get("status") == "success"),
                    None,
                )
                stopped.append(
                    StoppedSourceResponse(
                        watch_id=_as_uuid(watch["id"]),
                        source_folder_name=watch.get("source_folder_name") or "",
                        connection_name=c_meta.get("name"),
                        cause="connection_disabled",
                        hard=True,
                        stopped_since=c_meta.get("updated_at") or datetime.now(timezone.utc),
                        last_good_at=last_good,
                    )
                )
                continue

            verdict = verdict_for_runs(runs_by_watch.get(str(watch["id"]), []))
            # A `never_read` verdict is NOT stopped and does not appear here — a watch created
            # and never ticked has not read yet, which is a different sentence the surface owns.
            if not verdict.stopped:
                continue
            stopped.append(
                StoppedSourceResponse(
                    watch_id=_as_uuid(watch["id"]),
                    source_folder_name=watch.get("source_folder_name") or "",
                    connection_name=c_meta.get("name") if c_meta else None,
                    cause=verdict.cause or "unknown",
                    hard=verdict.hard,
                    stopped_since=verdict.stopped_since,
                    last_good_at=verdict.last_good_at,
                )
            )
        except Exception:  # noqa: BLE001
            logger.exception(
                "Skipping watch %s in source health verdict", watch.get("id")
            )

    # ⭐ SC#2 — "says WHEN it last succeeded". The verdict answers that from the window, and for
    # a source that has been dead longer than the window is deep the window has no answer. This
    # asks the unbounded question for exactly those rows, so the sentence is on the screen
    # rather than one click away in the history. ⛔ A row the window ALREADY answered is not
    # re-asked: one fact, one source, so the two can never be seen to disagree.
    unanswered = [s.watch_id for s in stopped if s.last_good_at is None]
    if unanswered:
        try:
            found = await last_success_by_watch(pool, unanswered, user_id=user_id)
            stopped = [
                s
                if s.last_good_at is not None
                # ⚠ `.get` on an ABSENT key, deliberately: a watch with no successful tick is
                # missing from the mapping, so this stays `None` — which is what keeps the
                # client's "has not read successfully yet" arm meaning what it says.
                else s.model_copy(update={"last_good_at": found.get(str(s.watch_id))})
                for s in stopped
            ]
        except Exception:  # noqa: BLE001
            # Same posture as the name query above: a missing date costs a sentence a date. It
            # must never cost the endpoint the whole app shell polls.
            logger.exception("Failed to resolve the last successful tick for stopped sources")

    return SourceHealthResponse(
        stopped=stopped,
        reader_running=reader_running,
        # ⚠ D-235-12 — an INSTANCE-level fact, stated ONCE. When the reader is off the per-watch
        # rows stay honest without each claiming to be individually broken: marking every watch
        # stopped would make the rail badge count N broken sources when nothing is wrong with
        # any of them.
        poll_interval_seconds=settings.watch_poll_interval_seconds,
    )
