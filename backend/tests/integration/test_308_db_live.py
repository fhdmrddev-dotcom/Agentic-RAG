"""Phase 308-01 (D-04 / D-12 / D-13 / D-20 / D-21 / D-27 / D-30 / D-58) — ``app/db/webhooks.py``, LIVE.

Every function the routes (308-04) and the outbox (308-03) call, driven against the local database
(127.0.0.1:54322) on COMMITTED rows, because the module opens its own transactions on a pool:

* the owner predicate: another member's endpoint, or the same member's endpoint in another org, is a
  miss (None) on every read and write — the 404 contract;
* the cap: the 11th endpoint for one (member, org) raises ``EndpointCapReached``, even when 12 creates
  race; another org's endpoints do not count;
* the projection never carries ciphertext; only ``get_endpoint_signing`` does;
* roll keeps the previous secret for 24 h and a second roll drops the oldest;
* off / on: the owner's own turn-off leaves no reason, the admin's says ``admin`` and the owner cannot
  undo it (``EndpointAdminOff``); turning off skips pending deliveries; turning on resets the failure
  count and closes the open notice with ``endpoint_enabled``; a repeat writes nothing (``changed_now``);
* delivery log paging (newest first, keyset), test writes that never touch the failure count, resend
  (enabled endpoint only, never a test, never in flight), the one attempt insert, delete cascades.

Every row is removed in ``finally`` and the leftover count is asserted zero.
"""

from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from dataclasses import dataclass
from datetime import timedelta
from uuid import UUID, uuid4

import pytest

from tests.integration._rls_harness import PG_AVAILABLE, PG_TEST_DSN, requires_pg

SECRET_A = "enc:v1:QUFBQQ"
SECRET_B = "enc:v1:QkJCQg"
SECRET_C = "enc:v1:Q0NDQw"
EVENTS = ["run.finished", "document.ingested"]


def _migration_225_applied() -> bool:
    if not PG_AVAILABLE:
        return False

    async def _probe() -> bool:
        import asyncpg

        conn = await asyncpg.connect(PG_TEST_DSN)
        try:
            return bool(await conn.fetchval(
                "SELECT to_regclass('public.webhook_endpoints') IS NOT NULL"
                " AND to_regprocedure('public.webhook_emit_run_event()') IS NOT NULL"
            ))
        finally:
            await conn.close()

    try:
        loop = asyncio.new_event_loop()
        try:
            return loop.run_until_complete(_probe())
        finally:
            loop.close()
    except Exception:
        return False


requires_225 = pytest.mark.skipif(
    not _migration_225_applied(),
    reason="migration 225 not applied to the local database (public.webhook_endpoints absent)",
)

pytestmark = [requires_pg, requires_225]


@dataclass
class World:
    pool: object
    alice: UUID
    bob: UUID
    org_a: UUID
    org_b: UUID


@asynccontextmanager
async def _world():
    """Commit two members (alice in A and B, bob in A) and two orgs; delete it all."""
    import asyncpg

    pool = await asyncpg.create_pool(PG_TEST_DSN, min_size=2, max_size=14)
    alice, bob = uuid4(), uuid4()
    orgs: list[UUID] = []
    leftover = None
    try:
        async with pool.acquire() as con:
            for uid, label in ((alice, "alice"), (bob, "bob")):
                await con.execute("INSERT INTO auth.users (id, email) VALUES ($1, $2)", uid, f"308-01-{label}-{uid}@test.local")
            # handle_new_user provisions a personal org; remember it so finally removes it too.
            orgs += [r["org_id"] for r in await con.fetch(
                "SELECT org_id FROM public.org_members WHERE user_id = ANY($1::uuid[])", [alice, bob])]
            org_a = await con.fetchval("INSERT INTO public.organizations (name) VALUES ($1) RETURNING id", f"308-01 A {alice.hex[:6]}")
            org_b = await con.fetchval("INSERT INTO public.organizations (name) VALUES ($1) RETURNING id", f"308-01 B {alice.hex[:6]}")
            orgs += [org_a, org_b]
            for org, uid in ((org_a, alice), (org_b, alice), (org_a, bob)):
                await con.execute(
                    "INSERT INTO public.org_members (org_id, user_id, role) VALUES ($1, $2, 'member') ON CONFLICT DO NOTHING",
                    org, uid,
                )
        yield World(pool, alice, bob, org_a, org_b)
    finally:
        async with pool.acquire() as con:
            await con.execute("DELETE FROM public.organizations WHERE id = ANY($1::uuid[])", orgs)
            await con.execute("DELETE FROM auth.users WHERE id = ANY($1::uuid[])", [alice, bob])
            leftover = await con.fetchval(
                "SELECT (SELECT count(*) FROM auth.users WHERE id = ANY($1::uuid[]))"
                " + (SELECT count(*) FROM public.organizations WHERE id = ANY($2::uuid[]))"
                " + (SELECT count(*) FROM public.webhook_endpoints WHERE user_id = ANY($1::uuid[]))"
                " + (SELECT count(*) FROM public.webhook_events WHERE org_id = ANY($2::uuid[]))"
                " + (SELECT count(*) FROM public.notifications WHERE recipient_id = ANY($1::uuid[]))",
                [alice, bob], orgs,
            )
        await pool.close()
        assert leftover == 0, "the live fixture left committed rows behind"


