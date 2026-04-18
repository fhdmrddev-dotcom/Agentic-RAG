"""Tests for GET /knowledge-health/summary — Phase 37 (HLTH-01–HLTH-04)."""
import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock

from tests.conftest import mock_user_data


def _approx_cutoff(days: int) -> datetime:
    """Return the expected cutoff datetime for `days` ago (UTC), used for tolerance checks."""
    return datetime.now(timezone.utc) - timedelta(days=days)


# ── Internal helper ───────────────────────────────────────────────────────────

def _make_result(data):
    r = MagicMock()
    r.data = data
    return r


# ── Data helpers ──────────────────────────────────────────────────────────────

def _doc(doc_id="doc-1", filename="report.pdf", folder_id=None,
         created_at="2026-01-01T00:00:00+00:00", file_size=1024):
    return {
        "id": doc_id,
        "filename": filename,
        "folder_id": folder_id,
        "created_at": created_at,
        "file_size": file_size,
    }


def _audit_row(document_ids, created_at="2026-04-15T10:00:00+00:00"):
    return {
        "metadata": {"document_ids": document_ids, "query_text": "test query"},
        "created_at": created_at,
    }


def _message_row(source_refs, confidence_avg_similarity=0.35,
                 created_at="2026-04-15T10:00:00+00:00"):
    return {
        "source_refs": source_refs,
        "confidence_avg_similarity": confidence_avg_similarity,
        "created_at": created_at,
    }


# ── Tests ─────────────────────────────────────────────────────────────────────

def test_summary_returns_four_arrays(client, auth_headers, mock_execute_result, mock_builder):
    """GET /knowledge-health/summary always returns the four required arrays."""
    # All queries return empty data — we just check shape.
    # With all empty: most_retrieved audit (1), never_retrieved docs (1),
    # never_retrieved audit (1), low_confidence messages (1), stale docs (1) = 5 executes.
    # No join executes because empty-list guards short-circuit both join queries.
    mock_execute_result.data = []
    res = client.get("/knowledge-health/summary", headers=auth_headers)
    assert res.status_code == 200
    body = res.json()
    assert "most_retrieved" in body
    assert "never_retrieved" in body
    assert "low_confidence" in body
    assert "stale" in body
    # All empty when no data
    assert body["most_retrieved"] == []
    assert body["never_retrieved"] == []
    assert body["low_confidence"] == []
    assert body["stale"] == []


def test_most_retrieved_counts_document_ids(client, auth_headers, mock_execute_result, mock_builder):
    """most_retrieved aggregates document_ids from audit_log metadata and returns top results."""
    audit_rows = [
        _audit_row(["doc-1", "doc-2"]),
        _audit_row(["doc-1"]),  # doc-1 appears twice = retrieval_count 2
    ]
    doc_rows = [
        _doc(doc_id="doc-1", filename="popular.pdf"),
        _doc(doc_id="doc-2", filename="once.pdf"),
    ]
    # Execute call sequence:
    # 1. most_retrieved: audit_log query
    # 2. most_retrieved: documents join (non-empty counts)
    # 3. never_retrieved: documents query
    # 4. never_retrieved: audit_log query
    # 5. low_confidence: messages query
    # 6. stale: documents query
    mock_builder.execute.side_effect = [
        _make_result(audit_rows),   # most_retrieved audit_log
        _make_result(doc_rows),     # most_retrieved documents join
        _make_result([]),           # never_retrieved documents
        _make_result([]),           # never_retrieved audit_log
        _make_result([]),           # low_confidence messages
        _make_result([]),           # stale documents
    ]
    res = client.get("/knowledge-health/summary", headers=auth_headers)
    assert res.status_code == 200
    body = res.json()
    most = body["most_retrieved"]
    assert len(most) >= 1
    assert most[0]["document_id"] == "doc-1"
    assert most[0]["retrieval_count"] == 2
    assert most[0]["filename"] == "popular.pdf"


