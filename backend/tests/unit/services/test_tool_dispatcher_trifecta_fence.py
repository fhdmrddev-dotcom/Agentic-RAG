"""Unit tests for TRUST-03 Trifecta Anti-Injection Fence in tool_dispatcher (Phase 234)."""
import asyncio
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4
import pytest

from app.services.tool_dispatcher import ToolContext, _handle_connector_chat_tool


class _MockConn:
    def __init__(self, conn_id, service_id="google", name="Team Drive", org_id="org-123"):
        self.id = conn_id
        self.service_id = service_id
        self.name = name
        self.org_id = org_id
        self.mcp_server_url = None
        self.config = {}
        self.secret = "sec-123"


def _make_ctx(user_id="user-456", org_id="org-123"):
    mock_pubsub = MagicMock()
    mock_pubsub.get_message = AsyncMock(
        return_value={"type": "message", "data": '{"decision": "allow"}'}
    )
    mock_pubsub.subscribe = AsyncMock()
    mock_pubsub.unsubscribe = AsyncMock()
    mock_pubsub.aclose = AsyncMock()

    redis = MagicMock()
    redis.pubsub.return_value = mock_pubsub

    ctx = ToolContext(
        redis=redis,
        run_id=uuid4(),
        thread_id="thread-123",
        supabase=MagicMock(),
        pool=None,
        user_settings=MagicMock(),
        current_user={"id": user_id, "org_id": org_id},
        folder_subtree_ids=None,
        scoped_folder_path=None,
        emit=AsyncMock(),
        spawn=MagicMock(),
        has_connection_retrieval=False,
    )
    ctx.citations = []
    return ctx


@pytest.fixture
def mock_setup(monkeypatch):
    conn_id = uuid4()
    conn = _MockConn(conn_id, service_id="google", name="Team Drive", org_id="org-123")

    mock_scope = MagicMock(ok=True, org_id="org-123")
    monkeypatch.setattr(
        "app.services.connectors.org_scope.resolve_connector_org",
        AsyncMock(return_value=mock_scope),
    )
    monkeypatch.setattr(
        "app.services.connector_service.list_connections",
        AsyncMock(return_value=[conn]),
    )
    monkeypatch.setattr(
        "app.services.tool_dispatcher.write_audit_entry",
        AsyncMock(),
    )
    monkeypatch.setattr(
        "app.services.connector_service.resolve_connection",
        AsyncMock(return_value=MagicMock(secret="sec", config={}, auth_scheme="bearer", mcp_server_url=None)),
    )
    monkeypatch.setattr(
        "app.services.connectors.service_tools.spec_for",
        MagicMock(return_value=MagicMock()),
    )
    return conn


@pytest.mark.asyncio
async def test_trifecta_fence_forces_ask_for_write_tool_when_connection_content_in_context(monkeypatch, mock_setup):
    """TRUST-03: Mutating connector action forced to posture='ask' when connection content is in retrieval context."""
    conn = mock_setup
    ctx = _make_ctx()
    ctx.has_connection_retrieval = True

    monkeypatch.setattr(
        "app.services.connectors.service_tools.tool_facet",
        MagicMock(return_value=("drive", True)),
    )
    monkeypatch.setattr(
        "app.services.connectors.grants.resolve_effective_posture",
        MagicMock(return_value="allow"),
    )
    monkeypatch.setattr(
        "app.services.connectors.service_tools.execute_service_tool",
        AsyncMock(return_value={"status": "uploaded"}),
    )

    res = await _handle_connector_chat_tool(
        service_id="google",
        action_tool_name="upload_file",
        args={"filename": "report.pdf"},
        ctx=ctx,
    )

    # Assert tool_approval_required was emitted despite configured posture being 'allow'
    ctx.emit.assert_awaited_once()
    emit_call = ctx.emit.call_args
    assert emit_call[0][2] == "tool_approval_required"
    emit_kwargs = emit_call[1]
    assert emit_kwargs["tool_name"] == "upload_file"
    assert emit_kwargs["connection_id"] == str(conn.id)


