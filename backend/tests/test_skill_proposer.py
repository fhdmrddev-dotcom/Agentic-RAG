"""Phase 135 Plan 03 (SI-01) — skill_proposer_service SERVICE-level tests.

Proves the four load-bearing behaviors of the self-improvement proposer
(``backend/app/services/skill_proposer_service.py``):

  1. ``test_propose_emits_one_edit`` (D-03/D-04): driving ``propose`` over an
     assembled evidence bundle returns EXACTLY ONE ``SkillProposal`` with a non-empty
     ``proposed_instructions`` — one shot, one proposal.
  2. ``test_disagreement_is_top_cue`` (D-02): the judge-PASS × human-DOWN row (the U9
     fixture shape) lands in the ``disagreements`` partition AND renders BEFORE the plain
     failing/anchor cases in the DATA block (weighted as the top cue).
  3. ``test_bundle_includes_prompt_and_expected`` (D-02 join): the ``skill_test_cases``
     join lands — the rendered DATA string carries the case's ``prompt`` + ``expected_behavior``
     (not just the model output), proving the proposer sees WHAT the case asked.
  4. ``test_honest_none_when_no_builder_model`` (D-03 floor): when
     ``resolve_skill_builder_model`` returns None, ``propose`` returns None and NEVER
     calls the paid ``forced_emit`` — an honest floor, never a fabricated proposal.

No live LLM / no live DB: ``forced_emit`` + ``resolve_skill_builder_model`` are patched;
supabase is a small in-memory READ fake honoring the owner-scoped ``.eq``/``.in_``/``.limit``
chain the evidence assembly touches (the read sibling of ``test_eval_runner``'s recording fake).
"""
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from app.services import skill_proposer_service as sp
from app.services.skill_proposer_service import SkillProposal

OWNER = "00000000-0000-0000-0000-000000000001"
OTHER = "00000000-0000-0000-0000-000000000099"
SKILL_ID = str(uuid4())
SOURCE_RUN = str(uuid4())


# ── A tiny in-memory READ fake supabase (the read sibling of test_eval_runner's fake) ─
class _Result:
    def __init__(self, data):
        self.data = list(data)


class _Query:
    """One chainable read builder over a table's seeded rows, honoring the owner-scoped
    ``.select().eq().in_().order().limit().execute()`` surface the evidence reads touch.
    Column projection is ignored (the fake returns full rows) — the service reads keys off
    the returned dicts, so full rows are a strict superset."""

    def __init__(self, rows):
        self._rows = list(rows)

    def select(self, *a, **k):
        return self

    def eq(self, col, val):
        self._rows = [r for r in self._rows if str(r.get(col)) == str(val)]
        return self

    def in_(self, col, vals):
        wanted = {str(v) for v in vals}
        self._rows = [r for r in self._rows if str(r.get(col)) in wanted]
        return self

    def order(self, *a, **k):
        return self

    def limit(self, n):
        self._rows = self._rows[:n]
        return self

    def execute(self, *a, **k):
        return _Result(self._rows)


class _ReadSupabase:
    def __init__(self, tables):
        self._tables = tables

    def table(self, name):
        return _Query(self._tables.get(name, []))


# ── Row builders ────────────────────────────────────────────────────────────────
def _test_case(prompt, expected, *, name=None, user_id=OWNER):
    return {
        "id": str(uuid4()),
        "skill_id": SKILL_ID,
        "user_id": user_id,
        "prompt": prompt,
        "expected_behavior": expected,
        "name": name,
    }


def _with_result(
    test_case_id, *, verdict_state, verdict_passed, output="WITH output",
    reason="judge reason", user_id=OWNER,
):
    return {
        "id": str(uuid4()),
        "eval_run_id": SOURCE_RUN,
        "test_case_id": test_case_id,
        "user_id": user_id,
        "variant": "with_skill",
        "output": output,
        "status": "completed",
        "verdict_state": verdict_state,
        "verdict_passed": verdict_passed,
        "verdict_reason": reason,
    }


def _without_result(test_case_id, *, output="WITHOUT output", user_id=OWNER):
    return {
        "id": str(uuid4()),
        "eval_run_id": SOURCE_RUN,
        "test_case_id": test_case_id,
        "user_id": user_id,
        "variant": "without_skill",
        "output": output,
        "status": "completed",
        "verdict_state": "graded",
        "verdict_passed": False,
        "verdict_reason": "without-arm reason",
    }


def _rating(eval_result_id, rating, *, user_id=OWNER):
    return {"id": str(uuid4()), "eval_result_id": eval_result_id, "user_id": user_id, "rating": rating}


