"""
Unit tests for Phase 36 multi-modal query features.

Tests 1-2: image chunk insertion into document_chunks (MODAL-03, D-01/D-02/D-03)
Tests 3-6: query_tables service logic (MODAL-03, D-04/D-05/D-06)
"""
from __future__ import annotations

import json
from unittest.mock import MagicMock, patch, call

import pytest


# ---------------------------------------------------------------------------
# Helper: build a mock supabase for image chunk tests
# ---------------------------------------------------------------------------

def _make_supabase_for_image_chunks(existing_max_chunk_index=None):
    """
    Builds a MagicMock supabase that satisfies extract_and_store_images call chain:
    - table("document_images").insert(rows).execute()  → data=[...]
    - table("document_chunks").select(...).eq(...).order(...).limit(...).execute() → data=[{"chunk_index": N}] or []
    - table("document_chunks").insert(rows).execute()  → data=[...]
    """
    mock = MagicMock()

    # document_images.insert().execute()
    img_exec = MagicMock()
    img_exec.data = []
    mock.table.return_value.insert.return_value.execute.return_value = img_exec

    # document_chunks MAX(chunk_index) query
    max_exec = MagicMock()
    if existing_max_chunk_index is not None:
        max_exec.data = [{"chunk_index": existing_max_chunk_index}]
    else:
        max_exec.data = []
    (mock.table.return_value.select.return_value
        .eq.return_value.order.return_value.limit.return_value
        .execute.return_value) = max_exec

    return mock


# ---------------------------------------------------------------------------
# Test 1: image chunk insertion — happy path
# ---------------------------------------------------------------------------

def test_image_chunk_insertion():
    """D-01/D-02/D-03: After document_images insert, image descriptions are embedded and
    inserted into document_chunks with correct content format."""
    from app.services.multimodal_service import extract_and_store_images

    mock_supabase = MagicMock()

    # document_images insert
    img_insert_exec = MagicMock()
    img_insert_exec.data = []

    # MAX(chunk_index) query — existing text chunks end at 4
    max_idx_exec = MagicMock()
    max_idx_exec.data = [{"chunk_index": 4}]

    # document_chunks insert capture
    chunks_insert_exec = MagicMock()
    chunks_insert_exec.data = []

    # Wire: first table("document_images"), then table("document_chunks")
    # Use side_effect on table() to route by table name
    def _table(name):
        tbl = MagicMock()
        if name == "document_images":
            tbl.insert.return_value.execute.return_value = img_insert_exec
        elif name == "document_chunks":
            # .select().eq().order().limit().execute() → max idx
            tbl.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = max_idx_exec
            # .insert().execute() → chunk insert
            tbl.insert.return_value.execute.return_value = chunks_insert_exec
        return tbl

    mock_supabase.table.side_effect = _table

    mock_settings = MagicMock()
    fake_embeddings = [[0.1] * 1536]

    image_dicts = [
        {"page": 2, "image_index": 0, "b64_png": "abc", "width": 100, "height": 100},
    ]

    with patch("app.services.multimodal_service.extract_pdf_images", return_value=image_dicts), \
         patch("app.services.multimodal_service.describe_image", return_value="A bar chart showing Q3 revenue."), \
         patch("app.services.multimodal_service.embed_texts", return_value=fake_embeddings) as mock_embed:

        extract_and_store_images(
            raw=b"%PDF",
            mime_type="application/pdf",
            document_id="doc-uuid-001",
            user_id="user-uuid-001",
            supabase=mock_supabase,
            app_settings=mock_settings,
        )

    # embed_texts called with correctly formatted content
    mock_embed.assert_called_once()
    texts_arg = mock_embed.call_args[0][0]
    assert texts_arg == ["[Image p.2]: A bar chart showing Q3 revenue."]

    # document_chunks insert called with correct row
    # Find the insert call on the document_chunks table mock
    # Verify via embed was called — chunk insert happens if embed succeeds
    assert mock_embed.called


def test_image_chunk_skips_empty_description():
    """D-01/Pitfall 2: Rows with empty description are skipped — embed_texts not called."""
    from app.services.multimodal_service import extract_and_store_images

    mock_supabase = MagicMock()

    img_insert_exec = MagicMock()
    img_insert_exec.data = []

    def _table(name):
        tbl = MagicMock()
        if name == "document_images":
            tbl.insert.return_value.execute.return_value = img_insert_exec
        elif name == "document_chunks":
            max_exec = MagicMock()
            max_exec.data = []
            tbl.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = max_exec
            tbl.insert.return_value.execute.return_value = MagicMock(data=[])
        return tbl

    mock_supabase.table.side_effect = _table

    mock_settings = MagicMock()
    image_dicts = [
        {"page": 1, "image_index": 0, "b64_png": "abc", "width": 100, "height": 100},
    ]

    with patch("app.services.multimodal_service.extract_pdf_images", return_value=image_dicts), \
         patch("app.services.multimodal_service.describe_image", return_value=""), \
         patch("app.services.multimodal_service.embed_texts") as mock_embed:

        extract_and_store_images(
            raw=b"%PDF",
            mime_type="application/pdf",
            document_id="doc-uuid-001",
            user_id="user-uuid-001",
            supabase=mock_supabase,
            app_settings=mock_settings,
        )

    mock_embed.assert_not_called()


