"""Phase 222 — the cross-AGENT seam: POST /connectors/mcp/probe-auth.

⚠ THIS TEST IS A BLOCKING GATE, NOT A NICE-TO-HAVE. `AGENTS.md` §3.1 permits splitting a
phase across two agents and calls it *"the exact shape of the Phase 204 defect"* — each
side individually correct, individually green, and the join dead. 204 shipped a spend cap
that never armed with **106 tests green**, because each parallel wave mocked the other's
side. The split therefore owes ONE test that mocks NEITHER, and this is it.

The contract under test is `BUS-047`, which Gemini is planning the door against.

⚠ WHAT IS FAKED: the socket, and only the socket. The route is real, its dependencies are
real, `probe_mcp_auth` is real, `_PinnedFetch` is real, the URL rewriting and SNI
restoration are real, and the response model is real. Contrast Phase 212's own seam test,
which mocks `McpClient.list_tools` — that proves the route calls something, not that the
wire is right. Contrast also 212's D-2, whose seam stub INVENTED a `timeout` parameter the
real function did not have and passed anyway.
"""

from __future__ import annotations

import json
from unittest.mock import AsyncMock

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app import dependencies as deps
from app.api import connectors
from app.main import app as real_app
from app.services import mcp_auth_discovery as disc

SERVER = "https://mcp.example.com/mcp"
ACTIVE_ORG = "11111111-1111-1111-1111-111111111111"

#: ⚠ BOTH headers are load-bearing. `require_org_manage` resolves the caller's org from
#: `X-Org-Id`; without it the gate refuses with 403 and every assertion below reads as a
#: contract failure when it is really an unauthenticated request. Cost 7 red tests once.
HEADERS = {"Authorization": "Bearer test-token", "X-Org-Id": ACTIVE_ORG}


@pytest.fixture
def router_client():
    probe = FastAPI()
    probe.include_router(connectors.router)
    probe.dependency_overrides = real_app.dependency_overrides
    return TestClient(probe)


@pytest.fixture
def authorized(mock_asyncpg_pool, monkeypatch):
    """An org admin with `live_connectors` visible — the two gates the route carries."""
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    mock_asyncpg_pool.set_fetchrow_result({"role": "admin"})

    async def _fake_has_perm(request, current_user, org_id, permission_key):
        return True

    monkeypatch.setattr("app.dependencies._has_org_permission", _fake_has_perm)
    monkeypatch.setattr(deps, "is_operator", AsyncMock(return_value=False))
    monkeypatch.setattr("app.models.user_settings.feature_audience", lambda feature: "everyone")


def _fake_socket(monkeypatch, handler):
    """Replace the SOCKET under the real client, leaving every other layer intact."""
    real_client_cls = httpx.AsyncClient

    class _TransportInjected(real_client_cls):
        def __init__(self, *a, **kw):
            kw["transport"] = httpx.MockTransport(handler)
            super().__init__(*a, **kw)

    monkeypatch.setattr(disc.httpx, "AsyncClient", _TransportInjected)

    def _pinned(url: str):
        return disc.PinnedDestination(
            ip="93.184.216.34", hostname=httpx.URL(url).host, port=443, scheme="https"
        )

    monkeypatch.setattr(disc, "validate_mcp_destination", _pinned)


def _json(payload: dict) -> httpx.Response:
    return httpx.Response(200, content=json.dumps(payload).encode(),
                          headers={"content-type": "application/json"})


# ── the contract BUS-047 promised, field by field ─────────────────────────────────────


