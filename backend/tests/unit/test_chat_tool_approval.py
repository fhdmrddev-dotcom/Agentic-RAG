"""Tests for Phase 216 Plan 02: Tool Approval Pause & SSE Stream Handling."""

import asyncio
import json
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from app.models.connector import ConnectorConnectionResponse, PostMessageConfig
from app.services.tool_dispatcher import ToolContext, _handle_connector_chat_tool


@pytest.mark.asyncio
async def test_tool_approval_deny_returns_refused():
    user_id = str(uuid4())
    mock_conn = ConnectorConnectionResponse(
        id=str(uuid4()),
        org_id=str(uuid4()),
        name="Slack Ops",
        service_id="slack",
        capability="post_message",
        config=PostMessageConfig(default_channel="general"),
        default_approval_posture="deny",
        tool_grants={"post_message": "deny"},
        created_at="2026-08-30T00:00:00Z",
        updated_at="2026-08-30T00:00:00Z",
    )

    ctx = ToolContext(
        redis=None,
        run_id=uuid4(),
        thread_id=str(uuid4()),
        supabase=MagicMock(),
        pool=None,
        user_settings=MagicMock(),
        current_user={"id": user_id},
        folder_subtree_ids=None,
        scoped_folder_path=None,
        emit=AsyncMock(),
        spawn=MagicMock(),
    )

    with pytest.MonkeyPatch.context() as mp:
        mp.setattr(
            "app.services.connector_service.list_connections",
            AsyncMock(return_value=[mock_conn]),
        )
        res = await _handle_connector_chat_tool(
            "slack",
            "post_message",
            {"message": "Deploying to prod"},
            ctx,
        )

        assert "tool_refused" in res.result
        assert "denied by policy" in res.result


@pytest.mark.asyncio
async def test_tool_approval_ask_emits_event_and_pauses():
    user_id = str(uuid4())
    thread_id = str(uuid4())
    mock_conn = ConnectorConnectionResponse(
        id=str(uuid4()),
        org_id=str(uuid4()),
        name="Slack Ops",
        service_id="slack",
        capability="post_message",
        config=PostMessageConfig(default_channel="general"),
        default_approval_posture="ask",
        tool_grants={"post_message": "ask"},
        created_at="2026-08-30T00:00:00Z",
        updated_at="2026-08-30T00:00:00Z",
    )

    mock_redis = MagicMock()
    mock_redis.publish = AsyncMock()
    mock_pubsub = MagicMock()
    mock_redis.pubsub = MagicMock(return_value=mock_pubsub)
    mock_pubsub.subscribe = AsyncMock()
    mock_pubsub.unsubscribe = AsyncMock()
    mock_pubsub.aclose = AsyncMock()

    # Simulate user sending an "allow" decision via Redis pub/sub
    mock_pubsub.get_message = AsyncMock(
        return_value={
            "type": "message",
            "data": json.dumps({"decision": "allow", "call_id": "call_123"}),
        }
    )

    mock_emit = AsyncMock()
    ctx = ToolContext(
        redis=mock_redis,
        run_id=uuid4(),
        thread_id=thread_id,
        supabase=MagicMock(),
        pool=None,
        user_settings=MagicMock(),
        current_user={"id": user_id},
        folder_subtree_ids=None,
        scoped_folder_path=None,
        emit=mock_emit,
        spawn=MagicMock(),
        tool_call_id="call_123",
    )

    with pytest.MonkeyPatch.context() as mp:
        mp.setattr(
            "app.services.connector_service.list_connections",
            AsyncMock(return_value=[mock_conn]),
        )
        mp.setattr(
            "app.services.connectors.registry.get_adapter",
            lambda cap: MagicMock(send=AsyncMock(return_value={"ok": True})),
        )

        res = await _handle_connector_chat_tool(
            "slack",
            "post_message",
            {"message": "Deploying to prod"},
            ctx,
        )

        # Assert approval event was emitted
        mock_emit.assert_called_once()
        call_kwargs = mock_emit.call_args.kwargs
        assert call_kwargs["call_id"] == "call_123"
        assert call_kwargs["service_name"] == "Slack Ops"
        assert call_kwargs["tool_name"] == "post_message"

        # Assert result was returned after allow decision
        assert "<external_tool_result" in res.result
        assert "Slack Ops" in res.result
