"""The injectable, leak-safe saved-view RESOLVE CORE — extracted in Phase 115.

This module holds the EXACT resolve logic that shipped inside the FastAPI route
module ``app.api.document_views`` (Phase 113/114) — lifted out VERBATIM so the
Phase 115 agent tool can call the SAME leak-safe two-leg resolve IN-PROCESS without
importing a FastAPI route or raising ``HTTPException`` into the agent loop.

Why extract (D-115-6 / RESEARCH §"Don't Hand-Roll"): a FORK of the resolver is the
one thing that quietly re-opens the cross-user leak the secure-phase two-user test
exists to catch. Extraction makes "the agent tool reuses the resolver verbatim"
structurally true — the route and the tool now share ONE core. There is no second
copy of the caller-scoping (VIEW-06), the count-only DISTINCT dedupe, the
relative-date window math, or the bound-param binding (SC#4).

The ONLY behavioral change vs. the route module is WHERE validation failures raise:
this core raises a plain :class:`ResolveError` (carrying ``.detail`` + ``.status``);
the route re-wraps it to ``HTTPException`` (byte-identical route behavior); the
agent handler (Plan 02) maps it to a calm ``ToolResult`` string. **This module MUST
NOT import the web framework** — no ``HTTPException``, no ``status``.

Safety invariants preserved verbatim from the route module:
  - Field-name whitelist + ``_``-prefix reject (T-113-12) via
    ``view_filter_compiler.validate_fields`` against
    ``set(DocumentMetadata.model_fields) ∪ enabled custom defs``.
  - Injection/SSTI in a filter value (SC#4 / T-113-11) neutralized by binding the
    compiled fragments as bound PostgREST params — never string-interpolated.
  - ``folder_scope`` → a bounded subtree LIST (never a set — Pitfall 1) via the
    cycle-guarded ``resolve_project_subtree``; an unreachable scope → no narrowing
    (D-113-5).
  - Every ``.execute()`` rides ``aexec`` (run_in_threadpool) so an async caller never
    blocks the event loop (D-v2.5-01 / T-113-15).
  - Every documents query leg is scoped from the CALLER, NEVER ``view["user_id"]``
    (the VIEW-06 invariant). A seeded global view resolves to DIFFERENT result sets
    per caller — each sees only their own documents.
"""

from datetime import date, timedelta

from supabase import Client

from app.models.document import DocumentMetadata
from app.models.document_view import ViewFilter
from app.services import metadata_field_service, view_filter_compiler
from app.services.harness.scope import resolve_project_subtree
from app.utils.db import aexec
from app.utils.folder_utils import fetch_visible_folders, get_globally_visible_folder_ids


class ResolveError(Exception):
    """A plain validation/resolve failure with no FastAPI dependency.

    The extracted core raises THIS instead of ``HTTPException`` so it never leaks a
    web framework into the agent loop. The route re-wraps it to ``HTTPException`` for
    byte-identical route behavior; the Phase 115 tool handler maps it to a calm
    ``ToolResult`` string. ``detail`` carries the same message the route used to put
    in ``HTTPException.detail``; ``status`` defaults to 422 (the old raise sites).
    """

    def __init__(self, detail: str, status: int = 422):
        super().__init__(detail)
        self.detail = detail
        self.status = status


# Relative-date unit → days (D-114-16 / sketch 030 — "months count as ≈30 days;
# the headline dates are the contract"). Used by `_relative_window` to turn an
# operator's N + unit into a server-clock-anchored date window.
_UNIT_DAYS: dict[str, int] = {"days": 1, "weeks": 7, "months": 30}

# WR-05: cap the relative span at ~100 years. A user could enter an absurd N
# (e.g. 999_999_999 months → today + timedelta(days=~3e10)), which raises
# OverflowError in Python date arithmetic — an unhandled 500 reachable from the UI.
# Clamping to a sane maximum keeps the bound well inside `date`'s range (year 9999)
# while covering every realistic document-age / due-date window.
_MAX_RELATIVE_DAYS: int = 36500  # ~100 years


