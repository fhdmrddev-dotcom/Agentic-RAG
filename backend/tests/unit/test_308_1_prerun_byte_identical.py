"""Phase 308.1 (BUG-261107-01, D-07, ROADMAP SC#4) — every pre-run publish answer, pinned byte-for-byte.

WHAT IS PINNED. ``POST /workflows/{definition_id}/publish`` answers seven ways WITHOUT ever
starting a golden run: stage 0 (``not_found`` -> 404, ``already_published`` -> 409,
``definition_invalid`` -> 200), stage 1 (``business_requirement`` -> 400, WF-P1), stage 2
(``lint`` -> 200 with a ``no_template_bound`` named failure, WF-P2), stage 2.5
(``interactive_phase`` -> 200) and stage 2.6 (``grounding_fidelity`` -> 200). For each, this file
records the HTTP status and the RAW response bytes, driven as a real request through
``fastapi.testclient.TestClient`` over a bare ``FastAPI()`` that includes
``app.api.workflows.router`` — so the route's HTTP mapping, ``PublishVerdict`` serialisation and
``HTTPException`` detail encoding are all inside the pin, not just the service's dict.

WHY. Phase 308.1 moves the golden run out of the request (it starts in the background and the
POST answers 202 with a handle). The success criterion that keeps that change honest is that
nothing an author sees BEFORE a run changes: WF-P1 and WF-P2 must be byte-identical before and
after. Every case also proves the refusal never started a golden run: ``_drive_golden_run`` is
patched to raise, and ``app.db.workflows.create_workflow_run`` is asserted never awaited.

CAPTURE MODE: ``PIN3081_CAPTURE=1`` writes ``backend/tests/fixtures/phase308_1/prerun_answers.json``
instead of asserting. It was run exactly once, on the UNCHANGED tree at ``13b344843`` (plan
308.1-01 Task 1, before ``publish_service.py`` was touched), and each recorded body was read and
confirmed to be the refusal its case names.

⛔ RE-CAPTURING THIS FIXTURE IS A DELIBERATE RE-BASELINE. It needs a written reason appended to
this docstring — the date, the plan, which case changed and the +/- of the diff — exactly as
``test_286_workflows_seam_pins.py`` records its re-baselines. A re-capture with no reason here
blesses whatever the change did, which is the one thing this pin exists to prevent.

⚠ KNOWN SENSITIVITY: the ``definition_invalid`` body embeds pydantic's own ``ValidationError``
text (including its ``errors.pydantic.dev/<version>`` link). A pydantic upgrade changes those
bytes without any change to publish; that is a legitimate re-baseline, recorded as above.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from unittest.mock import AsyncMock, patch
from uuid import UUID

import pytest

_BACKEND = Path(__file__).resolve().parents[2]
_FIXTURE = _BACKEND / "tests" / "fixtures" / "phase308_1" / "prerun_answers.json"
_CAPTURE = os.environ.get("PIN3081_CAPTURE") == "1"

_USER_ID = "3081a0d1-0000-4000-8000-000000000001"
_DEF_ID = UUID("3081a0d1-0000-4000-8000-0000000000d1")
_ORG_ID = "3081a0d1-0000-4000-8000-00000000a0d1"

_CASES = (
    "not_found",
    "already_published",
    "definition_invalid",
    "business_requirement",
    "lint_no_template_bound",
    "interactive_phase",
    "grounding_fidelity",
)


def _definition(*, business_requirement="Deliver a cited answer.", phases=None) -> dict:
    return {
        "slug": "pin-3081",
        "version": 1,
        "name": "Pin 308.1 workflow",
        "status": "draft",
        "phases": phases
        or [
            {
                "slug": "answer",
                "phase_index": 0,
                "config": {"phase_type": "llm_single", "prompt": "Answer the question."},
                "validators": [],
            }
        ],
        "business_requirement": business_requirement,
    }


def _row(definition, *, status: str = "draft") -> dict:
    return {
        "id": _DEF_ID,
        "slug": "pin-3081",
        "version": 1,
        "name": "Pin 308.1 workflow",
        "status": status,
        "definition": definition,
        "created_by": UUID(_USER_ID),
        "token": "pin-3081-token",
    }


def _case_setup(case: str):
    """``(get_definition return value, grounding failures)`` for one case."""
    if case == "not_found":
        return None, []
    if case == "already_published":
        return _row(_definition(), status="published"), []
    if case == "definition_invalid":
        # ``phases`` must be a list — a mapping fails ``WorkflowDefinition.model_validate``.
        return _row({"slug": "pin-3081", "version": 1, "name": "x", "phases": {"bad": True}}), []
    if case == "business_requirement":
        return _row(_definition(business_requirement=None)), []
    if case == "lint_no_template_bound":
        # Phase 295 (D-12): a fill step with no template attached is refused at publish.
        phases = [
            {
                "slug": "gather",
                "phase_index": 0,
                "name": "Gather the facts",
                "config": {"phase_type": "llm_single", "prompt": "Gather."},
                "validators": [],
            },
            {
                "slug": "fill-report",
                "phase_index": 1,
                "name": "Fill the status report",
                "config": {"phase_type": "llm_emit", "prompt": "Fill it.", "emitter": "render_template"},
                "validators": [],
            },
        ]
        return _row(_definition(phases=phases)), []
    if case == "interactive_phase":
        # 288-02: a pause step whose wait is not a real, bounded window.
        phases = [
            {
                "slug": "approve",
                "phase_index": 0,
                "name": "Approve the draft",
                "config": {
                    "phase_type": "llm_human_input",
                    "prompt": "Approve this?",
                    "timeout_seconds": 0,
                },
                "validators": [],
            }
        ]
        return _row(_definition(phases=phases)), []
    if case == "grounding_fidelity":
        return _row(_definition()), [
            {
                "code": "unknown_tool",
                "phase": "answer",
                "message": "step 'answer' names a tool that does not exist",
            }
        ]
    raise AssertionError(f"unknown case {case!r}")


def _drive(case: str, monkeypatch) -> tuple[int, bytes, AsyncMock, AsyncMock]:
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    import app.dependencies as deps
    import app.services.entitlement_service as ent
    from app.api import workflows as wf_api
    from app.services.harness import publish_service

    # The gates (Phase 148 visibility, Phase 258 capability) are neutralised exactly as
    # test_103_nl_generate.py does: the pin measures publish, not the gates in front of it.
    monkeypatch.setattr(deps, "is_operator", AsyncMock(return_value=True))
    monkeypatch.setattr(ent, "enforce_entitlement", AsyncMock(return_value=None))

    original_get_pg_pool = deps.get_pg_pool

    async def _fake_pool():
        return AsyncMock()

    # The route body calls ``get_pg_pool()`` by name — patch where it is LOOKED UP.
    monkeypatch.setattr(wf_api, "get_pg_pool", _fake_pool)

    row, grounding = _case_setup(case)

    app = FastAPI()
    app.dependency_overrides[wf_api.get_current_user] = lambda: {"id": _USER_ID}
    app.dependency_overrides[deps.get_redis] = lambda: AsyncMock()
    app.dependency_overrides[original_get_pg_pool] = lambda: AsyncMock()
    app.dependency_overrides[deps.get_active_org_id] = lambda: _ORG_ID
    app.include_router(wf_api.router)

    drive = AsyncMock(side_effect=AssertionError("a pre-run refusal must never drive a golden run"))
    create_run = AsyncMock(side_effect=AssertionError("a pre-run refusal must never create a run"))
    with (
        # publish_service imports these function-locally from app.db.workflows.
        patch("app.db.workflows.get_definition", AsyncMock(return_value=row)),
        patch("app.db.workflows.write_audit", AsyncMock()),
        patch("app.db.workflows.publish_definition", AsyncMock(return_value=-1)),
        patch("app.db.workflows.create_workflow_run", create_run),
        patch.object(publish_service, "_drive_golden_run", drive),
        patch.object(
            publish_service, "_grounding_fidelity_failures", AsyncMock(return_value=grounding)
        ),
    ):
        client = TestClient(app)
        resp = client.post(
            f"/workflows/{_DEF_ID}/publish",
            json={"golden_input": "a representative kickoff prompt"},
        )
    return resp.status_code, resp.content, drive, create_run


def _read_fixture() -> dict:
    assert _FIXTURE.exists(), f"missing fixture {_FIXTURE} — captured once, at the phase base"
    return json.loads(_FIXTURE.read_text(encoding="utf-8"))


@pytest.mark.parametrize("case", _CASES)
def test_pre_run_answer_is_byte_identical_and_starts_no_golden_run(case, monkeypatch):
    status_code, content, drive, create_run = _drive(case, monkeypatch)

    # The refusal never reached the golden run, on any worker, in any form.
    drive.assert_not_awaited()
    create_run.assert_not_awaited()

    if _CAPTURE:
        captured = json.loads(_FIXTURE.read_text(encoding="utf-8")) if _FIXTURE.exists() else {}
        captured[case] = {"status": status_code, "body": content.decode("utf-8")}
        ordered = {k: captured[k] for k in _CASES if k in captured}
        _FIXTURE.parent.mkdir(parents=True, exist_ok=True)
        _FIXTURE.write_text(
            json.dumps(ordered, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
            newline="\n",
        )
        return

    expected = _read_fixture()[case]
    assert status_code == expected["status"], (
        f"{case}: status {status_code} != pinned {expected['status']} (D-07: pre-run answers "
        "are byte-identical; a deliberate change needs a written re-baseline in this docstring)"
    )
    assert content == expected["body"].encode("utf-8"), (
        f"{case}: body changed.\n  now:    {content!r}\n  pinned: {expected['body']!r}"
    )


def test_the_fixture_pins_all_seven_answers_and_nothing_else():
    """Non-vacuity: seven cases, each a pre-run status, each the refusal its name claims."""
    if _CAPTURE:
        pytest.skip("capture run — the fixture is being written")
    fixture = _read_fixture()
    assert list(fixture) == list(_CASES), f"fixture keys {list(fixture)} != {list(_CASES)}"
    assert {v["status"] for v in fixture.values()} <= {200, 400, 404, 409}
    assert fixture["not_found"]["status"] == 404
    assert fixture["already_published"]["status"] == 409
    assert fixture["business_requirement"]["status"] == 400
    assert '"business_requirement"' in fixture["business_requirement"]["body"]
    for case, stage in (
        ("definition_invalid", "definition_invalid"),
        ("lint_no_template_bound", "lint"),
        ("interactive_phase", "interactive_phase"),
        ("grounding_fidelity", "grounding_fidelity"),
    ):
        assert fixture[case]["status"] == 200, case
        body = json.loads(fixture[case]["body"])
        assert body["published"] is False and body["blocked_stage"] == stage, (case, body)
        assert body["golden_run_id"] is None, (case, body)
    lint_codes = {f.get("code") for f in json.loads(fixture["lint_no_template_bound"]["body"])["named_failures"]}
    assert "no_template_bound" in lint_codes, lint_codes
