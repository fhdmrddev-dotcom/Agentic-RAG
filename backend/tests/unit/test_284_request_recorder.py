"""Phase 284 (FIX-11, D-23 layer 2 / T-284-30) — the request recorder over the shared transport.

Layer 1 (``test_284_route_inventory.py``) proves every Library ROUTE declares a bound. This layer
proves what the handlers actually SEND. Every user-JWT supabase client shares ONE module-global
httpx transport (``app.dependencies._shared_httpx``, handed to ``ClientOptions(httpx_client=…)``),
so swapping that transport for a recording ``httpx.MockTransport`` captures every PostgREST request
a real handler builds — the real postgrest-py query string, not a fake builder's call list.

``violations(requests, page_limit)`` fails a request when:

  * it is a GET / HEAD on a document table (``DOC_TABLES``) with NO ``limit`` and it is not a
    single-row read (``id=eq.<uuid>``) — "unbounded select on <table>". postgrest-py 2.29 turns
    ``.range(a, b)`` into ``offset=a&limit=b-a+1``, so a ranged read always carries ``limit``;
  * an ``id`` / ``document_id`` ``in.(…)`` list carries MORE ids than the page limit —
    "<col> in.() carries N ids > <page_limit>". That is the shape of the BUG-261014-06 stopgap
    (an ``in_`` loop over EVERY document id, 100 at a time), which a page can never need.

Declared exemptions, each named where it is used:

  * ``folder_id`` lists are bounded by FOLDERS, never by documents — a saved view's subtree or
    Find's folder narrowing is a folder-id list, and the number of folders does not grow with the
    library (pinned below by ``test_a_folder_id_list_is_exempt``);
  * Find's relationship allow-list (``RELATIONSHIP_EXEMPTION``) — reads of ONE document's lineage
    and edge endpoints on the base ``documents`` table, and the page's ``id in.()`` built from those
    edges, are bounded by ``REL_EDGE_CAP`` (a hub above it fails loud, ``SearchTruncatedError``),
    not by the page. The exemption is applied on the Find relationship case ONLY.

The RED drives (284-05, recorded in the SUMMARY, never committed): re-inserting the batching loop
into ``list_documents`` makes ``test_list_documents_is_one_bounded_read`` name
``document_id in.() carries 100 ids > 25``; deleting its ``.range()`` names
``unbounded select on library_documents``. The live twin runs the same detector against the seeded
50,000-document account (``tests/integration/test_284_request_recorder_live.py``).
"""
from __future__ import annotations

from contextlib import asynccontextmanager
from urllib.parse import parse_qsl, urlsplit
from uuid import NAMESPACE_URL, uuid5

import httpx
import pytest

CALLER = "00000000-0000-4000-8000-000000000284"
DOC_ID = "0f0e0d0c-0b0a-4908-8706-050403020100"
VIEW_ID = "aaaaaaaa-0284-4000-8000-000000000001"

#: Every table a Library list reads documents (or a document's children) from.
DOC_TABLES = frozenset(
    {"documents", "library_documents", "document_chunks", "document_tables", "document_images"}
)
#: The columns whose ``in.()`` list grows with the LIBRARY. ``folder_id`` is deliberately absent:
#: folder-id lists are bounded by folders (the declared exemption).
ID_COLS = frozenset({"id", "document_id"})

#: What the canned server pretends the library holds — far above PostgREST's max_rows (1,000).
LIBRARY_TOTAL = 50_000
#: PostgREST's default max_rows: an unranged read comes back cut at this many rows.
MAX_ROWS = 1_000

#: Find's relationship allow-list exemption, by name (``document_search_service.REL_EDGE_CAP``).
RELATIONSHIP_EXEMPTION = (
    "Find relationship allow-list: ONE document's lineage / edge-endpoint reads on the base "
    "`documents` table and the page's `id in.()` built from its edges, bounded by REL_EDGE_CAP"
)


# ───────────────────────────── the detector ─────────────────────────────


def _parts(req: httpx.Request) -> tuple[str, list[tuple[str, str]]]:
    split = urlsplit(str(req.url))
    table = split.path.rsplit("/", 1)[-1]
    return table, parse_qsl(split.query, keep_blank_values=True)


def _in_size(value: str) -> int:
    inner = value[len("in.("):-1] if value.endswith(")") else value[len("in.("):]
    return 0 if not inner else inner.count(",") + 1


