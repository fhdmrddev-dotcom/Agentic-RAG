"""Phase 300 (NOTE-02 / NOTE-03 / NOTE-04; D-09, D-12, D-13, D-20, D-31) — the run-waiting outbox.

Migration 218's triggers write ``public.notifications`` (one open notice per recipient and run) and
queue ONE ``public.notification_deliveries`` row per notice. This module is the asyncpg half the
drainer (``services/notification_drainer.py``) works it through: claim, re-check, record.

⚠ **THE DUPLICATE-SENDING GUARANTEE LIVES HERE**, not in the drainer, and it is four things:

  1. ``claim_due_deliveries`` selects due rows ``FOR UPDATE OF d SKIP LOCKED`` and flips them to
     ``'sending'`` (``attempts + 1``, ``claimed_at``) INSIDE THE SAME TRANSACTION. A second worker
     running the same select skips the locked rows, and once this one commits they no longer match
     ``status IN ('pending', 'retry')``. ⚠ The in-transaction flip is the load-bearing step (the
     ``db/schedules.py`` lesson): SKIP LOCKED alone only stops a SIMULTANEOUS double claim.
  2. ``notification_id UNIQUE`` on the table: one notice can never own two deliveries.
  3. The Resend ``Idempotency-Key`` (``run-waiting/<delivery id>``, built by the drainer) over a
     payload rendered ONCE at first claim and frozen on the row (D-31), so a retry is
     byte-identical and the vendor dedupes it.
  4. SMTP is at-most-once: a ``'sending'`` row left by a crashed worker is re-queued only when it
     was being sent through Resend; on SMTP or none it is recorded ``'failed'`` and never re-sent
     (``reclaim_stale_sending``). SMTP has no idempotency key, so "never twice" wins over "always".

The send itself happens AFTER the claim commits, never with a row lock held across HTTP or SMTP.

⛔ NOTE-03: nothing here reads the text of a question or an approval. The still-waiting check is an
``EXISTS`` that touches ``messages.tool_calls`` only for the two ids that link a prompt row to its
run and to its answer; the email is rendered from five facts (workflow name, org name, wait, run id,
kind). ``test_300_notification_drainer`` scans every ``*_SQL`` constant below for it.

Pool reads bypass RLS (the outbox is deny-all to clients); every function scopes by id.

Phase 301 adds the one READ a person makes: ``LIST_OPEN_SQL`` / ``list_open_notices`` — their open
notices across every org they belong to, scoped by the caller id (``GET /notifications``).
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Callable
from uuid import UUID

import asyncpg

logger = logging.getLogger(__name__)

#: D-12: a delivery is tried at most this many times.
MAX_ATTEMPTS = 3

#: Words stored on a stale SMTP / none row that is never re-sent (D-31).
INTERRUPTED_REASON = "Interrupted while sending; not retried to avoid a duplicate."
#: Words stored when the five facts could not be turned into an email at first claim.
RENDER_FAILED_REASON = "The email could not be prepared."

CLAIM_SQL = """
SELECT d.id, d.notification_id, d.attempts, d.subject, d.text_body, d.html_body,
       n.recipient_id, n.run_id, n.kind,
       wd.name AS workflow_name,
       o.name AS org_name,
       GREATEST(0, floor(EXTRACT(EPOCH FROM (COALESCE($2::timestamptz, now()) - n.created_at))))::int
           AS waited_seconds
  FROM public.notification_deliveries d
  JOIN public.notifications n ON n.id = d.notification_id
  LEFT JOIN public.workflow_runs wr ON wr.id = n.run_id
  LEFT JOIN public.workflow_definitions wd ON wd.id = wr.definition_id
  LEFT JOIN public.organizations o ON o.id = n.org_id
 WHERE d.status IN ('pending', 'retry')
   AND d.attempts < $3
   AND d.due_at <= COALESCE($2::timestamptz, now())
 ORDER BY d.due_at
 LIMIT $1
 FOR UPDATE OF d SKIP LOCKED
"""

CLAIM_UPDATE_SQL = """
UPDATE public.notification_deliveries
   SET status = 'sending',
       attempts = attempts + 1,
       claimed_at = now(),
       provider = $2,
       subject = COALESCE(subject, $3),
       text_body = COALESCE(text_body, $4),
       html_body = COALESCE(html_body, $5),
       waited_seconds = COALESCE(waited_seconds, $6)
 WHERE id = $1