def _relative_window(builder: str, n: int, unit: str | None) -> tuple[str | None, str | None]:
    """Compute a relative-date window from the SERVER CLOCK at resolve time (D-114-16).

    Returns ``(lower_iso, upper_iso)`` ISO date bounds (either may be ``None`` for an
    open-ended bound), recomputed every call so a saved relative view drifts with the
    calendar — the window is NEVER baked at save time nor on the client (Pitfall 6).

    * ``within_next`` → ``(today, today + N)`` — the ``today`` LOWER bound is the
      overdue-exclusion (D-114-5: "coming due soon," not "overdue + soon"). Both ends
      inclusive (the resolve route chains ``.gte(today).lte(today+N)``).
    * ``older_than``  → ``(None, today - N)`` — document age. The resolve route applies
      this upper bound STRICTLY via ``.lt`` (WR-03 / D-114-4: ``date < today - N``), so
      a document dated EXACTLY ``today - N`` is NOT "older than N" — it is excluded.
      (This helper returns the same bound DATE either way; the strict-vs-inclusive
      choice lives at the ``_apply`` builder call.)

    WR-05: the span is CLAMPED to ``[0, _MAX_RELATIVE_DAYS]`` (~100 years) and the
    ``date ± timedelta`` is guarded against ``OverflowError`` (it falls back to the
    clamp date if Python's ``date`` range is somehow exceeded) — an absurd N from the
    UI can never raise an unhandled 500.

    PHASE 115 HANDOFF: the agent-tool reuses this resolver / this helper so its
    relative windows recompute live; it MUST NOT re-derive its own window math.
    """
    today = date.today()  # server clock — recompute every resolve (drifts with calendar)
    # Clamp the span: a negative/zero N collapses to 0; an absurd N caps at ~100 years
    # (WR-05) so the date arithmetic below can never OverflowError into a 500.
    span = max(0, min(n * _UNIT_DAYS.get(unit or "days", 1), _MAX_RELATIVE_DAYS))
    if builder == "within_next":
        try:
            upper = (today + timedelta(days=span)).isoformat()
        except OverflowError:
            upper = date.max.isoformat()
        return today.isoformat(), upper
    if builder == "older_than":
        try:
            upper = (today - timedelta(days=span)).isoformat()
        except OverflowError:
            upper = date.min.isoformat()
        return None, upper
    return None, None


# The immutable built-in metadata keys (single-sourced from DocumentMetadata, the
# documents.py:1355 convention — under extra="allow", model_fields still returns
# ONLY the declared built-ins). The whitelist is built-ins ∪ enabled custom defs.
_METADATA_BUILTINS = set(DocumentMetadata.model_fields)

# Phase 237 (RULES-02 / SC#2): Source facts are first-class filterable fields in views & rules
_SOURCE_FACT_FIELDS: frozenset[str] = frozenset({
    "source_system",
    "source_connection_id",
    "path",
    "file_path",
    "ingest_visibility",
    "source_state",
    # Phase 240 (SRC-05 / D-240-07). ⛔ ADDED HERE AS WELL AS TO THE COMPILER, ON PURPOSE.
    # Phase 237 had to close a whitelist BYPASS at this file's defense-in-depth re-check after
    # promoting the source facts: a compiler-only change leaves `validate_fields` rejecting at
    # SAVE time a field the resolver is perfectly willing to select at READ time. A promotion
    # touches THREE places — PROMOTED_TYPED_COLUMNS, this whitelist, and the re-check below —
    # and the re-check reads PROMOTED_TYPED_COLUMNS.values(), so it follows automatically.
    "thread_key",
})


async def _build_field_meta(user_id: str, supabase: Client) -> tuple[set[str], set[str]]:
    """Assemble the live filterable-field whitelist + the numeric custom-field set.

    Returns ``(whitelist, number_custom_fields)`` from ONE def fetch:
      * ``whitelist`` — built-in metadata keys ∪ source fact fields ∪ the field_keys
        of the caller's ENABLED custom field defs (own + global). `_`-prefixed keys are
        excluded by ``validate_fields`` itself (they can never be whitelisted — D-111-9),
        so they are not added here regardless of any def's key.
      * ``number_custom_fields`` — the field_keys of the ENABLED custom defs whose
        ``field_type`` is ``number``; consumed by ``validate_operands`` to reject
        range operators on a lexically-compared custom number leg (WR-01).
    """
    defs = await metadata_field_service.list_field_definitions(user_id, supabase=supabase)
    enabled_custom = {d["field_key"] for d in defs if d.get("enabled")}
    number_custom = {
        d["field_key"] for d in defs if d.get("enabled") and d.get("field_type") == "number"
    }
    return _METADATA_BUILTINS | _SOURCE_FACT_FIELDS | enabled_custom, number_custom


