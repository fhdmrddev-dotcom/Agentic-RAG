"""Phase 307-02 (D-37, D-14, D-17, D-19, D-20, D-46; SC#2) — the spec round trip, LIVE.

A real ``uvicorn`` serves the real app; a real GoTrue member in a real org. The flow is the one
Claude runs, from the first 401 to a revoked token:

POST /mcp (no token) -> 401 naming the PRM URL -> GET PRM -> GET AS metadata -> POST /oauth/register
-> GET /oauth/authorize (302 to /app/connect/<uuid>) -> test-helper approve (307-03's route, minus
the member session) -> POST /oauth/token -> /mcp initialize + tools/list + a tool call ->
refresh -> the OLD refresh reused after the grace (``used_at`` back-dated) is refused and kills the
family -> the latest access token is refused at /mcp. A second run revokes through /oauth/revoke.
A CIMD client (a cached document — no network) signs in with a loopback redirect on port 54001
against a portless registration.

The tool call is ``list_documents`` (the 305 two-worker precedent): ``search_knowledge_base``
would embed the query through a paid provider from a spawned process with no stub seam.

Run with ``-rs``: a skip is NOT RUN, never a pass. ⛔ No role-``anon`` statement (BUG-261031-01).
"""
from __future__ import annotations

from uuid import UUID

import httpx
import pytest

from tests.integration import _305_live as live
from tests.integration import _307_live as o


@pytest.fixture(scope="module")
def server():
    with o.serve(workers=1) as srv:
        yield srv


# D-05: Claude gives discovery, registration and token 10 s each. Every endpoint's wall time on
# the live server is recorded here and bounded below; printed with ``-s`` for the SUMMARY.
TIMINGS: dict[str, float] = {}


def _t(label: str, r: httpx.Response) -> httpx.Response:
    seconds = r.elapsed.total_seconds()
    TIMINGS[label] = max(TIMINGS.get(label, 0.0), seconds)
    assert seconds < 10.0, f"{label} took {seconds:.2f}s — Claude gives up at 10 s"
    return r


def _authorize(base: str, client_id: str, redirect_uri: str, *, state: str = "st-307") -> httpx.Response:
    with httpx.Client(base_url=base, timeout=30, follow_redirects=False) as c:
        return c.get("/oauth/authorize", params={
            "response_type": "code", "client_id": client_id, "redirect_uri": redirect_uri,
            "code_challenge": o.CHALLENGE, "code_challenge_method": "S256", "state": state,
            "resource": f"{base}/mcp", "scope": "mcp",
        })


def _exchange(base: str, code: str, client_id: str, redirect_uri: str) -> httpx.Response:
    return o.token_post(base, {
        "grant_type": "authorization_code", "code": code, "client_id": client_id,
        "redirect_uri": redirect_uri, "code_verifier": o.VERIFIER, "resource": f"{base}/mcp",
    })


def _assert_token_body(r: httpx.Response) -> dict:
    assert r.status_code == 200, r.text
    assert r.headers["cache-control"] == "no-store"
    assert r.headers["pragma"] == "no-cache"
    body = r.json()
    assert body["token_type"] == "Bearer" and body["expires_in"] == 3600 and body["scope"] == "mcp"
    assert body["access_token"].startswith("srl_oat_") and body["refresh_token"].startswith("srl_ort_")
    return body


def _mcp_ok(base: str, access: str) -> list[str]:
    init = o.mcp_post(base, access, live.initialize_body())
    assert init.status_code == 200, init.text
    listed = o.mcp_post(base, access, o.tools_list_body())
    assert listed.status_code == 200, listed.text
    names = sorted(t["name"] for t in listed.json()["result"]["tools"])
    called = o.mcp_post(base, access, o.tool_call_body("list_documents"))
    assert called.status_code == 200, called.text
    assert called.json()["result"].get("isError") is not True, called.text
    return names


async def _sign_in(server, gw: o.GrantWorld, redis, client_id: str, redirect_uri: str) -> dict:
    a = _t("GET /oauth/authorize", _authorize(server.base_url, client_id, redirect_uri))
    assert a.status_code == 302, a.text
    location = a.headers["location"]
    assert "/app/connect/" in location, location
    request_id = location.rsplit("/", 1)[1]
    UUID(request_id, version=4)
    back = await gw.approve_for_test(redis, request_id)
    q = o.query_of(back)
    assert q["state"] == "st-307" and q["iss"] == server.base_url
    return _assert_token_body(_t("POST /oauth/token (code)",
                                 _exchange(server.base_url, q["code"], client_id, redirect_uri)))


