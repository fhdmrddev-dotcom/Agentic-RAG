"""Phase 295, gap fix round 1 (295-09): the BACKEND findings of ``295-REVIEW.md``.

A review is a CLAIM about code, so every finding below is driven by a test written BEFORE its
fix. Each section names the finding it drives, and every assertion reads an observable (a status
code, a write that did or did not happen, the words a person reads), never a call count alone.

Every network edge is faked (no live DB, no live Redis, no provider call).
"""
from __future__ import annotations

import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException

STEP = "Summarise the renewal terms"
SLUG = "summarise"


# ═════════════════════════════════════════════════════════════════════════════════════════
# CR-01 — an answer is bound to the question the run is waiting on NOW
# ═════════════════════════════════════════════════════════════════════════════════════════
class _Q:
    def __init__(self, sb, table):
        self.sb, self.table, self.op, self.row = sb, table, "select", None

    def select(self, *_a, **_k):
        return self

    def eq(self, *_a, **_k):
        return self

    def maybe_single(self):
        return self

    def insert(self, row):
        self.op, self.row = "insert", row
        return self


class _Supabase:
    """The owner-scoped reads the harness fallback makes, plus the response-row insert."""

    def __init__(self, run_id, thread_id):
        self.run_id, self.thread_id = str(run_id), str(thread_id)
        self.inserts: list[dict] = []

    def table(self, name):
        return _Q(self, name)


async def _aexec(q):
    if q.op == "insert":
        q.sb.inserts.append(q.row)
        return SimpleNamespace(data=[q.row])
    data = {
        "runs": None,
        "workflow_runs": {"id": q.sb.run_id, "thread_id": q.sb.thread_id},
        "threads": {"active_workflow_run_id": q.sb.run_id},
    }[q.table]
    return SimpleNamespace(data=data)


def _engine_prompt(tcid: str, *, kind="no_sources") -> dict:
    return {
        "kind": "ask_user_prompt", "tool_call_id": tcid, "prompt": "…",
        "options": ["Continue without sources", "Stop the run"], "timeout_seconds": None,
        "run_id": "r",
        "engine_pause": {"kind": kind, "phase": SLUG, "continue_allowed": True,
                         "locked": False, "folders": []},
    }


class _RunPool:
    """The two pool reads the answer route makes for a harness run: the prompt row the answer
    names (by its tool_call_id), and the run's CURRENT unanswered prompt."""

    def __init__(self, prompts: dict[str, dict], current: str | None):
        self.prompts, self.current = prompts, current

    async def fetchrow(self, sql, *args):
        if "NOT EXISTS" in sql:  # get_unanswered_ask_user
            if self.current is None:
                return None
            return {"tool_calls": [self.prompts[self.current]], "created_at": None}
        tcid = args[1]
        tc = self.prompts.get(tcid)
        return {"tool_calls": [tc]} if tc is not None else None


def _post(body: dict, pool: _RunPool):
    from app.api import runs as runs_api

    run_id, thread_id = uuid4(), uuid4()
    sb = _Supabase(run_id, thread_id)
    redrive = AsyncMock(return_value=True)

    async def _get_pool():
        return pool

    with patch.object(runs_api, "aexec", _aexec), \
         patch("app.api.threads._emit", AsyncMock()), \
         patch("app.services.ask_user_service.publish_response", AsyncMock()), \
         patch.object(runs_api, "_redrive_paused_workflow_run", redrive), \
         patch("app.dependencies.get_pg_pool", _get_pool):
        try:
            result = asyncio.run(runs_api.submit_ask_user_response(
                run_id, runs_api.AskUserResponseBody(**body),
                current_user={"id": str(uuid4())}, supabase=sb, redis=object(),
            ))
            err = None
        except HTTPException as exc:
            result, err = None, exc
    return result, err, sb, redrive


def test_cr01_a_stale_answer_for_an_earlier_engine_prompt_is_refused_with_409():
    """The run waits on T2; an answer arrives for T1 (a second tab's stale card, or a replay).
    T1's own labels are valid, so the allow-list alone let it through and re-drove the run:
    the step re-ran (search + LLM spend), the answer was thrown away and a third card came
    back. Now nothing is persisted and nothing is re-driven, so no step re-runs."""
    pool = _RunPool({"T1": _engine_prompt("T1"), "T2": _engine_prompt("T2")}, current="T2")
    _r, err, sb, redrive = _post(
        {"tool_call_id": "T1", "response_text": "Continue without sources"}, pool,
    )
    assert err is not None and err.status_code == 409, err
    assert err.detail == "This question is no longer the one the run is waiting on."
    assert sb.inserts == [], "a stale answer was persisted"
    redrive.assert_not_awaited()


