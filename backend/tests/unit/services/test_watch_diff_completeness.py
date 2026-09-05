"""Unit tests for WatchService completeness and deletion safety guards (Phase 234 — H-5 / SRC-06 / VIS-03 / VIS-04)."""
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from app.services.sources.base import FilePage, SourceFile
from app.services.watch_service import WatchService


@pytest.fixture
def mock_pool():
    return MagicMock()


@pytest.fixture
def mock_supabase():
    sb = MagicMock()
    conn_query = MagicMock()
    conn_query.select.return_value = conn_query
    conn_query.eq.return_value = conn_query
    conn_query.maybe_single.return_value = conn_query
    conn_query.execute.return_value = MagicMock(
        data={"id": str(uuid4()), "service_id": "google", "is_enabled": True}
    )

    doc_query = MagicMock()
    doc_query.update.return_value = doc_query
    doc_query.eq.return_value = doc_query
    doc_query.execute.return_value = MagicMock(data=[{"id": str(uuid4())}])

    def table_mock(name):
        if name == "connector_connections":
            return conn_query
        elif name == "documents":
            return doc_query
        return MagicMock()

    sb.table.side_effect = table_mock
    return sb


@pytest.fixture
def mock_adapter():
    adapter = MagicMock()
    adapter.list_files = AsyncMock()
    adapter.read_file = AsyncMock()
    return adapter


@pytest.mark.asyncio
async def test_incomplete_listing_suppresses_missing_state_transitions(mock_pool, mock_supabase, mock_adapter):
    """H-5 / SRC-06: An incomplete listing MUST NEVER mark missing items (Onyx #1161 guard)."""
    watch_id = uuid4()
    doc_id = uuid4()
    item_id = uuid4()

    watch_record = {
        "id": watch_id,
        "connection_id": uuid4(),
        "user_id": uuid4(),
        "source_folder_id": "folder-123",
    }

    # DB currently tracks one present item: doc-alpha
    tracked_item = {
        "id": item_id,
        "external_id": "ext-alpha",
        "name": "doc-alpha.pdf",
        "source_version": "v1",
        "document_id": doc_id,
        "state": "present",
    }

    # Adapter pagination fails mid-way with an error -> listing.complete will be False
    mock_adapter.list_files.side_effect = ConnectionResetError("TLS connection reset by peer")

    with patch("app.services.watch_service.get_watch_items", new=AsyncMock(return_value=[tracked_item])), \
         patch("app.services.watch_service.update_item_state", new=AsyncMock()) as mock_update_state, \
         patch("app.services.watch_service.release_watch", new=AsyncMock()), \
         patch("app.services.sources.base.SourceRegistry.get_adapter", return_value=mock_adapter):

        svc = WatchService(pool=mock_pool, supabase=mock_supabase)

        # Sync raises due to network failure, and H-5 ensures missing transitions are suppressed
        with pytest.raises(ConnectionResetError):
            await svc.sync_watch(watch_record)

        # CRITICAL H-5 ASSERTION: update_item_state was NEVER called to mark missing
        mock_update_state.assert_not_called()
        # documents table was NEVER updated to missing_at_source
        mock_supabase.table("documents").update.assert_not_called()


@pytest.mark.asyncio
async def test_complete_listing_marks_absent_files_missing_and_retains_document(mock_pool, mock_supabase, mock_adapter):
    """VIS-03: When listing.complete IS True, absent items transition to missing while document is retained."""
    watch_id = uuid4()
    doc_id = uuid4()
    item_id = uuid4()

    watch_record = {
        "id": watch_id,
        "connection_id": uuid4(),
        "user_id": uuid4(),
        "source_folder_id": "folder-123",
    }

    # DB tracks item-1
    tracked_item = {
        "id": item_id,
        "external_id": "ext-file-deleted",
        "name": "contract.pdf",
        "source_version": "v1",
        "document_id": doc_id,
        "state": "present",
    }

    # Source folder is now completely empty (next_page_token=None -> complete=True)
    mock_adapter.list_files.return_value = FilePage(files=[], next_page_token=None)

    with patch("app.services.watch_service.get_watch_items", new=AsyncMock(return_value=[tracked_item])), \
         patch("app.services.watch_service.update_item_state", new=AsyncMock()) as mock_update_state, \
         patch("app.services.watch_service.release_watch", new=AsyncMock()), \
         patch("app.services.sources.base.SourceRegistry.get_adapter", return_value=mock_adapter):

        svc = WatchService(pool=mock_pool, supabase=mock_supabase)
        res = await svc.sync_watch(watch_record)

        assert res["status"] == "success"
        assert res["counts"]["missing"] == 1

        # Watch item marked missing
        mock_update_state.assert_awaited_once_with(mock_pool, item_id, state="missing")

        # Document marked missing_at_source in Supabase (and row is NOT deleted from DB)
        mock_supabase.table("documents").update.assert_called_with({"source_state": "missing_at_source"})


