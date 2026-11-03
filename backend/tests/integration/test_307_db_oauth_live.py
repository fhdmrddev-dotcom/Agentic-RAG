"""Phase 307-01 (D-16, D-17, D-19, D-46, D-47, D-25) — the OAuth data layer, LIVE.

Against the local database (127.0.0.1:54322) with a real auth user, their org, an OAuth client and
a GRANT (an ``api_keys`` row of kind 'mcp' naming the client) made through the app's own
``create_api_key``. Every row is removed in teardown.

The refresh-rotation state machine is driven end to end: rotate, the bounded 60 s grace, reuse
(family revoke), dead and wrong_resource — each asserted on the rows it wrote, or did not write.
"""

from __future__ import annotations

import hashlib
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

import pytest
import pytest_asyncio

from tests.integration._rls_harness import requires_pg

pytestmark = [requires_pg]

RESOURCE = "http://localhost:8000/mcp"


def _digest(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


@pytest_asyncio.fixture
async def world(pg_pool):
    from app.db import api_keys as api_keys_db
    from app.db import oauth as oauth_db
    from app.security import api_key_auth

    uid = uuid4()
    await pg_pool.execute(
        "INSERT INTO auth.users (id, email) VALUES ($1, $2)", uid, f"p307-01-{uid.hex[:8]}@test.local"
    )
    org = await pg_pool.fetchval("SELECT org_id FROM public.org_members WHERE user_id = $1 LIMIT 1", uid)
    own_org = None
    if org is None:
        own_org = org = uuid4()
        await pg_pool.execute(
            "INSERT INTO public.organizations (id, name) VALUES ($1, $2)", org, f"p307-01-{org.hex[:8]}"
        )
        await pg_pool.execute(
            "INSERT INTO public.org_members (org_id, user_id, role) VALUES ($1, $2, 'member')", org, uid
        )
    client = await oauth_db.insert_dcr_client(
        pg_pool,
        client_id=f"p307-01-{uuid4().hex}",
        client_name="Claude",
        client_uri="https://claude.ai",
        redirect_uris=["https://claude.ai/api/mcp/auth_callback"],
    )

    async def make_grant(label: str = "Claude") -> dict:
        minted = api_key_auth.mint_key("mcp")  # a random secret nobody is ever shown (D-01)
        return await api_keys_db.create_api_key(
            pg_pool,
            org_id=org,
            user_id=uid,
            label=label,
            key_prefix=minted.key_prefix,
            key_hash=minted.key_hash,
            workflows=[],
            expires_at=datetime.now(timezone.utc) + timedelta(days=90),
            kind="mcp",
            tools=["search_knowledge_base"],
            oauth_client_id=client["id"],
        )

    w = {"pool": pg_pool, "user": uid, "org": org, "client": client, "make_grant": make_grant}
    try:
        yield w
    finally:
        for sql, arg in (
            ("DELETE FROM public.api_keys WHERE user_id = $1", uid),
            ("DELETE FROM public.oauth_clients WHERE id = $1", client["id"]),
            ("DELETE FROM public.org_members WHERE user_id = $1", uid),
            ("DELETE FROM public.organizations WHERE id = $1", own_org),
            ("DELETE FROM public.profiles WHERE id = $1", uid),
            ("DELETE FROM auth.users WHERE id = $1", uid),
        ):
            if arg is None:
                continue
            try:
                await pg_pool.execute(sql, arg)
            except Exception:
                pass
        # the personal org the auth trigger made, if any, now has no member
        try:
            await pg_pool.execute(
                "DELETE FROM public.organizations o WHERE o.id = $1 AND NOT EXISTS "
                "(SELECT 1 FROM public.org_members m WHERE m.org_id = o.id)",
                org,
            )
        except Exception:
            pass


async def _issue(w, grant_id, *, resource: str = RESOURCE, refresh_expires_at=None):
    from app.db import oauth as oauth_db
    from app.security import oauth_tokens as ot

    access, refresh = ot.mint_token("access"), ot.mint_token("refresh")
    async with w["pool"].acquire() as conn:
        access_id, refresh_id = await oauth_db.issue_token_pair(
            conn,
            grant_id=grant_id,
            access_hash=_digest(access),
            refresh_hash=_digest(refresh),
            resource=resource,
            refresh_expires_at=refresh_expires_at or datetime.now(timezone.utc) + timedelta(days=90),
        )
    return access, refresh, access_id, refresh_id


async def _rotate(w, refresh: str, *, resource=None):
    from app.db import oauth as oauth_db
    from app.security import oauth_tokens as ot

    new_access, new_refresh = ot.mint_token("access"), ot.mint_token("refresh")
    outcome = await oauth_db.rotate_refresh(
        w["pool"],
        refresh_hash=_digest(refresh),
        new_access_hash=_digest(new_access),
        new_refresh_hash=_digest(new_refresh),
        resource=resource,
    )
    return outcome, new_access, new_refresh


async def _token(w, token: str) -> dict | None:
    row = await w["pool"].fetchrow("SELECT * FROM public.oauth_tokens WHERE token_hash = $1", _digest(token))
    return dict(row) if row else None


async def _snapshot(w, grant_id):
    toks = await w["pool"].fetch(
        "SELECT id, used_at, replaced_by, revoked_at, expires_at FROM public.oauth_tokens "
        "WHERE grant_id = $1 ORDER BY id",
        grant_id,
    )
    key = await w["pool"].fetchrow("SELECT revoked_at, expires_at FROM public.api_keys WHERE id = $1", grant_id)
    return [dict(t) for t in toks], dict(key) if key else None


# ── storage and lookup ────────────────────────────────────────────────────────────────────────


async def test_issue_token_pair_stores_only_digests(world):
    grant = await world["make_grant"]()
    access, refresh, access_id, refresh_id = await _issue(world, grant["id"])
    assert isinstance(access_id, UUID) and isinstance(refresh_id, UUID)
    rows = await world["pool"].fetch(
        "SELECT t::text AS blob, kind, expires_at FROM public.oauth_tokens t WHERE grant_id = $1", grant["id"]
    )
    assert len(rows) == 2
    for r in rows:
        assert access not in r["blob"] and refresh not in r["blob"]
        assert access[8:] not in r["blob"] and refresh[8:] not in r["blob"]
    acc = await _token(world, access)
    assert acc["kind"] == "access"
    ttl = (acc["expires_at"] - acc["created_at"]).total_seconds()
    assert 3590 <= ttl <= 3610, ttl


async def test_get_access_token_for_auth_joins_the_grant(world):
    from app.db import oauth as oauth_db

    grant = await world["make_grant"]()
    access, refresh, access_id, _ = await _issue(world, grant["id"])
    row = await oauth_db.get_access_token_for_auth(world["pool"], _digest(access))
    assert row is not None
    assert row["id"] == grant["id"]                       # the GRANT's id: the admission tail's key id
    assert row["token_id"] == access_id
    assert row["oauth_client_id"] == world["client"]["id"]
    assert row["kind"] == "mcp" and row["key_hash"]
    assert row["resource"] == RESOURCE and row["token_revoked_at"] is None
    assert row["token_expires_at"] > datetime.now(timezone.utc)
    assert await oauth_db.get_access_token_for_auth(world["pool"], _digest("srl_oat_nope")) is None
    # a refresh token is not an access token
    assert await oauth_db.get_access_token_for_auth(world["pool"], _digest(refresh)) is None
    either = await oauth_db.get_token_by_digest(world["pool"], _digest(refresh))
    assert either is not None and either["token_kind"] == "refresh" and either["id"] == grant["id"]


# ── rotation (D-19 / D-46 / D-16) ─────────────────────────────────────────────────────────────


async def test_rotate_live_unused_refresh(world):
    grant = await world["make_grant"]()
    await world["pool"].execute(
        "UPDATE public.api_keys SET expires_at = now() + interval '10 days' WHERE id = $1", grant["id"]
    )
    _, refresh, _, refresh_id = await _issue(world, grant["id"])
    outcome, new_access, new_refresh = await _rotate(world, refresh)
    assert outcome.kind == "rotated" and outcome.grant_id == grant["id"]
    old = await _token(world, refresh)
    new_r, new_a = await _token(world, new_refresh), await _token(world, new_access)
    assert old["used_at"] is not None and old["replaced_by"] == new_r["id"]
    assert new_r["kind"] == "refresh" and new_a["kind"] == "access"
    assert new_r["used_at"] is None and new_r["revoked_at"] is None and new_r["resource"] == RESOURCE
    key = await world["pool"].fetchrow("SELECT expires_at FROM public.api_keys WHERE id = $1", grant["id"])
    slid = key["expires_at"] - datetime.now(timezone.utc)
    assert timedelta(days=89, hours=23) < slid <= timedelta(days=90), slid
    assert new_r["expires_at"] == key["expires_at"]
    assert outcome.grant_row["expires_at"] == key["expires_at"]


async def test_grace_rerotates_from_the_same_parent(world):
    grant = await world["make_grant"]()
    _, refresh, _, _ = await _issue(world, grant["id"])
    first, a1, r1 = await _rotate(world, refresh)
    assert first.kind == "rotated"
    again, a2, r2 = await _rotate(world, refresh)        # the same used token, within 60 s
    assert again.kind == "grace_rotated"
    s1a, s1r = await _token(world, a1), await _token(world, r1)
    assert s1a["revoked_at"] is not None and s1r["revoked_at"] is not None   # unused successor pair revoked
    parent, n2 = await _token(world, refresh), await _token(world, r2)
    assert parent["replaced_by"] == n2["id"] and n2["revoked_at"] is None
    assert (await _token(world, a2))["revoked_at"] is None
    key = await world["pool"].fetchrow("SELECT revoked_at FROM public.api_keys WHERE id = $1", grant["id"])
    assert key["revoked_at"] is None


async def _assert_family_dead(world, grant_id, *tokens):
    key = await world["pool"].fetchrow("SELECT revoked_at FROM public.api_keys WHERE id = $1", grant_id)
    assert key["revoked_at"] is not None, "the whole grant must be revoked"
    for t in tokens:
        outcome, _, _ = await _rotate(world, t)
        assert outcome.kind == "dead", (t[:8], outcome.kind)


async def test_reuse_after_the_grace_window_revokes_the_family(world):
    grant = await world["make_grant"]()
    _, refresh, _, refresh_id = await _issue(world, grant["id"])
    first, _, r1 = await _rotate(world, refresh)
    assert first.kind == "rotated"
    await world["pool"].execute(
        "UPDATE public.oauth_tokens SET used_at = now() - interval '61 seconds' WHERE id = $1", refresh_id
    )
    outcome, _, _ = await _rotate(world, refresh)
    assert outcome.kind == "reuse_revoked" and outcome.grant_id == grant["id"]
    await _assert_family_dead(world, grant["id"], r1)


async def test_reuse_inside_the_window_when_the_successor_was_used(world):
    grant = await world["make_grant"]()
    _, refresh, _, _ = await _issue(world, grant["id"])
    first, _, r1 = await _rotate(world, refresh)
    second, _, r2 = await _rotate(world, r1)              # successor used
    assert first.kind == "rotated" and second.kind == "rotated"
    outcome, _, _ = await _rotate(world, refresh)
    assert outcome.kind == "reuse_revoked"
    await _assert_family_dead(world, grant["id"], r2)


async def test_presenting_a_successor_revoked_by_the_grace_revokes_the_family(world):
    """The research safety argument (307-RESEARCH §Token lifecycle): a thief racing inside 60 s
    revokes the legitimate successor; the legitimate client then presents that revoked successor,
    and THAT is reuse — the whole family dies, so the thief's pair dies with it."""
    grant = await world["make_grant"]()
    _, refresh, _, _ = await _issue(world, grant["id"])
    first, _, legit = await _rotate(world, refresh)
    thief, _, stolen = await _rotate(world, refresh)
    assert first.kind == "rotated" and thief.kind == "grace_rotated"
    outcome, _, _ = await _rotate(world, legit)
    assert outcome.kind == "reuse_revoked"
    await _assert_family_dead(world, grant["id"], stolen)


async def test_dead_refreshes_write_nothing(world):
    from app.security import oauth_tokens as ot

    grant = await world["make_grant"]()
    _, refresh, _, refresh_id = await _issue(world, grant["id"])
    before = await _snapshot(world, grant["id"])

    unknown, _, _ = await _rotate(world, ot.mint_token("refresh"))
    assert unknown.kind == "dead" and unknown.grant_id is None
    access_as_refresh, _, _ = await _rotate(world, (await _issue(world, grant["id"]))[0])
    assert access_as_refresh.kind == "dead"
    before = await _snapshot(world, grant["id"])

    # an expired refresh token
    await world["pool"].execute(
        "UPDATE public.oauth_tokens SET expires_at = now() - interval '1 second' WHERE id = $1", refresh_id
    )
    before = await _snapshot(world, grant["id"])
    expired, _, _ = await _rotate(world, refresh)
    assert expired.kind == "dead"
    assert await _snapshot(world, grant["id"]) == before


@pytest.mark.parametrize("grant_state", ["revoked", "expired"])
async def test_dead_grant_writes_nothing(world, grant_state):
    grant = await world["make_grant"]()
    _, refresh, _, _ = await _issue(world, grant["id"])
    if grant_state == "revoked":
        await world["pool"].execute("UPDATE public.api_keys SET revoked_at = now() WHERE id = $1", grant["id"])
    else:
        await world["pool"].execute(
            "UPDATE public.api_keys SET expires_at = now() - interval '1 second' WHERE id = $1", grant["id"]
        )
    before = await _snapshot(world, grant["id"])
    outcome, _, _ = await _rotate(world, refresh)
    assert outcome.kind == "dead"
    assert await _snapshot(world, grant["id"]) == before


async def test_resource_on_refresh(world):
    grant = await world["make_grant"]()
    _, refresh, _, _ = await _issue(world, grant["id"])
    before = await _snapshot(world, grant["id"])
    wrong, _, _ = await _rotate(world, refresh, resource="https://evil.example/mcp")
    assert wrong.kind == "wrong_resource"
    assert await _snapshot(world, grant["id"]) == before
    same, _, _ = await _rotate(world, refresh, resource="HTTP://LocalHost:8000/mcp/")
    assert same.kind == "rotated"


# ── revocation ────────────────────────────────────────────────────────────────────────────────


async def test_revoke_grant_reports_whether_this_call_revoked(world):
    from app.db import oauth as oauth_db

    grant = await world["make_grant"]()
    assert await oauth_db.revoke_grant(world["pool"], grant["id"], revoked_by=world["user"]) is True
    assert await oauth_db.revoke_grant(world["pool"], grant["id"]) is False
    row = await world["pool"].fetchrow("SELECT revoked_at, revoked_by FROM public.api_keys WHERE id = $1", grant["id"])
    assert row["revoked_at"] is not None and row["revoked_by"] == world["user"]


async def test_revoke_access_token_touches_one_row(world):
    from app.db import oauth as oauth_db

    grant = await world["make_grant"]()
    access, refresh, access_id, _ = await _issue(world, grant["id"])
    other_access, *_ = await _issue(world, grant["id"])
    await oauth_db.revoke_access_token(world["pool"], access_id)
    assert (await _token(world, access))["revoked_at"] is not None
    assert (await _token(world, refresh))["revoked_at"] is None
    assert (await _token(world, other_access))["revoked_at"] is None
    key = await world["pool"].fetchrow("SELECT revoked_at FROM public.api_keys WHERE id = $1", grant["id"])
    assert key["revoked_at"] is None


# ── clients, allowlist, key lists ─────────────────────────────────────────────────────────────


async def test_clients(world):
    from app.db import oauth as oauth_db

    pool = world["pool"]
    got = await oauth_db.get_client(pool, world["client"]["client_id"])
    assert got["id"] == world["client"]["id"] and got["kind"] == "dcr"
    assert list(got["redirect_uris"]) == ["https://claude.ai/api/mcp/auth_callback"]
    assert await oauth_db.get_client(pool, "no-such-client") is None

    url = f"https://example.test/p307-01/{uuid4().hex}.json"
    now = datetime.now(timezone.utc)
    try:
        c1 = await oauth_db.upsert_cimd_client(
            pool, client_id=url, client_name="One", client_uri=None,
            redirect_uris=["https://claude.ai/cb"], fetched_at=now, expires_at=now + timedelta(hours=1),
        )
        c2 = await oauth_db.upsert_cimd_client(
            pool, client_id=url, client_name="Two", client_uri=None,
            redirect_uris=["https://claude.ai/cb2"], fetched_at=now, expires_at=now + timedelta(hours=2),
        )
        assert c1["id"] == c2["id"] and c2["client_name"] == "Two" and c2["kind"] == "cimd"
    finally:
        await pool.execute("DELETE FROM public.oauth_clients WHERE client_id = $1", url)

    stale = await oauth_db.insert_dcr_client(
        pool, client_id=f"p307-01-stale-{uuid4().hex}", client_name=None, client_uri=None,
        redirect_uris=["https://claude.ai/cb"],
    )
    try:
        await pool.execute(
            "UPDATE public.oauth_clients SET created_at = now() - interval '25 hours' WHERE id = ANY($1::uuid[])",
            [stale["id"], world["client"]["id"]],
        )
        await world["make_grant"]()   # world's client is referenced by a grant: never pruned
        deleted = await oauth_db.delete_unused_dcr_clients(pool, older_than_hours=24, limit=500)
        assert deleted >= 1
        assert await oauth_db.get_client(pool, stale["client_id"]) is None
        assert await oauth_db.get_client(pool, world["client"]["client_id"]) is not None
    finally:
        await pool.execute("DELETE FROM public.oauth_clients WHERE id = $1", stale["id"])


async def test_mark_client_granted(world):
    from app.db import oauth as oauth_db

    async with world["pool"].acquire() as conn:
        await oauth_db.mark_client_granted(conn, world["client"]["id"])
    got = await oauth_db.get_client(world["pool"], world["client"]["client_id"])
    assert got["last_grant_at"] is not None


async def test_get_redirect_hosts_reads_live(world):
    from app.db import oauth as oauth_db

    hosts = await oauth_db.get_redirect_hosts(world["pool"])
    assert isinstance(hosts, list)
    assert {"claude.ai", "claude.com"} <= {h.get("host") for h in hosts}


async def test_key_lists_never_carry_a_grant(world):
    from app.db import api_keys as api_keys_db
    from app.security import api_key_auth

    grant = await world["make_grant"]()
    assert grant["id"]
    stored = await world["pool"].fetchval(
        "SELECT oauth_client_id FROM public.api_keys WHERE id = $1", grant["id"]
    )
    assert stored == world["client"]["id"]
    minted = api_key_auth.mint_key("mcp")
    key = await api_keys_db.create_api_key(
        world["pool"], org_id=world["org"], user_id=world["user"], label="a real key",
        key_prefix=minted.key_prefix, key_hash=minted.key_hash, workflows=[],
        expires_at=datetime.now(timezone.utc) + timedelta(days=30), kind="mcp",
        tools=["search_knowledge_base"],
    )
    own = {r["id"] for r in await api_keys_db.list_keys_for_owner(world["pool"], org_id=world["org"], user_id=world["user"])}
    org = {r["id"] for r in await api_keys_db.list_keys_for_org(world["pool"], org_id=world["org"])}
    assert key["id"] in own and key["id"] in org
    assert grant["id"] not in own and grant["id"] not in org
    auth = await api_keys_db.get_key_for_auth(world["pool"], minted.key_hash)
    assert "oauth_client_id" in auth and auth["oauth_client_id"] is None