def test_cr01_an_answer_when_the_run_waits_on_nothing_is_refused_with_409():
    pool = _RunPool({"T1": _engine_prompt("T1")}, current=None)
    _r, err, sb, redrive = _post({"tool_call_id": "T1", "response_text": "Stop the run"}, pool)
    assert err is not None and err.status_code == 409
    assert sb.inserts == []
    redrive.assert_not_awaited()


def test_cr01_the_answer_to_the_current_question_still_persists_and_redrives():
    pool = _RunPool({"T1": _engine_prompt("T1"), "T2": _engine_prompt("T2")}, current="T2")
    result, err, sb, redrive = _post(
        {"tool_call_id": "T2", "response_text": "Continue without sources"}, pool,
    )
    assert err is None and result == {"status": "ok"}
    assert len(sb.inserts) == 1 and sb.inserts[0]["tool_calls"][0]["tool_call_id"] == "T2"
    redrive.assert_awaited_once()


def test_cr01_a_human_step_answer_to_its_current_question_is_unaffected():
    human = {"kind": "ask_user_prompt", "tool_call_id": "H", "prompt": "Approve?",
             "options": ["Reject", "Approve"], "run_id": "r"}
    pool = _RunPool({"H": human}, current="H")
    result, err, sb, redrive = _post({"tool_call_id": "H", "response_text": "Approve"}, pool)
    assert err is None and result == {"status": "ok"} and len(sb.inserts) == 1
    redrive.assert_awaited_once()


def _human_phase(prompt="Approve the summary?"):
    from app.models.harness import PhaseSpec

    return PhaseSpec.model_validate({
        "slug": "approve", "phase_index": 1,
        "config": {"phase_type": "llm_human_input", "prompt": prompt,
                   "options": ["Reject", "Approve"], "timeout_seconds": 300},
    })


def _drive_human(durable: dict | None, *, flag="T1"):
    """``_exec_llm_human_input`` on a re-drive whose flag names ``flag``; ``durable`` is what
    ``get_ask_user_response`` reads for it. The live ask is answered "Reject" in-process."""
    from app.services.harness import human_input

    asked: list = []

    async def _get_answer(pool, run_id, tool_call_id):
        return durable

    async def _subscribe(redis, run_id, tool_call_id, timeout_seconds):
        asked.append(tool_call_id)
        return {"kind": "response", "response_text": "Reject", "choice_index": None}

    ctx = SimpleNamespace(
        run_id=uuid4(), producer_run_id=uuid4(), thread_id=str(uuid4()), supabase=None,
        pool=object(), redis=object(), emit=AsyncMock(), current_user={"id": str(uuid4())},
        resume_answered_tool_call_id=flag,
    )
    with patch("app.db.workflows.get_ask_user_response", _get_answer), \
            patch.object(human_input, "subscribe_for_response", _subscribe):
        out = asyncio.run(human_input._exec_llm_human_input(_human_phase(), {}, ctx))
    return out, asked, ctx


def test_cr01_a_human_step_never_takes_an_engine_questions_answer_as_its_own():
    """The run is paused on human step H; the flag names T1, an engine ask answered "Continue
    without sources". The human step used to complete with THAT answer, so the person was
    recorded as having answered a question they were never asked."""
    out, asked, ctx = _drive_human({
        "response_text": "Continue without sources", "choice_index": None,
        "prompt": "Searched Contracts and found nothing.", "engine_pause": True,
    })
    assert out["answer"] != "Continue without sources", "the human step borrowed T1's answer"
    assert out["tool_call_id"] != "T1"
    assert len(asked) == 1, "the human step did not ask its own question"
    assert ctx.resume_answered_tool_call_id is None


def test_cr01_a_human_step_never_takes_another_human_questions_answer():
    out, asked, _ctx = _drive_human({
        "response_text": "Approve", "choice_index": None,
        "prompt": "A different step's question?", "engine_pause": False,
    })
    assert out["tool_call_id"] != "T1" and len(asked) == 1


