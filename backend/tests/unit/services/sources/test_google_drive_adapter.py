"""Phase 232 (SRC-02 / D-232-01 / D-232-05) — Google Drive Adapter Unit Tests.

Thoroughly tests GoogleDriveSourceAdapter:
- Virtual roots (My Drive, Shared Drives)
- Shared Drives listing via GET /drives with kind='drive'
- Folder and file listing with supportsAllDrives=true, includeItemsFromAllDrives=true, corpora=allDrives
- Google Doc and Google Sheet export to PDF
- Binary file downloads
- Error diagnostic extraction via _google_error_reason without query leakage
- Check health probe on valid/invalid credentials
"""

import json as jsonlib
from unittest.mock import AsyncMock

import pytest

from app.security.egress import PinnedResponse
from app.services.sources.adapters.google_drive import (
    GoogleDriveSourceAdapter,
    _google_error_reason,
)
from app.services.sources.base import BrowsePage, FilePage, SourceHealth


@pytest.fixture
def adapter() -> GoogleDriveSourceAdapter:
    return GoogleDriveSourceAdapter()


class TestGoogleErrorReason:
    """Tests for safe diagnostic extraction preventing user query leakage (TM-232-03)."""

    def test_empty_or_none_input(self):
        assert _google_error_reason(None) == ""
        assert _google_error_reason(b"") == ""
        assert _google_error_reason("not valid json") == ""

    def test_status_field_extraction(self):
        body = jsonlib.dumps({
            "error": {
                "code": 403,
                "status": "PERMISSION_DENIED",
                "message": "User query: sensitive search text was here",
            }
        })
        reason = _google_error_reason(body)
        assert reason == " (PERMISSION_DENIED)"
        assert "sensitive" not in reason

    def test_errors_array_reason_extraction(self):
        body = jsonlib.dumps({
            "error": {
                "code": 403,
                "errors": [{"reason": "rateLimitExceeded", "message": "query 'super secret'"}],
            }
        })
        reason = _google_error_reason(body)
        assert reason == " (rateLimitExceeded)"
        assert "secret" not in reason

    def test_details_array_reason_extraction(self):
        body = jsonlib.dumps({
            "error": {
                "code": 400,
                "status": "INVALID_ARGUMENT",
                "details": [{"reason": "API_KEY_INVALID"}],
            }
        })
        reason = _google_error_reason(body)
        assert reason == " (INVALID_ARGUMENT / API_KEY_INVALID)"

    def test_deduplicates_repeated_reasons(self):
        body = jsonlib.dumps({
            "error": {
                "status": "rateLimitExceeded",
                "errors": [{"reason": "rateLimitExceeded"}],
            }
        })
        reason = _google_error_reason(body)
        assert reason == " (rateLimitExceeded)"


