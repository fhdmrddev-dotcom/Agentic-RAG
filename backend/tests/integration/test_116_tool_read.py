"""Phase 116 Wave-0 — SC#2 tool read LIVE scaffold (Plan 03 target).

`get_related_documents` returns BOTH directions (outgoing edges where the subject is
the source, and incoming edges where it is the target) with correct inverse labels,
compact rows, and a `source_refs` list — driven through the real handler against live
:54322. The handler scopes every documents leg from the CALLER (the dispatching user)
via the shared `_resolve_readable_latest`.

Skips cleanly when local Postgres is unreachable. Imports inside the test bodies so
collection never errors on the not-yet-built handler while RED.
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
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live 116 tool-read test",
)


@pytest.mark.xfail(strict=False, reason="Plan 03 ships the get_related_documents handler")
@pytest.mark.asyncio
async def test_handler_returns_both_directions_with_source_refs():
    """The handler returns outgoing + incoming edges with inverse labels + source_refs (LIVE)."""
    from app.services.tool_dispatcher import _handle_get_related_documents  # noqa: F401

    # The seed src→tgt link / call handler for both subjects / assert both directions +
    # source_refs structure ships in Plan 03.
    assert callable(_handle_get_related_documents)
