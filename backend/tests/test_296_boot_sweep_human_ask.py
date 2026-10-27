"""Phase 296-02 (BUG-261025-03, backend half / D-24) — a boot never re-asks a waiting person.

MEASURED in the local DB for run ``1e932094`` (296-RESEARCH F5): THREE unanswered
``ask_user_prompt`` rows for one ``llm_human_input`` step, each with a new
``tool_call_id``, minted by successive boots. The cause: ``resume_stranded_workflows``
classified a human-input step by ``active["config"]`` / ``active["output"]["tool_call_id"]``,
and the REAL ``get_active_phase`` row carries neither (it selects ``id, slug, phase_index,
status, output, started_at, completed_at``; the executor writes ``tool_call_id`` only when it
RETURNS). So the human branch was dead, every boot fell through to ``_resume_run``, and
``_exec_llm_human_input`` minted a fresh prompt row.

Every fake here is built from the REAL row shape (no ``config`` key, ``output`` None for a
step still waiting). The step's type is legible only on the DEFINITION, the same way
``_is_armed_action_risk`` reads arming.
"""
from __future__ import annotations

import asyncio
from contextlib import ExitStack
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

SLUG = "approve"
PROMPT = "Approve the draft?"
OPTIONS = ["Approve", "Reject"]


def _real_active_row():
    """Exactly the keys ``db.workflows.get_active_phase`` selects (no ``config``)."""
    return {"id": uuid4(), "slug": SLUG, "phase_index": 1, "status": "active",
            "output": None, "started_at": None, "completed_at": None}


def _definition():
    spec = SimpleNamespace(
        slug=SLUG,
        config=SimpleNamespace(phase_type="llm_human_input", prompt=PROMPT, options=OPTIONS,
                               timeout_seconds=600),
        action_risk_armed=False,
    )
    return SimpleNamespace(phases=[spec])


def _sweep(answer, *, run_status="paused"):
    """One paused run waiting on an ``llm_human_input`` step; ``answer`` None = unanswered."""
    from app.services import harness_engine

    run_id = uuid4()
    built = SimpleNamespace(producer_run_id=None, org_id=None,
                            resume_answered_tool_call_id=None)
    seen: dict = {}

    async def _resume(rid, definition, ctx, *, pool, redis):
        seen["flag"] = ctx.resume_answered_tool_call_id

    mocks = {
        "find_resumable_runs": AsyncMock(return_value=[
            {"run_id": run_id, "thread_id": uuid4(), "user_id": uuid4(), "status": run_status}]),
        "claim_run": AsyncMock(return_value=True),
        "get_active_phase": AsyncMock(return_value=_real_active_row()),
        "_load_run_definition": AsyncMock(return_value=_definition()),
        "get_pending_ask_user": AsyncMock(return_value={
            "tool_call_id": "tc-hi", "prompt": PROMPT, "options": OPTIONS,
            "timeout_seconds": 600}),
        "ask_user_response_exists": AsyncMock(return_value=answer is not None),
        "get_ask_user_response": AsyncMock(return_value=answer),
        "resume_pending_prompt": AsyncMock(),
        "_build_resume_context": AsyncMock(return_value=built),
        "_resume_run": AsyncMock(side_effect=_resume),
        "_expire_pending_ask_user": AsyncMock(),
        "pause_run": AsyncMock(),
        "resume_run": AsyncMock(),
    }
    with ExitStack() as stack:
        for name, mock in mocks.items():
            stack.enter_context(patch.object(harness_engine, name, mock, create=True))
        resumed = asyncio.run(
            harness_engine.resume_stranded_workflows(pool=object(), redis=object()))
    return resumed, mocks, seen


def test_an_unanswered_human_ask_stays_paused_and_nothing_is_re_asked():
    resumed, m, _seen = _sweep(None)
    assert resumed == 0
    m["_resume_run"].assert_not_awaited()  # no re-drive → no fresh prompt row minted
    m["resume_pending_prompt"].assert_not_awaited()
    m["pause_run"].assert_awaited_once()  # releases the claim just taken


def test_an_answered_human_ask_is_consumed_never_re_asked():
    resumed, m, seen = _sweep({"response_text": "Approve", "choice_index": 0,
                               "prompt": PROMPT})
    assert resumed == 1
    m["_resume_run"].assert_awaited_once()
    m["pause_run"].assert_not_awaited()
    assert seen["flag"] == "tc-hi", "the re-drive must carry the answered id to consume"


def test_the_executor_consumes_the_flag_without_minting_a_prompt_row():
    """The answered arm's other half: with the flag set, ``_exec_llm_human_input`` returns
    the durable answer and inserts NO ``ask_user_prompt`` row."""
    from app.services.harness import human_input

    supabase = MagicMock()
    ctx = SimpleNamespace(
        run_id=uuid4(), redis=None, pool=object(), supabase=supabase,
        current_user={"id": str(uuid4())}, thread_id=str(uuid4()),
        resume_answered_tool_call_id="tc-hi", is_golden_run=False,
    )
    phase = _definition().phases[0]
    durable = {"response_text": "Approve", "choice_index": 0, "prompt": PROMPT}
    with patch("app.db.workflows.get_ask_user_response", AsyncMock(return_value=durable)):
        out = asyncio.run(human_input._exec_llm_human_input(phase, {}, ctx))
    assert out["tool_call_id"] == "tc-hi"
    assert out["answer"] == "Approve"
    supabase.table.assert_not_called()


def test_no_prompt_row_yet_falls_through_to_the_ordinary_re_drive():
    """A crash BEFORE the prompt insert leaves nothing to wait on: the step asks (once)."""
    from app.services import harness_engine

    run_id = uuid4()
    built = SimpleNamespace(producer_run_id=None, org_id=None,
                            resume_answered_tool_call_id=None)
    mocks = {
        "find_resumable_runs": AsyncMock(return_value=[
            {"run_id": run_id, "thread_id": uuid4(), "user_id": uuid4()}]),
        "claim_run": AsyncMock(return_value=True),
        "get_active_phase": AsyncMock(return_value=_real_active_row()),
        "_load_run_definition": AsyncMock(return_value=_definition()),
        "get_pending_ask_user": AsyncMock(return_value=None),
        "ask_user_response_exists": AsyncMock(return_value=False),
        "get_ask_user_response": AsyncMock(return_value=None),
        "resume_pending_prompt": AsyncMock(),
        "_build_resume_context": AsyncMock(return_value=built),
        "_resume_run": AsyncMock(),
        "pause_run": AsyncMock(),
        "resume_run": AsyncMock(),
    }
    with ExitStack() as stack:
        for name, mock in mocks.items():
            stack.enter_context(patch.object(harness_engine, name, mock, create=True))
        resumed = asyncio.run(
            harness_engine.resume_stranded_workflows(pool=object(), redis=object()))
    assert resumed == 1
    mocks["pause_run"].assert_not_awaited()
    assert built.resume_answered_tool_call_id is None