class TestGoogleDriveBrowsing:
    """Tests for browsing My Drive and Shared Drives."""

    @pytest.mark.asyncio
    async def test_virtual_root_browsing(self, adapter: GoogleDriveSourceAdapter):
        # browse at None or virtual_root requires no network call
        # ⚠ UPDATED IN PHASE 240, DELIBERATELY. This assertion read `== 2` and the roots
        #   genuinely became THREE: mail is a third virtual root on this same connection
        #   (D-240-01), because the Gmail mailbox IS the Google connection. The pin is not
        #   being bent to fit a change of behaviour it was meant to catch — the change is the
        #   feature, and the pin is rewritten STRONGER than it was: an ordered id list instead
        #   of a count, so adding a fourth root fails by NAME rather than by arithmetic.
        page1 = await adapter.browse({"id": "conn-1"}, folder_id=None)
        assert isinstance(page1, BrowsePage)
        assert [i.id for i in page1.items] == ["my_drive", "shared_drives", "mailbox_root"]
        assert [i.name for i in page1.items] == ["My Drive", "Shared Drives", "Mail"]
        assert all(i.kind == "folder" for i in page1.items)

        page2 = await adapter.browse({"id": "conn-1"}, folder_id="virtual_root")
        assert [i.id for i in page2.items] == ["my_drive", "shared_drives", "mailbox_root"]

    @pytest.mark.asyncio
    async def test_shared_drives_listing(self, adapter: GoogleDriveSourceAdapter, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setattr(
            "app.services.sources.adapters.google_drive.get_fresh_access_token",
            AsyncMock(return_value="token_123"),
        )

        recorded_calls = []

        async def _mock_send_pinned(capability: str, method: str, url: str, **kwargs):
            recorded_calls.append({"url": url, "params": kwargs.get("params"), "headers": kwargs.get("headers")})
            return PinnedResponse(
                status_code=200,
                headers={"content-type": "application/json"},
                body=jsonlib.dumps({
                    "drives": [
                        {"id": "drive-alpha", "name": "Alpha Team Drive"},
                        {"id": "drive-beta", "name": "Beta Research Drive"},
                    ],
                    "nextPageToken": "token_next_drives",
                }).encode("utf-8"),
            )

        monkeypatch.setattr("app.services.sources.adapters.google_drive.send_pinned_http", _mock_send_pinned)

        page = await adapter.browse({"id": "conn-1"}, folder_id="shared_drives")
        assert len(page.items) == 2
        assert page.next_page_token == "token_next_drives"
        assert page.items[0].id == "drive-alpha"
        assert page.items[0].name == "Alpha Team Drive"
        assert page.items[0].kind == "drive"
        assert page.items[0].drive_id == "drive-alpha"
        assert page.items[0].parent_id == "shared_drives"

        # Verify URL and auth headers
        assert len(recorded_calls) == 1
        assert "drives" in recorded_calls[0]["url"]
        assert recorded_calls[0]["headers"]["Authorization"] == "Bearer token_123"

    @pytest.mark.asyncio
    async def test_shared_drive_folder_drilldown_supports_all_drives(
        self, adapter: GoogleDriveSourceAdapter, monkeypatch: pytest.MonkeyPatch
    ):
        monkeypatch.setattr(
            "app.services.sources.adapters.google_drive.get_fresh_access_token",
            AsyncMock(return_value="token_123"),
        )

        recorded_params = {}

        async def _mock_send_pinned(capability: str, method: str, url: str, **kwargs):
            nonlocal recorded_params
            recorded_params = kwargs.get("params", {})
            return PinnedResponse(
                status_code=200,
                headers={"content-type": "application/json"},
                body=jsonlib.dumps({
                    "files": [
                        {
                            "id": "subfolder-xyz",
                            "name": "Project Specifications",
                            "mimeType": "application/vnd.google-apps.folder",
                            "driveId": "drive-alpha",
                        }
                    ],
                    "nextPageToken": None,
                }).encode("utf-8"),
            )

        monkeypatch.setattr("app.services.sources.adapters.google_drive.send_pinned_http", _mock_send_pinned)

        page = await adapter.browse({"id": "conn-1"}, folder_id="drive-alpha")
        assert len(page.items) == 1
        assert page.items[0].id == "subfolder-xyz"
        assert page.items[0].name == "Project Specifications"
        assert page.items[0].drive_id == "drive-alpha"
        assert page.items[0].parent_id == "drive-alpha"

        # Ensure supportsAllDrives, includeItemsFromAllDrives, and corpora are set
        assert recorded_params.get("supportsAllDrives") == "true"
        assert recorded_params.get("includeItemsFromAllDrives") == "true"
        assert recorded_params.get("corpora") == "allDrives"
        assert "'drive-alpha' in parents" in recorded_params.get("q", "")

    @pytest.mark.asyncio
    async def test_browse_my_drive_maps_to_root(
        self, adapter: GoogleDriveSourceAdapter, monkeypatch: pytest.MonkeyPatch
    ):
        monkeypatch.setattr(
            "app.services.sources.adapters.google_drive.get_fresh_access_token",
            AsyncMock(return_value="token_123"),
        )

        recorded_params = {}

        async def _mock_send_pinned(capability: str, method: str, url: str, **kwargs):
            nonlocal recorded_params
            recorded_params = kwargs.get("params", {})
            return PinnedResponse(
                status_code=200,
                headers={"content-type": "application/json"},
                body=jsonlib.dumps({"files": []}).encode("utf-8"),
            )

        monkeypatch.setattr("app.services.sources.adapters.google_drive.send_pinned_http", _mock_send_pinned)

        await adapter.browse({"id": "conn-1"}, folder_id="my_drive")
        assert "'root' in parents" in recorded_params.get("q", "")


class TestGoogleDriveFiles:
    """Tests for file enumeration, reading, and export."""

    @pytest.mark.asyncio
    async def test_list_files_in_folder(self, adapter: GoogleDriveSourceAdapter, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setattr(
            "app.services.sources.adapters.google_drive.get_fresh_access_token",
            AsyncMock(return_value="token_123"),
        )

        recorded_params = {}

        async def _mock_send_pinned(capability: str, method: str, url: str, **kwargs):
            nonlocal recorded_params
            recorded_params = kwargs.get("params", {})
            return PinnedResponse(
                status_code=200,
                headers={"content-type": "application/json"},
                body=jsonlib.dumps({
                    "files": [
                        {
                            "id": "file-doc-1",
                            "name": "Q4 Roadmap",
                            "mimeType": "application/vnd.google-apps.document",
                            "modifiedTime": "2026-09-04T10:00:00Z",
                            "driveId": "drive-alpha",
                        }
                    ],
                    "nextPageToken": None,
                }).encode("utf-8"),
            )

        monkeypatch.setattr("app.services.sources.adapters.google_drive.send_pinned_http", _mock_send_pinned)

        page = await adapter.list_files({"id": "conn-1"}, folder_id="subfolder-xyz")
        assert isinstance(page, FilePage)
        assert len(page.files) == 1
        f = page.files[0]
        assert f.id == "file-doc-1"
        assert f.name == "Q4 Roadmap"
        assert f.mime_type == "application/vnd.google-apps.document"
        assert f.drive_id == "drive-alpha"
        assert recorded_params.get("supportsAllDrives") == "true"
        assert recorded_params.get("includeItemsFromAllDrives") == "true"

    @pytest.mark.asyncio
    async def test_read_google_doc_exports_to_pdf(
        self, adapter: GoogleDriveSourceAdapter, monkeypatch: pytest.MonkeyPatch
    ):
        monkeypatch.setattr(
            "app.services.sources.adapters.google_drive.get_fresh_access_token",
            AsyncMock(return_value="token_123"),
        )

        calls = []

        async def _mock_send_pinned(capability: str, method: str, url: str, **kwargs):
            calls.append({"url": url, "params": kwargs.get("params")})
            if "/export" in url:
                assert kwargs.get("params", {}).get("mimeType") == "application/pdf"
                return PinnedResponse(
                    status_code=200,
                    headers={"content-type": "application/pdf"},
                    body=b"%PDF-1.4 exported pdf bytes",
                )
            # metadata
            return PinnedResponse(
                status_code=200,
                headers={"content-type": "application/json"},
                body=jsonlib.dumps({
                    "id": "doc-1",
                    "name": "Quarterly Plan",
                    "mimeType": "application/vnd.google-apps.document",
                }).encode("utf-8"),
            )

        monkeypatch.setattr("app.services.sources.adapters.google_drive.send_pinned_http", _mock_send_pinned)

        filename, content, mime_type = await adapter.read_file({"id": "conn-1"}, file_id="doc-1")
        assert filename == "Quarterly Plan.pdf"
        assert content == b"%PDF-1.4 exported pdf bytes"
        assert mime_type == "application/pdf"
        assert len(calls) == 2

    @pytest.mark.asyncio
    async def test_read_google_sheet_exports_to_pdf(
        self, adapter: GoogleDriveSourceAdapter, monkeypatch: pytest.MonkeyPatch
    ):
        monkeypatch.setattr(
            "app.services.sources.adapters.google_drive.get_fresh_access_token",
            AsyncMock(return_value="token_123"),
        )

        async def _mock_send_pinned(capability: str, method: str, url: str, **kwargs):
            if "/export" in url:
                return PinnedResponse(
                    status_code=200,
                    headers={"content-type": "application/pdf"},
                    body=b"%PDF-1.4 exported sheet bytes",
                )
            return PinnedResponse(
                status_code=200,
                headers={"content-type": "application/json"},
                body=jsonlib.dumps({
                    "id": "sheet-1",
                    "name": "Financials",
                    "mimeType": "application/vnd.google-apps.spreadsheet",
                }).encode("utf-8"),
            )

        monkeypatch.setattr("app.services.sources.adapters.google_drive.send_pinned_http", _mock_send_pinned)

        filename, content, mime_type = await adapter.read_file({"id": "conn-1"}, file_id="sheet-1")
        assert filename == "Financials.pdf"
        assert content == b"%PDF-1.4 exported sheet bytes"
        assert mime_type == "application/pdf"

    @pytest.mark.asyncio
    async def test_read_binary_file_downloads_direct(
        self, adapter: GoogleDriveSourceAdapter, monkeypatch: pytest.MonkeyPatch
    ):
        monkeypatch.setattr(
            "app.services.sources.adapters.google_drive.get_fresh_access_token",
            AsyncMock(return_value="token_123"),
        )

        async def _mock_send_pinned(capability: str, method: str, url: str, **kwargs):
            if kwargs.get("params", {}).get("alt") == "media":
                return PinnedResponse(
                    status_code=200,
                    headers={"content-type": "image/png"},
                    body=b"\x89PNG direct image bytes",
                )
            return PinnedResponse(
                status_code=200,
                headers={"content-type": "application/json"},
                body=jsonlib.dumps({
                    "id": "img-1",
                    "name": "architecture.png",
                    "mimeType": "image/png",
                }).encode("utf-8"),
            )

        monkeypatch.setattr("app.services.sources.adapters.google_drive.send_pinned_http", _mock_send_pinned)

        filename, content, mime_type = await adapter.read_file({"id": "conn-1"}, file_id="img-1")
        assert filename == "architecture.png"
        assert content == b"\x89PNG direct image bytes"
        assert mime_type == "image/png"


class TestGoogleDriveHealthCheck:
    """Tests for SourceAdapter.check health probe."""

    @pytest.mark.asyncio
    async def test_check_healthy(self, adapter: GoogleDriveSourceAdapter, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setattr(
            "app.services.sources.adapters.google_drive.get_fresh_access_token",
            AsyncMock(return_value="valid_token"),
        )

        async def _mock_send_pinned(capability: str, method: str, url: str, **kwargs):
            return PinnedResponse(
                status_code=200,
                headers={"content-type": "application/json"},
                body=jsonlib.dumps({
                    "user": {"displayName": "Dev User", "emailAddress": "dev@company.com"}
                }).encode("utf-8"),
            )

        monkeypatch.setattr("app.services.sources.adapters.google_drive.send_pinned_http", _mock_send_pinned)

        health = await adapter.check({"id": "conn-1"})
        assert isinstance(health, SourceHealth)
        assert health.ok is True
        assert health.details.get("email") == "dev@company.com"

    @pytest.mark.asyncio
    async def test_check_token_failure(self, adapter: GoogleDriveSourceAdapter, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setattr(
            "app.services.sources.adapters.google_drive.get_fresh_access_token",
            AsyncMock(return_value=None),
        )

        health = await adapter.check({"id": "conn-1"})
        assert isinstance(health, SourceHealth)
        assert health.ok is False
        assert "no valid OAuth token" in (health.error or "")

    @pytest.mark.asyncio
    async def test_check_api_error_returns_safe_reason(
        self, adapter: GoogleDriveSourceAdapter, monkeypatch: pytest.MonkeyPatch
    ):
        monkeypatch.setattr(
            "app.services.sources.adapters.google_drive.get_fresh_access_token",
            AsyncMock(return_value="valid_token"),
        )

        async def _mock_send_pinned(capability: str, method: str, url: str, **kwargs):
            return PinnedResponse(
                status_code=403,
                headers={"content-type": "application/json"},
                body=jsonlib.dumps({
                    "error": {
                        "status": "PERMISSION_DENIED",
                        "errors": [{"reason": "insufficientPermissions"}],
                    }
                }).encode("utf-8"),
            )

        monkeypatch.setattr("app.services.sources.adapters.google_drive.send_pinned_http", _mock_send_pinned)

        health = await adapter.check({"id": "conn-1"})
        assert health.ok is False
        assert "HTTP 403 (PERMISSION_DENIED / insufficientPermissions)" in (health.error or "")
