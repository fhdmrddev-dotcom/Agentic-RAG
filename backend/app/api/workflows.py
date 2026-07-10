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

import asyncpg
import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.config import settings
from app.dependencies import get_current_user, get_pg_pool, get_redis, get_supabase
from app.db.workflows import (
    create_workflow_definition,
    delete_workflow_definition,
    list_draft_workflows,
    list_published_workflows,
    list_starter_workflows,
    update_workflow_definition,
)
from app.models.harness import WorkflowDefinition
# Phase 102 (D-07) / Phase 103 (REQ-2): imported as MODULES so the route's delegate
# stays patchable in tests (mirrors the threads.py module-import-for-patchability
# discipline). NEVER import the orchestration fns by name — patch the module attr.
from app.services import workflow_authoring
from app.services.harness import publish_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/workflows", tags=["workflows"])


def _coerce_definition(raw: object) -> dict | None:
    """Decode the ``definition`` JSONB column to a dict for the wire.

    asyncpg returns the JSONB column as a raw JSON string when no pool codec is
    registered (db/workflows.py:278) — mirror publish_service's defensive decode
    (:103-109): a string is ``json.loads``-ed, a dict passes through, anything
    unparseable degrades to ``None`` (the client tolerates a missing definition).
    """
    if raw is None:
        return None
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        try:
            import json

            decoded = json.loads(raw)
            return decoded if isinstance(decoded, dict) else None
        except (ValueError, TypeError):
            return None
    return None


class PublishedWorkflow(BaseModel):
    """A picker row — the minimum the Deep/Harness toggle needs to list and start
    a workflow (id to kick off via MessageCreate.workflow_definition_id; name +
    slug for display).

    Phase 103-06 (REQ-7 D9/D10): ``definition`` is ADDITIVE — the Workflows page
    card derives its client-side strictness tier + phase chain from the real
    definition JSONB. It is optional so the pre-103 picker callers (the composer
    Harness dropdown) keep validating against the id/slug/name shape unchanged."""

    id: UUID
    slug: str
    name: str
    definition: dict | None = None


# ── Phase 103 (REQ-1 / WFAUTH-01) — draft CRUD response shapes ────────────────
class DraftCreateResponse(BaseModel):
    """The create/PATCH return — the new (or updated) draft id + its version."""

    id: UUID
    version: int


class DraftRow(BaseModel):
    """A drafts-shelf row (the caller's own drafts — D-103-4).

    Phase 103-06 (REQ-7 D9/D10): ``definition`` is ADDITIVE so the drafts-shelf
    card can derive the tier badge + phase chain client-side; optional to keep the
    pre-103 id/slug/version/name shelf shape valid."""

    id: UUID
    slug: str
    version: int
    name: str | None = None
    definition: dict | None = None


