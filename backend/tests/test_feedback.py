"""Tests for POST /feedback and GET /feedback/stats — Phase 39 (FB-01–FB-03)."""
import pytest
from unittest.mock import MagicMock

from tests.conftest import mock_user_data


def _make_result(data):
    r = MagicMock()
    r.data = data
    return r


def _rating(rating="positive"):
    return {"rating": rating}


def _neg_msg(message_id="00000000-0000-0000-0000-000000000099"):
    return {"message_id": message_id}


def _message_with_refs(msg_id="00000000-0000-0000-0000-000000000099", doc_id="doc-1"):
    return {
        "id": msg_id,
        "source_refs": [{"document_id": doc_id, "filename": "report.pdf", "avg_similarity": 0.8}],
    }


def _message_no_refs(msg_id="00000000-0000-0000-0000-000000000099"):
    return {"id": msg_id, "source_refs": []}


def _doc_row(doc_id="doc-1"):
    return {"id": doc_id, "filename": "report.pdf", "folder_id": None}


# ── Tests ─────────────────────────────────────────────────────────────────────

def test_submit_feedback_returns_201(client, auth_headers, mock_execute_result, mock_builder):
    """POST /feedback returns 201 and {status: ok} on first submission."""
    mock_execute_result.data = []
    res = client.post(
        "/feedback",
        json={
            "message_id": "00000000-0000-0000-0000-000000000099",
            "rating": "positive",
        },
        headers=auth_headers,
    )
    assert res.status_code == 201
    assert res.json()["status"] == "ok"
    # RLS: user_id from JWT must be embedded in the INSERT payload (not via .eq())
    # POST /feedback uses INSERT, so user_id appears in insert() call args
    insert_calls = [str(c) for c in mock_builder.insert.call_args_list]
    assert any(mock_user_data["id"] in c for c in insert_calls), (
        "user_id from JWT was not passed in INSERT payload (RLS enforcement missing)"
    )


def test_submit_feedback_duplicate_returns_409(client, auth_headers, mock_builder):
    """POST /feedback returns 409 when unique constraint violation is detected."""
    mock_builder.execute.side_effect = Exception(
        "duplicate key value violates unique constraint (23505)"
    )
    res = client.post(
        "/feedback",
        json={
            "message_id": "00000000-0000-0000-0000-000000000099",
            "rating": "positive",
        },
        headers=auth_headers,
    )
    assert res.status_code == 409
    assert "already submitted" in res.json()["detail"].lower()


def test_stats_empty_returns_zero_rate(client, auth_headers, mock_builder):
    """GET /feedback/stats returns zeroed stats when no ratings exist."""
    mock_builder.execute.side_effect = [
        _make_result([]),  # all ratings
        _make_result([]),  # negative ratings in window
    ]
    res = client.get("/feedback/stats", headers=auth_headers)
    assert res.status_code == 200
    body = res.json()
    assert body["positive_rate"] == 0.0
    assert body["total_ratings"] == 0
    assert body["downvoted_documents"] == []


def test_stats_positive_rate_calculation(client, auth_headers, mock_builder):
    """GET /feedback/stats computes all-time positive rate correctly (D-03)."""
    all_ratings = [_rating("positive"), _rating("positive"), _rating("positive"), _rating("negative")]
    mock_builder.execute.side_effect = [
        _make_result(all_ratings),  # all ratings (3 positive, 1 negative)
        _make_result([]),           # negative ratings in 30-day window (empty)
    ]
    res = client.get("/feedback/stats", headers=auth_headers)
    assert res.status_code == 200
    body = res.json()
    assert body["positive_rate"] == 0.75
    assert body["total_ratings"] == 4
    assert body["downvoted_documents"] == []


def test_stats_downvoted_documents_attribution(client, auth_headers, mock_builder):
    """GET /feedback/stats attributes downvotes to all source_refs documents (D-08)."""
    msg_id = "00000000-0000-0000-0000-000000000099"
    mock_builder.execute.side_effect = [
        _make_result([_rating("negative")]),          # all ratings (1 negative)
        _make_result([_neg_msg(msg_id)]),              # negative in window
        _make_result([_message_with_refs(msg_id)]),   # messages with source_refs
        _make_result([_doc_row("doc-1")]),             # documents lookup
    ]
    res = client.get("/feedback/stats", headers=auth_headers)
    assert res.status_code == 200
    body = res.json()
    assert len(body["downvoted_documents"]) == 1
    assert body["downvoted_documents"][0]["document_id"] == "doc-1"
    assert body["downvoted_documents"][0]["downvote_count"] == 1
    assert body["downvoted_documents"][0]["filename"] == "report.pdf"


def test_stats_skips_messages_with_empty_source_refs(client, auth_headers, mock_builder):
    """GET /feedback/stats excludes messages with empty source_refs from attribution (D-09)."""
    msg_id = "00000000-0000-0000-0000-000000000099"
    mock_builder.execute.side_effect = [
        _make_result([_rating("negative")]),      # all ratings
        _make_result([_neg_msg(msg_id)]),          # negative in window
        _make_result([_message_no_refs(msg_id)]), # message with empty source_refs
        # No 4th call — doc_counts is empty, documents lookup skipped
    ]
    res = client.get("/feedback/stats", headers=auth_headers)
    assert res.status_code == 200
    body = res.json()
    assert body["downvoted_documents"] == []


def test_stats_rls_user_id_filter_applied(client, auth_headers, mock_execute_result, mock_builder):
    """All stats queries filter by user_id derived from JWT (RLS enforcement)."""
    mock_execute_result.data = []
    mock_builder.execute.side_effect = [
        _make_result([]),  # all ratings
        _make_result([]),  # negative ratings
    ]
    res = client.get("/feedback/stats", headers=auth_headers)
    assert res.status_code == 200
    eq_calls = [str(c) for c in mock_builder.eq.call_args_list]
    user_id_calls = [c for c in eq_calls if mock_user_data["id"] in c]
    assert len(user_id_calls) >= 2, (
        f"Expected >=2 user_id eq filters across stats queries, got {len(user_id_calls)}"
    )
