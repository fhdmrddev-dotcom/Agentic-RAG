"""Phase 284 (284-04 Task 1 — FIX-11; D-14, D-18, R-11, R-12) — Find pages in SQL over the view.

Before 284, ``search_documents`` read EVERY match (two caller-scoped legs, each walked 1,000 rows
at a time with ``.range()``), sorted them in Python, sliced the page in Python, and then read the
lineage of the page (or of every candidate, for "Has earlier versions") 100 filenames at a time.
At 50,000 documents page 1 took 16.9 s (284-MEASUREMENTS.md).

Migration 207's ``public.library_documents`` view holds the visible-set union, ``version_count``
and ``has_earlier`` in SQL, so Find is now ONE builder:

    structure(supabase.table("library_documents").select(FIND_SELECT, count="exact"))
      .order(col, desc=…, nullsfirst=False).order("id").range(offset, offset + limit - 1)

These cases pin that shape on the in-memory PostgREST shared with the 271 suites (extended, not
forked — it derives the view from its ``documents`` fixture the way the SQL does):

  * exactly ONE row read on the view, ``count="exact"``, ranged to the page — and no read of
    ``documents`` at all for an ordinary search;
  * ``older_matches`` is a ``count="exact"`` HEAD read (``select("id")`` + ``limit(1)``), never rows;
  * the connection-name read is bounded by the page;
  * version states, every sort and its ``nullslast`` + ``id`` tiebreak, the exact total above
    ``max_rows``, the select list (no ``full_markdown``, no ``*``, exactly the view's columns);
  * the deleted machinery stays deleted (a source fence over the module);
  * a relationship allow-list above ``REL_EDGE_CAP`` edges FAILS LOUD instead of being cut at 1,000.

Imports of the service are inside the test bodies so RED is a per-test failure, never a
collection error.
"""

from __future__ import annotations

import inspect
import pathlib
import re

import pytest

from tests.unit.test_271_search_core import (
    CALLER,
    CONN,
    G1,
    OTHER,
    RESULT_KEYS,
    VIEW,
    FakePostgrest,
    doc,
    ids,
    patched,  # noqa: F401 — the shared seam-patching fixture
    run,
)

_REPO = pathlib.Path(__file__).resolve().parents[3]
_MIGRATION_207 = _REPO / "supabase" / "migrations" / "207_library_documents_view.sql"


def _view_reads(client):
    return [q for q in client.queries if q.table == VIEW]


# ─────────────────────────────── one ranged read ───────────────────────────────


@pytest.mark.asyncio
async def test_a_search_is_one_ranged_count_exact_read_of_the_view(patched):
    from app.services.document_search_service import FIND_SELECT

    patched["global"] = [G1]
    rows = [doc(f"id-{i:02d}", created_at=f"2024-02-{i + 1:02d}T00:00:00+00:00") for i in range(12)]
    rows.append(doc("theirs", user_id=OTHER, folder_id=G1))
    client = FakePostgrest({"documents": rows})
    out = await run(client, offset=5, limit=4)

    reads = _view_reads(client)
    assert len(reads) == 1, [q.calls for q in reads]
    (read,) = reads
    assert read.cols == FIND_SELECT
    assert read.count_mode == "exact"
    assert read._range == (5, 8)
    assert ("eq", "is_latest", True) in read.calls
    assert ("is_", "archived_at", "null") in read.calls
    # An ordinary search never reads the base table: no candidate walk, no lineage, no re-read.
    assert [q for q in client.queries if q.table == "documents"] == []
    assert out["total"] == 13
    assert len(out["documents"]) == 4
    assert set(out) == RESULT_KEYS


@pytest.mark.asyncio
async def test_the_connection_name_read_is_bounded_by_the_page(patched):
    rows = [doc(f"c-{i:02d}", source_connection_id=CONN,
                created_at=f"2024-03-{i + 1:02d}T00:00:00+00:00") for i in range(30)]
    client = FakePostgrest({"documents": rows,
                            "connector_connections": [{"id": CONN, "name": "Drive"}]})
    out = await run(client, limit=10)
    conn_reads = [q for q in client.queries if q.table == "connector_connections"]
    assert len(conn_reads) == 1
    (ids_in,) = [c for c in conn_reads[0].calls if c[0] == "in_"]
    assert len(ids_in[2]) <= 10
    assert all(d["source_connection_name"] == "Drive" for d in out["documents"])


