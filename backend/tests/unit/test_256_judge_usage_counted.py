"""Phase 256 round 1 / CR-02 (SC#4) — both in-run judge shots' tokens are COUNTED.

⭐ WHY THIS FILE EXISTS. ``persist_run_usage`` writes ``token_coverage =
list(TOKEN_COVERAGE_LEGS)`` UNCONDITIONALLY, and that array's ``"emit"`` leg claimed
every ``forced_emit``-borne shot inside a harness run. ``256-REVIEW.md`` § CR-02
measured that claim FALSE at two sites: ``validator_kinds.py``'s in-run
``llm_judge_rubric`` judge shot, and ``publish_service.py``'s publish-gauntlet judge
shot. Both were real, billed provider calls whose reported tokens were dropped on the
floor — so a run with genuine uncounted spend was invisible to
``idx_workflow_runs_org_coverage_incomplete``, the ONE access path Phase 257's METER-07
*"what it cannot see"* view reads.

**D-256-18 (operator ruling) takes Option A: COUNT the judge spend.** Option B —
narrowing ``TOKEN_COVERAGE_LEGS`` and shipping a second migration to alter the partial
index predicate — was considered and REJECTED. The phase's premise is *every token is
counted*; a marker honest about not counting is a weaker deliverable than a marker with
nothing left to omit. ⛔ So the 4-leg claim stops over-claiming by becoming TRUE, never
by being lowered. If you find yourself wanting to edit
``test_256_persist_run_usage.py``'s ``TOKEN_COVERAGE_LEGS`` fence, you are drifting into
the rejected option.

⛔ EVERYTHING HERE IS DRIVEN BEHAVIOURALLY AGAINST THE REAL FUNCTIONS, with
``forced_emit`` patched to return a known token-bearing result — **NEVER by grepping for
``_record_run_usage``**. A ``_record_run_usage(ctx, None, None)`` would satisfy a grep
and ship the defect: *presence assertions cannot see content drift.*

⚠ THE TWO SITES ARE NOT SYMMETRIC, and this suite is shaped by that measurement rather
than by the review's *"roughly two lines at each site"*:

  * ``validator_kinds.py`` has a LIVE in-run ``ctx`` carrying ``run_usage_box``, so it
    folds into the run-level box via ``phase_types._record_run_usage`` (imported
    function-locally — ``phase_types.py:84`` imports ``validator_kinds``, so a
    module-level import back is a CYCLE).
  * ``publish_service.py`` has **no ctx and no live box**: its golden run's box was
    already read and finalized by ``_drive_golden_run``'s own ``finally`` BEFORE the
    judge shot happens. So it accumulates into a CALLER-SUPPLIED ``usage_box`` (the
    ``task_service`` / ``eval_runner_service`` house pattern) which the caller at the
    QUAL-01 stage persists with ``persist_run_usage(pool, golden_run_id, ...)``.

WHAT THIS SUITE DOES NOT PROVE: that any real provider reports the usage it is billed
for (no live cross-provider UAT of a judge shot's reported usage happened in this
round); and that a ``forced_emit`` shot which RAISES can be counted (it cannot — see
``test_a_raised_judge_shot_contributes_nothing_and_that_is_the_named_residual``).
"""

from __future__ import annotations

import ast
import hashlib
import re
from pathlib import Path
from unittest.mock import AsyncMock
from uuid import UUID, uuid4

import pytest

import app.services.harness.publish_service as ps
import app.services.harness.validator_kinds as vk


_BACKEND_APP = Path(vk.__file__).resolve().parents[3] / "app"


def _verdict_dict(*, passed: bool = True) -> dict:
    """A minimally-valid ``JudgeVerdict`` payload."""
    return {
        "overall_passed": passed,
        "overall_score": 90 if passed else 10,
        "grounded_in_evidence": passed,
        "answers_business_requirement": passed,
        "did_the_work_not_delegated": passed,
        "criteria": [],
        "summary": "ok" if passed else "not ok",
        "case_feedback": "fine",
    }


class _BoxCtx:
    """An in-run ctx: a real ``run_usage_box``, exactly as the engine hands one over."""

    def __init__(self):
        self.run_usage_box: dict = {}
        self.judge_model = "claude-opus-4-8"
        self.user_settings = None


class _NoBoxCtx:
    """The Deep / unit-stub / golden-run shape — no box at all."""

    def __init__(self):
        self.judge_model = "claude-opus-4-8"
        self.user_settings = None


# ===========================================================================
#  SITE 1 — the in-run llm_judge_rubric validator
# ===========================================================================

@pytest.mark.asyncio
async def test_a_valid_in_run_judge_verdict_folds_its_tokens_into_the_run_box(
    monkeypatch,
):
    """The straightforward arm: a judge shot that produced a verdict was billed."""
    from app.services.harness.validator_kinds import JudgeVerdict

    async def _fake_forced_emit(**kwargs):
        return {
            "emitted": JudgeVerdict.model_validate(_verdict_dict(passed=True)),
            "failure": None,
            "input_tokens": 1234,
            "output_tokens": 567,
        }

    monkeypatch.setattr(
        "app.services.forced_emit.forced_emit", _fake_forced_emit, raising=True
    )

    ctx = _BoxCtx()
    result = await vk._validate_llm_judge_rubric(
        {"text": "a claim [1]"}, {"model": "claude-opus-4-8", "provider": "anthropic"}, ctx
    )

    assert result.passed is True
    assert ctx.run_usage_box == {"input_tokens": 1234, "output_tokens": 567}, (
        "THE IN-RUN JUDGE SHOT'S TOKENS WERE NOT COUNTED. `forced_emit` reported them "
        "and the gate dropped them, while `token_coverage`'s `\"emit\"` leg claimed to "
        "cover every forced_emit-borne shot inside a harness run. This is CR-02."
    )


