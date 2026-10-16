"""The document-search CORE — Phase 271 (FIND-01 / FIND-02 / FIND-03).

Find is its own mode beside RAG (FIND-02): an EXACT field match over the documents the
caller can see, in a STATED server order, paged on the server, with an exact total. It
returns whole ``documents`` rows (one per document), never a passage or a chunk, and it
ranks nothing.

It sits BESIDE ``document_view_resolver.resolve_filter`` and reuses it rather than forking
it (D-115-6: "a fork re-opens the leak"): metadata conditions go through the resolver's
extracted ``validate_and_compile`` + ``apply_fragments`` — the shipped whitelist, the
``_``-prefix reject, the numeric-range reject and the bound-param walk. ``resolve_filter``
itself is NOT reused because its contract is the opposite of Find's on three points
(latest only, ``created_at desc``, no paging) and on the fourth it drops an unreachable
folder scope (D-113-5) — exactly "a filter the backend silently ignores".

FastAPI-free on purpose (the resolver precedent): it raises a plain ``ResolveError``; the
route re-wraps it. Phase 272's agent tool can call it in-process.

Phase 284 (FIX-11; D-14, R-12) — **Find pages in the database.** Migration 207's
``public.library_documents`` (a ``security_invoker`` view) is the ONE SQL home of the Library's
visible set and of the two lineage facts (``version_count``, ``has_earlier``). A search is now ONE
builder over it — the shipped appliers below (unchanged), then ``.order(col, nullsfirst=False)
.order("id").range(offset, offset + limit - 1)`` with ``count="exact"``. Nothing is read beyond
the page: no candidate walk, no Python sort, no Python slice, no lineage read. At 50,000
documents page 1 took 16.9 s before this (284-MEASUREMENTS.md).

Safety invariants:
  - **Caller-scoped legs, kept as TWO queries.** Own leg ``user_id = caller``; global leg
    ``folder_id IN get_globally_visible_folder_ids(caller)`` — the same pair
    ``list_documents`` and the detail panel's gate use. Never collapsed into one ``or_``
    (RESEARCH A6). Every allow-list (folder subtree, relationship ids) is applied INSIDE
    both legs, so it can only NARROW visibility, never widen it. The route passes the
    user-JWT client, so RLS is the wall underneath both legs.
    ⚠ **SUPERSEDED 2026-10-16 (Phase 284, D-14 / R-11)** — kept, not deleted, because the
    property it protected still holds and is now STRONGER. The union is SQL inside the
    ``security_invoker`` view (own ∪ org-shared folders the caller does not own, RLS beneath
    it); this module interpolates NO visibility predicate anywhere — not an ``or_`` string, not
    a folder-id list. Every allow-list still only narrows (it is ANDed onto the one read). The
    service role reads ZERO rows from the view (``auth.uid()`` is NULL), so this core is
    fail-closed for any caller that is not a user JWT.
  - **An unreachable folder returns ZERO rows** — the opposite of D-113-5. A folder the
    caller cannot see narrows to nothing; it never silently becomes "no narrowing".
  - **No embedding call, no retrieval import, no RPC call** (D-03). Pinned by
    ``tests/unit/test_271_no_embedding.py`` (a raising patch + a source fence over this
    file, which is why the forbidden names are not even spelled out here).
  - **Exact total or fail loud.** The page is read with ``count="exact"``; the total is the
    server's count, never ``len(rows)``. A page that comes back SHORT of what that count
    promises raises ``SearchTruncatedError`` (503), and so does a relationship allow-list above
    ``REL_EDGE_CAP`` edges — never a silently truncated answer (PostgREST ``max-rows``).
  - **Server order is THE order** (D-03). Nulls last in both directions, ties on ``id``;
    the client never re-sorts.
  - **Values are bound, never interpolated** (SC#4): every value rides a builder param;
    ``.in_`` carries ids only (it escapes neither a double quote nor a backslash, so filename lists go
    through ``_pg_in_list`` — 271-REVIEW WR-04); ids are UUID-typed by the request model; the name escapes
    ``\\``, ``%`` and ``_`` before it is wrapped.
  - Every ``.execute()`` rides ``aexec`` (D-v2.5-01). No module-level mutable cache
    (multi-worker uvicorn, D-PRD-12).
"""

