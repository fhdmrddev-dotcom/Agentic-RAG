"""Unit tests for Phase 198: Node Vocabulary (Research-First).

Covers:
- NODE-01: Deterministic Reshape Invariant & JSONB unwrap scanner.
- NODE-02: Structured Mid-Run Human Input timeout, choices resolution, and pause mechanics (BUG-260816-06).
"""
import asyncio
import json
import re
import pytest

from app.services.harness.human_input import (
    HumanInputTimeout,
    _resolve_answer_text,
    _latest_phase_text,
)

# ── NODE-01: Reshape Invariant & Classification Sweeper ───────────────────────

RESHAPE_VERB_REGEX = re.compile(
    r"\b(reformat|convert|transform|restructure|reshape|serial|json|csv|normali|flatten|rename)\b",
    re.IGNORECASE,
)

CONTROL_VERB_REGEX = re.compile(
    r"\b(search|summar|synthesize|extract|generate|review|analyze|draft)\b",
    re.IGNORECASE,
)


def is_pure_reshape_prompt(prompt: str) -> bool:
    """Classify whether a prompt exists solely to reshape data without real domain work."""
    if not prompt or not prompt.strip():
        return False
    text = prompt.strip().lower()
    has_reshape = bool(RESHAPE_VERB_REGEX.search(text))
    has_domain = bool(CONTROL_VERB_REGEX.search(text))
    # A pure reshape prompt has reshape instructions but zero domain retrieval/synthesis
    return has_reshape and not has_domain


def unwrap_definition_json(raw_definition) -> dict:
    """Unwrap workflow definition JSONB whether stored as string scalar or dict object."""
    if isinstance(raw_definition, str):
        try:
            return json.loads(raw_definition)
        except Exception:
            return {}
    if isinstance(raw_definition, dict):
        return raw_definition
    return {}


def test_node_01_reshape_verb_classifier_positive_control():
    """Verify scanner correctly identifies synthetic reshape-only plumbing prompts."""
    pure_reshapes = [
        "Convert the output JSON to CSV format without making any changes to content.",
        "Reformat and flatten the dictionary keys into a list.",
        "Transform the raw json payload into a restructured serial table.",
    ]
    for prompt in pure_reshapes:
        assert is_pure_reshape_prompt(prompt) is True, f"Failed on: {prompt}"


def test_node_01_reshape_verb_classifier_negative_domain_prompts():
    """Verify real domain prompts (search, summarize, analyze) are not classified as pure reshape."""
    real_prompts = [
        "Search the knowledge base for Northwind Logistics support history and summarize findings.",
        "Using the gathered evidence, write the content for a quarterly business review.",
        "Analyze the statistical elements and extract key revenue figures.",
        "Draft an email response to the customer based on support documentation.",
    ]
    for prompt in real_prompts:
        assert is_pure_reshape_prompt(prompt) is False, f"Failed on: {prompt}"


def test_node_01_jsonb_unwrap_string_and_object():
    """Verify unwrap handles both raw dicts and double-encoded string scalars robustly."""
    obj_def = {"name": "Test Workflow", "phases": [{"slug": "p1", "phase_type": "llm_generate"}]}
    str_def = json.dumps(obj_def)

    assert unwrap_definition_json(obj_def)["name"] == "Test Workflow"
    assert unwrap_definition_json(str_def)["name"] == "Test Workflow"
    assert len(unwrap_definition_json(str_def)["phases"]) == 1
    assert unwrap_definition_json(None) == {}


# ── NODE-02: Structured Mid-Run Human Input & Timeout Pause (BUG-260816-06) ───

def test_node_02_human_input_timeout_exception_contract():
    """Verify HumanInputTimeout contract: carries metadata and is NOT asyncio.CancelledError."""
    exc = HumanInputTimeout(tool_call_id="call_123", timeout_seconds=300)
    
    assert exc.tool_call_id == "call_123"
    assert exc.timeout_seconds == 300
    assert "no answer after 300s" in str(exc)
    assert "paused and stays resumable" in str(exc)
    assert not isinstance(exc, asyncio.CancelledError)


