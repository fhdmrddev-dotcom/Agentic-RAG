"""Phase 116 Wave-0 — SC#1 version-stability LIVE scaffold (Plan 02 target).

Read-time follow-to-latest (REL-01): a relationship stored against a document
RESOLVES to the LATEST accessible version at read time, so after a re-upload (a new
version) OR a restore, the link still points at the current document. This is why the
link is resolved via `_resolve_readable_latest` over `(user_id, filename, is_latest)`
rather than pinned to a frozen doc id — renaming-to-latest is impossible today, so
the filename+is_latest tuple is the stable handle (the read-time resolution lock).

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
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live 116 version-stability test",
)


@pytest.mark.xfail(strict=False, reason="Plan 02 ships read-time _resolve_readable_latest")
@pytest.mark.asyncio
async def test_link_follows_latest_version_after_reupload():
    """After a new version (is_latest flips), the resolver maps the link to the LATEST row."""
    from app.services import document_relationship_service as svc

    # The seed v1 / link / upload v2 / re-resolve structure ships in Plan 02 — it asserts
    # `_resolve_readable_latest` returns the v2 row (is_latest=True) for the same filename.
    assert hasattr(svc, "_resolve_readable_latest")
