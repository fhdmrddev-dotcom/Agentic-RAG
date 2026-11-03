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
| member disconnects (307-05) | ``POST /api-keys/{grant}/revoke`` with the member's own session | 401 |
| org admin disconnects all (307-05) | ``POST /org/api-keys/connected-apps/revoke-all`` | every grant 401; a key in the org still 200 |

Run with ``-rs``: a skip is NOT RUN, never a pass. ⛔ No role-``anon`` statement (BUG-261031-01).
"""
from __future__ import annotations

from uuid import UUID

import pytest

from tests.integration import _305_live as live
from tests.integration import _307_live as o


@pytest.fixture(scope="module")
def server():
    with o.serve(workers=1) as srv:
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


# ── 307-05 (D-24 / D-27): disconnect through the real routes ──────────────────────────────────


def _session(token: str, org: str) -> dict:
    return {"Authorization": f"Bearer {token}", "X-Org-Id": org}


async def _audit_rows(pool, user_id: str, *, tries: int = 20) -> list[dict]:
    """The route audits in a BackgroundTask (after the response), so poll briefly."""
    import asyncio

    rows: list = []
    for _ in range(tries):
        rows = await pool.fetch(
            "SELECT action_type, metadata FROM public.audit_log WHERE user_id = $1 "
            "AND action_type = 'api_key.revoke' ORDER BY created_at", UUID(user_id),
        )
        if rows:
            break
        await asyncio.sleep(0.25)
    return [dict(r) for r in rows]


async def test_member_disconnects_through_the_route(server, pg_pool):
    import httpx

    async with o.grant_world(pg_pool) as gw:
        access, _, grant_id = await _live_token(server, gw)
        listed = httpx.get(f"{server.base_url}/api-keys/connected-apps",
                           headers=_session(gw.w.user_token, gw.w.org), timeout=30)
        assert listed.status_code == 200, listed.text
        assert [a["id"] for a in listed.json()["apps"]] == [str(grant_id)]
        r = httpx.post(f"{server.base_url}/api-keys/{grant_id}/revoke",
                       headers=_session(gw.w.user_token, gw.w.org), timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["state"] == "revoked"
        assert _call(server, access).status_code == 401
        rows = await _audit_rows(pg_pool, gw.w.user)
        assert len(rows) == 1
        detail = rows[0]["metadata"]["detail"]
        assert detail["credential"] == "oauth" and detail["redirect_host"] == "claude.ai"
        again = httpx.get(f"{server.base_url}/api-keys/connected-apps",
                          headers=_session(gw.w.user_token, gw.w.org), timeout=30)
        assert again.json()["apps"] == []


async def test_org_admin_disconnects_all_and_keys_keep_working(server, pg_pool):
    from datetime import datetime, timedelta, timezone
    from uuid import uuid4

    import httpx

    from app.db import api_keys as api_keys_db
    from app.db import oauth as oauth_db
    from app.security import api_key_auth
    from app.security.oauth_tokens import digest_token, mint_token
    from app.services.mcp_tool_catalogue import PRESETS

    async with o.grant_world(pg_pool) as gw:
        first_access, _, _ = await _live_token(server, gw)
        key_secret, _ = await gw.w.mint(kind="mcp")
        assert _call(server, key_secret).status_code == 200

        second, _ = await gw.w.users.create_signed_in_user(gw.w.org, role="member", label="p30705b")
        admin, admin_token = await gw.w.users.create_signed_in_user(gw.w.org, role="org-admin", label="p30705a")
        try:
            client = await gw.make_client()
            minted = api_key_auth.mint_key("mcp")
            row = await api_keys_db.create_api_key(
                pg_pool, org_id=UUID(gw.w.org), user_id=UUID(second), label=f"second {uuid4().hex[:6]}",
                key_prefix=minted.key_prefix, key_hash=minted.key_hash, workflows=[],
                expires_at=datetime.now(timezone.utc) + timedelta(days=90), kind="mcp",
                tools=list(PRESETS["read"].tools), oauth_client_id=client["id"],
            )
            gw.grants.append(row["id"])
            second_access, second_refresh = mint_token("access"), mint_token("refresh")
            async with pg_pool.acquire() as conn, conn.transaction():
                await oauth_db.issue_token_pair(
                    conn, grant_id=row["id"], access_hash=digest_token(second_access, "access"),
                    refresh_hash=digest_token(second_refresh, "refresh"),
                    resource=f"{server.base_url}/mcp",
                    refresh_expires_at=datetime.now(timezone.utc) + timedelta(days=90),
                )
            assert _call(server, second_access).status_code == 200

            listed = httpx.get(f"{server.base_url}/org/api-keys/connected-apps",
                               headers=_session(admin_token, gw.w.org), timeout=30)
            assert listed.status_code == 200, listed.text
            assert len(listed.json()["apps"]) == 2

            r = httpx.post(f"{server.base_url}/org/api-keys/connected-apps/revoke-all",
                           headers=_session(admin_token, gw.w.org), timeout=30)
            assert r.status_code == 200, r.text
            assert r.json() == {"revoked": 2, "members": 2}
            assert _call(server, first_access).status_code == 401
            assert _call(server, second_access).status_code == 401
            assert _call(server, key_secret).status_code == 200   # keys are never touched
            rows = await _audit_rows(pg_pool, admin)
            assert len(rows) == 1
            assert rows[0]["metadata"]["detail"] == {
                "credential": "oauth", "scope": "org", "count": 2, "members": 2,
            }
        finally:
            await pg_pool.execute("DELETE FROM public.audit_log WHERE user_id = ANY($1::uuid[])",
                                  [UUID(second), UUID(admin)])
            await pg_pool.execute("DELETE FROM public.oauth_tokens WHERE grant_id IN "
                                  "(SELECT id FROM public.api_keys WHERE user_id = ANY($1::uuid[]))",
                                  [UUID(second), UUID(admin)])
            await pg_pool.execute("DELETE FROM public.api_keys WHERE user_id = ANY($1::uuid[])",
                                  [UUID(second), UUID(admin)])
