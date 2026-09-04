from types import SimpleNamespace
from uuid import uuid4
import pytest
from app.models.connector import ToolGrantPosture
from app.services.connector_service import ResolvedConnection
from app.services.connectors.grants import resolve_effective_posture, is_tool_allowed
from app.services.harness.phase_types import _exec_external_action


class DummyContext:
    def __init__(self, org_id):
        self.is_golden_run = False
        self.org_id = str(org_id)
        self.pool = object()
        self.current_user = {"id": str(uuid4()), "org_id": str(org_id)}
        self.run_id = uuid4()


class DummyPhase:
    def __init__(self, **kwargs):
        self.slug = "step-test-action"
        self.name = "Test Action Step"
        self.phase_index = 0
        self.phase_type = "external_action"
        self.config = SimpleNamespace(**kwargs)
        self.action_risk_armed = False


@pytest.mark.asyncio
async def test_end_to_end_allowed_tool_executes_and_emits_action_sent(monkeypatch):
    """An allowed tool passes Gate 5.5 and writes an external_action_sent receipt with tool_name."""
    conn_id = uuid4()
    org_id = uuid4()

    # Real ResolvedConnection with explicit allow grant
    connection = ResolvedConnection(
        connection_id=str(conn_id),
        org_id=str(org_id),
        name="GitHub Production",
        capability=None,
        mcp_server_url="https://mcp.github.com/v1",
        default_approval_posture="ask",
        tool_grants={"search_code": "allow", "delete_repo": "deny"},
        secret_ciphertext=None,
        config={},
    )

    # Verify grants leaf module directly resolves posture
    assert resolve_effective_posture(connection, "search_code") == "allow"
    assert is_tool_allowed(connection, "search_code") is True

    # Monkeypatch live connectors feature audience to everyone
    async def mock_ensure_settings_fresh():
        pass

    monkeypatch.setattr("app.services.harness.phase_types.feature_audience", lambda feature: "everyone")
    monkeypatch.setattr("app.services.harness.phase_types.ensure_settings_fresh", mock_ensure_settings_fresh)

    # Mock resolve_connection to return our real connection object
    async def mock_resolve_connection(cid, org_id):
        assert str(cid) == str(conn_id)
        assert str(org_id) == str(org_id)
        return connection

    monkeypatch.setattr("app.services.harness.phase_types.resolve_connection", mock_resolve_connection)

    # Capture written audit events
    audit_events = []
    async def mock_write_audit(pool, run_id, user_id, event_type, metadata):
        audit_events.append({
            "run_id": run_id,
            "user_id": user_id,
            "event_type": event_type,
            "metadata": metadata,
        })

    monkeypatch.setattr("app.services.harness.phase_types.write_audit", mock_write_audit)

    # Mock MCP client call_tool
    async def mock_call_tool(server_url, tool_name, arguments, secret=None):
        return {"text": f"results for {tool_name}"}

    monkeypatch.setattr("app.services.mcp_client.call_tool", mock_call_tool)

    ctx = DummyContext(org_id=org_id)

    phase = DummyPhase(
        connection_id=str(conn_id),
        tool_name="search_code",
        tool_args={"query": "repo:org/test"},
        capability=None,
    )

    outcome = await _exec_external_action(phase, {}, ctx)

    # Assert success and output
    assert outcome == {"text": "results for search_code"}

    # Assert external_action_sent audit event written with tool_name
    sent_events = [e for e in audit_events if e["event_type"] == "external_action_sent"]
    assert len(sent_events) == 1
    assert sent_events[0]["metadata"]["tool_name"] == "search_code"
    assert sent_events[0]["metadata"]["connection_id"] == str(conn_id)


@pytest.mark.asyncio
async def test_end_to_end_denied_tool_fails_gate55_and_emits_tool_refused(monkeypatch):
    """A denied tool is halted at Gate 5.5, emits tool_refused, and never invokes MCP client."""
    conn_id = uuid4()
    org_id = uuid4()

    connection = ResolvedConnection(
        connection_id=str(conn_id),
        org_id=str(org_id),
        name="GitHub Production",
        capability=None,
        mcp_server_url="https://mcp.github.com/v1",
        default_approval_posture="ask",
        tool_grants={"search_code": "allow", "delete_repo": "deny"},
        secret_ciphertext=None,
        config={},
    )

    assert resolve_effective_posture(connection, "delete_repo") == "deny"
    assert is_tool_allowed(connection, "delete_repo") is False

    async def mock_ensure_settings_fresh():
        pass

    monkeypatch.setattr("app.services.harness.phase_types.feature_audience", lambda feature: "everyone")
    monkeypatch.setattr("app.services.harness.phase_types.ensure_settings_fresh", mock_ensure_settings_fresh)

    async def mock_resolve_connection(cid, org_id):
        return connection

    monkeypatch.setattr("app.services.harness.phase_types.resolve_connection", mock_resolve_connection)

    audit_events = []
    async def mock_write_audit(pool, run_id, user_id, event_type, metadata):
        audit_events.append({
            "run_id": run_id,
            "user_id": user_id,
            "event_type": event_type,
            "metadata": metadata,
        })

    monkeypatch.setattr("app.services.harness.phase_types.write_audit", mock_write_audit)

    mcp_called = False
    async def mock_call_tool(*args, **kwargs):
        nonlocal mcp_called
        mcp_called = True
        return {"text": "should not be called"}

    monkeypatch.setattr("app.services.mcp_client.call_tool", mock_call_tool)

    ctx = DummyContext(org_id=org_id)

    phase = DummyPhase(
        connection_id=str(conn_id),
        tool_name="delete_repo",
        tool_args={"repo": "org/test"},
        capability=None,
    )

    outcome = await _exec_external_action(phase, {}, ctx)

    # ⚠ AMENDED by plan 213-06 (GRANT-04). SC#4 requires the refusal to NAME THE GRANT
    # that would allow it; "is not granted permission" named none and offered no next step.
    assert "is set to Deny on this connection" in outcome.get("text", ""), outcome
    assert "Set it to Allow or Ask first" in outcome.get("text", ""), outcome
    assert not mcp_called

    # Assert tool_refused audit event written with tool_name
    refused_events = [e for e in audit_events if e["event_type"] == "tool_refused"]
    assert len(refused_events) == 1
    assert refused_events[0]["metadata"]["tool_name"] == "delete_repo"
    assert refused_events[0]["metadata"]["connection_id"] == str(conn_id)


@pytest.mark.asyncio
async def test_end_to_end_unspecified_tool_inherits_default_posture(monkeypatch):
    """An unspecified tool inherits connection default_approval_posture (e.g. ask -> refused at execution)."""
    conn_id = uuid4()
    org_id = uuid4()

    connection = ResolvedConnection(
        connection_id=str(conn_id),
        org_id=str(org_id),
        name="GitHub Production",
        capability=None,
        mcp_server_url="https://mcp.github.com/v1",
        default_approval_posture="ask",
        tool_grants={"search_code": "allow"},
        secret_ciphertext=None,
        config={},
    )

    # create_issue is not in tool_grants, inherits "ask"
    assert resolve_effective_posture(connection, "create_issue") == "ask"
    assert is_tool_allowed(connection, "create_issue") is False
