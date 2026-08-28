"""BUG-260828-09 — A FAILED PUBLISH NAMES THE STEP, THE CAUSE, AND NOTHING MACHINE-SHAPED.

The operator published one workflow four times and read *"the golden run failed a structural
gate"* every time, beside a ten-row stage spine. Meanwhile the engine had already written this,
in plain language, into ``workflow_phases.output``::

    Phase 1 (survey-library) gate failed after 3 attempt(s): citations_required: nothing was
    retrieved (0 sources) — this step reads your documents and must show where its answer
    came from

⭐ **THE FIXTURES IN THIS FILE ARE NOT INVENTED.** Every phase row below is the shape measured
on the live database on 2026-08-28, for golden runs ``22ad0cf3`` / ``1f841ade`` / ``c22f4bb2``
/ ``ffa38fa6`` — a ``failed`` phase 0 carrying ``_failure_reason``, followed by ``pending``
rows whose ``output`` is ``{}``. That trailing ``{}`` is the entire defect: it is a dict, so
the shipped harvest accepted it as "the deliverable" and overwrote the only row that knew
anything. A fixture that stopped after the failed phase would pass against the broken tree,
which is precisely how this survived a phase with green gates.

⚠ **THE COUNTERFACTUAL IS DRIVEN, NOT DESCRIBED.** ``test_the_shipped_selection_rule_is_the_bug``
re-states the pre-change predicate LOCALLY and asserts it produces the empty deliverable, so the
claim *"this was broken and is now fixed"* is executable rather than a sentence in a docstring.
The verbatim old predicate is stated in exactly ONE place — here — for the reason
``phase_output_object``'s own docblock gives: a docblock that quotes the forbidden form makes an
acceptance grep count its own prose.

CONVENTION (inherited from ``test_214_publish_arg_gate.py``): imports inside the test bodies,
plain sync tests, and NOTHING here touches Postgres — every surface under test is pure over
rows a caller loaded.
"""

from __future__ import annotations

from types import SimpleNamespace


# ── the measured fixture ──────────────────────────────────────────────────────

#: The verbatim reason the live rows carry. Kept whole so the prefix strip is proven against
#: the real string rather than a tidied one — the em dash and the inner colon both matter.
LIVE_REASON = (
    "Phase 1 (survey-library) gate failed after 3 attempt(s): citations_required: nothing "
    "was retrieved (0 sources) — this step reads your documents and must show where its "
    "answer came from"
)

#: What the author must end up reading: the reason with its machine prefix gone and NOTHING
#: else changed. The validator's own name survives, because the inner colon is not a prefix.
LIVE_CAUSE = (
    "citations_required: nothing was retrieved (0 sources) — this step reads your documents "
    "and must show where its answer came from"
)


def _live_phases() -> list[dict]:
    """The four failed golden runs' phase rows, as ``load_run_phases`` returns them."""
    return [
        {
            "phase_index": 0,
            "slug": "survey-library",
            "status": "failed",
            "output": {"_failure_reason": LIVE_REASON},
        },
        {"phase_index": 1, "slug": "write-summary", "status": "pending", "output": {}},
        {"phase_index": 2, "slug": "act", "status": "pending", "output": {}},
    ]


def _live_definition():
    """The live definition's phases. TWO OF THE THREE CARRY NO NAME, which is the ordinary
    case rather than an edge case — ``survey-library`` and ``act`` are both ``name: null`` on
    the row the operator actually published."""
    return SimpleNamespace(
        phases=[
            SimpleNamespace(phase_index=0, slug="survey-library", name=None),
            SimpleNamespace(phase_index=1, slug="write-summary", name="Write the short library summary"),
            SimpleNamespace(phase_index=2, slug="act", name=None),
        ]
    )


# ── the deliverable harvest ───────────────────────────────────────────────────


def test_a_pending_phase_does_not_erase_the_failed_one():
    """THE HEADLINE. The failed phase's reason survives two trailing ``pending`` rows."""
    from app.services.harness.publish_service import _deliverable_output

    assert _deliverable_output(_live_phases()) == {"_failure_reason": LIVE_REASON}


def test_the_shipped_selection_rule_is_the_bug():
    """THE COUNTERFACTUAL — the pre-change predicate, re-stated locally and DRIVEN.

    If this ever passes with the same body as the assertion above, the fix has been reverted
    and every other test in this file has become vacuous.
    """
    import json

    broken: dict = {}
    for p in sorted(_live_phases(), key=lambda q: q.get("phase_index", 0)):
        out = p.get("output")
        if isinstance(out, str):
            try:
                out = json.loads(out)
            except (ValueError, TypeError):
                out = None
        if isinstance(out, dict):
            broken = out

    assert broken == {}, "the pre-change rule must lose the reason — otherwise there was no bug"