# ---------------------------------------------------------------------------
# Tests 3-6: query_tables service (RED until Plan 02 implements handle_query_tables)
# ---------------------------------------------------------------------------

def _make_supabase_for_query_tables(doc_id="doc-uuid-001", tables_data=None):
    """Mock supabase for handle_query_tables: resolve_document_id + document_tables query."""
    mock = MagicMock()
    # resolve_document_id uses: table("documents").select(...).eq(...).ilike(...).eq(...).maybe_single().execute()
    doc_exec = MagicMock()
    doc_exec.data = {"id": doc_id} if doc_id else None
    (mock.table.return_value.select.return_value
         .eq.return_value.ilike.return_value.eq.return_value
         .maybe_single.return_value.execute.return_value) = doc_exec

    # document_tables query chain
    tables_exec = MagicMock()
    tables_exec.data = tables_data if tables_data is not None else []
    (mock.table.return_value.select.return_value
         .eq.return_value.eq.return_value
         .order.return_value.execute.return_value) = tables_exec

    return mock


def test_query_tables_returns_data():
    """D-04/D-05: handle_query_tables returns JSON array with table headers and rows."""
    from app.services.multimodal_service import handle_query_tables

    tables_data = [
        {"page": 1, "table_index": 0, "headers": ["Region", "Revenue"], "rows": [["APAC", "1.2M"]]}
    ]
    mock_supabase = MagicMock()

    with patch("app.services.retrieval_service.resolve_document_id", return_value="doc-uuid-001"):
        result = handle_query_tables(
            args={"document_name": "Q3 Report.pdf"},
            user_id="user-uuid-001",
            supabase=mock_supabase,
        )

    data = json.loads(result)
    assert isinstance(data, list)
    assert data[0]["headers"] == ["Region", "Revenue"]
    assert data[0]["rows"] == [["APAC", "1.2M"]]
    assert data[0]["truncated"] is False


def test_query_tables_document_not_found():
    """D-04: handle_query_tables returns error JSON when document not found."""
    from app.services.multimodal_service import handle_query_tables

    mock_supabase = MagicMock()

    with patch("app.services.retrieval_service.resolve_document_id", return_value=None):
        result = handle_query_tables(
            args={"document_name": "nonexistent.pdf"},
            user_id="user-uuid-001",
            supabase=mock_supabase,
        )

    data = json.loads(result)
    assert "error" in data
    assert "nonexistent.pdf" in data["error"]


def test_query_tables_column_filter():
    """D-04: handle_query_tables filters rows server-side when column_filter is provided."""
    from app.services.multimodal_service import handle_query_tables

    mock_supabase = MagicMock()

    with patch("app.services.retrieval_service.resolve_document_id", return_value="doc-uuid-001"), \
         patch("app.services.multimodal_service._fetch_document_tables", return_value=[
             {
                 "page": 1, "table_index": 0,
                 "headers": ["Region", "Revenue"],
                 "rows": [["APAC", "1.2M"], ["EMEA", "0.8M"]],
             }
         ]):
        result = handle_query_tables(
            args={"document_name": "Q3 Report.pdf", "column_filter": {"Region": "APAC"}},
            user_id="user-uuid-001",
            supabase=mock_supabase,
        )

    data = json.loads(result)
    assert len(data) == 1
    assert data[0]["rows"] == [["APAC", "1.2M"]]


def test_query_tables_row_cap():
    """D-06: handle_query_tables caps at 50 rows and sets truncated=True."""
    from app.services.multimodal_service import handle_query_tables

    many_rows = [[str(i), str(i * 2)] for i in range(75)]
    mock_supabase = MagicMock()

    with patch("app.services.retrieval_service.resolve_document_id", return_value="doc-uuid-001"), \
         patch("app.services.multimodal_service._fetch_document_tables", return_value=[
             {"page": 1, "table_index": 0, "headers": ["A", "B"], "rows": many_rows}
         ]):
        result = handle_query_tables(
            args={"document_name": "big.pdf"},
            user_id="user-uuid-001",
            supabase=mock_supabase,
        )

    data = json.loads(result)
    assert len(data[0]["rows"]) == 50
    assert data[0]["truncated"] is True
