"""Phase 135 Plan 04 (SI-01) — proposal router owner-scoping / IDOR integration tests.

The self-improvement PROPOSAL control surface (POST propose / GET list+single / POST reject) is
the front half of the loop and the FIRST place a user's own instruction-body edit is drafted and
persisted, so the owner-scoping gate is load-bearing. All three tests drive the REAL FastAPI app
through the proposal routes with NO live DB and NO live provider — the ``skill_proposer_service``
is patched (``propose`` -> ``AsyncMock``; no paid builder call) and ``get_current_user`` /
``get_supabase`` are dependency-overridden with the in-memory filtering fake reused from
``test_evals_router`` (it honors ``.eq()`` / ``.in_()`` chains + insert/update/delete so the
owner-scoping 404 and the pure-audit reject are MEANINGFUL, not vacuous):

  1. ``test_propose_owner_can_draft`` (D-01/D-04/D-13): as OWNER, POST propose from a source run
     with results drafts a ``status='proposed'`` row AND the serialized response carries
     ``gate = null`` — proving the D-13 honest-counts field is DECLARED and not stripped by FastAPI.
  2. ``test_cross_user_404`` (T-135-01 IDOR): as OTHER_USER, propose / GET / reject against OWNER's
     skill + proposal each return 404 (never 403) AND neither IDOR write lands (no insert on
     propose, no status flip on reject).
  3. ``test_reject_is_pure_audit_via_route`` (D-10): reject flips the OWNER proposal to
     ``rejected`` and leaves ``skill_versions`` / ``skills`` untouched (no version row, no skills
     write — a pure audit).

Reuses ``_FilterSupabase`` / ``_override`` / ``_clear_overrides`` from ``test_evals_router`` so the
fake store semantics stay identical to the sibling eval-router tests.
"""
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import httpx
import pytest
from httpx import ASGITransport

import app.models.user_settings as user_settings_mod
from app.dependencies import get_current_user, get_supabase
from app.services import skill_proposer_service
from app.services.skill_proposer_service import SkillProposal
from tests.test_evals_router import _FilterSupabase, _clear_overrides, _override

OWNER = {"id": "00000000-0000-0000-0000-000000000001", "email": "owner@example.com"}
OTHER_USER = {"id": "00000000-0000-0000-0000-000000000099", "email": "other@example.com"}

_H = {"Authorization": "Bearer test"}


def _seed(*, proposal_status=None, proposal_id=None):
    """Build an in-memory store: a skill + its base version + a completed source run (with one
    result) owned by OWNER — the minimum the propose route reads. Optionally seed ONE OWNER
    proposal row (for the get / reject / cross-user paths). Returns (store, ids)."""
    skill_id = str(uuid4())
    version_id = str(uuid4())
    source_run_id = str(uuid4())
    store = {
        "skills": [
            {"id": skill_id, "name": "S", "description": "d", "user_id": OWNER["id"]}
        ],
        "skill_versions": [
            {
                "id": version_id,
                "skill_id": skill_id,
                "user_id": OWNER["id"],
                "instructions": "BASE INSTRUCTIONS",
                "name": "S",
                "description": "d",
                "version_number": 1,
            }
        ],
        "eval_runs": [
            {
                "id": source_run_id,
                "skill_id": skill_id,
                "skill_version_id": version_id,
                "user_id": OWNER["id"],
                "status": "completed",
            }
        ],
        "eval_results": [
            {
                "id": str(uuid4()),
                "eval_run_id": source_run_id,
                "test_case_id": str(uuid4()),
                "user_id": OWNER["id"],
                "variant": "with_skill",
                "output": "an answer",
                "status": "completed",
                "verdict_state": "graded",
                "verdict_passed": False,
                "verdict_reason": "did not meet the bar",
            }
        ],
        # assemble_evidence reads these too — present-but-empty so the real service runs cleanly.
        "skill_test_cases": [],
        "eval_ratings": [],
        "tuner_runs": [],
        "skill_proposals": [],
    }
    if proposal_status is not None:
        pid = proposal_id or str(uuid4())
        store["skill_proposals"].append(
            {
                "id": pid,
                "skill_id": skill_id,
                "base_skill_version_id": version_id,
                "new_skill_version_id": None,
                "re_eval_run_id": None,
                "source_eval_run_id": source_run_id,
                "user_id": OWNER["id"],
                "proposed_instructions": "PROPOSED BODY",
                "rationale": "r",
                "evidence_summary": "e",
                "status": proposal_status,
                "override_forced": False,
                "created_at": "2026-07-02T00:00:00Z",
                "updated_at": "2026-07-02T00:00:00Z",
            }
        )
    return store, SimpleNamespace(
        skill_id=skill_id, version_id=version_id, source_run_id=source_run_id
    )


def _patch_service(monkeypatch):
    """No live LLM / no live settings DB: force ``propose`` to a fixed proposal and stub
    ``load_user_settings`` (the route loads it only to pass through to the patched proposer)."""
    fake = SkillProposal(
        proposed_instructions="NEW BODY", rationale="why", evidence_cited="cases 1,2"
    )
    monkeypatch.setattr(skill_proposer_service, "propose", AsyncMock(return_value=fake))
    monkeypatch.setattr(
        user_settings_mod, "load_user_settings", lambda uid, *a, **k: SimpleNamespace()
    )


