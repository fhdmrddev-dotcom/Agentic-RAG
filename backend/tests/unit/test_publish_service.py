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
        # Phase 182 plan 06 — stage 2.6 (grounding fidelity) is NEUTRALISED throughout this
        # suite: these tests pin the pipeline ORDER and the QUAL-01 hard-blocker contract,
        # and every definition here is deliberately grounding-agnostic. The stage's own
        # behavior (block on a hallucinated tool / an inaccessible skill reference, the
        # fail-closed path, and the /validate-vs-publish agreement) is owned by
        # tests/unit/test_182_publish_grounding_stage.py. Without this patch the stage would
        # resolve a REAL service-role client, because ``pool`` is an AsyncMock.
        patch.object(publish_service, "_grounding_fidelity_failures", AsyncMock(return_value=[])),
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
        patch.object(publish_service, "_grounding_fidelity_failures", AsyncMock(return_value=[])),
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
        patch.object(publish_service, "_grounding_fidelity_failures", AsyncMock(return_value=[])),
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


# ── WR-04: the publish deadline (asyncio.wait_for → golden_run_timeout) ────────
@pytest.mark.asyncio
async def test_golden_run_timeout_blocks_not_raises():
    """WR-04 / T-102-09-03: a golden run that exceeds the publish budget maps to an
    honest ``golden_run_timeout`` block — never a hung request nor a 500. Drive a real
    timeout by patching the budget to ~0s and making ``_drive_golden_run`` sleep past it
    so ``asyncio.wait_for`` cancels it."""
    import asyncio

    row = _definition_row(business_requirement="Deliver a cited answer.")

    async def _hang(**_kwargs):
        await asyncio.sleep(5)  # well past the patched ~0s budget → TimeoutError
        return (uuid4(), {"text": "never reached"}, "completed")

    with (
        patch("app.db.workflows.get_definition", AsyncMock(return_value=row)),
        patch("app.db.workflows.write_audit", AsyncMock()),
        patch.object(publish_service, "_grounding_fidelity_failures", AsyncMock(return_value=[])),
        patch.object(publish_service, "_drive_golden_run", _hang),
        patch.object(publish_service, "_judge_golden_output", AsyncMock()) as judge,
        patch("app.db.workflows.publish_definition", AsyncMock()) as flip,
        # Shrink the publish budget so the 5s sleep blows it instantly:
        patch("app.config.settings.harness_publish_max_seconds", 0.05),
    ):
        result = await _call()  # must NOT raise

    assert result["published"] is False
    assert result["blocked_stage"] == "golden_run_timeout"
    assert result["named_failures"]  # the named budget-exceeded failure
    assert result["golden_run_id"] is None  # no usable run id (it was abandoned)
    judge.assert_not_called()  # the judge never ran (no output to judge)
    flip.assert_not_called()  # no flip on a timed-out golden run


def test_harness_publish_max_seconds_config_present():
    """WR-04: the publish-level wall budget knob exists on Settings (bounded, generous)."""
    from app.config import settings

    assert hasattr(settings, "harness_publish_max_seconds")
    assert isinstance(settings.harness_publish_max_seconds, int)
    assert settings.harness_publish_max_seconds > 0


# ── WR-02: owner-only publish read (a non-owner cannot load a global DRAFT) ────
@pytest.mark.asyncio
async def test_get_definition_publish_read_is_owner_only_for_drafts():
    """WR-02 / T-102-09-01: ``get_definition``'s publish read restricts drafts to true
    ownership — the bare ``OR is_system_global = true`` is GONE; a global row is readable only
    when PUBLISHED. The SQL predicate is the security boundary (a non-owner can no longer
    load a global DRAFT → no golden run / no flip on another user's draft)."""
    from unittest.mock import AsyncMock as _AsyncMock

    from app.db import workflows as wf_db

    captured: dict = {}

    async def _fake_fetchrow(query, *args):
        captured["query"] = query
        captured["args"] = args
        return None  # a non-owner of a global draft → no row → None (the EoP is closed)

    pool = _AsyncMock()
    pool.fetchrow = _fake_fetchrow
    other_user = uuid4()

    result = await wf_db.get_definition(pool, _DEF_ID, user_id=other_user)

    assert result is None  # a non-owner gets None for a global draft
    q = captured["query"]
    # The corrected, owner-only-for-drafts predicate:
    assert "(is_system_global = true AND status = 'published')" in q
    # The over-wide bare global predicate is GONE (no global-DRAFT exposure):
    assert "OR is_system_global = true)" not in q
    # $N placeholders only — the owner id is bound as $2 (no f-string SQL):
    assert "created_by = $2" in q
    assert captured["args"] == (_DEF_ID, other_user)


