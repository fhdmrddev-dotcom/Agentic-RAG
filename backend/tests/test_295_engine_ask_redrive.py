"""Phase 295 (plan 295-03 Tasks 2-3) — an engine ask is answered, refused, or re-driven.

Two layers, each driven for real with every network edge faked (no live DB, no live Redis):

* THE ROUTE (``POST /runs/{id}/ask_user_response``): an answer to a prompt carrying
  ``engine_pause`` is allow-listed BEFORE it is persisted — an unoffered label or index, a folder
  outside the server-built list, or "Continue without sources" on a locked prompt is HTTP 422 with
  plain words, and no response row is written and nothing is re-driven (T-295-03-01 / -02). A
  valid answer persists ``folder_id`` on the response row and re-drives as before.
* THE RE-DRIVE (``_run_phase_with_gates`` twice over ``engine_ask_fakes.World``): the found-nothing
  pause, then the person's answer, then the phase again — Continue completes with the produced
  output marked ``unsourced``; Stop fails with words; a folder re-runs the body ONCE over that
  folder, and a second nothing-found pauses again.
"""
from __future__ import annotations

import asyncio
from contextlib import ExitStack
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException

STEP = "Summarise the renewal terms"
SLUG = "summarise"
FOLDER = "Contracts"


# ── the route ─────────────────────────────────────────────────────────────────────────────
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


class _PromptPool:
    def __init__(self, tool_call):
        self.tool_call = tool_call
        self.reads: list = []

    async def fetchrow(self, sql, *args):
        self.reads.append((sql, args))
        return {"tool_calls": [self.tool_call]} if self.tool_call is not None else None


def _prompt(*, kind="no_sources", locked=False, folders=None, options=None):
    folders = list(folders or [])
    if options is None:
        options = (["Search another folder"] if folders else []) + (
            [] if locked else ["Continue without sources"]) + ["Stop the run"]
    return {
        "kind": "ask_user_prompt", "tool_call_id": "tc-1", "prompt": "…",
        "options": options, "timeout_seconds": None, "run_id": "r",
        "engine_pause": {"kind": kind, "phase": SLUG, "continue_allowed": not locked,
                         "locked": locked, "folders": folders},
    }


def _post(body: dict, prompt: dict | None):
    from app.api import runs as runs_api

    run_id, thread_id = uuid4(), uuid4()
    sb = _Supabase(run_id, thread_id)
    redrive = AsyncMock(return_value=True)
    pool = _PromptPool(prompt)

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


A = {"id": str(uuid4()), "name": "Archive", "depth": 0}


def test_a_forged_continue_on_a_locked_prompt_is_refused_with_422_and_persists_nothing():
    _r, err, sb, redrive = _post(
        {"tool_call_id": "tc-1", "response_text": "Continue without sources"},
        _prompt(locked=True, folders=[A]),
    )
    assert err is not None and err.status_code == 422
    assert "Must prove it" in err.detail
    assert sb.inserts == [], "a refused answer was persisted"
    redrive.assert_not_awaited()


def test_a_forged_continue_by_index_on_a_locked_prompt_is_refused():
    # options are [Search, Stop]; index 1 is Stop, so a mismatched label + index is forged.
    _r, err, sb, _rd = _post(
        {"tool_call_id": "tc-1", "response_text": "Continue without sources", "choice_index": 1},
        _prompt(locked=True, folders=[A]),
    )
    assert err is not None and err.status_code == 422 and sb.inserts == []


@pytest.mark.parametrize("body", [
    {"tool_call_id": "tc-1", "response_text": "Proceed anyway"},
    {"tool_call_id": "tc-1", "response_text": "", "choice_index": 9},
    {"tool_call_id": "tc-1", "response_text": "nope"},
])
def test_an_unoffered_choice_is_refused(body):
    _r, err, sb, redrive = _post(body, _prompt(folders=[A]))
    assert err is not None and err.status_code == 422
    assert err.detail == "That choice is not one this question offers."
    assert sb.inserts == []
    redrive.assert_not_awaited()


def test_a_folder_outside_the_offered_list_is_refused():
    _r, err, sb, _rd = _post(
        {"tool_call_id": "tc-1", "response_text": "Search another folder", "choice_index": 0,
         "folder_id": str(uuid4())},
        _prompt(folders=[A]),
    )
    assert err is not None and err.status_code == 422
    assert err.detail == "That folder is not one this question offers."
    assert sb.inserts == []


def test_a_valid_folder_answer_persists_folder_id_and_redrives():
    result, err, sb, redrive = _post(
        {"tool_call_id": "tc-1", "response_text": "Search another folder", "choice_index": 0,
         "folder_id": A["id"]},
        _prompt(folders=[A]),
    )
    assert err is None and result == {"status": "ok"}
    assert len(sb.inserts) == 1
    tc = sb.inserts[0]["tool_calls"][0]
    assert tc["kind"] == "ask_user_response" and tc["folder_id"] == A["id"]
    redrive.assert_awaited_once()


def test_a_prompt_without_engine_pause_is_unaffected():
    plain = {"kind": "ask_user_prompt", "tool_call_id": "tc-1", "options": ["a", "b"]}
    result, err, sb, redrive = _post(
        {"tool_call_id": "tc-1", "response_text": "anything at all"}, plain,
    )
    assert err is None and result == {"status": "ok"} and len(sb.inserts) == 1
    assert sb.inserts[0]["tool_calls"][0]["folder_id"] is None
    redrive.assert_awaited_once()


