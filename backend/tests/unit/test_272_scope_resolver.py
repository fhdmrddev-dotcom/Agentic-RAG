"""Phase 272-03 (D-21 / D-06 / D-11 / D-18 / D-19 / D-20 / D-23) — the scope resolver, no database.

Fakes: a RECORDING supabase-py builder (every chained call is kept, per query), a patched
``retrieval_scope.get_user_pg_connection`` yielding a fake asyncpg connection (every SQL + args
kept), a patched ``_resolve_caller_org_ids`` and a patched field whitelist. So every case reads
exactly what step 1 asked PostgREST for and what step 2 asked Postgres under RLS.

The binding rules this pins:

* **D-21 two steps.** Step 1 (service role) only proposes candidates, bounded to the caller's
  orgs; step 2 (the caller's RLS) decides. An id step 1 returned that step 2 did not is ABSENT.
* **D-18.** No orgs, ``folder_ids=[]``, or no candidates → an EMPTY ScopeResult, with zero
  further queries. ``None`` is never produced for "matched nothing".
* **D-19.** The chat folder scope is ANDed into step 1, never dropped.
* **Pitfall 14 / D-05.** ``added`` / ``source_created`` / ``source_modified`` are Find's
  timestamptz dates (``FindDate``); ``date`` is the document's own date (``date_typed``, the
  compiler) — the two never swap.
"""
from __future__ import annotations

import ast
import pathlib
import re
from contextlib import asynccontextmanager

import pytest

import app.services.retrieval_scope as rscope
from app.services.retrieval_scope import DEFAULT_PREDICATES, RetrievalPredicate

ORGS = {"org-a"}


# ── fakes ────────────────────────────────────────────────────────────────────────────────────

class _Result:
    def __init__(self, data, count=None):
        self.data = data
        self.count = count


class _Query:
    def __init__(self, sb, table):
        self.sb = sb
        self.table = table
        self.calls: list[tuple] = []
        sb.queries.append(self)

    def __getattr__(self, name):
        def _rec(*args, **kwargs):
            self.calls.append((name, args, kwargs))
            return self
        return _rec

    def execute(self):
        rows = self.sb.responder(self)
        return _Result(rows, count=len(rows) if self.has("select") and self.count_requested() else None)

    # helpers
    def has(self, name):
        return any(c[0] == name for c in self.calls)

    def count_requested(self):
        return any(c[0] == "select" and c[2].get("count") == "exact" for c in self.calls)

    def args_of(self, name):
        return [c[1] for c in self.calls if c[0] == name]


class _FakeSupabase:
    def __init__(self, responder):
        self.queries: list[_Query] = []
        self.responder = responder

    def table(self, name):
        return _Query(self, name)


class _FakeConn:
    def __init__(self, responder):
        self.responder = responder
        self.calls: list[tuple] = []

    async def fetch(self, sql, *args):
        self.calls.append((sql, args))
        return self.responder(sql, args)


def _step1_ids(ids):
    """Responder: every documents query returns these candidate ids (range-walk aware)."""
    def _resp(q):
        rng = q.args_of("range")
        start = rng[0][0] if rng else 0
        return [{"id": i} for i in ids][start:]
    return _resp


@pytest.fixture
def harness(monkeypatch):
    state = {"orgs": set(ORGS), "rls_ids": None, "conn": None, "pg_rows": None}

    async def _orgs(_sb, _uid):
        return set(state["orgs"])

    async def _meta(_uid, _sb):
        return ({"legal_entity", "date", "document_type", "title", "author"}, set())

    monkeypatch.setattr(rscope, "_resolve_caller_org_ids", _orgs)
    import app.services.document_view_resolver as dvr
    monkeypatch.setattr(dvr, "_build_field_meta", _meta)

    def _conn_responder(sql, args):
        if state["pg_rows"] is not None:
            return state["pg_rows"](sql, args)
        ids = args[0]
        allowed = state["rls_ids"]
        return [{"id": i} for i in ids if allowed is None or i in allowed]

    conn = _FakeConn(_conn_responder)
    state["conn"] = conn

    @asynccontextmanager
    async def _fake_user_conn(request, current_user):
        assert request is None and current_user == {"id": "u1"}, (request, current_user)
        yield conn

    monkeypatch.setattr(rscope, "get_user_pg_connection", _fake_user_conn)
    return state


