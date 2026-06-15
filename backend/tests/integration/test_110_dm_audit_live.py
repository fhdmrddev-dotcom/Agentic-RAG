"""Phase 110 SC#4 — live audit round-trip over all 8 new DM action types.

THE LOAD-BEARING GATE for the audit lockstep (Shared Pattern A).

The audit-service write path swallows the Postgres 23514 CHECK violation and
returns None (D-05). A ``VALID_ACTION_TYPES`` string absent from the live CHECK
would therefore drop SILENTLY — the exact silent-audit-drop trap this phase
exists to remove. So this test NEVER goes through the swallowing service write
path (its return is always None). It drives a raw asyncpg INSERT (which raises
``CheckViolationError`` on drift — RED) + SELECT-back (returns None on drift —
RED) over EACH of the 8 D-110-1 strings. The 8 ARE the population, so we
parametrize over all of them.

Modeled byte-for-byte on test_092_harness_audit_live.py's live-DB harness
(PG_AVAILABLE skipif + function-scoped pg_pool + seeded auth.users fixture).
Skips cleanly (never errors) when local Postgres :54322 is unreachable.

NOTE: even when :54322 IS up, this SKIPS/REDs until migration 071 is applied
(Plan 02) — the CHECK does not yet carry the 8 new strings. That is expected
for THIS plan; the gate requires GREEN against the migrated DB in Plan 02.
"""

import asyncio
import json
import os
from uuid import uuid4

import asyncpg
import pytest
import pytest_asyncio


# The 8 D-110-1 locked-vocabulary strings — downstream phases (111-119) consume
# these as-is. Lockstep with migration 071's audit CHECK array AND
# audit_service.VALID_ACTION_TYPES's Phase-110 block.
NEW_DM_ACTION_TYPES = frozenset({
    "view.create", "view.delete",
    "relationship.create", "relationship.delete",
    "classification.apply", "classification.rule.create",
    "metadata.update", "metadata.field.create",
})


_POSTGRES_TEST_DSN = os.environ.get(
    "POSTGRES_DSN",
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
)


async def _pg_reachable(dsn: str = _POSTGRES_TEST_DSN) -> bool:
    """Probe local Postgres availability without raising. Used by skipif guard."""
    try:
        conn = await asyncio.wait_for(asyncpg.connect(dsn), timeout=2.0)
        await conn.close()
        return True
    except Exception:
        return False


def _check_pg_available_sync() -> bool:
    """Synchronous wrapper for the async probe (used by pytest.mark.skipif)."""
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
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live DM audit integration tests",
)


@pytest_asyncio.fixture
async def pg_pool():
    """Function-scoped real asyncpg pool against local Postgres :54322.

    Function scope (NOT session) is REQUIRED — pytest-asyncio creates a fresh
    event loop per test, and asyncpg pools are loop-bound.
    """
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


@pytest_asyncio.fixture
async def test_thread_user(pg_pool):
    """Seed a throwaway auth.users + threads pair; clean up afterward.

    audit_log.user_id FKs auth.users(id) ON DELETE CASCADE — so a REAL
    auth.users row is required for the INSERT. Yields (thread_id, user_id).
    Teardown deletes the audit probes (Phase 110 extension) before the user.
    """
    user_id = uuid4()
    thread_id = uuid4()
    try:
        await pg_pool.execute(
            "INSERT INTO auth.users (id, email) VALUES ($1, $2)",
            user_id, f"phase-110-{user_id}@test.local",
        )
        await pg_pool.execute(
            "INSERT INTO threads (id, user_id, title) VALUES ($1, $2, $3)",
            thread_id, user_id, "phase-110 audit test thread",
        )
    except Exception as e:
        pytest.skip(f"test_thread_user fixture setup failed: {type(e).__name__}: {e}")
    yield (thread_id, user_id)
    # FK-safe teardown. Phase 110 extension: DELETE the audit probes first
    # (audit_log.user_id FKs auth.users ON DELETE CASCADE, but delete explicitly
    # to keep the table clean and not rely on cascade ordering).
    for sql in (
        ("DELETE FROM audit_log WHERE user_id = $1", user_id),
        ("DELETE FROM threads WHERE id = $1", thread_id),
        ("DELETE FROM auth.users WHERE id = $1", user_id),
    ):
        try:
            await pg_pool.execute(*sql)
        except Exception:
            pass


@pytest.mark.asyncio
@pytest.mark.parametrize("action_type", sorted(NEW_DM_ACTION_TYPES))
async def test_dm_audit_type_round_trips_live(pg_pool, test_thread_user, action_type):
    """SC#4: each new DM action_type INSERTs + SELECTs back against the LIVE DB.

    Raw asyncpg — NOT the swallowing audit-service write (swallows 23514 + returns None).
    A CHECK-enum drift raises CheckViolationError on INSERT (RED) or the SELECT
    returns None (RED). Mock-proof by construction.
    """
    _thread_id, user_id = test_thread_user
    await pg_pool.execute(
        "INSERT INTO audit_log (user_id, action_type, metadata) VALUES ($1, $2, $3::jsonb)",
        user_id, action_type, json.dumps({"phase": "110", "probe": True}),
    )
    row = await pg_pool.fetchrow(
        "SELECT action_type FROM audit_log WHERE user_id = $1 AND action_type = $2",
        user_id, action_type,
    )
    assert row is not None, f"audit row for {action_type} did not land — CHECK enum drift"
    assert row["action_type"] == action_type
