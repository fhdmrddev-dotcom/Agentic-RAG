"""Phase 308-03 (D-07 / D-08 a / D-09 / D-10 / D-11 / D-13 / D-15 / D-41; SC#2) — webhooks send ONCE, LIVE.

Two ``WebhookDrainer`` instances race over the REAL local Postgres (127.0.0.1:54322) with a counting
fake ``send``: exactly one send per (endpoint, event). Then the identity rules: the ``webhook-id``
stays ``msg_<event id>`` across a retry and a resend while the timestamp and signature are recomputed
per attempt; a rolled secret signs twice during its overlap and once after it, and the expired key is
erased; the org's redaction switch ON freezes the same bytes as OFF. WR-03: a row reclaimed between
claim and renew is never sent by the worker that lost it.

⚠ THESE ROWS ARE COMMITTED — two drainers on two connections must both see them. Every row is created
with an id this file knows and deleted in ``finally``; the leftover count is asserted zero. Run under
the local-DB lock. Events are written by migration 225's own trigger from a real status write, never
inserted by hand.

⚠ ISOLATION FROM THE DEV OUTBOX: every tick is pinned to the year 2000. This file moves its own events'
``created_at`` (and its endpoints' ``created_at``) into 1999-2000, and fan-out stamps its deliveries due
at the pinned time. A real event is created at a real ``now()`` (2026+), so a pinned tick can never
fan out, claim, reclaim or purge a row this file did not create.

No real HTTP call is ever made: ``send`` is a fake with ``webhook_sender.send``'s signature, and the
secrets are encrypted with a test ``MultiFernet`` passed through ``cipher_getter``.
"""
from __future__ import annotations

import asyncio
import base64
import hashlib
import hmac
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

import pytest
from cryptography.fernet import Fernet, MultiFernet

from app.db import webhook_outbox as outbox
from app.db import webhooks as webhooks_db
from app.security import secret_cipher
from app.services import webhook_drainer as wd
from app.services import webhook_signer
from app.services.webhook_sender import SendOutcome
from tests.integration._rls_harness import PG_TEST_DSN, requires_pg
from tests.integration.test_308_db_live import requires_225

pytestmark = [requires_pg, requires_225]

T0 = datetime(2000, 1, 1, 0, 0, tzinfo=timezone.utc)
NOW = T0 + timedelta(minutes=1)
CIPHER = MultiFernet([Fernet(Fernet.generate_key())])
ALL_TYPES = ("run.finished", "run.waiting", "document.ingested")


def ok(code: int = 200) -> SendOutcome:
    return SendOutcome(delivered=True, status_code=code, latency_ms=7, error=None, retryable=False)


def failed(code: int | None, error: str = "http_status", retryable: bool = False, **kw) -> SendOutcome:
    return SendOutcome(delivered=False, status_code=code, latency_ms=7, error=error, retryable=retryable, **kw)


class CountingSend:
    """``webhook_sender.send``'s shape; records every call, never touches the network."""

    def __init__(self, *outcomes: SendOutcome) -> None:
        self.outcomes = list(outcomes) or [ok()]
        self.calls: list[tuple[str, bytes, dict]] = []

    async def __call__(self, url: str, body: bytes, headers) -> SendOutcome:
        self.calls.append((url, body, dict(headers)))
        return self.outcomes[min(len(self.calls) - 1, len(self.outcomes) - 1)]


class CountingAudit:
    def __init__(self) -> None:
        self.calls: list[dict] = []

    async def __call__(self, **kw) -> None:
        self.calls.append(kw)


def verify(secret: str, headers: dict, body: bytes, sig: str) -> bool:
    key = base64.b64decode(secret[len("whsec_"):])
    mac = hmac.new(key, f"{headers['webhook-id']}.{headers['webhook-timestamp']}.".encode() + body, hashlib.sha256)
    return sig == "v1," + base64.b64encode(mac.digest()).decode()


