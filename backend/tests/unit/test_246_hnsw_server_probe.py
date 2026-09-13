"""Phase 246 (RECALL-02 / SEED-268 / D-246-05) — Server Setting Probe & Strict Fence Suite.

Tests verify:
1. Probe isolation & SET LOCAL non-poisoning (Finding 2a).
2. 60-second TTL cache expiry against live ALTER SYSTEM changes (Finding 2c).
3. Non-40 server simulation (64) issues statement when user selects 40 (closing SEED-268).
4. Matching server setting (200) skips statement (no-op shortcut).
5. Null/missing pgvector GUC fallback (Finding 2b).
6. retrieval_service.py strict fence assertion (D-246-01: 0 lines touched).
"""

from __future__ import annotations

import asyncio
import subprocess
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


def test_retrieval_service_is_byte_unchanged():
    """D-246-01 Strict Fence: retrieval_service.py must remain 100% byte-untouched in Phase 246.

    This prevents triggering its 3rd G-5 landing (19/11/456).
    """
    repo_root = Path(__file__).resolve().parents[3]
    target_file = repo_root / "backend" / "app" / "services" / "retrieval_service.py"
    assert target_file.is_file(), f"File not found: {target_file}"

    # Run git diff against origin/develop or HEAD~ commits to verify retrieval_service.py is clean
    res = subprocess.run(
        ["git", "diff", "--name-only", "origin/develop", "--", str(target_file)],
        capture_output=True,
        text=True,
        cwd=str(repo_root),
    )
    assert res.returncode == 0
    assert res.stdout.strip() == "", (
        f"VIOLATION OF D-246-01: backend/app/services/retrieval_service.py has uncommitted or "
        f"branch modifications: {res.stdout.strip()}"
    )
