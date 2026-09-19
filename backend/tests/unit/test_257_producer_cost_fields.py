"""Static fence ensuring SC#4 producer lockstep (WR-01).

Guards MessageResponse and WorkflowRunRead schemas against dropped cost fields,
and guards both endpoint SELECT queries against dropping input_tokens/output_tokens.
"""

from pathlib import Path
import ast
from app.models.message import MessageResponse
from app.api.workflow_runs import WorkflowRunRead


def test_message_response_declares_the_cost_fields():
    """MessageResponse must include cost_usd and is_rated for chat turn badges."""
    assert {"cost_usd", "is_rated"} <= set(MessageResponse.model_fields)


def test_workflow_run_read_declares_the_cost_fields():
    """WorkflowRunRead must include model, cost_usd, is_rated, token_coverage."""
    assert {"model", "cost_usd", "is_rated", "token_coverage"} <= set(WorkflowRunRead.model_fields)


def test_enrich_messages_with_runs_selects_tokens():
    """_enrich_messages_with_runs must explicitly SELECT input_tokens, output_tokens."""
    threads_path = Path(__file__).resolve().parent.parent.parent / "app" / "api" / "threads.py"
    content = threads_path.read_text(encoding="utf-8")
    assert "input_tokens, output_tokens" in content, (
        "threads.py _enrich_messages_with_runs must explicitly select input_tokens, output_tokens"
    )


def test_workflow_runs_selects_tokens():
    """get_workflow_run must explicitly SELECT input_tokens, output_tokens."""
    wf_path = Path(__file__).resolve().parent.parent.parent / "app" / "api" / "workflow_runs.py"
    content = wf_path.read_text(encoding="utf-8")
    assert "input_tokens, output_tokens" in content, (
        "workflow_runs.py get_workflow_run must explicitly select input_tokens, output_tokens"
    )
