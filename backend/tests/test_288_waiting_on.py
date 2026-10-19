"""Phase 288 Plan 03 (AUTH-01 run-surface half; D-09, D-10, D-11, A-05, A-06, A-07).

The run read carries ``waiting_on {sentence, step_name, prompt_line, window_passed}`` for a run
that is waiting on a human-input step. This suite pins, in order:

  1. the PURE composer (owner / non-owner / blank name / hostile name / paused wording);
  2. the db read (NOT EXISTS on the response row; two pause steps, first answered, returns
     the second - Pitfall 4; run-scoped by ``tool_calls->0->>'run_id'``);
  3. the route (active, paused, terminal, golden, failure degrades to None, the key survives
     ``response_model``).

Reuses the seam of ``test_188_workflow_run_read.py`` (one fake, never a second).
"""
from __future__ import annotations

import asyncio
from uuid import UUID

import pytest

from tests import test_188_workflow_run_read as t188  # noqa: E402

_RUN = UUID(t188._OWNED_RUN_ID)
_STRANGER = "00000000-0000-0000-0000-0000000000aa"


# ── 1) the pure composer ──────────────────────────────────────────────────────


def _compose(**kw):
    from app.api.workflow_runs import compose_waiting_on

    base = dict(
        owner_id=t188._OWNER_ID,
        viewer_id=t188._OWNER_ID,
        viewer_email="owner@x.co",
        display_name="Dana Whitfield",
        step_name="Manager sign-off",
        prompt_text="Approve the Q3 numbers?\nSecond line that must not ship.",
        window_passed=False,
    )
    base.update(kw)
    return compose_waiting_on(**base)


def test_owner_active_sentence_names_the_person_and_marks_you():
    w = _compose()
    assert w["sentence"] == 'Waiting on Dana Whitfield (you) to answer "Approve the Q3 numbers?".'
    assert w["prompt_line"] == "Approve the Q3 numbers?"
    assert w["step_name"] == "Manager sign-off"
    assert w["window_passed"] is False


def test_paused_wording_says_still_waiting_and_never_expired():
    w = _compose(window_passed=True)
    assert w["window_passed"] is True
    assert w["sentence"].startswith("Still waiting on Dana Whitfield (you)")
    assert w["sentence"].startswith("Still waiting on")
    assert "continues" not in w["sentence"]  # CR-01: resume after answer is not guaranteed
    assert "expire" not in w["sentence"].lower()


def test_owner_blank_name_falls_back_to_email():
    w = _compose(display_name="   ")
    assert "owner@x.co (you)" in w["sentence"]


def test_non_owner_never_sees_email_prompt_line_or_you():
    w = _compose(viewer_id=_STRANGER, viewer_email="stranger@x.co", display_name=None)
    assert w["sentence"] == "Waiting on the person who started this run to answer."
    assert w["prompt_line"] is None
    assert "(you)" not in w["sentence"]
    assert "@" not in w["sentence"]


def test_non_owner_sees_display_name_but_not_email_or_prompt():
    w = _compose(viewer_id=_STRANGER, viewer_email="stranger@x.co")
    assert "Dana Whitfield" in w["sentence"]
    assert "(you)" not in w["sentence"]
    assert w["prompt_line"] is None
    assert "Approve" not in w["sentence"]


def test_hostile_name_and_prompt_are_scrubbed_and_clamped():
    hostile = "Eve‮\x07\nMallory" + "x" * 300
    w = _compose(display_name=hostile, prompt_text="​Do it‮ now\n" + "y" * 400)
    for ch in "‮​\x07\n":
        assert ch not in w["sentence"]
    assert len(w["sentence"]) < 400
    assert w["prompt_line"] and len(w["prompt_line"]) <= 72


def test_unanswered_ask_never_yields_a_blank_sentence():
    """SEED-159 shape: an unanswered ask with nothing usable still says something true."""
    w = _compose(display_name=None, viewer_email="", prompt_text="", step_name=None)
    assert w["sentence"].strip()
    assert w["prompt_line"] is None
    assert w["step_name"] is None


# ── 2) the db read ────────────────────────────────────────────────────────────


class _RecPool:
    def __init__(self, row=None):
        self.row = row
        self.sql = None
        self.args = None

    async def fetchrow(self, sql, *args):
        self.sql, self.args = sql, args
        return self.row


def test_db_read_is_not_exists_and_run_scoped():
    from app.db import workflows as wdb

    pool = _RecPool(
        {"tool_calls": [{"tool_call_id": "tc2", "prompt": "Second?", "options": None,
                         "timeout_seconds": 300}]}
    )
    out = asyncio.run(wdb.get_unanswered_ask_user(pool, _RUN))
    assert out == {"tool_call_id": "tc2", "prompt": "Second?", "options": None,
                   "timeout_seconds": 300}
    sql = " ".join(pool.sql.split())
    assert "NOT EXISTS" in sql
    assert "ask_user_prompt" in sql and "ask_user_response" in sql
    assert "tool_calls->0->>'run_id' = $1::text" in sql
    assert "tool_calls->0->>'tool_call_id'" in sql
    assert pool.args == (_RUN,)


