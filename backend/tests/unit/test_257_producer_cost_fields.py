"""Static and behavioral fences ensuring SC#4 producer lockstep (WR-01, WR-08).

Guards MessageResponse and WorkflowRunRead schemas against dropped cost fields,
guards both endpoint SELECT queries against dropping input_tokens/output_tokens
in actual AST call arguments (immune to comments, Plant C), and verifies end-to-end
population of cost_usd and is_rated (immune to null-stamping, Plant B).
"""

from decimal import Decimal
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4
import ast

import pytest

from app.models.message import MessageResponse
from app.api.workflow_runs import WorkflowRunRead


def test_message_response_declares_the_cost_fields():
    """MessageResponse must include cost_usd and is_rated for chat turn badges."""
    assert {"cost_usd", "is_rated"} <= set(MessageResponse.model_fields)


def test_workflow_run_read_declares_the_cost_fields():
    """WorkflowRunRead must include model, cost_usd, is_rated, token_coverage."""
    assert {"model", "cost_usd", "is_rated", "token_coverage"} <= set(WorkflowRunRead.model_fields)


def test_enrich_messages_with_runs_selects_tokens_in_ast():
    """WR-08 / Plant C: assert input_tokens, output_tokens are in the actual AST .select() argument, not in comments."""
    threads_path = Path(__file__).resolve().parent.parent.parent / "app" / "api" / "threads.py"
    tree = ast.parse(threads_path.read_text(encoding="utf-8"))
    select_literals = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Call):
            if isinstance(node.func, ast.Attribute) and node.func.attr == "select":
                for arg in node.args:
                    if isinstance(arg, ast.Constant) and isinstance(arg.value, str):
                        select_literals.append(arg.value)
    assert any("input_tokens" in lit and "output_tokens" in lit for lit in select_literals), (
        "threads.py must pass input_tokens and output_tokens inside an actual .select() call argument"
    )


def test_workflow_runs_selects_tokens_in_ast():
    """WR-08 / Plant C: assert input_tokens, output_tokens are in the actual AST .select() argument in workflow_runs.py."""
    wf_path = Path(__file__).resolve().parent.parent.parent / "app" / "api" / "workflow_runs.py"
    tree = ast.parse(wf_path.read_text(encoding="utf-8"))
    select_literals = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Call):
            if isinstance(node.func, ast.Attribute) and node.func.attr == "select":
                for arg in node.args:
                    if isinstance(arg, ast.Constant) and isinstance(arg.value, str):
                        select_literals.append(arg.value)
    assert any("input_tokens" in lit and "output_tokens" in lit for lit in select_literals), (
        "workflow_runs.py must explicitly pass input_tokens and output_tokens inside a .select() call argument"
    )


@pytest.mark.asyncio
async def test_enrich_messages_with_runs_populates_cost_behavioral(monkeypatch):
    """WR-08 / Plant B: behavioral fence asserting producer fields are actually POPULATED with values."""
    from app.api.threads import _enrich_messages_with_runs
    from app.services.pricing_service import ModelRate

    now = datetime(2026, 9, 19, 12, 0, tzinfo=timezone.utc)
    mock_supabase = MagicMock()
    mock_run_row = {
        "message_id": "msg-123",
        "run_id": "run-456",
        "status": "completed",
        "model": "gpt-4o",
        "provider": "openai",
        "started_at": now.isoformat(),
        "completed_at": now.isoformat(),
        "input_tokens": 1000,
        "output_tokens": 500,
        "org_id": None,
    }
    mock_resp = MagicMock()
    mock_resp.data = [mock_run_row]

    # Mock supabase fluent query chain
    mock_table = MagicMock()
    mock_supabase.table.return_value = mock_table
    mock_table.select.return_value = mock_table
    mock_table.eq.return_value = mock_table
    mock_table.is_.return_value = mock_table
    mock_table.order.return_value = mock_table

    async def mock_aexec(query):
        return mock_resp

    monkeypatch.setattr("app.api.threads.aexec", mock_aexec)

    mock_pool = AsyncMock()
    monkeypatch.setattr("app.api.threads.get_pg_pool", AsyncMock(return_value=mock_pool))

    mock_rate = ModelRate(
        id=uuid4(),
        model_id="gpt-4o",
        provider="openai",
        input_cost_per_million=Decimal("2.500000"),
        output_cost_per_million=Decimal("10.000000"),
        effective_from=now,
        org_id=None,
    )
    monkeypatch.setattr("app.db.rates.get_rate_history_for_models", AsyncMock(return_value=[mock_rate]))

    messages = [{"id": "msg-123"}]
    out = await _enrich_messages_with_runs(
        messages=messages,
        thread_id=uuid4(),
        user_id=str(uuid4()),
        supabase=mock_supabase,
    )

    assert len(out) == 1
    assert out[0]["is_rated"] is True
    # 1000 * 2.5 / 1e6 = 0.0025; 500 * 10 / 1e6 = 0.0050; total = 0.0075
    assert out[0]["cost_usd"] == pytest.approx(0.0075)
    assert out[0]["model"] == "gpt-4o"