@pytest.mark.asyncio
async def test_version_has_earlier_is_a_column_filter(patched):
    rows = [doc("a1", filename="A.pdf", version_number=1, is_latest=False),
            doc("a2", filename="A.pdf", version_number=2, is_latest=True),
            doc("b1", filename="B.pdf")]
    client = FakePostgrest({"documents": rows})
    out = await run(client, version="has_earlier")
    (read,) = _view_reads(client)
    assert ("eq", "has_earlier", True) in read.calls
    assert ("eq", "is_latest", True) in read.calls
    assert ids(out) == ["a2"]
    assert out["total"] == 1


@pytest.mark.asyncio
async def test_version_older_is_own_only(patched):
    patched["global"] = [G1]
    rows = [doc("a1", filename="A.pdf", version_number=1, is_latest=False),
            doc("a2", filename="A.pdf", version_number=2, is_latest=True),
            doc("x1", user_id=OTHER, filename="X.pdf", folder_id=G1, version_number=1, is_latest=False),
            doc("x2", user_id=OTHER, filename="X.pdf", folder_id=G1, version_number=2, is_latest=True)]
    client = FakePostgrest({"documents": rows})
    out = await run(client, version="older")
    (read,) = _view_reads(client)
    assert ("eq", "user_id", CALLER) in read.calls  # P-03: a colleague's old versions never show
    assert ("eq", "is_latest", False) in read.calls
    assert ids(out) == ["a1"]


@pytest.mark.parametrize(
    "sort,col,desc",
    [
        ("added_desc", "created_at", True),
        ("added_asc", "created_at", False),
        ("document_date_desc", "date_typed", True),
        ("source_modified_desc", "source_modified_at", True),
        ("source_created_desc", "source_created_at", True),
        ("name_asc", "filename_key", False),
    ],
)
@pytest.mark.asyncio
async def test_each_sort_orders_in_sql_nulls_last_then_id(patched, sort, col, desc):
    client = FakePostgrest({"documents": [doc("x")]})
    await run(client, sort=sort)
    (read,) = _view_reads(client)
    assert read.orders == [(col, desc, False), ("id", False, None)]


@pytest.mark.asyncio
async def test_the_total_is_exact_above_max_rows_and_a_deep_page_is_right(patched):
    rows = [doc(f"id-{i:04d}", created_at=f"2020-01-01T00:00:{i % 60:02d}+00:00")
            for i in range(1500)]
    # created_at repeats every 60 rows, so most of the order is decided by the id tiebreak.
    client = FakePostgrest({"documents": rows}, max_rows=1000)
    out = await run(client, offset=1400, limit=100)
    assert out["total"] == 1500
    expected = sorted(rows, key=lambda r: r["id"])
    expected.sort(key=lambda r: r["created_at"], reverse=True)
    assert ids(out) == [r["id"] for r in expected[1400:1500]]
    (read,) = _view_reads(client)
    assert read._range == (1400, 1499)


def test_the_select_list_is_exactly_the_view_columns_with_no_markdown_and_no_star():
    from app.services.document_search_service import FIND_SELECT

    cols = [c.strip() for c in FIND_SELECT.split(",")]
    assert "*" not in FIND_SELECT
    assert "full_markdown" not in cols
    assert {"version_count", "has_earlier"} <= set(cols)
    assert len(cols) == len(set(cols))

    # The view's column list, read from migration 207 itself (so the two can never drift apart).
    sql = _MIGRATION_207.read_text(encoding="utf-8").replace("\r\n", "\n")
    body = sql.split("CREATE OR REPLACE VIEW public.library_documents", 1)[1].split("FROM public.documents d\nWHERE", 1)[0]
    view_cols = set(re.findall(r"^\s*d\.([a-z_]+),?\s*$", body, flags=re.M))
    view_cols |= set(re.findall(r"\bAS ([a-z_]+)", body))
    assert len(view_cols) > 30, "the migration parse collapsed"
    # Every view column is selected except the sort key (ordered by, never returned).
    assert set(cols) == view_cols - {"filename_key"}