@pytest.mark.asyncio
async def test_a_FAILED_in_run_judge_shot_still_has_its_tokens_counted(monkeypatch):
    """⭐ THE EXPENSIVE OUTCOME, AND THE CASE THAT FAILS IF THE RECORDING IS MISPLACED.

    ``if result.get("failure") or result.get("emitted") is None: return
    GateResult(False, ...)`` sits TWO LINES below the ``forced_emit`` call. A recording
    placed below it would count the cheap outcomes and skip the expensive one — a judge
    shot that produced no verdict was still SERVED and BILLED. That bias is invisible
    downstream, because a biased total still looks like a total.
    """
    async def _fake_forced_emit(**kwargs):
        return {
            "emitted": None,
            "failure": "model_failed_to_emit",
            "input_tokens": 999,
            "output_tokens": 111,
        }

    monkeypatch.setattr(
        "app.services.forced_emit.forced_emit", _fake_forced_emit, raising=True
    )

    ctx = _BoxCtx()
    result = await vk._validate_llm_judge_rubric(
        {"text": "x"}, {"model": "claude-opus-4-8", "provider": "anthropic"}, ctx
    )

    assert result.passed is False, "a no-verdict judge shot must still fail the gate"
    assert ctx.run_usage_box == {"input_tokens": 999, "output_tokens": 111}, (
        "A FAILED JUDGE SHOT'S BILLED TOKENS VANISHED. The recording must sit ABOVE "
        "the failure arm; below it, only the cheap outcomes are ever counted."
    )


@pytest.mark.asyncio
async def test_a_judge_shot_that_reported_no_usage_adds_nothing_and_not_zero(
    monkeypatch,
):
    """⛔ NOT ``0``. ``None`` means never measured; the two are different facts (D-256-06)."""
    from app.services.harness.validator_kinds import JudgeVerdict

    async def _fake_forced_emit(**kwargs):
        return {
            "emitted": JudgeVerdict.model_validate(_verdict_dict()),
            "failure": None,
            "input_tokens": None,
            "output_tokens": None,
        }

    monkeypatch.setattr(
        "app.services.forced_emit.forced_emit", _fake_forced_emit, raising=True
    )

    ctx = _BoxCtx()
    result = await vk._validate_llm_judge_rubric(
        {"text": "x"}, {"model": "claude-opus-4-8", "provider": "anthropic"}, ctx
    )

    assert result.passed is True
    assert ctx.run_usage_box == {}, (
        "nothing was measured, so nothing may be added — a 0 here would read as "
        "'measured as zero' and make an uninstrumented judge shot look free"
    )


@pytest.mark.asyncio
async def test_a_ctx_with_no_usage_box_is_a_harmless_no_op(monkeypatch):
    """The golden-run / Deep / unit-stub shape. The verdict must be byte-identical."""
    from app.services.harness.validator_kinds import JudgeVerdict

    async def _fake_forced_emit(**kwargs):
        return {
            "emitted": JudgeVerdict.model_validate(_verdict_dict(passed=False)),
            "failure": None,
            "input_tokens": 50,
            "output_tokens": 60,
        }

    monkeypatch.setattr(
        "app.services.forced_emit.forced_emit", _fake_forced_emit, raising=True
    )

    ctx = _NoBoxCtx()
    result = await vk._validate_llm_judge_rubric(
        {"text": "x"}, {"model": "claude-opus-4-8", "provider": "anthropic"}, ctx
    )

    assert result.passed is False  # overall_passed False -> honest fail
    assert not hasattr(ctx, "run_usage_box"), (
        "the recording must never CREATE a box on a ctx that has none — "
        "`_record_run_usage` reads through `_run_usage_box`, which returns None"
    )


@pytest.mark.asyncio
async def test_the_precomputed_verdict_seam_records_nothing(monkeypatch):
    """⛔ The recording must not have been hoisted above the pre-computed-verdict seam.

    ``output["_judge_verdict"]`` returns BEFORE any provider call — nothing was served,
    so nothing was billed, so nothing may be recorded.
    """
    async def _must_not_be_called(**kwargs):  # pragma: no cover - guard
        raise AssertionError("the pre-computed seam must make NO provider call")

    monkeypatch.setattr(
        "app.services.forced_emit.forced_emit", _must_not_be_called, raising=True
    )

    ctx = _BoxCtx()
    result = await vk._validate_llm_judge_rubric(
        {"_judge_verdict": _verdict_dict(passed=True)}, {}, ctx
    )

    assert result.passed is True
    assert ctx.run_usage_box == {}


# ===========================================================================
#  SITE 2 — the publish-gauntlet judge shot
# ===========================================================================

class _FakeDefinition:
    business_requirement = "ship a thing"
    phases: list = []


def _patch_publish_judge_deps(monkeypatch):
    """Everything ``_judge_golden_output`` resolves before the shot."""
    async def _load_app_settings_async():
        return {}

    monkeypatch.setattr(
        "app.models.user_settings.load_app_settings_async",
        _load_app_settings_async,
        raising=True,
    )
    monkeypatch.setattr(
        "app.services.harness.validator_kinds.resolve_judge_model",
        lambda _s: "claude-opus-4-8",
        raising=True,
    )
    monkeypatch.setattr(
        "app.config.get_model_capability",
        lambda _m: {"provider": "anthropic"},
        raising=True,
    )


@pytest.mark.asyncio
async def test_the_publish_judge_accumulates_every_served_attempt_not_just_the_winner(
    monkeypatch,
):
    """⭐ UP TO THREE BILLED SHOTS HAPPEN, AND EVERY SERVED SHOT COUNTS (D-256-12).

    ``for _attempt in range(3)`` retries on a NON-verdict. Two non-verdict results
    followed by a valid one means the provider served — and billed — three times. The
    accumulators are declared ABOVE the loop and initialise to ``None``, never ``0``
    (S-4 / the ``forced_emit`` ladder precedent: a FAILED rung still counts).
    """
    from app.services.harness.validator_kinds import JudgeVerdict

    _patch_publish_judge_deps(monkeypatch)

    shots = [
        {"emitted": None, "failure": "model_failed_to_emit",
         "input_tokens": 100, "output_tokens": 10},
        {"emitted": None, "failure": "model_failed_to_emit",
         "input_tokens": 200, "output_tokens": 20},
        {"emitted": JudgeVerdict.model_validate(_verdict_dict()), "failure": None,
         "input_tokens": 300, "output_tokens": 30},
    ]
    calls = {"n": 0}

    async def _fake_forced_emit(**kwargs):
        out = shots[calls["n"]]
        calls["n"] += 1
        return out

    monkeypatch.setattr(
        "app.services.forced_emit.forced_emit", _fake_forced_emit, raising=True
    )

    box: dict = {}
    verdict = await ps._judge_golden_output(
        definition=_FakeDefinition(),
        final_output={"text": "the deliverable"},
        pool=None,
        owner_settings=None,
        usage_box=box,
    )

    assert calls["n"] == 3, "the retry loop must have served three shots"
    assert verdict.get("overall_passed") is True
    assert box == {"input_tokens": 600, "output_tokens": 60}, (
        "THE PUBLISH JUDGE'S SPEND WAS NOT ACCUMULATED ACROSS ATTEMPTS. Every served "
        f"shot was billed; the winning shot alone is not the total. got {box}"
    )


