"""Phase 110 SC#2/SC#3 (CI half) — live audit-enum subset drift guard.

Calls the SAME shared ``assert_action_types_synced(pool)`` from audit_service
that the main.py boot guard calls (single source of truth — no second parse to
drift). RED on drift, BEFORE deploy, without waiting for a boot crash. Plus a
second assertion that VALID_ACTION_TYPES is exactly the 19 expected strings.

Live-DB harness modeled on test_092_harness_audit_live.py. Skips cleanly when
:54322 is unreachable.

NOTE: until migration 071 is applied (Plan 02), the live CHECK has only the
original 11 — so ``assert_action_types_synced`` RAISES (the 8 new frozenset
strings are not yet a subset). That is expected for THIS plan; this test goes
GREEN against the migrated DB in Plan 02.
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
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live audit drift-guard test",
)


# The 19 expected action types (original 11 + the 8 D-110-1 strings).
_EXPECTED_19 = frozenset({
    "document.upload", "document.delete", "search.query",
    "code.execute", "skill.load", "thread.create",
    "thread.delete", "settings.update",
    "memory.remember", "memory.recall",
    "feedback.submit",
    "view.create", "view.delete",
    "relationship.create", "relationship.delete",
    "classification.apply", "classification.rule.create",
    "metadata.update", "metadata.field.create",
})


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
async def test_valid_action_types_subset_of_live_check(pg_pool):
    """SC#2/SC#3 (CI): the shared guard passes (no raise) when the frozenset is a
    subset of the live CHECK; RED on drift. Single source of truth with the boot
    guard.
    """
    from app.services.audit_service import assert_action_types_synced
    await assert_action_types_synced(pg_pool)  # raises RuntimeError on drift → RED


def test_valid_action_types_is_exactly_19():
    """The frozenset is exactly the 19 expected strings (no DB needed)."""
    from app.services.audit_service import VALID_ACTION_TYPES
    assert VALID_ACTION_TYPES == _EXPECTED_19, (
        f"VALID_ACTION_TYPES != expected 19; "
        f"missing={sorted(_EXPECTED_19 - VALID_ACTION_TYPES)}, "
        f"extra={sorted(VALID_ACTION_TYPES - _EXPECTED_19)}"
    )
    assert len(VALID_ACTION_TYPES) == 19