def test_db_read_none_when_everything_answered():
    from app.db import workflows as wdb

    assert asyncio.run(wdb.get_unanswered_ask_user(_RecPool(None), _RUN)) is None


def test_existing_pending_read_is_unchanged():
    import inspect

    from app.db import workflows as wdb

    assert "NOT EXISTS" not in inspect.getsource(wdb.get_pending_ask_user)


# ── 3) the route ──────────────────────────────────────────────────────────────


class _NameOnlyPool:
    def __init__(self, name):
        self.name = name

    async def fetchval(self, *_a, **_k):
        return self.name


def _active_review(store, status="active", run_status="active", golden=None):
    run = next(r for r in store.rows["workflow_runs"] if r["id"] == t188._OWNED_RUN_ID)
    run["status"] = run_status
    if golden is not None:
        run["is_golden_run"] = golden
    for p in store.rows["workflow_phases"]:
        if p["slug"] == "review":
            p["status"] = status
            p["started_at"] = "2026-08-05T10:03:00+00:00"
    for d in store.rows["workflow_definitions"]:
        if d["id"] == t188._OLD_DEF_ID:
            for ph in d["definition"]["phases"]:
                if ph["slug"] == "review":
                    ph["name"] = "Manager sign-off"


def _wire(monkeypatch, *, name="Dana Whitfield", prompt="Approve the Q3 numbers?", raises=False):
    import app.dependencies as deps
    from app.api import workflow_runs as wr

    async def _pool():
        return _NameOnlyPool(name)

    async def _unanswered(pool, run_id):
        if raises:
            raise RuntimeError("pool down")
        return None if prompt is None else {"tool_call_id": "t", "prompt": prompt}

    monkeypatch.setattr(deps, "get_pg_pool", _pool)
    monkeypatch.setattr(wr.workflows_db, "get_unanswered_ask_user", _unanswered)


def test_active_run_gets_a_worded_waiting_on(client, monkeypatch):
    store = t188._canvas_on(monkeypatch)
    _active_review(store)
    _wire(monkeypatch)
    body = client.get(f"/workflow-runs/{t188._OWNED_RUN_ID}").json()
    w = body["waiting_on"]
    assert w["sentence"] == 'Waiting on Dana Whitfield (you) to answer "Approve the Q3 numbers?".'
    assert w["step_name"] == "Manager sign-off"
    assert w["window_passed"] is False
    assert t188._OWNER_ID not in w["sentence"]


def test_paused_run_keeps_the_line_with_window_passed(client, monkeypatch):
    store = t188._canvas_on(monkeypatch)
    _active_review(store, run_status="paused")
    _wire(monkeypatch)
    w = client.get(f"/workflow-runs/{t188._OWNED_RUN_ID}").json()["waiting_on"]
    assert w["window_passed"] is True
    assert "expire" not in w["sentence"].lower()


def test_same_read_twice_is_identical_reload(client, monkeypatch):
    store = t188._canvas_on(monkeypatch)
    _active_review(store)
    _wire(monkeypatch)
    a = client.get(f"/workflow-runs/{t188._OWNED_RUN_ID}").json()["waiting_on"]
    b = client.get(f"/workflow-runs/{t188._OWNED_RUN_ID}").json()["waiting_on"]
    assert a == b


@pytest.mark.parametrize("case", ["terminal", "golden", "no_prompt", "failure"])
def test_waiting_on_is_none(client, monkeypatch, case):
    store = t188._canvas_on(monkeypatch)
    if case == "terminal":
        _active_review(store, status="completed", run_status="completed")
        _wire(monkeypatch)
    elif case == "golden":
        _active_review(store, golden=True)
        _wire(monkeypatch)
    elif case == "no_prompt":
        _active_review(store)
        _wire(monkeypatch, prompt=None)
    else:
        _active_review(store)
        _wire(monkeypatch, raises=True)
    resp = client.get(f"/workflow-runs/{t188._OWNED_RUN_ID}")
    assert resp.status_code == 200, resp.text
    assert resp.json().get("waiting_on") is None


def test_foreign_run_still_one_404_and_no_waiting_lookup(client, monkeypatch):
    store = t188._canvas_on(monkeypatch)
    _active_review(store)
    called = []
    _wire(monkeypatch)
    from app.api import workflow_runs as wr

    async def _spy(pool, run_id):
        called.append(run_id)
        return None

    monkeypatch.setattr(wr.workflows_db, "get_unanswered_ask_user", _spy)
    resp = client.get(f"/workflow-runs/{t188._FOREIGN_RUN_ID}")
    assert resp.status_code == 404 and resp.json() == {"detail": "Run not found"}
    assert called == []
