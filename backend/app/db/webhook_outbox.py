"""Phase 308-03 (HOOK-03 / HOOK-04 / HOOK-05; D-07, D-10, D-13, D-17, D-18, D-19, D-44, D-48, D-58) —
the webhook outbox: every statement the drainer (``services/webhook_drainer.py``) runs.

Migration 225's triggers write ONE ``webhook_events`` row per status transition. This module is the
asyncpg half the drainer works them through: fan-out (who receives an event), the send claim, the
lease, the guarded record, the one auto-disable winner with its in-app notice, and the purge. The
route-facing reads and writes live in ``app/db/webhooks.py``; the ONE attempt insert is there too
(``webhooks.insert_attempt``) and is reused here.

⚠ **THE DUPLICATE-SENDING GUARANTEE LIVES HERE**, not in the drainer, and it is four things:

  1. ``UNIQUE (endpoint_id, event_id)`` at fan-out: ``insert_deliveries`` is ``ON CONFLICT DO
     NOTHING``, so two workers fanning out the same event (or one fanning it out twice) can never own
     two deliveries for one endpoint.
  2. The in-transaction ``'sending'`` flip: ``claim_due_deliveries`` selects due rows ``FOR UPDATE OF
     d SKIP LOCKED`` and flips them to ``'sending'`` with ``attempts + 1`` and ``claimed_at`` INSIDE
     THE SAME TRANSACTION. A second worker skips the locked rows, and once this one commits they no
     longer match ``status IN ('pending', 'retrying')`` (the ``db/notifications.py`` lesson: SKIP
     LOCKED alone only stops a SIMULTANEOUS double claim).
  3. The lease renew that refuses a reclaimed row: ``renew_lease`` matches ``status = 'sending' AND
     attempts = $n``, so a row another worker reclaimed — or reclaimed AND claimed again, one attempt
     later — is never sent by the worker that lost it (300-REVIEW WR-03). Every record UPDATE carries
     the same guard.
  4. A stable ``webhook-id`` (``msg_<event id>``, D-09), so the one duplicate this design admits — a
     worker that dies mid-send, whose row is reclaimed and retried — is safe at the receiver.

HTTP never happens inside a transaction here: every function either returns before the caller
sends, or records after it sent.

⚠ TEST DELIVERIES (``webhook.test``) ARE NEVER CLAIMED (D-58). The Test route creates one already
``'sending'`` and records it itself. Both claims exclude the type, and the stale-lease reclaim marks a
stranded test delivery ``'failed'`` (``stale_lease``) and never re-queues it.

⚠ NOTHING HERE LOGS A URL, A SECRET OR A PAYLOAD — ids and outcome words only. No statement names a
body, response or headers column (D-20); ``test_308_no_body_scan`` scans every ``*_SQL`` constant.

Pool reads bypass RLS (the four tables are deny-all to clients); every function scopes by id.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Any
from uuid import UUID

import asyncpg

from app.db import webhooks as webhooks_db

logger = logging.getLogger(__name__)

#: The reason words of migration 225's ``webhook_deliveries.reason`` CHECK.
REASON_WORDS = (
    "redaction_failed", "secret_unreadable", "invalid_url", "max_attempts", "not_retried", "stale_lease",
)
#: Who may be told: an endpoint turned off for failing or gone gets a notice; admin / owner_removed not.
NOTICE_REASONS = frozenset({"failing", "gone"})

# ── fan-out ───────────────────────────────────────────────────────────────────────────────

# The oldest event nobody has fanned out yet, locked for this transaction. A test event is fanned
# out by the route at creation and is excluded anyway.
CLAIM_EVENT_SQL = """
SELECT id, type, org_id, item_id, owner_id, status, origin_kind, definition_id, folder_id, created_at
  FROM public.webhook_events
 WHERE fanned_out_at IS NULL
   AND type <> 'webhook.test'
   AND created_at <= COALESCE($1::timestamptz, now())
 ORDER BY created_at
 LIMIT 1
 FOR UPDATE SKIP LOCKED
"""

# Pitfall 10: an endpoint created AFTER the event never receives it. $4 is the run owner for run
# events (D-03: "your runs"), NULL for documents (visibility decides at fan-out).
CANDIDATES_SQL = """
SELECT e.id, e.user_id, e.org_id
  FROM public.webhook_endpoints e
 WHERE e.org_id = $1
   AND e.enabled
   AND $2 = ANY (e.event_types)
   AND e.created_at <= $3
   AND ($4::uuid IS NULL OR e.user_id = $4)
 ORDER BY e.user_id, e.id
