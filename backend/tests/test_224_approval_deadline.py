"""Phase 224 Plan 02 (BUG-260902-04 / D-224-01) — Approval Wire Deadline & Single Timeout Source.

Verifies:
1. _APPROVAL_TIMEOUT_SECONDS is imported directly from tool_dispatcher and serves as the single authority.
2. When posture == 'ask', ctx.emit('tool_approval_required', ...) includes:
   - timeout_seconds == _APPROVAL_TIMEOUT_SECONDS
   - expires_at as a valid ISO 8601 UTC timestamp derived from _APPROVAL_TIMEOUT_SECONDS
3. Zero divergence between server pause timeout, audit copy, and wire emission.
"""

import asyncio
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4
import pytest

from app.services.tool_dispatcher import _APPROVAL_TIMEOUT_SECONDS, dispatch_tool, ToolContext


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
    ctx.tool_call_id = "call-123"
    ctx.redis = MagicMock()
    ctx.emit = AsyncMock()
    ctx.pool = None

    spawned = []
    ctx.spawn = MagicMock(side_effect=lambda coro: spawned.append(coro))
    ctx._spawned = spawned
    return ctx


@pytest.mark.asyncio
async def test_tool_approval_wire_deadline_and_timeout(monkeypatch):
    """posture == 'ask' emits expires_at and timeout_seconds derived from _APPROVAL_TIMEOUT_SECONDS."""
    import app.services.tool_dispatcher as td

    conn_id = uuid4()
    conn = _MockConn(conn_id, service_id="google", name="Google Drive")

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
    monkeypatch.setattr("app.services.tool_dispatcher.write_audit_entry", audit_mock)

    ctx = _make_ctx()

    # Mock pubsub to return decision='allow'
    mock_pubsub = MagicMock()
    mock_pubsub.subscribe = AsyncMock()
    mock_pubsub.unsubscribe = AsyncMock()
    mock_pubsub.aclose = AsyncMock()

    # Return allow decision on first get_message call
    mock_pubsub.get_message = AsyncMock(
        return_value={"type": "message", "data": '{"decision": "allow"}'}
    )
    ctx.redis.pubsub.return_value = mock_pubsub

    # Mock connection resolution and service tool execution for allow branch
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
        AsyncMock(return_value={"files": []}),
    )

    t0 = datetime.now(timezone.utc)
    result = await td._handle_connector_chat_tool(
        service_id="google",
        action_tool_name="list_files",
        args={},
        ctx=ctx,
    )
    t1 = datetime.now(timezone.utc)

    # 1. Assert emit was called with 'tool_approval_required'
    emit_calls = [c for c in ctx.emit.call_args_list if c.args[2] == "tool_approval_required"]
    assert len(emit_calls) == 1, f"Expected 1 tool_approval_required emit, got {len(emit_calls)}"

    emit_kwargs = emit_calls[0].kwargs

    # 2. Assert timeout_seconds matches imported _APPROVAL_TIMEOUT_SECONDS exactly (single source of truth)
    assert "timeout_seconds" in emit_kwargs, "timeout_seconds must be present in emitted event kwargs"
    assert emit_kwargs["timeout_seconds"] == _APPROVAL_TIMEOUT_SECONDS, (
        f"Emitted timeout_seconds ({emit_kwargs['timeout_seconds']}) must match "
        f"module authority _APPROVAL_TIMEOUT_SECONDS ({_APPROVAL_TIMEOUT_SECONDS})"
    )

    # 3. Assert expires_at is ISO 8601 UTC string within bounds of _APPROVAL_TIMEOUT_SECONDS
    assert "expires_at" in emit_kwargs, "expires_at must be present in emitted event kwargs"
    expires_at_str = emit_kwargs["expires_at"]
    expires_at_dt = datetime.fromisoformat(expires_at_str)

    assert expires_at_dt.tzinfo is not None, "expires_at must include timezone"
    duration_from_t0 = (expires_at_dt - t0).total_seconds()
    duration_from_t1 = (expires_at_dt - t1).total_seconds()

    # The computed deadline must be within 1.0s of now + _APPROVAL_TIMEOUT_SECONDS
    assert (
        _APPROVAL_TIMEOUT_SECONDS - 1.0 <= duration_from_t0 <= _APPROVAL_TIMEOUT_SECONDS + 1.0
    ), f"expires_at duration ({duration_from_t0}) drifted from _APPROVAL_TIMEOUT_SECONDS ({_APPROVAL_TIMEOUT_SECONDS})"

    assert result is not None
    assert result.result is not None
    assert "error" not in result.result


@pytest.mark.asyncio
async def test_tool_approval_timeout_uses_constant(monkeypatch):
    """TimeoutError branch in dispatcher consumes _APPROVAL_TIMEOUT_SECONDS for audit record."""
    import app.services.tool_dispatcher as td

    conn_id = uuid4()
    conn = _MockConn(conn_id, service_id="google", name="Google Drive")

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
    monkeypatch.setattr("app.services.tool_dispatcher.write_audit_entry", audit_mock)

    ctx = _make_ctx()

    # Mock pubsub that times out
    mock_pubsub = MagicMock()
    mock_pubsub.subscribe = AsyncMock()
    mock_pubsub.unsubscribe = AsyncMock()
    mock_pubsub.aclose = AsyncMock()

    # Force wait_for to raise TimeoutError immediately
    async def _mock_wait_for(coro, timeout):
        if hasattr(coro, "close"):
            coro.close()
        # Assert that wait_for is called with the module constant, not an arbitrary literal
        assert timeout == _APPROVAL_TIMEOUT_SECONDS, (
            f"wait_for timeout ({timeout}) must equal _APPROVAL_TIMEOUT_SECONDS ({_APPROVAL_TIMEOUT_SECONDS})"
        )
        raise asyncio.TimeoutError()

    monkeypatch.setattr("asyncio.wait_for", _mock_wait_for)
    ctx.redis.pubsub.return_value = mock_pubsub

    result = await td._handle_connector_chat_tool(
        service_id="google",
        action_tool_name="list_files",
        args={},
        ctx=ctx,
    )

    # Assert timeout result
    assert "timed out waiting for human approval" in result.result

    # Run spawned audit coroutines
    for coro in ctx._spawned:
        await coro

    # Verify audit mock called with 'timeout' and string referencing _APPROVAL_TIMEOUT_SECONDS
    audit_calls = [c for c in audit_mock.call_args_list if c.kwargs.get("action_type") == "connector.call"]
    assert len(audit_calls) == 1
    timeout_audit = audit_calls[0]
    assert timeout_audit.kwargs["metadata"]["outcome"] == "timeout"
    assert f"{int(_APPROVAL_TIMEOUT_SECONDS)}s" in timeout_audit.kwargs["metadata"]["failure_reason"]