async def _create(w: World, *, user=None, org=None, url="https://hooks.example.com/in", description=None):
    from app.db import webhooks as db

    return await db.create_endpoint(
        w.pool, user_id=user or w.alice, org_id=org or w.org_a, url=url, description=description,
        event_types=EVENTS, secret_ciphertext=SECRET_A,
    )


async def _delivery(w: World, endpoint_id, *, status="pending", type_="run.finished", created_offset=0):
    async with w.pool.acquire() as con:
        if type_ == "webhook.test":
            ev = await con.fetchval(
                "INSERT INTO public.webhook_events (type, org_id, endpoint_id, payload) VALUES ('webhook.test', $1, $2, '{}')"
                " RETURNING id", w.org_a, endpoint_id,
            )
        else:
            ev = await con.fetchval(
                "INSERT INTO public.webhook_events (type, org_id, item_id, owner_id, status, payload, created_at)"
                " VALUES ($1, $2, $3, $4, 'completed', '{}', now() - make_interval(secs => $5)) RETURNING id",
                type_, w.org_a, uuid4(), w.alice, created_offset,
            )
        return await con.fetchval(
            "INSERT INTO public.webhook_deliveries (endpoint_id, event_id, status, attempts, created_at)"
            " VALUES ($1, $2, $3, 3, now() - make_interval(secs => $4)) RETURNING id",
            endpoint_id, ev, status, created_offset,
        )


# ── projection + owner predicate ────────────────────────────────────────────────────────────


def test_the_client_projection_never_names_ciphertext():
    from app.db import webhooks as db

    assert "secret_ciphertext" not in db._ENDPOINT_COLUMNS
    assert "secret_ciphertext" in db._SIGNING_COLUMNS
    assert "previous_secret_ciphertext" in db._SIGNING_COLUMNS


