"""284-REVIEW CR-01 — an offset past the end answers an EMPTY page with the exact total.

PostgREST answers a ``count=exact`` ranged read whose offset is greater than the total with 416 /
``PGRST103`` (driven live in ``tests/integration/test_284_offset_past_end_live.py``), and
postgrest-py raises ``APIError``. Since 284 every Library list is such a read, so a shrinking list
under an open page was a 500. ONE helper — ``app.utils.db.aexec_page`` — absorbs it: on
``PGRST103`` it re-reads the same filters with ``.limit(1)`` for the exact count and answers
``data=[]`` with that count. Any other error still raises.

The fakes here RAISE the real ``APIError`` shape PostgREST sends, so a route that bypasses the
helper fails these tests with the same exception production would have turned into a 500.
"""
from __future__ import annotations

import inspect
from types import SimpleNamespace

import pytest
from postgrest.exceptions import APIError

from tests.unit.test_271_search_core import CALLER, FakePostgrest, doc, patched  # noqa: F401
from tests.unit.test_284_list_contract import DOC_ID, USER_ID, _gate_ok, _row, client_with  # noqa: F401


def _416(offset: int, total: int) -> APIError:
    return APIError({
        "message": "Requested range not satisfiable", "code": "PGRST103", "hint": None,
        "details": f"An offset of {offset} was requested, but there are only {total} rows.",
    })


# ── the helper ───────────────────────────────────────────────────────────────────────────────


class _Builder:
    """The minimum a ranged read is: ``.range`` / ``.limit`` / ``.execute``, recorded."""

    def __init__(self, log: list, total: int, error: Exception | None = None):
        self.log, self.total, self.error = log, total, error
        self.rng = self.lim = None

    def range(self, s, e):
        self.rng = (s, e)
        return self

    def limit(self, n):
        self.lim = n
        return self

    def execute(self):
        self.log.append((self.rng, self.lim))
        if self.rng is not None and self.rng[0] > self.total:
            raise self.error or _416(self.rng[0], self.total)
        return SimpleNamespace(data=[{"id": "x"}] if self.total else [], count=self.total)


async def test_a_page_past_the_end_is_empty_with_the_exact_count():
    from app.utils.db import aexec_page

    log: list = []
    res = await aexec_page(lambda: _Builder(log, 7), offset=50, limit=25)
    assert res.data == [] and res.count == 7
    assert log == [((50, 74), None), (None, 1)], "the count re-read is .limit(1) over the same filters"


async def test_an_in_range_page_is_one_read():
    from app.utils.db import aexec_page

    log: list = []
    res = await aexec_page(lambda: _Builder(log, 7), offset=0, limit=25)
    assert res.count == 7 and res.data == [{"id": "x"}]
    assert log == [((0, 24), None)]


async def test_any_other_error_still_raises():
    from app.utils.db import aexec_page

    boom = APIError({"message": "invalid input syntax for type uuid", "code": "22P02",
                     "hint": None, "details": None})
    with pytest.raises(APIError) as exc:
        await aexec_page(lambda: _Builder([], 0, error=boom), offset=5, limit=25)
    assert exc.value.code == "22P02"


# ── the routes in api/documents.py ───────────────────────────────────────────────────────────


def _ranged(total: int, row_factory=lambda: _row()):
    """A Recorder answer that behaves like PostgREST: 416 past the end, else rows + count."""
    def answer(q):
        rng = q.named("range")
        if rng and rng[0][1][0] > total:
            return _416(rng[0][1][0], total)
        return {"data": [row_factory()] if total else [], "count": total}
    return answer


def test_get_documents_past_the_end_is_200_empty(client_with):
    client, rec = client_with({"library_documents": _ranged(7)})
    res = client.get("/documents", params={"offset": 50})
    assert res.status_code == 200, res.text
    assert res.json() == {"documents": [], "total": 7, "offset": 50, "limit": 25}
    page, head = rec.reads("library_documents")
    assert head.named("limit") == [("limit", (1,), {})] and not head.named("range")
    assert ("eq", ("is_latest", True), {}) in head.calls, "the count re-read keeps the filters"
    assert ("is_", ("archived_at", "null"), {}) in head.calls


@pytest.mark.parametrize("path,table,key,limit", [
    ("chunks", "document_chunks", "chunks", 200),
    ("tables", "document_tables", "tables", 50),
    ("images", "document_images", "images", 100),
])
def test_per_document_lists_past_the_end_are_200_empty(client_with, path, table, key, limit):
    client, _ = client_with({"library_documents": _gate_ok(), table: _ranged(2, lambda: {})})
    res = client.get(f"/documents/{DOC_ID}/{path}", params={"offset": 10})
    assert res.status_code == 200, res.text
    assert res.json() == {key: [], "total": 2, "offset": 10, "limit": limit}


def test_versions_past_the_end_are_200_empty(client_with):
    gate = {"data": {"filename": "a.pdf", "user_id": USER_ID, "folder_id": None}}
    ranged = _ranged(2)
    client, _ = client_with({"documents": lambda q: gate if q.named("maybe_single") else ranged(q)})
    res = client.get(f"/documents/{DOC_ID}/versions", params={"offset": 10})
    assert res.status_code == 200, res.text
    assert res.json() == {"versions": [], "total": 2, "offset": 10, "limit": 50}


# ── the resolver and Find (the fake PostgREST from the 271/284 suites, made to 416) ──────────


def _postgrest_416(q):
    if q.count_mode == "exact" and q._range is not None:
        total = len([r for r in q.client.rows_for(q.table) if q._match(r)])
        if q._range[0] > total:
            raise _416(q._range[0], total)
    return None


def _docs(n):
    return [doc(f"d-{i:02d}", created_at=f"2024-01-01T00:00:{i:02d}+00:00") for i in range(n)]


async def test_view_resolve_past_the_end_is_empty_with_the_exact_total(patched):  # noqa: F811
    from app.models.document_view import ViewFilter
    from app.services.document_view_resolver import resolve_filter

    client = FakePostgrest({"documents": _docs(6)}, override=_postgrest_416)
    out = await resolve_filter(caller=CALLER, flt=ViewFilter(op="and", conditions=[]),
                               folder_scope=None, count_only=False, supabase=client,
                               via_view=True, offset=40, limit=25, include_archived=True)
    assert out == {"documents": [], "total": 6, "offset": 40, "limit": 25}


async def test_document_search_past_the_end_is_empty_with_the_exact_total(patched):  # noqa: F811
    from app.models.document_search import DocumentSearchRequest
    from app.services.document_search_service import search_documents

    client = FakePostgrest({"documents": _docs(6)}, override=_postgrest_416)
    out = await search_documents(caller=CALLER, req=DocumentSearchRequest(offset=30, limit=25),
                                 supabase=client)
    assert out["documents"] == [] and out["total"] == 6
    assert (out["offset"], out["limit"]) == (30, 25)


def test_every_paged_284_read_goes_through_the_one_helper():
    """No ranged ``count="exact"`` read of a 284 surface calls ``.range(`` outside ``aexec_page``."""
    from app.api import documents
    from app.services import document_search_service, document_view_resolver

    for fn in (documents.list_documents, documents.list_document_versions,
               documents.list_document_chunks, documents.list_document_tables,
               documents.list_document_images, document_view_resolver.resolve_filter,
               document_search_service.search_documents):
        src = inspect.getsource(fn)
        assert "aexec_page(" in src, f"{fn.__name__} does not page through aexec_page"
        assert ".range(" not in src, f"{fn.__name__} still builds its own .range(...)"
