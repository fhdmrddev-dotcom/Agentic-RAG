"""Phase 210 Plan 03 unit/integration tests — RAG-09 Failure Honesty (Post-Review Fix).

Verifies:
1. When search_documents fails, ToolResult carries structured retrieval_error with provider name,
   and citations/source_refs stay strictly EMPTY (never populated with pseudo-citation error objects).
2. Citation deduplication (_deduplicate_citations) runs cleanly over citations without KeyError('document_id').
3. run_task_sub_agent harvests and returns retrieval_error alongside summary and citations.
4. _validate_citations_required identifies provider failure from output['retrieval_error'] and names the provider.
5. Genuine zero matches (no error) produces the standard 0 sources rejection.
6. Successful retrieval with markers passes normally.
"""
from unittest.mock import AsyncMock, MagicMock, patch
import pytest

from app.services.citation_markers import _deduplicate_citations
from app.services.harness.validator_kinds import _validate_citations_required
from app.services.task_service import run_task_sub_agent
from app.services.tool_dispatcher import _handle_search_documents, ToolContext, ToolResult


@pytest.mark.asyncio
async def test_search_documents_exception_returns_retrieval_error_with_clean_citations():
    """When search_documents raises, ToolResult carries retrieval_error and citations is empty."""
    mock_ctx = MagicMock(spec=ToolContext)
    mock_ctx.current_user = {"id": "user-123"}
    mock_ctx.supabase = MagicMock()
    mock_ctx.user_settings = MagicMock()
    mock_ctx.user_settings.embedding_provider = "openai"
    mock_ctx.folder_subtree_ids = None
    mock_ctx.run_id = "run-456"

    with patch("app.services.tool_dispatcher.search_documents", AsyncMock(side_effect=Exception("insufficient_quota"))):
        tool_result = await _handle_search_documents({"query": "quarterly earnings"}, mock_ctx)

    assert isinstance(tool_result, ToolResult)
    # ⚠ V-1 / V-3: citations and source_refs MUST be empty list, never error objects
    assert tool_result.citations == []
    assert tool_result.source_refs == []

    # ⚠ V-2: provider is explicitly named
    assert tool_result.retrieval_error is not None
    assert tool_result.retrieval_error["provider"] == "openai"
    assert tool_result.retrieval_error["retrieval_status"] == "provider_error"
    assert "insufficient_quota" in tool_result.retrieval_error["detail"]

    # ⚠ V-1: Deduplication MUST NOT raise KeyError
    deduped = _deduplicate_citations(tool_result.citations)
    assert deduped == []


@pytest.mark.asyncio
async def test_task_service_harvests_retrieval_error():
    """run_task_sub_agent harvests tr.retrieval_error and returns it in the result dict."""
    parent_ctx = MagicMock(spec=ToolContext)
    parent_ctx.redis = MagicMock()
    parent_ctx.run_id = "00000000-0000-0000-0000-000000000002"
    parent_ctx.current_user = {"id": "00000000-0000-0000-0000-000000000003"}
    parent_ctx.user_settings = MagicMock()
    parent_ctx.user_settings.embedding_provider = "openai"
    parent_ctx.user_settings.sub_agent_model = "gpt-4o"
    parent_ctx.model = "gpt-4o"
    parent_ctx.thread_id = "00000000-0000-0000-0000-000000000001"
    parent_ctx.pool = MagicMock()
    parent_ctx.supabase = MagicMock()
    parent_ctx.spawn = MagicMock()
    parent_ctx.emit = AsyncMock()
    parent_ctx.scoped_folder_path = None
    parent_ctx.folder_subtree_ids = None
    parent_ctx.dead_gap_tokens_in_run = set()
    parent_ctx.skill_instructions_override = None
    parent_ctx.phase_whitelist = None
    parent_ctx.workflow_run_id = None
    parent_ctx.skill_snapshot = None
    parent_ctx.per_run_task_semaphore = None
    parent_ctx.parent_run_id = None

    tool_call_item = {
        "id": "call_1",
        "name": "search_documents",
        "arguments": '{"query": "revenue"}',
    }

    mock_stream_result = (
        "Search failed",
        [tool_call_item],
    )
    mock_stream_result_final = (
        "Based on the documents, search is unavailable.",
        [],
    )

    with patch("app.services.task_service._stream_one_iteration", AsyncMock(side_effect=[mock_stream_result, mock_stream_result_final])), \
         patch("app.services.tool_dispatcher.search_documents", AsyncMock(side_effect=Exception("insufficient_quota"))), \
         patch("app.services.task_service.insert_run", AsyncMock()), \
         patch("app.services.task_service.finalize_run", AsyncMock()), \
         patch("app.services.task_service._emit_terminal", AsyncMock(), create=True):
        res = await run_task_sub_agent(
            parent_ctx=parent_ctx,
            description="Find revenue",
            instructions=None,
            allowed_tools=["search_documents"],
            max_steps=3,
        )

    assert res["citations"] == []
    assert res["source_refs"] == []
    assert res["retrieval_error"] is not None
    assert res["retrieval_error"]["provider"] == "openai"
    assert "insufficient_quota" in res["retrieval_error"]["detail"]