async def test_create_list_get_and_the_owner_predicate():
    from app.db import webhooks as db

    async with _world() as w:
        e1 = await _create(w, description="Billing")
        e2 = await _create(w, url="https://hooks.example.com/two")
        other_org = await _create(w, org=w.org_b)
        bobs = await _create(w, user=w.bob)
        for row in (e1, e2, other_org, bobs):
            assert "secret_ciphertext" not in row and "previous_secret_ciphertext" not in row
        assert e1["enabled"] is True and e1["disabled_reason"] is None
        assert list(e1["event_types"]) == EVENTS

        mine = await db.list_endpoints_for_owner(w.pool, user_id=w.alice, org_id=w.org_a)
        assert [r["id"] for r in mine] == [e2["id"], e1["id"]]  # newest first
        assert all("secret_ciphertext" not in r for r in mine)

        assert (await db.get_endpoint_for_owner(w.pool, endpoint_id=e1["id"], user_id=w.alice, org_id=w.org_a))["id"] == e1["id"]
        # another member's row, the same member's row in another org, and a miss: all None
        assert await db.get_endpoint_for_owner(w.pool, endpoint_id=bobs["id"], user_id=w.alice, org_id=w.org_a) is None
        assert await db.get_endpoint_for_owner(w.pool, endpoint_id=other_org["id"], user_id=w.alice, org_id=w.org_a) is None
        assert await db.get_endpoint_for_owner(w.pool, endpoint_id=uuid4(), user_id=w.alice, org_id=w.org_a) is None
        assert await db.update_endpoint(w.pool, endpoint_id=bobs["id"], user_id=w.alice, org_id=w.org_a, description="x") is None
        assert await db.roll_secret(w.pool, endpoint_id=bobs["id"], user_id=w.alice, org_id=w.org_a, new_ciphertext=SECRET_B) is None
        assert await db.delete_endpoint(w.pool, endpoint_id=bobs["id"], org_id=w.org_a, owner_id=w.alice) is None
        assert await db.set_endpoint_enabled(
            w.pool, endpoint_id=bobs["id"], org_id=w.org_a, owner_id=w.alice, enabled=False, reason=None
        ) is None
        assert await db.list_deliveries(
            w.pool, endpoint_id=bobs["id"], user_id=w.alice, org_id=w.org_a, before=None, limit=10
        ) is None

        signing = await db.get_endpoint_signing(w.pool, endpoint_id=e1["id"], org_id=w.org_a)
        assert signing["secret_ciphertext"] == SECRET_A and signing["previous_secret_ciphertext"] is None
        assert await db.get_endpoint_signing(w.pool, endpoint_id=e1["id"], org_id=w.org_b) is None

        admin = await db.list_endpoints_for_org(w.pool, org_id=w.org_a)
        assert {r["id"] for r in admin} == {e1["id"], e2["id"], bobs["id"]}
        assert all("secret_ciphertext" not in r for r in admin)
        assert all(r["owner_is_member"] is True and r["owner_name"] for r in admin)


async def test_update_changes_only_the_given_fields():
    from app.db import webhooks as db

    async with _world() as w:
        e = await _create(w, description="Billing")
        r = await db.update_endpoint(w.pool, endpoint_id=e["id"], user_id=w.alice, org_id=w.org_a, description=None)
        assert r["description"] is None and r["url"] == e["url"] and list(r["event_types"]) == EVENTS
        r = await db.update_endpoint(
            w.pool, endpoint_id=e["id"], user_id=w.alice, org_id=w.org_a,
            url="https://hooks.example.com/new", event_types=["run.waiting"],
        )
        assert r["url"] == "https://hooks.example.com/new" and list(r["event_types"]) == ["run.waiting"]
        assert r["description"] is None


async def test_the_eleventh_endpoint_is_refused_even_under_a_race():
    from app.db import webhooks as db

    async with _world() as w:
        await _create(w, org=w.org_b)  # another org does not count
        results = await asyncio.gather(*[_create(w) for _ in range(12)], return_exceptions=True)
        ok = [r for r in results if isinstance(r, dict)]
        refused = [r for r in results if isinstance(r, db.EndpointCapReached)]
        assert len(ok) == db.MAX_ENDPOINTS_PER_MEMBER == 10
        assert len(refused) == 2, results
        with pytest.raises(db.EndpointCapReached):
            await _create(w)
        assert len(await db.list_endpoints_for_owner(w.pool, user_id=w.alice, org_id=w.org_a)) == 10
        assert await _create(w, user=w.bob)  # another member has their own ten


# ── roll ─────────────────────────────────────────────────────────────────────────────────────


