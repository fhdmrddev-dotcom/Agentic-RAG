"""Phase 308-03 (HOOK-02..HOOK-05; D-03, D-09, D-10, D-11, D-13, D-15, D-17, D-18, D-19, D-25, D-26,
D-41, D-44, D-48) — the outbound webhook drainer.

A poll loop that runs in EVERY uvicorn worker (no leader; ``main.py``'s lifespan starts and stops it,
308-04). Each tick does three things, in this order:

  1. FAN-OUT. Claim the oldest event nobody has fanned out (``webhook_outbox.claim_next_event``, one
     transaction per event), decide who receives it, freeze its payload ONCE, insert one delivery per
     recipient, mark the event fanned out.
       * run events: the run owner's subscribed endpoints in the run's org (D-03);
       * document events: every subscribed endpoint in the org whose owner can SEE the document —
         asked once per owner on that owner's acting connection; an owner who cannot see it gets
         NO delivery row at all, so the log can never reveal the item (D-03 / D-26);
       * an owner the liveness predicate refuses: a ``skipped_owner_gone`` row, and the endpoint
         turned off with reason ``owner_removed`` after the commit (D-25; no notice);
       * the payload is a typed, text-free model frozen through ``webhook_sender.freeze_payload``
         (the org's redaction guard, D-15 / D-41). Frozen as ``None`` means nothing may be sent:
         every delivery of that event is recorded ``failed`` / ``redaction_failed``.
  2. SEND. Reclaim stale ``'sending'`` rows, claim due deliveries (``FOR UPDATE OF d SKIP LOCKED``,
     the ``'sending'`` flip inside the claiming transaction), then per row, OUTSIDE any transaction,
     on fresh reads, in this order:
       enabled? (else ``skipped_disabled``) -> owner still allowed? (else ``skipped_owner_gone`` and
       the endpoint off, ``owner_removed``) -> item still visible to the owner? (one acting
       connection per (owner, org, table) per pass; else ``skipped_not_visible``) -> renew the lease
       (lost = never send, record nothing) -> decrypt the current secret, and the previous one only
       while its overlap runs (else ``secret_unreadable``) -> sign NOW, for this attempt
       (``webhook-id`` = ``msg_<event id>``, stable across retries and resends; timestamp and
       signature per attempt) -> one awaited send through ``webhook_sender`` -> record.
  3. HOUSEKEEPING, at most hourly: purge events older than 30 days in bounded batches (deliveries
     and attempts cascade, D-44) and erase previous secrets whose overlap ended (D-13).

The outcome -> record table (D-17 / D-18 / D-19):
  delivered                       -> ``sent``; the endpoint's failure run resets
  410                             -> ``failed`` (``gone``); the endpoint off, reason ``gone``, notice
  retryable, attempts < 6         -> ``retrying`` at the schedule step (+-10 % jitter, or Retry-After
                                     clamped to the next step)
  retryable at attempt 6          -> ``failed`` (``max_attempts``); counts toward auto-disable
  not retryable                   -> ``failed`` (``not_retried``); counts toward auto-disable
  the fifth failure in a row      -> exactly one worker turns the endpoint off (``failing``), writes
                                     the one notice and the one ``webhook.endpoint.auto_disabled`` audit

⚠ THE DUPLICATE-SENDING GUARANTEE IS NOT IN THIS FILE — ``app/db/webhook_outbox.py`` owns it.

⚠ THE ONE LIVENESS PREDICATE AND THE ONE VISIBILITY RULE ARE REUSED, NEVER RE-IMPLEMENTED: the
liveness default is an adapter over ``app.security.principal_liveness`` with ``kind = "webhook"`` (so
the MCP switches are never read); the visibility default asks the app's own RLS through an acting-
member connection (``app.security.acting_member``). No task is spawned inside an acting scope.

⚠ LOGS CARRY DELIVERY / ENDPOINT / EVENT IDS AND OUTCOME WORDS ONLY — never a URL (a receiver token
can sit in its path or query), a secret, a signature or the payload.
"""
from __future__ import annotations

import asyncio
import logging
import random
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Awaitable, Callable, Iterable
from uuid import UUID

from cryptography.fernet import InvalidToken
from fastapi.concurrency import run_in_threadpool

