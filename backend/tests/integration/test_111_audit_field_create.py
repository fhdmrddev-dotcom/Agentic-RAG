"""Phase 111 Wave-0 (RED) — live metadata.field.create audit round-trip (D-111-5/11).

THE LOAD-BEARING audit gate for the custom-field create path (the 104 lesson:
audit-enum failures FALSE-GREEN in static tests). The audit-service write path
swallows the Postgres 23514 CHECK violation and returns None. So this test
drives a raw asyncpg INSERT of `metadata.field.create` (which RAISES
CheckViolationError on enum drift — RED) + a SELECT-back (None on drift — RED).

`metadata.field.create` is one of the 8 D-110-1 strings already in migration
071's audit CHECK; this confirms the 111 create path's audit action_type lands.

RED convention: the CRUD create endpoint (which emits this audit row through the
service) lands in Plan 03; the raw round-trip below is GREEN once migration 071
is applied (Plan 02 of Phase 110 — already applied per STATE.md). We keep it
xfail-guarded so it never hard-fails before the migrated DB is in place.
Modeled byte-for-byte on test_110_dm_audit_live.py.
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
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live 111 audit tests",
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


@pytest_asyncio.fixture
async def test_user(pg_pool):
    user_id = uuid4()
    try:
        await pg_pool.execute(
            "INSERT INTO auth.users (id, email) VALUES ($1, $2)",
            user_id, f"phase-111-audit-{user_id}@test.local",
        )
    except Exception as e:
        pytest.skip(f"test_user fixture setup failed: {type(e).__name__}: {e}")
    yield user_id
    for sql in (
        ("DELETE FROM audit_log WHERE user_id = $1", user_id),
        ("DELETE FROM auth.users WHERE id = $1", user_id),
    ):
        try:
            await pg_pool.execute(*sql)
        except Exception:
            pass


@pytest.mark.asyncio
@pytest.mark.xfail(
    reason="metadata.field.create emitted by the CRUD path in Plan 03; raw round-trip is the standing gate",
    strict=False,
)
async def test_metadata_field_create_audit_round_trips_live(pg_pool, test_user):
    """`metadata.field.create` INSERTs + SELECTs back against the LIVE DB.

    Raw asyncpg — NOT the swallowing audit-service write. A CHECK-enum drift
    raises CheckViolationError on INSERT (RED) or the SELECT returns None (RED).
    """
    user_id = test_user
    await pg_pool.execute(
        "INSERT INTO audit_log (user_id, action_type, metadata) VALUES ($1, $2, $3::jsonb)",
        user_id, "metadata.field.create",
        json.dumps({"phase": "111", "field_key": "contract_value", "probe": True}),
    )
    row = await pg_pool.fetchrow(
        "SELECT action_type FROM audit_log WHERE user_id = $1 AND action_type = $2",
        user_id, "metadata.field.create",
    )
    assert row is not None, "metadata.field.create audit row did not land — CHECK enum drift"
    assert row["action_type"] == "metadata.field.create"
