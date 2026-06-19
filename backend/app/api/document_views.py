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

from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client

from app.dependencies import get_current_user, get_supabase
from app.models.document import DocumentMetadata
from app.models.document_view import (
    AdHocResolve,
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

# Relative-date unit → days (D-114-16 / sketch 030 — "months count as ≈30 days;
# the headline dates are the contract"). Used by `_relative_window` to turn an
# operator's N + unit into a server-clock-anchored date window.
_UNIT_DAYS: dict[str, int] = {"days": 1, "weeks": 7, "months": 30}


def _relative_window(builder: str, n: int, unit: str | None) -> tuple[str | None, str | None]:
    """Compute a relative-date window from the SERVER CLOCK at resolve time (D-114-16).

    Returns ``(lower_iso, upper_iso)`` ISO date bounds (either may be ``None`` for an
    open-ended bound), recomputed every call so a saved relative view drifts with the
    calendar — the window is NEVER baked at save time nor on the client (Pitfall 6).

    * ``within_next`` → ``(today, today + N)`` — the ``today`` LOWER bound is the
      overdue-exclusion (D-114-5: "coming due soon," not "overdue + soon").
    * ``older_than``  → ``(None, today - N)`` — document age, ``date <= today - N``.

    PHASE 115 HANDOFF: the agent-tool MUST reuse this resolver / this helper so its
    relative windows recompute live; it MUST NOT re-derive its own window math.
    """
    today = date.today()  # server clock — recompute every resolve (drifts with calendar)
    span = n * _UNIT_DAYS.get(unit or "days", 1)
    if builder == "within_next":
        return today.isoformat(), (today + timedelta(days=span)).isoformat()
    if builder == "older_than":
        return None, (today - timedelta(days=span)).isoformat()
    return None, None

# The immutable built-in metadata keys (single-sourced from DocumentMetadata, the
# documents.py:1355 convention — under extra="allow", model_fields still returns
# ONLY the declared built-ins). The whitelist is built-ins ∪ enabled custom defs.
_METADATA_BUILTINS = set(DocumentMetadata.model_fields)


async def _build_field_meta(user_id: str, supabase: Client) -> tuple[set[str], set[str]]:
    """Assemble the live filterable-field whitelist + the numeric custom-field set.

    Returns ``(whitelist, number_custom_fields)`` from ONE def fetch:
      * ``whitelist`` — built-in metadata keys ∪ the field_keys of the caller's
        ENABLED custom field defs (own + global). `_`-prefixed keys are excluded by
        ``validate_fields`` itself (they can never be whitelisted — D-111-9), so they
        are not added here regardless of any def's key.
      * ``number_custom_fields`` — the field_keys of the ENABLED custom defs whose
        ``field_type`` is ``number``; consumed by ``validate_operands`` to reject
        range operators on a lexically-compared custom number leg (WR-01).
    """
    defs = await metadata_field_service.list_field_definitions(user_id, supabase=supabase)
    enabled_custom = {d["field_key"] for d in defs if d.get("enabled")}
    number_custom = {
        d["field_key"] for d in defs if d.get("enabled") and d.get("field_type") == "number"
    }
    return _METADATA_BUILTINS | enabled_custom, number_custom


async def _build_whitelist(user_id: str, supabase: Client) -> set[str]:
    """Back-compat thin wrapper: just the whitelist (see ``_build_field_meta``)."""
    whitelist, _ = await _build_field_meta(user_id, supabase)
    return whitelist


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
    return await _resolve_filter(
        caller=caller,
        flt=flt,
        folder_scope=view.get("folder_scope"),
        count_only=count_only,
        supabase=supabase,
    )


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
    SHARED ``_resolve_filter`` core) — with NO ``document_views`` write and NO audit
    entry. ``count_only`` returns ``{total}`` (the live "N documents match" preview +
    the page's list resolve share THIS one path now); otherwise ``{documents, total}``.

    Leak-safety (VIEW-06) is preserved by construction: ``_resolve_filter`` scopes
    every leg from the CALLER, never a view owner (there IS no view here — the caller
    IS the only scope). SC#4 holds — the value rides as a bound PostgREST param via
    the compiler + ``_apply``, never interpolated. ``folder_scope`` (optional) is
    caller-owner-scoped exactly like a saved view's scope.
    """
    return await _resolve_filter(
        caller=current_user["id"],
        flt=body.filter_expr,
        folder_scope=str(body.folder_scope) if body.folder_scope is not None else None,
        count_only=body.count_only,
        supabase=supabase,
    )


async def _resolve_filter(
    *,
    caller: str,
    flt: ViewFilter,
    folder_scope: str | None,
    count_only: bool,
    supabase: Client,
):
    """The SHARED, leak-safe resolve core (114 CR-01) — used by BOTH the saved-view
    ``resolve_view`` and the stateless ad-hoc ``resolve_adhoc`` endpoints.

    Caller MUST have already done any readability gate (a saved view's 404-not-403);
    this core never reads a view owner — every documents query leg is scoped from
    ``caller`` (the VIEW-06 invariant). It performs NO DB write and NO audit entry, so
    it is safe to call on every keystroke. Returns ``{"total": N}`` when ``count_only``
    else ``{"documents": [...], "total": N}`` (the plain-dict, no-response_model shape
    so rows round-trip the exact metadata blob — the 112 CR-01 lesson).
    """
    # Re-validate fields + operands against the LIVE field metadata at resolve (not
    # just at save) — a field could have been deleted/disabled or retyped since save
    # (T-114-02-03 defense-in-depth / WR-01 / WR-02). For the AD-HOC path this IS the
    # save-time check (no prior create validated it).
    whitelist, number_fields = await _build_field_meta(caller, supabase)
    try:
        view_filter_compiler.validate_fields(flt, whitelist)
        view_filter_compiler.validate_operands(flt, number_fields)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))

    # Compile the AST → an ordered list[Fragment] (R-114-A); [] when empty → no
    # narrowing (D-113-9). The attacker-controlled value rides as a bound Fragment
    # literal carried into a PostgREST builder param — NEVER string-interpolated into
    # SQL or the .or_/.in_ grammar (SC#4 / T-114-02-03).
    fragments = view_filter_compiler.compile_filter(flt)

    # Defense-in-depth: re-check the custom-leg field names are still whitelisted
    # before they become a metadata->>'field' selector (a field deleted since save).
    for frag in fragments:
        if frag.leg == "custom" and frag.field not in whitelist:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"filter field {frag.field!r} is no longer available",
            )

    # Resolve folder_scope → a subtree LIST (never a set — Pitfall 1); an unreachable
    # scope contributes no narrowing (D-113-5). Owner-scoped to the CALLER, so a
    # global view's scope can never reach another user's folders.
    #
    # resolve_project_subtree walks from the scope ROOT and ALWAYS includes that root
    # id in its output, even when the root is a folder the caller can't see (a seeded
    # global view pointing at another user's private folder). Narrowing on such a
    # subtree would zero out the caller's docs — the exact opposite of D-113-5. So
    # intersect the resolved subtree with the caller's VISIBLE folder ids; if nothing
    # the caller can see survives, the scope is unreachable → drop the narrowing
    # entirely (the view resolves over the caller's full visible set, never erroring
    # or resolving empty).
    subtree = None
    if folder_scope:
        raw_subtree = await resolve_project_subtree(
            folder_scope, supabase=supabase, user_id=caller
        )
        if raw_subtree:
            visible_ids = {f["id"] for f in await fetch_visible_folders(supabase, caller)}
            reachable = [fid for fid in raw_subtree if fid in visible_ids]
            # Non-empty → narrow to the caller-visible subtree; empty (unreachable
            # scope) → leave subtree=None so no narrowing is applied (D-113-5).
            subtree = reachable or None

    def _apply(q):
        """Walk the ordered list[Fragment] + subtree scope onto a documents query leg.

        Two legs, one dispatch (R-114-A / RESEARCH §"Two-leg split"):
          * ``leg="typed"``       → the CONSTANT promoted column name
            (`document_type_norm` / `date_typed`); builder call straight on the column.
          * ``leg="custom"``      → a `metadata->>'field'` selector; ``field`` is a
            WHITELISTED key (re-validated above), never raw input.
          * ``leg="containment"`` → the surviving `metadata @> {field: value}` `@>`
            fast path (boolean/number eq).

        Every value rides as a bound PostgREST param. AND across conditions is the
        chained builder calls (PostgREST ANDs filters), preserving the flat-AND AST.
        """
        for frag in fragments:
            if frag.leg == "containment":
                # boolean/number eq — the @> fast path (case-sensitive exact is correct)
                q = q.contains("metadata", {frag.field: frag.value})
                continue

            # Column selector: a CONSTANT typed column name, or a metadata->>'key'
            # JSON-path on a whitelisted key (the key is NOT attacker input).
            col = frag.field if frag.leg == "typed" else f"metadata->>{frag.field}"

            if frag.builder in ("within_next", "older_than"):
                # Relative-date window from the SERVER CLOCK at resolve time (D-114-16).
                # value = N, value2 = unit. within_next → .gte(today).lte(today+N)
                # (the .gte(today) lower bound EXCLUDES overdue, D-114-5);
                # older_than → .lte(today-N).
                low, high = _relative_window(frag.builder, frag.value, frag.value2)
                if low is not None:
                    q = q.gte(col, low)
                if high is not None:
                    q = q.lte(col, high)
            elif frag.builder == "or_":
                # one_of — membership over one field. Bind the list via .in_
                # (PostgREST QUOTES each member → SC#4-safe), never an interpolated
                # .or_ grammar string built from user values (T-114-02-03).
                q = q.in_(col, frag.values or [])
            elif frag.builder == "is_empty":
                # is_empty — absent OR ''/'[]'. The field is whitelisted (a constant
                # here, re-validated above); the three RHS predicates are HARD-CODED
                # literals, never user input → the .or_ grammar carries no
                # attacker-controlled token (T-114-02-03 / D-114-12).
                q = q.or_(f"{col}.is.null,{col}.eq.,{col}.eq.[]")
            else:
                # eq / gte / lte / ilike — direct builder on the column; the value is
                # a bound param. between carries value2 → chain a .lte upper bound.
                q = getattr(q, frag.builder)(col, frag.value)
                if frag.value2 is not None:
                    q = q.lte(col, frag.value2)

        if subtree:  # VIEW-05 — narrow to the subtree LIST (never a set — Pitfall 1)
            q = q.in_("folder_id", subtree)  # → folder_id = ANY($n)
        return q

    global_folder_ids = await get_globally_visible_folder_ids(supabase, caller)

    # ---- count-only mode (D-114-15) — own+global DISTINCT dedupe, no full rows ----
    if count_only:
        # Select ids only (NEVER `*` — avoids the silent >1000 undercount; mirrors
        # the resolve dedupe exactly, RESEARCH §"Count-Only Path" option 1). The
        # union of id SETS across the two legs is the DISTINCT total — a caller-owned
        # doc living in a globally-visible folder matches BOTH legs but is counted
        # once (Pitfall 1: NEVER own.count + global.count). Same caller-scoping as
        # full resolve → a count over another user's docs is impossible by
        # construction (T-114-02-02 / VIEW-06).
        own_ids = {
            d["id"]
            for d in (await aexec(_apply(
                supabase.table("documents").select("id")
                .eq("user_id", caller).eq("is_latest", True)
            ))).data or []
        }
        glob_ids: set[str] = set()
        if global_folder_ids:
            glob_ids = {
                d["id"]
                for d in (await aexec(_apply(
                    supabase.table("documents").select("id")
                    .in_("folder_id", global_folder_ids).eq("is_latest", True)
                ))).data or []
            }
        return {"total": len(own_ids | glob_ids)}

    # ---- CALLER-SCOPED listing (clone list_documents) — scope from CALLER, never view.user_id ----
    own = _apply(
        supabase.table("documents")
        .select("*")
        .eq("user_id", caller)  # the VIEW-06 invariant: CALLER, never the view owner
        .eq("is_latest", True)  # Pitfall 6: latest versions only (VER-03)
    )
    own_docs = (await aexec(own)).data or []

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
