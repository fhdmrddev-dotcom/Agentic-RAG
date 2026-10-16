"""Phase 284 (R-01 / R-02 / D-18 / P-1 / P-2) — ``public.library_documents`` proven LIVE, as
``authenticated``, against the seeded scale account.

What each test proves (and why a service-role or mocked test could not):

  (a) SHAPE — the view is ``security_invoker`` (so RLS on documents/folders applies beneath it),
      and its columns are exactly ``documents`` − {full_markdown} + {filename_key, version_count,
      has_earlier}. That second half is the P-2 DRIFT FENCE: a column added to ``documents`` later
      will not appear in the view, and this test is what says so.
  (b) GRANTS — anon cannot SELECT; authenticated can SELECT and nothing else (T-284-05/09).
  (c) FAIL-CLOSED — the service role reads ZERO rows through PostgREST (``auth.uid()`` is NULL).
      A test that "passes" through the service role proves nothing (RESEARCH anti-pattern); this
      one proves the opposite on purpose (T-284-08).
  (d) LEAK (D-18) — the peer (a REAL GoTrue user in the same org, owning nothing) sees exactly the
      20 documents in ``Shared 284`` and none of the owner's private ones; the owner's
      ``count=exact`` equals the database's ``count(*)``.
  (e) PARITY P-1 — for the owner, the peer and the operator's dev account, the view's latest id
      set read under ``_apply_rls_user_context`` equals the PRE-284 rule
      (``_284_scale_account.legacy_visible_latest_ids``).
  (f) ``version_count`` / ``has_earlier`` for a seeded two-version filename equal the SQL truth.

Runs ONLY against the local stack (:54321 / :54322); unreachable → SKIP with the reason (a skip is
a SKIP, never a pass). The scale account must be seeded (``scripts/seed-scale-284.py``); unseeded →
SKIP. Read-only: nothing here writes. ⛔ Run under the local-DB lock (worktree rule 4).
"""
from __future__ import annotations

import asyncio
import json
from uuid import UUID

import pytest
import pytest_asyncio

try:
    import asyncpg
except ImportError:  # pragma: no cover
    asyncpg = None

from tests.integration._271_gotrue_users import _admin, require_gotrue
from tests.integration._284_scale_account import (
    BIG_FOLDER_NAME,
    DEV_ACCOUNT_EMAIL,
    SCALE_OWNER_EMAIL,
    SCALE_PEER_EMAIL,
    SHARED_FOLDER_NAME,
    legacy_visible_latest_ids,
    sign_in,
    uid_for_email,
    user_client,
)

DSN = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
DERIVED = {"filename_key", "version_count", "has_earlier"}


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
async def pool():
    async def _init(conn):
        await conn.set_type_codec("jsonb", encoder=json.dumps, decoder=json.loads, schema="pg_catalog")

    p = await asyncpg.create_pool(DSN, min_size=1, max_size=4, init=_init)
    try:
        yield p
    finally:
        await p.close()


@pytest_asyncio.fixture
async def account(pool):
    require_gotrue()
    async with pool.acquire() as c:
        owner = await uid_for_email(c, SCALE_OWNER_EMAIL)
        peer = await uid_for_email(c, SCALE_PEER_EMAIL)
        dev = await uid_for_email(c, DEV_ACCOUNT_EMAIL)
        if owner is None or peer is None:
            pytest.skip("the scale account is not seeded (run scripts/seed-scale-284.py)")
        shared = await c.fetchval(
            "SELECT id FROM folders WHERE user_id=$1 AND name=$2", UUID(owner), SHARED_FOLDER_NAME)
        big = await c.fetchval(
            "SELECT id FROM folders WHERE user_id=$1 AND name=$2", UUID(owner), BIG_FOLDER_NAME)
    return {"owner": owner, "peer": peer, "dev": dev, "shared": str(shared), "big": str(big)}


async def _view_latest_ids(conn, uid: str) -> set[str]:
    from app.dependencies import _apply_rls_user_context

    out: set[str] = set()
    async with conn.transaction():
        await _apply_rls_user_context(conn, uid)
        last = None
        while True:
            rows = await conn.fetch(
                "SELECT id FROM public.library_documents WHERE is_latest "
                "AND ($1::uuid IS NULL OR id > $1) ORDER BY id LIMIT 5000", last)
            if not rows:
                break
            out.update(str(r["id"]) for r in rows)
            last = rows[-1]["id"]
    return out


# ── (a) shape + drift fence ──────────────────────────────────────────────────────────────────

async def test_view_is_security_invoker_and_its_columns_track_documents(pool):
    async with pool.acquire() as c:
        opts = await c.fetchval(
            "SELECT c.reloptions FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace "
            "WHERE n.nspname = 'public' AND c.relname = 'library_documents' AND c.relkind = 'v'")
        assert opts is not None, "public.library_documents does not exist (migration 207 not applied)"
        assert "security_invoker=true" in opts
        cols = lambda t: c.fetch(  # noqa: E731
            "SELECT column_name FROM information_schema.columns WHERE table_schema='public' "
            "AND table_name=$1", t)
        view_cols = {r["column_name"] for r in await cols("library_documents")}
        doc_cols = {r["column_name"] for r in await cols("documents")}
    assert view_cols == (doc_cols - {"full_markdown"}) | DERIVED, (
        "P-2 drift: view columns differ from documents − {full_markdown} + derived: "
        f"missing {sorted((doc_cols - {'full_markdown'}) - view_cols)}, "
        f"extra {sorted(view_cols - doc_cols - DERIVED)}")


