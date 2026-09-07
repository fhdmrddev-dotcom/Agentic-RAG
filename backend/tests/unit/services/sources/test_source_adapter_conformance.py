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
from app.services.sources.adapters.microsoft_graph import MicrosoftGraphSourceAdapter
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


GRAPH_DOWNLOAD_URL = "https://b0mpua-by3301.files.1drv.com/y23vmagconformance"


@pytest.fixture
def graph_adapter(monkeypatch: pytest.MonkeyPatch) -> MicrosoftGraphSourceAdapter:
    """Phase 238 — the THIRD family, added to this suite by registering a fixture and nothing
    else. If a new adapter had needed a new invariant, that would have been the SC#4 finding."""
    monkeypatch.setattr(
        "app.services.sources.adapters.microsoft_graph.get_fresh_access_token",
        AsyncMock(return_value="mock_graph_token"),
    )

    async def _mock_send_pinned_http(capability: str, method: str, url: str, **kwargs):
        # THE INVARIANT THAT IS ONLY TRUE FOR THIS FAMILY, ASSERTED WHERE IT BELONGS — inside
        # the adapter's own fake, never as a branch in a shared test body.
        assert capability in ("graph_read", "graph_download")
        assert not url.endswith("/content"), "/content answers 302; the adapter must not call it"
        params = kwargs.get("params") or {}

        if capability == "graph_download":
            return PinnedResponse(
                status_code=200,
                headers={"content-type": "application/pdf"},
                body=b"%PDF-1.7 Mock Graph Binary Content",
            )

        # ⚠ Matches on the ABSENCE of $select, because that is what Graph requires: any
        # projection suppresses @microsoft.graph.downloadUrl (measured live 2026-09-07,
        # contradicting the docs). A fake that accepted either form would have hidden the
        # defect a second time.
        if "/me/drive/items/item-g-1" in url and "$select" not in params:
            return PinnedResponse(
                status_code=200,
                headers={"content-type": "application/json"},
                body=jsonlib.dumps({
                    "id": "item-g-1",
                    "name": "spec.pdf",
                    "size": 1024,
                    "file": {"mimeType": "application/pdf"},
                    "@microsoft.graph.downloadUrl": GRAPH_DOWNLOAD_URL,
                }).encode("utf-8"),
            )

        if url.endswith("/me/drive"):
            return PinnedResponse(
                status_code=200,
                headers={"content-type": "application/json"},
                body=jsonlib.dumps({
                    "id": "drive-g",
                    "driveType": "personal",
                    "owner": {"user": {"displayName": "Test User", "email": "test@example.com"}},
                }).encode("utf-8"),
            )

        # /children — page 1 carries a nextLink, page 2 (re-issued as that URL) does not.
        if "$skiptoken" in url:
            return PinnedResponse(
                status_code=200,
                headers={"content-type": "application/json"},
                body=jsonlib.dumps({"value": [
                    {"id": "folder-g-2", "name": "Archive", "folder": {"childCount": 0},
                     "parentReference": {"path": "/drive/root:/Finance"}},
                ]}).encode("utf-8"),
            )

        return PinnedResponse(
            status_code=200,
            headers={"content-type": "application/json"},
            body=jsonlib.dumps({
                "value": [
                    {"id": "folder-g-1", "name": "Finance", "folder": {"childCount": 2},
                     "parentReference": {"path": "/drive/root:"}},
                    {
                        "id": "item-g-1",
                        "name": "Design.pdf",
                        "size": 2048,
                        "lastModifiedDateTime": "2026-09-01T12:00:00Z",
                        "webUrl": "https://onedrive.live.com/redir?resid=item-g-1",
                        "file": {"mimeType": "application/pdf"},
                        "parentReference": {"path": "/drive/root:/Finance"},
                    },
                ],
                "@odata.nextLink":
                    "https://graph.microsoft.com/v1.0/me/drive/items/folder-g-1/children?$skiptoken=X",
            }).encode("utf-8"),
        )

    monkeypatch.setattr(
        "app.services.sources.adapters.microsoft_graph.send_pinned_http",
        _mock_send_pinned_http,
    )
    return MicrosoftGraphSourceAdapter()


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