@pytest.mark.asyncio
async def test_the_publish_judge_reports_its_spend_on_a_FAILED_verdict_too(monkeypatch):
    """A judge that returns ``{"failure": ...}`` on all three attempts still billed."""
    _patch_publish_judge_deps(monkeypatch)

    async def _fake_forced_emit(**kwargs):
        return {"emitted": None, "failure": "model_failed_to_emit",
                "input_tokens": 7, "output_tokens": 3}

    monkeypatch.setattr(
        "app.services.forced_emit.forced_emit", _fake_forced_emit, raising=True
    )

    box: dict = {}
    verdict = await ps._judge_golden_output(
        definition=_FakeDefinition(),
        final_output={"text": "x"},
        pool=None,
        owner_settings=None,
        usage_box=box,
    )

    assert "failure" in verdict
    assert box == {"input_tokens": 21, "output_tokens": 9}, (
        "three failed shots were served and billed; the box must carry all three "
        f"(got {box}) — this is the return path that bypasses the verdict parse"
    )


@pytest.mark.asyncio
async def test_a_raised_judge_shot_contributes_nothing_and_that_is_the_named_residual(
    monkeypatch,
):
    """⚠ IN-03, ASSERTED AS THE RESIDUAL IT IS RATHER THAN PAPERED OVER.

    ``except Exception as e: ... continue`` at the top of the attempt loop means
    ``forced_emit`` returned NO DICT — there is nothing to read. The tokens the provider
    may already have billed are unreachable from here. ⛔ Do NOT manufacture a number
    for it; the residual is registered in ``SEED-300`` with a concrete trigger instead.
    """
    from app.services.harness.validator_kinds import JudgeVerdict

    _patch_publish_judge_deps(monkeypatch)

    calls = {"n": 0}

    async def _fake_forced_emit(**kwargs):
        calls["n"] += 1
        if calls["n"] == 1:
            raise RuntimeError("provider hiccup")
        return {"emitted": JudgeVerdict.model_validate(_verdict_dict()),
                "failure": None, "input_tokens": 5, "output_tokens": 5}

    monkeypatch.setattr(
        "app.services.forced_emit.forced_emit", _fake_forced_emit, raising=True
    )

    box: dict = {}
    verdict = await ps._judge_golden_output(
        definition=_FakeDefinition(),
        final_output={"text": "x"},
        pool=None,
        owner_settings=None,
        usage_box=box,
    )

    assert verdict.get("overall_passed") is True
    assert box == {"input_tokens": 5, "output_tokens": 5}, (
        "only the SERVED-and-RETURNED shot is countable; the raised one contributed "
        "nothing because forced_emit returned no dict (IN-03, the named residual)"
    )


@pytest.mark.asyncio
async def test_the_publish_judge_with_no_box_is_byte_identical_to_what_shipped(
    monkeypatch,
):
    """``usage_box`` defaults to ``None`` — every pre-existing caller is unchanged."""
    from app.services.harness.validator_kinds import JudgeVerdict

    _patch_publish_judge_deps(monkeypatch)

    async def _fake_forced_emit(**kwargs):
        return {"emitted": JudgeVerdict.model_validate(_verdict_dict()),
                "failure": None, "input_tokens": 11, "output_tokens": 22}

    monkeypatch.setattr(
        "app.services.forced_emit.forced_emit", _fake_forced_emit, raising=True
    )

    verdict = await ps._judge_golden_output(
        definition=_FakeDefinition(),
        final_output={"text": "x"},
        pool=None,
        owner_settings=None,
    )
    assert verdict.get("overall_passed") is True
    assert "input_tokens" not in verdict and "output_tokens" not in verdict, (
        "⛔ the verdict dict must gain NO token keys — `JudgeVerdict.model_validate` "
        "owns that shape and would reject or drop them"
    )


# ===========================================================================
#  The QUAL-01 caller persists onto the GOLDEN RUN's workflow_runs row
# ===========================================================================

def _qual01_source() -> str:
    """The QUAL-01 stage's source, sliced at its own landmarks."""
    src = Path(ps.__file__).read_text(encoding="utf-8")
    start = src.index("# ── stage 4: the judge verdict")
    end = src.index("# ── stage 5: flip")
    return src[start:end]


def test_the_qual01_stage_persists_the_judge_spend_above_the_block_return():
    """⚠ ASSERTED AS AN ORDERING, not as presence.

    ``_block(...)`` for a failing verdict returns ~10 lines below the judge call. A
    persist placed below it would lose the judge spend of every BLOCKED publish — and a
    blocked publish is exactly the one whose money is most worth recording, because
    nothing else about the run became durable.
    """
    stage = _qual01_source()
    assert "persist_run_usage(" in stage, (
        "THE QUAL-01 STAGE PERSISTS NOTHING. `_judge_golden_output` has no ctx and no "
        "live run_usage_box (its golden run's box was closed and finalized by "
        "`_drive_golden_run`'s finally BEFORE this line), so the caller is the only "
        "place that can write the judge's spend. This is CR-02's publish half."
    )
    persist_at = stage.index("persist_run_usage(")
    block_at = stage.index('stage="judge"')
    assert persist_at < block_at, (
        "the usage write must sit ABOVE the failing-verdict `_block` return, or a "
        "blocked publish loses its judge spend entirely"
    )


def test_the_persist_targets_the_workflow_runs_grain_and_not_the_producer_shell():
    """⛔ ``golden_run_id``, never ``_producer_id`` (D-256-03).

    ``golden_run_id`` is a ``workflow_runs`` row — the grain ``persist_run_usage``
    writes and the grain ``token_coverage`` lives on. ``_producer_id`` is the separate
    ``runs`` shell; writing the workflow figure onto it would mix grains, which D-256-03
    forbids because the two can then never be summed honestly.
    """
    stage = _qual01_source()
    call = stage[stage.index("persist_run_usage(") :]
    call = call[: call.index(")") + 1]
    assert "golden_run_id" in call, f"the persist must key on golden_run_id; got: {call!r}"
    assert "_producer_id" not in call, (
        f"⛔ the workflow figure may never be written onto the `runs` shell: {call!r}"
    )