def test_the_last_real_output_still_wins_on_a_completed_run():
    """NON-REGRESSION. Every phase produced something, so the selection is unchanged — this
    is the shape of every run that reaches the judge, and the judge grades what it returns."""
    from app.services.harness.publish_service import _deliverable_output

    rows = [
        {"phase_index": 0, "slug": "a", "status": "completed", "output": {"text": "first"}},
        {"phase_index": 1, "slug": "b", "status": "completed", "output": {"text": "last"}},
    ]
    assert _deliverable_output(rows) == {"text": "last"}


def test_the_jsonb_string_scalar_shape_is_read():
    """D-200.1-01: 527 of 588 live ``output`` values are jsonb STRING SCALARS. The inline
    loop's own ``json.loads`` handled that; reading through ``phase_output_object`` must not
    lose it."""
    from app.services.harness.publish_service import _deliverable_output

    rows = [{"phase_index": 0, "slug": "a", "status": "completed", "output": '{"text": "x"}'}]
    assert _deliverable_output(rows) == {"text": "x"}


def test_the_harvest_is_total():
    """A nullish list, an absent output, an unparseable string and a list-valued output all
    resolve rather than raising — the column is model-influenced."""
    from app.services.harness.publish_service import _deliverable_output

    assert _deliverable_output([]) == {}
    assert _deliverable_output(None) == {}  # type: ignore[arg-type]
    assert _deliverable_output([{"phase_index": 0}]) == {}
    assert _deliverable_output([{"phase_index": 0, "output": "not json {"}]) == {}
    assert _deliverable_output([{"phase_index": 0, "output": "[1, 2]"}]) == {}


# ── the blocked step ──────────────────────────────────────────────────────────


def test_the_blocked_step_carries_the_cause_without_its_machine_prefix():
    from app.services.harness.publish_service import _blocked_step

    step = _blocked_step(_live_phases(), _live_definition())

    assert step is not None
    assert step["cause"] == LIVE_CAUSE
    assert step["reason"] == LIVE_REASON  # the raw sentence is DEMOTED, never discarded
    assert step["step_slug"] == "survey-library"
    assert step["step_index"] == 0


def test_the_cause_keeps_the_validators_own_colon():
    """``[^:]*`` rather than ``.*``. A greedy prefix match would strip ``citations_required:``
    — the one word that tells an author WHICH check refused — out of the cause."""
    from app.services.harness.publish_service import _blocked_step

    cause = _blocked_step(_live_phases(), _live_definition())["cause"]
    assert cause.startswith("citations_required:")


def test_an_unnamed_step_reports_no_name_rather_than_its_slug():
    """PROPERTY (1) OF THE REPORT, AS A FENCE. ``survey-library`` has ``name: null`` on the
    live row. The shipped sibling gate falls back ``name or slug`` and emitted
    ``"step_name": "act"`` — a slug in the field that promises an authored name. The honest
    answer is ``None``; the client resolves the face through ``nodeTitle``."""
    from app.services.harness.publish_service import _blocked_step

    step = _blocked_step(_live_phases(), _live_definition())
    assert step["step_name"] is None
    assert "survey-library" not in str(step["step_name"])


def test_an_authored_name_is_carried_through():
    from app.services.harness.publish_service import _blocked_step

    rows = [
        {"phase_index": 0, "slug": "survey-library", "status": "completed", "output": {"text": "ok"}},
        {
            "phase_index": 1,
            "slug": "write-summary",
            "status": "failed",
            "output": {"_failure_reason": "Phase 2 (write-summary) validation flagged: too short"},
        },
    ]
    step = _blocked_step(rows, _live_definition())
    assert step["step_name"] == "Write the short library summary"
    assert step["cause"] == "too short"


def test_the_ask_user_reason_shape_is_stripped_too():
    """``_resolve_failure_with_ask_user`` composes a DIFFERENT verb (``validation flagged``)
    and appends its own suffix. The prefix rule is keyed on the slug, so it covers both
    producers without knowing either verb."""
    from app.services.harness.publish_service import _blocked_step

    rows = [
        {
            "phase_index": 0,
            "slug": "survey-library",
            "status": "failed",
            "output": {
                "_failure_reason": (
                    "Phase 1 (survey-library) validation flagged: freshness:staleness|old "
                    "— aborted by user"
                )
            },
        }
    ]
    step = _blocked_step(rows, _live_definition())
    assert step["cause"] == "freshness:staleness|old — aborted by user"


