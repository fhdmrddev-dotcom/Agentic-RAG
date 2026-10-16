"""284-REVIEW CR-01 — an offset past the end is an EMPTY PAGE with the exact total, never a 500. LIVE.

PostgREST answers a ``count=exact`` read whose offset is greater than the total with
**416 / PGRST103** ("Requested range not satisfiable"), and postgrest-py raises ``APIError`` on any
non-2xx answer. Every paged Library read since 284 is ``count="exact"`` + ``.range(...)``, so a list
that shrank under an open page (Include archived turned off on page 3, a Realtime DELETE, a
re-chunk while Chunks is scrolled) became a 500 — and "Try again" re-asked the same impossible page.

This suite drives each paged route coroutine in-process with a REAL signed-in user's client
(GoTrue JWT + anon key — the ``get_user_supabase_client`` shape, RLS enforced as
``authenticated``), against the local stack:

  (0) CHARACTERISATION — PostgREST itself: ``offset > total`` raises ``APIError`` code
      ``PGRST103``; ``offset == total`` is a 200 with no rows. This is the behaviour the routes must
      absorb, proven rather than read from documentation (the review could not drive it).
  (1) ``GET /documents`` — the browse list, including the review's exact path (include_archived
      turned off while on a page that only existed with it on);
  (2) ``GET /documents/{id}/versions`` · ``/chunks`` · ``/tables`` · ``/images``;
  (3) ``GET /document-views/{id}/resolve`` and ``POST /document-views/resolve``;
  (4) ``POST /document-search``.

Each answers ``{<rows>: [], total: <exact>, offset, limit}``. Local stack only (unreachable → SKIP).
Writes throwaway rows for throwaway users only, removed by ``RouteUsers.drop_all``.
⛔ Run under the local-DB lock (worktree rule 4).
"""
from __future__ import annotations

import asyncio
import json
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

import pytest
import pytest_asyncio

try:
    import asyncpg
except ImportError:  # pragma: no cover
    asyncpg = None

from tests.integration._284_route_users import RouteUsers

DSN = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"


def _pg_ok() -> bool:
    if asyncpg is None:
        return False

    async def _probe():
        c = await asyncio.wait_for(asyncpg.connect(DSN), timeout=2.0)
        await c.close()

    try:
        asyncio.run(_probe())
        return True
    except Exception:
        return False


pytestmark = pytest.mark.skipif(not _pg_ok(), reason=f"local Postgres not reachable at {DSN}")

#: The user's documents: 4 latest (2 of them archived) + 1 older version of the first one.
LATEST = 4
UNARCHIVED = 2


@pytest_asyncio.fixture
async def world():
    async def _init(conn):
        await conn.set_type_codec("jsonb", encoder=json.dumps, decoder=json.loads, schema="pg_catalog")

    pool = await asyncpg.create_pool(DSN, min_size=1, max_size=4, init=_init)
    users = RouteUsers(pool)
    try:
        try:
            uid = await users.create("cr01")
        except Exception as e:  # noqa: BLE001
            pytest.skip(f"GoTrue user setup failed: {type(e).__name__}: {e}")
        org = await users.personal_org(uid)
        base = datetime(2025, 9, 1, tzinfo=timezone.utc)
        docs: list[UUID] = []
        for i in range(LATEST):
            doc = uuid4()
            await pool.execute(
                "INSERT INTO documents (id, user_id, filename, file_path, file_size, mime_type, status, "
                "metadata, created_at, is_latest, version_number, archived_at) "
                "VALUES ($1,$2,$3,$4,100,'text/plain','completed',$5,$6,true,2,$7)",
                doc, uid, f"cr01-{i}.txt", f"{uid}/{doc}.txt", {"title": f"cr01 {i}"},
                base + timedelta(seconds=i), base if i >= UNARCHIVED else None,
            )
            docs.append(doc)
        older = uuid4()
        await pool.execute(
            "INSERT INTO documents (id, user_id, filename, file_path, file_size, mime_type, status, "
            "metadata, created_at, is_latest, version_number) "
            "VALUES ($1,$2,'cr01-0.txt',$3,100,'text/plain','completed','{}'::jsonb,$4,false,1)",
            older, uid, f"{uid}/{older}.txt", base - timedelta(days=1),
        )
        subject = docs[0]
        for i in range(2):
            await pool.execute(
                "INSERT INTO document_chunks (id, document_id, user_id, org_id, content, chunk_index) "
                "VALUES ($1,$2,$3,$4,$5,$6)", uuid4(), subject, uid, org, f"cr01 chunk {i}", i,
            )
            await pool.execute(
                "INSERT INTO document_tables (id, document_id, user_id, org_id, table_index) "
                "VALUES ($1,$2,$3,$4,$5)", uuid4(), subject, uid, org, i,
            )
            await pool.execute(
                "INSERT INTO document_images (id, document_id, user_id, org_id, image_index) "
                "VALUES ($1,$2,$3,$4,$5)", uuid4(), subject, uid, org, i,
            )
        view_id = uuid4()
        await pool.execute(
            "INSERT INTO public.document_views (id, user_id, org_id, name, filter_expr) "
            "VALUES ($1,$2,$3,$4,$5)",
            view_id, uid, org, f"cr01 {view_id.hex[:8]}", {"op": "and", "conditions": []},
        )
        yield {"uid": str(uid), "sb": users.client(uid), "subject": str(subject),
               "view_id": str(view_id)}
    finally:
        await users.drop_all()
        await pool.close()