# ===========================================================================
#  ⭐ AND THE CALLER IS DRIVEN, NOT DESCRIBED — WR-01 (256-REVIEW-round1.md)
# ===========================================================================
#
# ⛔ THE TWO FENCES ABOVE ARE SOURCE TEXT, AND SOURCE TEXT CANNOT SEE A MISSING
# ARGUMENT. Round 1 shipped the publish half of CR-02 guarded by nothing else:
# ``grep publish_workflow`` over this module returned NOTHING, because every
# behavioural case above calls ``_judge_golden_output`` DIRECTLY and hands it a box it
# made itself. Leg 1 of the chain (the judge FILLS a supplied box) was driven; leg 2
# (``publish_workflow`` SUPPLIES one, and persists it) was not driven at all.
#
# THE CONCRETE FAILURE THAT LEAVES EVERY OTHER TEST GREEN: a later phase extracts the
# owner-settings + judge block of the QUAL-01 stage into a helper and drops the
# ``usage_box=_judge_usage`` keyword from the call site. ``_judge_usage`` stays ``{}``,
# ``if _judge_usage:`` is False, NO usage write is ever issued, and the judge spend
# silently stops being counted — while BOTH text fences above still hold, because the
# ``persist_run_usage(`` call text and its ``golden_run_id`` argument are still
# literally present. ``token_coverage``'s four-leg claim over-claims again and the run
# becomes invisible to ``idx_workflow_runs_org_coverage_incomplete``, the ONE access
# path Phase 257's METER-07 *"what it cannot see"* view reads. That is CR-02 verbatim,
# reopened with a fully green suite.
#
# ⭐ SO THESE TWO CASES ASSERT THE ARGUMENTS OF THE WRITE, NEVER THAT A WRITE HAPPENED.
# ``persist_run_usage`` is left REAL and the pool is the recorder, so what is pinned is
# the statement the database would actually receive: the ``workflow_runs`` grain id, the
# judge's real token numbers, and the four-leg coverage marker. *Presence assertions
# cannot see content drift* — a fence proving only "something was written" would pass
# over a write of ``(0, 0)`` onto the wrong row.
#
# ⚠ WHAT IS MOCKED, AND WHY IT IS NOT THE SUBJECT. ``_drive_golden_run`` is mocked at
# the boundary — the house shape of ``test_publish_service.py``, whose own docstring
# records the D-05 reason: the REAL acceptance of a golden run is the live SC#10
# scoreboard, never a unit test. ``_judge_golden_output`` is deliberately NOT mocked; it
# is the callee whose box-filling these cases must observe, so ``forced_emit`` is
# patched one level deeper and the whole judge retry ladder runs for real.

_PUBLISH_DEF_ID = UUID("00000000-0000-4000-8000-0000000000d1")
_PUBLISH_USER_UUID = UUID("00000000-0000-4000-8000-0000000000a1")
_PUBLISH_USER = {"id": str(_PUBLISH_USER_UUID)}


def _publish_definition_row() -> dict:
    """A lint-clean single-phase draft row — the ``test_publish_service.py`` shape."""
    return {
        "id": _PUBLISH_DEF_ID,
        "slug": "qual-test",
        "version": 1,
        "name": "Quality Test Workflow",
        "status": "draft",
        "definition": {
            "slug": "qual-test",
            "version": 1,
            "name": "Quality Test Workflow",
            "status": "draft",
            "phases": [
                {
                    "slug": "answer",
                    "phase_index": 0,
                    "config": {"phase_type": "llm_single", "prompt": "Answer the question."},
                    "validators": [],
                }
            ],
            "business_requirement": "Deliver a cited answer.",
        },
        "created_by": _PUBLISH_USER_UUID,
    }


def _patch_publish_gauntlet(monkeypatch, *, golden_run_id):
    """Everything from stage 0 to stage 4, so the JUDGE STAGE IS REACHED.

    ⛔ ``persist_run_usage`` is NOT among these — it is the subject. ⛔ Neither is
    ``_judge_golden_output``.
    """
    _patch_publish_judge_deps(monkeypatch)
    monkeypatch.setattr(
        "app.models.user_settings.load_user_settings", lambda _uid: None, raising=True
    )
    monkeypatch.setattr(
        "app.db.workflows.get_definition",
        AsyncMock(return_value=_publish_definition_row()),
        raising=True,
    )
    monkeypatch.setattr("app.db.workflows.write_audit", AsyncMock(), raising=True)
    monkeypatch.setattr(
        "app.db.workflows.publish_definition", AsyncMock(return_value=2), raising=True
    )
    # Stage 2.6 would otherwise resolve a REAL service-role client against an AsyncMock
    # pool — the same reason ``test_publish_service.py`` neutralises it suite-wide.
    monkeypatch.setattr(
        ps, "_grounding_fidelity_failures", AsyncMock(return_value=[]), raising=True
    )
    monkeypatch.setattr(
        ps,
        "_drive_golden_run",
        AsyncMock(
            return_value=(golden_run_id, {"text": "a grounded answer [doc1]"}, "completed")
        ),
        raising=True,
    )


def _usage_writes(pool) -> list[tuple]:
    """Every ``persist_run_usage`` statement the pool ACTUALLY received."""
    return [
        c.args
        for c in pool.execute.await_args_list
        if c.args and "UPDATE workflow_runs SET input_tokens" in str(c.args[0])
    ]


