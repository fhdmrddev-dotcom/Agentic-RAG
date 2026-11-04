"""Phase 308-03 (D-18 / D-19 / D-48; Pitfall 9; SC#4's backend truth) — a receiver that keeps failing
is turned off with ONE in-app notice, LIVE.

* five deliveries ending ``failed`` (the fake receiver answers 400) turn the endpoint off with reason
  ``failing``; its other pending delivery becomes ``skipped_disabled``; exactly ONE open
  ``webhook_disabled`` notice and ONE audit call — also when two drainers record the fifth failure at
  once, and when two callers race ``register_failure`` directly;
* ``list_open_notices`` lists it for the owner and counts it in ``total``; the run-waiting email
  drainer's ``CLAIM_SQL`` claims nothing for it (it has no delivery row);
* a 410 on another endpoint: off at once with reason ``gone`` and one notice;
* turning the endpoint on closes the notice (``endpoint_enabled``) and the list drops it; deleting an
  endpoint removes its notice (cascade).

Committed rows pinned to the year 2000, removed in ``finally`` with a zero-leftover assertion (the
``test_308_drainer_once_live`` world). Run under the local-DB lock, with ``-rs``.
"""
from __future__ import annotations

import asyncio

from app.db import notifications as notifications_db
from app.db import webhook_outbox as outbox
from app.db import webhooks as webhooks_db
from app.services import webhook_drainer as wd
from tests.integration._rls_harness import requires_pg
from tests.integration.test_308_db_live import requires_225
from tests.integration.test_308_drainer_once_live import NOW, CountingAudit, CountingSend, failed, world

pytestmark = [requires_pg, requires_225]


async def _open_notices(w, endpoint) -> list:
    return [n for n in await w.notices(endpoint) if n["closed_at"] is None]


async def test_five_failures_turn_the_endpoint_off_with_one_notice():
    async with world() as w:
        ep = await w.endpoint(w.alice)
        for _ in range(6):
            assert await w.finish(await w.run(w.alice))
        # fan out all six, then send five at a time
        assert await w.drainer(CountingSend())._fan_out(now=NOW) == 6
        send, audit = CountingSend(failed(400)), CountingAudit()
        await w.drainer(send, audit=audit, max_claims_per_tick=5).tick(now=NOW)

        assert len(send.calls) == 5
        endpoint = await w.endpoint_row(ep)
        assert endpoint["enabled"] is False and endpoint["disabled_reason"] == "failing"
        assert endpoint["consecutive_failures"] == 5
        statuses = sorted(r["status"] for r in await w.deliveries(ep))
        assert statuses == ["failed"] * 5 + ["skipped_disabled"]
        assert all(r["reason"] == "not_retried" for r in await w.deliveries(ep) if r["status"] == "failed")
        (notice,) = await _open_notices(w, ep)
        assert notice["kind"] == "webhook_disabled" and notice["recipient_id"] == w.alice
        assert len(audit.calls) == 1
        assert audit.calls[0]["reason"] == "failing" and audit.calls[0]["endpoint_id"] == ep
        assert audit.calls[0]["host"] == "hooks.example.com"

        rows, total = await notifications_db.list_open_notices(w.pool, w.alice)
        mine = [r for r in rows if r["endpoint_id"] == ep]
        assert len(mine) == 1 and mine[0]["kind"] == "webhook_disabled" and mine[0]["reason"] == "failing"
        assert total >= 1 and total == len(rows)

        # the email drainer drives from notification_deliveries only: nothing to claim for this notice
        async with w.pool.acquire() as c:
            tr = c.transaction()
            await tr.start()
            try:
                claimable = await c.fetch(notifications_db.CLAIM_SQL, 1000, None, notifications_db.MAX_ATTEMPTS)
            finally:
                await tr.rollback()
        assert notice["id"] not in {r["notification_id"] for r in claimable}
        assert await w.pool.fetchval(
            "SELECT count(*) FROM public.notification_deliveries WHERE notification_id = $1", notice["id"]
        ) == 0

        # turning it on closes the notice; the list drops it
        on = await webhooks_db.set_endpoint_enabled(w.pool, endpoint_id=ep, org_id=w.org, owner_id=w.alice,
                                                    enabled=True, reason=None)
        assert on["enabled"] is True and on["consecutive_failures"] == 0
        (closed,) = await w.notices(ep)
        assert closed["closed_at"] is not None and closed["closed_reason"] == "endpoint_enabled"
        rows, _ = await notifications_db.list_open_notices(w.pool, w.alice)
        assert not [r for r in rows if r["endpoint_id"] == ep]