@pytest.mark.asyncio
async def test_propose_owner_can_draft(monkeypatch):
    """D-01/D-04/D-13: OWNER drafts ONE proposal from a source run with results; the response is a
    ``proposed`` row whose serialized ``gate`` is null (the field survives serialization)."""
    from app.main import app

    store, ids = _seed()
    sb = _FilterSupabase(store)
    _patch_service(monkeypatch)

    _override(app, user=OWNER, supabase=sb)
    try:
        async with httpx.AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as c:
            resp = await c.post(
                f"/skills/{ids.skill_id}/proposals",
                json={"source_eval_run_id": ids.source_run_id},
                headers=_H,
            )
    finally:
        _clear_overrides(app)

    assert resp.status_code == 200, f"propose {resp.status_code}: {resp.text}"
    body = resp.json()
    assert body["status"] == "proposed"
    assert body["proposed_instructions"] == "NEW BODY"
    # base_instructions is hydrated from the base version (for the diff) — not a stored column.
    assert body["base_instructions"] == "BASE INSTRUCTIONS"
    # D-13: the gate honest-counts field is DECLARED on the response model, so it is present and
    # serialized as null (no re-eval has reconciled yet) — NOT silently stripped by FastAPI.
    assert "gate" in body and body["gate"] is None, "gate must be declared + serialized as null"
    # A durable proposed row landed via the service-role insert.
    proposals = sb.store.get("skill_proposals", [])
    assert len(proposals) == 1 and proposals[0]["status"] == "proposed"
    assert proposals[0]["user_id"] == OWNER["id"]


@pytest.mark.asyncio
async def test_cross_user_404(monkeypatch):
    """T-135-01 (IDOR): OTHER_USER propose / GET / reject against OWNER's skill + proposal each
    return 404 (never 403), and NO IDOR write lands (no insert on propose, no flip on reject)."""
    from app.main import app

    pid = str(uuid4())
    store, ids = _seed(proposal_status="proposed", proposal_id=pid)
    sb = _FilterSupabase(store)
    _patch_service(monkeypatch)

    _override(app, user=OTHER_USER, supabase=sb)
    try:
        async with httpx.AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as c:
            # propose against OWNER's skill -> 404 (skill not owned; blocked before any evidence read)
            propose_resp = await c.post(
                f"/skills/{ids.skill_id}/proposals",
                json={"source_eval_run_id": ids.source_run_id},
                headers=_H,
            )
            # GET OWNER's proposal -> 404 (never 403)
            get_resp = await c.get(f"/skills/{ids.skill_id}/proposals/{pid}", headers=_H)
            # reject OWNER's proposal -> 404 (never 403)
            reject_resp = await c.post(
                f"/skills/{ids.skill_id}/proposals/{pid}/reject", headers=_H
            )
    finally:
        _clear_overrides(app)

    assert propose_resp.status_code == 404, f"cross-user propose {propose_resp.status_code}"
    assert get_resp.status_code == 404, f"cross-user get {get_resp.status_code}"
    assert reject_resp.status_code == 404, f"cross-user reject {reject_resp.status_code}"

    # The IDOR writes never landed: propose inserted nothing, reject did NOT flip the OWNER row.
    proposals = sb.store.get("skill_proposals", [])
    assert len(proposals) == 1, "cross-user propose must NOT insert a row"
    assert proposals[0]["status"] == "proposed", "cross-user reject must NOT flip status"
    assert proposals[0]["user_id"] == OWNER["id"]


@pytest.mark.asyncio
async def test_reject_is_pure_audit_via_route(monkeypatch):
    """D-10: reject flips the OWNER proposal to 'rejected' and leaves skill_versions / skills
    untouched — a pure audit (no version row, no skills write)."""
    from app.main import app

    pid = str(uuid4())
    store, ids = _seed(proposal_status="proposed", proposal_id=pid)
    sb = _FilterSupabase(store)
    _patch_service(monkeypatch)

    versions_before = len(sb.store.get("skill_versions", []))
    skills_before = [dict(s) for s in sb.store.get("skills", [])]

    _override(app, user=OWNER, supabase=sb)
    try:
        async with httpx.AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as c:
            resp = await c.post(
                f"/skills/{ids.skill_id}/proposals/{pid}/reject", headers=_H
            )
    finally:
        _clear_overrides(app)

    assert resp.status_code == 200, f"reject {resp.status_code}: {resp.text}"
    assert resp.json()["status"] == "rejected"
    # The ONE proposal flipped in place — pure audit.
    proposals = sb.store.get("skill_proposals", [])
    assert len(proposals) == 1 and proposals[0]["status"] == "rejected"
    # No version row was written and skills was not touched (D-10).
    assert len(sb.store.get("skill_versions", [])) == versions_before, "reject must NOT add a version"
    assert [dict(s) for s in sb.store.get("skills", [])] == skills_before, "reject must NOT write skills"
