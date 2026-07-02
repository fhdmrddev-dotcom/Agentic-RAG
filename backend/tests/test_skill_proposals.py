"""Phase 135 Plan 05 (SI-01) — the approval / promotion / force / interrupted LIFECYCLE (service-level).

These tests drive the Plan-05 route functions DIRECTLY (no httpx / no live DB / no live LLM) over the
in-memory ``_FilterSupabase`` fake reused from ``test_evals_router`` (it honors ``.eq()`` / ``.in_()``
chains + insert/update so the owner-scoping, the version INSERT, and the single promotion write are
MEANINGFUL, not vacuous). The async re-eval launch (``_launch_reeval`` — Redis SET NX + companion
runs row + ``run_eval_job`` spawn) is patched to an ``AsyncMock`` so the lifecycle assertions stay
deterministic (the launch machinery itself is exercised by the router integration + the Task-1 source
assertion). The gate math is covered exhaustively by ``test_promotion_gate.py``.

  * ``test_approve_creates_self_improve_version`` (D-05): approve INSERTs a ``source='self_improve'``
    draft version and does NOT touch the live ``skills`` row; the proposal transitions to
    ``re_evaling`` with the draft + re-eval linked, and the re-eval is launched on the SOURCE run's
    provider/model with the draft override (D-11 / Pitfall #1).
  * ``test_reject_is_pure_audit`` (D-10): reject flips status to ``rejected`` with NO version / skills
    write.
  * ``test_promotion_paths`` (D-13): a passing gate promotes (``skills.instructions`` updated +
    ``status='promoted'`` + ``gate.passed=True``); a failing gate does NOT promote (``skills``
    untouched + ``status='not_promoted'`` + ``gate.passed=False``) — the honest counts render on BOTH
    terminal states.
  * ``test_force_promote_records_override`` (D-06): force-promote a ``not_promoted`` proposal records
    ``override_forced=true`` + ``status='promoted'`` + applies the live-skill write + carries the
    FAILED gate counts; only from a ``not_promoted`` starting state (409 otherwise).
  * ``test_interrupted_state`` (D-14): a terminal-but-not-completed re-eval reconciles to
    ``interrupted`` with ``gate=None``, and rerun re-launches against the EXISTING draft version.
"""
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException

from tests.test_evals_router import _FilterSupabase

OWNER = {"id": "00000000-0000-0000-0000-000000000001", "email": "owner@example.com"}


def _result(run_id, tc, passed, *, variant="with_skill", state="graded"):
    """One ``eval_results`` row the gate reads (with_skill / graded by default)."""
    return {
        "id": str(uuid4()),
        "eval_run_id": run_id,
        "test_case_id": tc,
        "user_id": OWNER["id"],
        "variant": variant,
        "verdict_state": state,
        "verdict_passed": passed,
    }


def _make(
    *,
    proposal_status="proposed",
    draft=False,
    re_eval_status=None,
    source_verdicts=None,
    reeval_verdicts=None,
    override_forced=False,
):
    """Build an in-memory store: a skill (live instructions) + its base version + a completed source
    run + owner test cases + ONE proposal. Optionally a self_improve draft version and a re-eval run
    (with graded results) for the reconcile / promotion / interrupted paths. Returns (store, ids)."""
    skill_id = str(uuid4())
    base_version_id = str(uuid4())
    source_run_id = str(uuid4())
    proposal_id = str(uuid4())
    draft_version_id = str(uuid4()) if draft else None
    re_eval_run_id = str(uuid4()) if re_eval_status else None

    store = {
        "skills": [{
            "id": skill_id, "name": "pdf-builder", "description": "d",
            "instructions": "LIVE INSTRUCTIONS", "user_id": OWNER["id"],
        }],
        "skill_versions": [{
            "id": base_version_id, "skill_id": skill_id, "user_id": OWNER["id"],
            "version_number": 1, "name": "pdf-builder", "description": "d",
            "instructions": "BASE INSTRUCTIONS", "source": "manual",
        }],
        "skill_test_cases": [{
            "id": str(uuid4()), "skill_id": skill_id, "user_id": OWNER["id"],
            "prompt": "Make a PDF", "expected_behavior": "makes a pdf", "order_index": 0,
        }],
        "eval_runs": [{
            "id": source_run_id, "skill_id": skill_id, "skill_version_id": base_version_id,
            "user_id": OWNER["id"], "provider": "anthropic",
            "model": "claude-haiku-4-5-20251001", "status": "completed",
        }],
        "eval_results": [],
        "skill_proposals": [{
            "id": proposal_id, "skill_id": skill_id, "base_skill_version_id": base_version_id,
            "new_skill_version_id": draft_version_id, "re_eval_run_id": re_eval_run_id,
            "source_eval_run_id": source_run_id, "user_id": OWNER["id"],
            "proposed_instructions": "PROPOSED BODY", "rationale": "r", "evidence_summary": "e",
            "status": proposal_status, "override_forced": override_forced,
            "created_at": "2026-07-02T00:00:00Z", "updated_at": "2026-07-02T00:00:00Z",
        }],
    }
    for tc, passed in (source_verdicts or []):
        store["eval_results"].append(_result(source_run_id, tc, passed))
    if draft:
        store["skill_versions"].append({
            "id": draft_version_id, "skill_id": skill_id, "user_id": OWNER["id"],
            "version_number": 2, "name": "pdf-builder", "description": "d",
            "instructions": "PROPOSED BODY", "source": "self_improve",
        })
    if re_eval_status:
        store["eval_runs"].append({
            "id": re_eval_run_id, "skill_id": skill_id, "skill_version_id": draft_version_id,
            "user_id": OWNER["id"], "provider": "anthropic",
            "model": "claude-haiku-4-5-20251001", "status": re_eval_status,
        })
        for tc, passed in (reeval_verdicts or []):
            store["eval_results"].append(_result(re_eval_run_id, tc, passed))

    return store, SimpleNamespace(
        skill_id=skill_id, base_version_id=base_version_id, source_run_id=source_run_id,
        proposal_id=proposal_id, draft_version_id=draft_version_id, re_eval_run_id=re_eval_run_id,
    )


