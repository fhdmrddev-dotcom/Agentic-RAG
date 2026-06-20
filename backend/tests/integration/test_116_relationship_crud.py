"""Phase 116 Wave-0 — SC#1 relationship CRUD LIVE scaffold (Plan 02/03 target).

Drives the service + (later) router against live :54322:
  * POST create a typed link between two visible-to-caller docs → row lands.
  * The visible-both gate rejects an UNSEEABLE endpoint (422) — checked BEFORE the
    self-link / CHECK so there is no ordering oracle (a probe can't distinguish
    "unseeable" from "self-link" by error shape).
  * Self-link (source == target) rejected (422, the no_self_rel CHECK / model guard).
  * DELETE removes the row; a cross-user / absent id → 404-not-403 (own-scoped delete
    collapses a miss to False).

Skips cleanly when local Postgres is unreachable (`_pg_reachable` 2s-timeout guard,
cloned from test_115_tool_global_leak.py). Imports are inside the test bodies so
collection never errors on the not-yet-built service / router while RED.
"""

import asyncio
import os
from uuid import uuid4

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
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live 116 CRUD test",
)


@pytest.mark.xfail(strict=False, reason="Plan 02/03 ship create + delete + visible-both gate")
@pytest.mark.asyncio
async def test_create_self_link_and_cross_user_delete():
    """Create a valid link; reject self-link + unseeable endpoint (422); 404-not-403 on cross-user delete."""
    from app.services import document_relationship_service as svc  # noqa: F401

    # The full seed/create/assert structure ships in Plan 02 (service) + Plan 03 (router).
    # Placeholder assert keeps the RED scaffold honest until then.
    assert hasattr(svc, "create_relationship")
    assert hasattr(svc, "delete_relationship")
