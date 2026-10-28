"""Phase 284 (R-03 / D-06 / D-07) — the shape of ``GET /library/summary``, with mocked rows.

The route runs ONE ``GROUPING SETS`` scan over ``public.library_documents`` and folds the rows by
their ``GROUPING()`` flags. This suite drives the fold over hand-built rows — no database — so the
mapping is pinned exactly:

  * the grand-total row (every flag 1) → total / archived / chunks / rate_limited_in_flight;
  * the ``(folder_id)`` set: ``folder_id IS NULL`` → ``root``, every other row → ``folders[id]``
    (the D-217.1-31 rule: the null-folder bucket IS Root, disambiguated from the grand total by
    ``GROUPING()``, never by the NULL alone);
  * ``(status)`` → ``status``; ``paused`` is ALWAYS 0 (R-04: not a document status);
  * ``(status, ingestion_step)`` → ``steps`` for ``processing`` rows only (IngestionTab's fold);
  * ``(source_connection_id)`` → ``connections`` with the name from the one bounded name read,
    ``None`` when no name row came back;
  * ``(doc_type)`` → ``document_types`` sorted count desc then value, capped at 200 with
    ``document_types_truncated``.
"""
from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from unittest.mock import MagicMock
from uuid import UUID

from app.api import library as library_api

F1 = "11111111-1111-4111-8111-111111111111"
F2 = "22222222-2222-4222-8222-222222222222"
C1 = "33333333-3333-4333-8333-333333333333"
C2 = "44444444-4444-4444-8444-444444444444"


def _row(*, g_f=1, g_s=1, g_i=1, g_c=1, g_t=1, folder_id=None, status=None, ingestion_step=None,
         source_connection_id=None, doc_type=None, n=0, size_bytes=0, archived=0, chunks=0,
         rate_limited=0):
    return {
        "g_f": g_f, "g_s": g_s, "g_i": g_i, "g_c": g_c, "g_t": g_t,
        "folder_id": UUID(folder_id) if folder_id else None, "status": status,
        "ingestion_step": ingestion_step,
        "source_connection_id": UUID(source_connection_id) if source_connection_id else None,
        "doc_type": doc_type, "n": n, "size_bytes": size_bytes, "archived": archived,
        "chunks": chunks, "rate_limited": rate_limited,
    }


ROWS = [
    _row(n=10, size_bytes=1000, archived=2, chunks=77, rate_limited=1),             # grand total
    _row(g_f=0, folder_id=None, n=6, size_bytes=600, archived=1, chunks=40),        # Root
    _row(g_f=0, folder_id=F1, n=3, size_bytes=300, archived=1, chunks=30),
    _row(g_f=0, folder_id=F2, n=1, size_bytes=100, archived=0, chunks=7),
    _row(g_s=0, status="completed", n=6),
    _row(g_s=0, status="processing", n=2),
    _row(g_s=0, status="pending", n=1),
    _row(g_s=0, status="failed", n=1),
    _row(g_s=0, g_i=0, status="processing", ingestion_step="embedding", n=1),
    _row(g_s=0, g_i=0, status="processing", ingestion_step="extracting", n=1),
    _row(g_s=0, g_i=0, status="completed", ingestion_step=None, n=6),               # not a step
    _row(g_s=0, g_i=0, status="pending", ingestion_step="extracting", n=1),         # not processing
    _row(g_c=0, source_connection_id=None, n=7),                                     # no connection
    _row(g_c=0, source_connection_id=C1, n=2),
    _row(g_c=0, source_connection_id=C2, n=1),
    _row(g_t=0, doc_type=None, n=4),                                                 # untyped
    _row(g_t=0, doc_type="invoice", n=3),
    _row(g_t=0, doc_type="contract", n=3),
]


def test_grand_total_and_root_and_folders_map_by_grouping_flags():
    s = library_api.fold_summary_rows(ROWS, {C1: "Drive"})
    assert (s.total, s.archived, s.chunks, s.rate_limited_in_flight) == (10, 2, 77, 1)
    assert (s.root.count, s.root.size_bytes, s.root.archived) == (6, 600, 1)
    assert set(s.folders) == {F1, F2}
    assert (s.folders[F1].count, s.folders[F1].size_bytes, s.folders[F1].archived) == (3, 300, 1)
    assert s.folders[F2].count == 1


def test_status_has_paused_zero_and_steps_are_processing_only():
    s = library_api.fold_summary_rows(ROWS, {})
    assert s.status.model_dump() == {
        "pending": 1, "processing": 2, "paused": 0, "completed": 6, "failed": 1,
    }
    assert s.steps == {"embedding": 1, "extracting": 1}


def test_connections_carry_names_and_a_missing_name_is_none():
    s = library_api.fold_summary_rows(ROWS, {C1: "Drive"})
    by_id = {c.id: c for c in s.connections}
    assert set(by_id) == {C1, C2}  # the NULL (no connection) bucket is not a connection
    assert (by_id[C1].name, by_id[C1].count) == ("Drive", 2)
    assert (by_id[C2].name, by_id[C2].count) == (None, 1)