async def test_two_drainers_recording_the_fifth_failure_write_one_notice_and_one_audit():
    async with world() as w:
        ep = await w.endpoint(w.alice)
        for _ in range(2):
            assert await w.finish(await w.run(w.alice))
        assert await w.drainer(CountingSend())._fan_out(now=NOW) == 2
        await w.pool.execute("UPDATE public.webhook_endpoints SET consecutive_failures = 4 WHERE id = $1", ep)
        send, audit = CountingSend(failed(400)), CountingAudit()
        a = w.drainer(send, audit=audit, max_claims_per_tick=1)
        b = w.drainer(send, audit=audit, max_claims_per_tick=1)

        await asyncio.gather(a.tick(now=NOW), b.tick(now=NOW))

        assert 1 <= len(send.calls) <= 2
        endpoint = await w.endpoint_row(ep)
        assert endpoint["enabled"] is False and endpoint["disabled_reason"] == "failing"
        assert len(await _open_notices(w, ep)) == 1, "Pitfall 9: exactly one notice"
        assert len(audit.calls) == 1, "exactly one auto_disabled audit"


async def test_register_failure_racing_at_the_threshold_has_exactly_one_winner():
    async with world() as w:
        ep = await w.endpoint(w.alice)
        await w.pool.execute("UPDATE public.webhook_endpoints SET consecutive_failures = 4 WHERE id = $1", ep)
        results = await asyncio.gather(*(
            outbox.register_failure(w.pool, endpoint_id=ep, threshold=wd.AUTO_DISABLE_AFTER, now=NOW)
            for _ in range(4)
        ))
        assert sum(r is not None for r in results) == 1
        assert len(await _open_notices(w, ep)) == 1


async def test_a_410_turns_the_endpoint_off_at_once_with_one_notice():
    async with world() as w:
        healthy = await w.endpoint(w.alice, url="https://hooks.example.com/ok", events=("run.waiting",))
        ep = await w.endpoint(w.alice, url="https://hooks.example.com/gone", events=("run.finished",))
        assert await w.finish(await w.run(w.alice))
        audit = CountingAudit()
        await w.drainer(CountingSend(failed(410, "gone", gone=True)), audit=audit).tick(now=NOW)
        endpoint = await w.endpoint_row(ep)
        assert endpoint["enabled"] is False and endpoint["disabled_reason"] == "gone"
        (row,) = await w.deliveries(ep)
        assert (row["status"], row["last_error"], row["last_status_code"]) == ("failed", "gone", 410)
        assert len(await _open_notices(w, ep)) == 1
        assert [c["reason"] for c in audit.calls] == ["gone"]
        assert (await w.endpoint_row(healthy))["enabled"] is True and await w.notices(healthy) == []


async def test_deleting_an_endpoint_removes_its_notice():
    async with world() as w:
        ep = await w.endpoint(w.alice)
        assert await w.finish(await w.run(w.alice))
        await w.drainer(CountingSend(failed(410, "gone", gone=True))).tick(now=NOW)
        assert len(await _open_notices(w, ep)) == 1
        deleted = await webhooks_db.delete_endpoint(w.pool, endpoint_id=ep, org_id=w.org, owner_id=w.alice)
        assert deleted is not None
        assert await w.notices(ep) == []
        assert await w.pool.fetchval(
            "SELECT count(*) FROM public.notifications WHERE recipient_id = $1 AND kind = 'webhook_disabled'", w.alice
        ) == 0