_ACME = {"field": "legal_entity", "op": "eq", "value": "Acme GmbH"}


# ── step 1 shape + D-19 ──────────────────────────────────────────────────────────────────────

async def test_step1_is_bounded_to_orgs_latest_connected_and_the_folder_scope(harness):
    sb = _FakeSupabase(_step1_ids(["d1"]))
    res = await rscope.resolve_document_scope(
        user_id="u1", conditions=[_ACME], folder_ids=["f1"], supabase=sb,
    )
    docs = [q for q in sb.queries if q.table == "documents"]
    assert docs, "no step-1 read happened"
    q = docs[0]
    assert ("org_id", sorted(ORGS)) in q.args_of("in_")
    assert ("is_latest", True) in q.args_of("eq")
    assert ("source_state.is.null,source_state.neq.source_disconnected",) in q.args_of("or_")
    assert ("metadata", {"legal_entity": "Acme GmbH"}) in q.args_of("contains")
    assert ("folder_id", ["f1"]) in q.args_of("in_"), "D-19: the folder scope was dropped"
    assert res.document_ids == ("d1",)
    assert res.applied == (_ACME,)


async def test_no_folder_scope_means_no_folder_predicate(harness):
    sb = _FakeSupabase(_step1_ids(["d1"]))
    await rscope.resolve_document_scope(user_id="u1", conditions=[_ACME], folder_ids=None, supabase=sb)
    q = [q for q in sb.queries if q.table == "documents"][0]
    assert not any(a[0] == "folder_id" for a in q.args_of("in_"))


# ── step 2: RLS decides (D-21) ───────────────────────────────────────────────────────────────

async def test_step2_is_one_bound_array_and_rls_decides(harness):
    harness["rls_ids"] = {"d1"}
    sb = _FakeSupabase(_step1_ids(["d1", "d2"]))
    res = await rscope.resolve_document_scope(user_id="u1", conditions=[_ACME], folder_ids=None, supabase=sb)
    sql, args = harness["conn"].calls[0]
    assert re.search(r"FROM public\.documents WHERE id = ANY\(\$1::uuid\[\]\)", sql), sql
    assert len(args) == 1 and sorted(args[0]) == ["d1", "d2"]
    assert res.document_ids == ("d1",), "an id RLS did not return leaked into the scope"


# ── D-18: never widen ────────────────────────────────────────────────────────────────────────

async def test_no_orgs_is_empty_with_no_reads(harness):
    harness["orgs"] = set()
    sb = _FakeSupabase(_step1_ids(["d1"]))
    res = await rscope.resolve_document_scope(user_id="u1", conditions=[_ACME], folder_ids=None, supabase=sb)
    assert res.is_empty and res.document_ids == ()
    assert [q for q in sb.queries if q.table == "documents"] == []
    assert harness["conn"].calls == []


async def test_an_empty_folder_scope_is_empty_with_zero_queries(harness):
    sb = _FakeSupabase(_step1_ids(["d1"]))
    res = await rscope.resolve_document_scope(user_id="u1", conditions=[_ACME], folder_ids=[], supabase=sb)
    assert res.is_empty
    assert sb.queries == [] and harness["conn"].calls == []


async def test_no_candidates_is_empty_with_no_step2(harness):
    sb = _FakeSupabase(_step1_ids([]))
    res = await rscope.resolve_document_scope(user_id="u1", conditions=[_ACME], folder_ids=None, supabase=sb)
    assert res.is_empty and res.document_ids == ()
    assert harness["conn"].calls == []


# ── dates: FindDate vs the compiler (Pitfall 14 / D-05) + D-06 ───────────────────────────────

async def test_a_date_word_routes_to_finddate_day_boundaries(harness):
    sb = _FakeSupabase(_step1_ids(["d1"]))
    cond = {"field": "source_modified", "op": "between", "value": "2025-10-01", "value2": "2025-10-31"}
    res = await rscope.resolve_document_scope(user_id="u1", conditions=[cond], folder_ids=None, supabase=sb)
    q = [q for q in sb.queries if q.table == "documents"][0]
    assert ("source_modified_at", "2025-10-01") in q.args_of("gte")
    assert ("source_modified_at", "2025-11-01") in q.args_of("lt")
    assert res.date_field == "source_modified"