def test_document_types_sorted_count_desc_then_value_untyped_excluded():
    s = library_api.fold_summary_rows(ROWS, {})
    assert [(t.value, t.count) for t in s.document_types] == [("contract", 3), ("invoice", 3)]
    assert s.document_types_truncated is False


def test_document_types_cap_at_200_with_truncated_flag():
    rows = [_row(n=500)] + [_row(g_t=0, doc_type=f"type-{k:03d}", n=1000 - k) for k in range(250)]
    s = library_api.fold_summary_rows(rows, {})
    assert len(s.document_types) == 200
    assert s.document_types_truncated is True
    assert s.document_types[0].value == "type-000"


def test_an_empty_library_folds_to_zeros():
    s = library_api.fold_summary_rows([_row(n=0)], {})
    assert s.total == 0 and s.root.count == 0 and s.folders == {}
    assert s.status.model_dump() == {"pending": 0, "processing": 0, "paused": 0, "completed": 0, "failed": 0}


def test_the_sql_reads_the_view_never_the_table_and_is_one_grouping_sets_scan():
    sql = library_api.LIBRARY_SUMMARY_SQL
    assert "FROM public.library_documents" in sql
    assert "FROM public.documents" not in sql
    assert sql.count("GROUPING SETS") == 1
    assert "WHERE is_latest" in sql


def test_the_route_runs_one_scan_then_one_bounded_name_read_as_the_user():
    """Drive the coroutine with a fake connection: exactly two statements, the second bounded by
    the distinct connection ids and naming only id, name (column grants)."""
    calls: list[tuple[str, tuple]] = []

    class FakeConn:
        async def fetch(self, sql, *args):
            calls.append((sql, args))
            if "GROUPING SETS" in sql:
                return ROWS
            return [{"id": UUID(C1), "name": "Drive"}]

    @asynccontextmanager
    async def fake_user_conn(request, current_user):
        assert current_user["id"] == "u-1"
        yield FakeConn()

    orig = library_api.get_user_pg_connection
    library_api.get_user_pg_connection = fake_user_conn
    try:
        out = asyncio.run(library_api.get_library_summary(MagicMock(), {"id": "u-1"}))
    finally:
        library_api.get_user_pg_connection = orig
    assert len(calls) == 2
    name_sql, name_args = calls[1]
    assert "SELECT id, name FROM public.connector_connections" in name_sql
    assert sorted(str(x) for x in name_args[0]) == sorted([C1, C2])
    assert {c.id: c.name for c in out.connections} == {C1: "Drive", C2: None}


def test_no_connection_rows_means_no_name_read():
    calls: list[str] = []

    class FakeConn:
        async def fetch(self, sql, *args):
            calls.append(sql)
            return [_row(n=0)]

    @asynccontextmanager
    async def fake_user_conn(request, current_user):
        yield FakeConn()

    orig = library_api.get_user_pg_connection
    library_api.get_user_pg_connection = fake_user_conn
    try:
        asyncio.run(library_api.get_library_summary(MagicMock(), {"id": "u-1"}))
    finally:
        library_api.get_user_pg_connection = orig
    assert len(calls) == 1


# ── Phase 298 (298-01, D-32) — the summary and its lists share ONE org predicate ──────────────

ORG_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"


def test_the_summary_narrows_with_the_same_org_predicate_as_the_lists():
    """D-32: ``GET /documents`` adds ``org_id = <active>`` to every read and the summary carries the
    same predicate, so the IngestionTab pill and its lists can never disagree. ``$1`` NULL (no org
    resolved) is today's unnarrowed scan."""
    sql = library_api.LIBRARY_SUMMARY_SQL
    assert sql.count("($1::uuid IS NULL OR org_id = $1)") == 1
    assert "WHERE is_latest AND ($1::uuid IS NULL OR org_id = $1)" in sql


def _drive_summary(monkeypatch, resolved):
    calls: list[tuple[str, tuple]] = []

    class FakeConn:
        async def fetch(self, sql, *args):
            calls.append((sql, args))
            return [_row(n=0)]

    @asynccontextmanager
    async def fake_user_conn(request, current_user):
        yield FakeConn()

    async def fake_resolve(request, current_user):
        return resolved

    monkeypatch.setattr(library_api, "get_user_pg_connection", fake_user_conn)
    monkeypatch.setattr("app.services.org_lists.resolve_active_org_or_none", fake_resolve)
    asyncio.run(library_api.get_library_summary(MagicMock(), {"id": "u-1"}))
    return calls


def test_the_summary_scan_binds_the_resolved_org(monkeypatch):
    calls = _drive_summary(monkeypatch, ORG_A)
    assert len(calls) == 1
    assert calls[0][1] == (UUID(ORG_A),)


def test_the_summary_scan_binds_null_when_no_org_resolves(monkeypatch):
    calls = _drive_summary(monkeypatch, None)
    assert len(calls) == 1
    assert calls[0][1] == (None,)
