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

import re
from types import SimpleNamespace
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
@pytest.mark.parametrize("kind", ["llm_human_input", "ask_user_validator"])
async def test_the_interactive_block_writes_a_publish_blocked_receipt(kind):
    """G-1 (``/gsd:validate-phase 193.2``) — the stage-2.5 block DOES leave a receipt.

    ⚠ THIS SETTLES A CONTRADICTION, and both sides are recorded rather than one quietly
    corrected. ``193.2-UAT.md`` row **U2** stated the expectation verbatim as *"**no**
    ``publish_blocked`` row is written"*, while ``_block``'s own docstring says it writes
    one and stage 2.5 (``publish_service.py:223``) returns ``await _block(...)``. **U2 was
    never driven** — no interactive step ever appeared across the 20 measured generations
    (``193.2-FREQUENCY.md`` figure 2, 0/20), so the surface never rendered and no manual
    observation settled it either. The property therefore had verification of NEITHER kind
    while the row above it read as covered.

    **Measured, and this test is what makes it re-derivable:** a publish POST that reaches
    stage 2.5 writes a ``publish_blocked`` receipt at ``blocked_stage="interactive_phase"``.
    U2's sentence is true ONLY of the path where the client greys ``publish-trigger`` off
    ``/validate``'s ``blockedReason`` and the POST is never sent — a DIFFERENT path, on a
    different tier. The two were conflated; they are separated here.

    The sibling case above already patches ``write_audit`` and asserts nothing on it, which
    is exactly how a receipt can go unobserved while looking watched.
    """
    row = _interactive_definition_row(kind=kind)
    with (
        patch("app.db.workflows.get_definition", AsyncMock(return_value=row)),
        patch("app.db.workflows.write_audit", AsyncMock()) as audit,
        patch.object(publish_service, "_drive_golden_run", AsyncMock()),
        patch("app.db.workflows.publish_definition", AsyncMock()),
    ):
        result = await _call()

    assert result["blocked_stage"] == "interactive_phase"  # non-vacuity: we hit stage 2.5

    # THE RECEIPT — asserted on the call the sibling case leaves unexamined.
    blocked = [c for c in audit.await_args_list if c.kwargs.get("event_type") == "publish_blocked"]
    assert len(blocked) == 1, (
        f"expected exactly one publish_blocked receipt, got {len(blocked)}: "
        f"{[c.kwargs.get('event_type') for c in audit.await_args_list]}"
    )

    metadata = blocked[0].kwargs["metadata"]
    assert metadata["blocked_stage"] == "interactive_phase"
    assert metadata["definition_id"] == str(_DEF_ID)  # attributable with a NULL run_id
    assert metadata["golden_run_id"] is None  # blocked PRE-RUN, so there is no run to name
    assert metadata["named_failures"], "the receipt carries the named phase + message"

    # The receipt is written against a NULL run_id — the stage-0/1/2 shape `_block`
    # documents (``harness_audit.run_id`` is nullable; Phase 107 receipt VIEW).
    assert blocked[0].args[1] is None


@pytest.mark.asyncio
async def test_a_clean_definition_writes_no_interactive_publish_blocked_receipt():
    """G-1's positive control — the receipt above is EARNED, not an artifact of the mock.

    Without it, a ``write_audit`` mock that recorded a ``publish_blocked`` call on every
    publish would satisfy the case above and nobody would know. A definition with no
    interactive phase must produce NO ``interactive_phase`` receipt.
    """
    row = _definition_row(business_requirement="Deliver a cited answer.")
    golden_run_id = uuid4()
    good_verdict = {"overall_passed": True, "overall_score": 90, "summary": "good", "criteria": []}
    with (
        patch("app.db.workflows.get_definition", AsyncMock(return_value=row)),
        patch("app.db.workflows.write_audit", AsyncMock()) as audit,
        patch.object(publish_service, "_grounding_fidelity_failures", AsyncMock(return_value=[])),
        patch.object(
            publish_service, "_drive_golden_run",
            AsyncMock(return_value=(golden_run_id, {"text": "a grounded answer [doc1]"}, "completed")),
        ),
        patch.object(publish_service, "_judge_golden_output", AsyncMock(return_value=good_verdict)),
        patch("app.db.workflows.publish_definition", AsyncMock(return_value=2)),
    ):
        result = await _call()

    assert result["published"] is True  # non-vacuity: this definition really did publish
    interactive = [
        c for c in audit.await_args_list
        if c.kwargs.get("event_type") == "publish_blocked"
        and c.kwargs.get("metadata", {}).get("blocked_stage") == "interactive_phase"
    ]
    assert interactive == []


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


# ══════════════════════════════════════════════════════════════════════════════════════
# PHASE 193.2 (BUG-260815-01 / D-12 / D-13 / D-14 / T-193.2-01) — THE REFUSAL'S WORDS
# ══════════════════════════════════════════════════════════════════════════════════════
#
# The pre-193.2 message read *"interactive phases (llm_human_input / ask_user dispositions)
# cannot be validated in a synchronous publish"* — two engine identifiers aimed at a person
# who chose neither and can see neither word anywhere on the canvas. This block makes the
# rewritten copy's honesty properties MECHANICAL rather than reviewed.
#
# ⚠ THE F-3 SCOPING INVERSION, stated because getting it backwards produces a fence that is
# RED on a clean tree: every assertion here scopes over the COMPOSED MESSAGE VALUE, never
# over ``inspect.getsource`` of the module. ``publish_service``'s own docblocks legitimately
# QUOTE both forbidden identifiers — they must, to record what was fixed and why the gate
# matches exactly two shapes — so a source-scoped F-3 would fail on the shipping tree.
#
# ⚠ THE SHIPPED WR-04 CASES ABOVE ARE NOT EDITED. In particular
# ``test_interactive_phase_blocks_publish_before_golden_run``'s ``drive.assert_not_awaited()``
# IS the proof that the gate stays and the golden run is never driven for these definitions.
#
# ⚠ THE OTHER HALF OF F-5 LIVES IN ``tests/unit/test_187_route_assigned_reach.py``, whose
# header states the two-halves discipline this block imitates rather than duplicates: that
# file owns the CLIENT-REACH half (an ``interactive_phase`` verdict is route-assigned and
# incomplete, so it reaches ``blockedReason``); this file owns the VALUE half (the string
# ``/validate`` emits and the string the publish refusal emits are the same bytes).

#: The D-14 register: nothing shipped may promise unscheduled work.
_UNSCHEDULED_RE = re.compile(r"plann?ed|coming|soon|deferred|future release", re.I)

#: The identifiers and the slug that may never reach copy (F-3).
_FORBIDDEN_IN_COPY = ("llm_human_input", "ask_user", "zz-plant-slug")


def _interactive_definition(*, kind: str, name=..., slug: str | None = None):
    """A ``WorkflowDefinition`` whose single phase is INTERACTIVE, with a settable ``name``.

    A SIBLING of ``_interactive_definition_row`` rather than a change to it: that fixture is
    consumed by the shipped WR-04 cases, and neither shipped fixture phase carries a ``name``
    at all — which is exactly why the empty-name degradation case can use it as it stands and
    every LABEL case must add one here.

    ``name=...`` (the sentinel) omits the key entirely, which is the pre-103 JSONB shape;
    ``name=None`` writes an explicit null.
    """
    from app.models.harness import WorkflowDefinition

    if kind == "llm_human_input":
        phase = {
            "slug": slug or "approve",
            "phase_index": 0,
            "config": {"phase_type": "llm_human_input", "prompt": "Approve this?"},
            "validators": [],
        }
    else:
        phase = {
            "slug": slug or "answer",
            "phase_index": 0,
            "config": {"phase_type": "llm_single", "prompt": "Answer the question."},
            "validators": [
                {"kind": "regex_match", "config": {"pattern": "x"}, "on_failure": "ask_user"}
            ],
        }
    if name is not ...:
        phase["name"] = name
    return WorkflowDefinition.model_validate(
        {
            "slug": "qual-test",
            "version": 1,
            "name": "Quality Test Workflow",
            "status": "draft",
            "phases": [phase],
            "business_requirement": "Deliver a cited answer.",
        }
    )


_BOTH_KINDS = ("llm_human_input", "ask_user_validator")