def test_node_02_resolve_answer_text_direct_string():
    """Verify typed response_text takes precedence over choice index."""
    res = _resolve_answer_text(
        response_text="Custom author revision",
        choice_index=0,
        options=["Approve", "Reject"],
    )
    assert res == "Custom author revision"


def test_node_02_resolve_answer_text_choice_index():
    """Verify choice_index maps to matching option when response_text is empty."""
    options = ["Approve Draft", "Request Revision", "Reject Entirely"]
    
    assert _resolve_answer_text("", 0, options) == "Approve Draft"
    assert _resolve_answer_text(None, 1, options) == "Request Revision"
    assert _resolve_answer_text("   ", 2, options) == "Reject Entirely"


def test_node_02_resolve_answer_text_invalid_choice_index():
    """Verify invalid or out-of-bounds choice_index degrades safely to empty string."""
    options = ["Yes", "No"]
    
    assert _resolve_answer_text("", 99, options) == ""
    assert _resolve_answer_text("", -1, options) == ""
    assert _resolve_answer_text("", "invalid", options) == ""
    assert _resolve_answer_text("", None, options) == ""


def test_node_02_latest_phase_text_extraction():
    """Verify _latest_phase_text extracts the upstream draft text for the human gate."""
    accumulated = {
        "retrieve": {"citations": ["c1", "c2"]},
        "draft": {"text": "Here is the generated QBR report content."},
        "stats": {"count": 42},
    }
    assert _latest_phase_text(accumulated) == "Here is the generated QBR report content."
    assert _latest_phase_text({}) == ""
    assert _latest_phase_text({"step1": {"other": "value"}}) == ""


@pytest.mark.asyncio
async def test_node_02_golden_run_mock_bypass_with_options():
    """SEED-164: _exec_llm_human_input auto-continues with options[0] during golden runs."""
    from types import SimpleNamespace
    from app.services.harness.human_input import _exec_llm_human_input

    phase = SimpleNamespace(
        config=SimpleNamespace(
            prompt="Choose direction",
            options=["Proceed with Option A", "Proceed with Option B"],
            timeout_seconds=300,
        )
    )
    ctx = SimpleNamespace(is_golden_run=True, run_id=None)

    res = await _exec_llm_human_input(phase, accumulated_outputs={}, ctx=ctx)
    assert res["text"] == "Choose direction"
    assert res["answer"] == "Proceed with Option A"
    assert res["_golden_run_mock"] is True
    assert "tool_call_id" in res


@pytest.mark.asyncio
async def test_node_02_golden_run_mock_bypass_without_options():
    """SEED-164: _exec_llm_human_input auto-continues with 'Approved' when options are empty during golden runs."""
    from types import SimpleNamespace
    from app.services.harness.human_input import _exec_llm_human_input

    phase = SimpleNamespace(
        config=SimpleNamespace(
            prompt="Is this document good to finalize?",
            options=[],
            timeout_seconds=300,
        )
    )
    ctx = SimpleNamespace(is_golden_run=True, run_id=None)

    res = await _exec_llm_human_input(phase, accumulated_outputs={}, ctx=ctx)
    assert res["text"] == "Is this document good to finalize?"
    assert res["answer"] == "Approved"
    assert res["_golden_run_mock"] is True


