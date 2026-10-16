"""Phase 284 (284-04 Task 2 — FIX-11; D-23 layer 1, R-10) — every Library route declares its bound.

WHAT THIS FENCE PROTECTS. Before Phase 284 every Library list was silently cut at PostgREST's
``max_rows`` (1,000): the routes read unranged and nobody noticed until a 10,000-document folder
showed 1,000. Phase 284 pages them. This file stops the NEXT unbounded route: every route whose
endpoint lives in a Library-domain module is either PAGED — it declares ``offset`` and a ``limit``
with an upper bound — or it is named on ``ALLOW_LIST`` with the reason it cannot grow with the
library. A new route that is neither fails here, by name.

THE INVENTORY is every ``app.routes`` route whose endpoint module is one of ``LIBRARY_MODULES``, one
row per HTTP method (HEAD / OPTIONS skipped). EVERY method is classified, writes included, so a
new route of any kind has to be looked at once.

HOW A ROUTE IS READ AS PAGED.
  * GET (and any method with query parameters): the query parameters of the route's dependant tree
    — sub-dependencies included, because ``document_governance`` declares its paging through
    ``Depends(_pagination_params)`` — include ``offset`` and a ``limit`` whose field metadata
    carries an ``le`` bound.
  * POST: a body model with a ``limit`` field carrying ``le`` (``/document-search``,
    ``/document-views/resolve``).
  If FastAPI ever stops exposing ``dependant.query_params`` / ``field_info.metadata``, the detector
  FAILS LOUDLY rather than reading "no limit" (which would read as unbounded, or worse, pass).

FLOORS (never re-derived at run time): the route count measured when this fence was written is a
literal, and the paged set is the exact list below. A module rename or a router that stops
mounting cannot let this pass over nothing.

ADJACENT, OUT OF THE INVENTORY: ``app.api.retention`` lists documents through asyncpg (no PostgREST
``max_rows`` cut) under an org-admin scope, and its one history list is already paged
(``offset`` / ``limit ≤ 100``). It is a governance surface, not the Library's; it is named here so
its absence is a decision, not an oversight.

Driven RED (284-04 SUMMARY): a planted ``GET /document-views/_planted284`` returning ``[]`` with no
limit is named by the inventory.
"""
from __future__ import annotations

from fastapi import APIRouter, FastAPI, Query

from app.main import app

LIBRARY_MODULES = {
    "app.api.documents",
    "app.api.document_views",
    "app.api.document_search",
    "app.api.folders",
    "app.api.kb",
    "app.api.library",
    "app.api.document_relationships",
    "app.api.document_governance",
    "app.api.document_queries",
    "app.api.takeoff",
}

#: Measured at RED (284-04): 48 routes across the ten modules. A literal on purpose.
ROUTE_COUNT_FLOOR = 48

#: Exactly the routes that page. Adding a paged route is a one-line edit here; losing one fails.
PAGED = {
    ("GET", "/documents"),
    ("GET", "/documents/{document_id}/versions"),
    ("GET", "/documents/{document_id}/chunks"),
    ("GET", "/documents/{document_id}/tables"),
    ("GET", "/documents/{document_id}/images"),
    ("GET", "/document-views/{view_id}/resolve"),
    ("POST", "/document-views/resolve"),
    ("POST", "/document-search"),
    ("GET", "/document-governance/broken-relationships"),
    ("GET", "/document-governance/unclassified"),
    ("GET", "/document-governance/low-confidence"),
}

#: Paged by its parameters, but with a read INSIDE that is not — named so it cannot be forgotten.
PAGED_WITH_A_KNOWN_UNRANGED_READ = {
    ("GET", "/document-governance/broken-relationships"):
        "takes offset/limit but reads EVERY relationship edge unranged first — silently cut at "
        "1,000 edges (SEED-356)",
}

