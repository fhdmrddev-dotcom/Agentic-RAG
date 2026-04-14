"""Unit tests for app.services.retrieval_service.search_documents.

All external dependencies (OpenAI embeddings, Supabase) are mocked.
"""
from unittest.mock import MagicMock, patch

import pytest

# We need to patch embed_texts before the module is loaded the first time,
# but since conftest already imported app.main the module is already loaded.
# Use patch as a context manager / decorator inside each test.

from app.services.retrieval_service import search_documents, _enrich_with_filenames


FAKE_EMBEDDING = [0.1, 0.2, 0.3]
USER_ID = "00000000-0000-0000-0000-000000000001"

# Helper settings mock: disables hybrid search so tests use vector-only path.
# This avoids needing side_effect lists for multiple rpc calls.
VECTOR_ONLY_SETTINGS = MagicMock(
    hybrid_search_enabled=False,
    retrieval_top_k=5,
    retrieval_match_threshold=0.3,
    hybrid_candidate_count=10,
    rrf_k=60,
    vector_search_weight=1.0,
    keyword_search_weight=1.0,
    rerank_top_n=5,
    rerank_enabled=False,
)

HYBRID_SETTINGS = MagicMock(
    hybrid_search_enabled=True,
    retrieval_top_k=5,
    retrieval_match_threshold=0.3,
    hybrid_candidate_count=10,
    rrf_k=60,
    vector_search_weight=1.0,
    keyword_search_weight=1.0,
    rerank_top_n=5,
    rerank_enabled=False,
)