@dataclass
class World:
    pool: object
    org: UUID
    alice: UUID
    bob: UUID
    threads: dict
    definitions: dict
    orgs: list = field(default_factory=list)
    secrets: dict = field(default_factory=dict)

    def drainer(self, send, *, audit=None, **kw) -> wd.WebhookDrainer:
        return wd.WebhookDrainer(self.pool, send=send, cipher_getter=lambda: CIPHER,
                                 audit=audit or CountingAudit(), **kw)

    async def endpoint(self, owner: UUID, *, url: str = "https://hooks.example.com/in",
                       events=ALL_TYPES) -> UUID:
        secret = webhook_signer.new_secret()
        async with self.pool.acquire() as c:
            ep = await c.fetchval(
                "INSERT INTO public.webhook_endpoints (user_id, org_id, url, event_types, secret_ciphertext, created_at)"
                " VALUES ($1, $2, $3, $4::text[], $5, $6) RETURNING id",
                owner, self.org, url, list(events), secret_cipher.encrypt_secret(secret, CIPHER),
                T0 - timedelta(days=1),
            )
        self.secrets[ep] = secret
        return ep

    async def run(self, owner: UUID) -> UUID:
        return await self.pool.fetchval(
            "INSERT INTO public.workflow_runs (thread_id, definition_id, status, org_id, user_id, inputs, origin_kind)"
            " VALUES ($1, $2, 'active', $3, $4, '{}'::jsonb, 'app') RETURNING id",
            self.threads[owner], self.definitions[owner], self.org, owner,
        )

    async def finish(self, run: UUID, status: str = "completed") -> UUID | None:
        """A real status write (225's trigger emits); the event is then pinned into 2000."""
        await self.pool.execute("UPDATE public.workflow_runs SET status = $2 WHERE id = $1", run, status)
        return await self.pin(run)

    async def doc(self, owner: UUID) -> UUID:
        return await self.pool.fetchval(
            "INSERT INTO public.documents (user_id, org_id, filename, mime_type, file_size, file_path, status)"
            " VALUES ($1, $2, $3, 'text/plain', 1, $4, 'processing') RETURNING id",
            owner, self.org, f"308-03-{uuid4().hex[:6]}.txt", f"308-03/{uuid4()}",
        )

    async def complete_doc(self, doc: UUID) -> UUID | None:
        await self.pool.execute("UPDATE public.documents SET status = 'completed' WHERE id = $1", doc)
        return await self.pin(doc)

    async def pin(self, item: UUID) -> UUID | None:
        return await self.pool.fetchval(
            "UPDATE public.webhook_events SET created_at = $2 WHERE item_id = $1 AND fanned_out_at IS NULL"
            " RETURNING id", item, T0,
        )

    async def deliveries(self, endpoint: UUID) -> list:
        return await self.pool.fetch(
            "SELECT id, event_id, status, reason, attempts, last_status_code, last_error, next_attempt_at, sent_at"
            " FROM public.webhook_deliveries WHERE endpoint_id = $1 ORDER BY created_at, id", endpoint,
        )

    async def endpoint_row(self, endpoint: UUID):
        return await self.pool.fetchrow("SELECT * FROM public.webhook_endpoints WHERE id = $1", endpoint)

    async def notices(self, endpoint: UUID) -> list:
        return await self.pool.fetch(
            "SELECT id, kind, closed_at, closed_reason, recipient_id FROM public.notifications WHERE endpoint_id = $1",
            endpoint,
        )


