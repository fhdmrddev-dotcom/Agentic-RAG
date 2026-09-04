"""Phase 213 (Wave 1) — Schema, models, projection, and sanitization tests for approval posture.

Tests cover:
  1. `ToolGrantPosture` literal and Pydantic model validation (Create, Update, Response).
  2. `_sanitize_tool_grants` contract: accepts 'allow', 'ask', 'deny'; strictly refuses bools, ints, invalid strings.
  3. `_to_response` projection preserves or defaults `default_approval_posture`.
  4. Service write paths (create, update, update_grants) sanitize grants and persist posture.
"""

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from pydantic import ValidationError

from app.models.connector import (
    ConnectorConnectionCreate,
    ConnectorConnectionResponse,
    ConnectorConnectionUpdate,
    ToolGrantPosture,
)
from app.services import connector_service


# ── 1 · Pydantic models validation ────────────────────────────────────────────────────────

def test_connector_models_default_approval_posture():
    """ConnectorConnectionCreate and ConnectorConnectionResponse default posture to 'ask'."""
    create_req = ConnectorConnectionCreate(
        service_id="github",
        name="GitHub Service",
        mcp_server_url="https://api.github.com/mcp",
    )
    assert create_req.default_approval_posture == "ask"
    assert create_req.tool_grants == {}

    resp = ConnectorConnectionResponse(
        id="conn-1",
        org_id="org-1",
        service_id="github",
        name="GitHub Service",
    )
    assert resp.default_approval_posture == "ask"
    assert resp.tool_grants == {}


def test_connector_models_accept_explicit_posture_and_grants():
    """ConnectorConnectionCreate and Update accept valid posture values."""
    create_req = ConnectorConnectionCreate(
        service_id="github",
        name="GitHub Service",
        mcp_server_url="https://api.github.com/mcp",
        default_approval_posture="deny",
        tool_grants={"create_issue": "allow", "delete_repo": "deny", "list_repos": "ask"},
    )
    assert create_req.default_approval_posture == "deny"
    assert create_req.tool_grants == {
        "create_issue": "allow",
        "delete_repo": "deny",
        "list_repos": "ask",
    }

    update_req = ConnectorConnectionUpdate(
        default_approval_posture="allow",
        tool_grants={"create_issue": "ask"},
    )
    assert update_req.default_approval_posture == "allow"
    assert update_req.tool_grants == {"create_issue": "ask"}


def test_connector_models_reject_invalid_posture_strings():
    """Pydantic raises ValidationError for unknown posture strings."""
    with pytest.raises(ValidationError):
        ConnectorConnectionCreate(
            service_id="github",
            name="GitHub Service",
            mcp_server_url="https://api.github.com/mcp",
            default_approval_posture="invalid",  # type: ignore
        )

    with pytest.raises(ValidationError):
        ConnectorConnectionCreate(
            service_id="github",
            name="GitHub Service",
            mcp_server_url="https://api.github.com/mcp",
            tool_grants={"foo": "invalid"},  # type: ignore
        )


# ── 2 · _sanitize_tool_grants ─────────────────────────────────────────────────────────────

def test_sanitize_tool_grants_accepts_legal_postures():
    """_sanitize_tool_grants accepts dicts with 'allow', 'ask', 'deny'."""
    raw = {"t1": "allow", "t2": "ask", "t3": "deny"}
    cleaned = connector_service._sanitize_tool_grants(raw)
    assert cleaned == raw


@pytest.mark.parametrize("invalid_val", [True, False, 1, 0, None, 1.5, "yes", "no", "granted"])
def test_sanitize_tool_grants_refuses_non_postures(invalid_val):
    """_sanitize_tool_grants strictly refuses booleans, numbers, and non-posture strings."""
    with pytest.raises(ValueError) as excinfo:
        connector_service._sanitize_tool_grants({"my_tool": invalid_val})
    msg = str(excinfo.value)
    assert "my_tool" in msg
    assert "not one of" in msg


# ── 3 · _to_response projection ───────────────────────────────────────────────────────────

def test_to_response_preserves_posture_and_defaults_none():
    """_to_response includes default_approval_posture, defaulting to 'ask' if missing."""
    row_with_posture = {
        "id": "11111111-1111-1111-1111-111111111111",
        "org_id": "00000000-0000-0000-0000-000000000001",
        "service_id": "slack",
        "name": "Slack Integration",
        "config": {},
        "default_approval_posture": "deny",
        "tool_grants": {"send_message": "allow"},
        "discovered_tools": [],
        "is_enabled": True,
    }
    resp = connector_service._to_response(row_with_posture)
    assert resp.default_approval_posture == "deny"
    assert resp.tool_grants == {"send_message": "allow"}

    # Without default_approval_posture key
    row_without_posture = {
        "id": "11111111-1111-1111-1111-111111111111",
        "org_id": "00000000-0000-0000-0000-000000000001",
        "service_id": "slack",
        "name": "Slack Integration",
        "config": {},
        "tool_grants": None,
        "is_enabled": True,
    }
    resp_default = connector_service._to_response(row_without_posture)
    assert resp_default.default_approval_posture == "ask"
    assert resp_default.tool_grants == {}


# ── 4 · CRUD service writes ───────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_update_connection_grants_writes_sanitized_postures(monkeypatch):
    """update_connection_grants sanitizes and persists posture map."""
    updates_recorded = []

    class FakeQueryBuilder:
        def __init__(self):
            self.request = SimpleNamespace(params=SimpleNamespace(set=lambda k, v: self))

        def update(self, payload):
            updates_recorded.append(payload)
            return self

        def eq(self, *args):
            return self

        def execute(self):
            return SimpleNamespace(data=[{
                "id": "conn-1",
                "org_id": "org-1",
                "service_id": "jira",
                "name": "Jira",
                "config": {},
                "default_approval_posture": "ask",
                "tool_grants": updates_recorded[-1]["tool_grants"],
                "discovered_tools": [],
                "is_enabled": True,
            }])

    fake_client = SimpleNamespace(table=lambda name: FakeQueryBuilder())

    res = await connector_service.update_connection_grants(
        connection_id="conn-1",
        org_id="org-1",
        tool_grants={"jira_create_issue": "allow", "jira_delete_issue": "deny"},
        supabase=fake_client,
    )
    assert res.tool_grants == {"jira_create_issue": "allow", "jira_delete_issue": "deny"}
    assert updates_recorded[0]["tool_grants"] == {
        "jira_create_issue": "allow",
        "jira_delete_issue": "deny",
    }