def violations(requests, page_limit: int, *, exempt=None) -> list[str]:
    """Every recorded PostgREST request that could grow with the library.

    ``exempt(table, params) -> set[str]`` may waive ``{"unbounded", "id_list"}`` for a request —
    used ONLY for the named relationship exemption.
    """
    out: list[str] = []
    for r in requests:
        if "/rest/v1/" not in urlsplit(str(r.url)).path or r.method not in ("GET", "HEAD"):
            continue
        table, params = _parts(r)
        waived = exempt(table, params) if exempt else set()
        keys = {k for k, _ in params}
        single = any(k == "id" and v.startswith("eq.") for k, v in params)
        if table in DOC_TABLES and not single and "limit" not in keys and "unbounded" not in waived:
            out.append(f"unbounded select on {table}: {r.url}")
        for k, v in params:
            if k in ID_COLS and v.startswith("in.(") and "id_list" not in waived:
                n = _in_size(v)
                if n > page_limit:
                    out.append(f"{k} in.() carries {n} ids > {page_limit}: {table}")
    return out


def assert_clean(requests, page_limit: int, label: str = "", *, exempt=None) -> None:
    """Fail with every DISTINCT violation named (the URL tail dropped, so one line per shape)."""
    found = violations(requests, page_limit, exempt=exempt)
    distinct = sorted({v.split(": http", 1)[0] for v in found})
    assert not found, f"{label} -- {len(found)} violation(s):\n" + "\n".join(distinct)


def largest_in_list(requests) -> int:
    """The longest ``in.()`` list of ANY column seen (reported by the live suite)."""
    best = 0
    for r in requests:
        if "/rest/v1/" not in urlsplit(str(r.url)).path:
            continue
        for _k, v in _parts(r)[1]:
            if v.startswith("in.("):
                best = max(best, _in_size(v))
    return best


def relationship_exemption(rel_edge_cap: int):
    """The Find-only waiver (``RELATIONSHIP_EXEMPTION``) as a predicate."""

    def _exempt(table: str, params) -> set[str]:
        keys = {k for k, _ in params}
        ids_ok = all(_in_size(v) <= rel_edge_cap for k, v in params if k in ID_COLS and v.startswith("in.("))
        if table == "documents" and ("filename" in keys or "id" in keys) and ids_ok:
            return {"unbounded", "id_list"}  # one lineage / the edges' endpoints
        if table == "library_documents" and ids_ok:
            return {"id_list"}  # the page's allow-list; the page itself must still be ranged
        return set()

    return _exempt


# ───────────────────────────── the canned PostgREST ─────────────────────────────


def _uid(*parts) -> str:
    return str(uuid5(NAMESPACE_URL, "284-05/" + "/".join(map(str, parts))))


def _doc(i: int, **extra) -> dict:
    return {
        "id": _uid("doc", i), "user_id": CALLER, "folder_id": None, "filename": f"f{i}.pdf",
        "file_path": f"{CALLER}/f{i}.pdf", "file_size": 10, "mime_type": "application/pdf",
        "status": "completed", "error_message": None, "chunk_count": 1, "content_hash": "h",
        "version_number": 1, "is_latest": True, "metadata": {}, "created_at": "2026-10-16T00:00:00+00:00",
        "updated_at": "2026-10-16T00:00:00+00:00", "source_connection_id": None, "archived_at": None,
        "retrievable": True, "version_count": 1, "has_earlier": False, **extra,
    }


def _canned_rows(table: str, params, n: int) -> list[dict]:
    if table == "document_views":
        return [{"id": VIEW_ID, "user_id": CALLER, "name": "v", "is_system_global": False,
                 "filter_expr": {"op": "and", "conditions": []}, "folder_scope": None,
                 "created_at": "2026-10-16T00:00:00+00:00", "updated_at": "2026-10-16T00:00:00+00:00"}]
    if table == "document_relationships":
        return [{"source_doc_id": _uid("edge", i), "target_doc_id": DOC_ID} for i in range(3)]
    if table in ("folders", "connector_connections"):
        return []
    if table == "documents":
        ids = next((v for k, v in params if k == "id" and v.startswith("in.(")), None)
        if ids:  # the relationship endpoints, read back by id
            return [_doc(0, id=x) for x in ids[len("in.("):-1].split(",")][:n]
    if table == "document_chunks":
        return [{"id": _uid("chunk", i), "chunk_index": i, "content": "c", "embedding_model": "m",
                 "embedding_dimensions": 3} for i in range(n)]
    if table == "document_tables":
        return [{"id": _uid("table", i), "document_id": DOC_ID, "page": 1, "table_index": i,
                 "headers": [], "rows": [], "extractor": "x"} for i in range(n)]
    if table == "document_images":
        return [{"id": _uid("image", i), "document_id": DOC_ID, "page": 1, "image_index": i,
                 "description": "d"} for i in range(n)]
    return [_doc(i) for i in range(n)]


