"""BUG-261031-03 — LIVE: concurrent searches must not deadlock a real asyncpg pool.

Read-only: no row is written. A dedicated asyncpg pool of ``max_size=2`` (never the app's) is
installed as the ``get_pg_pool`` singleton and ``CONCURRENCY`` calls go through the real
``retrieval_rpc._call_as_user`` with the HNSW knob on and the 60 s probe cache cold — the exact
state the 2026-10-31 burst hit. Before the fix every pooled connection sat ``idle in transaction``
after ``set_config('app.acting_org_id')`` while its holder waited inside
``get_server_ef_search`` for a second connection.

Also pins, on the real server, the property the fix relies on: ``pg_settings.reset_val`` (the
session default) is NOT changed by a ``SET LOCAL`` in the open transaction, while
``current_setting`` is.
"""
from __future__ import annotations

import asyncio
import uuid

import asyncpg
import pytest

import app.dependencies as deps
import app.services.retrieval_tuning as rt
from app.security.acting_member import acting_org_scope
from app.services.retrieval_rpc import _call_as_user
from tests.integration._rls_harness import PG_TEST_DSN, requires_pg

pytestmark = requires_pg

POOL_MAX = 2
CONCURRENCY = 8
DEADLINE_S = 15.0


@pytest.fixture
async def small_pool(monkeypatch):
    pool = await asyncpg.create_pool(
        PG_TEST_DSN, min_size=0, max_size=POOL_MAX, init=deps._init_pg_connection
    )
    monkeypatch.setattr(deps, "_pg_pool", pool)
    rt._reset_server_ef_cache()
    try:
        yield pool
    finally:
        rt._reset_server_ef_cache()
        pool.terminate()


@pytest.mark.asyncio
@pytest.mark.parametrize("acting", [True, False], ids=["mcp-acting-org", "app-chat-search"])
async def test_concurrent_searches_on_a_real_small_pool_complete(small_pool, acting):
    uid = str(uuid.uuid4())

    async def one():
        if acting:
            with acting_org_scope(str(uuid.uuid4())):
                return await _call_as_user(uid, "SELECT 1 AS x", hnsw_ef_search=40)
        return await _call_as_user(uid, "SELECT 1 AS x", hnsw_ef_search=40)

    tasks = [asyncio.create_task(one()) for _ in range(CONCURRENCY)]
    done, pending = await asyncio.wait(tasks, timeout=DEADLINE_S)
    for t in pending:
        t.cancel()
    await asyncio.gather(*pending, return_exceptions=True)
    assert not pending, (
        f"{len(pending)}/{CONCURRENCY} searches on a {POOL_MAX}-connection pool were still waiting "
        f"after {DEADLINE_S}s: pool deadlock"
    )
    assert all(t.result() == [{"x": 1}] for t in done)


@pytest.mark.asyncio
async def test_reset_val_is_the_session_default_under_set_local(small_pool):
    async with deps.get_user_pg_connection(None, {"id": str(uuid.uuid4())}) as conn:
        # make sure the vector extension's GUCs are registered in this session
        await conn.execute("SELECT '[1]'::public.vector")
        before = await conn.fetchval(
            "SELECT reset_val FROM pg_catalog.pg_settings WHERE name = 'hnsw.ef_search'"
        )
        await conn.execute("SELECT set_config('hnsw.ef_search', $1, true)", "177")
        assert await conn.fetchval("SELECT current_setting('hnsw.ef_search', true)") == "177"
        after = await conn.fetchval(
            "SELECT reset_val FROM pg_catalog.pg_settings WHERE name = 'hnsw.ef_search'"
        )
        probed = await rt.get_server_ef_search(conn, force_refresh=True)
    assert before is not None and after == before
    assert probed == int(before)
