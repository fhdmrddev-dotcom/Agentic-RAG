"""Phase 210 Plan 03 unit/integration tests — RAG-09 Failure Honesty.

Tests:
1. Tool exception in search_documents returns structured error citation in ToolResult.
2. _validate_citations_required identifies provider failure error in output['citations'] and returns honest outage message.
3. Genuine zero matches (no error) produces the standard 0 sources rejection.
4. Successful retrieval validates markers normally.
"""
from unittest.mock import AsyncMock, MagicMock, patch
import pytest

from app.services.harness.validator_kinds import _validate_citations_required
from app.services.tool_dispatcher import _handle_search_documents, ToolContext


@pytest.mark.asyncio
async def test_search_documents_exception_returns_structured_error_citation():
    """When search_documents raises, ToolResult carries an is_error citation object."""
    mock_ctx = MagicMock(spec=ToolContext)
    mock_ctx.current_user = {"id": "user-123"}
    mock_ctx.supabase = MagicMock()
    mock_ctx.user_settings = {}
    mock_ctx.folder_subtree_ids = None
    mock_ctx.run_id = "run-456"

    with patch("app.services.tool_dispatcher.search_documents", AsyncMock(side_effect=Exception("insufficient_quota"))):
        tool_result = await _handle_search_documents({"query": "quarterly earnings"}, mock_ctx)

    assert tool_result is not None
    assert len(tool_result.citations) == 1
    err_cit = tool_result.citations[0]
    assert err_cit["is_error"] is True
    assert err_cit["retrieval_status"] == "provider_error"
    assert "insufficient_quota" in err_cit["detail"]


@pytest.mark.asyncio
async def test_validator_rejects_with_honest_provider_outage_message():
    """_validate_citations_required emits a service outage message when error citation is present."""
    output = {
        "text": "Based on the documents, revenue grew 15%.",
        "citations": [
            {
                "is_error": True,
                "retrieval_status": "provider_error",
                "provider": "openai",
                "detail": "RateLimitError: insufficient_quota",
            }
        ],
    }
    config = {"mode": "retrieved_and_cited", "min_markers": 1}
    ctx = MagicMock()

    result = await _validate_citations_required(output, config, ctx)
    assert not result.passed
    assert "retrieval failed (openai: RateLimitError: insufficient_quota)" in result.error_message
    assert "this is a service outage, not model non-compliance" in result.error_message
    assert "0 sources" not in result.error_message


@pytest.mark.asyncio
async def test_validator_rejects_genuine_zero_results():
    """When search returns genuine 0 sources, standard 0 sources message is used."""
    output = {
        "text": "I could not find anything in your files.",
        "citations": [],
    }
    config = {"mode": "retrieved_and_cited", "min_markers": 1}
    ctx = MagicMock()

    result = await _validate_citations_required(output, config, ctx)
    assert not result.passed
    assert "nothing was retrieved (0 sources)" in result.error_message
    assert "service outage" not in result.error_message


@pytest.mark.asyncio
async def test_validator_passes_when_retrieval_succeeds_and_marker_present():
    """Successful retrieval with citation marker passes."""
    output = {
        "text": "Revenue grew by 15% in Q3 [1].",
        "citations": [
            {
                "document_id": "doc-1",
                "filename": "q3_report.pdf",
                "chunk_index": 0,
                "passage": "Revenue grew 15% in Q3.",
            }
        ],
    }
    config = {"mode": "retrieved_and_cited", "min_markers": 1}
    ctx = MagicMock()

    result = await _validate_citations_required(output, config, ctx)
    assert result.passed
    assert result.error_message is None