from __future__ import annotations

import logging
from datetime import date, timedelta

from supabase import Client

from app.models.document_search import DocumentSearchRequest, FindRelationship
from app.services.document_relationship_service import (
    _INVERSE_LABEL,
    _resolve_readable_latest,
    _subject_version_ids,
)
from app.services.document_vocabulary import TIMESTAMP_DATE_COLUMNS as _DATE_COLUMN
from app.services.document_view_resolver import (
    LIBRARY_ROW_COLUMNS,
    ResolveError,
    _relative_window,
    apply_fragments,
    validate_and_compile,
)
from app.services.harness.scope import resolve_project_subtree
from app.utils.db import aexec, aexec_page
from app.utils.folder_utils import fetch_visible_folders

log = logging.getLogger(__name__)

#: The page row (read from migration 207's ``public.library_documents`` — the Library visible set,
#: D-04, security_invoker, SELECT-only): every column of the view except the sort key ``filename_key`` (ordered by,
#: never returned). ``full_markdown`` is not in the view at all (up to ~267 KB per row; Find
#: used to send it to the browser). Pinned to the migration's own column list by
#: ``tests/unit/test_284_find_sql.py``, so a column added to the view must be added here too.
FIND_SELECT = LIBRARY_ROW_COLUMNS + ",version_count,has_earlier"

#: D-14 / T-284-25 — a relationship allow-list is bounded by ONE document's edges, not by the
#: library. Above this many edges the search refuses (503) instead of PostgREST cutting the edge
#: read at max_rows (1,000) and answering short without saying so.
REL_EDGE_CAP = 500


def _pg_in_list(values: list[str]) -> str:
    r"""A PostgREST ``in.(...)`` list with EVERY member quoted and ``\`` / ``"`` escaped.

    271-REVIEW WR-04: postgrest-py's ``.in_()`` quotes a value only when it holds ``,:()``
    and escapes nothing inside the quotes. Measured against PostgREST 14.10, a filename like
    ``Q3 "final", draft.pdf`` is then read as two wrong names — a 200, not an error — so the
    lineage and relationship reads silently miss that document. File names come from users
    and cloud drives, so they get this path; ids and UUIDs keep ``.in_()``. (Since 284 the
    lineage facts are the view's columns; the relationship follow-to-latest read still uses this.)
    """
    return "(" + ",".join(
        '"' + v.replace("\\", "\\\\").replace('"', '\\"') + '"' for v in values
    ) + ")"

# The three timestamptz dates (P-10). "Date in the document" is NOT here: it is the
# shipped compiler's ``date`` field on ``date_typed`` (a ``date``), via ``filter_expr``.
# ``_DATE_COLUMN`` is imported from its ONE home, ``document_vocabulary`` (DEBT-09, Phase 278).

# Sort key → (column, descending). P-01: the default is ``added_desc``. 284: the order runs in
# SQL; ``name_asc`` orders by the view's ``filename_key`` (``lower(filename) COLLATE "C"`` —
# codepoint order, the Python ``casefold`` sort it replaces, RESEARCH A7).
_SORT = {
    "added_desc": ("created_at", True),
    "added_asc": ("created_at", False),
    "document_date_desc": ("date_typed", True),
    "source_modified_desc": ("source_modified_at", True),
    "source_created_desc": ("source_created_at", True),
    "name_asc": ("filename_key", False),
}
# 278-REVIEW WR-02: derived from the home, never re-typed — a date word added to
# ``document_vocabulary.TIMESTAMP_DATE_COLUMNS`` must sort as a datetime here too, not as a string.
# Same type (``set``) and same members as the hand-typed literal it replaces.
# 284: the sort is SQL now, so timestamptz columns sort as timestamps natively and nothing in this
# module reads this set any more. It stays because ``test_278_vocabulary_one_home`` pins its
# derivation from the vocabulary home (DEBT-09); deleting it is that fence's decision, not this one's.
_TIMESTAMP_COLUMNS = set(_DATE_COLUMN.values())