@asynccontextmanager
async def world():
    """Commit one org with two members (alice, bob), each with a thread and a definition; delete it all."""
    import asyncpg

    pool = await asyncpg.create_pool(PG_TEST_DSN, min_size=2, max_size=8)
    alice, bob = uuid4(), uuid4()
    orgs: list[UUID] = []
    threads: dict = {}
    definitions: dict = {}
    leftover = None
    try:
        async with pool.acquire() as c:
            for uid, label in ((alice, "alice"), (bob, "bob")):
                await c.execute("INSERT INTO auth.users (id, email) VALUES ($1, $2)", uid, f"308-03-{label}-{uid}@test.local")
            # handle_new_user provisions a personal org each; remember them so finally removes them.
            orgs += [r["org_id"] for r in await c.fetch(
                "SELECT org_id FROM public.org_members WHERE user_id = ANY($1::uuid[])", [alice, bob])]
            org = await c.fetchval("INSERT INTO public.organizations (name) VALUES ($1) RETURNING id", f"308-03 {alice.hex[:6]}")
            orgs.append(org)
            for uid in (alice, bob):
                await c.execute("INSERT INTO public.org_members (org_id, user_id, role) VALUES ($1, $2, 'member')", org, uid)
                threads[uid] = await c.fetchval(
                    "INSERT INTO public.threads (user_id, org_id, title) VALUES ($1, $2, '308-03') RETURNING id", uid, org,
                )
                definitions[uid] = await c.fetchval(
                    "INSERT INTO public.workflow_definitions (slug, name, created_by, org_id, status)"
                    " VALUES ($1, '308-03 wf', $2, $3, 'published') RETURNING id",
                    f"p308-03-{uuid4().hex[:8]}", uid, org,
                )
        yield World(pool, org, alice, bob, threads, definitions, orgs)
    finally:
        users = [alice, bob]
        async with pool.acquire() as c:
            await c.execute("DELETE FROM public.workflow_runs WHERE user_id = ANY($1::uuid[])", users)
            await c.execute("DELETE FROM public.documents WHERE user_id = ANY($1::uuid[])", users)
            await c.execute("DELETE FROM public.threads WHERE user_id = ANY($1::uuid[])", users)
            await c.execute("DELETE FROM public.workflow_definitions WHERE created_by = ANY($1::uuid[])", users)
            await c.execute("DELETE FROM public.organizations WHERE id = ANY($1::uuid[])", orgs)
            await c.execute("DELETE FROM auth.users WHERE id = ANY($1::uuid[])", users)
            leftover = await c.fetchval(
                "SELECT (SELECT count(*) FROM auth.users WHERE id = ANY($1::uuid[]))"
                " + (SELECT count(*) FROM public.organizations WHERE id = ANY($2::uuid[]))"
                " + (SELECT count(*) FROM public.webhook_endpoints WHERE user_id = ANY($1::uuid[]))"
                " + (SELECT count(*) FROM public.webhook_events WHERE org_id = ANY($2::uuid[]))"
                " + (SELECT count(*) FROM public.notifications WHERE recipient_id = ANY($1::uuid[]))"
                " + (SELECT count(*) FROM public.workflow_runs WHERE user_id = ANY($1::uuid[]))"
                " + (SELECT count(*) FROM public.documents WHERE user_id = ANY($1::uuid[]))",
                users, orgs,
            )
        await pool.close()
        assert leftover == 0, "the live fixture left committed rows behind"


# ── exactly once with two workers (D-07 / D-08 a) ─────────────────────────────────────────


async def test_two_drainers_send_one_event_exactly_once():
    async with world() as w:
        ep = await w.endpoint(w.alice)
        event = await w.finish(await w.run(w.alice))
        assert event is not None, "non-vacuity: 225's trigger wrote one event"
        send = CountingSend()
        a, b = w.drainer(send), w.drainer(send)

        await asyncio.gather(a.tick(now=NOW), b.tick(now=NOW))

        rows = await w.deliveries(ep)
        assert len(rows) == 1, "UNIQUE (endpoint_id, event_id): one delivery per endpoint and event"
        assert len(send.calls) == 1, f"two drainers sent {len(send.calls)} times"
        url, body, headers = send.calls[0]
        assert headers["webhook-id"] == f"msg_{event}"
        assert verify(w.secrets[ep], headers, body, headers["webhook-signature"])
        assert rows[0]["status"] == "sent" and rows[0]["attempts"] == 1 and rows[0]["last_status_code"] == 200
        frozen = await w.pool.fetchval("SELECT payload FROM public.webhook_events WHERE id = $1", event)
        assert body == frozen.encode("ascii"), "the frozen bytes are exactly what was sent"
        assert a.sent + b.sent == 1

        await a.tick(now=NOW + timedelta(hours=1))
        assert len(send.calls) == 1, "a sent delivery is never sent again"


async def test_two_endpoints_get_exactly_one_call_each():
    async with world() as w:
        ep1 = await w.endpoint(w.alice, url="https://hooks.example.com/one")
        ep2 = await w.endpoint(w.alice, url="https://hooks.example.com/two")
        assert await w.finish(await w.run(w.alice))
        send = CountingSend()
        await asyncio.gather(w.drainer(send).tick(now=NOW), w.drainer(send).tick(now=NOW))
        assert sorted(c[0] for c in send.calls) == ["https://hooks.example.com/one", "https://hooks.example.com/two"]
        for ep in (ep1, ep2):
            (row,) = await w.deliveries(ep)
            assert row["status"] == "sent"


