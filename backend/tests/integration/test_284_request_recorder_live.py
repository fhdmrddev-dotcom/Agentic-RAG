"""Phase 284 (FIX-11, D-23 layer 2 / T-284-30) — the request recorder LIVE, against the seeded
50,000-document scale account, through REAL GoTrue JWTs and REAL PostgREST.

The unit twin (``tests/unit/test_284_request_recorder.py``) pins the detector and drives the
handlers over canned bodies. Here the SAME detector runs over what the handlers send to the real
local stack: ``app.dependencies._shared_httpx`` — the ONE transport every user-JWT client shares —
is replaced by a real ``httpx.Client`` whose request hook records every request, and the user
client is built by ``get_user_supabase`` itself, exactly as a request would build it.

Driven as the owner (50,000 + 20): ``GET /documents`` for Root, the Big folder's first and LAST
page and the whole library; ``POST /document-search`` (empty and by name); a saved view's resolve
and the ad-hoc resolve (page + count); the 2,500-chunk document's ``/chunks``. Each handler's
requests must carry ZERO violations and the largest ``in.()`` list must not exceed that handler's
page limit. ``GET /library/summary`` is asyncpg — its SQL text is captured through a wrapped
connection and must read ``library_documents`` with no ``ANY($…)`` over document ids.

Local stack only; unreachable / unseeded → SKIP. It writes ONE throwaway ``document_views`` row
(deleted in ``finally``). ⛔ Run under the local-DB lock.
"""
from __future__ import annotations

import asyncio
import json
from contextlib import asynccontextmanager
from unittest.mock import MagicMock
from uuid import UUID, uuid4

import httpx
import pytest
import pytest_asyncio

try:
    import asyncpg
except ImportError:  # pragma: no cover
    asyncpg = None

from tests.integration._271_gotrue_users import require_gotrue
from tests.integration._284_scale_account import (
    BIG_FOLDER_NAME,
    CHUNKY_FILENAME,
    SCALE_OWNER_EMAIL,
    _local_env,
    sign_in,
    uid_for_email,
)
from tests.unit.test_284_request_recorder import DOC_TABLES, largest_in_list, violations

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


@pytest_asyncio.fixture
async def world(monkeypatch):
    require_gotrue()
    import app.dependencies as deps

    # The unit conftest points `settings` at a placeholder project; the live client must reach the
    # LOCAL stack, so the two values get_user_supabase reads come from backend/.env (the shape
    # `_271_gotrue_users.user_client` uses). Nothing else about the production build changes.
    env = _local_env()
    monkeypatch.setattr(deps.settings, "supabase_url", env["SUPABASE_URL"])
    monkeypatch.setattr(deps.settings, "supabase_anon_key", env["SUPABASE_ANON_KEY"])

    seen: list[httpx.Request] = []
    transport = httpx.Client(event_hooks={"request": [seen.append]})
    monkeypatch.setattr(deps, "_shared_httpx", transport)

    c = await asyncpg.connect(DSN)
    view_id = uuid4()
    try:
        owner = await uid_for_email(c, SCALE_OWNER_EMAIL)
        if owner is None:
            pytest.skip("the scale account is not seeded (run scripts/seed-scale-284.py)")
        o = UUID(owner)
        latest = await c.fetchval("SELECT count(*) FROM documents WHERE user_id=$1 AND is_latest", o)
        if latest < 50_000:
            pytest.skip(f"the scale account holds {latest} latest documents, not the 50,000 shape")
        big = await c.fetchval("SELECT id FROM folders WHERE user_id=$1 AND name=$2", o, BIG_FOLDER_NAME)
        org = await c.fetchval("SELECT org_id FROM folders WHERE id=$1", big)
        truth = {
            "big_all": await c.fetchval(
                "SELECT count(*) FROM documents WHERE user_id=$1 AND is_latest AND folder_id=$2", o, big),
            "chunky": str(await c.fetchval(
                "SELECT id FROM documents WHERE user_id=$1 AND filename=$2", o, CHUNKY_FILENAME)),
            "named": await c.fetchval(
                "SELECT filename FROM documents WHERE folder_id=$1 AND is_latest "
                "ORDER BY filename LIMIT 1 OFFSET 7", big),
        }
        await c.execute(
            "INSERT INTO public.document_views (id, user_id, org_id, name, filter_expr, folder_scope) "
            "VALUES ($1, $2, $3, $4, $5::jsonb, $6)",
            view_id, o, org, f"284-05 recorder {view_id.hex[:8]}",
            json.dumps({"op": "and", "conditions": []}), big,
        )
        sb = deps.get_user_supabase(None, {"id": owner}, sign_in(SCALE_OWNER_EMAIL))
        yield {"owner": owner, "big": str(big), "view_id": str(view_id), "truth": truth,
               "sb": sb, "seen": seen}
    finally:
        await c.execute("DELETE FROM public.document_views WHERE id = $1", view_id)
        await c.close()
        transport.close()


def _check(w, label: str, page_limit: int) -> int:
    """Assert the requests recorded since the last check are clean; return their largest in.()."""
    batch = list(w["seen"])
    w["seen"].clear()
    rest = [r for r in batch if "/rest/v1/" in str(r.url)]
    assert rest, f"{label}: non-vacuity — the handler sent no PostgREST request through the recorder"
    assert violations(rest, page_limit) == [], label
    biggest = largest_in_list(rest)
    assert biggest <= page_limit, f"{label}: an in.() list of {biggest} > {page_limit}"
    print(f"[284-05] {label}: {len(rest)} request(s), largest in.() = {biggest}")
    return biggest


