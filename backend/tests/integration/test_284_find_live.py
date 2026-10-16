"""Phase 284 (284-04 Task 1 — SC#4 / D-14 / D-18) — Find pages in SQL, LIVE, at 50,000 documents.

``search_documents`` is driven in-process with a REAL user client (GoTrue JWT + the anon key, so
RLS is enforced as ``authenticated``), against the seeded scale account. Ground truth is read as
``postgres`` straight from ``public.documents`` — never from the view under test — and the visible
set comes from the PRE-284 rule kept as an oracle (``legacy_visible_latest_ids``).

  * A's empty-filter Find ``total`` == the count of A's latest, non-archived, visible documents;
  * the LAST page (``offset = total - 1``) returns the oldest document by the stated order;
  * ``version="has_earlier"``'s total == the SQL truth;
  * B (the peer) finds exactly the 20 ``Shared 284`` documents and none of A's private ones — D-18
    "searches", the security half of SC#4;
  * a name search for a seeded filename fragment finds that document;
  * page 1 at 50k answers fast (the timing is printed for the SUMMARY; the BEFORE figure was 16.9 s).

Local stack only; unreachable / unseeded → SKIP. Read-only. ⛔ Run under the local-DB lock.
"""
from __future__ import annotations

import asyncio
import time
from uuid import UUID

import pytest
import pytest_asyncio

try:
    import asyncpg
except ImportError:  # pragma: no cover
    asyncpg = None

from tests.integration._271_gotrue_users import require_gotrue
from tests.integration._284_scale_account import (
    SCALE_OWNER_EMAIL,
    SCALE_PEER_EMAIL,
    SHARED_FOLDER_NAME,
    legacy_visible_latest_ids,
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
        visible = await legacy_visible_latest_ids(c, owner)
        vis = [UUID(v) for v in visible]
        live = await c.fetch(
            "SELECT id FROM documents WHERE id = ANY($1::uuid[]) AND archived_at IS NULL", vis)
        oldest = await c.fetchval(
            "SELECT id FROM documents WHERE id = ANY($1::uuid[]) AND archived_at IS NULL "
            "ORDER BY created_at ASC, id DESC LIMIT 1", vis)
        has_earlier = await c.fetchval(
            "SELECT count(*) FROM documents d WHERE d.id = ANY($1::uuid[]) AND d.archived_at IS NULL "
            "AND EXISTS (SELECT 1 FROM documents e WHERE e.user_id = d.user_id "
            "AND e.filename = d.filename AND e.version_number < d.version_number)", vis)
        shared = await c.fetchval(
            "SELECT id FROM folders WHERE user_id=$1 AND name=$2", o, SHARED_FOLDER_NAME)
        shared_ids = {str(r["id"]) for r in await c.fetch(
            "SELECT id FROM documents WHERE folder_id=$1 AND is_latest", shared)}
        named = await c.fetchrow(
            "SELECT id, filename FROM documents WHERE folder_id=$1 AND is_latest "
            "ORDER BY filename LIMIT 1 OFFSET 7", shared)
    finally:
        await c.close()
    return {
        "owner": owner, "peer": peer,
        "truth": {"total": len(live), "oldest": str(oldest), "has_earlier": has_earlier,
                  "shared_ids": shared_ids, "named": (str(named["id"]), named["filename"])},
        "owner_sb": user_client(sign_in(SCALE_OWNER_EMAIL)),
        "peer_sb": user_client(sign_in(SCALE_PEER_EMAIL)),
    }


async def _find(sb, uid, **body):
    from app.models.document_search import DocumentSearchRequest
    from app.services.document_search_service import search_documents

    return await search_documents(caller=uid, req=DocumentSearchRequest(**body), supabase=sb)


async def test_owner_total_is_the_sql_count_and_page_one_is_fast(world):
    t = world["truth"]
    started = time.perf_counter()
    page = await _find(world["owner_sb"], world["owner"])
    elapsed_ms = (time.perf_counter() - started) * 1000
    print(f"\n[284-04] Find page 1 as the owner: total={page['total']} in {elapsed_ms:.0f} ms")
    assert page["total"] == t["total"]
    assert t["total"] > 10_000, "the 50k account is expected here (the 10k step is too small)"
    assert len(page["documents"]) == 25
    assert all("full_markdown" not in d for d in page["documents"])
    # Generous on purpose (a loaded dev box must not flake it): the BEFORE figure is 16.9 s.
    assert elapsed_ms < 5000, f"Find page 1 took {elapsed_ms:.0f} ms at 50k"


async def test_the_last_page_returns_the_oldest(world):
    t = world["truth"]
    page = await _find(world["owner_sb"], world["owner"], offset=t["total"] - 1, limit=1)
    assert page["total"] == t["total"]
    assert [d["id"] for d in page["documents"]] == [t["oldest"]]


async def test_has_earlier_total_is_the_sql_truth(world):
    t = world["truth"]
    page = await _find(world["owner_sb"], world["owner"], version="has_earlier", limit=100)
    assert page["total"] == t["has_earlier"]
    assert t["has_earlier"] > 0
    assert all(d["has_earlier"] is True and d["version_count"] >= 2 for d in page["documents"])


async def test_the_peer_finds_exactly_the_shared_documents(world):
    t = world["truth"]
    page = await _find(world["peer_sb"], world["peer"], limit=100)
    assert page["total"] == 20
    got = {d["id"] for d in page["documents"]}
    assert got == t["shared_ids"], "B saw a document outside Shared 284 (D-18)"


async def test_a_name_search_finds_a_seeded_document(world):
    doc_id, filename = world["truth"]["named"]
    fragment = filename.rsplit(".", 1)[0][-10:]
    page = await _find(world["owner_sb"], world["owner"], name=fragment)
    assert doc_id in {d["id"] for d in page["documents"]}
    peer = await _find(world["peer_sb"], world["peer"], name=fragment)
    assert doc_id in {d["id"] for d in peer["documents"]}  # it is a Shared 284 document
