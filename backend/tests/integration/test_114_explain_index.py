"""Phase 114 Plan 03 — SC#3 EXPLAIN index-use proof on the typed columns (~10k seed).

Proves the btree indexes from migration 074 are actually USED by the planner — an
Index Scan / Bitmap Index Scan, NOT a Seq Scan — for the two hot virtual-folder
filter shapes:

  - a date RANGE on `date_typed`  (`>= CURRENT_DATE AND <= CURRENT_DATE + 90`)
  - an exact `document_type_norm = '<value>'`

CRITICAL: the planner picks a SEQ SCAN on a tiny table regardless of indexes (the dev
DB is only ~33 docs). So this test SEEDS ~10k synthetic `documents` rows under a
THROWAWAY user, runs `ANALYZE documents` so the planner has real stats, captures the
EXPLAIN plan, asserts an index scan, then DELETES every seeded row and asserts the
real document count is unchanged. The seed/EXPLAIN/teardown is fully isolated to the
throwaway user_id — the real ~33-doc dataset is never touched.

Live-DB harness mirrors test_114_typed_columns.py (skips cleanly when :54322 is down).
"""

import asyncio
import json
import os
from datetime import date, timedelta
from uuid import uuid4

import asyncpg
import pytest
import pytest_asyncio


_POSTGRES_TEST_DSN = os.environ.get(
    "POSTGRES_DSN",
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
)

_SEED_N = 10_000  # ~10k rows so the planner prefers an index over a seq scan (SC#3)


async def _pg_reachable(dsn: str = _POSTGRES_TEST_DSN) -> bool:
    try:
        conn = await asyncio.wait_for(asyncpg.connect(dsn), timeout=2.0)
        await conn.close()
        return True
    except Exception:
        return False


def _check_pg_available_sync() -> bool:
    import asyncio as _a
    try:
        loop = _a.new_event_loop()
        try:
            return loop.run_until_complete(_pg_reachable())
        finally:
            loop.close()
    except Exception:
        return False


PG_AVAILABLE = _check_pg_available_sync()
pytestmark = pytest.mark.skipif(
    not PG_AVAILABLE,
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live 114 EXPLAIN test",
)


async def _table_exists(pool, table: str) -> bool:
    return bool(await pool.fetchval(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
        "WHERE table_schema='public' AND table_name=$1)",
        table,
    ))


async def _column_exists(pool, table: str, column: str) -> bool:
    return bool(await pool.fetchval(
        "SELECT EXISTS (SELECT 1 FROM information_schema.columns "
        "WHERE table_schema='public' AND table_name=$1 AND column_name=$2)",
        table, column,
    ))


@pytest_asyncio.fixture
async def pg_pool():
    async def _init(conn):
        await conn.set_type_codec(
            "jsonb", encoder=json.dumps, decoder=json.loads, schema="pg_catalog",
        )
    pool = await asyncpg.create_pool(
        _POSTGRES_TEST_DSN, min_size=1, max_size=4, init=_init,
    )
    try:
        yield pool
    finally:
        await pool.close()