ALLOW_LIST: dict[tuple[str, str], str] = {
    # ── single objects ──────────────────────────────────────────────────────────────────────
    ("GET", "/documents/{document_id}"): "single object",
    ("POST", "/documents/{document_id}/download-url"): "single object: one signed URL",
    ("GET", "/documents/{document_id}/takeoff"): "single object: one document's takeoff",
    # ── bounded by construction ─────────────────────────────────────────────────────────────
    ("GET", "/documents/{document_id}/content"): "bounded by construction: a line window (CONTENT_MAX_LINES)",
    ("GET", "/documents/{document_id}/conversation"):
        "bounded by construction: capped at CONVERSATION_SIBLING_CAP and reports truncated",
    ("GET", "/documents/{document_id}/queries"): "bounded by construction: .limit(MAX_ROWS=100) and a window",
    ("GET", "/document-views"): "bounded by construction: one row per saved view, not documents",
    ("GET", "/folders"): "bounded by construction: folders, not documents",
    ("GET", "/folders/{folder_id}/children"): "bounded by construction: folders, not documents",
    ("GET", "/document-relationships"): "one document's edges",
    ("GET", "/library/index-summary"): "GROUP BY folder: one row per folder",
    ("GET", "/library/summary"): "GROUPING SETS: bounded by folders, statuses, steps, connections and types",
    # ── agent KB browse (no frontend caller) ────────────────────────────────────────────────
    ("GET", "/kb/ls"): "agent KB browse — lists a folder's documents unranged; SEED-355",
    ("GET", "/kb/tree"): "agent KB browse — SEED-355",
    ("GET", "/kb/grep"): "agent KB browse — SEED-355",
    ("GET", "/kb/glob"): "agent KB browse — SEED-355",
    ("GET", "/kb/read"): "single object: one document's line window",
    # ── writes: each returns the one thing it wrote ─────────────────────────────────────────
    ("POST", "/documents/upload"): "write: one upload",
    ("POST", "/documents/{document_id}/restore"): "write: one document",
    ("POST", "/documents/{document_id}/reingest"): "write: one document",
    ("POST", "/documents/{document_id}/reextract"): "write: one document",
    ("DELETE", "/documents/{document_id}"): "write: one document (or its lineage)",
    ("PATCH", "/documents/{document_id}/move"): "write: one document",
    ("PATCH", "/documents/{document_id}/metadata"): "write: one document",
    ("PATCH", "/documents/{document_id}/classification/accept"): "write: one document",
    ("PATCH", "/documents/{document_id}/classification/dismiss"): "write: one document",
    ("POST", "/folders"): "write: one folder",
    ("PATCH", "/folders/{folder_id}"): "write: one folder",
    ("DELETE", "/folders/{folder_id}"): "write: one folder",
    ("PATCH", "/folders/{folder_id}/toggle-global"): "write: one folder",
    ("PATCH", "/folders/{folder_id}/move"): "write: one folder",
    ("POST", "/document-views"): "write: one saved view",
    ("PATCH", "/document-views/{view_id}"): "write: one saved view",
    ("DELETE", "/document-views/{view_id}"): "write: one saved view",
    ("POST", "/document-relationships"): "write: one edge",
    ("DELETE", "/document-relationships/{relationship_id}"): "write: one edge",
    ("POST", "/documents/{document_id}/takeoff/match"): "write: one document's takeoff",
    ("PATCH", "/documents/{document_id}/takeoff/resolve"): "write: one document's takeoff",
}


# ── the detector ───────────────────────────────────────────────────────────────────────────


def _has_le(field) -> bool:
    info = getattr(field, "field_info", None)
    assert info is not None and hasattr(info, "metadata"), (
        "FastAPI's ModelField no longer exposes field_info.metadata — update this fence; "
        "it must never silently read a bounded limit as unbounded (or the reverse)"
    )
    return any(getattr(m, "le", None) is not None for m in info.metadata)


def _query_params(route) -> dict:
    assert hasattr(route, "dependant") and hasattr(route.dependant, "query_params"), (
        f"cannot read the dependant of {getattr(route, 'path', route)!r} — update this fence"
    )
    found: dict = {}
    stack = [route.dependant]
    while stack:
        dep = stack.pop()
        for p in dep.query_params:
            found.setdefault(p.name, p)
        stack.extend(getattr(dep, "dependencies", []) or [])
    return found


def _body_limit_bounded(route) -> bool:
    for p in route.dependant.body_params:
        model = getattr(getattr(p, "field_info", None), "annotation", None) or getattr(p, "type_", None)
        fields = getattr(model, "model_fields", None) or {}
        limit = fields.get("limit")
        if limit is not None and any(getattr(m, "le", None) is not None for m in limit.metadata):
            return True
    return False