_NOT_IN_A_FOLDER = object()  # sentinel: folder condition = "Not in a folder"

# Incoming verb → its stored rel_type (the inverse of ``_INVERSE_LABEL``, never retyped).
_REL_TYPE_OF_INCOMING = {inverse: stored for stored, inverse in _INVERSE_LABEL.items()}

TRUNCATED_DETAIL = "Couldn't read every matching document. Narrow the search and try again."


class SearchTruncatedError(ResolveError):
    """A read came back SHORT of the count the server reported (Pitfall 2), or a relationship
    allow-list exceeded ``REL_EDGE_CAP`` edges.

    Status 503: the answer would be incomplete, so the search refuses rather than showing
    a short list as if it were the whole result.
    """

    def __init__(self, detail: str = TRUNCATED_DETAIL, status: int = 503):
        super().__init__(detail=detail, status=status)


def _zero_result(req: DocumentSearchRequest, *, older_matches: int = 0) -> dict:
    """The zero-result shape — the SAME keys as any answer (no existence oracle)."""
    return {
        "documents": [],
        "total": 0,
        "older_matches": older_matches,
        "sort": req.sort,
        "offset": req.offset,
        "limit": req.limit,
    }


def _escape_like(text: str) -> str:
    """Escape the LIKE metacharacters ``\\``, ``%`` and ``_`` (backslash FIRST).

    A typed ``*`` is a PostgREST wildcard too and is left as is (RESEARCH A4): it can only
    widen the caller's own name match, never their visibility.
    """
    return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _day_after(iso_day: str) -> str:
    return (date.fromisoformat(iso_day) + timedelta(days=1)).isoformat()


# ─────────────────────────────── structure appliers ───────────────────────────────


def _apply_name(q, req: DocumentSearchRequest):
    if req.name:
        q = q.ilike("filename", f"%{_escape_like(req.name)}%")
    return q


def _apply_folder(q, folder_ids):
    if folder_ids is _NOT_IN_A_FOLDER:
        q = q.is_("folder_id", "null")
    elif folder_ids is not None:
        q = q.in_("folder_id", folder_ids)
    return q


def _apply_added_by(q, req: DocumentSearchRequest, caller: str):
    """Mirror 270's ``addedBy`` (connection FIRST, 270 F-2); never an email (270 P-02)."""
    ab = req.added_by
    if ab is None:
        return q
    if ab.kind == "me":
        q = q.eq("user_id", caller).is_("source_connection_id", "null")
    elif ab.kind == "connection":
        q = q.eq("source_connection_id", str(ab.connection_id))
    else:  # others
        q = q.neq("user_id", caller).is_("source_connection_id", "null")
    return q


def _apply_dates(q, req: DocumentSearchRequest):
    """timestamptz day boundaries (Pitfall 3): a whole calendar day is ``>= d AND < d+1``.

    ``before d`` → ``< d``; ``after d`` → ``>= d+1``; ``between a b`` → ``>= a`` and
    ``< b+1``. Relative windows come from the SHIPPED ``_relative_window`` (D-114-16 — never
    re-derived): ``within_next`` → ``>= today`` and ``< (today+N)+1``; ``older_than`` →
    ``< today-N`` (strict, matching the resolver's WR-03 contract).
    """
    for d in req.dates:
        col = _DATE_COLUMN[d.which]
        if d.op == "before":
            q = q.lt(col, d.value)
        elif d.op == "after":
            q = q.gte(col, _day_after(d.value))
        elif d.op == "between":
            q = q.gte(col, d.value).lt(col, _day_after(d.value2))
        else:
            low, high = _relative_window(d.op, d.value, d.unit)
            if low is not None:
                q = q.gte(col, low)
            if high is not None:
                q = q.lt(col, high) if d.op == "older_than" else q.lt(col, _day_after(high))
    return q


