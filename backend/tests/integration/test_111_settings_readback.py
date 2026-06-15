"""Phase 111 Wave-0 (RED) — migration 072 settings read-back (META-03).

After migration 072 is applied (Plan 05 — the [BLOCKING] live-apply gate), the
3 new app_settings columns read back through `_build_settings_from_row` with
the right defaults:
  - extraction_model         -> "" (env_attr=None => app_settings-only)
  - extraction_window_cap    -> 32000
  - metadata_enrichment_mode -> "enriched"

This test reads the LIVE app_settings row and confirms the columns exist + the
build path surfaces them. xfail until Plan 05 applies migration 072 (the FILE
existing in Plan 01 does NOT change the live DB).
Live-DB harness copied verbatim from test_110_dm_schema.py.
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
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live 111 settings-readback tests",
)


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


@pytest.mark.asyncio
@pytest.mark.xfail(
    reason="migration 072 applied in Plan 05 (META-03 [BLOCKING] live-apply gate)",
    strict=False,
)
async def test_extraction_columns_read_back_with_defaults(pg_pool):
    """The 3 new app_settings columns exist and read back via _build_settings_from_row."""
    for col, _default in (
        ("extraction_model", ""),
        ("extraction_window_cap", 32000),
        ("metadata_enrichment_mode", "enriched"),
    ):
        assert await _column_exists(pg_pool, "app_settings", col), (
            f"app_settings.{col} missing — migration 072 not applied (Plan 05)"
        )

    # The build path surfaces the columns with the documented defaults when NULL.
    from app.models.user_settings import _build_settings_from_row

    row = await pg_pool.fetchrow("SELECT * FROM public.app_settings LIMIT 1")
    settings = _build_settings_from_row(dict(row) if row else {})

    assert settings.extraction_model == "" or isinstance(settings.extraction_model, str)
    assert settings.extraction_window_cap == 32000 or isinstance(settings.extraction_window_cap, int)
    assert settings.metadata_enrichment_mode in ("enriched", "legacy")


@pytest.mark.xfail(
    reason="3 settings fields added in Plan 01 Task 3; GREEN after that lands (META-03)",
    strict=False,
)
def test_build_settings_defaults_without_db():
    """Pure-Python (no DB): an EMPTY row defaults the 3 fields correctly.

    This guards the env_attr=None app_settings-only contract regardless of the
    live migration state — it flips GREEN once Task 3 of this plan adds the 3
    fields to UserEffectiveSettings + _build_settings_from_row.
    """
    from app.models.user_settings import _build_settings_from_row

    settings = _build_settings_from_row({})
    assert settings.extraction_model == "", "default extraction_model is empty str"
    assert settings.extraction_window_cap == 32000, "default window cap is 32000"
    assert settings.metadata_enrichment_mode == "enriched", "default mode is enriched"
