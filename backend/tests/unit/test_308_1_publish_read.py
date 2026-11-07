"""Phase 308.1-03 (BUG-261107-01, D-04 / D-20) — ``GET /workflows/{definition_id}/publish``.

The POST now answers 202 with a handle while the golden run continues in the background; this is
the ONE read the publish screen (and any API caller) follows it with. It returns the caller's
latest attempt on a draft: ``{state, golden_run_id, verdict, progress}``.

* owner-scoped exactly like the POST: a missing draft, someone else's draft, and a GLOBAL
  published row created by another user (``get_definition`` returns those to anyone) are all the
  POST's uniform ``404 "workflow not found"``;
* an owner with no attempt gets ``200 {state: "none", ...}`` (they own the row; nothing leaks);
* ``progress.step_name`` is the AUTHORED step name, never the slug; ``step_index`` is 1-based;
  ``started_at`` is the run's ``created_at`` (a re-drive re-stamps ``claimed_at``);
* the body never carries the attempt's golden input or its stage-0 token;
* the route carries the POST's two gates and resolves to this handler in the full app.

The handler lives in its own router (``api/workflow_publish.py``, D-04): ``api/workflows.py``'s
split is OWED. Database reads are patched at ``app.db.workflows`` (function-local imports).
"""

from __future__ import annotations

import inspect
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch
from uuid import UUID, uuid4

import pytest

_ME = str(uuid4())
_OTHER = str(uuid4())
_DEF_ID = uuid4()
_RUN_ID = uuid4()
_STARTED = datetime(2026, 11, 7, 9, 30, tzinfo=timezone.utc)

# Distinctive strings: if either ever reaches the body, the test names it.
_SECRET_INPUT = "GOLDEN-INPUT-MUST-NOT-LEAK-7731"
_SECRET_TOKEN = "STAGE0-TOKEN-MUST-NOT-LEAK-9902"

_SNAPSHOT = {
    "slug": "qual",
    "version": 1,
    "name": "Quality",
    "status": "draft",
    "business_requirement": "Deliver a cited answer.",
    "phases": [
        {"slug": f"s{i}", "phase_index": i, "name": name,
         "config": {"phase_type": "llm_single", "prompt": "p"}, "validators": []}
        for i, name in enumerate(["Read the brief", "Draft the answer", None, "Check", "Send"])
    ],
}


def _phases(active_index: int | None):
    rows = []
    for i in range(5):
        if active_index is None:
            status = "completed"
        else:
            status = "completed" if i < active_index else ("active" if i == active_index else "pending")
        rows.append({"phase_index": i, "slug": f"s{i}", "status": status, "output": None})
    return rows


def _attempt(state: str, verdict=None):
    # What latest_publish_attempt returns. A careless handler reading the whole record would
    # still never see the secrets: the db read does not select them. They are planted on the
    # snapshot anyway so a leak through ANY field is caught.
    snapshot = dict(_SNAPSHOT, business_requirement=f"{_SECRET_INPUT} {_SECRET_TOKEN}")
    return {
        "run_id": _RUN_ID,
        "status": "active" if state != "done" else "completed",
        "created_at": _STARTED,
        "definition_snapshot": snapshot,
        "state": state,
        "verdict": verdict,
    }


def _definition(*, created_by=_ME, status="draft"):
    return {"id": _DEF_ID, "slug": "qual", "version": 1, "name": "Quality", "status": status,
            "definition": _SNAPSHOT, "created_by": created_by, "token": _SECRET_TOKEN}


@pytest.fixture
def client(monkeypatch):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    import app.dependencies as deps
    import app.services.entitlement_service as ent
    from app.api import workflow_publish

    # The gates are neutralised exactly like test_103_nl_generate's bare app.
    monkeypatch.setattr(deps, "is_operator", AsyncMock(return_value=True))
    monkeypatch.setattr(ent, "enforce_entitlement", AsyncMock(return_value=None))

    async def _pool():
        return object()

    monkeypatch.setattr(workflow_publish, "get_pg_pool", _pool)
    app = FastAPI()
    app.dependency_overrides[deps.get_current_user] = lambda: {"id": _ME}
    app.dependency_overrides[deps.get_active_org_id] = lambda: "00000000-0000-0000-0000-00000000a0d1"
    app.dependency_overrides[deps.get_pg_pool] = _pool
    app.include_router(workflow_publish.router)
    return TestClient(app)


def _patched(definition, attempt, phases=None):
    return (
        patch("app.db.workflows.get_definition", AsyncMock(return_value=definition)),
        patch("app.db.workflows.latest_publish_attempt", AsyncMock(return_value=attempt)),
        patch("app.db.workflows.load_run_phases", AsyncMock(return_value=phases or [])),
    )


def _get(client, definition, attempt, phases=None):
    p1, p2, p3 = _patched(definition, attempt, phases)
    with p1 as get_def, p2 as latest, p3:
        resp = client.get(f"/workflows/{_DEF_ID}/publish")
    return resp, get_def, latest


# ── the owner's attempt states ──────────────────────────────────────────────────────────────────