async def test_the_document_date_routes_to_the_compiler_not_finddate(harness):
    sb = _FakeSupabase(_step1_ids(["d1"]))
    cond = {"field": "date", "op": "between", "value": "2025-10-01", "value2": "2025-10-31"}
    res = await rscope.resolve_document_scope(user_id="u1", conditions=[cond], folder_ids=None, supabase=sb)
    q = [q for q in sb.queries if q.table == "documents"][0]
    assert ("date_typed", "2025-10-01") in q.args_of("gte")
    assert ("date_typed", "2025-10-31") in q.args_of("lte")
    assert not any(a[0].endswith("_at") for a in q.args_of("gte")), "date was routed to FindDate"
    assert res.date_field == "date"


async def test_undated_count_is_rls_visible_and_names_its_field(harness):
    """D-06: documents passing every NON-date condition with NULL in that date's column."""
    harness["rls_ids"] = {"d1", "u1doc"}           # u2doc is not visible to the caller

    def _resp(q):
        if q.has("is_"):                            # the undated read
            assert ("date_typed", "null") in q.args_of("is_")
            assert ("metadata", {"legal_entity": "Acme GmbH"}) in q.args_of("contains")
            assert not q.has("gte"), "the date condition leaked into the undated read"
            return [{"id": "u1doc"}, {"id": "u2doc"}]
        return [{"id": "d1"}]

    sb = _FakeSupabase(_resp)
    cond = {"field": "date", "op": "between", "value": "2025-10-01", "value2": "2025-10-31"}
    res = await rscope.resolve_document_scope(user_id="u1", conditions=[_ACME, cond], folder_ids=None, supabase=sb)
    assert res.document_ids == ("d1",)
    assert res.undated_excluded == 1, "an id RLS hides was counted as undated"
    assert res.date_field == "date"


async def test_no_date_condition_means_no_undated_count(harness):
    sb = _FakeSupabase(_step1_ids(["d1"]))
    res = await rscope.resolve_document_scope(user_id="u1", conditions=[_ACME], folder_ids=None, supabase=sb)
    assert res.undated_excluded is None and res.date_field is None


# ── refusals propagate ───────────────────────────────────────────────────────────────────────

async def test_an_unknown_field_raises_resolve_error(harness):
    from app.services.document_view_resolver import ResolveError

    sb = _FakeSupabase(_step1_ids(["d1"]))
    with pytest.raises(ResolveError):
        await rscope.resolve_document_scope(
            user_id="u1", conditions=[{"field": "nope", "op": "eq", "value": "x"}],
            folder_ids=None, supabase=sb,
        )


@pytest.mark.parametrize("field", ["source_modified", "date"])
async def test_a_non_iso_date_is_refused_naming_the_rule(harness, field):
    from app.services.document_view_resolver import ResolveError

    sb = _FakeSupabase(_step1_ids(["d1"]))
    with pytest.raises(ResolveError) as ei:
        await rscope.resolve_document_scope(
            user_id="u1", conditions=[{"field": field, "op": "after", "value": "October"}],
            folder_ids=None, supabase=sb,
        )
    assert ei.value.status == 422
    assert "YYYY-MM-DD" in ei.value.detail
    assert [q for q in sb.queries if q.table == "documents"] == [], "a bad date reached PostgREST"


# ── D-13 seam: a predicate that is DATA ──────────────────────────────────────────────────────

async def test_a_python_enforced_predicate_is_applied_with_no_code_change(harness):
    extra = RetrievalPredicate(
        "only_reports", {"field": "document_type", "op": "eq", "value": "Report"}, False,
    )
    sb = _FakeSupabase(_step1_ids(["d1"]))
    res = await rscope.resolve_document_scope(
        user_id="u1", conditions=[_ACME], folder_ids=None, supabase=sb,
        predicates=DEFAULT_PREDICATES + (extra,),
    )
    q = [q for q in sb.queries if q.table == "documents"][0]
    assert ("metadata->>document_type", "report") in q.args_of("eq")
    assert res.applied == (_ACME,), "a default predicate is not a caller condition"