def _make_supabase(rpc_data=None, docs_data=None, second_rpc_data=None):
    """Build a minimal supabase mock for retrieval tests.

    Args:
        rpc_data: Data returned by the first rpc call (vector search).
        docs_data: Data returned by the documents table query.
        second_rpc_data: Data returned by the second rpc call (keyword search in hybrid mode).
                         If None, defaults to empty list.
    """
    sb = MagicMock()

    rpc_result = MagicMock()
    rpc_result.data = rpc_data if rpc_data is not None else []

    second_rpc_result = MagicMock()
    second_rpc_result.data = second_rpc_data if second_rpc_data is not None else []

    docs_result = MagicMock()
    docs_result.data = docs_data if docs_data is not None else []

    # rpc chain — first call returns rpc_result, second returns second_rpc_result
    rpc_builder = MagicMock()
    rpc_builder.execute.side_effect = [rpc_result, second_rpc_result]
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
            search_documents("test query", USER_ID, sb, user_settings=VECTOR_ONLY_SETTINGS)
            mock_embed.assert_called_once_with(["test query"], user_settings=VECTOR_ONLY_SETTINGS)

    def test_calls_supabase_rpc_match_document_chunks(self):
        sb = _make_supabase()
        with patch("app.services.retrieval_service.embed_texts", return_value=[FAKE_EMBEDDING]):
            search_documents("hello", USER_ID, sb, user_settings=VECTOR_ONLY_SETTINGS)
            sb.rpc.assert_called_once()
            call_args = sb.rpc.call_args
            assert call_args[0][0] == "match_document_chunks"
            params = call_args[0][1]
            assert params["query_embedding"] == FAKE_EMBEDDING
            assert params["match_user_id"] == USER_ID

    def test_returns_empty_list_when_no_chunks_match(self):
        sb = _make_supabase(rpc_data=[])
        with patch("app.services.retrieval_service.embed_texts", return_value=[FAKE_EMBEDDING]):
            result, avg_sim = search_documents("nothing", USER_ID, sb, user_settings=VECTOR_ONLY_SETTINGS)
            assert result == []
            assert avg_sim == 0.0

    def test_returns_empty_list_when_rpc_data_is_none(self):
        sb = _make_supabase(rpc_data=None)
        with patch("app.services.retrieval_service.embed_texts", return_value=[FAKE_EMBEDDING]):
            result, avg_sim = search_documents("nothing", USER_ID, sb, user_settings=VECTOR_ONLY_SETTINGS)
            assert result == []
            assert avg_sim == 0.0

    def test_joins_results_with_documents_table(self):
        doc_id = "doc-uuid-1"
        rpc_data = [
            {"id": "chunk-uuid-1", "document_id": doc_id, "content": "Some content", "similarity": 0.85},
        ]
        docs_data = [{"id": doc_id, "filename": "report.pdf"}]
        sb = _make_supabase(rpc_data=rpc_data, docs_data=docs_data)

        with patch("app.services.retrieval_service.embed_texts", return_value=[FAKE_EMBEDDING]):
            result, _ = search_documents("query", USER_ID, sb, user_settings=VECTOR_ONLY_SETTINGS)

        # Documents table should have been queried
        sb.table.assert_called_with("documents")

    def test_returns_formatted_results(self):
        doc_id = "doc-uuid-2"
        rpc_data = [
            {"id": "chunk-uuid-2", "document_id": doc_id, "content": "Relevant text here.", "similarity": 0.9},
        ]
        docs_data = [{"id": doc_id, "filename": "notes.txt"}]
        sb = _make_supabase(rpc_data=rpc_data, docs_data=docs_data)

        with patch("app.services.retrieval_service.embed_texts", return_value=[FAKE_EMBEDDING]):
            result, avg_sim = search_documents("query", USER_ID, sb, user_settings=VECTOR_ONLY_SETTINGS)

        assert len(result) == 1
        item = result[0]
        assert item["content"] == "Relevant text here."
        assert item["document_id"] == doc_id
        assert item["filename"] == "notes.txt"
        assert item["similarity"] == 0.9

    def test_uses_unknown_filename_when_doc_not_found(self):
        doc_id = "missing-doc-id"
        rpc_data = [
            {"id": "chunk-uuid-3", "document_id": doc_id, "content": "Orphaned chunk.", "similarity": 0.7},
        ]
        # Documents table returns empty (doc deleted or not found)
        docs_data = []
        sb = _make_supabase(rpc_data=rpc_data, docs_data=docs_data)

        with patch("app.services.retrieval_service.embed_texts", return_value=[FAKE_EMBEDDING]):
            result, _ = search_documents("query", USER_ID, sb, user_settings=VECTOR_ONLY_SETTINGS)

        assert len(result) == 1
        assert result[0]["filename"] == "Unknown"

    def test_returns_multiple_results(self):
        doc_id = "doc-multi"
        rpc_data = [
            {"id": "chunk-uuid-4", "document_id": doc_id, "content": "Chunk one.", "similarity": 0.9},
            {"id": "chunk-uuid-5", "document_id": doc_id, "content": "Chunk two.", "similarity": 0.8},
            {"id": "chunk-uuid-6", "document_id": doc_id, "content": "Chunk three.", "similarity": 0.7},
        ]
        docs_data = [{"id": doc_id, "filename": "big.pdf"}]
        sb = _make_supabase(rpc_data=rpc_data, docs_data=docs_data)

        with patch("app.services.retrieval_service.embed_texts", return_value=[FAKE_EMBEDDING]):
            result, _ = search_documents("query", USER_ID, sb, user_settings=VECTOR_ONLY_SETTINGS)

        assert len(result) == 3
        assert all(r["filename"] == "big.pdf" for r in result)


