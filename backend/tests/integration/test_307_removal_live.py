"""Phase 307-02 (D-24, D-21, D-19; SC#3) — every removal stops the NEXT call, through /mcp, LIVE.

Each case: a real OAuth access token answers ``/mcp`` -> one removal is applied in the database ->
the very next call is refused. The token is resolved on EVERY call (stateless edge, one resolver),
so nothing is cached past a removal.

| Case | Removal | Next call |
|---|---|---|
| membership | the ``org_members`` row is deleted | 401 |
| ban | ``auth.users.banned_until`` set in the future (the REAL ban ``deps._is_banned`` reads — the spawned server sees it; a monkeypatch could not cross the process) | 401 |
| org switch | ``organizations.mcp_enabled = false`` | 403 + the org sentence |
| deployment switch | ``app_settings('global').mcp_enabled = false`` (restored in ``finally``) | 403 + the deployment sentence |
| expired | the grant's ``expires_at`` in the past | 401 |
| revoked | the grant's ``revoked_at`` set | 401 |
| refresh reuse | the used refresh token presented after the grace | the family dies: 401 |

Run with ``-rs``: a skip is NOT RUN, never a pass. ⛔ No role-``anon`` statement (BUG-261031-01).
"""
from __future__ import annotations

from uuid import UUID

import pytest

from tests.integration import _305_live as live
from tests.integration import _307_live as o


@pytest.fixture(scope="module")
def server():
    with live.serve(workers=1) as srv:
        yield srv


def _call(server, access):
    return o.mcp_post(server.base_url, access, live.initialize_body())


async def _live_token(server, gw):
    access, refresh, grant_id = await gw.mint_grant(resource=f"{server.base_url}/mcp")
    ok = _call(server, access)
    assert ok.status_code == 200, ok.text
    return access, refresh, grant_id


async def test_membership_removed(server, pg_pool):
    async with o.grant_world(pg_pool) as gw:
        access, _, _ = await _live_token(server, gw)
        await pg_pool.execute("DELETE FROM public.org_members WHERE org_id = $1 AND user_id = $2",
                              UUID(gw.w.org), UUID(gw.w.user))
        assert _call(server, access).status_code == 401


async def test_banned(server, pg_pool):
    async with o.grant_world(pg_pool) as gw:
        access, _, _ = await _live_token(server, gw)
        await pg_pool.execute("UPDATE auth.users SET banned_until = now() + interval '1 day' WHERE id = $1",
                              UUID(gw.w.user))
        try:
            assert _call(server, access).status_code == 401
        finally:
            await pg_pool.execute("UPDATE auth.users SET banned_until = NULL WHERE id = $1", UUID(gw.w.user))


async def test_org_switch_off(server, pg_pool):
    from app.security.principal_liveness import MCP_OFF_ORG_SENTENCE

    async with o.grant_world(pg_pool) as gw:
        access, _, _ = await _live_token(server, gw)
        await pg_pool.execute("UPDATE public.organizations SET mcp_enabled = false WHERE id = $1", UUID(gw.w.org))
        r = _call(server, access)
        assert r.status_code == 403
        assert r.json() == {"error": "mcp_off", "error_description": MCP_OFF_ORG_SENTENCE}


async def test_deployment_switch_off(server, pg_pool):
    from app.security.principal_liveness import MCP_OFF_DEPLOYMENT_SENTENCE

    async with o.grant_world(pg_pool) as gw:
        access, _, _ = await _live_token(server, gw)
        before = await pg_pool.fetchval("SELECT mcp_enabled FROM public.app_settings WHERE id = 'global'")
        await pg_pool.execute("UPDATE public.app_settings SET mcp_enabled = false WHERE id = 'global'")
        try:
            r = _call(server, access)
        finally:
            await pg_pool.execute("UPDATE public.app_settings SET mcp_enabled = $1 WHERE id = 'global'", before)
        assert r.status_code == 403
        assert r.json() == {"error": "mcp_off", "error_description": MCP_OFF_DEPLOYMENT_SENTENCE}


async def test_grant_expired(server, pg_pool):
    async with o.grant_world(pg_pool) as gw:
        access, _, grant_id = await _live_token(server, gw)
        await pg_pool.execute("UPDATE public.api_keys SET expires_at = now() - interval '1 minute' WHERE id = $1",
                              grant_id)
        assert _call(server, access).status_code == 401


async def test_grant_revoked(server, pg_pool):
    async with o.grant_world(pg_pool) as gw:
        access, _, grant_id = await _live_token(server, gw)
        await pg_pool.execute("UPDATE public.api_keys SET revoked_at = now() WHERE id = $1", grant_id)
        assert _call(server, access).status_code == 401


async def test_refresh_reuse(server, pg_pool):
    from app.security.oauth_tokens import digest_token

    async with o.grant_world(pg_pool) as gw:
        _, refresh, _ = await _live_token(server, gw)
        rotated = o.refresh(server.base_url, refresh, gw.last_client_id)
        assert rotated.status_code == 200, rotated.text
        fresh_access = rotated.json()["access_token"]
        assert _call(server, fresh_access).status_code == 200
        await pg_pool.execute(
            "UPDATE public.oauth_tokens SET used_at = now() - interval '5 minutes' WHERE token_hash = $1",
            digest_token(refresh, "refresh"),
        )
        reused = o.refresh(server.base_url, refresh, gw.last_client_id)
        assert reused.status_code == 400 and reused.json()["error"] == "invalid_grant"
        assert _call(server, fresh_access).status_code == 401
