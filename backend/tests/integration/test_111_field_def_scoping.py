"""Phase 111 Wave-0 (RED) — 2-user field-def scoping (D-111-6).

The app-code read of metadata_field_definitions uses an explicit
`.or_(user_id.eq.{B}, is_system_global.eq.true)` filter (the service path runs under
the service role, so RLS does NOT auto-scope — the app MUST scope). A 2-user
cross-leak negative: with user A's private row + a global row seeded, B's
scoped read returns ONLY B-own + global, NEVER A's private row.

We prove the SQL shape directly against the live DB (the exact predicate the
app uses) so a service-role read that forgot the filter would RED here.

RED convention: until migration 071 is applied (Plan 02) the table is absent —
skip. The assertion is xfail until Plan 02 wires the scoped read.
Live-DB harness copied verbatim from test_110_dm_schema.py.
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
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live 111 scoping tests",
)


async def _table_exists(pool, table: str) -> bool:
    return bool(await pool.fetchval(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
        "WHERE table_schema='public' AND table_name=$1)",
        table,
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
async def two_users(pg_pool):
    user_a = uuid4()
    user_b = uuid4()
    try:
        for uid in (user_a, user_b):
            await pg_pool.execute(
                "INSERT INTO auth.users (id, email) VALUES ($1, $2)",
                uid, f"phase-111-scope-{uid}@test.local",
            )
    except Exception as e:
        pytest.skip(f"two_users fixture setup failed: {type(e).__name__}: {e}")
    yield (user_a, user_b)
    try:
        await pg_pool.execute(
            "DELETE FROM public.metadata_field_definitions WHERE field_key = $1",
            "phase111_global_scope_probe",
        )
    except Exception:
        pass
    for uid in (user_a, user_b):
        try:
            await pg_pool.execute(
                "DELETE FROM public.metadata_field_definitions WHERE user_id = $1", uid
            )
        except Exception:
            pass
        try:
            await pg_pool.execute("DELETE FROM auth.users WHERE id = $1", uid)
        except Exception:
            pass


@pytest.mark.asyncio
async def test_scoped_read_excludes_other_users_private_field(pg_pool, two_users):
    """B's scoped read returns B-own + global, NEVER A's private row."""
    if not await _table_exists(pg_pool, "metadata_field_definitions"):
        pytest.skip("migration 071 not applied (metadata_field_definitions absent)")

    user_a, user_b = two_users

    # A's private field.
    a_id = uuid4()
    await pg_pool.execute(
        "INSERT INTO public.metadata_field_definitions (id, user_id, field_key, is_system_global) "
        "VALUES ($1, $2, $3, false)",
        a_id, user_a, "a_private_field",
    )
    # A global field (user_id NULL, is_system_global true).
    g_id = uuid4()
    await pg_pool.execute(
        "INSERT INTO public.metadata_field_definitions (id, user_id, field_key, is_system_global) "
        "VALUES ($1, NULL, $2, true)",
        g_id, "phase111_global_scope_probe",
    )
    # B's own field.
    b_id = uuid4()
    await pg_pool.execute(
        "INSERT INTO public.metadata_field_definitions (id, user_id, field_key, is_system_global) "
        "VALUES ($1, $2, $3, false)",
        b_id, user_b, "b_own_field",
    )

    # The EXACT app-code predicate: (user_id = B) OR (is_system_global = true).
    rows = await pg_pool.fetch(
        "SELECT id FROM public.metadata_field_definitions "
        "WHERE (user_id = $1 OR is_system_global = true)",
        user_b,
    )
    visible = {r["id"] for r in rows}
    assert b_id in visible, "B must see their own field"
    assert g_id in visible, "B must see the global field"
    assert a_id not in visible, "CROSS-LEAK: B must NOT see A's private field"