@pytest.mark.asyncio
async def test_reappearing_file_restores_to_present(mock_pool, mock_supabase, mock_adapter):
    """An item previously marked missing that reappears in the folder restores state to present."""
    watch_id = uuid4()
    doc_id = uuid4()
    item_id = uuid4()

    watch_record = {
        "id": watch_id,
        "connection_id": uuid4(),
        "user_id": uuid4(),
        "source_folder_id": "folder-123",
    }

    # File previously missing
    tracked_item = {
        "id": item_id,
        "external_id": "ext-file-restored",
        "name": "restored.pdf",
        "source_version": "2026-09-01T12:00:00Z",
        "document_id": doc_id,
        "state": "missing",
    }

    file_item = SourceFile(
        id="ext-file-restored",
        name="restored.pdf",
        mime_type="application/pdf",
        modified_at="2026-09-01T12:00:00Z",
    )
    mock_adapter.list_files.return_value = FilePage(files=[file_item], next_page_token=None)

    with patch("app.services.watch_service.get_watch_items", new=AsyncMock(return_value=[tracked_item])), \
         patch("app.services.watch_service.update_item_state", new=AsyncMock()) as mock_update_state, \
         patch("app.services.watch_service.release_watch", new=AsyncMock()), \
         patch("app.services.sources.base.SourceRegistry.get_adapter", return_value=mock_adapter):

        svc = WatchService(pool=mock_pool, supabase=mock_supabase)
        res = await svc.sync_watch(watch_record)

        assert res["counts"]["restored"] == 1
        # Item restored to present
        mock_update_state.assert_awaited_once_with(mock_pool, item_id, state="present")
        # Document source_state cleared
        mock_supabase.table("documents").update.assert_called_with({"source_state": None})


@pytest.mark.asyncio
async def test_unauthorized_source_transitions_items_to_unauthorized(mock_pool, mock_supabase, mock_adapter):
    """VIS-04: 403 / permission revoked at external source transitions items to unauthorized."""
    watch_id = uuid4()
    doc_id = uuid4()
    item_id = uuid4()

    watch_record = {
        "id": watch_id,
        "connection_id": uuid4(),
        "user_id": uuid4(),
        "source_folder_id": "folder-123",
    }

    tracked_item = {
        "id": item_id,
        "external_id": "ext-file-1",
        "name": "doc1.pdf",
        "document_id": doc_id,
        "state": "present",
    }

    # External adapter returns 403 permission error
    mock_adapter.list_files.side_effect = PermissionError("403 Forbidden: Insufficient permissions for folder")

    with patch("app.services.watch_service.get_watch_items", new=AsyncMock(return_value=[tracked_item])), \
         patch("app.services.watch_service.update_item_state", new=AsyncMock()) as mock_update_state, \
         patch("app.services.watch_service.release_watch", new=AsyncMock()) as mock_release, \
         patch("app.services.sources.base.SourceRegistry.get_adapter", return_value=mock_adapter):

        svc = WatchService(pool=mock_pool, supabase=mock_supabase)
        res = await svc.sync_watch(watch_record)

        assert res["status"] == "unauthorized"
        # Item state marked unauthorized
        mock_update_state.assert_awaited_once()
        assert mock_update_state.call_args[1]["state"] == "unauthorized"

        # Document source_state marked unauthorized_at_source
        mock_supabase.table("documents").update.assert_called_with({"source_state": "unauthorized_at_source"})
        mock_release.assert_awaited_once()