def _apply_version(q, version: str):
    # latest / has_earlier → latest rows (has_earlier narrows further by lineage, in
    # ``_find_query``); older → the non-latest rows (D-06). No state ever mixes the two.
    return q.eq("is_latest", version != "older")


def _apply_archived(q, include_archived: bool):
    # Phase 275 (RET-04 / D-18) — Find hides archived documents unless the person asks for them.
    # Open / download routes are NOT filtered: an archived document stays openable.
    return q if include_archived else q.is_("archived_at", "null")


def _apply_ids(q, id_allow):
    if id_allow is not None:
        q = q.in_("id", sorted(id_allow))
    return q


# ─────────────────────────────── reads ───────────────────────────────


async def _resolve_folder(req: DocumentSearchRequest, caller: str, supabase: Client):
    """``None`` (no condition) · ``_NOT_IN_A_FOLDER`` · a caller-visible id LIST.

    The list may be EMPTY — the caller cannot see the folder — and the caller then returns
    zero rows (the opposite of D-113-5, which turns an unreachable scope into no narrowing).
    """
    folder = req.folder
    if folder is None:
        return None
    if folder.folder_id is None:
        return _NOT_IN_A_FOLDER
    root = str(folder.folder_id)
    visible = {str(f["id"]) for f in await fetch_visible_folders(supabase, caller)}
    if root not in visible:
        return []
    if not folder.include_subfolders:
        return [root]
    # resolve_project_subtree always includes the root and walks the caller's visible tree;
    # intersect with the visible set anyway (the resolver's own guard, D-113-5 mechanics).
    raw = await resolve_project_subtree(root, supabase=supabase, user_id=caller) or [root]
    return [fid for fid in raw if str(fid) in visible]


