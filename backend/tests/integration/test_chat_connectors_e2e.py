import json
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4
import pytest
import httpx

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
from app.services.cloud_storage import list_cloud_files, fetch_cloud_file


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

    with patch("app.services.connector_service.list_connections", AsyncMock(return_value=[mock_conn])), \
         patch("app.services.connectors.registry.get_adapter", lambda cap: MagicMock(send=AsyncMock(return_value={"status": "sent", "channel": "ops"}))):

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


@pytest.mark.asyncio
async def test_e2e_cloud_file_import_flow():
    """End-to-end simulation of single-file cloud storage browsing and document ingestion."""
    conn_id = str(uuid4())
    mock_conn = {
        "id": conn_id,
        "service_id": "google_drive",
        "name": "Corporate Google Drive",
    }

    mock_list_response = httpx.Response(
        200,
        json={
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
        },
    )

    mock_meta_response = httpx.Response(
        200,
        json={
            "id": "g-file-1",
            "name": "Q3_Report.pdf",
            "mimeType": "application/pdf",
            "size": "10240",
        },
    )

    mock_dl_response = httpx.Response(
        200,
        content=b"%PDF-1.4 Mock PDF Content",
    )

    async def mock_get(url, *args, **kwargs):
        url_str = str(url)
        params = kwargs.get("params") or {}
        if url_str.endswith("/files"):
            return mock_list_response
        elif params.get("alt") == "media":
            return mock_dl_response
        elif url_str.endswith("/files/g-file-1"):
            return mock_meta_response
        else:
            return mock_dl_response

    with patch("app.services.cloud_storage.get_fresh_access_token", AsyncMock(return_value="valid-oauth-token")), \
         patch("httpx.AsyncClient.get", side_effect=mock_get):

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
