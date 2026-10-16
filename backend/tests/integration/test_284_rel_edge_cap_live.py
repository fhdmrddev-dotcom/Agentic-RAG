"""284-REVIEW WR-02 — a relationship hub above the cap is the worded 503, never a 414 → 500. LIVE.

Find's "… references this document" sends the hub's edge endpoints in URLs (the endpoints read
and the page read's ``id in.()``). The gateway refuses a request line over 8 KB with 414 (measured
on the local Kong: 208 ids in a ``select=id`` read pass, 209 fail; BUG-261014-06 on cloud: 182
pass, 286 fail). With ``REL_EDGE_CAP = 500`` a hub of 250 edges passed the cap check and built a
~10 KB page URL → 414 → ``APIError`` → a 500, where the contract promises the worded refusal.

Driven in-process through ``POST /document-search``'s route coroutine with a REAL signed-in
user's client (GoTrue JWT + anon key, RLS as ``authenticated``):

  (a) a hub at the cap answers 200 with every referencing document;
  (b) a hub of 250 edges answers the worded 503 (``TRUNCATED_DETAIL``) — not an ``APIError``.

Local stack only (unreachable → SKIP). Throwaway rows for a throwaway user, removed by
``RouteUsers.drop_all`` (edges cascade with their documents). ⛔ Run under the local-DB lock.
"""
from __future__ import annotations

import asyncio
import json
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
import pytest_asyncio
from fastapi import HTTPException

try:
    import asyncpg
except ImportError:  # pragma: no cover
    asyncpg = None

from tests.integration._284_route_users import RouteUsers

DSN = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
HUB_OVER = 250  # between the measured bound (~208 ids) and the old cap (500)


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
    async def _init(conn):
        await conn.set_type_codec("jsonb", encoder=json.dumps, decoder=json.loads, schema="pg_catalog")

    pool = await asyncpg.create_pool(DSN, min_size=1, max_size=4, init=_init)
    users = RouteUsers(pool)
    try:
        try:
            uid = await users.create("wr02")
        except Exception as e:  # noqa: BLE001
            pytest.skip(f"GoTrue user setup failed: {type(e).__name__}: {e}")
        org = await users.personal_org(uid)
        base = datetime(2025, 9, 1, tzinfo=timezone.utc)

        async def hub_with(n: int, label: str) -> str:
            hub = uuid4()
            await pool.execute(
                "INSERT INTO documents (id, user_id, filename, file_path, file_size, mime_type, status, "
                "metadata, created_at, is_latest, version_number) "
                "VALUES ($1,$2,$3,$4,100,'text/plain','completed','{}'::jsonb,$5,true,1)",
                hub, uid, f"{label}-hub.txt", f"{uid}/{hub}.txt", base,
            )
            refs = [uuid4() for _ in range(n)]
            await pool.executemany(
                "INSERT INTO documents (id, user_id, filename, file_path, file_size, mime_type, status, "
                "metadata, created_at, is_latest, version_number) "
                "VALUES ($1,$2,$3,$4,100,'text/plain','completed','{}'::jsonb,$5,true,1)",
                [(r, uid, f"{label}-ref-{i:03d}.txt", f"{uid}/{r}.txt", base + timedelta(seconds=i + 1))
                 for i, r in enumerate(refs)],
            )
            await pool.executemany(
                "INSERT INTO document_relationships (user_id, org_id, source_doc_id, target_doc_id, rel_type) "
                "VALUES ($1,$2,$3,$4,'references')",
                [(uid, org, r, hub) for r in refs],
            )
            return str(hub)

        from app.services.document_search_service import REL_EDGE_CAP

        at_cap = await hub_with(REL_EDGE_CAP, "cap")
        over = await hub_with(HUB_OVER, "over")
        yield {"uid": str(uid), "sb": users.client(uid), "at_cap": at_cap, "over": over,
               "cap": REL_EDGE_CAP}
    finally:
        await users.drop_all()
        await pool.close()


async def _find(w, hub: str, **kw):
    from app.api.document_search import search
    from app.models.document_search import DocumentSearchRequest

    body = DocumentSearchRequest(relationship={"verb": "references", "document_id": hub}, **kw)
    return await search(body=body, current_user={"id": w["uid"]}, supabase=w["sb"])


async def test_a_hub_at_the_cap_answers_every_referencing_document(world):
    out = await _find(world, world["at_cap"], limit=100)
    assert out["total"] == world["cap"]
    assert len(out["documents"]) == min(world["cap"], 100)


async def test_a_hub_above_the_cap_is_the_worded_503_not_a_414(world):
    from app.services.document_search_service import TRUNCATED_DETAIL

    with pytest.raises(HTTPException) as exc:
        await _find(world, world["over"], limit=25)
    assert exc.value.status_code == 503
    assert exc.value.detail == TRUNCATED_DETAIL