async def _relationship_allow_list(
    caller: str, rel: FindRelationship, supabase: Client
) -> tuple[set[str], set[str]] | None:
    """``<result> <verb> <picked P>`` → ``(latest_ids, older_ids)``, or ``None`` if P is unreadable.

    P-02 (RESEARCH Pattern 3), both directions (D-04 / D-05):
      * an OUTGOING verb (a stored ``rel_type``: supersedes / amends / references /
        attached_to) matches the edge SOURCES whose target is in P's lineage;
      * an INCOMING verb (its inverse label) matches the edge TARGETS whose source is in
        P's lineage — so "is superseded by A" is non-empty whenever A supersedes something
        in P's lineage, never "outgoing links only".
    P is matched BY LINEAGE (``_subject_version_ids``) so an edge recorded on P's old
    version still counts (D-116-1a). For Latest / Has earlier each matched endpoint follows
    to its lineage's latest row and P's own latest is excluded (a link inside one lineage is
    not "X supersedes X"); for Older versions the endpoints are row-exact — the rows the
    link was recorded on. ``older_ids`` is therefore what "Show them" lists.

    ⛔ Both helpers are handed the route's user-JWT client explicitly: their ``None``
    default is the SERVICE-ROLE client, which would switch RLS off. The edge read is
    also ``user_id = caller`` (RLS on ``document_relationships`` is owner-only anyway).
    An unreadable P returns ``None`` → the caller answers with the zero-result shape, so
    the picker can never become an existence oracle.

    Bounded by ONE document's edges, never by the library (D-14): the edge read asks for at
    most ``REL_EDGE_CAP + 1`` rows and a hub above the cap raises ``SearchTruncatedError``
    rather than being cut silently at PostgREST's max_rows. Every later read is an ``in.()``
    over at most that many endpoints.
    """
    p_row = await _resolve_readable_latest(str(rel.document_id), caller, supabase=supabase)
    if p_row is None:
        return None
    versions = await _subject_version_ids(p_row, supabase=supabase)

    if rel.verb in _INVERSE_LABEL:  # outgoing: result is the SOURCE
        rel_type, match_col, result_col = rel.verb, "target_doc_id", "source_doc_id"
    else:  # incoming: result is the TARGET
        rel_type, match_col, result_col = _REL_TYPE_OF_INCOMING[rel.verb], "source_doc_id", "target_doc_id"

    edges = await aexec(
        supabase.table("document_relationships")
        .select("source_doc_id,target_doc_id")
        .eq("rel_type", rel_type)
        .eq("user_id", caller)
        .in_(match_col, versions)
        .limit(REL_EDGE_CAP + 1)
    )
    edge_rows = edges.data or []
    if len(edge_rows) > REL_EDGE_CAP:
        log.warning("document search relationship allow-list above %s edges; refused", REL_EDGE_CAP)
        raise SearchTruncatedError()
    endpoints = sorted({str(e[result_col]) for e in edge_rows if e.get(result_col)})
    if not endpoints:
        return set(), set()

    rows = (
        await aexec(
            supabase.table("documents").select("id,user_id,filename,is_latest").in_("id", endpoints)
        )
    ).data or []
    latest_ids = {r["id"] for r in rows if r.get("is_latest")}
    older_ids = {r["id"] for r in rows if not r.get("is_latest")}

    # Follow each non-latest endpoint to its lineage's latest row — ONE batched read.
    stale = [r for r in rows if not r.get("is_latest") and r.get("user_id") and r.get("filename")]
    if stale:
        wanted = {(r["user_id"], r["filename"]) for r in stale}
        heads = (
            await aexec(
                supabase.table("documents")
                .select("id,user_id,filename")
                .in_("user_id", sorted({k[0] for k in wanted}))
                .filter("filename", "in", _pg_in_list(sorted({k[1] for k in wanted})))
                .eq("is_latest", True)
            )
        ).data or []
        latest_ids |= {h["id"] for h in heads if (h.get("user_id"), h.get("filename")) in wanted}

    latest_ids.discard(p_row["id"])  # P's own lineage latest is never its own match
    return latest_ids, older_ids


# ─────────────────────────────── the core ───────────────────────────────


def _find_query(
    q,
    *,
    caller: str,
    req: DocumentSearchRequest,
    version: str,
    fragments: list,
    folder_ids,
    id_allow,
):
    """Every condition, ANDed onto ONE read of the view. Only narrows — never widens.

    ``structure`` is the shipped composition, unchanged. The version state adds one column
    filter on top: ``older`` is the caller's OWN rows only (P-03 — a colleague's superseded
    versions never show), ``has_earlier`` is the view's lineage fact.
    """

    def structure(q):
        q = apply_fragments(q, fragments)  # the SHARED walk (no fork, D-115-6)
        q = _apply_name(q, req)
        q = _apply_folder(q, folder_ids)
        q = _apply_added_by(q, req, caller)
        q = _apply_dates(q, req)
        q = _apply_version(q, version)
        q = _apply_archived(q, req.include_archived)
        q = _apply_ids(q, id_allow)
        return q

    q = structure(q)
    if version == "older":
        q = q.eq("user_id", caller)
    elif version == "has_earlier":
        q = q.eq("has_earlier", True)
    return q


async def _attach_connection_names(rows: list[dict], supabase: Client) -> None:
    """The connection NAME for connector-placed rows (Phase 270 P-02) — ONE read, page-bounded.

    Mirror of ``api/documents.py``'s list decoration: the ids are at most the page's. Decoration
    only — a failure leaves every name ``None``, never a 500.
    """
    conn_ids = sorted({d["source_connection_id"] for d in rows if d.get("source_connection_id")})
    conn_names: dict[str, str] = {}
    if conn_ids:
        try:
            conn_res = await aexec(
                supabase.table("connector_connections").select("id, name").in_("id", conn_ids)
            )
            conn_names = {r["id"]: r.get("name") for r in (conn_res.data or [])}
        except Exception:
            log.debug("connection-name lookup failed; names stay None")
    for d in rows:
        sid = d.get("source_connection_id")
        d["source_connection_name"] = conn_names.get(sid) if sid else None


