"""Phase 292.1 (BUG-261024-03, D-12..D-16 / D-20) — a typed continue word resumes the paused run.

Production evidence: after a tool-limit pause the user typed "continue" and got a NEW run on a
different capacity path, while the paused run sat unresumed. The send door now carries ONE
delegating branch: when the text is one of a short fixed list of continue words (D-13, no model
call), the thread is Deep, and the thread's LATEST root run is PAUSED with Continues left — per
``app.db.runs.run_is_cap_paused``, because a first-turn pause reads ``completed`` (292.1-REVIEW
CR-02) — the
door hands the run to ``runs.continue_run`` — the same code the Continue button calls, and still the
ONLY writer of ``runs.status`` (D-12; threads.py's recorded rejected arm stands).

Every other case is today's send: any other text (D-15), an exhausted run or a lost race to the
last Continue (D-16), a run that is not paused, a harness thread, a workflow kickoff, and a failed
latest-run read (fail open — a read failure never blocks a message).
"""
from __future__ import annotations

import ast
import asyncio
import json
import subprocess
from contextlib import ExitStack, asynccontextmanager
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException
from fastapi.responses import JSONResponse

import app.api.threads as threads_mod
import app.services.run_producer as rp
from app.models.message import MessageCreate

PLAN_BASE = "9d3b77c88b2e2b175c76a069dd2aa4896d73b6b8"

REPO_ROOT = Path(__file__).resolve().parents[3]
THREADS_PATH = REPO_ROOT / "backend" / "app" / "api" / "threads.py"
FIXTURE = Path(__file__).resolve().parent / "fixtures" / "continue_words_cases.json"

USER_ID = "11111111-1111-1111-1111-111111111111"
THREAD_ID = "33333333-3333-3333-3333-333333333333"
RUN_ID = "55555555-5555-5555-5555-555555555555"

_CASES = json.loads(FIXTURE.read_text(encoding="utf-8"))


# ── D-13: the word list ─────────────────────────────────────────────────────────────────────


def test_the_word_list_is_exactly_the_six_words():
    from app.services.typed_continue import CONTINUE_WORDS

    assert len(_CASES["words"]) == 6  # non-vacuity
    assert CONTINUE_WORDS == frozenset(_CASES["words"])


@pytest.mark.parametrize("text", _CASES["match"])
def test_a_continue_word_matches_after_normalisation(text):
    from app.services.typed_continue import is_continue_word

    assert is_continue_word(text) is True


@pytest.mark.parametrize("text", _CASES["no_match"])
def test_anything_else_is_a_new_request(text):
    from app.services.typed_continue import is_continue_word

    assert is_continue_word(text) is False


# ── the send-door harness (copied from test_279_org_helper._SendHarness) ─────────────────────


