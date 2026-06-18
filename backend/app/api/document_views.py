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
from app.models.document import DocumentMetadata
from app.models.document_view import (
    ViewCreate,
    ViewFilter,
    ViewResponse,
    ViewUpdate,
)
from app.services import document_view_service, metadata_field_service, view_filter_compiler
from app.services.audit_service import write_audit_entry
from app.services.harness.scope import resolve_project_subtree
from app.utils.db import aexec
from app.utils.folder_utils import fetch_visible_folders, get_globally_visible_folder_ids

router = APIRouter(prefix="/document-views", tags=["document-views"])

# The immutable built-in metadata keys (single-sourced from DocumentMetadata, the
# documents.py:1355 convention — under extra="allow", model_fields still returns
# ONLY the declared built-ins). The whitelist is built-ins ∪ enabled custom defs.
_METADATA_BUILTINS = set(DocumentMetadata.model_fields)


async def _build_whitelist(user_id: str, supabase: Client) -> set[str]:
    """Assemble the live filterable-field whitelist for the caller.

    Built-in metadata keys ∪ the field_keys of the caller's ENABLED custom field
    definitions (own + global). `_`-prefixed keys are excluded by
    `validate_fields` itself (they can never be whitelisted — D-111-9 invariant),
    so they are not added here regardless of any def's key.
    """
    enabled_custom = {
        d["field_key"]
        for d in await metadata_field_service.list_field_definitions(user_id, supabase=supabase)
        if d.get("enabled")
    }
    return _METADATA_BUILTINS | enabled_custom


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
    # 1. Field-whitelist validation at SAVE (D-113-10) — unknown / `_`-field → 422.
    whitelist = await _build_whitelist(current_user["id"], supabase)
    try:
        view_filter_compiler.validate_fields(body.filter_expr, whitelist)
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

    # Re-validate the AST fields if the update carries a new filter_expr (D-113-10).
    if body.filter_expr is not None:
        whitelist = await _build_whitelist(current_user["id"], supabase)
        try:
            view_filter_compiler.validate_fields(body.filter_expr, whitelist)
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
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """Resolve a view to its complete listing of matching latest-version docs.

    THE per-viewer leak-safe core (VIEW-06 / T-113-09): every documents query leg
    is scoped from the CALLER, NEVER from `view["user_id"]`. A seeded global view
    resolves to DIFFERENT result sets per caller. Returns a complete listing
    (query-not-copy, D-113-1), newest-first, with a total count.
    """
    caller = current_user["id"]

    # 1. Readability gate (own OR global) → 404-not-403 on an unseeable id (D-113-4).
    #    view["user_id"] is used ONLY for this check — NEVER in a documents query.
    view = await document_view_service.get_view(view_id, caller, supabase=supabase)
    if view is None:
        raise HTTPException(status_code=404, detail="View not found")  # 404-not-403, no existence leak

    # 2. Compile the saved AST → metadata_filter jsonb dict ({} when empty → no
    #    narrowing, D-113-9). The attacker-controlled value rides as a bound
    #    JSON literal — never string-interpolated (SC#4 / T-113-11).
    flt = ViewFilter.model_validate(view["filter_expr"] or {"op": "and", "conditions": []})
    metadata_filter = view_filter_compiler.compile_filter(flt)

    # 3. Resolve folder_scope → a subtree LIST (never a set — Pitfall 1); an
    #    unreachable scope contributes no narrowing (D-113-5). Owner-scoped to the
    #    CALLER, so a global view's scope can never reach another user's folders.
    #
    #    resolve_project_subtree walks from the scope ROOT and ALWAYS includes that
    #    root id in its output, even when the root is a folder the caller can't see
    #    (a seeded global view pointing at another user's private folder). Narrowing
    #    on such a subtree would zero out the caller's docs — the exact opposite of
    #    D-113-5. So intersect the resolved subtree with the caller's VISIBLE folder
    #    ids; if nothing the caller can see survives, the scope is unreachable →
    #    drop the narrowing entirely (the view resolves over the caller's full
    #    visible set, never erroring or resolving empty).
    subtree = None
    if view.get("folder_scope"):
        raw_subtree = await resolve_project_subtree(
            view["folder_scope"], supabase=supabase, user_id=caller
        )
        if raw_subtree:
            visible_ids = {f["id"] for f in await fetch_visible_folders(supabase, caller)}
            reachable = [fid for fid in raw_subtree if fid in visible_ids]
            # Non-empty → narrow to the caller-visible subtree; empty (unreachable
            # scope) → leave subtree=None so no narrowing is applied (D-113-5).
            subtree = reachable or None

    def _apply(q):
        """Compose the metadata filter + subtree scope onto a documents query leg."""
        if metadata_filter:  # D-113-9: empty → skip .contains() entirely
            q = q.contains("metadata", metadata_filter)  # → metadata @> $1::jsonb (param-bound, SC#4)
        if subtree:  # VIEW-05 — narrow to the subtree LIST (never a set — Pitfall 1)
            q = q.in_("folder_id", subtree)  # → folder_id = ANY($n)
        return q

    # ---- CALLER-SCOPED listing (clone list_documents) — scope from CALLER, never view.user_id ----
    own = _apply(
        supabase.table("documents")
        .select("*")
        .eq("user_id", caller)  # the VIEW-06 invariant: CALLER, never the view owner
        .eq("is_latest", True)  # Pitfall 6: latest versions only (VER-03)
    )
    own_docs = (await aexec(own)).data or []

    global_folder_ids = await get_globally_visible_folder_ids(supabase, caller)
    global_docs: list[dict] = []
    if global_folder_ids:
        glob = _apply(
            supabase.table("documents")
            .select("*")
            .in_("folder_id", global_folder_ids)
            .eq("is_latest", True)
        )
        global_docs = (await aexec(glob)).data or []

    # 4. Merge, dedupe by id, sort created_at desc (clone documents.py:563-570).
    seen: set[str] = set()
    merged: list[dict] = []
    for d in own_docs + global_docs:
        if d["id"] not in seen:
            seen.add(d["id"])
            merged.append(d)
    merged.sort(key=lambda d: d["created_at"], reverse=True)  # newest-first (D-113-1)

    # Plain dict (NO response_model) so the rows round-trip the same metadata blob
    # GET /documents returns — the 112 CR-01 extra="allow" preservation lesson.
    return {"documents": merged, "total": len(merged)}
