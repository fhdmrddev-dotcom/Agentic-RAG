"""Phase 271 (271-01 Task 2) — the document-search core, proven by its exact builder calls.

``document_search_service.search_documents`` answers every structure condition the Find UI
offers. ROADMAP's named failure for this phase is "a filter the backend silently ignores", so
every applier here is asserted TWICE:

  1. by the exact PostgREST builder calls it issues on EVERY visibility leg (a recorder), and
  2. by CONTENT — the fake below EVALUATES the recorded calls against canned rows, so a test
     asserts the returned id set, not merely that a method was called.

``FakePostgrest`` is a tiny in-memory PostgREST: ``select`` (projection + ``count``), ``eq``,
``neq``, ``in_``, ``is_``, ``ilike`` (LIKE with backslash escapes), ``gte``, ``lt``, ``lte``,
``contains``, ``order``, ``range``, ``limit``. ``rpc`` raises — the search path may never
call one (D-03). The relationship suite imports it from here (the test_240 precedent).

Imports of the service are inside the test bodies so RED is a per-test ImportError.
"""

from __future__ import annotations

import re
from datetime import date

import pytest

CALLER = "11111111-1111-4111-8111-111111111111"
OTHER = "22222222-2222-4222-8222-222222222222"
F1 = "aaaaaaaa-0000-4000-8000-000000000001"
F2 = "aaaaaaaa-0000-4000-8000-000000000002"
G1 = "bbbbbbbb-0000-4000-8000-000000000001"
CONN = "cccccccc-0000-4000-8000-000000000001"


# ─────────────────────────────── the fake PostgREST ───────────────────────────────


class FakeResult:
    def __init__(self, data, count=None):
        self.data = data
        self.count = count


def _get(row: dict, col: str):
    if col.startswith("metadata->>"):
        return (row.get("metadata") or {}).get(col[len("metadata->>"):])
    if col == "metadata->source->>system":
        return ((row.get("metadata") or {}).get("source") or {}).get("system")
    return row.get(col)


def _norm(v):
    return str(v) if v is not None and not isinstance(v, (bool, int, float)) else v


def _like_to_regex(pattern: str) -> re.Pattern:
    out, i = [], 0
    while i < len(pattern):
        ch = pattern[i]
        if ch == "\\" and i + 1 < len(pattern):
            out.append(re.escape(pattern[i + 1]))
            i += 2
            continue
        if ch in ("%", "*"):
            out.append(".*")
        elif ch == "_":
            out.append(".")
        else:
            out.append(re.escape(ch))
        i += 1
    return re.compile("^" + "".join(out) + "$", re.IGNORECASE | re.DOTALL)


def parse_pgrst_in_list(value: str) -> list[str]:
    r"""PostgREST's ``in.(...)`` list grammar, as MEASURED against the local server (14.10).

    271-REVIEW WR-04, probed with uuid-cast errors that echo the parsed value back:
      * ``("a\"b")`` -> ``a"b``, ``("a\\b")`` -> ``a\b``, ``("a\b")`` -> ``ab``: inside quotes a backslash
        escapes the next character;
      * ``(a\b)`` -> ``a\b``: an unquoted value is verbatim up to the next comma;
      * ``("Q3 "final", draft.pdf")`` -> first value ``"Q3 "final"`` (quotes and all): a quoted
        value that does not close cleanly is re-read verbatim to the next comma. NO 400 —
        the request succeeds and silently matches the wrong names.
    """
    assert value.startswith("(") and value.endswith(")"), value
    body = value[1:-1]
    out: list[str] = []
    i = 0
    while i <= len(body):
        if body.startswith('"', i):
            j, buf = i + 1, []
            while j < len(body) and body[j] != '"':
                if body[j] == "\\" and j + 1 < len(body):
                    buf.append(body[j + 1])
                    j += 2
                    continue
                buf.append(body[j])
                j += 1
            if j < len(body) and (j + 1 == len(body) or body[j + 1] == ","):
                out.append("".join(buf))
                i = j + 2
                continue
        k = body.find(",", i)
        k = len(body) if k == -1 else k
        out.append(body[i:k])
        i = k + 1
    return out


