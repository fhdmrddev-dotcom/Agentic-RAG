"""Phase 232 (SRC-01 / SRC-02) — Source Adapter Conformance Suite.

Verifies that any SourceAdapter implementation (MockSourceAdapter,
GoogleDriveSourceAdapter in Plan 232-02, Microsoft Graph in Phase 238, MCP in Phase 239)
conforms to identical protocol invariants and DTO contracts.
"""

import json as jsonlib
from unittest.mock import AsyncMock

import pytest

from app.security.egress import PinnedResponse
from app.services.sources.adapters.google_drive import GoogleDriveSourceAdapter
from app.services.sources.adapters.mock_source import MockSourceAdapter
from app.services.sources.base import (
    BrowsePage,
    FilePage,
    SourceAdapter,
    SourceFile,
    SourceHealth,
    SourceNode,
    SourceRegistry,
)


@pytest.fixture
def mock_adapter() -> MockSourceAdapter:
    return MockSourceAdapter()


@pytest.fixture
def google_adapter(monkeypatch: pytest.MonkeyPatch) -> GoogleDriveSourceAdapter:
    monkeypatch.setattr(
        "app.services.sources.adapters.google_drive.get_fresh_access_token",
        AsyncMock(return_value="mock_access_token"),
    )

    async def _mock_send_pinned_http(capability: str, method: str, url: str, **kwargs):
        assert capability == "drive_read"
        params = kwargs.get("params", {}) or {}

        # 1. /drives (Shared Drives enumeration)
        if "/drives" in url and "/files" not in url:
            return PinnedResponse(
                status_code=200,
                headers={"content-type": "application/json"},
                body=jsonlib.dumps({
                    "drives": [
                        {"id": "drive-sd-1", "name": "Engineering Shared Drive"},
                        {"id": "drive-sd-2", "name": "Marketing Shared Drive"},
                    ],
                    "nextPageToken": None,
                }).encode("utf-8"),
            )

        # 2. /about (Health probe)
        if "/about" in url:
            return PinnedResponse(
                status_code=200,
                headers={"content-type": "application/json"},
                body=jsonlib.dumps({
                    "user": {
                        "displayName": "Test Workspace User",
                        "emailAddress": "test@example.com",
                    }
                }).encode("utf-8"),
            )

        # 3. /files/export or /files/{id} (Read file)
        if "/export" in url:
            return PinnedResponse(
                status_code=200,
                headers={"content-type": "application/pdf"},
                body=b"%PDF-1.4 Mock PDF Export Content",
            )
        if "/files/" in url and params.get("alt") == "media":
            return PinnedResponse(
                status_code=200,
                headers={"content-type": "application/pdf"},
                body=b"%PDF-1.4 Mock Binary Content",
            )
        if "/files/" in url and "fields" in params:
            return PinnedResponse(
                status_code=200,
                headers={"content-type": "application/json"},
                body=jsonlib.dumps({
                    "id": "file-g-1",
                    "name": "spec.pdf",
                    "mimeType": "application/pdf",
                    "size": "1024",
                }).encode("utf-8"),
            )

        # 4. /files (Browse folders or list files)
        q = params.get("q", "")
        if "mimeType = 'application/vnd.google-apps.folder'" in q:
            # Folder browse
            page_token = params.get("pageToken")
            next_token = "next_page_123" if not page_token else None
            return PinnedResponse(
                status_code=200,
                headers={"content-type": "application/json"},
                body=jsonlib.dumps({
                    "files": [
                        {"id": "subfolder-1", "name": "Docs", "mimeType": "application/vnd.google-apps.folder", "driveId": None},
                    ],
                    "nextPageToken": next_token,
                }).encode("utf-8"),
            )
        else:
            # File list
            return PinnedResponse(
                status_code=200,
                headers={"content-type": "application/json"},
                body=jsonlib.dumps({
                    "files": [
                        {
                            "id": "file-1",
                            "name": "Design.pdf",
                            "mimeType": "application/pdf",
                            "size": "2048",
                            "modifiedTime": "2026-09-01T12:00:00Z",
                            "driveId": None,
                        }
                    ],
                    "nextPageToken": None,
                }).encode("utf-8"),
            )

    monkeypatch.setattr(
        "app.services.sources.adapters.google_drive.send_pinned_http",
        _mock_send_pinned_http,
    )
    return GoogleDriveSourceAdapter()