@pytest.mark.asyncio
async def test_approve_creates_self_improve_version(monkeypatch):
    """D-05: approve INSERTs a self_improve draft WITHOUT touching the live skill, transitions to
    re_evaling, and launches the re-eval on the SOURCE run's provider/model with the draft override."""
    from app.api import evals

    store, ids = _make(proposal_status="proposed")
    sb = _FilterSupabase(store)
    launch = AsyncMock(return_value=uuid4())
    monkeypatch.setattr(evals, "_launch_reeval", launch)

    versions_before = len(store["skill_versions"])
    result = await evals.approve_skill_proposal(
        ids.skill_id, UUID(ids.proposal_id),
        current_user=OWNER, supabase=sb, redis=object(), pool=object(),
    )

    # A self_improve draft version was INSERTed (WITHOUT a live-skill write — D-05).
    versions = store["skill_versions"]
    assert len(versions) == versions_before + 1
    draft = [v for v in versions if v.get("source") == "self_improve"]
    assert len(draft) == 1 and draft[0]["instructions"] == "PROPOSED BODY"
    assert draft[0]["version_number"] == 2  # COALESCE(MAX)+1
    # The live skills row is UNTOUCHED at approve time (no promotion yet — D-05).
    assert store["skills"][0]["instructions"] == "LIVE INSTRUCTIONS"
    # The proposal transitioned to 're_evaling' with the draft + re-eval linked.
    prop = store["skill_proposals"][0]
    assert prop["status"] == "re_evaling"
    assert prop["new_skill_version_id"] == draft[0]["id"]
    assert prop["re_eval_run_id"] is not None
    # The re-eval launched with the draft override on the SOURCE run's provider/model (D-11 / Pitfall #1).
    assert launch.await_count == 1
    kwargs = launch.await_args.kwargs
    assert kwargs["provider"] == "anthropic" and kwargs["model"] == "claude-haiku-4-5-20251001"
    assert kwargs["proposed_instructions"] == "PROPOSED BODY"
    # The response echoes the reconciled proposal + run id.
    assert result["proposal"].status == "re_evaling"
    assert result["re_eval_run_id"]


@pytest.mark.asyncio
async def test_reject_is_pure_audit():
    """D-10: reject flips status to 'rejected' with NO version row and NO skills write."""
    from app.api import evals

    store, ids = _make(proposal_status="proposed")
    sb = _FilterSupabase(store)
    versions_before = len(store["skill_versions"])
    skills_before = [dict(s) for s in store["skills"]]

    resp = await evals.reject_skill_proposal(
        ids.skill_id, UUID(ids.proposal_id), current_user=OWNER, supabase=sb,
    )

    assert resp.status == "rejected"
    assert store["skill_proposals"][0]["status"] == "rejected"
    assert len(store["skill_versions"]) == versions_before  # no version row (D-10)
    assert [dict(s) for s in store["skills"]] == skills_before  # skills untouched