class FakeQuery:
    def __init__(self, client: "FakePostgrest", table: str):
        self.client = client
        self.table = table
        self.calls: list[tuple] = []
        self.cols = "*"
        self.count_mode = None
        self._range = None
        self._order: list[tuple[str, bool]] = []
        self._limit = None
        client.queries.append(self)

    # builder ---------------------------------------------------------------------------
    def select(self, cols="*", count=None):
        self.calls.append(("select", cols, count))
        self.cols = cols
        self.count_mode = count
        return self

    def _filter(name):  # noqa: N805 — a method factory
        def f(self, col, val):
            self.calls.append((name, col, val))
            return self

        return f

    eq = _filter("eq")
    neq = _filter("neq")
    in_ = _filter("in_")
    is_ = _filter("is_")
    ilike = _filter("ilike")
    gte = _filter("gte")
    lt = _filter("lt")
    lte = _filter("lte")
    contains = _filter("contains")

    def or_(self, expr):
        self.calls.append(("or_", expr))
        return self

    def filter(self, col, op, val):
        """``.filter(col, "in", "(...)")`` — a hand-quoted in-list (271-REVIEW WR-04).

        Parsed with PostgREST's own grammar (``parse_pgrst_in_list``) and recorded as an
        ``in_`` over the values the SERVER would see, so a quoting defect changes the answer.
        """
        if op != "in":  # pragma: no cover — the search core only hand-builds in-lists
            raise AssertionError(f"the fake does not evaluate .filter op {op!r}")
        self.calls.append(("in_", col, parse_pgrst_in_list(val)))
        return self

    def order(self, col, desc=False, **_k):
        self.calls.append(("order", col, desc))
        self._order.append((col, desc))
        return self

    def range(self, start, end):
        self.calls.append(("range", start, end))
        self._range = (start, end)
        return self

    def limit(self, n):
        self.calls.append(("limit", n))
        self._limit = n
        return self

    # helpers for assertions ------------------------------------------------------------
    def filters(self, name=None):
        return [c for c in self.calls if c[0] not in ("select", "order", "range", "limit")
                and (name is None or c[0] == name)]

    # evaluation ------------------------------------------------------------------------
    def _match(self, row) -> bool:
        for c in self.calls:
            op = c[0]
            if op in ("select", "order", "range", "limit"):
                continue
            if op == "or_":
                raise AssertionError("the fake does not evaluate or_; the search core never builds one")
            _, col, val = c
            have = _get(row, col)
            if op == "eq":
                if have is None or _norm(have) != _norm(val):
                    return False
            elif op == "neq":
                if have is None or _norm(have) == _norm(val):
                    return False
            elif op == "in_":
                if have is None or _norm(have) not in {_norm(v) for v in val}:
                    return False
            elif op == "is_":
                assert val == "null"
                if have is not None:
                    return False
            elif op == "ilike":
                if have is None or not _like_to_regex(val).match(str(have)):
                    return False
            elif op in ("gte", "lt", "lte"):
                if have is None:
                    return False
                h, v = str(have), str(val)
                if op == "gte" and not h >= v:
                    return False
                if op == "lt" and not h < v:
                    return False
                if op == "lte" and not h <= v:
                    return False
            elif op == "contains":
                blob = row.get(col) or {}
                if any(blob.get(k) != v for k, v in val.items()):
                    return False
            else:  # pragma: no cover
                raise AssertionError(f"unknown op {op}")
        return True

    def execute(self):
        self.client.executed.append(self)
        override = self.client.override(self) if self.client.override else None
        if override is not None:
            return override
        rows = [r for r in self.client.tables.get(self.table, []) if self._match(r)]
        for col, desc in reversed(self._order):
            rows.sort(key=lambda r: (_get(r, col) is None, str(_get(r, col))), reverse=desc)
        count = len(rows) if self.count_mode == "exact" else None
        if self._range is not None:
            s, e = self._range
            rows = rows[s:e + 1]
        if self._limit is not None:
            rows = rows[: self._limit]
        if self.client.max_rows is not None:
            rows = rows[: self.client.max_rows]
        if self.cols != "*":
            keep = [c.strip() for c in self.cols.split(",")]
            rows = [{k: r.get(k) for k in keep} for r in rows]
        else:
            rows = [dict(r) for r in rows]
        return FakeResult(rows, count)


