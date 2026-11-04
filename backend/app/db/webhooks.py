"""Phase 308 (HOOK-01..HOOK-04, HOOK-06; D-04, D-12, D-13, D-20, D-21, D-27, D-30, D-58) — every
route-facing read and write of the four webhook tables (migration 225).

The ONE data-access home for endpoints, the delivery log, test deliveries and resend. The API layer
never composes SQL. The drainer's outbox statements (fan-out, claim, lease, record, auto-disable,
purge) live in ``app/db/webhook_outbox.py`` and reuse ``insert_attempt`` from here.

⚠ **THE OWNER PREDICATE IS IN EVERY STATEMENT, INCLUDING THE ONES THAT ALREADY HAVE AN ID.**
These queries run on the **service-role asyncpg pool**, which is ``BYPASSRLS`` — and migration 225
gives the webhook tables NO policy at all, so *this file is the only wall*. A ``WHERE id = $1`` with
no ``AND org_id = $2 AND user_id = $3`` is a cross-tenant read of somebody else's endpoint. The member
path always binds the owner; ``owner_id=None`` is the ADMIN path only (``/org/webhooks``, behind the
org-manage check), and it still binds the org.

⚠ **CIPHERTEXT LEAVES THIS MODULE ONLY THROUGH ``get_endpoint_signing``** (the drainer and the test
route). ``_ENDPOINT_COLUMNS`` — every list, get, update and toggle — leaves both encrypted secrets out;
only ``_SIGNING_COLUMNS`` carries them. This module never encrypts or decrypts (the route does, with
``app.security.secret_cipher``) and never makes an HTTP call.

⚠ **NOTHING HERE LOGS A URL, A SECRET OR A PAYLOAD.** The frozen payload (``webhook_events.payload``)
is the only payload column in the schema (D-58); no delivery or attempt row holds a body, a response
or headers (D-20).
"""

from __future__ import annotations

import enum
import logging
from datetime import datetime, timedelta
from typing import Any
from uuid import UUID

import asyncpg

logger = logging.getLogger(__name__)

MAX_ENDPOINTS_PER_MEMBER = 10  # D-27: per (member, org)
PREVIOUS_SECRET_TTL = timedelta(hours=24)  # D-13: the overlap a roll leaves

_ENDPOINT_COLUMN_NAMES = (
    "id", "user_id", "org_id", "url", "description", "event_types", "enabled", "disabled_reason",
    "disabled_at", "previous_secret_expires_at", "consecutive_failures", "last_success_at",
    "created_at", "updated_at",
)

# The client-facing projection. NEVER `select *` — see the module docblock.
_ENDPOINT_COLUMNS = ", ".join(_ENDPOINT_COLUMN_NAMES)
_E_COLUMNS = ", ".join(f"e.{c}" for c in _ENDPOINT_COLUMN_NAMES)

# The signer's projection: the client columns plus both encrypted secrets. Read ONLY by
# get_endpoint_signing.
_SIGNING_COLUMNS = _ENDPOINT_COLUMNS + ", secret_ciphertext, previous_secret_ciphertext"


class EndpointCapReached(Exception):
    """The member already has ``MAX_ENDPOINTS_PER_MEMBER`` endpoints in this org (D-27)."""


class EndpointOff(Exception):
    """A resend was asked for on an endpoint that is turned off."""


class _Refusal(enum.Enum):
    ADMIN_OFF = "admin_off"


#: Returned (never raised) by ``set_endpoint_enabled`` when the OWNER asks to turn on an endpoint an
#: org admin turned off (D-30). The route maps it to 403.
EndpointAdminOff = _Refusal.ADMIN_OFF

_UNSET: Any = object()


# ── SQL ──────────────────────────────────────────────────────────────────────────────────────

# One transaction-scoped advisory lock per (member, org): two concurrent creates cannot both read
# "9 endpoints" and both insert (D-27).
CAP_LOCK_SQL = (
    "SELECT pg_advisory_xact_lock(hashtextextended("
    "'webhook_endpoints:' || $1::uuid::text || ':' || $2::uuid::text, 0))"
)

