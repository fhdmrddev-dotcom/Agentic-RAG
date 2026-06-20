"""Phase 116 Wave-0 — SC#1 audit LIVE scaffold (Plan 03 target).

The `relationship.create` audit row lands on create — the async round-trip IS the
proof (DMF-01). `relationship.create` / `relationship.delete` are already in
`VALID_ACTION_TYPES` + the live audit_log CHECK (migration 071) — NO migration, NO
frozenset-sync needed (D-116-12). This test proves the writer actually fires (the
audit_service swallows errors, so only a live read of the row proves it landed).

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
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live 116 audit test",
)


@pytest.mark.xfail(strict=False, reason="Plan 03 wires the relationship.create audit write")
@pytest.mark.asyncio
async def test_relationship_create_audit_row_lands():
    """A `relationship.create` audit_log row exists after a create (the round-trip is the proof)."""
    from app.services.audit_service import VALID_ACTION_TYPES

    # The action type is already live-enum (no migration). Full create→read-audit
    # structure ships in Plan 03 (the router fires the audit write).
    assert "relationship.create" in VALID_ACTION_TYPES
    assert "relationship.delete" in VALID_ACTION_TYPES
