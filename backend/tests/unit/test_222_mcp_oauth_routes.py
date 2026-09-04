"""Phase 222 — the two OAuth routes, and the properties that keep an untrusted
authorization server from steering them.

⚠ The route pair is where this phase's trust boundary actually sits. `/authorize` runs
under `require_org_manage`; `/callback` has NO auth dependency at all, because it is a
browser redirect arriving from a third party with no JWT. What replaces the header is the
pending record — org and user were bound at authorize time under an authenticated request,
and `state` is a single-use random handle that resolves to it. These tests pin that the
substitution actually holds rather than that it was intended.
"""

from __future__ import annotations

from unittest.mock import AsyncMock

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app import dependencies as deps
from app.api import connectors
from app.main import app as real_app
from app.services import mcp_auth_discovery as disc
from app.services.mcp_auth_discovery import McpAuthProbe

ACTIVE_ORG = "11111111-1111-1111-1111-111111111111"
CONN_ID = "22222222-2222-2222-2222-222222222222"
HEADERS = {"Authorization": "Bearer test-token", "X-Org-Id": ACTIVE_ORG}


@pytest.fixture
def router_client():
    probe = FastAPI()
    probe.include_router(connectors.router)
    probe.dependency_overrides = real_app.dependency_overrides
    return TestClient(probe)


@pytest.fixture
def authorized(mock_asyncpg_pool, monkeypatch):
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    mock_asyncpg_pool.set_fetchrow_result({"role": "admin"})

    async def _perm(request, current_user, org_id, permission_key):
        return True

    monkeypatch.setattr("app.dependencies._has_org_permission", _perm)
    monkeypatch.setattr(deps, "is_operator", AsyncMock(return_value=False))
    monkeypatch.setattr("app.models.user_settings.feature_audience", lambda f: "everyone")


class _FakeRedis:
    def __init__(self):
        self.store = {}

    async def setex(self, k, ttl, v):
        self.store[k] = v

    async def get(self, k):
        return self.store.get(k)

    async def delete(self, k):
        self.store.pop(k, None)


@pytest.fixture
def wired(monkeypatch):
    """A connection row, a Redis, and a discovery result — the three things the route reads."""
    redis = _FakeRedis()
    monkeypatch.setattr("app.dependencies.get_redis", lambda: redis)

    async def _secret(connection_id, org_id):
        return "the-client-secret"

    monkeypatch.setattr(connectors.connector_service, "read_oauth_client_secret", _secret)
    return redis


def _probe_returns(monkeypatch, probe: McpAuthProbe):
    async def _p(server_url, **kw):
        return probe

    monkeypatch.setattr("app.services.mcp_auth_discovery.probe_mcp_auth", _p)


OAUTH_PROBE = McpAuthProbe(
    kind="oauth",
    authorization_host="auth.example.com",
    authorization_endpoint="https://auth.example.com/authorize",
    token_endpoint="https://auth.example.com/token",
    code_challenge_methods=["S256"],
    resource_status=401,
)


# ── /authorize ────────────────────────────────────────────────────────────────────────


def test_the_authorize_route_will_not_accept_endpoints_from_the_caller(authorized, router_client):
    """⚠ THE HEADLINE PROPERTY OF THIS ROUTE. The request model is `extra='forbid'` and takes
    a connection id alone. A caller that could name `token_endpoint` could point the exchange
    — which carries our client secret — anywhere it liked. That is the same reason the probe
    response withholds those fields, enforced from the other side."""
    res = router_client.post(
        "/connectors/mcp/oauth/authorize",
        json={
            "connection_id": CONN_ID,
            "token_endpoint": "https://attacker.example.net/token",
        },
        headers=HEADERS,
    )
    assert res.status_code == 422


def test_a_connection_with_no_server_address_is_refused_with_a_sentence(
    authorized, wired, monkeypatch, router_client
):
    monkeypatch.setattr(
        connectors, "aexec",
        AsyncMock(return_value=type("R", (), {"data": [{"id": CONN_ID, "mcp_server_url": None, "config": {}}]})()),
    )
    res = router_client.post(
        "/connectors/mcp/oauth/authorize", json={"connection_id": CONN_ID}, headers=HEADERS
    )
    assert res.status_code == 422
    assert "no server address" in res.json()["detail"]


def test_a_server_that_needs_a_pasted_token_is_refused_in_its_own_words(
    authorized, wired, monkeypatch, router_client
):
    """⚠ The refusal carries the PROBE's sentence, not a generic one. The three non-oauth
    verdicts have opposite remedies and a person acts on the difference."""
    monkeypatch.setattr(
        connectors, "aexec",
        AsyncMock(return_value=type("R", (), {"data": [
            {"id": CONN_ID, "mcp_server_url": "https://mcp.example.com/mcp", "config": {}}
        ]})()),
    )
    _probe_returns(monkeypatch, McpAuthProbe(
        kind="token", resource_status=401,
        detail="This server asks for a credential but does not advertise how to obtain one.",
    ))
    res = router_client.post(
        "/connectors/mcp/oauth/authorize", json={"connection_id": CONN_ID}, headers=HEADERS
    )
    assert res.status_code == 422
    assert "does not advertise" in res.json()["detail"]