CAP_COUNT_SQL = "SELECT count(*) FROM public.webhook_endpoints WHERE user_id = $1 AND org_id = $2"

CREATE_SQL = f"""
INSERT INTO public.webhook_endpoints (user_id, org_id, url, description, event_types, secret_ciphertext)
VALUES ($1, $2, $3, $4, $5::text[], $6)
RETURNING {_ENDPOINT_COLUMNS}
"""

LIST_FOR_OWNER_SQL = f"""
SELECT {_ENDPOINT_COLUMNS}
  FROM public.webhook_endpoints
 WHERE user_id = $1 AND org_id = $2
 ORDER BY created_at DESC, id DESC
"""

GET_FOR_OWNER_SQL = f"""
SELECT {_ENDPOINT_COLUMNS}
  FROM public.webhook_endpoints
 WHERE id = $1 AND org_id = $2 AND user_id = $3
"""

GET_SIGNING_SQL = f"""
SELECT {_SIGNING_COLUMNS}
  FROM public.webhook_endpoints
 WHERE id = $1 AND org_id = $2
"""

LIST_FOR_ORG_SQL = f"""
SELECT {_E_COLUMNS},
       COALESCE(NULLIF(po.display_name, ''), uo.email) AS owner_name,
       EXISTS (SELECT 1 FROM public.org_members m
                WHERE m.org_id = e.org_id AND m.user_id = e.user_id) AS owner_is_member
  FROM public.webhook_endpoints e
  LEFT JOIN public.profiles po ON po.id = e.user_id
  LEFT JOIN auth.users uo ON uo.id = e.user_id
 WHERE e.org_id = $1
 ORDER BY e.created_at DESC, e.id DESC
"""

# The previous secret takes the current one; the current one takes the new one. A second roll inside
# the overlap therefore drops the oldest. The CTE reads the overlap state BEFORE the write.
ROLL_SQL = f"""
WITH old AS (
    SELECT id, previous_secret_expires_at AS old_expires_at
      FROM public.webhook_endpoints
     WHERE id = $1 AND org_id = $2 AND user_id = $3
     FOR UPDATE
)
UPDATE public.webhook_endpoints e
   SET previous_secret_ciphertext = e.secret_ciphertext,
       previous_secret_expires_at = now() + $5::interval,
       secret_ciphertext = $4
  FROM old
 WHERE e.id = old.id
RETURNING {_E_COLUMNS},
          (old.old_expires_at IS NOT NULL AND old.old_expires_at > now()) AS ended_overlap
"""

LOCK_ENDPOINT_OWNER_SQL = """
SELECT enabled, disabled_reason
  FROM public.webhook_endpoints
 WHERE id = $1 AND org_id = $2 AND user_id = $3
 FOR UPDATE
"""

LOCK_ENDPOINT_ADMIN_SQL = """
SELECT enabled, disabled_reason
  FROM public.webhook_endpoints
 WHERE id = $1 AND org_id = $2
 FOR UPDATE
"""

SKIP_PENDING_SQL = """
UPDATE public.webhook_deliveries
   SET status = 'skipped_disabled', claimed_at = NULL
 WHERE endpoint_id = $1
   AND status IN ('pending', 'retrying')
"""

CLOSE_NOTICE_SQL = """
UPDATE public.notifications
   SET closed_at = now(), closed_reason = 'endpoint_enabled'
 WHERE endpoint_id = $1
   AND kind = 'webhook_disabled'
   AND closed_at IS NULL
"""

DELETE_OWNER_SQL = """
DELETE FROM public.webhook_endpoints
 WHERE id = $1 AND org_id = $2 AND user_id = $3
RETURNING id, org_id, user_id, url, description
"""

DELETE_ADMIN_SQL = """
DELETE FROM public.webhook_endpoints
 WHERE id = $1 AND org_id = $2
RETURNING id, org_id, user_id, url, description
"""

OWNS_ENDPOINT_SQL = """
SELECT EXISTS (SELECT 1 FROM public.webhook_endpoints WHERE id = $1 AND org_id = $2 AND user_id = $3)
"""

