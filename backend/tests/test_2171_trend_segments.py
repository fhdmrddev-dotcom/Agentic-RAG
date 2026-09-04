"""Phase 217.1 (BE-4 / LIB-06 / D-217.1-34) — the characterization test.

⭐ **D-217.1-34's ordering is a HARD REQUIREMENT, not a preference.** `retrieval_count`
currently means "a search that ran" — EVERY `search.query` row is counted into it,
unconditionally (`knowledge_health.py:357-388`). A naive error-path write would make a
provider outage read as a RISE on the shipped Coverage Trend chart — a stronger lie than
the dip the sketch warns about.

This file pins TODAY'S meaning against the UNMODIFIED `_fetch_retrieval_trend` FIRST.
Task 1 must pass before Task 2's edit; Task 2 extends it to prove `retrieval_count` is
unchanged when error rows are added.

The conftest's `mock_builder`/`mock_execute_result` drive the supabase client; the trend
reader is a plain sync function over `res.data`.
"""
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock

from app.api.knowledge_health import _fetch_retrieval_trend


def _supabase_for(builder) -> MagicMock:
    """A top-level supabase client whose `.table(...)` returns the shared builder."""
    sb = MagicMock()
    sb.table.return_value = builder
    sb.rpc.return_value = builder
    return sb


def _iso(days_ago: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=days_ago)).isoformat()


def _run_trend(mock_builder, mock_execute_result, rows, days=7):
    """Drive _fetch_retrieval_trend with a given audit_log row set, return the trend list."""
    mock_execute_result.data = rows
    return _fetch_retrieval_trend(_supabase_for(mock_builder), "user-1", days)


def _today_row(trend):
    return next(r for r in trend if r["date"] == datetime.now(timezone.utc).date().isoformat())


def test_retrieval_count_means_a_search_that_ran(mock_builder, mock_execute_result):
    """PINS TODAY'S SHIPPED BEHAVIOR — every non-error row increments retrieval_count.

    Fixture: one success row (non-empty document_ids), one legitimate-zero-hit row
    (empty document_ids, no retrieval_status). `retrieval_count` == 2. ⚠ There are NO
    error rows yet — this is the pre-edit contract.
    """
    today = _iso(0)
    rows = [
        {
            "created_at": today,
            "metadata": {"query_text": "q1", "document_ids": ["d-1", "d-2"]},
        },
        {
            "created_at": today,
            "metadata": {"query_text": "q2", "document_ids": []},
        },
    ]
    trend = _run_trend(mock_builder, mock_execute_result, rows)
    # Both rows land on today's bucket.
    today_row = _today_row(trend)
    assert today_row["retrieval_count"] == 2, (
        "retrieval_count must count every search.query row — a search that ran, "
        "success or legitimate zero-hit. Pinned BEFORE the BE-4 error-path write "
        "(D-217.1-34)."
    )


def test_error_row_does_not_change_retrieval_count_but_increments_could_not_search(
    mock_builder, mock_execute_result
):
    """POST-EDIT REGRESSION (D-217.1-34): adding one error row leaves retrieval_count
    UNCHANGED (still 2) and increments a new could_not_search series instead.

    This is the whole point of BE-4 — a provider outage must never make the shipped
    Coverage Trend chart RISE.
    """
    today = _iso(0)
    rows = [
        {
            "created_at": today,
            "metadata": {"query_text": "q1", "document_ids": ["d-1", "d-2"]},
        },
        {
            "created_at": today,
            "metadata": {"query_text": "q2", "document_ids": []},
        },
        {
            "created_at": today,
            "metadata": {
                "query_text": "q3",
                "document_ids": [],
                "retrieval_status": "provider_error",
            },
        },
    ]
    trend = _run_trend(mock_builder, mock_execute_result, rows)
    today_row = _today_row(trend)
    assert today_row["retrieval_count"] == 2, (
        "retrieval_count must be UNCHANGED by an error row — a provider outage can never "
        "make the Coverage Trend chart rise (D-217.1-34 / T-217.1-15a)"
    )
    assert today_row["could_not_search"] == 1, (
        "the error row increments the new could_not_search series, never retrieval_count"
    )
    assert today_row["found_something"] == 1
    assert today_row["found_nothing"] == 1