class FakePostgrest:
    def __init__(self, tables=None, *, max_rows=None, override=None):
        self.tables = tables or {}
        self.max_rows = max_rows
        self.override = override
        self.queries: list[FakeQuery] = []
        self.executed: list[FakeQuery] = []

    def table(self, name):
        return FakeQuery(self, name)

    def rpc(self, *a, **k):  # D-03: the search path never calls an RPC
        raise AssertionError(f"the document-search path called .rpc{a!r}")

    # assertion helpers -----------------------------------------------------------------
    def candidate_legs(self):
        from app.services.document_search_service import CANDIDATE_COLUMNS

        return [q for q in self.queries if q.table == "documents" and q.cols == CANDIDATE_COLUMNS]

    def first_page_legs(self):
        return [q for q in self.candidate_legs() if q.count_mode == "exact"]


def doc(id_, *, user_id=CALLER, filename=None, folder_id=None, version_number=1, is_latest=True,
        created_at="2024-01-01T00:00:00+00:00", source_created_at=None, source_modified_at=None,
        date_typed=None, source_connection_id=None, document_type_norm=None, metadata=None):
    return {
        "id": id_,
        "user_id": user_id,
        "filename": filename or f"{id_}.pdf",
        "folder_id": folder_id,
        "version_number": version_number,
        "is_latest": is_latest,
        "created_at": created_at,
        "source_created_at": source_created_at,
        "source_modified_at": source_modified_at,
        "date_typed": date_typed,
        "source_connection_id": source_connection_id,
        "document_type_norm": document_type_norm,
        "metadata": metadata if metadata is not None else {"title": id_},
    }


@pytest.fixture
def patched(monkeypatch):
    """Patch every folder/visibility/field-meta seam at its import site; return a setter."""
    import app.services.document_search_service as svc
    import app.services.document_view_resolver as resolver

    state = {"global": [], "visible": [], "subtree": None}

    async def _global(supabase, user_id):
        return list(state["global"])

    async def _visible(supabase, user_id, **_k):
        return [{"id": f} for f in state["visible"]]

    async def _subtree(folder_id, *, supabase, user_id, **_k):
        return list(state["subtree"]) if state["subtree"] is not None else [str(folder_id)]

    async def _meta(user_id, supabase):
        return {"document_type", "date", "title", "reviewed"}, set()

    monkeypatch.setattr(svc, "get_globally_visible_folder_ids", _global)
    monkeypatch.setattr(svc, "fetch_visible_folders", _visible)
    monkeypatch.setattr(svc, "resolve_project_subtree", _subtree)
    monkeypatch.setattr(resolver, "_build_field_meta", _meta)
    return state


async def run(client, **body):
    from app.models.document_search import DocumentSearchRequest
    from app.services.document_search_service import search_documents

    req = DocumentSearchRequest(**body)
    return await search_documents(caller=CALLER, req=req, supabase=client)


def ids(result):
    return [d["id"] for d in result["documents"]]


RESULT_KEYS = {"documents", "total", "older_matches", "sort", "offset", "limit"}


# ─────────────────────────────── the model ───────────────────────────────


def test_model_defaults():
    from app.models.document_search import DocumentSearchRequest

    r = DocumentSearchRequest()
    assert r.version == "latest"
    assert r.sort == "added_desc"
    assert r.offset == 0
    assert r.limit == 25
    assert r.filter_expr.conditions == []
    assert r.dates == []


