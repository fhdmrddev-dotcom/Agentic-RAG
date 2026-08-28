"""Phase 213 Wave 2 Unit Tests — Gate 5.5 Posture Resolution & Execution Engine Integration.

Tests:
1. Pure unit tests over `app.services.connectors.grants` (`resolve_effective_posture`, `is_tool_allowed`, leaf invariant).
2. Gate 5.5 posture enforcement inside `_exec_external_action` across both MCP and Capability shapes (closing BUG-260827-02).
3. Audit event emission verification (`tool_refused` on deny, `external_action_sent` carrying `tool_name` on success).
"""
from __future__ import annotations

import ast
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
import pytest

from app.services.connector_service import ResolvedConnection
from app.services.connectors.grants import (
    _LEGAL_POSTURES,
    is_tool_allowed,
    resolve_effective_posture,
)
from app.services.harness.phase_types import _exec_external_action


# ═══════════════════════════════════════════════════════════════════════════════
# 1. Pure Unit Tests over grants.py
# ═══════════════════════════════════════════════════════════════════════════════

def test_leaf_module_invariant_does_not_import_harness_engine():
    """D-213-00: grants.py is a strict leaf and must never import phase_types or harness_engine."""
    import app.services.connectors.grants as grants_mod
    with open(grants_mod.__file__, "r", encoding="utf-8") as f:
        tree = ast.parse(f.read())

    imported_modules = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                imported_modules.add(alias.name)
        elif isinstance(node, ast.ImportFrom) and node.module:
            imported_modules.add(node.module)

    for mod in imported_modules:
        assert "phase_types" not in mod, f"grants.py imported phase_types: {mod}"
        assert "harness_engine" not in mod, f"grants.py imported harness_engine: {mod}"


def test_resolve_effective_posture_explicit_grants():
    conn = ResolvedConnection(
        connection_id="conn-1",
        org_id="org-1",
        capability=None,
        name="GitHub",
        config={},
        secret_ciphertext="enc",
        default_approval_posture="ask",
        tool_grants={
            "create_issue": "allow",
            "delete_repo": "deny",
            "star_repo": "ask",
        },
    )
    assert resolve_effective_posture(conn, "create_issue") == "allow"
    assert resolve_effective_posture(conn, "delete_repo") == "deny"
    assert resolve_effective_posture(conn, "star_repo") == "ask"
    assert is_tool_allowed(conn, "create_issue") is True
    assert is_tool_allowed(conn, "delete_repo") is False
    assert is_tool_allowed(conn, "star_repo") is False


def test_resolve_effective_posture_legacy_boolean_coercion():
    conn = ResolvedConnection(
        connection_id="conn-1",
        org_id="org-1",
        capability="post_message",
        name="Slack",
        config={},
        secret_ciphertext="enc",
        default_approval_posture="ask",
        tool_grants={
            "post_message": True,   # type: ignore[dict-item]
            "delete_message": False, # type: ignore[dict-item]
        },
    )
    assert resolve_effective_posture(conn, "post_message") == "allow"
    assert resolve_effective_posture(conn, "delete_message") == "deny"


def test_resolve_effective_posture_inherits_default_posture():
    conn_ask = ResolvedConnection(
        connection_id="conn-1",
        org_id="org-1",
        capability=None,
        name="Jira",
        config={},
        secret_ciphertext="enc",
        default_approval_posture="ask",
        tool_grants={},
    )
    assert resolve_effective_posture(conn_ask, "unconfigured_tool") == "ask"

    conn_deny = ResolvedConnection(
        connection_id="conn-2",
        org_id="org-1",
        capability=None,
        name="Jira",
        config={},
        secret_ciphertext="enc",
        default_approval_posture="deny",
        tool_grants={},
    )
    assert resolve_effective_posture(conn_deny, "unconfigured_tool") == "deny"

    conn_allow = ResolvedConnection(
        connection_id="conn-3",
        org_id="org-1",
        capability=None,
        name="Jira",
        config={},
        secret_ciphertext="enc",
        default_approval_posture="allow",
        tool_grants={},
    )
    assert resolve_effective_posture(conn_allow, "unconfigured_tool") == "allow"


