"""Phase 300 (NOTE-02 / NOTE-04; D-09, D-12, D-13, D-20, D-31) — the run-waiting email drainer.

A poll loop that runs in EVERY uvicorn worker and turns due ``notification_deliveries`` rows into
one email each: claim (``db.notifications.claim_due_deliveries``), re-check that the run is still
waiting and that the owner has not opted out, send through the one app mailer, record the outcome.

⚠ **THE DUPLICATE-SENDING GUARANTEE IS NOT IN THIS FILE.** ``db/notifications.py`` owns it: the
``FOR UPDATE SKIP LOCKED`` claim with the ``'sending'`` flip inside the claiming transaction, the
``UNIQUE (notification_id)`` key, the payload frozen at first claim, and SMTP at-most-once for a
row left mid-send by a crashed worker. This loop therefore needs no leader election, no advisory
lock and no Redis — the database is the arbiter of which row is whose (the ``SchedulerService``
reasoning: a leader scheme fails silently when the leader dies).

Per claimed row, in this order (D-13, D-09), on a fresh read AFTER the claim committed:
  1. still waiting? (notice open, run active / paused, an unanswered prompt exists) — else
     ``skipped_answered``, nothing sent;
  2. opted in? (``user_settings.preferences.notification_email_enabled``, default on) — else
     ``skipped_opted_out``, nothing sent, the notice left alone;
  3. an address on record? — else ``failed``;
  4. renew this row's lease (WR-03) — lost to another worker means never send it;
  5. send the frozen payload under ``Idempotency-Key: run-waiting/<delivery id>``, off the event
     loop (``send_email`` is blocking), then map the outcome (D-12): sent / suppressed / retry
     (retryable, attempts left: +60 s after the first attempt, +300 s after the second) / failed.

Logs carry delivery ids and outcome words only — never an address, a subject or a body.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Callable

from fastapi.concurrency import run_in_threadpool

from app.db import notifications as db
from app.services.email_provider import OutboundEmail, SendOutcome, configured_provider, send_email
from app.services.run_waiting_email import render_run_waiting

logger = logging.getLogger(__name__)

#: D-12 backoff after attempt 1 and attempt 2 (attempt 3 is the last; MAX_ATTEMPTS lives in db).
RETRY_BACKOFF_SECONDS = {1: 60, 2: 300}
NO_ADDRESS_REASON = "No email address on record."
UNEXPECTED_REASON = "The email could not be sent."


def render_delivery(facts: dict) -> Any:
    """The claim's render callback: exactly the five facts 300-03's renderer accepts."""
    return render_run_waiting(
        workflow_name=facts.get("workflow_name"),
        org_name=facts.get("org_name"),
        waited_seconds=int(facts.get("waited_seconds") or 0),
        run_id=facts["run_id"],
        kind=facts["kind"],
    )


class NotificationDrainer:
    """The outbox poll loop. One instance per worker; they cooperate through the database."""

    def __init__(
        self,
        pool,
        *,
        send: Callable[..., SendOutcome] = send_email,
        poll_interval_seconds: float = 20,
        max_claims_per_tick: int = 20,
        lease_seconds: int = 600,
    ) -> None:
        self._pool = pool
        self._send = send
        self._poll_interval_seconds = poll_interval_seconds
        self._max_claims_per_tick = max_claims_per_tick
        self._lease_seconds = lease_seconds
        self._task: asyncio.Task | None = None
        self._stopping = asyncio.Event()
        # Observability for the only question an operator has about a background loop.
        self.ticks = 0
        self.sent = 0
        self.skipped = 0
        self.failed = 0

    async def tick(self, *, now: datetime | None = None) -> int:
        """Reclaim stale rows, claim due ones, process each. Returns how many were SENT.

        ``now`` pins the clock (tests). One row raising never stops the rest of the batch.
        """
        provider = configured_provider()
        try:
            await db.reclaim_stale_sending(
                self._pool, lease_seconds=self._lease_seconds, provider=provider, now=now
            )
        except Exception:  # noqa: BLE001 — a failed reclaim never blocks new claims
            logger.exception("notification drainer: stale-claim recovery failed")
        claimed = await db.claim_due_deliveries(
            self._pool, limit=self._max_claims_per_tick, render=render_delivery, now=now,
            provider=provider,
        )
        sent = 0
        for row in claimed:
            try:
                if await self._process(row, now=now):
                    sent += 1
            except Exception:  # noqa: BLE001
                logger.exception("notification delivery %s failed before sending", row.id)
                await self._record_unsent_error(row, now=now)
        self.ticks += 1
        self.sent += sent
        return sent

    async def _process(self, row: db.ClaimedDelivery, *, now: datetime | None) -> bool:
        if not await db.still_waiting(self._pool, row.notification_id):
            await db.record_delivery_outcome(self._pool, row.id, status="skipped_answered")
            self.skipped += 1
            return False
        if not await db.email_opted_in(self._pool, row.recipient_id):
            await db.record_delivery_outcome(self._pool, row.id, status="skipped_opted_out")
            self.skipped += 1
            return False
        to = await db.recipient_email(self._pool, row.recipient_id)
        if not to:
            await db.record_delivery_outcome(self._pool, row.id, status="failed", reason=NO_ADDRESS_REASON)
            self.failed += 1
            return False

        # WR-03: the batch was claimed under ONE claimed_at and is sent row by row, so stamp this
        # row's lease as its send STARTS. Lost (reclaimed or re-claimed by another worker while it
        # sat in this batch): never send it, and never record over that worker's outcome.
        if not await db.renew_delivery_lease(self._pool, row):
            logger.warning("notification delivery %s was reclaimed before sending; not sent", row.id)
            return False

        msg = OutboundEmail(to=to, subject=row.subject, text=row.text_body, html=row.html_body)
        outcome = await run_in_threadpool(self._send, msg, idempotency_key=f"run-waiting/{row.id}")
        return await self._record(row, outcome, now=now)

    async def _record(self, row: db.ClaimedDelivery, outcome: SendOutcome, *, now: datetime | None) -> bool:
        if outcome.status == "sent":
            await db.record_delivery_outcome(
                self._pool, row.id, status="sent", reason=None, provider=outcome.provider,
                provider_message_id=outcome.provider_id, retry_due_at=None,
            )
            logger.info("notification delivery %s sent", row.id)
            return True
        if outcome.status == "suppressed":
            await db.record_delivery_outcome(
                self._pool, row.id, status="suppressed", reason=outcome.reason,
                provider=outcome.provider, provider_message_id=None, retry_due_at=None,
            )
            self.skipped += 1
            return False
        if outcome.retryable and row.attempts < db.MAX_ATTEMPTS:
            base = now or datetime.now(timezone.utc)
            backoff = RETRY_BACKOFF_SECONDS.get(row.attempts, RETRY_BACKOFF_SECONDS[2])
            await db.record_delivery_outcome(
                self._pool, row.id, status="retry", reason=outcome.reason, provider=outcome.provider,
                provider_message_id=None, retry_due_at=base + timedelta(seconds=backoff),
            )
            logger.info("notification delivery %s will be retried (attempt %d)", row.id, row.attempts)
            return False
        await db.record_delivery_outcome(
            self._pool, row.id, status="failed", reason=outcome.reason, provider=outcome.provider,
            provider_message_id=None, retry_due_at=None,
        )
        self.failed += 1
        logger.warning("notification delivery %s failed (attempt %d)", row.id, row.attempts)
        return False

    async def _record_unsent_error(self, row: db.ClaimedDelivery, *, now: datetime | None) -> None:
        """A row that raised BEFORE its send: nothing left the process, so it may be tried again."""
        if row.attempts < db.MAX_ATTEMPTS:
            base = now or datetime.now(timezone.utc)
            backoff = RETRY_BACKOFF_SECONDS.get(row.attempts, RETRY_BACKOFF_SECONDS[2])
            await db.record_delivery_outcome(
                self._pool, row.id, status="retry", reason=UNEXPECTED_REASON,
                retry_due_at=base + timedelta(seconds=backoff),
            )
        else:
            await db.record_delivery_outcome(self._pool, row.id, status="failed", reason=UNEXPECTED_REASON)
            self.failed += 1

    async def _loop(self) -> None:
        while not self._stopping.is_set():
            try:
                n = await self.tick()
                if n:
                    logger.info("notification drainer sent %d email(s)", n)
            except Exception:  # noqa: BLE001 — a failed tick never ends the loop
                logger.exception("notification drainer tick failed (the loop continues)")
            try:
                # wait_for on the stop event rather than a bare sleep, so shutdown never waits
                # out a whole poll interval.
                await asyncio.wait_for(self._stopping.wait(), timeout=self._poll_interval_seconds)
            except asyncio.TimeoutError:
                pass

    def start(self) -> None:
        if self._task is not None:
            return
        self._stopping.clear()
        self._task = asyncio.create_task(self._loop())

    async def stop(self) -> None:
        self._stopping.set()
        task, self._task = self._task, None
        if task is None:
            return
        task.cancel()
        try:
            await task
        except (asyncio.CancelledError, Exception):  # noqa: BLE001
            pass


__all__ = ["NotificationDrainer", "render_delivery", "RETRY_BACKOFF_SECONDS"]
