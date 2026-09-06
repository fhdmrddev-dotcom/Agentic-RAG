"""Phase 234 (LIB-08 / SRC-06 / QUEUE-03 / VIS-03..06) — Watch Service Engine.

The background polling loop that checks active connector_watches, claims due watches atomically
(QUEUE-03), paginates source listings, diffs against connector_watch_items, and advances documents
through ingestion_jobs.

Key invariants:
1. H-5 / SRC-06: Missing verdicts are structurally forbidden unless the listing asserted complete=True.
2. SEED-239: Error isolation per watch (one failing sync never halts the loop).
3. SC#4: Renamed/moved files update existing item and document metadata without duplicate rows or re-ingest.
4. VIS-03: Deleted files update source_state='missing_at_source' while retaining the document.
5. VIS-04: Unauthorized/unshared files transition to state='unauthorized' / 'unauthorized_at_source'.
6. Bytes uploaded to Supabase storage BEFORE insert_ingestion_job (preventing empty document ingestion).
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

import asyncpg
from starlette.concurrency import run_in_threadpool
from supabase import Client

from app.config import Settings, settings as default_settings
from app.db.ingestion_jobs import insert_ingestion_job
# ⚠ THE `skipped_still_running` WRITER IN `db/watches.py` IS DELIBERATELY NOT IMPORTED HERE —
# Phase 235 plan 05 resolved RESEARCH Open Question 4 by DELETING the dead import rather than
# wiring it up. (Its exact symbol is kept out of this file on purpose, so that a grep for the
# dead writer over the production tree returns a clean absence rather than this note.)
# The reason is structural, not tidiness: `claim_due_watches` filters on
# `leased_until IS NULL OR leased_until < now()` and takes `FOR UPDATE SKIP LOCKED`, so a
# still-leased watch is skipped INSIDE SQL and never reaches this module at all — there is
# no point in the service that holds the id of a watch it skipped. Calling it would also be
# actively wrong: it OVERWRITES `last_status` to `skipped_still_running`, clobbering the
# `running` status of a watch another worker is legitimately mid-flight on, and it writes NO
# `connector_sync_runs` row — a status with no history behind it, which is the exact class of
# claim this phase exists to end. Migration 172's COMMENT already records the value as
# written by nothing; deleting the import makes that permanently true.
from app.db.watches import (
    claim_due_watches,
    get_watch_items,
    release_watch,
    update_item_state,
    upsert_watch_item,
)
from app.dependencies import get_supabase
from app.services.ingest_splice import MintResult, async_mint_document_row
from app.services.sources.base import SourceAdapter, SourceListing, SourceRegistry
from app.services.sources.failure_cause import classify_failure_cause

logger = logging.getLogger(__name__)


def _zero_counts() -> dict[str, int]:
    """The six flat count keys, all zero.

    ⚠ ONE home for the key set. `connector_sync_runs` has a named integer column per key
    (migration 172), so a key added here without a column silently drops on the floor —
    which is why the shape is minted in a single place rather than typed out per seam.
    """
    return {"new": 0, "modified": 0, "renamed": 0, "missing": 0, "restored": 0, "errors": 0}


def _opt_uuid(val: Any) -> UUID | None:
    """Coerce a claimed-row ownership column to a UUID, or None if it is absent/unusable.

    ⚠ This must NEVER raise. It feeds `release_watch`'s ownership columns, and `release_watch`
    is a best-effort writer on the release path of a sync that may already have failed —
    a malformed id must degrade to the DAL's own `COALESCE(..., w.user_id)` fallback, never
    turn a completed sync into a crash.
    """
    if val is None:
        return None
    if isinstance(val, UUID):
        return val
    try:
        return UUID(str(val))
    except (ValueError, AttributeError, TypeError):
        return None


class WatchService:
    """The background poller and diff sync engine for connector watches."""

    def __init__(
        self,
        pool: asyncpg.Pool,
        settings: Settings | None = None,
        supabase: Client | None = None,
    ) -> None:
        self.pool = pool
        self.settings = settings or default_settings
        self._supabase = supabase
        self._running = False
        self._poll_task: asyncio.Task | None = None

    def _get_supabase(self) -> Client:
        if self._supabase is not None:
            return self._supabase
        return get_supabase()

    def start(self) -> None:
        """Start the background watch polling loop."""
        if self._running:
            return
        self._running = True
        self._poll_task = asyncio.create_task(self._poll_loop())
        logger.info("WatchService started with poll interval %ds", getattr(self.settings, "watch_poll_interval_seconds", 60))

    def stop(self) -> None:
        """Stop the background polling loop."""
        self._running = False
        if self._poll_task and not self._poll_task.done():
            self._poll_task.cancel()
        logger.info("WatchService stopped")

    async def _poll_loop(self) -> None:
        interval = getattr(self.settings, "watch_poll_interval_seconds", 60)
        while self._running:
            try:
                await self.tick()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.exception("Unexpected error in WatchService poll loop: %s", e)

            try:
                await asyncio.sleep(interval)
            except asyncio.CancelledError:
                break

    async def tick(self) -> int:
        """Claim due watches and execute their synchronization passes.

        Returns number of watches claimed and processed.
        """
        lease_seconds = getattr(self.settings, "watch_lease_seconds", 600)
        claimed = await claim_due_watches(self.pool, limit=10, lease_seconds=lease_seconds)
        if not claimed:
            return 0

        logger.info("WatchService claimed %d due watch(es)", len(claimed))
        processed = 0

        for watch in claimed:
            watch_id = UUID(str(watch["id"]))
            # ⛔ SEAM 1 of 4 (SURF-02 / T-235-15). This arm is OUTSIDE `sync_watch`, and it is
            # the one that catches every CRASH-shaped failure — the failures a person most
            # needs to see in a history. `started_at` is captured HERE rather than read off
            # the watch row, because `claim_due_watches` sets `last_run_at = now()` at CLAIM
            # time (RESEARCH §2.5), which is not when this tick began doing work.
            started_at = datetime.now(timezone.utc)
            # SEED-239: Error isolation per watch — one failing watch never crashes the tick
            try:
                await self.sync_watch(watch)
                processed += 1
            except Exception as exc:
                logger.exception("Watch %s failed during sync: %s", watch_id, exc)
                await release_watch(
                    self.pool,
                    watch_id,
                    status="failed",
                    error=str(exc),
                    # A crash read nothing it could count, and nothing it could complete.
                    counts=None,
                    listing_complete=False,
                    failure_cause=classify_failure_cause(str(exc)),
                    started_at=started_at,
                    user_id=_opt_uuid(watch.get("user_id")),
                    org_id=_opt_uuid(watch.get("org_id")),
                )

        return processed

    async def sync_watch(self, watch: dict) -> dict[str, Any]:
        """Perform one complete directory sync pass for a single claimed watch."""
        # ⚠ When THIS tick began. NOT `watch["last_run_at"]`, which `claim_due_watches` set to
        # now() at claim time (RESEARCH §2.5) — reading that back would make every run row's
        # duration read as zero.
        started_at = datetime.now(timezone.utc)
        watch_id = UUID(str(watch["id"]))
        conn_id = str(watch["connection_id"])
        user_id = str(watch["user_id"])
        org_id = str(watch["org_id"]) if watch.get("org_id") else None
        library_folder_id = str(watch["library_folder_id"]) if watch.get("library_folder_id") else None
        source_folder_id = watch.get("source_folder_id")

        supabase = self._get_supabase()

        # 1. Resolve connection record and ingest visibility posture
        conn_resp = await run_in_threadpool(
            lambda: supabase.table("connector_connections")
            .select("*")
            .eq("id", conn_id)
            .maybe_single()
            .execute()
        )
        conn = conn_resp.data if conn_resp else None
        if not conn:
            raise ValueError(f"Connection {conn_id} not found")

        if not conn.get("is_enabled", True):
            # ⛔ SEAM 2 of 4 (D-235-07). A paused tick DID NOT READ — but it DID TICK, and
            # every tick gets a row. That is exactly what makes "when did this source last
            # successfully read?" answerable as a different question from "when did it last
            # change anything?", which is the confusion that let a dead watch look fine.
            # counts are EXPLICITLY zero rather than None: nothing was read, and zero is the
            # honest observation, not an absence of one.
            #
            # ⛔ AND THE CAUSE IS NAMED **HERE AND NOWHERE ELSE** (plan 13, gap-closure round 1).
            # This arm is the only code in the system that KNOWS the connection is off — it just
            # read `is_enabled` off the connection row two lines up. `classify_failure_cause` is
            # deliberately given no matcher and no status row for it, because a provider message
            # containing the word "disabled" is not evidence that somebody switched this
            # connection off. Writing `failure_cause=None` here is what made a deliberately
            # paused source read as "It stopped, and no reason was recorded." with a Retry
            # button that cannot help.
            await release_watch(
                self.pool,
                watch_id,
                status="paused",
                error="Connection is disabled",
                counts=_zero_counts(),
                listing_complete=False,
                failure_cause="connection_disabled",
                started_at=started_at,
                user_id=_opt_uuid(watch.get("user_id")),
                org_id=_opt_uuid(watch.get("org_id")),
            )
            return {"status": "paused", "reason": "Connection disabled"}

        default_ingest_visibility = conn.get("default_ingest_visibility") or "private"

        # 2. Resolve adapter
        adapter: SourceAdapter | None = SourceRegistry.get_adapter(conn)
        if not adapter:
            service_id = conn.get("service_id", "")
            if "google" in str(service_id).lower():
                adapter = SourceRegistry.get_adapter("google")
        if not adapter:
            raise NotImplementedError(f"No source adapter available for connection {conn_id} (service_id={conn.get('service_id')})")

        # 3. Paged listing loop producing a SourceListing
        listing = SourceListing(files=[], complete=False)
        page_token: str | None = None
        seen_tokens: set[str] = set()
        max_pages = 200
        page_count = 0
        try:
            while True:
                if page_token:
                    if page_token in seen_tokens:
                        logger.warning("Watch %s page token cycle detected: %s", watch_id, page_token)
                        listing.complete = False
                        break
                    seen_tokens.add(page_token)

                page_count += 1
                if page_count > max_pages:
                    logger.warning("Watch %s exceeded maximum pagination limit (%d pages)", watch_id, max_pages)
                    listing.complete = False
                    break

                file_page = await adapter.list_files(
                    conn,
                    folder_id=source_folder_id,
                    recursive=False,
                    page_token=page_token,
                )
                listing.files.extend(file_page.files)
                page_token = file_page.next_page_token
                if not page_token:
                    listing.complete = True
                    break
        except Exception as list_exc:
            listing.complete = False
            listing.error = str(list_exc)
            # ⚠ THE SUBSTRING TEST BELOW STILL DECIDES CONTROL FLOW, AND IS DELIBERATELY
            # UNCHANGED. It is the VIS-04 routing rule — which items get transitioned to
            # `unauthorized` — and narrowing or widening it here would silently change item
            # state for reasons that have nothing to do with history. What it NO LONGER does
            # is CLASSIFY: the cause recorded in the run row comes from
            # `classify_failure_cause`, and the raw string survives only as evidence.
            err_str = str(list_exc).lower()
            if "403" in err_str or "permission" in err_str or "unauthorized" in err_str:
                # VIS-04: Authorization revoked at source
                await self._handle_unauthorized_watch(
                    watch,
                    list_exc,
                    started_at=started_at,
                    cause=classify_failure_cause(str(list_exc)),
                )
                return {"status": "unauthorized", "error": str(list_exc)}
            raise list_exc

        # 4. Load tracked items from DB
        existing_items = await get_watch_items(self.pool, watch_id)
        items_by_ext_id = {it["external_id"]: it for it in existing_items}

        counts = _zero_counts()
        seen_ext_ids: set[str] = set()

        # 5. Process present items from source listing
        for item in listing.files:
            seen_ext_ids.add(item.id)
            existing = items_by_ext_id.get(item.id)
            doc_id: UUID | None = None

            try:
                if existing is None:
                    # ── NEW FILE ──────────────────────────────────────────────────────────
                    filename, file_bytes, mime_type = await adapter.read_file(conn, item.id)

                    metadata = {
                        "source": {
                            "system": (conn.get("service_id") or "connector").strip().lower(),
                            "external_id": str(item.id),
                            "version": str(item.modified_at or ""),
                        }
                    }

                    mint_res: MintResult = await async_mint_document_row(
                        raw=file_bytes,
                        filename=filename or item.name,
                        mime_type=mime_type or item.mime_type or "application/octet-stream",
                        user_id=user_id,
                        supabase=supabase,
                        folder_id=library_folder_id,
                        metadata=metadata,
                        org_id=org_id,
                        source_connection_id=conn_id,
                        ingest_visibility=default_ingest_visibility,
                        on_conflict="link",
                    )
                    doc_id = UUID(str(mint_res.document["id"]))

                    if mint_res.is_duplicate:
                        # Duplicate in folder: link into watch items, but do NOT upload bytes and do NOT enqueue
                        await upsert_watch_item(
                            self.pool,
                            watch_id=watch_id,
                            external_id=item.id,
                            name=item.name,
                            user_id=UUID(user_id),
                            org_id=UUID(org_id) if org_id else None,
                            path_hint=getattr(item, "drive_id", "") or "",
                            source_version=str(item.modified_at or ""),
                            document_id=doc_id,
                            state="present",
                        )
                    else:
                        # New content: Upload bytes to Supabase storage BEFORE enqueue
                        await run_in_threadpool(
                            lambda: supabase.storage.from_("documents").upload(
                                path=mint_res.storage_path,
                                file=file_bytes,
                                file_options={"content-type": mime_type or item.mime_type or "application/octet-stream", "upsert": "true"},
                            )
                        )
                        await upsert_watch_item(
                            self.pool,
                            watch_id=watch_id,
                            external_id=item.id,
                            name=item.name,
                            user_id=UUID(user_id),
                            org_id=UUID(org_id) if org_id else None,
                            path_hint=getattr(item, "drive_id", "") or "",
                            source_version=str(item.modified_at or ""),
                            document_id=doc_id,
                            state="present",
                        )
                        await insert_ingestion_job(
                            self.pool,
                            document_id=doc_id,
                            user_id=UUID(user_id),
                            org_id=UUID(org_id) if org_id else None,
                        )
                    counts["new"] += 1

                else:
                    # ── EXISTING FILE ─────────────────────────────────────────────────────
                    item_mod = str(item.modified_at or "")
                    existing_ver = str(existing.get("source_version") or "")

                    # Re-appearance check: if previously missing/unauthorized, restore to present
                    if existing.get("state") in ("missing", "unauthorized"):
                        counts["restored"] += 1
                        await update_item_state(self.pool, existing["id"], state="present")
                        if existing.get("document_id"):
                            await run_in_threadpool(
                                lambda doc_id=existing["document_id"]: supabase.table("documents")
                                .update({"source_state": None})
                                .eq("id", str(doc_id))
                                .execute()
                            )

                    # Modification check: version/timestamp changed
                    if item_mod and existing_ver and item_mod != existing_ver:
                        filename, file_bytes, mime_type = await adapter.read_file(conn, item.id)
                        mint_res = await async_mint_document_row(
                            raw=file_bytes,
                            filename=filename or item.name,
                            mime_type=mime_type or item.mime_type or "application/octet-stream",
                            user_id=user_id,
                            supabase=supabase,
                            folder_id=library_folder_id,
                            org_id=org_id,
                            source_connection_id=conn_id,
                            ingest_visibility=default_ingest_visibility,
                            on_conflict="link",
                        )
                        doc_id = UUID(str(mint_res.document["id"]))
                        if not mint_res.is_duplicate:
                            await run_in_threadpool(
                                lambda: supabase.storage.from_("documents").upload(
                                    path=mint_res.storage_path,
                                    file=file_bytes,
                                    file_options={"content-type": mime_type or item.mime_type or "application/octet-stream", "upsert": "true"},
                                )
                            )
                            await insert_ingestion_job(
                                self.pool,
                                document_id=doc_id,
                                user_id=UUID(user_id),
                                org_id=UUID(org_id) if org_id else None,
                            )
                        await upsert_watch_item(
                            self.pool,
                            watch_id=watch_id,
                            external_id=item.id,
                            name=item.name,
                            user_id=UUID(user_id),
                            org_id=UUID(org_id) if org_id else None,
                            path_hint=getattr(item, "drive_id", "") or "",
                            source_version=item_mod,
                            document_id=doc_id,
                            state="present",
                        )
                        counts["modified"] += 1

                    # SC#4: Renamed or moved file at source (same external_id, name changed, content unchanged)
                    elif item.name != existing.get("name"):
                        counts["renamed"] += 1
                        await upsert_watch_item(
                            self.pool,
                            watch_id=watch_id,
                            external_id=item.id,
                            name=item.name,
                            user_id=UUID(user_id),
                            org_id=UUID(org_id) if org_id else None,
                            path_hint=getattr(item, "drive_id", "") or "",
                            source_version=existing_ver,
                            document_id=existing.get("document_id"),
                            state="present",
                        )
                        if existing.get("document_id"):
                            await run_in_threadpool(
                                lambda doc_id=existing["document_id"], new_name=item.name: supabase.table("documents")
                                .update({"filename": new_name})
                                .eq("id", str(doc_id))
                                .execute()
                            )

            except Exception as item_err:
                counts["errors"] += 1
                logger.error(
                    "Watch %s item %s (%s) sync failed: %s",
                    watch_id, item.id, getattr(item, "name", ""), item_err, exc_info=True,
                )
                try:
                    target_doc_id = doc_id or (UUID(str(existing["document_id"])) if (existing and existing.get("document_id")) else None)
                    await upsert_watch_item(
                        self.pool,
                        watch_id=watch_id,
                        external_id=item.id,
                        name=getattr(item, "name", "") or "unknown",
                        user_id=UUID(user_id),
                        org_id=UUID(org_id) if org_id else None,
                        path_hint=getattr(item, "drive_id", "") or "",
                        source_version=str(getattr(item, "modified_at", "") or ""),
                        document_id=target_doc_id,
                        state="failed",
                        last_error=str(item_err),
                    )
                    if target_doc_id:
                        await run_in_threadpool(
                            lambda d_id=target_doc_id, err=item_err: supabase.table("documents")
                            .update({
                                "status": "failed",
                                "ingestion_step": "failed",
                                "error_message": f"Watch sync failed: {err}"[:500],
                            })
                            .eq("id", str(d_id))
                            .execute()
                        )
                except Exception as record_err:
                    logger.error(
                        "Watch %s failed to record error state for item %s: %s",
                        watch_id, item.id, record_err, exc_info=True,
                    )
                continue

        # 6. Deleted files (in DB, absent from source listing)
        deleted_candidates = [
            it for it in existing_items
            if it["external_id"] not in seen_ext_ids and it["state"] == "present"
        ]

        # ── STRUCTURAL ASSERTION (H-5 / SRC-06) ───────────────────────────────────────
        # Onyx #1161 guard: If the listing did NOT complete exhaustively (e.g. mid-pagination error),
        # missing state transitions are STRICTLY FORBIDDEN.
        if not listing.complete:
            if deleted_candidates:
                logger.warning(
                    "Watch %s listing incomplete; suppressing missing state transitions for %d item(s) (H-5)",
                    watch_id, len(deleted_candidates),
                )
        else:
            for it in deleted_candidates:
                counts["missing"] += 1
                await update_item_state(self.pool, it["id"], state="missing")
                if it.get("document_id"):
                    await run_in_threadpool(
                        lambda doc_id=it["document_id"]: supabase.table("documents")
                        .update({"source_state": "missing_at_source"})
                        .eq("id", str(doc_id))
                        .execute()
                    )

        # 7. Release watch upon successful sync
        # ⛔ SEAM 3 of 4 — the happy path, and the discard this whole plan exists to stop:
        # `counts` was computed above and thrown away one line below, so `sync_watch`'s
        # return value died in `tick()` at `processed += 1`.
        #
        # ⭐ `listing_complete` IS PASSED FROM `listing.complete`, NEVER LEFT AT ITS DEFAULT
        # (T-235-16). The H-5 block immediately above SUPPRESSES missing-state transitions
        # when the listing did not finish exhaustively, so such a tick records
        # `count_missing = 0` BY DESIGN rather than by observation. The flag is the only
        # thing that stops that zero being read as "nothing was deleted" — and defaulting it
        # would render a COMPLETE listing as incomplete, which is its own lie.
        await release_watch(
            self.pool,
            watch_id,
            status="success",
            error=None,
            counts=counts,
            listing_complete=listing.complete,
            failure_cause=None,
            started_at=started_at,
            user_id=_opt_uuid(watch.get("user_id")),
            org_id=_opt_uuid(watch.get("org_id")),
        )
        logger.info(
            "Watch %s sync complete: %d new, %d modified, %d renamed, %d missing, %d restored, %d errors",
            watch_id, counts["new"], counts["modified"], counts["renamed"], counts["missing"], counts["restored"], counts["errors"],
        )
        return {"status": "success", "counts": counts}

    async def _handle_unauthorized_watch(
        self,
        watch: dict,
        exc: Exception,
        *,
        started_at: datetime | None = None,
        cause: str | None = None,
    ) -> None:
        """Handle 403 / permission revoked at external source (VIS-04).

        `cause` is supplied by the caller, which has already asked `classify_failure_cause`.
        It is not re-derived here: one exception must not be classified twice, or the row and
        the routing could disagree about the same failure.
        """
        watch_id = UUID(str(watch["id"]))
        supabase = self._get_supabase()
        existing_items = await get_watch_items(self.pool, watch_id)

        for it in existing_items:
            if it["state"] != "unauthorized":
                await update_item_state(self.pool, it["id"], state="unauthorized", error=str(exc))
                if it.get("document_id"):
                    await run_in_threadpool(
                        lambda doc_id=it["document_id"]: supabase.table("documents")
                        .update({"source_state": "unauthorized_at_source"})
                        .eq("id", str(doc_id))
                        .execute()
                    )

        # ⛔ SEAM 4 of 4 — the only arm carrying token_revoked / folder_gone evidence.
        # ⚠ The cause is classified from the RAW exception text, not from the
        # "Source access unauthorized: …" wrapper written into `error` — a wrapper that
        # itself contains the word "unauthorized" would make every failure here look like a
        # revoked token, including a folder that was simply deleted.
        await release_watch(
            self.pool,
            watch_id,
            status="failed",
            error=f"Source access unauthorized: {exc}",
            # The listing threw mid-flight: nothing was counted, nothing completed.
            counts=None,
            listing_complete=False,
            failure_cause=cause if cause is not None else classify_failure_cause(str(exc)),
            started_at=started_at,
            user_id=_opt_uuid(watch.get("user_id")),
            org_id=_opt_uuid(watch.get("org_id")),
        )
