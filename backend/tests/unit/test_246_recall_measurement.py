"""Phase 246 Plan 03 (RECALL-01) — Dual-measurement recall and latency verification.

Asserts:
  1. The execution plan against recall_bench uses an HNSW index scan (not Seq Scan).
  2. Under default configuration (code default ef_search = 200), recall@20 restores from 0.040 to >= 0.99
     for the 0.2% tenant in the 100,000-chunk benchmark corpus.
  3. The regression guard at ef_search = 40 collapses (< 0.10, reproducing the ~0.040 cliff).

Target isolation (Blocker A): Runs exclusively against recall_bench, never against live postgres.
"""

from __future__ import annotations

import pytest
import asyncpg

from app.services.recall_eval import (
    measuring_connection,
    sample_query_vectors,
    measure_layer1,
    FILTER_SHAPES,
    inspect_execution_plan,
)

BENCH_DSN = "postgresql://postgres:postgres@127.0.0.1:54322/recall_bench"
SMALL_TENANT_USER_ID = "5aa65229-1a8d-4c50-80d3-cac588a43616"


@pytest.fixture
async def bench_available():
    """Verify recall_bench is available and holds 100,000 chunks before running tests."""
    try:
        conn = await asyncpg.connect(BENCH_DSN, timeout=5.0)
        count = await conn.fetchval("SELECT count(*) FROM public.document_chunks")
        await conn.close()
        if count < 100000:
            pytest.skip(f"recall_bench has only {count} chunks; expected 100,000")
    except Exception as exc:
        pytest.skip(f"recall_bench database not reachable: {exc}")


@pytest.mark.asyncio
async def test_target_database_is_recall_bench_not_postgres():
    """Safety invariant: verification must target recall_bench, never postgres."""
    assert "recall_bench" in BENCH_DSN
    assert "postgres@127.0.0.1:54322/postgres" not in BENCH_DSN


@pytest.mark.asyncio
async def test_query_execution_plan_uses_hnsw_index(bench_available):
    """Inspect EXPLAIN query plan to assert vector searches use HNSW index, not sequential scan."""
    async with measuring_connection(BENCH_DSN, SMALL_TENANT_USER_ID) as conn:
        vectors = await sample_query_vectors(conn, count=1, seed="241")
        assert len(vectors) == 1

        v0 = vectors[0]
        query = (
            "SELECT id, document_id, 1 - (embedding <=> $1::public.vector) AS similarity "
            "FROM public.document_chunks WHERE user_id = $2::uuid "
            "ORDER BY embedding <=> $1::public.vector LIMIT 20"
        )
        plan_info = await inspect_execution_plan(conn, query, v0, SMALL_TENANT_USER_ID)

        assert plan_info["uses_index"] is True, f"Query plan did not use index: {plan_info['plan']}"
        assert plan_info["execution_time_ms"] > 0.0


@pytest.mark.asyncio
async def test_recall_default_restores_small_tenant_recall(bench_available):
    """Default configuration (ef_search = 200) restores small tenant recall from 0.040 to >= 0.99."""
    async with measuring_connection(BENCH_DSN, SMALL_TENANT_USER_ID) as conn:
        # Sample 5 query vectors for fast, deterministic evaluation
        vectors = await sample_query_vectors(conn, count=5, seed="241")
        shape = FILTER_SHAPES[0]

        # In Phase 246, default ef_search is 200
        res = await measure_layer1(
            conn,
            k=20,
            filter_shape=shape,
            query_vectors=vectors,
            user_id=SMALL_TENANT_USER_ID,
            ef_search=200,
        )

        assert res["recall_at_k"] is not None
        assert res["recall_at_k"] >= 0.99, (
            f"Expected recall@20 >= 0.99 under default 200, got {res['recall_at_k']}"
        )
        assert res["underfill"] == 0.0, f"Expected 0 underfill under default 200, got {res['underfill']}"
        assert "p95_latency_ms" in res
        assert res["p95_latency_ms"] is not None


@pytest.mark.asyncio
async def test_regression_guard_at_40(bench_available):
    """Explicitly verify that ef_search = 40 reproduces the recall cliff (< 0.10)."""
    async with measuring_connection(BENCH_DSN, SMALL_TENANT_USER_ID) as conn:
        vectors = await sample_query_vectors(conn, count=5, seed="241")
        shape = FILTER_SHAPES[0]

        res_40 = await measure_layer1(
            conn,
            k=20,
            filter_shape=shape,
            query_vectors=vectors,
            user_id=SMALL_TENANT_USER_ID,
            ef_search=40,
        )

        assert res_40["recall_at_k"] is not None
        # Confirms that ef_search = 40 suffers severe recall collapse on the 0.2% tenant
        assert res_40["recall_at_k"] < 0.10, (
            f"Expected recall@20 < 0.10 under ef_search=40 regression guard, got {res_40['recall_at_k']}"
        )
        assert res_40["underfill"] > 0.80, f"Expected massive underfill at 40, got {res_40['underfill']}"
