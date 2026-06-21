"""Saved-view ("virtual folder") CRUD + per-viewer resolve router (Phase 113).

The thin composition layer that turns the inert Plan 01 compiler + Plan 02 CRUD
service into a live, leak-safe API surface (VIEW-01/02/04/05/06):

  - CRUD (`POST/GET/PATCH/DELETE`) cloned from `api/metadata_fields.py`: create
    validates the AST fields against the live whitelist (D-113-10 → 422 on an
    unknown/`_`-prefixed field), the service hard-sets `is_global=False`
    (D-113-3), and a fire-and-forget `view.create` audit row is written (DMF-01).
    Every cross-user/unseeable miss collapses to a generic 404, NEVER 403 — no
    existence leak (D-113-4 / T-113-10).

  - `GET /{view_id}/resolve` — the per-viewer leak-safe core (VIEW-06, the single
    most dangerous boundary this phase touches). It clones the `list_documents`
    listing path (`documents.py:535`) but composes the compiler-produced
    `metadata_filter` (bound as one `$1::jsonb` via `.contains()`) + the
    `folder_scope` subtree. EVERY query leg is scoped from the CALLER (own docs +
    the caller's globally-visible-folder docs), NEVER `view["user_id"]`. A seeded
    global view resolves to DIFFERENT result sets per caller — each sees only
    their own documents. (T-113-09: the RLS label is not proof; the live two-user
    leak test runs in secure-phase.)

Safety invariants composed here:
  - Field-name whitelist + `_`-prefix reject at SAVE/UPDATE (T-113-12), via
    `view_filter_compiler.validate_fields` against
    `set(DocumentMetadata.model_fields) ∪ enabled custom defs`.
  - Injection/SSTI in a filter value (SC#4 / T-113-11) is neutralized by binding
    the compiled dict as a single `$1::jsonb` param — never string-interpolated.
  - `folder_scope` → a bounded subtree LIST (never a set — Pitfall 1) via the
    cycle-guarded `resolve_project_subtree`; an unreachable scope → no narrowing
    (D-113-5).
  - Every `.execute()` rides `aexec` (run_in_threadpool) so the async route never
    blocks the event loop (D-v2.5-01 / T-113-15).

NOTE (the 112 CR-01 lesson): the resolve route deliberately returns a plain
`{"documents": [...], "total": N}` dict with NO `response_model`, so the rows
round-trip the exact metadata blob `GET /documents` returns — tightening to a
`response_model` whose nested metadata is `extra="ignore"` would silently strip
`_source` / `_confidence` from rendered rows.

Per A1 (CONTEXT "Claude's discretion"): NO `document_management_enabled` feature
gate is added here — following the 111/112 precedent, the gate lives at the 114
UI surface. Per A2/D-113-10: the optional `stale_fields` resolve-warning is
deferred wholesale to Phase 119 (not shipped here).
"""

from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client

from app.dependencies import get_current_user, get_supabase
from app.models.document_view import (
    AdHocResolve,
    ViewCreate,
    ViewFilter,
    ViewResponse,
    ViewUpdate,
)
from app.services import document_view_service, view_filter_compiler
from app.services.audit_service import write_audit_entry
# Phase 115 — the leak-safe resolve core was EXTRACTED here verbatim so the agent
# tool can reuse it in-process (D-115-6: one core, no fork). The route stays a thin
# wrapper: it owns the readability gate + the ResolveError → HTTPException remap so
# the 113/114 endpoints behave byte-identically. The CRUD create/update still
# validate against the live whitelist via the extracted _build_field_meta.
from app.services.document_view_resolver import (
    _MAX_RELATIVE_DAYS,  # noqa: F401 — re-exported: 114 range-date tests import these
    ResolveError,
    _build_field_meta,
    _build_whitelist,  # noqa: F401 — kept exported for 114 callers importing from here
    _relative_window,  # noqa: F401 — helpers from here (byte-identical import surface)
    resolve_filter,
)

router = APIRouter(prefix="/document-views", tags=["document-views"])

# The relative-date helpers (_relative_window / _UNIT_DAYS / _MAX_RELATIVE_DAYS), the
# built-in whitelist (_METADATA_BUILTINS) and the field-meta builders (_build_field_meta
# / _build_whitelist) + the entire _resolve_filter core were EXTRACTED to
# app.services.document_view_resolver in Phase 115 (see the import block above). The
# CRUD create/update below still validate against the live whitelist via the imported
# _build_field_meta; the resolve routes are thin wrappers over the imported
# resolve_filter (ResolveError → HTTPException remap).


