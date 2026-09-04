"""Unit tests for Ingest Splice service (Phase 229 TRUST-01).

Tests mint_document_row, async_mint_document_row, and splice_document:
- Validates folder ownership (G-1 byte-for-byte 403 on mismatch)
- Enforces folder-scoped deduplication
- Enforces user-scoped filename versioning with is_latest retirement
- Preserves Postgres timestamp defaults (omits created_at/updated_at, G-4)
- Handles 23505 unique collision: raises 409 on 'raise', links existing on 'link' (G-2)
- Tests async threadpool wrapper
- Verifies post-mint extraction pipeline and error capture
"""

import hashlib
from unittest.mock import MagicMock, patch
import pytest
from fastapi import HTTPException

from app.services.ingest_splice import (
    MintResult,
    async_mint_document_row,
    mint_document_row,
    splice_document,
)

USER_ID = "00000000-0000-0000-0000-000000000001"
OTHER_USER_ID = "00000000-0000-0000-0000-000000000099"
FOLDER_ID = "11111111-1111-1111-1111-111111111111"
DOC_ID_1 = "22222222-2222-2222-2222-222222222221"
DOC_ID_2 = "22222222-2222-2222-2222-222222222222"
RAW_BYTES = b"sample document content for ingest splice test"
CONTENT_HASH = hashlib.sha256(RAW_BYTES).hexdigest()
FILENAME = "invoice.pdf"
MIME_TYPE = "application/pdf"


def _make_result(data):
    r = MagicMock()
    r.data = data
    return r


def _make_query_builder():
    b = MagicMock()
    b.eq.return_value = b
    b.neq.return_value = b
    b.is_.return_value = b
    b.order.return_value = b
    b.limit.return_value = b
    b.maybe_single.return_value = b
    b.single.return_value = b
    b.execute.return_value = _make_result([])
    return b


def _make_table_mock():
    t = MagicMock()
    select_b = _make_query_builder()
    insert_b = _make_query_builder()
    update_b = _make_query_builder()
    delete_b = _make_query_builder()

    t.select.return_value = select_b
    t.insert.return_value = insert_b
    t.update.return_value = update_b
    t.delete.return_value = delete_b

    t._select = select_b
    t._insert = insert_b
    t._update = update_b
    t._delete = delete_b
    return t


def _build_mock_supabase():
    client = MagicMock()
    tables = {
        "documents": _make_table_mock(),
        "folders": _make_table_mock(),
    }
    client.table.side_effect = lambda name: tables.get(name, _make_table_mock())
    client._tables = tables
    client.storage = MagicMock()
    client.storage.from_.return_value = MagicMock()
    return client


def test_mint_document_row_fresh_doc():
    """Minting a new document sets pending status, version 1, is_latest=True, and omits created_at/updated_at."""
    supabase = _build_mock_supabase()
    inserted_doc = {
        "id": DOC_ID_1,
        "user_id": USER_ID,
        "filename": FILENAME,
        "file_path": f"{USER_ID}/{DOC_ID_1}/{FILENAME}",
        "file_size": len(RAW_BYTES),
        "mime_type": MIME_TYPE,
        "status": "pending",
        "content_hash": CONTENT_HASH,
        "folder_id": None,
        "version_number": 1,
        "is_latest": True,
    }
    # select() returns empty for dedup and versions
    supabase._tables["documents"]._select.execute.return_value = _make_result([])
    # insert() returns inserted_doc
    supabase._tables["documents"]._insert.execute.return_value = _make_result([inserted_doc])

    res = mint_document_row(
        raw=RAW_BYTES,
        filename=FILENAME,
        mime_type=MIME_TYPE,
        user_id=USER_ID,
        supabase=supabase,
    )

    assert isinstance(res, MintResult)
    assert res.is_duplicate is False
    assert res.version_number == 1
    assert res.document["status"] == "pending"

    # Verify doc_data passed to insert omits created_at/updated_at (G-4)
    insert_call_arg = supabase._tables["documents"].insert.call_args[0][0]
    assert "created_at" not in insert_call_arg
    assert "updated_at" not in insert_call_arg
    assert insert_call_arg["status"] == "pending"
    assert insert_call_arg["is_latest"] is True


