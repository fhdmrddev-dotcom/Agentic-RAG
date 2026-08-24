"""
Unit tests for table chunks retrieval injection & semantic search (Phase 202 TAB-02).
"""
from __future__ import annotations

from unittest.mock import MagicMock, patch
import pytest

from app.services.multimodal_service import (
    format_table_markdown_chunks,
    embed_and_store_table_chunks,
    backfill_document_table_chunks,
    extract_and_store_tables,
    TABLE_CHUNK_MAX_ROWS,
)


def test_format_table_markdown_chunks_single_page():
    table = {
        "page": 1,
        "table_index": 0,
        "headers": ["doc_id", "title", "owner_team"],
        "rows": [
            ["DOC0001", "Support Guide", "support"],
            ["DOC0002", "API Reference", "engineering"],
        ],
    }
    chunks = format_table_markdown_chunks(table, max_rows=25)
    assert len(chunks) == 1
    content = chunks[0]
    assert content.startswith("[Table 1 | Page 1 | Columns: doc_id, title, owner_team]")
    assert "| doc_id | title | owner_team |" in content
    assert "| --- | --- | --- |" in content
    assert "| DOC0001 | Support Guide | support |" in content
    assert "| DOC0002 | API Reference | engineering |" in content


def test_format_table_markdown_chunks_large_table_batching():
    # 70 rows with max_rows=25 -> 3 chunks (25, 25, 20)
    rows = [[f"ID_{i}", f"Title_{i}"] for i in range(70)]
    table = {
        "page": 2,
        "table_index": 1,
        "headers": ["id", "title"],
        "rows": rows,
    }
    chunks = format_table_markdown_chunks(table, max_rows=25)
    assert len(chunks) == 3
    for chunk in chunks:
        assert chunk.startswith("[Table 2 | Page 2 | Columns: id, title]")
        assert "| id | title |" in chunk
        assert "| --- | --- |" in chunk
    assert "ID_0" in chunks[0]
    assert "ID_24" in chunks[0]
    assert "ID_25" in chunks[1]
    assert "ID_49" in chunks[1]
    assert "ID_50" in chunks[2]
    assert "ID_69" in chunks[2]


def test_format_table_markdown_chunks_sanitizes_pipes_and_newlines():
    table = {
        "page": None,
        "table_index": 0,
        "headers": ["Column | 1", "Notes"],
        "rows": [
            ["Value\nwith\nnewlines", "Contains | pipe character"],
        ],
    }
    chunks = format_table_markdown_chunks(table)
    assert len(chunks) == 1
    content = chunks[0]
    assert "[Table 1 | Page N/A | Columns: Column | 1, Notes]" in content
    assert "Column \\| 1" in content
    assert "Value with newlines" in content
    assert "Contains \\| pipe character" in content


def test_format_table_markdown_chunks_empty_headers():
    table = {"page": 1, "table_index": 0, "headers": [], "rows": []}
    assert format_table_markdown_chunks(table) == []


def test_embed_and_store_table_chunks_inserts_with_correct_offsets():
    mock_supabase = MagicMock()
    mock_chunks_builder = MagicMock()
    mock_docs_builder = MagicMock()

    # Table routing mocks
    def table_router(table_name):
        if table_name == "document_chunks":
            return mock_chunks_builder
        if table_name == "documents":
            return mock_docs_builder
        return MagicMock()

    mock_supabase.table.side_effect = table_router

    # Mock max chunk_index = 4
    mock_chunks_builder.select.return_value = mock_chunks_builder
    mock_chunks_builder.eq.return_value = mock_chunks_builder
    mock_chunks_builder.order.return_value = mock_chunks_builder
    mock_chunks_builder.limit.return_value = mock_chunks_builder
    mock_chunks_builder.execute.return_value = MagicMock(data=[{"chunk_index": 4}])

    # Mock doc org_id
    mock_docs_builder.select.return_value = mock_docs_builder
    mock_docs_builder.eq.return_value = mock_docs_builder
    mock_docs_builder.maybe_single.return_value = mock_docs_builder
    mock_docs_builder.execute.return_value = MagicMock(data={"org_id": "org-123"})

    mock_insert_builder = MagicMock()
    mock_chunks_builder.insert.return_value = mock_insert_builder
    mock_insert_builder.execute.return_value = MagicMock(data=[])

    table_dicts = [
        {
            "page": 1,
            "table_index": 0,
            "headers": ["A", "B"],
            "rows": [["1", "2"]],
        }
    ]

    with patch("app.services.multimodal_service.embed_texts") as mock_embed:
        mock_embed.return_value = [[0.1, 0.2, 0.3]]
        chunk_rows = embed_and_store_table_chunks(
            document_id="doc-tbl-01",
            user_id="user-01",
            table_dicts=table_dicts,
            supabase=mock_supabase,
        )

    assert len(chunk_rows) == 1
    assert chunk_rows[0]["chunk_index"] == 5  # 4 + 1
    assert chunk_rows[0]["org_id"] == "org-123"
    assert chunk_rows[0]["embedding"] == [0.1, 0.2, 0.3]
    assert "[Table 1 | Page 1 | Columns: A, B]" in chunk_rows[0]["content"]