def _who(w):
    return {"current_user": {"id": w["uid"]}, "supabase": w["sb"]}


# ── (0) PostgREST itself ─────────────────────────────────────────────────────────────────────


async def test_postgrest_answers_416_pgrst103_past_the_end_and_200_at_the_end(world):
    from postgrest.exceptions import APIError

    q = lambda: world["sb"].table("library_documents").select("id", count="exact").eq("is_latest", True)  # noqa: E731
    with pytest.raises(APIError) as exc:
        q().range(LATEST + 5, LATEST + 9).execute()
    assert exc.value.code == "PGRST103", exc.value.json()
    at_end = q().range(LATEST, LATEST + 4).execute()
    assert at_end.data == [] and at_end.count == LATEST


# ── (1) the browse list ──────────────────────────────────────────────────────────────────────


async def _list(w, **kw):
    from app.api.documents import list_documents

    args = dict(limit=25, offset=0, folder_id=None, include_archived=False, status_=None,
                order="created_desc", kind=None)
    args.update(kw)
    return await list_documents(**args, **_who(w))


async def test_browse_past_the_end_is_an_empty_page_with_the_exact_total(world):
    page = await _list(world, offset=50, include_archived=True)
    assert page == {"documents": [], "total": LATEST, "offset": 50, "limit": 25}


async def test_turning_include_archived_off_on_a_deep_page_is_not_a_500(world):
    """The review's deterministic path: page 2 at limit 3 exists only with archived included."""
    on = await _list(world, offset=3, limit=3, include_archived=True)
    assert on["total"] == LATEST and len(on["documents"]) == LATEST - 3
    off = await _list(world, offset=3, limit=3, include_archived=False)
    assert off == {"documents": [], "total": UNARCHIVED, "offset": 3, "limit": 3}


# ── (2) the per-document lists ───────────────────────────────────────────────────────────────


async def test_versions_chunks_tables_images_past_the_end(world):
    from app.api.documents import (
        list_document_chunks,
        list_document_images,
        list_document_tables,
        list_document_versions,
    )

    doc = world["subject"]
    versions = await list_document_versions(document_id=doc, limit=50, offset=10, **_who(world))
    assert versions == {"versions": [], "total": 2, "offset": 10, "limit": 50}
    chunks = await list_document_chunks(document_id=doc, limit=200, offset=10, **_who(world))
    assert chunks == {"chunks": [], "total": 2, "offset": 10, "limit": 200}
    tables = await list_document_tables(document_id=doc, limit=50, offset=10, **_who(world))
    assert tables == {"tables": [], "total": 2, "offset": 10, "limit": 50}
    images = await list_document_images(document_id=doc, limit=100, offset=10, **_who(world))
    assert images == {"images": [], "total": 2, "offset": 10, "limit": 100}


# ── (3) saved view + ad-hoc resolve ──────────────────────────────────────────────────────────


async def test_view_resolve_and_adhoc_resolve_past_the_end(world):
    from app.api.document_views import resolve_adhoc, resolve_view
    from app.models.document_view import AdHocResolve, ViewFilter

    saved = await resolve_view(view_id=world["view_id"], count_only=False, offset=40, limit=25,
                               include_archived=True, **_who(world))
    assert saved == {"documents": [], "total": LATEST, "offset": 40, "limit": 25}
    adhoc = await resolve_adhoc(
        body=AdHocResolve(filter_expr=ViewFilter(op="and", conditions=[]), offset=40, limit=25,
                          include_archived=False),
        **_who(world),
    )
    assert adhoc == {"documents": [], "total": UNARCHIVED, "offset": 40, "limit": 25}


# ── (4) Find ─────────────────────────────────────────────────────────────────────────────────


async def test_document_search_past_the_end(world):
    from app.api.document_search import search
    from app.models.document_search import DocumentSearchRequest

    out = await search(body=DocumentSearchRequest(offset=30, limit=25, include_archived=True),
                       **_who(world))
    assert out["documents"] == [] and out["total"] == LATEST
    assert (out["offset"], out["limit"]) == (30, 25)