def test_a_running_attempt_reports_the_authored_step_its_position_and_the_run_start(client):
    resp, get_def, latest = _get(client, _definition(), _attempt("running"), _phases(1))
    assert resp.status_code == 200
    assert resp.json() == {
        "state": "running",
        "golden_run_id": str(_RUN_ID),
        "verdict": None,
        "progress": {
            "step_index": 2,
            "step_count": 5,
            "step_name": "Draft the answer",
            "started_at": "2026-11-07T09:30:00Z",
        },
    }
    from app.config import settings

    assert latest.await_args.kwargs == {
        "definition_id": _DEF_ID,
        "user_id": UUID(_ME),
        "lease_seconds": settings.harness_resume_lease_seconds,  # 308.1 review CR-02
        "max_age_seconds": settings.harness_publish_max_seconds,  # 308.1 review WR-06
    }
    assert get_def.await_args.kwargs["user_id"] == UUID(_ME)


def test_an_unnamed_active_step_has_no_name_never_its_slug(client):
    resp, _, _ = _get(client, _definition(), _attempt("running"), _phases(2))
    progress = resp.json()["progress"]
    assert progress["step_index"] == 3
    assert progress["step_name"] is None
    assert "s2" not in resp.text


def test_between_steps_there_is_no_active_step(client):
    resp, _, _ = _get(client, _definition(), _attempt("running"), _phases(None))
    progress = resp.json()["progress"]
    assert progress["step_index"] is None and progress["step_count"] == 5
    assert progress["step_name"] is None


def test_a_finishing_attempt_says_finishing(client):
    resp, _, _ = _get(client, _definition(), _attempt("finishing"), _phases(None))
    assert resp.status_code == 200
    assert resp.json()["state"] == "finishing"
    assert resp.json()["verdict"] is None


def test_a_done_attempt_returns_the_recorded_verdict(client):
    verdict = {"published": False, "blocked_stage": "judge", "named_failures": ["not cited"],
               "golden_run_id": str(_RUN_ID), "blocked_step": None}
    resp, _, _ = _get(client, _definition(), _attempt("done", verdict), _phases(None))
    body = resp.json()
    assert resp.status_code == 200
    assert body["state"] == "done"
    assert body["golden_run_id"] == str(_RUN_ID)
    assert body["verdict"]["published"] is False
    assert body["verdict"]["blocked_stage"] == "judge"
    assert body["verdict"]["named_failures"] == ["not cited"]
    assert body["verdict"]["golden_run_id"] == str(_RUN_ID)


def test_a_published_verdict_carries_its_version(client):
    verdict = {"published": True, "version": 4, "golden_run_id": str(_RUN_ID)}
    resp, _, _ = _get(client, _definition(), _attempt("done", verdict))
    assert resp.json()["verdict"]["published"] is True
    assert resp.json()["verdict"]["version"] == 4


def test_an_owner_with_no_attempt_gets_state_none(client):
    resp, _, _ = _get(client, _definition(), None)
    assert resp.status_code == 200
    assert resp.json() == {"state": "none", "golden_run_id": None, "verdict": None, "progress": None}


# ── 308.1 review CR-02 (c): a stranded tail is recovered on READ, not only at a worker boot ─────


def _get_recovering(client, attempt):
    from unittest.mock import MagicMock

    p1, p2, p3 = _patched(_definition(), attempt, _phases(None))
    with (
        p1, p2 as latest, p3,
        patch("app.services.harness.publish_attempt.recover_publish_tail", MagicMock()) as recover,
    ):
        resp = client.get(f"/workflows/{_DEF_ID}/publish")
    return resp, recover, latest


@pytest.mark.parametrize("state", ["running", "finishing"])
def test_a_stranded_tail_is_recovered_by_the_read_and_the_current_state_answered(client, state):
    """CR-02: all recovery used to run only at process boot, so a record left ``running`` on an
    ended run (a Stop, a DB blip before the claim) or a dead ``finishing`` claim spun the publish
    screen until the next restart. The read now spawns the recovered tail (the CAS keeps it
    exactly-once) and answers what it found; the next poll reads the verdict."""
    from app.config import settings

    attempt = dict(_attempt(state), status="cancelled", tail_stranded=True)
    resp, recover, latest = _get_recovering(client, attempt)
    assert resp.status_code == 200
    assert resp.json()["state"] == state
    recover.assert_called_once()
    assert recover.call_args.args == (_RUN_ID,)
    assert "pool" in recover.call_args.kwargs
    assert latest.await_args.kwargs["lease_seconds"] == settings.harness_resume_lease_seconds


def test_a_stranded_tail_past_the_budget_is_recovered_as_a_timeout(client):
    """308.1 review WR-06: an attempt past the publish budget is never judged when recovered."""
    from app.config import settings

    attempt = dict(_attempt("running"), status="completed", tail_stranded=True, tail_expired=True)
    resp, recover, latest = _get_recovering(client, attempt)
    assert resp.status_code == 200
    recover.assert_called_once()
    assert recover.call_args.kwargs["expired"] is True
    assert latest.await_args.kwargs["max_age_seconds"] == settings.harness_publish_max_seconds