def test_cr01_a_human_step_consumes_the_answer_to_its_own_question():
    out, asked, _ctx = _drive_human({
        "response_text": "", "choice_index": 1,
        "prompt": "Approve the summary?", "engine_pause": False,
    })
    assert out == {"text": "Approve the summary?", "answer": "Approve", "tool_call_id": "T1"}
    assert asked == []


def test_cr01_the_durable_answer_read_names_the_question_it_answers():
    """``get_ask_user_response`` already joins the prompt row; it now hands back that prompt's
    words and whether it was an engine ask, so a consumer can tell whose answer it is."""
    from app.db.workflows import get_ask_user_response

    class _Pool:
        async def fetchrow(self, sql, *args):
            assert "p.tool_calls" in sql
            return {
                "tool_calls": [{"kind": "ask_user_response", "tool_call_id": "T1",
                                "response_text": "Stop the run", "choice_index": None}],
                "prompt_tool_calls": [_engine_prompt("T1")],
            }

    got = asyncio.run(get_ask_user_response(_Pool(), uuid4(), "T1"))
    assert got["response_text"] == "Stop the run"
    assert got["prompt"] == "…"
    assert got["engine_pause"] is True


# ═════════════════════════════════════════════════════════════════════════════════════════
# WR-01 — a sub-agent / provider error is an OUTAGE, never "found nothing"
# ═════════════════════════════════════════════════════════════════════════════════════════
VENDOR = "Your credit balance is too low to access the API (org-AbC123, model claude-x)"


def _mock_agent_phase():
    from unittest.mock import MagicMock

    phase = MagicMock()
    phase.slug = "research"
    phase.config = MagicMock()
    phase.config.prompt = "Find the renewal terms"
    phase.config.allowed_tools = ["search_documents"]
    phase.config.tools_budget = 5
    phase.config.max_steps = 3
    phase.config.max_parallel_agents = 2
    phase.config.merge_strategy = "concat"
    phase.config.skill_snapshot = None
    phase.validators = []
    return phase


def _mock_agent_ctx():
    from unittest.mock import MagicMock

    ctx = MagicMock()
    ctx.prior_run = None
    ctx.folder_subtree_ids = None
    ctx.user_settings = MagicMock()
    ctx.user_settings.embedding_provider = "openai"
    return ctx


def _sub_agent(status="error", summary=f"Sub-agent failed: {VENDOR}"):
    return {
        "sub_run_id": "sub-1", "summary": summary, "status": status, "source_refs": [],
        "citations": [], "similarity_scores": [], "input_tokens": None, "output_tokens": None,
        "retrieval_error": None, "kb_search_calls": 0,
    }


def test_wr01_an_errored_sub_agent_marks_the_output_and_keeps_no_vendor_text():
    from app.services.harness.phase_types import _exec_llm_agent

    with patch("app.services.harness.phase_types.run_task_sub_agent",
               AsyncMock(return_value=_sub_agent())), \
         patch("app.services.harness.phase_types._record_run_usage"):
        out = asyncio.run(_exec_llm_agent(_mock_agent_phase(), {}, _mock_agent_ctx()))
    assert out.get("sub_agent_status") == "error"
    assert VENDOR not in out["text"] and "org-AbC123" not in out["text"]
    assert out["text"].strip(), "an errored step must still say something in plain words"


def test_wr01_a_completed_sub_agent_output_is_unchanged():
    from app.services.harness.phase_types import _exec_llm_agent

    with patch("app.services.harness.phase_types.run_task_sub_agent",
               AsyncMock(return_value=_sub_agent("completed", "The term renews yearly [1]."))), \
         patch("app.services.harness.phase_types._record_run_usage"):
        out = asyncio.run(_exec_llm_agent(_mock_agent_phase(), {}, _mock_agent_ctx()))
    assert "sub_agent_status" not in out
    assert out["text"] == "The term renews yearly [1]."