# Newest first by (created_at, id), keyset paging. A skipped_not_visible row never names its item:
# the owner lost sight of it, so the log does not tell them which one it was (D-26).
LIST_DELIVERIES_SQL = """
SELECT d.id,
       ev.type AS event_type,
       CASE WHEN d.status = 'skipped_not_visible' THEN NULL ELSE ev.item_id END AS item_id,
       d.status, d.reason, d.attempts, d.last_status_code, d.last_latency_ms, d.last_error,
       d.last_attempt_at, d.next_attempt_at, d.sent_at, d.created_at
  FROM public.webhook_deliveries d
  JOIN public.webhook_events ev ON ev.id = d.event_id
  JOIN public.webhook_endpoints e ON e.id = d.endpoint_id
 WHERE d.endpoint_id = $1
   AND e.org_id = $2
   AND e.user_id = $3
   AND ($4::timestamptz IS NULL OR (d.created_at, d.id) < ($4::timestamptz, $5::uuid))
 ORDER BY d.created_at DESC, d.id DESC
 LIMIT $6
"""

CREATE_TEST_EVENT_SQL = """
INSERT INTO public.webhook_events (type, org_id, endpoint_id, payload, fanned_out_at)
SELECT 'webhook.test', e.org_id, e.id, $3, now()
  FROM public.webhook_endpoints e
 WHERE e.id = $1 AND e.org_id = $2
RETURNING id
"""

CREATE_TEST_DELIVERY_SQL = """
INSERT INTO public.webhook_deliveries (endpoint_id, event_id, status, attempts, claimed_at, next_attempt_at)
VALUES ($1, $2, 'sending', 1, now(), now())
RETURNING id
"""

# Only a test delivery still in flight. A test is never retried and never counts toward
# auto-disable, so the endpoint's consecutive_failures / last_success_at are not touched.
RECORD_TEST_SQL = """
UPDATE public.webhook_deliveries d
   SET status = CASE WHEN $2 THEN 'sent' ELSE 'failed' END,
       reason = CASE WHEN $2 THEN NULL ELSE COALESCE($6, 'not_retried') END,
       last_status_code = $3,
       last_latency_ms = $4,
       last_error = $5,
       last_attempt_at = now(),
       sent_at = CASE WHEN $2 THEN now() ELSE d.sent_at END,
       claimed_at = NULL
 WHERE d.id = $1
   AND d.status = 'sending'
   AND EXISTS (SELECT 1 FROM public.webhook_events ev WHERE ev.id = d.event_id AND ev.type = 'webhook.test')
RETURNING d.attempts
"""

INSERT_ATTEMPT_SQL = """
INSERT INTO public.webhook_delivery_attempts (delivery_id, attempt, status_code, latency_ms, error)
VALUES ($1, $2, $3, $4, $5)
"""

RESEND_LOCK_SQL = """
SELECT d.status, ev.type AS event_type, e.enabled
  FROM public.webhook_deliveries d
  JOIN public.webhook_events ev ON ev.id = d.event_id
  JOIN public.webhook_endpoints e ON e.id = d.endpoint_id
 WHERE d.id = $1
   AND d.endpoint_id = $2
   AND e.org_id = $3
   AND e.user_id = $4
 FOR UPDATE OF d
"""

RESEND_SQL = """
UPDATE public.webhook_deliveries
   SET status = 'pending', attempts = 0, next_attempt_at = now(), claimed_at = NULL, reason = NULL
 WHERE id = $1
   AND status IN ('sent', 'failed')
RETURNING id, endpoint_id, event_id, status, attempts, next_attempt_at
"""


def _changed(status: str | None) -> bool:
    """Whether a single-row write took (asyncpg's status tag), so a repeat audits nothing."""
    return str(status or "").strip().endswith(" 1")


# ── endpoints ────────────────────────────────────────────────────────────────────────────────