"""

INSERT_DELIVERIES_SQL = """
INSERT INTO public.webhook_deliveries (endpoint_id, event_id, status, next_attempt_at)
SELECT u.endpoint_id, $1, u.status, COALESCE($4::timestamptz, now())
  FROM unnest($2::uuid[], $3::text[]) AS u(endpoint_id, status)
ON CONFLICT (endpoint_id, event_id) DO NOTHING
RETURNING id, endpoint_id, status
"""

# Nothing was sent: the guard could not freeze the payload (D-15). Not counted toward auto-disable.
FAIL_UNFROZEN_SQL = """
UPDATE public.webhook_deliveries
   SET status = 'failed', reason = $2
 WHERE event_id = $1
   AND status = 'pending'
"""

MARK_FANNED_OUT_SQL = """
UPDATE public.webhook_events
   SET payload = $2, fanned_out_at = COALESCE($3::timestamptz, now())
 WHERE id = $1
   AND fanned_out_at IS NULL
"""

# ── send ──────────────────────────────────────────────────────────────────────────────────

# A crashed worker's 'sending' rows. A test delivery is failed (never retried, D-58); a real one goes
# back to 'retrying' (due now; same webhook-id, safe at the receiver) while attempts remain.
RECLAIM_SQL = """
WITH stale AS (
    SELECT d.id, d.attempts, (ev.type = 'webhook.test') AS is_test
      FROM public.webhook_deliveries d
      JOIN public.webhook_events ev ON ev.id = d.event_id
     WHERE d.status = 'sending'
       AND d.claimed_at < COALESCE($1::timestamptz, now()) - make_interval(secs => $2)
     FOR UPDATE OF d SKIP LOCKED
)
UPDATE public.webhook_deliveries t
   SET status = CASE WHEN stale.is_test OR stale.attempts >= $3 THEN 'failed' ELSE 'retrying' END,
       reason = CASE WHEN stale.is_test THEN 'stale_lease'
                     WHEN stale.attempts >= $3 THEN 'max_attempts'
                     ELSE t.reason END,
       next_attempt_at = CASE WHEN stale.is_test OR stale.attempts >= $3 THEN t.next_attempt_at
                              ELSE COALESCE($1::timestamptz, now()) END,
       claimed_at = NULL
  FROM stale
 WHERE t.id = stale.id
RETURNING t.id
"""

CLAIM_DELIVERIES_SQL = """
SELECT d.id, d.endpoint_id, d.event_id,
       ev.type AS event_type, ev.item_id, ev.payload, ev.created_at AS event_created_at,
       e.user_id, e.org_id, e.url, e.enabled,
       e.secret_ciphertext, e.previous_secret_ciphertext, e.previous_secret_expires_at
  FROM public.webhook_deliveries d
  JOIN public.webhook_events ev ON ev.id = d.event_id
  JOIN public.webhook_endpoints e ON e.id = d.endpoint_id
 WHERE d.status IN ('pending', 'retrying')
   AND d.attempts < $3
   AND d.next_attempt_at <= COALESCE($2::timestamptz, now())
   AND ev.type <> 'webhook.test'
 ORDER BY d.next_attempt_at
 LIMIT $1
 FOR UPDATE OF d SKIP LOCKED
"""

CLAIM_FLIP_SQL = """
UPDATE public.webhook_deliveries
   SET status = 'sending', attempts = attempts + 1, claimed_at = COALESCE($2::timestamptz, now())
 WHERE id = $1
RETURNING attempts
"""

# WR-03: matching attempts as well as 'sending' is load-bearing — see the module docblock (3).
RENEW_LEASE_SQL = """
UPDATE public.webhook_deliveries
   SET claimed_at = COALESCE($3::timestamptz, now())
 WHERE id = $1
   AND status = 'sending' AND attempts = $2
