"""Phase 232 (SRC-01) — Source Adapter Conformance Suite.

Verifies that any SourceAdapter implementation (MockSourceAdapter today,
GoogleDriveSourceAdapter in Plan 232-02, Microsoft Graph in Phase 238, MCP in Phase 239)
conforms to identical protocol invariants and DTO contracts.
"""

import pytest

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


class TestSourceAdapterConformance:
    """Universal conformance test suite applicable to all SourceAdapter implementations."""

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

    def test_registry_resolution(self):
        adapter = SourceRegistry.get_adapter("mock_source")
        assert adapter is not None
        assert isinstance(adapter, MockSourceAdapter)

        # Connection dict resolution
        adapter_conn = SourceRegistry.get_adapter({"service_id": "mock_source"})
        assert adapter_conn is not None
        assert isinstance(adapter_conn, MockSourceAdapter)

        # Unsupported service resolution returns None
        assert SourceRegistry.get_adapter("unknown_provider") is None
