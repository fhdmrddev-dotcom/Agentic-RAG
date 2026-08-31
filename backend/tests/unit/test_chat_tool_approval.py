"""Tests for Phase 216 Plan 02: Tool Approval Pause & SSE Stream Handling."""

import asyncio
import json
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

from types import SimpleNamespace

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
        # ⚠ `resolve_connection` MUST BE MOCKED, and its absence used to be INVISIBLE.
        # The dispatcher resolves the connection before it sends — that call is the
        # org-scoping gate and the credential read — so without this the test reached a
        # real network and failed at DNS. It passed anyway, because the handler caught
        # every exception and answered "Executed post_message on Slack Ops with
        # result/note: …" inside the untrusted-content envelope. The assertion below
        # then found `<external_tool_result` in a sentence describing a FAILURE.
        mp.setattr(
            "app.services.connector_service.resolve_connection",
            AsyncMock(return_value=SimpleNamespace(
                connection_id=str(mock_conn.id),
                org_id=str(mock_conn.org_id),
                capability="post_message",
                service_id="slack",
                config={"default_channel": "#ops"},
                secret="xoxb-test",
                mcp_server_url=None,
            )),
        )
        mp.setattr(
            "app.services.connectors.registry.get_adapter",
            lambda cap: SimpleNamespace(
                INPUT_SCHEMA={"properties": {"text": {"type": "string"}}},
                send=AsyncMock(return_value=SimpleNamespace(
                    ok=True, provider_message="", detail="posted to #ops",
                )),
            ),
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

        # Assert result was returned after allow decision.
        # ⚠ THE SECOND LINE IS THE ONE THAT MATTERS AND IT IS NEW. The envelope alone
        # proves nothing: the shipped handler wrapped its own FAILURES in it too, so this
        # assertion was satisfied by a send that never left the process. `ok=True` from
        # the adapter is now the only thing that produces a wrapped result.
        assert "<external_tool_result" in res.result
        assert "Slack Ops" in res.result
        assert "tool_failed" not in res.result
        assert "posted to #ops" in res.result
