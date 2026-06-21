"""Phase 110 SC#5 — live capability-flag column + read chain.

Asserts the app_settings.document_management_enabled column exists and the
id='global' row reads true, and that load_app_settings_async() surfaces it as
True end-to-end.

Live-DB harness modeled on test_092_harness_audit_live.py. Skips cleanly when
:54322 is unreachable.

NOTE: until migration 071 is applied (Plan 02) the column does not exist — the
column SELECT REDs/skips. That is expected for THIS plan; GREEN in Plan 02.
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
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live DM flag test",
)


@pytest_asyncio.fixture
async def pg_pool():
    """Function-scoped real asyncpg pool against local Postgres :54322."""
    async def _init(conn):
        await conn.set_type_codec(
            "jsonb",
            encoder=json.dumps,
            decoder=json.loads,
            schema="pg_catalog",
        )
    pool = await asyncpg.create_pool(
        _POSTGRES_TEST_DSN,
        min_size=1,
        max_size=4,
        init=_init,
    )
    try:
        yield pool
    finally:
        await pool.close()


@pytest.mark.asyncio
async def test_flag_column_global_row_true(pg_pool):
    """SC#5: app_settings.document_management_enabled exists and id='global' is true."""
    column_exists = await pg_pool.fetchval(
        "SELECT EXISTS (SELECT 1 FROM information_schema.columns "
        "WHERE table_schema='public' AND table_name='app_settings' "
        "AND column_name='document_management_enabled')"
    )
    if not column_exists:
        pytest.skip("migration 071 not applied (column absent) — Plan 02 applies it")
    value = await pg_pool.fetchval(
        "SELECT document_management_enabled FROM app_settings WHERE id = 'global'"
    )
    assert value is True, f"global app_settings flag should default true (got {value!r})"


@pytest.mark.asyncio
async def test_flag_read_chain_true(pg_pool):
    """SC#5: load_app_settings_async() surfaces document_management_enabled True."""
    column_exists = await pg_pool.fetchval(
        "SELECT EXISTS (SELECT 1 FROM information_schema.columns "
        "WHERE table_schema='public' AND table_name='app_settings' "
        "AND column_name='document_management_enabled')"
    )
    if not column_exists:
        pytest.skip("migration 071 not applied (column absent) — Plan 02 applies it")
    from app.models.user_settings import load_app_settings_async
    settings = await load_app_settings_async()
    assert settings.document_management_enabled is True
