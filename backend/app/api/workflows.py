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

import io
import logging
import re
import zipfile
from typing import Annotated, Literal
from uuid import UUID, uuid4

import asyncpg
import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, File, Header, HTTPException, Query, UploadFile, status
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool
from supabase import Client

from app.config import settings
from app.dependencies import (
    canvas_caller,
    get_current_user,
    get_pg_pool,
    get_redis,
    get_supabase,
    get_user_supabase_client,
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
    get_definition,
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
# ``LINT_CODES`` rides the SAME import (WR-05): the severity classifier below composes its
# known-code set from the module that OWNS the codes rather than re-declaring the literals.
from app.services.harness.reachability import LINT_CODES, lint_workflow
# Phase 196 (AUTH-04 / SC#2 / D-09 / D-08) — the save-path model refusal. The LOGIC lives in
# the leaf; this module contributes two call lines, which is a call-out and not a second
# concern (see the G-5 note in 196-06-PLAN.md). Cycle-safe: model_registry imports app.config
# at module scope and its admin/user_settings collaborators FUNCTION-LOCALLY.
from app.services.model_registry import assert_phase_models_registered, unregistered_phase_models
from app.services.operator_service import write_operator_audit
# Phase 182 (CR-02) — the SAME owner-identity scrub every other folder/skill read path
# applies (folders.py:20,34 / kb.py:123 / skills.py:218-222; SEED-091 / D-164-05 / D-165-05).
# Imported at module level exactly as folders.py / kb.py do it; folder_utils is cycle-safe
# (it imports only app.utils.db).
from app.utils.folder_utils import _null_foreign_global_owner
# Phase 193 (AUTH-03) — the author-time template door REUSES the shipped upload gate
# rather than re-implementing it: ``validate_upload`` is the magic-byte/content
# validator (Phase 100 D-12, widened in 151 D-09) and ``MAX_FILE_SIZE`` / ``BUCKET_NAME``
# are the size cap and the Storage bucket the CONSUMER already reads from
# (``template_asset_service.resolve_template_source`` Branch 1). Importing the
# validator from ``app.api.workspace`` introduces no cycle — that module imports only
# db/dependencies/services/utils, never an api module.
from app.api.workspace import validate_upload
from app.services.workspace_service import BUCKET_NAME, MAX_FILE_SIZE
# Phase 193.1 (AUTH-03, D-05) — the stateless author-time read. Both symbols are PURE
# bytes/dict -> names (no DB, no Storage, no user scope), which is what makes a route
# that persists nothing cheap. ``placeholder_names_from_parsed`` is the SHARED assembly
# ``grounding.resolve_template_placeholders`` also calls, so the bound-template door and
# this one can never disagree about the same document. No cycle:
# ``template_render_service`` imports only re/typing/pydantic.
from app.services.template_render_service import (
    parse_docx_template_variables,
    placeholder_names_from_parsed,
)

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
    Harness dropdown) keep validating against the id/slug/name shape unchanged.

    Phase 192 (LIB-01 / D-04): ``is_mine`` + ``is_system_global`` are ADDITIVE and
    DEFAULTED, following the ``definition`` precedent — the 22 frontend references and
    the three production consumers (``WorkflowsPage.tsx``, ``panel/WorkspacePanel.tsx``,
    ``workflows/StarterTemplatePicker.tsx``) keep validating unchanged, and a frontend
    deployed AHEAD of this backend degrades to "nothing is mine" rather than crashing.
    They exist so the Workflows-page *Yours* and *Starters* chips filter client-side with
    honest SIMULTANEOUS counts instead of a ``?scope=mine`` server round-trip.

    BINDING RULE — ``is_mine`` IS COMPUTED SERVER-SIDE FROM THE AUTHENTICATED CALLER, AND
    A RAW ``created_by`` IS DELIBERATELY NOT PROJECTED ONTO THIS MODEL. ``list_published_
    workflows`` runs on a service-role asyncpg pool that BYPASSES RLS, so the predicate
    ``(is_system_global = true OR created_by = $1)`` is the ONLY boundary — whatever this
    model carries, the caller receives. A raw ``created_by`` is safe under TODAY's predicate
    (the sole non-caller rows are migration-seeded globals) and starts emitting other users'
    identifiers the moment a later phase widens it — and v3.4's co-tenant ``org_id`` /
    ``is_org_shared`` model is exactly that widening, with no code change here and no review.
    That is the mig-116 / CR-01 shape, applied prospectively. ``is_mine`` CANNOT widen: it
    discloses one bit about the caller themselves. ``is_system_global`` describes the ROW,
    never a person.

    Phase 192.1 (LIB-05 / D-15): ``updated_at`` is ADDITIVE and DEFAULTED on the same
    ``definition`` / ``is_mine`` precedent — a frontend deployed AHEAD of this backend reads
    ``undefined`` and renders no *changed* segment, which degrades rather than crashing. It
    feeds the library identity line's recency half ("changed 2 months ago").

    IT PASSES THE BINDING RULE ABOVE, FOR THE RULE'S OWN STATED REASON — it "describes the
    ROW, never a person", exactly as ``is_system_global`` does. It discloses WHEN a row the
    caller can ALREADY see last changed, and it can never begin emitting a second user's
    identifier however the predicate later widens. Recorded here so a reviewer meeting a new
    field on this model does not have to re-litigate it as the mig-116 / CR-01 shape.

    TYPED ``str``, NEVER ``datetime``, AND THE REASON IS THE ONE ``DraftCreateResponse.token``
    ALREADY BANKED (:184-188): a ``datetime``-typed field re-serializes through Pydantic and
    DROPS the fractional part when microseconds are 0, so the wire string's width would vary
    with the clock. Typing it ``str`` and calling ``.isoformat()`` in the builder makes the
    wire value exactly what the database returned.

    ⚠ D-17 — ON A PUBLISHED ROW THIS IS THE PUBLISH TIME, AND THAT IS HONEST, NOT A BUG.
    ``workflow_definitions_block_published`` (``full-schema.sql:3764``) makes a published row
    immutable, so its ``updated_at`` is frozen at the publish flip — which IS the last time
    it changed. Do NOT add a second field to "fix" this."""

    id: UUID
    slug: str
    name: str
    definition: dict | None = None
    is_mine: bool = False
    is_system_global: bool = False
    updated_at: str | None = None


def _caller_uuid(current_user: dict) -> UUID | None:
    """The authenticated caller's id as a ``UUID`` — the one coercion both feeds share.

    Phase 192 (D-04): ``get_published_workflows`` already normalises ``current_user["id"]``
    through ``UUID(...)`` when it is a ``str`` before handing it to the db layer. ``is_mine``
    must be computed IDENTICALLY in ``/published`` and ``/starters``, so the coercion lives
    in ONE place rather than being retyped per handler (a retyped coercion is how the two
    endpoints silently disagree). Returns ``None`` when the id is absent or unparseable, so
    ``is_mine`` degrades to ``False`` — never to a 500 on a read path the RUN CARVE-OUT
    protects.
    """
    raw = current_user.get("id")
    if isinstance(raw, UUID):
        return raw
    if isinstance(raw, str):
        try:
            return UUID(raw)
        except ValueError:
            return None
    return None


def _iso_or_none(raw: object) -> str | None:
    """A row's ``updated_at`` as an ISO-8601 ``str`` — the ONE coercion all THREE feeds share.

    Phase 192.1 (LIB-05 / D-15). It lives in one place for the reason ``_caller_uuid`` above
    does: ``updated_at`` is serialized by ``/published``, ``/starters`` AND ``/drafts``, and a
    coercion retyped per handler is how three endpoints silently come to disagree about the
    same column. asyncpg decodes ``timestamptz`` to a ``datetime``, so the live path is
    ``.isoformat()``.

    TYPED ``str`` ON THE WAY OUT, NEVER ``datetime``, AND THAT IS BINDING — see the field
    docblocks on ``PublishedWorkflow.updated_at`` and ``DraftRow.updated_at``. A
    ``datetime``-typed model field re-serializes through Pydantic and DROPS the fractional
    part when microseconds are 0, so the wire string's width would vary with the clock.
    Formatting HERE makes the wire value exactly what the database returned.

    Tolerates a ``str`` already (a hand-built row dict in a test, or a driver configured with
    a text codec) and answers ``None`` for a missing/NULL column, so a caller degrades to "no
    changed segment" rather than raising on a read path the RUN CARVE-OUT protects.
    """
    if raw is None:
        return None
    if isinstance(raw, str):
        return raw
    isoformat = getattr(raw, "isoformat", None)
    return isoformat() if callable(isoformat) else None


# ── Phase 103 (REQ-1 / WFAUTH-01) — draft CRUD response shapes ────────────────
class DraftCreateResponse(BaseModel):
    """The create/PATCH return — the new (or updated) draft id + its version.

    Phase 186 (CONCUR-02 / D-186-07): ``token`` is the ADDITIVE opaque optimistic
    concurrency token of the row AS OF THIS RESPONSE. On a PATCH it is the POST-write
    value, so the client chains its next autosave with no extra read. Old callers that
    ignore the field stay valid — nothing about ``id``/``version`` changed.

    TYPED ``str``, NEVER ``datetime``, AND THAT IS BINDING. A ``datetime``-typed field
    re-serializes through Pydantic, which DROPS the fractional part when microseconds are
    0 — the token width would then vary with the clock and a save could compare unequal to
    itself. The client echoes this string VERBATIM and must never parse it (a JS ``Date``
    truncates to milliseconds; probed, it matches 0 rows)."""

    id: UUID
    version: int
    token: str


class DraftRow(BaseModel):
    """A drafts-shelf row (the caller's own drafts — D-103-4).

    Phase 103-06 (REQ-7 D9/D10): ``definition`` is ADDITIVE so the drafts-shelf
    card can derive the tier badge + phase chain client-side; optional to keep the
    pre-103 id/slug/version/name shelf shape valid.

    Phase 186 (D-186-07): ``token`` is ADDITIVE too — the Open-a-draft path needs a
    concurrency token in hand before its first autosave, or that save would have to write
    unguarded. Same binding typing rule as ``DraftCreateResponse.token``: ``str``, never
    ``datetime``, never parsed.

    Phase 192.1 (LIB-05 / D-15): ``updated_at`` is ADDITIVE and DEFAULTED — the recency half
    of the library identity line. Typed ``str`` for the same Pydantic-drops-the-fraction
    reason recorded on ``DraftCreateResponse.token`` (:184-188), serialized via
    ``.isoformat()`` in the builder.

    ⚠ D-16 — THERE ARE TWO FIELDS HERE OFF ONE SOURCE COLUMN, AND THAT IS DELIBERATE.
    ``token`` is ``to_char(updated_at …)`` in disguise (``db/workflows.py:93-95``), so a
    reader will reasonably ask why ``updated_at`` is not simply parsed out of it. Because
    ``token`` is OPAQUE BY CONTRACT and parsing it is forbidden: Postgres keeps microseconds,
    a JS ``Date`` keeps milliseconds, and a parsed-and-re-rendered token matches ZERO rows —
    every later save then refuses as stale (probed live 2026-08-01). One field the server
    compares byte-for-byte; one the client may format. Never collapse them."""

    id: UUID
    slug: str
    version: int
    name: str | None = None
    definition: dict | None = None
    token: str
    updated_at: str | None = None


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
    # Phase 192 (D-04): the row's raw ``created_by`` is consumed HERE and dies HERE — it is
    # compared against the authenticated caller to produce one bit and is never assigned to a
    # response-model field. See PublishedWorkflow's binding rule.
    caller = _caller_uuid(current_user)
    # Phase 192.1 (D-15 / D-17): ``updated_at`` is projected by the widened SELECT.
    #
    # READ WITH ``r.get(...)``, NOT ``r[...]``, AND THE REASON IS A SHIPPED TEST RATHER THAN
    # A STYLE PREFERENCE. ``192.1-01-PLAN.md`` asked for ``r["updated_at"]`` so a
    # silently-dropped column would fail loudly; measured, that reading raises ``KeyError``
    # against ``test_row_dict_missing_both_columns_serializes_with_defaults``, which exists
    # to pin that a pre-192 row dict still flows through both handlers. Every sibling
    # optional column in this very expression (``definition``, ``created_by``,
    # ``is_system_global``) is already ``.get(...)``; only ``id``/``slug``/``name`` are
    # indexed. The "fail loudly" property the plan wanted is delivered INSTEAD by
    # ``test_workflows_updated_at.py``'s SELECT-list assertions, which fail in CI if the
    # column is ever dropped from the query — strictly earlier than a runtime ``KeyError``.
    #
    # ⚠ D-17 — FOR A PUBLISHED ROW THIS IS THE PUBLISH TIME, AND THAT IS THE HONEST ANSWER.
    # ``workflow_definitions_block_published`` (full-schema.sql:3764) makes a published row
    # immutable, so its ``updated_at`` is frozen at the publish flip. "changed <rel>" on a
    # published card therefore means "when it was published" — which IS when it last changed.
    # Do NOT add a second field to "fix" this.
    return [
        PublishedWorkflow(
            id=r["id"],
            slug=r["slug"],
            name=r["name"],
            definition=_coerce_definition(r.get("definition")),
            is_mine=(caller is not None and r.get("created_by") == caller),
            is_system_global=bool(r.get("is_system_global")),
            updated_at=_iso_or_none(r.get("updated_at")),
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
    # Phase 192 (D-04): ``is_mine`` is computed IDENTICALLY to /published, NOT hard-coded
    # ``False``. Under today's seeding it is always False here (mig 094 seeds ``created_by``
    # as the system user 00000000-0000-0000-0000-000000000001), but hard-coding would ship
    # that as an UNSTATED invariant — a later seeding change would make the field lie in
    # silence. Same fence as /published: the raw ``created_by`` dies in this expression.
    caller = _caller_uuid(current_user)
    # Phase 192.1 (D-15): ``updated_at`` is serialized here TOO, through the SAME
    # ``_iso_or_none`` helper /published uses. This is RESEARCH's correction C-6 in force —
    # ``PublishedWorkflow`` is ONE model serving TWO feeds, so a field added for the Published
    # shelf and not mirrored here would leave every Starters card silently missing its
    # "changed <rel>" segment while the type said it had one.
    return [
        PublishedWorkflow(
            id=r["id"],
            slug=r["slug"],
            name=r["name"],
            definition=_coerce_definition(r.get("definition")),
            is_mine=(caller is not None and r.get("created_by") == caller),
            is_system_global=bool(r.get("is_system_global")),
            updated_at=_iso_or_none(r.get("updated_at")),
        )
        for r in rows
    ]


# ══ Phase 182 (VALID-01) — the server VALIDATION SEAM ═════════════════════════
#
# G-5 RED LINE: these routes join THIS router (api/workflows.py), NEVER api/threads.py.
#
# THE ANTI-DRIFT CONTRACT (D-182-02 / D-182-06 / red line D-14): the visual canvas is a
# pure CLIENT of this seam. Every rule it previews is the SAME copy the publish gauntlet
# enforces — and the claim is VERIFIABLE, one row per check, shared symbol -> publish stage:
#
#   preview check (here)                              shared symbol                    publish stage
#   ------------------------------------------------  -------------------------------  --------------------
#   structural lint                                   ``lint_workflow``                ``lint``
#   grounding fidelity                                ``grounding.grounding_verdicts`` ``grounding_fidelity``
#   business requirement present (D-13)               ``grounding.business_requirement_missing``
#                                                                                      ``business_requirement``
#   interactive phase cannot publish (WR-04)          ``publish_service._interactive_phase_failures``
#                                                                                      ``interactive_phase``
#
# PROVENANCE: the grounding-fidelity half of that parity was added in the Phase 182 GAP
# CLOSURE (plan 182-06). At first ship this seam PREVIEWED grounding fidelity while
# ``publish_workflow`` did not ENFORCE it, so a definition naming a hallucinated tool or an
# inaccessible skill reference painted red here and published green
# (``182-VERIFICATION.md`` Truth 5 / WR-01). ``publish_service`` now runs the same collector
# at stage 2.6; ``tests/unit/test_182_publish_grounding_stage.py`` asserts the two sides
# report the SAME findings for the same definition, so the parity cannot silently rot again.
#
# SAME RULES **AND** SAME FAILURE POSTURE (round-2 gap closure — WR-02). The row-per-check
# table above was only half the claim: until this plan the two sides shared the rules but had
# OPPOSITE postures when a grounding read FAILED — publish returned a structured
# ``grounding_unavailable`` block while this route let a ``postgrest`` ``APIError`` escape as
# an HTTP 500, and this is the route that fires on every canvas edit. Both sides now branch on
# the SAME ``GroundingBundle.degraded`` signal and mint the SAME finding from the SAME builder
# (``grounding.grounding_unavailable_finding``), so "one shared copy" covers what happens when
# the shared copy cannot run.
#
# NOTHING is re-implemented here and NOTHING is ever re-implemented client-side;
# the route only AGGREGATES and CLASSIFIES. `/validate` is READ-ONLY advice — it never
# persists, never executes, and never mints a version; PUBLISH remains the enforcing gate.
#
# GATE (D-182-05, Pitfall 3): both routes carry ``Depends(require_canvas())`` **ALONE** — a
# byte-identical 404 when ``visual_workflow_canvas`` is off, for EVERYONE incl. operators,
# resolved PRE-AUTH. They must NEVER stack ``require_visible`` (which raises 403 and would
# leak that the route exists) nor couple canvas availability to another feature's audience.
# WR-08 (round-2 gap closure): that gate is also where the caller is RESOLVED. It publishes the
# validated identity on ``request.state.canvas_caller`` and both handlers read it back through
# ``Depends(canvas_caller)`` — so the token is validated ONCE per request, not twice (the old
# ``Depends(get_current_user)`` form re-validated the same token the gate had just accepted, at
# 2 GoTrue round-trips + 2 ``auth.users`` ban queries per canvas edit). ``canvas_caller`` fails
# CLOSED to the SAME 404, so the hand-off can never soften the gate.
#
# ROUTE ORDERING: declared as explicit STATIC segments HERE, ahead of every ``/{definition_id}``
# route below (the ``/drafts`` / ``/starters`` precedent), so no present or future path param
# can shadow them. ``_coerce_user_id`` is defined further down at module level and resolved
# at request time.
class Verdict(BaseModel):
    """One static-gauntlet finding, per-node (SC#4).

    ``code`` is the machine literal, and every one of them is OWNED by the module that emits
    it (WR-05): the 5 ``reachability.LINT_CODES`` values, the 3
    ``grounding.GROUNDING_VERDICT_CODES`` values (``folder_scope`` / ``unregistered_tool`` /
    ``unregistered_skill``), and the 3 ``_ROUTE_ASSIGNED_CODES`` this route mints itself
    (``business_requirement`` / ``interactive_phase`` / ``unbound_retrieval``). ``phase`` is
    the phase ``slug`` — the
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
    # Phase 185 (D-185-09 / GOVERN-01) — the KB-READING tool names. The client intersects
    # this with a phase's ``available_tools`` so the grounding dial, the strike-through on the
    # loose side and the canvas seal all move on the SAME render as a tool chip: no debounce,
    # no reload, and no network hop just to print a refusal reason.
    #
    # THE CLIENT NEVER ENFORCES. Req 4's run-time gate is unconditional and server-side, so a
    # wrong client read is a DISPLAY bug by construction and never a safety hole. What the
    # client must not do is own the LIST — a hardcoded frontend copy is a second copy of the
    # safety-defining names, and the day a 6th KB tool lands backend-side the canvas silently
    # stops marking it (the exact drift D-182-06's RED LINE was written against).
    #
    # NOT filtered by ``tools``, and NOT suppressed when ``degraded`` is non-empty: this is the
    # safety-DEFINING list, not a per-caller registry read, and a degraded folder/skill read
    # must never silently un-mark a locked step.
    kb_tools: list[str] = Field(default_factory=list)
    # CR-02: EXPLICIT per-row models, never ``list[dict]``. A bare ``list[dict]`` shipped the raw
    # ``folders``/``skills`` DB rows verbatim — leaking ``org_id`` + the seeding owner's
    # ``user_id`` on a brand-new surface, bypassing the projection every sibling read applies.
    folders: list[PaletteFolder] = Field(default_factory=list)
    skills: list[PaletteSkill] = Field(default_factory=list)
    template_placeholders: list[str] = Field(default_factory=list)
    # Round-3 CR-02 / verification Truth 8: the names of the registries that could NOT be
    # resolved for this request (``"folders"`` / ``"skills"``), sorted for a stable payload.
    # EMPTY is the only value that means "this palette is complete".
    #
    # Without this field the route was a LIAR AT SCALE, and specifically a liar this phase
    # introduced: plan 182-11 moved the folders/skills read failure OUT of an exception
    # (a loud 500 the canvas could not mistake for data) and INTO ``GroundingBundle.degraded``
    # — a field this handler then never read. A PostgREST blip therefore rendered as
    # ``{"folders": [], "skills": []}`` at HTTP 200: byte-indistinguishable from an author who
    # genuinely owns nothing, on the exact surface whose whole job is to tell the canvas which
    # building blocks are valid. The canvas would have drawn empty dropdowns and the author
    # would have concluded their KB was gone. Degrading LOUDLY is the same contract
    # ``/validate`` already keeps with ``grounding_unavailable`` — "we could not check" is a
    # different sentence from "there is nothing", and the palette must be able to say it.
    degraded: list[str] = Field(default_factory=list)


# ══ The severity taxonomy (D-182-03) — COMPOSED from the owning modules ══════════
#
# Hard structural + grounding-fidelity breaks are ERRORS; not-yet-ready conditions
# (``input_unsatisfied`` while wiring, a missing business requirement, an interactive
# phase, an empty draft) are INCOMPLETE.
#
# WR-05 (``182-VERIFICATION.md``): this block used to be a hardcoded ``frozenset`` of 6
# string literals copied out of ``reachability`` + ``grounding``, with ``_severity``
# returning the soft ``incomplete`` for anything it did not recognise. Both halves are now
# fixed — the known set DERIVES from the modules that OWN the codes, and the unknown branch
# fails LOUD (see ``_severity``). The composition, one row per owner:
#
#   ``reachability.LINT_CODES``           — the 5 structural codes ``lint_workflow`` emits
#   ``grounding.GROUNDING_VERDICT_CODES`` — the 3 fidelity codes ``grounding_verdicts`` emits
#   ``_ROUTE_ASSIGNED_CODES``             — the 3 codes THIS route mints itself
#
# ``tests/unit/test_182_severity_codes.py`` SCANS the two owning modules' emit sites and
# fails if a published set drifts from what its functions can really emit. That guard is
# load-bearing: a failures-only test differential cannot see a code that was added without
# ever being classified, because nothing was ever asserting about it.
#
# NO LONGER PUBLISH-ONLY (round-2 gap closure — WR-01 / WR-02). This block used to say
# ``grounding_unavailable`` "cannot reach this classifier" because only publish minted it.
# That is now FALSE: BOTH consumers of the shared collector mint it, from the ONE builder
# ``grounding.grounding_unavailable_finding``, and ``/validate`` emits it whenever a grounding
# read is unresolvable. It is composed in below as ``_DEGRADED_CODES``.
#
# It is an INFRASTRUCTURE-HONESTY code, not a rule finding — which is why it lives in neither
# owning module's verdict set (``grounding_verdicts`` does not emit it) and why it classifies
# ``error``: an unverifiable definition must not look publishable. "We could not check" must
# never paint the soft ``incomplete``, or the canvas would say "still building" while publish
# says "blocked". Its STRING lives in ``grounding.py`` so neither consumer carries a literal.

# The three codes the ROUTE mints itself — no owning module emits them:
#   ``business_requirement`` — minted in ``validate_workflow`` from
#                              ``grounding.business_requirement_missing(body)`` being True
#   ``interactive_phase``    — minted in ``validate_workflow``'s
#                              ``publish_service._interactive_phase_failures(body)`` loop
#   ``unbound_retrieval``    — minted in ``validate_workflow``'s stage (5) loop over
#                              ``grounding.grounding_cause(phase) == "detected"`` while
#                              ``body.project_folder_id is None`` (Phase 187 / D-187-11)
#
# WHY THE ROUTE AND NOT ``grounding.grounding_verdicts`` (D-187-11)
# ─────────────────────────────────────────────────────────────────
# (1) WHAT IS TRUE, AND WHY THE ROUTE IS STILL THE RIGHT HOME. That collector is SHARED with
#     publish — plan 182-06 made the publish gate ENFORCING through it — so any rule added
#     there becomes a hard SERVER publish blocker, evaluated inside the gauntlet, on a code
#     path no client can influence. These three codes are deliberately NOT there, and the
#     consequence really does hold: the server's publish gate runs exactly the stages it ran
#     before D-187-11, and none of them can emit a route-assigned code.
#
# (2) WHAT WAS FALSE HERE UNTIL PLAN 187-28, AND IS NOW CORRECTED. This block used to claim
#     that a route-assigned verdict was confined to the canvas and therefore left publishing
#     untouched from the AUTHOR'S SEAT. Measured live on 2026-08-04, that is wrong. The
#     Builder's ``blockedReason`` memo (``frontend/src/pages/WorkflowBuilderPage.tsx``)
#     returns the FIRST verdict's message for ANY not-ok envelope — it prefers an ``error``
#     finding but falls back to ``verdicts[0]``, so an ``incomplete``-ONLY response is not
#     exempt — and that string is handed straight to the Publish control's ``disabled`` +
#     ``aria-describedby``. A draft whose SOLE verdict is ``unbound_retrieval`` therefore
#     renders a DISABLED ``publish-trigger`` with this route's own message beside it.
#     ⇒ A route-assigned code DOES gate the Publish BUTTON.
#
# (3) THAT IS INTENDED, NOT A LEAK (operator decision, 2026-08-04). Blocking an unbound
#     retrieval workflow BEFORE a golden run is spent is precisely what
#     ``.planning/reported-bugs/BUG-260731-03-*`` asked for. The distinction that survives —
#     and the one the next reader must not collapse again — is:
#       * the SERVER publish GATE  — unchanged by these codes, because they are not in the
#                                    shared collector;
#       * the CLIENT publish CONTROL — gated by them, because ``/validate``'s envelope is
#                                    exactly what greys that button.
#     "The route is the seam that keeps a verdict out of the server gate" is the true claim.
#     "The route is the seam that keeps a verdict away from the author's Publish button" is
#     the false one, and it is not reproduced verbatim anywhere in this module ON PURPOSE:
#     ``tests/unit/test_187_route_assigned_reach.py`` pins its absence by scanning this
#     file's source, and quoting the old sentence in order to explain it would satisfy that
#     pin and disarm it. The original wording is preserved in history at commit ``a68132db``.
#
# (4) WHERE THIS IS MEASURED, so the paragraph points at evidence instead of asserting a
#     property on its own authority (the WR-14 lesson, same shape plan 187-24 used):
#       * the TRUE half  — ``backend/tests/unit/test_187_route_assigned_reach.py``: no member
#         of ``_ROUTE_ASSIGNED_CODES`` reaches ``grounding.GROUNDING_VERDICT_CODES`` or is
#         emitted by ``grounding.grounding_verdicts`` for any constructible input.
#       * the GATED half — ``frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx``
#         ("187-28 — a route-assigned verdict GATES the Publish control"): an ``ok:false``
#         whose sole verdict is an ``incomplete`` route-assigned code yields a non-null
#         ``publish-blocked-reason`` equal to the server's message verbatim, and a disabled
#         ``publish-trigger``.
_ROUTE_ASSIGNED_CODES: frozenset[str] = frozenset(
    {
        "business_requirement",
        "interactive_phase",
        "unbound_retrieval",
    }
)

# The NOT-YET-READY set (D-182-03): the author is still building, not broken. A product
# decision, so these stay literals — deriving them would make the taxonomy unreadable.
_INCOMPLETE_CODES: frozenset[str] = frozenset(
    {
        "input_unsatisfied",
        "business_requirement",
        "interactive_phase",
        # D-187-11: an unbound retrieval workflow is UNFINISHED, not broken — the author has
        # not yet said which corpus this is about. BOTH registrations are required: this one
        # AND ``_ROUTE_ASSIGNED_CODES`` above. ``_ERROR_CODES`` is DERIVED by subtraction, so
        # a code registered in neither lands in the error bucket and ``_severity`` logs a
        # fail-loud warning on EVERY canvas edit — the opposite of the grey "still building"
        # this verdict is for.
        "unbound_retrieval",
    }
)

# ``no_terminal`` is DUAL-SOURCE (Pitfall 2) — resolved by the split inside ``_severity``
# BEFORE any set lookup, so it belongs to neither bucket.
_DUAL_SOURCE_CODES: frozenset[str] = frozenset({"no_terminal"})

# The DEGRADED bucket: "we could not CHECK" (WR-01 / WR-02). Sourced from ``grounding.py`` so
# the string exists in exactly one place. Deliberately NOT added to ``_INCOMPLETE_CODES`` —
# subtracting the two soft buckets from the widened ``_KNOWN_CODES`` below drops it into the
# derived error bucket automatically, which is the required classification.
_DEGRADED_CODES: frozenset[str] = frozenset({grounding.GROUNDING_UNAVAILABLE_CODE})

# Everything ``/validate`` knows how to classify.
_KNOWN_CODES: frozenset[str] = (
    LINT_CODES | grounding.GROUNDING_VERDICT_CODES | _ROUTE_ASSIGNED_CODES | _DEGRADED_CODES
)

# DERIVED, never listed: every known code that is neither a still-building condition nor
# the dual-source one is a hard break. Keeping the ``_ERROR_CODES`` name so any existing
# reference still resolves — but there is no longer a literal to drift.
_ERROR_CODES: frozenset[str] = _KNOWN_CODES - _INCOMPLETE_CODES - _DUAL_SOURCE_CODES


def _severity(code: str, *, phases_empty: bool) -> str:
    """Classify a verbatim check's finding — the route's ONLY interpretive step (D-182-03).

    ``no_terminal`` is emitted by ``lint_workflow`` from TWO different situations (Pitfall 2):
    ``phases == []`` (an empty draft — the author is still building) and an unreachable
    terminal (a genuinely broken graph). Same code, split severity, distinguished by the
    definition the route already holds — so an empty canvas paints grey "still building",
    never red "broken".

    FAILS CLOSED on an UNRECOGNISED code (WR-05). This function used to end in a bare,
    unconditional SOFT default, so a code nobody had classified painted grey "still building"
    on the canvas — and the author would then hit a hard publish BLOCK they were never warned
    about. Failing loud instead (red, plus a logged warning naming the code) is strictly the
    safer error: a wrongly-RED verdict is visible and gets fixed, a wrongly-GREY one is
    invisible.

    That branch is a LIVE path, not a theoretical one — Phase 184 and Phase 185 both add
    verdict codes (185 adds the GOVERN per-node grounding-mode verdict, ROADMAP SC#4).
    """
    # (1) the dual-source split, resolved BEFORE any set lookup.
    if code in _DUAL_SOURCE_CODES:
        return "incomplete" if phases_empty else "error"
    # (2) still building.
    if code in _INCOMPLETE_CODES:
        return "incomplete"
    # (3) broken.
    if code in _ERROR_CODES:
        return "error"
    # (4) UNKNOWN — fail LOUD, never soft (WR-05).
    logger.warning(
        "POST /workflows/validate: unrecognised verdict code %r — classifying it as 'error' "
        "(fail-closed). Add it to the canonical set of the module that emits it "
        "(reachability.LINT_CODES / grounding.GROUNDING_VERDICT_CODES / "
        "workflows._ROUTE_ASSIGNED_CODES) and, if it is a still-building condition rather "
        "than a break, to workflows._INCOMPLETE_CODES.",
        code,
    )
    return "error"


@router.post(
    "/validate",
    response_model=ValidateResponse,
    dependencies=[Depends(require_canvas())],  # D-182-05 — require_canvas ALONE (never require_visible)
)
async def validate_workflow(
    body: WorkflowDefinition,
    # WR-08: ``require_canvas`` above ALREADY validated this bearer token and published the
    # identity on ``request.state.canvas_caller``. Consume it — do NOT re-run get_current_user,
    # which cost a 2nd GoTrue round-trip + a 2nd auth.users ban query on every canvas edit.
    current_user: dict = Depends(canvas_caller),
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
      5. ``grounding.grounding_cause`` × ``project_folder_id`` — the D-187-11 unbound-retrieval
                                                      check, the ONE rule on this route that
                                                      publish does NOT also run (see
                                                      ``_ROUTE_ASSIGNED_CODES``)

    The golden run + judge (publish stages 3-4) are LIVE-only and deliberately NOT here —
    ``/validate`` is a static, no-provider, read-only surface called on every canvas edit.

    ALWAYS HTTP 200 with the machine-renderable envelope: a dirty definition is not an HTTP
    error, it is advice. A malformed/injected body key is a 422 for free (``WorkflowDefinition``
    is ``extra='forbid'``) — the SHAPE tier, never relaxed to a lenient dict (V5). A phase
    declaring ``folder_scope`` on an unbound workflow also 422s at the shape tier (the
    ``@model_validator``), so it never reaches this handler; an empty ``phases: []`` IS
    shape-valid and lands here as an ``incomplete`` ``no_terminal``.

    THAT PROMISE IS NOW ENFORCED FOR THE TWO GROUNDING I/O STAGES (round-2 gap closure —
    WR-02). Until this plan nothing enforced it: a real ``postgrest`` ``APIError`` from either
    the palette read or the ⊆ walk escaped as an HTTP 500 (``APIError`` is not a
    ``ValueError``, so the ⊆ rule's catch never saw it) — while the SAME collector on the
    publish side returned a structured block. Both stages are wrapped now and degrade to the
    honest ``grounding_unavailable`` verdict at severity ``error``: ``ok`` is never ``True``
    when a check did not run, and a degraded read is never dressed up as a rule finding.

    THE SEAL IS SCOPED, AND ITS BOUNDARY IS RECORDED. What remains is SEED-131 / SEED-132 and
    stays DEFERRED to Phase 184: the envelope-level design question (a top-level ``degraded``
    marker or a third severity, instead of a verdict code), the ``@model_validator`` 422s that
    bypass this envelope before the handler is even entered, and a contract test enforcing
    always-200 across the WHOLE handler rather than across the grounding stages only.
    """
    user_id = _coerce_user_id(current_user)

    findings: list[dict] = []

    # (1) structural lint — the verbatim pure check. Mapped to the SAME dict shape publish
    # renders its lint block with (publish_service: {"code", "phase", "message"}).
    #
    # WHY THE PURE CHECKS LIVE OUTSIDE THE SEAL BELOW: lint, the D-13 business-requirement
    # invariant and the interactive-phase check need NO registry and cannot fail, so a
    # registry blip must cost the author the three GROUNDING rules only — not the whole
    # validation. A blanket try/except around the handler body would discard results that
    # were computed perfectly well (and a blanket ``except`` returning ``ok: True`` would be
    # strictly WORSE than the 500 it replaced — it paints a possibly-broken workflow green).
    findings.extend(
        {"code": e.code, "phase": e.phase_slug, "message": e.message}
        for e in lint_workflow(body)
    )

    # (2) grounding fidelity — the per-node collector over the ONE shared rule copy.
    # SEALED (WR-02): the ONLY two DB-backed stages on this route are the registry read and
    # the collector (whose rule 1 walks the project subtree), and both are wrapped here.
    try:
        # ONE registry read for the whole request (the palette the fidelity rules test
        # against). ``project_folder_id`` is deliberately not passed: a bound project narrows
        # only the per-phase folder_scope ⊆ check (which reads it off the definition itself)
        # and the NL prose line — never the palette.
        bundle = await grounding.assemble_grounding_bundle(
            supabase=supabase,
            user_id=str(user_id),
        )
        if bundle.degraded:
            # WR-01: an unresolved registry makes every membership test vacuously false, so
            # running the fidelity rules here would report the author's VALID tool names and
            # skill references as unregistered — a factual accusation manufactured out of an
            # outage. Skip them entirely and say what is actually true.
            findings.append(grounding.grounding_unavailable_finding(bundle.degraded))
        else:
            findings.extend(
                await grounding.grounding_verdicts(
                    body,
                    supabase=supabase,
                    user_id=str(user_id),
                    tool_names=bundle.tool_names,
                    skill_ids=bundle.skill_ids,
                )
            )
    except Exception:  # noqa: BLE001 — this route is documented ALWAYS HTTP 200
        logger.warning(
            "POST /workflows/validate: grounding could not be resolved; returning the "
            "structural verdicts plus an honest %r verdict instead of a 500",
            grounding.GROUNDING_UNAVAILABLE_CODE,
            exc_info=True,
        )
        findings.append(grounding.grounding_unavailable_finding())

    # (3) the D-13 business-requirement invariant — same predicate publish stage 1 calls,
    # same named-failure prose.
    if grounding.business_requirement_missing(body):
        findings.append(
            {
                "code": "business_requirement",
                "phase": None,
                # ONE source with publish stage 1 — see the constant's docblock.
                "message": grounding.BUSINESS_REQUIREMENT_MISSING_MESSAGE,
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

    # (5) D-187-11 — the unbound-retrieval check (BUG-260731-03, the verdict half). A step
    # that READS the knowledge base while the workflow is bound to no folder searches
    # EVERYTHING: at report time, 40+ documents across 10 unrelated corpora. It is a pure,
    # registry-free, structural property of the definition, so it lives OUT here with lint and
    # the D-13 invariant rather than inside the sealed grounding block above.
    #
    # WHY DETERMINISTIC, AND WHY AT AUTHOR TIME. This condition already had a gate: the
    # publish gauntlet's judge. `BUG-260731-03` measured it PASSING a worse deliverable
    # (11 files / 5+ folders) than the one it FAILED (3 files / 3 folders) an hour apart, on
    # the same defect. A hard wall that fails open under variance is not a control for this
    # failure mode — and the judge only speaks after a full golden run has been spent, about
    # the SYMPTOM (bad citations) rather than the CAUSE (no scope). Scope-boundness is
    # structural, so the answer here is the same every time.
    #
    # ``grounding.grounding_cause`` is the ONE home of the KB-tool intersection (its
    # ``KB_TOOLS`` docblock says why a second copy is a safety hole, not a duplication smell).
    # A local tool tuple here would silently stop marking the day a 6th KB tool lands. It is
    # PURE and does zero I/O, so calling it needs no pool and cannot fail.
    #
    # INCOMPLETE, not error, and the message says a FACT plus a CONSEQUENCE — never "unsafe"
    # and never "blocked". The author is still building; they have not yet said what this
    # workflow is about.
    if body.project_folder_id is None:
        findings.extend(
            {
                "code": "unbound_retrieval",
                "phase": phase.slug,
                "message": (
                    f"phase '{phase.slug}' reads your documents, but this workflow is not "
                    "bound to a knowledge base — it would search everything"
                ),
            }
            for phase in body.phases
            if grounding.grounding_cause(phase) == "detected"
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
    # WR-08: ``require_canvas`` above ALREADY validated this bearer token and published the
    # identity on ``request.state.canvas_caller``. Consume it — do NOT re-run get_current_user,
    # which cost a 2nd GoTrue round-trip + a 2nd auth.users ban query on every canvas edit.
    current_user: dict = Depends(canvas_caller),
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
        # Read off the SHARED bundle, NEVER recomputed here — the same discipline the
        # ``degraded`` comment below enforces. ``assemble_grounding_bundle`` stays the ONE
        # computation, so this route cannot drift from the rule the engine enforces.
        kb_tools=bundle.kb_tools,
        folders=bundle.folders,
        skills=bundle.skills,
        template_placeholders=bundle.placeholders,
        # The SAME ``bundle.degraded`` branch ``validate_workflow`` makes (:575), at the SAME
        # seam, from the SAME shared collector — this route was the one consumer that read the
        # bundle's data fields but not its honesty field. Nothing is filtered or synthesized
        # here: whatever DID resolve is still served (a skills-read failure must not blank the
        # folder tree), and ``degraded`` names only what did not.
        degraded=sorted(bundle.degraded or ()),
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

    Enforces, IN ORDER (the same order as ``publish_service.publish_workflow``'s stage list —
    the two docstrings must never disagree): business_requirement present -> structural lint
    -> the interactive-phase pre-run block (WR-04) -> grounding fidelity (Phase 182 stage 2.6,
    the SAME shared collector ``POST /workflows/validate`` previews) -> a REAL golden run on
    the project KB -> the judge verdict -> the draft->published flip. A lint-clean workflow
    whose judge fails CANNOT publish.

    The orchestration lives in ``publish_service.publish`` (owner-scoped via
    ``get_definition``). HTTP mapping:
      - ``not_found`` (not owned / does not exist) -> 404 (no existence leak, V4)
      - ``already_published`` -> 409
      - ``business_requirement`` (D-13) -> 400 with the structured verdict
      - any other block -> 200 ``{published: False, blocked_stage, named_failures, golden_run_id}``
      - success -> 200 ``{published: True, version, golden_run_id}``

    ``grounding_fidelity`` and ``draft_changed`` (like ``lint`` and ``interactive_phase``)
    are UNRECOGNISED ``blocked_stage`` values for the branches above, so they fall through
    to the 200 + structured verdict — a new stage needs NO route branch here, only this
    docstring. The newest of them (Phase 186 / D-186-10) means the draft was edited while
    the gauntlet was running, so the token captured at stage 0 no longer matched and the
    flip was refused. It is deliberately NOT folded into the ``already_published`` 409:
    that would tell the author somebody else published their workflow, which is false, and
    would hide the one fact that tells them what to do next — their own newer edit. 200 +
    ``{published: False, blocked_stage, golden_run_id}`` is the honest answer, and the
    golden run stays browsable.

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


# Phase 186 (D-186-09): the published-row 409 keeps its shipped, operator-verified
# SENTENCE and its shipped STATUS; only its SHAPE changes, from a bare string to an
# object, so the client can branch on a machine code instead of matching prose. One
# constant because the same refusal is raised from two places (the ``already_published``
# cause and the CheckViolationError race backstop) and two spellings of one locked string
# is how a locked string stops being locked.
_ALREADY_PUBLISHED_DETAIL = {
    "code": "already_published",
    "message": "workflow is published and cannot be modified",
}


# DRAFT ROUTES ARE DELIBERATELY NOT GROUNDING-GATED (Phase 182 plan 06 — a DECISION, not an
# oversight). Neither ``create_draft`` below nor ``update_draft`` further down runs the
# grounding-fidelity checks: a work-in-progress draft must stay storable while incomplete, or
# the Phase 184 canvas editing loop becomes hostile — every save that outruns its node config
# would be rejected mid-authoring. ``POST /workflows/validate`` is the live ADVISORY surface
# (read-only, per-node verdicts, no persistence) and PUBLISH is the ENFORCING gate: nothing
# mints a version without passing publish stage 2.6. Do not "fix" this by adding a check here.
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
    # SC#2 / D-09: refuse a model this deployment does not know, BEFORE the write. A create
    # has no prior definition, so there is nothing to grandfather (D-08) and every
    # unregistered value is refused.
    await assert_phase_models_registered(body)
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
            token=r["token"],  # Phase 186 — the shelf hands the builder a token
            # Phase 192.1 (D-15 / D-16): a SEPARATE field, deliberately NOT derived from
            # ``token`` on the line above — the two are the same source column and the token
            # is opaque by contract. See DraftRow's docblock for why collapsing them breaks
            # every subsequent save.
            updated_at=_iso_or_none(r.get("updated_at")),
        )
        for r in rows
    ]


# NOT grounding-gated either — see the decision recorded above ``create_draft`` (Phase 182
# plan 06): drafts stay storable while incomplete; PUBLISH is the enforcing gate.
@router.patch(
    "/{definition_id}",
    response_model=DraftCreateResponse,
    dependencies=[Depends(require_visible("workflow_authoring"))],  # Phase 148 (VIS-01) — authoring gate
)
async def update_draft(
    definition_id: UUID,
    body: WorkflowDefinition,
    current_user: dict = Depends(get_current_user),
    # ``Annotated[...] = None``, NOT ``= Header(default=None, ...)``, and the difference is
    # load-bearing HERE: this repo's shipped route tests call route functions DIRECTLY
    # (``test_workflows_routes.py:111-144``), and with the ``= Header(...)`` form FastAPI
    # never runs, so the parameter arrives as the unresolved ``Header`` FieldInfo object
    # itself — truthy, not ``None``, and passed straight to asyncpg as the token bind
    # (observed: ``DataError: expected str, got Header``). The Annotated form makes the
    # DEFAULT a plain ``None``, so a direct call takes the unguarded branch exactly as an
    # absent header does over HTTP.
    if_match: Annotated[str | None, Header(alias="If-Match")] = None,
) -> DraftCreateResponse:
    """Update a DRAFT (REQ-1 PATCH) — returns ``{id, version, token}``.

    THE CONCURRENCY TOKEN RIDES IN ``If-Match``, NOT IN THE BODY (Phase 186 / D-186-07).
    ``WorkflowDefinition`` is ``extra='forbid'`` and the token is TRANSPORT METADATA, not
    part of the definition (D-14 — no second source of truth): a token key in the body
    would 422 today and would be persisted into the ``definition`` JSONB if it did not.
    A wrapper body model was the alternative and was rejected — it is a breaking shape
    change to every caller and every test that PATCHes a bare definition.

    ``If-Match`` IS OPTIONAL FOR ONE RELEASE, DELIBERATELY. An absent header means exactly
    today's unguarded behaviour. Requiring it would break every browser tab that was open
    across the deploy on its very next save. The client always sends one, so the unguarded
    path is reachable only by a pre-deploy tab or a non-browser caller. THIS IS A DATED
    CONCESSION, NOT THE END STATE — the header is expected to become required once no
    pre-186 client can still be running.

    Three named refusals (D-186-09), and the 404 is deliberately the dullest of them:
      - ``not_found`` (missing OR not-owned) -> **404** with the UNCHANGED string detail
        ``draft not found``. It gets NO machine code: a coded 404 would let a caller
        tell "no such workflow" from "someone else's workflow", i.e. an existence oracle
        (T-186-01-03). Not-found and not-owned must stay byte-identical.
      - ``already_published`` -> **409**, today's sentence, now object-shaped so the
        client can stop string-matching prose. NOTE this is a deliberate STATUS change
        from the pre-186 404: the 0-row write is now disambiguated by an owner-scoped
        probe instead of collapsing to "not found" (test_103_published_409.py pins it).
      - ``stale_token`` -> **409** with the CURRENT token attached, so D-186-08's
        "overwrite with what's on screen" is ONE more PATCH rather than a re-read plus a
        PATCH. Disclosing it leaks nothing: the disambiguating probe is owner-scoped, so
        the caller already owns the row (T-186-01-04, accepted).

    A published-row PATCH also hits the immutability trigger (Postgres ``23514``) when the
    ``status='draft'`` conjunct loses a race with a concurrent publish; we still catch
    ``asyncpg.exceptions.CheckViolationError`` -> HTTP 409, never a silent overwrite or a
    500 (T-103-01-02 / T-186-01-06). ``definition_id`` is a path ``UUID`` -> FastAPI 422 on
    a malformed id.
    """
    pool = await get_pg_pool()
    user_id = _coerce_user_id(current_user)
    body = body.model_copy(update={"status": "draft"})
    # SC#2 / D-09 / D-08 — AFTER ownership, BEFORE the write. Lazy: the stored row is read
    # only when the body actually carries an unregistered model (measured 2026-08-18: 0 of
    # 257 stored phases), so an ordinary autosave costs no extra query. ⚠ A row this caller
    # does not OWN falls through to the write below rather than raising, so the 400 can
    # never distinguish "not yours" from "bad model" — the 0-row UPDATE answers with today's
    # byte-identical dull 404 (T-196-ORACLE). ``previous`` is D-08's grandfather.
    if await unregistered_phase_models(body):
        stored = await get_definition(pool, definition_id, user_id=user_id)
        if stored is not None and str(stored.get("created_by")) == str(user_id):
            await assert_phase_models_registered(
                body, previous=_coerce_definition(stored.get("definition"))
            )
    try:
        row = await update_workflow_definition(
            pool, definition_id, definition=body, user_id=user_id, token=if_match
        )
    except asyncpg.exceptions.CheckViolationError:
        # Same concept, same shape as the ``already_published`` refusal below — one
        # object for one meaning, so the client branches on ``code`` in both cases.
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=_ALREADY_PUBLISHED_DETAIL,
        )

    if not row.get("ok"):
        cause = row.get("cause")
        if cause == "already_published":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=_ALREADY_PUBLISHED_DETAIL,
            )
        if cause == "stale_token":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                # THE CLIENT BRANCHES ON ``code``, NEVER ON THIS PROSE. The message is
                # for a human reading a log; rewording it must never change behaviour.
                detail={
                    "code": "stale_token",
                    "message": "this draft was changed somewhere else since you loaded it",
                    "token": row.get("token"),
                },
            )
        # ``not_found`` — and any cause this route does not recognise — fails closed to
        # the dullest answer there is. A new refusal cause must be mapped deliberately.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="draft not found")

    # Constructed FIELD BY FIELD, never ``DraftCreateResponse(**row)``: the refusal-aware
    # dict carries an ``ok`` key that has no business reaching the wire model.
    return DraftCreateResponse(id=row["id"], version=row["version"], token=row["token"])


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

    THIS 409's DETAIL STAYS A BARE STRING, ON PURPOSE (Phase 186). A delete is not on the
    autosave path, so it has no concurrency token and no stale-vs-published ambiguity to
    resolve — object-shaping it would be churn for a distinction that does not exist here.
    The client's defensive default covers the asymmetry: a 409 whose body has no ``code``
    falls back to today's ``WorkflowConflictError``. Read as a DECISION, not an oversight.
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
        # ⚠ L-02 (2026-08-16) — ``r.parent_run_id IS NULL``, the IDENTICAL narrowing
        # CR-01 shipped for this exact join in ``api/runs.py`` (its cancel fallback).
        # Without it this LEFT JOIN can bind ``producer_id`` to a SUB-AGENT: sub-agent
        # runs live on the SAME thread with the SAME ``'streaming'`` status
        # (``task_service.py``'s ``insert_run`` writes ``parent_run_id=parent_ctx.run_id``),
        # so ``delete_workflow_cascade`` could cancel a sub-agent, leave the real
        # producer running, and report success — the same silent-success class CR-01
        # removed one route away. Pre-existing and owner-scoped, so never a
        # cross-tenant exposure; a correctness defect, not a security one.
        # ⚠ This NARROWS what the join can reach and widens nothing.
        "LEFT JOIN runs r ON r.thread_id = wr.thread_id AND r.status = 'streaming' "
        "AND r.parent_run_id IS NULL "
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


# ── Phase 193 (AUTH-03, corrected wording) — author-time template binding ─────
# THE GAP: ``resolve_template_source`` Branch 1 (template_asset_service.py:145-180) has
# always been able to CONSUME a library ``asset_ref`` — {asset_id, filename, mime} naming
# a Storage path in the ``workspace-files`` bucket — and route those bytes down the
# TRUSTED docxtpl/Jinja path (``provenance="library"``). Nothing could ever PRODUCE one:
# the 10 published workflows that bind a template were seeded straight into the DB, and
# WorkflowBuilderPage.tsx:667 only READS ``assets.find(a => a.kind === "template")`` to
# show a filename. This route is the missing producer for a consumer that already exists.
#
# IT DOES NOT WRITE THE DEFINITION, DELIBERATELY. It returns the descriptor; the Builder
# writes it into ``definition.assets[]`` through the existing PATCH /workflows/{id} draft
# save. That keeps ONE writer on the definition JSONB — a second server-side writer would
# race the draft-save path and its Phase-186 If-Match concurrency token.
#
# NARROWER THAN THE CHAT-TIME DOOR, ON PURPOSE. ``POST /threads/{id}/workspace/files``
# accepts the widened 151/D-09 allowlist (text, scripts, images) because those are skill
# assets the agent reads. A workflow template is a document to FILL and its bytes reach
# the docxtpl/Jinja render engine, so this door accepts the OOXML three ONLY.
_TEMPLATE_MIME_BY_EXT = {
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}
# Spelled out rather than derived from ``mimetypes.guess_type`` (workspace_service:99):
# the stdlib map has no OOXML entries and falls back to the Windows registry, so the
# guessed value varies by machine. The mime is persisted INTO the definition and read
# back by the render path — it must be identical on every box.


class TemplateAssetRef(BaseModel):
    """The four keys ``resolve_template_source`` Branch 1 reads off an ``AssetRef``.

    Field-for-field identical to ``app.models.harness.AssetRef`` (models/harness.py:512)
    so the Builder can drop this object straight into ``definition.assets[]`` and the
    ``extra='forbid'`` WorkflowDefinition will accept it unchanged. ``kind`` is a
    single-value Literal — this door mints templates, never ``reference`` assets.
    """

    kind: Literal["template"] = "template"
    asset_id: str
    filename: str
    mime: str


class TemplatePlaceholdersResponse(BaseModel):
    """What a bound template asks the step to fill in — and whether we could read it.

    ``read`` is the whole point of the model. An empty ``placeholders`` list is
    ambiguous on its own: it could mean *we opened the document and it carries no
    fill-in fields*, or *we never opened it at all*. Collapsing those two into one
    wire shape lets an author conclude their template is field-less when the read
    simply failed — and they then ship a workflow that fills nothing. The two
    states are therefore carried separately and rendered as different sentences on
    different nodes by the client.

    ``"not_requested"`` is deliberately NOT in this Literal: the route always
    supplies an ``asset_id``, so that arm of the resolver is unreachable here.
    """

    read: Literal["ok", "unreadable"]
    placeholders: list[str] = Field(default_factory=list)


# Phase 193.1 (AUTH-03, D-05) — the uncompressed-size cap the SHIPPED doors do not have.
# ``zipfile.ZipFile.read()`` decompresses without a bound: ``parse_docx_template_variables``
# (``template_render_service.py:387``) calls ``zf.read(n)`` on ``word/document.xml`` plus
# every header/footer, so a 10 MB OOXML container declaring a multi-GB ``document.xml``
# passes BOTH size gates above and then materialises in RAM. 50 MB is ~5x the compressed
# cap — far beyond any real brief, far below a bomb.
_TEMPLATE_MAX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024


@router.post(
    "/template/placeholders",
    response_model=TemplatePlaceholdersResponse,
    dependencies=[Depends(require_visible("workflow_authoring"))],  # Phase 148 (VIS-01) — authoring gate
)
async def read_template_placeholders(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
) -> TemplatePlaceholdersResponse:
    """Read a template's fill-in fields from the BYTES, persisting nothing (D-05).

    WHY THIS ROUTE EXISTS. The sibling upload door needs a saved workflow
    (``POST /{definition_id}/template``), and at describe time there is no workflow yet
    — so an author who wants the draft built to fit their template has a chicken-and-egg
    problem. This door takes the bytes straight off their disk and answers with the field
    names. **No row, no Storage object, no draft.** Rejected alternatives, recorded so the
    shape reads as a decision: minting an empty draft up front (library rows the user
    never asked for, and a second writer against Phase 186's concurrency token), and
    stashing to a scratch Storage path (an orphan-cleanup problem nobody owns, on bytes
    that are RLS-sensitive).

    ⚠ **IT INJECTS NO SUPABASE CLIENT AND NO POOL, AND THAT IS A CLASS ELIMINATION
    RATHER THAN A STYLE CHOICE.** Quick task ``260814-q5r`` had to write an owner-prefix
    check AND a ``..`` traversal check on its read door, because that route resolves a
    caller-supplied Storage PATH through a client sitting on a service-role pool which
    bypasses RLS — a hand-written guard in front of a service-role read is the exact
    shape of a prior credential-exposure defect in this codebase. This route accepts no
    path and owns no row, so there is nothing for that class to attach to. Adding
    ``supabase=Depends(get_supabase)`` "for symmetry" would REINTRODUCE it; the fence in
    ``tests/unit/test_193_1_stateless_placeholders.py`` sweeps the body as well as the
    signature so that edit reds.

    THE GATES, in the sibling's exact order — each one load-bearing:

      1. **The DECLARED part size, before the body is materialised** (the WR-04 fix) —
         uvicorn/FastAPI impose no body cap, so ``.read()`` of a multi-GB part would
         buffer it all in RAM.
      2. **The extension**, before the body is read at all — a ``.png`` costs nothing.
      3. **Empty / oversized actual body** — a lying or absent declared size stops here.
      4. **The magic bytes** via the shipped ``validate_upload`` — ZIP EOCD +
         ``[Content_Types].xml`` + a per-extension part marker, so a renamed binary
         wearing a ``.docx`` name never reaches the parser.
      5. **The uncompressed-total cap** — see ``_TEMPLATE_MAX_UNCOMPRESSED_BYTES``.
         ⚠ This one is NOT inherited: gates 1-4 come from the shipped doors and do NOT
         cover a zip bomb, so they must not be presented as though they did. Capping it
         here does NOT close it on ``POST /{id}/template`` or on the q5r read door — the
         exposure is inherited, flagged, and deliberately not widened. It caps the
         DECLARED uncompressed total; a central directory that UNDER-declares its sizes
         would still get past it, and closing that needs a bounded read inside the
         shipped parser, which is out of this door's scope.

    WHY THE ORDER IS THE HONESTY MECHANISM. ``parse_docx_template_variables`` returns
    ``None`` for TWO different facts — *not a zip / corrupt / not a docx* (:390-391) and
    *a real docx carrying no tokens* (:407-408). Here the bytes come straight off a
    user's disk, so the ambiguity is live. With gate 4 ahead of the parse, a document
    that never opened is a **422 refusal**, and ``read="ok"`` with ``[]`` can only ever
    mean *we opened it and it carries no fill-in fields*. Those two facts may never merge
    (``TemplateAttachSection.tsx:130-143`` carries the same warning on the client).

    ⚠ ``read="unreadable"`` is UNREACHABLE on this route — the same idiom
    ``TemplatePlaceholdersResponse`` already uses for ``"not_requested"``. A document that
    cannot be opened is a refusal, not a degraded read. The field is kept for shape parity
    with the bound-template door so the client derives its arms from ONE wire shape.

    The response echoes NOTHING from the upload — no filename, no extension, no size —
    which is why the sibling's WR-05 ``safe_name`` sanitisation is not carried across.
    """
    if file.size is not None and file.size > MAX_FILE_SIZE:  # WR-04 — before .read()
        raise HTTPException(422, "File too large. Maximum size is 10 MB.")

    original = file.filename or ""
    ext = "." + original.rsplit(".", 1)[-1].lower() if "." in original else ""
    if ext not in _TEMPLATE_MIME_BY_EXT:
        raise HTTPException(
            422,
            "A workflow template must be a .docx, .pptx or .xlsx document "
            f"(got {ext or 'a file with no extension'}).",
        )

    raw = await file.read()
    if len(raw) == 0:
        raise HTTPException(422, "File is empty")
    if len(raw) > MAX_FILE_SIZE:  # a lying/absent declared size does not get past this
        raise HTTPException(422, "File too large. Maximum size is 10 MB.")
    validate_upload(original, raw)  # magic-byte / OOXML-container gate -> 422

    try:
        with zipfile.ZipFile(io.BytesIO(raw)) as zf:
            uncompressed = sum(zi.file_size for zi in zf.infolist())
    except Exception:  # noqa: BLE001 — gate 4 already proved it is a container
        raise HTTPException(422, "File is not a valid Office document (its archive could not be read).")
    if uncompressed > _TEMPLATE_MAX_UNCOMPRESSED_BYTES:
        raise HTTPException(
            422,
            "This document expands to more than "
            f"{_TEMPLATE_MAX_UNCOMPRESSED_BYTES // (1024 * 1024)} MB when opened and "
            "was not read.",
        )

    try:
        # CLAUDE.md / D-v2.5-01 — the parse is sync CPU work (zip inflate + regex over
        # stripped XML). Bounded by the gates above, but it is user-triggerable, so it
        # goes off the event loop exactly as the sibling wraps its Storage call (:1723).
        parsed = await run_in_threadpool(parse_docx_template_variables, raw)
    except Exception:
        # Clean relay, never a traceback (the sibling's :1729-1736 posture).
        logger.warning("Stateless template placeholder read failed (relaying clean error)", exc_info=True)
        raise HTTPException(422, "The document could not be read.")

    # ``parsed is None`` HERE — past gate 4 — is the honest empty state, not a failure.
    # The assembly is the SHARED one so this door and the bound-template door can never
    # show two different field lists for the same document.
    return TemplatePlaceholdersResponse(
        read="ok", placeholders=placeholder_names_from_parsed(parsed)
    )


@router.post(
    "/{definition_id}/template",
    response_model=TemplateAssetRef,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_visible("workflow_authoring"))],  # Phase 148 (VIS-01) — authoring gate
)
async def upload_workflow_template(
    definition_id: UUID,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    # The per-request user-JWT client (ANON key + Bearer), NOT the service role. The
    # ``workspace_storage_insert_own`` policy (migration 054:91) requires the first path
    # segment to equal ``auth.uid()``, so Storage RLS is a SECOND, database-enforced
    # boundary underneath the owner-gate below — a service-role client would bypass it.
    supabase: Client = Depends(get_user_supabase_client),
) -> TemplateAssetRef:
    """Upload a template and store it durably against a workflow the caller OWNS.

    The order of the gates is load-bearing and each one is a decision:

      1. **Owner-gate first** — ``_owned_slug_or_404`` is the SAME owner-scoped
         ``created_by`` WHERE the delete/preview routes use, and its 404 is deliberately
         indistinguishable from not-found: a 403 would confirm that a workflow exists
         (no existence oracle). The workflow cluster reads through a service-role pool
         which bypasses RLS, so this WHERE is the route's authorization boundary.
      2. **The DECLARED part size, before the body is materialised** (workspace.py:250,
         the WR-04 fix) — uvicorn/FastAPI impose no body cap, so ``.read()`` of a
         multi-GB part would buffer it all in RAM.
      3. **The extension**, before the body is read at all — a ``.png`` costs nothing.
      4. **The magic bytes** via the shipped ``validate_upload`` — a renamed binary
         wearing a ``.docx`` name never reaches Storage.

    Nothing is persisted on any refusal: the single write is the LAST statement before
    the return. The blocking supabase-py upload is ``run_in_threadpool``-wrapped
    (CLAUDE.md / D-v2.5-01).
    """
    pool = await get_pg_pool()
    user_id = _coerce_user_id(current_user)
    await _owned_slug_or_404(pool, definition_id, user_id)  # 404 on non-owner / unknown

    if file.size is not None and file.size > MAX_FILE_SIZE:  # WR-04 — before .read()
        raise HTTPException(422, "File too large. Maximum size is 10 MB.")

    original = file.filename or ""
    ext = "." + original.rsplit(".", 1)[-1].lower() if "." in original else ""
    if ext not in _TEMPLATE_MIME_BY_EXT:
        raise HTTPException(
            422,
            "A workflow template must be a .docx, .pptx or .xlsx document "
            f"(got {ext or 'a file with no extension'}).",
        )

    raw = await file.read()
    if len(raw) == 0:
        raise HTTPException(422, "File is empty")
    if len(raw) > MAX_FILE_SIZE:  # a lying/absent declared size does not get past this
        raise HTTPException(422, "File too large. Maximum size is 10 MB.")
    validate_upload(original, raw)  # magic-byte / OOXML-container gate -> 422

    # WR-05 (100-REVIEW) sanitisation, same shape as workspace.py:265 — ordinary names
    # ("Q3 Report (final).docx", "P&L 2026.xlsx") must not 422 at a user who never typed
    # a path, while '/' and '..' are stripped so the object can only ever land under the
    # user-keyed prefix built below.
    safe_name = re.sub(r"[^a-zA-Z0-9._\- ]", "_", original)
    safe_name = re.sub(r"\.{2,}", ".", safe_name).strip() or f"template{ext}"
    mime = _TEMPLATE_MIME_BY_EXT[ext]
    # The layout the seeded library fixtures already use and Branch 1 already reads
    # (RESEARCH Q1): {user_id}/_library/{workflow}/{uuid8}-{name}. The uuid8 makes a
    # re-upload of the same filename a NEW object rather than an overwrite, so a draft
    # still pointing at the old asset_id keeps rendering.
    asset_id = f"{user_id}/_library/{definition_id}/{uuid4().hex[:8]}-{safe_name}"
    try:
        await run_in_threadpool(
            supabase.storage.from_(BUCKET_NAME).upload,
            asset_id,
            raw,
            {"content-type": mime, "upsert": "true"},
        )
    except Exception:
        # Never surface a raw storage traceback (the D-05 clean-relay posture).
        logger.warning(
            "Workflow template upload failed for definition=%s (relaying clean error)",
            definition_id,
            exc_info=True,
        )
        raise HTTPException(502, "The template could not be stored. Please try again.")

    return TemplateAssetRef(asset_id=asset_id, filename=safe_name, mime=mime)


@router.get(
    "/{definition_id}/template/placeholders",
    response_model=TemplatePlaceholdersResponse,
    dependencies=[Depends(require_visible("workflow_authoring"))],  # Phase 148 (VIS-01) — authoring gate
)
async def get_workflow_template_placeholders(
    definition_id: UUID,
    asset_id: str = Query(..., max_length=512),
    current_user: dict = Depends(get_current_user),
    # The per-request user-JWT client, NOT the service role — see gate 3 below.
    supabase: Client = Depends(get_user_supabase_client),
) -> TemplatePlaceholdersResponse:
    """Read the fill-in fields of a template the caller OWNS (quick task 260814-q5r).

    WHY THIS ROUTE EXISTS AT ALL, rather than a widened ``?template_asset_id=`` on
    ``GET /workflows/grounding-bundle``. That parameter is typed ``UUID | None``, while
    this feature's asset ids are Storage PATHS (``{user_id}/_library/{definition_id}/…``)
    — so passing a real one is a **422 before the handler runs**, measured. The seam is
    not merely unwired, it is unwirable as typed. And widening it would be worse than
    useless: ``resolve_template_source`` Branch 1 does not scope by ``user_id`` at all,
    and that route injects the **service-role** client, so the ``UUID`` coercion is
    today's ONLY thing standing between a caller and any object in the bucket. Relaxing
    an accidental guard into a hand-written one on a service-role Storage read is the
    exact shape of a prior credential-exposure defect in this codebase. Two further
    reasons: the palette route is ``require_canvas()``-gated, so placeholders would be
    invisible on the Spine view (the surface most authors are on), and it would refetch
    the whole palette — folder tree, skill registry, tool list — to read one document.

    ⚠ **The asset is NOT required to be bound in the persisted definition, and that is a
    decision, not an oversight.** The Builder writes a freshly-uploaded descriptor into
    its store one statement before ``saveNow()``; requiring the binding would make this
    fetch race that round trip and answer about the OLD template, or about none.
    Ownership is proved by the gates below, never by the binding.

    THE GATES, in order, each one load-bearing:

      1. **Owner-gate on the definition** — ``_owned_slug_or_404``, the SAME owner-scoped
         ``created_by`` WHERE the upload/delete/preview routes use. Its 404 is deliberately
         indistinguishable from not-found: a 403 would confirm a workflow exists.
      2. **Owner-prefix on the asset id** — it must start with ``{user_id}/``. The pool is
         service-role and bypasses RLS, and gate 1 proves nothing about an asset id that
         arrived in the query string, so without this a caller could pass their OWN
         definition id and SOMEONE ELSE'S asset path.
      3. **No ``..`` segment.** This is NOT belt-and-braces. ``workspace_storage_select_own``
         (``supabase/migrations/054_workspace_files.sql:83-89``) keys on
         ``(storage.foldername(name))[1]`` — the FIRST path segment — so
         ``{uid}/../someone-else/x.docx`` satisfies gate 2 AND passes the database policy.
         The traversal check is the only thing that stops it.

    Both refusals raise the SAME 404 wording as a missing workflow — no existence oracle
    for objects either.

    The Storage read goes through the user-JWT client so ``workspace_storage_select_own``
    is a second, database-enforced boundary underneath gate 2, exactly as the sibling
    upload door documents for its write. A service-role client would silently remove it.
    """
    pool = await get_pg_pool()
    user_id = _coerce_user_id(current_user)
    await _owned_slug_or_404(pool, definition_id, user_id)  # 404 on non-owner / unknown

    if not asset_id.startswith(f"{user_id}/") or ".." in asset_id.split("/"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="template not found")

    placeholders, read = await grounding.resolve_template_placeholders(
        supabase=supabase,
        pool=pool,
        user_id=str(user_id),
        template_asset_id=asset_id,
        template_placeholders=None,
    )
    # ``read`` can only be "ok" or "unreadable" here — "not_requested" is unreachable
    # because an ``asset_id`` is always supplied (it is a required query param).
    return TemplatePlaceholdersResponse(read=read, placeholders=placeholders)