def test_get_ask_user_response_returns_folder_id_additively():
    from app.db.workflows import get_ask_user_response

    class _Pool:
        def __init__(self, tc):
            self.tc = tc

        async def fetchrow(self, sql, *args):
            return {"tool_calls": [self.tc]}

    new = asyncio.run(get_ask_user_response(
        _Pool({"response_text": "x", "choice_index": 0, "folder_id": "f"}), uuid4(), "t"))
    old = asyncio.run(get_ask_user_response(_Pool({"response_text": "x"}), uuid4(), "t"))
    assert new == {"response_text": "x", "choice_index": 0, "folder_id": "f"}
    assert old == {"response_text": "x", "choice_index": None, "folder_id": None}


# ── the re-drive ──────────────────────────────────────────────────────────────────────────
def _phase(*, escalated=False):
    from app.models.harness import PhaseSpec
    from app.services.harness.grounding import effective_phase

    raw = PhaseSpec(
        slug=SLUG, phase_index=0, name=STEP,
        config={"phase_type": "llm_agent", "prompt": "Find the terms and cite them.",
                "available_tools": ["search_documents"]},
        grounding_escalated=escalated,
    )
    return raw, effective_phase(raw, total_phases=1)


def _definition(raw):
    from app.models.harness import WorkflowDefinition

    return WorkflowDefinition(slug="w", name="W", version=1, project_folder_id=uuid4(),
                              phases=[raw.model_dump()])


class _Drive:
    def __init__(self, *, folders=None, escalated=False, body_outputs=None):
        from tests.unit.engine_ask_fakes import FakePool, World

        self.raw, self.phase = _phase(escalated=escalated)
        self.world = World(SLUG, kb_label=FOLDER, folders=list(folders or []))
        self.ctx = self.world.ctx(definition=_definition(self.raw))
        self.run_id, self.user, self.pool = uuid4(), uuid4(), FakePool()
        self.bodies: list = []
        self._outputs = list(body_outputs or [])

    async def body(self, phase, accumulated, ctx):
        self.bodies.append(dict(getattr(ctx, "phase_scope_override", None) or {}))
        if self._outputs:
            return dict(self._outputs[0])
        return {"text": "Nothing found.", "sub_run_id": "s", "citations": []}

    def once(self, stack_patches=()):
        from app.services import harness_engine

        async def _subtree(root, *, supabase, user_id, **_kw):
            return [root]

        with ExitStack() as stack:
            self.world.enter(stack)
            stack.enter_context(patch.object(harness_engine, "_execute_phase", self.body))
            stack.enter_context(patch.object(harness_engine, "write_audit", self.world.write_audit))
            stack.enter_context(patch.object(harness_engine, "_emit", self.world.emit))
            stack.enter_context(
                patch("app.services.harness.scope.resolve_project_subtree", _subtree)
            )
            return asyncio.run(harness_engine._run_phase_with_gates(
                self.phase, {}, self.ctx, run_id=self.run_id, pool=self.pool, redis=object(),
                wall_clock=30, _audit_user_id=self.user, total_phases=1,
            ))

    def answer(self, **kw):
        self.ctx.resume_answered_tool_call_id = self.world.answer(**kw)


def test_continue_completes_the_run_with_the_output_marked_unsourced():
    d = _Drive()
    first = d.once()
    assert first.kind == "pause_run"
    ran = len(d.bodies)
    d.answer(response_text="Continue without sources", choice_index=0)
    second = d.once()
    assert second.kind == "completed"
    assert second.output["unsourced"]["continued_by"] == str(d.ctx.current_user["id"])
    assert second.output["text"] == "Nothing found."
    assert len(d.bodies) == ran, "the re-drive consumed the answer; it never re-ran the body"


def test_stop_ends_the_run_failed_with_the_stop_sentence():
    d = _Drive()
    assert d.once().kind == "pause_run"
    d.answer(response_text="Stop the run", choice_index=1)
    second = d.once()
    assert second.kind == "fail_run"
    assert second.reason == f"Searched {FOLDER} and found nothing for “{STEP}”. Stopped by Fahad Murad."


def test_a_folder_answer_reruns_the_body_once_with_the_override_and_can_pause_again():
    folder = {"id": str(uuid4()), "name": "Archive", "depth": 0}
    d = _Drive(folders=[folder])
    assert d.once().kind == "pause_run"
    before = len(d.bodies)
    d.answer(response_text="Search another folder", choice_index=0, folder_id=folder["id"])
    second = d.once()
    # one re-run of the step (its own bounded retries), over the chosen folder only
    reruns = d.bodies[before:]
    assert reruns and all(b == {SLUG: [folder["id"]]} for b in reruns)
    assert second.kind == "pause_run", "a second nothing-found pauses again"
    assert d.world.count("prompt_row") == 2 and d.world.count("pause_run") == 2
    second_prompt = d.world.latest_tool_call()["prompt"]
    assert second_prompt.startswith("Searched Archive and found nothing")


def test_a_locked_step_is_never_completed_at_consume():
    folder = {"id": str(uuid4()), "name": "Archive", "depth": 0}
    d = _Drive(folders=[folder], escalated=True)
    assert d.once().kind == "pause_run"
    assert "Continue without sources" not in d.world.latest_tool_call()["options"]
    d.answer(response_text="Continue without sources")
    second = d.once()
    assert second.kind != "completed"
    assert d.world.audits("validator_ask_user_approved") == []


def test_pause_run_releases_the_lease_so_a_second_pause_can_be_redriven():
    """D-50 / Pitfall 1 — the second pause's ``pause_run`` releases the claim; the SQL is
    pinned in tests/unit/test_295_engine_ask_pause.py. Here: a re-drive that pauses again
    writes pause_run again (so the lease is released again)."""
    folder = {"id": str(uuid4()), "name": "Archive", "depth": 0}
    d = _Drive(folders=[folder])
    d.once()
    d.answer(response_text="Search another folder", choice_index=0, folder_id=folder["id"])
    d.once()
    assert d.world.count("pause_run") == 2
