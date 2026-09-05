"""Unit tests for WatchService (Phase 234 — LIB-08 / QUEUE-03 / SC#4 / SEED-239)."""
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest

from app.services.ingest_splice import MintResult
from app.services.sources.base import FilePage, SourceFile, SourceListing
from app.services.watch_service import WatchService


@pytest.fixture
def mock_pool():
    pool = MagicMock()
    return pool


@pytest.fixture
def mock_supabase():
    sb = MagicMock()
    # Mock table("connector_connections")
    conn_query = MagicMock()
    conn_query.select.return_value = conn_query
    conn_query.eq.return_value = conn_query
    conn_query.maybe_single.return_value = conn_query
    conn_query.execute.return_value = MagicMock(
        data={
            "id": str(uuid4()),
            "service_id": "google",
            "name": "Team Google Drive",
            "is_enabled": True,
            "default_ingest_visibility": "private",
        }
    )

    # Mock table("documents")
    doc_query = MagicMock()
    doc_query.update.return_value = doc_query
    doc_query.eq.return_value = doc_query
    doc_query.execute.return_value = MagicMock(data=[{"id": str(uuid4())}])

    def table_side_effect(name):
        if name == "connector_connections":
            return conn_query
        elif name == "documents":
            return doc_query
        return MagicMock()

    sb.table.side_effect = table_side_effect

    # Mock storage
    storage_bucket = MagicMock()
    storage_bucket.upload.return_value = {"Key": "documents/fake-path"}
    sb.storage.from_.return_value = storage_bucket
    return sb


@pytest.fixture
def mock_adapter():
    adapter = MagicMock()
    adapter.list_files = AsyncMock()
    adapter.read_file = AsyncMock()
    return adapter


@pytest.mark.asyncio
async def test_watch_service_tick_claims_and_syncs_new_file(mock_pool, mock_supabase, mock_adapter):
    watch_id = uuid4()
    conn_id = uuid4()
    user_id = uuid4()
    org_id = uuid4()

    watch_record = {
        "id": watch_id,
        "connection_id": conn_id,
        "user_id": user_id,
        "org_id": org_id,
        "library_folder_id": None,
        "source_folder_id": "root-folder-123",
        "interval_minutes": 30,
        "status": "running",
    }

    # Setup adapter listing 1 new file
    file_item = SourceFile(
        id="ext-file-1",
        name="quarterly_report.pdf",
        mime_type="application/pdf",
        size=1024,
        modified_at="2026-09-01T12:00:00Z",
    )
    mock_adapter.list_files.return_value = FilePage(files=[file_item], next_page_token=None)
    mock_adapter.read_file.return_value = ("quarterly_report.pdf", b"%PDF-1.4 mock content", "application/pdf")

    new_doc_id = uuid4()
    mint_res = MintResult(
        document={"id": str(new_doc_id), "user_id": str(user_id)},
        is_duplicate=False,
        storage_path=f"{user_id}/{new_doc_id}/quarterly_report.pdf",
        version_number=1,
    )

    with patch("app.services.watch_service.claim_due_watches", new=AsyncMock(return_value=[watch_record])), \
         patch("app.services.watch_service.get_watch_items", new=AsyncMock(return_value=[])), \
         patch("app.services.watch_service.upsert_watch_item", new=AsyncMock(return_value={"id": uuid4()})) as mock_upsert, \
         patch("app.services.watch_service.insert_ingestion_job", new=AsyncMock(return_value=uuid4())) as mock_insert_job, \
         patch("app.services.watch_service.release_watch", new=AsyncMock()) as mock_release, \
         patch("app.services.watch_service.async_mint_document_row", new=AsyncMock(return_value=mint_res)) as mock_mint, \
         patch("app.services.sources.base.SourceRegistry.get_adapter", return_value=mock_adapter):

        svc = WatchService(pool=mock_pool, supabase=mock_supabase)
        claimed_count = await svc.tick()

        assert claimed_count == 1
        # Check adapter read_file called
        mock_adapter.read_file.assert_awaited_once_with(mock_supabase.table("connector_connections").select().eq().maybe_single().execute().data, "ext-file-1")

        # Check async_mint_document_row called keyword-only
        mock_mint.assert_awaited_once()
        _, kwargs = mock_mint.call_args
        assert kwargs["raw"] == b"%PDF-1.4 mock content"
        assert kwargs["filename"] == "quarterly_report.pdf"
        assert kwargs["mime_type"] == "application/pdf"
        assert kwargs["user_id"] == str(user_id)
        assert kwargs["ingest_visibility"] == "private"

        # Check storage upload executed before enqueueing
        mock_supabase.storage.from_("documents").upload.assert_called_once()
        upload_kwargs = mock_supabase.storage.from_("documents").upload.call_args[1]
        assert upload_kwargs["path"] == mint_res.storage_path
        assert upload_kwargs["file"] == b"%PDF-1.4 mock content"

        # Check watch item tracked and ingestion job enqueued
        mock_upsert.assert_awaited_once()
        mock_insert_job.assert_awaited_once_with(mock_pool, document_id=new_doc_id, user_id=user_id, org_id=org_id)

        # Check watch released as success
        mock_release.assert_awaited_once_with(mock_pool, watch_id, status="success")


