"""Phase 111.1 (EMBED-05 / D-04 / D-05) — the re-embed lifecycle.

A model/dimension switch must recover search at full recall without ever losing the
corpus or comparing across vector spaces. This module owns the batched, RLS-scoped,
resumable, NON-DESTRUCTIVE background job that re-embeds a user's existing chunks from
their PRESERVED `content` when the configured embedding model/dimensions change, plus a
minimal progress record the Settings status card reconciles on fetch.

Contracts (all proven live by tests/integration/test_111_1_reembed_{resume,rls}.py):
  - BATCHED + RESUMABLE: each pass re-selects chunks WHERE embedding_model IS DISTINCT
    FROM the currently-configured model, so a crashed/interrupted run picks up where it
    left off on the next kick (D-05). No double-processing.
  - NON-DESTRUCTIVE: the new vector + tags are written in ONE update; an old vector is
    NEVER deleted before its replacement is written (no delete-then-embed). A failed run
    leaves the corpus at "partial", never worse (D-05). Only `resize_embedding_column`
    (a TRUE dims change) NULLs vectors — and then the job re-embeds all of them.
  - RLS-SCOPED: every read AND write carries `.eq("user_id", user_id)`. The job runs on
    the service-role client (RLS bypass), so the app is the ONLY scope gate — a cross-user
    re-embed is a tampering / info-disclosure boundary (T-111.1-05-01 / V4).
  - NON-BLOCKING: every supabase-py call + `embed_texts` is wrapped in `run_in_threadpool`
    (D-v2.5-01 / SEED-065 — embed_texts is a SYNC HTTP call; running it on the event loop
    froze ALL serving under a search-heavy fan-out).
  - dims-change GATE: `resize_embedding_column(N)` is called ONLY when `dims_changed`.

Progress (Open Q #3 — lightest store that survives a worker restart): the meaningful
counts (total / re-embedded / remaining) are DERIVED LIVE from document_chunks on fetch,
so a worker restart never loses real progress — the DB is the source of truth (D-v2.5-03
reconcile-on-fetch). A cosmetic `status` (running|partial|complete|failed) is held in a
small in-process registry and reconciled AGAINST the counts on read: a stale in-memory
hint never overrides the persisted record (counts win — T-111.1-05-05). No new migration.
"""

from __future__ import annotations

import logging
import time
from typing import TYPE_CHECKING

from starlette.concurrency import run_in_threadpool

from app.services.openai_service import embed_texts

if TYPE_CHECKING:
    from app.models.user_settings import UserEffectiveSettings

logger = logging.getLogger(__name__)

# Re-embed a bounded slice per pass so a long corpus never holds one giant transaction
# nor one huge embedding request. 64 keeps the embed batch comfortably under provider
# input caps while amortizing the per-batch round-trip overhead.
BATCH: int = 64

DEFAULT_MODEL = "text-embedding-3-small"

# In-process status hint, keyed by user_id. A cosmetic overlay on the DB-derived counts
# (which are the source of truth). Survives within a worker; a restart simply re-derives
# status from the counts on the next fetch (running->partial/complete by reconciliation).
_status_registry: dict[str, dict] = {}


def _set_status(user_id: str, status: str, **extra) -> None:
    rec = _status_registry.get(user_id, {})
    rec.update({"status": status, "updated_at": time.time(), **extra})
    _status_registry[user_id] = rec


def _current_model(app_settings) -> str:
    return (getattr(app_settings, "embedding_model", "") or DEFAULT_MODEL)


# ── the job ─────────────────────────────────────────────────────────────────────