async def test_a_row_reclaimed_before_its_renew_is_never_sent_by_the_loser():
    """WR-03, live: A claims; its lease passes while the row is queued; B reclaims it and sends it
    (attempt 2). When A reaches the row, it must send nothing and record nothing over B."""
    async with world() as w:
        ep = await w.endpoint(w.alice)
        assert await w.finish(await w.run(w.alice))
        a_send, b_send = CountingSend(), CountingSend()
        a, b = w.drainer(a_send), w.drainer(b_send)
        assert await a._fan_out(now=NOW) == 1
        (a_row,) = await outbox.claim_due_deliveries(w.pool, limit=5, now=NOW, max_attempts=wd.MAX_ATTEMPTS)
        assert a_row.attempts == 1
        await w.pool.execute("UPDATE public.webhook_deliveries SET claimed_at = $2 WHERE id = $1",
                             a_row.id, NOW - timedelta(hours=1))
        await b.tick(now=NOW)
        (after_b,) = await w.deliveries(ep)
        assert after_b["status"] == "sent" and after_b["attempts"] == 2 and len(b_send.calls) == 1

        cache = wd._PassCache(a._liveness, a._visibility, {(a_row.user_id, a_row.org_id, "workflow_runs"): [a_row.item_id]})
        assert await a._process(a_row, now=NOW, cache=cache) is False
        assert a_send.calls == [], "WR-03: the first worker sent a row it no longer owned"
        (final,) = await w.deliveries(ep)
        assert (final["status"], final["attempts"]) == ("sent", 2)


async def test_a_row_reclaimed_and_claimed_again_elsewhere_is_not_sent_by_its_first_worker():
    """WR-03, the attempts half: B reclaimed AND re-claimed the row, so it is 'sending' again (one
    attempt later) while B's send is in flight. A's renew must not match it: no concurrent POST."""
    async with world() as w:
        ep = await w.endpoint(w.alice)
        assert await w.finish(await w.run(w.alice))
        a_send = CountingSend()
        a = w.drainer(a_send)
        assert await a._fan_out(now=NOW) == 1
        (a_row,) = await outbox.claim_due_deliveries(w.pool, limit=5, now=NOW, max_attempts=wd.MAX_ATTEMPTS)
        await w.pool.execute("UPDATE public.webhook_deliveries SET claimed_at = $2 WHERE id = $1",
                             a_row.id, NOW - timedelta(hours=1))
        assert await outbox.reclaim_stale_sending(w.pool, lease_seconds=600, max_attempts=wd.MAX_ATTEMPTS, now=NOW) == 1
        (b_row,) = await outbox.claim_due_deliveries(w.pool, limit=5, now=NOW, max_attempts=wd.MAX_ATTEMPTS)
        assert b_row.id == a_row.id and b_row.attempts == 2

        cache = wd._PassCache(a._liveness, a._visibility, {(a_row.user_id, a_row.org_id, "workflow_runs"): [a_row.item_id]})
        assert await a._process(a_row, now=NOW, cache=cache) is False
        assert a_send.calls == [], "WR-03: two workers would POST the same delivery at once"
        (row,) = await w.deliveries(ep)
        assert (row["status"], row["attempts"]) == ("sending", 2)


async def test_a_stale_test_delivery_is_failed_and_never_retried():
    """D-58: the drainer never claims a webhook.test delivery; a stranded one is failed, not retried."""
    async with world() as w:
        ep = await w.endpoint(w.alice)
        created = await webhooks_db.create_test_delivery(w.pool, endpoint_id=ep, org_id=w.org, payload="{}")
        assert created is not None
        _, delivery = created
        await w.pool.execute("UPDATE public.webhook_deliveries SET claimed_at = $2 WHERE id = $1",
                             delivery, NOW - timedelta(hours=1))
        send = CountingSend()
        await w.drainer(send).tick(now=NOW)
        row = await w.pool.fetchrow("SELECT status, reason, attempts FROM public.webhook_deliveries WHERE id = $1", delivery)
        assert (row["status"], row["reason"], row["attempts"]) == ("failed", "stale_lease", 1)
        await w.drainer(send).tick(now=NOW + timedelta(hours=1))
        assert send.calls == []


# ── identity across retry and resend (D-09 / D-11 / D-17 / D-21) ──────────────────────────