def test_the_oauth_verdict_reaches_the_wire_with_every_promised_field(
    authorized, monkeypatch, router_client
):
    """A fully compliant server, end to end: route -> discovery -> pinned socket -> JSON."""

    def handler(request: httpx.Request) -> httpx.Response:
        path = request.url.path
        if path == "/mcp":
            return httpx.Response(401, headers={
                "WWW-Authenticate": 'Bearer resource_metadata="https://mcp.example.com/prm"'
            })
        if path == "/prm":
            return _json({"authorization_servers": ["https://auth.example.com"]})
        return _json({
            "authorization_endpoint": "https://auth.example.com/authorize",
            "token_endpoint": "https://auth.example.com/token",
            "registration_endpoint": "https://auth.example.com/register",
            "code_challenge_methods_supported": ["S256"],
        })

    _fake_socket(monkeypatch, handler)
    res = router_client.post("/connectors/mcp/probe-auth", json={"server_url": SERVER}, headers=HEADERS)

    assert res.status_code == 200
    body = res.json()
    # ⚠ THE KEYS ARE ASSERTED EXACTLY, not by subset. A door planned against BUS-047 breaks
    # on a renamed key just as surely as on a wrong value, and an extra key is a leak.
    assert set(body) == {
        "kind", "authorization_host", "registration_required",
        "code_challenge_methods", "detail", "resource_status",
    }
    assert body["kind"] == "oauth"
    assert body["authorization_host"] == "auth.example.com"
    assert body["registration_required"] is False  # the server does DCR; collect nothing
    assert body["code_challenge_methods"] == ["S256"]
    assert body["resource_status"] == 401


def test_the_endpoints_are_never_put_on_the_wire(authorized, monkeypatch, router_client):
    """⚠ THE ABSENCE IS THE CONTRACT (BUS-047), so it gets a test rather than a comment.

    `authorization_endpoint` and `token_endpoint` are withheld deliberately: the browser
    never calls them, the backend does, and exposing them invites a frontend to start the
    flow itself — which would move the PKCE verifier out of the only place that can keep
    it secret. A future field added to the dataclass must not silently reach a client.
    """

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/mcp":
            return httpx.Response(401, headers={
                "WWW-Authenticate": 'Bearer resource_metadata="https://mcp.example.com/prm"'
            })
        if request.url.path == "/prm":
            return _json({"authorization_servers": ["https://auth.example.com"]})
        return _json({
            "authorization_endpoint": "https://auth.example.com/authorize",
            "token_endpoint": "https://auth.example.com/token",
        })

    _fake_socket(monkeypatch, handler)
    raw = router_client.post("/connectors/mcp/probe-auth", json={"server_url": SERVER}, headers=HEADERS).text

    assert "authorization_endpoint" not in raw
    assert "token_endpoint" not in raw
    # The host may appear (it is `authorization_host`); the PATHS must not.
    assert "/authorize" not in raw
    assert "/token" not in raw


def test_registration_required_is_true_when_the_server_offers_no_dynamic_registration(
    authorized, monkeypatch, router_client
):
    """The field that decides whether the door's form has any inputs at all."""

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/mcp":
            return httpx.Response(401, headers={
                "WWW-Authenticate": 'Bearer resource_metadata="https://mcp.example.com/prm"'
            })
        if request.url.path == "/prm":
            return _json({"authorization_servers": ["https://auth.example.com"]})
        return _json({  # no registration_endpoint
            "authorization_endpoint": "https://auth.example.com/authorize",
            "token_endpoint": "https://auth.example.com/token",
        })

    _fake_socket(monkeypatch, handler)
    body = router_client.post("/connectors/mcp/probe-auth", json={"server_url": SERVER}, headers=HEADERS).json()
    assert body["kind"] == "oauth"
    assert body["registration_required"] is True


def test_the_token_door_survives_end_to_end(authorized, monkeypatch, router_client):
    """GitHub's shape today. ⚠ This is the door that SHIPS — 222 adds a front step to it."""
    _fake_socket(monkeypatch, lambda r: httpx.Response(401))
    body = router_client.post("/connectors/mcp/probe-auth", json={"server_url": SERVER}, headers=HEADERS).json()
    assert body["kind"] == "token"
    assert body["detail"]
    assert body["registration_required"] is False


def test_an_open_server_reaches_the_wire_as_open(authorized, monkeypatch, router_client):
    _fake_socket(monkeypatch, lambda r: _json({"jsonrpc": "2.0", "id": 0, "result": {}}))
    body = router_client.post("/connectors/mcp/probe-auth", json={"server_url": SERVER}, headers=HEADERS).json()
    assert body["kind"] == "open"
    assert body["authorization_host"] is None