class TestMockSourceAdapterConformance:
    """Universal conformance test suite for MockSourceAdapter."""

    @pytest.mark.asyncio
    async def test_browse_root_returns_browse_page(self, mock_adapter: SourceAdapter):
        page = await mock_adapter.browse(connection={"id": "conn-1", "service_id": "mock_source"})
        assert isinstance(page, BrowsePage)
        assert len(page.items) > 0
        for node in page.items:
            assert isinstance(node, SourceNode)
            assert isinstance(node.id, str) and len(node.id) > 0
            assert isinstance(node.name, str) and len(node.name) > 0
            assert node.kind in ("folder", "drive")

    @pytest.mark.asyncio
    async def test_browse_children_sets_parent_id(self, mock_adapter: SourceAdapter):
        page = await mock_adapter.browse(
            connection={"id": "conn-1", "service_id": "mock_source"},
            folder_id="mock-root",
            page_token="all",
        )
        assert isinstance(page, BrowsePage)
        assert len(page.items) > 0
        for node in page.items:
            assert node.parent_id == "mock-root"

    @pytest.mark.asyncio
    async def test_browse_pagination(self, mock_adapter: SourceAdapter):
        # First page
        page1 = await mock_adapter.browse(connection={"id": "conn-1", "service_id": "mock_source"})
        assert page1.next_page_token is not None

        # Second page
        page2 = await mock_adapter.browse(
            connection={"id": "conn-1", "service_id": "mock_source"},
            page_token=page1.next_page_token,
        )
        assert len(page2.items) > 0
        assert page2.next_page_token is None

    @pytest.mark.asyncio
    async def test_list_files_returns_file_page(self, mock_adapter: SourceAdapter):
        files_page = await mock_adapter.list_files(
            connection={"id": "conn-1", "service_id": "mock_source"},
            folder_id="folder-eng",
        )
        assert isinstance(files_page, FilePage)
        assert len(files_page.files) == 2
        for f in files_page.files:
            assert isinstance(f, SourceFile)
            assert isinstance(f.id, str) and len(f.id) > 0
            assert isinstance(f.name, str) and len(f.name) > 0
            assert isinstance(f.mime_type, str) and "/" in f.mime_type
            assert f.size is None or f.size >= 0

    @pytest.mark.asyncio
    async def test_read_file_returns_content_tuple(self, mock_adapter: SourceAdapter):
        filename, raw_bytes, mime_type = await mock_adapter.read_file(
            connection={"id": "conn-1", "service_id": "mock_source"},
            file_id="file-eng-1",
        )
        assert isinstance(filename, str) and filename == "architecture.pdf"
        assert isinstance(raw_bytes, bytes) and len(raw_bytes) > 0
        assert isinstance(mime_type, str) and mime_type == "application/pdf"

    @pytest.mark.asyncio
    async def test_check_health_probe(self, mock_adapter: SourceAdapter):
        health = await mock_adapter.check(connection={"id": "conn-1", "service_id": "mock_source"})
        assert isinstance(health, SourceHealth)
        assert health.ok is True
        assert health.error is None
        assert "status" in health.details