class TestMicrosoftGraphAdapterConformance:
    """Universal conformance suite for MicrosoftGraphSourceAdapter (Phase 238 / SRC-03).

    Every method below is the Drive/Mock assertion with a different fixture. That is the point:
    the third family passes the SAME invariants, so `SourceAdapter` expressed it.
    """

    @pytest.mark.asyncio
    async def test_browse_root_returns_virtual_roots(self, graph_adapter: SourceAdapter):
        page = await graph_adapter.browse(connection={"id": "conn-ms", "service_id": "microsoft"})
        assert isinstance(page, BrowsePage)
        assert [n.id for n in page.items] == ["onedrive"]
        for node in page.items:
            assert isinstance(node, SourceNode)
            assert node.kind == "folder"
            assert node.has_children is True

    @pytest.mark.asyncio
    async def test_browse_children_sets_parent_id(self, graph_adapter: SourceAdapter):
        page = await graph_adapter.browse(
            connection={"id": "conn-ms", "service_id": "microsoft"},
            folder_id="onedrive",
        )
        assert isinstance(page, BrowsePage)
        assert len(page.items) > 0
        for node in page.items:
            assert node.parent_id == "onedrive"

    @pytest.mark.asyncio
    async def test_browse_pagination(self, graph_adapter: SourceAdapter):
        page1 = await graph_adapter.browse(
            connection={"id": "conn-ms", "service_id": "microsoft"},
            folder_id="onedrive",
        )
        assert page1.next_page_token is not None

        page2 = await graph_adapter.browse(
            connection={"id": "conn-ms", "service_id": "microsoft"},
            folder_id="onedrive",
            page_token=page1.next_page_token,
        )
        assert len(page2.items) > 0
        assert page2.next_page_token is None

    @pytest.mark.asyncio
    async def test_list_files_returns_file_page(self, graph_adapter: SourceAdapter):
        files_page = await graph_adapter.list_files(
            connection={"id": "conn-ms", "service_id": "microsoft"},
            folder_id="folder-g-1",
        )
        assert isinstance(files_page, FilePage)
        assert len(files_page.files) == 1
        f = files_page.files[0]
        assert isinstance(f, SourceFile)
        assert f.id == "item-g-1"
        assert f.name == "Design.pdf"
        assert f.mime_type == "application/pdf"
        assert f.size == 2048

    @pytest.mark.asyncio
    async def test_read_file_returns_content_tuple(self, graph_adapter: SourceAdapter):
        filename, raw_bytes, mime_type = await graph_adapter.read_file(
            connection={"id": "conn-ms", "service_id": "microsoft"},
            file_id="item-g-1",
        )
        assert isinstance(filename, str) and filename == "spec.pdf"
        assert isinstance(raw_bytes, bytes) and len(raw_bytes) > 0
        assert isinstance(mime_type, str) and mime_type == "application/pdf"

    @pytest.mark.asyncio
    async def test_check_health_probe(self, graph_adapter: SourceAdapter):
        health = await graph_adapter.check(connection={"id": "conn-ms", "service_id": "microsoft"})
        assert isinstance(health, SourceHealth)
        assert health.ok is True
        assert health.error is None
        assert health.details.get("email") == "test@example.com"


class TestSourceFilePathIsNeverFabricated:
    """SEED-253 (D-238-07), asserted across EVERY adapter rather than for one of them.

    The seed's defect was not "path is missing" — it was that a MISSING path was replaced by
    `/<filename>`, so a folder-shaped rule matched the filename and a dead rule looked alive.
    The contract-level invariant is therefore: `path` is None, or it is a path. It is never a
    bare filename dressed up as one.
    """

    @pytest.mark.asyncio
    async def test_graph_path_is_the_real_folder(self, graph_adapter: SourceAdapter):
        page = await graph_adapter.list_files(
            connection={"id": "conn-ms", "service_id": "microsoft"},
            folder_id="folder-g-1",
        )
        assert page.files[0].path == "/Finance/Design.pdf"

    @pytest.mark.asyncio
    async def test_mock_path_is_populated_by_the_adapter(self, mock_adapter: SourceAdapter):
        page = await mock_adapter.list_files(
            connection={"id": "conn-1", "service_id": "mock_source"},
            folder_id="folder-eng",
        )
        for f in page.files:
            assert f.path and f.path.startswith("/") and f.path.count("/") >= 2, (
                "an adapter-populated path names a FOLDER; '/name.ext' is the fabrication "
                "SEED-253 was planted about"
            )

    @pytest.mark.asyncio
    async def test_drive_path_is_none_not_fabricated(self, google_adapter: SourceAdapter):
        """Drive has NO path in `files.list` and SEED-253 stays open for it. None is the honest
        answer; `preview_service`'s walk supplies a breadcrumb where it can."""
        page = await google_adapter.list_files(
            connection={"id": "conn-google", "service_id": "google"},
            folder_id="folder-123",
        )
        assert page.files[0].path is None


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

    def test_microsoft_source_resolution(self):
        """Phase 238 — registration, not a branch. Both keys are decorators on the adapter."""
        for key in ("microsoft", "microsoft_graph"):
            adapter = SourceRegistry.get_adapter(key)
            assert adapter is not None, key
            assert isinstance(adapter, MicrosoftGraphSourceAdapter)

        adapter_conn = SourceRegistry.get_adapter({"service_id": "microsoft"})
        assert isinstance(adapter_conn, MicrosoftGraphSourceAdapter)
        assert SourceRegistry.is_source_supported("microsoft") is True

    def test_unknown_provider_resolution(self):
        assert SourceRegistry.get_adapter("unknown_provider") is None
        assert SourceRegistry.is_source_supported("unknown_provider") is False
        assert SourceRegistry.is_source_supported("google") is True
        assert SourceRegistry.is_source_supported("mock_source") is True