@pytest.mark.asyncio
async def test_watch_service_duplicate_file_skips_upload_and_enqueue(mock_pool, mock_supabase, mock_adapter):
    watch_id = uuid4()
    conn_id = uuid4()
    user_id = uuid4()

    watch_record = {
        "id": watch_id,
        "connection_id": conn_id,
        "user_id": user_id,
        "org_id": None,
        "library_folder_id": None,
        "source_folder_id": "root-folder-123",
    }

    file_item = SourceFile(
        id="ext-file-dup",
        name="existing_file.pdf",
        mime_type="application/pdf",
        modified_at="2026-09-01T12:00:00Z",
    )
    mock_adapter.list_files.return_value = FilePage(files=[file_item], next_page_token=None)
    mock_adapter.read_file.return_value = ("existing_file.pdf", b"already existing bytes", "application/pdf")

    existing_doc_id = uuid4()
    # is_duplicate=True: already exists in folder
    mint_res = MintResult(
        document={"id": str(existing_doc_id), "user_id": str(user_id)},
        is_duplicate=True,
        storage_path=f"{user_id}/{existing_doc_id}/existing_file.pdf",
        version_number=1,
    )

    with patch("app.services.watch_service.claim_due_watches", new=AsyncMock(return_value=[watch_record])), \
         patch("app.services.watch_service.get_watch_items", new=AsyncMock(return_value=[])), \
         patch("app.services.watch_service.upsert_watch_item", new=AsyncMock(return_value={"id": uuid4()})) as mock_upsert, \
         patch("app.services.watch_service.insert_ingestion_job", new=AsyncMock()) as mock_insert_job, \
         patch("app.services.watch_service.release_watch", new=AsyncMock()) as mock_release, \
         patch("app.services.watch_service.async_mint_document_row", new=AsyncMock(return_value=mint_res)), \
         patch("app.services.sources.base.SourceRegistry.get_adapter", return_value=mock_adapter):

        svc = WatchService(pool=mock_pool, supabase=mock_supabase)
        await svc.tick()

        # Item linked into watch tracking
        mock_upsert.assert_awaited_once()
        upsert_kwargs = mock_upsert.call_args[1]
        assert upsert_kwargs["document_id"] == existing_doc_id
        assert upsert_kwargs["state"] == "present"

        # Crucial: Storage upload NOT called and job NOT enqueued for duplicate
        mock_supabase.storage.from_("documents").upload.assert_not_called()
        mock_insert_job.assert_not_called()
        mock_release.assert_awaited_once_with(mock_pool, watch_id, status="success")