@pytest.mark.parametrize("kind", _BOTH_KINDS)
def test_f3_no_internal_identifier_and_no_slug_reaches_the_copy(kind):
    """F-3 — ``BUG-260815-01``: no engine identifier and no slug may reach the message.

    Scoped over the COMPOSED MESSAGE VALUE (see the block header for why a source-scoped
    form would be RED on a clean tree). The phase carries the distinctive slug
    ``zz-plant-slug`` so a slug leak is unmistakable rather than merely plausible.
    """
    definition = _interactive_definition(kind=kind, name=None, slug="zz-plant-slug")
    findings = publish_service._interactive_phase_failures(definition)

    # NON-VACUITY — an absence assertion over zero findings is the commonest way a fence
    # stops seeing. The slug must still be carried as MACHINE-READABLE metadata.
    assert findings, f"{kind}: no finding produced — the absence assertions below prove nothing"
    assert findings[0]["phase"] == "zz-plant-slug", (
        "the finding's `phase` key must still carry the slug — it is metadata the canvas "
        "keys off, and only the `message` is copy"
    )

    for finding in findings:
        message = finding["message"]
        for token in _FORBIDDEN_IN_COPY:
            assert token not in message, (
                f"{kind}: {token!r} reached user-visible copy — that is BUG-260815-01 "
                f"(and BUG-260809-02 before it). Message was: {message!r}"
            )

    # INLINE PLANT — a literal that DOES carry the slug must match the same predicate the
    # fence applies, so the loop above cannot be passing because it inspects nothing.
    planted = 'the step "zz-plant-slug" cannot be validated'
    assert any(token in planted for token in _FORBIDDEN_IN_COPY), (
        "control: the containment predicate stopped detecting a planted slug"
    )


@pytest.mark.parametrize("kind", _BOTH_KINDS)
@pytest.mark.parametrize("name", ["Approve the quarterly draft", None], ids=["named", "degraded"])
def test_f4_no_message_promises_anything_unscheduled(kind, name):
    """F-4 (D-14) — across BOTH arms and BOTH the named and degraded forms (4 shapes).

    ``SEED-164`` exists because *"the DEFERRED Phase-103 rework"* read like a plan for a
    year while being scheduled nowhere. No shipped string may do that again.
    """
    findings = publish_service._interactive_phase_failures(
        _interactive_definition(kind=kind, name=name)
    )
    assert findings, f"{kind}/{name!r}: no finding produced — nothing was actually checked"

    for finding in findings:
        assert not _UNSCHEDULED_RE.search(finding["message"]), (
            f"{kind}/{name!r}: the refusal promises unscheduled work: {finding['message']!r}"
        )

    # POSITIVE CONTROL — the regex still fires on a string that does promise something.
    assert _UNSCHEDULED_RE.search("this is planned for a future release"), (
        "control: _UNSCHEDULED_RE stopped matching — the assertions above are inert"
    )


@pytest.mark.parametrize("kind", _BOTH_KINDS)
def test_d13_the_refusal_names_the_step_by_its_visible_label(kind):
    """D-13 — the message names the offending step by the label a non-coder reads."""
    label = "Approve the quarterly draft"
    findings = publish_service._interactive_phase_failures(
        _interactive_definition(kind=kind, name=label)
    )
    assert findings
    assert label in findings[0]["message"], (
        f"{kind}: the step's visible name is absent from the refusal — the author cannot "
        f"tell WHICH step to act on. Message was: {findings[0]['message']!r}"
    )


@pytest.mark.parametrize("kind", _BOTH_KINDS)
@pytest.mark.parametrize(
    "name", [..., None, "", "   ", "\n\t "], ids=["absent", "null", "empty", "spaces", "control"]
)
def test_d13_an_empty_name_degrades_to_a_true_name_free_sentence(kind, name):
    """D-13 — the degradation is name-free and TRUE: never a slug, never a step number.

    ``PhaseNodeCard`` puts no ``phase_index`` on the node face, so *"Step 3"* would name
    something the author cannot read on the canvas — which is why a digit-based reference is
    asserted absent alongside the slug.
    """
    findings = publish_service._interactive_phase_failures(
        _interactive_definition(kind=kind, name=name, slug="zz-plant-slug")
    )
    assert findings, f"{kind}/{name!r}: no finding produced"
    message = findings[0]["message"]

    expected = (
        publish_service._INTERACTIVE_STEP_UNNAMED
        if kind == "llm_human_input"
        else publish_service._INTERACTIVE_FALLBACK_UNNAMED
    )
    assert message == expected, f"{kind}/{name!r}: not the degraded literal: {message!r}"
    assert "zz-plant-slug" not in message, "the degradation fell back to the slug"
    assert not any(ch.isdigit() for ch in message), (
        f"the degradation carries a digit — a step NUMBER names something invisible on the "
        f"canvas. Message was: {message!r}"
    )
    assert '""' not in message, "the degradation left an empty quoted label behind"


def test_d13_the_two_arms_share_no_message():
    """D-13 / the 193.1 D-26 shape — the two arms must not collapse onto one literal.

    Arm 1 is about the STEP (remove it); arm 2 is about a step's FAILURE ROUTE (change it).
    ONE string serving both meanings is precisely the defect 193.1 fixed in ``grounding.py``,
    and this is the only assertion that can catch a later "simplification" that undoes it.
    """
    label = "Approve the quarterly draft"
    human = publish_service._interactive_phase_failures(
        _interactive_definition(kind="llm_human_input", name=label)
    )[0]["message"]
    asker = publish_service._interactive_phase_failures(
        _interactive_definition(kind="ask_user_validator", name=label)
    )[0]["message"]

    def _differ(a: str, b: str) -> bool:
        """Distinct, and sharing no complete sentence — not merely unequal strings."""
        if a == b:
            return False
        sentences = lambda s: {p.strip() for p in s.split(". ") if p.strip()}  # noqa: E731
        return not (sentences(a) & sentences(b))

    assert _differ(human, asker), (
        "the two arms collapsed onto one message (or share a sentence). They describe "
        f"different things and one literal cannot honestly serve both.\n  arm1: {human!r}\n"
        f"  arm2: {asker!r}"
    )
    # POSITIVE CONTROL — the predicate detects the collapse it exists to catch.
    assert not _differ(human, human), "control: _differ stopped detecting a collapsed pair"
    assert not _differ(
        "Publishing cannot pause. Remove that step to publish.",
        "Something else entirely. Remove that step to publish.",
    ), "control: _differ stopped detecting a SHARED SENTENCE between two unequal messages"

    # The degraded pair must not collapse either.
    assert _differ(
        publish_service._INTERACTIVE_STEP_UNNAMED,
        publish_service._INTERACTIVE_FALLBACK_UNNAMED,
    ), "the degraded arms collapsed onto one message"


@pytest.mark.parametrize("kind", _BOTH_KINDS)
def test_t193201_a_huge_name_yields_a_bounded_message(kind):
    """T-193.2-01 — the clamp. ``PhaseSpec.name`` is an UNBOUNDED ``str | None``.

    Unclamped, a 10 KB step name becomes a 10 KB refusal inside a ``text-[12px]``
    ``shrink-0`` header span AND a 10 KB PERSISTED ``harness_audit.metadata`` row.
    """
    huge = "A" * 10_000
    findings = publish_service._interactive_phase_failures(
        _interactive_definition(kind=kind, name=huge)
    )
    assert findings
    message = findings[0]["message"]

    assert len(message) < 400, (
        f"{kind}: a 10,000-character step name produced a {len(message)}-character refusal "
        f"— the clamp is not applied"
    )
    assert huge not in message, "the RAW name landed in the message, not the sanitised label"
    assert "…" in message, "the clamped label carries no ellipsis, so the truncation is silent"
    assert publish_service._LABEL_MAX_CHARS <= 80, (
        "the clamp drifted above the 60-80 band this threat model specifies"
    )
    assert publish_service._LABEL_MAX_CHARS >= 60


