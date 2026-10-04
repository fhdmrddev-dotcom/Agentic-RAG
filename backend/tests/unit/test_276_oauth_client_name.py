"""Phase 276-07 (D-27) — MCP OAuth dynamic registrations are named "Syrel" on vendor consent screens.

RFC 7591 dynamic client registration names OUR application inside SOMEONE ELSE's account, so the
name a person sees on the vendor's consent screen comes from the `client_name` we send. After the
product rename (2026-10-04) a NEW registration must say "Syrel".

⛔ The other half is the one that matters for safety (T-276-42): a connection that already stores a
`custom_client_id` must NEVER be re-registered just to pick up the new name. Re-registering would
mint a second vendor application, orphan the first, and put a different `client_id` on the token
than on the consent that authorised it. So arm B asserts `register_client` is not called at all —
an existing vendor application keeps the name it was registered with.

Harness cloned from `test_252_credential_boundary.py`
`test_the_dcr_route_refuses_a_server_minted_id_it_will_not_store` (same authorisation monkeypatches,
same probe shape, the real route mounted on a bare FastAPI app).
"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

ACTIVE_ORG = "11111111-1111-1111-1111-111111111111"
CONN_ID = "22222222-2222-2222-2222-222222222222"
HEADERS = {"Authorization": "Bearer test-token", "X-Org-Id": ACTIVE_ORG}


def _drive(monkeypatch, mock_asyncpg_pool, config: dict) -> tuple[list[dict], object]:
    """Mount the real authorize route with `config` on the row; return (register calls, response)."""
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    from app import dependencies as deps
    from app.api import connectors
    from app.main import app as real_app
    from app.services.mcp_auth_discovery import McpAuthProbe
    from app.services.mcp_oauth import RegisteredClient

    # — authorisation, copied from the 252 harness —
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    mock_asyncpg_pool.set_fetchrow_result({"role": "admin"})

    async def _perm(request, current_user, org_id, permission_key):
        return True

    monkeypatch.setattr("app.dependencies._has_org_permission", _perm)
    monkeypatch.setattr(deps, "is_operator", AsyncMock(return_value=False))
    monkeypatch.setattr("app.models.user_settings.feature_audience", lambda f: "everyone")

    monkeypatch.setattr(
        connectors,
        "aexec",
        AsyncMock(return_value=SimpleNamespace(data=[
            {"id": CONN_ID, "mcp_server_url": "https://mcp.example.com/mcp", "config": config}
        ])),
    )

    async def _probe(server_url, **kw):
        return McpAuthProbe(
            kind="oauth",
            authorization_host="auth.example.com",
            authorization_endpoint="https://auth.example.com/authorize",
            token_endpoint="https://auth.example.com/token",
            registration_endpoint="https://auth.example.com/register",
            code_challenge_methods=["S256"],
            resource_status=401,
        )

    monkeypatch.setattr("app.services.mcp_auth_discovery.probe_mcp_auth", _probe)
    monkeypatch.setattr(
        connectors.connector_service, "read_oauth_client_secret", AsyncMock(return_value=None)
    )
    monkeypatch.setattr(
        connectors.connector_service, "store_oauth_client_credentials", AsyncMock(return_value=None)
    )

    calls: list[dict] = []

    async def _register(registration_endpoint, **kw):
        calls.append({"registration_endpoint": registration_endpoint, **kw})
        return RegisteredClient(client_id="minted-123", client_secret=None)

    monkeypatch.setattr("app.services.mcp_oauth.register_client", _register)

    async def _begin(redis, **kw):
        return ("https://auth.example.com/authorize?client_id=" + kw["client_id"], "handle")

    monkeypatch.setattr("app.services.mcp_oauth.begin_authorization", _begin)
    monkeypatch.setattr("app.dependencies.get_redis", lambda: None)

    probe_app = FastAPI()
    probe_app.include_router(connectors.router)
    probe_app.dependency_overrides = real_app.dependency_overrides
    res = TestClient(probe_app).post(
        "/connectors/mcp/oauth/authorize", json={"connection_id": CONN_ID}, headers=HEADERS
    )
    return calls, res


@pytest.mark.asyncio
async def test_a_new_dynamic_registration_is_named_syrel(monkeypatch, mock_asyncpg_pool):
    """Arm A — no stored application, the server offers registration → one call, named Syrel."""
    calls, res = _drive(monkeypatch, mock_asyncpg_pool, config={})

    assert res.status_code == 200, res.text
    assert len(calls) == 1
    assert calls[0]["client_name"] == "Syrel"
    assert calls[0]["registration_endpoint"] == "https://auth.example.com/register"


@pytest.mark.asyncio
async def test_a_stored_client_is_never_re_registered(monkeypatch, mock_asyncpg_pool):
    """Arm B — a stored `custom_client_id` skips registration; its vendor app keeps its old name."""
    calls, res = _drive(monkeypatch, mock_asyncpg_pool, config={"custom_client_id": "existing-app"})

    assert res.status_code == 200, res.text
    assert calls == [], "a connection with a stored application was re-registered"
    assert "client_id=existing-app" in res.json()["authorize_url"]
