"""Unit tests for app.services.retrieval_service.search_documents.

All external dependencies (OpenAI embeddings, Supabase) are mocked.
"""
from unittest.mock import MagicMock, patch

import pytest

# We need to patch embed_texts before the module is loaded the first time,
# but since conftest already imported app.main the module is already loaded.
# Use patch as a context manager / decorator inside each test.

from app.services.retrieval_service import search_documents


FAKE_EMBEDDING = [0.1, 0.2, 0.3]
USER_ID = "00000000-0000-0000-0000-000000000001"


def _make_supabase(rpc_data=None, docs_data=None):
    """Build a minimal supabase mock for retrieval tests."""
    sb = MagicMock()

    rpc_result = MagicMock()
    rpc_result.data = rpc_data if rpc_data is not None else []

    docs_result = MagicMock()
    docs_result.data = docs_data if docs_data is not None else []

    # rpc chain
    rpc_builder = MagicMock()
    rpc_builder.execute.return_value = rpc_result
    sb.rpc.return_value = rpc_builder

    # documents table chain
    table_builder = MagicMock()
    table_builder.select.return_value = table_builder
    table_builder.in_.return_value = table_builder
    table_builder.execute.return_value = docs_result
    sb.table.return_value = table_builder

    return sb


class TestSearchDocuments:
    def test_calls_embed_texts_with_query(self):
        sb = _make_supabase()
        with patch("app.services.retrieval_service.embed_texts", return_value=[FAKE_EMBEDDING]) as mock_embed:
            search_documents("test query", USER_ID, sb)
            mock_embed.assert_called_once_with(["test query"])

    def test_calls_supabase_rpc_match_document_chunks(self):
        sb = _make_supabase()
        with patch("app.services.retrieval_service.embed_texts", return_value=[FAKE_EMBEDDING]):
            search_documents("hello", USER_ID, sb)
            sb.rpc.assert_called_once()
            call_args = sb.rpc.call_args
            assert call_args[0][0] == "match_document_chunks"
            params = call_args[0][1]
            assert params["query_embedding"] == FAKE_EMBEDDING
            assert params["match_user_id"] == USER_ID

    def test_returns_empty_list_when_no_chunks_match(self):
        sb = _make_supabase(rpc_data=[])
        with patch("app.services.retrieval_service.embed_texts", return_value=[FAKE_EMBEDDING]):
            result = search_documents("nothing", USER_ID, sb)
            assert result == []

    def test_returns_empty_list_when_rpc_data_is_none(self):
        sb = _make_supabase(rpc_data=None)
        with patch("app.services.retrieval_service.embed_texts", return_value=[FAKE_EMBEDDING]):
            result = search_documents("nothing", USER_ID, sb)
            assert result == []

    def test_joins_results_with_documents_table(self):
        doc_id = "doc-uuid-1"
        rpc_data = [
            {"document_id": doc_id, "content": "Some content", "similarity": 0.85},
        ]
        docs_data = [{"id": doc_id, "filename": "report.pdf"}]
        sb = _make_supabase(rpc_data=rpc_data, docs_data=docs_data)

        with patch("app.services.retrieval_service.embed_texts", return_value=[FAKE_EMBEDDING]):
            result = search_documents("query", USER_ID, sb)

        # Documents table should have been queried
        sb.table.assert_called_with("documents")

    def test_returns_formatted_results(self):
        doc_id = "doc-uuid-2"
        rpc_data = [
            {"document_id": doc_id, "content": "Relevant text here.", "similarity": 0.9},
        ]
        docs_data = [{"id": doc_id, "filename": "notes.txt"}]
        sb = _make_supabase(rpc_data=rpc_data, docs_data=docs_data)

        with patch("app.services.retrieval_service.embed_texts", return_value=[FAKE_EMBEDDING]):
            result = search_documents("query", USER_ID, sb)

        assert len(result) == 1
        item = result[0]
        assert item["content"] == "Relevant text here."
        assert item["document_id"] == doc_id
        assert item["filename"] == "notes.txt"
        assert item["similarity"] == 0.9

    def test_uses_unknown_filename_when_doc_not_found(self):
        doc_id = "missing-doc-id"
        rpc_data = [
            {"document_id": doc_id, "content": "Orphaned chunk.", "similarity": 0.7},
        ]
        # Documents table returns empty (doc deleted or not found)
        docs_data = []
        sb = _make_supabase(rpc_data=rpc_data, docs_data=docs_data)

        with patch("app.services.retrieval_service.embed_texts", return_value=[FAKE_EMBEDDING]):
            result = search_documents("query", USER_ID, sb)

        assert len(result) == 1
        assert result[0]["filename"] == "Unknown"

    def test_returns_multiple_results(self):
        doc_id = "doc-multi"
        rpc_data = [
            {"document_id": doc_id, "content": "Chunk one.", "similarity": 0.9},
            {"document_id": doc_id, "content": "Chunk two.", "similarity": 0.8},
            {"document_id": doc_id, "content": "Chunk three.", "similarity": 0.7},
        ]
        docs_data = [{"id": doc_id, "filename": "big.pdf"}]
        sb = _make_supabase(rpc_data=rpc_data, docs_data=docs_data)

        with patch("app.services.retrieval_service.embed_texts", return_value=[FAKE_EMBEDDING]):
            result = search_documents("query", USER_ID, sb)

        assert len(result) == 3
        assert all(r["filename"] == "big.pdf" for r in result)
