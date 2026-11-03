"""Phase 307-02 (D-18; T-307-12) — an OAuth access token is useless against PostgREST and GoTrue.

The token is opaque on purpose (``srl_oat_`` + 32 random bytes — not a JWT), so the local Supabase
gateway at :54321 cannot mistake it for a session. Proven by REQUESTS, not by reasoning (Pitfall
11): a live, valid token is presented to ``/rest/v1/api_keys`` with the anon key, and to
``/auth/v1/user``. Both must refuse and return no rows. A skip here (the gateway unreachable) FAILS
the plan's acceptance — it is never a pass.

⛔ No role-``anon`` SQL statement: the anon key is only sent as the ``apikey`` header PostgREST
requires, exactly as any browser does (BUG-261031-01 is about statements, not this header).
"""
from __future__ import annotations

import httpx
import pytest

from tests.integration import _305_live as live
from tests.integration import _307_live as o
from tests.integration._271_gotrue_users import _local_env, require_gotrue


@pytest.fixture(scope="module")
def server():
    with o.serve(workers=1) as srv:
        yield srv


async def test_postgrest_and_gotrue_refuse_a_live_oauth_token(server, pg_pool):
    require_gotrue()
    env = _local_env()
    supabase, public_key = env["SUPABASE_URL"].rstrip("/"), env["SUPABASE_ANON_KEY"]
    async with o.grant_world(pg_pool) as gw:
        access, _, _ = await gw.mint_grant(resource=f"{server.base_url}/mcp")
        # Positive control: the SAME token is live where it belongs.
        assert o.mcp_post(server.base_url, access, live.initialize_body()).status_code == 200

        headers = {"apikey": public_key, "Authorization": f"Bearer {access}"}
        rest = httpx.get(f"{supabase}/rest/v1/api_keys?select=id", headers=headers, timeout=10)
        assert rest.status_code == 401, (rest.status_code, rest.text[:300])
        assert not isinstance(rest.json(), list), "PostgREST returned rows for an OAuth token"

        user = httpx.get(f"{supabase}/auth/v1/user", headers=headers, timeout=10)
        assert user.status_code in (401, 403), (user.status_code, user.text[:300])
        assert gw.w.user not in user.text