async def test_retry_and_resend_keep_the_webhook_id_and_resign_each_attempt():
    async with world() as w:
        ep = await w.endpoint(w.alice)
        event = await w.finish(await w.run(w.alice))
        send = CountingSend(failed(503, retryable=True), ok(), ok())
        d = w.drainer(send)
        await d.tick(now=NOW)
        (mid,) = await w.deliveries(ep)
        assert mid["status"] == "retrying" and mid["attempts"] == 1 and mid["last_status_code"] == 503
        due = (mid["next_attempt_at"] - NOW).total_seconds()
        assert 27 <= due <= 33, f"D-17: +30 s +-10 %, got {due}"

        await d.tick(now=NOW + timedelta(seconds=40))
        (done,) = await w.deliveries(ep)
        assert done["status"] == "sent" and done["attempts"] == 2
        attempts = await w.pool.fetch(
            "SELECT attempt, status_code FROM public.webhook_delivery_attempts WHERE delivery_id = $1 ORDER BY attempt",
            done["id"],
        )
        assert [(r["attempt"], r["status_code"]) for r in attempts] == [(1, 503), (2, 200)]

        resent = await webhooks_db.resend_delivery(w.pool, delivery_id=done["id"], endpoint_id=ep,
                                                   user_id=w.alice, org_id=w.org)
        assert resent is not None and resent["status"] == "pending" and resent["attempts"] == 0
        # pin the resent row back into 2000 so only this file's pinned tick can claim it
        await w.pool.execute("UPDATE public.webhook_deliveries SET next_attempt_at = $2 WHERE id = $1", done["id"], NOW)
        await d.tick(now=NOW + timedelta(minutes=5))

        assert len(send.calls) == 3
        ids = {c[2]["webhook-id"] for c in send.calls}
        assert ids == {f"msg_{event}"}, "webhook-id is stable across a retry and a resend"
        stamps = [int(c[2]["webhook-timestamp"]) for c in send.calls]
        assert stamps == [int(NOW.timestamp()), int(NOW.timestamp()) + 40, int(NOW.timestamp()) + 300]
        assert len({c[2]["webhook-signature"] for c in send.calls}) == 3, "signed again at each attempt"
        assert all(c[1] == send.calls[0][1] for c in send.calls), "the body bytes never change"
        for _, body, headers in send.calls:
            assert verify(w.secrets[ep], headers, body, headers["webhook-signature"])


async def test_a_rolled_secret_signs_twice_in_its_overlap_and_once_after_and_is_erased():
    async with world() as w:
        ep = await w.endpoint(w.alice)
        old = w.secrets[ep]
        new = webhook_signer.new_secret()
        rolled = await webhooks_db.roll_secret(w.pool, endpoint_id=ep, user_id=w.alice, org_id=w.org,
                                               new_ciphertext=secret_cipher.encrypt_secret(new, CIPHER))
        assert rolled is not None
        assert await w.finish(await w.run(w.alice))
        send = CountingSend()
        await w.drainer(send).tick(now=NOW)
        _, body, headers = send.calls[0]
        first, second = headers["webhook-signature"].split(" ")
        assert verify(new, headers, body, first) and verify(old, headers, body, second), "new first, then old"

        # the overlap has ended (as of the pinned clock): one signature, and the hourly tick erases it
        await w.pool.execute("UPDATE public.webhook_endpoints SET previous_secret_expires_at = $2 WHERE id = $1",
                             ep, NOW - timedelta(seconds=1))
        assert await w.finish(await w.run(w.alice))
        await w.drainer(send).tick(now=NOW)
        _, body2, headers2 = send.calls[1]
        assert headers2["webhook-signature"].count("v1,") == 1
        assert verify(new, headers2, body2, headers2["webhook-signature"])
        row = await w.endpoint_row(ep)
        assert row["previous_secret_ciphertext"] is None and row["previous_secret_expires_at"] is None


# ── redaction ON freezes the same bytes (D-15 / D-41) ─────────────────────────────────────


async def test_redaction_on_freezes_the_same_bytes_as_off_and_still_sends():
    from app.db import outbound_policy
    from app.services import webhook_sender

    async with world() as w:
        ep = await w.endpoint(w.alice)
        await w.pool.execute("UPDATE public.organizations SET pii_redaction_enabled = true WHERE id = $1", w.org)
        assert await outbound_policy.pii_redaction_enabled(w.pool, w.org) is True, "non-vacuity: the switch is ON"
        event = await w.finish(await w.run(w.alice))
        send = CountingSend()
        await w.drainer(send).tick(now=NOW)
        (row,) = await w.deliveries(ep)
        assert row["status"] == "sent" and len(send.calls) == 1
        frozen_on = await w.pool.fetchval("SELECT payload FROM public.webhook_events WHERE id = $1", event)

        ev = dict(await w.pool.fetchrow("SELECT * FROM public.webhook_events WHERE id = $1", event))

        async def off(_org):
            return False

        model = wd.build_run_event(
            type=ev["type"], event_id_created_at=ev["created_at"], run_id=ev["item_id"],
            workflow_id=ev["definition_id"], org_id=ev["org_id"], status=ev["status"], origin_kind=ev["origin_kind"],
        )
        frozen_off = await webhook_sender.freeze_payload(model, org_id=str(w.org), is_on=off)
        assert frozen_on == frozen_off, "D-41: the switch ON must not change one byte of an id-and-link payload"
        assert send.calls[0][1] == frozen_on.encode("ascii")
