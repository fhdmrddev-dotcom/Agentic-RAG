"""Phase 111.1 Wave-0 (RED) — re-embed job stays RLS-scoped (EMBED-05 / V4 SECURITY).

The background re-embed job MUST scope every read + write to `eq("user_id", user_id)`
(matching the `dc.user_id = match_user_id` RLS clause in match_document_chunks). A
re-embed kicked for user A must NEVER touch user B's chunks — a cross-user re-embed
is a tampering/integrity boundary (V4 threat).

The job lands in Plan 05. Live proof; this is the SECURITY backstop verifying the job
never widens its scope. RED convention: live-DB harness verbatim; behavioral
assertions xfail(strict=False); skips cleanly when :54322 is unreachable.
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
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live 111.1 re-embed RLS tests",
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


@pytest.mark.asyncio
@pytest.mark.xfail(
    reason="re-embed job + RLS-scope proof land in Plan 05 (EMBED-05 / V4)",
    strict=False,
)
async def test_reembed_never_touches_another_users_chunks(pg_pool):
    """A re-embed for user A leaves user B's chunks (and their embedding_model tags) untouched."""
    from app.services.reembed_service import reembed_job  # noqa: F401

    assert False, "cross-user re-embed isolation proof pending Plan 05 job + two-user fixtures"