async def test_the_whole_spec_round_trip(server, pg_pool):
    base = server.base_url
    redis = o.redis_client()
    async with o.grant_world(pg_pool) as gw:
        # 1 · the 401 names the PRM document, which names the AS, whose metadata is complete
        first = _t("POST /mcp (401)", o.mcp_post(base, None, live.initialize_body()))
        assert first.status_code == 401
        challenge = first.headers["www-authenticate"]
        prm_url = challenge.split('resource_metadata="', 1)[1].rstrip('"')
        assert prm_url == f"{base}/.well-known/oauth-protected-resource/mcp"
        prm = _t("GET PRM", httpx.get(prm_url, timeout=10)).json()
        assert prm["resource"] == f"{base}/mcp" and prm["authorization_servers"] == [base]
        as_meta = _t("GET AS metadata",
                     httpx.get(f"{base}/.well-known/oauth-authorization-server", timeout=10)).json()
        assert as_meta["issuer"] == base
        assert as_meta["code_challenge_methods_supported"] == ["S256"]
        assert as_meta["client_id_metadata_document_supported"] is True

        # 2 · DCR
        reg = _t("POST /oauth/register", httpx.post(as_meta["registration_endpoint"], json={
            "client_name": "Claude (307 live)", "redirect_uris": [o.CLAUDE_REDIRECT],
            "grant_types": ["authorization_code", "refresh_token"], "response_types": ["code"],
            "token_endpoint_auth_method": "none",
        }, timeout=10))
        assert reg.status_code == 201, reg.text
        client_id = reg.json()["client_id"]
        assert "client_secret" not in reg.json()
        gw.clients.extend(await o.clients_registered_over_http(pg_pool, [client_id]))

        # 3 · authorize -> approve -> token -> tools
        pair = await _sign_in(server, gw, redis, client_id, o.CLAUDE_REDIRECT)
        names = _mcp_ok(base, pair["access_token"])
        assert names == ["list_documents", "read_document", "search_knowledge_base"]

        # 4 · refresh rotates; the old refresh reused after the grace kills the family
        old_refresh = pair["refresh_token"]
        new = _assert_token_body(_t("POST /oauth/token (refresh)", o.refresh(base, old_refresh, client_id)))
        assert new["refresh_token"] != old_refresh
        _mcp_ok(base, new["access_token"])
        from app.security.oauth_tokens import digest_token

        await pg_pool.execute(
            "UPDATE public.oauth_tokens SET used_at = now() - interval '5 minutes' WHERE token_hash = $1",
            digest_token(old_refresh, "refresh"),
        )
        reused = o.refresh(base, old_refresh, client_id)
        assert reused.status_code == 400 and reused.json()["error"] == "invalid_grant"
        dead = o.mcp_post(base, new["access_token"], live.initialize_body())
        assert dead.status_code == 401
        rows = await gw.w.audit_rows()
        reuse_rows = [r for r in rows if r["action_type"] == "api_key.refused"
                      and (r["metadata"] or {}).get("reason") == "refresh_reuse"]
        assert len(reuse_rows) == 1, [(r["action_type"], (r["metadata"] or {}).get("reason")) for r in rows]
        assert reuse_rows[0]["metadata"]["detail"]["credential"] == "oauth"

        # 5 · a second sign-in, revoked through /oauth/revoke: the next /mcp call is 401
        pair2 = await _sign_in(server, gw, redis, client_id, o.CLAUDE_REDIRECT)
        _mcp_ok(base, pair2["access_token"])
        with httpx.Client(base_url=base, timeout=30) as c:
            rv = _t("POST /oauth/revoke",
                    c.post("/oauth/revoke", data={"token": pair2["refresh_token"], "client_id": client_id}))
        assert rv.status_code == 200
        assert o.mcp_post(base, pair2["access_token"], live.initialize_body()).status_code == 401
        revoke_rows = [r for r in await gw.w.audit_rows() if r["action_type"] == "api_key.revoke"]
        assert len(revoke_rows) == 1 and revoke_rows[0]["metadata"]["detail"]["credential"] == "oauth"
    await redis.aclose()
    print("\n[307-02 live endpoint timings, max seconds]", {k: round(v, 3) for k, v in TIMINGS.items()})


async def test_a_cimd_client_on_a_random_loopback_port(server, pg_pool):
    redis = o.redis_client()
    async with o.grant_world(pg_pool) as gw:
        client = await gw.make_client(kind="cimd", redirect_uris=("http://localhost/callback",
                                                                  "http://127.0.0.1/callback"))
        pair = await _sign_in(server, gw, redis, client["client_id"], "http://localhost:54001/callback")
        _mcp_ok(server.base_url, pair["access_token"])
    await redis.aclose()


async def test_a_replayed_code_is_refused_and_revokes_its_grant(server, pg_pool):
    base = server.base_url
    redis = o.redis_client()
    async with o.grant_world(pg_pool) as gw:
        client = await gw.make_client()
        a = _authorize(base, client["client_id"], o.CLAUDE_REDIRECT)
        back = await gw.approve_for_test(redis, a.headers["location"].rsplit("/", 1)[1])
        code = o.query_of(back)["code"]
        pair = _assert_token_body(_exchange(base, code, client["client_id"], o.CLAUDE_REDIRECT))
        again = _exchange(base, code, client["client_id"], o.CLAUDE_REDIRECT)
        assert again.status_code == 400 and again.json()["error"] == "invalid_grant"
        assert o.mcp_post(base, pair["access_token"], live.initialize_body()).status_code == 401
    await redis.aclose()


async def test_a_switched_off_org_still_refreshes_but_mcp_answers_403(server, pg_pool):
    from app.security.principal_liveness import MCP_OFF_ORG_SENTENCE

    base = server.base_url
    async with o.grant_world(pg_pool) as gw:
        access, refresh, _ = await gw.mint_grant(resource=f"{base}/mcp")
        await pg_pool.execute("UPDATE public.organizations SET mcp_enabled = false WHERE id = $1::uuid", gw.w.org)
        r = o.refresh(base, refresh, gw.last_client_id)  # no resource: optional on refresh (D-47)
        body = _assert_token_body(r)
        off = o.mcp_post(base, body["access_token"], live.initialize_body())
        assert off.status_code == 403
        assert off.json() == {"error": "mcp_off", "error_description": MCP_OFF_ORG_SENTENCE}
        wrong = o.refresh(base, body["refresh_token"], gw.last_client_id, resource="https://other.example/mcp")
        assert wrong.status_code == 400 and wrong.json()["error"] == "invalid_target"
