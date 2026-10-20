"""Phase 288-02 (AUTH-01) -- the gauntlet learns the pause, and removes nothing.

D-08 / A-03: a human-input step's ``timeout_seconds`` is refused at the gauntlet when it is
<= 0 or above ``settings.ask_user_max_timeout_seconds`` (1800 s = 30 minutes). Before this
phase NOTHING defined an "unbounded wait": ``0``/negative meant an immediate timeout then
``pause_run`` and ``99999`` was silently clamped by the executor. 300 (default) and 1800
(the ceiling) still publish.

D-07 / A-04: a successful publish of a pause workflow carries ``auto_answered`` -- a worded
note, per pause actually answered automatically in the golden run, that it was not exercised
by a person. DERIVED FROM THE GOLDEN RUN'S PERSISTED PHASE OUTPUTS (``_golden_run_mock``),
never a static scan, so a pause skipped by ``skip_to_phase`` is never claimed answered.

The ask_user validator refusal is untouched and re-asserted here (SEED-137 / SEED-187).
"""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, patch
from uuid import UUID, uuid4

import pytest

from app.models.harness import WorkflowDefinition
from app.services.harness import publish_service

_USER = {"id": str(uuid4())}
_DEF_ID = uuid4()
_FORBIDDEN = ("llm_human_input", "ask_user", "zz-plant-slug")


def _pause_definition(*, timeout=..., name="Approve the draft", slug="zz-plant-slug"):
    config = {"phase_type": "llm_human_input", "prompt": "Approve this?"}
    if timeout is not ...:
        config["timeout_seconds"] = timeout
    phase = {"slug": slug, "phase_index": 0, "config": config, "validators": []}
    if name is not None:
        phase["name"] = name
    return {
        "slug": "qual-test",
        "version": 1,
        "name": "Quality Test Workflow",
        "status": "draft",
        "phases": [phase],
        "business_requirement": "Deliver a cited answer.",
    }


def _row(definition: dict) -> dict:
    return {
        "id": _DEF_ID,
        "slug": "qual-test",
        "version": 1,
        "name": "Quality Test Workflow",
        "status": "draft",
        "definition": definition,
        "created_by": UUID(_USER["id"]),
    }


# ── Task 1: the timeout refusal ─────────────────────────────────────────────────────────
@pytest.mark.parametrize("bad", [0, -5, 99999, 1801])
def test_unbounded_or_out_of_range_pause_timeout_is_refused(bad):
    d = WorkflowDefinition.model_validate(_pause_definition(timeout=bad))
    findings = publish_service._interactive_phase_failures(d)
    assert len(findings) == 1, f"timeout_seconds={bad} must be refused, got {findings!r}"
    assert findings[0]["phase"] == "zz-plant-slug"
    msg = findings[0]["message"]
    assert "30 minutes" in msg, msg
    for token in _FORBIDDEN:
        assert token not in msg, f"{token!r} leaked into copy: {msg!r}"


@pytest.mark.parametrize("ok", [1, 300, 1800])
def test_in_range_pause_timeout_still_publishes(ok):
    d = WorkflowDefinition.model_validate(_pause_definition(timeout=ok))
    assert publish_service._interactive_phase_failures(d) == []


def test_default_timeout_still_publishes():
    d = WorkflowDefinition.model_validate(_pause_definition())
    assert publish_service._interactive_phase_failures(d) == []


def test_unnamed_pause_degrades_without_slug():
    d = WorkflowDefinition.model_validate(_pause_definition(timeout=0, name=None))
    findings = publish_service._interactive_phase_failures(d)
    assert len(findings) == 1
    for token in _FORBIDDEN:
        assert token not in findings[0]["message"]


def test_ask_user_validator_refusal_is_unchanged():
    d = WorkflowDefinition.model_validate(
        {
            "slug": "qual-test",
            "version": 1,
            "name": "Quality Test Workflow",
            "status": "draft",
            "phases": [
                {
                    "slug": "answer",
                    "phase_index": 0,
                    "config": {"phase_type": "llm_single", "prompt": "Answer."},
                    "validators": [
                        {"kind": "regex_match", "config": {"pattern": "x"}, "on_failure": "ask_user"}
                    ],
                }
            ],
            "business_requirement": "x",
        }
    )
    findings = publish_service._interactive_phase_failures(d)
    assert len(findings) == 1 and findings[0]["phase"] == "answer"
    assert "asks a person whenever its check fails" in findings[0]["message"]


