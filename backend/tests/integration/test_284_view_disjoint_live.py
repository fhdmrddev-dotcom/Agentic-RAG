"""284-REVIEW WR-R2-05 — the two legs of ``public.library_documents`` (migration 208) are DISJOINT,
so UNION ALL lists every document exactly once. LIVE, as real users.

Migration 208 rewrote the view as ``leg 1 (the caller's own) UNION ALL leg 2 (documents in
org-shared folders the caller does not own)``. UNION ALL does not de-duplicate, so the view is exact
only because leg 2 also says ``u.user_id IS DISTINCT FROM (SELECT auth.uid())``. Exactly ONE shape
matches both legs' folder conditions: **a document the caller owns, filed in ANOTHER user's
org-shared folder**. The scale fixture never builds it (the peer owns nothing; both shared folders
belong to the owner), and ``test_284_view_live`` collects ids into a ``set``, which hides a
duplicate. So deleting that predicate turned nothing red. This suite builds the shape on purpose:

  * user A owns an org-shared folder in A's org; user B joins A's org;
  * B owns one document INSIDE A's shared folder (the both-legs shape), plus one at B's Root;
  * A owns one document in the same folder (leg 2's positive control for B).

and asserts, for B, through PostgREST with B's REAL GoTrue JWT (the Library's own path) AND in
SQL as ``authenticated`` with ``request.jwt.claims`` only (PostgREST's branch of ``auth.uid()``):

  (1) B's document in A's folder appears EXACTLY ONCE;
  (2) ``count(*) == count(DISTINCT id)`` and PostgREST's ``count=exact`` equals the distinct ids;
  (3) B's visible set is exactly {B's in-folder doc, B's Root doc, A's in-folder doc}.

And, for A, (4) A sees only A's own document: B's document sits in A's OWN shared folder, which
207/208 exclude on purpose (``f.user_id <> uid``) even though RLS would admit it.

Local stack only (unreachable → SKIP). Writes throwaway rows for throwaway users only, removed in
``finally``. ⛔ Run under the local-DB lock (worktree rule 4).
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

_DOC = (
    "INSERT INTO public.documents (id, user_id, org_id, folder_id, filename, file_path, file_size, "
    "mime_type, status, metadata, created_at, is_latest, version_number) "
    "VALUES ($1,$2,$3,$4,$5,$6,100,'text/plain','completed','{}'::jsonb,$7,true,1)"
)


@pytest_asyncio.fixture
async def world():
    async def _init(conn):
        await conn.set_type_codec("jsonb", encoder=json.dumps, decoder=json.loads, schema="pg_catalog")

    pool = await asyncpg.create_pool(DSN, min_size=1, max_size=4, init=_init)
    users = RouteUsers(pool)
    folder = uuid4()
    docs: dict[str, UUID] = {}
    try:
        try:
            a = await users.create("wr205-a")
            b = await users.create("wr205-b")
        except Exception as e:  # noqa: BLE001
            pytest.skip(f"GoTrue user setup failed: {type(e).__name__}: {e}")
        org_a = await users.personal_org(a)
        org_b = await users.personal_org(b)
        await users.join_org_of(b, a)
        await pool.execute(
            "INSERT INTO public.folders (id, user_id, org_id, name, is_org_shared) "
            "VALUES ($1,$2,$3,'WR-R2-05 shared',true)", folder, a, org_a)
        base = datetime(2026, 10, 16, tzinfo=timezone.utc)
        docs = {"b_in_a_folder": uuid4(), "b_root": uuid4(), "a_in_folder": uuid4()}
        for i, (key, owner, org, fid) in enumerate((
            ("b_in_a_folder", b, org_a, folder),
            ("b_root", b, org_b, None),
            ("a_in_folder", a, org_a, folder),
        )):
            d = docs[key]
            await pool.execute(_DOC, d, owner, org, fid, f"wr-r2-05-{key}.txt", f"{owner}/{d}.txt",
                               base + timedelta(seconds=i))
        yield {"pool": pool, "users": users, "a": a, "b": b, "folder": folder, "docs": docs}
    finally:
        for d in docs.values():
            try:
                await pool.execute("DELETE FROM public.documents WHERE id = $1", d)
            except Exception:
                pass
        try:
            await pool.execute("DELETE FROM public.folders WHERE id = $1", folder)
        except Exception:
            pass
        await users.drop_all()
        await pool.close()


async def _sql_view(pool, uid: UUID, probe: UUID) -> dict:
    """As ``authenticated`` with ``request.jwt.claims`` ONLY — PostgREST's path through auth.uid()."""
    async with pool.acquire() as c:
        async with c.transaction():
            await c.execute("SET LOCAL ROLE authenticated")
            await c.execute("SELECT set_config('request.jwt.claim.sub', '', true)")
            await c.execute("SELECT set_config('request.jwt.claims', $1, true)",
                            json.dumps({"sub": str(uid), "role": "authenticated", "aud": "authenticated"}))
            row = await c.fetchrow(
                "SELECT count(*) AS n, count(DISTINCT id) AS nd, "
                "count(*) FILTER (WHERE id = $1) AS n_probe, "
                "coalesce(array_agg(id ORDER BY id), '{}') AS ids FROM public.library_documents",
                probe)
    return dict(row)


async def test_callers_own_document_in_another_users_shared_folder_is_listed_once(world):
    pool, users, a, b, docs = world["pool"], world["users"], world["a"], world["b"], world["docs"]
    probe = docs["b_in_a_folder"]

    # (1)-(3) through PostgREST, with B's real JWT — the Library's own read.
    res = users.client(b).table("library_documents").select("id", count="exact").limit(100).execute()
    ids = [r["id"] for r in res.data]
    assert ids.count(str(probe)) == 1, (
        f"B's own document in A's shared folder is listed {ids.count(str(probe))} times "
        "(leg 1 and leg 2 both matched it: the legs are not disjoint)")
    assert len(ids) == len(set(ids)), f"duplicate ids in B's Library: {sorted(ids)}"
    assert res.count == len(set(ids)), f"count=exact {res.count} != {len(set(ids))} distinct ids"
    assert set(ids) == {str(docs["b_in_a_folder"]), str(docs["b_root"]), str(docs["a_in_folder"])}

    # (1)-(2) in SQL, as authenticated + request.jwt.claims only.
    got = await _sql_view(pool, b, probe)
    assert got["n_probe"] == 1, f"SQL: the probe document appears {got['n_probe']} times"
    assert got["n"] == got["nd"], f"SQL: count(*) {got['n']} != count(DISTINCT id) {got['nd']}"
    assert got["n"] == 3

    # (4) A does not list B's document in A's OWN shared folder (207's exclusion, kept by 208).
    got_a = await _sql_view(pool, a, probe)
    assert got_a["n_probe"] == 0, "A lists another user's document in A's own shared folder"
    assert list(got_a["ids"]) == [docs["a_in_folder"]]
    res_a = users.client(a).table("library_documents").select("id", count="exact").execute()
    assert [r["id"] for r in res_a.data] == [str(docs["a_in_folder"])] and res_a.count == 1