@pytest.mark.asyncio
async def test_trifecta_fence_forces_ask_when_citations_have_source_connection_id(monkeypatch, mock_setup):
    """TRUST-03: Citations containing source_connection_id trigger the fence even if flag was not pre-set."""
    conn = mock_setup
    ctx = _make_ctx()
    ctx.has_connection_retrieval = False
    ctx.citations = [{"document_id": "doc-1", "source_connection_id": "conn-xyz"}]

    monkeypatch.setattr(
        "app.services.connectors.service_tools.tool_facet",
        MagicMock(return_value=("drive", True)),
    )
    monkeypatch.setattr(
        "app.services.connectors.grants.resolve_effective_posture",
        MagicMock(return_value="allow"),
    )
    monkeypatch.setattr(
        "app.services.connectors.service_tools.execute_service_tool",
        AsyncMock(return_value={"status": "uploaded"}),
    )

    res = await _handle_connector_chat_tool(
        service_id="google",
        action_tool_name="upload_file",
        args={"filename": "report.pdf"},
        ctx=ctx,
    )

    ctx.emit.assert_awaited_once()
    emit_call = ctx.emit.call_args
    assert emit_call[0][2] == "tool_approval_required"


@pytest.mark.asyncio
async def test_trifecta_fence_does_not_affect_read_only_tool(monkeypatch, mock_setup):
    """TRUST-03: Read-only actions (is_write=False) retain their configured posture even with connection content in context."""
    conn = mock_setup
    ctx = _make_ctx()
    ctx.has_connection_retrieval = True

    monkeypatch.setattr(
        "app.services.connectors.service_tools.tool_facet",
        MagicMock(return_value=("drive", False)),
    )
    monkeypatch.setattr(
        "app.services.connectors.grants.resolve_effective_posture",
        MagicMock(return_value="allow"),
    )
    mock_exec = AsyncMock(return_value={"files": []})
    monkeypatch.setattr(
        "app.services.connectors.service_tools.execute_service_tool",
        mock_exec,
    )

    res = await _handle_connector_chat_tool(
        service_id="google",
        action_tool_name="list_files",
        args={},
        ctx=ctx,
    )

    # Read-only tool executes directly without requiring approval
    ctx.emit.assert_not_called()
    mock_exec.assert_awaited_once()
    assert "files" in res.result


@pytest.mark.asyncio
async def test_trifecta_fence_does_not_force_ask_when_no_connection_content_in_context(monkeypatch, mock_setup):
    """TRUST-03: Write actions do not require approval when NO connection content was retrieved in context."""
    conn = mock_setup
    ctx = _make_ctx()
    ctx.has_connection_retrieval = False
    ctx.citations = [{"document_id": "doc-1", "source_connection_id": None}]

    monkeypatch.setattr(
        "app.services.connectors.service_tools.tool_facet",
        MagicMock(return_value=("drive", True)),
    )
    monkeypatch.setattr(
        "app.services.connectors.grants.resolve_effective_posture",
        MagicMock(return_value="allow"),
    )
    mock_exec = AsyncMock(return_value={"status": "uploaded"})
    monkeypatch.setattr(
        "app.services.connectors.service_tools.execute_service_tool",
        mock_exec,
    )

    res = await _handle_connector_chat_tool(
        service_id="google",
        action_tool_name="upload_file",
        args={"filename": "report.pdf"},
        ctx=ctx,
    )

    # No connection docs -> configured 'allow' posture preserved
    ctx.emit.assert_not_called()
    mock_exec.assert_awaited_once()
    assert "uploaded" in res.result


@pytest.mark.asyncio
async def test_trifecta_fence_preserves_deny_posture(monkeypatch, mock_setup):
    """TRUST-03: An already-denied write action remains denied and does not loosen to 'ask'."""
    conn = mock_setup
    ctx = _make_ctx()
    ctx.has_connection_retrieval = True

    monkeypatch.setattr(
        "app.services.connectors.service_tools.tool_facet",
        MagicMock(return_value=("drive", True)),
    )
    monkeypatch.setattr(
        "app.services.connectors.grants.resolve_effective_posture",
        MagicMock(return_value="deny"),
    )
    mock_exec = AsyncMock()
    monkeypatch.setattr(
        "app.services.connectors.service_tools.execute_service_tool",
        mock_exec,
    )

    res = await _handle_connector_chat_tool(
        service_id="google",
        action_tool_name="upload_file",
        args={"filename": "report.pdf"},
        ctx=ctx,
    )

    # Deny posture strictly preserved
    ctx.emit.assert_not_called()
    mock_exec.assert_not_called()
    assert "tool_refused" in res.result