@pytest.mark.asyncio
async def test_promotion_paths():
    """D-13: a passing gate promotes (skills updated + status='promoted' + gate.passed=True); a
    failing gate does NOT promote (skills untouched + status='not_promoted' + gate.passed=False) —
    the honest counts render on BOTH terminal states (recompute-on-read)."""
    from app.api import evals

    tc1, tc2 = str(uuid4()), str(uuid4())

    # PASS: tc1 prev-pass stays pass, tc2 prev-fail now passes -> gate passes -> promote.
    store, ids = _make(
        proposal_status="re_evaling", draft=True, re_eval_status="completed",
        source_verdicts=[(tc1, True), (tc2, False)],
        reeval_verdicts=[(tc1, True), (tc2, True)],
    )
    sb = _FilterSupabase(store)
    resp = await evals.get_skill_proposal(
        ids.skill_id, UUID(ids.proposal_id), current_user=OWNER, supabase=sb, redis=object(),
    )
    assert resp.status == "promoted"
    assert resp.gate is not None and resp.gate.passed is True
    assert resp.gate.newly_pass == 1 and resp.gate.still_pass == 1
    # The live skill was updated to the proposed body — the SINGLE promotion write (only on pass).
    assert store["skills"][0]["instructions"] == "PROPOSED BODY"

    # FAIL: tc2 still fails -> no improvement -> not_promoted -> skills untouched.
    store2, ids2 = _make(
        proposal_status="re_evaling", draft=True, re_eval_status="completed",
        source_verdicts=[(tc1, True), (tc2, False)],
        reeval_verdicts=[(tc1, True), (tc2, False)],
    )
    sb2 = _FilterSupabase(store2)
    resp2 = await evals.get_skill_proposal(
        ids2.skill_id, UUID(ids2.proposal_id), current_user=OWNER, supabase=sb2, redis=object(),
    )
    assert resp2.status == "not_promoted"
    assert resp2.gate is not None and resp2.gate.passed is False  # honest counts on not_promoted too
    assert store2["skills"][0]["instructions"] == "LIVE INSTRUCTIONS"  # NOT promoted


@pytest.mark.asyncio
async def test_force_promote_records_override():
    """D-06: force-promote a not_promoted proposal records override_forced=true + status='promoted'
    + applies the live-skill write + carries the FAILED gate counts; only from a not_promoted state."""
    from app.api import evals
    from app.models.eval_run import ForcePromoteBody

    tc1 = str(uuid4())
    # A not_promoted proposal with a completed (FAILING — regression) re-eval.
    store, ids = _make(
        proposal_status="not_promoted", draft=True, re_eval_status="completed",
        source_verdicts=[(tc1, True)], reeval_verdicts=[(tc1, False)],
    )
    sb = _FilterSupabase(store)

    resp = await evals.force_promote_skill_proposal(
        ids.skill_id, UUID(ids.proposal_id), ForcePromoteBody(),
        current_user=OWNER, supabase=sb,
    )
    assert resp.status == "promoted"
    assert resp.override_forced is True
    assert store["skills"][0]["instructions"] == "PROPOSED BODY"  # the override applied the write
    # The FAILED honest counts still render at the moment of override (D-06 + D-13 always displayed).
    assert resp.gate is not None and resp.gate.passed is False
    assert store["skill_proposals"][0]["override_forced"] is True
    assert store["skill_proposals"][0]["status"] == "promoted"

    # Force-promote is ONLY allowed from a not_promoted starting state (409 otherwise).
    store2, ids2 = _make(proposal_status="promoted", draft=True)
    sb2 = _FilterSupabase(store2)
    with pytest.raises(HTTPException) as exc:
        await evals.force_promote_skill_proposal(
            ids2.skill_id, UUID(ids2.proposal_id), ForcePromoteBody(),
            current_user=OWNER, supabase=sb2,
        )
    assert exc.value.status_code == 409


@pytest.mark.asyncio
async def test_interrupted_state(monkeypatch):
    """D-14: a terminal-but-not-completed re-eval reconciles to 'interrupted' with gate=None, and
    rerun re-launches against the EXISTING draft version (never leaves it stuck 're_evaling')."""
    from app.api import evals

    tc1 = str(uuid4())
    # A re_evaling proposal whose re-eval FAILED (terminal-but-not-completed) -> interrupted on read.
    store, ids = _make(
        proposal_status="re_evaling", draft=True, re_eval_status="failed",
        source_verdicts=[(tc1, False)],
    )
    sb = _FilterSupabase(store)

    resp = await evals.get_skill_proposal(
        ids.skill_id, UUID(ids.proposal_id), current_user=OWNER, supabase=sb, redis=object(),
    )
    assert resp.status == "interrupted"
    assert resp.gate is None  # nothing to display honestly on an interrupted re-eval
    assert store["skill_proposals"][0]["status"] == "interrupted"

    # rerun re-launches against the EXISTING draft version -> back to re_evaling with a new run id.
    new_run = uuid4()
    launch = AsyncMock(return_value=new_run)
    monkeypatch.setattr(evals, "_launch_reeval", launch)

    rerun_resp = await evals.rerun_skill_proposal(
        ids.skill_id, UUID(ids.proposal_id),
        current_user=OWNER, supabase=sb, redis=object(), pool=object(),
    )
    assert rerun_resp["proposal"].status == "re_evaling"
    assert rerun_resp["re_eval_run_id"] == str(new_run)
    assert store["skill_proposals"][0]["status"] == "re_evaling"
    assert store["skill_proposals"][0]["re_eval_run_id"] == str(new_run)
    # rerun launched against the EXISTING draft (no NEW version insert).
    assert launch.await_args.kwargs["draft_version"]["id"] == ids.draft_version_id
    assert len([v for v in store["skill_versions"] if v.get("source") == "self_improve"]) == 1
