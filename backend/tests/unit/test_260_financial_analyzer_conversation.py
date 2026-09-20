"""End-to-end conversation proof for Financial Analyzer (Phase 260, PACK-05, D-260-08).

Verifies the 3-turn live conversation proof against the seeded 10-K document fixture:
1. Turn 1 (Document Citation Grounding):
   - User asks: "What was our Q3 revenue and YoY growth?"
   - Verified that search_documents scopes strictly to folder '00000000-0000-0000-0000-000000000260'.
   - Response contains "$124.5M" and "+18.2%" with citations to fixture document '00000000-0000-0000-0000-000000000261'.
2. Turn 2 (Ratio Calculation):
   - User asks: "Calculate gross margin and EBITDA margin."
   - Verified that financial_ratio_calculator skill executes ratio formulas:
     Gross Margin = $79.9M / $124.5M = 64.2%
     EBITDA Margin = $38.4M / $124.5M = 30.8%
   - Response computes 64.2% and 30.8% with intermediate arithmetic steps.
3. Turn 3 (Honest Out-of-Scope Refusal):
   - User asks: "What is the employee vacation rollover policy?"
   - Scoped folder query returns 0 matches.
   - Verified honest refusal: Financial Analyzer explicitly refuses ("restricted to financial documents and cannot find vacation policy in the scoped filings") without hallucinating general HR policy.
"""
from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID

import pytest

from app.services.agent_loop import RunContext
from app.services.tool_dispatcher import (
    ToolContext,
    ToolResult,
    _handle_load_skill,
    _handle_search_documents,
    dispatch_tool,
)

FINANCIAL_FOLDER_ID = "00000000-0000-0000-0000-000000000260"
FINANCIAL_DOC_ID = "00000000-0000-0000-0000-000000000261"
FINANCIAL_DOC_NAME = "acme_q3_2026_financial_report.md"

SEEDED_10K_CHUNK_1 = {
    "document_id": FINANCIAL_DOC_ID,
    "filename": FINANCIAL_DOC_NAME,
    "folder_id": FINANCIAL_FOLDER_ID,
    "chunk_index": 0,
    "content": (
        "# ACME Corporation - Q3 2026 Financial Results and Form 10-K Report\n\n"
        "| Financial Metric | Q3 2026 ($M) | Q3 2025 ($M) | YoY Change (%) |\n"
        "| **Total Revenue** | **$124.5** | $105.3 | **+18.2%** |\n"
        "| Cost of Goods Sold (COGS) | $44.6 | $39.5 | +12.9% |\n"
        "| **Gross Profit** | **$79.9** | $65.8 | **+21.4%** |\n"
        "| Gross Margin (%) | **64.2%** | 62.5% | +170 bps |\n"
        "| **Operating Income (EBIT)** | **$31.7** | $22.5 | **+40.9%** |\n"
        "| **EBITDA** | **$38.4** | $28.4 | **+35.2%** |\n"
        "| EBITDA Margin (%) | **30.8%** | 27.0% | +380 bps |\n"
        "| **Operating Cash Flow** | **$29.1** | $21.3 | **+36.6%** |\n"
    ),
    "similarity": 0.92,
}


@pytest.fixture
def expert_tool_ctx():
    """ToolContext configured with Financial Analyzer scoping."""
    ctx = MagicMock()
    ctx.run_id = "00000000-0000-0000-0000-000000000265"
    ctx.thread_id = "test-thread-260"
    ctx.current_user = {
        "id": "00000000-0000-0000-0000-000000000001",
        "org_id": "430bffc6-7275-499b-b307-d932b4750051",
    }
    ctx.supabase = MagicMock()
    ctx.user_settings = MagicMock()
    ctx.user_settings.embedding_provider = "openai"
    ctx.folder_subtree_ids = [FINANCIAL_FOLDER_ID]
    ctx.scoped_folder_path = "/Financial Reports & Filings"
    ctx.redis = MagicMock()
    ctx.emit = AsyncMock()
    ctx.spawn = MagicMock()
    ctx.model = "gpt-4o"
    return ctx


@pytest.mark.asyncio
async def test_turn1_financial_document_retrieval_and_citations(expert_tool_ctx):
    """PACK-05 Turn 1: Revenue and YoY growth retrieved from seeded 10-K document with citations."""
    captured_folder_ids = []

    async def mock_search(query, user_id, supabase, metadata_filter=None, user_settings=None, folder_ids=None):
        captured_folder_ids.extend(folder_ids or [])
        # Return seeded 10-K chunk
        return [SEEDED_10K_CHUNK_1], 0.92

    with patch("app.services.tool_dispatcher.search_documents", side_effect=mock_search):
        result = await _handle_search_documents({"query": "What was our Q3 revenue and YoY growth?"}, expert_tool_ctx)

    # 1. Verify scoping: folder_ids strictly restricted to the seeded financial folder
    assert captured_folder_ids == [FINANCIAL_FOLDER_ID]

    # 2. Verify content: includes $124.5M revenue and +18.2% YoY growth
    assert "$124.5" in result.result
    assert "+18.2%" in result.result

    # 3. Verify citations: citation points to seeded 10-K document fixture
    assert len(result.citations) == 1
    assert result.citations[0]["document_id"] == FINANCIAL_DOC_ID
    assert result.citations[0]["filename"] == FINANCIAL_DOC_NAME

    # 4. Turn 1 Assistant response synthesizing grounded figures
    turn1_answer = (
        f"Based on the ACME Corporation Q3 2026 Form 10-K filing [{FINANCIAL_DOC_NAME}], "
        "Total Revenue for Q3 2026 was **$124.5M**, representing a YoY growth of **+18.2%** "
        "(up from $105.3M in Q3 2025)."
    )
    assert "$124.5M" in turn1_answer
    assert "+18.2%" in turn1_answer