# ── D-11 nearby values ───────────────────────────────────────────────────────────────────────

async def test_nearby_months_are_ordered_by_distance_with_counts_never_text(harness):
    import datetime as dt

    def _pg(sql, args):
        if "date_typed" in sql:
            return [
                {"v": dt.date(2025, 9, 3)}, {"v": dt.date(2025, 9, 20)},
                {"v": dt.date(2025, 11, 2)}, {"v": dt.date(2025, 3, 1)},
            ]
        return [{"id": i} for i in args[0]]

    harness["pg_rows"] = _pg
    sb = _FakeSupabase(_step1_ids(["s1", "s2", "n1", "m1"]))
    cond = {"field": "date", "op": "between", "value": "2025-10-01", "value2": "2025-10-31"}
    out = await rscope.nearby_values(
        user_id="u1", conditions=[_ACME, cond], field="date", folder_ids=None, supabase=sb,
    )
    assert out[:2] == [
        {"value": "2025-09", "label": "September 2025", "documents": 2},
        {"value": "2025-11", "label": "November 2025", "documents": 1},
    ]
    assert all(set(e) == {"value", "label", "documents"} for e in out)
    # The date condition was REMOVED before re-resolving; the other one stayed.
    q = [q for q in sb.queries if q.table == "documents"][0]
    assert not q.has("gte") and ("metadata", {"legal_entity": "Acme GmbH"}) in q.args_of("contains")


async def test_nearby_dimension_values_are_ordered_by_count(harness):
    def _pg(sql, args):
        if "metadata->>$2" in sql:
            assert args[1] == "legal_entity"
            return [{"v": "Beta Ltd"}, {"v": "Acme AG"}, {"v": "Acme AG"}, {"v": None}]
        return [{"id": i} for i in args[0]]

    harness["pg_rows"] = _pg
    sb = _FakeSupabase(_step1_ids(["x1", "x2", "x3", "x4"]))
    out = await rscope.nearby_values(
        user_id="u1", conditions=[_ACME], field="legal_entity", folder_ids=None, supabase=sb,
    )
    assert out == [{"value": "Acme AG", "documents": 2}, {"value": "Beta Ltd", "documents": 1}]


# ── D-20 / D-23: bound params, never interpolated ────────────────────────────────────────────

async def test_canonical_stored_values_binds_field_and_value(harness):
    harness["pg_rows"] = lambda sql, args: [{"v": "Acme GmbH"}]
    out = await rscope.canonical_stored_values(user_id="u1", field="legal_entity", value="acme gmbh")
    sql, args = harness["conn"].calls[0]
    assert "$1" in sql and "$2" in sql
    assert "legal_entity" not in sql and "acme" not in sql.lower()
    assert args[:2] == ("legal_entity", "acme gmbh")
    assert out == ["Acme GmbH"]


async def test_top_document_types_binds_the_limit(harness):
    harness["pg_rows"] = lambda sql, args: [{"v": "report", "n": 4}, {"v": "invoice", "n": 2}]
    out = await rscope.top_document_types(user_id="u1", limit=15)
    sql, args = harness["conn"].calls[0]
    assert "document_type_norm" in sql and "$1" in sql and args == (15,)
    assert out == [("report", 4), ("invoice", 2)]


# ── source fences ────────────────────────────────────────────────────────────────────────────

_SRC = pathlib.Path(rscope.__file__).read_text(encoding="utf-8")


def test_find_modules_are_imported_function_locally_only():
    """Pitfall 5: a module-level import of the Find modules re-opens the tool_dispatcher cycle."""
    top = [n for n in ast.parse(_SRC).body if isinstance(n, (ast.Import, ast.ImportFrom))]
    names = {getattr(n, "module", None) or "" for n in top}
    for forbidden in ("app.services.document_view_resolver", "app.services.document_search_service",
                      "app.models.document_search", "app.models.document_view"):
        assert forbidden not in names, f"{forbidden} imported at module level"


def test_no_f_string_sql():
    assert not re.search(r"f\"[^\"]*(SELECT|WHERE)", _SRC)
    assert not re.search(r"f'[^']*(SELECT|WHERE)", _SRC)
