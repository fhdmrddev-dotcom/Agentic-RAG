"""284-REVIEW WR-02 — the relationship allow-list cap sits BELOW the measured URL bound.

The relationship filter sends its allow-list in URLs: the endpoints read (``in.(ids)``) and the
page read itself (``_apply_ids``). The gateway refuses a request line over 8 KB with 414 "URI too
long", which postgrest-py raises and the route turned into a 500 — instead of the promised worded
503 (``SearchTruncatedError``).

Measured, not assumed:
  * BUG-261014-06 (cloud): an ``in.()`` of 286 ids → 414; 182 ids → 200.
  * 2026-10-16 (local Kong, this fix): a ``select=id`` read with 208 ids (path+query 8,172
    chars) → 200; 209 ids (8,211 chars) → 414. The bound is the 8,192-byte request line.
  * the FIND page read carries ``FIND_SELECT`` (~800 chars) and every filter, so with the cap at
    500 it was ~20 KB; at 200 it is ~8.5 KB — STILL over the bound. At 100 it is ~4.6 KB.

So ``REL_EDGE_CAP`` is 100, and every URL the allow-list path builds is pinned here, with the REAL
postgrest-py builder and httpx's own encoding, to fit inside a 6,144-byte budget — 2 KB of the
8 KB bound left for the request's other filters (name, folder subtree, dates).
"""
from __future__ import annotations

import uuid

import httpx
import pytest
from postgrest import SyncPostgrestClient

from tests.unit.test_271_search_core import CALLER, FakePostgrest, doc, patched, run  # noqa: F401

#: The bound measured above (bytes in "GET <path?query> HTTP/1.1"), and the budget the
#: allow-list path must fit — leaving 2 KB for everything else a Find request may carry.
REQUEST_LINE_BOUND = 8192
URL_BUDGET = 6144


def _request_line(q) -> int:
    url = httpx.URL("/rest/v1/" + str(q.request.path).lstrip("/"), params=q.request.params)
    return len("GET ") + len(str(url.raw_path, "ascii")) + len(" HTTP/1.1")


def _ids(n: int) -> list[str]:
    return sorted(str(uuid.uuid4()) for _ in range(n))


def test_the_cap_is_below_the_measured_bound():
    from app.services.document_search_service import REL_EDGE_CAP

    assert REL_EDGE_CAP == 100


def test_the_page_read_at_the_cap_fits_the_url_budget():
    """The FIND page read with REL_EDGE_CAP ids — built by the real ``_find_query``."""
    from app.models.document_search import DocumentSearchRequest
    from app.services.document_search_service import FIND_SELECT, REL_EDGE_CAP, _find_query

    client = SyncPostgrestClient("http://127.0.0.1:54321/rest/v1")
    req = DocumentSearchRequest(name="quarterly report", include_archived=False)
    q = _find_query(
        client.from_("library_documents").select(FIND_SELECT, count="exact"),
        caller=CALLER, req=req, version="latest", fragments=[], folder_ids=None,
        id_allow=set(_ids(REL_EDGE_CAP)),
    ).order("created_at", desc=True, nullsfirst=False).order("id").range(0, 24)
    line = _request_line(q)
    assert line <= URL_BUDGET, f"page read at the cap is {line} bytes (budget {URL_BUDGET})"


def test_the_endpoints_read_at_the_cap_fits_the_url_budget():
    from app.services.document_search_service import REL_EDGE_CAP

    client = SyncPostgrestClient("http://127.0.0.1:54321/rest/v1")
    q = client.from_("documents").select("id,user_id,filename,is_latest").in_("id", _ids(REL_EDGE_CAP))
    assert _request_line(q) <= URL_BUDGET


@pytest.mark.asyncio
async def test_long_stale_filenames_are_followed_in_batches_under_the_budget(patched):  # noqa: F811
    """The follow-to-latest read puts FILENAMES in the URL. A hub at the cap whose endpoints are
    all older versions with long names must still be read in batches that each fit."""
    from app.services.document_search_service import REL_EDGE_CAP, _pg_in_list

    hub = "eeeeeeee-0000-4000-8000-000000000000"
    rows, edges = [doc(hub, filename="hub.pdf")], []
    for i in range(REL_EDGE_CAP):
        name = f"{i:03d}-" + "a-very-long-contract-file-name-" * 7 + ".pdf"  # ~225 chars
        old = f"eeeeeeee-0000-4000-8000-{i + 1:012d}"
        new = f"ffffffff-0000-4000-8000-{i + 1:012d}"
        rows += [doc(old, filename=name, is_latest=False, version_number=1),
                 doc(new, filename=name, is_latest=True, version_number=2)]
        edges.append({"source_doc_id": old, "target_doc_id": hub, "rel_type": "references",
                      "user_id": CALLER})
    client = FakePostgrest({"documents": rows, "document_relationships": edges})
    out = await run(client, relationship={"verb": "references", "document_id": hub}, limit=100)
    assert out["total"] == REL_EDGE_CAP, "every stale endpoint still follows to its latest row"

    by_name = [q for q in client.queries if q.table == "documents"
               and any(c[0] == "in_" and c[1] == "filename" for c in q.calls)]
    assert len(by_name) > 1, "the follow-to-latest read must be batched"
    for q in by_name:
        (names,) = [c[2] for c in q.calls if c[0] == "in_" and c[1] == "filename"]
        encoded = len(str(httpx.URL("/x", params={"filename": "in." + _pg_in_list(names)}).raw_path, "ascii"))
        assert encoded <= URL_BUDGET // 2, f"one filename batch is {encoded} bytes"
