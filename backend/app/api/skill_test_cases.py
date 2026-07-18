"""Phase 132 Plan 02 (EVAL-01 / VER-01) — owner-scoped eval test-case CRUD + read-only
version history.

This net-new router (it touches NO G-5 hot file) exposes the persistence foundation that
Plan 01 built:

  GET    /skills/{skill_id}/test-cases   list cases (owner-scoped, order_index ASC)
  POST   /skills/{skill_id}/test-cases   create a case (parent skill must be owned)
  PATCH  /test-cases/{case_id}           edit prompt/expected_behavior/order_index/name
  DELETE /test-cases/{case_id}           delete a case
  GET    /skills/{skill_id}/versions     list version history (version_number DESC, READ-ONLY)

OWNER-SCOPING IS THE SOLE RUNTIME GATE (T-132-06/07/08): ``get_supabase()`` is the
SERVICE-ROLE client, which BYPASSES RLS — so the app-code ``.eq("user_id", current_user["id"])``
on EVERY query is the only thing standing between user A and user B's cases/versions. A missing
filter is a silent full-table leak. A non-matching id returns 404 (never 403 — don't leak
existence). For POST, ``user_id``/``skill_id`` are sourced from the authenticated caller + the
path, NEVER the request body (a forged body id is ignored, T-132-07), and the parent skill must
be owned by the caller before a case is inserted.

Version history is the AUTHOR'S PRIVATE artifact (D-12 / T-132-08): the versions GET filters on
``user_id`` so a consumer of a global skill (who is not the author) gets an empty list, never the
author's history. Versions are trigger-created + immutable (Plan 01), so there is NO write route
for ``/versions``.

CONVENTION (RESEARCH A3 / D-PRD-01): mirrors ``skills.py`` exactly — the SYNC supabase client is
called inline inside the async handlers (no ``run_in_threadpool``). This is ACCEPTED prevailing
tech-debt for this phase; the holistic ``run_in_threadpool`` backfill across all routers is
tracked as SEED-097 (do NOT diverge this one router).
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client

from app.dependencies import get_current_user, get_supabase, require_visible
from app.models.skill_test_case import TestCaseCreate, TestCaseResponse, TestCaseUpdate
from app.models.skill_version import SkillVersionResponse

logger = logging.getLogger(__name__)

# No shared prefix — the routes span /skills/{id}/... and /test-cases/{id}; each declares its
# full path.
# Phase 148 (VIS-01) — eval test-case CRUD + version history is a Skill Studio surface
# (Operators-only). Gate the whole router (every endpoint) so a non-operator is refused
# server-side (403 — D-03). No carve-out. require_visible is a no-op for operators + Everyone
# features (is_operator is the ONE swappable audience boundary).
router = APIRouter(
    tags=["skill-test-cases"],
    dependencies=[Depends(require_visible("skill_studio"))],
)


def _verify_owned_skill(supabase: Client, skill_id: str, user_id: str) -> None:
    """Raise 404 unless ``skill_id`` exists AND is owned by ``user_id``.

    The owner gate for the create path: a user can only author eval cases against a skill they
    OWN. ``get_supabase`` is service-role (RLS bypassed), so this ``.eq("user_id", …)`` is the
    real gate. 404 (never 403) on a miss so a cross-user skill's existence is not leaked."""
    result = (
        supabase.table("skills")
        .select("id")
        .eq("id", skill_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Skill not found")


@router.get("/skills/{skill_id}/test-cases", response_model=list[TestCaseResponse])
async def list_test_cases(
    skill_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """List a skill's test cases (owner-scoped, ordered by ``order_index`` ascending)."""
    result = (
        supabase.table("skill_test_cases")
        .select("*")
        .eq("skill_id", skill_id)
        .eq("user_id", current_user["id"])
        .order("order_index")
        .execute()
    )
    return result.data or []


@router.post(
    "/skills/{skill_id}/test-cases",
    response_model=TestCaseResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_test_case(
    skill_id: str,
    body: TestCaseCreate,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """Create a test case bound to ``skill_id``. ``user_id``/``skill_id`` come from the caller +
    path (NEVER the body, T-132-07); the parent skill must be owned (404 otherwise)."""
    _verify_owned_skill(supabase, skill_id, current_user["id"])

    result = (
        supabase.table("skill_test_cases")
        .insert({
            "skill_id": skill_id,
            "user_id": current_user["id"],
            "prompt": body.prompt,
            "expected_behavior": body.expected_behavior,
            "order_index": body.order_index,
            "name": body.name,
        })
        .execute()
    )
    if not result.data:
        # Should not happen on a successful insert; guard so we never return a malformed body.
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create test case",
        )
    return result.data[0]


@router.patch("/test-cases/{case_id}", response_model=TestCaseResponse)
async def update_test_case(
    case_id: str,
    body: TestCaseUpdate,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """Edit a test case (only the supplied fields). Owner-scoped: a non-owned/unknown id → 404."""
    update_data = body.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = (
        supabase.table("skill_test_cases")
        .update(update_data)
        .eq("id", case_id)
        .eq("user_id", current_user["id"])
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Test case not found")
    return result.data[0]


@router.delete("/test-cases/{case_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_test_case(
    case_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """Delete a test case. Owner-scoped: a non-owned/unknown id → 404 (the delete matches
    nothing under the ``.eq("user_id", …)`` filter)."""
    result = (
        supabase.table("skill_test_cases")
        .delete()
        .eq("id", case_id)
        .eq("user_id", current_user["id"])
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Test case not found")


@router.get("/skills/{skill_id}/versions", response_model=list[SkillVersionResponse])
async def list_skill_versions(
    skill_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """List a skill's immutable version history (newest first), owner-scoped (READ-ONLY).

    Version history is author-private (D-12 / T-132-08): the ``.eq("user_id", …)`` filter means a
    consumer of a global skill (not the author) gets an empty list, never the author's history.
    There is NO write route — versions are trigger-created + immutable (Plan 01)."""
    result = (
        supabase.table("skill_versions")
        .select("*")
        .eq("skill_id", skill_id)
        .eq("user_id", current_user["id"])
        .order("version_number", desc=True)
        .execute()
    )
    return result.data or []
