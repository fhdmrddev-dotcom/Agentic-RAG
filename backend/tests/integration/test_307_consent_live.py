"""Phase 307-03 (OAUTH-04; D-13, D-14, D-15, D-28, D-49; SC#1) — the spec round trip through the REAL
consent route, LIVE.

307-02's round trip stood the approve step in with a test helper (``_307_live.approve_for_test``).
This suite runs the same flow with the member's real GoTrue session against the real routes:

POST /oauth/register -> GET /oauth/authorize (302 to /app/connect/<uuid>) -> GET
/oauth/requests/<uuid> (member JWT: the who-well, the account, the orgs, the catalogue) -> POST
…/approve (org picked EXPLICITLY, Read only) -> POST /oauth/token -> /mcp tools/list shows exactly the
three read tools -> a read tool runs. A second request is DENIED: the redirect carries
``error=access_denied`` and no grant is written; a second approve of the first request is 410.

The tool call is ``list_documents`` (the 305/307-02 precedent): ``search_knowledge_base`` would
embed through a paid provider from a spawned process with no stub seam.

Run with ``-rs``: a skip is NOT RUN, never a pass. Take the local-DB lock first.
⛔ No role-``anon`` statement (BUG-261031-01).
"""
from __future__ import annotations

import asyncio
from uuid import UUID

import httpx
import pytest

from tests.integration import _305_live as live
from tests.integration import _307_live as o


@pytest.fixture(scope="module")
def server():
    with o.serve(workers=1) as srv:
        yield srv


def _authorize(base: str, client_id: str, *, state: str) -> httpx.Response:
    with httpx.Client(base_url=base, timeout=30, follow_redirects=False) as c:
        return c.get("/oauth/authorize", params={
            "response_type": "code", "client_id": client_id, "redirect_uri": o.CLAUDE_REDIRECT,
            "code_challenge": o.CHALLENGE, "code_challenge_method": "S256", "state": state,
            "resource": f"{base}/mcp", "scope": "mcp",
        })


def _request_id(r: httpx.Response) -> str:
    assert r.status_code == 302, r.text
    rid = r.headers["location"].rsplit("/", 1)[1]
    UUID(rid, version=4)
    return rid