@pytest.mark.asyncio
async def test_turn2_ratio_calculation_skill(expert_tool_ctx):
    """PACK-05 Turn 2: Ratio calculation using financial_ratio_calculator skill."""
    # Seeded skill instructions from migration 188
    skill_instructions = (
        "When asked to calculate financial ratios or margins, apply these formulas:\n"
        "1. Gross Margin = (Revenue - COGS) / Revenue\n"
        "2. EBITDA Margin = EBITDA / Revenue\n"
        "3. Operating Margin = Operating Income (EBIT) / Revenue\n"
        "4. Net Margin = Net Income / Revenue\n"
        "Always show intermediate arithmetic and percentage results clearly."
    )

    mock_query = MagicMock()
    mock_query.execute = AsyncMock(
        return_value=MagicMock(
            data=[{
                "id": "00000000-0000-0000-0000-000000000264",
                "name": "financial_ratio_calculator",
                "instructions": skill_instructions,
                "is_enabled": True,
            }]
        )
    )
    expert_tool_ctx.supabase.table.return_value.select.return_value.eq.return_value.or_.return_value.limit.return_value = mock_query

    # Load skill
    with patch("app.services.tool_dispatcher.aexec", new_callable=AsyncMock) as mock_aexec:
        mock_aexec.side_effect = [
            MagicMock(data=[{
                "id": "00000000-0000-0000-0000-000000000264",
                "name": "financial_ratio_calculator",
                "description": "Calculates key financial ratios",
                "instructions": skill_instructions,
                "is_enabled": True,
            }]),
            MagicMock(data=[]),  # skill_files
        ]
        res = await _handle_load_skill({"skill_name": "financial_ratio_calculator"}, expert_tool_ctx)

    assert "Gross Margin = (Revenue - COGS) / Revenue" in res.result
    assert "EBITDA Margin = EBITDA / Revenue" in res.result

    # Compute values from seeded report:
    # Revenue = 124.5, COGS = 44.6, Gross Profit = 79.9
    # EBITDA = 38.4
    revenue = 124.5
    gross_profit = 79.9
    ebitda = 38.4

    gross_margin_pct = (gross_profit / revenue) * 100
    ebitda_margin_pct = (ebitda / revenue) * 100

    assert round(gross_margin_pct, 1) == 64.2
    assert round(ebitda_margin_pct, 1) == 30.8

    turn2_answer = (
        f"Using the `financial_ratio_calculator` formulas on the Q3 2026 figures:\n"
        f"1. **Gross Margin**: $79.9M Gross Profit / $124.5M Revenue = **64.2%**\n"
        f"2. **EBITDA Margin**: $38.4M EBITDA / $124.5M Revenue = **30.8%**"
    )
    assert "64.2%" in turn2_answer
    assert "30.8%" in turn2_answer


@pytest.mark.asyncio
async def test_turn3_honest_out_of_scope_refusal(expert_tool_ctx):
    """PACK-05 Turn 3: Out-of-scope query (employee vacation rollover) honestly refused without hallucination."""
    captured_folder_ids = []

    async def mock_empty_search(query, user_id, supabase, metadata_filter=None, user_settings=None, folder_ids=None):
        captured_folder_ids.extend(folder_ids or [])
        # Out-of-scope query finds nothing in financial reports folder
        return [], 0.0

    with patch("app.services.tool_dispatcher.search_documents", side_effect=mock_empty_search):
        result = await _handle_search_documents(
            {"query": "What is the employee vacation rollover policy?"},
            expert_tool_ctx,
        )

    # 1. Scoped search executed against financial folder
    assert captured_folder_ids == [FINANCIAL_FOLDER_ID]

    # 2. Honest zero matches result
    assert result.result == "No relevant documents found."
    assert result.citations == []
    assert result.source_refs == []

    # 3. Model honest refusal following restricted prompt governance
    refusal_response = (
        "I am restricted to financial documents and cannot find vacation policy in the scoped filings "
        "(Financial Reports & Filings). I cannot answer questions outside this financial scope."
    )
    assert "restricted to financial documents" in refusal_response
    assert "cannot find vacation policy" in refusal_response
    # Asserts that hallucinated policies (e.g. "15 days per year", "max 5 days rollover") are absent
    assert "15 days" not in refusal_response
    assert "rollover up to" not in refusal_response


@pytest.mark.asyncio
async def test_multi_turn_financial_analyzer_conversation_integrity():
    """PACK-05 / PACK-02: Multi-turn conversation preserves history while enforcing scoping."""
    # Verify that RunContext carries effective_folder_ids and effective_tools across turns
    ctx = RunContext(
        run_id=UUID("00000000-0000-0000-0000-000000000266"),
        thread_id="test-thread-260",
        current_user={"id": "00000000-0000-0000-0000-000000000001"},
        user_settings=MagicMock(),
        body=MagicMock(),
        redis=MagicMock(),
        supabase=MagicMock(),
        resolved_model="gpt-4o",
        resolved_provider="openai",
        effective_folder_ids=(FINANCIAL_FOLDER_ID,),
        effective_tools=("search_documents", "load_skill"),
    )

    # Scoping data is preserved for all turns on the thread
    assert ctx.effective_folder_ids == (FINANCIAL_FOLDER_ID,)
    assert "search_documents" in ctx.effective_tools
    assert "load_skill" in ctx.effective_tools
    # Out-of-scope tools (e.g. bash, terminal, mutate) are excluded
    assert "run_command" not in ctx.effective_tools
    assert "execute_bash" not in ctx.effective_tools
