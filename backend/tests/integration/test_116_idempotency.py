"""Phase 116 Wave-0 — SC#1 idempotency LIVE scaffold (Plan 02 target).

The duplicate-create guarantee (D-116-6) proven against live :54322: creating the
SAME `(source, target, rel_type)` twice yields ONE row and returns the existing edge
— no 409, no duplicate, no error. Migration 075's additive partial unique index is
the race-immune backstop; `create_relationship`'s 23505-catch re-fetches the existing
edge. (Note: the live index is applied by Plan 04 — until then this proves the
SELECT-then-INSERT / catch logic; with the index it also proves race-immunity.)

Skips cleanly when local Postgres is unreachable. Imports inside the test bodies.
"""

import asyncio
import os

import pytest

try:
    import asyncpg
except ImportError:  # pragma: no cover
    asyncpg = None


_POSTGRES_TEST_DSN = os.environ.get(
    "POSTGRES_DSN",
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
)


async def _pg_reachable(dsn: str = _POSTGRES_TEST_DSN) -> bool:
    if asyncpg is None:
        return False
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
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live 116 idempotency test",
)


@pytest.mark.xfail(strict=False, reason="Plan 02 ships idempotent create_relationship")
@pytest.mark.asyncio
async def test_duplicate_create_returns_existing_one_row():
    """Same (source,target,rel_type) twice → one row, returns existing (no 409, no dup)."""
    from app.services import document_relationship_service as svc  # noqa: F401

    # The seed-two-docs / create-twice / assert-one-row structure ships in Plan 02.
    assert hasattr(svc, "create_relationship")