def _member(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def test_sign_in_through_the_real_consent_route(server, pg_pool):
    base = server.base_url
    async with o.grant_world(pg_pool) as gw:
        token = gw.w.user_token
        reg = httpx.post(f"{base}/oauth/register", json={
            "client_name": "Claude (307-03 live)", "redirect_uris": [o.CLAUDE_REDIRECT],
            "grant_types": ["authorization_code", "refresh_token"], "response_types": ["code"],
            "token_endpoint_auth_method": "none",
        }, timeout=10)
        assert reg.status_code == 201, reg.text
        client_id = reg.json()["client_id"]
        gw.clients.extend(await o.clients_registered_over_http(pg_pool, [client_id]))

        rid = _request_id(_authorize(base, client_id, state="st-30703"))

        with httpx.Client(base_url=base, timeout=30) as c:
            # No session: refused, and reading never consumes.
            assert c.get(f"/oauth/requests/{rid}").status_code == 401

            read = c.get(f"/oauth/requests/{rid}", headers=_member(token))
            assert read.status_code == 200, read.text
            body = read.json()
            assert body["status"] == "ready"
            assert body["client"]["name"] == "Claude (307-03 live)"
            assert body["client"]["name_source"] == "dcr"
            assert body["client"]["redirect_host"] == "claude.ai"
            assert body["client"]["redirect_kind"] == "web"
            assert body["client"]["host_seeded"] is True
            assert body["account"]["email"].endswith("@test.local")
            org_ids = [org["id"] for org in body["orgs"]]
            assert gw.w.org in org_ids
            assert [t for t in body["tools"] if t["group"] == "read"]

            approve = c.post(f"/oauth/requests/{rid}/approve", headers=_member(token), json={
                "org_id": gw.w.org, "tools": ["search_knowledge_base", "list_documents", "read_document"],
                "folder_ids": None, "include_external": False,
            })
            assert approve.status_code == 200, approve.text
            back = approve.json()["redirect_url"]
            assert back.startswith(o.CLAUDE_REDIRECT + "?")
            q = o.query_of(back)
            assert q["state"] == "st-30703" and q["iss"] == base

            # The request is single-use.
            again = c.post(f"/oauth/requests/{rid}/approve", headers=_member(token), json={
                "org_id": gw.w.org, "tools": ["search_knowledge_base"], "folder_ids": None,
                "include_external": False,
            })
            assert again.status_code == 410

        # The grant row: kind mcp, the client, the picked org, the member, ~90 days.
        grants = await pg_pool.fetch(
            "SELECT k.id, k.org_id, k.user_id, k.kind, k.label, k.tools, k.folder_ids, k.include_external, "
            "k.expires_at - now() AS left_, c.client_id FROM public.api_keys k "
            "JOIN public.oauth_clients c ON c.id = k.oauth_client_id WHERE c.client_id = $1",
            client_id,
        )
        assert len(grants) == 1
        g = grants[0]
        assert str(g["org_id"]) == gw.w.org and str(g["user_id"]) == gw.w.user and g["kind"] == "mcp"
        assert g["label"] == "Claude (307-03 live)" and g["folder_ids"] is None and g["include_external"] is False
        assert 89 <= g["left_"].days <= 90
        gw.grants.append(g["id"])
        last_grant = await pg_pool.fetchval(
            "SELECT last_grant_at FROM public.oauth_clients WHERE client_id = $1", client_id
        )
        assert last_grant is not None

        # The code exchanges at /oauth/token, and the token reaches exactly the three read tools.
        pair = o.token_post(base, {
            "grant_type": "authorization_code", "code": q["code"], "client_id": client_id,
            "redirect_uri": o.CLAUDE_REDIRECT, "code_verifier": o.VERIFIER, "resource": f"{base}/mcp",
        })
        assert pair.status_code == 200, pair.text
        access = pair.json()["access_token"]
        assert o.mcp_post(base, access, live.initialize_body()).status_code == 200
        listed = o.mcp_post(base, access, o.tools_list_body())
        assert listed.status_code == 200, listed.text
        names = sorted(t["name"] for t in listed.json()["result"]["tools"])
        assert names == ["list_documents", "read_document", "search_knowledge_base"]
        called = o.mcp_post(base, access, o.tool_call_body("list_documents"))
        assert called.status_code == 200 and called.json()["result"].get("isError") is not True, called.text

        # One api_key.create row, credential oauth, naming the client and the redirect host.
        rows: list[dict] = []
        for _ in range(20):
            rows = [r for r in await gw.w.audit_rows()
                    if r["action_type"] == "api_key.create"
                    and (r["metadata"] or {}).get("api_key_id") == str(g["id"])]
            if rows:
                break
            await asyncio.sleep(0.25)
        assert len(rows) == 1, rows
        detail = rows[0]["metadata"]["detail"]
        assert detail == {"credential": "oauth", "client_name": "Claude (307-03 live)",
                          "redirect_host": "claude.ai"}

        # A second request, DENIED: access_denied back to the client, no grant written.
        rid2 = _request_id(_authorize(base, client_id, state="st-deny"))
        with httpx.Client(base_url=base, timeout=30) as c:
            deny = c.post(f"/oauth/requests/{rid2}/deny", headers=_member(token))
        assert deny.status_code == 200, deny.text
        dq = o.query_of(deny.json()["redirect_url"])
        assert dq == {"error": "access_denied", "state": "st-deny", "iss": base}
        count = await pg_pool.fetchval(
            "SELECT count(*) FROM public.api_keys k JOIN public.oauth_clients c "
            "ON c.id = k.oauth_client_id WHERE c.client_id = $1", client_id,
        )
        assert count == 1