@router.get("", response_model=list[ViewResponse])
async def list_views(
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """List the caller's own views plus global ones (deduped, ordered by name)."""
    return await document_view_service.list_views(current_user["id"], supabase=supabase)


@router.post("", response_model=ViewResponse, status_code=status.HTTP_201_CREATED)
async def create_view(
    body: ViewCreate,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """Create an owner-private saved view (never global) + write a view.create audit row.

    Validates every AST field against the live whitelist BEFORE the write
    (D-113-10): an unknown or `_`-prefixed field → 422. The service hard-sets
    `is_global=False` (D-113-3); the body never supplies it.
    """
    # 1. Field-whitelist + operand validation at SAVE (D-113-10 / WR-01 / WR-02) —
    #    unknown/`_`-field, a range op on a custom number field, or a malformed
    #    operand (empty one_of, missing scalar/between bound) → 422.
    whitelist, number_fields = await _build_field_meta(current_user["id"], supabase)
    try:
        view_filter_compiler.validate_fields(body.filter_expr, whitelist)
        view_filter_compiler.validate_operands(body.filter_expr, number_fields)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))

    # 2. Persist (service hard-sets is_global=False; filter_expr stored as the
    #    validated AST dict via model_dump()).
    created = await document_view_service.create_view(
        user_id=current_user["id"],
        name=body.name,
        filter_expr=body.filter_expr.model_dump(),
        folder_scope=body.folder_scope,
        supabase=supabase,
    )

    # 3. Fire the governance receipt (DMF-01). write_audit_entry is async and
    #    SWALLOWS errors, so the LIVE round-trip is the real verification
    #    (test_113_view_crud.py::test_create_writes_audit).
    await write_audit_entry(
        user_id=current_user["id"],
        action_type="view.create",
        metadata={"view_id": created["id"], "name": body.name},
        supabase=supabase,
    )
    return created