#: ⚠ THE HOSTILE TABLE IS A FIXED LITERAL LIST AND IT IS **NOT** DERIVED FROM THE
#: IMPLEMENTATION'S PREDICATE — that independence is the entire point of it (code review
#: ``WR-02``, 2026-08-15).
#:
#: WHAT THIS REPLACES, RECORDED RATHER THAN ERASED. Until this date the single-line case below
#: asserted ``not any(ord(ch) < 32 or ord(ch) == 127 for ch in message)`` — the **identical
#: predicate** to the code under test (``publish_service.py``'s pre-``WR-02``
#: ``ch.isspace() or ord(ch) < 32 or ord(ch) == 127``). A test that restates the
#: implementation's own condition can never discover a class that condition misses, and this
#: one did not: driven against the pre-``WR-02`` scrubber, **22 of the 31 codepoints below
#: survived it, and every single survivor was Unicode category ``Cf``** (the table's other
#: nine are 7 × ``Cc`` + ``Zl`` + ``Zp``, which the old rule did catch) — while the case sat
#: green the whole time. The fix widened the guard to
#: general categories; re-deriving the *test* from those categories would rebuild the same
#: circularity one level up. So the codepoints are spelled out here, individually, and a
#: future NARROWING of the guard reds one named row rather than nothing.
#:
#: ⚠ WRITTEN AS ``\\uXXXX`` ESCAPES, NEVER AS RAW CHARACTERS, AND THAT IS A HARD RULE.
#: ``U+202E`` and its neighbours reverse the DISPLAYED order of a source file for any human or
#: agent reading it; a raw bidi override committed into a repository that becomes model context
#: is the very hazard this table exists to fence. The names are carried beside each codepoint
#: so a failure is legible without a Unicode chart.
_HOSTILE_CODEPOINTS = (
    ("\u0000", "NULL"),
    ("\u0009", "CHARACTER TABULATION"),
    ("\u000a", "LINE FEED"),
    ("\u000d", "CARRIAGE RETURN"),
    ("\u001b", "ESCAPE"),
    ("\u007f", "DELETE"),
    ("\u0085", "NEXT LINE"),
    ("\u00ad", "SOFT HYPHEN"),
    ("\u061c", "ARABIC LETTER MARK"),
    ("\u180e", "MONGOLIAN VOWEL SEPARATOR"),
    ("\u200b", "ZERO WIDTH SPACE"),
    ("\u200c", "ZERO WIDTH NON-JOINER"),
    ("\u200d", "ZERO WIDTH JOINER"),
    ("\u200e", "LEFT-TO-RIGHT MARK"),
    ("\u200f", "RIGHT-TO-LEFT MARK"),
    ("\u2028", "LINE SEPARATOR"),
    ("\u2029", "PARAGRAPH SEPARATOR"),
    ("\u202a", "LEFT-TO-RIGHT EMBEDDING"),
    ("\u202b", "RIGHT-TO-LEFT EMBEDDING"),
    ("\u202c", "POP DIRECTIONAL FORMATTING"),
    ("\u202d", "LEFT-TO-RIGHT OVERRIDE"),
    ("\u202e", "RIGHT-TO-LEFT OVERRIDE"),
    ("\u2060", "WORD JOINER"),
    ("\u2066", "LEFT-TO-RIGHT ISOLATE"),
    ("\u2067", "RIGHT-TO-LEFT ISOLATE"),
    ("\u2068", "FIRST STRONG ISOLATE"),
    ("\u2069", "POP DIRECTIONAL ISOLATE"),
    ("\ufeff", "ZERO WIDTH NO-BREAK SPACE (BOM)"),
    ("\ufff9", "INTERLINEAR ANNOTATION ANCHOR"),
    ("\ufffa", "INTERLINEAR ANNOTATION SEPARATOR"),
    ("\ufffb", "INTERLINEAR ANNOTATION TERMINATOR"),
)

#: The four the code reviewer drove against the shipped function by hand. Asserted to be a
#: SUBSET of the table above, so nobody can "fix" this finding down to the four examples that
#: happened to be tried — which is the blindness, not the bug.
_WR02_REVIEWER_CODEPOINTS = ("\u200b", "\u202e", "\u2066", "\u00ad")


def test_wr02_the_hostile_table_is_well_formed_and_covers_the_reported_four():
    """NON-VACUITY + SCOPE for the table above — a fence's own inputs must be checked.

    Three ways this table could quietly stop meaning anything, each pinned:
      1. it shrinks to the four codepoints a reviewer named (the blindness being fixed);
      2. a duplicate row makes the parametrized case count lie about its coverage;
      3. a row is written as a RAW character, defeating the escape rule in the docblock.
    """
    chars = [ch for ch, _ in _HOSTILE_CODEPOINTS]
    assert len(chars) >= 30, "the hostile table shrank"
    assert len(set(chars)) == len(chars), "the hostile table has a duplicate row"
    assert all(len(ch) == 1 for ch in chars), "a row is not a single codepoint"
    for ch in _WR02_REVIEWER_CODEPOINTS:
        assert ch in chars, f"U+{ord(ch):04X} — the review's own repro case is not in the table"
    # The table is NOT allowed to be re-derived from the implementation's category set, but it
    # SHOULD be a subset of what that set covers; a row outside it would be a silent xfail.
    import unicodedata

    for ch, name in _HOSTILE_CODEPOINTS:
        assert (
            unicodedata.category(ch) in publish_service._NON_PRINTING_CATEGORIES
            or ch.isspace()
        ), f"{name} (U+{ord(ch):04X}) is in the table but outside the guard's stated classes"


@pytest.mark.parametrize("kind", _BOTH_KINDS)
@pytest.mark.parametrize(
    "hostile,name",
    _HOSTILE_CODEPOINTS,
    ids=[f"U+{ord(ch):04X}" for ch, _ in _HOSTILE_CODEPOINTS],
)
def test_wr02_no_non_printing_codepoint_survives_into_the_refusal(hostile, name, kind):
    """``WR-02`` — each hostile codepoint asserted INDIVIDUALLY against the composed refusal.

    Individually, not as a set comprehension: a future narrowing of the guard must red a row
    that NAMES the codepoint it stopped catching. The concrete harm being fenced is display
    spoofing and hidden content — ``U+202E`` reverses the displayed order of everything after
    it, including *"Remove that step to publish."*, so a crafted step label can make a refusal
    read as something other than what it says; ``U+200B`` hides content inside a label the
    operator is being asked to act on, and makes an operator ``grep`` disagree with the screen.
    **It is NOT an XSS or injection surface** — the message reaches React as a text child and
    there is no ``dangerouslySetInnerHTML`` on the path (verified in the ``193.2`` review).
    """
    findings = publish_service._interactive_phase_failures(
        _interactive_definition(kind=kind, name=f"Approve{hostile}the draft")
    )
    assert findings
    message = findings[0]["message"]

    assert hostile not in message, (
        f"{kind}: {name} (U+{ord(hostile):04X}) survived into copy. The scrub is not covering "
        f"its Unicode class. Message was: {message!r}"
    )
    # …and the READABLE label still lands: scrubbing may not degrade the step name into
    # something the operator cannot match against the canvas (the D-13 constraint).
    assert "Approve" in message and "the draft" in message, (
        f"{kind}: scrubbing {name} destroyed the readable label: {message!r}"
    )


@pytest.mark.parametrize("kind", _BOTH_KINDS)
def test_wr02_a_name_made_only_of_invisibles_degrades_rather_than_quoting_nothing(kind):
    """``WR-02`` boundary — a label that scrubs to NOTHING must take the name-free arm.

    The failure this forbids is a refusal reading ``the step "" stops to wait for a person``:
    an empty quoted label is worse than the honest degraded sentence, because it looks like a
    step whose name the author simply cannot see.
    """
    invisible = "".join(ch for ch, _ in _HOSTILE_CODEPOINTS if not ch.isspace())
    findings = publish_service._interactive_phase_failures(
        _interactive_definition(kind=kind, name=invisible, slug="zz-plant-slug")
    )
    assert findings
    message = findings[0]["message"]

    expected = (
        publish_service._INTERACTIVE_STEP_UNNAMED
        if kind == "llm_human_input"
        else publish_service._INTERACTIVE_FALLBACK_UNNAMED
    )
    assert message == expected, f"{kind}: an all-invisible name did not degrade: {message!r}"
    assert '""' not in message, "an empty quoted label reached copy"
    assert "zz-plant-slug" not in message, "the degradation fell back to the slug"


@pytest.mark.parametrize("kind", _BOTH_KINDS)
def test_wr02_scrubbing_keeps_the_refusal_inside_its_measured_length_ceiling(kind):
    """``WR-02`` re-measurement — the clamp interacts with the scrub, so both are re-driven.

    ⚠ RE-MEASURED 2026-08-15 AFTER THE CATEGORY WIDENING, because the two are coupled: every
    scrubbed character becomes a space and runs are then collapsed, so a hostile-stuffed name
    SHORTENS rather than lengthens. Driven over the degraded arm, a realistic 27-character
    label, a 10,000-``A`` name, a 200-character wide-glyph name and a 10,000-character name
    stuffed with ``U+202E``/``U+200B``: the worst case is **196** characters on arm 1 and
    **195** on arm 2 — IDENTICAL to the pre-fix figures recorded in ``193.2-06-SUMMARY.md``,
    against the 250 ceiling that summary set. Nothing grew.
    """
    stuffed = ("A\u202e\u200b" * 4_000)[:10_000]
    for name in (None, "Approve the quarterly draft", "A" * 10_000, "—" * 200, stuffed):
        findings = publish_service._interactive_phase_failures(
            _interactive_definition(kind=kind, name=name)
        )
        assert findings
        message = findings[0]["message"]
        assert len(message) <= 250, (
            f"{kind}: a {len(message)}-character refusal breached the 250 ceiling "
            f"({'degraded' if name is None else repr(name[:20]) + '…'})"
        )
        assert len(message) <= 196, (
            f"{kind}: the refusal grew past the measured 196-character worst case to "
            f"{len(message)} — the clamp and the scrub have drifted apart"
        )


