"""Phase 135 Plan 05 (SI-01) — the D-13 promotion-gate math (pure function, exhaustive edges).

``evals.promotion_gate(source_rows, reeval_rows)`` is the honest gate at the heart of the
self-improvement loop: it joins the SOURCE run × the RE-EVAL run on ``test_case_id`` (``with_skill``
arm only) over the INTERSECTION of cases GRADED in BOTH runs and decides:

    passed = no_regression AND improved
      no_regression = every previously-PASSING case still passes
      improved      = at least one previously-FAILING case now passes

``not_measured`` (``verdict_state != 'graded'``) rows are excluded from BOTH the numerator AND the
denominator — a case that isn't graded in one arm is honestly ``excluded_not_measured``, never
counted as a pass or a fail. A changed case set (cases added/deleted since the source run) is handled
by the intersection-only join, with the dropped/added cases counted in ``excluded_not_measured``.

These tests are PURE (no DB / no LLM / no async) — they exercise the gate math directly and assert
the returned dict's keys are EXACTLY ``PromotionGate.model_fields`` so the field can never silently
drift from the locked Plan-04 model.
"""
from app.api.evals import promotion_gate
from app.models.eval_run import PromotionGate


def _row(tc, passed, *, variant="with_skill", state="graded"):
    """A minimal ``eval_results`` row the gate reads (test_case_id / variant / verdict_state /
    verdict_passed)."""
    return {
        "test_case_id": tc,
        "variant": variant,
        "verdict_state": state,
        "verdict_passed": passed,
    }


def test_no_regression_plus_improvement_passes():
    """no previously-passing case regressed AND >=1 previously-failing case now passes -> passed."""
    source = [_row("tc1", True), _row("tc2", False)]
    reeval = [_row("tc1", True), _row("tc2", True)]
    g = promotion_gate(source, reeval)
    assert g["passed"] is True
    assert g["no_regression"] is True
    assert g["improved"] is True
    assert g["prev_pass"] == 1 and g["prev_fail"] == 1
    assert g["still_pass"] == 1 and g["newly_pass"] == 1
    assert g["excluded_not_measured"] == 0


def test_regressed_prev_pass_fails_the_gate():
    """A previously-PASSING case that now FAILS breaks no_regression -> not passed (even if an
    improvement also happened)."""
    source = [_row("tc1", True), _row("tc2", False)]
    reeval = [_row("tc1", False), _row("tc2", True)]  # tc1 regressed
    g = promotion_gate(source, reeval)
    assert g["passed"] is False
    assert g["no_regression"] is False
    assert g["improved"] is True  # tc2 improved, but a regression still fails the gate
    assert g["still_pass"] == 0


def test_no_improvement_fails_the_gate():
    """no_regression alone is NOT enough — the gate requires >=1 newly-passing case (D-13)."""
    source = [_row("tc1", True), _row("tc2", False)]
    reeval = [_row("tc1", True), _row("tc2", False)]  # tc2 still fails
    g = promotion_gate(source, reeval)
    assert g["passed"] is False
    assert g["no_regression"] is True
    assert g["improved"] is False
    assert g["newly_pass"] == 0


def test_all_pass_with_no_prev_fail_is_not_an_improvement():
    """Every case already passing means there is nothing to improve -> not passed (needs a
    newly-passing prev-fail)."""
    source = [_row("tc1", True), _row("tc2", True)]
    reeval = [_row("tc1", True), _row("tc2", True)]
    g = promotion_gate(source, reeval)
    assert g["passed"] is False
    assert g["improved"] is False
    assert g["prev_fail"] == 0


def test_not_measured_excluded_from_both_sides():
    """A ``not_measured`` (non-graded) arm is excluded from the numerator AND the denominator, and
    counted honestly in ``excluded_not_measured`` — never a pass or a fail."""
    source = [_row("tc1", True), _row("tc2", False), _row("tc3", True)]
    # tc3 is not graded on the re-eval (an errored / empty arm) -> excluded from BOTH sides.
    reeval = [_row("tc1", True), _row("tc2", True), _row("tc3", None, state="not_measured")]
    g = promotion_gate(source, reeval)
    assert g["passed"] is True
    # tc3 is NOT counted as a prev_pass (excluded), so prev_pass == 1 (only tc1), NOT 2.
    assert g["prev_pass"] == 1
    assert g["prev_fail"] == 1
    assert g["still_pass"] == 1 and g["newly_pass"] == 1
    # tc3 is graded in source but not in re-eval -> excluded_not_measured.
    assert g["excluded_not_measured"] == 1


def test_without_skill_rows_are_ignored():
    """Only the ``with_skill`` arm feeds the gate — ``without_skill`` rows never affect the math."""
    source = [_row("tc1", True), _row("tc1", True, variant="without_skill")]
    reeval = [_row("tc1", False), _row("tc1", True, variant="without_skill")]  # with_skill regressed
    g = promotion_gate(source, reeval)
    assert g["passed"] is False
    assert g["no_regression"] is False
    assert g["prev_pass"] == 1  # only the with_skill tc1


def test_changed_case_set_intersection_only():
    """A changed case set (a case deleted + a case added since the source run) compares only the
    INTERSECTION; the dropped + added cases are counted in ``excluded_not_measured``."""
    source = [_row("tc1", True), _row("tc2", False)]   # tc1 deleted before the re-eval
    reeval = [_row("tc2", True), _row("tc3", True)]     # tc3 added after the source run
    g = promotion_gate(source, reeval)
    # Only tc2 is shared: it was failing and now passes -> improvement, no prev_pass to regress.
    assert g["passed"] is True
    assert g["prev_pass"] == 0 and g["prev_fail"] == 1
    assert g["newly_pass"] == 1
    # tc1 (source-only) + tc3 (re-eval-only) are both excluded.
    assert g["excluded_not_measured"] == 2


def test_empty_runs_do_not_pass():
    """No graded cases in either arm -> nothing improved -> not passed (honest, never a fabricated
    pass on an empty comparison)."""
    g = promotion_gate([], [])
    assert g["passed"] is False
    assert g["improved"] is False
    assert g["prev_pass"] == 0 and g["prev_fail"] == 0
    assert g["excluded_not_measured"] == 0


def test_gate_keys_match_promotion_gate_model_exactly():
    """The returned dict's keys MUST equal ``PromotionGate.model_fields`` exactly — so the honest
    counts can never silently drift from the locked Plan-04 response model (the field FastAPI
    serializes onto ``SkillProposalResponse.gate``)."""
    g = promotion_gate([_row("tc1", False)], [_row("tc1", True)])
    assert set(g.keys()) == set(PromotionGate.model_fields.keys())
    # And the dict is directly constructible into the model (no missing / extra keys, right types).
    model = PromotionGate(**g)
    # tc1: prev_fail -> now pass => improved True, no_regression True (no prev_pass) => passed True.
    assert model.improved is True and model.no_regression is True and model.passed is True