class TestSearchDocumentsPhase26:
    """Phase 26: Tests for chunk_index passthrough and avg_similarity return."""

    def test_returns_chunk_index_in_enriched_results(self):
        """chunk_index from RPC row is included in the enriched result dict."""
        doc_id = "doc-cite-1"
        rpc_data = [
            {"id": "chunk-uuid-10", "document_id": doc_id, "content": "Citation text.", "similarity": 0.88, "chunk_index": 3},
        ]
        docs_data = [{"id": doc_id, "filename": "source.pdf"}]
        sb = _make_supabase(rpc_data=rpc_data, docs_data=docs_data)

        with patch("app.services.retrieval_service.embed_texts", return_value=[FAKE_EMBEDDING]):
            result, avg_sim = search_documents("query", USER_ID, sb, user_settings=VECTOR_ONLY_SETTINGS)

        assert len(result) == 1
        assert result[0]["chunk_index"] == 3

    def test_returns_avg_similarity_as_second_value(self):
        """avg_sim is the mean of similarity values from vector search rows."""
        doc_id = "doc-cite-2"
        rpc_data = [
            {"id": "chunk-uuid-11", "document_id": doc_id, "content": "High sim chunk.", "similarity": 0.9, "chunk_index": 1},
            {"id": "chunk-uuid-12", "document_id": doc_id, "content": "Lower sim chunk.", "similarity": 0.7, "chunk_index": 2},
        ]
        docs_data = [{"id": doc_id, "filename": "source.pdf"}]
        sb = _make_supabase(rpc_data=rpc_data, docs_data=docs_data)

        with patch("app.services.retrieval_service.embed_texts", return_value=[FAKE_EMBEDDING]):
            result, avg_sim = search_documents("query", USER_ID, sb, user_settings=VECTOR_ONLY_SETTINGS)

        assert avg_sim == pytest.approx(0.8)

    def test_returns_zero_avg_sim_when_no_results(self):
        """avg_sim is 0.0 when vector search returns no rows."""
        sb = _make_supabase(rpc_data=[])

        with patch("app.services.retrieval_service.embed_texts", return_value=[FAKE_EMBEDDING]):
            result, avg_sim = search_documents("query", USER_ID, sb, user_settings=VECTOR_ONLY_SETTINGS)

        assert result == []
        assert avg_sim == 0.0

    def test_hybrid_empty_returns_tuple(self):
        """Hybrid path with no results from either search returns ([], 0.0)."""
        sb = _make_supabase(rpc_data=[], second_rpc_data=[])

        with patch("app.services.retrieval_service.embed_texts", return_value=[FAKE_EMBEDDING]):
            result, avg_sim = search_documents("query", USER_ID, sb, user_settings=HYBRID_SETTINGS)

        assert result == []
        assert avg_sim == 0.0

    def test_chunk_index_none_when_missing(self):
        """chunk_index is None in enriched result when RPC row lacks the field."""
        doc_id = "doc-cite-3"
        rpc_data = [
            # No chunk_index field in this row
            {"id": "chunk-uuid-13", "document_id": doc_id, "content": "Old RPC row.", "similarity": 0.75},
        ]
        docs_data = [{"id": doc_id, "filename": "legacy.pdf"}]
        sb = _make_supabase(rpc_data=rpc_data, docs_data=docs_data)

        with patch("app.services.retrieval_service.embed_texts", return_value=[FAKE_EMBEDDING]):
            result, avg_sim = search_documents("query", USER_ID, sb, user_settings=VECTOR_ONLY_SETTINGS)

        assert len(result) == 1
        assert result[0]["chunk_index"] is None


class TestEnrichWithFilenamesPhase28:
    """Phase 28 VER-06: Tests for version_number propagation through enrichment."""

    def _make_enrich_supabase(self, docs_data=None):
        """Build a supabase mock for _enrich_with_filenames tests."""
        sb = MagicMock()
        docs_result = MagicMock()
        docs_result.data = docs_data if docs_data is not None else []
        table_builder = MagicMock()
        table_builder.select.return_value = table_builder
        table_builder.in_.return_value = table_builder
        table_builder.execute.return_value = docs_result
        sb.table.return_value = table_builder
        return sb

    def test_enrich_with_filenames_includes_version_number(self):
        """VER-06: enriched results carry version_number from documents table."""
        doc_id = "doc-ver-1"
        rows = [
            {"document_id": doc_id, "content": "Some text.", "similarity": 0.85, "chunk_index": 0},
        ]
        docs_data = [{"id": doc_id, "filename": "report_v3.pdf", "metadata": None, "version_number": 3}]
        sb = self._make_enrich_supabase(docs_data=docs_data)

        result = _enrich_with_filenames(rows, sb)

        assert len(result) == 1
        assert result[0]["version_number"] == 3

    def test_enrich_with_filenames_defaults_version_number_to_1(self):
        """VER-06: enriched results default version_number to 1 when field absent from documents row."""
        doc_id = "doc-ver-2"
        rows = [
            {"document_id": doc_id, "content": "Legacy text.", "similarity": 0.70, "chunk_index": 1},
        ]
        # Doc row has no version_number (pre-migration data)
        docs_data = [{"id": doc_id, "filename": "legacy.pdf", "metadata": None}]
        sb = self._make_enrich_supabase(docs_data=docs_data)

        result = _enrich_with_filenames(rows, sb)

        assert len(result) == 1
        assert result[0]["version_number"] == 1