@pytest.mark.asyncio
async def test_preflight_workflow_kickoff_permits_draft_for_author(monkeypatch):
    """SEED-164: Draft workflows are runnable by their author."""
    from types import SimpleNamespace
    from unittest.mock import AsyncMock, MagicMock
    from app.services.workflow_kickoff import preflight_workflow_kickoff

    user_id = "u-author-1"
    def_id = "wf-draft-1"
    definition = {
        "slug": "test-draft",
        "name": "Test Draft",
        "version": 1,
        "phases": [
            {
                "slug": "p1",
                "name": "Phase 1",
                "phase_index": 0,
                "config": {"phase_type": "llm_single", "prompt": "test"},
            }
        ],
    }

    mock_supabase = MagicMock()
    mock_table = MagicMock()
    mock_select = MagicMock()
    mock_eq = MagicMock()
    mock_or = MagicMock()

    mock_supabase.table.return_value = mock_table
    mock_table.select.return_value = mock_select
    mock_select.eq.return_value = mock_eq
    mock_eq.or_.return_value = mock_or

    mock_query = MagicMock()
    mock_query.execute.return_value = SimpleNamespace(
        data={
            "id": def_id,
            "definition": definition,
            "status": "draft",
            "is_system_global": False,
            "created_by": user_id,
            "skill_snapshots": None,
        }
    )
    mock_or.maybe_single.return_value = mock_query

    body = SimpleNamespace(workflow_definition_id=def_id)
    current_user = {"id": user_id}

    import app.api.threads as threads_mod
    monkeypatch.setattr(threads_mod, "workflows_enabled", lambda: True)
    monkeypatch.setattr(threads_mod, "get_pg_pool", AsyncMock(return_value=MagicMock()))

    import app.services.workflow_kickoff as kickoff_mod
    monkeypatch.setattr(kickoff_mod, "assert_folder_scopes_subset", AsyncMock())
    monkeypatch.setattr(kickoff_mod, "_ensure_skill_snapshots", AsyncMock(side_effect=lambda **kw: kw["definition"]))

    import app.services.template_service as tpl_mod
    monkeypatch.setattr(tpl_mod, "pin_templates_for_run", AsyncMock())

    import uuid
    thread_id = str(uuid.uuid4())

    kickoff_def, kickoff_id = await preflight_workflow_kickoff(
        request=None,
        body=body,
        thread_id=thread_id,
        thread_row=None,
        supabase=mock_supabase,
        current_user=current_user,
    )

    assert kickoff_id == def_id
    assert kickoff_def.slug == "test-draft"


@pytest.mark.asyncio
async def test_preflight_workflow_kickoff_refuses_draft_for_non_author(monkeypatch):
    """SEED-164: Draft workflows cannot be run by someone who is not the author."""
    from types import SimpleNamespace
    from unittest.mock import MagicMock
    from fastapi import HTTPException
    from app.services.workflow_kickoff import preflight_workflow_kickoff

    user_id = "u-stranger"
    def_id = "wf-draft-1"
    definition = {"slug": "test-draft", "name": "Test Draft", "version": 1, "phases": []}

    mock_supabase = MagicMock()
    mock_table = MagicMock()
    mock_select = MagicMock()
    mock_eq = MagicMock()
    mock_or = MagicMock()

    mock_supabase.table.return_value = mock_table
    mock_table.select.return_value = mock_select
    mock_select.eq.return_value = mock_eq
    mock_eq.or_.return_value = mock_or

    mock_query = MagicMock()
    mock_query.execute.return_value = SimpleNamespace(
        data={
            "id": def_id,
            "definition": definition,
            "status": "draft",
            "is_system_global": True,
            "created_by": "u-author-1",
            "skill_snapshots": None,
        }
    )
    mock_or.maybe_single.return_value = mock_query

    body = SimpleNamespace(workflow_definition_id=def_id)
    current_user = {"id": user_id}

    import app.api.threads as threads_mod
    monkeypatch.setattr(threads_mod, "workflows_enabled", lambda: True)

    with pytest.raises(HTTPException) as exc_info:
        await preflight_workflow_kickoff(
            request=None,
            body=body,
            thread_id="t-1",
            thread_row=None,
            supabase=mock_supabase,
            current_user=current_user,
        )
    assert exc_info.value.status_code == 403



