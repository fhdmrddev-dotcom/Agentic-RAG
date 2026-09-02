"""Phase 223 (GRANT-05 / SC#1 / SC#3 / SC#4) — Connector Tool Execution Audit & Recovery Copy.

Verifies:
1. All 5 evaluated action outcomes (policy_denial, user_rejected, timeout, execution_failure, success)
   spawn write_audit_entry with action_type='connector.call', actor attribution, and explicit org_id.
2. Metadata stores arg_keys only, never verbatim argument values (G-6 / SEED-223).
3. Timeout copy truthfully states nobody answered in time, does not claim the connection is healthy,
   and advises against hallucinating workspace panels or re-authorization.
4. Precondition exit with missing user_id does not crash.
"""

import asyncio
from unittest.mock import AsyncMock, MagicMock
from uuid import UUID, uuid4
import pytest


class _MockConn:
    def __init__(self, conn_id, service_id="google", name="Google Drive", org_id="org-123"):
        self.id = conn_id
        self.service_id = service_id
        self.name = name
        self.org_id = org_id
        self.mcp_server_url = None
        self.config = {}
        self.secret = "sec-123"


def _make_ctx(user_id="user-456", org_id="org-123"):
    ctx = MagicMock()
    ctx.current_user = {"id": user_id, "org_id": org_id}
    ctx.supabase = MagicMock()
    ctx.thread_id = "thread-789"
    ctx.run_id = "run-001"
    ctx.redis = MagicMock()
    ctx.emit = AsyncMock()

    spawned = []

    def _spawn(coro):
        spawned.append(coro)

    ctx.spawn.side_effect = _spawn
    ctx._spawned = spawned
    return ctx


@pytest.mark.asyncio
async def test_policy_denial_audited(monkeypatch):
    """Exit 1: posture == 'deny' audits connector.call with outcome='policy_denial'."""
    import app.services.tool_dispatcher as td

    conn_id = uuid4()
    conn = _MockConn(conn_id)

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
        "app.services.connectors.grants.resolve_effective_posture",
        MagicMock(return_value="deny"),
    )

    audit_mock = AsyncMock()
    monkeypatch.setattr(td, "write_audit_entry", audit_mock)

    ctx = _make_ctx()
    args = {"query": "secret document content", "limit": 10}

    res = await td._handle_connector_chat_tool(
        service_id="google",
        action_tool_name="search_files",
        args=args,
        ctx=ctx,
    )

    assert "tool_refused" in res.result
    # Run spawned coros
    for coro in ctx._spawned:
        await coro

    assert audit_mock.await_count == 1
    call_kwargs = audit_mock.await_args.kwargs
    assert call_kwargs["action_type"] == "connector.call"
    assert call_kwargs["user_id"] == "user-456"
    assert call_kwargs["org_id"] == "org-123"
    meta = call_kwargs["metadata"]
    assert meta["outcome"] == "policy_denial"
    assert meta["failure_reason"] == "Denied by tool posture policy"
    assert meta["arg_keys"] == ["query", "limit"]
    # Verify raw args are NOT leaked
    assert "secret document content" not in str(meta)


@pytest.mark.asyncio
async def test_user_rejected_audited_and_copy(monkeypatch):
    """Exit 2: User rejection audits outcome='user_rejected' with actionable recovery string."""
    import app.services.tool_dispatcher as td

    conn_id = uuid4()
    conn = _MockConn(conn_id)

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
        "app.services.connectors.grants.resolve_effective_posture",
        MagicMock(return_value="ask"),
    )

    audit_mock = AsyncMock()
    monkeypatch.setattr(td, "write_audit_entry", audit_mock)

    ctx = _make_ctx()
    # Mock pubsub decision returning 'deny'
    mock_pubsub = MagicMock()
    mock_pubsub.subscribe = AsyncMock()
    mock_pubsub.unsubscribe = AsyncMock()
    mock_pubsub.aclose = AsyncMock()
    ctx.redis.pubsub.return_value = mock_pubsub

    # Mock decision payload with decision != "allow"
    async def _mock_wait_for(coro, timeout):
        # cancel coro and return rejection
        if hasattr(coro, "close"):
            coro.close()
        return {"decision": "deny"}

    monkeypatch.setattr(asyncio, "wait_for", _mock_wait_for)

    res = await td._handle_connector_chat_tool(
        service_id="google",
        action_tool_name="delete_file",
        args={"file_id": "123"},
        ctx=ctx,
    )

    assert '"status": "rejected"' in res.result
    assert "Do not retry this action unless explicitly requested by the user" in res.result

    for coro in ctx._spawned:
        await coro

    assert audit_mock.await_count == 1
    meta = audit_mock.await_args.kwargs["metadata"]
    assert meta["outcome"] == "user_rejected"
    assert meta["failure_reason"] == "User rejected execution"