@router.get("/published", response_model=list[PublishedWorkflow])
async def get_published_workflows(
    project_folder_id: UUID | None = None,
    scope: str | None = None,
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

    SCOPED SHELF (Phase 143 / WF-01, D-143-2a): the optional ``scope`` query param
    threads ``owned_only=(scope == "mine")`` into the db helper. The Workflows-page
    Published shelf passes ``?scope=mine`` to see ONLY the caller's own published
    rows (the curated globals now live in the Starters shelf — no double-render);
    ANY other value (including omitting it — the composer picker / run-soul default)
    keeps ``owned_only=False`` so the global rows still appear. The comparison is a
    pure-Python ``== "mine"`` — ``scope`` is NEVER interpolated into SQL (V5).
    """
    pool = await get_pg_pool()
    user_id = current_user["id"]
    rows = await list_published_workflows(
        pool,
        user_id=UUID(user_id) if isinstance(user_id, str) else user_id,
        project_folder_id=project_folder_id,
        owned_only=(scope == "mine"),
    )
    return [
        PublishedWorkflow(
            id=r["id"],
            slug=r["slug"],
            name=r["name"],
            definition=_coerce_definition(r.get("definition")),
        )
        for r in rows
    ]


@router.get("/starters", response_model=list[PublishedWorkflow])
async def get_starter_workflows(
    current_user: dict = Depends(get_current_user),
) -> list[PublishedWorkflow]:
    """List the curated global starters — the Starters shelf feed (Phase 143 / WF-01).

    Delegates to ``list_starter_workflows`` (``status='published' AND is_global=true
    AND definition->>'category'='starter'``) and maps each row through the existing
    ``PublishedWorkflow`` + ``_coerce_definition`` shape the Published shelf uses. The
    rows are UNSCOPED curated globals — ``is_global`` published rows are world-readable
    (T-143-01, mig-056 SELECT policy), so no per-user filter is needed; ``category=
    'starter'`` narrows to curated (the 5 mig-061 dev scaffolds lack the marker and are
    excluded — D-143-2a).

    Declared as an explicit STATIC ``/starters`` segment BEFORE any ``/{definition_id}``
    route (the ``/drafts`` precedent) so a future path param can never shadow it.
    """
    pool = await get_pg_pool()
    rows = await list_starter_workflows(pool)
    return [
        PublishedWorkflow(
            id=r["id"],
            slug=r["slug"],
            name=r["name"],
            definition=_coerce_definition(r.get("definition")),
        )
        for r in rows
    ]


# ── Phase 102 (QUAL-01 / D-07) — the server-side publish path ─────────────────
# G-5 RED LINE: this endpoint joins THIS router (api/workflows.py), NEVER
# api/threads.py (the hot-file ledger forbids growing threads.py). The publish flip
# is the ONLY draft->published path; 103's Workflows page is just a client of this
# endpoint (same server-enforced-invariant discipline as 092's mode lock).
class PublishRequest(BaseModel):
    """The publish body — the author-supplied representative kickoff prompt (D-05)
    the golden run executes against the project KB."""

    golden_input: str


class PublishVerdict(BaseModel):
    """The D-08 structured verdict. A block names the stage + the failures + the
    golden run id (a real, browsable run); a success carries the published version.
    Machine-renderable for 103 (nothing prose-only)."""

    published: bool
    version: int | None = None
    golden_run_id: UUID | None = None
    blocked_stage: str | None = None
    named_failures: list = Field(default_factory=list)


@router.post("/{definition_id}/publish", response_model=PublishVerdict)
async def publish_workflow(
    definition_id: UUID,
    body: PublishRequest,
    current_user: dict = Depends(get_current_user),
    redis: aioredis.Redis = Depends(get_redis),
) -> PublishVerdict:
    """Publish a draft (D-07) — the QUAL-01 hard gate.

    Enforces, IN ORDER: business_requirement present -> structural lint -> a REAL
    golden run on the project KB -> the judge verdict -> the draft->published flip.
    A lint-clean workflow whose judge fails CANNOT publish.

    The orchestration lives in ``publish_service.publish`` (owner-scoped via
    ``get_definition``). HTTP mapping:
      - ``not_found`` (not owned / does not exist) -> 404 (no existence leak, V4)
      - ``already_published`` -> 409
      - ``business_requirement`` (D-13) -> 400 with the structured verdict
      - any other block -> 200 ``{published: False, blocked_stage, named_failures, golden_run_id}``
      - success -> 200 ``{published: True, version, golden_run_id}``

    ``definition_id`` is a path ``UUID`` -> FastAPI 422 on a malformed id (V5).
    """
    pool = await get_pg_pool()
    result = await publish_service.publish(
        definition_id=definition_id,
        golden_input=body.golden_input,
        user=current_user,
        pool=pool,
        redis=redis,
    )

    blocked = result.get("blocked_stage")
    if blocked == "not_found":
        # not-found AND cross-user collapse to a uniform 404 (no existence leak).
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="workflow not found")
    if blocked == "already_published":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="workflow is already published"
        )
    if blocked == "business_requirement":
        # The D-13 publish-time invariant — a draft with no declared business
        # requirement is a 400 (the structured verdict rides the detail).
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result)

    # A lint / structural-gate / judge block, or a success, returns 200 with the
    # machine-renderable verdict (the run is a real, browsable workflow_run).
    return PublishVerdict(**result)


# ── Phase 103 (REQ-1 / WFAUTH-01) — draft CRUD routes ─────────────────────────
# G-5 RED LINE: these join THIS router (api/workflows.py), NEVER api/threads.py.
# The Workflows page (Plan 06) + Builder (Plan 04) are clients of these routes.
def _coerce_user_id(current_user: dict) -> UUID:
    """The get_published_workflows boilerplate: the trusted owner id as a UUID."""
    user_id = current_user["id"]
    return UUID(user_id) if isinstance(user_id, str) else user_id


@router.post("", response_model=DraftCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_draft(
    body: WorkflowDefinition,
    current_user: dict = Depends(get_current_user),
) -> DraftCreateResponse:
    """Persist a NEW draft (REQ-1 create) — returns ``{id, version}``.

    Server-forced invariants (T-103-01-03): ``status='draft'`` is forced on the body
    server-side (never trusted from the client); the DB fn binds ``is_global=false`` +
    ``created_by=user_id`` literally/by the trusted owner. A hallucinated/extra key in
    the body is already a 422 (``WorkflowDefinition`` is ``extra='forbid'``).
    """
    pool = await get_pg_pool()
    user_id = _coerce_user_id(current_user)
    # Force draft status server-side — never trust the client's ``status``:
    body = body.model_copy(update={"status": "draft"})
    try:
        row = await create_workflow_definition(pool, definition=body, user_id=user_id)
    except asyncpg.exceptions.UniqueViolationError:
        # UNIQUE(slug, version) already taken (e.g. a re-fired save or a same-named
        # draft). An honest 409 — NEVER a raw 500 (UAT-103). The client treats a
        # persist 409 as non-fatal to the in-memory draft.
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="a workflow with this slug and version already exists",
        )
    return DraftCreateResponse(**row)


@router.get("/drafts", response_model=list[DraftRow])
async def list_drafts(
    current_user: dict = Depends(get_current_user),
) -> list[DraftRow]:
    """List the caller's OWN drafts (the drafts shelf — D-103-4).

    Owner-scoped in the DB layer (``status='draft' AND created_by=$1``); a second
    user's draft is absent (T-103-01-01). Declared as an explicit static segment
    so it is never shadowed by a ``/{definition_id}`` path.
    """
    pool = await get_pg_pool()
    user_id = _coerce_user_id(current_user)
    rows = await list_draft_workflows(pool, user_id=user_id)
    return [
        DraftRow(
            id=r["id"],
            slug=r["slug"],
            version=r["version"],
            name=r.get("name"),
            definition=_coerce_definition(r.get("definition")),
        )
        for r in rows
    ]


@router.patch("/{definition_id}", response_model=DraftCreateResponse)
async def update_draft(
    definition_id: UUID,
    body: WorkflowDefinition,
    current_user: dict = Depends(get_current_user),
) -> DraftCreateResponse:
    """Update a DRAFT (REQ-1 PATCH) — returns ``{id, version}``.

    A published-row PATCH hits the immutability trigger (Postgres ``23514``); we catch
    ``asyncpg.exceptions.CheckViolationError`` -> HTTP 409 (mirroring the
    ``already_published`` -> 409 mapping), never a silent overwrite or a 500
    (T-103-01-02). A not-owned / non-draft / missing id returns ``None`` -> 404 (no
    existence leak). ``definition_id`` is a path ``UUID`` -> FastAPI 422 on a malformed id.
    """
    pool = await get_pg_pool()
    user_id = _coerce_user_id(current_user)
    body = body.model_copy(update={"status": "draft"})
    try:
        row = await update_workflow_definition(
            pool, definition_id, definition=body, user_id=user_id
        )
    except asyncpg.exceptions.CheckViolationError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="workflow is published and cannot be modified",
        )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="draft not found")
    return DraftCreateResponse(**row)


@router.delete("/{definition_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_draft(
    definition_id: UUID,
    current_user: dict = Depends(get_current_user),
):
    """Delete a DRAFT (REQ-1 DELETE) -> 204.

    A published-row DELETE hits the immutability trigger (``23514``); we catch
    ``CheckViolationError`` -> HTTP 409 (no silent removal, no 500; T-103-01-02). A
    not-owned / non-draft / missing id returns ``False`` -> 404 (no existence leak).

    No return-type annotation (the delete_folder 204 precedent): a ``-> None`` makes
    FastAPI build a response body field, which the 204 status forbids.
    """
    pool = await get_pg_pool()
    user_id = _coerce_user_id(current_user)
    try:
        deleted = await delete_workflow_definition(pool, definition_id, user_id=user_id)
    except asyncpg.exceptions.CheckViolationError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="workflow is published and cannot be modified",
        )
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="draft not found")
    return None


# ── Phase 103 (REQ-2 / WFAUTH-02) — NL one-shot generation route ──────────────
# G-5 RED LINE: joins THIS router (api/workflows.py), NEVER api/threads.py. The
# orchestration (grounding assembly + forced_emit + retry + fidelity) lives in the
# workflow_authoring service — the route is delegation ONLY. The returned draft is
# NOT persisted (persistence is REQ-1's explicit POST /workflows create).
class GenerateRequest(BaseModel):
    """The NL-authoring body (D-103-CONF-2). ``describe`` is the plain-language task;
    template grounding is OPTIONAL — a library ``template_asset_id`` OR a direct
    ``template_placeholders`` list (never both required)."""

    describe: str
    project_folder_id: UUID | None = None
    template_asset_id: UUID | None = None
    template_placeholders: list[str] | None = None


@router.post("/generate")
async def generate_workflow(
    body: GenerateRequest,
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase),
):
    """Generate a grounded ``WorkflowDefinition`` DRAFT from an NL description (REQ-2).

    Delegates to ``workflow_authoring.generate_workflow_definition`` (the orchestration
    stays OUT of the route body). Returns the service result dict directly:
      - ``{ok: True, definition}`` -> a draft object the Builder loads (NOT persisted);
      - ``{ok: False, error, detail}`` -> an HONEST "could not generate" (the UI
        distinguishes on ``ok``). A service ``ok=False`` is returned as 200 with the
        structured error body — it is not an HTTP error, it is an honest failure surface.

    ``project_folder_id`` / ``template_asset_id`` are path/body ``UUID``s -> FastAPI 422
    on a malformed value (V5).
    """
    pool = await get_pg_pool()
    user_id = current_user["id"]
    result = await workflow_authoring.generate_workflow_definition(
        describe=body.describe,
        supabase=supabase,
        user_id=str(user_id),
        settings=settings,
        pool=pool,
        project_folder_id=body.project_folder_id,
        template_asset_id=body.template_asset_id,
        template_placeholders=body.template_placeholders,
    )
    return result