def test_resolve_effective_posture_safe_defaults_and_fail_closed():
    # Missing tool_name or None connection
    assert resolve_effective_posture(None, "tool_1") == "deny"
    assert resolve_effective_posture(SimpleNamespace(), None) == "deny"
    assert resolve_effective_posture(SimpleNamespace(), "") == "deny"

    # Connection dict support
    conn_dict = {
        "id": "conn-dict",
        "default_approval_posture": "allow",
        "tool_grants": {"action_a": "deny"},
    }
    assert resolve_effective_posture(conn_dict, "action_a") == "deny"
    assert resolve_effective_posture(conn_dict, "action_b") == "allow"

    # Invalid posture value fails closed to deny
    conn_invalid = {
        "id": "conn-bad",
        "default_approval_posture": "invalid_posture",
        "tool_grants": {"action_bad": "malicious_eval"},
    }
    assert resolve_effective_posture(conn_invalid, "action_bad") == "deny"
    assert resolve_effective_posture(conn_invalid, "other_tool") == "deny"


# ═══════════════════════════════════════════════════════════════════════════════
# 2. Gate 5.5 Execution Engine Integration Tests
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_gate55_mcp_explicit_deny_refuses_and_audits():
    conn = ResolvedConnection(
        connection_id="conn-mcp-1",
        org_id="org-1",
        capability=None,
        name="Atlassian MCP",
        config={},
        secret_ciphertext="enc",
        mcp_server_url="https://mcp.atlassian.com/v1",
        default_approval_posture="ask",
        tool_grants={"jira_delete_issue": "deny"},
    )
    phase = SimpleNamespace(
        slug="phase_external",
        phase_index=1,
        config=SimpleNamespace(
            capability=None,
            connection_id="conn-mcp-1",
            tool_name="jira_delete_issue",
            tool_args={"issue_id": "PROJ-123"},
        ),
    )
    mock_audit = AsyncMock()
    ctx = SimpleNamespace(
        org_id="org-1",
        run_id="run-1",
        current_user={"id": "user-1"},
        pool=MagicMock(),
        inputs={},
    )

    with patch("app.services.harness.phase_types.resolve_connection", new_callable=AsyncMock) as mock_res, \
         patch("app.services.harness.phase_types.write_audit", mock_audit), \
         patch("app.services.harness.phase_types.feature_audience", return_value="everyone"):
        mock_res.return_value = conn

        res = await _exec_external_action(phase, {}, ctx)

        assert "failure" in res
        # ⚠ AMENDED by plan 213-06 (GRANT-04 / D-213-16). The old assertion read
        # "permission not granted" — the mechanism-naming voice the sketch replaced. The
        # refusal now names the GRANT that stopped it and the change that would let it
        # through, and the `failure` carries the machine reason rather than prose.
        assert "posture_denied" in res["failure"], res["failure"]
        assert "is set to Deny on this connection" in res["text"], res["text"]
        assert "Set it to Allow or Ask first" in res["text"], res["text"]
        assert "jira_delete_issue" in res["text"]

        # Verify tool_refused audit event
        mock_audit.assert_called_once()
        call_args = mock_audit.call_args
        assert call_args.kwargs["event_type"] == "tool_refused"
        assert call_args.kwargs["metadata"]["tool_name"] == "jira_delete_issue"
        assert call_args.kwargs["metadata"]["connection_id"] == "conn-mcp-1"


from unittest.mock import AsyncMock, MagicMock, PropertyMock, patch