def test_mint_document_row_exact_duplicate_completed():
    """Deduplication matches existing completed + is_latest document and returns MintResult(is_duplicate=True)."""
    supabase = _build_mock_supabase()
    existing_doc = {
        "id": DOC_ID_1,
        "user_id": USER_ID,
        "filename": FILENAME,
        "file_path": f"{USER_ID}/{DOC_ID_1}/{FILENAME}",
        "status": "completed",
        "content_hash": CONTENT_HASH,
        "version_number": 1,
        "is_latest": True,
    }
    supabase._tables["documents"]._select.execute.return_value = _make_result([existing_doc])

    res = mint_document_row(
        raw=RAW_BYTES,
        filename=FILENAME,
        mime_type=MIME_TYPE,
        user_id=USER_ID,
        supabase=supabase,
    )

    assert res.is_duplicate is True
    assert res.document["id"] == DOC_ID_1
    # No insert should have occurred
    supabase._tables["documents"].insert.assert_not_called()


def test_mint_document_row_folder_ownership_validation():
    """Folder ownership is strictly validated; unowned folder raises 403 (G-1 byte-for-byte parity)."""
    supabase = _build_mock_supabase()
    # Case 1: Folder does not exist -> 404
    supabase._tables["folders"]._select.execute.return_value = _make_result(None)

    with pytest.raises(HTTPException) as exc_404:
        mint_document_row(
            raw=RAW_BYTES,
            filename=FILENAME,
            mime_type=MIME_TYPE,
            user_id=USER_ID,
            folder_id=FOLDER_ID,
            supabase=supabase,
        )
    assert exc_404.value.status_code == 404
    assert exc_404.value.detail == "Folder not found"

    # Case 2: Folder owned by other user -> 403
    supabase._tables["folders"]._select.execute.return_value = _make_result(
        {"id": FOLDER_ID, "user_id": OTHER_USER_ID}
    )

    with pytest.raises(HTTPException) as exc_403:
        mint_document_row(
            raw=RAW_BYTES,
            filename=FILENAME,
            mime_type=MIME_TYPE,
            user_id=USER_ID,
            folder_id=FOLDER_ID,
            supabase=supabase,
        )
    assert exc_403.value.status_code == 403
    assert exc_403.value.detail == "Cannot upload to a folder you do not own"


def test_mint_document_row_versioning_cascade():
    """When a document with the same filename exists, retires prior versions and increments version_number."""
    supabase = _build_mock_supabase()
    existing_version_row = {"id": DOC_ID_1, "version_number": 2}
    # 1. Dedup select -> empty
    # 2. Versions select -> returns existing_version_row
    supabase._tables["documents"]._select.execute.side_effect = [
        _make_result([]),
        _make_result([existing_version_row]),
    ]

    inserted_doc = {
        "id": DOC_ID_2,
        "user_id": USER_ID,
        "filename": FILENAME,
        "file_path": f"{USER_ID}/{DOC_ID_2}/{FILENAME}",
        "version_number": 3,
        "is_latest": True,
    }
    supabase._tables["documents"]._insert.execute.return_value = _make_result([inserted_doc])

    res = mint_document_row(
        raw=RAW_BYTES,
        filename=FILENAME,
        mime_type=MIME_TYPE,
        user_id=USER_ID,
        supabase=supabase,
    )

    assert res.version_number == 3
    # Verifies prior versions update cascade: update({"is_latest": False})
    supabase._tables["documents"].update.assert_called_with({"is_latest": False})


def test_mint_document_row_unique_violation_raise():
    """Unique index collision (23505) with on_conflict='raise' raises HTTP 409 Conflict."""
    supabase = _build_mock_supabase()
    supabase._tables["documents"]._select.execute.return_value = _make_result([])
    supabase._tables["documents"]._insert.execute.side_effect = Exception("error: 23505: duplicate key value violates unique constraint")

    with pytest.raises(HTTPException) as exc_409:
        mint_document_row(
            raw=RAW_BYTES,
            filename=FILENAME,
            mime_type=MIME_TYPE,
            user_id=USER_ID,
            supabase=supabase,
            on_conflict="raise",
        )
    assert exc_409.value.status_code == 409
    assert "File already exists in this folder" in exc_409.value.detail