async def create_endpoint(
    pool: asyncpg.Pool,
    *,
    user_id: UUID,
    org_id: UUID,
    url: str,
    description: str | None,
    event_types: list[str],
    secret_ciphertext: str,
) -> dict:
    """Insert one endpoint and return its client projection (never the ciphertext).

    Raises ``EndpointCapReached`` when the member already has ``MAX_ENDPOINTS_PER_MEMBER`` in this
    org. The count and the insert run under one advisory lock on (member, org), so racing creates
    cannot exceed the cap. ``url`` is validated by the route (D-46); the table's CHECKs are the
    second wall.
    """
    async with pool.acquire() as con:
        async with con.transaction():
            await con.execute(CAP_LOCK_SQL, user_id, org_id)
            if await con.fetchval(CAP_COUNT_SQL, user_id, org_id) >= MAX_ENDPOINTS_PER_MEMBER:
                raise EndpointCapReached()
            row = await con.fetchrow(
                CREATE_SQL, user_id, org_id, url, description, list(event_types), secret_ciphertext
            )
    return dict(row)


async def list_endpoints_for_owner(pool: asyncpg.Pool, *, user_id: UUID, org_id: UUID) -> list[dict]:
    """Every endpoint this member owns in this org, newest first."""
    return [dict(r) for r in await pool.fetch(LIST_FOR_OWNER_SQL, user_id, org_id)]


async def get_endpoint_for_owner(
    pool: asyncpg.Pool, *, endpoint_id: UUID, user_id: UUID, org_id: UUID
) -> dict | None:
    """One endpoint, or ``None`` for a miss AND for another member's / another org's row (404)."""
    row = await pool.fetchrow(GET_FOR_OWNER_SQL, endpoint_id, org_id, user_id)
    return dict(row) if row is not None else None


async def get_endpoint_signing(pool: asyncpg.Pool, *, endpoint_id: UUID, org_id: UUID) -> dict | None:
    """The endpoint WITH both encrypted secrets — for the drainer and the test route ONLY.

    Org-scoped; the caller has already established the owner (the test route via
    ``get_endpoint_for_owner``, the drainer from the delivery row it claimed).
    """
    row = await pool.fetchrow(GET_SIGNING_SQL, endpoint_id, org_id)
    return dict(row) if row is not None else None


async def update_endpoint(
    pool: asyncpg.Pool,
    *,
    endpoint_id: UUID,
    user_id: UUID,
    org_id: UUID,
    url: str | None = None,
    description: Any = _UNSET,
    event_types: list[str] | None = None,
) -> dict | None:
    """Change only the given fields. ``url`` / ``event_types`` ``None`` = unchanged; ``description``
    left out = unchanged, ``None`` = cleared. ``None`` for a miss or another member's row."""
    sets: list[str] = []
    args: list[Any] = [endpoint_id, org_id, user_id]
    if url is not None:
        args.append(url)
        sets.append(f"url = ${len(args)}")
    if description is not _UNSET:
        args.append(description)
        sets.append(f"description = ${len(args)}")
    if event_types is not None:
        args.append(list(event_types))
        sets.append(f"event_types = ${len(args)}::text[]")
    if not sets:
        return await get_endpoint_for_owner(pool, endpoint_id=endpoint_id, user_id=user_id, org_id=org_id)
    row = await pool.fetchrow(
        f"UPDATE public.webhook_endpoints SET {', '.join(sets)} "
        f"WHERE id = $1 AND org_id = $2 AND user_id = $3 RETURNING {_ENDPOINT_COLUMNS}",
        *args,
    )
    return dict(row) if row is not None else None


