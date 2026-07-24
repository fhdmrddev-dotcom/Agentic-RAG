"""Phase 092 (MODE-01 / D-01) — published-workflows list endpoint for the picker.

There was NO workflows API router before this (RESEARCH A4 — only the engine
ran workflows, no live HTTP surface). This adds the single read the Harness-mode
picker needs: the list of published workflow definitions a user may kick off.

The endpoint is owner-scoped through ``list_published_workflows``' RLS-mirroring
WHERE clause (``status='published' AND (is_system_global OR created_by=user)``) — a user
never sees another user's unpublished or private definitions (T-092-07). The GET
itself is a pure read (no writes).
"""
from __future__ import annotations

import logging
from typing import Literal
from uuid import UUID

import asyncpg
import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.config import settings
from app.dependencies import (
    get_current_user,
    get_pg_pool,
    get_redis,
    get_supabase,
    require_canvas,
    require_visible,
)
from app.db.workflows import (
    count_foreign_runs_on_global,
    create_workflow_definition,
    delete_published_workflow_cascade,
    delete_workflow_cascade_preview,
    delete_workflow_definition,
    finish_run,
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
# Phase 182 (VALID-01 / D-182-06): ``grounding`` is imported as a MODULE for the same
# patchability reason as ``publish_service`` above — the /validate + /grounding-bundle
# routes resolve ``grounding.<fn>`` at call time, so a test can monkeypatch the shared
# grounding source's attributes (the Phase-103 test seam, now pointed at grounding.py).
from app.services.harness import grounding, publish_service
# Phase 182 (Pitfall 1): lint is imported MODULE-DIRECT from ``reachability`` (NOT via
# ``app.services.harness``) to keep the import light — ``reachability.py`` is documented
# "PURE — no I/O, no DB, no engine import", and the /validate seam must never re-derive
# a structural rule. There is exactly ONE lint copy and this is it (red line D-14).
from app.services.harness.reachability import lint_workflow
from app.services.operator_service import write_operator_audit
# Phase 182 (CR-02) — the SAME owner-identity scrub every other folder/skill read path
# applies (folders.py:20,34 / kb.py:123 / skills.py:218-222; SEED-091 / D-164-05 / D-165-05).
# Imported at module level exactly as folders.py / kb.py do it; folder_utils is cycle-safe
# (it imports only app.utils.db).
from app.utils.folder_utils import _null_foreign_global_owner

logger = logging.getLogger(__name__)

# ── Phase 163 (TEN-02 / D-03 / D-05) — workflow-cluster client policy ─────────
# The workflow cluster stays on the hardened service-role client (classified carve-out),
# and its DB layer stays on the raw ``get_pg_pool()`` pool. Reasons (schema/architecture-driven,
# per the plan-07 carve-out discipline — the workflow_* RLS is already LIVE + proven by
# tests/integration/test_163_rls_workflow_eval.py, so DB-layer isolation is enforced regardless):
#   * ``db/workflows.py`` is a service-role module BY DESIGN (its header), shared by BOTH the
#     request routes AND the background harness engine on the SAME helpers — several of which own
#     their own ``pool.acquire()`` transaction (create_workflow_run / delete_published_workflow_
#     cascade / delete_workflow_cascade_preview / count_foreign_runs_on_global / finish_run) and so
#     cannot accept a duck-typed request-scoped RLS Connection.
#   * ``/published`` + ``/starters`` are the documented RUN CARVE-OUT picker feeds (see below): a
#     GLOBAL workflow is now org-scoped (membership gates ``is_system_global`` — test_163_rls_workflow_eval),
#     so a user-JWT read would HIDE cross-org starters — NOT behavior-preserving. is_system_global
#     cross-org visibility is Phase 165.
#   * ``delete_workflow_cascade`` is a destructive cross-user cascade that drives the shared
#     service-role ``_cancel_run_internals`` writer + the operator audit ledger; ``generate_workflow``
#     delegates to the out-of-scope ``workflow_authoring`` service. Both keep service-role
#     (``# service-role:`` at their Depends). The harness/eval async writers are widened in plan 09.
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


# Phase 148 (VIS-01) — RUN CARVE-OUT: DO NOT gate /published or /starters. They are the Run
# picker feeds (the Deep/Harness composer + Workflows launch); end users need them so Run stays
# for everyone (D-05). The workflow LAUNCH in threads.py is also ungated (untouched by this
# plan). Only the AUTHORING/publish endpoints below carry require_visible('workflow_authoring').
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

    Delegates to ``list_starter_workflows`` (``status='published' AND is_system_global=true
    AND definition->>'category'='starter'``) and maps each row through the existing
    ``PublishedWorkflow`` + ``_coerce_definition`` shape the Published shelf uses. The
    rows are UNSCOPED curated globals — ``is_system_global`` published rows are world-readable
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


# ══ Phase 182 (VALID-01) — the server VALIDATION SEAM ═════════════════════════
#
# G-5 RED LINE: these routes join THIS router (api/workflows.py), NEVER api/threads.py.
#
# THE ANTI-DRIFT CONTRACT (D-182-02 / D-182-06 / red line D-14): the visual canvas is a
# pure CLIENT of this seam. Every rule it previews is the SAME copy the publish gauntlet
# enforces — ``lint_workflow`` (structural), ``grounding.grounding_verdicts`` (fidelity),
# ``grounding.business_requirement_missing`` (D-13), ``publish_service._interactive_phase_failures``
# (WR-04). NOTHING is re-implemented here and NOTHING is ever re-implemented client-side;
# the route only AGGREGATES and CLASSIFIES. `/validate` is READ-ONLY advice — it never
# persists, never executes, and never mints a version; PUBLISH remains the enforcing gate.
#
# GATE (D-182-05, Pitfall 3): both routes carry ``Depends(require_canvas())`` **ALONE** — a
# byte-identical 404 when ``visual_workflow_canvas`` is off, for EVERYONE incl. operators,
# resolved PRE-AUTH. They must NEVER stack ``require_visible`` (which raises 403 and would
# leak that the route exists) nor couple canvas availability to another feature's audience.
#
# ROUTE ORDERING: declared as explicit STATIC segments HERE, ahead of every ``/{definition_id}``
# route below (the ``/drafts`` / ``/starters`` precedent), so no present or future path param
# can shadow them. ``_coerce_user_id`` is defined further down at module level and resolved
# at request time.
class Verdict(BaseModel):
    """One static-gauntlet finding, per-node (SC#4).

    ``code`` is the machine literal (the 5 verbatim lowercase ``LintError.code`` values plus
    the route-assigned ``folder_scope`` / ``unregistered_tool`` / ``unregistered_skill`` /
    ``business_requirement`` / ``interactive_phase``). ``phase`` is the phase ``slug`` — the
    node identity the canvas paints on (the 181/183 ``node id == phase.slug`` contract) — or
    ``None`` for a workflow-global finding. ``severity`` is the ONLY net-new field (D-182-03):
    an ORTHOGONAL UI hint (``error`` = broken/red, ``incomplete`` = still-building/grey), NOT
    a pass/fail axis — both severities block a publish."""

    code: str
    phase: str | None = None
    message: str
    severity: Literal["error", "incomplete"]


class ValidateResponse(BaseModel):
    """The ``{ok, verdicts}`` envelope — vocabulary aligned with the existing
    ``{ok, error, detail}`` grounding shape + the D-08 publish verdict (no new vocabulary).

    ``ok == (verdicts == [])``: the FULL static gauntlet is clean, i.e. "this can pass the
    static half of publish now". An ``incomplete``-only verdict set still sets ``ok False``
    (an unfinished draft cannot publish either)."""

    ok: bool
    verdicts: list[Verdict] = Field(default_factory=list)


class PaletteFolder(BaseModel):
    """One KB folder the canvas may bind a ``project_folder_id`` / ``folder_scope`` to.

    An EXPLICIT projection (CR-02). ``bundle.folders`` are raw
    ``fetch_all_folders(supabase, fields="*")`` rows — i.e. EVERY column of ``public.folders``
    (``id, user_id, name, parent_id, is_org_shared, created_at, updated_at, org_id``). Raw DB
    rows must NEVER reach the wire on this surface:

      * ``org_id`` is deliberately absent — ``FolderResponse`` does not expose it either, and a
        tenant identifier is not a palette field.
      * the owner ``user_id`` is deliberately absent — SEED-091 / D-164-05 (TEN-06): a
        non-owner reader of an org-shared folder must not learn who seeded it. Omitting the
        column outright is strictly stronger than nulling it.
      * ``created_at`` / ``updated_at`` are noise the palette never renders.

    ``id`` / ``name`` / ``parent_id`` is not a guess at what the canvas needs — it is exactly
    what ``grounding._render_folder_tree`` consumes to build the tree, so the picker can render
    the full hierarchy from this and nothing more."""

    id: UUID
    name: str
    parent_id: UUID | None = None


class PaletteSkill(BaseModel):
    """One enabled skill eligible for a phase ``skill_ref`` — id + display name ONLY (CR-02).

    ``bundle.skills`` rows carry the owner ``user_id`` (and, post-CR-01, ``org_id`` /
    ``is_system`` / ``is_enabled``, which the org-gated visibility post-filter needs). None of
    that is palette data. ``skill_ref`` binds to the ``id``; the name is the label
    ``render_grounding_prompt`` also shows. ``name`` is Optional purely so a degenerate row can
    never 500 a read-only palette."""

    id: UUID
    name: str | None = None


class GroundingBundleResponse(BaseModel):
    """The server-sourced PALETTE of valid building blocks (D-182-01).

    This is what Phase 184's node-config dropdowns bind to — the tool names eligible for an
    ``available_tools`` whitelist, the KB folder tree (name + id), the enabled owner/org-shared
    skills eligible for ``skill_ref``, and (only when a ``template_asset_id`` is supplied) that
    template's placeholder fields. **It is NEVER a frontend constant** (Pitfall 1 / SC#2): KB
    content can never whitelist itself, so the valid sets are computed server-side by the ONE
    shared ``grounding.assemble_grounding_bundle``.

    Kept a SEPARATE cacheable ``GET`` rather than embedded in the ``/validate`` response
    (D-182-01): ``/validate`` fires on every canvas edit; the palette is near-static."""

    tools: list[str] = Field(default_factory=list)
    # CR-02: EXPLICIT per-row models, never ``list[dict]``. A bare ``list[dict]`` shipped the raw
    # ``folders``/``skills`` DB rows verbatim — leaking ``org_id`` + the seeding owner's
    # ``user_id`` on a brand-new surface, bypassing the projection every sibling read applies.
    folders: list[PaletteFolder] = Field(default_factory=list)
    skills: list[PaletteSkill] = Field(default_factory=list)
    template_placeholders: list[str] = Field(default_factory=list)


# The severity taxonomy (D-182-03). Hard structural + grounding-fidelity breaks are ERRORS;
# not-yet-ready conditions (``input_unsatisfied`` while wiring, a missing business
# requirement, an interactive phase, an empty draft) are INCOMPLETE.
_ERROR_CODES = frozenset(
    {
        "bad_index",
        "orphan_phase",
        "unsatisfiable_skip",
        "folder_scope",
        "unregistered_tool",
        "unregistered_skill",
    }
)


def _severity(code: str, *, phases_empty: bool) -> str:
    """Classify a verbatim check's finding — the route's ONLY interpretive step (D-182-03).

    ``no_terminal`` is emitted by ``lint_workflow`` from TWO different situations (Pitfall 2):
    ``phases == []`` (an empty draft — the author is still building) and an unreachable
    terminal (a genuinely broken graph). Same code, split severity, distinguished by the
    definition the route already holds — so an empty canvas paints grey "still building",
    never red "broken"."""
    if code == "no_terminal":
        return "incomplete" if phases_empty else "error"
    if code in _ERROR_CODES:
        return "error"
    return "incomplete"


@router.post(
    "/validate",
    response_model=ValidateResponse,
    dependencies=[Depends(require_canvas())],  # D-182-05 — require_canvas ALONE (never require_visible)
)
async def validate_workflow(
    body: WorkflowDefinition,
    current_user: dict = Depends(get_current_user),
    # service-role: the grounding fidelity reads span the owner's folder tree + skill
    # registry (scoped BY HAND on user_id inside grounding.py — service-role bypasses RLS).
    supabase=Depends(get_supabase),
) -> ValidateResponse:
    """Validate a raw ``WorkflowDefinition`` — the SINGLE SOURCE OF VALIDATION TRUTH (VALID-01).

    Aggregates the FULL STATIC publish gauntlet (D-182-02) so the canvas previews every
    pre-run blocker live, reusing each check VERBATIM:

      1. ``lint_workflow``                          — structural (bad_index / unsatisfiable_skip /
                                                      orphan_phase / no_terminal / input_unsatisfied)
      2. ``grounding.grounding_verdicts``           — fidelity (folder_scope ⊆ project subtree,
                                                      available_tools ∈ registry, skill_ref ∈ enabled)
      3. ``grounding.business_requirement_missing`` — the D-13 publish invariant (shared with publish stage 1)
      4. ``publish_service._interactive_phase_failures`` — the WR-04 interactive-phase pre-run block

    The golden run + judge (publish stages 3-4) are LIVE-only and deliberately NOT here —
    ``/validate`` is a static, no-provider, read-only surface called on every canvas edit.

    ALWAYS HTTP 200 with the machine-renderable envelope: a dirty definition is not an HTTP
    error, it is advice. A malformed/injected body key is a 422 for free (``WorkflowDefinition``
    is ``extra='forbid'``) — the SHAPE tier, never relaxed to a lenient dict (V5). A phase
    declaring ``folder_scope`` on an unbound workflow also 422s at the shape tier (the
    ``@model_validator``), so it never reaches this handler; an empty ``phases: []`` IS
    shape-valid and lands here as an ``incomplete`` ``no_terminal``.
    """
    user_id = _coerce_user_id(current_user)
    # ONE registry read for the whole request (the palette the fidelity rules test against).
    # ``project_folder_id`` is deliberately not passed: a bound project narrows only the
    # per-phase folder_scope ⊆ check (which reads it off the definition itself) and the NL
    # prose line — never the palette.
    bundle = await grounding.assemble_grounding_bundle(
        supabase=supabase,
        user_id=str(user_id),
    )

    findings: list[dict] = []

    # (1) structural lint — the verbatim pure check. Mapped to the SAME dict shape publish
    # renders its lint block with (publish_service: {"code", "phase", "message"}).
    findings.extend(
        {"code": e.code, "phase": e.phase_slug, "message": e.message}
        for e in lint_workflow(body)
    )

    # (2) grounding fidelity — the per-node collector over the ONE shared rule copy.
    findings.extend(
        await grounding.grounding_verdicts(
            body,
            supabase=supabase,
            user_id=str(user_id),
            tool_names=bundle.tool_names,
            skill_ids=bundle.skill_ids,
        )
    )

    # (3) the D-13 business-requirement invariant — same predicate publish stage 1 calls,
    # same named-failure prose.
    if grounding.business_requirement_missing(body):
        findings.append(
            {
                "code": "business_requirement",
                "phase": None,
                "message": (
                    "a workflow must declare exactly one business_requirement before publish"
                ),
            }
        )

    # (4) the WR-04 interactive-phase pre-run block — reused verbatim (one finding per phase).
    findings.extend(
        {
            "code": "interactive_phase",
            "phase": f.get("phase"),
            "message": f.get("message"),
        }
        for f in publish_service._interactive_phase_failures(body)
    )

    phases_empty = len(body.phases) == 0
    verdicts = [
        Verdict(
            code=f["code"],
            phase=f.get("phase"),
            message=f["message"],
            severity=_severity(f["code"], phases_empty=phases_empty),
        )
        for f in findings
    ]
    return ValidateResponse(ok=(len(verdicts) == 0), verdicts=verdicts)


@router.get(
    "/grounding-bundle",
    response_model=GroundingBundleResponse,
    dependencies=[Depends(require_canvas())],  # D-182-05 — require_canvas ALONE (never require_visible)
)
async def get_grounding_bundle(
    current_user: dict = Depends(get_current_user),
    # service-role: the palette read spans the owner's folder tree + skill registry (scoped
    # BY HAND on user_id inside grounding.py — service-role bypasses RLS).
    supabase=Depends(get_supabase),
    template_asset_id: UUID | None = None,
) -> GroundingBundleResponse:
    """The cacheable server-sourced palette the canvas binds to (D-182-01).

    A pure READ — no writes, no provider call. Delegates to the ONE shared
    ``grounding.assemble_grounding_bundle`` (the SAME computation the ``/validate`` fidelity
    rules and NL generation consume) and serializes its structured fields. The palette is
    workflow-agnostic, so ``project_folder_id`` is not taken: a bound project narrows only the
    per-phase ``folder_scope`` ⊆ check, never the set of valid building blocks.

    ``template_placeholders`` is populated ONLY when the optional ``?template_asset_id=`` query
    param is supplied (placeholders are per-template); the base palette returns ``[]``. A
    malformed id is a 422 for free (``UUID`` coercion, V5); the pg pool is resolved lazily
    because it is needed ONLY to resolve a template's bytes.

    Reads stay OWNER-scoped by ``user_id`` (V4 / T-182-03) — the palette must never widen to
    another user's folders or skills.

    The response is an EXPLICIT projection (``PaletteFolder`` / ``PaletteSkill``), never the raw
    DB rows (CR-02): ``org_id`` and the seeding owner's ``user_id`` never reach the wire.
    """
    user_id = _coerce_user_id(current_user)
    # Lazily resolved: assemble_grounding_bundle needs a pool ONLY to resolve a template
    # asset's placeholder vocabulary, so the base palette never forces pool creation.
    pool = await get_pg_pool() if template_asset_id is not None else None
    bundle = await grounding.assemble_grounding_bundle(
        supabase=supabase,
        pool=pool,
        user_id=str(user_id),
        project_folder_id=None,
        template_asset_id=template_asset_id,
    )
    # CR-02 — apply the SAME owner-identity scrub at the SAME seam every sibling read path uses
    # (folders.py:20,34 / kb.py:123 / skills.py:218-222; SEED-091 / D-164-05 / D-165-05): null
    # the seeding owner on non-owned shared/system rows before serializing. The Palette* models
    # below then project ``user_id`` away ENTIRELY, so this is defense in depth — it keeps the
    # sibling-route invariant honored at this seam if a future edit ever widens those models.
    # Called WITHOUT ``visible_non_owned_ids`` (the shared-row-only form skills.py uses): the
    # D-165-05 subtree-descendant broadening exists to null owners on rows the projection does
    # not emit at all here, and buying it would cost a THIRD full-table folder read on a route
    # whose whole point is being cheap and cacheable (IN-05).
    _null_foreign_global_owner(bundle.folders, str(user_id))
    _null_foreign_global_owner(bundle.skills, str(user_id))
    return GroundingBundleResponse(
        tools=bundle.tools,
        folders=bundle.folders,
        skills=bundle.skills,
        template_placeholders=bundle.placeholders,
    )


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


@router.post(
    "/{definition_id}/publish",
    response_model=PublishVerdict,
    dependencies=[Depends(require_visible("workflow_authoring"))],  # Phase 148 (VIS-01) — authoring gate
)
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


@router.post(
    "",
    response_model=DraftCreateResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_visible("workflow_authoring"))],  # Phase 148 (VIS-01) — authoring gate
)
async def create_draft(
    body: WorkflowDefinition,
    current_user: dict = Depends(get_current_user),
) -> DraftCreateResponse:
    """Persist a NEW draft (REQ-1 create) — returns ``{id, version}``.

    Server-forced invariants (T-103-01-03): ``status='draft'`` is forced on the body
    server-side (never trusted from the client); the DB fn binds ``is_system_global=false`` +
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


@router.get(
    "/drafts",
    response_model=list[DraftRow],
    dependencies=[Depends(require_visible("workflow_authoring"))],  # Phase 148 (VIS-01) — authoring gate
)
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


@router.patch(
    "/{definition_id}",
    response_model=DraftCreateResponse,
    dependencies=[Depends(require_visible("workflow_authoring"))],  # Phase 148 (VIS-01) — authoring gate
)
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


@router.delete(
    "/{definition_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_visible("workflow_authoring"))],  # Phase 148 (VIS-01) — authoring gate
)
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


# ── Phase 152 (WFIN-03 / D-08) — published-workflow safe DELETE cascade ───────
# G-5 RED LINE: this DESTRUCTIVE cascade joins THIS router (api/workflows.py),
# NEVER api/threads.py (the hot-file ledger forbids growing threads.py — D-08). It is
# a DISTINCT route from the draft ``DELETE /{definition_id}`` (Pitfall 7): overloading
# the draft path would change its draft-only 404 contract and collide with the client
# ``deleteWorkflowDraft``. Cancel-first (D-LOCK-05) lives HERE in the route/service
# layer, never inside the db-helper transaction.
class DeletePreview(BaseModel):
    """The victim-naming sheet's exact Removed/Kept counts (D-LOCK-03). ``versions`` +
    ``runs`` are Removed; ``threads`` are Kept (they become normal chats); ``in_flight``
    is the count of runs STILL LIVE — the honest signal the sheet's amber cancel-first
    banner gates on (D-LOCK-05). Defaults to 0 so an older client that ignores it is
    unaffected (additive field)."""

    name: str
    versions: int
    runs: int
    threads: int
    in_flight: int = 0


async def _owned_slug_or_404(pool, definition_id: UUID, user_id: UUID) -> str:
    """Resolve the slug of an OWNED definition, or raise a uniform 404.

    Owner-gated (``created_by = $2``) — a non-owner / unknown id resolves to ``None`` →
    404, indistinguishable from not-found (no existence leak; the ``get_definition``
    404-collapse precedent). The service role bypasses RLS, so this WHERE is the ONLY
    authorization boundary (T-152-02-01)."""
    row = await pool.fetchrow(
        "SELECT slug FROM workflow_definitions WHERE id = $1 AND created_by = $2",
        definition_id,
        user_id,
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="workflow not found")
    return row["slug"]


@router.get(
    "/{definition_id}/delete-preview",
    response_model=DeletePreview,
    dependencies=[Depends(require_visible("workflow_authoring"))],  # Phase 148 (VIS-01) — authoring gate
)
async def get_delete_preview(
    definition_id: UUID,
    current_user: dict = Depends(get_current_user),
) -> DeletePreview:
    """Exact Removed/Kept counts for the victim-naming sheet BEFORE commit (D-LOCK-03).

    Owner-gated + 404-collapse (same boundary as the cascade DELETE). The counts are
    server-sourced — the sheet never guesses. A distinct STATIC-suffix route so it never
    shadows (or is shadowed by) the draft ``/{definition_id}`` paths.
    """
    pool = await get_pg_pool()
    user_id = _coerce_user_id(current_user)
    slug = await _owned_slug_or_404(pool, definition_id, user_id)
    preview = await delete_workflow_cascade_preview(pool, slug=slug, user_id=user_id)
    if not preview.get("found"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="workflow not found")
    return DeletePreview(
        name=preview["name"],
        versions=preview["versions"],
        runs=preview["runs"],
        threads=preview["threads"],
        in_flight=preview.get("in_flight", 0),
    )


@router.delete(
    "/{definition_id}/cascade",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_visible("workflow_authoring"))],  # Phase 148 (VIS-01) — authoring gate
)
async def delete_workflow_cascade(
    definition_id: UUID,
    current_user: dict = Depends(get_current_user),
    # service-role: destructive cross-user cascade — drives the shared _cancel_run_internals
    # writer + the operator audit ledger (write_operator_audit); not an RLS request path.
    supabase=Depends(get_supabase),
):
    """Hard-delete a workflow (definition + ALL versions + ALL runs) safely -> 204.

    Order (D-LOCK-04/05):
      1. Owner-gate the target id → its slug (non-owner / unknown → 404, no leak).
      2. CANCEL-FIRST every in-flight run (status ``active``/``paused``/``cap_paused``) for
         that slug's versions — BEFORE the DB delete, never deleting a live run out from
         under the engine (D-LOCK-05). Cancel through the PRODUCER ``runs.run_id`` (the
         RUN_TASKS key, resolved by the LEFT JOIN — NOT the ``workflow_runs.id``, which the
         registry never keys), publish the ask_user cancel sentinel on the workflow-run
         channel, and durably ``finish_run`` the workflow_runs row (covers the paused +
         cross-worker ``WORKER_COUNT=2`` cases).
      3. FK-safe cascade (``delete_published_workflow_cascade``): runs FIRST (RESTRICT
         blocker) → phases auto-cascade → thread anchors auto-SET-NULL (threads KEPT as
         normal chats) → all versions. ``harness_audit`` receipts linger (A3).
      4. Best-effort audit receipt (never raises) — the victim-naming "recorded with your
         name" (D-LOCK-03).

    No return-type annotation (the ``delete_draft`` 204 precedent): a ``-> None`` makes
    FastAPI build a response body field, which 204 forbids.
    """
    pool = await get_pg_pool()
    user_id = _coerce_user_id(current_user)
    slug = await _owned_slug_or_404(pool, definition_id, user_id)

    # WR-01 fail-closed guard: an ``is_system_global`` definition's runs are owned by RUNNERS,
    # not the definition owner. The ON DELETE RESTRICT FK forces the cascade to sweep
    # every runner's rows, so deleting a shared workflow here would cancel + destroy
    # OTHER users' run history. Refuse with 409 (before any cancel/delete side effect)
    # when the caller's global definition(s) for this slug carry other users' runs.
    foreign_runs = await count_foreign_runs_on_global(pool, slug=slug, user_id=user_id)
    if foreign_runs > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "This is a shared workflow with runs owned by other users — deleting it "
                "here would remove their run history, so it's blocked."
            ),
        )

    # 2. Cancel-first (D-LOCK-05) — heal every in-flight run for this slug's versions
    # BEFORE the DB delete. The cancel discipline lives in the SERVICE/route layer, not
    # the db txn. ``_cancel_run_internals`` + ``publish_cancel_sentinel`` are late-imported
    # (the admin.py:479 discipline — keeps the RUN_TASKS registry off this module's load
    # path, avoids the import cycle).
    #
    # CR-01 / D-LOCK-05: a live kickoff-started run's producer task is registered in
    # RUN_TASKS under the PRODUCER ``runs.run_id`` (threads.py:2011), NOT the
    # ``workflow_runs.id``. Resolve that producer identity via a LEFT JOIN to the live
    # ``runs`` row (status='streaming') and cancel through IT — the same identity the
    # admin Kill path uses — so the engine task is actually cancelled.
    inflight = await pool.fetch(
        "SELECT wr.id AS wf_id, wr.thread_id, "
        "r.run_id AS producer_id, r.status AS producer_status "
        "FROM workflow_runs wr "
        "JOIN workflow_definitions wd ON wd.id = wr.definition_id "
        "LEFT JOIN runs r ON r.thread_id = wr.thread_id AND r.status = 'streaming' "
        "WHERE wd.slug = $1 AND wd.created_by = $2 "
        "AND wr.status IN ('active', 'paused', 'cap_paused')",
        slug,
        user_id,
    )
    if inflight:
        from app.services.ask_user_service import publish_cancel_sentinel  # noqa: PLC0415
        from app.services.run_lifecycle import _cancel_run_internals  # noqa: PLC0415

        redis = get_redis()
        for r in inflight:
            # (1) Cancel the LIVE producer task — RUN_TASKS is keyed by the producer
            # runs.run_id, never the workflow_runs id (CR-01). A run with no live
            # producer row (already terminal / cross-worker) has producer_id = None.
            if r["producer_id"] is not None:
                await _cancel_run_internals(
                    run_id=r["producer_id"],
                    status=r["producer_status"],
                    thread_id=str(r["thread_id"]) if r["thread_id"] else None,
                    redis=redis,
                    supabase=supabase,
                )
            # (2) Wake any paused ask_user harness prompt — the harness subscribes on the
            # WORKFLOW run id channel (best-effort, never raises).
            await publish_cancel_sentinel(redis, r["wf_id"])
            # (3) Durably terminalize the workflow_runs row BEFORE the delete — the
            # cross-worker (WORKER_COUNT=2) + paused backstop D-LOCK-05 needs (the engine's
            # own writes 0-row no-op once its rows are gone, so this is the authoritative
            # terminal state + anchor-clear).
            await finish_run(pool, r["wf_id"], "cancelled")

    # 3. FK-safe hard-delete (D-LOCK-04).
    result = await delete_published_workflow_cascade(pool, slug=slug, user_id=user_id)
    if not result.get("deleted"):
        # A racing delete emptied the slug between the owner-gate and here → 404.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="workflow not found")

    # 4. Best-effort audit receipt — write_operator_audit NEVER raises (swallow-on-error),
    # so the delete's 204 can never regress on an audit failure. Records the material,
    # irreversible cascade under the actor's own id (D-LOCK-03 "recorded with your name").
    await write_operator_audit(
        str(user_id),
        "workflow.delete",
        f"Deleted {result.get('name')}",
        is_write=True,
        target_type="workflow_definition",
        target_id=str(definition_id),
        metadata={
            "slug": slug,
            "versions": result.get("versions"),
            "runs": result.get("runs"),
        },
        supabase=supabase,
    )
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


@router.post(
    "/generate",
    dependencies=[Depends(require_visible("workflow_authoring"))],  # Phase 148 (VIS-01) — authoring gate
)
async def generate_workflow(
    body: GenerateRequest,
    current_user: dict = Depends(get_current_user),
    # service-role: delegates to the out-of-scope workflow_authoring service (grounding
    # assembly reads spanning folders/templates/assets — not audited for RLS-readiness here).
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