@pytest_asyncio.fixture
async def seeded_10k(pg_pool):
    """Seed ~10k throwaway docs (varied document_type + ISO dates), ANALYZE, then
    FULLY delete them and assert the real document count is preserved.

    Isolation: all rows belong to one throwaway user_id. The data-preservation guard
    captures the real total before/after and asserts it is unchanged.
    """
    if not await _table_exists(pg_pool, "documents"):
        pytest.skip("documents table absent")
    if not await _column_exists(pg_pool, "documents", "date_typed"):
        pytest.fail(
            "migration 074 not applied (date_typed absent) — "
            "run scripts/apply_migration_074.py first (Plan 03 [BLOCKING] step)"
        )

    user_id = uuid4()
    real_total_before = await pg_pool.fetchval("SELECT count(*) FROM documents")
    try:
        await pg_pool.execute(
            "INSERT INTO auth.users (id, email) VALUES ($1, $2)",
            user_id, f"phase-114-explain-{user_id}@test.local",
        )
    except Exception as e:
        pytest.skip(f"seed user setup failed: {type(e).__name__}: {e}")

    types = ["invoice", "report", "contract", "memo", "receipt"]
    today = date.today()
    try:
        # Bulk insert via COPY-style executemany for speed. Spread dates across a wide
        # window so the date-range predicate is genuinely selective (index-worthy).
        records = []
        for i in range(_SEED_N):
            doc_id = uuid4()
            dtype = types[i % len(types)]
            # dates from ~today-365 to ~today+365 → the [today, today+90] window
            # selects a small slice (selective → index scan preferred).
            d = today + timedelta(days=(i % 730) - 365)
            records.append((
                doc_id, user_id, f"seed-{i}.txt", f"{user_id}/{doc_id}.txt",
                100, "text/plain", "completed",
                {"document_type": dtype, "date": d.isoformat()},
            ))
        await pg_pool.executemany(
            "INSERT INTO documents (id, user_id, filename, file_path, file_size, "
            "mime_type, status, metadata, is_latest, version_number) "
            "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,1)",
            records,
        )
        # Real planner stats — without ANALYZE the planner may still seq-scan.
        await pg_pool.execute("ANALYZE documents")
        yield user_id
    finally:
        await pg_pool.execute("DELETE FROM documents WHERE user_id = $1", user_id)
        await pg_pool.execute("DELETE FROM auth.users WHERE id = $1", user_id)
        await pg_pool.execute("ANALYZE documents")  # restore stats to the real dataset
        real_total_after = await pg_pool.fetchval("SELECT count(*) FROM documents")
        assert real_total_after == real_total_before, (
            f"DATA PRESERVATION FAILED — real documents {real_total_before} -> "
            f"{real_total_after} (seed cleanup must not touch real rows)"
        )


def _plan_text(rows) -> str:
    # EXPLAIN returns one column ('QUERY PLAN'); join all lines.
    return "\n".join(r[0] for r in rows)


def _uses_index(plan: str, index_name: str) -> bool:
    """True if the plan uses the named index via an Index/Bitmap Index Scan (not Seq)."""
    return (
        index_name in plan
        and ("Index Scan" in plan or "Bitmap Index Scan" in plan or "Index Only Scan" in plan)
    )


@pytest.mark.asyncio
async def test_explain_date_range_uses_btree_index(pg_pool, seeded_10k):
    """SC#3: a date_typed RANGE uses idx_documents_date_typed (NOT a Seq Scan) at ~10k."""
    user_id = seeded_10k
    rows = await pg_pool.fetch(
        "EXPLAIN SELECT id FROM public.documents "
        "WHERE user_id = $1 AND is_latest = true "
        "  AND date_typed >= CURRENT_DATE AND date_typed <= CURRENT_DATE + 90",
        user_id,
    )
    plan = _plan_text(rows)
    assert _uses_index(plan, "idx_documents_date_typed"), (
        "expected an Index/Bitmap Index Scan on idx_documents_date_typed, got:\n" + plan
    )
    assert "Seq Scan on documents" not in plan, (
        "the date-range query must NOT fall back to a Seq Scan at ~10k rows:\n" + plan
    )


@pytest.mark.asyncio
async def test_explain_document_type_eq_uses_btree_index(pg_pool, seeded_10k):
    """SC#3: document_type_norm = '<v>' uses idx_documents_document_type_norm (not Seq)."""
    user_id = seeded_10k
    rows = await pg_pool.fetch(
        "EXPLAIN SELECT id FROM public.documents "
        "WHERE user_id = $1 AND is_latest = true AND document_type_norm = 'invoice'",
        user_id,
    )
    plan = _plan_text(rows)
    assert _uses_index(plan, "idx_documents_document_type_norm"), (
        "expected an Index/Bitmap Index Scan on idx_documents_document_type_norm, got:\n" + plan
    )
    assert "Seq Scan on documents" not in plan, (
        "the document_type_norm equality query must NOT Seq Scan at ~10k rows:\n" + plan
    )