async def search_documents(*, caller: str, req: DocumentSearchRequest, supabase: Client) -> dict:
    """Find documents by structured fields. Returns the plain-dict response (no model).

    ``{"documents": [row…], "total", "older_matches", "sort", "offset", "limit"}`` — each
    row is a ``library_documents`` row (``FIND_SELECT``: the document's columns without
    ``full_markdown``, plus ``version_count`` and ``has_earlier``) and ``source_connection_name``.
    Performs no write and no audit entry (safe per keystroke).

    ⛔ Pass the route's USER-JWT client. The view is keyed on ``auth.uid()``, so the service role
    reads zero rows — fail-closed, never "everything".
    """
    caller = str(caller)

    # (a) metadata conditions — the shipped validation + compile (422 on a bad field).
    fragments: list = []
    if req.filter_expr.conditions:
        fragments = await validate_and_compile(caller, req.filter_expr, supabase)

    # (b) folder: unreachable → zero rows (never "no narrowing").
    folder_ids = await _resolve_folder(req, caller, supabase)
    if isinstance(folder_ids, list) and not folder_ids:
        return _zero_result(req)

    id_allow = None
    older_matches = 0
    rel_older: set[str] = set()

    # (c) relationship → an id allow-list, ANDed onto the one read (it only narrows).
    if req.relationship is not None:
        allow = await _relationship_allow_list(caller, req.relationship, supabase)
        if allow is None:
            return _zero_result(req)  # unreadable P: the same shape as "no matches"
        rel_latest, rel_older = allow
        id_allow = rel_older if req.version == "older" else rel_latest

    def query(select: str, version: str, allow):
        return _find_query(
            supabase.table("library_documents").select(select, count="exact"),
            caller=caller, req=req, version=version, fragments=fragments,
            folder_ids=folder_ids, id_allow=allow,
        )

    # older_matches (P-02's hint): only for version=latest with a relationship set. It is
    # the SAME pipeline with version="older" — so pressing "Show them" (the same request
    # with version=older) returns exactly this many rows. Counted by a HEAD read, never rows.
    if req.version == "latest" and req.relationship is not None and rel_older:
        head = await aexec(query("id", "older", rel_older).limit(1))
        older_matches = head.count if isinstance(head.count, int) else len(head.data or [])

    if id_allow is not None and not id_allow:
        # An empty allow-list: never send `.in_("id", [])`; answer with the zero shape.
        return _zero_result(req, older_matches=older_matches)

    # (d) the page — ONE ranged read; order, total and slice are all the database's.
    col, desc = _SORT[req.sort]
    #     284-REVIEW CR-01: a page past the end is `[]` + the exact total, never PostgREST's 416.
    res = await aexec_page(
        lambda: query(FIND_SELECT, req.version, id_allow)
        .order(col, desc=desc, nullsfirst=False)
        .order("id"),
        offset=req.offset,
        limit=req.limit,
    )
    documents = list(res.data or [])
    count = getattr(res, "count", None)
    # The isinstance guard is load-bearing: a missing / non-int count (a test double's
    # MagicMock) is never evidence of truncation, and never becomes the total.
    total = count if isinstance(count, int) else len(documents)
    if isinstance(count, int) and len(documents) < min(req.limit, max(count - req.offset, 0)):
        log.warning(
            "document search page SHORT: %s rows at offset %s of %s", len(documents), req.offset, count
        )
        raise SearchTruncatedError()

    # (e) decoration over the page only.
    await _attach_connection_names(documents, supabase)

    return {
        "documents": documents,
        "total": total,
        "older_matches": older_matches,
        "sort": req.sort,
        "offset": req.offset,
        "limit": req.limit,
    }
