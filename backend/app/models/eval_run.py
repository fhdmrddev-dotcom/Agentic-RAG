"""Phase 133 Plan 01 (EVAL-02) — Pydantic contracts for the eval runner.

Mirrors the ``public.eval_runs`` / ``public.eval_results`` columns from migration 080
(``supabase/migrations/080_eval_runs_and_results.sql``).

A run is single-provider/single-model (D-01): ``provider``/``model`` live on the run.
Results carry ``provider``/``model`` too (D-02 — provider-keyed even though the run is
single-provider) and a ``with_skill``/``without_skill`` ``variant`` discriminator (D-04).

All fields are FLAT single-typed (``str | None`` / ``int | None`` / ``datetime | None``) —
never a multi-type list union, which trips the Gemini JSON-Schema ``type: [...]`` trap.
``user_id``/``skill_id`` come from the path + authenticated caller, NEVER a request body
(T-132-07 — a forged body id is ignored).
"""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class StartEvalRunBody(BaseModel):
    """POST body — start an eval run. ``skill_id`` comes from the path and ``user_id`` from
    the authenticated caller, NEVER the body (T-132-07). One provider/model per run (D-01)."""

    provider: str
    model: str


class EvalRunResponse(BaseModel):
    """Full ``public.eval_runs`` row shape returned by the run routes."""

    id: UUID
    skill_id: UUID
    skill_version_id: UUID
    user_id: UUID
    provider: str
    model: str
    status: str
    case_count: int
    error: str | None
    created_at: datetime
    completed_at: datetime | None


class EvalResultResponse(BaseModel):
    """Full ``public.eval_results`` row shape returned by the result routes."""

    id: UUID
    eval_run_id: UUID
    test_case_id: UUID
    user_id: UUID
    variant: str
    provider: str
    model: str
    output: str
    status: str
    error: str | None
    input_tokens: int | None
    output_tokens: int | None
    created_at: datetime
