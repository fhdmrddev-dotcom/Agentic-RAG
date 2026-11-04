"""Phase 308-01 (D-19 / D-48 / D-56; Pitfall 2, P-8, T-308-18) — the "Waiting on you" read lists a
``webhook_disabled`` notice, LIVE against the local database (127.0.0.1:54322).

* an open webhook_disabled notice (endpoint off with reason failing or gone) is listed for its owner
  with ``run_id`` null, ``endpoint_id``, ``reason`` and a ``title`` (the description, else host + path
  with the query removed, ``title_is_address`` true), and ``total`` counts it beside a run notice;
* it is NOT listed once the endpoint is on again, when the endpoint's reason is admin or
  owner_removed, when the recipient left the org (the org_members join — the access wall), or for
  another member;
* a run notice behaves exactly as before (the run status wall still applies) and serialises with
  exactly the keys it had before 308;
* the email drainer's CLAIM_SQL claims nothing for a webhook notice (it has no delivery row).

Committed rows (the route reads through a pool), removed in ``finally``; leftovers asserted zero.
"""

from __future__ import annotations

import asyncio
import json
from contextlib import asynccontextmanager
from dataclasses import dataclass
from uuid import UUID, uuid4

import pytest

from tests.integration._rls_harness import PG_AVAILABLE, PG_TEST_DSN, requires_pg

RUN_NOTICE_KEYS = {"id", "run_id", "org_id", "org_name", "workflow_name", "kind", "origin", "created_at"}


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
    org: UUID
    run: UUID
    run_notice: UUID


@asynccontextmanager
async def _world():
    """Commit alice + bob in one org, an active run of alice's with an open question notice."""
    import asyncpg

    pool = await asyncpg.create_pool(PG_TEST_DSN, min_size=1, max_size=4)
    alice, bob = uuid4(), uuid4()
    orgs: list[UUID] = []
    leftover = None
    try:
        async with pool.acquire() as con:
            for uid, label in ((alice, "alice"), (bob, "bob")):
                await con.execute("INSERT INTO auth.users (id, email) VALUES ($1, $2)", uid, f"308-01n-{label}-{uid}@test.local")
            orgs += [r["org_id"] for r in await con.fetch(
                "SELECT org_id FROM public.org_members WHERE user_id = ANY($1::uuid[])", [alice, bob])]
            org = await con.fetchval("INSERT INTO public.organizations (name) VALUES ($1) RETURNING id", f"308-01n {alice.hex[:6]}")
            orgs.append(org)
            for uid in (alice, bob):
                await con.execute(
                    "INSERT INTO public.org_members (org_id, user_id, role) VALUES ($1, $2, 'member') ON CONFLICT DO NOTHING",
                    org, uid,
                )
            thread = await con.fetchval(
                "INSERT INTO public.threads (user_id, org_id, title) VALUES ($1, $2, '308 thread') RETURNING id", alice, org
            )
            definition = await con.fetchval(
                "INSERT INTO public.workflow_definitions (slug, name, created_by, org_id, status)"
                " VALUES ($1, 'Compliance Gap Report', $2, $3, 'published') RETURNING id",
                f"308-01n-{alice.hex[:8]}", alice, org,
            )
            run = await con.fetchval(
                "INSERT INTO public.workflow_runs (thread_id, definition_id, status, org_id, user_id, inputs, origin_kind)"
                " VALUES ($1, $2, 'active', $3, $4, '{}'::jsonb, 'app') RETURNING id",
                thread, definition, org, alice,
            )
            run_notice = await con.fetchval(
                "INSERT INTO public.notifications (recipient_id, org_id, run_id, kind, tool_call_id, created_at)"
                " VALUES ($1, $2, $3, 'question', 'tc-308', now() - interval '10 minutes') RETURNING id",
                alice, org, run,
            )
        yield World(pool, alice, bob, org, run, run_notice)
    finally:
        async with pool.acquire() as con:
            await con.execute("DELETE FROM public.workflow_runs WHERE user_id = ANY($1::uuid[])", [alice, bob])
            await con.execute("DELETE FROM public.threads WHERE user_id = ANY($1::uuid[])", [alice, bob])
            await con.execute("DELETE FROM public.workflow_definitions WHERE created_by = ANY($1::uuid[])", [alice, bob])
            await con.execute("DELETE FROM public.organizations WHERE id = ANY($1::uuid[])", orgs)
            await con.execute("DELETE FROM auth.users WHERE id = ANY($1::uuid[])", [alice, bob])
            leftover = await con.fetchval(
                "SELECT (SELECT count(*) FROM auth.users WHERE id = ANY($1::uuid[]))"
                " + (SELECT count(*) FROM public.organizations WHERE id = ANY($2::uuid[]))"
                " + (SELECT count(*) FROM public.webhook_endpoints WHERE user_id = ANY($1::uuid[]))"
                " + (SELECT count(*) FROM public.notifications WHERE recipient_id = ANY($1::uuid[]))"
                " + (SELECT count(*) FROM public.workflow_runs WHERE user_id = ANY($1::uuid[]))",
                [alice, bob], orgs,
            )
        await pool.close()
        assert leftover == 0, "the live fixture left committed rows behind"


async def _webhook_notice(w: World, *, owner=None, reason="failing", description=None,
                          url="https://hooks.example.com/in/abc?token=s3cr3t"):
    owner = owner or w.alice
    async with w.pool.acquire() as con:
        ep = await con.fetchval(
            "INSERT INTO public.webhook_endpoints"
            " (user_id, org_id, url, description, event_types, secret_ciphertext, enabled, disabled_reason, disabled_at)"
            " VALUES ($1, $2, $3, $4, ARRAY['run.finished'], 'enc:v1:eA', false, $5, now()) RETURNING id",
            owner, w.org, url, description, reason,
        )
        nid = await con.fetchval(
            "INSERT INTO public.notifications (recipient_id, org_id, kind, endpoint_id) VALUES ($1, $2, 'webhook_disabled', $3)"
            " RETURNING id", owner, w.org, ep,
        )
    return ep, nid