@pytest.mark.parametrize("kind", _BOTH_KINDS)
def test_t193201_a_newline_bearing_name_yields_a_single_line_message(kind):
    """T-193.2-01 — a newline in a model-authored name breaks the one-line shape on BOTH
    surfaces this one string feeds, so whitespace and non-printing characters are collapsed.

    ⚠ AMENDED 2026-08-15 (code review ``WR-02``). WHAT THIS CASE ASSERTED UNTIL THEN IS
    RECORDED HERE VERBATIM RATHER THAN DELETED, because the shape it had is the finding:

        assert not any(ord(ch) < 32 or ord(ch) == 127 for ch in message)

    That is the **identical predicate** to the code it was testing, so it could only ever
    confirm the implementation agreed with itself. The class-wide guarantee now lives in
    ``test_wr02_no_non_printing_codepoint_survives_into_the_refusal``, asserted against the
    INDEPENDENT ``_HOSTILE_CODEPOINTS`` table above; what stays here is the concrete
    one-line/one-space shape a newline-bearing name must produce.
    """
    findings = publish_service._interactive_phase_failures(
        _interactive_definition(kind=kind, name="Approve\nthe\r\nquarterly\tdraft\x07")
    )
    assert findings
    message = findings[0]["message"]

    assert "\n" not in message and "\r" not in message and "\t" not in message, (
        f"{kind}: the refusal is not a single line: {message!r}"
    )
    assert "\x07" not in message, (
        f"{kind}: a control character survived into copy: {message!r}"
    )
    # The SANITISED label lands, not the raw one.
    assert "Approve the quarterly draft" in message, (
        f"{kind}: the collapsed label is not what reached the message: {message!r}"
    )


async def _validate_via_the_real_route(definition, monkeypatch):
    """Drive ``POST /workflows/validate``'s OWN handler and return its ``ValidateResponse``.

    The handler is called DIRECTLY — the posture three shipped suites already use
    (``test_182_validate.py:117-126``, ``test_182_grounding_degradation.py:244``,
    ``test_182_publish_grounding_stage.py:374``) — rather than through TestClient, so no
    live DB, no auth round-trip and no event loop of our own.

    ``assemble_grounding_bundle`` is swapped for a clean empty bundle, following
    ``test_182_validate.py``'s ``_patch_bundle``. That is deliberate rather than incidental:
    left unpatched, ``supabase=object()`` makes the grounding read raise, the route's
    documented ``except Exception`` catches it and appends a ``grounding_unavailable``
    verdict — so the handler would run its DEGRADED path, and a fence should measure the
    path users actually get. The fixtures below bind no folder, name no tool and reference
    no skill, so with the bundle stubbed the grounding step is a genuine no-op and the only
    thing left to observe is step (4)'s projection.
    """
    from app.api import workflows as wf
    from app.services.harness import grounding as g

    async def _fake_assemble(**_kwargs):
        return g.GroundingBundle(
            tools=[], tool_names=set(), folders=[], skills=[], skill_ids=set(), placeholders=[]
        )

    monkeypatch.setattr(g, "assemble_grounding_bundle", _fake_assemble)

    return await wf.validate_workflow(
        body=definition,
        current_user={"id": "00000000-0000-0000-0000-000000000001"},
        supabase=object(),
    )


@pytest.mark.parametrize("kind", _BOTH_KINDS)
@pytest.mark.parametrize("name", ["Approve the quarterly draft", None], ids=["named", "degraded"])
async def test_f5_validate_and_the_publish_refusal_emit_the_same_bytes(kind, name, monkeypatch):
    """F-5 (D-12), the publish half — ONE message string feeds BOTH surfaces.

    ⚠ **REWRITTEN 2026-08-15 (code review ``WR-01``). WHAT THIS CASE ASSERTED UNTIL THEN IS
    RECORDED HERE VERBATIM RATHER THAN DELETED, because a fence whose history is erased
    cannot be audited — and because the shape it had is the single most valuable thing about
    it: it is what a tautology looks like when it is wearing a correct docstring.** In full:

        publish_failures = publish_service._interactive_phase_failures(definition)
        validate_findings = [
            {"code": "interactive_phase", "phase": f.get("phase"), "message": f.get("message")}
            for f in publish_service._interactive_phase_failures(definition)   # ← same call
        ]
        assert [f["message"] for f in publish_failures] == [
            f["message"] for f in validate_findings
        ]

    …under the claim *"Computed rather than hard-coded: a hard-coded expectation would pass
    while the two callers drifted apart, which is the whole property under test."* The claim
    was right about the danger and the code did not implement it. ``_interactive_phase_failures``
    is a pure function of ``definition``, so **both sides of that comparison were the same
    call and the assertion was ``x == x``.** It could not go red for any edit to any file.
    Worse, it **never imported ``app.api.workflows`` at all** — it hand-copied the route's
    projection into the test, so the one artefact under test was a replica of the thing that
    could drift. D-12's server-side property had ZERO coverage while reading ✅.

    **What it asserts NOW:** the REAL ``/validate`` handler is executed, and the ``message``
    on every ``interactive_phase`` verdict it returns is compared against what the PUBLISH
    path composes. Two different call paths, one expected value. An edit to the route's
    step-(4) projection — clamping the message for the canvas, prefixing a code, mapping it
    through a lookup table, swapping the composer — now fails here, which is the whole point:
    the client renders ``verdict.message`` verbatim, so a drift is directly user-visible.

    ⚠ **DRIVEN RED, not reasoned about.** Planting ``f.get("message")[:20]`` in the route's
    step-(4) projection (``app/api/workflows.py``) fails all four parametrized shapes; the
    plant was then reverted to an EMPTY ``git diff --numstat`` and all four went green. The
    pre-rewrite version of this case stayed GREEN under that same plant — measured, which is
    how a fence is shown to see something rather than assumed to.

    ⚠ **The ``phase`` key is asserted too, and separately from the message.** It carries the
    SLUG as machine-readable metadata (the canvas keys nodes off it) while only ``message``
    is copy — ``test_f3_no_internal_identifier_and_no_slug_reaches_the_copy`` depends on that
    split, so a route that leaked the slug into the message and dropped it from ``phase``
    must not read as a pass here.

    The other half of F-5 — that an ``interactive_phase`` verdict actually reaches
    ``blockedReason`` on the client — is owned by ``PublishGauntlet.test.tsx``'s ``?raw``
    one-home fence (``193.2-06`` task 3), NOT by ``test_187_route_assigned_reach.py``, which
    ``193.2-VALIDATION.md`` credited in error and which received zero changes this phase.
    """
    from app.api import workflows as wf

    definition = _interactive_definition(kind=kind, name=name)

    # The way the PUBLISH path calls it (publish_service.py stage 2.5).
    publish_failures = publish_service._interactive_phase_failures(definition)

    # The way ``/validate`` calls it — through the ROUTE, not through a copy of the route.
    response = await _validate_via_the_real_route(definition, monkeypatch)
    validate_verdicts = [v for v in response.verdicts if v.code == "interactive_phase"]

    # NON-VACUITY, on BOTH sides. An equality between two empty lists is the commonest way a
    # fence like this stops seeing — and it is exactly what a route that dropped step (4)
    # entirely would produce.
    assert publish_failures, f"{kind}/{name!r}: the publish path composed no refusal"
    assert validate_verdicts, (
        f"{kind}/{name!r}: /validate emitted no interactive_phase verdict — the route no "
        f"longer runs the WR-04 check, so the equality below would prove nothing"
    )
    assert len(publish_failures) == len(validate_verdicts), (
        f"{kind}/{name!r}: the two surfaces disagree on HOW MANY steps are at fault"
    )

    # PROOF THAT THE ROUTE WAS REALLY EXECUTED — not a helper that happens to share a name.
    assert wf.validate_workflow.__module__ == "app.api.workflows"

    assert [f["message"] for f in publish_failures] == [
        v.message for v in validate_verdicts
    ], "the publish refusal and the /validate verdict no longer carry the same bytes"

    # The slug stays METADATA on both surfaces (see the docstring's `phase` note).
    assert [f["phase"] for f in publish_failures] == [v.phase for v in validate_verdicts]