# ─────────────────────────────── older_matches ───────────────────────────────


@pytest.mark.asyncio
async def test_older_matches_is_one_count_exact_head_read(patched):
    from tests.unit.test_271_relationship_filter import P2, _graph

    client = _graph()
    out = await run(client, relationship={"verb": "supersedes", "document_id": P2})
    heads = [q for q in _view_reads(client) if q.cols == "id"]
    assert len(heads) == 1
    (head,) = heads
    assert head.count_mode == "exact"
    assert head._limit == 1
    assert ("eq", "is_latest", False) in head.calls
    assert ("eq", "user_id", CALLER) in head.calls
    assert out["older_matches"] == 1


# ─────────────────────────────── the deleted machinery ───────────────────────────────


def test_the_candidate_walk_sort_slice_and_lineage_reads_are_gone():
    import app.services.document_search_service as svc

    src = inspect.getsource(svc)
    for name in ("_fetch_all", "_sort_rows", "_lineage_rows", "_lineage_facts", "_LINEAGE_BATCH",
                 "_PAGE = 1000", "_candidates", "_hydrate"):
        assert name not in src, name
    assert "ordered[" not in src, "a Python page slice is back"
    assert 'table("library_documents")' in src
    assert 'table("documents").select("*")' not in src


def test_the_zero_result_keys_are_unchanged():
    from app.models.document_search import DocumentSearchRequest
    from app.services.document_search_service import _zero_result

    assert set(_zero_result(DocumentSearchRequest())) == RESULT_KEYS


# ─────────────────────────────── a hub document fails loud ───────────────────────────────


@pytest.mark.asyncio
async def test_a_relationship_above_the_edge_cap_fails_loud(patched):
    from app.services.document_search_service import REL_EDGE_CAP, SearchTruncatedError

    assert REL_EDGE_CAP == 100  # 284-REVIEW WR-02: below the measured 8 KB request-line bound
    hub = "eeeeeeee-0000-4000-8000-000000000000"
    sources = [f"eeeeeeee-0000-4000-8000-{i:012d}" for i in range(1, REL_EDGE_CAP + 2)]
    documents = [doc(hub, filename="hub.pdf")] + [doc(s, filename=f"{s}.pdf") for s in sources]
    edges = [{"source_doc_id": s, "target_doc_id": hub, "rel_type": "references", "user_id": CALLER}
             for s in sources]
    client = FakePostgrest({"documents": documents, "document_relationships": edges})
    with pytest.raises(SearchTruncatedError) as ei:
        await run(client, relationship={"verb": "references", "document_id": hub})
    assert ei.value.status == 503
    (edge_read,) = [q for q in client.queries if q.table == "document_relationships"]
    assert edge_read._limit == REL_EDGE_CAP + 1, "the edge read must be bounded, never unranged"


@pytest.mark.asyncio
async def test_a_relationship_at_the_edge_cap_still_answers(patched):
    from app.services.document_search_service import REL_EDGE_CAP

    hub = "eeeeeeee-0000-4000-8000-000000000000"
    sources = [f"eeeeeeee-0000-4000-8000-{i:012d}" for i in range(1, REL_EDGE_CAP + 1)]
    documents = [doc(hub, filename="hub.pdf")] + [doc(s, filename=f"{s}.pdf") for s in sources]
    edges = [{"source_doc_id": s, "target_doc_id": hub, "rel_type": "references", "user_id": CALLER}
             for s in sources]
    client = FakePostgrest({"documents": documents, "document_relationships": edges})
    out = await run(client, relationship={"verb": "references", "document_id": hub}, limit=100)
    assert out["total"] == REL_EDGE_CAP
