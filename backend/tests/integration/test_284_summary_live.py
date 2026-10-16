"""Phase 284 (R-03 / D-06 / D-07 / T-284-11) — ``GET /library/summary`` LIVE, against the seeded
scale account, with every number checked against its OWN ``count(*)`` / ``sum()``.

Drives the REAL handler in-process with REAL SQL under REAL RLS: ``get_user_pg_connection`` (the
route's seam) is monkeypatched onto a test pool that applies ``_apply_rls_user_context`` — the
``test_2171_index_summary_rls.py`` shape, for the same Windows loop-binding reason documented
there. The ground truth is read as ``postgres`` from ``public.documents`` directly (NOT from the
view), so a view bug cannot agree with itself.

  * owner: total / archived / chunks / root / folders[Big] (count + size) / every status / every
    processing step / rate_limited_in_flight equal the SQL truth; ``paused`` is 0 (R-04);
  * peer: every number reflects ONLY the 20 shared documents (the summary is not a count oracle).

Local stack only; unreachable or unseeded → SKIP. Read-only. ⛔ Run under the local-DB lock.
"""
from __future__ import annotations

import asyncio
import json
from contextlib import asynccontextmanager
from unittest.mock import MagicMock
from uuid import UUID

import pytest
import pytest_asyncio

try:
    import asyncpg
except ImportError:  # pragma: no cover
    asyncpg = None

from tests.integration._284_scale_account import (
    BIG_FOLDER_NAME,
    SCALE_OWNER_EMAIL,
    SCALE_PEER_EMAIL,
    SHARED_FOLDER_NAME,
    uid_for_email,
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
    async with pool.acquire() as c:
        owner = await uid_for_email(c, SCALE_OWNER_EMAIL)
        peer = await uid_for_email(c, SCALE_PEER_EMAIL)
        if owner is None or peer is None:
            pytest.skip("the scale account is not seeded (run scripts/seed-scale-284.py)")
        big = await c.fetchval("SELECT id FROM folders WHERE user_id=$1 AND name=$2",
                               UUID(owner), BIG_FOLDER_NAME)
        shared = await c.fetchval("SELECT id FROM folders WHERE user_id=$1 AND name=$2",
                                  UUID(owner), SHARED_FOLDER_NAME)
    return {"owner": owner, "peer": peer, "big": str(big), "shared": str(shared)}


async def _summary_as(pool, uid: str) -> dict:
    from app.api import library as library_api
    from app.dependencies import _apply_rls_user_context

    @asynccontextmanager
    async def _user_conn(request, current_user):
        async with pool.acquire() as conn:
            async with conn.transaction():
                await _apply_rls_user_context(conn, current_user["id"])
                yield conn

    orig = library_api.get_user_pg_connection
    library_api.get_user_pg_connection = _user_conn
    try:
        out = await library_api.get_library_summary(MagicMock(), {"id": uid})
    finally:
        library_api.get_user_pg_connection = orig
    return out.model_dump()


async def test_owner_summary_equals_its_own_counts(pool, account):
    s = await _summary_as(pool, account["owner"])
    o = UUID(account["owner"])
    W = "FROM documents WHERE user_id = $1 AND is_latest"
    async with pool.acquire() as c:
        f = c.fetchval
        truth_total = await f(f"SELECT count(*) {W}", o)
        truth_archived = await f(f"SELECT count(*) {W} AND archived_at IS NOT NULL", o)
        truth_chunks = await f(f"SELECT coalesce(sum(chunk_count),0) {W}", o)
        truth_root = await f(f"SELECT count(*) {W} AND folder_id IS NULL", o)
        truth_root_size = await f(f"SELECT coalesce(sum(file_size),0) {W} AND folder_id IS NULL", o)
        truth_big = await f(f"SELECT count(*) {W} AND folder_id = $2", o, UUID(account["big"]))
        truth_big_size = await f(f"SELECT coalesce(sum(file_size),0) {W} AND folder_id = $2", o,
                                 UUID(account["big"]))
        truth_big_arch = await f(f"SELECT count(*) {W} AND folder_id = $2 AND archived_at IS NOT NULL",
                                 o, UUID(account["big"]))
        truth_status = {r["status"]: r["n"] for r in await c.fetch(
            f"SELECT status, count(*) n {W} GROUP BY 1", o)}
        truth_steps = {r["ingestion_step"]: r["n"] for r in await c.fetch(
            f"SELECT ingestion_step, count(*) n {W} AND status='processing' "
            "AND ingestion_step IS NOT NULL GROUP BY 1", o)}
        truth_rl = await f(
            f"SELECT count(*) {W} AND status IN ('pending','processing') AND ("
            "error_message ILIKE '%rate limit%' OR error_message ILIKE '%429%' "
            "OR error_message ILIKE '%quota%')", o)
        truth_types = {r["t"]: r["n"] for r in await c.fetch(
            f"SELECT metadata->>'document_type' t, count(*) n {W} "
            "AND metadata->>'document_type' IS NOT NULL GROUP BY 1", o)}
        truth_folders = {str(r["folder_id"]): r["n"] for r in await c.fetch(
            f"SELECT folder_id, count(*) n {W} AND folder_id IS NOT NULL GROUP BY 1", o)}

    assert truth_total in (10020, 50020), "the account is not at a seeded size"
    assert s["total"] == truth_total
    assert s["archived"] == truth_archived
    assert s["chunks"] == truth_chunks
    assert s["root"]["count"] == truth_root
    assert s["root"]["size_bytes"] == truth_root_size
    assert s["folders"][account["big"]]["count"] == truth_big
    if truth_total == 50020:
        assert truth_big == 10000
    assert s["folders"][account["big"]]["size_bytes"] == truth_big_size
    assert s["folders"][account["big"]]["archived"] == truth_big_arch
    assert {k: v["count"] for k, v in s["folders"].items()} == truth_folders
    for st in ("pending", "processing", "completed", "failed"):
        assert s["status"][st] == truth_status.get(st, 0), st
    assert s["status"]["paused"] == 0
    assert s["steps"] == truth_steps
    assert s["rate_limited_in_flight"] == truth_rl
    assert {t["value"]: t["count"] for t in s["document_types"]} == truth_types
    assert s["document_types_truncated"] is False
    assert s["connections"] == []  # the seed places no connector documents


async def test_peer_summary_reflects_only_the_20_shared(pool, account):
    s = await _summary_as(pool, account["peer"])
    sid = UUID(account["shared"])
    async with pool.acquire() as c:
        size = await c.fetchval(
            "SELECT coalesce(sum(file_size),0) FROM documents WHERE folder_id=$1 AND is_latest", sid)
        chunks = await c.fetchval(
            "SELECT coalesce(sum(chunk_count),0) FROM documents WHERE folder_id=$1 AND is_latest", sid)
    assert s["total"] == 20
    assert s["root"]["count"] == 0
    assert set(s["folders"]) == {account["shared"]}
    assert s["folders"][account["shared"]] == {"count": 20, "size_bytes": size, "archived": 0}
    assert s["chunks"] == chunks
    assert s["status"]["completed"] == 20
    assert sum(s["status"].values()) == 20
    assert s["steps"] == {}