async def test_every_library_read_is_bounded_at_50k(world):
    from app.api.document_views import resolve_adhoc, resolve_view
    from app.api.documents import list_document_chunks, list_documents
    from app.models.document_search import DocumentSearchRequest
    from app.models.document_view import AdHocResolve
    from app.services.document_search_service import search_documents

    w, user = world, {"id": world["owner"]}
    sizes = {}

    async def _list(**kw):
        args = dict(limit=25, offset=0, folder_id=None, include_archived=False, status_=None,
                    order="created_desc", kind=None)
        args.update(kw)
        return await list_documents(**args, current_user=user, supabase=w["sb"])

    page = await _list(folder_id="root")
    assert page["total"] > 1_000 and len(page["documents"]) == 25
    sizes["list root"] = _check(w, "GET /documents root", 25)

    first = await _list(folder_id=w["big"], limit=200, include_archived=True)
    assert first["total"] == w["truth"]["big_all"]
    sizes["list big first"] = _check(w, "GET /documents Big page 1", 200)

    last_offset = (w["truth"]["big_all"] - 1) // 200 * 200
    last = await _list(folder_id=w["big"], limit=200, offset=last_offset, include_archived=True)
    assert len(last["documents"]) == w["truth"]["big_all"] - last_offset
    sizes["list big last"] = _check(w, "GET /documents Big LAST page", 200)

    everything = await _list(include_archived=True)
    assert everything["total"] >= 50_000
    sizes["list all"] = _check(w, "GET /documents whole library", 25)

    found = await search_documents(caller=w["owner"], req=DocumentSearchRequest(), supabase=w["sb"])
    assert found["total"] >= 49_000 and len(found["documents"]) == 25
    sizes["find empty"] = _check(w, "POST /document-search (empty)", 25)

    fragment = w["truth"]["named"].rsplit(".", 1)[0][-10:]
    named = await search_documents(caller=w["owner"], req=DocumentSearchRequest(name=fragment),
                                   supabase=w["sb"])
    assert named["total"] >= 1
    sizes["find name"] = _check(w, "POST /document-search (name)", 25)

    view = await resolve_view(w["view_id"], count_only=False, offset=0, limit=200,
                              include_archived=True, current_user=user, supabase=w["sb"])
    assert view["total"] == w["truth"]["big_all"]
    count = await resolve_view(w["view_id"], count_only=True, offset=0, limit=25,
                               include_archived=True, current_user=user, supabase=w["sb"])
    assert count == {"total": w["truth"]["big_all"]}
    sizes["resolve view"] = _check(w, "GET /document-views/{id}/resolve", 200)

    adhoc = await resolve_adhoc(
        AdHocResolve(filter_expr={"op": "and", "conditions": []}, offset=49_000, limit=200),
        current_user=user, supabase=w["sb"])
    assert adhoc["total"] >= 50_000 and adhoc["documents"]
    sizes["resolve adhoc"] = _check(w, "POST /document-views/resolve", 200)

    chunks = await list_document_chunks(w["truth"]["chunky"], limit=200, offset=0,
                                        current_user=user, supabase=w["sb"])
    assert chunks["total"] == 2_500 and len(chunks["chunks"]) == 200
    sizes["chunks"] = _check(w, "GET /documents/{id}/chunks", 200)

    print(f"[284-05] largest in.() per handler: {sizes}; overall max = {max(sizes.values())}")


async def test_the_summary_sql_reads_the_view_and_sends_no_id_list(world):
    from app.api import library as library_api
    from app.dependencies import _apply_rls_user_context

    sql_seen: list[tuple[str, tuple]] = []

    class _Recording:
        def __init__(self, conn):
            self._conn = conn

        async def fetch(self, sql, *args):
            sql_seen.append((sql, args))
            return await self._conn.fetch(sql, *args)

    async def _init(conn):
        await conn.set_type_codec("jsonb", encoder=json.dumps, decoder=json.loads, schema="pg_catalog")

    pool = await asyncpg.create_pool(DSN, min_size=1, max_size=2, init=_init)

    @asynccontextmanager
    async def _user_conn(request, current_user):
        async with pool.acquire() as conn:
            async with conn.transaction():
                await _apply_rls_user_context(conn, current_user["id"])
                yield _Recording(conn)

    orig = library_api.get_user_pg_connection
    library_api.get_user_pg_connection = _user_conn
    try:
        out = await library_api.get_library_summary(MagicMock(), {"id": world["owner"]})
    finally:
        library_api.get_user_pg_connection = orig
        await pool.close()

    assert out.total >= 50_000
    assert sql_seen and "public.library_documents" in sql_seen[0][0]
    for sql, args in sql_seen:
        reads_docs = any(f"public.{t}" in sql for t in DOC_TABLES)
        assert not (reads_docs and "ANY($" in sql), sql
    print(f"[284-05] summary: {len(sql_seen)} statement(s); "
          f"params per statement = {[len(a[0]) if a else 0 for _s, a in sql_seen]}")