async def set_endpoint_enabled(
    pool: asyncpg.Pool,
    *,
    endpoint_id: UUID,
    org_id: UUID,
    owner_id: UUID | None,
    enabled: bool,
    reason: str | None,
) -> dict | _Refusal | None:
    """Turn one endpoint off or on. ``owner_id=None`` is the ADMIN path (org-scoped, any owner).

    Off: ``enabled`` false, ``disabled_at`` now, ``disabled_reason`` NULL for the owner's own
    turn-off (D-58) and ``reason or 'admin'`` on the admin path (an admin's off replaces any other
    reason, so the owner cannot undo it); the endpoint's pending / retrying deliveries become
    ``skipped_disabled`` in the same transaction.

    On: refused for the OWNER when an admin turned it off — returns ``EndpointAdminOff`` and changes
    nothing (D-30). Otherwise clears the reason, resets ``consecutive_failures`` to 0 and closes the
    endpoint's open webhook_disabled notice with ``closed_reason = 'endpoint_enabled'`` (D-48), all
    in one transaction.

    Returns the projected row plus ``changed_now`` (this call flipped it), so a repeat audits nothing;
    ``None`` for a miss or a row outside the caller's scope.
    """
    admin = owner_id is None
    if not admin and reason is not None:
        raise ValueError("the owner's own turn-off carries no reason (D-58)")
    if admin:
        scope, args = "id = $1 AND org_id = $2", (endpoint_id, org_id)
    else:
        scope, args = "id = $1 AND org_id = $2 AND user_id = $3", (endpoint_id, org_id, owner_id)
    async with pool.acquire() as con:
        async with con.transaction():
            current = await con.fetchrow(
                LOCK_ENDPOINT_ADMIN_SQL if admin else LOCK_ENDPOINT_OWNER_SQL, *args
            )
            if current is None:
                return None
            if enabled:
                if not admin and not current["enabled"] and current["disabled_reason"] == "admin":
                    return EndpointAdminOff
                status = await con.execute(
                    f"UPDATE public.webhook_endpoints "
                    f"SET enabled = true, disabled_reason = NULL, disabled_at = NULL, consecutive_failures = 0 "
                    f"WHERE {scope} AND NOT enabled",
                    *args,
                )
                await con.execute(CLOSE_NOTICE_SQL, endpoint_id)
            else:
                new_reason = (reason or "admin") if admin else None
                guard = (
                    f"(enabled OR disabled_reason IS DISTINCT FROM ${len(args) + 1})" if admin else "enabled"
                )
                status = await con.execute(
                    f"UPDATE public.webhook_endpoints "
                    f"SET enabled = false, disabled_reason = ${len(args) + 1}, disabled_at = now() "
                    f"WHERE {scope} AND {guard}",
                    *args,
                    new_reason,
                )
                await con.execute(SKIP_PENDING_SQL, endpoint_id)
            row = await con.fetchrow(
                f"SELECT {_ENDPOINT_COLUMNS} FROM public.webhook_endpoints WHERE {scope}", *args
            )
    return {**dict(row), "changed_now": _changed(status)}


async def roll_secret(
    pool: asyncpg.Pool, *, endpoint_id: UUID, user_id: UUID, org_id: UUID, new_ciphertext: str
) -> dict | None:
    """Replace the signing secret; keep the old one for ``PREVIOUS_SECRET_TTL`` (D-13).

    A second roll inside the overlap drops the oldest secret. Returns the projected row plus
    ``ended_overlap`` (an overlap was running and this roll ended it); ``None`` for a miss.
    """
    row = await pool.fetchrow(ROLL_SQL, endpoint_id, org_id, user_id, new_ciphertext, PREVIOUS_SECRET_TTL)
    return dict(row) if row is not None else None


async def delete_endpoint(
    pool: asyncpg.Pool, *, endpoint_id: UUID, org_id: UUID, owner_id: UUID | None
) -> dict | None:
    """Delete one endpoint; its events (tests), deliveries, attempts and notice cascade.

    ``owner_id=None`` is the admin path. Returns the deleted row's id, org_id, user_id, url and
    description (the route audits the host from it); ``None`` for a miss.
    """
    if owner_id is None:
        row = await pool.fetchrow(DELETE_ADMIN_SQL, endpoint_id, org_id)
    else:
        row = await pool.fetchrow(DELETE_OWNER_SQL, endpoint_id, org_id, owner_id)
    return dict(row) if row is not None else None


async def list_endpoints_for_org(pool: asyncpg.Pool, *, org_id: UUID) -> list[dict]:
    """Every endpoint in this org (admin), with ``owner_name`` and ``owner_is_member``; never
    ciphertext."""
    return [dict(r) for r in await pool.fetch(LIST_FOR_ORG_SQL, org_id)]


# ── delivery log ─────────────────────────────────────────────────────────────────────────────