async def test_roll_keeps_the_previous_secret_for_24_hours_and_a_second_roll_drops_the_oldest():
    from app.db import webhooks as db

    async with _world() as w:
        e = await _create(w)
        r1 = await db.roll_secret(w.pool, endpoint_id=e["id"], user_id=w.alice, org_id=w.org_a, new_ciphertext=SECRET_B)
        assert r1["ended_overlap"] is False
        assert r1["previous_secret_expires_at"] is not None
        s = await db.get_endpoint_signing(w.pool, endpoint_id=e["id"], org_id=w.org_a)
        assert (s["secret_ciphertext"], s["previous_secret_ciphertext"]) == (SECRET_B, SECRET_A)
        async with w.pool.acquire() as con:
            ttl = await con.fetchval(
                "SELECT previous_secret_expires_at - now() FROM public.webhook_endpoints WHERE id = $1", e["id"]
            )
        assert timedelta(hours=23, minutes=59) < ttl <= timedelta(hours=24)
        r2 = await db.roll_secret(w.pool, endpoint_id=e["id"], user_id=w.alice, org_id=w.org_a, new_ciphertext=SECRET_C)
        assert r2["ended_overlap"] is True
        s = await db.get_endpoint_signing(w.pool, endpoint_id=e["id"], org_id=w.org_a)
        assert (s["secret_ciphertext"], s["previous_secret_ciphertext"]) == (SECRET_C, SECRET_B)


# ── off / on ─────────────────────────────────────────────────────────────────────────────────


async def test_owner_off_skips_pending_and_owner_on_resets_and_closes_the_notice():
    from app.db import webhooks as db

    async with _world() as w:
        e = await _create(w)
        pending = await _delivery(w, e["id"], status="pending")
        retrying = await _delivery(w, e["id"], status="retrying")
        sent = await _delivery(w, e["id"], status="sent")

        off = await db.set_endpoint_enabled(w.pool, endpoint_id=e["id"], org_id=w.org_a, owner_id=w.alice, enabled=False, reason=None)
        assert off["enabled"] is False and off["disabled_reason"] is None and off["disabled_at"] is not None
        assert off["changed_now"] is True
        again = await db.set_endpoint_enabled(w.pool, endpoint_id=e["id"], org_id=w.org_a, owner_id=w.alice, enabled=False, reason=None)
        assert again["changed_now"] is False
        async with w.pool.acquire() as con:
            st = {r["id"]: r["status"] for r in await con.fetch(
                "SELECT id, status FROM public.webhook_deliveries WHERE endpoint_id = $1", e["id"])}
            assert st == {pending: "skipped_disabled", retrying: "skipped_disabled", sent: "sent"}
            # the drainer's state: five failures and an open notice
            await con.execute(
                "UPDATE public.webhook_endpoints SET consecutive_failures = 5, disabled_reason = 'failing' WHERE id = $1", e["id"]
            )
            await con.execute(
                "INSERT INTO public.notifications (recipient_id, org_id, kind, endpoint_id) VALUES ($1, $2, 'webhook_disabled', $3)",
                w.alice, w.org_a, e["id"],
            )

        on = await db.set_endpoint_enabled(w.pool, endpoint_id=e["id"], org_id=w.org_a, owner_id=w.alice, enabled=True, reason=None)
        assert on["enabled"] is True and on["disabled_reason"] is None and on["disabled_at"] is None
        assert on["consecutive_failures"] == 0 and on["changed_now"] is True
        async with w.pool.acquire() as con:
            n = await con.fetchrow("SELECT closed_at, closed_reason FROM public.notifications WHERE endpoint_id = $1", e["id"])
        assert n["closed_at"] is not None and n["closed_reason"] == "endpoint_enabled"
        assert (await db.set_endpoint_enabled(
            w.pool, endpoint_id=e["id"], org_id=w.org_a, owner_id=w.alice, enabled=True, reason=None
        ))["changed_now"] is False


async def test_admin_off_cannot_be_undone_by_the_owner():
    from app.db import webhooks as db

    async with _world() as w:
        e = await _create(w)
        off = await db.set_endpoint_enabled(w.pool, endpoint_id=e["id"], org_id=w.org_a, owner_id=None, enabled=False, reason=None)
        assert off["disabled_reason"] == "admin" and off["changed_now"] is True
        refused = await db.set_endpoint_enabled(w.pool, endpoint_id=e["id"], org_id=w.org_a, owner_id=w.alice, enabled=True, reason=None)
        assert refused is db.EndpointAdminOff
        still = await db.get_endpoint_for_owner(w.pool, endpoint_id=e["id"], user_id=w.alice, org_id=w.org_a)
        assert still["enabled"] is False and still["disabled_reason"] == "admin"
        on = await db.set_endpoint_enabled(w.pool, endpoint_id=e["id"], org_id=w.org_a, owner_id=None, enabled=True, reason=None)
        assert on["enabled"] is True and on["disabled_reason"] is None and on["changed_now"] is True
        # the admin path is org-scoped: another org's admin reaches nothing
        assert await db.set_endpoint_enabled(
            w.pool, endpoint_id=e["id"], org_id=w.org_b, owner_id=None, enabled=False, reason=None
        ) is None