@pytest.mark.parametrize(
    "body",
    [
        {"bogus": 1},
        {"limit": 101},
        {"limit": 0},
        {"offset": -1},
        {"name": "x" * 201},
        {"added_by": {"kind": "connection"}},
        {"added_by": {"kind": "me", "connection_id": CONN}},
        {"added_by": {"kind": "others", "connection_id": CONN}},
        {"dates": [{"which": "added", "op": "before", "value": "2020-01-01"},
                   {"which": "added", "op": "after", "value": "2019-01-01"}]},
        {"dates": [{"which": "added", "op": "before", "value": "2019-13-40"}]},
        {"dates": [{"which": "added", "op": "between", "value": "2019-01-01"}]},
        {"dates": [{"which": "added", "op": "within_next", "value": -1, "unit": "days"}]},
        {"dates": [{"which": "added", "op": "within_next", "value": "7", "unit": "days"}]},
        {"dates": [{"which": "nope", "op": "before", "value": "2020-01-01"}]},
        {"relationship": {"verb": "related_to", "document_id": F1}},
        {"relationship": {"verb": "supersedes", "document_id": "not-a-uuid"}},
        {"version": "superseded"},
        {"sort": "relevance"},
        {"folder": {"folder_id": F1, "extra": True}},
    ],
)
def test_model_rejects(body):
    from pydantic import ValidationError

    from app.models.document_search import DocumentSearchRequest

    with pytest.raises(ValidationError):
        DocumentSearchRequest(**body)


def test_model_accepts_full_body():
    from app.models.document_search import DocumentSearchRequest

    r = DocumentSearchRequest(
        name="contract",
        folder={"folder_id": F1},
        added_by={"kind": "connection", "connection_id": CONN},
        dates=[{"which": "added", "op": "between", "value": "2019-01-01", "value2": "2019-12-31"},
               {"which": "source_modified", "op": "within_next", "value": 7, "unit": "days"}],
        relationship={"verb": "superseded_by", "document_id": F2},
        version="has_earlier",
        sort="name_asc",
        offset=25,
        limit=100,
    )
    assert r.folder.include_subfolders is True


# ─────────────────────────────── name ───────────────────────────────


@pytest.mark.asyncio
async def test_name_is_escaped_once_per_leg(patched):
    patched["global"] = [G1]
    rows = [doc("d1", filename="ac%me_\\.pdf"), doc("d2", filename="acXme_\\.pdf"),
            doc("d3", filename="ACme.pdf", user_id=OTHER, folder_id=G1)]
    client = FakePostgrest({"documents": rows})
    out = await run(client, name="ac%me_\\")
    legs = client.first_page_legs()
    assert len(legs) == 2
    for q in legs:
        assert q.filters("ilike") == [("ilike", "filename", "%ac\\%me\\_\\\\%")]
    # Content: only the literal % / _ / \ match — the wildcard reading would also take d2.
    assert ids(out) == ["d1"]


# ─────────────────────────────── folder ───────────────────────────────


@pytest.mark.asyncio
async def test_folder_subtree_narrows_every_leg(patched):
    patched["global"] = [G1]
    patched["visible"] = [F1, F2, G1]
    patched["subtree"] = [F1, F2]
    rows = [doc("in1", folder_id=F1), doc("in2", folder_id=F2), doc("out", folder_id=None),
            doc("g", user_id=OTHER, folder_id=G1)]
    client = FakePostgrest({"documents": rows})
    out = await run(client, folder={"folder_id": F1})
    for q in client.first_page_legs():
        assert ("in_", "folder_id", [F1, F2]) in q.calls
    assert sorted(ids(out)) == ["in1", "in2"]


@pytest.mark.asyncio
async def test_folder_without_subfolders_is_the_folder_alone(patched):
    patched["visible"] = [F1, F2]
    patched["subtree"] = [F1, F2]
    rows = [doc("in1", folder_id=F1), doc("in2", folder_id=F2)]
    client = FakePostgrest({"documents": rows})
    out = await run(client, folder={"folder_id": F1, "include_subfolders": False})
    for q in client.first_page_legs():
        assert ("in_", "folder_id", [F1]) in q.calls
    assert ids(out) == ["in1"]


@pytest.mark.asyncio
async def test_not_in_a_folder_is_folder_id_null(patched):
    rows = [doc("loose", folder_id=None), doc("filed", folder_id=F1)]
    client = FakePostgrest({"documents": rows})
    out = await run(client, folder={"folder_id": None})
    for q in client.first_page_legs():
        assert ("is_", "folder_id", "null") in q.calls
    assert ids(out) == ["loose"]