RETURNING true
"""

RECORD_SQL = """
UPDATE public.webhook_deliveries
   SET status = $3,
       reason = $4,
       last_status_code = $5,
       last_latency_ms = $6,
       last_error = $7,
       last_attempt_at = CASE WHEN $10 THEN COALESCE($9::timestamptz, now()) ELSE last_attempt_at END,
       next_attempt_at = COALESCE($8::timestamptz, next_attempt_at),
       sent_at = CASE WHEN $3 = 'sent' THEN COALESCE($9::timestamptz, now()) ELSE sent_at END,
       claimed_at = NULL
 WHERE id = $1
   AND status = 'sending' AND attempts = $2
RETURNING id
"""

SKIP_SQL = """
UPDATE public.webhook_deliveries
   SET status = $2, claimed_at = NULL
 WHERE id = $1
   AND status = 'sending' AND ($3::int IS NULL OR attempts = $3)
RETURNING id
"""

# ── endpoint health ───────────────────────────────────────────────────────────────────────

MARK_SUCCESS_SQL = """
UPDATE public.webhook_endpoints
   SET consecutive_failures = 0, last_success_at = COALESCE($2::timestamptz, now())
 WHERE id = $1
"""

# Atomic: two workers recording failures for one endpoint each read their own count back.
REGISTER_FAILURE_SQL = """
UPDATE public.webhook_endpoints
   SET consecutive_failures = consecutive_failures + 1
 WHERE id = $1
   AND enabled
RETURNING consecutive_failures
"""

# Pitfall 9: `AND enabled` makes exactly one caller the winner; every other caller gets no row.
DISABLE_SQL = """
UPDATE public.webhook_endpoints
   SET enabled = false, disabled_reason = $2, disabled_at = COALESCE($3::timestamptz, now())
 WHERE id = $1
   AND enabled
RETURNING id, user_id, org_id, url
"""

# D-48: one open webhook_disabled notice per endpoint (225's partial unique index).
INSERT_NOTICE_SQL = """
INSERT INTO public.notifications (recipient_id, org_id, kind, endpoint_id)
VALUES ($1, $2, 'webhook_disabled', $3)
ON CONFLICT (endpoint_id) WHERE closed_at IS NULL AND kind = 'webhook_disabled' DO NOTHING
"""

# ── housekeeping ──────────────────────────────────────────────────────────────────────────

# D-44: bounded batches; SKIP LOCKED lets two workers purge at once without waiting on each other.
# Deliveries and attempts cascade.
PURGE_SQL = """
DELETE FROM public.webhook_events
 WHERE id IN (
     SELECT id FROM public.webhook_events
      WHERE created_at < COALESCE($1::timestamptz, now()) - make_interval(days => $2)
      ORDER BY created_at
      LIMIT $3
      FOR UPDATE SKIP LOCKED
 )
"""

# D-13: the previous secret is used only while unexpired, and erased after.
ERASE_PREVIOUS_SQL = """
UPDATE public.webhook_endpoints
   SET previous_secret_ciphertext = NULL, previous_secret_expires_at = NULL
 WHERE previous_secret_expires_at IS NOT NULL
   AND previous_secret_expires_at <= COALESCE($1::timestamptz, now())