def test_an_unrecognised_reason_shape_becomes_the_cause_verbatim():
    """A refusal that renders nothing is a workflow nobody can fix — so a reason this rule
    cannot parse is handed over WHOLE rather than dropped."""
    from app.services.harness.publish_service import _blocked_step

    rows = [
        {
            "phase_index": 0,
            "slug": "survey-library",
            "status": "failed",
            "output": {"_failure_reason": "something nobody has seen before"},
        }
    ]
    assert _blocked_step(rows, _live_definition())["cause"] == "something nobody has seen before"


def test_a_prefix_naming_a_different_step_is_not_stripped():
    """The rule is keyed on the slug of the phase that ACTUALLY failed, so it can never eat a
    prefix that names some other step."""
    from app.services.harness.publish_service import _blocked_step

    rows = [
        {
            "phase_index": 0,
            "slug": "survey-library",
            "status": "failed",
            "output": {"_failure_reason": "Phase 9 (some-other-step) gate failed after 1 attempt(s): x"},
        }
    ]
    step = _blocked_step(rows, _live_definition())
    assert step["cause"] == "Phase 9 (some-other-step) gate failed after 1 attempt(s): x"


def test_no_failed_phase_means_no_blocked_step():
    """A judge block, a lint block, or a crash before any phase ran. The surface must be
    byte-for-byte what shipped, which means this returns ``None`` and adds no field."""
    from app.services.harness.publish_service import _blocked_step

    rows = [{"phase_index": 0, "slug": "a", "status": "completed", "output": {"text": "ok"}}]
    assert _blocked_step(rows, _live_definition()) is None
    assert _blocked_step([], _live_definition()) is None
    assert _blocked_step(None, _live_definition()) is None  # type: ignore[arg-type]


def test_the_blocked_step_is_total_against_a_malformed_definition():
    from app.services.harness.publish_service import _blocked_step

    step = _blocked_step(_live_phases(), SimpleNamespace())
    assert step is not None and step["step_name"] is None
    step = _blocked_step(_live_phases(), None)
    assert step is not None and step["cause"] == LIVE_CAUSE


def test_a_failed_phase_with_no_reason_still_names_the_step():
    """``fail_phase`` always writes ``_failure_reason``, but a status-repair script or a
    cancelled row may not have. The step is still identified; the cause is honestly absent."""
    from app.services.harness.publish_service import _blocked_step

    rows = [{"phase_index": 0, "slug": "survey-library", "status": "failed", "output": {}}]
    step = _blocked_step(rows, _live_definition())
    assert step is not None
    assert step["step_slug"] == "survey-library"
    assert step["cause"] is None and step["reason"] is None


# ── the seam: does it actually reach the verdict? ─────────────────────────────
#
# ⚠ THE PHASE-204 LESSON, APPLIED. Every test above is pure over rows a caller loaded, and
# every one of them would stay green if nothing ever CALLED those functions — which is the
# exact shape of the defect they exist to close (`BUG-260828-02` shipped through 16 green
# plans because the fixtures reached a state no real path could). So these two drive the REAL
# `publish()` and mock NEITHER side of the join: not `_blocked_step`, not
# `_blocked_step_for_run`, not `_structural_failures`, not `_block`. Only the golden RUN and
# the DB read are faked, because those are I/O and not the seam under test.

import pytest  # noqa: E402
from unittest.mock import AsyncMock, patch  # noqa: E402
from uuid import UUID, uuid4  # noqa: E402

from app.services.harness import publish_service  # noqa: E402

_USER = {"id": str(uuid4())}
_DEF_ID = uuid4()


def _row() -> dict:
    """A lint-clean 3-phase definition mirroring the live one — two of its steps unnamed."""
    definition = {
        "slug": "kb-library-structure-summary",
        "version": 1,
        "name": "Knowledge Base Library Structure Summary",
        "status": "draft",
        "phases": [
            {
                "slug": "survey-library",
                "phase_index": 0,
                "config": {"phase_type": "llm_single", "prompt": "Survey the library."},
                "validators": [],
            },
            {
                "slug": "write-summary",
                "phase_index": 1,
                "name": "Write the short library summary",
                "config": {"phase_type": "llm_single", "prompt": "Summarise it."},
                "validators": [],
            },
        ],
        "business_requirement": "Summarise the shape of the knowledge base.",
    }
    return {
        "id": _DEF_ID,
        "slug": "kb-library-structure-summary",
        "version": 1,
        "name": "Knowledge Base Library Structure Summary",
        "status": "draft",
        "definition": definition,
        "created_by": UUID(_USER["id"]),
    }


