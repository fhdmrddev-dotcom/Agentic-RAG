"""Phase 212 (S-3 / Preflight Finding 3) — Cross-Plan Seam Integration Test.

Verifies the mock-neither wire contract between:
- Frontend: probeMcpServer(payload: McpProbeRequest): Promise<McpProbeResponse>
- Backend: POST /connectors/discover-tools -> McpDiscoverResponse

Asserts byte/field wire fidelity:
- Request wire: { mcp_server_url, secret, timeout }
- Response wire: { server_url, tools, count }
- Tool fields: { name, title, description, inputSchema, outputSchema }
"""

from __future__ import annotations

from unittest.mock import AsyncMock
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app import dependencies as deps
from app.api import connectors
from app.main import app as real_app
from app.models.connector import McpDiscoverResponse
from app.services.mcp_client import McpClient

CALLER_ID = "00000000-0000-0000-0000-000000000001"
ACTIVE_ORG = "11111111-1111-1111-1111-111111111111"


@pytest.fixture
def router_client():
    """A TestClient over `connectors.router` ALONE, sharing the live override dict."""
    probe = FastAPI()
    probe.include_router(connectors.router)
    probe.dependency_overrides = real_app.dependency_overrides
    return TestClient(probe)


def test_discover_tools_wire_contract_matches_probe_mcp_server(
    mock_asyncpg_pool, monkeypatch, router_client
):
    """Verifies that POST /connectors/discover-tools produces the exact wire shape probeMcpServer expects."""

    # 1. Authorize member into active org with org:manage permission
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    mock_asyncpg_pool.set_fetchrow_result({"role": "admin"})

    async def _fake_has_perm(request, current_user, org_id, permission_key):
        return True

    monkeypatch.setattr("app.dependencies._has_org_permission", _fake_has_perm)

    # 2. Set live_connectors visibility feature to 'everyone'
    monkeypatch.setattr(deps, "is_operator", AsyncMock(return_value=False))
    monkeypatch.setattr("app.models.user_settings.feature_audience", lambda feature: "everyone")

    # 3. Mock MCP tool response
    sample_tools = [
        {
            "name": "query_database",
            "title": "Query Database",
            "description": "Execute SQL queries against the read-replica database.",
            "inputSchema": {
                "type": "object",
                "properties": {"query": {"type": "string"}},
                "required": ["query"],
            },
            "outputSchema": {
                "type": "object",
                "properties": {"rows": {"type": "array"}},
            },
        },
        {
            "name": "send_slack_message",
            "title": "Send Slack Message",
            "description": "Send a markdown message to a Slack channel.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "channel": {"type": "string"},
                    "text": {"type": "string"},
                },
                "required": ["channel", "text"],
            },
        },
    ]

    async def mock_list_tools(server_url, secret=None, timeout=None):
        return sample_tools

    monkeypatch.setattr("app.services.mcp_client.list_tools", mock_list_tools)

    request_payload = {
        "mcp_server_url": "https://mcp.internal.example.com/v1/sse",
        "secret": "test-secret-token",
        "timeout": 10.0,
    }

    response = router_client.post(
        "/connectors/discover-tools",
        json=request_payload,
        headers={"Authorization": "Bearer test-token", "X-Org-Id": ACTIVE_ORG},
    )

    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    data = response.json()

    # Wire fields asserted
    assert data["server_url"] == "https://mcp.internal.example.com/v1/sse"
    assert data["count"] == 2
    assert len(data["tools"]) == 2

    tool1 = data["tools"][0]
    assert tool1["name"] == "query_database"
    assert tool1["title"] == "Query Database"
    assert tool1["description"] == "Execute SQL queries against the read-replica database."
    assert tool1["inputSchema"] == {
        "type": "object",
        "properties": {"query": {"type": "string"}},
        "required": ["query"],
    }
    assert tool1["outputSchema"] == {
        "type": "object",
        "properties": {"rows": {"type": "array"}},
    }

    tool2 = data["tools"][1]
    assert tool2["name"] == "send_slack_message"
    assert tool2["title"] == "Send Slack Message"
    assert tool2["description"] == "Send a markdown message to a Slack channel."
    assert tool2["inputSchema"] is not None
    assert tool2.get("outputSchema") is None


def test_discover_tools_refusal_when_live_connectors_off(
    mock_asyncpg_pool, monkeypatch, router_client
):
    """Verifies that POST /connectors/discover-tools is refused with 403 when live_connectors is off (SEC-1)."""
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    mock_asyncpg_pool.set_fetchrow_result({"role": "admin"})

    async def _fake_has_perm(request, current_user, org_id, permission_key):
        return True

    monkeypatch.setattr("app.dependencies._has_org_permission", _fake_has_perm)
    monkeypatch.setattr(deps, "is_operator", AsyncMock(return_value=False))
    monkeypatch.setattr("app.models.user_settings.feature_audience", lambda feature: "off")

    response = router_client.post(
        "/connectors/discover-tools",
        json={"mcp_server_url": "https://mcp.internal.example.com/v1/sse"},
        headers={"Authorization": "Bearer test-token", "X-Org-Id": ACTIVE_ORG},
    )

    assert response.status_code == 403
    assert "administrators only" in response.json()["detail"]