async def _list(w: World, who: UUID):
    from app.db.notifications import list_open_notices

    async with w.pool.acquire() as con:
        rows, total = await list_open_notices(con, who, 50)
    return [dict(r) for r in rows], total


async def _route(w: World, who: UUID, monkeypatch) -> dict:
    """GET /notifications's handler, on this file's pool, serialised exactly as FastAPI does."""
    from app.api import notifications as api

    async def pool():
        return w.pool

    monkeypatch.setattr(api, "get_pg_pool", pool)
    out = await api.list_waiting_notices(current_user={"id": str(who)})
    return json.loads(out.model_dump_json())


async def test_a_failing_webhook_notice_is_listed_and_counted(monkeypatch):
    async with _world() as w:
        ep, nid = await _webhook_notice(w)
        rows, total = await _list(w, w.alice)
        assert total == 2
        by_kind = {r["kind"]: r for r in rows}
        hook = by_kind["webhook_disabled"]
        assert (hook["id"], hook["run_id"], hook["endpoint_id"], hook["reason"]) == (nid, None, ep, "failing")
        assert hook["title"] == "hooks.example.com/in/abc"  # host + path, the query never selected
        assert hook["title_is_address"] is True
        assert hook["workflow_name"] is None and hook["origin"] is None
        assert by_kind["question"]["id"] == w.run_notice

        body = await _route(w, w.alice, monkeypatch)
        assert body["total"] == 2
        hook = next(n for n in body["notices"] if n["kind"] == "webhook_disabled")
        assert hook["run_id"] is None and hook["workflow_name"] is None
        assert hook["endpoint_id"] == str(ep) and hook["reason"] == "failing"
        assert hook["title"] == "hooks.example.com/in/abc" and hook["title_is_address"] is True
        assert "s3cr3t" not in json.dumps(body)
        run = next(n for n in body["notices"] if n["kind"] == "question")
        assert set(run) == RUN_NOTICE_KEYS  # a run notice serialises exactly as before 308
        assert run["workflow_name"] == "Compliance Gap Report" and run["origin"] == "app"


async def test_a_gone_notice_with_a_description_uses_the_description():
    async with _world() as w:
        await _webhook_notice(w, reason="gone", description="Billing sync")
        rows, total = await _list(w, w.alice)
        hook = next(r for r in rows if r["kind"] == "webhook_disabled")
        assert (hook["title"], hook["title_is_address"], hook["reason"], total) == ("Billing sync", False, "gone", 2)


@pytest.mark.parametrize("reason", ["admin", "owner_removed"])
async def test_admin_or_owner_removed_endpoints_are_not_listed(reason):
    async with _world() as w:
        await _webhook_notice(w, reason=reason)
        rows, total = await _list(w, w.alice)
        assert [r["kind"] for r in rows] == ["question"] and total == 1


async def test_enabled_again_left_the_org_or_another_member_is_not_listed():
    from app.db import webhooks as db

    async with _world() as w:
        ep, _ = await _webhook_notice(w)
        # another member sees nothing of alice's
        assert await _list(w, w.bob) == ([], 0)
        # turned on again: the notice closes and leaves the list
        await db.set_endpoint_enabled(w.pool, endpoint_id=ep, org_id=w.org, owner_id=w.alice, enabled=True, reason=None)
        rows, total = await _list(w, w.alice)
        assert [r["kind"] for r in rows] == ["question"] and total == 1

        await _webhook_notice(w, url="https://hooks.example.com/two")
        assert (await _list(w, w.alice))[1] == 2
        async with w.pool.acquire() as con:
            await con.execute("DELETE FROM public.org_members WHERE org_id = $1 AND user_id = $2", w.org, w.alice)
        assert await _list(w, w.alice) == ([], 0)  # the org_members join is the wall (P-8)


async def test_a_run_notice_keeps_its_status_wall():
    async with _world() as w:
        async with w.pool.acquire() as con:
            # close-on-end is fail-soft in 218: a notice left open on a run that ended (inserted
            # already finished, so no status trigger closes it) must still never be listed.
            ended = await con.fetchval(
                "INSERT INTO public.workflow_runs (thread_id, definition_id, status, org_id, user_id, inputs)"
                " SELECT thread_id, definition_id, 'completed', org_id, user_id, '{}'::jsonb"
                " FROM public.workflow_runs WHERE id = $1 RETURNING id", w.run,
            )
            await con.execute(
                "INSERT INTO public.notifications (recipient_id, org_id, run_id, kind, tool_call_id)"
                " VALUES ($1, $2, $3, 'approval', 'tc-308-ended')", w.alice, w.org, ended,
            )
        rows, total = await _list(w, w.alice)
        assert [r["id"] for r in rows] == [w.run_notice] and total == 1


async def test_the_email_drainer_claims_nothing_for_a_webhook_notice():
    from app.db.notifications import CLAIM_SQL, MAX_ATTEMPTS

    async with _world() as w:
        _, nid = await _webhook_notice(w)
        async with w.pool.acquire() as con:
            assert await con.fetchval("SELECT count(*) FROM public.notification_deliveries WHERE notification_id = $1", nid) == 0
            async with con.transaction():
                claimed = await con.fetch(CLAIM_SQL, 500, None, MAX_ATTEMPTS)
        assert nid not in {r.get("notification_id") for r in claimed}