"""


@dataclass(frozen=True)
class ClaimedWebhookDelivery:
    """One delivery claimed for sending: the ids to re-check, the frozen payload, and the endpoint's
    signing state (ciphertext only — decryption is the drainer's, per attempt)."""

    id: UUID
    endpoint_id: UUID
    event_id: UUID
    attempts: int
    event_type: str
    item_id: UUID | None
    org_id: UUID
    user_id: UUID
    payload: str | None
    url: str
    secret_ciphertext: str
    previous_secret_ciphertext: str | None
    previous_secret_expires_at: datetime | None
    enabled: bool
    event_created_at: datetime


# ── fan-out ───────────────────────────────────────────────────────────────────────────────


async def claim_next_event(con: asyncpg.Connection, *, now: Any = None) -> dict | None:
    """Lock the oldest un-fanned event (the caller holds the transaction), or ``None``."""
    row = await con.fetchrow(CLAIM_EVENT_SQL, now)
    return dict(row) if row is not None else None


async def candidate_endpoints(con: asyncpg.Connection, *, event: dict) -> list[dict]:
    """Enabled endpoints in the event's org subscribed to its type and created no later than it.

    Run events go to the run owner's endpoints only (D-03); a run event with no owner goes nowhere.
    """
    is_run = str(event["type"]).startswith("run.")
    if is_run and event.get("owner_id") is None:
        return []
    rows = await con.fetch(
        CANDIDATES_SQL, event["org_id"], event["type"], event["created_at"],
        event.get("owner_id") if is_run else None,
    )
    return [dict(r) for r in rows]


async def insert_deliveries(
    con: asyncpg.Connection, *, event_id: UUID, rows: list[tuple[UUID, str]], now: Any = None
) -> list[dict]:
    """Insert one delivery per ``(endpoint_id, status)``; a pair that exists already is skipped."""
    if not rows:
        return []
    inserted = await con.fetch(
        INSERT_DELIVERIES_SQL, event_id, [r[0] for r in rows], [r[1] for r in rows], now
    )
    return [dict(r) for r in inserted]


async def fail_unfrozen_deliveries(con: asyncpg.Connection, *, event_id: UUID, reason: str) -> None:
    """Record every pending delivery of ``event_id`` ``'failed'`` with ``reason``; nothing is sent."""
    await con.execute(FAIL_UNFROZEN_SQL, event_id, reason)


async def mark_fanned_out(
    con: asyncpg.Connection, *, event_id: UUID, payload: str | None, now: Any = None
) -> None:
    """Freeze the payload (once, D-11) and mark the event fanned out."""
    await con.execute(MARK_FANNED_OUT_SQL, event_id, payload, now)


# ── send ──────────────────────────────────────────────────────────────────────────────────


async def reclaim_stale_sending(
    pool: asyncpg.Pool, *, lease_seconds: int, max_attempts: int, now: Any = None
) -> int:
    """Resolve ``'sending'`` rows whose lease passed (a worker died mid-send). Returns how many."""
    rows = await pool.fetch(RECLAIM_SQL, now, float(lease_seconds), max_attempts)
    return len(rows)


async def claim_due_deliveries(
    pool: asyncpg.Pool, *, limit: int, now: Any = None, max_attempts: int
) -> list[ClaimedWebhookDelivery]:
    """Claim up to ``limit`` due deliveries and flip them to ``'sending'`` in ONE transaction.

    The caller sends after this returns — never inside it.
    """
    claimed: list[ClaimedWebhookDelivery] = []
    async with pool.acquire() as con:
        async with con.transaction():
            due = await con.fetch(CLAIM_DELIVERIES_SQL, limit, now, max_attempts)
            for row in due:
                attempts = await con.fetchval(CLAIM_FLIP_SQL, row["id"], now)
                claimed.append(ClaimedWebhookDelivery(
                    id=row["id"],
                    endpoint_id=row["endpoint_id"],
                    event_id=row["event_id"],
                    attempts=int(attempts),
                    event_type=row["event_type"],
                    item_id=row["item_id"],
                    org_id=row["org_id"],
                    user_id=row["user_id"],
                    payload=row["payload"],
                    url=row["url"],
                    secret_ciphertext=row["secret_ciphertext"],
                    previous_secret_ciphertext=row["previous_secret_ciphertext"],
                    previous_secret_expires_at=row["previous_secret_expires_at"],
                    enabled=bool(row["enabled"]),
                    event_created_at=row["event_created_at"],
                ))
    return claimed


async def renew_lease(pool: asyncpg.Pool, *, delivery_id: UUID, attempts: int, now: Any = None) -> bool:
    """WR-03: stamp this row's lease, if it is still this worker's claim. ``False`` = lost: the
    caller must NOT send and must record nothing."""
    return bool(await pool.fetchval(RENEW_LEASE_SQL, delivery_id, attempts, now))


async def record_outcome(
    pool: asyncpg.Pool,
    *,
    delivery_id: UUID,
    attempts: int,
    status: str,
    reason: str | None = None,
    status_code: int | None = None,
    latency_ms: int | None = None,
    error: str | None = None,
    next_attempt_at: datetime | None = None,
    now: Any = None,
    attempted: bool = True,
) -> bool:
    """Store one outcome on THIS worker's ``'sending'`` row and, when an HTTP attempt happened, its
    attempt row (``webhooks.insert_attempt``) — one transaction. Returns whether the record landed.

    Swallows its own failure (logged by delivery id): a row left ``'sending'`` is resolved by
    ``reclaim_stale_sending``.
    """
    try:
        async with pool.acquire() as con:
            async with con.transaction():
                landed = await con.fetchval(
                    RECORD_SQL, delivery_id, attempts, status, reason, status_code, latency_ms,
                    error, next_attempt_at, now, attempted,
                )
                if landed is None:
                    return False
                if attempted:
                    await webhooks_db.insert_attempt(
                        con, delivery_id=delivery_id, attempt=attempts,
                        status_code=status_code, latency_ms=latency_ms, error=error,
                    )
        return True
    except Exception:  # noqa: BLE001 — a record never crashes the batch
        logger.exception("webhook delivery %s: the outcome could not be recorded", delivery_id)
        return False


async def skip_delivery(
    pool: asyncpg.Pool, *, delivery_id: UUID, status: str, attempts: int | None = None
) -> bool:
    """Record a ``skipped_*`` status on a ``'sending'`` row (nothing was sent, no attempt row)."""
    return bool(await pool.fetchval(SKIP_SQL, delivery_id, status, attempts))


# ── endpoint health ───────────────────────────────────────────────────────────────────────


async def mark_success(pool: asyncpg.Pool, *, endpoint_id: UUID, now: Any = None) -> None:
    """Any 2xx: the failure run is over (D-18)."""
    await pool.execute(MARK_SUCCESS_SQL, endpoint_id, now)


async def disable_endpoint(
    pool: asyncpg.Pool, *, endpoint_id: UUID, reason: str, now: Any = None
) -> dict | None:
    """Turn an enabled endpoint off for ``reason``; return the row iff THIS call won, else ``None``.

    In the same transaction, the winner moves the endpoint's pending / retrying deliveries to
    ``skipped_disabled`` and, for ``failing`` or ``gone``, writes the one ``webhook_disabled`` notice
    (D-48). Never a notice for ``owner_removed`` (the person is gone) or ``admin``.
    """
    async with pool.acquire() as con:
        async with con.transaction():
            won = await con.fetchrow(DISABLE_SQL, endpoint_id, reason, now)
            if won is None:
                return None
            await con.execute(webhooks_db.SKIP_PENDING_SQL, endpoint_id)
            if reason in NOTICE_REASONS:
                await con.execute(INSERT_NOTICE_SQL, won["user_id"], won["org_id"], won["id"])
    logger.warning("webhook endpoint %s turned off (%s)", endpoint_id, reason)
    return dict(won)


async def register_failure(
    pool: asyncpg.Pool, *, endpoint_id: UUID, threshold: int, now: Any = None
) -> dict | None:
    """One more delivery ended ``failed``. At ``threshold`` the endpoint is turned off for
    ``failing``; returns the disabled row iff THIS call won that disable (Pitfall 9), else ``None``."""
    count = await pool.fetchval(REGISTER_FAILURE_SQL, endpoint_id)
    if count is None or int(count) < threshold:
        return None
    return await disable_endpoint(pool, endpoint_id=endpoint_id, reason="failing", now=now)


# ── housekeeping ──────────────────────────────────────────────────────────────────────────


async def purge_old_events(
    pool: asyncpg.Pool, *, older_than_days: int, batch: int = 1000, max_batches: int = 20,
    now: Any = None,
) -> int:
    """Delete events older than ``older_than_days`` in bounded batches (D-44). Returns how many."""
    total = 0
    for _ in range(max_batches):
        status = await pool.execute(PURGE_SQL, now, int(older_than_days), int(batch))
        deleted = int(str(status).rsplit(" ", 1)[-1] or 0)
        total += deleted
        if deleted < batch:
            break
    return total


async def erase_expired_previous_secrets(pool: asyncpg.Pool, *, now: Any = None) -> int:
    """Erase every previous secret whose overlap ended (D-13). Returns how many endpoints."""
    status = await pool.execute(ERASE_PREVIOUS_SQL, now)
    return int(str(status).rsplit(" ", 1)[-1] or 0)


__all__ = [
    "ClaimedWebhookDelivery",
    "NOTICE_REASONS",
    "REASON_WORDS",
    "candidate_endpoints",
    "claim_due_deliveries",
    "claim_next_event",
    "disable_endpoint",
    "erase_expired_previous_secrets",
    "fail_unfrozen_deliveries",
    "insert_deliveries",
    "mark_fanned_out",
    "mark_success",
    "purge_old_events",
    "reclaim_stale_sending",
    "record_outcome",
    "register_failure",
    "renew_lease",
    "skip_delivery",
]