# ── a refusal is not a verdict about the server ───────────────────────────────────────


def test_an_egress_refusal_is_a_422_naming_its_reason_code_and_not_a_500(
    authorized, monkeypatch, router_client
):
    """⚠ THIS IS THE ONE THE SHIPPED SIBLING GETS WRONG, so it is pinned here.

    `discover_tools_from_url` reads `exc.detail` in its own `except EgressRefused`, and
    `EgressRefused` defines `reason_code`/`host`/`capability`/`ip` and NO `detail` — so
    that handler raises `AttributeError` and converts a clean 422 into a 500. Measured
    2026-09-01. This route reads `reason_code`, and the test proves it rather than trusting
    the comment beside it.

    ⚠ AND THE STATUS MATTERS SEMANTICALLY: 422 means *"we would not go there"*, while a 200
    with `kind="token"` means *"it wants a credential"*. Flattening the two would send
    somebody hunting for an API key for an address we refused to contact.
    """
    called = False

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal called
        called = True
        return httpx.Response(200)

    # NOTE: the real validator, deliberately — loopback must be refused by the shipped code.
    real_client_cls = httpx.AsyncClient

    class _TransportInjected(real_client_cls):
        def __init__(self, *a, **kw):
            kw["transport"] = httpx.MockTransport(handler)
            super().__init__(*a, **kw)

    monkeypatch.setattr(disc.httpx, "AsyncClient", _TransportInjected)

    res = router_client.post(
        "/connectors/mcp/probe-auth",
        json={"server_url": "https://127.0.0.1/mcp"},
        headers=HEADERS,
    )
    assert res.status_code == 422
    assert "address_not_public" in res.json()["detail"]
    assert called is False, "a refused destination must never reach the transport"


def test_a_redirect_is_a_refusal_and_never_an_open_door(
    authorized, monkeypatch, router_client
):
    """⚠ THE DEFECT THE UNIT TESTS CAUGHT, PINNED AT THE WIRE TOO.

    A 302 originally fell through `status < 400` and reached the browser as `kind="open"`
    — *"this server needs no credential, connect straight through"* — about a server that
    had answered nothing at all. The door is contractually allowed to say "no credential
    needed" ONLY from `kind === "open"`, so that string must never be reachable this way.
    """
    _fake_socket(monkeypatch, lambda r: httpx.Response(
        302, headers={"location": "https://evil.example.net/mcp"}
    ))
    res = router_client.post("/connectors/mcp/probe-auth", json={"server_url": SERVER}, headers=HEADERS)
    assert res.status_code == 422
    assert "redirected" in res.json()["detail"]
    assert "open" not in res.text


# ── the gates the route carries ───────────────────────────────────────────────────────


def test_the_route_is_behind_the_live_connectors_kill_switch(
    mock_asyncpg_pool, monkeypatch, router_client
):
    """⚠ PER ENDPOINT, never router-level (`main.py:782`). This route opens a socket to an
    operator-supplied address; outside the switch it would be the one egress path Phase
    210's kill switch could not turn off."""
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    mock_asyncpg_pool.set_fetchrow_result({"role": "admin"})

    async def _fake_has_perm(request, current_user, org_id, permission_key):
        return True

    monkeypatch.setattr("app.dependencies._has_org_permission", _fake_has_perm)
    monkeypatch.setattr(deps, "is_operator", AsyncMock(return_value=False))
    # The switch is OFF for everyone but operators, and this caller is not one.
    monkeypatch.setattr("app.models.user_settings.feature_audience", lambda feature: "operators")

    res = router_client.post("/connectors/mcp/probe-auth", json={"server_url": SERVER}, headers=HEADERS)
    assert res.status_code in (403, 404), f"expected the feature gate to refuse, got {res.status_code}"


def test_an_unknown_field_in_the_request_is_refused(authorized, router_client):
    """`_StrictBase` is `extra='forbid'`, so a door sending a stale key learns at the seam."""
    res = router_client.post(
        "/connectors/mcp/probe-auth",
        json={"server_url": SERVER, "secret": "should-not-be-accepted"},
        headers=HEADERS,
    )
    assert res.status_code == 422