def _handler(recorded: list[httpx.Request]):
    def handle(req: httpx.Request) -> httpx.Response:
        recorded.append(req)
        table, params = _parts(req)
        q = dict(params)
        single = any(k == "id" and v.startswith("eq.") for k, v in params)
        if single:
            row = _canned_rows(table, params, 1)
            if table not in ("document_views",):
                row = [_doc(0, id=q["id"][len("eq."):])]
            return httpx.Response(200, json=row, headers={"content-range": "0-0/1"})
        limit = int(q["limit"]) if "limit" in q else None
        offset = int(q.get("offset", 0))
        n = MAX_ROWS if limit is None else max(0, min(limit, LIBRARY_TOTAL - offset))
        if table in ("documents",) and limit is None and "filename" in q:
            n = 3  # one document's lineage
        rows = _canned_rows(table, params, n)
        total = LIBRARY_TOTAL if table in DOC_TABLES else len(rows)
        cr = f"{offset}-{offset + len(rows) - 1}/{total}" if rows else f"*/{total}"
        return httpx.Response(200, json=rows, headers={"content-range": cr})

    return handle


@pytest.fixture
def recorded(monkeypatch):
    """Swap the SHARED user-JWT transport for a recording MockTransport (``_shared_httpx``)."""
    import app.dependencies as deps

    seen: list[httpx.Request] = []
    client = httpx.Client(transport=httpx.MockTransport(_handler(seen)))
    monkeypatch.setattr(deps, "_shared_httpx", client)
    try:
        yield seen
    finally:
        client.close()


@pytest.fixture
def sb(recorded):
    """A user client built EXACTLY as production builds it (``get_user_supabase``)."""
    from app.dependencies import get_user_supabase

    return get_user_supabase(None, {"id": CALLER}, "unit-test-token")


USER = {"id": CALLER}


# ───────────────────────────── the detector, pinned ─────────────────────────────


def _req(url: str, method: str = "GET") -> httpx.Request:
    return httpx.Request(method, "http://127.0.0.1:54321/rest/v1/" + url)


def test_the_detector_names_each_shape():
    ids = ",".join(_uid("x", i) for i in range(26))
    assert violations([_req("library_documents?select=id&offset=0&limit=25")], 25) == []
    assert violations([_req("documents?select=id")], 25) == [
        "unbounded select on documents: http://127.0.0.1:54321/rest/v1/documents?select=id"
    ]
    assert violations([_req(f"document_tables?select=id&document_id=in.({ids})&limit=25")], 25) == [
        "document_id in.() carries 26 ids > 25: document_tables"
    ]
    assert violations([_req(f"documents?id=eq.{DOC_ID}")], 25) == []  # a single-row read


def test_a_folder_id_list_is_exempt():
    """``folder_id`` lists are bounded by folders, not by documents (the declared exemption)."""
    folders = ",".join(_uid("f", i) for i in range(300))
    assert violations([_req(f"library_documents?folder_id=in.({folders})&offset=0&limit=25")], 25) == []


def test_writes_and_non_rest_requests_are_not_reads():
    assert violations([_req("documents?select=id", "POST"), httpx.Request("GET", "http://x/auth/v1/user")], 25) == []


# ───────────────────────────── the real handlers ─────────────────────────────


async def test_list_documents_is_one_bounded_read(recorded, sb):
    from app.api.documents import list_documents

    out = await list_documents(limit=25, offset=0, folder_id=None, include_archived=False,
                               status_=None, order="created_desc", kind=None,
                               current_user=USER, supabase=sb)
    assert_clean(recorded, 25, "GET /documents")
    assert out["total"] == LIBRARY_TOTAL and len(out["documents"]) == 25
    assert 1 <= len(recorded) <= 3, [str(r.url)[:120] for r in recorded]