@pytest.mark.asyncio
async def test_non_owner_global_draft_publish_is_refused():
    """WR-02 end-to-end: when ``get_definition`` returns None for a non-owner's attempt
    to publish a global draft, the publish path refuses with ``not_found`` (404, no leak)
    and NEVER drives a golden run or flips (the EoP path is closed)."""
    with (
        patch("app.db.workflows.get_definition", AsyncMock(return_value=None)),
        patch("app.db.workflows.write_audit", AsyncMock()),
        patch.object(publish_service, "_drive_golden_run", AsyncMock()) as drive,
        patch("app.db.workflows.publish_definition", AsyncMock()) as flip,
    ):
        result = await _call(user={"id": str(uuid4())})  # a DIFFERENT, non-owner user

    assert result["published"] is False
    assert result["blocked_stage"] == "not_found"  # uniform 404, no existence leak
    drive.assert_not_called()  # no golden run on another user's draft
    flip.assert_not_called()  # no privileged state change


# ── WR-03: the concurrent-double-publish sentinel → honest already_published ────
@pytest.mark.asyncio
async def test_concurrent_double_publish_blocks_at_already_published():
    """WR-03 / T-102-09-02: ``publish_definition`` returns -1 when its ``status='draft'``
    WHERE guard matched 0 rows (a concurrent double-publish race loser). The caller must
    route the sentinel to an honest ``already_published`` block — NOT a false
    ``{published: True, version: -1}`` receipt nor a false ``publish_succeeded`` row."""
    row = _definition_row(business_requirement="Deliver a cited answer.")
    golden_run_id = uuid4()
    good_verdict = {"overall_passed": True, "overall_score": 95, "summary": "good", "criteria": []}
    audit_events: list = []

    async def _capture_audit(pool, run_id, *, user_id, event_type, metadata):
        audit_events.append(event_type)

    with (
        patch("app.db.workflows.get_definition", AsyncMock(return_value=row)),
        patch("app.db.workflows.write_audit", AsyncMock(side_effect=_capture_audit)),
        patch.object(publish_service, "_grounding_fidelity_failures", AsyncMock(return_value=[])),
        patch.object(
            publish_service, "_drive_golden_run",
            AsyncMock(return_value=(golden_run_id, {"text": "a grounded answer [doc1]"}, "completed")),
        ),
        patch.object(publish_service, "_judge_golden_output", AsyncMock(return_value=good_verdict)),
        # publish_definition finds 0 draft rows (already flipped by a concurrent publish) → -1:
        patch("app.db.workflows.publish_definition", AsyncMock(return_value=-1)),
    ):
        result = await _call()

    # The honest block — NOT a false success receipt:
    assert result["published"] is not True
    assert result.get("version") != -1  # never {published: True, version: -1}
    assert result["blocked_stage"] == "already_published"
    assert result["golden_run_id"] == golden_run_id
    # A FALSE publish_succeeded governance row was NEVER written:
    assert "publish_succeeded" not in audit_events


# ── IN-02: write_audit accepts a nullable run_id (the publish_blocked receipt) ──
def test_write_audit_signature_allows_nullable_run_id():
    """IN-02: ``write_audit``'s ``run_id`` parameter is annotated ``UUID | None`` — the
    NULL-run ``publish_blocked`` receipts (stage-0/1/2, before any golden run) rely on it;
    the column is nullable. Verify the annotation rather than a live DB write."""
    import inspect
    import typing
    from uuid import UUID as _UUID

    from app.db.workflows import write_audit

    sig = inspect.signature(write_audit)
    hints = typing.get_type_hints(write_audit)
    assert "run_id" in sig.parameters
    run_id_hint = hints["run_id"]
    # ``UUID | None`` resolves to ``typing.Optional[UUID]`` == ``Union[UUID, None]``:
    args = typing.get_args(run_id_hint)
    assert type(None) in args, f"run_id must be nullable, got {run_id_hint!r}"
    assert _UUID in args, f"run_id must still accept UUID, got {run_id_hint!r}"


