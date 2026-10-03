"""Phase 246 (RECALL-02 / SEED-268 / D-246-05) — Server Setting Probe & Strict Fence Suite.

Tests verify:
1. Probe isolation & SET LOCAL non-poisoning (Finding 2a).
2. 60-second TTL cache expiry against live ALTER SYSTEM changes (Finding 2c).
3. Non-40 server simulation (64) issues statement when user selects 40 (closing SEED-268).
4. Matching server setting (200) skips statement (no-op shortcut).
5. Null/missing pgvector GUC fallback (Finding 2b).
6. retrieval_service.py strict fence (D-246-01) — RETIRED deliberately by 272-01; see the test body.
"""

from __future__ import annotations

import asyncio
import time
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import asyncpg
import pytest

import app.services.retrieval_tuning as rt


class _MockTxConnection:
    """Simulates an asyncpg connection that tracks in_transaction state and statements."""

    def __init__(self, server_guc: str = "40"):
        self.server_guc = server_guc
        self.local_guc: str | None = None
        self._in_txn = False
        self.calls: list[tuple[str, tuple]] = []

    def is_in_transaction(self) -> bool:
        return self._in_txn

    async def execute(self, sql: str, *args):
        self.calls.append((sql, args))
        if "set_config" in sql:
            # sql is like SELECT set_config('hnsw.ef_search', $1, true)
            self.local_guc = str(args[0])
        return "SELECT 1"

    async def fetchval(self, sql: str, *args):
        self.calls.append((sql, args))
        if "current_setting" in sql:
            # If in transaction and local GUC was set via SET LOCAL, return local_guc
            if self._in_txn and self.local_guc is not None:
                return self.local_guc
            return self.server_guc
        return None

    def begin(self):
        self._in_txn = True

    def rollback(self):
        self._in_txn = False
        self.local_guc = None  # SET LOCAL auto-reverts on rollback / commit


class _MockPool:
    """Simulates asyncpg.Pool acquiring clean connections outside borrower transactions."""

    def __init__(self, server_guc: str = "40"):
        self.server_guc = server_guc
        self.fetchval_calls: list[str] = []

    async def fetchval(self, sql: str, *args):
        self.fetchval_calls.append(sql)
        if "current_setting" in sql:
            return self.server_guc
        return None


@pytest.fixture(autouse=True)
def clean_cache():
    """Ensure every test starts with an uninitialized cache."""
    rt._reset_server_ef_cache()
    yield
    rt._reset_server_ef_cache()


@pytest.mark.asyncio
async def test_probe_not_poisoned_by_prior_set_local():
    """Finding 2a / D-246-05: SET LOCAL on a borrower connection does NOT poison the probe.

    A borrower connection that executed SET LOCAL hnsw.ef_search = 150 inside a transaction
    auto-reverts upon rollback/commit. The pool-level probe queries on a clean connection
    outside the transaction and reads the true server default (40), not 150.
    """
    pool = _MockPool(server_guc="40")
    conn = _MockTxConnection(server_guc="40")

    # Simulate transaction running SET LOCAL
    conn.begin()
    await conn.execute("SELECT set_config('hnsw.ef_search', $1, true)", "150")
    assert conn.local_guc == "150"
    # An unsafe probe inside this transaction would see the poisoned 150
    assert await conn.fetchval("SELECT current_setting('hnsw.ef_search', true)") == "150"

    # The official probe queries via pool (or clean connection) outside the transaction
    probed = await rt.get_server_ef_search(conn=conn, pool=pool, force_refresh=True)
    assert probed == 40, f"Probe was poisoned by prior SET LOCAL: got {probed}, expected 40"

    # When transaction rolls back, conn itself reverts
    conn.rollback()
    assert await conn.fetchval("SELECT current_setting('hnsw.ef_search', true)") == "40"


@pytest.mark.asyncio
async def test_server_probe_ttl_expiry():
    """Finding 2c / D-246-05: Probe caches for 60s, then expires to reflect live ALTER SYSTEM."""
    pool = _MockPool(server_guc="40")

    start_time = 1000.0
    with patch("time.monotonic", return_value=start_time):
        val1 = await rt.get_server_ef_search(pool=pool)
        assert val1 == 40
        assert len(pool.fetchval_calls) == 1

    # At t = 1030s (within 60s TTL), should return cached value without querying pool
    with patch("time.monotonic", return_value=start_time + 30.0):
        val2 = await rt.get_server_ef_search(pool=pool)
        assert val2 == 40
        assert len(pool.fetchval_calls) == 1  # No new fetchval call

    # Operator alters Postgres setting live: ALTER SYSTEM SET hnsw.ef_search = 64
    pool.server_guc = "64"

    # At t = 1061s (after 60s TTL), cache has expired and re-queries
    with patch("time.monotonic", return_value=start_time + 61.0):
        val3 = await rt.get_server_ef_search(pool=pool)
        assert val3 == 64
        assert len(pool.fetchval_calls) == 2  # Re-probed!


