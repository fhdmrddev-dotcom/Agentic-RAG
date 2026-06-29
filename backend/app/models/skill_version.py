"""Phase 132 Plan 02 (VER-01) — Pydantic contract for read-only skill version history.

Mirrors the ``public.skill_versions`` columns from migration 079
(``supabase/migrations/079_skill_versions_and_test_cases.sql``). Versions are
trigger-created and IMMUTABLE (append-only, BEFORE UPDATE block trigger raising
23514), so there is NO create/update model — only a read response.

There is no ``updated_at`` column (append-only). ``source`` is one of
``manual``/``import``/``tuner``/``self_improve``/``backfill`` (DB CHECK), surfaced
here as a plain ``str``.
"""
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class SkillVersionResponse(BaseModel):
    """One immutable version-history row (read-only — versions are captured by the
    Plan 01 ``capture_skill_version()`` trigger, never written by app code)."""

    id: UUID
    skill_id: UUID
    user_id: UUID
    version_number: int
    name: str
    description: str
    instructions: str
    source: str
    created_at: datetime