def test_wr01_a_batch_with_an_errored_branch_marks_the_output_and_keeps_no_vendor_text():
    from app.services.harness.phase_types import _exec_llm_batch_agents

    results = [_sub_agent("completed", "Branch one found it [1]."), _sub_agent()]
    with patch("app.services.harness.phase_types.run_task_sub_agent",
               AsyncMock(side_effect=results)), \
         patch("app.services.harness.phase_types._record_run_usage"), \
         patch("app.services.harness.phase_types._collect_sub_questions",
               return_value=["q1", "q2"]), \
         patch("app.services.harness.phase_types._effective_model_checked",
               AsyncMock(return_value="m")), \
         patch("app.services.harness.phase_types._phase_tools_override", return_value=[]), \
         patch("app.services.harness.phase_types._build_phase_tool_context",
               return_value=object()):
        out = asyncio.run(_exec_llm_batch_agents(_mock_agent_phase(), {}, _mock_agent_ctx()))
    assert out.get("sub_agent_status") == "error"
    assert VENDOR not in out["text"]
    assert "Branch one found it [1]." in out["text"]


def test_wr01_finding_from_output_reads_an_errored_sub_agent_as_an_outage():
    from app.services.harness.engine_ask import finding_from_output

    assert finding_from_output({"text": "x", "citations": [], "sub_agent_status": "error"}) == "outage"
    assert finding_from_output({"text": "x", "citations": []}) == "no_sources"


def test_wr01_the_citations_gate_names_an_errored_step_an_outage_not_found_nothing():
    from app.services.harness.validator_kinds import _validate_citations_required

    res = asyncio.run(_validate_citations_required(
        {"text": "x", "citations": [], "sub_agent_status": "error"},
        {"mode": "retrieved_and_cited", "min_markers": 1}, None,
    ))
    assert not res.passed
    assert "service outage" in res.error_message
    assert "nothing was retrieved" not in res.error_message


def test_wr01_an_errored_kb_step_fails_with_the_outage_sentence_and_never_pauses():
    """End to end through ``_run_phase_with_gates``: the step's sub-agent errored, so the run
    must not offer "Search another folder" / "Continue without sources" (no prompt row), and the
    failure reason is the outage sentence with no vendor body in it."""
    from contextlib import ExitStack

    from app.models.harness import PhaseSpec
    from app.services import harness_engine
    from app.services.harness.grounding import effective_phase
    from tests.unit.engine_ask_fakes import FakePool, World

    raw = PhaseSpec(
        slug=SLUG, phase_index=0, name=STEP,
        config={"phase_type": "llm_agent", "prompt": "Find the terms and cite them.",
                "available_tools": ["search_documents"]},
    )
    phase = effective_phase(raw, total_phases=1)
    world = World(SLUG, kb_label="Contracts", folders=[{"id": "f", "name": "Archive", "depth": 0}])
    ctx = world.ctx(definition=None)

    async def body(phase, accumulated, ctx):
        return {"text": "This step could not get an answer.", "sub_run_id": "s",
                "citations": [], "sub_agent_status": "error"}

    with ExitStack() as stack:
        world.enter(stack)
        for p in (
            patch.object(harness_engine, "_execute_phase", body),
            patch.object(harness_engine, "write_audit", world.write_audit),
            patch.object(harness_engine, "_emit", world.emit),
        ):
            stack.enter_context(p)
        outcome = asyncio.run(harness_engine._run_phase_with_gates(
            phase, {}, ctx, run_id=uuid4(), pool=FakePool(), redis=object(), wall_clock=30,
            _audit_user_id=uuid4(), total_phases=1,
        ))
    assert outcome.kind == "fail_run", outcome
    assert "service outage" in outcome.reason
    assert VENDOR not in outcome.reason
    assert world.prompt_rows() == [], "an outage was offered as a found-nothing question"


# ═════════════════════════════════════════════════════════════════════════════════════════
# WR-02 — after "Search another folder" finds nothing again, that folder is not re-offered
# ═════════════════════════════════════════════════════════════════════════════════════════
def _plain_kb_phase(folder_scope=None):
    from app.models.harness import PhaseSpec

    cfg = {"phase_type": "llm_agent", "prompt": "p", "available_tools": ["search_documents"]}
    if folder_scope is not None:
        cfg["folder_scope"] = folder_scope
    return PhaseSpec(slug=SLUG, phase_index=0, name=STEP, config=cfg)