@pytest.mark.asyncio
async def test_unreachable_folder_returns_zero_and_issues_no_documents_query(patched):
    patched["visible"] = [F2]  # F1 is not visible to the caller
    patched["subtree"] = [F1]
    client = FakePostgrest({"documents": [doc("x", folder_id=F1)]})
    out = await run(client, folder={"folder_id": F1})
    assert set(out) == RESULT_KEYS
    assert out["documents"] == [] and out["total"] == 0 and out["older_matches"] == 0
    assert [q for q in client.queries if q.table == "documents"] == []


# ─────────────────────────────── added by ───────────────────────────────


@pytest.mark.asyncio
async def test_added_by_me(patched):
    patched["global"] = [G1]
    rows = [doc("mine"), doc("mine-conn", source_connection_id=CONN),
            doc("theirs", user_id=OTHER, folder_id=G1)]
    client = FakePostgrest({"documents": rows})
    out = await run(client, added_by={"kind": "me"})
    for q in client.first_page_legs():
        assert ("eq", "user_id", CALLER) in q.calls
        assert ("is_", "source_connection_id", "null") in q.calls
    assert ids(out) == ["mine"]


@pytest.mark.asyncio
async def test_added_by_connection(patched):
    rows = [doc("mine"), doc("mine-conn", source_connection_id=CONN)]
    client = FakePostgrest({"documents": rows})
    out = await run(client, added_by={"kind": "connection", "connection_id": CONN})
    for q in client.first_page_legs():
        assert ("eq", "source_connection_id", CONN) in q.calls
    assert ids(out) == ["mine-conn"]


@pytest.mark.asyncio
async def test_added_by_others(patched):
    patched["global"] = [G1]
    rows = [doc("mine"), doc("theirs", user_id=OTHER, folder_id=G1),
            doc("theirs-conn", user_id=OTHER, folder_id=G1, source_connection_id=CONN)]
    client = FakePostgrest({"documents": rows})
    out = await run(client, added_by={"kind": "others"})
    for q in client.first_page_legs():
        assert ("neq", "user_id", CALLER) in q.calls
        assert ("is_", "source_connection_id", "null") in q.calls
    assert ids(out) == ["theirs"]


# ─────────────────────────────── dates ───────────────────────────────


@pytest.mark.asyncio
async def test_added_before_is_strict_day(patched):
    rows = [doc("old", created_at="2019-12-31T15:00:00+00:00"),
            doc("new", created_at="2020-01-01T00:00:00+00:00")]
    client = FakePostgrest({"documents": rows})
    out = await run(client, dates=[{"which": "added", "op": "before", "value": "2020-01-01"}])
    for q in client.first_page_legs():
        assert q.filters("lt") == [("lt", "created_at", "2020-01-01")]
    assert ids(out) == ["old"]


@pytest.mark.asyncio
async def test_added_after_starts_the_next_day(patched):
    rows = [doc("dec31", created_at="2019-12-31T15:00:00+00:00"),
            doc("jan1", created_at="2020-01-01T00:00:01+00:00")]
    client = FakePostgrest({"documents": rows})
    out = await run(client, dates=[{"which": "added", "op": "after", "value": "2019-12-31"}])
    for q in client.first_page_legs():
        assert q.filters("gte") == [("gte", "created_at", "2020-01-01")]
    assert ids(out) == ["jan1"]


@pytest.mark.asyncio
async def test_added_between_keeps_the_whole_last_day(patched):
    rows = [doc("dec31-afternoon", created_at="2019-12-31T15:00:00+00:00"),
            doc("before", created_at="2018-12-31T23:59:59+00:00"),
            doc("after", created_at="2020-01-01T00:00:00+00:00")]
    client = FakePostgrest({"documents": rows})
    out = await run(client, dates=[{"which": "added", "op": "between",
                                     "value": "2019-01-01", "value2": "2019-12-31"}])
    for q in client.first_page_legs():
        assert ("gte", "created_at", "2019-01-01") in q.calls
        assert ("lt", "created_at", "2020-01-01") in q.calls
    assert ids(out) == ["dec31-afternoon"]


class _FixedDate(date):
    @classmethod
    def today(cls):
        return cls(2024, 6, 10)