# ══════════════════════════════════════════════════════════════════════════════════════
# PHASE 189 — CONFLICT 1 (D-19): AN ARMED PHASE KILLS A GOLDEN-RUN PUBLISH
# ══════════════════════════════════════════════════════════════════════════════════════
#
# ``189-RESEARCH.md`` § "⚠ CONFLICTS WITH A LOCKED DECISION" measured that **D-06 ("a
# workflow containing the external-action node PUBLISHES and RUNS") is FALSE at HEAD**.
# The three cases below capture that RED, with the mechanism asserted rather than the
# symptom, BEFORE plan 189-05 changes a line of engine source.
#
# THE CHAIN, each link measured and each one asserted by one of the three cases:
#
#   1. ``_interactive_phase_failures`` blocks a publish PRE-RUN for exactly TWO shapes —
#      ``phase_type == "llm_human_input"`` and a validator whose ``on_failure ==
#      "ask_user"``. The armed action-risk checkpoint is NEITHER: D-187-01 hoisted it OUT
#      of ``phase.validators`` entirely and ``harness_engine`` reads
#      ``getattr(phase, "action_risk_armed", False)`` directly.   → CASE 3
#   2. ⇒ an armed phase sails past stage 2.5 and reaches stage 3, the REAL golden run
#      (``is_golden_run=True``).                                  → CASE 3
#   3. The golden run hits the checkpoint, which calls
#      ``_resolve_failure_with_ask_user(..., is_action_risk=True)``, where
#      ``timeout_seconds = None if is_action_risk`` — and
#      ``ask_user_service.subscribe_for_response``'s own docstring calls ``None``
#      "wait indefinitely".                                       → CASE 1 (RED)
#   4. Nobody is watching a synchronous publish's ask channel, so the request burns the
#      whole ``settings.harness_publish_max_seconds`` budget (7200 s) and returns
#      ``blocked_stage="golden_run_timeout"``.
#
# ⚠ NO TEST HERE EVER AWAITS THAT BUDGET. ``subscribe_for_response`` is replaced by a
# recorder that captures its ``timeout_seconds`` argument and RAISES a sentinel instead
# of waiting. The hang is proven by its MECHANISM (the resolved timeout value and the
# code path taken), never by wall-clock — a test that genuinely blocks for two hours is
# a broken test, and the whole file still runs in well under a second.
#
# ⚠ THE PHASE TYPE UNDER TEST IS A **SHIPPED** ONE. ``action_risk_armed`` lives on
# ``PhaseSpec``, shared by all six shipped types, so an armed ``llm_single`` reproduces
# the defect TODAY. That is deliberate and load-bearing: it proves the golden-run hang is
# a PRE-EXISTING defect rather than one Phase 189 introduces, and it decouples the proof
# from the 7th ``phase_type`` (which does not exist until plan 189-07).
#
# ⚠ THIS CLASS OF DEFECT — an armed checkpoint killing a run — IS ``BUG-260731-02``,
# which is why migration 114 exists. It must therefore be DRIVEN, never asserted from a
# reading of the source.
#
# ⚠ FILE PLACEMENT, AND WHY IT DEVIATES FROM 189-02-PLAN.md. The plan named
# ``backend/tests/test_publish_gate.py`` and instructed "use its existing publish-driving
# fixture and its judge mock". Measured 2026-08-07: that file is the **Phase 136 SKILL
# publish gate** (``compute_publish_gate`` over ``eval_runs``) — it has no publish-driving
# fixture, no judge mock, and does not import ``publish_service`` at all
# (``grep -rln "publish_service\|golden_run" tests/`` does not list it). The WORKFLOW
# publish gauntlet's fixture (``_definition_row`` / ``_call``), its judge mock
# (``_judge_golden_output``) and ``_interactive_phase_failures``' own unit test are all
# HERE, so this is where the falsification lives. See ``189-02-SUMMARY.md``.


class _AskChannelSubscribed(Exception):
    """Raised by the recorder INSTEAD of waiting on the ask channel.

    The production call this stands in for is ``await subscribe_for_response(..., None)``
    — an unbounded wait. Raising makes the wedge instantaneous AND unmistakable: the test
    can never hang, and "the ask channel was subscribed" becomes a recorded fact rather
    than a timing artefact.
    """


class _SubscribeRecorder:
    """Records every ``subscribe_for_response`` call's ``timeout_seconds``, then raises.

    The engine calls ``subscribe_for_response(redis, run_id, tool_call_id, timeout)``
    POSITIONALLY (``harness_engine._resolve_failure_with_ask_user``), so the signature is
    positional here too.
    """

    def __init__(self):
        self.timeouts: list = []

    async def __call__(self, redis, run_id, tool_call_id, timeout_seconds):
        self.timeouts.append(timeout_seconds)
        raise _AskChannelSubscribed(
            f"the ask channel was subscribed with timeout_seconds={timeout_seconds!r}"
        )


_ARMED_SLUG = "send-the-notice"
_ARMED_TOTAL_PHASES = 2


def _armed_phase_definition_dict() -> dict:
    """A lint-clean, single-phase definition whose ONE phase is armed.

    A SHIPPED ``llm_single`` type carrying ``action_risk_armed: true`` at the
    ``PhaseSpec`` level — the smallest shape that reproduces CONFLICT 1 today.
    """
    return {
        "slug": "armed-test",
        "version": 1,
        "name": "Armed Test Workflow",
        "status": "draft",
        "phases": [
            {
                "slug": _ARMED_SLUG,
                "phase_index": 0,
                "name": "Send the renewal notice",
                "config": {"phase_type": "llm_single", "prompt": "Draft the renewal notice."},
                "action_risk_armed": True,
                "validators": [],
            }
        ],
        "business_requirement": "Send the customer their renewal notice.",
    }


def _armed_definition_row() -> dict:
    """``_definition_row``'s shape, carrying the armed phase above."""
    return {
        "id": _DEF_ID,
        "slug": "armed-test",
        "version": 1,
        "name": "Armed Test Workflow",
        "status": "draft",
        "definition": _armed_phase_definition_dict(),
        "created_by": UUID(_USER["id"]),
    }


