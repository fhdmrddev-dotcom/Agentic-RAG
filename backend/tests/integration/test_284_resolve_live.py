"""Phase 284 (284-04 Task 2 — D-10 / R-02 / D-18) — saved views and filters page, LIVE, at 50,000.

The route coroutines are driven in-process with a REAL user client (GoTrue JWT + the anon key, RLS
enforced as ``authenticated``) against the seeded scale account; ground truth is read as
``postgres`` from ``public.documents``.

  * A's saved view over the ``Big`` folder's subtree, walked at ``limit=200``, reaches exactly the
    folder's 10,000 latest documents with ``total == 10000`` on every page and no duplicate;
  * ``count_only`` returns 10,000 — before 284 it returned the union of two legs each cut near
    1,000;
  * B resolving the same filter (ad hoc: B cannot read A's private view, and an unreachable
    ``folder_scope`` is "no narrowing", D-113-5) gets only the 20 ``Shared 284`` documents;
  * the AGENT path (service role, ``via_view=False``) still returns rows for A with an exact total,
    while a service-role read of the view returns ZERO rows — fail-closed, proven rather than
    assumed (R-02).

The saved view is inserted for the test and deleted in ``finally``. Local stack only;
unreachable / unseeded → SKIP. ⛔ Run under the local-DB lock.
"""
from __future__ import annotations

import asyncio
import json
from types import SimpleNamespace
from uuid import UUID, uuid4

import pytest
import pytest_asyncio

try:
    import asyncpg
except ImportError:  # pragma: no cover
    asyncpg = None

from tests.integration._271_gotrue_users import _local_env, require_gotrue
from tests.integration._284_scale_account import (
    BIG_FOLDER_NAME,
    SCALE_OWNER_EMAIL,
    SCALE_PEER_EMAIL,
    SHARED_FOLDER_NAME,
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
    view_id = uuid4()
    try:
        owner = await uid_for_email(c, SCALE_OWNER_EMAIL)
        peer = await uid_for_email(c, SCALE_PEER_EMAIL)
        if owner is None or peer is None:
            pytest.skip("the scale account is not seeded (run scripts/seed-scale-284.py)")
        o = UUID(owner)
        big = await c.fetchval("SELECT id FROM folders WHERE user_id=$1 AND name=$2", o, BIG_FOLDER_NAME)
        shared = await c.fetchval("SELECT id FROM folders WHERE user_id=$1 AND name=$2", o, SHARED_FOLDER_NAME)
        org = await c.fetchval("SELECT org_id FROM folders WHERE id=$1", big)
        truth = {
            "big_ids": {str(r["id"]) for r in await c.fetch(
                "SELECT id FROM documents WHERE folder_id=$1 AND is_latest", big)},
            "shared_ids": {str(r["id"]) for r in await c.fetch(
                "SELECT id FROM documents WHERE folder_id=$1 AND is_latest", shared)},
            "agent_total": await c.fetchval(
                "SELECT count(*) FROM documents WHERE user_id=$1 AND is_latest AND retrievable", o),
        }
        await c.execute(
            "INSERT INTO public.document_views (id, user_id, org_id, name, filter_expr, folder_scope) "
            "VALUES ($1, $2, $3, $4, $5::jsonb, $6)",
            view_id, o, org, f"284-04 live {view_id.hex[:8]}",
            json.dumps({"op": "and", "conditions": []}), big,
        )
        yield {
            "owner": owner, "peer": peer, "big": str(big), "view_id": str(view_id), "truth": truth,
            "owner_sb": user_client(sign_in(SCALE_OWNER_EMAIL)),
            "peer_sb": user_client(sign_in(SCALE_PEER_EMAIL)),
        }
    finally:
        await c.execute("DELETE FROM public.document_views WHERE id = $1", view_id)
        await c.close()


async def _resolve_view(w, **kw):
    from app.api.document_views import resolve_view

    return await resolve_view(view_id=w["view_id"], current_user={"id": w["owner"]},
                              supabase=w["owner_sb"], **kw)


async def test_the_saved_view_walks_to_every_document_in_big(world):
    t = world["truth"]
    assert len(t["big_ids"]) == 10000, "the 50k account is expected (Big holds exactly 10,000)"
    seen: list[str] = []
    offset = 0
    while True:
        page = await _resolve_view(world, offset=offset, limit=200)
        assert page["total"] == 10000
        assert (page["offset"], page["limit"]) == (offset, 200)
        seen.extend(d["id"] for d in page["documents"])
        offset += 200
        if offset >= page["total"]:
            break
    assert len(seen) == len(set(seen)) == 10000, "duplicates or gaps across pages"
    assert set(seen) == t["big_ids"]


async def test_count_only_is_exact_not_near_one_thousand(world):
    out = await _resolve_view(world, count_only=True)
    assert out == {"total": 10000}


async def test_the_peer_resolving_the_same_filter_sees_only_shared_documents(world):
    from app.api.document_views import resolve_adhoc
    from app.models.document_view import AdHocResolve

    body = AdHocResolve(filter_expr={"op": "and", "conditions": []}, folder_scope=world["big"], limit=200)
    out = await resolve_adhoc(body, current_user={"id": world["peer"]}, supabase=world["peer_sb"])
    assert out["total"] == 20
    assert {d["id"] for d in out["documents"]} == world["truth"]["shared_ids"]
    count = await resolve_adhoc(AdHocResolve(filter_expr={"op": "and", "conditions": []},
                                             folder_scope=world["big"], count_only=True),
                                current_user={"id": world["peer"]}, supabase=world["peer_sb"])
    assert count == {"total": 20}


async def test_the_agent_path_still_returns_rows_and_the_view_is_fail_closed(world):
    from supabase import create_client

    import app.services.tools.documents as td

    env = _local_env()
    service = create_client(env["SUPABASE_URL"], env["SUPABASE_SERVICE_ROLE_KEY"])
    # Fail-closed, proven: the service role reads NOTHING through the view.
    assert service.table("library_documents").select("id").limit(5).execute().data == []

    ctx = SimpleNamespace(current_user={"id": world["owner"]}, supabase=service)
    result = await td._handle_query_documents_by_view({"filter": {"op": "and", "conditions": []}}, ctx)
    parsed = json.loads(result.result)
    assert parsed["mode"] == "results"
    assert parsed["shown"] == 20 and len(parsed["documents"]) == 20
    assert parsed["total"] == world["truth"]["agent_total"], "the agent total is exact past 1,000"
    assert parsed["total"] > 1000