@pytest.mark.asyncio
async def test_timeout_audited_and_truthful_copy(monkeypatch):
    """Exit 3: Timeout audits outcome='timeout' with truthful text omitting health claim."""
    import app.services.tool_dispatcher as td

    conn_id = uuid4()
    conn = _MockConn(conn_id)

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
        "app.services.connectors.grants.resolve_effective_posture",
        MagicMock(return_value="ask"),
    )

    audit_mock = AsyncMock()
    monkeypatch.setattr(td, "write_audit_entry", audit_mock)

    ctx = _make_ctx()
    mock_pubsub = MagicMock()
    mock_pubsub.subscribe = AsyncMock()
    mock_pubsub.unsubscribe = AsyncMock()
    mock_pubsub.aclose = AsyncMock()
    ctx.redis.pubsub.return_value = mock_pubsub

    async def _mock_wait_for(coro, timeout):
        if hasattr(coro, "close"):
            coro.close()
        raise asyncio.TimeoutError()

    monkeypatch.setattr(asyncio, "wait_for", _mock_wait_for)

    res = await td._handle_connector_chat_tool(
        service_id="google",
        action_tool_name="create_file",
        args={"filename": "test.txt"},
        ctx=ctx,
    )

    assert '"status": "timeout"' in res.result
    # Check truthful recovery instructions
    assert "Nobody answered in time." in res.result
    assert "Do not advise the user to check a workspace panel or re-authenticate" in res.result
    # Verify unverified health reassurance was EXCLUDED
    assert "The connection remains connected and healthy" not in res.result

    for coro in ctx._spawned:
        await coro

    assert audit_mock.await_count == 1
    meta = audit_mock.await_args.kwargs["metadata"]
    assert meta["outcome"] == "timeout"
    assert meta["failure_reason"] == "Approval request timed out after 120s"


@pytest.mark.asyncio
async def test_execution_failure_audited(monkeypatch):
    """Exit 4: Execution failure audits outcome='execution_failure'."""
    import app.services.tool_dispatcher as td
    from app.services.connectors.service_tools import ServiceToolError

    conn_id = uuid4()
    conn = _MockConn(conn_id)

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
        "app.services.connectors.grants.resolve_effective_posture",
        MagicMock(return_value="allow"),
    )

    resolved_conn = MagicMock(secret="sec", config={}, auth_scheme="bearer")
    monkeypatch.setattr(
        "app.services.connector_service.resolve_connection",
        AsyncMock(return_value=resolved_conn),
    )
    monkeypatch.setattr(
        "app.services.connectors.service_tools.spec_for",
        MagicMock(return_value=MagicMock()),
    )
    monkeypatch.setattr(
        "app.services.connectors.service_tools.execute_service_tool",
        AsyncMock(side_effect=ServiceToolError("403 Forbidden: rate limited")),
    )

    audit_mock = AsyncMock()
    monkeypatch.setattr(td, "write_audit_entry", audit_mock)

    ctx = _make_ctx()
    res = await td._handle_connector_chat_tool(
        service_id="google",
        action_tool_name="upload_file",
        args={"file_path": "/tmp/a.pdf"},
        ctx=ctx,
    )

    assert "tool_failed" in res.result
    assert "403 Forbidden: rate limited" in res.result

    for coro in ctx._spawned:
        await coro

    assert audit_mock.await_count == 1
    meta = audit_mock.await_args.kwargs["metadata"]
    assert meta["outcome"] == "execution_failure"
    assert "403 Forbidden: rate limited" in meta["failure_reason"]


@pytest.mark.asyncio
async def test_success_audited(monkeypatch):
    """Exit 5: Successful tool execution audits outcome='success'."""
    import app.services.tool_dispatcher as td

    conn_id = uuid4()
    conn = _MockConn(conn_id)

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
        "app.services.connectors.grants.resolve_effective_posture",
        MagicMock(return_value="allow"),
    )

    resolved_conn = MagicMock(secret="sec", config={}, auth_scheme="bearer")
    monkeypatch.setattr(
        "app.services.connector_service.resolve_connection",
        AsyncMock(return_value=resolved_conn),
    )
    monkeypatch.setattr(
        "app.services.connectors.service_tools.spec_for",
        MagicMock(return_value=MagicMock()),
    )
    monkeypatch.setattr(
        "app.services.connectors.service_tools.execute_service_tool",
        AsyncMock(return_value={"status": "uploaded", "id": "file-999"}),
    )

    audit_mock = AsyncMock()
    monkeypatch.setattr(td, "write_audit_entry", audit_mock)

    ctx = _make_ctx()
    res = await td._handle_connector_chat_tool(
        service_id="google",
        action_tool_name="upload_file",
        args={"filename": "doc.pdf"},
        ctx=ctx,
    )

    assert '<external_tool_result service="Google Drive" tool="upload_file">' in res.result
    assert '"status": "uploaded"' in res.result

    for coro in ctx._spawned:
        await coro

    assert audit_mock.await_count == 1
    meta = audit_mock.await_args.kwargs["metadata"]
    assert meta["outcome"] == "success"
    assert meta["failure_reason"] is None
    assert meta["arg_keys"] == ["filename"]


@pytest.mark.asyncio
async def test_missing_user_id_does_not_crash():
    """Precondition: missing user_id returns error without attempting unauditable DB write."""
    import app.services.tool_dispatcher as td

    ctx = MagicMock()
    ctx.current_user = None

    res = await td._handle_connector_chat_tool(
        service_id="google",
        action_tool_name="search",
        args={},
        ctx=ctx,
    )

    assert "no authenticated user in context" in res.result