class _SendHarness:
    def __init__(self, *, thread_row=None, latest_run=None, read_exc=None, continue_result=None,
                 preflight_exc=None, paused=None):
        self.thread_row = thread_row or {"id": THREAD_ID, "active_workflow_run_id": None}
        self.inserted_rows: list[dict] = []
        self.register = AsyncMock(return_value=None)
        self.producer = AsyncMock(return_value=None)
        self.resolve = AsyncMock(return_value=rp.ThreadScoping(None, None, None, None, None))
        self.preflight = AsyncMock(side_effect=preflight_exc, return_value=(None, None))
        self.latest_run = latest_run
        # What the ONE pause predicate (app.db.runs.run_is_cap_paused) answers. Default: the
        # status alone (a re-pause writes cap_paused); a first-turn pause passes paused=True on a
        # `completed` row — the real producer shape (292.1-REVIEW CR-02).
        self.paused = paused if paused is not None else bool(
            latest_run and latest_run.get("status") == "cap_paused")
        self.read_exc = read_exc
        self.sqls: list[str] = []
        self.paused_args: list[tuple] = []
        self.continue_run = AsyncMock(return_value=continue_result if continue_result is not None else {
            "status": "ok", "run_id": RUN_ID, "continues_used": 2, "continues_remaining": 1,
        })

    async def aexec(self, builder):
        rec = getattr(builder, "_rec", None)
        if rec is not None:
            self.inserted_rows.append(rec)
            return SimpleNamespace(data=[{"id": str(uuid4())}])
        return SimpleNamespace(data=dict(self.thread_row))

    def supabase(self):
        sb = MagicMock()

        def _table(_name):
            t = MagicMock()

            def _insert(row):
                b = MagicMock()
                b._rec = row
                return b

            t.insert.side_effect = _insert
            sel = MagicMock()
            sel._rec = None
            sel.eq.return_value = sel
            sel.single.return_value = sel
            sel.maybe_single.return_value = sel
            t.select.return_value = sel
            return t

        sb.table.side_effect = _table
        return sb

    def pg_connection(self):
        harness = self

        class _Conn:
            async def fetchrow(self, sql, *args):
                flat = " ".join(sql.split())
                harness.sqls.append(flat)
                if harness.read_exc is not None:
                    raise harness.read_exc
                if "AS paused" in flat:
                    harness.paused_args.append(args)
                    return {"paused": harness.paused}
                return harness.latest_run

        @asynccontextmanager
        async def _cm(_request, _user):
            yield _Conn()

        return _cm

    def runs_reads(self) -> list[str]:
        """The latest-run reads (the pause predicate's own read is counted separately)."""
        return [s for s in self.sqls if "FROM runs" in s and "AS paused" not in s]

    def paused_reads(self) -> list[str]:
        return [s for s in self.sqls if "AS paused" in s]

    def patches(self):
        settings = SimpleNamespace(active_provider="openai", llm_model="gpt-4o")
        return [
            patch.object(threads_mod, "resolve_active_org_or_none", AsyncMock(return_value=None)),
            patch.object(threads_mod, "aexec", self.aexec),
            patch.object(threads_mod, "preflight_workflow_kickoff", self.preflight),
            patch.object(threads_mod, "get_user_pg_connection", self.pg_connection()),
            patch.object(threads_mod, "load_user_settings", MagicMock(return_value=settings)),
            patch.object(threads_mod._run_model_resolution, "apply_user_model_default",
                         AsyncMock(return_value=settings)),
            patch.object(threads_mod, "resolve_run_model",
                         AsyncMock(side_effect=lambda *, body, user_settings:
                                   ("gpt-4o", "openai", None, body, user_settings))),
            patch.object(threads_mod, "register_run_start", self.register),
            patch.object(threads_mod, "get_pg_pool", AsyncMock(return_value=MagicMock())),
            patch.object(threads_mod, "create_workflow_run", AsyncMock(return_value=uuid4())),
            patch.object(threads_mod, "maybe_autotitle_thread", AsyncMock(return_value=None)),
            patch.object(threads_mod.settings, "max_continues_per_run", 3),
            patch("app.api.runs.continue_run", self.continue_run),
            patch.object(rp, "run_producer", self.producer),
            patch.object(rp, "_resolve_thread_scoping", self.resolve),
        ]


async def _send(h: _SendHarness, content: str, **body_kw):
    service = MagicMock(name="service_supabase")
    redis = MagicMock(name="redis")
    sb = h.supabase()
    with ExitStack() as stack:
        for p in h.patches():
            stack.enter_context(p)
        resp = await threads_mod.send_message(
            THREAD_ID,
            MessageCreate(content=content, **body_kw),
            SimpleNamespace(headers={}, state=SimpleNamespace()),
            current_user={"id": USER_ID, "email": "u@example.com"},
            supabase=sb,
            service_supabase=service,
            redis=redis,
        )
        await asyncio.sleep(0)
    return resp, sb, service, redis


def _paused(continues_used: int = 1, status: str = "cap_paused") -> dict:
    return {"run_id": RUN_ID, "status": status, "continues_used": continues_used}


def _assert_normal_send(h: _SendHarness, resp) -> None:
    assert resp.status_code == 201, "the ordinary send path ran"
    assert len(h.inserted_rows) == 1, "the user message was written"
    assert h.register.await_count == 1, "a new run row was registered"


