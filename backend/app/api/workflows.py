"""Phase 092 (MODE-01 / D-01) — published-workflows list endpoint for the picker.

There was NO workflows API router before this (RESEARCH A4 — only the engine
ran workflows, no live HTTP surface). This adds the single read the Harness-mode
picker needs: the list of published workflow definitions a user may kick off.

The endpoint is owner-scoped through ``list_published_workflows``' RLS-mirroring
WHERE clause (``status='published' AND (is_global OR created_by=user)``) — a user
never sees another user's unpublished or private definitions (T-092-07). The GET
itself is a pure read (no writes).
"""
from __future__ import annotations

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.dependencies import get_current_user, get_pg_pool
from app.db.workflows import list_published_workflows

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/workflows", tags=["workflows"])


class PublishedWorkflow(BaseModel):
    """A picker row — the minimum the Deep/Harness toggle needs to list and start
    a workflow (id to kick off via MessageCreate.workflow_definition_id; name +
    slug for display)."""

    id: UUID
    slug: str
    name: str


@router.get("/published", response_model=list[PublishedWorkflow])
async def get_published_workflows(
    project_folder_id: UUID | None = Query(None),
    current_user: dict = Depends(get_current_user),
) -> list[PublishedWorkflow]:
    """List the published workflow definitions the user may start (D-01 picker feed).

    Owner-scoped via the RLS-mirroring predicate in ``list_published_workflows``.
    Pure read — prefers the asyncpg pool for the scoped query.

    PROJECT BINDING (Phase 098 / PROJ-01, D-03): the optional ``project_folder_id``
    query param makes the library queryable per project — when present, only
    published definitions bound to that folder are returned. FastAPI coerces the
    raw query string to ``UUID`` before it reaches the DB layer (rejecting a
    malformed value with 422), and the db helper binds it as a positional
    parameter — never string-interpolated (T-098-10). Owner-scoping is preserved
    (it lives in the db-layer WHERE); the project filter can only narrow, never
    widen, the result (T-098-09). Omitting it returns the full published list
    unchanged (backward compatible).
    """
    pool = await get_pg_pool()
    user_id = current_user["id"]
    rows = await list_published_workflows(
        pool,
        user_id=UUID(user_id) if isinstance(user_id, str) else user_id,
        project_folder_id=project_folder_id,
    )
    return [PublishedWorkflow(**r) for r in rows]