@pytest.mark.asyncio
async def test_publish_workflow_actually_issues_the_judge_usage_write_on_a_PASSED_publish(
    monkeypatch,
):
    """⛔ THE CALLER IS DRIVEN. Drop ``usage_box=_judge_usage`` and this goes RED.

    The happy path still has to pay for its judge shot. This case binds
    ``publish_workflow``'s half of the wiring end to end: it declares a box, the REAL
    ``_judge_golden_output`` fills it from the shot's reported usage, and the stage
    persists it onto the ``workflow_runs`` grain before the flip.
    """
    from app.db.workflows import TOKEN_COVERAGE_LEGS
    from app.services.harness.validator_kinds import JudgeVerdict

    golden_run_id = uuid4()
    _patch_publish_gauntlet(monkeypatch, golden_run_id=golden_run_id)

    async def _fake_forced_emit(**kwargs):
        return {
            "emitted": JudgeVerdict.model_validate(_verdict_dict(passed=True)),
            "failure": None,
            "input_tokens": 1234,
            "output_tokens": 567,
        }

    monkeypatch.setattr(
        "app.services.forced_emit.forced_emit", _fake_forced_emit, raising=True
    )

    pool = AsyncMock()
    result = await ps.publish_workflow(
        definition_id=_PUBLISH_DEF_ID,
        golden_input="a representative kickoff prompt",
        user=_PUBLISH_USER,
        pool=pool,
        redis=AsyncMock(),
    )

    assert result["published"] is True, f"the gauntlet never reached stage 5: {result}"

    writes = _usage_writes(pool)
    assert writes, (
        "THE QUAL-01 STAGE ISSUED NO USAGE WRITE AT ALL. `publish_workflow` declares "
        "`_judge_usage = {}` and must hand it to `_judge_golden_output` as `usage_box=`; "
        "without that keyword the box stays empty, `if _judge_usage:` is False, and "
        "every publish's judge spend is lost again — while both source-text fences "
        "above stay green. This is WR-01 / CR-02's publish half."
    )
    assert len(writes) == 1, f"the judge spend was written more than once: {writes}"
    sql, run_id, in_tok, out_tok, legs = writes[0]

    assert run_id == golden_run_id, (
        f"⛔ the write must key on the `workflow_runs` grain (`golden_run_id` "
        f"{golden_run_id}), never the separate `runs` shell — D-256-03. got {run_id!r}"
    )
    assert (in_tok, out_tok) == (1234, 567), (
        "the judge's REAL measured tokens must reach the row — a write that happened "
        f"with the wrong numbers is exactly the drift a presence assertion cannot see. "
        f"got {(in_tok, out_tok)}"
    )
    assert legs == list(TOKEN_COVERAGE_LEGS), (
        '⛔ the coverage marker rides the SAME statement, and the `"emit"` leg is only '
        f"true BECAUSE this write happens. got {legs!r}"
    )
    assert "token_coverage = $4" in sql and "COALESCE(input_tokens, 0)" in sql, (
        f"ADD, never SET, and the marker travels with it (D-256-09): {sql!r}"
    )


@pytest.mark.asyncio
async def test_publish_workflow_actually_issues_the_judge_usage_write_on_a_BLOCKED_publish(
    monkeypatch,
):
    """⭐ THE OUTCOME WHOSE MONEY MATTERS MOST, DRIVEN RATHER THAN DESCRIBED.

    A blocked publish is the one whose spend is most worth recording — nothing else
    about that run became durable, and the provider was still paid for up to three
    shots. Three non-verdict shots of 7/3 bill 21/9, the retry loop exhausts, and the
    stage blocks at ``judge`` — so the write must ALREADY have happened, because the
    persist sits ABOVE the ``_block`` return. The ordering fence above asserts that over
    source text; this asserts it over behaviour, where a persist moved below the block
    shows up as an ABSENT statement rather than as a rearranged string.
    """
    golden_run_id = uuid4()
    _patch_publish_gauntlet(monkeypatch, golden_run_id=golden_run_id)

    shots = {"n": 0}

    async def _fake_forced_emit(**kwargs):
        shots["n"] += 1
        return {
            "emitted": None,
            "failure": "model_failed_to_emit",
            "input_tokens": 7,
            "output_tokens": 3,
        }

    monkeypatch.setattr(
        "app.services.forced_emit.forced_emit", _fake_forced_emit, raising=True
    )

    pool = AsyncMock()
    result = await ps.publish_workflow(
        definition_id=_PUBLISH_DEF_ID,
        golden_input="a representative kickoff prompt",
        user=_PUBLISH_USER,
        pool=pool,
        redis=AsyncMock(),
    )

    assert result["published"] is False and result["blocked_stage"] == "judge", (
        f"the gauntlet must block at the judge stage here: {result}"
    )
    assert shots["n"] == 3, "the retry loop must have served — and been billed for — three shots"

    writes = _usage_writes(pool)
    assert writes, (
        "A BLOCKED PUBLISH RECORDED NO JUDGE SPEND. Either `usage_box=_judge_usage` is "
        "gone from the `_judge_golden_output` call, or the persist has moved BELOW the "
        "failing-verdict `_block` return — both lose the money of precisely the "
        "publishes that produced nothing else durable."
    )
    assert len(writes) == 1, f"the judge spend was written more than once: {writes}"
    _sql, run_id, in_tok, out_tok, _legs = writes[0]
    assert run_id == golden_run_id, f"⛔ the `workflow_runs` grain, not the shell: {run_id!r}"
    assert (in_tok, out_tok) == (21, 9), (
        "every SERVED shot was billed, so all three must reach the row — the winning "
        f"shot alone is not the total, and here there was no winning shot. got "
        f"{(in_tok, out_tok)}"
    )


# ===========================================================================
#  THE DISPOSITION FENCE — what makes SC#4 survive the next author
# ===========================================================================