@pytest.mark.asyncio
async def test_watch_service_renamed_file_updates_metadata_without_reingest(mock_pool, mock_supabase, mock_adapter):
    """SC#4: Renamed file at source updates item name and document filename without duplicate row or re-ingest."""
    watch_id = uuid4()
    conn_id = uuid4()
    user_id = uuid4()
    doc_id = uuid4()

    watch_record = {
        "id": watch_id,
        "connection_id": conn_id,
        "user_id": user_id,
        "org_id": None,
        "source_folder_id": "root-folder-123",
    }

    # In source listing: file name is now renamed_presentation.pdf
    file_item = SourceFile(
        id="ext-file-42",
        name="renamed_presentation.pdf",
        mime_type="application/pdf",
        modified_at="2026-09-01T12:00:00Z",
    )
    mock_adapter.list_files.return_value = FilePage(files=[file_item], next_page_token=None)

    # In DB: item was previously tracked as old_presentation.pdf with SAME version
    existing_item = {
        "id": uuid4(),
        "external_id": "ext-file-42",
        "name": "old_presentation.pdf",
        "source_version": "2026-09-01T12:00:00Z",
        "document_id": doc_id,
        "state": "present",
    }

    with patch("app.services.watch_service.claim_due_watches", new=AsyncMock(return_value=[watch_record])), \
         patch("app.services.watch_service.get_watch_items", new=AsyncMock(return_value=[existing_item])), \
         patch("app.services.watch_service.upsert_watch_item", new=AsyncMock(return_value={"id": uuid4()})) as mock_upsert, \
         patch("app.services.watch_service.insert_ingestion_job", new=AsyncMock()) as mock_insert_job, \
         patch("app.services.watch_service.release_watch", new=AsyncMock()), \
         patch("app.services.watch_service.async_mint_document_row", new=AsyncMock()) as mock_mint, \
         patch("app.services.sources.base.SourceRegistry.get_adapter", return_value=mock_adapter):

        svc = WatchService(pool=mock_pool, supabase=mock_supabase)
        await svc.tick()

        # SC#4: name updated on watch item
        mock_upsert.assert_awaited_once()
        assert mock_upsert.call_args[1]["name"] == "renamed_presentation.pdf"

        # SC#4: documents.filename updated
        mock_supabase.table("documents").update.assert_called_with({"filename": "renamed_presentation.pdf"})

        # SC#4: ZERO re-minting and ZERO re-ingestion
        mock_adapter.read_file.assert_not_called()
        mock_mint.assert_not_called()
        mock_insert_job.assert_not_called()


@pytest.mark.asyncio
async def test_watch_service_error_isolation_per_watch(mock_pool, mock_supabase, mock_adapter):
    """SEED-239: Error isolation — one failing watch does not halt other watches in the tick."""
    w1_id = uuid4()
    w2_id = uuid4()

    w1 = {"id": w1_id, "connection_id": uuid4(), "user_id": uuid4(), "source_folder_id": "bad-folder"}
    w2 = {"id": w2_id, "connection_id": uuid4(), "user_id": uuid4(), "source_folder_id": "good-folder"}

    with patch("app.services.watch_service.claim_due_watches", new=AsyncMock(return_value=[w1, w2])), \
         patch("app.services.watch_service.release_watch", new=AsyncMock()) as mock_release:

        svc = WatchService(pool=mock_pool, supabase=mock_supabase)

        async def mock_sync(w):
            if w["id"] == w1_id:
                raise RuntimeError("Google Drive API 503 Backend Error")
            return {"status": "success"}

        svc.sync_watch = AsyncMock(side_effect=mock_sync)

        processed = await svc.tick()

        # w2 succeeded despite w1 failure
        assert processed == 1
        assert svc.sync_watch.await_count == 2

        # w1 was released as failed with the error message
        mock_release.assert_awaited_once_with(mock_pool, w1_id, status="failed", error="Google Drive API 503 Backend Error")
