"""Phase 275 (RET-03 / D-08 / D-29 / D-31 / D-37) — the nightly retention sweep daemon.

A copy of the ``WatchService`` shape: ``start`` / ``stop`` / ``_poll_loop`` / ``tick``. The lifespan
constructs it ONLY when ``settings.retention_sweep_enabled`` is true (``RETENTION_SWEEP_ENABLED``,
default false — D-29: the operator turns it on after reading a dry run).

Key invariants:
1. Claim exclusivity lives in the database (``db.retention.claim_due_retention_sweeps``: FOR UPDATE
   SKIP LOCKED + lease + ``next_run_at`` advanced inside the claim), so every uvicorn worker may run
   this loop and an org is still swept once per night (D-31). The workflow scheduler is untouched.
2. Per-org isolation: one org's failure releases THAT org ``failed`` and the tick continues.
3. ``IncompleteEvaluation`` (inside ``run_org_sweep``) disposes nothing and releases ``incomplete``.
4. The sweep archives and queues; it NEVER deletes a document (D-08). Deletes happen only in
   ``disposition.confirm_batch`` behind an org admin's typed count.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Optional

from app.config import Settings, settings as default_settings
from app.db import retention as rdb
from app.services.retention import disposition

logger = logging.getLogger(__name__)


class RetentionSweepService:
    """The background poller for due retention sweeps."""

    def __init__(self, pool: Any, settings: Optional[Settings] = None, supabase: Any = None) -> None:
        self.pool = pool
        self.settings = settings or default_settings
        self._supabase = supabase  # unused by the sweep (it never removes bytes); kept for shape parity
        self._running = False
        self._poll_task: asyncio.Task | None = None

    def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._poll_task = asyncio.create_task(self._poll_loop())
        logger.info("RetentionSweepService started (poll every %ds, sweep at %02d:00 UTC)",
                    rdb.POLL_INTERVAL_SECONDS, rdb.SWEEP_HOUR_UTC)

    def stop(self) -> None:
        self._running = False
        if self._poll_task and not self._poll_task.done():
            self._poll_task.cancel()
        logger.info("RetentionSweepService stopped")

    async def _poll_loop(self) -> None:
        while self._running:
            try:
                await self.tick()
            except asyncio.CancelledError:
                break
            except Exception as exc:  # the loop never dies on one bad tick
                logger.exception("Unexpected error in RetentionSweepService poll loop: %s", exc)
            try:
                await asyncio.sleep(rdb.POLL_INTERVAL_SECONDS)
            except asyncio.CancelledError:
                break

    async def tick(self, *, now: Optional[datetime] = None) -> int:
        """Claim due orgs and sweep each one. Returns the number of orgs swept ``ok``."""
        claimed = await rdb.claim_due_retention_sweeps(self.pool, limit=5, lease_seconds=rdb.LEASE_SECONDS, now=now)
        swept = 0
        for row in claimed:
            org_id = row["org_id"]
            if await sweep_one(self.pool, org_id, now=now):
                swept += 1
        return swept


async def sweep_one(pool: Any, org_id: Any, *, now: Optional[datetime] = None) -> bool:
    """Sweep one already-claimed org and release it with its terminal status. Never raises."""
    at = now or datetime.now(timezone.utc)
    try:
        result = await disposition.run_org_sweep(pool, org_id, now=at)
    except Exception as exc:  # per-org isolation (the SEED-239 shape)
        logger.exception("retention sweep failed for org %s", org_id)
        await _release(pool, org_id, status="failed", error=f"{type(exc).__name__}: {exc}"[:500], counts=None)
        return False
    await _release(pool, org_id, status=result.status, error=result.error, counts=result.counts)
    return result.status == "ok"


async def _release(pool: Any, org_id: Any, **kw) -> None:
    try:
        await rdb.release_retention_sweep(pool, org_id, **kw)
    except Exception:
        logger.exception("retention: releasing the sweep lease for org %s failed", org_id)
