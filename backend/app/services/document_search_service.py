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

Safety invariants:
  - **Caller-scoped legs, kept as TWO queries.** Own leg ``user_id = caller``; global leg
    ``folder_id IN get_globally_visible_folder_ids(caller)`` — the same pair
    ``list_documents`` and the detail panel's gate use. Never collapsed into one ``or_``
    (RESEARCH A6). Every allow-list (folder subtree, relationship ids) is applied INSIDE
    both legs, so it can only NARROW visibility, never widen it. The route passes the
    user-JWT client, so RLS is the wall underneath both legs.
  - **An unreachable folder returns ZERO rows** — the opposite of D-113-5. A folder the
    caller cannot see narrows to nothing; it never silently becomes "no narrowing".
  - **No embedding call, no retrieval import, no RPC call** (D-03). Pinned by
    ``tests/unit/test_271_no_embedding.py`` (a raising patch + a source fence over this
    file, which is why the forbidden names are not even spelled out here).
  - **Exact total or fail loud.** Candidates are read with ``count="exact"`` and walked
    with ``.range()`` until the reported count; a short read raises
    ``SearchTruncatedError`` (503) — never a silently truncated answer (PostgREST
    ``max-rows``, RESEARCH Pitfall 2).
  - **Server order is THE order** (D-03). Nulls last in both directions, ties on ``id``;
    the client never re-sorts.
  - **Values are bound, never interpolated** (SC#4): every value rides a builder param;
    ``.in_`` quotes members; ids are UUID-typed by the request model; the name escapes
    ``\\``, ``%`` and ``_`` before it is wrapped.
  - Every ``.execute()`` rides ``aexec`` (D-v2.5-01). No module-level mutable cache
    (multi-worker uvicorn, D-PRD-12).
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta

from supabase import Client

from app.models.document_search import DocumentSearchRequest
from app.services.document_view_resolver import (
    ResolveError,
    _relative_window,
    apply_fragments,
    validate_and_compile,
)
from app.services.harness.scope import resolve_project_subtree
from app.utils.db import aexec
from app.utils.folder_utils import fetch_visible_folders, get_globally_visible_folder_ids

log = logging.getLogger(__name__)

# The lightweight candidate projection: everything the filters, the sort and the lineage
# step need, and nothing else. Page rows are re-read with ``select("*")`` afterwards.
CANDIDATE_COLUMNS = (
    "id,user_id,filename,folder_id,version_number,is_latest,created_at,"
    "source_created_at,source_modified_at,date_typed,source_connection_id"
)
_LINEAGE_COLUMNS = "id,user_id,filename,version_number,folder_id"
_PAGE = 1000
# Lineage reads filter ``filename IN (...)``; keep each request's URL bounded.
_LINEAGE_BATCH = 100

# The three timestamptz dates (P-10). "Date in the document" is NOT here: it is the
# shipped compiler's ``date`` field on ``date_typed`` (a ``date``), via ``filter_expr``.
_DATE_COLUMN = {
    "added": "created_at",
    "source_created": "source_created_at",
    "source_modified": "source_modified_at",
}

# Sort key → (column, descending). P-01: the default is ``added_desc``.
_SORT = {
    "added_desc": ("created_at", True),
    "added_asc": ("created_at", False),
    "document_date_desc": ("date_typed", True),
    "source_modified_desc": ("source_modified_at", True),
    "source_created_desc": ("source_created_at", True),
    "name_asc": ("filename", False),
}
_TIMESTAMP_COLUMNS = {"created_at", "source_created_at", "source_modified_at"}

_NOT_IN_A_FOLDER = object()  # sentinel: folder condition = "Not in a folder"

TRUNCATED_DETAIL = "Couldn't read every matching document. Narrow the search and try again."


class SearchTruncatedError(ResolveError):
    """A candidate read came back SHORT of the count the server reported (Pitfall 2).

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
    # latest / has_earlier → latest rows (has_earlier narrows further by lineage, below);
    # older → the non-latest rows (D-06). No state ever mixes the two.
    return q.eq("is_latest", version != "older")


def _apply_ids(q, id_allow):
    if id_allow is not None:
        q = q.in_("id", sorted(id_allow))
    return q


# ─────────────────────────────── reads ───────────────────────────────


async def _fetch_all(build) -> list[dict]:
    """Read EVERY row a filter matches: ``count="exact"`` + a ``.range()`` walk.

    ``build(count)`` returns a FRESH builder (select first, then every filter) for each
    page — the folder_utils ``fetch_all_folders(strict=True)`` precedent. Ordered by ``id``
    so pages cannot overlap or skip. The ``isinstance(total, int)`` guard is load-bearing:
    a missing / non-int count (a test double's MagicMock) is never evidence of truncation.
    """
    first = await aexec(build(True).order("id").range(0, _PAGE - 1))
    rows = list(first.data or [])
    total = getattr(first, "count", None)
    if not isinstance(total, int):
        return rows
    while len(rows) < total:
        page = await aexec(build(False).order("id").range(len(rows), len(rows) + _PAGE - 1))
        batch = page.data or []
        if not batch:
            break
        rows.extend(batch)
    if len(rows) < total:
        log.warning("document search read TRUNCATED: %s of %s rows", len(rows), total)
        raise SearchTruncatedError()
    return rows


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


async def _lineage_rows(rows: list[dict], supabase: Client) -> list[dict]:
    """ONE batched lineage read over the rows' ``(user_id, filename)`` pairs.

    The lineage key is ``(user_id, filename)`` — the handle ``list_document_versions`` and
    ``_subject_version_ids`` use (RESEARCH §Definitions / A7). The read is a superset
    (owners × names); exact pairs are matched in Python. Batched by filename so a very large
    candidate set never builds an unbounded URL.
    """
    owners = sorted({r["user_id"] for r in rows if r.get("user_id")})
    names = sorted({r["filename"] for r in rows if r.get("filename")})
    if not owners or not names:
        return []
    out: list[dict] = []
    for i in range(0, len(names), _LINEAGE_BATCH):
        chunk = names[i:i + _LINEAGE_BATCH]

        def build(count: bool, chunk=chunk):
            return (
                supabase.table("documents")
                .select(_LINEAGE_COLUMNS, count="exact" if count else None)
                .in_("user_id", owners)
                .in_("filename", chunk)
            )

        out.extend(await _fetch_all(build))
    return out


def _lineage_facts(rows: list[dict], lineage: list[dict], caller: str, global_ids: list[str]):
    """Per row: ``(version_count, has_earlier)`` over the VISIBLE rows of its lineage.

    Visible = passes a leg: own (``user_id == caller``) or in a globally-visible folder.
    ``has_earlier`` (P-05) = a visible lineage row with a LOWER ``version_number`` exists.
    (The shipped chevron's ``version_number > 1`` diverges after a delete; recorded, not
    changed here.)
    """
    gset = {str(g) for g in global_ids}
    by_key: dict[tuple, list[int]] = {}
    for r in lineage:
        if str(r.get("user_id")) != caller and str(r.get("folder_id")) not in gset:
            continue
        key = (r.get("user_id"), r.get("filename"))
        by_key.setdefault(key, []).append(r.get("version_number") or 0)
    facts: dict[str, tuple[int, bool]] = {}
    for r in rows:
        versions = by_key.get((r.get("user_id"), r.get("filename")), [])
        mine = r.get("version_number") or 0
        facts[r["id"]] = (max(len(versions), 1), any(v < mine for v in versions))
    return facts


def _sort_rows(rows: list[dict], sort: str) -> list[dict]:
    """Server order (D-03): nulls LAST in both directions, ties on ``id`` ascending."""
    col, desc = _SORT[sort]
    present = sorted((r for r in rows if r.get(col) is not None), key=lambda r: r["id"])
    missing = sorted((r for r in rows if r.get(col) is None), key=lambda r: r["id"])

    values: dict[str, object] = {}
    for r in present:
        v = r[col]
        values[r["id"]] = v.casefold() if col == "filename" else v
    if col in _TIMESTAMP_COLUMNS:
        try:
            parsed = {
                r["id"]: datetime.fromisoformat(str(r[col]).replace("Z", "+00:00")) for r in present
            }
            # Mixed naive/aware values cannot be compared; keep the strings then.
            if len({p.tzinfo is None for p in parsed.values()}) <= 1:
                values = parsed
        except ValueError:
            pass  # keep the ISO strings (Postgres' UTC text form sorts correctly as text)
    # Stable sort: equal values keep their id-ascending order, in BOTH directions.
    present.sort(key=lambda r: values[r["id"]], reverse=desc)
    return present + missing


# ─────────────────────────────── the core ───────────────────────────────


async def _candidates(
    *,
    caller: str,
    req: DocumentSearchRequest,
    version: str,
    fragments: list,
    folder_ids,
    id_allow,
    global_ids: list[str],
    supabase: Client,
) -> list[dict]:
    """Every visible row matching every condition (lightweight columns), deduped by id."""

    def structure(q):
        q = apply_fragments(q, fragments)  # the SHARED walk (no fork, D-115-6)
        q = _apply_name(q, req)
        q = _apply_folder(q, folder_ids)
        q = _apply_added_by(q, req, caller)
        q = _apply_dates(q, req)
        q = _apply_version(q, version)
        q = _apply_ids(q, id_allow)
        return q

    def own(count: bool):
        base = supabase.table("documents").select(CANDIDATE_COLUMNS, count="exact" if count else None)
        return structure(base.eq("user_id", caller))

    rows = await _fetch_all(own)

    # P-03: Older versions are the caller's OWN rows only — no global-folder leg.
    if version != "older" and global_ids:

        def glob(count: bool):
            base = supabase.table("documents").select(CANDIDATE_COLUMNS, count="exact" if count else None)
            return structure(base.in_("folder_id", global_ids))

        rows += await _fetch_all(glob)

    seen: set[str] = set()
    merged: list[dict] = []
    for r in rows:
        if r["id"] not in seen:
            seen.add(r["id"])
            merged.append(r)
    return merged


async def _hydrate(page: list[dict], facts: dict, supabase: Client) -> list[dict]:
    """Re-read the PAGE rows in full (``select *``) and attach the per-row facts."""
    if not page:
        return []
    page_ids = [r["id"] for r in page]
    full = (await aexec(supabase.table("documents").select("*").in_("id", page_ids))).data or []
    by_id = {r["id"]: r for r in full}
    out = [by_id[i] for i in page_ids if i in by_id]  # the sorted order, preserved

    # Mirror of api/documents.py:799-814 (Phase 270 P-02) — the connection NAME for
    # connector-placed rows, ONE batched user-JWT read. Decoration only: a failure leaves
    # every name None, never a 500.
    conn_ids = sorted({d["source_connection_id"] for d in out if d.get("source_connection_id")})
    conn_names: dict[str, str] = {}
    if conn_ids:
        try:
            conn_res = await aexec(
                supabase.table("connector_connections").select("id, name").in_("id", conn_ids)
            )
            conn_names = {r["id"]: r.get("name") for r in (conn_res.data or [])}
        except Exception:
            log.debug("connection-name lookup failed; names stay None")
    for d in out:
        count, earlier = facts.get(d["id"], (1, False))
        d["version_count"] = count
        d["has_earlier"] = earlier
        sid = d.get("source_connection_id")
        d["source_connection_name"] = conn_names.get(sid) if sid else None
    return out


async def search_documents(*, caller: str, req: DocumentSearchRequest, supabase: Client) -> dict:
    """Find documents by structured fields. Returns the plain-dict response (no model).

    ``{"documents": [row…], "total", "older_matches", "sort", "offset", "limit"}`` — each
    row is the full ``documents`` row plus ``version_count``, ``has_earlier`` and
    ``source_connection_name``. Performs no write and no audit entry (safe per keystroke).
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

    global_ids = await get_globally_visible_folder_ids(supabase, caller)

    # (d) candidates over both legs (own only for `older`).
    candidates = await _candidates(
        caller=caller, req=req, version=req.version, fragments=fragments,
        folder_ids=folder_ids, id_allow=id_allow, global_ids=global_ids, supabase=supabase,
    )

    # (e) has_earlier — ONE batched lineage read over the candidates.
    facts: dict = {}
    if req.version == "has_earlier" and candidates:
        facts = _lineage_facts(candidates, await _lineage_rows(candidates, supabase), caller, global_ids)
        candidates = [r for r in candidates if facts[r["id"]][1]]

    # (f) server sort, (g) exact total + page slice.
    ordered = _sort_rows(candidates, req.sort)
    total = len(ordered)
    page = ordered[req.offset:req.offset + req.limit]

    # (h) hydrate the page (lineage facts over the PAGE when not already computed).
    if page and not facts:
        facts = _lineage_facts(page, await _lineage_rows(page, supabase), caller, global_ids)
    documents = await _hydrate(page, facts, supabase)

    return {
        "documents": documents,
        "total": total,
        "older_matches": older_matches,
        "sort": req.sort,
        "offset": req.offset,
        "limit": req.limit,
    }