#: ⚠ EVERY ``forced_emit`` CALL SITE IN ``backend/app``, WITH A DISPOSITION EACH.
#: Asserted as a SET, never as ``len(...) == 10`` — a count lets one site vanish while
#: another appears and still reads green. ⛔ An ELEVENTH site anywhere under
#: ``backend/app`` FAILS this fence until it is classified, which is the only mechanism
#: that makes SC#4's *"discoverable, not from someone's memory"* survive.
#:
#: Dispositions:
#:   COUNTED-INTO-RUN-BOX  — folds into ``ctx.run_usage_box``, which the engine persists
#:   COUNTED-VIA-PERSIST   — accumulated into a caller box the caller persists
#:   NO-RUN                — no ``runs`` row, no ``workflow_runs`` row, so no
#:                           ``token_coverage`` marker exists that could over-claim
#:   REGISTERED            — a ``runs`` row that carries NO ``token_coverage`` marker;
#:                           SEED-300 hole 3, open with a trigger
_EXPECTED_FORCED_EMIT_SITES: dict[str, str] = {
    "services/embedding_service.py": "NO-RUN",
    "services/eval_runner_service.py": "REGISTERED (SEED-300 hole 3 — an eval `runs` row, no token_coverage marker)",
    "services/expert_authoring.py": "NO-RUN",
    "services/harness/phase_types.py": "COUNTED-INTO-RUN-BOX",
    "services/harness/publish_service.py": "COUNTED-VIA-PERSIST",
    "services/harness/validator_kinds.py": "COUNTED-INTO-RUN-BOX",
    # Phase 263 (PACK-15 / D-263-13). ⭐ THIS FENCE IS WHAT FOUND THE SITE: `263-02-PLAN.md`
    # named `test_259_closed_core_inventory.py` as the registry a new service must not disturb
    # and never mentioned this SECOND one, so the enrolment was discovered by the gate going
    # red, not by the plan. NO-RUN is the same argument the two neighbours above carry — a
    # plain service function called from a route, no `runs` row, no `workflow_runs` row, and
    # `run_usage_box` absent from the source (driven by the test below, not asserted here).
    "services/skill_body_authoring.py": "NO-RUN",
    "services/skill_proposer_service.py": "NO-RUN",
    "services/skill_tuner_service.py": "NO-RUN",
    "services/workflow_authoring.py": "NO-RUN",
}

_FORCED_EMIT_RE = re.compile(r"(?:await\s+forced_emit\s*\(|=\s*forced_emit\s*\()")


def _measured_forced_emit_files() -> set[str]:
    found: set[str] = set()
    for path in sorted(_BACKEND_APP.rglob("*.py")):
        if "__pycache__" in path.parts:
            continue
        rel = path.relative_to(_BACKEND_APP).as_posix()
        for line in path.read_text(encoding="utf-8").splitlines():
            if _FORCED_EMIT_RE.search(line):
                found.add(rel)
                break
    return found


def test_every_forced_emit_call_site_carries_a_disposition():
    """⛔ THE SET, re-derived from source, with a disposition for every member.

    ⚠ MEASURED, NOT INHERITED: the ruling in ``256-VERIFICATION.md`` names TWO judge
    sites, but ``grep -rn "await forced_emit(\\|= forced_emit(" backend/app`` measures
    TEN call sites across EIGHT files. Eight of the ten are not judge shots at all, and
    a plan that fixed "the two" while leaving the other eight unnamed would have left
    SC#4's discoverability resting on this round's memory.
    """
    measured = _measured_forced_emit_files()
    expected = set(_EXPECTED_FORCED_EMIT_SITES)
    assert measured == expected, (
        "the `forced_emit` call-site file SET changed.\n"
        f"  appeared (needs a disposition): {sorted(measured - expected)}\n"
        f"  vanished: {sorted(expected - measured)}\n"
        "Every site must carry one of COUNTED-INTO-RUN-BOX / COUNTED-VIA-PERSIST / "
        "NO-RUN / REGISTERED. A new uncounted site means `token_coverage`'s four-leg "
        "claim is over-claiming again, and the marker is the one thing Phase 257's "
        "METER-07 blind-spot view reads."
    )
    assert all(_EXPECTED_FORCED_EMIT_SITES.values()), "a blank disposition is not one"


def test_the_four_non_harness_hosts_really_have_no_run_usage_box():
    """The ARGUMENT for the ``NO-RUN`` disposition, driven rather than asserted.

    ⚠ ``grep -c run_usage_box`` is ZERO in all four, and zero in
    ``eval_runner_service.py`` too. Only the latter has a run at all, and it is a
    ``runs`` shell with a local ``usage_acc`` — no ``workflow_runs`` row, and therefore
    no ``token_coverage`` marker that could over-claim over it. That distinction is what
    separates ``NO-RUN`` from ``REGISTERED``.
    """
    for rel, disposition in _EXPECTED_FORCED_EMIT_SITES.items():
        if not disposition.startswith(("NO-RUN", "REGISTERED")):
            continue
        src = (_BACKEND_APP / rel).read_text(encoding="utf-8")
        assert "run_usage_box" not in src, (
            f"{rel} carries a `run_usage_box` after all — its {disposition!r} "
            "disposition is wrong and the site must be re-classified"
        )


# ===========================================================================
#  No fifth leg, no second migration — recorded where the column points
# ===========================================================================

def test_the_leg_set_is_still_four_and_the_emit_leg_says_what_it_covers():
    """⛔ Option B stays rejected, and the ``"emit"`` leg's meaning is written down.

    Migration 182's durable ``COMMENT ON COLUMN`` delegates the legs' meaning to this
    constant verbatim (*"Written from ONE module-level constant,
    db.workflows.TOKEN_COVERAGE_LEGS"*), which is exactly what makes "no second
    migration" CORRECT rather than merely convenient: the durable comment does not
    become false when the leg's coverage grows, because it never spelled the coverage
    out itself.
    """
    from app.db import workflows as dbw

    assert dbw.TOKEN_COVERAGE_LEGS == ("agent", "single", "batch", "emit")

    src = Path(dbw.__file__).read_text(encoding="utf-8")
    block = src[: src.index("TOKEN_COVERAGE_LEGS: tuple")]
    block = block[block.index("the coverage marker") :]
    lowered = block.lower()
    assert "judge" in lowered, (
        "the `\"emit\"` leg now COVERS the two in-run judge shots, and the "
        "TOKEN_COVERAGE_LEGS comment block is where the durable column comment points "
        "for that meaning — so it must say so, in words, for Phase 257 and the next "
        "author. It does not."
    )
    assert "d-256-18" in lowered or "option a" in lowered, (
        "the block must record that Option A was TAKEN and Option B (a narrowed leg set "
        "+ a second migration altering the index predicate) was REJECTED, with the "
        "operator's reason — otherwise the next author re-litigates a settled decision"
    )