async def _build_whitelist(user_id: str, supabase: Client) -> set[str]:
    """Back-compat thin wrapper: just the whitelist (see ``_build_field_meta``)."""
    whitelist, _ = await _build_field_meta(user_id, supabase)
    return whitelist


async def resolve_filter(
    *,
    caller: str,
    flt: ViewFilter,
    folder_scope: str | None,
    count_only: bool,
    supabase: Client,
):
    """The SHARED, leak-safe resolve core (114 CR-01; extracted in 115) — used by BOTH
    the route module's ``resolve_view`` / ``resolve_adhoc`` endpoints AND the Phase 115
    agent tool ``query_documents_by_view`` handler.

    Caller MUST have already done any readability gate (a saved view's 404-not-403);
    this core never reads a view owner — every documents query leg is scoped from
    ``caller`` (the VIEW-06 invariant). It performs NO DB write and NO audit entry, so
    it is safe to call on every keystroke. Returns ``{"total": N}`` when ``count_only``
    else ``{"documents": [...], "total": N}`` (the plain-dict, no-response_model shape
    so rows round-trip the exact metadata blob — the 112 CR-01 lesson).

    On a validation failure (a bad/`_`-prefixed/deleted filter field) this raises a
    plain :class:`ResolveError` (NOT ``HTTPException`` — that lived in the route, which
    re-wraps; the agent handler maps it to a calm string). This is the ONLY behavioral
    change vs. the shipped route logic — every other line is byte-identical.
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
        raise ResolveError(detail=str(e))

    # Compile the AST → an ordered list[Fragment] (R-114-A); [] when empty → no
    # narrowing (D-113-9). The attacker-controlled value rides as a bound Fragment
    # literal carried into a PostgREST builder param — NEVER string-interpolated into
    # SQL or the .or_/.in_ grammar (SC#4 / T-114-02-03).
    fragments = view_filter_compiler.compile_filter(flt)

    # Defense-in-depth: re-check all leg field names against whitelist or promoted columns
    # before they become a selector (SC#2 seam closure).
    promoted_cols = set(view_filter_compiler.PROMOTED_TYPED_COLUMNS.values())
    for frag in fragments:
        if frag.leg == "typed":
            if frag.field not in promoted_cols:
                raise ResolveError(
                    detail=f"filter field {frag.field!r} is no longer available",
                )
        elif frag.leg in ("custom", "containment"):
            if frag.field not in whitelist:
                raise ResolveError(
                    detail=f"filter field {frag.field!r} is no longer available",
                )
        else:
            raise ResolveError(
                detail=f"filter leg {frag.leg!r} is not valid",
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
            (`document_type_norm` / `date_typed` / `source_connection_id` / ...);
            builder call straight on the column.
          * ``leg="custom"``      → a `metadata->>'field'` or nested source selector;
            ``field`` is a WHITELISTED key (re-validated above), never raw input.
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

            # Column selector: a CONSTANT typed column name, or a metadata selector
            if frag.leg == "typed":
                col = frag.field
            elif frag.field == "source_system":
                col = "metadata->source->>system"
            elif frag.field in ("path", "file_path"):
                col = "file_path"
            else:
                col = f"metadata->>{frag.field}"

            if frag.builder in ("within_next", "older_than"):
                # Relative-date window from the SERVER CLOCK at resolve time (D-114-16).
                # value = N, value2 = unit.
                #   within_next → .gte(today).lte(today+N) — inclusive both ends; the
                #     .gte(today) lower bound EXCLUDES overdue (D-114-5);
                #   older_than  → .lt(today-N) — STRICT upper bound (WR-03: D-114-4 is
                #     "date < today-N", so a doc dated EXACTLY today-N is NOT "older
                #     than N"; the code now matches that contract, no off-by-one).
                low, high = _relative_window(frag.builder, frag.value, frag.value2)
                if low is not None:
                    q = q.gte(col, low)
                if high is not None:
                    q = q.lt(col, high) if frag.builder == "older_than" else q.lte(col, high)
            elif frag.builder == "or_":
                # one_of — membership over one field. Bind the list via .in_
                # (PostgREST QUOTES each member → SC#4-safe), never an interpolated
                # .or_ grammar string built from user values (T-114-02-03).
                q = q.in_(col, frag.values or [])
            elif frag.builder == "is_empty":
                # is_empty — absent OR ''/'[]' on custom, or is.null on typed column
                if frag.leg == "typed":
                    q = q.is_(col, "null")
                else:
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