def test_never_retrieved_excludes_retrieved_docs(client, auth_headers, mock_execute_result, mock_builder):
    """never_retrieved excludes any document_id that appears in audit_log search.query metadata."""
    all_docs = [
        _doc(doc_id="doc-retrieved", filename="retrieved.pdf"),
        _doc(doc_id="doc-orphan", filename="orphan.pdf"),
    ]
    audit_rows = [_audit_row(["doc-retrieved"])]

    # Execute call sequence:
    # 1. most_retrieved: audit_log query (empty → no join)
    # 2. never_retrieved: documents query
    # 3. never_retrieved: audit_log query
    # 4. low_confidence: messages query (empty → no join)
    # 5. stale: documents query
    mock_builder.execute.side_effect = [
        _make_result([]),           # most_retrieved audit_log (empty → no join)
        _make_result(all_docs),     # never_retrieved: all docs
        _make_result(audit_rows),   # never_retrieved: audit_log all-time
        _make_result([]),           # low_confidence messages
        _make_result([]),           # stale documents
    ]
    res = client.get("/knowledge-health/summary", headers=auth_headers)
    assert res.status_code == 200
    body = res.json()
    never = body["never_retrieved"]
    doc_ids = [d["document_id"] for d in never]
    assert "doc-retrieved" not in doc_ids
    assert "doc-orphan" in doc_ids


def test_low_confidence_filters_below_threshold(client, auth_headers, mock_execute_result, mock_builder):
    """low_confidence only includes docs with avg_similarity < 0.40."""
    messages = [
        _message_row(
            source_refs=[
                {"document_id": "doc-low", "avg_similarity": 0.30},
                {"document_id": "doc-high", "avg_similarity": 0.75},
            ],
            confidence_avg_similarity=0.30,
        ),
    ]
    doc_rows = [_doc(doc_id="doc-low", filename="low.pdf")]

    # Execute call sequence:
    # 1. most_retrieved: audit_log (empty → no join)
    # 2. never_retrieved: documents
    # 3. never_retrieved: audit_log
    # 4. low_confidence: messages (non-empty, low_conf_ids computed below threshold)
    # 5. low_confidence: documents join (only doc-low qualifies)
    # 6. stale: documents
    mock_builder.execute.side_effect = [
        _make_result([]),           # most_retrieved audit_log (empty → no join)
        _make_result([]),           # never_retrieved documents
        _make_result([]),           # never_retrieved audit_log
        _make_result(messages),     # low_confidence messages
        _make_result(doc_rows),     # low_confidence documents join
        _make_result([]),           # stale documents
    ]
    res = client.get("/knowledge-health/summary", headers=auth_headers)
    assert res.status_code == 200
    body = res.json()
    low_conf = body["low_confidence"]
    doc_ids = [d["document_id"] for d in low_conf]
    assert "doc-low" in doc_ids
    assert "doc-high" not in doc_ids
    assert low_conf[0]["avg_similarity"] < 0.40


def test_stale_applies_days_param(client, auth_headers, mock_execute_result, mock_builder):
    """stale_days query param is accepted and the cutoff passed to .lt() reflects 180 days."""
    mock_execute_result.data = []
    res = client.get("/knowledge-health/summary?stale_days=180", headers=auth_headers)
    assert res.status_code == 200
    # Verify .lt was called with "created_at" and an ISO timestamp ~180 days ago.
    call_args = mock_builder.lt.call_args
    assert call_args is not None, ".lt() was not called"
    assert call_args[0][0] == "created_at"
    cutoff = datetime.fromisoformat(call_args[0][1])
    expected = _approx_cutoff(180)
    assert abs((cutoff - expected).total_seconds()) < 5, (
        f"Cutoff {cutoff} not within 5s of expected 180-day cutoff {expected}"
    )


def test_stale_default_90_days(client, auth_headers, mock_execute_result, mock_builder):
    """stale_days defaults to 90 and the cutoff passed to .lt() reflects 90 days."""
    mock_execute_result.data = []
    res = client.get("/knowledge-health/summary", headers=auth_headers)
    assert res.status_code == 200
    # Verify .lt was called with "created_at" and an ISO timestamp ~90 days ago.
    call_args = mock_builder.lt.call_args
    assert call_args is not None, ".lt() was not called"
    assert call_args[0][0] == "created_at"
    cutoff = datetime.fromisoformat(call_args[0][1])
    expected = _approx_cutoff(90)
    assert abs((cutoff - expected).total_seconds()) < 5, (
        f"Cutoff {cutoff} not within 5s of expected 90-day cutoff {expected}"
    )


def test_rls_user_id_filter_applied(client, auth_headers, mock_execute_result, mock_builder):
    """All queries filter by user_id (eq called with user_id for RLS)."""
    mock_execute_result.data = []
    res = client.get("/knowledge-health/summary", headers=auth_headers)
    assert res.status_code == 200
    # user_id should appear as an eq filter argument at least once per query (4 queries)
    eq_calls = [str(c) for c in mock_builder.eq.call_args_list]
    user_id_calls = [c for c in eq_calls if mock_user_data["id"] in c]
    assert len(user_id_calls) >= 4, (
        f"Expected >=4 user_id eq filters, got {len(user_id_calls)}"
    )