@router.patch("/{view_id}", response_model=ViewResponse)
async def update_view(
    view_id: str,
    body: ViewUpdate,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """Update an owned view (404 on a cross-user miss, never 403).

    If `filter_expr` is present in the update, re-run the whitelist validation
    before the write (D-113-10 — save-time validation on create AND update).
    """
    data = body.model_dump(exclude_none=True)
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")

    # Ownership BEFORE validation (WR-01): confirm the caller owns this view before
    # running filter-field validation, so an unowned/absent id uniformly returns 404
    # regardless of whether the submitted filter_expr is valid — no 422-vs-404
    # ordering oracle. Mirrors the 112 PATCH analog (documents.py:1380), which
    # SELECTs ownership first. get_view is own-OR-global, so require STRICT ownership
    # here: a global view the caller does not own is not updatable either.
    existing = await document_view_service.get_view(view_id, current_user["id"], supabase=supabase)
    if existing is None or str(existing.get("user_id")) != str(current_user["id"]):
        raise HTTPException(status_code=404, detail="View not found")  # NEVER 403 — no existence leak

    # Re-validate the AST fields + operands if the update carries a new filter_expr
    # (D-113-10 / WR-01 / WR-02).
    if body.filter_expr is not None:
        whitelist, number_fields = await _build_field_meta(current_user["id"], supabase)
        try:
            view_filter_compiler.validate_fields(body.filter_expr, whitelist)
            view_filter_compiler.validate_operands(body.filter_expr, number_fields)
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
        # Store the validated AST as a plain dict (jsonb), not the Pydantic model.
        data["filter_expr"] = body.filter_expr.model_dump()

    # folder_scope (a UUID) must serialize to str for the jsonb/uuid column.
    if body.folder_scope is not None:
        data["folder_scope"] = str(body.folder_scope)

    updated = await document_view_service.update_view(
        current_user["id"], view_id, data, supabase=supabase
    )
    if updated is None:
        raise HTTPException(status_code=404, detail="View not found")  # NEVER 403 — defense-in-depth (ownership already gated above)
    return updated


@router.delete("/{view_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_view(
    view_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """Delete an owned view (404 on a cross-user miss, never 403)."""
    removed = await document_view_service.delete_view(
        current_user["id"], view_id, supabase=supabase
    )
    if not removed:
        raise HTTPException(status_code=404, detail="View not found")  # NEVER 403


@router.get("/{view_id}/resolve")
async def resolve_view(
    view_id: str,
    count_only: bool = False,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """Resolve a view to its complete listing of matching latest-version docs.

    THE per-viewer leak-safe core (VIEW-06 / T-113-09): every documents query leg
    is scoped from the CALLER, NEVER from `view["user_id"]`. A seeded global view
    resolves to DIFFERENT result sets per caller. Returns a complete listing
    (query-not-copy, D-113-1), newest-first, with a total count.

    The saved AST compiles (Plan 01) to an ordered ``list[Fragment]`` of bound
    WHERE-fragment descriptors (R-114-A). `_apply` walks them across two legs — the
    promoted typed indexed columns (`document_type_norm` / `date_typed`) and a
    whitelisted `metadata->>'field'` custom leg — chaining supabase-py builder calls
    so every VALUE rides as a bound PostgREST param (SC#4). Both legs are scoped
    identically from the CALLER, then merged + DISTINCT-deduped by id (VIEW-06).

    RELATIVE-DATE / PHASE 115 HANDOFF (D-114-16): relative-date windows
    (`within_next` / `older_than`) are computed HERE from the server clock at resolve
    time (never baked at save, never on the client) so a saved "expiring within 90
    days" view drifts with the calendar. Phase 115's agent-tool MUST reuse this
    resolver, never re-derive its own window math.

    ``count_only=True`` (D-114-15) returns just ``{"total": N}`` — the own+global
    DISTINCT-deduped count without materializing full rows — for the live builder
    preview and the per-view sidebar badges.
    """
    caller = current_user["id"]

    # 1. Readability gate (own OR global) → 404-not-403 on an unseeable id (D-113-4).
    #    view["user_id"] is used ONLY for this check — NEVER in a documents query.
    view = await document_view_service.get_view(view_id, caller, supabase=supabase)
    if view is None:
        raise HTTPException(status_code=404, detail="View not found")  # 404-not-403, no existence leak

    # 2. Compile + caller-scoped own+global two-leg resolve via the SHARED core
    #    (114 CR-01: the same core serves the saved-view resolve AND the stateless
    #    ad-hoc /resolve endpoint). The saved AST → an ordered list[Fragment]
    #    (R-114-A); the attacker-controlled value rides as a bound Fragment literal
    #    (SC#4); every leg is scoped from the CALLER, never view["user_id"] (VIEW-06).
    flt = ViewFilter.model_validate(view["filter_expr"] or {"op": "and", "conditions": []})
    # The extracted core raises a plain ResolveError on a validation failure; the
    # route re-wraps it to the SAME HTTPException it raised before extraction so the
    # 113/114 endpoint behaves byte-identically (the 422 detail string is carried
    # through unchanged).
    try:
        return await resolve_filter(
            caller=caller,
            flt=flt,
            folder_scope=view.get("folder_scope"),
            count_only=count_only,
            supabase=supabase,
        )
    except ResolveError as e:
        raise HTTPException(status_code=e.status, detail=e.detail)


@router.post("/resolve")
async def resolve_adhoc(
    body: AdHocResolve,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """STATELESS ad-hoc resolve/count for an UNSAVED filter (114 CR-01).

    The live FilterBar / IngestionPage preview an unsaved filter as the user builds
    it. Phase 113/114 had NO ad-hoc-by-body endpoint, so the client faked one with a
    ``createView → resolve → deleteView`` dance — which fired a ``view.create``
    GOVERNANCE AUDIT row on EVERY debounced keystroke that was never cleaned up,
    flooding the compliance audit log (DMF-01) with ``__live_*`` throwaway rows, AND
    double-round-tripped (the page + the bar each ran their own transient cycle).

    This endpoint takes the ``filter_expr`` AST inline and runs the IDENTICAL
    compile + caller-scoped own+global two-leg resolve as ``resolve_view`` (the
    SHARED ``resolve_filter`` core, extracted to document_view_resolver in 115) —
    with NO ``document_views`` write and NO audit entry. ``count_only`` returns
    ``{total}`` (the live "N documents match" preview + the page's list resolve share
    THIS one path now); otherwise ``{documents, total}``.

    Leak-safety (VIEW-06) is preserved by construction: ``resolve_filter`` scopes
    every leg from the CALLER, never a view owner (there IS no view here — the caller
    IS the only scope). SC#4 holds — the value rides as a bound PostgREST param via
    the compiler + ``_apply``, never interpolated. ``folder_scope`` (optional) is
    caller-owner-scoped exactly like a saved view's scope.
    """
    try:
        return await resolve_filter(
            caller=current_user["id"],
            flt=body.filter_expr,
            folder_scope=str(body.folder_scope) if body.folder_scope is not None else None,
            count_only=body.count_only,
            supabase=supabase,
        )
    except ResolveError as e:
        raise HTTPException(status_code=e.status, detail=e.detail)