@pytest.mark.asyncio
@pytest.mark.parametrize("bad", [0, -5, 99999, 1801])
async def test_publish_blocks_at_interactive_phase_without_golden_run(bad):
    row = _row(_pause_definition(timeout=bad))
    with (
        patch("app.db.workflows.get_definition", AsyncMock(return_value=row)),
        patch("app.db.workflows.write_audit", AsyncMock()),
        patch.object(publish_service, "_drive_golden_run", AsyncMock()) as drive,
        patch("app.db.workflows.publish_definition", AsyncMock()) as flip,
    ):
        result = await _call()
    assert result["published"] is False
    assert result["blocked_stage"] == "interactive_phase"
    drive.assert_not_awaited()
    flip.assert_not_called()


# ── Task 2: auto_answered on the success verdict ────────────────────────────────────────
async def _call():
    return await publish_service.publish(
        definition_id=_DEF_ID,
        golden_input="a representative kickoff prompt",
        user=_USER,
        pool=AsyncMock(),
        redis=AsyncMock(),
    )


async def _publish_with_phase_rows(definition: dict, phase_rows: list):
    good = {"overall_passed": True, "overall_score": 90, "summary": "good", "criteria": []}
    with (
        patch("app.db.workflows.get_definition", AsyncMock(return_value=_row(definition))),
        patch("app.db.workflows.write_audit", AsyncMock()),
        patch("app.db.workflows.load_run_phases", AsyncMock(return_value=phase_rows)),
        patch.object(publish_service, "_grounding_fidelity_failures", AsyncMock(return_value=[])),
        patch.object(
            publish_service,
            "_drive_golden_run",
            AsyncMock(return_value=(uuid4(), {"text": "approved output"}, "completed")),
        ),
        patch.object(publish_service, "_judge_golden_output", AsyncMock(return_value=good)),
        patch("app.db.workflows.publish_definition", AsyncMock(return_value=2)),
    ):
        return await _call()


@pytest.mark.asyncio
async def test_answered_pause_carries_a_worded_auto_answered_note():
    rows = [
        {
            "slug": "zz-plant-slug",
            "phase_index": 0,
            "status": "completed",
            # jsonb string scalar on purpose -- phase_output_object must unwrap it
            "output": json.dumps({"answer": "Approved", "_golden_run_mock": True}),
        }
    ]
    result = await _publish_with_phase_rows(_pause_definition(), rows)
    assert result["published"] is True
    notes = result["auto_answered"]
    assert len(notes) == 1 and notes[0]["phase"] == "zz-plant-slug"
    msg = notes[0]["message"]
    assert "automatically" in msg and "validation" in msg and "person" in msg
    for token in _FORBIDDEN:
        assert token not in msg


@pytest.mark.asyncio
async def test_a_skipped_pause_is_never_claimed_answered():
    rows = [
        {"slug": "zz-plant-slug", "phase_index": 0, "status": "skipped", "output": None}
    ]
    result = await _publish_with_phase_rows(_pause_definition(), rows)
    assert result["published"] is True
    assert not result.get("auto_answered")


@pytest.mark.asyncio
async def test_a_pause_free_workflow_verdict_is_unchanged():
    d = {
        "slug": "qual-test",
        "version": 1,
        "name": "Quality Test Workflow",
        "status": "draft",
        "phases": [
            {
                "slug": "answer",
                "phase_index": 0,
                "config": {"phase_type": "llm_single", "prompt": "Answer."},
                "validators": [],
            }
        ],
        "business_requirement": "Deliver a cited answer.",
    }
    loader = AsyncMock(return_value=[])
    good = {"overall_passed": True, "overall_score": 90, "summary": "good", "criteria": []}
    with (
        patch("app.db.workflows.get_definition", AsyncMock(return_value=_row(d))),
        patch("app.db.workflows.write_audit", AsyncMock()),
        patch("app.db.workflows.load_run_phases", loader),
        patch.object(publish_service, "_grounding_fidelity_failures", AsyncMock(return_value=[])),
        patch.object(
            publish_service,
            "_drive_golden_run",
            AsyncMock(return_value=(uuid4(), {"text": "x"}, "completed")),
        ),
        patch.object(publish_service, "_judge_golden_output", AsyncMock(return_value=good)),
        patch("app.db.workflows.publish_definition", AsyncMock(return_value=2)),
    ):
        result = await _call()
    assert set(result) == {"published", "version", "golden_run_id"}
    loader.assert_not_awaited()  # no pause -> no extra read


def test_wire_field_is_declared_and_not_dropped():
    from app.api.workflow_wire import PublishVerdict

    v = PublishVerdict(
        published=True,
        version=2,
        auto_answered=[{"phase": "p", "message": "m"}],
    )
    assert v.model_dump()["auto_answered"] == [{"phase": "p", "message": "m"}]
    assert PublishVerdict(published=True, version=1).auto_answered == []
