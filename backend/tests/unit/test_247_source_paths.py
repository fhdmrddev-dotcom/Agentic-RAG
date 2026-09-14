"""Unit tests for Phase 247 Plan 01 (WATCH-01, WATCH-02, WR-04, WR-07).

Asserts:
- Google Drive adapter path resolution and parent-to-path hierarchy (WATCH-01).
- Gmail user label human name resolution vs raw label_id (WR-04).
- Microsoft Graph parentReference path parsing across OneDrive and SharePoint (WATCH-02).
- Classification rule matching on metadata.source.path.
- Strict boundary fence on backend/app/api/connectors.py (0 lines modified).
"""

from __future__ import annotations

import json
import subprocess
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.classification_matcher import match_metadata
from app.services.sources.adapters.google_drive import (
    _FOLDER_PATH_CACHE,
    GoogleDriveSourceAdapter,
    _resolve_folder_path,
)
from app.services.sources.adapters.microsoft_graph import (
    MicrosoftGraphSourceAdapter,
    _folder_path,
)
from app.services.sources.base import FilePage, SourceFile
from app.services.sources.mail.gmail import _LABEL_NAME_CACHE, get_label_name


# ── 1. Google Drive Path Hierarchy (WATCH-01) ────────────────────────────────


@pytest.mark.asyncio
async def test_google_drive_folder_path_hierarchy_resolution():
    """Verify _resolve_folder_path walks parent chain and caches cleanly."""
    _FOLDER_PATH_CACHE.clear()
    _FOLDER_PATH_CACHE["root"] = ("", None)
    _FOLDER_PATH_CACHE["my_drive"] = ("", None)

    # Mock send_pinned_http for Drive API files.get
    async def mock_send(service, method, url, params=None, headers=None, timeout=None, max_bytes=None):
        resp = MagicMock()
        resp.status_code = 200
        if "fld_finance" in url:
            resp.body = json.dumps({"id": "fld_finance", "name": "Finance", "parents": ["root"]}).encode("utf-8")
        elif "fld_2026" in url:
            resp.body = json.dumps({"id": "fld_2026", "name": "2026", "parents": ["fld_finance"]}).encode("utf-8")
        else:
            resp.status_code = 404
            resp.body = b"{}"
        return resp

    with patch("app.services.sources.adapters.google_drive.send_pinned_http", side_effect=mock_send):
        path_root = await _resolve_folder_path("token", "root")
        assert path_root == ""

        path_finance = await _resolve_folder_path("token", "fld_finance")
        assert path_finance == "/Finance"

        path_2026 = await _resolve_folder_path("token", "fld_2026")
        assert path_2026 == "/Finance/2026"

        # Subsequent resolution is served from cache without network calls
        cached_2026 = await _resolve_folder_path("token", "fld_2026")
        assert cached_2026 == "/Finance/2026"


@pytest.mark.asyncio
async def test_google_drive_list_files_populates_source_file_path():
    """Verify GoogleDriveSourceAdapter.list_files sets SourceFile.path."""
    adapter = GoogleDriveSourceAdapter()
    conn = MagicMock()

    drive_files_resp = {
        "files": [
            {
                "id": "file_1",
                "name": "Q1_Tax.xlsx",
                "mimeType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "size": "102400",
                "modifiedTime": "2026-09-01T12:00:00Z",
                "parents": ["fld_2026"],
            },
            {
                "id": "file_2",
                "name": "root_readme.txt",
                "mimeType": "text/plain",
                "size": "512",
                "modifiedTime": "2026-09-01T12:00:00Z",
                "parents": ["root"],
            },
        ],
        "nextPageToken": None,
    }

    _FOLDER_PATH_CACHE["fld_2026"] = ("2026", "fld_finance")
    _FOLDER_PATH_CACHE["fld_finance"] = ("Finance", "root")

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.body = json.dumps(drive_files_resp).encode("utf-8")

    with patch.object(adapter, "_get_auth_token", AsyncMock(return_value="fake-token")), patch(
        "app.services.sources.adapters.google_drive.send_pinned_http", AsyncMock(return_value=mock_resp)
    ):
        page = await adapter.list_files(conn, folder_id="fld_2026")
        assert len(page.files) == 2

        f1 = page.files[0]
        assert f1.name == "Q1_Tax.xlsx"
        assert f1.path == "/Finance/2026/Q1_Tax.xlsx"

        f2 = page.files[1]
        assert f2.name == "root_readme.txt"
        assert f2.path == "/root_readme.txt"


# ── 2. WR-04 Human Label Name Resolution ─────────────────────────────────────


@pytest.mark.asyncio
async def test_wr04_user_label_human_name_resolution():
    """WR-04: User labels (Label_9) resolve display name ('Finance') via Gmail API & cache."""
    _LABEL_NAME_CACHE.clear()

    # System labels return id unchanged immediately
    assert await get_label_name("token", "INBOX") == "INBOX"
    assert await get_label_name("token", "SENT") == "SENT"

    # User label queries Gmail API
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.body = json.dumps({"id": "Label_9", "name": "Receipts", "type": "user"}).encode("utf-8")

    with patch("app.services.sources.mail.gmail.send_pinned_http", AsyncMock(return_value=mock_resp)):
        name = await get_label_name("token", "Label_9")
        assert name == "Receipts"

        # Cache is populated
        assert _LABEL_NAME_CACHE["Label_9"] == "Receipts"

        # Next call uses cache
        name_cached = await get_label_name("token", "Label_9")
        assert name_cached == "Receipts"


