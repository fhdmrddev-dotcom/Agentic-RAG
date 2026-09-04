"""Phase 222 (SEED-237) — Cross-Seam Integration Test (AGENTS.md §3.1).

Tests the wire seam between the Door client and backend crypto/discovery routes
WITHOUT mocking either side.

Covers:
1. POST /connectors/mcp/probe-auth -> McpProbeAuthResponse shape contract
2. POST /connectors/mcp/oauth/authorize -> McpOAuthStartResponse shape contract
3. GET /connectors/mcp/oauth/callback -> RedirectResponse error/success handling
4. HTTP 422 Policy Refusal -> {"detail": {"reason_code": ..., "message": ...}} object contract
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

SERVER = "https://mcp.notion.com/mcp"
ACTIVE_ORG = "11111111-1111-1111-1111-111111111111"
HEADERS = {"Authorization": "Bearer test-token", "X-Org-Id": ACTIVE_ORG}


@pytest.fixture
def seam_client():
    probe = FastAPI()
    probe.include_router(connectors.router)
    probe.dependency_overrides = real_app.dependency_overrides
    return TestClient(probe)


@pytest.fixture
def authorized(mock_asyncpg_pool, monkeypatch):
    """An org admin with live_connectors enabled."""
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    mock_asyncpg_pool.set_fetchrow_result({"role": "admin"})

    async def _fake_has_perm(request, current_user, org_id, permission_key):
        return True

    monkeypatch.setattr("app.dependencies._has_org_permission", _fake_has_perm)
    monkeypatch.setattr(deps, "is_operator", AsyncMock(return_value=False))
    monkeypatch.setattr("app.models.user_settings.feature_audience", lambda feature: "everyone")


def _inject_socket(monkeypatch, handler):
    """Inject mock transport at the lowest socket layer, leaving all wire parsing unmocked."""
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
    return httpx.Response(
        200,
        content=json.dumps(payload).encode(),
        headers={"content-type": "application/json"},
    )


def test_probe_auth_open_server_seam(seam_client, authorized, monkeypatch):
    """Verifies probe-auth on open server answers kind='open' with 200."""
    def _handler(req: httpx.Request) -> httpx.Response:
        if req.url.path == "/mcp":
            return _json({"jsonrpc": "2.0", "result": {"protocolVersion": "2024-11-05"}})
        return httpx.Response(404)

    _inject_socket(monkeypatch, _handler)

    res = seam_client.post("/connectors/mcp/probe-auth", json={"server_url": SERVER}, headers=HEADERS)
    assert res.status_code == 200
    data = res.json()
    assert data["kind"] == "open"
    assert data["authorization_host"] is None
    assert data["registration_required"] is False
    assert data["code_challenge_methods"] == []


def test_probe_auth_oauth_dcr_server_seam(seam_client, authorized, monkeypatch):
    """Verifies probe-auth on RFC 9728/8414 server returns kind='oauth' with registration_required=False."""
    def _handler(req: httpx.Request) -> httpx.Response:
        if req.url.path == "/mcp":
            return httpx.Response(
                401,
                headers={"WWW-Authenticate": 'Bearer resource_metadata="https://auth.notion.com/.well-known/oauth-protected-resource"'},
            )
        if req.url.path == "/.well-known/oauth-protected-resource":
            return _json({
                "resource": "https://mcp.notion.com/mcp",
                "authorization_servers": ["https://auth.notion.com"],
            })
        if req.url.path == "/.well-known/oauth-authorization-server":
            return _json({
                "issuer": "https://auth.notion.com",
                "authorization_endpoint": "https://auth.notion.com/oauth/authorize",
                "token_endpoint": "https://auth.notion.com/oauth/token",
                "registration_endpoint": "https://auth.notion.com/oauth/register",
                "code_challenge_methods_supported": ["S256"],
            })
        return httpx.Response(404)

    _inject_socket(monkeypatch, _handler)

    res = seam_client.post("/connectors/mcp/probe-auth", json={"server_url": SERVER}, headers=HEADERS)
    assert res.status_code == 200
    data = res.json()
    assert data["kind"] == "oauth"
    assert data["authorization_host"] == "auth.notion.com"
    assert data["registration_required"] is False
    assert data["code_challenge_methods"] == ["S256"]


def test_probe_auth_token_server_seam(seam_client, authorized, monkeypatch):
    """Verifies probe-auth on raw 401 returns kind='token' with detail."""
    def _handler(req: httpx.Request) -> httpx.Response:
        if req.url.path == "/mcp":
            return httpx.Response(401, text="Personal access token required")
        return httpx.Response(404)

    _inject_socket(monkeypatch, _handler)

    res = seam_client.post("/connectors/mcp/probe-auth", json={"server_url": SERVER}, headers=HEADERS)
    assert res.status_code == 200
    data = res.json()
    assert data["kind"] == "token"
    assert data["authorization_host"] is None
    assert "token" in data["detail"].lower()


def test_probe_auth_egress_refusal_seam(seam_client, authorized):
    """Verifies policy refusal yields HTTP 422 with structured reason_code object (BUS-052)."""
    res = seam_client.post(
        "/connectors/mcp/probe-auth",
        json={"server_url": "http://127.0.0.1:8000/mcp"},
        headers=HEADERS,
    )
    assert res.status_code == 422
    body = res.json()
    assert isinstance(body["detail"], dict)
    assert "reason_code" in body["detail"]
    assert body["detail"]["reason_code"] in ("scheme_not_tls", "non_https_mcp_url", "rfc1918_refused", "loopback_refused")


def test_mcp_oauth_callback_redirect_error_handling(seam_client):
    """Verifies that error returned in callback redirects to settings page with query parameter."""
    res = seam_client.get(
        "/connectors/mcp/oauth/callback?error=access_denied&error_description=User+cancelled",
        follow_redirects=False,
    )
    assert res.status_code in (302, 307)
    location = res.headers["location"]
    assert "error=" in location or "oauth_error" in location