@pytest.mark.asyncio
async def test_relative_dates_use_the_shipped_window(patched, monkeypatch):
    import app.services.document_view_resolver as resolver

    monkeypatch.setattr(resolver, "date", _FixedDate)
    rows = [doc("soon", source_modified_at="2024-06-17T10:00:00+00:00"),
            doc("later", source_modified_at="2024-06-18T00:00:00+00:00"),
            doc("past", source_modified_at="2024-06-09T23:00:00+00:00"),
            doc("unknown", source_modified_at=None)]
    client = FakePostgrest({"documents": rows})
    out = await run(client, dates=[{"which": "source_modified", "op": "within_next",
                                     "value": 7, "unit": "days"}])
    for q in client.first_page_legs():
        assert ("gte", "source_modified_at", "2024-06-10") in q.calls
        assert ("lt", "source_modified_at", "2024-06-18") in q.calls
    assert ids(out) == ["soon"]

    client2 = FakePostgrest({"documents": [
        doc("ancient", source_created_at="2024-05-01T00:00:00+00:00"),
        doc("edge", source_created_at="2024-06-03T00:00:00+00:00"),
    ]})
    out2 = await run(client2, dates=[{"which": "source_created", "op": "older_than",
                                      "value": 1, "unit": "weeks"}])
    for q in client2.first_page_legs():
        assert q.filters("lt") == [("lt", "source_created_at", "2024-06-03")]
    assert ids(out2) == ["ancient"]


# ─────────────────────────────── metadata filter ───────────────────────────────


@pytest.mark.asyncio
async def test_metadata_filter_reaches_every_leg_through_the_shipped_compiler(patched):
    patched["global"] = [G1]
    rows = [doc("c", document_type_norm="contract"), doc("i", document_type_norm="invoice"),
            doc("gc", user_id=OTHER, folder_id=G1, document_type_norm="contract")]
    client = FakePostgrest({"documents": rows})
    out = await run(client, filter_expr={"op": "and", "conditions": [
        {"field": "document_type", "op": "eq", "value": "Contract"}]})
    legs = client.first_page_legs()
    assert len(legs) == 2
    for q in legs:
        assert ("eq", "document_type_norm", "contract") in q.calls
    assert sorted(ids(out)) == ["c", "gc"]


@pytest.mark.asyncio
async def test_metadata_whitelist_violation_is_a_422(patched):
    from app.services.document_view_resolver import ResolveError

    client = FakePostgrest({"documents": [doc("x")]})
    with pytest.raises(ResolveError) as ei:
        await run(client, filter_expr={"op": "and", "conditions": [
            {"field": "_confidence", "op": "eq", "value": "x"}]})
    assert ei.value.status == 422
    assert [q for q in client.queries if q.table == "documents"] == []


# ─────────────────────────────── version state ───────────────────────────────


def _lineage_rows():
    return [
        # v1 + v2 lineage → v2 has earlier
        doc("a1", filename="A.pdf", version_number=1, is_latest=False),
        doc("a2", filename="A.pdf", version_number=2, is_latest=True),
        # a lone v3 whose v1/v2 were deleted → no earlier version
        doc("b3", filename="B.pdf", version_number=3, is_latest=True),
        # restored lineage v1, v2, v3-latest → v3 has earlier
        doc("c1", filename="C.pdf", version_number=1, is_latest=False),
        doc("c2", filename="C.pdf", version_number=2, is_latest=False),
        doc("c3", filename="C.pdf", version_number=3, is_latest=True),
        # a colleague's older version in a shared folder (P-03: never in `older`)
        doc("x1", user_id=OTHER, filename="X.pdf", folder_id=G1, version_number=1, is_latest=False),
        doc("x2", user_id=OTHER, filename="X.pdf", folder_id=G1, version_number=2, is_latest=True),
    ]


@pytest.mark.asyncio
async def test_version_latest_is_the_default_on_both_legs(patched):
    patched["global"] = [G1]
    client = FakePostgrest({"documents": _lineage_rows()})
    out = await run(client)
    legs = client.first_page_legs()
    assert len(legs) == 2
    for q in legs:
        assert ("eq", "is_latest", True) in q.calls
    assert sorted(ids(out)) == ["a2", "b3", "c3", "x2"]
    assert all(d["is_latest"] for d in out["documents"])


