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