def test_the_durable_column_comment_still_delegates_to_the_constant():
    """The leaf fact the "no second migration" argument rests on.

    ⚠ MEASURED CORRECTION (Phase 256 round 1): the plan claimed this phrase is
    grep-verifiable with ONE hit in BOTH ``supabase/migrations/182_*.sql`` and
    ``supabase/full-schema.sql``. Re-measured here: it is **0 hits in the migration and
    1 in full-schema.sql**, because the migration splits the sentence across two
    adjacent SQL string literals (``'... db.workflows.'`` ``'TOKEN_COVERAGE_LEGS, ...'``)
    which Postgres concatenates on apply. The FACT is true; the plan's stated
    verification method was not. So this fence normalises the literals before matching —
    the original claim is recorded beside the correction, never over it.
    """
    repo = _BACKEND_APP.parents[1]
    mig = (repo / "supabase/migrations/182_workflow_runs_token_totals.sql").read_text(
        encoding="utf-8"
    )
    # Concatenate adjacent SQL string literals the way the server does.
    joined = re.sub(r"'\s*\n\s*'", "", mig)
    phrase = "Written from ONE module-level constant, db.workflows.TOKEN_COVERAGE_LEGS"
    assert phrase in joined, (
        "migration 182's COMMENT ON COLUMN no longer delegates the legs' meaning to the "
        "code constant — if that delegation goes, growing the leg's coverage DOES "
        "falsify a durable comment and a second migration becomes owed"
    )
    full = (repo / "supabase/full-schema.sql").read_text(encoding="utf-8")
    assert phrase in full, "the deploy artifact lost the delegating phrase"


def test_this_round_shipped_no_migration():
    """⭐ A CLOSURE ROUND INTRODUCES NO NEW CAPABILITY (G-7), and a migration is one.

    ⚠ SCOPE CORRECTED DELIBERATELY 2026-09-19 (Phase 257 review). The original assertion
    is recorded here rather than deleted, because the way it failed is the finding:

        if re.match(r"^(18[3-9]|19\\d|[2-9]\\d{2})_", p.name)
        assert later == [], f"a migration numbered above 182 appeared: {later}"

    It was SCOPED TO PHASE 256'S CLOSURE ROUND — G-7 forbids a *gap-closure round* from
    smuggling in a new capability, and a migration is one. It was never a claim that the
    repository may not exceed migration 182 forever, but that is what it ASSERTED, so the
    first later phase to ship any migration trips it whether or not it did anything wrong.
    **Phase 257 is a PHASE, not a closure round of 256**, and migration 183 (`model_rates`,
    METER-01) is exactly the new capability a phase exists to ship.

    ⛔ THIS IS THE `SEED-177` / `D-206-07` SHAPE, AND ITS RULE BINDS HERE: *retire or widen
    a fence DELIBERATELY, never trip it by surprise.* It WAS tripped by surprise — the
    backend gate went 71 -> 72 against a ceiling of 71 with zero headroom, and nothing in
    Phase 257's four plans predicted it. What is corrected is the fence's SCOPE, not its
    intent: 256's closure round still shipped no migration, and that is still asserted
    below, now pinned at the number 257 legitimately took.

    Re-open trigger: a *gap-closure round* — not a phase — proposing a migration.
    """
    # ⚠ SECOND CORRECTION, SAME DAY, AND THE SECOND ONE IS THE REAL FIX. The first pass
    # simply moved the ceiling 182 -> 183. Phase 257.1 then shipped migration 184 and the
    # fence fired AGAIN — which is the tell that a MOVING CEILING was never the property.
    # Any fence that must be widened by every subsequent phase is a scheduled false alarm,
    # and the third person to hit it widens it without reading why it exists.
    #
    # ⭐ THE PROPERTY IS HISTORICAL AND IMMUTABLE: *Phase 256 shipped exactly one migration,
    # 182, and its gap-closure rounds shipped none.* Phase 256 is closed; that fact can
    # never change, so asserting it can never be tripped by a later phase doing its job.
    # Measured: the highest migration number named anywhere under `.planning/phases/256-*/`
    # is 182 (the others referenced are 055, 118, 125, 129, 175 — all pre-existing).
    repo = _BACKEND_APP.parents[1]
    phase_dirs = sorted((repo / ".planning" / "phases").glob("256-*"))
    assert phase_dirs, "phase 256's artifacts are missing — this fence lost its subject"

    referenced: set[int] = set()
    for d in phase_dirs:
        for f in d.rglob("*.md"):
            for m in re.finditer(
                r"(?:supabase/migrations/|\bmigration\s+)(\d{3})\b",
                f.read_text(encoding="utf-8", errors="replace"),
                re.I,
            ):
                referenced.add(int(m.group(1)))

    above = sorted(n for n in referenced if n > 182)
    assert above == [], (
        "Phase 256's artifacts now reference a migration numbered above 182. Phase 256 is "
        "CLOSED, so this is either a retroactive edit to a shipped phase's record or a "
        "gap-closure round smuggling in a new capability — G-7 forbids the second and the "
        f"first needs saying out loud. Offending migration number(s): {above}"
    )


# ===========================================================================
#  The placement properties, as ORDERINGS over the real source
# ===========================================================================

def test_the_validator_records_above_its_failure_arm():
    """⛔ ORDERING, not presence — the whole point of the placement.

    ⚠ MEASURED VIA ``ast``, NOT VIA A SOURCE SLICE, AND THE REASON IS THAT THE FIRST
    DRAFT OF THIS FENCE FIRED ON ITS OWN SUBJECT'S COMMENT. The implementation's comment
    block legitimately QUOTES the failure arm (*"recording below the
    ``if result.get("failure") ...: return GateResult(False, …)`` two lines down would
    count the cheap outcomes"*), so ``str.index`` found that quotation — which sits
    ABOVE the recording — and reported the ordering backwards on correct code. That is
    the ``PhaseFormPanel.test.tsx`` / ``stripComments.testutil.ts`` trap on the backend:
    **a text fence cannot tell code from a comment.** ``ast`` parses statements only, so
    prose about the code is invisible to it.
    """
    src = Path(vk.__file__).read_text(encoding="utf-8")
    fn = next(
        n
        for n in ast.walk(ast.parse(src))
        if isinstance(n, ast.AsyncFunctionDef) and n.name == "_validate_llm_judge_rubric"
    )
    record_lines = [
        n.lineno
        for n in ast.walk(fn)
        if isinstance(n, ast.Call)
        and isinstance(n.func, ast.Name)
        and n.func.id == "_record_run_usage"
    ]
    assert record_lines, "no `_record_run_usage` CALL in the validator"
    failure_lines = [
        n.lineno
        for n in ast.walk(fn)
        # ⚠ ``ast.unparse`` NORMALISES STRING LITERALS TO SINGLE QUOTES, so matching the
        # source's own double-quoted spelling finds nothing. Measured, not reasoned about.
        if isinstance(n, ast.If) and "result.get('failure')" in ast.unparse(n.test)
    ]
    assert failure_lines, "the `result.get('failure')` arm moved — re-derive"
    assert min(record_lines) < min(failure_lines), (
        f"the recording (line {min(record_lines)}) sits BELOW the failure arm (line "
        f"{min(failure_lines)}), so a judge shot that produced no verdict — the "
        "expensive outcome — is never counted"
    )