RETURNING attempts, subject, text_body, html_body
"""

CLAIM_RENDER_FAILED_SQL = """
UPDATE public.notification_deliveries
   SET status = 'failed', attempts = attempts + 1, claimed_at = now(), provider = $2, reason = $3
 WHERE id = $1
"""

RECLAIM_SQL = """
WITH stale AS (
    SELECT d.id, d.provider, d.attempts
      FROM public.notification_deliveries d
     WHERE d.status = 'sending'
       AND d.claimed_at < COALESCE($1::timestamptz, now()) - make_interval(secs => $2)
     FOR UPDATE OF d SKIP LOCKED
)
UPDATE public.notification_deliveries t
   SET status = CASE WHEN $3 = 'resend' AND stale.provider = 'resend' AND stale.attempts < $4
                     THEN 'retry' ELSE 'failed' END,
       due_at = CASE WHEN $3 = 'resend' AND stale.provider = 'resend' AND stale.attempts < $4
                     THEN COALESCE($1::timestamptz, now()) ELSE t.due_at END,
       reason = CASE WHEN $3 = 'resend' AND stale.provider = 'resend' AND stale.attempts < $4
                     THEN t.reason ELSE $5 END
  FROM stale
 WHERE t.id = stale.id
RETURNING t.id
"""

STILL_WAITING_SQL = """
SELECT EXISTS (
    SELECT 1
      FROM public.notifications n
      JOIN public.workflow_runs wr ON wr.id = n.run_id
     WHERE n.id = $1
       AND n.closed_at IS NULL
       AND wr.status IN ('active', 'paused')
       -- v4.8 audit W-1: the recipient must still belong to the run's org, as LIST_OPEN_SQL and
       -- link_resolver require. Otherwise the email links to a run that reads "can't be opened".
       AND EXISTS (
           SELECT 1
             FROM public.org_members om
            WHERE om.org_id = n.org_id
              AND om.user_id = n.recipient_id
       )
       AND EXISTS (
           SELECT 1
             FROM public.messages m
            WHERE m.thread_id = wr.thread_id
              AND m.role = 'system'
              AND m.origin = 'harness'
              AND m.tool_calls @> '[{"kind": "ask_user_prompt"}]'::jsonb
              AND m.tool_calls->0->>'run_id' = wr.id::text
              AND NOT EXISTS (
                  SELECT 1
                    FROM public.messages r
                   WHERE r.thread_id = m.thread_id
                     AND r.role = 'system'
                     AND r.tool_calls @> '[{"kind": "ask_user_response"}]'::jsonb
                     AND r.tool_calls->0->>'tool_call_id' = m.tool_calls->0->>'tool_call_id'
              )
       )
)
"""

#: D-09: on unless the owner's preferences say exactly false; a user with no row is on.
OPTED_IN_SQL = """
SELECT coalesce(
    (SELECT lower(coalesce(us.preferences->>'notification_email_enabled', 'true')) <> 'false'
       FROM public.user_settings us
      WHERE us.user_id = $1),
    true)
"""

RECIPIENT_SQL = "SELECT email FROM auth.users WHERE id = $1"

#: 300-REVIEW WR-03: re-stamp ONE row's lease the moment its send starts. The batch shares one
#: ``claimed_at``, and rows are sent one at a time, so on a slow relay a row still QUEUED could
#: pass the lease and be reclaimed by another worker (SMTP: ``'failed'``; Resend: ``'retry'``,
#: then a second claim). Matching ``attempts`` as well as ``'sending'`` is load-bearing: a Resend
#: row reclaimed AND re-claimed elsewhere is ``'sending'`` again, one attempt later, and must not
#: be sent by both workers at once. No row back = no longer ours: never send it.
RENEW_LEASE_SQL = """
UPDATE public.notification_deliveries
   SET claimed_at = now()
 WHERE id = $1
   AND status = 'sending'
   AND attempts = $2
RETURNING true
"""

RECORD_SQL = """
UPDATE public.notification_deliveries
   SET status = $2,
       reason = $3,
       provider = COALESCE($4, provider),
       provider_message_id = COALESCE($5, provider_message_id),
       due_at = COALESCE($6::timestamptz, due_at),
       sent_at = CASE WHEN $2 = 'sent' THEN now() ELSE sent_at END
 WHERE id = $1
   AND status = 'sending'
