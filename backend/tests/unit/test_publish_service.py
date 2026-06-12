"""Phase 102 (QUAL-01) — the server-side publish path (the output-quality gate).

``POST /workflows/{id}/publish`` is the ONLY way a draft becomes published (D-07),
enforcing IN ORDER: business_requirement -> structural lint (reachability) -> golden
run (real engine, real KB, flagged validation run) -> judge verdict -> flip. A lint-clean
workflow that produces bad output cannot publish (the HARD blocker).

A blocked publish returns a structured verdict naming the blocked stage + named failures
+ the golden ``workflow_run`` id (D-08).

LIVE ACCEPTANCE (D-05 / Pitfall 4 — the 099/101 mock-mask lesson): these UNIT tests mock
the golden-run + judge BOUNDARIES (``_drive_golden_run`` / ``_judge_golden_output``) to
assert the pipeline ORDER and the hard-blocker contract deterministically. The REAL
acceptance is the LIVE golden run against the project KB on the VALIDATION.md SC#10 4-axis
scoreboard — NOT these mocked tests.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch
from uuid import UUID, uuid4

import pytest

from app.services.harness import publish_service

_USER = {"id": str(uuid4())}
_DEF_ID = uuid4()


def _definition_row(*, business_requirement: str | None, lint_clean: bool = True, status: str = "draft") -> dict:
    """A get_definition row whose `definition` JSONB model_validates to a workflow.

    `lint_clean=True` yields a single-phase (contiguous index 0) llm_single workflow
    the reachability lint passes. `lint_clean=False` yields a non-contiguous index
    (a BAD_INDEX lint error) so the pipeline short-circuits at the lint stage.
    """
    phase_index = 0 if lint_clean else 5  # 5 with one phase → non-contiguous → bad_index
    definition = {
        "slug": "qual-test",
        "version": 1,
        "name": "Quality Test Workflow",
        "status": status,
        "phases": [
            {
                "slug": "answer",
                "phase_index": phase_index,
                "config": {"phase_type": "llm_single", "prompt": "Answer the question."},
                "validators": [],
            }
        ],
        "business_requirement": business_requirement,
    }
    return {
        "id": _DEF_ID,
        "slug": "qual-test",
        "version": 1,
        "name": "Quality Test Workflow",
        "status": status,
        "definition": definition,
        "created_by": UUID(_USER["id"]),
    }


async def _call(**overrides):
    """Invoke publish() with all DB + boundary helpers patched."""
    return await publish_service.publish(
        definition_id=overrides.get("definition_id", _DEF_ID),
        golden_input=overrides.get("golden_input", "a representative kickoff prompt"),
        user=overrides.get("user", _USER),
        pool=overrides.get("pool", AsyncMock()),
        redis=overrides.get("redis", AsyncMock()),
    )


@pytest.mark.asyncio
async def test_publish_requires_business_requirement():
    """A draft with no ``business_requirement`` -> a structured block
    (``blocked_stage == "business_requirement"``), no flip, no golden run (D-13)."""
    row = _definition_row(business_requirement=None)
    with (
        patch.object(publish_service, "publish_workflow", publish_service.publish_workflow),
        patch("app.db.workflows.get_definition", AsyncMock(return_value=row)),
        patch("app.db.workflows.write_audit", AsyncMock()),
        patch.object(publish_service, "_drive_golden_run", AsyncMock()) as drive,
        patch("app.db.workflows.publish_definition", AsyncMock()) as flip,
    ):
        result = await _call()

    assert result["published"] is False
    assert result["blocked_stage"] == "business_requirement"
    assert result["golden_run_id"] is None
    drive.assert_not_called()  # blocked BEFORE the golden run
    flip.assert_not_called()  # no flip


@pytest.mark.asyncio
async def test_publish_pipeline_order():
    """Lint short-circuits BEFORE the golden run: a lint-failing definition blocks with
    ``blocked_stage == "lint"`` and NEVER drives a golden run."""
    row = _definition_row(business_requirement="Deliver a cited answer.", lint_clean=False)
    with (
        patch("app.db.workflows.get_definition", AsyncMock(return_value=row)),
        patch("app.db.workflows.write_audit", AsyncMock()),
        patch.object(publish_service, "_drive_golden_run", AsyncMock()) as drive,
        patch("app.db.workflows.publish_definition", AsyncMock()) as flip,
    ):
        result = await _call()

    assert result["published"] is False
    assert result["blocked_stage"] == "lint"
    assert result["named_failures"]  # the lint codes
    drive.assert_not_called()  # lint short-circuits BEFORE create_workflow_run
    flip.assert_not_called()


@pytest.mark.asyncio
async def test_bad_output_blocks_publish():
    """A lint-clean workflow whose judge returns ``overall_passed=False`` -> blocked
    (``blocked_stage == "judge"``) + the golden_run_id present + NO flip (the QUAL-01
    hard blocker; the SEED-050 delegates-back-to-user trap)."""
    row = _definition_row(business_requirement="Deliver a cited answer.")
    golden_run_id = uuid4()
    bad_verdict = {
        "overall_passed": False,
        "overall_score": 30,
        "summary": "The output asked the user to do the research instead of doing it.",
        "criteria": [
            {"criterion": "did_the_work_not_delegated", "passed": False, "score": 0,
             "evidence": "punts back to the user"},
        ],
    }
    with (
        patch("app.db.workflows.get_definition", AsyncMock(return_value=row)),
        patch("app.db.workflows.write_audit", AsyncMock()),
        patch.object(
            publish_service, "_drive_golden_run",
            AsyncMock(return_value=(golden_run_id, {"text": "you should research X"}, "completed")),
        ),
        patch.object(publish_service, "_judge_golden_output", AsyncMock(return_value=bad_verdict)),
        patch("app.db.workflows.publish_definition", AsyncMock()) as flip,
    ):
        result = await _call()

    assert result["published"] is False
    assert result["blocked_stage"] == "judge"
    assert result["golden_run_id"] == golden_run_id  # a real, browsable golden run
    assert result["named_failures"]  # the per-criterion critique + summary
    flip.assert_not_called()  # the QUAL-01 hard blocker — NO flip on a judge fail


@pytest.mark.asyncio
async def test_good_output_publishes():
    """A lint-clean workflow whose judge passes flips draft->published and returns
    the version + the golden_run_id (the happy path — the gate is not a wall for good
    output)."""
    row = _definition_row(business_requirement="Deliver a cited answer.")
    golden_run_id = uuid4()
    good_verdict = {
        "overall_passed": True,
        "overall_score": 92,
        "summary": "Grounded, answers the requirement, did the work.",
        "criteria": [],
    }
    with (
        patch("app.db.workflows.get_definition", AsyncMock(return_value=row)),
        patch("app.db.workflows.write_audit", AsyncMock()),
        patch.object(
            publish_service, "_drive_golden_run",
            AsyncMock(return_value=(golden_run_id, {"text": "a grounded answer [doc1]"}, "completed")),
        ),
        patch.object(publish_service, "_judge_golden_output", AsyncMock(return_value=good_verdict)),
        patch("app.db.workflows.publish_definition", AsyncMock(return_value=2)) as flip,
    ):
        result = await _call()

    assert result["published"] is True
    assert result["version"] == 2
    assert result["golden_run_id"] == golden_run_id
    flip.assert_called_once()  # the flip happened


@pytest.mark.asyncio
async def test_cross_user_draft_is_not_found():
    """A draft the caller does not own (get_definition returns None) -> a uniform
    not_found block (the route 404s — no existence leak, V4 / T-102-05-06)."""
    with (
        patch("app.db.workflows.get_definition", AsyncMock(return_value=None)),
        patch("app.db.workflows.write_audit", AsyncMock()),
        patch.object(publish_service, "_drive_golden_run", AsyncMock()) as drive,
    ):
        result = await _call()

    assert result["published"] is False
    assert result["blocked_stage"] == "not_found"
    drive.assert_not_called()


@pytest.mark.asyncio
async def test_golden_run_error_is_structured_not_raised():
    """A golden-run crash returns a structured ``golden_run_error`` block — the publish
    path NEVER raises into the route (the sealed-orchestration backstop)."""
    row = _definition_row(business_requirement="Deliver a cited answer.")
    with (
        patch("app.db.workflows.get_definition", AsyncMock(return_value=row)),
        patch("app.db.workflows.write_audit", AsyncMock()),
        patch.object(
            publish_service, "_drive_golden_run",
            AsyncMock(side_effect=RuntimeError("engine blew up")),
        ),
        patch("app.db.workflows.publish_definition", AsyncMock()) as flip,
    ):
        result = await _call()  # must NOT raise

    assert result["published"] is False
    assert result["blocked_stage"] == "golden_run_error"
    flip.assert_not_called()