async def reembed_job(
    supabase,
    user_id: str,
    app_settings: "UserEffectiveSettings",
    dims_changed: bool,
    max_batches: int | None = None,
    batch_size: int | None = None,
) -> dict:
    """Re-embed this user's stale chunks from their preserved `content`.

    `max_batches` bounds the number of passes (used by the resumable test to simulate an
    interruption); production callers omit it (process until no stale chunks remain). The
    same stale predicate is re-read each pass, so a bounded/crashed run RESUMES on re-kick.
    `batch_size` overrides the per-pass slice size (defaults to BATCH); also used by the
    resumable test to force genuine multi-pass behavior on a small fixture.
    Returns a snapshot of the progress record.
    """
    limit = batch_size if batch_size is not None else BATCH
    current = _current_model(app_settings)
    dims = getattr(app_settings, "embedding_dimensions", None)
    _set_status(user_id, "running", model=current, dims_changed=bool(dims_changed))

    try:
        # dims-change GATE: NULL all vectors + rebuild the HNSW index ONLY on a true dims
        # change. After this, EVERY chunk is stale (NULL vector) and the loop re-embeds all.
        if dims_changed:
            await run_in_threadpool(
                lambda: supabase.rpc(
                    "resize_embedding_column", {"new_dim": dims}
                ).execute()
            )

        processed = 0
        passes = 0
        while True:
            if max_batches is not None and passes >= max_batches:
                break
            passes += 1

            # RESUMABLE READ: re-select the still-stale chunks each pass. RLS scope
            # eq(user_id) (V4 — the service-role client bypasses RLS, so the app scopes
            # by hand). neq(embedding_model, current) == the IS DISTINCT FROM stale
            # predicate (D-10). Threadpool-wrapped (never block the loop).
            batch = await run_in_threadpool(
                lambda: supabase.table("document_chunks")
                .select("id, content")
                .eq("user_id", user_id)
                .neq("embedding_model", current)
                .limit(limit)
                .execute()
            )
            rows = batch.data or []
            if not rows:
                break

            # Re-embed from the PRESERVED content (never re-derive from a lost vector).
            vectors = await run_in_threadpool(
                embed_texts,
                [r["content"] for r in rows],
                user_settings=app_settings,
            )

            # NON-DESTRUCTIVE WRITE: write the new vector + tags in ONE update, scoped to
            # eq(id) AND eq(user_id) (RLS). The old vector is only ever overwritten by its
            # replacement — never NULLed first. An interruption between batches leaves the
            # unprocessed chunks with their original vector (the corpus stays "partial").
            for row, vec in zip(rows, vectors):
                await run_in_threadpool(
                    lambda row=row, vec=vec: supabase.table("document_chunks")
                    .update(
                        {
                            "embedding": vec,
                            "embedding_model": current,
                            "embedding_dimensions": dims,
                        }
                    )
                    .eq("id", row["id"])
                    .eq("user_id", user_id)  # RLS scope on the WRITE too (V4)
                    .execute()
                )
                processed += 1

            _set_status(user_id, "running", processed=processed)

        # Reconcile final status against the live counts (source of truth).
        progress = await reembed_progress(supabase, user_id, app_settings)
        final = "complete" if progress["remaining"] == 0 else "partial"
        _set_status(user_id, final, processed=processed)
        progress["status"] = final
        return progress

    except Exception:  # noqa: BLE001 — a failed run must leave an HONEST, resumable state.
        logger.warning("reembed_job failed for user_id=%s; marking partial", user_id, exc_info=True)
        _set_status(user_id, "failed")
        try:
            progress = await reembed_progress(supabase, user_id, app_settings)
            progress["status"] = "failed"
            return progress
        except Exception:  # noqa: BLE001
            return {"status": "failed", "total": None, "re_embedded": None, "remaining": None}


async def reembed_progress(
    supabase,
    user_id: str,
    app_settings: "UserEffectiveSettings | None" = None,
) -> dict:
    """Reconcile-on-fetch progress for the Settings status card (D-v2.5-03).

    Counts are DERIVED LIVE from document_chunks (the source of truth — survives any
    worker restart). `status` overlays the in-process hint, reconciled against the counts:
    if no stale chunks remain the status is `complete` regardless of a stale hint; if some
    remain and nothing is running, it degrades to `partial`. RLS-scoped eq(user_id).
    """
    current = _current_model(app_settings) if app_settings is not None else None

    total = (
        await run_in_threadpool(
            lambda: supabase.table("document_chunks")
            .select("id")
            .eq("user_id", user_id)
            .execute()
        )
    ).data or []
    total_n = len(total)

    if current is not None:
        done_rows = (
            await run_in_threadpool(
                lambda: supabase.table("document_chunks")
                .select("id")
                .eq("user_id", user_id)
                .eq("embedding_model", current)
                .execute()
            )
        ).data or []
        re_embedded = len(done_rows)
    else:
        re_embedded = None

    remaining = (total_n - re_embedded) if re_embedded is not None else None

    hint = _status_registry.get(user_id, {})
    status = hint.get("status", "idle")
    # Counts win over a stale hint (T-111.1-05-05): a fully-current corpus is complete;
    # leftover stale chunks with nothing running degrade a 'running'/'idle' hint to partial.
    if remaining is not None:
        if remaining == 0 and status not in ("running",):
            status = "complete"
        elif remaining > 0 and status in ("idle", "complete"):
            status = "partial"

    return {
        "status": status,
        "total": total_n,
        "re_embedded": re_embedded,
        "remaining": remaining,
        "model": current,
        "updated_at": hint.get("updated_at"),
    }


async def start_reembed(
    supabase,
    user_id: str,
    app_settings: "UserEffectiveSettings",
    dims_changed: bool,
) -> dict:
    """Entrypoint the settings kickoff (BackgroundTask) + the "Re-embed now" re-kick both
    call. Thin wrapper over `reembed_job` (runs to completion — no batch cap)."""
    return await reembed_job(supabase, user_id, app_settings, dims_changed=dims_changed)
