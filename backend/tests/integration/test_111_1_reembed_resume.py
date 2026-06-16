"""Phase 111.1 Wave-0 (RED) — re-embed job resumable + non-destructive (EMBED-05 / D-05).

The background re-embed job must be:
  - RESUMABLE: each pass re-selects chunks where embedding_model != current, so a
    crashed/partial run picks up where it left off on the next kick.
  - NON-DESTRUCTIVE: the old vector is kept until the replacement is written (never
    delete-then-embed), so a failed run never leaves the corpus worse than partial.

The job lands in Plan 05. Live proof; GREEN once migration 073 is applied (Plan 04)
AND the job exists (Plan 05). RED convention: live-DB harness verbatim; behavioral
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
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live 111.1 re-embed tests",
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
    reason="re-embed job lands in Plan 05 (EMBED-05 / D-05)",
    strict=False,
)
async def test_reembed_job_is_resumable(pg_pool):
    """A partial run re-selects the still-stale chunks on the next pass."""
    from app.services.reembed_service import reembed_job  # noqa: F401

    assert False, "resumable re-embed proof pending Plan 05 job + fixtures"


@pytest.mark.asyncio
@pytest.mark.xfail(
    reason="re-embed job lands in Plan 05 (EMBED-05 / D-05)",
    strict=False,
)
async def test_reembed_job_is_non_destructive(pg_pool):
    """The old vector survives until its replacement is written (no delete-then-embed)."""
    from app.services.reembed_service import reembed_job  # noqa: F401

    assert False, "non-destructive re-embed proof pending Plan 05 job + fixtures"
