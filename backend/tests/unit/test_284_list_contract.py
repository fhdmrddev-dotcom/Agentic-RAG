"""Phase 284 (D-01 / D-02 / D-03 / D-05 / D-11 / D-17 / R-05 / R-08) — the paged list contract.

A RECORDING fake builder (the ``test_271_search_core.py`` ``FakeQuery`` idea, NOT a MagicMock): it
implements only the builder methods the routes may call, records every call in order, and RAISES
on anything else — so a test that passes proves the exact chain, never "something was called".

What is pinned:
  * ``GET /documents`` = ONE read on ``library_documents`` with ``count="exact"``,
    ``.eq("is_latest", True)``, ``created_at desc`` then ``id desc``, ``.range(offset,
    offset + limit - 1)``; folder / archived / status / order / kind filters as the contract says;
    422s on bad params; embedded child counts flattened; ONE page-bounded connection-name read
    whose failure degrades to ``None``; the ``{documents, total, offset, limit}`` envelope with
    ``total == res.count``; no ``full_markdown`` and no ``*`` in the select; no ``_ID_BATCH``.
  * ``GET /documents/{id}``: 422 on a malformed id, 404 on a view miss, a DocumentResponse on a
    hit, and no literal ``GET /documents/<segment>`` route is shadowed by it.
  * the per-document routes page with exact totals (defaults / caps per the contract).
"""
from __future__ import annotations

import inspect
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.dependencies import get_supabase
from app.main import app

USER_ID = "00000000-0000-0000-0000-000000000001"
NOW = "2026-10-16T00:00:00+00:00"
DOC_ID = "0f0e0d0c-0b0a-4908-8706-050403020100"
FOLDER = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
CONN = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"

ALLOWED = {"select", "eq", "neq", "is_", "in_", "or_", "order", "range", "limit",
           "maybe_single", "ilike", "lt", "gt"}


class FakeQuery:
    def __init__(self, rec: "Recorder", table: str):
        self.rec, self.table = rec, table
        self.calls: list[tuple[str, tuple, dict]] = []

    def __getattr__(self, name):
        if name not in ALLOWED:
            raise AttributeError(f"FakeQuery does not implement .{name}() — the route called it")

        def _m(*a, **k):
            self.calls.append((name, a, k))
            return self

        return _m

    def named(self, name):
        return [c for c in self.calls if c[0] == name]

    def execute(self):
        self.rec.executed.append(self)
        spec = self.rec.answers.get(self.table)
        if callable(spec):
            spec = spec(self)
        if isinstance(spec, Exception):
            raise spec
        spec = spec or {}
        single = bool(self.named("maybe_single"))
        data = spec.get("data", None if single else [])
        if single and data is None:
            return None  # postgrest 2.29: a 0-row maybe_single returns None
        return SimpleNamespace(data=data, count=spec.get("count"))


class Recorder:
    def __init__(self, answers: dict):
        self.answers = answers
        self.executed: list[FakeQuery] = []

    def table(self, name):
        return FakeQuery(self, name)

    def reads(self, table):
        return [q for q in self.executed if q.table == table]


def _row(doc_id=None, **over):
    base = {
        "id": doc_id or str(uuid4()), "user_id": USER_ID, "folder_id": None, "filename": "a.pdf",
        "file_path": f"{USER_ID}/a.pdf", "file_size": 10, "mime_type": "application/pdf",
        "status": "completed", "error_message": None, "chunk_count": 1, "content_hash": "h",
        "created_at": NOW, "updated_at": NOW,
        "document_tables": [{"count": 2}], "document_images": [{"count": 0}],
    }
    base.update(over)
    return base


@pytest.fixture
def client_with():
    def _make(answers):
        rec = Recorder(answers)
        app.dependency_overrides[get_supabase] = lambda: rec
        return TestClient(app), rec

    yield _make


def _list(client_with, params=None, rows=None, count=None, conn=None):
    rows = rows if rows is not None else [_row()]
    answers = {"library_documents": {"data": rows, "count": len(rows) if count is None else count}}
    if conn is not None:
        answers["connector_connections"] = conn
    client, rec = client_with(answers)
    return client.get("/documents", params=params or {}), rec


# ── GET /documents ───────────────────────────────────────────────────────────────────────────

def test_one_ranged_exact_read_on_the_view(client_with):
    res, rec = _list(client_with, rows=[_row(), _row()], count=1234)
    assert res.status_code == 200, res.text
    body = res.json()
    assert set(body) == {"documents", "total", "offset", "limit"}
    assert (body["total"], body["offset"], body["limit"]) == (1234, 0, 25)
    assert len(body["documents"]) == 2
    reads = rec.reads("library_documents")
    assert len(reads) == 1
    q = reads[0]
    (sel_args, sel_kw), = [(a, k) for n, a, k in q.calls if n == "select"]
    assert sel_kw.get("count") == "exact"
    cols = sel_args[0]
    assert "full_markdown" not in cols and "*" not in cols
    assert "document_tables(count)" in cols and "document_images(count)" in cols
    assert ("eq", ("is_latest", True), {}) in q.calls
    orders = q.named("order")
    assert orders == [("order", ("created_at",), {"desc": True}), ("order", ("id",), {"desc": True})]
    assert q.named("range") == [("range", (0, 24), {})]
    assert not rec.reads("documents"), "the list must not read the base table"