def test_wr02_the_folder_just_searched_counts_as_searched():
    from app.services.harness.engine_ask import _searched_ids

    ctx = SimpleNamespace(folder_subtree_ids=["P", "P-child"],
                          phase_scope_override={SLUG: ["F", "F-child"]})
    got = set(_searched_ids(ctx, _plain_kb_phase()))
    assert {"F", "F-child"} <= got, got
    assert {"P", "P-child"} <= got, "the bound folder stops counting as searched"


def test_wr02_the_step_scope_still_narrows_what_was_searched():
    from app.services.harness.engine_ask import _searched_ids

    P, F, F_CHILD = (str(uuid4()) for _ in range(3))
    ctx = SimpleNamespace(folder_subtree_ids=[P], phase_scope_override={SLUG: [F, F_CHILD]})
    assert set(_searched_ids(ctx, _plain_kb_phase(folder_scope=[F]))) == {F}


def test_wr02_a_run_with_no_override_is_unchanged():
    from app.services.harness.engine_ask import _searched_ids

    ctx = SimpleNamespace(folder_subtree_ids=["P", "P-child"], phase_scope_override={})
    assert _searched_ids(ctx, _plain_kb_phase()) == ["P", "P-child"]
    ctx = SimpleNamespace(folder_subtree_ids=None)
    assert _searched_ids(ctx, _plain_kb_phase()) is None


def test_wr02_the_re_pause_does_not_offer_the_folder_that_came_up_empty():
    """Through ``permitted_folder_options`` for real: the run searched P, the person chose F,
    F found nothing again. The new question must not offer F (a dead option)."""
    from app.models.harness import WorkflowDefinition
    from app.services.harness import engine_ask

    P, F, G = (str(uuid4()) for _ in range(3))
    tree = [{"id": P, "name": "Contracts", "parent_id": None},
            {"id": F, "name": "Archive", "parent_id": None},
            {"id": G, "name": "Board papers", "parent_id": None}]
    definition = WorkflowDefinition(
        slug="w", name="W", version=1, project_folder_id=P,
        phases=[{"slug": SLUG, "phase_index": 0, "config": {
            "phase_type": "llm_agent", "prompt": "p", "available_tools": ["search_documents"]}}],
    )
    ctx = SimpleNamespace(folder_subtree_ids=[P], phase_scope_override={SLUG: [F]})

    async def _fetch(_supabase, _user_id, **_kw):
        return [dict(f) for f in tree]

    with patch("app.services.harness.scope.fetch_visible_folders", _fetch), \
         patch("app.utils.folder_utils.fetch_visible_folders", _fetch):
        out = asyncio.run(engine_ask.permitted_folder_options(
            definition, phase=definition.phases[0],
            searched_ids=engine_ask._searched_ids(ctx, definition.phases[0]),
            supabase=object(), user_id=str(uuid4()),
        ))
    ids = [f["id"] for f in out]
    assert F not in ids, "the folder that just came up empty was offered again"
    assert ids == [G]


# ═════════════════════════════════════════════════════════════════════════════════════════
# WR-03 — a valid skip_to on a NON-emit step posts no new chat failure message
# ═════════════════════════════════════════════════════════════════════════════════════════
def test_wr03_a_non_emit_step_routed_by_skip_to_posts_no_failure_message():
    """Before 295 a non-emit step whose gate routed by ``skip_to_phase`` wrote ZERO chat
    failure messages (its executor never surfaces one). D-23 made the skip_to arm surface
    whenever the phase had validators, so the thread gained "Phase N gate failed …" mid-run
    while the run went on and completed. The executor here returns plain output, as
    ``llm_agent`` / ``llm_single`` / batch do."""
    from tests.unit.test_295_truthful_run_ends import _definition, _drive_workflow, _messages, _validator

    plain = {"text": "Nothing relevant was found."}
    run = _drive_workflow(
        _definition(validators=[_validator("skip_to_phase:p1")]), [dict(plain), dict(plain)],
    )
    assert _messages(run) == [], _messages(run)


def test_wr03_a_non_emit_step_whose_gate_fails_the_run_still_says_why_once():
    from tests.unit.test_295_truthful_run_ends import _definition, _drive_workflow, _messages, _validator

    plain = {"text": "Nothing relevant was found."}
    run = _drive_workflow(_definition(validators=[_validator()]), [dict(plain), dict(plain)])
    assert len(_messages(run)) == 1