@pytest.mark.asyncio
async def test_google_drive_list_files_mail_arm_uses_human_label_name():
    """WR-04: GoogleDriveSourceAdapter passes human display name to list_messages."""
    adapter = GoogleDriveSourceAdapter()
    conn = MagicMock()

    _LABEL_NAME_CACHE["Label_9"] = "Receipts"

    mock_page = FilePage(
        files=[
            SourceFile(
                id="msg:123",
                name="Invoice.eml",
                mime_type="message/rfc822",
                path="/Receipts",
            )
        ],
        next_page_token=None,
    )

    with patch.object(adapter, "_get_auth_token", AsyncMock(return_value="token")), patch(
        "app.services.sources.mail.gmail.list_messages", AsyncMock(return_value=mock_page)
    ) as mock_list_msg:
        res = await adapter.list_files(conn, folder_id="mailbox:Label_9:after:1726000000")
        assert len(res.files) == 1
        assert res.files[0].path == "/Receipts"

        # Assert list_messages received human label_name="Receipts", NOT "Label_9"
        mock_list_msg.assert_awaited_once()
        assert mock_list_msg.call_args.kwargs["label_name"] == "Receipts"
        assert mock_list_msg.call_args.kwargs["label_id"] == "Label_9"


# ── 3. Microsoft Graph Path Parsing (WATCH-02) ───────────────────────────────


def test_microsoft_graph_parent_reference_path_parsing():
    """WATCH-02: Clean parentReference.path parsing across OneDrive and SharePoint."""
    # Standard OneDrive personal
    item1 = {
        "name": "Tax.xlsx",
        "parentReference": {"path": "/drive/root:/Finance/2026"},
    }
    assert _folder_path(item1) == "/Finance/2026"

    # SharePoint site drive
    item2 = {
        "name": "Memo.docx",
        "parentReference": {"path": "/sites/contoso/drives/b!12345/root:/Legal/Contracts"},
    }
    assert _folder_path(item2) == "/Legal/Contracts"

    # URL encoded space / entities
    item3 = {
        "name": "Q3 Report.pdf",
        "parentReference": {"path": "/drive/root:/Team%20Docs/Financial%20Plans"},
    }
    assert _folder_path(item3) == "/Team Docs/Financial Plans"

    # Root file (direct child of drive root)
    item4 = {
        "name": "readme.txt",
        "parentReference": {"path": "/drive/root:"},
    }
    assert _folder_path(item4) == ""

    # Drive item without root: marker (opaque item id) returns None per WR-03
    item5 = {
        "name": "orphan.txt",
        "parentReference": {"path": "/drives/b!abc/items/01XYZ"},
    }
    assert _folder_path(item5) is None


@pytest.mark.asyncio
async def test_microsoft_graph_list_files_combines_path_cleanly():
    """WATCH-02: MicrosoftGraphSourceAdapter.list_files produces clean relative paths."""
    adapter = MicrosoftGraphSourceAdapter()
    conn = MagicMock()

    graph_payload = {
        "value": [
            {
                "id": "item-1",
                "name": "Q3_Budget.xlsx",
                "file": {"mimeType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"},
                "size": 5000,
                "lastModifiedDateTime": "2026-09-01T12:00:00Z",
                "parentReference": {"path": "/drive/root:/Finance/2026"},
            },
            {
                "id": "item-2",
                "name": "root.txt",
                "file": {"mimeType": "text/plain"},
                "size": 100,
                "lastModifiedDateTime": "2026-09-01T12:00:00Z",
                "parentReference": {"path": "/drive/root:"},
            },
        ]
    }

    with patch.object(adapter, "_get_auth_token", AsyncMock(return_value="fake-token")), patch.object(
        adapter, "_get_page", AsyncMock(return_value=graph_payload)
    ):
        page = await adapter.list_files(conn, folder_id="root")
        assert len(page.files) == 2
        assert page.files[0].path == "/Finance/2026/Q3_Budget.xlsx"
        assert page.files[1].path == "/root.txt"


# ── 4. Classification Rule Matching ──────────────────────────────────────────


def test_classification_rule_matches_on_resolved_source_path():
    """Verify classification rule matching on metadata.source.path evaluates accurately."""
    # Match expression matching path contains '/Finance/'
    match_contains = {
        "op": "and",
        "conditions": [
            {"field": "path", "op": "contains", "value": "/Finance/"},
        ],
    }
    whitelist = {"path", "title", "filename", "type"}

    facts_drive = {
        "filename": "Q1_Tax.xlsx",
        "path": "/Finance/2026/Q1_Tax.xlsx",
        "source_path": "/Finance/2026/Q1_Tax.xlsx",
    }
    assert match_metadata(match_contains, facts_drive, whitelist) is True

    facts_other = {
        "filename": "Marketing.pdf",
        "path": "/Marketing/Flyer.pdf",
        "source_path": "/Marketing/Flyer.pdf",
    }
    assert match_metadata(match_contains, facts_other, whitelist) is False

    # Exact path match
    match_eq = {
        "op": "and",
        "conditions": [
            {"field": "path", "op": "eq", "value": "/Finance/2026/Q1_Tax.xlsx"},
        ],
    }
    assert match_metadata(match_eq, facts_drive, whitelist) is True



# ── 5. Boundary Fence & Connectors Integrity ─────────────────────────────────


def test_connectors_api_byte_identical_fence():
    """Fence: backend/app/api/connectors.py must NOT have any git modifications."""
    res = subprocess.run(
        ["git", "status", "--porcelain", "backend/app/api/connectors.py"],
        capture_output=True,
        text=True,
        check=True,
    )
    assert res.stdout.strip() == "", (
        f"FENCE VIOLATION: backend/app/api/connectors.py was modified: {res.stdout}"
    )