def _drive_armed_phase(*, is_golden_run: bool):
    """Drive the REAL ``_run_phase_with_gates`` over the armed phase and record.

    Returns ``SimpleNamespace(timeouts, body_invoked, wedged, audit_events, emits)``.

    ``audit_events`` / ``emits`` are the ``event_type`` keyword of every
    ``harness_engine.write_audit`` call and the positional event name of every
    ``harness_engine._emit`` call. They are RECORDED FROM THE DRIVE — a golden run
    writing no approval receipt is then a measured absence, not a reading of the
    source. Both the ``action_risk_pending`` announce (``harness_engine`` :776) and the
    ``validator_ask_user_approved`` receipt (:1362, inside
    ``_resolve_failure_with_ask_user``) go through this same patched symbol, so one
    recorder sees both.

    ``is_golden_run`` is written onto the run ctx. **That attribute is the D-19 work**:
    ``is_golden_run`` exists today as a ``workflow_runs`` COLUMN
    (``db/workflows.py`` / ``publish_service.py``) but appears ZERO times in
    ``harness_engine.py`` — it is not threaded into ctx, which is exactly why the two
    drives below are indistinguishable at HEAD. Setting it here is forward-compatible: an
    engine that ignores it behaves as it does today, and plan 189-05's engine reads it.

    Everything with a network or DB edge is mocked (``feedback_mock_completeness``):
    ``write_audit``, ``_emit``, ``ctx.emit``, ``_execute_phase`` and
    ``ask_user_service.subscribe_for_response``. ``ctx.supabase=None`` skips the durable
    prompt-row insert, so no DB is touched.
    """
    import asyncio

    from app.models.harness import PhaseSpec
    from app.services import harness_engine
    from app.services.harness.grounding import effective_phase

    recorder = _SubscribeRecorder()
    body = SimpleNamespace(invoked=False)
    audit_events: list = []
    emits: list = []

    async def _body_spy(phase, accumulated, ctx):
        body.invoked = True
        return {"text": "the deliverable"}

    async def _audit_spy(pool, run_id, *, user_id=None, event_type=None, metadata=None):
        audit_events.append(event_type)

    async def _emit_spy(redis, stream_run_id, event, **kw):
        emits.append(event)

    raw = PhaseSpec.model_validate(_armed_phase_definition_dict()["phases"][0])
    assert raw.action_risk_armed is True, (
        "harness guard: the phase under test is not armed — the drive would measure nothing"
    )
    # THE PHASE THE ENGINE ACTUALLY RUNS (``run_workflow``'s ONE synthesis seam). An
    # ``llm_single`` phase with no ``available_tools`` is not grounding-detected, so
    # ``effective_phase`` returns it by identity — but calling it keeps this drive on the
    # production seam rather than beside it.
    eff = effective_phase(raw, total_phases=_ARMED_TOTAL_PHASES)

    ctx = SimpleNamespace(
        supabase=None,
        thread_id=None,
        current_user={"id": uuid4()},
        producer_run_id=uuid4(),
        emit=AsyncMock(),
        retry_feedback=None,
        is_golden_run=is_golden_run,  # ← D-19's threading target
    )

    wedged = False
    with (
        patch.object(harness_engine, "_execute_phase", _body_spy),
        patch.object(harness_engine, "write_audit", _audit_spy),
        patch.object(harness_engine, "_emit", _emit_spy),
        patch("app.services.ask_user_service.subscribe_for_response", recorder),
    ):
        try:
            asyncio.run(
                harness_engine._run_phase_with_gates(
                    eff, {}, ctx,
                    run_id=uuid4(), pool=object(), redis=object(),
                    wall_clock=30, _audit_user_id=uuid4(),
                    total_phases=_ARMED_TOTAL_PHASES,
                )
            )
        except _AskChannelSubscribed:
            wedged = True

    return SimpleNamespace(
        timeouts=recorder.timeouts, body_invoked=body.invoked, wedged=wedged,
        audit_events=audit_events, emits=emits,
    )


def test_an_armed_phase_does_not_subscribe_to_the_ask_channel_on_a_golden_run():
    """D-19 / D-06 / ``BUG-260731-02`` — **THE CONFLICT-1 PROPERTY. RED AT HEAD.**

    A golden run is a SYNCHRONOUS publish request with no human watching. An armed phase
    that subscribes to the ask channel there waits on an answer that can never come, and
    the publish dies at ``harness_publish_max_seconds``. So the property is:

        is_golden_run(ctx)  ⇒  the armed checkpoint NEVER awaits subscribe_for_response

    D-19 resolves this by AUTO-RECORD-AND-CONTINUE: the *pause* is skipped on a golden
    run, the *record* is not. Two alternatives were REJECTED and neither may be used to
    turn this green — (B) naming armed phases in ``_interactive_phase_failures``, which
    makes such a workflow unpublishable and contradicts D-06 outright, and (C) publishing
    a synthetic approval onto the ask channel, which writes a
    ``validator_ask_user_approved`` receipt claiming a human approved when none did
    (the Control-Room ``consequence ≠ receipt`` rule).

    ANTI-VACUITY. A "zero subscribes" assertion is worthless if the drive never reached
    the checkpoint at all, so the positive control runs FIRST inside this same test: the
    identical phase on a NON-golden ctx must subscribe. Only then is the golden-run
    silence a measurement. (``test_a_live_non_golden_run_still_pauses_on_an_armed_phase``
    below states the same control as a standing, separately-named regression fence.)
    """
    # ── positive control: the harness genuinely reaches the ask channel ──────────
    live = _drive_armed_phase(is_golden_run=False)
    assert len(live.timeouts) == 1, (
        f"harness broken: the NON-golden drive subscribed {len(live.timeouts)} times, "
        f"expected exactly 1 — the golden-run assertion below would be vacuous"
    )

    # ── the property ────────────────────────────────────────────────────────────
    golden = _drive_armed_phase(is_golden_run=True)

    assert golden.timeouts == [], (
        "D-19 / CONFLICT 1: an armed phase SUBSCRIBED TO THE ASK CHANNEL on a golden run. "
        f"subscribe_for_response was awaited {len(golden.timeouts)} time(s) with "
        f"timeout_seconds={golden.timeouts!r} — and `None` is what "
        "ask_user_service.subscribe_for_response's own docstring calls 'wait "
        "indefinitely'. Nobody is watching a synchronous publish's ask channel, so this "
        "burns the full settings.harness_publish_max_seconds budget and the publish "
        "returns blocked_stage='golden_run_timeout'. D-06 ('a workflow containing the "
        "node PUBLISHES and RUNS') is FALSE while this is true. Owner: plan 189-05."
    )


def test_the_armed_golden_run_subscribe_carries_the_indefinite_wait():
    """D-19 — the MECHANISM half, recorded separately so the RED names a VALUE. RED AT HEAD.

    The sibling test above asserts the property (zero subscribes). This one pins WHY the
    subscribe is fatal rather than merely untidy: the recorded ``timeout_seconds`` is
    ``None``, which ``ask_user_service.subscribe_for_response`` documents as "wait
    indefinitely", and the enclosing publish budget is
    ``settings.harness_publish_max_seconds`` — measured 7200 s.

    Keeping the two apart matters for 189-05: a fix that made the golden run subscribe
    with a SHORT timeout would satisfy neither, but a reader of a single combined failure
    could not tell which half had moved.
    """
    from app.config import settings

    # The budget the indefinite wait burns — read from config, never re-typed.
    assert settings.harness_publish_max_seconds == 7200, (
        f"the publish budget moved to {settings.harness_publish_max_seconds}s; the "
        "CONFLICT-1 record in 189-02-SUMMARY.md quotes 7200"
    )

    golden = _drive_armed_phase(is_golden_run=True)

    assert None not in golden.timeouts, (
        "D-19 / CONFLICT 1 mechanism: the golden run's armed checkpoint awaited "
        f"subscribe_for_response with timeout_seconds={golden.timeouts!r}. `None` is "
        "harness_engine's `timeout_seconds = None if is_action_risk` — the indefinite "
        f"wait — inside a request bounded at {settings.harness_publish_max_seconds}s. "
        "That is the 2-hour publish death, stated as the value that causes it."
    )


def test_a_live_non_golden_run_still_pauses_on_an_armed_phase():
    """D-19's NEGATIVE CONTROL — **passes today and must STILL pass after 189-05.**

    A LIVE (non-golden) run must keep pausing on an armed phase, with the indefinite
    ``timeout_seconds=None`` wait intact: "with the checkpoint set, no answer must mean
    the run NEVER proceeds", and ``None`` (never ``0``) is what the shipped
    ``PendingAskCard`` renders as "no deadline".

    THIS IS THE FENCE AROUND THE D-19 FIX. Without it, 189-05 could turn its sibling
    green by simply disarming the checkpoint everywhere — which is precisely the
    wire-around SC#2 forbids and D-04 exists to prevent. The body must NOT have run: an
    armed step whose person has not answered is a step that has not happened.
    """
    live = _drive_armed_phase(is_golden_run=False)

    assert live.timeouts == [None], (
        f"a LIVE armed run must pause indefinitely on the ask channel; observed "
        f"timeouts={live.timeouts!r}. A fix that silences the golden run by disarming "
        f"the checkpoint outright is the wire-around D-04 and SC#2 forbid."
    )
    assert live.wedged is True, "the drive did not reach the ask channel at all"
    assert live.body_invoked is False, (
        "the armed step's BODY RAN while nobody had answered — asking after the "
        "irreversible step is not a checkpoint"
    )


