"""Phase 232 (SRC-01 / D-232-06) — Import Service Unit Tests.

Verifies that import_service correctly delegates browsing and single-file import
to registered SourceAdapters, mints via async_mint_document_row with correct
source_connection_id, tenant org_id (TM-232-06), and connection-scoped visibility (TM-232-05).
"""

from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from app.models.connector import ConnectorConnectionResponse, McpConfig
from app.services.sources.base import (
    FilePage,
    SourceAdapter,
    SourceFile,
    SourceRegistry,
)
from app.services.sources.import_service import (
    browse_connection_files,
    fetch_cloud_file,
    import_single_file,
)


@pytest.fixture
def mock_connection():
    return ConnectorConnectionResponse(
        id=str(uuid4()),
        org_id=str(uuid4()),
        name="Test Source Account",
        service_id="mock_source",
        capability=None,
        config=McpConfig(),
        default_ingest_visibility="org",
        created_at="2026-09-01T00:00:00Z",
        updated_at="2026-09-01T00:00:00Z",
    )


@pytest.mark.asyncio
async def test_browse_connection_files_delegates_to_adapter(mock_connection):
    result = await browse_connection_files(
        connection=mock_connection,
        folder_id="folder-eng",
        query=None,
    )
    assert "files" in result
    assert len(result["files"]) == 2
    f0 = result["files"][0]
    assert f0["id"] == "file-eng-1"
    assert f0["name"] == "architecture.pdf"
    assert f0["mime_type"] == "application/pdf"
    assert f0["size"] == 1024


@pytest.mark.asyncio
async def test_browse_connection_files_unregistered_service_returns_empty():
    result = await browse_connection_files(
        connection={"id": "c-unregistered", "service_id": "nonexistent_service"},
    )
    assert result == {"files": [], "next_page_token": None}


@pytest.mark.asyncio
async def test_import_single_file_mints_with_connection_scope_and_org(
    mock_connection, monkeypatch: pytest.MonkeyPatch
):
    mock_bg = MagicMock()
    mock_sb = MagicMock()

    mint_call_args = {}

    async def _mock_mint(**kwargs):
        nonlocal mint_call_args
        mint_call_args = kwargs
        doc = {
            "id": "doc-minted-123",
            "filename": kwargs["filename"],
            "mime_type": kwargs["mime_type"],
            "org_id": kwargs["org_id"],
            "source_connection_id": kwargs["source_connection_id"],
            "ingest_visibility": kwargs["ingest_visibility"],
        }
        res = MagicMock()
        res.document = doc
        res.is_duplicate = False
        res.storage_path = "org/doc-minted-123/architecture.pdf"
        return res

    monkeypatch.setattr("app.services.ingest_splice.async_mint_document_row", _mock_mint)
    mock_splice = MagicMock()
    monkeypatch.setattr("app.services.ingest_splice.splice_document", mock_splice)
    monkeypatch.setattr("app.services.sources.import_service.get_supabase", lambda: mock_sb)

    user_id = str(uuid4())
    active_org_id = str(mock_connection.org_id)

    doc = await import_single_file(
        connection=mock_connection,
        file_id="file-eng-1",
        user_id=user_id,
        active_org=active_org_id,
        background_tasks=mock_bg,
        supabase=mock_sb,
    )

    assert doc["id"] == "doc-minted-123"
    assert doc["filename"] == "architecture.pdf"

    # TM-232-05: Ingest visibility stamped from connection
    assert mint_call_args["ingest_visibility"] == "org"

    # TM-232-06: Org ID stamped from active_org
    assert mint_call_args["org_id"] == active_org_id
    assert mint_call_args["source_connection_id"] == str(mock_connection.id)
    assert mint_call_args["user_id"] == user_id

    # Splicing scheduled
    mock_bg.add_task.assert_called_once()


@pytest.mark.asyncio
async def test_fetch_cloud_file_unregistered_raises():
    with pytest.raises(NotImplementedError) as exc:
        await fetch_cloud_file({"id": "c-1", "service_id": "dropbox"}, "f-1")
    assert "not implemented" in str(exc.value)
