"""Phase 217.1 (BE-6) — rank evaluator unit tests.

Tests the ``evaluate_check`` service function with mocked ``search_documents``.

⚠ The supabase-py client's ``.execute()`` is a SYNC call. ``aexec`` (``app/utils/db.py:47``)
wraps it in ``run_in_threadpool``, so the mock's ``.execute()`` must be a sync MagicMock, not
an AsyncMock — an async mock returns a coroutine object that ``run_in_threadpool`` cannot call.
"""
from unittest.mock import MagicMock, patch

import pytest

from app.services.checked_query_service import evaluate_check


def _mock_supabase(data: list | None = None) -> MagicMock:
    """Build a self-returning supabase mock chain that ``aexec`` can call.

    ``aexec`` calls ``query.execute`` synchronously via ``run_in_threadpool``, so
    ``.execute`` must be a sync callable returning a MagicMock with a ``.data`` list.
    """
    sb = MagicMock()
    sb.table.return_value = sb
    sb.select.return_value = sb
    sb.eq.return_value = sb
    sb.limit.return_value = sb
    sb.order.return_value = sb
    sb.execute.return_value = MagicMock(data=data or [])
    return sb


@pytest.mark.asyncio
async def test_evaluator_calls_search_documents_with_user_settings():
    """The evaluator calls search_documents with the caller's own resolved settings."""
    supabase = _mock_supabase(data=[{"last_rank": 3}])
    user_settings = {"hybrid_search_enabled": True, "retrieval_top_k": 10}

    with patch(
        "app.services.checked_query_service.search_documents",
        return_value=([{"document_id": "doc-1"}], 0.8),
    ) as mock_search:
        rank = await evaluate_check(
            supabase, "user-1", "cq-1", "test question", "doc-1", user_settings
        )

    assert rank == 1
    # Verify search_documents was called with the right user_settings as keyword arg
    mock_search.assert_called_once()
    assert mock_search.call_args[1].get("user_settings") == user_settings


@pytest.mark.asyncio
async def test_evaluator_returns_none_when_document_not_found():
    """When expected_document_id is not among the hits, last_rank = None (never 0)."""
    supabase = _mock_supabase(data=[{"last_rank": None}])

    with patch(
        "app.services.checked_query_service.search_documents",
        return_value=([{"document_id": "other-doc"}], 0.5),
    ):
        rank = await evaluate_check(
            supabase, "user-1", "cq-1", "test question", "doc-1", None
        )

    assert rank is None


@pytest.mark.asyncio
async def test_evaluator_rotates_previous_rank():
    """previous_rank is set to the prior last_rank before the update."""
    supabase = _mock_supabase(data=[{"last_rank": 2}])

    with patch(
        "app.services.checked_query_service.search_documents",
        return_value=([{"document_id": "doc-1"}], 0.8),
    ):
        rank = await evaluate_check(
            supabase, "user-1", "cq-1", "test question", "doc-1", None
        )

    assert rank == 1
    # The UPDATE should set previous_rank=2 (the prior last_rank)
    # Verify via assert_called_with
    supabase.update.assert_called()
    args, _ = supabase.update.call_args
    assert args[0].get("previous_rank") == 2


@pytest.mark.asyncio
async def test_evaluator_finds_first_matching_index():
    """When the same document appears multiple times, take the FIRST (best) index."""
    supabase = _mock_supabase(data=[{"last_rank": None}])

    hits = [
        {"document_id": "other-a"},
        {"document_id": "doc-1"},
        {"document_id": "doc-1"},
        {"document_id": "other-b"},
    ]
    with patch(
        "app.services.checked_query_service.search_documents",
        return_value=(hits, 0.6),
    ):
        rank = await evaluate_check(
            supabase, "user-1", "cq-1", "test question", "doc-1", None
        )

    assert rank == 2  # 1-indexed, first occurrence is at index 1