# ── D-12: the gate resumes the paused run ────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_a_typed_continue_on_a_paused_deep_thread_resumes_that_run():
    h = _SendHarness(latest_run=_paused(1))
    resp, sb, service, redis = await _send(h, "continue")

    h.continue_run.assert_awaited_once()
    kw = h.continue_run.await_args.kwargs
    assert str(kw["run_id"]) == RUN_ID
    assert kw["supabase"] is sb and kw["service_supabase"] is service and kw["redis"] is redis
    assert kw["current_user"]["id"] == USER_ID

    assert resp.status_code == 200
    payload = json.loads(resp.body)
    assert payload == {
        "continued": True,
        "run_id": RUN_ID,
        "message_id": None,
        "continues_used": 2,
        "continues_remaining": 1,
    }
    # nothing written by the door itself: no message, no run row, no scoping, no preflight
    assert h.inserted_rows == []
    assert h.register.await_count == 0
    assert h.resolve.await_count == 0
    assert h.preflight.await_count == 0
    # the latest-run read carries no status predicate (the 244 rule)
    reads = h.runs_reads()
    assert len(reads) == 1
    assert "ORDER BY started_at DESC" in reads[0] and "status = 'cap_paused'" not in reads[0]


@pytest.mark.asyncio
async def test_punctuated_and_cased_words_resume_too():
    h = _SendHarness(latest_run=_paused(0))
    resp, *_ = await _send(h, "  Keep going!  ")
    h.continue_run.assert_awaited_once()
    assert json.loads(resp.body)["continued"] is True


# ── D-15: any other text is today's send, and never reads the run ───────────────────────────


@pytest.mark.asyncio
async def test_please_continue_is_a_new_request_and_never_reads_the_run():
    h = _SendHarness(latest_run=_paused(1))
    resp, *_ = await _send(h, "please continue")
    h.continue_run.assert_not_awaited()
    assert h.runs_reads() == [], "the latest-run read must come AFTER the pure word match"
    _assert_normal_send(h, resp)


# ── D-16: exhausted, or a lost race to the last Continue, falls through ─────────────────────


@pytest.mark.asyncio
async def test_an_exhausted_run_falls_through_to_a_new_message():
    h = _SendHarness(latest_run=_paused(3))
    resp, *_ = await _send(h, "continue")
    h.continue_run.assert_not_awaited()
    _assert_normal_send(h, resp)


@pytest.mark.asyncio
async def test_a_refused_continue_response_falls_through_to_a_new_message():
    refused = JSONResponse(status_code=200, content={
        "status": "refused", "message": "All 3 Continues used", "continues_used": 3,
        "continues_remaining": 0,
    })
    h = _SendHarness(latest_run=_paused(2), continue_result=refused)
    resp, *_ = await _send(h, "continue")
    h.continue_run.assert_awaited_once()
    _assert_normal_send(h, resp)


@pytest.mark.asyncio
async def test_a_refused_continue_dict_falls_through_to_a_new_message():
    h = _SendHarness(latest_run=_paused(2), continue_result={"status": "refused", "continues_used": 3,
                                                              "continues_remaining": 0})
    resp, *_ = await _send(h, "continue")
    h.continue_run.assert_awaited_once()
    _assert_normal_send(h, resp)


# ── not paused / harness / kickoff ──────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_a_completed_latest_run_with_no_pause_is_a_normal_send():
    # A run that FINISHED: no carrier during it (or only an older one) → the predicate says no.
    h = _SendHarness(latest_run=_paused(0, status="completed"), paused=False)
    resp, *_ = await _send(h, "continue")
    h.continue_run.assert_not_awaited()
    assert len(h.paused_reads()) == 1, "completed asks the carrier-aware predicate"
    _assert_normal_send(h, resp)


# ── 292.1-REVIEW CR-02: a FIRST-turn pause reads `completed` (the real producer shape) ──────


@pytest.mark.asyncio
async def test_a_typed_continue_resumes_a_first_turn_pause_finalized_completed():
    h = _SendHarness(latest_run=_paused(0, status="completed"), paused=True)
    resp, *_ = await _send(h, "continue")
    h.continue_run.assert_awaited_once()
    assert str(h.continue_run.await_args.kwargs["run_id"]) == RUN_ID
    assert resp.status_code == 200 and json.loads(resp.body)["continued"] is True
    assert h.inserted_rows == [] and h.register.await_count == 0
    # the predicate is asked about THIS run, on the same per-request connection
    assert len(h.paused_args) == 1 and str(h.paused_args[0][0]) == RUN_ID


