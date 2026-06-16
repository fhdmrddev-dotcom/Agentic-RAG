"""Phase 111.1 Wave-0 (RED) — match_document_chunks excludes stale-model chunks (D-10).

After migration 073, `match_document_chunks` takes a `p_embedding_model` parameter
and filters `AND (p_embedding_model IS NULL OR dc.embedding_model = p_embedding_model)`.
During a half-finished re-embed, chunks still tagged with the OLD model are excluded
from results — the graceful-dip recall reduction — so the search NEVER compares
across two vector spaces (Pitfall 2). RLS scope `dc.user_id = match_user_id` is kept.

Live proof; GREEN once migration 073 is applied (Plan 04 [BLOCKING]). RED convention:
live-DB harness verbatim; behavioral assertions xfail(strict=False); skips cleanly
when :54322 is unreachable.
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
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live 111.1 match-filter tests",
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


async def _function_has_param(pool, fn_name: str, param: str) -> bool:
    return bool(await pool.fetchval(
        "SELECT EXISTS (SELECT 1 FROM pg_proc p "
        "JOIN pg_namespace n ON n.oid = p.pronamespace "
        "WHERE n.nspname='public' AND p.proname=$1 "
        "AND pg_get_function_arguments(p.oid) LIKE '%' || $2 || '%')",
        fn_name, param,
    ))


@pytest.mark.asyncio
@pytest.mark.xfail(
    reason="match_document_chunks gains p_embedding_model in migration 073 (Plan 04 D-10)",
    strict=False,
)
async def test_match_function_has_embedding_model_param(pg_pool):
    assert await _function_has_param(pg_pool, "match_document_chunks", "p_embedding_model"), (
        "match_document_chunks must take p_embedding_model after migration 073 (Plan 04)"
    )


@pytest.mark.asyncio
@pytest.mark.xfail(
    reason="stale-model exclusion proven with live fixtures in Plan 03/04 (D-10)",
    strict=False,
)
async def test_stale_model_chunks_excluded(pg_pool):
    """A chunk tagged with the OLD embedding_model is excluded when p_embedding_model = current."""
    assert False, "stale-model exclusion end-to-end proof pending Plan 03/04 fixtures"