# ── WR-04: interactive-phase pre-run block (llm_human_input / ask_user) ────────
def _interactive_definition_row(*, kind: str) -> dict:
    """A lint-clean definition row whose single phase is INTERACTIVE.

    ``kind == "llm_human_input"`` → an llm_human_input phase.
    ``kind == "ask_user_validator"`` → an llm_single phase with a validator whose
    ``on_failure == "ask_user"`` (the D-11 interactive disposition).
    """
    if kind == "llm_human_input":
        phase = {
            "slug": "approve",
            "phase_index": 0,
            "config": {"phase_type": "llm_human_input", "prompt": "Approve this?"},
            "validators": [],
        }
    else:
        phase = {
            "slug": "answer",
            "phase_index": 0,
            "config": {"phase_type": "llm_single", "prompt": "Answer the question."},
            "validators": [
                {"kind": "regex_match", "config": {"pattern": "x"}, "on_failure": "ask_user"}
            ],
        }
    definition = {
        "slug": "qual-test",
        "version": 1,
        "name": "Quality Test Workflow",
        "status": "draft",
        "phases": [phase],
        "business_requirement": "Deliver a cited answer.",
    }
    return {
        "id": _DEF_ID,
        "slug": "qual-test",
        "version": 1,
        "name": "Quality Test Workflow",
        "status": "draft",
        "definition": definition,
        "created_by": UUID(_USER["id"]),
    }


@pytest.mark.asyncio
@pytest.mark.parametrize("kind", ["llm_human_input", "ask_user_validator"])
async def test_interactive_phase_blocks_publish_before_golden_run(kind):
    """WR-04: a definition with an interactive phase (llm_human_input OR an ask_user
    validator disposition) is blocked at ``interactive_phase`` PRE-RUN — the golden run
    is NEVER driven (an unsubscribed ask_user prompt cannot wedge the publish)."""
    row = _interactive_definition_row(kind=kind)
    with (
        patch("app.db.workflows.get_definition", AsyncMock(return_value=row)),
        patch("app.db.workflows.write_audit", AsyncMock()),
        patch.object(publish_service, "_drive_golden_run", AsyncMock()) as drive,
        patch("app.db.workflows.publish_definition", AsyncMock()) as flip,
    ):
        result = await _call()

    assert result["published"] is False
    assert result["blocked_stage"] == "interactive_phase"
    assert result["named_failures"]  # the named phase + message
    assert result["golden_run_id"] is None
    drive.assert_not_awaited()  # the golden run was NEVER driven
    flip.assert_not_called()


@pytest.mark.asyncio
async def test_non_interactive_definition_proceeds_past_interactive_check():
    """WR-04 control: a non-interactive definition is NOT blocked at the interactive
    stage — it proceeds to the golden run (the check is a targeted guard, not a wall)."""
    row = _definition_row(business_requirement="Deliver a cited answer.")  # llm_single, no ask_user
    golden_run_id = uuid4()
    good_verdict = {"overall_passed": True, "overall_score": 90, "summary": "good", "criteria": []}
    with (
        patch("app.db.workflows.get_definition", AsyncMock(return_value=row)),
        patch("app.db.workflows.write_audit", AsyncMock()),
        patch.object(publish_service, "_grounding_fidelity_failures", AsyncMock(return_value=[])),
        patch.object(
            publish_service, "_drive_golden_run",
            AsyncMock(return_value=(golden_run_id, {"text": "a grounded answer [doc1]"}, "completed")),
        ) as drive,
        patch.object(publish_service, "_judge_golden_output", AsyncMock(return_value=good_verdict)),
        patch("app.db.workflows.publish_definition", AsyncMock(return_value=2)),
    ):
        result = await _call()

    assert result["published"] is True  # proceeded past the interactive check
    drive.assert_awaited_once()  # the golden run WAS driven (not blocked)


