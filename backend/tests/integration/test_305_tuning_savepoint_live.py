"""305-REVIEW LF-01 / LF-02 — LIVE: an HNSW tuning error degrades the TUNING, never the SEARCH.

Read-only: no row is written. A dedicated asyncpg pool of ``max_size=2`` (never the app's) is
installed as the ``get_pg_pool`` singleton, as in ``test_305_search_pool_deadlock_live.py``.

Both arms run on the caller's own RLS transaction (``get_user_pg_connection``), which is where
``retrieval_rpc._call_as_user`` runs every probe and every ``SET LOCAL``. In Postgres an error inside
a transaction aborts it, so a caught error that is "swallowed" still fails the NEXT statement with
``InFailedSQLTransactionError`` — the search. Each arm drives that, then asserts the statement after
the failure still runs.

* LF-01: the in-transaction ``ef_search`` probe (554fe5235) fails -> the search must still answer,
  and the failure must not be cached for 60 s.
* LF-02: a ``SET LOCAL`` the server rejects (a value out of pgvector's range; an ``hnsw.*`` name the
  installed pgvector does not define, the pre-0.8 ``hnsw.iterative_scan`` shape) -> ``_set_local``
  returns False AND the transaction stays usable. And a ``SET LOCAL`` that succeeds inside its
  savepoint is still in force after the savepoint is released (the tuning is not silently undone).
"""
from __future__ import annotations

import uuid

import asyncpg
import pytest

import app.dependencies as deps
import app.services.retrieval_tuning as rt
from app.services.retrieval_rpc import _call_as_user
from tests.integration._rls_harness import PG_TEST_DSN, requires_pg

pytestmark = requires_pg


@pytest.fixture
async def small_pool(monkeypatch):
    pool = await asyncpg.create_pool(
        PG_TEST_DSN, min_size=0, max_size=2, init=deps._init_pg_connection
    )
    monkeypatch.setattr(deps, "_pg_pool", pool)
    rt._reset_server_ef_cache()
    try:
        yield pool
    finally:
        rt._reset_server_ef_cache()
        pool.terminate()


# ── LF-01: the in-transaction probe ────────────────────────────────────────────────────────────


async def test_a_failing_probe_does_not_abort_the_search(small_pool, monkeypatch):
    """The probe statement errors inside the caller's transaction. The search after it must run."""
    monkeypatch.setattr(rt, "_SQL_EF_SEARCH_SESSION_DEFAULT", "SELECT 1/0")  # any server-side error
    rows = await _call_as_user(str(uuid.uuid4()), "SELECT 1 AS x", hnsw_ef_search=200)
    assert rows == [{"x": 1}]


async def test_a_failing_probe_is_not_cached(small_pool, monkeypatch):
    monkeypatch.setattr(rt, "_SQL_EF_SEARCH_SESSION_DEFAULT", "SELECT 1/0")
    async with deps.get_user_pg_connection(None, {"id": str(uuid.uuid4())}) as conn:
        assert await rt.get_server_ef_search(conn, force_refresh=True) is None
        assert await conn.fetchval("SELECT 1") == 1  # the transaction is still usable
    assert rt._server_ef_cache is None, "a FAILED probe was pinned for the TTL"


async def test_a_successful_in_transaction_probe_still_reads_the_session_default(small_pool):
    async with deps.get_user_pg_connection(None, {"id": str(uuid.uuid4())}) as conn:
        await conn.execute("SELECT '[1]'::public.vector")  # register pgvector's GUCs
        await conn.execute("SELECT set_config('hnsw.ef_search', $1, true)", "177")
        probed = await rt.get_server_ef_search(conn, force_refresh=True)
        assert await conn.fetchval("SELECT current_setting('hnsw.ef_search', true)") == "177"
    assert probed is not None and probed != 177


# ── LF-02: a rejected SET LOCAL ────────────────────────────────────────────────────────────────


async def test_a_rejected_value_leaves_the_transaction_usable(small_pool):
    async with deps.get_user_pg_connection(None, {"id": str(uuid.uuid4())}) as conn:
        await conn.execute("SELECT '[1]'::public.vector")  # load pgvector so it validates the value
        applied = await rt._set_local(conn, rt._SQL_EF_SEARCH, "0", guc="hnsw.ef_search")
        assert applied is False
        assert await conn.fetchval("SELECT 1") == 1


async def test_an_hnsw_name_the_server_does_not_define_is_tuning_unavailable(small_pool):
    """pgvector reserves the ``hnsw.`` prefix once loaded, so a name it does not define (what
    ``hnsw.iterative_scan`` is below 0.8) raises 42602 ``InvalidNameError``. It must degrade the
    tuning, not propagate and not abort the search. (pgvector is 0.8.0 locally and in production,
    so this arm is latent today.)"""
    async with deps.get_user_pg_connection(None, {"id": str(uuid.uuid4())}) as conn:
        await conn.execute("SELECT '[1]'::public.vector")
        applied = await rt._set_local(
            conn, "SELECT set_config('hnsw.no_such_knob_lf02', $1, true)", "on",
            guc="hnsw.no_such_knob_lf02",
        )
        assert applied is False
        assert await conn.fetchval("SELECT 1") == 1


async def test_a_set_local_that_succeeds_is_still_in_force_after_its_savepoint(small_pool):
    """The savepoint must not undo the tuning: a released savepoint keeps its SET LOCAL until the
    outer transaction ends."""
    async with deps.get_user_pg_connection(None, {"id": str(uuid.uuid4())}) as conn:
        await conn.execute("SELECT '[1]'::public.vector")
        assert await rt._set_local(conn, rt._SQL_EF_SEARCH, "123", guc="hnsw.ef_search") is True
        assert await conn.fetchval("SELECT current_setting('hnsw.ef_search', true)") == "123"


async def test_apply_knobs_with_a_rejected_knob_still_answers_the_search(small_pool, monkeypatch):
    """End to end on the real call path: every knob statement rejected, the search still runs."""
    monkeypatch.setattr(rt, "_SQL_ITERATIVE_SCAN", "SELECT set_config('hnsw.no_such_knob_lf02b', $1, true)")
    rt._set_server_ef_cache(40)
    uid = str(uuid.uuid4())
    async with deps.get_user_pg_connection(None, {"id": uid}) as conn:
        await conn.execute("SELECT '[1]'::public.vector")
        await rt.apply_hnsw_session_knobs(conn, ef_search=200, iterative_scan="relaxed_order")
        assert await conn.fetchval("SELECT current_setting('hnsw.ef_search', true)") == "200"
        assert await conn.fetchval("SELECT 1") == 1