@pytest.mark.asyncio
async def test_version_older_is_own_leg_only(patched):
    patched["global"] = [G1]
    client = FakePostgrest({"documents": _lineage_rows()})
    out = await run(client, version="older")
    legs = client.first_page_legs()
    assert len(legs) == 1, "P-03: no global-folder leg for older versions"
    assert ("eq", "is_latest", False) in legs[0].calls
    assert ("eq", "user_id", CALLER) in legs[0].calls
    assert sorted(ids(out)) == ["a1", "c1", "c2"]
    assert not any(d["is_latest"] for d in out["documents"])


@pytest.mark.asyncio
async def test_version_has_earlier_is_by_lineage(patched):
    patched["global"] = [G1]
    client = FakePostgrest({"documents": _lineage_rows()})
    out = await run(client, version="has_earlier")
    for q in client.first_page_legs():
        assert ("eq", "is_latest", True) in q.calls
    assert sorted(ids(out)) == ["a2", "c3", "x2"]
    for d in out["documents"]:
        assert d["has_earlier"] is True


# ─────────────────────────────── legs + dedupe ───────────────────────────────


@pytest.mark.asyncio
async def test_legs_are_two_queries_and_a_row_in_both_appears_once(patched):
    patched["global"] = [G1]
    rows = [doc("both", folder_id=G1), doc("own"), doc("glob", user_id=OTHER, folder_id=G1),
            doc("hidden", user_id=OTHER)]
    client = FakePostgrest({"documents": rows})
    out = await run(client)
    legs = client.first_page_legs()
    assert len(legs) == 2
    own, glob = legs
    assert own.filters()[0] == ("eq", "user_id", CALLER)
    assert glob.filters()[0] == ("in_", "folder_id", [G1])
    assert not any(c[0] == "or_" for q in legs for c in q.calls)
    assert sorted(ids(out)) == ["both", "glob", "own"]
    assert out["total"] == 3


@pytest.mark.asyncio
async def test_no_global_leg_when_no_global_folders(patched):
    client = FakePostgrest({"documents": [doc("own")]})
    await run(client)
    assert len(client.first_page_legs()) == 1


# ─────────────────────────────── sort ───────────────────────────────


def _sort_rows():
    return [
        doc("id-b", filename="beta.pdf", created_at="2024-01-02T00:00:00+00:00",
            date_typed="2020-05-01", source_modified_at=None, source_created_at="2021-01-01T00:00:00+00:00"),
        doc("id-a", filename="Alpha.pdf", created_at="2024-01-02T00:00:00+00:00",
            date_typed=None, source_modified_at="2023-03-01T00:00:00+00:00", source_created_at=None),
        doc("id-c", filename="charlie.pdf", created_at="2024-01-03T00:00:00.5+00:00",
            date_typed="2021-01-01", source_modified_at=None, source_created_at="2020-01-01T00:00:00+00:00"),
        doc("id-d", filename="Delta.pdf", created_at="2024-01-01T00:00:00+00:00",
            date_typed="2019-01-01", source_modified_at="2023-04-01T00:00:00+00:00",
            source_created_at="2022-01-01T00:00:00+00:00"),
    ]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "sort,expected",
    [
        # ties on created_at (id-a / id-b) break on id ascending in BOTH directions
        ("added_desc", ["id-c", "id-a", "id-b", "id-d"]),
        ("added_asc", ["id-d", "id-a", "id-b", "id-c"]),
        # NULL date_typed (id-a) comes LAST
        ("document_date_desc", ["id-c", "id-b", "id-d", "id-a"]),
        # NULL source_modified_at on id-b and id-c come LAST, id-ascending
        ("source_modified_desc", ["id-d", "id-a", "id-b", "id-c"]),
        ("source_created_desc", ["id-d", "id-b", "id-c", "id-a"]),
        # case-insensitive
        ("name_asc", ["id-a", "id-b", "id-c", "id-d"]),
    ],
)
async def test_each_sort_is_the_server_order(patched, sort, expected):
    client = FakePostgrest({"documents": _sort_rows()})
    out = await run(client, sort=sort)
    assert ids(out) == expected
    assert out["sort"] == sort


# ─────────────────────────────── page + total ───────────────────────────────