async def list_deliveries(
    pool: asyncpg.Pool,
    *,
    endpoint_id: UUID,
    user_id: UUID,
    org_id: UUID,
    before: tuple[datetime, UUID] | None,
    limit: int,
) -> dict | None:
    """One page of an endpoint's delivery log, newest first.

    ``before`` is the ``(created_at, id)`` keyset cursor of the last row of the previous page.
    Returns ``{"items": [...], "next_cursor": (created_at, id) | None}``, or ``None`` when the
    endpoint is not this member's in this org (404).
    """
    if not await pool.fetchval(OWNS_ENDPOINT_SQL, endpoint_id, org_id, user_id):
        return None
    before_at, before_id = before if before is not None else (None, None)
    rows = await pool.fetch(
        LIST_DELIVERIES_SQL, endpoint_id, org_id, user_id, before_at, before_id, limit + 1
    )
    items = [dict(r) for r in rows[:limit]]
    next_cursor = (items[-1]["created_at"], items[-1]["id"]) if len(rows) > limit and items else None
    return {"items": items, "next_cursor": next_cursor}


# ── test deliveries ──────────────────────────────────────────────────────────────────────────


async def create_test_delivery(
    pool: asyncpg.Pool, *, endpoint_id: UUID, org_id: UUID, payload: str
) -> tuple[UUID, UUID] | None:
    """One ``webhook.test`` event (payload frozen, already fanned out) and its one delivery, claimed
    ('sending', attempt 1) for the route to send now. ``None`` when the endpoint is not in this org.
    """
    async with pool.acquire() as con:
        async with con.transaction():
            event_id = await con.fetchval(CREATE_TEST_EVENT_SQL, endpoint_id, org_id, payload)
            if event_id is None:
                return None
            delivery_id = await con.fetchval(CREATE_TEST_DELIVERY_SQL, endpoint_id, event_id)
    return event_id, delivery_id


async def record_test_outcome(
    pool: asyncpg.Pool,
    *,
    delivery_id: UUID,
    sent: bool,
    status_code: int | None,
    latency_ms: int | None,
    error: str | None,
    reason: str | None = None,
) -> bool:
    """Record a test send: 'sent', or 'failed' with reason ``not_retried`` (or the given ``reason`` —
    ``redaction_failed`` / ``secret_unreadable`` when nothing was sent), plus one attempt row.

    Never touches the endpoint's failure count or last success (a test never counts toward
    auto-disable). Returns whether the delivery was still a test in flight.
    """
    async with pool.acquire() as con:
        async with con.transaction():
            attempts = await con.fetchval(RECORD_TEST_SQL, delivery_id, sent, status_code, latency_ms, error, reason)
            if attempts is None:
                return False
            await insert_attempt(
                con, delivery_id=delivery_id, attempt=int(attempts),
                status_code=status_code, latency_ms=latency_ms, error=error,
            )
    return True


async def insert_attempt(
    conn: asyncpg.Connection,
    *,
    delivery_id: UUID,
    attempt: int,
    status_code: int | None,
    latency_ms: int | None,
    error: str | None,
) -> None:
    """The ONE attempt insert (the test route here, the drainer in 308-03). Words only: no body,
    response or headers (D-20)."""
    await conn.execute(INSERT_ATTEMPT_SQL, delivery_id, attempt, status_code, latency_ms, error)


# ── resend ───────────────────────────────────────────────────────────────────────────────────


async def resend_delivery(
    pool: asyncpg.Pool, *, delivery_id: UUID, endpoint_id: UUID, user_id: UUID, org_id: UUID
) -> dict | None:
    """Queue a finished delivery again (D-21): 'pending', attempts 0, due now.

    Only a 'sent' or 'failed' delivery of a non-test event, on an endpoint the caller owns. Raises
    ``EndpointOff`` when that endpoint is turned off. ``None`` for a test delivery, a skipped or
    in-flight one, another member's, or a miss.
    """
    async with pool.acquire() as con:
        async with con.transaction():
            current = await con.fetchrow(RESEND_LOCK_SQL, delivery_id, endpoint_id, org_id, user_id)
            if current is None or current["event_type"] == "webhook.test":
                return None
            if current["status"] not in ("sent", "failed"):
                return None
            if not current["enabled"]:
                raise EndpointOff()
            row = await con.fetchrow(RESEND_SQL, delivery_id)
    return dict(row) if row is not None else None