from app.db import outbound_policy
from app.db import webhook_outbox as outbox
from app.models.webhook import build_document_event, build_run_event
from app.security import secret_cipher
from app.security.acting_member import acting_member_connection
from app.security.principal_liveness import principal_still_allowed
from app.services import webhook_sender, webhook_signer, webhook_urls
from app.services.webhook_sender import SendOutcome

logger = logging.getLogger(__name__)

#: D-17: attempt 1 at once, then +30 s, +5 min, +30 min, +2 h, +8 h (about 10.5 h in all).
RETRY_SCHEDULE_SECONDS = (0, 30, 300, 1800, 7200, 28800)
MAX_ATTEMPTS = len(RETRY_SCHEDULE_SECONDS)
#: D-18: five deliveries in a row ending ``failed`` turn the endpoint off.
AUTO_DISABLE_AFTER = 5
#: D-44: the purge tick, and how old an event must be to go.
PURGE_EVERY_SECONDS = 3600
RETENTION_DAYS = 30
#: The spread on a scheduled retry, so a dead receiver's retries do not arrive in lockstep.
JITTER_FRACTION = 0.1

AUTO_DISABLED_ACTION = "webhook.endpoint.auto_disabled"
DOCUMENT_TYPE = "document.ingested"

#: D-26: the one visibility statement per table, run on the owner's acting connection (RLS decides).
VISIBLE_SQL = {
    "workflow_runs": "SELECT id FROM public.workflow_runs WHERE id = ANY($1::uuid[])",
    "documents": "SELECT id FROM public.documents WHERE id = ANY($1::uuid[])",
}


@dataclass(frozen=True)
class EndpointOwner:
    """Who an endpoint acts for: its owner, in its org."""

    user_id: UUID
    org_id: UUID


def next_delay(attempts_done: int, retry_after: int | None, *, rng: Callable[[], float] = random.random) -> float:
    """Seconds until the next attempt after ``attempts_done`` attempts (D-17).

    The schedule step with +-``JITTER_FRACTION`` jitter; a ``Retry-After`` replaces the step, clamped
    to the FOLLOWING step's delay and never below 1 s.
    """
    last = len(RETRY_SCHEDULE_SECONDS) - 1
    step = RETRY_SCHEDULE_SECONDS[min(max(attempts_done, 0), last)]
    if retry_after is not None:
        cap = RETRY_SCHEDULE_SECONDS[min(max(attempts_done, 0) + 1, last)]
        return float(max(1, min(int(retry_after), cap)))
    jitter = step * JITTER_FRACTION * (2.0 * rng() - 1.0)
    return max(1.0, step + jitter)


async def endpoint_owner_allowed(pool: Any, owner: EndpointOwner) -> bool:
    """D-25: the ONE liveness predicate, adapted: the owner is still a member of the endpoint's org
    and not banned. ``kind = "webhook"`` stops before the MCP switches."""
    refusal = await principal_still_allowed(
        pool, key_row={"org_id": owner.org_id, "user_id": owner.user_id, "kind": "webhook"}
    )
    return refusal is None


async def visible_item_ids(*, owner_id: UUID, org_id: UUID, table: str, ids: Iterable[UUID]) -> set[UUID]:
    """D-26: which of ``ids`` the owner can see in ``org_id`` RIGHT NOW, under the app's own RLS, on
    ONE acting-member connection. Nothing is spawned inside the scope (the ContextVar hazard)."""
    if table not in VISIBLE_SQL:
        raise ValueError(f"no visibility rule for {table!r}")
    async with acting_member_connection(user_id=str(owner_id), org_id=str(org_id)) as conn:
        rows = await conn.fetch(VISIBLE_SQL[table], list(ids))
    return {r["id"] for r in rows}


async def audit_auto_disabled(*, owner_id: UUID, org_id: UUID, endpoint_id: UUID, host: str, reason: str) -> None:
    """D-31: one ``webhook.endpoint.auto_disabled`` row — Syrel is the actor, the owner the subject;
    the endpoint id and host only, never a path, a query or a secret (P-7)."""
    from app.dependencies import get_service_role_supabase  # noqa: PLC0415 — keep the import light
    from app.services.audit_service import write_audit_entry  # noqa: PLC0415

    audit_supabase = await run_in_threadpool(get_service_role_supabase, str(org_id))
    await write_audit_entry(
        user_id=str(owner_id),
        action_type=AUTO_DISABLED_ACTION,
        metadata={"actor": "syrel", "endpoint_id": str(endpoint_id), "host": host, "reason": reason},
        supabase=audit_supabase,
        org_id=str(org_id),
    )


