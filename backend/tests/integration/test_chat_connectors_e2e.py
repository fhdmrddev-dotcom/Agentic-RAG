import json
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4
from types import SimpleNamespace

import pytest

from app.models.connector import (
    ConnectorConnectionResponse,
    PostMessageConfig,
)
from app.services.connectors.chat_tools import (
    build_chat_tools_for_connectors,
    parse_chat_tool_call_name,
)
from app.services.tool_dispatcher import (
    ToolContext,
    dispatch_tool,
)
from app.services.sources.import_service import list_cloud_files, fetch_cloud_file


@pytest.mark.asyncio
async def test_e2e_chat_connector_flow():
    """End-to-end simulation of connector tool discovery, dispatch, approval pause/resume, and prompt injection defense."""
    conn_id = str(uuid4())
    org_id = str(uuid4())
    user_id = str(uuid4())
    thread_id = str(uuid4())

    mock_conn = ConnectorConnectionResponse(
        id=conn_id,
        org_id=org_id,
        name="Slack Operations",
        service_id="slack",
        capability="post_message",
        is_enabled=True,
        config=PostMessageConfig(default_channel="ops"),
        default_approval_posture="ask",
        tool_grants={"post_message": "ask"},
        discovered_tools=[
            {
                "name": "post_message",
                "description": "Post a message to a team channel",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "message": {"type": "string", "description": "The message body"}
                    },
                    "required": ["message"],
                },
            }
        ],
        created_at="2026-08-30T00:00:00Z",
        updated_at="2026-08-30T00:00:00Z",
    )

    # 1. Chat tool discovery for active connector
    chat_tools = build_chat_tools_for_connectors([mock_conn])
    assert len(chat_tools) == 1
    assert chat_tools[0]["type"] == "function"
    assert chat_tools[0]["function"]["name"] == "slack__post_message"

    # 2. Tool name parsing
    parsed = parse_chat_tool_call_name("slack__post_message")
    assert parsed == ("slack", "post_message")

    # 3. Setup Redis and pub/sub for tool approval simulation
    mock_redis = MagicMock()
    mock_redis.publish = AsyncMock()
    mock_pubsub = MagicMock()
    mock_redis.pubsub = MagicMock(return_value=mock_pubsub)
    mock_pubsub.subscribe = AsyncMock()
    mock_pubsub.unsubscribe = AsyncMock()
    mock_pubsub.aclose = AsyncMock()

    mock_pubsub.get_message = AsyncMock(
        return_value={
            "type": "message",
            "data": json.dumps({"decision": "allow", "call_id": "call_9988"}),
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
        tool_call_id="call_9988",
    )

    # THIS BLOCK USED TO MOCK NEITHER `resolve_connection` NOR THE ADAPTER CONTRACT,
    # AND THE TEST PASSED ANYWAY - which is the finding, not the fix. The send reached a
    # real DNS lookup, failed, and the handler answered "Executed post_message on Slack
    # Operations with result/note: [Errno 11001] getaddrinfo failed" INSIDE the untrusted
    # envelope. Both assertions below were satisfied by a call that never left the
    # process, so the one test named as this feature end-to-end proof was green on a
    # path that had never once worked.
    resolved = SimpleNamespace(
        connection_id=str(mock_conn.id),
        org_id=str(mock_conn.org_id),
        capability="post_message",
        service_id="slack",
        config={"default_channel": "#ops"},
        secret="xoxb-test",
        mcp_server_url=None,
    )
    adapter = SimpleNamespace(
        INPUT_SCHEMA={"properties": {"text": {"type": "string"}}},
        send=AsyncMock(return_value=SimpleNamespace(
            ok=True, provider_message="", detail="posted to #ops",
        )),
    )
    with patch("app.services.connector_service.list_connections", AsyncMock(return_value=[mock_conn])), \
         patch("app.services.connector_service.resolve_connection", AsyncMock(return_value=resolved)), \
         patch("app.services.connectors.registry.get_adapter", lambda cap: adapter):

        res = await dispatch_tool(
            "slack__post_message",
            {"message": "Deploying release v3.9"},
            ctx,
        )

    # 4. SSE event emitted and untrusted output security envelope verified
    mock_emit.assert_called_once()
    assert mock_emit.call_args[0][2] == "tool_approval_required"
    assert '<external_tool_result service="Slack Operations" tool="post_message">' in res.result
    assert "untrusted external data retrieved from Slack Operations" in res.result
    # The envelope alone is not evidence of a send. The adapter OWN verdict is.
    assert "tool_failed" not in res.result
    adapter.send.assert_awaited_once()


@pytest.mark.asyncio
async def test_a_refused_send_reads_as_a_refusal_not_as_a_completed_action():
    """THE FENCE FOR THE DEFECT THE TEST ABOVE WAS HIDING.

    Slack answers HTTP 200 with ``{"ok": false}`` for a message nobody received, and the
    adapter turns that into ``ok=False`` with the vendor own words. The chat dispatcher
    used to render every such outcome - and every exception - as "Executed post_message
    on ...", so a model was told the message had been posted and told the person so in
    turn.

    ``phase_types.py`` already states the rule for the canvas: only the adapter own
    verdict produces ``completed``. Chat must not disagree with the canvas about the same
    send, which is what this pins.
    """
    from app.services.tool_dispatcher import _handle_connector_chat_tool

    conn_id = uuid4()
    org_id = uuid4()
    user_id = str(uuid4())
    conn = SimpleNamespace(
        id=conn_id, org_id=org_id, name="Slack Operations", service_id="slack",
        capability="post_message", is_enabled=True, mcp_server_url=None,
        discovered_tools=[{"name": "post_message"}],
        tool_grants={"post_message": "allow"}, default_approval_posture="allow",
    )
    resolved = SimpleNamespace(
        connection_id=str(conn_id), org_id=str(org_id), capability="post_message",
        service_id="slack", config={"default_channel": "#ops"}, secret="xoxb-test",
        mcp_server_url=None,
    )
    refused = SimpleNamespace(
        ok=False, provider_message="channel_not_found", detail="nothing was posted",
    )
    ctx = ToolContext(
        redis=None, run_id=uuid4(), thread_id=str(uuid4()), supabase=MagicMock(),
        pool=None, user_settings=MagicMock(), current_user={"id": user_id},
        folder_subtree_ids=None, scoped_folder_path=None, emit=AsyncMock(),
        spawn=MagicMock(), tool_call_id="call_refused",
    )

    with patch("app.services.connector_service.list_connections", AsyncMock(return_value=[conn])), \
         patch("app.services.connector_service.resolve_connection", AsyncMock(return_value=resolved)), \
         patch("app.services.connectors.registry.get_adapter", lambda cap: SimpleNamespace(
             INPUT_SCHEMA={"properties": {"text": {"type": "string"}}},
             send=AsyncMock(return_value=refused),
         )):
        res = await _handle_connector_chat_tool("slack", "post_message", {"text": "hi"}, ctx)

    payload = json.loads(res.result)
    assert payload["error"] == "tool_failed"
    assert "was NOT performed" in payload["message"]
    assert "channel_not_found" in payload["message"]
    # The refusal is OURS, so it must NOT wear the untrusted-content envelope - teaching
    # a model to distrust our own sentences is how it learns to ignore them.
    assert "<external_tool_result" not in res.result
    # The exact word the shipped defect used. Its absence is the regression pin.
    assert "Executed" not in res.result


@pytest.mark.asyncio
async def test_e2e_cloud_file_import_flow():
    """End-to-end simulation of single-file cloud storage browsing and document ingestion."""
    conn_id = str(uuid4())
    mock_conn = {
        "id": conn_id,
        "service_id": "google_drive",
        "name": "Corporate Google Drive",
    }

    # ⚠ THE SEAM MOVED FROM httpx TO THE EGRESS BINDER, AND THAT IS THE FIX BEING TESTED.
    # `cloud_storage` used to open a RAW `httpx.AsyncClient` against googleapis.com — no
    # scheme check, no allow-list, no DNS pin, no redirect refusal, no size cap — on a path
    # that downloads a file a caller names. It sits outside `services/connectors/`, so the
    # D-05 source fence never walked it and the gap was invisible to the guard written for
    # exactly this. It now goes through `send_pinned_http` under the `drive_read` key.
    #
    # ⚠ A PinnedResponse carries `.body` (bytes) — not `.json()`, not `.content`.
    def _pinned(status, body):
        return SimpleNamespace(status_code=status, body=body)

    mock_list_response = _pinned(200, json.dumps({
        "files": [
            {
                "id": "g-file-1",
                "name": "Q3_Report.pdf",
                "mimeType": "application/pdf",
                "size": "10240",
                "modifiedTime": "2026-08-30T12:00:00Z",
            }
        ],
        "nextPageToken": None,
    }))

    mock_meta_response = _pinned(200, json.dumps({
        "id": "g-file-1",
        "name": "Q3_Report.pdf",
        "mimeType": "application/pdf",
        "size": "10240",
    }))

    mock_dl_response = _pinned(200, b"%PDF-1.4 Mock PDF Content")

    async def mock_send(capability, method, url, **kwargs):
        # The key is asserted, not ignored: reaching Google under any OTHER capability would
        # be reaching it under an allow-list that does not name googleapis.com.
        assert capability == "drive_read", capability
        url_str = str(url)
        params = kwargs.get("params") or {}
        if url_str.endswith("/files"):
            return mock_list_response
        if params.get("alt") == "media":
            return mock_dl_response
        if url_str.endswith("/files/g-file-1"):
            return mock_meta_response
        return mock_dl_response

    with patch("app.services.sources.adapters.google_drive.get_fresh_access_token", AsyncMock(return_value="valid-oauth-token")), \
         patch("app.services.sources.adapters.google_drive.send_pinned_http", side_effect=mock_send):

        # 1. Listing files
        res = await list_cloud_files(
            connection=mock_conn,
            query="Report",
        )
        assert len(res["files"]) == 1
        assert res["files"][0]["id"] == "g-file-1"
        assert res["files"][0]["name"] == "Q3_Report.pdf"

        # 2. Fetching binary for import
        filename, content_bytes, mime_type = await fetch_cloud_file(
            connection=mock_conn,
            file_id="g-file-1",
        )
        assert filename == "Q3_Report.pdf"
        assert content_bytes.startswith(b"%PDF")
        assert mime_type == "application/pdf"