def test_offset_and_limit_drive_the_range(client_with):
    res, rec = _list(client_with, params={"offset": 200, "limit": 50})
    assert res.status_code == 200
    assert rec.reads("library_documents")[0].named("range") == [("range", (200, 249), {})]
    assert (res.json()["offset"], res.json()["limit"]) == (200, 50)


@pytest.mark.parametrize("params", [{"limit": 201}, {"limit": 0}, {"offset": -1},
                                    {"folder_id": "nope"}, {"status": "paused"},
                                    {"order": "name_asc"}, {"kind": "pdf"}])
def test_bad_params_are_422(client_with, params):
    res, rec = _list(client_with, params=params)
    assert res.status_code == 422, (params, res.text)
    assert not rec.executed


def test_root_and_folder_filters(client_with):
    _, rec = _list(client_with, params={"folder_id": "root"})
    assert ("is_", ("folder_id", "null"), {}) in rec.reads("library_documents")[0].calls
    _, rec = _list(client_with, params={"folder_id": FOLDER})
    assert ("eq", ("folder_id", FOLDER), {}) in rec.reads("library_documents")[0].calls


def test_archived_hidden_by_default_and_shown_on_request(client_with):
    _, rec = _list(client_with)
    assert ("is_", ("archived_at", "null"), {}) in rec.reads("library_documents")[0].calls
    _, rec = _list(client_with, params={"include_archived": "true"})
    assert not [c for c in rec.reads("library_documents")[0].calls if c[1][:1] == ("archived_at",)]


@pytest.mark.parametrize("status,expected", [
    ("in_flight", ("in_", ("status", ["pending", "processing"]), {})),
    ("done", ("in_", ("status", ["completed", "failed"]), {})),
    ("completed", ("eq", ("status", "completed"), {})),
    ("failed", ("eq", ("status", "failed"), {})),
])
def test_status_filters(client_with, status, expected):
    _, rec = _list(client_with, params={"status": status})
    assert expected in rec.reads("library_documents")[0].calls


def test_order_updated_desc(client_with):
    _, rec = _list(client_with, params={"order": "updated_desc"})
    assert rec.reads("library_documents")[0].named("order") == [
        ("order", ("updated_at",), {"desc": True}), ("order", ("id",), {"desc": True})]


def test_kind_spreadsheet_is_one_constant_or(client_with):
    _, rec = _list(client_with, params={"kind": "spreadsheet"})
    ors = rec.reads("library_documents")[0].named("or_")
    assert len(ors) == 1
    expr = ors[0][1][0]
    for needle in (".xlsx", ".xls", ".csv", "spreadsheet", "csv"):
        assert needle in expr
    # a constant: the same string whatever else the request carried
    _, rec2 = _list(client_with, params={"kind": "spreadsheet", "folder_id": "root", "offset": 5})
    assert rec2.reads("library_documents")[0].named("or_")[0][1][0] == expr


def test_embedded_counts_are_flattened(client_with):
    row = _row(document_tables=[{"count": 3}], document_images=[{"count": 7}])
    res, _ = _list(client_with, rows=[row])
    doc = res.json()["documents"][0]
    assert (doc["table_count"], doc["image_count"]) == (3, 7)
    assert "document_tables" not in doc and "document_images" not in doc


def test_one_page_bounded_connection_name_read(client_with):
    rows = [_row(source_connection_id=CONN), _row(source_connection_id=CONN), _row()]
    res, rec = _list(client_with, rows=rows,
                     conn={"data": [{"id": CONN, "name": "Team Drive"}]})
    reads = rec.reads("connector_connections")
    assert len(reads) == 1
    assert ("select", ("id, name",), {}) in reads[0].calls
    assert reads[0].named("in_") == [("in_", ("id", [CONN]), {})]
    names = [d["source_connection_name"] for d in res.json()["documents"]]
    assert names == ["Team Drive", "Team Drive", None]


def test_connection_name_failure_leaves_none_never_500(client_with):
    res, _ = _list(client_with, rows=[_row(source_connection_id=CONN)], conn=RuntimeError("boom"))
    assert res.status_code == 200
    assert res.json()["documents"][0]["source_connection_name"] is None


def test_no_connector_rows_no_name_read(client_with):
    _, rec = _list(client_with, rows=[_row()])
    assert not rec.reads("connector_connections")