@pytest.mark.asyncio
async def test_non_40_server_issues_statement_when_user_sets_40():
    """SEED-268 / RECALL-02: On a server whose native default is 64, selecting 40 issues SET LOCAL.

    The old hardcoded shortcut saw 40 == _SERVER_DEFAULT_EF_SEARCH (40) and issued NOTHING,
    leaving the search running at 64. The dynamic probe discovers 64, sees 40 != 64,
    and issues SET LOCAL hnsw.ef_search = 40.
    """
    rt._set_server_ef_cache(64)
    conn = _MockTxConnection(server_guc="64")
    conn.begin()

    await rt.apply_hnsw_session_knobs(conn, ef_search=40)

    # SET LOCAL hnsw.ef_search = 40 MUST be in conn.calls!
    set_calls = [sql for sql, args in conn.calls if "set_config" in sql and "hnsw.ef_search" in sql]
    assert len(set_calls) == 1, f"Expected 1 SET LOCAL call, got: {conn.calls}"
    assert conn.local_guc == "40"


@pytest.mark.asyncio
async def test_matching_server_setting_skips_statement():
    """No-op shortcut: when requested ef_search equals the server's setting, issue nothing."""
    rt._set_server_ef_cache(200)
    conn = _MockTxConnection(server_guc="200")
    conn.begin()

    await rt.apply_hnsw_session_knobs(conn, ef_search=200)

    set_calls = [sql for sql, args in conn.calls if "set_config" in sql and "hnsw.ef_search" in sql]
    assert len(set_calls) == 0, f"Expected 0 SET LOCAL calls, got: {conn.calls}"


@pytest.mark.asyncio
async def test_null_pgvector_guc_falls_back_cleanly():
    """Finding 2b: If pgvector is not loaded and current_setting returns NULL, returns None."""
    pool = _MockPool(server_guc=None)

    val = await rt.get_server_ef_search(pool=pool, force_refresh=True)
    assert val is None

    # Connection executing apply_hnsw_session_knobs with None server setting issues SET LOCAL as fail-safe
    conn = _MockTxConnection()
    conn.begin()
    await rt.apply_hnsw_session_knobs(conn, ef_search=200)
    set_calls = [sql for sql, args in conn.calls if "set_config" in sql and "hnsw.ef_search" in sql]
    assert len(set_calls) == 1


def test_retrieval_service_fence_retired_by_272_01():
    """RETIRED DELIBERATELY by 272-01 (SEED-177: retire a fence deliberately, never trip it by surprise).

    D-246-01 was a Phase-246-only strict fence: ``retrieval_service.py`` had to stay byte-untouched
    so Phase 246 would not become its 3rd G-5 landing (19/11/456) without proposing the owed
    extraction. 272-01 discharged the extraction it protected — the RPC adapter moved verbatim to
    ``retrieval_rpc.py`` — so the file now legitimately differs. The old body also compared against
    ``origin/develop`` and would stay red until develop is pushed, which proves nothing either way.

    What it asserts instead are the discharge facts this probe module depends on: the knob call
    site now lives in ``retrieval_rpc`` and ``retrieval_service`` no longer defines it.
    """
    import inspect

    import app.services.retrieval_rpc as rrpc
    import app.services.retrieval_service as rs

    repo_root = Path(__file__).resolve().parents[3]
    service_src = (repo_root / "backend" / "app" / "services" / "retrieval_service.py").read_text(
        encoding="utf-8"
    )
    assert "async def _call_as_user" not in service_src, (
        "retrieval_service.py defines _call_as_user again — the 272-01 extraction was undone"
    )
    assert "async def _call_as_user" in inspect.getsource(rrpc)
    assert "apply_hnsw_session_knobs" in inspect.getsource(rrpc._call_as_user)
    # The back-compat name is a re-export of the moved function, not a second definition.
    assert rs._call_as_user is rrpc._call_as_user