@pytest.mark.asyncio
async def test_page_slices_after_the_sort_and_total_is_the_candidate_count(patched):
    rows = [doc(f"id-{i:02d}", created_at=f"2024-01-{i + 1:02d}T00:00:00+00:00") for i in range(30)]
    client = FakePostgrest({"documents": rows})
    out = await run(client, offset=25, limit=25)
    assert out["total"] == 30
    assert ids(out) == [f"id-{i:02d}" for i in (4, 3, 2, 1, 0)]
    assert (out["offset"], out["limit"]) == (25, 25)


@pytest.mark.asyncio
async def test_candidates_are_range_paged_until_the_count(patched):
    rows = [doc(f"id-{i:04d}") for i in range(2500)]
    client = FakePostgrest({"documents": rows}, max_rows=1000)
    out = await run(client, limit=10)
    assert out["total"] == 2500
    ranges = [c for q in client.candidate_legs() for c in q.calls if c[0] == "range"]
    assert ranges[0] == ("range", 0, 999)
    assert len(ranges) == 3


@pytest.mark.asyncio
async def test_a_short_read_fails_loud(patched):
    from app.services.document_search_service import SearchTruncatedError

    def override(q):
        if q.table == "documents" and q.count_mode == "exact":
            return FakeResult([doc(f"id-{i}") for i in range(1000)], 1500)
        if q.table == "documents" and q._range is not None:
            return FakeResult([], None)
        return None

    client = FakePostgrest({"documents": []}, override=override)
    with pytest.raises(SearchTruncatedError) as ei:
        await run(client)
    assert ei.value.status == 503
    assert "Narrow the search" in ei.value.detail


@pytest.mark.asyncio
async def test_a_non_int_count_is_not_read_as_truncation(patched):
    from unittest.mock import MagicMock

    def override(q):
        if q.table == "documents" and q.count_mode == "exact":
            return FakeResult([doc("only")], MagicMock())
        return None

    client = FakePostgrest({"documents": [doc("only")]}, override=override)
    out = await run(client)
    assert ids(out) == ["only"]


# ─────────────────────────────── hydration ───────────────────────────────


@pytest.mark.asyncio
async def test_page_rows_are_hydrated_with_full_rows_and_facts(patched):
    rows = [
        doc("v1", filename="A.pdf", version_number=1, is_latest=False),
        doc("v2", filename="A.pdf", version_number=2, is_latest=True, source_connection_id=CONN,
            metadata={"title": "A", "_source": {"title": "llm"}, "_confidence": {"title": 0.4}}),
        doc("solo", filename="B.pdf"),
    ]
    client = FakePostgrest({"documents": rows,
                            "connector_connections": [{"id": CONN, "name": "Drive"}]})
    out = await run(client, sort="name_asc")
    by_id = {d["id"]: d for d in out["documents"]}
    assert by_id["v2"]["version_count"] == 2
    assert by_id["v2"]["has_earlier"] is True
    assert by_id["v2"]["source_connection_name"] == "Drive"
    assert by_id["v2"]["metadata"]["_confidence"] == {"title": 0.4}  # the full blob, no coercion
    assert by_id["solo"]["version_count"] == 1
    assert by_id["solo"]["has_earlier"] is False
    assert by_id["solo"]["source_connection_name"] is None
    hydrate = [q for q in client.queries if q.table == "documents" and q.cols == "*"]
    assert len(hydrate) == 1


@pytest.mark.asyncio
async def test_a_failing_connection_read_leaves_names_none(patched):
    def override(q):
        if q.table == "connector_connections":
            raise RuntimeError("boom")
        return None

    client = FakePostgrest({"documents": [doc("v", source_connection_id=CONN)]}, override=override)
    out = await run(client)
    assert out["documents"][0]["source_connection_name"] is None


# ─────────────────────────────── D-03 here ───────────────────────────────


@pytest.mark.asyncio
async def test_no_rpc_and_no_embedding_names(patched):
    import app.services.document_search_service as svc

    client = FakePostgrest({"documents": [doc("x")]})
    await run(client, name="x", version="has_earlier")  # .rpc on the fake raises
    for attr in ("embed_texts", "embed_chunks", "openai_service", "embedding_service",
                 "retrieval_service", "HTTPException"):
        assert not hasattr(svc, attr), attr