@pytest.mark.asyncio
async def test_validator_rejects_with_honest_provider_outage_message():
    """_validate_citations_required emits a service outage message naming the provider."""
    output = {
        "text": "Based on the documents, search was unavailable.",
        "citations": [],
        "retrieval_error": {
            "provider": "openai",
            "retrieval_status": "provider_error",
            "detail": "RateLimitError: insufficient_quota",
        },
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
    """When search returns genuine 0 sources (no retrieval_error), standard 0 sources message is used."""
    output = {
        "text": "I could not find anything in your files.",
        "citations": [],
        "retrieval_error": None,
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
        "retrieval_error": None,
    }
    config = {"mode": "retrieved_and_cited", "min_markers": 1}
    ctx = MagicMock()

    result = await _validate_citations_required(output, config, ctx)
    assert result.passed
    assert result.error_message is None


@pytest.mark.asyncio
async def test_exec_llm_agent_forwards_retrieval_error_to_gate():
    """_exec_llm_agent threads retrieval_error into its output dict and the gate catches it."""
    from app.services.harness.phase_types import _exec_llm_agent

    mock_phase = MagicMock()
    mock_phase.slug = "research_phase"
    mock_phase.config = MagicMock()
    mock_phase.config.prompt = "Find quarterly results"
    mock_phase.config.allowed_tools = ["search_documents"]
    mock_phase.config.tools_budget = 5
    mock_phase.config.max_steps = 3
    mock_phase.config.skill_snapshot = None
    mock_phase.validators = []

    mock_ctx = MagicMock()
    mock_ctx.prior_run = None
    mock_ctx.folder_subtree_ids = None
    mock_ctx.user_settings = MagicMock()
    mock_ctx.user_settings.embedding_provider = "openai"

    sub_agent_ret = {
        "sub_run_id": "sub-123",
        "summary": "Search provider failed with rate limit",
        "status": "completed",
        "source_refs": [],
        "citations": [],
        "similarity_scores": [],
        "input_tokens": 100,
        "output_tokens": 50,
        "retrieval_error": {
            "provider": "openai",
            "retrieval_status": "provider_error",
            "detail": "RateLimitError: insufficient_quota",
        },
    }

    with patch("app.services.harness.phase_types.run_task_sub_agent", AsyncMock(return_value=sub_agent_ret)), \
         patch("app.services.harness.phase_types._record_run_usage"):
        phase_output = await _exec_llm_agent(mock_phase, {}, mock_ctx)

    assert phase_output["citations"] == []
    assert phase_output["source_refs"] == []
    assert phase_output["retrieval_error"] is not None
    assert phase_output["retrieval_error"]["provider"] == "openai"

    # Now pass phase_output to the gate
    gate_res = await _validate_citations_required(
        phase_output,
        {"mode": "retrieved_and_cited", "min_markers": 1},
        mock_ctx,
    )
    assert not gate_res.passed
    assert "retrieval failed (openai: RateLimitError: insufficient_quota)" in gate_res.error_message
    assert "this is a service outage, not model non-compliance" in gate_res.error_message


def test_deduplication_and_downstream_consumers_safe_from_keyerror():
    """_deduplicate_citations from both citation_markers and agent_loop handle phase_output citations cleanly."""
    from app.services.citation_markers import _deduplicate_citations as cm_dedup
    from app.services.agent_loop import _deduplicate_citations as al_dedup

    # 1. Output from a provider failure (empty list)
    assert cm_dedup([]) == []
    assert al_dedup([]) == []

    # 2. Output from successful citations
    valid_cits = [
        {"document_id": "doc-1", "chunk_index": 0, "passage": "P1"},
        {"document_id": "doc-1", "chunk_index": 0, "passage": "P1 duplicate"},
        {"document_id": "doc-2", "chunk_index": 1, "passage": "P2"},
    ]
    assert len(cm_dedup(valid_cits)) == 2
    assert len(al_dedup(valid_cits)) == 2