def test_mint_document_row_unique_violation_link():
    """Unique index collision (23505) with on_conflict='link' re-queries non-failed doc and returns linked duplicate (G-2)."""
    supabase = _build_mock_supabase()
    linked_doc = {
        "id": DOC_ID_1,
        "user_id": USER_ID,
        "filename": FILENAME,
        "file_path": f"{USER_ID}/{DOC_ID_1}/{FILENAME}",
        "status": "pending",  # still pending in concurrent ingest!
        "version_number": 1,
    }
    # 1. Dedup select -> empty (since existing is pending, not completed)
    # 2. Version select -> empty
    # 3. Link select (after 23505) -> returns linked_doc
    supabase._tables["documents"]._select.execute.side_effect = [
        _make_result([]),
        _make_result([]),
        _make_result([linked_doc]),
    ]
    supabase._tables["documents"]._insert.execute.side_effect = Exception("23505 unique_violation on documents_dedup_idx")

    res = mint_document_row(
        raw=RAW_BYTES,
        filename=FILENAME,
        mime_type=MIME_TYPE,
        user_id=USER_ID,
        supabase=supabase,
        on_conflict="link",
    )

    assert res.is_duplicate is True
    assert res.document["id"] == DOC_ID_1


@pytest.mark.asyncio
async def test_async_mint_document_row_wrapper():
    """async_mint_document_row executes in threadpool and produces identical result."""
    supabase = _build_mock_supabase()
    inserted_doc = {
        "id": DOC_ID_1,
        "user_id": USER_ID,
        "filename": FILENAME,
        "file_path": f"{USER_ID}/{DOC_ID_1}/{FILENAME}",
        "version_number": 1,
        "status": "pending",
    }
    supabase._tables["documents"]._select.execute.return_value = _make_result([])
    supabase._tables["documents"]._insert.execute.return_value = _make_result([inserted_doc])

    res = await async_mint_document_row(
        raw=RAW_BYTES,
        filename=FILENAME,
        mime_type=MIME_TYPE,
        user_id=USER_ID,
        supabase=supabase,
    )

    assert res.is_duplicate is False
    assert res.document["id"] == DOC_ID_1


def test_splice_document_pipeline_success():
    """splice_document runs storage upload, updates status='processing'/'extracting', and delegates to ingest_document."""
    supabase = _build_mock_supabase()
    storage_path = f"{USER_ID}/{DOC_ID_1}/{FILENAME}"

    with patch("app.api.documents.extract_text", return_value="extracted text content") as mock_extract, \
         patch("app.api.documents.ingest_document") as mock_ingest:
        splice_document(
            document_id=DOC_ID_1,
            raw=b"plain text content",
            mime_type="text/plain",
            filename="note.txt",
            user_id=USER_ID,
            storage_path=storage_path,
            supabase=supabase,
        )

        supabase.storage.from_().upload.assert_called_once()
        mock_extract.assert_called_once()
        mock_ingest.assert_called_once()
        args, kwargs = mock_ingest.call_args
        assert kwargs["document_id"] == DOC_ID_1
        assert kwargs["text"] == "extracted text content"
        assert kwargs["user_id"] == USER_ID


def test_splice_document_storage_failure_nonblocking():
    """Storage upload failure is logged and non-blocking; extraction and ingestion still proceed."""
    supabase = _build_mock_supabase()
    supabase.storage.from_().upload.side_effect = Exception("Storage bucket timeout")
    storage_path = f"{USER_ID}/{DOC_ID_1}/{FILENAME}"

    with patch("app.api.documents.extract_text", return_value="text") as mock_extract, \
         patch("app.api.documents.ingest_document") as mock_ingest:
        splice_document(
            document_id=DOC_ID_1,
            raw=b"text",
            mime_type="text/plain",
            filename="note.txt",
            user_id=USER_ID,
            storage_path=storage_path,
            supabase=supabase,
        )

        mock_extract.assert_called_once()
        mock_ingest.assert_called_once()


def test_splice_document_extraction_failure_marks_failed():
    """Extraction failure catches exception and marks documents row status='failed', ingestion_step='failed'."""
    supabase = _build_mock_supabase()

    with patch("app.api.documents.extract_text", side_effect=ValueError("Corrupt document stream")), \
         patch("app.api.documents.ingest_document") as mock_ingest:
        splice_document(
            document_id=DOC_ID_1,
            raw=b"bad bytes",
            mime_type="text/plain",
            filename="note.txt",
            user_id=USER_ID,
            storage_path="",
            supabase=supabase,
        )

        # Ingest should NOT be called
        mock_ingest.assert_not_called()
        # Document status should be updated to failed
        supabase._tables["documents"].update.assert_called_with({
            "status": "failed",
            "ingestion_step": "failed",
            "error_message": "Corrupt document stream",
        })
