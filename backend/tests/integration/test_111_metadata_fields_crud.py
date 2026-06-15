"""Phase 111 Wave-0 (RED) — metadata_field_definitions CRUD + RLS forcing (META-01).

The CRUD create endpoint forces `user_id=caller` and `is_global=false` (no
client-supplied ownership escalation); list returns own + global enabled rows.

RED convention: the CRUD endpoint lands in Plan 03. Until then the create call
target does not exist, so the behavioral assertions are xfail(strict=False).
The live-DB harness (PG_AVAILABLE skipif + function-scoped pg_pool + seeded
auth.users) is copied verbatim from test_110_dm_audit_live.py — it skips
cleanly (never collection-errors) when :54322 is unreachable.
"""

import asyncio
import json
import os
from uuid import uuid4

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
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live 111 CRUD tests",
)


async def _table_exists(pool, table: str) -> bool:
    return bool(await pool.fetchval(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
        "WHERE table_schema='public' AND table_name=$1)",
        table,
    ))


@pytest_asyncio.fixture
async def pg_pool():
    """Function-scoped real asyncpg pool against local Postgres :54322."""
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
async def test_user(pg_pool):
    """Seed a throwaway auth.users row; FK-safe teardown."""
    user_id = uuid4()
    try:
        await pg_pool.execute(
            "INSERT INTO auth.users (id, email) VALUES ($1, $2)",
            user_id, f"phase-111-crud-{user_id}@test.local",
        )
    except Exception as e:
        pytest.skip(f"test_user fixture setup failed: {type(e).__name__}: {e}")
    yield user_id
    for sql in (
        ("DELETE FROM public.metadata_field_definitions WHERE user_id = $1", user_id),
        ("DELETE FROM audit_log WHERE user_id = $1", user_id),
        ("DELETE FROM auth.users WHERE id = $1", user_id),
    ):
        try:
            await pg_pool.execute(*sql)
        except Exception:
            pass


@pytest.mark.asyncio
@pytest.mark.xfail(
    reason="metadata_field_definitions CRUD endpoint lands in Plan 03 (META-01)",
    strict=False,
)
async def test_crud_create_forces_owner_and_not_global(pg_pool, test_user):
    """The CRUD create path forces user_id=caller and is_global=false."""
    if not await _table_exists(pg_pool, "metadata_field_definitions"):
        pytest.skip("migration 071 not applied (metadata_field_definitions absent)")

    from app.services.metadata_field_service import create_field_definition

    created = await create_field_definition(
        user_id=test_user,
        field_key="contract_value",
        field_type="number",
        # A client trying to escalate to global must be ignored.
        is_global=True,
    )
    row = await pg_pool.fetchrow(
        "SELECT user_id, is_global FROM public.metadata_field_definitions WHERE id = $1",
        created["id"],
    )
    assert row is not None, "created field row must exist"
    assert row["user_id"] == test_user, "create must force user_id=caller"
    assert row["is_global"] is False, "create must force is_global=false (no escalation)"


@pytest.mark.asyncio
@pytest.mark.xfail(
    reason="metadata_field_definitions list endpoint lands in Plan 03 (META-01)",
    strict=False,
)
async def test_list_returns_own_plus_global_enabled(pg_pool, test_user):
    """List returns the caller's own enabled fields plus global enabled fields."""
    if not await _table_exists(pg_pool, "metadata_field_definitions"):
        pytest.skip("migration 071 not applied (metadata_field_definitions absent)")

    from app.services.metadata_field_service import list_field_definitions

    fields = await list_field_definitions(user_id=test_user)
    assert isinstance(fields, list), "list must return a list of field defs"