def test_extract_and_store_tables_generates_chunks_automatically():
    mock_supabase = MagicMock()
    mock_tables_builder = MagicMock()
    mock_chunks_builder = MagicMock()
    mock_docs_builder = MagicMock()

    def table_router(table_name):
        if table_name == "document_tables":
            return mock_tables_builder
        if table_name == "document_chunks":
            return mock_chunks_builder
        if table_name == "documents":
            return mock_docs_builder
        return MagicMock()

    mock_supabase.table.side_effect = table_router

    mock_tables_builder.insert.return_value.execute.return_value = MagicMock(data=[])
    mock_chunks_builder.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = MagicMock(data=[])
    mock_docs_builder.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = MagicMock(data=None)
    mock_chunks_builder.insert.return_value.execute.return_value = MagicMock(data=[])

    with patch("app.services.multimodal_service.extract_csv_tables") as mock_extract, \
         patch("app.services.multimodal_service.embed_texts") as mock_embed:
        mock_extract.return_value = [
            {"page": 1, "table_index": 0, "headers": ["ColA"], "rows": [["Val1"]]}
        ]
        mock_embed.return_value = [[0.01, 0.02]]

        extract_and_store_tables(
            raw=b"ColA\nVal1",
            mime_type="text/csv",
            document_id="doc-csv-auto",
            user_id="user-auto",
            supabase=mock_supabase,
        )

    # Verifies document_tables insert
    mock_tables_builder.insert.assert_called_once()
    # Verifies document_chunks insert
    mock_chunks_builder.insert.assert_called_once()


def test_backfill_document_table_chunks():
    mock_supabase = MagicMock()
    mock_tables_builder = MagicMock()
    mock_chunks_builder = MagicMock()
    mock_docs_builder = MagicMock()

    def table_router(table_name):
        if table_name == "document_tables":
            return mock_tables_builder
        if table_name == "document_chunks":
            return mock_chunks_builder
        if table_name == "documents":
            return mock_docs_builder
        return MagicMock()

    mock_supabase.table.side_effect = table_router

    mock_docs_builder.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = MagicMock(
        data={"user_id": "u-backfill", "org_id": None}
    )
    mock_tables_builder.select.return_value.eq.return_value.order.return_value.execute.return_value = MagicMock(
        data=[{"page": 1, "table_index": 0, "headers": ["X", "Y"], "rows": [["10", "20"]]}]
    )

    # First chunks query: check existing (returns empty)
    # Second chunks query: max chunk_index
    mock_chunks_builder.select.return_value.eq.return_value.ilike.return_value.limit.return_value.execute.return_value = MagicMock(data=[])
    mock_chunks_builder.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = MagicMock(data=[])
    mock_chunks_builder.insert.return_value.execute.return_value = MagicMock(data=[])

    with patch("app.services.multimodal_service.embed_texts") as mock_embed:
        mock_embed.return_value = [[0.9, 0.8]]
        count = backfill_document_table_chunks(
            document_id="doc-to-backfill",
            supabase=mock_supabase,
        )

    assert count == 1
    mock_chunks_builder.insert.assert_called_once()
