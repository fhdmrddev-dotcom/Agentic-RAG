"""Tests for Phase 216 Plan 03 / Phase 232 Plan 03: Source Browser & Single-File Import."""

from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import json as jsonlib

import pytest
from app.models.connector import ConnectorConnectionResponse, McpConfig
from app.services.sources.import_service import fetch_cloud_file, list_cloud_files


@pytest.mark.asyncio
async def test_list_cloud_files_google_drive():
    mock_conn = ConnectorConnectionResponse(
        id=str(uuid4()),
        org_id=str(uuid4()),
        name="Google Drive",
        service_id="google_workspace",
        capability=None,
        config=McpConfig(),
        created_at="2026-08-30T00:00:00Z",
        updated_at="2026-08-30T00:00:00Z",
    )

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.body = jsonlib.dumps({
        "nextPageToken": "token_abc",
        "files": [
            {
                "id": "file_123",
                "name": "Q3_Report.pdf",
                "mimeType": "application/pdf",
                "size": "1048576",
                "modifiedTime": "2026-08-30T12:00:00Z",
                "iconLink": "https://drive.google.com/icon.png",
                "webViewLink": "https://drive.google.com/file/123",
            }
        ],
    })

    with pytest.MonkeyPatch.context() as mp:
        mp.setattr(
            "app.services.sources.adapters.google_drive.get_fresh_access_token",
            AsyncMock(return_value="valid_token"),
        )
        mp.setattr(
            "app.services.sources.adapters.google_drive.send_pinned_http",
            AsyncMock(return_value=mock_resp),
        )

        res = await list_cloud_files(mock_conn, query="Report")
        assert len(res["files"]) == 1
        f = res["files"][0]
        assert f["id"] == "file_123"
        assert f["name"] == "Q3_Report.pdf"
        assert f["mime_type"] == "application/pdf"
        assert f["size"] == 1048576
        assert res["next_page_token"] == "token_abc"


@pytest.mark.asyncio
async def test_fetch_cloud_file_google_drive_binary():
    mock_conn = ConnectorConnectionResponse(
        id=str(uuid4()),
        org_id=str(uuid4()),
        name="Google Drive",
        service_id="google_workspace",
        capability=None,
        config=McpConfig(),
        created_at="2026-08-30T00:00:00Z",
        updated_at="2026-08-30T00:00:00Z",
    )

    meta_resp = MagicMock()
    meta_resp.status_code = 200
    meta_resp.body = jsonlib.dumps({
        "id": "file_123",
        "name": "Design.png",
        "mimeType": "image/png",
    })

    dl_resp = MagicMock()
    dl_resp.status_code = 200
    dl_resp.body = b"fake_png_bytes"

    with pytest.MonkeyPatch.context() as mp:
        mp.setattr(
            "app.services.sources.adapters.google_drive.get_fresh_access_token",
            AsyncMock(return_value="valid_token"),
        )
        mp.setattr(
            "app.services.sources.adapters.google_drive.send_pinned_http",
            AsyncMock(side_effect=[meta_resp, dl_resp]),
        )

        filename, content, mime = await fetch_cloud_file(mock_conn, "file_123")
        assert filename == "Design.png"
        assert content == b"fake_png_bytes"
        assert mime == "image/png"

