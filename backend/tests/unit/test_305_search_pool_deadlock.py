"""BUG-261031-03 — concurrent searches deadlocked the asyncpg pool.

Measured 2026-10-31 on the local stack: 32 concurrent MCP ``search_knowledge_base`` calls left all
10 pooled connections ``idle in transaction`` (last statement ``set_config('app.acting_org_id')``)
and the rest hung for minutes. The holder's coroutine chain, dumped live:

    retrieval_rpc._call_as_user            (holds an RLS connection, transaction open)
      -> retrieval_tuning.apply_hnsw_session_knobs
        -> retrieval_tuning.get_server_ef_search   (cache cold: conn is in a transaction ...)
          -> get_pg_pool().fetchval(...)            (... so it asks the pool for a SECOND one)
            -> asyncpg Pool._acquire_impl -> Queue.get   (waits forever)

So once ``concurrency >= pool max_size`` and the 60 s probe cache is cold, every connection is held
by a caller waiting for one more. The path is the app's own retrieval RPC, so the in-app chat search
shares it; MCP only adds the acting-org GUC (the last setup statement seen in pg_stat_activity).

These tests drive the REAL ``_call_as_user`` -> ``get_user_pg_connection`` ->
``_apply_rls_user_context`` -> ``apply_hnsw_session_knobs`` -> ``get_server_ef_search`` chain over a
pool that behaves like asyncpg's (a bounded queue of connections; ``pool.fetchval`` acquires one).
A deadlock fails the ``wait_for`` instead of hanging the run.
"""
from __future__ import annotations

import asyncio
import uuid
from contextlib import asynccontextmanager

import pytest

import app.dependencies as deps
import app.services.retrieval_tuning as rt
from app.security.acting_member import acting_org_scope
from app.services.retrieval_rpc import _call_as_user

POOL_MAX = 2
CONCURRENCY = 6
DEADLINE_S = 5.0


class _Conn:
    def __init__(self, pool: "_BoundedPool", n: int):
        self._pool = pool
        self.n = n
        self._in_txn = False
        self.local: dict[str, str] = {}

    def is_in_transaction(self) -> bool:
        return self._in_txn

    @asynccontextmanager
    async def transaction(self):
        # asyncpg: a nested ``transaction()`` is a SAVEPOINT; only the outermost one ends the
        # transaction (305-REVIEW LF-01/LF-02 wrap each tuning statement in one).
        nested = self._in_txn
        self._in_txn = True
        try:
            yield
        finally:
            if not nested:
                self._in_txn = False
                self.local.clear()  # SET LOCAL reverts at COMMIT

    async def execute(self, sql: str, *args):
        await asyncio.sleep(0)  # a real round trip yields to the loop
        if "set_config" in sql:
            self.local[sql.split("'")[1]] = str(args[0])
        return "SELECT 1"

    async def fetchval(self, sql: str, *args):
        await asyncio.sleep(0)
        if "reset_val" in sql:
            return self._pool.server_ef  # the session default: SET LOCAL never changes it
        if "current_setting" in sql:
            return self.local.get("hnsw.ef_search", self._pool.server_ef)
        return None

    async def fetch(self, sql: str, *args):
        await asyncio.sleep(0)
        return [{"x": 1}]


class _BoundedPool:
    """asyncpg.Pool's contract that matters here: at most ``max_size`` connections, an acquire
    waits for a free one, and ``pool.fetchval`` acquires one of its own."""

    def __init__(self, max_size: int, server_ef: str = "40"):
        self.server_ef = server_ef
        self._free: asyncio.Queue[_Conn] = asyncio.Queue()
        for i in range(max_size):
            self._free.put_nowait(_Conn(self, i))
        self.holding: dict[int, int] = {}  # task id -> connections held right now
        self.nested = 0  # acquires made by a task that already held one

    @asynccontextmanager
    async def acquire(self):
        task = id(asyncio.current_task())
        if self.holding.get(task, 0) > 0:
            self.nested += 1
        conn = await self._free.get()
        self.holding[task] = self.holding.get(task, 0) + 1
        try:
            yield conn
        finally:
            self.holding[task] -= 1
            self._free.put_nowait(conn)

    async def fetchval(self, sql: str, *args):
        async with self.acquire() as conn:
            return await conn.fetchval(sql, *args)


