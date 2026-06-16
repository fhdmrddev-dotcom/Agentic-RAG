"""Phase 111.1 Wave-0 (RED) — resize_embedding_column resizes + rebuilds HNSW (EMBED-05).

`resize_embedding_column(new_dim)` (already defined, never called) must:
  - DROP the HNSW index,
  - ALTER document_chunks.embedding TYPE vector(new_dim) (USING NULL),
  - rebuild the HNSW index.

Migration 073 re-declares it as the source of truth (CREATE OR REPLACE). It is wired
into the re-embed job (Plan 05) and only called on a true dims change.

Live proof; GREEN once migration 073 is applied (Plan 04). Tested against a COPY of
the corpus, never the live :54322 corpus (Assumption A4 — USING NULL wipes vectors).
RED convention: live-DB harness verbatim; behavioral assertions xfail(strict=False);
skips cleanly when :54322 is unreachable.
"""

import asyncio
import json
import os

import asyncpg
import pytest
import pytest_asyncio


_POSTGRES_TEST_DSN = os.environ.get(
    "POSTGRES_DSN",
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
)


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
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live 111.1 resize tests",
)


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


async def _function_exists(pool, fn_name: str) -> bool:
    return bool(await pool.fetchval(
        "SELECT EXISTS (SELECT 1 FROM pg_proc p "
        "JOIN pg_namespace n ON n.oid = p.pronamespace "
        "WHERE n.nspname='public' AND p.proname=$1)",
        fn_name,
    ))


@pytest.mark.asyncio
@pytest.mark.xfail(
    reason="resize_embedding_column re-declared + live-verified in migration 073 / Plan 04/05 (EMBED-05)",
    strict=False,
)
async def test_resize_embedding_column_exists(pg_pool):
    assert await _function_exists(pg_pool, "resize_embedding_column"), (
        "resize_embedding_column must exist (re-declared in migration 073, Plan 04)"
    )


@pytest.mark.asyncio
@pytest.mark.xfail(
    reason="resize-on-a-corpus-copy proof lands in Plan 05 (EMBED-05; Assumption A4)",
    strict=False,
)
async def test_resize_rebuilds_hnsw_on_a_copy(pg_pool):
    """Against a COPY of document_chunks, resize alters the column + rebuilds the HNSW index."""
    assert False, "resize-on-copy proof pending Plan 05 (never run on the live corpus)"
