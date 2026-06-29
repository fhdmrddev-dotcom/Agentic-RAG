"""Phase 132 Plan 02 (EVAL-01) — Pydantic contracts for the eval test-case CRUD surface.

Mirrors the ``public.skill_test_cases`` columns from migration 079
(``supabase/migrations/079_skill_versions_and_test_cases.sql``):

  id, skill_id, user_id, prompt, expected_behavior, order_index, name,
  created_at, updated_at.

``expected_behavior`` is FREE TEXT, never an assertion (D-06); there are NO
provider/model columns on the table OR these models (D-08). Test cases bind to the
SKILL via ``skill_id`` (not a version), so they stay freely editable before any
run (D-07).
"""
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class TestCaseCreate(BaseModel):
    """POST body — create a test case. ``skill_id``/``user_id`` come from the path +
    authenticated caller, NEVER the body (T-132-07 — a forged body id is ignored)."""

    prompt: str
    expected_behavior: str = ""
    order_index: int = 0
    name: str | None = None


class TestCaseUpdate(BaseModel):
    """PATCH body — all fields optional so only the supplied fields are edited
    (``model_dump(exclude_none=True)`` on the route). No provider/model fields (D-08)."""

    prompt: str | None = None
    expected_behavior: str | None = None
    order_index: int | None = None
    name: str | None = None


class TestCaseResponse(BaseModel):
    """Full row shape returned by every test-case route."""

    id: UUID
    skill_id: UUID
    user_id: UUID
    prompt: str
    expected_behavior: str
    order_index: int
    name: str | None
    created_at: datetime
    updated_at: datetime