def test_the_validator_import_is_function_local_because_a_module_level_one_cycles():
    """⛔ ``phase_types.py`` imports THIS module, so a module-level import back CYCLES.

    Also the module's own Pitfall-4 contract (``forced_emit``,
    ``template_render_service``, ``docxtpl`` are function-local here).
    """
    src = Path(vk.__file__).read_text(encoding="utf-8")
    tree = ast.parse(src)
    for node in tree.body:  # MODULE level only
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            names = [a.name for a in node.names]
            assert "_record_run_usage" not in names, (
                "a module-level import of `_record_run_usage` is an import CYCLE: "
                "`phase_types.py:84` imports `validator_kinds`"
            )
            if isinstance(node, ast.ImportFrom):
                assert node.module != "app.services.harness.phase_types", (
                    "module-level `from app.services.harness.phase_types import ...` "
                    "is the cycle this file's Pitfall 4 forbids"
                )
    # And the phase_types import that DOES exist is inside a function body.
    fn = src[src.index("async def _validate_llm_judge_rubric") :]
    assert "from app.services.harness.phase_types import _record_run_usage" in fn


def test_the_publish_usage_box_is_keyword_only_and_defaults_to_none():
    """Additive by construction: every pre-existing caller stays byte-identical."""
    tree = ast.parse(Path(ps.__file__).read_text(encoding="utf-8"))
    fn = next(
        n
        for n in ast.walk(tree)
        if isinstance(n, ast.AsyncFunctionDef) and n.name == "_judge_golden_output"
    )
    kwonly = [a.arg for a in fn.args.kwonlyargs]
    assert "usage_box" in kwonly, (
        f"`usage_box` must be KEYWORD-ONLY; kwonly args are {kwonly}"
    )
    assert fn.args.args == [], "the function stays keyword-only throughout"
    idx = kwonly.index("usage_box")
    default = fn.args.kw_defaults[idx]
    assert isinstance(default, ast.Constant) and default.value is None, (
        "the default must be `None` — a `{}` default is a shared mutable and a "
        "non-None default would change what every existing caller gets"
    )


def test_the_publish_accumulators_are_declared_above_the_retry_loop():
    """⛔ ABOVE the loop, initialised to ``None`` never ``0`` (S-4 ladder precedent).

    Inside the loop they would reset on every attempt and only the last shot would
    count; initialised to ``0`` they would make a judge that reported no usage at all
    look measured-at-zero rather than never-measured.
    """
    src = Path(ps.__file__).read_text(encoding="utf-8")
    fn = src[src.index("async def _judge_golden_output") :]
    fn = fn[: fn.index("\ndef _author_judge_criteria")]
    loop_at = fn.index("for _attempt in range(3):")
    acc = re.search(r"_judge_in\w*\s*:\s*int \| None = None", fn) or re.search(
        r"_judge_in\w*\s*=\s*None", fn
    )
    assert acc, "no `None`-initialised input-token accumulator found"
    assert acc.start() < loop_at, (
        "the accumulator is declared INSIDE the retry loop — it would reset on every "
        "attempt and only the winning shot would ever be counted"
    )


# ===========================================================================
#  METER-04 / METER-05 are VERIFIED and are NOT re-opened by this round
# ===========================================================================

def test_the_input_tokens_none_set_is_still_exactly_two_entries():
    """⚠ If this fails, a VERIFIED criterion was re-opened — stop and report.

    ``run_lifecycle.py`` (a default PARAMETER, not a call site) and
    ``run_reconciler.py`` (SEED-299, registered). ⚠ ``256-VERIFICATION.md`` says
    ``run_reconciler.py:236``; the measured line is ``:245`` and ``256-CONTEXT.md``
    D-256-08 was right — so this fence binds the FILES, not the line numbers, which is
    the part that is stable.
    """
    hits: list[str] = []
    for path in sorted(_BACKEND_APP.rglob("*.py")):
        if "__pycache__" in path.parts:
            continue
        rel = path.relative_to(_BACKEND_APP).as_posix()
        for lineno, line in enumerate(
            path.read_text(encoding="utf-8").splitlines(), start=1
        ):
            if "input_tokens=None" in line:
                hits.append(f"{rel}:{lineno}")
    files = sorted({h.rsplit(":", 1)[0] for h in hits})
    assert files == ["services/run_lifecycle.py", "services/run_reconciler.py"], (
        f"the `input_tokens=None` set changed (METER-05 re-opened): {hits}"
    )
    assert len(hits) == 2, f"expected exactly two entries, measured: {hits}"


def _md5(p: Path) -> str:
    return hashlib.md5(p.read_bytes()).hexdigest()  # noqa: S324 — file identity, not crypto


def test_persist_run_usage_body_is_untouched_by_this_round():
    """⛔ The writer is only REACHED from one more place; its body is not edited.

    The unconditional ``token_coverage = list(TOKEN_COVERAGE_LEGS)`` write stays exactly
    as it was, and that is CORRECT once the claim is true: the column records *which
    counting legs the instrumentation covers — NOT which legs a given run happened to
    use*. The defect was a FALSE claim, not a conditional one.
    """
    from app.db import workflows as dbw

    src = Path(dbw.__file__).read_text(encoding="utf-8")
    tree = ast.parse(src)
    fn = next(
        n
        for n in ast.walk(tree)
        if isinstance(n, ast.AsyncFunctionDef) and n.name == "persist_run_usage"
    )
    body = ast.get_source_segment(src, fn)
    assert body is not None
    assert "token_coverage = $4" in body
    assert "list(TOKEN_COVERAGE_LEGS)" in body
    assert "if not input_delta and not output_delta:" in body, (
        "the falsy-delta short-circuit is what makes the three call sites idempotent"
    )