def test_a_golden_run_writes_no_approval_and_no_pending_receipt():
    """D-19's **REJECTED OPTION C**, fenced — ``consequence ≠ receipt``.

    D-19 rejected publishing a synthetic approval onto the ask channel, because it writes
    a ``validator_ask_user_approved`` row claiming a human approved **when none did** —
    the Control-Room rule that a receipt describes what actually happened to a person.
    The same argument retires ``action_risk_pending``: that row records the CONSEQUENCE
    "the run paused for someone", and on a golden run nothing paused.

    So the golden run's armed checkpoint must write **neither**, at the ledger and at the
    wire. This is DRIVEN — the audit and emit calls are recorded from the real
    ``_run_phase_with_gates`` drive, never read off the source.

    ANTI-VACUITY, and it is the whole reason this test is not one line: an "absent
    receipt" assertion is trivially satisfied by a drive that never reached the
    checkpoint, or by a recorder wired to the wrong symbol. The LIVE control runs first
    and must show BOTH names present — only then is the golden run's silence a
    measurement.
    """
    _FORBIDDEN = ("validator_ask_user_approved", "action_risk_pending")

    # ── positive control: on a live run BOTH names are genuinely produced ────────
    live = _drive_armed_phase(is_golden_run=False)
    assert "action_risk_pending" in live.audit_events, (
        f"harness broken: a LIVE armed run wrote no action_risk_pending audit row "
        f"(events={live.audit_events!r}) — the golden-run absence below would be vacuous"
    )
    assert "action_risk_pending" in live.emits, (
        f"harness broken: a LIVE armed run emitted no action_risk_pending event "
        f"(emits={live.emits!r}) — the wire half of the assertion below would be vacuous"
    )

    # ── the property ────────────────────────────────────────────────────────────
    golden = _drive_armed_phase(is_golden_run=True)

    written = [e for e in golden.audit_events if e in _FORBIDDEN]
    assert written == [], (
        f"D-19 / REJECTED OPTION C: the golden run wrote {written!r} into harness_audit. "
        "Nobody was asked and nobody approved, so neither row is true: "
        "'validator_ask_user_approved' claims a human approved, and 'action_risk_pending' "
        "claims the run paused for a person. The Control-Room rule is that consequence is "
        "not receipt. The golden-run branch must skip the pause SILENTLY at the ledger."
    )
    emitted = [e for e in golden.emits if e in _FORBIDDEN]
    assert emitted == [], (
        f"D-19 / REJECTED OPTION C (the WIRE half): the golden run emitted {emitted!r}. "
        "Phase 188's run surface is the consumer; telling it a step is awaiting a person "
        "when the publish request is the only thing on the other end is the same lie one "
        "layer out."
    )


def test_the_armed_step_still_runs_on_a_golden_run():
    """D-19 / T-189-15 — **"skip the pause" must never become "skip the step".**

    D-05 says the approved step RECORDS THE INTENDED ACTION and the run CONTINUES; the
    golden-run branch skips only the PAUSE. If it also skipped the body, the arming would
    be decorative and the publish would grade a workflow whose governed step never ran —
    the fail-open shape Phase 188 spent two plans closing
    (``finalizeAllPhasesForThread`` sweeping ``pending`` → ``done``).

    The executor spy is the observable: ``_execute_phase`` MUST have been reached, and the
    drive must NOT have wedged on the ask channel. Its counterpart is
    ``test_a_live_non_golden_run_still_pauses_on_an_armed_phase``, which asserts the exact
    OPPOSITE pair for a live run — so a fix that got the branch backwards fails one or the
    other, never neither.
    """
    golden = _drive_armed_phase(is_golden_run=True)

    assert golden.body_invoked is True, (
        "D-19: the armed phase's EXECUTOR WAS NEVER REACHED on a golden run. Skipping the "
        "pause is not skipping the step — a silently-skipped governed step makes the "
        "arming decorative and lets the judge grade a deliverable that was never produced "
        "(D-05: the step records its intended action and the run continues)."
    )
    assert golden.wedged is False, (
        "the golden run wedged on the ask channel — see the sibling property test"
    )


def test_the_armed_checkpoint_is_not_a_validator():
    """D-19 — **WHY stage 2.5 misses an armed phase.** Passes today; must keep passing.

    ``_interactive_phase_failures`` blocks a publish PRE-RUN for exactly two shapes: an
    ``llm_human_input`` phase, and a validator whose ``on_failure == "ask_user"``. After
    D-187-01 hoisted the armed action-risk checkpoint OUT of ``phase.validators``, an
    armed phase is NEITHER — so it passes stage 2.5 untouched and reaches the stage-3
    golden run. That is the measured reason CONFLICT 1 is reachable at all.

    ⚠ **THIS ASSERTION IS NOT AN OVERSIGHT — IT IS A DELIBERATE FENCE.** Extending
    ``_interactive_phase_failures`` to name armed phases is CONFLICT-1 **Option B**,
    which makes an ``external_action`` workflow UNPUBLISHABLE and therefore contradicts
    D-06 outright. It was REJECTED. A future reader who "fixes" the golden-run hang by
    adding a case here will fail this test, which is the intent.

    Both halves are asserted, so neither can pass vacuously: the armed definition is
    clean, AND the two shapes the helper genuinely owns still flag.
    """
    from app.models.harness import WorkflowDefinition

    armed = WorkflowDefinition.model_validate(_armed_phase_definition_dict())
    assert armed.phases[0].action_risk_armed is True  # the fixture really is armed

    assert publish_service._interactive_phase_failures(armed) == [], (
        "stage 2.5 now blocks an ARMED phase pre-run. That is CONFLICT-1 Option B, "
        "REJECTED by D-19: it makes an external_action workflow unpublishable and "
        "contradicts D-06. The fix belongs in the engine (189-05), not here."
    )

    # POSITIVE CONTROL — the helper still flags the two shapes it DOES own, so the
    # emptiness above is a measurement rather than a broken helper.
    for kind in ("llm_human_input", "ask_user_validator"):
        other = WorkflowDefinition.model_validate(
            _interactive_definition_row(kind=kind)["definition"]
        )
        assert publish_service._interactive_phase_failures(other), (
            f"control: _interactive_phase_failures stopped flagging {kind!r} — the "
            f"assertion above proves nothing while this helper is inert"
        )


@pytest.mark.asyncio
async def test_an_armed_definition_reaches_the_stage_3_golden_run():
    """D-19 — the COMPOSITION: stage 2.5 lets an armed phase through to the golden run.

    The sibling above proves ``_interactive_phase_failures`` returns nothing for an armed
    definition. This proves the CONSEQUENCE end-to-end through the real ``publish``
    pipeline: the armed workflow is not blocked at ``interactive_phase`` and
    ``_drive_golden_run`` IS awaited — which is the door the indefinite ask-channel
    subscribe walks through.

    The golden run and judge are mocked exactly as every sibling in this file mocks them
    (that is the point — the pipeline ORDER is what is under test here; the checkpoint's
    own behaviour is driven for real in ``_drive_armed_phase``). Passing today AND after
    189-05 is required: D-06 says an armed workflow publishes.
    """
    row = _armed_definition_row()
    golden_run_id = uuid4()
    good_verdict = {"overall_passed": True, "overall_score": 91, "summary": "ok", "criteria": []}
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

    assert result.get("blocked_stage") != "interactive_phase", (
        "an armed phase was blocked at stage 2.5 — see "
        "test_the_armed_checkpoint_is_not_a_validator for why that is Option B"
    )
    drive.assert_awaited_once()  # stage 3 WAS reached — the golden run is driven
    assert result["published"] is True


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


# ══════════════════════════════════════════════════════════════════════════════
# V20 — THE PHASE'S HEADLINE GATE (189 / D-06): AN external_action WORKFLOW PUBLISHES
#
# ⚠ FILE PLACEMENT, AGAIN. `189-11-PLAN.md` names `backend/tests/test_publish_gate.py`
# for this test, as `189-02-PLAN.md` and `189-05-PLAN.md` did before it. Re-measured
# 2026-08-07 (third time): that file is the Phase-136 SKILL publish gate
# (`compute_publish_gate` over `eval_runs`) — it does not import `publish_service`,
# has no judge mock and no publish-driving fixture. `189-VALIDATION.md`'s V20 row was
# corrected in Wave 0 and points HERE.
#
# WHY THIS DRIVES THE REAL GAUNTLET RATHER THAN MOCKING TO GREEN. V20 failed RED at
# HEAD for TWO INDEPENDENT REASONS, and a test that patched either of them out would
# be green for the wrong reason:
#
#   RED 1 — stage 2.6 (CONFLICT 2, fixed by 189-04). The capability in
#     `available_tools` was refused as an unregistered tool. So `_grounding_fidelity_failures`
#     is NOT patched here: the REAL stage runs, the REAL `assemble_grounding_bundle`
#     computes the REAL `tool_names` union, and only the leaf REGISTRY READS (folders /
#     skills / org) are faked — the same "fake the read, never the rule" posture
#     `test_182_publish_grounding_stage.py` documents, pushed one level deeper so the
#     union itself is real.
#
#   RED 2 — stage 3 (CONFLICT 1, fixed by 189-05). The armed checkpoint subscribed to
#     the ask channel with an indefinite wait and the publish died at
#     `harness_publish_max_seconds`. So `_drive_golden_run` is NOT patched either: the
#     REAL engine drives the REAL phase through the REAL armed checkpoint on a golden
#     ctx. Only its DB edges are faked. `subscribe_for_response` is the raising recorder
#     from the CONFLICT-1 block above, so this test can NEVER hang — reaching the ask
#     channel raises instantly and fails the publish loudly.
#
# What IS mocked is what the shipped suite mocks: the judge (`_judge_golden_output`),
# the DB writes, and the service-role client.
# ══════════════════════════════════════════════════════════════════════════════