def _is_paged(route) -> bool:
    q = _query_params(route)
    if "offset" in q and "limit" in q and _has_le(q["limit"]):
        return True
    return _body_limit_bounded(route)


def _inventory(routes, modules=LIBRARY_MODULES):
    """[(method, path, paged)] for every route whose endpoint lives in ``modules``."""
    rows = []
    for route in routes:
        endpoint = getattr(route, "endpoint", None)
        if getattr(endpoint, "__module__", "") not in modules or not hasattr(route, "dependant"):
            continue
        paged = _is_paged(route)
        for method in sorted(getattr(route, "methods", None) or ()):
            if method in ("HEAD", "OPTIONS"):
                continue
            rows.append((method, route.path, paged))
    return rows


def _violations(rows, allow=ALLOW_LIST):
    """Every row that is neither paged nor allow-listed — the routes that can grow unbounded."""
    return sorted((m, p) for m, p, paged in rows if not paged and (m, p) not in allow)


# ── the live app ─────────────────────────────────────────────────────────────────────────


def test_every_library_route_is_paged_or_allow_listed_with_a_reason():
    rows = _inventory(app.routes)
    keys = {(m, p) for m, p, _ in rows}
    assert len(rows) >= ROUTE_COUNT_FLOOR, f"library inventory collapsed to {len(rows)}: {sorted(keys)}"
    assert len(keys) == len(rows), "a (method, path) appears twice"

    unbounded = _violations(rows)
    assert not unbounded, (
        "Library route(s) that can return an unbounded list — page them (offset + a limit with "
        f"le) or allow-list them WITH A REASON: {unbounded}"
    )


def test_the_paged_set_is_exactly_the_named_list():
    paged = {(m, p) for m, p, is_paged in _inventory(app.routes) if is_paged}
    assert paged == PAGED, f"missing: {sorted(PAGED - paged)} · unexpected: {sorted(paged - PAGED)}"
    assert set(PAGED_WITH_A_KNOWN_UNRANGED_READ) <= PAGED


def test_the_allow_list_names_only_live_routes_and_every_reason_is_said():
    keys = {(m, p) for m, p, _ in _inventory(app.routes)}
    stale = sorted(set(ALLOW_LIST) - keys)
    assert not stale, f"allow-listed routes that no longer exist (delete the row): {stale}"
    assert not (set(ALLOW_LIST) & PAGED), "a paged route does not need an allow-list row"
    for key, reason in ALLOW_LIST.items():
        assert isinstance(reason, str) and len(reason) >= 10, f"{key} has no real reason"


def test_the_seeds_the_allow_list_cites_exist():
    import pathlib

    seeds = pathlib.Path(__file__).resolve().parents[3] / ".planning" / "seeds"
    for seed in ("SEED-355", "SEED-356"):
        assert list(seeds.glob(f"{seed}-*.md")), f"{seed} is cited but not planted"


# ── permanent detector self-test ─────────────────────────────────────────────────────────


def _throwaway_routes():
    router = APIRouter(prefix="/documents")

    @router.get("/_planted")
    async def planted():  # pragma: no cover - never called
        return []

    @router.get("/_paged")
    async def paged(offset: int = Query(0, ge=0), limit: int = Query(25, le=200)):  # pragma: no cover
        return []

    @router.get("/_limit_without_le")
    async def no_le(offset: int = 0, limit: int = 25):  # pragma: no cover - never called
        return []

    throwaway = FastAPI()
    throwaway.include_router(router)
    return throwaway.routes


def test_the_detector_names_a_planted_unbounded_route():
    """If this ever passes over a broken detector, the live inventory above means nothing."""
    rows = _inventory(_throwaway_routes(), modules={__name__})
    by_key = {(m, p): paged for m, p, paged in rows}
    assert by_key == {
        ("GET", "/documents/_planted"): False,
        ("GET", "/documents/_paged"): True,
        ("GET", "/documents/_limit_without_le"): False,
    }
    assert _violations(rows, allow={}) == [
        ("GET", "/documents/_limit_without_le"),
        ("GET", "/documents/_planted"),
    ]