def _table_for(event_type: str) -> str:
    return "documents" if event_type == DOCUMENT_TYPE else "workflow_runs"


class WebhookDrainer:
    """The webhook outbox loop. One instance per worker; they cooperate through the database."""

    def __init__(
        self,
        pool,
        *,
        send: Callable[..., Awaitable[SendOutcome]] | None = None,
        liveness: Callable[[EndpointOwner], Awaitable[bool]] | None = None,
        visibility: Callable[..., Awaitable[set]] | None = None,
        cipher_getter: Callable[[], Any] = secret_cipher.get_cipher,
        is_on: Callable[[str], Awaitable[Any]] | None = None,
        audit: Callable[..., Awaitable[None]] | None = None,
        poll_interval_seconds: float = 20,
        max_claims_per_tick: int = 20,
        lease_seconds: int = 600,
        rng: Callable[[], float] = random.random,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._pool = pool
        self._send = send or webhook_sender.send
        self._liveness = liveness or (lambda owner: endpoint_owner_allowed(pool, owner))
        self._visibility = visibility or visible_item_ids
        self._cipher_getter = cipher_getter
        self._is_on = is_on or (lambda org: outbound_policy.pii_redaction_enabled(pool, org))
        self._audit = audit or audit_auto_disabled
        self._poll_interval_seconds = poll_interval_seconds
        self._max_claims_per_tick = max_claims_per_tick
        self._lease_seconds = lease_seconds
        self._rng = rng
        self._clock = clock
        self._last_purge: float | None = None
        self._task: asyncio.Future | None = None
        self._stopping = asyncio.Event()
        # Observability for the only question an operator has about a background loop.
        self.ticks = 0
        self.sent = 0
        self.skipped = 0
        self.failed = 0

    # ── the tick ──────────────────────────────────────────────────────────────────────────

    async def tick(self, *, now: datetime | None = None) -> int:
        """Fan out, send, then (hourly) purge. Returns how many deliveries were SENT.

        ``now`` pins the clock (tests). A failing step never stops the next one.
        """
        await self._fan_out(now=now)
        sent = 0
        try:
            sent = await self._send_pass(now=now)
        except Exception:  # noqa: BLE001 — a failed send pass never ends the tick
            logger.exception("webhook drainer: the send pass failed")
        await self._maybe_purge(now=now)
        self.ticks += 1
        self.sent += sent
        return sent

    # ── fan-out ───────────────────────────────────────────────────────────────────────────

    async def _fan_out(self, *, now: datetime | None) -> int:
        done = 0
        for _ in range(self._max_claims_per_tick):
            try:
                handled = await self._fan_out_one(now=now)
            except Exception:  # noqa: BLE001 — the event's transaction rolled back; next tick retries
                logger.exception("webhook drainer: fan-out failed (retried next tick)")
                break
            if not handled:
                break
            done += 1
        return done

    async def _fan_out_one(self, *, now: datetime | None) -> bool:
        owners_gone: list[UUID] = []
        async with self._pool.acquire() as con:
            async with con.transaction():
                event = await outbox.claim_next_event(con, now=now)
                if event is None:
                    return False
                candidates = await outbox.candidate_endpoints(con, event=event)
                if candidates and event["type"] == DOCUMENT_TYPE:
                    candidates = await self._who_can_see(event, candidates)
                rows: list[tuple[UUID, str]] = []
                allowed: dict[EndpointOwner, bool] = {}
                for endpoint in candidates:
                    owner = EndpointOwner(endpoint["user_id"], endpoint["org_id"])
                    if owner not in allowed:
                        allowed[owner] = bool(await self._liveness(owner))
                    if allowed[owner]:
                        rows.append((endpoint["id"], "pending"))
                    else:
                        rows.append((endpoint["id"], "skipped_owner_gone"))
                        owners_gone.append(endpoint["id"])
                to_send = any(status == "pending" for _, status in rows)
                frozen = await self._freeze(event) if to_send else None
                if rows:
                    await outbox.insert_deliveries(con, event_id=event["id"], rows=rows, now=now)
                if to_send and frozen is None:
                    await outbox.fail_unfrozen_deliveries(con, event_id=event["id"], reason="redaction_failed")
                    logger.warning("webhook event %s: the payload could not be guarded; nothing sent", event["id"])
                await outbox.mark_fanned_out(con, event_id=event["id"], payload=frozen, now=now)
        for endpoint_id in owners_gone:
            await self._disable(endpoint_id, "owner_removed", now=now)
        return True

    async def _who_can_see(self, event: dict, candidates: list[dict]) -> list[dict]:
        """D-03 / D-26: keep only endpoints whose owner can see the document — asked once per owner."""
        by_owner: dict[UUID, list[dict]] = {}
        for endpoint in candidates:
            by_owner.setdefault(endpoint["user_id"], []).append(endpoint)
        kept: list[dict] = []
        for owner_id, endpoints in by_owner.items():
            visible = await self._visibility(
                owner_id=owner_id, org_id=event["org_id"], table="documents", ids=[event["item_id"]]
            )
            if event["item_id"] in visible:
                kept.extend(endpoints)
        return kept

    async def _freeze(self, event: dict) -> str | None:
        """The event's payload, frozen ONCE through the org's redaction guard; ``None`` = do not send."""
        try:
            if event["type"] == DOCUMENT_TYPE:
                model = build_document_event(
                    event_id_created_at=event["created_at"], document_id=event["item_id"],
                    folder_id=event.get("folder_id"), org_id=event["org_id"],
                )
            else:
                model = build_run_event(
                    type=event["type"], event_id_created_at=event["created_at"], run_id=event["item_id"],
                    workflow_id=event.get("definition_id"), org_id=event["org_id"],
                    status=event["status"], origin_kind=event.get("origin_kind"),
                )
        except Exception:  # noqa: BLE001 — fail closed: a payload that cannot be built is never sent
            logger.warning("webhook event %s: the payload could not be built", event["id"])
            return None
        return await webhook_sender.freeze_payload(model, org_id=str(event["org_id"]), is_on=self._is_on)

    # ── send ──────────────────────────────────────────────────────────────────────────────

    async def _send_pass(self, *, now: datetime | None) -> int:
        try:
            await outbox.reclaim_stale_sending(
                self._pool, lease_seconds=self._lease_seconds, max_attempts=MAX_ATTEMPTS, now=now
            )
        except Exception:  # noqa: BLE001 — a failed reclaim never blocks new claims
            logger.exception("webhook drainer: stale-claim recovery failed")
        claimed = await outbox.claim_due_deliveries(
            self._pool, limit=self._max_claims_per_tick, now=now, max_attempts=MAX_ATTEMPTS
        )
        groups: dict[tuple[UUID, UUID, str], list[UUID]] = {}
        for row in claimed:
            if row.item_id is not None:
                groups.setdefault((row.user_id, row.org_id, _table_for(row.event_type)), []).append(row.item_id)
        cache = _PassCache(self._liveness, self._visibility, groups)
        sent = 0
        for row in claimed:
            try:
                if await self._process(row, now=now, cache=cache):
                    sent += 1
            except Exception:  # noqa: BLE001 — one row never stops the batch
                logger.exception("webhook delivery %s failed before sending", row.id)
                await self._record_unsent_error(row, now=now)
        return sent

    async def _process(self, row: outbox.ClaimedWebhookDelivery, *, now: datetime | None, cache: "_PassCache") -> bool:
        if not row.enabled:
            await outbox.skip_delivery(self._pool, delivery_id=row.id, status="skipped_disabled", attempts=row.attempts)
            self.skipped += 1
            return False
        owner = EndpointOwner(row.user_id, row.org_id)
        if not await cache.allowed(owner):
            await outbox.skip_delivery(self._pool, delivery_id=row.id, status="skipped_owner_gone", attempts=row.attempts)
            self.skipped += 1
            await self._disable(row.endpoint_id, "owner_removed", now=now)
            return False
        if row.item_id not in await cache.visible(owner, _table_for(row.event_type)):
            await outbox.skip_delivery(self._pool, delivery_id=row.id, status="skipped_not_visible", attempts=row.attempts)
            self.skipped += 1
            return False

        # WR-03: stamp the lease as this row's send STARTS. Lost = another worker owns it now.
        if not await outbox.renew_lease(self._pool, delivery_id=row.id, attempts=row.attempts, now=now):
            logger.warning("webhook delivery %s was reclaimed before sending; not sent", row.id)
            return False
        if row.payload is None:
            await self._fail_unsent(row, "redaction_failed", now=now)
            return False

        when = now or datetime.now(timezone.utc)
        keys = self._signing_keys(row, when)
        if keys is None:
            await self._fail_unsent(row, "secret_unreadable", now=now)
            return False
        current, previous = keys
        data = row.payload.encode("ascii")
        headers = webhook_signer.build_headers(
            msg_id=webhook_signer.message_id(row.event_id), timestamp=int(when.timestamp()), body=data,
            current=current, previous=previous,
        )
        try:
            outcome = await self._send(row.url, data, headers)
        except Exception:  # noqa: BLE001 — the request may have left: never retried, never counted
            logger.exception("webhook delivery %s: the send raised; recorded failed, not retried", row.id)
            await self._fail_unsent(row, "not_retried", now=now)
            return False
        return await self._record(row, outcome, now=now)

    def _signing_keys(self, row: outbox.ClaimedWebhookDelivery, when: datetime) -> tuple[str, str | None] | None:
        """The current signing key and, while its overlap runs, the previous one (D-13). ``None`` when
        the current one cannot be read (no cipher configured, or it will not decrypt)."""
        cipher = self._cipher_getter()
        if cipher is None:
            return None
        try:
            current = secret_cipher.decrypt_secret(row.secret_ciphertext, cipher)
        except (InvalidToken, ValueError):
            return None
        previous = None
        expires = row.previous_secret_expires_at
        if row.previous_secret_ciphertext and expires is not None and expires > when:
            try:
                previous = secret_cipher.decrypt_secret(row.previous_secret_ciphertext, cipher)
            except (InvalidToken, ValueError):
                logger.warning("webhook endpoint %s: the previous key is unreadable; signing with the current only",
                               row.endpoint_id)
        return current, previous

    async def _record(self, row: outbox.ClaimedWebhookDelivery, outcome: SendOutcome, *, now: datetime | None) -> bool:
        when = now or datetime.now(timezone.utc)
        common = dict(delivery_id=row.id, attempts=row.attempts, status_code=outcome.status_code,
                      latency_ms=outcome.latency_ms, error=outcome.error, now=now, attempted=True)
        if outcome.delivered:
            landed = await outbox.record_outcome(self._pool, status="sent", reason=None, **common)
            if landed:
                await outbox.mark_success(self._pool, endpoint_id=row.endpoint_id, now=now)
                logger.info("webhook delivery %s sent", row.id)
            return landed
        if outcome.gone:
            await outbox.record_outcome(self._pool, status="failed", reason="not_retried", **common)
            self.failed += 1
            await self._disable(row.endpoint_id, "gone", now=now)
            return False
        if outcome.retryable and row.attempts < MAX_ATTEMPTS:
            delay = next_delay(row.attempts, outcome.retry_after_seconds, rng=self._rng)
            await outbox.record_outcome(
                self._pool, status="retrying", reason=None, next_attempt_at=when + timedelta(seconds=delay), **common,
            )
            logger.info("webhook delivery %s will be retried (attempt %d, %s)", row.id, row.attempts, outcome.error)
            return False
        reason = "max_attempts" if outcome.retryable else "not_retried"
        landed = await outbox.record_outcome(self._pool, status="failed", reason=reason, **common)
        self.failed += 1
        logger.warning("webhook delivery %s failed (attempt %d, %s)", row.id, row.attempts, outcome.error)
        if landed:
            won = await outbox.register_failure(
                self._pool, endpoint_id=row.endpoint_id, threshold=AUTO_DISABLE_AFTER, now=now
            )
            if won is not None:
                await self._audit_disabled(won, "failing")
        return False

    async def _fail_unsent(self, row: outbox.ClaimedWebhookDelivery, reason: str, *, now: datetime | None) -> None:
        """Nothing was sent: ``failed`` with ``reason``, no attempt row, not counted toward auto-disable."""
        await outbox.record_outcome(
            self._pool, delivery_id=row.id, attempts=row.attempts, status="failed", reason=reason, error=None,
            now=now, attempted=False,
        )
        self.failed += 1
        logger.warning("webhook delivery %s failed before sending (%s)", row.id, reason)

    async def _record_unsent_error(self, row: outbox.ClaimedWebhookDelivery, *, now: datetime | None) -> None:
        """A row that raised BEFORE its send: nothing left the process, so it may be tried again."""
        when = now or datetime.now(timezone.utc)
        if row.attempts < MAX_ATTEMPTS:
            await outbox.record_outcome(
                self._pool, delivery_id=row.id, attempts=row.attempts, status="retrying", error=None, now=now,
                next_attempt_at=when + timedelta(seconds=next_delay(row.attempts, None, rng=self._rng)),
                attempted=False,
            )
        else:
            await self._fail_unsent(row, "max_attempts", now=now)

    async def _disable(self, endpoint_id: UUID, reason: str, *, now: datetime | None) -> None:
        won = await outbox.disable_endpoint(self._pool, endpoint_id=endpoint_id, reason=reason, now=now)
        if won is not None:
            await self._audit_disabled(won, reason)

    async def _audit_disabled(self, won: dict, reason: str) -> None:
        try:
            await self._audit(
                owner_id=won["user_id"], org_id=won["org_id"], endpoint_id=won["id"],
                host=webhook_urls.host_of(won["url"]), reason=reason,
            )
        except Exception:  # noqa: BLE001 — the endpoint is off either way; the audit is a record
            logger.exception("webhook endpoint %s: the auto-disable audit could not be written", won["id"])

    # ── housekeeping ──────────────────────────────────────────────────────────────────────

    async def _maybe_purge(self, *, now: datetime | None) -> None:
        moment = self._clock()
        if self._last_purge is not None and moment - self._last_purge < PURGE_EVERY_SECONDS:
            return
        self._last_purge = moment
        try:
            purged = await outbox.purge_old_events(self._pool, older_than_days=RETENTION_DAYS, now=now)
            if purged:
                logger.info("webhook drainer purged %d old event(s)", purged)
        except Exception:  # noqa: BLE001
            logger.exception("webhook drainer: the purge failed")
        try:
            await outbox.erase_expired_previous_secrets(self._pool, now=now)
        except Exception:  # noqa: BLE001
            logger.exception("webhook drainer: the expired previous-key erase failed")

    # ── the loop ──────────────────────────────────────────────────────────────────────────

    async def _loop(self) -> None:
        while not self._stopping.is_set():
            try:
                n = await self.tick()
                if n:
                    logger.info("webhook drainer sent %d delivery(ies)", n)
            except Exception:  # noqa: BLE001 — a failed tick never ends the loop
                logger.exception("webhook drainer tick failed (the loop continues)")
            try:
                # wait_for on the stop event rather than a bare sleep, so shutdown never waits out
                # a whole poll interval.
                await asyncio.wait_for(self._stopping.wait(), timeout=self._poll_interval_seconds)
            except asyncio.TimeoutError:
                pass

    def start(self) -> None:
        if self._task is not None:
            return
        self._stopping.clear()
        self._task = asyncio.ensure_future(self._loop())

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


class _PassCache:
    """Per send pass: liveness once per owner, visibility once per (owner, org, table) over every
    claimed item of that group."""

    def __init__(self, liveness, visibility, groups: dict) -> None:
        self._liveness = liveness
        self._visibility = visibility
        self._groups = groups
        self._allowed: dict[EndpointOwner, bool] = {}
        self._visible: dict[tuple, set] = {}

    async def allowed(self, owner: EndpointOwner) -> bool:
        if owner not in self._allowed:
            self._allowed[owner] = bool(await self._liveness(owner))
        return self._allowed[owner]

    async def visible(self, owner: EndpointOwner, table: str) -> set:
        key = (owner.user_id, owner.org_id, table)
        if key not in self._visible:
            ids = self._groups.get(key, [])
            self._visible[key] = (
                set(await self._visibility(owner_id=owner.user_id, org_id=owner.org_id, table=table, ids=ids))
                if ids else set()
            )
        return self._visible[key]


__all__ = [
    "AUTO_DISABLE_AFTER",
    "EndpointOwner",
    "JITTER_FRACTION",
    "MAX_ATTEMPTS",
    "PURGE_EVERY_SECONDS",
    "RETENTION_DAYS",
    "RETRY_SCHEDULE_SECONDS",
    "WebhookDrainer",
    "audit_auto_disabled",
    "endpoint_owner_allowed",
    "next_delay",
    "visible_item_ids",
]