"""

FACTS_SQL = """
SELECT (SELECT max(s.sent_at) FROM public.notification_deliveries s WHERE s.status = 'sent')
           AS last_sent_at,
       f.updated_at AS last_failure_at,
       f.reason AS last_failure_reason
  FROM (SELECT 1) AS one
  LEFT JOIN LATERAL (
      SELECT x.updated_at, x.reason
        FROM public.notification_deliveries x
       WHERE x.status = 'failed'
       ORDER BY x.updated_at DESC
       LIMIT 1
  ) f ON true
"""

# Phase 301 (NOTE-01 / NOTE-05; D-10, D-15, D-27, D-28) — the read behind GET /notifications: the
# caller's OPEN notices across EVERY org they are currently a member of, waited-longest first.
#   * $1 is the caller from the verified session, bound in BOTH the recipient predicate and the
#     org_members join (D-27). The pool bypasses RLS, so these two predicates ARE the access wall;
#     auth.uid() would be NULL here. Leaving an org drops its notices at once (F18).
#   * wr.status IN ('active', 'paused') is the status wall (F10): 218's close is fail-soft, so a
#     notice left open on a run that ended is still never listed.
#   * n.org_id is nullable in 218 but always set (workflow_runs.org_id is NOT NULL), so the inner
#     joins drop nothing real.
#   * count(*) OVER () is evaluated before LIMIT: the true open total, even when $2 cuts the rows.
#   * ⛔ NOTE-03: no prompt id, no join to the chat rows, no question text — five facts only.
LIST_OPEN_SQL = """
SELECT n.id, n.run_id, n.org_id, o.name AS org_name, n.kind, n.created_at, wr.origin_kind AS origin,
       COALESCE(NULLIF(wr.definition_snapshot->>'name', ''), NULLIF(d.name, ''), 'Workflow run')
           AS workflow_name,
       count(*) OVER () AS total
  FROM public.notifications n
  JOIN public.org_members m ON m.org_id = n.org_id AND m.user_id = $1
  JOIN public.organizations o ON o.id = n.org_id
  JOIN public.workflow_runs wr ON wr.id = n.run_id AND wr.status IN ('active', 'paused')
  LEFT JOIN public.workflow_definitions d ON d.id = wr.definition_id
 WHERE n.recipient_id = $1 AND n.closed_at IS NULL
 ORDER BY n.created_at ASC, n.id
 LIMIT $2
"""


@dataclass(frozen=True)
class ClaimedDelivery:
    """One delivery claimed for sending, carrying its frozen payload and the ids to re-check."""

    id: UUID
    notification_id: UUID
    recipient_id: UUID
    run_id: UUID
    kind: str
    attempts: int
    subject: str
    text_body: str
    html_body: str


async def claim_due_deliveries(
    pool: asyncpg.Pool,
    *,
    limit: int,
    render: Callable[[dict], Any],
    now: Any = None,
    provider: str = "none",
) -> list[ClaimedDelivery]:
    """Claim up to ``limit`` due deliveries, flip them to ``'sending'`` and freeze their payload.

    ``render(facts)`` is called once for a row that has no subject yet, with exactly
    ``workflow_name``, ``org_name``, ``waited_seconds``, ``run_id`` and ``kind``; it returns an
    object with ``subject`` / ``text`` / ``html``. A row that already has a subject (a retry) is
    never re-rendered. The select, the render and the update all run inside ONE transaction; the
    caller sends after this returns. ``now`` pins the clock for a test.
    """
    claimed: list[ClaimedDelivery] = []
    async with pool.acquire() as con:
        async with con.transaction():
            due = await con.fetch(CLAIM_SQL, limit, now, MAX_ATTEMPTS)
            for row in due:
                subject = text = html_body = None
                waited = None
                if row["subject"] is None:
                    try:
                        rendered = render({
                            "workflow_name": row["workflow_name"],
                            "org_name": row["org_name"],
                            "waited_seconds": int(row["waited_seconds"] or 0),
                            "run_id": row["run_id"],
                            "kind": row["kind"],
                        })
                        subject, text, html_body = rendered.subject, rendered.text, rendered.html
                        waited = int(row["waited_seconds"] or 0)
                    except Exception:  # noqa: BLE001 — one bad row never stops the batch
                        logger.exception("notification delivery %s could not be rendered", row["id"])
                        await con.execute(CLAIM_RENDER_FAILED_SQL, row["id"], provider, RENDER_FAILED_REASON)
                        continue
                updated = await con.fetchrow(
                    CLAIM_UPDATE_SQL, row["id"], provider, subject, text, html_body, waited
                )
                claimed.append(ClaimedDelivery(
                    id=row["id"],
                    notification_id=row["notification_id"],
                    recipient_id=row["recipient_id"],
                    run_id=row["run_id"],
                    kind=row["kind"],
                    attempts=int(updated["attempts"]),
                    subject=updated["subject"],
                    text_body=updated["text_body"],
                    html_body=updated["html_body"],
                ))
    return claimed


async def reclaim_stale_sending(
    pool: asyncpg.Pool, *, lease_seconds: int = 600, provider: str, now: Any = None
) -> int:
    """Resolve ``'sending'`` rows whose claim is older than the lease (a worker died mid-send).

    Re-queued (``'retry'``, due now; same key and frozen payload on the next claim) only when the
    row was claimed for Resend, Resend is still the configured provider, and attempts remain.
    Every other stale row — SMTP, none, a provider switched since, or out of attempts — is
    ``'failed'`` with ``INTERRUPTED_REASON`` and never re-sent. Returns how many rows it touched.
    """
    rows = await pool.fetch(RECLAIM_SQL, now, float(lease_seconds), provider, MAX_ATTEMPTS,
                            INTERRUPTED_REASON)
    return len(rows)


async def still_waiting(pool: asyncpg.Pool, notification_id: UUID) -> bool:
    """D-13: the notice is open, its run is active or paused, and an unanswered prompt exists."""
    return bool(await pool.fetchval(STILL_WAITING_SQL, notification_id))


async def email_opted_in(pool: asyncpg.Pool, user_id: UUID) -> bool:
    """D-09 / NOTE-04: read at send time; default on, off only when explicitly false."""
    return bool(await pool.fetchval(OPTED_IN_SQL, user_id))


async def recipient_email(pool: asyncpg.Pool, user_id: UUID) -> str | None:
    """The owner's sign-in address, or ``None`` when there is none on record."""
    value = await pool.fetchval(RECIPIENT_SQL, user_id)
    value = (value or "").strip()
    return value or None