@pytest.mark.asyncio
async def test_gate55_mcp_allow_dispatches_tool_and_writes_sent_receipt():
    conn = ResolvedConnection(
        connection_id="conn-mcp-1",
        org_id="org-1",
        capability=None,
        name="Atlassian MCP",
        config={},
        secret_ciphertext="enc",
        mcp_server_url="https://mcp.atlassian.com/v1",
        default_approval_posture="ask",
        tool_grants={"jira_create_issue": "allow"},
        # ⚠ ADDED at Phase 214 (D-214-00). The MCP arm now projects its argument object onto
        # the bound tool's DECLARED schema through the one accessor, exactly as the native arm
        # and the publish gate do, so a connection with no snapshot has an unknowable argument
        # shape and RECORDS rather than sending. That is the intended refusal — an executor
        # that sends where the gate refuses is the drift pointing the dangerous way — and a
        # real MCP connection always carries the snapshot `discover_tools` wrote. Declaring it
        # here restores this case to a DISPATCH, which is what the test is about; the
        # no-snapshot refusal has its own case in `test_214_args_leaf.py`.
        discovered_tools=[{
            "name": "jira_create_issue",
            "description": "Create a Jira issue",
            "inputSchema": {
                "type": "object",
                "required": ["summary"],
                "properties": {"summary": {"type": "string"}},
            },
        }],
    )
    phase = SimpleNamespace(
        slug="phase_external",
        phase_index=1,
        config=SimpleNamespace(
            capability=None,
            connection_id="conn-mcp-1",
            tool_name="jira_create_issue",
            tool_args={"summary": "New Issue"},
        ),
    )
    mock_audit = AsyncMock()
    ctx = SimpleNamespace(
        org_id="org-1",
        run_id="run-1",
        current_user={"id": "user-1"},
        pool=MagicMock(),
        inputs={},
    )

    with patch("app.services.harness.phase_types.resolve_connection", new_callable=AsyncMock) as mock_res, \
         patch("app.services.mcp_client.call_tool", new_callable=AsyncMock) as mock_call, \
         patch("app.services.harness.phase_types.write_audit", mock_audit), \
         patch("app.services.harness.phase_types.feature_audience", return_value="everyone"), \
         patch.object(ResolvedConnection, "secret", new_callable=PropertyMock, return_value="test-token"):
        mock_res.return_value = conn
        mock_call.return_value = {"text": "Issue created: PROJ-456", "isError": False}

        res = await _exec_external_action(phase, {}, ctx)

        assert res["text"] == "Issue created: PROJ-456"
        assert "failure" not in res
        mock_call.assert_called_once_with(
            "https://mcp.atlassian.com/v1",
            tool_name="jira_create_issue",
            arguments={"summary": "New Issue"},
            secret="test-token",
        )

        # D-213-13 / D-213-14: MCP arm writes external_action_sent with tool_name
        mock_audit.assert_called_once()
        call_args = mock_audit.call_args
        assert call_args.kwargs["event_type"] == "external_action_sent"
        assert call_args.kwargs["metadata"]["capability"] == "mcp"
        assert call_args.kwargs["metadata"]["tool_name"] == "jira_create_issue"
        assert call_args.kwargs["metadata"]["destination_host"] == "https://mcp.atlassian.com/v1"


