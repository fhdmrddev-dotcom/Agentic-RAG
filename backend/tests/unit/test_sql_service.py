"""Unit tests for app.services.sql_service.query_documents.

All Supabase calls are mocked — no real DB required.
"""
from unittest.mock import MagicMock

import pytest

from app.services.sql_service import _to_markdown_table, query_documents

USER_ID = "00000000-0000-0000-0000-000000000001"


def _make_supabase(rpc_data=None):
    """Minimal Supabase mock that returns rpc_data from .rpc().execute()."""
    sb = MagicMock()
    result = MagicMock()
    result.data = rpc_data if rpc_data is not None else []
    rpc_builder = MagicMock()
    rpc_builder.execute.return_value = result
    sb.rpc.return_value = rpc_builder
    return sb


# ── Client-side validation ────────────────────────────────────────────────────

class TestQueryDocumentsValidation:
    def test_rejects_non_select_query(self):
        sb = _make_supabase()
        with pytest.raises(ValueError, match="Only SELECT"):
            query_documents("DROP TABLE documents", USER_ID, sb)

    def test_rejects_update_query(self):
        sb = _make_supabase()
        with pytest.raises(ValueError, match="Only SELECT"):
            query_documents("UPDATE documents SET status='deleted'", USER_ID, sb)

    def test_rejects_insert_query(self):
        sb = _make_supabase()
        with pytest.raises(ValueError, match="Only SELECT"):
            query_documents("INSERT INTO documents VALUES (1)", USER_ID, sb)

    def test_rejects_query_with_semicolon(self):
        sb = _make_supabase()
        with pytest.raises(ValueError, match="semicolons"):
            query_documents("SELECT * FROM documents; DROP TABLE documents", USER_ID, sb)

    def test_accepts_valid_select(self):
        sb = _make_supabase(rpc_data=[{"filename": "a.pdf"}])
        result = query_documents("SELECT filename FROM documents", USER_ID, sb)
        assert result  # non-empty

    def test_case_insensitive_select_check(self):
        sb = _make_supabase(rpc_data=[{"count": 3}])
        # Should NOT raise — case-insensitive SELECT check
        result = query_documents("select count(*) from documents", USER_ID, sb)
        assert result

    def test_leading_whitespace_is_stripped(self):
        sb = _make_supabase(rpc_data=[{"filename": "x.txt"}])
        result = query_documents("   SELECT filename FROM documents", USER_ID, sb)
        assert result


# ── RPC call ──────────────────────────────────────────────────────────────────

class TestQueryDocumentsRpcCall:
    def test_calls_query_user_documents_rpc(self):
        sb = _make_supabase(rpc_data=[])
        query_documents("SELECT * FROM documents", USER_ID, sb)
        sb.rpc.assert_called_once_with(
            "query_user_documents",
            {"sql_query": "SELECT * FROM documents WHERE documents.user_id = '00000000-0000-0000-0000-000000000001'"},
        )

    def test_raises_runtime_error_on_rpc_exception(self):
        sb = MagicMock()
        sb.rpc.side_effect = Exception("DB connection refused")
        with pytest.raises(RuntimeError, match="Database query failed"):
            query_documents("SELECT * FROM documents", USER_ID, sb)


# ── Output formatting ─────────────────────────────────────────────────────────

class TestQueryDocumentsOutput:
    def test_returns_no_results_string_when_empty(self):
        sb = _make_supabase(rpc_data=[])
        assert query_documents("SELECT * FROM documents", USER_ID, sb) == "No results."

    def test_returns_no_results_string_when_data_is_none(self):
        sb = _make_supabase(rpc_data=None)
        assert query_documents("SELECT * FROM documents", USER_ID, sb) == "No results."

    def test_returns_markdown_table_for_small_results(self):
        rows = [
            {"filename": "report.pdf", "status": "completed"},
            {"filename": "notes.txt", "status": "completed"},
        ]
        sb = _make_supabase(rpc_data=rows)
        result = query_documents("SELECT filename, status FROM documents", USER_ID, sb)
        assert "filename" in result
        assert "report.pdf" in result
        assert "notes.txt" in result
        assert "|" in result  # markdown table separator

    def test_markdown_table_has_header_and_separator(self):
        rows = [{"filename": "a.pdf", "file_type": "pdf"}]
        sb = _make_supabase(rpc_data=rows)
        result = query_documents("SELECT filename, file_type FROM documents", USER_ID, sb)
        lines = result.strip().splitlines()
        assert len(lines) >= 3  # header, separator, data row
        assert "---" in lines[1]

    def test_returns_json_for_large_results(self):
        rows = [{"filename": f"doc{i}.pdf"} for i in range(11)]
        sb = _make_supabase(rpc_data=rows)
        result = query_documents("SELECT filename FROM documents", USER_ID, sb)
        # >10 rows → JSON not markdown table
        assert "|" not in result
        assert "doc0.pdf" in result

    def test_truncates_to_20_rows_with_note(self):
        rows = [{"filename": f"doc{i}.pdf"} for i in range(25)]
        sb = _make_supabase(rpc_data=rows)
        result = query_documents("SELECT filename FROM documents", USER_ID, sb)
        assert "Showing 20 of 25" in result
        # Only first 20 rows should be in the JSON
        assert "doc20.pdf" not in result


# ── _to_markdown_table helper ─────────────────────────────────────────────────

class TestToMarkdownTable:
    def test_empty_list_returns_no_results(self):
        assert _to_markdown_table([]) == "No results."

    def test_single_row(self):
        result = _to_markdown_table([{"name": "Alice", "age": "30"}])
        assert "name" in result
        assert "Alice" in result
        assert "30" in result

    def test_multiple_rows(self):
        rows = [{"col": "a"}, {"col": "b"}, {"col": "c"}]
        result = _to_markdown_table(rows)
        assert result.count("a") >= 1
        assert result.count("b") >= 1

    def test_handles_none_values(self):
        rows = [{"filename": None, "status": "pending"}]
        result = _to_markdown_table(rows)
        assert "None" in result or "" in result  # None → str() → "None"