async def record_delivery_outcome(
    pool: asyncpg.Pool,
    delivery_id: UUID,
    *,
    status: str,
    reason: str | None = None,
    provider: str | None = None,
    provider_message_id: str | None = None,
    retry_due_at: datetime | None = None,
) -> None:
    """Store one outcome on a ``'sending'`` row. Swallows its own failure (a record, like the
    schedule outcome writer): a row left ``'sending'`` is resolved by ``reclaim_stale_sending``."""
    try:
        await pool.execute(
            RECORD_SQL, delivery_id, status, reason, provider, provider_message_id, retry_due_at
        )
    except Exception:  # noqa: BLE001
        logger.exception("record_delivery_outcome failed for delivery %s", delivery_id)


async def renew_delivery_lease(pool: asyncpg.Pool, delivery: "ClaimedDelivery") -> bool:
    """WR-03: stamp this row's lease now, if it is still this worker's claim. ``False`` = another
    worker reclaimed it (or claimed it again): the caller must NOT send and must record nothing."""
    return bool(await pool.fetchval(RENEW_LEASE_SQL, delivery.id, delivery.attempts))


async def latest_delivery_facts(pool: asyncpg.Pool) -> dict:
    """For the Control Room Email tile: the newest send, and the newest failure with its words.

    Skipped and suppressed rows are never failures, so they are not read here.
    """
    row = await pool.fetchrow(FACTS_SQL)
    if row is None:
        return {"last_sent_at": None, "last_failure_at": None, "last_failure_reason": None}
    return {
        "last_sent_at": row["last_sent_at"],
        "last_failure_at": row["last_failure_at"],
        "last_failure_reason": row["last_failure_reason"],
    }


async def list_open_notices(conn: Any, caller: UUID, limit: int = 50) -> tuple[list, int]:
    """Phase 301: the caller's open notices (at most ``limit``) and the true open total."""
    rows = await conn.fetch(LIST_OPEN_SQL, caller, limit)
    return list(rows), (int(rows[0]["total"]) if rows else 0)


__all__ = [
    "ClaimedDelivery",
    "MAX_ATTEMPTS",
    "INTERRUPTED_REASON",
    "claim_due_deliveries",
    "reclaim_stale_sending",
    "still_waiting",
    "email_opted_in",
    "recipient_email",
    "record_delivery_outcome",
    "renew_delivery_lease",
    "latest_delivery_facts",
    "list_open_notices",
]