@pytest.mark.asyncio
async def test_gate55_capability_shape_posture_enforced_sec1():
    """SEC-1 / BUG-260827-02: Native Capability shape MUST be subject to Gate 5.5 posture check."""
    # 1. Denied capability connection
    conn_denied = ResolvedConnection(
        connection_id="conn-slack-1",
        org_id="org-1",
        capability="post_message",
        name="Slack Ops",
        config={"default_channel": "#ops"},
        secret_ciphertext="enc",
        default_approval_posture="deny",
        tool_grants={},
    )
    phase = SimpleNamespace(
        slug="phase_slack",
        phase_index=0,
        config=SimpleNamespace(
            capability="post_message",
            connection_id="conn-slack-1",
        ),
    )
    mock_audit = AsyncMock()
    ctx = SimpleNamespace(
        org_id="org-1",
        run_id="run-1",
        current_user={"id": "user-1"},
        pool=MagicMock(),
        inputs={"content": "Hello Slack"},
    )

    with patch("app.services.harness.phase_types.resolve_connection", new_callable=AsyncMock) as mock_res, \
         patch("app.services.harness.phase_types.get_adapter") as mock_adapter_get, \
         patch("app.services.harness.phase_types.write_audit", mock_audit), \
         patch("app.services.harness.phase_types.feature_audience", return_value="everyone"):
        mock_res.return_value = conn_denied

        res = await _exec_external_action(phase, {}, ctx)

        assert "failure" in res
        # ⚠ AMENDED by plan 213-06 (GRANT-04 / D-213-16), and this drive is the
        # `not_granted` case rather than `posture_denied`: `tool_grants` is EMPTY and the
        # connection default is `deny`, so nobody ever GRANTED this tool rather than
        # someone DENYING it. Asserting the other reason here would quietly erase the very
        # distinction this fixture creates — and D-213-16 exists so the ledger can answer
        # "did a person deny this, or did a setting?".
        assert "not_granted" in res["failure"], res["failure"]
        assert "has never been allowed on this connection" in res["text"], res["text"]
        assert "Set it to Allow or Ask first" in res["text"], res["text"]
        assert "post_message" in res["text"]
        # Adapter send must NEVER be called
        mock_adapter_get.assert_not_called()

        # tool_refused audit event
        mock_audit.assert_called_once()
        assert mock_audit.call_args.kwargs["event_type"] == "tool_refused"
        assert mock_audit.call_args.kwargs["metadata"]["tool_name"] == "post_message"


@pytest.mark.asyncio
async def test_gate55_capability_shape_allow_sends_and_writes_receipt():
    """Allowed capability connection sends and writes external_action_sent with tool_name."""
    conn_allowed = ResolvedConnection(
        connection_id="conn-slack-1",
        org_id="org-1",
        capability="post_message",
        name="Slack Ops",
        config={"default_channel": "#ops"},
        secret_ciphertext="enc",
        default_approval_posture="ask",
        tool_grants={"post_message": "allow"},
    )
    phase = SimpleNamespace(
        slug="phase_slack",
        phase_index=0,
        config=SimpleNamespace(
            capability="post_message",
            connection_id="conn-slack-1",
        ),
    )
    mock_adapter = MagicMock()
    mock_adapter.INPUT_SCHEMA = {"properties": {"channel": {}, "text": {}}}
    mock_adapter.send = AsyncMock(return_value=SimpleNamespace(ok=True, raw_status=200))

    mock_audit = AsyncMock()
    ctx = SimpleNamespace(
        org_id="org-1",
        run_id="run-1",
        current_user={"id": "user-1"},
        pool=MagicMock(),
        inputs={"content": "Hello Slack"},
    )

    with patch("app.services.harness.phase_types.resolve_connection", new_callable=AsyncMock) as mock_res, \
         patch("app.services.harness.phase_types.get_adapter", return_value=mock_adapter), \
         patch("app.services.harness.phase_types.write_audit", mock_audit), \
         patch("app.services.harness.phase_types.feature_audience", return_value="everyone"), \
         patch.object(ResolvedConnection, "secret", new_callable=PropertyMock, return_value="xoxb-test"):
        mock_res.return_value = conn_allowed

        res = await _exec_external_action(phase, {}, ctx)

        assert "failure" not in res
        mock_adapter.send.assert_called_once()

        # external_action_sent audit event carries tool_name
        mock_audit.assert_called_once()
        assert mock_audit.call_args.kwargs["event_type"] == "external_action_sent"
        assert mock_audit.call_args.kwargs["metadata"]["capability"] == "post_message"
        assert mock_audit.call_args.kwargs["metadata"]["tool_name"] == "post_message"