class TestGoogleDriveAdapterConformance:
    """Universal conformance test suite for GoogleDriveSourceAdapter."""

    @pytest.mark.asyncio
    async def test_browse_root_returns_virtual_roots(self, google_adapter: SourceAdapter):
        page = await google_adapter.browse(connection={"id": "conn-google", "service_id": "google"})
        assert isinstance(page, BrowsePage)
        assert len(page.items) == 2
        ids = {n.id for n in page.items}
        assert ids == {"my_drive", "shared_drives"}
        for node in page.items:
            assert isinstance(node, SourceNode)
            assert node.kind == "folder"
            assert node.has_children is True

    @pytest.mark.asyncio
    async def test_browse_children_sets_parent_id(self, google_adapter: SourceAdapter):
        page = await google_adapter.browse(
            connection={"id": "conn-google", "service_id": "google"},
            folder_id="my_drive",
        )
        assert isinstance(page, BrowsePage)
        assert len(page.items) > 0
        for node in page.items:
            assert node.parent_id == "my_drive"

    @pytest.mark.asyncio
    async def test_browse_pagination(self, google_adapter: SourceAdapter):
        page1 = await google_adapter.browse(
            connection={"id": "conn-google", "service_id": "google"},
            folder_id="my_drive",
        )
        assert page1.next_page_token == "next_page_123"

        page2 = await google_adapter.browse(
            connection={"id": "conn-google", "service_id": "google"},
            folder_id="my_drive",
            page_token=page1.next_page_token,
        )
        assert len(page2.items) > 0
        assert page2.next_page_token is None

    @pytest.mark.asyncio
    async def test_list_files_returns_file_page(self, google_adapter: SourceAdapter):
        files_page = await google_adapter.list_files(
            connection={"id": "conn-google", "service_id": "google"},
            folder_id="folder-123",
        )
        assert isinstance(files_page, FilePage)
        assert len(files_page.files) == 1
        f = files_page.files[0]
        assert isinstance(f, SourceFile)
        assert f.id == "file-1"
        assert f.name == "Design.pdf"
        assert f.mime_type == "application/pdf"
        assert f.size == 2048

    @pytest.mark.asyncio
    async def test_read_file_returns_content_tuple(self, google_adapter: SourceAdapter):
        filename, raw_bytes, mime_type = await google_adapter.read_file(
            connection={"id": "conn-google", "service_id": "google"},
            file_id="file-g-1",
        )
        assert isinstance(filename, str) and filename == "spec.pdf"
        assert isinstance(raw_bytes, bytes) and len(raw_bytes) > 0
        assert isinstance(mime_type, str) and mime_type == "application/pdf"

    @pytest.mark.asyncio
    async def test_check_health_probe(self, google_adapter: SourceAdapter):
        health = await google_adapter.check(connection={"id": "conn-google", "service_id": "google"})
        assert isinstance(health, SourceHealth)
        assert health.ok is True
        assert health.error is None
        assert health.details.get("email") == "test@example.com"


class TestRegistryResolution:
    """Tests for SourceRegistry provider resolution and alias support."""

    def test_mock_source_resolution(self):
        adapter = SourceRegistry.get_adapter("mock_source")
        assert adapter is not None
        assert isinstance(adapter, MockSourceAdapter)

        adapter_conn = SourceRegistry.get_adapter({"service_id": "mock_source"})
        assert adapter_conn is not None
        assert isinstance(adapter_conn, MockSourceAdapter)

    def test_google_source_resolution(self):
        adapter_google = SourceRegistry.get_adapter("google")
        assert adapter_google is not None
        assert isinstance(adapter_google, GoogleDriveSourceAdapter)

        adapter_workspace = SourceRegistry.get_adapter("google_workspace")
        assert adapter_workspace is not None
        assert isinstance(adapter_workspace, GoogleDriveSourceAdapter)

        adapter_conn = SourceRegistry.get_adapter({"service_id": "google"})
        assert adapter_conn is not None
        assert isinstance(adapter_conn, GoogleDriveSourceAdapter)

    def test_unknown_provider_resolution(self):
        assert SourceRegistry.get_adapter("unknown_provider") is None
        assert SourceRegistry.is_source_supported("unknown_provider") is False
        assert SourceRegistry.is_source_supported("google") is True
        assert SourceRegistry.is_source_supported("mock_source") is True