def test_total_falls_back_to_page_length_only_when_count_is_absent(client_with):
    client, rec = client_with({"library_documents": {"data": [_row()], "count": None}})
    assert client.get("/documents").json()["total"] == 1


def test_the_stopgap_is_gone():
    from app.api import documents

    src = inspect.getsource(documents)
    assert "_ID_BATCH" not in src
    assert "get_globally_visible_folder_ids" not in src


# ── GET /documents/{id} ──────────────────────────────────────────────────────────────────────

def test_single_read_malformed_id_is_422(client_with):
    client, rec = client_with({})
    res = client.get("/documents/not-a-uuid")
    assert res.status_code == 422
    assert not rec.executed


def test_single_read_view_miss_is_404(client_with):
    client, rec = client_with({"library_documents": {"data": None}})
    res = client.get(f"/documents/{DOC_ID}")
    assert res.status_code == 404
    assert res.json()["detail"] == "Document not found"
    q = rec.reads("library_documents")[0]
    assert ("eq", ("id", DOC_ID), {}) in q.calls and q.named("maybe_single")


def test_single_read_hit_is_a_document(client_with):
    client, _ = client_with({"library_documents": {"data": _row(DOC_ID)}})
    res = client.get(f"/documents/{DOC_ID}")
    assert res.status_code == 200, res.text
    assert res.json()["id"] == DOC_ID
    assert res.json()["table_count"] == 2


def test_the_single_read_shadows_no_literal_documents_route():
    """Every literal ``GET /documents/<segment>`` route must be declared BEFORE the param route,
    or it would never be reached. Today there are none; this fails the day one is added after."""
    routes = [r for r in app.routes if "GET" in getattr(r, "methods", set())]
    paths = [r.path for r in routes]
    assert "/documents/{document_id}" in paths
    param_at = paths.index("/documents/{document_id}")
    for i, p in enumerate(paths):
        parts = p.split("/")
        if len(parts) == 3 and parts[1] == "documents" and "{" not in parts[2]:
            assert i < param_at, f"GET {p} is shadowed by GET /documents/{{document_id}}"


# ── per-document routes ──────────────────────────────────────────────────────────────────────

def _gate_ok():
    return {"data": {"id": DOC_ID, "filename": "a.pdf", "user_id": USER_ID, "folder_id": None}}


@pytest.mark.parametrize("path,table,key,default,cap,order", [
    ("chunks", "document_chunks", "chunks", 200, 500, "chunk_index"),
    ("tables", "document_tables", "tables", 50, 200, "table_index"),
    ("images", "document_images", "images", 100, 200, "image_index"),
])
def test_per_document_lists_page_with_exact_totals(client_with, path, table, key, default, cap, order):
    client, rec = client_with({"library_documents": _gate_ok(), table: {"data": [], "count": 2500}})
    res = client.get(f"/documents/{DOC_ID}/{path}")
    assert res.status_code == 200, res.text
    assert res.json() == {key: [], "total": 2500, "offset": 0, "limit": default}
    q = rec.reads(table)[0]
    assert [k for n, a, k in q.calls if n == "select"][0].get("count") == "exact"
    assert q.named("range") == [("range", (0, default - 1), {})]
    assert q.named("order")[0][1] == (order,)
    assert client.get(f"/documents/{DOC_ID}/{path}", params={"limit": cap}).status_code == 200
    assert client.get(f"/documents/{DOC_ID}/{path}", params={"limit": cap + 1}).status_code == 422
    assert client.get(f"/documents/{DOC_ID}/{path}", params={"offset": -1}).status_code == 422


def test_versions_page_through_aexec_with_exact_total(client_with):
    gate = {"data": {"filename": "a.pdf", "user_id": USER_ID, "folder_id": None}}
    v = [_row(version_number=2), _row(version_number=1, is_latest=False)]
    client, rec = client_with({"documents": lambda q: gate if q.named("maybe_single")
                               else {"data": v, "count": 2}})
    res = client.get(f"/documents/{DOC_ID}/versions")
    assert res.status_code == 200, res.text
    body = res.json()
    assert (body["total"], body["offset"], body["limit"]) == (2, 0, 50)
    assert [d["version_number"] for d in body["versions"]] == [2, 1]
    page = [q for q in rec.reads("documents") if not q.named("maybe_single")][0]
    assert page.named("order") == [("order", ("version_number",), {"desc": True})]
    assert page.named("range") == [("range", (0, 49), {})]
    assert client.get(f"/documents/{DOC_ID}/versions", params={"limit": 201}).status_code == 422


def test_versions_and_list_use_aexec_not_bare_execute():
    from app.api import documents

    for fn in (documents.list_documents, documents.list_document_versions,
               documents.get_document):
        assert ".execute()" not in inspect.getsource(fn), fn.__name__