@pytest.mark.parametrize("state", ["running", "finishing", "done"])
def test_a_live_attempt_is_never_recovered_by_the_read(client, state):
    verdict = {"published": True, "version": 2, "golden_run_id": str(_RUN_ID)} if state == "done" else None
    attempt = dict(_attempt(state, verdict), tail_stranded=False)
    resp, recover, _ = _get_recovering(client, attempt)
    assert resp.status_code == 200
    recover.assert_not_called()


def test_a_recovery_that_cannot_start_never_breaks_the_read(client):
    from unittest.mock import MagicMock

    attempt = dict(_attempt("running"), status="completed", tail_stranded=True)
    p1, p2, p3 = _patched(_definition(), attempt, _phases(None))
    with (
        p1, p2, p3,
        patch("app.services.harness.publish_attempt.recover_publish_tail",
              MagicMock(side_effect=RuntimeError("no loop"))),
    ):
        resp = client.get(f"/workflows/{_DEF_ID}/publish")
    assert resp.status_code == 200
    assert resp.json()["state"] == "running"


# ── the POST's uniform 404 ──────────────────────────────────────────────────────────────────────


def test_a_missing_draft_is_the_posts_404(client):
    resp, _, latest = _get(client, None, _attempt("running"))
    assert resp.status_code == 404
    assert resp.json() == {"detail": "workflow not found"}
    latest.assert_not_awaited()


def test_someone_elses_global_published_row_is_the_same_404(client):
    """``get_definition`` returns a global published row to ANYONE; that must never be a 200."""
    resp, _, latest = _get(
        client, _definition(created_by=_OTHER, status="published"), _attempt("done")
    )
    assert resp.status_code == 404
    assert resp.json() == {"detail": "workflow not found"}
    latest.assert_not_awaited()


def test_a_non_owned_draft_is_the_same_404(client):
    resp, _, _ = _get(client, _definition(created_by=_OTHER), _attempt("running"))
    assert resp.status_code == 404
    assert resp.json() == {"detail": "workflow not found"}


# ── nothing secret leaves ───────────────────────────────────────────────────────────────────────


@pytest.mark.parametrize("state", ["running", "finishing", "done"])
def test_the_body_never_carries_the_golden_input_or_the_token(client, state):
    verdict = {"published": True, "version": 2, "golden_run_id": str(_RUN_ID)} if state == "done" else None
    resp, _, _ = _get(client, _definition(), _attempt(state, verdict), _phases(1))
    assert resp.status_code == 200
    assert _SECRET_INPUT not in resp.text
    assert _SECRET_TOKEN not in resp.text
    assert "golden_input" not in resp.text and "stage0_token" not in resp.text


def test_the_module_never_names_the_secret_record_keys():
    import ast

    from app.api import workflow_publish

    tree = ast.parse(inspect.getsource(workflow_publish))
    for node in ast.walk(tree):
        if isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name):
            assert node.target.id not in ("golden_input", "stage0_token")
        if isinstance(node, ast.Subscript) and isinstance(node.slice, ast.Constant):
            assert node.slice.value not in ("golden_input", "stage0_token")
        if (isinstance(node, ast.Call) and getattr(node.func, "attr", None) == "get"
                and node.args and isinstance(node.args[0], ast.Constant)):
            assert node.args[0].value not in ("golden_input", "stage0_token")


# ── the full app: gates and resolution ──────────────────────────────────────────────────────────


def _full_app_route():
    from fastapi.routing import APIRoute

    from app.main import app

    matches = [
        r for r in app.routes
        if isinstance(r, APIRoute) and r.path == "/workflows/{definition_id}/publish"
        and "GET" in r.methods
    ]
    return app, matches


def test_the_get_resolves_to_the_new_handler_and_nothing_shadows_it():
    from starlette.routing import Match

    app, matches = _full_app_route()
    assert len(matches) == 1
    assert matches[0].endpoint.__module__ == "app.api.workflow_publish"
    scope = {"type": "http", "path": f"/workflows/{_DEF_ID}/publish", "method": "GET"}
    first_full = next(r for r in app.routes if r.matches(scope)[0] == Match.FULL)
    assert first_full is matches[0]


def test_the_get_carries_the_posts_two_gates():
    _, matches = _full_app_route()
    calls = [d.call for d in matches[0].dependant.dependencies]
    closures = [inspect.getclosurevars(c).nonlocals for c in calls if inspect.isfunction(c)]
    assert {"feature": "workflow_authoring"}.items() <= next(
        (c for c in closures if "feature" in c), {}
    ).items()
    assert {"capability": "workflows"}.items() <= next(
        (c for c in closures if "capability" in c), {}
    ).items()
    names = {getattr(c, "__qualname__", "") for c in calls}
    assert any(n.startswith("require_visible") for n in names)
    assert any(n.startswith("require_capability") for n in names)
    assert any(getattr(c, "__name__", "") == "get_current_user" for c in calls)