def test_a_successful_start_returns_a_url_whose_state_carries_nothing(
    authorized, wired, monkeypatch, router_client
):
    monkeypatch.setattr(
        connectors, "aexec",
        AsyncMock(return_value=type("R", (), {"data": [{
            "id": CONN_ID,
            "mcp_server_url": "https://mcp.example.com/mcp",
            "config": {"custom_client_id": "client-abc"},
        }]})()),
    )
    _probe_returns(monkeypatch, OAUTH_PROBE)

    res = router_client.post(
        "/connectors/mcp/oauth/authorize", json={"connection_id": CONN_ID}, headers=HEADERS
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert set(body) == {"authorize_url", "authorization_host"}
    assert body["authorization_host"] == "auth.example.com"

    url = httpx.URL(body["authorize_url"])
    assert url.host == "auth.example.com"
    assert url.params["code_challenge_method"] == "S256"
    # The secret never leaves the server, and the state resolves to nothing on its own.
    assert "the-client-secret" not in body["authorize_url"]
    assert len(url.params["state"]) >= 32


def test_the_authorize_route_is_behind_the_kill_switch(
    mock_asyncpg_pool, monkeypatch, router_client
):
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    mock_asyncpg_pool.set_fetchrow_result({"role": "admin"})

    async def _perm(request, current_user, org_id, permission_key):
        return True

    monkeypatch.setattr("app.dependencies._has_org_permission", _perm)
    monkeypatch.setattr(deps, "is_operator", AsyncMock(return_value=False))
    monkeypatch.setattr("app.models.user_settings.feature_audience", lambda f: "operators")

    res = router_client.post(
        "/connectors/mcp/oauth/authorize", json={"connection_id": CONN_ID}, headers=HEADERS
    )
    assert res.status_code in (403, 404)


# ── /callback ─────────────────────────────────────────────────────────────────────────


def test_the_callback_never_reflects_the_providers_error_text_into_the_redirect(router_client):
    """⚠ `error_description` IS ATTACKER-SUPPLIED TEXT from an untrusted authorization
    server. Reflecting it into a URL the browser then renders is how a refusal becomes an
    injection. Only the short `error` code travels; the description is logged."""
    injected = "<script>alert(1)</script>&evil=1"
    res = router_client.get(
        "/connectors/mcp/oauth/callback",
        params={"error": "access_denied", "error_description": injected},
        follow_redirects=False,
    )
    assert res.status_code in (302, 307)
    location = res.headers["location"]
    assert "access_denied" in location
    assert "script" not in location
    assert "evil=1" not in location


def test_the_callback_needs_no_jwt_but_refuses_a_handle_it_does_not_know(
    monkeypatch, router_client
):
    """No auth dependency — it is a third-party redirect. The single-use handle is what
    stands in for one, so an unknown handle must not become a connected connection."""
    monkeypatch.setattr("app.dependencies.get_redis", lambda: _FakeRedis())
    saved = []
    monkeypatch.setattr(
        connectors.connector_service, "save_oauth_tokens",
        AsyncMock(side_effect=lambda **kw: saved.append(kw)),
    )

    res = router_client.get(
        "/connectors/mcp/oauth/callback",
        params={"code": "c", "state": "a-handle-nobody-minted"},
        follow_redirects=False,
    )
    assert res.status_code in (302, 307)
    assert "oauth_error=exchange_failed" in res.headers["location"]
    assert saved == [], "no token may be stored for a handle we never issued"


def test_a_callback_with_no_code_lands_honestly_rather_than_pretending(router_client):
    res = router_client.get(
        "/connectors/mcp/oauth/callback", params={"state": "x"}, follow_redirects=False
    )
    assert res.status_code in (302, 307)
    assert "missing_code_or_state" in res.headers["location"]


def test_the_stored_org_comes_from_the_pending_record_not_from_the_request(
    monkeypatch, router_client
):
    """⚠ THE SUBSTITUTION THAT REPLACES THE MISSING JWT, pinned. The callback carries no
    identity, so org and user must come from the record minted at authorize time under an
    authenticated `require_org_manage` request — never from anything in this URL."""
    import json as _json

    redis = _FakeRedis()
    monkeypatch.setattr("app.dependencies.get_redis", lambda: redis)
    redis.store["mcp_oauth:pending:HANDLE"] = _json.dumps({
        "code_verifier": "v", "client_id": "cid", "client_secret": None,
        "token_endpoint": "https://auth.example.com/token",
        "redirect_uri": "https://api.example.com/cb",
        "connection_id": CONN_ID, "user_id": "user-1",
        "org_id": ACTIVE_ORG, "server_url": "https://mcp.example.com/mcp",
    })

    def _fake(url):
        return disc.PinnedDestination(ip="93.184.216.34", hostname=httpx.URL(url).host, port=443, scheme="https")

    monkeypatch.setattr(disc, "validate_mcp_destination", _fake)

    real_cls = httpx.AsyncClient

    class _Injected(real_cls):
        def __init__(self, *a, **kw):
            kw["transport"] = httpx.MockTransport(
                lambda r: httpx.Response(200, json={"access_token": "at", "expires_in": 3600})
            )
            super().__init__(*a, **kw)

    monkeypatch.setattr(disc.httpx, "AsyncClient", _Injected)

    saved: list[dict] = []
    monkeypatch.setattr(
        connectors.connector_service, "save_oauth_tokens",
        AsyncMock(side_effect=lambda **kw: saved.append(kw)),
    )

    res = router_client.get(
        "/connectors/mcp/oauth/callback",
        # ⚠ A DIFFERENT org is supplied in the URL. It must be ignored entirely.
        params={"code": "c", "state": "HANDLE", "org_id": "99999999-9999-9999-9999-999999999999"},
        follow_redirects=False,
    )
    assert "oauth_connected=1" in res.headers["location"]
    assert len(saved) == 1
    assert saved[0]["org_id"] == ACTIVE_ORG
    assert saved[0]["connection_id"] == CONN_ID
    # ⚠ No profile fetch here: there is no known identity endpoint, and inventing one would
    # send the fresh token to a URL the same untrusted server chose.
    assert saved[0]["account_email"] is None