# ── (b) grants ───────────────────────────────────────────────────────────────────────────────

async def test_view_grants_are_select_only_and_closed_to_anon(pool):
    async with pool.acquire() as c:
        priv = lambda role, p: c.fetchval(  # noqa: E731
            "SELECT has_table_privilege($1, 'public.library_documents', $2)", role, p)
        assert await priv("anon", "SELECT") is False
        assert await priv("authenticated", "SELECT") is True
        for p in ("INSERT", "UPDATE", "DELETE", "TRUNCATE"):
            assert await priv("authenticated", p) is False, f"authenticated has {p}"
            assert await priv("anon", p) is False, f"anon has {p}"
        assert await priv("service_role", "SELECT") is True
        assert await priv("service_role", "INSERT") is False


# ── (c) fail-closed for the service role ─────────────────────────────────────────────────────

async def test_service_role_reads_zero_rows(account):
    res = _admin().table("library_documents").select("id", count="exact").limit(5).execute()
    assert res.data == []
    assert res.count == 0


# ── (d) the two-user leak test, through PostgREST with REAL JWTs ─────────────────────────────

async def test_peer_sees_only_the_20_shared_and_owner_sees_all(pool, account):
    peer = user_client(sign_in(SCALE_PEER_EMAIL))
    res = (peer.table("library_documents").select("id,folder_id,user_id", count="exact")
           .eq("is_latest", True).limit(200).execute())
    assert res.count == 20, f"peer counts {res.count}, expected exactly the 20 shared documents"
    assert len(res.data) == 20
    assert {r["folder_id"] for r in res.data} == {account["shared"]}

    async with pool.acquire() as c:
        a_private = await c.fetchval(
            "SELECT id FROM documents WHERE user_id=$1 AND is_latest AND folder_id IS NULL LIMIT 1",
            UUID(account["owner"]))
        a_count = await c.fetchval(
            "SELECT count(*) FROM documents WHERE user_id=$1 AND is_latest", UUID(account["owner"]))
    miss = peer.table("library_documents").select("id").eq("id", str(a_private)).execute()
    assert miss.data == [], "LEAK: the peer reads one of the owner's private documents"
    # and the base table agrees (RLS beneath the view, not the view alone, is the wall)
    miss2 = peer.table("documents").select("id").eq("id", str(a_private)).execute()
    assert miss2.data == []

    owner = user_client(sign_in(SCALE_OWNER_EMAIL))
    res_a = (owner.table("library_documents").select("id", count="exact")
             .eq("is_latest", True).limit(1).execute())
    assert res_a.count == a_count, f"owner count {res_a.count} != count(*) {a_count}"


async def test_peer_view_page_and_embedded_counts_work_through_postgrest(account):
    """The paged read the list route will make: order + range + count + embedded child counts."""
    owner = user_client(sign_in(SCALE_OWNER_EMAIL))
    res = (owner.table("library_documents")
           .select("id,created_at,document_tables(count),document_images(count)", count="exact")
           .eq("is_latest", True).eq("folder_id", account["big"])
           .order("created_at", desc=True).order("id", desc=True).range(0, 24).execute())
    assert len(res.data) == 25
    assert isinstance(res.count, int) and res.count >= 3000
    assert all(isinstance(r["document_tables"], list) for r in res.data)


# ── (e) parity P-1: the view's set == the PRE-284 rule ───────────────────────────────────────

@pytest.mark.parametrize("who", ["owner", "peer", "dev"])
async def test_view_latest_set_equals_the_legacy_rule(pool, account, who):
    uid = account[who]
    if uid is None:
        pytest.skip(f"no {who} account in this database")
    async with pool.acquire() as c:
        orgs = sorted(str(r["org_id"]) for r in await c.fetch(
            "SELECT org_id FROM org_members WHERE user_id=$1", UUID(uid)))
        legacy = await legacy_visible_latest_ids(c, uid)
    async with pool.acquire() as c:
        view = await _view_latest_ids(c, uid)
    assert view == legacy, (
        f"P-1 parity failed for {who} (orgs {orgs}): view-only {len(view - legacy)}, "
        f"legacy-only {len(legacy - view)}")
    if who == "owner":
        assert len(view) >= 10020
    if who == "peer":
        assert len(view) == 20


# ── (f) version_count / has_earlier ──────────────────────────────────────────────────────────

async def test_version_columns_equal_sql_truth(pool, account):
    from app.dependencies import _apply_rls_user_context

    owner = UUID(account["owner"])
    async with pool.acquire() as c:
        fname = await c.fetchval(
            "SELECT filename FROM documents WHERE user_id=$1 AND NOT is_latest ORDER BY filename LIMIT 1",
            owner)
        truth = await c.fetch(
            "SELECT id, version_number FROM documents WHERE user_id=$1 AND filename=$2", owner, fname)
    assert len(truth) == 2
    async with pool.acquire() as c:
        async with c.transaction():
            await _apply_rls_user_context(c, str(owner))
            rows = await c.fetch(
                "SELECT id, version_number, version_count, has_earlier FROM public.library_documents "
                "WHERE filename = $1", fname)
            single = await c.fetchrow(
                "SELECT version_count, has_earlier FROM public.library_documents "
                "WHERE is_latest AND has_earlier = false LIMIT 1")
    by_v = {r["version_number"]: r for r in rows}
    assert set(by_v) == {1, 2}
    assert by_v[2]["version_count"] == 2 and by_v[2]["has_earlier"] is True
    assert by_v[1]["version_count"] == 2 and by_v[1]["has_earlier"] is False
    assert single["version_count"] == 1 and single["has_earlier"] is False