@pytest.fixture
def pool(monkeypatch):
    p = _BoundedPool(POOL_MAX)

    async def _get_pool():
        return p

    monkeypatch.setattr(deps, "get_pg_pool", _get_pool)
    rt._reset_server_ef_cache()  # the burst arrives with the 60 s probe cache cold
    yield p
    rt._reset_server_ef_cache()


async def _burst(*, acting: bool) -> list:
    uid = str(uuid.uuid4())

    async def one():
        if acting:
            with acting_org_scope(str(uuid.uuid4())):
                return await _call_as_user(uid, "SELECT 1 AS x", hnsw_ef_search=40)
        return await _call_as_user(uid, "SELECT 1 AS x", hnsw_ef_search=40)

    return await asyncio.wait_for(
        asyncio.gather(*(one() for _ in range(CONCURRENCY))), timeout=DEADLINE_S
    )


@pytest.mark.asyncio
@pytest.mark.parametrize("acting", [True, False], ids=["mcp-acting-org", "app-chat-search"])
async def test_searches_beyond_pool_size_all_complete(pool, acting):
    """More concurrent searches than pooled connections must queue, never deadlock."""
    try:
        results = await _burst(acting=acting)
    except asyncio.TimeoutError:
        pytest.fail(
            f"{CONCURRENCY} concurrent _call_as_user calls on a {POOL_MAX}-connection pool did not "
            f"finish in {DEADLINE_S}s: pool deadlock ({pool.nested} nested acquires by a task that "
            "already held a connection)"
        )
    assert results == [[{"x": 1}]] * CONCURRENCY


@pytest.mark.asyncio
async def test_no_task_acquires_a_second_connection_while_holding_one(pool):
    """The structural rule behind the fix: no search holds a pooled connection while it waits for
    another one (that is what starves the pool at concurrency >= max_size)."""
    rt._reset_server_ef_cache()
    async with deps.get_user_pg_connection(None, {"id": str(uuid.uuid4())}) as conn:
        await rt.apply_hnsw_session_knobs(conn, ef_search=200)
    assert pool.nested == 0, "the ef_search probe acquired a second pooled connection"
    # and the probe still did its job: it learnt the server default (40) and cached it
    assert await rt.get_server_ef_search(force_refresh=False) == 40


@pytest.mark.asyncio
async def test_a_failed_in_transaction_probe_is_never_cached(pool, monkeypatch):
    """305-REVIEW LF-01: a probe that errored must not pin ``None`` for the 60 s TTL — the next
    call probes again. (The live suite proves the error cannot abort the caller's transaction.)"""

    async def _boom(sql, *args):
        raise RuntimeError("canceling statement due to statement timeout")

    async with deps.get_user_pg_connection(None, {"id": str(uuid.uuid4())}) as conn:
        monkeypatch.setattr(conn, "fetchval", _boom)
        assert await rt.get_server_ef_search(conn, force_refresh=True) is None
    assert rt._server_ef_cache is None, "a FAILED probe was cached for the TTL"
    assert pool.nested == 0


@pytest.mark.asyncio
async def test_in_transaction_probe_is_not_poisoned_by_a_prior_set_local(pool):
    """D-246-05 kept: a SET LOCAL already on the caller's transaction must not become the cached
    server default. The probe reads the session default, which SET LOCAL never changes."""
    async with deps.get_user_pg_connection(None, {"id": str(uuid.uuid4())}) as conn:
        await conn.execute("SELECT set_config('hnsw.ef_search', $1, true)", "150")
        probed = await rt.get_server_ef_search(conn, force_refresh=True)
    assert probed == 40
    assert pool.nested == 0