async def _publish():
    return await publish_service.publish(
        definition_id=_DEF_ID,
        golden_input="a representative kickoff prompt",
        user=_USER,
        pool=AsyncMock(),
        redis=AsyncMock(),
    )


@pytest.mark.asyncio
async def test_a_failed_golden_run_reaches_the_author_naming_the_step():
    """THE PROPERTY THE BUG ASKS FOR, END TO END.

    ``_drive_golden_run`` returns the terminal status; everything after it is the shipped
    code path. The verdict must carry the cause, and the raw sentence must survive beside it.
    """
    golden_run_id = uuid4()
    with (
        patch("app.db.workflows.get_definition", AsyncMock(return_value=_row())),
        patch("app.db.workflows.write_audit", AsyncMock()) as audit,
        patch("app.db.workflows.load_run_phases", AsyncMock(return_value=_live_phases())),
        patch.object(publish_service, "_grounding_fidelity_failures", AsyncMock(return_value=[])),
        patch.object(
            publish_service,
            "_drive_golden_run",
            AsyncMock(return_value=(golden_run_id, {}, "failed")),
        ),
        patch("app.db.workflows.publish_definition", AsyncMock()) as flip,
    ):
        result = await _publish()

    assert result["published"] is False
    assert result["blocked_stage"] == "structural_gate"
    flip.assert_not_called()

    step = result["blocked_step"]
    assert step is not None, "the verdict must carry the failing step — this is the whole bug"
    assert step["cause"] == LIVE_CAUSE
    assert step["reason"] == LIVE_REASON
    assert step["step_slug"] == "survey-library"
    assert step["step_name"] is None  # unnamed on the live row; the client resolves the face

    # And the RECEIPT carries it too — a governance trail that records only the fallback
    # cannot explain a refusal after the fact.
    receipt = [c for c in audit.await_args_list if c.kwargs.get("event_type") == "publish_blocked"]
    assert receipt, "a block must always write its receipt"
    assert receipt[-1].kwargs["metadata"]["blocked_step"]["cause"] == LIVE_CAUSE


@pytest.mark.asyncio
async def test_a_judge_block_gains_no_step_card():
    """NON-REGRESSION AND A FENCE IN ONE. The judge stage cannot name a failing step — no
    phase failed — so ``blocked_step`` is ``None`` and that surface is byte-for-byte what
    shipped. A field that appeared on every block would be a card with nothing in it."""
    golden_run_id = uuid4()
    bad_verdict = {
        "overall_passed": False,
        "overall_score": 40,
        "summary": "Thin.",
        "criteria": [],
    }
    with (
        patch("app.db.workflows.get_definition", AsyncMock(return_value=_row())),
        patch("app.db.workflows.write_audit", AsyncMock()),
        patch.object(publish_service, "_grounding_fidelity_failures", AsyncMock(return_value=[])),
        patch.object(
            publish_service,
            "_drive_golden_run",
            AsyncMock(return_value=(golden_run_id, {"text": "an answer"}, "completed")),
        ),
        patch.object(publish_service, "_judge_golden_output", AsyncMock(return_value=bad_verdict)),
        patch("app.db.workflows.publish_definition", AsyncMock()),
    ):
        result = await _publish()

    assert result["blocked_stage"] == "judge"
    assert result["blocked_step"] is None


@pytest.mark.asyncio
async def test_the_explanation_read_can_fail_without_changing_the_decision():
    """A publish decision that has already been made must never become a 500 because the
    EXPLANATION could not be loaded. The block still stands; the card is simply absent."""
    golden_run_id = uuid4()
    with (
        patch("app.db.workflows.get_definition", AsyncMock(return_value=_row())),
        patch("app.db.workflows.write_audit", AsyncMock()),
        patch("app.db.workflows.load_run_phases", AsyncMock(side_effect=RuntimeError("db down"))),
        patch.object(publish_service, "_grounding_fidelity_failures", AsyncMock(return_value=[])),
        patch.object(
            publish_service,
            "_drive_golden_run",
            AsyncMock(return_value=(golden_run_id, {}, "failed")),
        ),
        patch("app.db.workflows.publish_definition", AsyncMock()) as flip,
    ):
        result = await _publish()

    assert result["published"] is False
    assert result["blocked_stage"] == "structural_gate"
    assert result["blocked_step"] is None
    flip.assert_not_called()
