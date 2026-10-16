"""Phase 284 (SC#1 / SC#2 / D-03 / D-11 / D-17 / D-18) — the paged list LIVE, as the seeded
scale account, through REAL GoTrue JWTs and REAL PostgREST (RLS enforced as ``authenticated``).

The route coroutines are driven in-process with a real user client (the
``test_271_search_live.py`` shape: ``supabase=user_client(token)``), so every read is the one
production makes; the ground truth is read as ``postgres`` from ``public.documents`` directly.

  * Root ``total`` == ``count(*)`` of the owner's latest Root documents under the SAME predicate
    (archived hidden by default; ``include_archived`` counts every one);
  * the Big folder's ``total`` == its ``count(*)``, and WALKING EVERY PAGE at ``limit=200``
    returns exactly the DB id set, no duplicates, the last row the oldest by ``created_at, id``
    — every one of more than 1,000 documents is reachable (SC#2);
  * the peer: ``total == 20`` and a 404 for one of the owner's private documents (D-18);
  * ``/chunks`` of the 2,500-chunk document reports ``total == 2500`` and pages 200 at a time;
  * a seeded document's ``table_count`` equals its ``document_tables`` count.

Local stack only; unreachable / unseeded → SKIP. Read-only. ⛔ Run under the local-DB lock.
"""
from __future__ import annotations

import asyncio
from uuid import UUID

import pytest
import pytest_asyncio
from fastapi import HTTPException

try:
    import asyncpg
except ImportError:  # pragma: no cover
    asyncpg = None

from tests.integration._271_gotrue_users import require_gotrue
from tests.integration._284_scale_account import (
    BIG_FOLDER_NAME,
    CHUNKY_FILENAME,
    SCALE_OWNER_EMAIL,
    SCALE_PEER_EMAIL,
    sign_in,
    uid_for_email,
    user_client,
)

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
async def world():
    require_gotrue()
    c = await asyncpg.connect(DSN)
    try:
        owner = await uid_for_email(c, SCALE_OWNER_EMAIL)
        peer = await uid_for_email(c, SCALE_PEER_EMAIL)
        if owner is None or peer is None:
            pytest.skip("the scale account is not seeded (run scripts/seed-scale-284.py)")
        o = UUID(owner)
        big = await c.fetchval("SELECT id FROM folders WHERE user_id=$1 AND name=$2", o, BIG_FOLDER_NAME)
        f = c.fetchval
        truth = {
            "root_unarchived": await f("SELECT count(*) FROM documents WHERE user_id=$1 AND is_latest "
                                       "AND folder_id IS NULL AND archived_at IS NULL", o),
            "root_all": await f("SELECT count(*) FROM documents WHERE user_id=$1 AND is_latest "
                                "AND folder_id IS NULL", o),
            "big_all": await f("SELECT count(*) FROM documents WHERE user_id=$1 AND is_latest "
                               "AND folder_id=$2", o, big),
            "big_ids": {str(r["id"]) for r in await c.fetch(
                "SELECT id FROM documents WHERE user_id=$1 AND is_latest AND folder_id=$2", o, big)},
            "big_oldest": str(await f(
                "SELECT id FROM documents WHERE user_id=$1 AND is_latest AND folder_id=$2 "
                "ORDER BY created_at ASC, id ASC LIMIT 1", o, big)),
            "private": str(await f("SELECT id FROM documents WHERE user_id=$1 AND is_latest "
                                   "AND folder_id IS NULL LIMIT 1", o)),
            "chunky": str(await f("SELECT id FROM documents WHERE user_id=$1 AND filename=$2", o,
                                  CHUNKY_FILENAME)),
            "tabled": await c.fetchrow(
                "SELECT document_id, count(*) n FROM document_tables WHERE user_id=$1 "
                "GROUP BY 1 ORDER BY 1 LIMIT 1", o),
        }
    finally:
        await c.close()
    return {"owner": owner, "peer": peer, "big": str(big), "truth": truth,
            "owner_sb": user_client(sign_in(SCALE_OWNER_EMAIL)),
            "peer_sb": user_client(sign_in(SCALE_PEER_EMAIL))}


async def _list(sb, uid, *, limit=25, offset=0, folder_id=None, include_archived=False,
                status=None, order="created_desc", kind=None):
    from app.api.documents import list_documents

    return await list_documents(limit=limit, offset=offset, folder_id=folder_id,
                                include_archived=include_archived, status_=status, order=order,
                                kind=kind, current_user={"id": uid}, supabase=sb)


async def test_root_total_equals_count_star(world):
    t = world["truth"]
    page = await _list(world["owner_sb"], world["owner"], folder_id="root")
    assert page["total"] == t["root_unarchived"]
    assert len(page["documents"]) == 25
    assert all(d["folder_id"] is None and d["archived_at"] is None for d in page["documents"])
    every = await _list(world["owner_sb"], world["owner"], folder_id="root", include_archived=True)
    assert every["total"] == t["root_all"]
    assert t["root_all"] in (6000, 30000)


async def test_walking_every_page_of_big_reaches_every_document(world):
    t = world["truth"]
    seen: list[str] = []
    offset, total = 0, None
    while True:
        page = await _list(world["owner_sb"], world["owner"], folder_id=world["big"],
                           include_archived=True, limit=200, offset=offset)
        total = page["total"]
        seen.extend(d["id"] for d in page["documents"])
        offset += 200
        if offset >= total:
            break
    assert total == t["big_all"]
    assert len(seen) == len(set(seen)) == t["big_all"], "duplicates or gaps across pages"
    assert set(seen) == t["big_ids"]
    assert seen[-1] == t["big_oldest"], "the last row of the last page is not the oldest document"
    if t["root_all"] == 30000:
        assert total == 10000


async def test_peer_sees_twenty_and_a_404_for_a_private_document(world):
    from app.api.documents import get_document

    page = await _list(world["peer_sb"], world["peer"], include_archived=True, limit=200)
    assert page["total"] == 20 and len(page["documents"]) == 20
    with pytest.raises(HTTPException) as exc:
        await get_document(document_id=world["truth"]["private"], current_user={"id": world["peer"]},
                           supabase=world["peer_sb"])
    assert exc.value.status_code == 404 and exc.value.detail == "Document not found"


async def test_chunks_of_the_2500_chunk_document_page_with_exact_total(world):
    from app.api.documents import list_document_chunks

    doc = world["truth"]["chunky"]
    seen: list[int] = []
    offset = 0
    while True:
        page = await list_document_chunks(document_id=doc, limit=200, offset=offset,
                                          current_user={"id": world["owner"]}, supabase=world["owner_sb"])
        assert page["total"] == 2500
        assert len(page["chunks"]) <= 200
        seen.extend(c["chunk_index"] for c in page["chunks"])
        offset += 200
        if offset >= page["total"]:
            break
    assert seen == list(range(2500))


async def test_table_count_equals_document_tables_count(world):
    from app.api.documents import get_document

    row = world["truth"]["tabled"]
    doc = await get_document(document_id=str(row["document_id"]), current_user={"id": world["owner"]},
                             supabase=world["owner_sb"])
    assert doc["table_count"] == row["n"]