# ── delivery log, test writes, resend ───────────────────────────────────────────────────────


async def test_delivery_log_is_newest_first_with_keyset_paging():
    from app.db import webhooks as db

    async with _world() as w:
        e = await _create(w)
        ids = [await _delivery(w, e["id"], status="sent", created_offset=100 - i) for i in range(5)]
        hidden = await _delivery(w, e["id"], status="skipped_not_visible", created_offset=0)
        page = await db.list_deliveries(w.pool, endpoint_id=e["id"], user_id=w.alice, org_id=w.org_a, before=None, limit=4)
        got = [r["id"] for r in page["items"]]
        assert got == [hidden, *reversed(ids)][:4]
        assert page["items"][0]["item_id"] is None  # a skipped_not_visible row never names its item
        assert all(r["item_id"] is not None for r in page["items"][1:])
        assert page["items"][1]["event_type"] == "run.finished"
        assert page["next_cursor"] is not None
        page2 = await db.list_deliveries(
            w.pool, endpoint_id=e["id"], user_id=w.alice, org_id=w.org_a, before=page["next_cursor"], limit=4
        )
        assert [r["id"] for r in page2["items"]] == list(reversed(ids))[3:]
        assert page2["next_cursor"] is None
        for row in page["items"]:
            assert not any(k in row for k in ("payload", "body", "response", "headers"))


async def test_a_test_delivery_never_counts_toward_auto_disable():
    from app.db import webhooks as db

    async with _world() as w:
        e = await _create(w)
        event_id, delivery_id = await db.create_test_delivery(w.pool, endpoint_id=e["id"], org_id=w.org_a, payload='{"type":"webhook.test"}')
        async with w.pool.acquire() as con:
            ev = await con.fetchrow("SELECT type, endpoint_id, payload, fanned_out_at FROM public.webhook_events WHERE id = $1", event_id)
            d = await con.fetchrow("SELECT status, attempts, claimed_at FROM public.webhook_deliveries WHERE id = $1", delivery_id)
        assert (ev["type"], ev["endpoint_id"], ev["payload"]) == ("webhook.test", e["id"], '{"type":"webhook.test"}')
        assert ev["fanned_out_at"] is not None
        assert (d["status"], d["attempts"]) == ("sending", 1) and d["claimed_at"] is not None
        assert await db.create_test_delivery(w.pool, endpoint_id=e["id"], org_id=w.org_b, payload="{}") is None

        await db.record_test_outcome(w.pool, delivery_id=delivery_id, sent=False, status_code=500, latency_ms=42, error="http_status")
        async with w.pool.acquire() as con:
            d = await con.fetchrow(
                "SELECT status, reason, last_status_code, last_latency_ms, last_error, last_attempt_at, sent_at"
                " FROM public.webhook_deliveries WHERE id = $1", delivery_id)
            att = await con.fetch("SELECT attempt, status_code, latency_ms, error FROM public.webhook_delivery_attempts WHERE delivery_id = $1", delivery_id)
            ep = await con.fetchrow("SELECT consecutive_failures, last_success_at FROM public.webhook_endpoints WHERE id = $1", e["id"])
        assert (d["status"], d["reason"], d["last_status_code"], d["last_latency_ms"], d["last_error"]) == (
            "failed", "not_retried", 500, 42, "http_status")
        assert d["last_attempt_at"] is not None and d["sent_at"] is None
        assert [tuple(r) for r in att] == [(1, 500, 42, "http_status")]
        assert (ep["consecutive_failures"], ep["last_success_at"]) == (0, None)

        _, ok_id = await db.create_test_delivery(w.pool, endpoint_id=e["id"], org_id=w.org_a, payload="{}")
        await db.record_test_outcome(w.pool, delivery_id=ok_id, sent=True, status_code=204, latency_ms=10, error=None)
        async with w.pool.acquire() as con:
            d = await con.fetchrow("SELECT status, reason, sent_at FROM public.webhook_deliveries WHERE id = $1", ok_id)
            ep = await con.fetchrow("SELECT consecutive_failures, last_success_at FROM public.webhook_endpoints WHERE id = $1", e["id"])
        assert d["status"] == "sent" and d["reason"] is None and d["sent_at"] is not None
        assert (ep["consecutive_failures"], ep["last_success_at"]) == (0, None)