# ── Test 1: propose emits exactly one edit (D-03/D-04) ───────────────────────────
@pytest.mark.asyncio
async def test_propose_emits_one_edit():
    """A resolved builder model + a real evidence bundle yields exactly one SkillProposal
    with non-empty proposed_instructions (one shot = one proposal, D-04)."""
    tc = _test_case("Fix the failing case.", "Handles the edge case correctly.")
    supabase = _ReadSupabase({
        "eval_results": [
            _with_result(tc["id"], verdict_state="graded", verdict_passed=False),
            _without_result(tc["id"]),
        ],
        "skill_test_cases": [tc],
        "eval_ratings": [],
        "tuner_runs": [],
    })
    evidence = await sp.assemble_evidence(
        supabase, skill_id=SKILL_ID, source_run_id=SOURCE_RUN, user_id=OWNER,
        current_instructions="OLD BODY",
    )

    fake_emit = AsyncMock(return_value={
        "emitted": SkillProposal(
            proposed_instructions="NEW rewritten body.",
            rationale="Closes the failing case.",
            evidence_cited="the graded-fail case",
        ),
    })
    with patch.object(sp, "resolve_skill_builder_model", return_value="test-model"), \
            patch.object(sp, "forced_emit", fake_emit):
        result = await sp.propose(
            skill={"id": SKILL_ID}, base_version={"id": str(uuid4())},
            source_run_id=SOURCE_RUN, evidence=evidence, user_settings=SimpleNamespace(),
        )

    assert isinstance(result, SkillProposal), "propose returns a single SkillProposal"
    assert result.proposed_instructions.strip(), "the proposed instruction body is non-empty"
    fake_emit.assert_awaited_once()  # ONE forced shot = one proposal (D-04)


# ── Test 2: the disagreement row is the top cue (D-02 / U9) ───────────────────────
@pytest.mark.asyncio
async def test_disagreement_is_top_cue():
    """A judge-PASS × human-DOWN row (U9 shape) lands in the `disagreements` partition and
    renders BEFORE the plain failing case in the DATA block (weighted as the top cue)."""
    disagree_tc = _test_case("DISAGREE prompt marker", "expected for the disagreement case")
    fail_tc = _test_case("PLAINFAIL prompt marker", "expected for the plain failing case")

    disagree_with = _with_result(disagree_tc["id"], verdict_state="graded", verdict_passed=True)
    fail_with = _with_result(fail_tc["id"], verdict_state="graded", verdict_passed=False)

    supabase = _ReadSupabase({
        "eval_results": [disagree_with, fail_with],
        "skill_test_cases": [disagree_tc, fail_tc],
        # The human thumbs-DOWN on the judge-PASS answer = the disagreement (U9).
        "eval_ratings": [_rating(disagree_with["id"], "down")],
        "tuner_runs": [],
    })
    evidence = await sp.assemble_evidence(
        supabase, skill_id=SKILL_ID, source_run_id=SOURCE_RUN, user_id=OWNER,
        current_instructions="BODY",
    )

    # Partition: the disagreement row is in `disagreements` (NOT anchors — disjoint).
    assert len(evidence["disagreements"]) == 1
    assert evidence["disagreements"][0]["test_case_id"] == disagree_tc["id"]
    assert evidence["anchors"] == [], "a down-rated pass is a disagreement, not an anchor"
    assert len(evidence["failing"]) == 1

    # Render: the disagreement prompt appears BEFORE the plain failing prompt (top cue first).
    rendered = sp._render_evidence_as_data(evidence)
    assert rendered.index("DISAGREE prompt marker") < rendered.index("PLAINFAIL prompt marker")


# ── Test 3: the prompt/expected join lands in the bundle (D-02) ───────────────────
@pytest.mark.asyncio
async def test_bundle_includes_prompt_and_expected():
    """The skill_test_cases join carries each case's prompt + expected_behavior into the
    rendered DATA — proving the proposer sees WHAT the case asked, not just the output."""
    tc = _test_case("P1", "E1")
    supabase = _ReadSupabase({
        "eval_results": [
            _with_result(tc["id"], verdict_state="not_measured", verdict_passed=None,
                         output="some output text"),
            _without_result(tc["id"]),
        ],
        "skill_test_cases": [tc],
        "eval_ratings": [],
        "tuner_runs": [],
    })
    evidence = await sp.assemble_evidence(
        supabase, skill_id=SKILL_ID, source_run_id=SOURCE_RUN, user_id=OWNER,
        current_instructions="BODY",
    )
    rendered = sp._render_evidence_as_data(evidence)
    assert "P1" in rendered, "the seeded test-case prompt is woven into the DATA (D-02 join)"
    assert "E1" in rendered, "the seeded expected_behavior is woven into the DATA (D-02 join)"


# ── Test 4: honest None when no builder model resolves (D-03 floor) ───────────────
@pytest.mark.asyncio
async def test_honest_none_when_no_builder_model():
    """resolve_skill_builder_model -> None => propose returns None and NEVER calls the paid
    forced_emit (no fabricated proposal — the honest floor)."""
    fake_emit = AsyncMock()
    with patch.object(sp, "resolve_skill_builder_model", return_value=None), \
            patch.object(sp, "forced_emit", fake_emit):
        result = await sp.propose(
            skill={"id": SKILL_ID}, base_version={"id": str(uuid4())},
            source_run_id=SOURCE_RUN,
            evidence={"current_instructions": "BODY", "disagreements": [], "failing": [],
                      "anchors": [], "tuner": None},
            user_settings=SimpleNamespace(),
        )
    assert result is None, "no builder model => honest None (never fabricated)"
    fake_emit.assert_not_awaited()  # the paid forced shot is never made