async def test_list_documents_root_and_last_page_are_bounded(recorded, sb):
    from app.api.documents import list_documents

    for folder_id, offset in (("root", 0), (_uid("big"), 9_975), (None, LIBRARY_TOTAL - 25)):
        await list_documents(limit=25, offset=offset, folder_id=folder_id, include_archived=True,
                             status_="in_flight", order="updated_desc", kind=None,
                             current_user=USER, supabase=sb)
    assert_clean(recorded, 25, "GET /documents root, Big, last page")


@pytest.mark.parametrize(
    ("route", "limit"),
    [("list_document_versions", 50), ("list_document_chunks", 200),
     ("list_document_tables", 50), ("list_document_images", 100)],
)
async def test_the_per_document_routes_are_bounded(recorded, sb, route, limit):
    from app.api import documents

    out = await getattr(documents, route)(DOC_ID, limit=limit, offset=0, current_user=USER, supabase=sb)
    assert out["total"] == LIBRARY_TOTAL
    assert_clean(recorded, limit, route)


async def test_get_document_is_a_single_read(recorded, sb):
    from app.api.documents import get_document

    await get_document(DOC_ID, current_user=USER, supabase=sb)
    assert_clean(recorded, 25, "GET /documents/{id}")


async def test_search_documents_is_bounded(recorded, sb):
    from app.models.document_search import DocumentSearchRequest
    from app.services.document_search_service import search_documents

    for body in ({}, {"name": "f1"}, {"offset": LIBRARY_TOTAL - 25}):
        out = await search_documents(caller=CALLER, req=DocumentSearchRequest(**body), supabase=sb)
        assert out["total"] == LIBRARY_TOTAL
    assert_clean(recorded, 25, "POST /document-search")


async def test_search_documents_relationship_is_bounded_by_its_edges(recorded, sb):
    """The ONE place the relationship exemption applies — and it is not a blanket waiver."""
    from app.models.document_search import DocumentSearchRequest
    from app.services.document_search_service import REL_EDGE_CAP, search_documents

    req = DocumentSearchRequest(relationship={"verb": "supersedes", "document_id": DOC_ID})
    await search_documents(caller=CALLER, req=req, supabase=sb)
    tables = [_parts(r)[0] for r in recorded]
    assert "document_relationships" in tables, "non-vacuity: the relationship path ran"
    # Without the waiver the lineage read IS unbounded — the exemption is real, not decorative.
    assert any("unbounded select on documents" in v for v in violations(recorded, 25))
    exempt = relationship_exemption(REL_EDGE_CAP)
    assert_clean(recorded, 25, RELATIONSHIP_EXEMPTION, exempt=exempt)
    page = [r for r in recorded if _parts(r)[0] == "library_documents"]
    assert page and all("limit" in dict(_parts(r)[1]) for r in page)  # the page is still ranged
    assert largest_in_list(recorded) <= REL_EDGE_CAP


async def test_both_resolve_routes_are_bounded(recorded, sb):
    from app.api.document_views import resolve_adhoc, resolve_view
    from app.models.document_view import AdHocResolve

    page = await resolve_view(VIEW_ID, count_only=False, offset=0, limit=25, include_archived=False,
                              current_user=USER, supabase=sb)
    assert page["total"] == LIBRARY_TOTAL
    await resolve_view(VIEW_ID, count_only=True, offset=0, limit=25, include_archived=True,
                       current_user=USER, supabase=sb)
    body = AdHocResolve(filter_expr={"op": "and", "conditions": []}, offset=LIBRARY_TOTAL - 25, limit=25)
    await resolve_adhoc(body, current_user=USER, supabase=sb)
    assert sum(_parts(r)[0] == "library_documents" for r in recorded) == 3  # non-vacuity
    assert_clean(recorded, 25, "both resolve routes")


async def test_the_summary_reads_the_view_and_sends_no_id_list(monkeypatch):
    """``GET /library/summary`` is asyncpg, not PostgREST: its SQL text is what is recorded."""
    from app.api import library

    sql_seen: list[tuple[str, tuple]] = []

    class _Conn:
        async def fetch(self, sql, *args):
            sql_seen.append((sql, args))
            return []

    @asynccontextmanager
    async def _user_conn(request, current_user):
        yield _Conn()

    monkeypatch.setattr(library, "get_user_pg_connection", _user_conn)
    await library.get_library_summary(None, USER)
    assert sql_seen and "public.library_documents" in sql_seen[0][0]
    for sql, args in sql_seen:
        reads_docs = any(f"public.{t}" in sql for t in DOC_TABLES)
        assert not (reads_docs and "ANY($" in sql), sql
        assert not args, "the summary passes no parameter list"