async def test_resend_rules():
    from app.db import webhooks as db

    async with _world() as w:
        e = await _create(w)
        failed = await _delivery(w, e["id"], status="failed")
        sent = await _delivery(w, e["id"], status="sent")
        sending = await _delivery(w, e["id"], status="sending")
        skipped = await _delivery(w, e["id"], status="skipped_not_visible")
        test = await _delivery(w, e["id"], status="sent", type_="webhook.test")
        kw = {"endpoint_id": e["id"], "user_id": w.alice, "org_id": w.org_a}

        for did in (sending, skipped, test):
            assert await db.resend_delivery(w.pool, delivery_id=did, **kw) is None
        assert await db.resend_delivery(w.pool, delivery_id=failed, endpoint_id=e["id"], user_id=w.bob, org_id=w.org_a) is None

        r = await db.resend_delivery(w.pool, delivery_id=failed, **kw)
        assert r is not None
        async with w.pool.acquire() as con:
            d = await con.fetchrow(
                "SELECT status, attempts, claimed_at, reason, next_attempt_at <= now() AS due FROM public.webhook_deliveries WHERE id = $1",
                failed)
        assert (d["status"], d["attempts"], d["claimed_at"], d["reason"], d["due"]) == ("pending", 0, None, None, True)

        await db.set_endpoint_enabled(w.pool, endpoint_id=e["id"], org_id=w.org_a, owner_id=w.alice, enabled=False, reason=None)
        with pytest.raises(db.EndpointOff):
            await db.resend_delivery(w.pool, delivery_id=sent, **kw)


async def test_insert_attempt_is_the_one_attempt_insert():
    from app.db import webhooks as db

    async with _world() as w:
        e = await _create(w)
        did = await _delivery(w, e["id"], status="sending")
        async with w.pool.acquire() as con:
            await db.insert_attempt(con, delivery_id=did, attempt=4, status_code=None, latency_ms=3000, error="timeout")
            row = await con.fetchrow("SELECT attempt, status_code, latency_ms, error FROM public.webhook_delivery_attempts WHERE delivery_id = $1", did)
        assert tuple(row) == (4, None, 3000, "timeout")


async def test_delete_returns_the_row_and_cascades():
    from app.db import webhooks as db

    async with _world() as w:
        e = await _create(w)
        did = await _delivery(w, e["id"], status="failed")
        async with w.pool.acquire() as con:
            await db.insert_attempt(con, delivery_id=did, attempt=1, status_code=500, latency_ms=5, error="http_status")
            await con.execute("UPDATE public.webhook_endpoints SET enabled = false, disabled_reason = 'gone' WHERE id = $1", e["id"])
            await con.execute(
                "INSERT INTO public.notifications (recipient_id, org_id, kind, endpoint_id) VALUES ($1, $2, 'webhook_disabled', $3)",
                w.alice, w.org_a, e["id"],
            )
        gone = await db.delete_endpoint(w.pool, endpoint_id=e["id"], org_id=w.org_a, owner_id=w.alice)
        assert (gone["id"], gone["url"], gone["user_id"]) == (e["id"], e["url"], w.alice)
        async with w.pool.acquire() as con:
            left = await con.fetchval(
                "SELECT (SELECT count(*) FROM public.webhook_deliveries WHERE id = $1)"
                " + (SELECT count(*) FROM public.webhook_delivery_attempts WHERE delivery_id = $1)"
                " + (SELECT count(*) FROM public.notifications WHERE endpoint_id = $2)", did, e["id"])
        assert left == 0
        assert await db.delete_endpoint(w.pool, endpoint_id=e["id"], org_id=w.org_a, owner_id=w.alice) is None