_V20_SLUG = "notify-the-customer"


def _external_action_definition_dict() -> dict:
    """A lint-clean, single-phase workflow whose ONE phase is the governed external action.

    Single-phase on purpose: every phase in a publish golden run really executes, and a
    second `llm_single` step would make a real provider call. The external action's own
    executor calls nothing — that is the point of the type in this milestone.

    `available_tools` is deliberately NOT written here: D-03 DERIVES it from `capability`
    by total replacement, so the value stage 2.6 tests membership on is the one the
    production validator produced.
    """
    return {
        "slug": "v20-external-action",
        "version": 1,
        "name": "V20 External Action Workflow",
        "status": "draft",
        "phases": [
            {
                "slug": _V20_SLUG,
                "phase_index": 0,
                "name": "Notify the customer",
                "config": {"phase_type": "external_action", "capability": "send_email"},
                "validators": [],
            }
        ],
        "business_requirement": "Tell the customer their renewal is due.",
    }


class _V20Redis:
    """Records the engine's XADDs; satisfies `_emit`."""

    def __init__(self):
        self.xadds: list = []

    async def xadd(self, stream, fields, *args, **kwargs):
        self.xadds.append((stream, fields))
        return "0-0"


class _V20Supabase:
    """The ephemeral-validation-thread INSERT, and nothing else.

    `_drive_golden_run` performs exactly one supabase call before the engine takes over:
    `supabase.table("threads").insert({...}).execute()`. Anything else this stand-in is
    asked for raises, so a future edit that adds a silent second read is loud rather than
    mysterious.
    """

    def __init__(self):
        self.thread_id = str(uuid4())
        self.inserts: list = []

    def table(self, name):
        assert name == "threads", f"the golden-run drive touched an unexpected table: {name!r}"
        return self

    def insert(self, payload):
        self.inserts.append(payload)
        return self

    def execute(self):
        return SimpleNamespace(data=[{"id": self.thread_id}])


def _drive_v20_publish(pool):
    """Run the REAL publish gauntlet over the external-action definition.

    Returns `SimpleNamespace(result, subscribe_timeouts, supabase, redis)`.

    Everything patched here is a DB edge, a registry READ or the judge. Every RULE —
    lint, the interactive-phase check, stage 2.6's fidelity rules, the engine's armed
    checkpoint, the phase executor and the status-write seam — is the shipped code.
    """
    import asyncio

    from app.services.harness import grounding as g
    from app.services.harness import publish_service

    supabase = _V20Supabase()
    redis = _V20Redis()
    recorder = _SubscribeRecorder()
    run_id = uuid4()
    phase_id = uuid4()
    # The run's phase spine, as `load_run_phases` reads it back. WITHOUT this the engine
    # loops over ZERO phases and the publish still returns `published: True` — which is
    # precisely why this test asserts the recorded_not_sent WRITE and not only the
    # verdict. (Observed: the first run of this test passed every publish assertion with
    # an empty spine.)
    pool.set_fetch_result(
        [{"id": phase_id, "slug": _V20_SLUG, "phase_index": 0,
          "status": "pending", "output": {}}]
    )

    judge = AsyncMock(
        return_value={
            "overall_passed": True,
            "overall_score": 94,
            "summary": "Records the intended notification; nothing was sent.",
            "criteria": [],
        }
    )

    with (
        patch("app.db.workflows.get_definition", AsyncMock(return_value=_v20_row())),
        patch("app.db.workflows.write_audit", AsyncMock()),
        patch("app.db.workflows.publish_definition", AsyncMock(return_value=2)),
        # the golden run's DB edges (the ONLY thing faked inside _drive_golden_run)
        patch("app.db.workflows.create_workflow_run", AsyncMock(return_value=run_id)),
        patch("app.db.runs.insert_run", AsyncMock()),
        patch("app.db.runs.finalize_run", AsyncMock()),
        patch("app.models.user_settings.load_user_settings", lambda _uid: None),
        # no real service-role client is ever constructed (the 182 posture)
        patch.object(
            publish_service,
            "_resolve_publish_supabase",
            AsyncMock(return_value=(supabase, str(uuid4()))),
        ),
        # the REGISTRY READS behind assemble_grounding_bundle — never the rules, and
        # never the tool-name union, which is 189-04's fix and must be exercised.
        patch("app.utils.folder_utils.fetch_visible_folders", AsyncMock(return_value=[])),
        patch("app.utils.folder_utils._resolve_caller_org_ids", AsyncMock(return_value=set())),
        patch.object(g, "_skill_registry", lambda *a, **k: []),
        # the judge, exactly as the shipped tests mock it
        patch.object(publish_service, "_judge_golden_output", judge),
        # the ask channel RAISES instead of waiting — this test cannot hang
        patch("app.services.ask_user_service.subscribe_for_response", recorder),
    ):
        result = asyncio.run(
            publish_service.publish(
                definition_id=_DEF_ID,
                golden_input="the Acme renewal is due on 12 September",
                user=_USER,
                pool=pool,
                redis=redis,
            )
        )

    return SimpleNamespace(
        result=result, subscribe_timeouts=recorder.timeouts, supabase=supabase, redis=redis,
        phase_id=phase_id, run_id=run_id,
    )


def _v20_row() -> dict:
    """`_definition_row`'s shape, carrying the external-action definition."""
    definition = _external_action_definition_dict()
    return {
        "id": _DEF_ID,
        "slug": definition["slug"],
        "version": definition["version"],
        "name": definition["name"],
        "status": "draft",
        "definition": definition,
        "created_by": UUID(_USER["id"]),
    }


def test_v20_an_external_action_workflow_publishes(mock_asyncpg_pool):
    """**V20 — THE PHASE'S HEADLINE GATE. RED AT HEAD FOR TWO INDEPENDENT REASONS.**

    D-06: "a workflow containing the node PUBLISHES and RUNS". 189 is a shippable slice,
    not a drawer of unpublishable drafts, and 190 needs a live workflow to upgrade in
    place.

    The two REDs, quoted from `189-02-SUMMARY.md`, are in this plan's SUMMARY beside the
    green. Both are re-exercised here rather than patched away — see the block comment
    above this test for exactly which seams are real and which are faked.

    The last assertion is the one that stops this being a publish test that skipped the
    thing it was about: the golden run's external-action phase must have REACHED
    `recorded_not_sent`. A publish that green-lit a workflow whose governed step never
    ran would satisfy `published is True` completely — that is 189-05's PLANT E and
    189-09's PLANT H, one layer out.
    """
    run = _drive_v20_publish(mock_asyncpg_pool)

    assert run.result["published"] is True, (
        f"D-06 / V20: an external_action workflow did NOT publish. "
        f"blocked_stage={run.result.get('blocked_stage')!r} "
        f"named_failures={run.result.get('named_failures')!r}"
    )
    assert run.result.get("blocked_stage") is None, (
        f"V20: the publish carried a blocked_stage: {run.result.get('blocked_stage')!r}"
    )
    assert run.result["version"] == 2

    # ── CONFLICT 1 is really gone: nobody was asked, on a run nobody was watching ──
    assert run.subscribe_timeouts == [], (
        f"the golden run subscribed to the ask channel ({run.subscribe_timeouts!r}) — "
        f"that is the 7200 s publish death 189-05 closed"
    )

    # ── the publish exercised the REAL path: the governed step ran and recorded ───
    recorded = [
        (sql, args) for sql, args in mock_asyncpg_pool.calls
        if "SET status='recorded_not_sent'" in sql
    ]
    assert len(recorded) == 1, (
        f"the golden run's external-action phase never reached recorded_not_sent. "
        f"workflow_phases writes: "
        f"{[s for s, _ in mock_asyncpg_pool.calls if 'UPDATE workflow_phases' in s]!r}"
    )
    import json as _json

    persisted = _json.loads(recorded[0][1][1])
    assert persisted["recorded_intent"]["capability"] == "send_email"
    assert "NOT SENT" in persisted["text"], (
        f"the recorded body must read as NOT SENT, never as a receipt: {persisted['text']!r}"
    )