def test_interactive_phase_failures_helper_detects_both_forms():
    """WR-04 unit: ``_interactive_phase_failures`` flags both an ``llm_human_input``
    phase AND an ``ask_user`` validator disposition; a clean definition returns []."""
    from app.models.harness import WorkflowDefinition

    human = WorkflowDefinition.model_validate(
        _interactive_definition_row(kind="llm_human_input")["definition"]
    )
    asker = WorkflowDefinition.model_validate(
        _interactive_definition_row(kind="ask_user_validator")["definition"]
    )
    clean = WorkflowDefinition.model_validate(
        _definition_row(business_requirement="x")["definition"]
    )

    assert publish_service._interactive_phase_failures(human)  # llm_human_input flagged
    assert publish_service._interactive_phase_failures(asker)  # ask_user validator flagged
    assert publish_service._interactive_phase_failures(clean) == []  # nothing flagged


# ── route-level HTTP mapping (api/workflows.py — G-5: NOT threads.py) ──────────
@pytest.mark.asyncio
async def test_route_not_found_maps_to_404():
    """A ``not_found`` block from the service maps to HTTP 404 (no existence leak)."""
    from fastapi import HTTPException

    from app.api import workflows as wf_api

    with patch.object(
        wf_api.publish_service, "publish",
        AsyncMock(return_value={"published": False, "blocked_stage": "not_found",
                                "named_failures": ["workflow not found"], "golden_run_id": None}),
    ), patch("app.api.workflows.get_pg_pool", AsyncMock(return_value=AsyncMock())):
        with pytest.raises(HTTPException) as exc:
            await wf_api.publish_workflow(
                definition_id=_DEF_ID,
                body=wf_api.PublishRequest(golden_input="x"),
                current_user=_USER,
                redis=AsyncMock(),
            )
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_route_missing_business_requirement_maps_to_400():
    """A ``business_requirement`` block maps to HTTP 400 (the D-13 publish-time invariant)."""
    from fastapi import HTTPException

    from app.api import workflows as wf_api

    verdict = {"published": False, "blocked_stage": "business_requirement",
               "named_failures": ["must declare a business_requirement"], "golden_run_id": None}
    with patch.object(
        wf_api.publish_service, "publish", AsyncMock(return_value=verdict),
    ), patch("app.api.workflows.get_pg_pool", AsyncMock(return_value=AsyncMock())):
        with pytest.raises(HTTPException) as exc:
            await wf_api.publish_workflow(
                definition_id=_DEF_ID,
                body=wf_api.PublishRequest(golden_input="x"),
                current_user=_USER,
                redis=AsyncMock(),
            )
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_route_success_returns_verdict_200():
    """A success returns the PublishVerdict (200 path — published True + version)."""
    from app.api import workflows as wf_api

    golden_run_id = uuid4()
    verdict = {"published": True, "version": 3, "golden_run_id": golden_run_id}
    with patch.object(
        wf_api.publish_service, "publish", AsyncMock(return_value=verdict),
    ), patch("app.api.workflows.get_pg_pool", AsyncMock(return_value=AsyncMock())):
        result = await wf_api.publish_workflow(
            definition_id=_DEF_ID,
            body=wf_api.PublishRequest(golden_input="x"),
            current_user=_USER,
            redis=AsyncMock(),
        )
    assert result.published is True
    assert result.version == 3
    assert result.golden_run_id == golden_run_id


@pytest.mark.asyncio
async def test_route_judge_block_returns_200_structured_verdict():
    """A judge block returns 200 with the structured verdict (machine-renderable for 103)."""
    from app.api import workflows as wf_api

    golden_run_id = uuid4()
    verdict = {"published": False, "blocked_stage": "judge",
               "named_failures": [{"summary": "delegated back to the user"}],
               "golden_run_id": golden_run_id}
    with patch.object(
        wf_api.publish_service, "publish", AsyncMock(return_value=verdict),
    ), patch("app.api.workflows.get_pg_pool", AsyncMock(return_value=AsyncMock())):
        result = await wf_api.publish_workflow(
            definition_id=_DEF_ID,
            body=wf_api.PublishRequest(golden_input="x"),
            current_user=_USER,
            redis=AsyncMock(),
        )
    assert result.published is False
    assert result.blocked_stage == "judge"
    assert result.golden_run_id == golden_run_id
    assert result.named_failures