@pytest.mark.parametrize("status", ["failed", "cancelled", "timed_out", "streaming"])
@pytest.mark.asyncio
async def test_a_run_that_is_neither_paused_nor_completed_never_asks_the_predicate(status):
    h = _SendHarness(latest_run=_paused(0, status=status), paused=True)
    resp, *_ = await _send(h, "continue")
    h.continue_run.assert_not_awaited()
    assert h.paused_reads() == []
    _assert_normal_send(h, resp)


@pytest.mark.asyncio
async def test_the_latest_run_read_skips_sub_agent_rows():
    # A sub-agent row shares the thread and starts AFTER its parent; it must never be "the latest
    # run" the pause is attributed to.
    h = _SendHarness(latest_run=_paused(1))
    await _send(h, "continue")
    reads = h.runs_reads()
    assert len(reads) == 1 and "parent_run_id IS NULL" in reads[0]


@pytest.mark.asyncio
async def test_a_thread_with_no_runs_is_a_normal_send():
    h = _SendHarness(latest_run=None)
    resp, *_ = await _send(h, "continue")
    h.continue_run.assert_not_awaited()
    _assert_normal_send(h, resp)


@pytest.mark.asyncio
async def test_a_harness_thread_skips_the_gate_without_a_read():
    row = {"id": THREAD_ID, "active_workflow_run_id": str(uuid4())}
    h = _SendHarness(thread_row=row, latest_run=_paused(0),
                     preflight_exc=HTTPException(status_code=409, detail="locked"))
    with pytest.raises(HTTPException):
        await _send(h, "continue")
    h.continue_run.assert_not_awaited()
    assert h.runs_reads() == []
    assert h.preflight.await_count == 1


@pytest.mark.asyncio
async def test_a_workflow_kickoff_skips_the_gate_without_a_read():
    h = _SendHarness(latest_run=_paused(0),
                     preflight_exc=HTTPException(status_code=403, detail="kickoff reached"))
    with pytest.raises(HTTPException):
        await _send(h, "continue", workflow_definition_id=uuid4())
    h.continue_run.assert_not_awaited()
    assert h.runs_reads() == []
    assert h.preflight.await_count == 1


# ── fail open ───────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_a_failed_latest_run_read_never_blocks_the_message(caplog):
    h = _SendHarness(read_exc=RuntimeError("db blip"))
    with caplog.at_level("WARNING"):
        resp, *_ = await _send(h, "continue")
    h.continue_run.assert_not_awaited()
    _assert_normal_send(h, resp)
    assert any("typed continue" in r.getMessage() for r in caplog.records)


# ── D-20: exactly ONE delegating `if` in send_message, relative to the plan base ────────────


def _ifs(src: str, fn_name: str) -> int:
    tree = ast.parse(src)
    for node in ast.walk(tree):
        if isinstance(node, (ast.AsyncFunctionDef, ast.FunctionDef)) and node.name == fn_name:
            return sum(isinstance(n, ast.If) for n in ast.walk(node))
    raise AssertionError(f"{fn_name} not found")


def test_send_message_gains_exactly_one_branch_relative_to_the_plan_base():
    try:
        base_src = subprocess.run(
            ["git", "show", f"{PLAN_BASE}:backend/app/api/threads.py"],
            cwd=REPO_ROOT, capture_output=True, text=True, encoding="utf-8", check=True,
        ).stdout
    except (subprocess.CalledProcessError, FileNotFoundError):
        pytest.skip("plan base not reachable from this checkout")
    head_src = THREADS_PATH.read_text(encoding="utf-8")
    base_count = _ifs(base_src, "send_message")
    assert base_count > 0
    assert _ifs(head_src, "send_message") == base_count + 1
    assert head_src.count("_typed_continue_or_none(") == 2  # one def + one call
