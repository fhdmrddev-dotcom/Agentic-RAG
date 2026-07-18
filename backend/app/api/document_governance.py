"""Document Governance Health — Backend (Phase 119, DGOV-01/02).

A SEPARATE, light, READ-ONLY governance view of document-*structure* health — distinct from
the *retrieval* "Library Health" dashboard (``knowledge_health.py``, which this clones). It
surfaces three signals produced by the upstream v3.0 features, each linking out to the
document detail panel where the existing fix actions already live:

  1. ``GET /document-governance/broken-relationships`` — D-119-3: an edge whose TARGET resolves
     to NO readable latest version (the document was fully deleted — no ``is_latest=True`` row
     the owner can read). Anchors on Phase 116's ``_resolve_readable_latest``: ``None`` ==
     broken. A target that EXISTS but is masked "linked document (no access)" is NOT a break —
     masking != deletion (preserves the Phase 117 semantics; no cross-user existence leak).
  2. ``GET /document-governance/unclassified`` — D-119-4: a doc with
     ``metadata._classification.status == "suggested"`` (a pending classification suggestion the
     user has neither accepted nor dismissed). dismiss POPs the whole ``_classification`` key and
     accept sets status "accepted", so the equality filter naturally excludes both.
  3. ``GET /document-governance/low-confidence`` — D-119-5: a doc with ANY extracted field
     ``metadata._confidence[field] < 0.5`` (the ``ConfidenceChip`` ``TIER.MED`` low cutoff —
     hardcoded in ``frontend/src/components/metadata/ConfidenceChip.tsx``; do NOT introduce a
     second threshold constant). NOT PostgREST-expressible → an in-Python scan.

PURE CONSUMER: NO migration, NO new write path, NO new package. Read-only aggregation over the
already-shipped DM tables under their existing RLS.

OWNER-SCOPING IS THE SOLE GATE (Pitfall 3 / T-119-01-01): ``get_supabase()`` is the SERVICE-ROLE
client (RLS bypassed), so the app-code ``.eq("user_id", _uid(caller))`` on EVERY query is the
only thing standing between user A and user B's data. ``_uid`` coerces to a canonical UUID
string so a malformed value raises ``ValueError`` (caught by the 502 wrap) rather than breaking
out of the filter grammar. The broken signal additionally rides the already-owner-scoped
``_resolve_readable_latest``. Proven NON-VACUOUS by the two-user live leak test
(``tests/integration/test_119_leak.py``).

ONE structural deviation from the ``knowledge_health.py`` analog: ``_fetch_broken_relationships``
is ``async`` (it awaits the async ``_resolve_readable_latest``). The two SQL/Python fetches
(unclassified / low-confidence) are SYNC and are called from their async route handlers through
``run_in_threadpool`` so a bare blocking supabase-py call never stalls the event loop (CLAUDE.md
D-v2.5-01).

DMF-03 (non-action): this router is deliberately NOT gated behind
``app_settings.document_management_enabled`` — Phases 111/112/113/116/118 all chose not to gate at
the router surface (the flag is dormant at every DM surface; SEED-080 / v3.2 entitlement seam).
Gating Governance alone would make it the lone inconsistent surface. ``document_management_enabled``
is referenced ONLY in this comment, never as an actual gate call.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.concurrency import run_in_threadpool
from supabase import Client

from app.dependencies import get_current_user, get_supabase, require_visible
from app.services.document_relationship_service import (
    _resolve_readable_latest,  # broken-edge classification: None == broken (D-119-3)
    _uid,                       # UUID-coerce-before-predicate (sole owner-scoping gate)
)

# Phase 148 (VIS-01 / A4) — governance_health maps to THIS router (the Phase 119 "Governance"
# nav), not knowledge_health.py ("Library Health", a sibling read-only surface left ungated/
# Everyone). Gate the whole router (every endpoint) so a non-operator is refused server-side
# (403 — D-03). governance_health is an Everyone-audience feature day-one, so require_visible is
# a no-op for everyone until an operator flips it to Operators-only (is_operator is the ONE
# swappable audience boundary).
router = APIRouter(
    prefix="/document-governance",
    tags=["document-governance"],
    dependencies=[Depends(require_visible("governance_health"))],
)

DEFAULT_LIMIT = 20
MAX_LIMIT = 100

# The low-confidence cutoff IS the ConfidenceChip TIER.MED low cutoff (0.5) — see
# frontend/src/components/metadata/ConfidenceChip.tsx. A field < this is "low"; >= is not.
# Do NOT introduce a second threshold constant (D-119-5).
LOW_CONF_CUTOFF = 0.5

# Cap the low-confidence Python scan like the analog's .in_() cap (knowledge_health.py:115-118)
# so a pathologically large library doesn't pull every row into memory.
LOW_CONF_SCAN_CAP = 2000


# ── Signal fetchers ─────────────────────────────────────────────────────────────

async def _latest_exists_anywhere(supabase: Client, endpoint_id: str) -> bool:
    """Does a CURRENT (``is_latest=True``) version of this endpoint's document exist for ANY
    owner, regardless of the caller's read access?

    THE masking-vs-deletion distinction (D-119-3). The caller-scoped ``_resolve_readable_latest``
    returns ``None`` for BOTH "the document's latest is gone" and "the latest exists but the caller
    can't read it (another user's private doc)" — it cannot tell them apart. The governance broken
    signal must:
      * MASKED, NOT broken — a current ``is_latest=True`` row exists somewhere (the doc is alive,
        the caller just can't see it). Reporting it would re-introduce the cross-user existence
        signal Phase 117 masking deliberately suppresses (masking != deletion).
      * BROKEN — no ``is_latest=True`` row exists at all for this document's lineage (the latest
        was deleted; the edge survived because it is keyed on a now-orphaned OLD version — the live
        ``ON DELETE CASCADE`` on ``document_relationships`` means a fully-deleted endpoint takes its
        edge with it, so the ONLY way an edge dangles is an orphaned old-version reference, A1).

    The endpoint id may itself be an old (non-latest) version, so existence is checked over the
    document's full ``(user_id, filename)`` lineage — the same follow-to-latest key the resolver
    uses. This is a service-role EXISTENCE probe (the count of current-latest rows, plus the
    lineage key needed to compute it) — it answers ONLY "deletion or masking?" for the caller's
    OWN edge and never surfaces a foreign doc's content to the caller.
    """
    # First, learn the endpoint's lineage key (its owner + filename). The endpoint row may be an
    # old version that still exists, or may be gone entirely.
    row_res = await run_in_threadpool(
        lambda: supabase.table("documents")
        .select("user_id, filename, is_latest")
        .eq("id", endpoint_id)
        .limit(1)
        .execute()
    )
    rows = row_res.data or []
    if not rows:
        # The endpoint id row itself is gone. Under the live FK CASCADE the edge would normally
        # be removed too, so reaching here means there is no lineage to follow → broken.
        return False
    row = rows[0]
    if row.get("is_latest"):
        return True  # the endpoint id is itself the current latest → alive (masked, not broken)
    owner, fname = row.get("user_id"), row.get("filename")
    if not owner or not fname:
        return False
    latest_res = await run_in_threadpool(
        lambda: supabase.table("documents")
        .select("id", count="exact")
        .eq("user_id", owner)
        .eq("filename", fname)
        .eq("is_latest", True)
        .limit(1)
        .execute()
    )
    return bool(latest_res.count or (latest_res.data or []))


async def _fetch_broken_relationships(
    supabase: Client, user_id: str, offset: int = 0, limit: int = DEFAULT_LIMIT
) -> dict:
    """D-119-3 — the caller's OWN edges whose far endpoint has NO current readable latest.

    The ONE async fetch (it awaits the async ``_resolve_readable_latest`` + the existence probe).
    For each of the caller's own edges, an endpoint is BROKEN iff (a) the caller cannot resolve it
    to a readable latest (``_resolve_readable_latest`` → None) AND (b) no ``is_latest=True`` row
    exists for its lineage anywhere (``_latest_exists_anywhere`` → False — the orphaned-old-version
    case A1 pins live, since the FK CASCADE removes the edge when the endpoint row itself is hard-
    deleted). A target whose current latest EXISTS but is merely unreadable to the caller (another
    user's private doc) is MASKED, NOT broken — masking != deletion (D-119-3); reporting it would
    re-introduce a cross-user existence signal the Phase 117 masking deliberately suppresses.

    The READABLE end (when one endpoint is gone but the other resolves) is carried as
    ``readable_doc_id`` / ``document_id`` so the frontend link-out can open the openable end,
    plus ``relationship_id``, ``rel_type``, ``broken_doc_id``.
    """
    caller = _uid(user_id)
    edges_res = await run_in_threadpool(
        lambda: supabase.table("document_relationships")
        .select("id, source_doc_id, target_doc_id, rel_type")
        .eq("user_id", caller)
        .execute()
    )

    broken: list[dict] = []
    # Cache resolver + existence verdicts within this request — a doc appears on many edges.
    readable_latest_id: dict[str, str | None] = {}
    latest_alive: dict[str, bool] = {}

    async def _readable_latest_id(doc_id: str) -> str | None:
        # The openable end for the link-out: the RESOLVED LATEST id, NOT the raw edge
        # endpoint id (WR-02). The endpoint may itself be an old (is_latest=False) version —
        # surfacing that raw id makes `listDocuments()` (is_latest-only) return nothing, so the
        # frontend resolves it to undefined and the row is a silent dead click. `_resolve_readable_latest`
        # is already owner-scoped (its returned row is own-latest ∪ global-latest); we capture
        # THAT row's id so the link-out targets a row the doc list actually returns. The resolver
        # degrades to a stale old row when no current latest exists, so we only carry it when the
        # resolved row is itself is_latest — otherwise the end has no openable target (None).
        if doc_id not in readable_latest_id:
            row = await _resolve_readable_latest(doc_id, user_id, supabase=supabase)
            readable_latest_id[doc_id] = (
                row["id"] if (row is not None and bool(row.get("is_latest"))) else None
            )
        return readable_latest_id[doc_id]

    async def _is_broken(doc_id: str) -> bool:
        # Broken = NO current `is_latest=True` row exists for this lineage ANYWHERE (the
        # latest was deleted; the edge dangles off an orphaned old version — A1). A doc whose
        # latest is alive but unreadable to the caller (another user's private doc) is MASKED,
        # NOT broken (D-119-3) — `_latest_exists_anywhere` returns True for it.
        if doc_id not in latest_alive:
            latest_alive[doc_id] = await _latest_exists_anywhere(supabase, doc_id)
        return not latest_alive[doc_id]

    for edge in (edges_res.data or []):
        src = edge.get("source_doc_id")
        tgt = edge.get("target_doc_id")
        src_broken = await _is_broken(src) if src else False
        tgt_broken = await _is_broken(tgt) if tgt else False

        # An edge is dangling when EITHER endpoint was fully deleted. Surface the broken end +
        # the readable end's RESOLVED LATEST id (WR-02), so the row links out to a doc that
        # `listDocuments()` (is_latest-only) actually returns — None if that end has no current
        # readable latest (both ends gone, or the surviving end is itself an old version).
        broken_ends = []
        if src_broken:
            broken_ends.append((src, (await _readable_latest_id(tgt)) if tgt else None))
        if tgt_broken:
            broken_ends.append((tgt, (await _readable_latest_id(src)) if src else None))

        for broken_doc_id, readable_doc_id in broken_ends:
            broken.append({
                "relationship_id": edge.get("id"),
                "rel_type": edge.get("rel_type"),
                "broken_doc_id": broken_doc_id,
                # readable_doc_id is the RESOLVED LATEST id of the openable end (WR-02) —
                # None if both ends are gone OR the surviving end has no current readable latest.
                "readable_doc_id": readable_doc_id,
                "document_id": readable_doc_id,  # the link-out target the row opens
            })

    total = len(broken)
    page = broken[offset:offset + limit]
    return {"items": page, "total": total, "offset": offset, "limit": limit}


def _fetch_unclassified(
    supabase: Client, user_id: str, offset: int = 0, limit: int = DEFAULT_LIMIT
) -> dict:
    """D-119-4 — the caller's latest docs with a PENDING classification suggestion.

    Mirrors ``_fetch_never_retrieved``'s SQL-level shape, with a deep-jsonb path equality on
    ``_classification.status == "suggested"``. The PostgREST path form is the DOTTED form
    ``metadata->_classification->>status`` — pinned GREEN live on :54322 (A3): the quoted-arrow
    form returns nothing for the ``_``-leading key. accept sets status "accepted" and dismiss POPs
    the whole key, so this equality naturally excludes both (no "dismissed" handling needed).
    """
    res = (
        supabase.table("documents")
        .select("id, filename, folder_id, metadata", count="exact")
        .eq("user_id", _uid(user_id))
        .eq("is_latest", True)
        .eq("metadata->_classification->>status", "suggested")  # A3 dotted form (live-pinned)
        .range(offset, offset + limit - 1)
        .execute()
    )

    items = []
    for doc in (res.data or []):
        sugg = (doc.get("metadata") or {}).get("_classification") or {}
        items.append({
            "document_id": doc["id"],
            "filename": doc.get("filename"),
            "folder_id": doc.get("folder_id"),
            "suggested_folder_name": sugg.get("suggested_folder_name"),
        })

    return {"items": items, "total": res.count or 0, "offset": offset, "limit": limit}


def _is_empty(value) -> bool:
    """A field value the detail panel treats as empty (mirror of
    ``DocumentDetailPanel.resolveFieldState``'s ``empty``): ``None``, an empty/whitespace
    string, or an empty list. An empty-valued field is MISSING metadata, not LOW-confidence
    metadata — so it must not drive the low-confidence signal (see ``_fetch_low_confidence``).
    """
    return (
        value is None
        or (isinstance(value, str) and value.strip() == "")
        or (isinstance(value, list) and len(value) == 0)
    )


def _fetch_low_confidence(
    supabase: Client, user_id: str, offset: int = 0, limit: int = DEFAULT_LIMIT
) -> dict:
    """D-119-5 — the caller's latest docs with a populated, unconfirmed field whose
    ``_confidence`` is below the cutoff.

    NOT PostgREST-expressible → fetch the caller's latest docs (capped) and scan in Python.
    Number guards (RESEARCH A4): skip docs with no ``_confidence`` dict; only consider values
    that are ``isinstance(v, (int, float)) and not isinstance(v, bool)`` (``True``/``False`` are
    ``int`` subclasses — a naive ``v < 0.5`` would treat ``False`` as a 0.0 low score); ``0.0``
    is a LEGITIMATE low value (never truthiness-test).

    Field-eligibility guards (BUG-260620: a doc surfaced here but its opened detail panel showed
    nothing low) — match the panel's ``isLow`` predicate (``DocumentDetailPanel.resolveFieldState``:
    ``!empty && source !== "user" && score < LOW_TIER``) so the governance signal can never report
    a field the panel hides:
      * skip ``_``-prefixed keys (``_confidence``/``_source``/… are internal, never fields);
      * skip fields whose VALUE is empty — the extractor left them blank, so they are *missing*
        metadata, not *low-confidence* metadata (this was the live defect: ``date``/``author``
        extracted as ``None`` carried a 0.1 score and falsely flagged the doc);
      * skip fields the user confirmed (``metadata._source[field] == "user"``) — a user-set value
        is authoritative regardless of the original extraction score.

    Each item carries the per-field below-cutoff map (``low_fields``) and ``min_confidence`` (the
    worst field's score) for the row chip; the list is sorted ascending by ``min_confidence``
    (worst first), then page-sliced.
    """
    res = (
        supabase.table("documents")
        .select("id, filename, folder_id, metadata")
        .eq("user_id", _uid(user_id))
        .eq("is_latest", True)
        .limit(LOW_CONF_SCAN_CAP)
        .execute()
    )

    rows = []
    for doc in (res.data or []):
        metadata = doc.get("metadata") or {}
        confidence = metadata.get("_confidence")
        if not isinstance(confidence, dict):
            continue  # no per-field confidence map → not a low-conf candidate
        source_map = metadata.get("_source")
        if not isinstance(source_map, dict):
            source_map = {}
        low_fields = {
            field: value
            for field, value in confidence.items()
            # 0.0 is a real low value; guard non-numeric / None / bool (bool is an int subclass).
            if isinstance(value, (int, float)) and not isinstance(value, bool)
            and value < LOW_CONF_CUTOFF
            # Match the panel's isLow: a real, populated, non-user-confirmed field only.
            and not field.startswith("_")
            and not _is_empty(metadata.get(field))
            and source_map.get(field) != "user"
        }
        if not low_fields:
            continue
        rows.append({
            "document_id": doc["id"],
            "filename": doc.get("filename"),
            "folder_id": doc.get("folder_id"),
            "low_fields": low_fields,
            "min_confidence": min(low_fields.values()),
        })

    rows.sort(key=lambda r: r["min_confidence"])  # worst-confidence first
    total = len(rows)
    page = rows[offset:offset + limit]
    return {"items": page, "total": total, "offset": offset, "limit": limit}


# ── Endpoints ───────────────────────────────────────────────────────────────────

def _pagination_params(
    offset: int = Query(0, ge=0),
    limit: int = Query(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
) -> tuple[int, int]:
    return offset, limit


@router.get("/broken-relationships")
async def governance_broken_relationships(
    offset_limit: tuple[int, int] = Depends(_pagination_params),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """Return the caller's broken/dangling relationships (target resolves to no readable
    latest version, D-119-3)."""
    user_id = current_user["id"]
    offset, limit = offset_limit
    try:
        return await _fetch_broken_relationships(supabase, user_id, offset, limit)
    except Exception as exc:
        # A malformed user/doc id (ValueError from _uid) or a transient DB error collapses to a
        # calm 502 — never a 500 stack trace, never an existence oracle.
        raise HTTPException(
            status_code=502,
            detail="Governance metrics temporarily unavailable",
        ) from exc


@router.get("/unclassified")
async def governance_unclassified(
    offset_limit: tuple[int, int] = Depends(_pagination_params),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """Return the caller's docs with a pending classification suggestion (D-119-4)."""
    user_id = current_user["id"]
    offset, limit = offset_limit
    try:
        # SYNC supabase-py call → threadpool so the async handler never blocks (D-v2.5-01).
        return await run_in_threadpool(_fetch_unclassified, supabase, user_id, offset, limit)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="Governance metrics temporarily unavailable",
        ) from exc


@router.get("/low-confidence")
async def governance_low_confidence(
    offset_limit: tuple[int, int] = Depends(_pagination_params),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """Return the caller's docs with any extracted field below the confidence cutoff
    (D-119-5)."""
    user_id = current_user["id"]
    offset, limit = offset_limit
    try:
        # SYNC supabase-py call → threadpool so the async handler never blocks (D-v2.5-01).
        return await run_in_threadpool(_fetch_low_confidence, supabase, user_id, offset, limit)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="Governance metrics temporarily unavailable",
        ) from exc
