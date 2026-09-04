"""Phase 223 (GRANT-05 / SC#1a / SC#3 / SC#4) — Permanent Grant Audit Receipts.

Verifies:
1. handle_tool_approval with decision='always' calls connector_service.grant_one_tool
   AND writes audit_log with action_type='connector.grant', source='chat_card', and actor user_id.
2. update_grants in connectors.py calls connector_service.update_connection_grants
   AND writes audit_log with action_type='connector.grant', source='settings', and actor user_id.
3. Decision 'allow' (once) does NOT write a grant audit record.
"""

from unittest.mock import AsyncMock, MagicMock
from uuid import UUID, uuid4
import pytest
from app.models.thread import ToolApprovalDecisionRequest


@pytest.mark.asyncio
async def test_chat_card_always_allow_audits_grant(monkeypatch):
    """Decision 'always' persists grant and writes connector.grant audit log with source='chat_card'."""
    import app.api.threads as threads_api

    conn_id = uuid4()
    thread_id = uuid4()
    user_id = str(uuid4())
    org_id = str(uuid4())

    mock_scope = MagicMock(ok=True, org_id=org_id)
    monkeypatch.setattr(
        "app.services.connectors.org_scope.resolve_connector_org",
        AsyncMock(return_value=mock_scope),
    )
    monkeypatch.setattr(
        "app.dependencies._has_org_permission",
        AsyncMock(return_value=True),
    )
    grant_one_mock = AsyncMock(return_value=MagicMock())
    monkeypatch.setattr(
        "app.services.connector_service.grant_one_tool",
        grant_one_mock,
    )
    audit_mock = AsyncMock()
    monkeypatch.setattr(threads_api, "write_audit_entry", audit_mock)

    mock_redis = MagicMock()
    mock_redis.publish = AsyncMock(return_value=1)

    payload = ToolApprovalDecisionRequest(
        call_id="call-123",
        decision="always",
        connection_id=conn_id,
        tool_name="create_channel",
    )
    request = MagicMock()
    current_user = {"id": user_id, "org_id": org_id}
    supabase = MagicMock()

    res = await threads_api.handle_tool_approval(
        thread_id=thread_id,
        payload=payload,
        request=request,
        current_user=current_user,
        redis=mock_redis,
        supabase=supabase,
    )

    assert res["status"] == "ok"
    assert res["decision"] == "always"
    assert res["grant_persisted"] is True

    # Assert grant_one_tool called
    grant_one_mock.assert_awaited_once_with(
        str(conn_id),
        org_id=org_id,
        tool_name="create_channel",
        posture="allow",
        supabase=supabase,
    )

    # Assert audit row written
    audit_mock.assert_awaited_once()
    kwargs = audit_mock.await_args.kwargs
    assert kwargs["action_type"] == "connector.grant"
    assert kwargs["user_id"] == user_id
    assert kwargs["org_id"] == org_id
    assert kwargs["metadata"] == {
        "connection_id": str(conn_id),
        "tool_name": "create_channel",
        "posture": "allow",
        "source": "chat_card",
    }


@pytest.mark.asyncio
async def test_chat_card_allow_once_does_not_audit_grant(monkeypatch):
    """Decision 'allow' (once) does NOT mutate grants or write connector.grant audit log."""
    import app.api.threads as threads_api

    thread_id = uuid4()
    user_id = str(uuid4())
    org_id = str(uuid4())

    grant_one_mock = AsyncMock()
    monkeypatch.setattr("app.services.connector_service.grant_one_tool", grant_one_mock)
    audit_mock = AsyncMock()
    monkeypatch.setattr(threads_api, "write_audit_entry", audit_mock)

    mock_redis = MagicMock()
    mock_redis.publish = AsyncMock(return_value=1)

    payload = ToolApprovalDecisionRequest(
        call_id="call-456",
        decision="allow",
    )
    request = MagicMock()
    current_user = {"id": user_id, "org_id": org_id}
    supabase = MagicMock()

    res = await threads_api.handle_tool_approval(
        thread_id=thread_id,
        payload=payload,
        request=request,
        current_user=current_user,
        redis=mock_redis,
        supabase=supabase,
    )

    assert res["status"] == "ok"
    assert res["decision"] == "allow"
    grant_one_mock.assert_not_awaited()
    audit_mock.assert_not_awaited()


@pytest.mark.asyncio
async def test_settings_update_grants_audits_grant(monkeypatch):
    """Settings update_grants endpoint persists map and writes connector.grant audit log with source='settings'."""
    import app.api.connectors as connectors_api

    conn_id = str(uuid4())
    user_id = str(uuid4())
    org_id = str(uuid4())

    updated_conn = MagicMock()
    update_mock = AsyncMock(return_value=updated_conn)
    monkeypatch.setattr(
        "app.services.connector_service.update_connection_grants",
        update_mock,
    )
    audit_mock = AsyncMock()
    monkeypatch.setattr(connectors_api, "write_audit_entry", audit_mock)

    tool_grants = {"read_inbox": "allow", "send_mail": "ask"}
    user = {"id": user_id, "org_id": org_id}
    supabase = MagicMock()

    res = await connectors_api.update_grants(
        connection_id=conn_id,
        tool_grants=tool_grants,
        active_org=org_id,
        user=user,
        supabase=supabase,
    )

    assert res == updated_conn
    update_mock.assert_awaited_once_with(
        conn_id,
        org_id=org_id,
        tool_grants=tool_grants,
        supabase=supabase,
    )

    audit_mock.assert_awaited_once()
    kwargs = audit_mock.await_args.kwargs
    assert kwargs["action_type"] == "connector.grant"
    assert kwargs["user_id"] == user_id
    assert kwargs["org_id"] == org_id
    assert kwargs["metadata"] == {
        "connection_id": conn_id,
        "source": "settings",
        "tool_count": 2,
        "tool_grants": {"read_inbox": "allow", "send_mail": "ask"},
    }
