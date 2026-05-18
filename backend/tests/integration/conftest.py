"""Shared integration-test fixtures.

Phase 074 D-074-11: hoists ``_reset_redis_singleton`` from per-file copies in
``test_062_stream_replay.py`` (canonical at :36-51) and
``test_063_post_then_subscribe.py`` (verbatim copy at :45-62). The two local
copies were deleted in this commit; ``test_059_disconnect.py`` now inherits
the same protection that fixes the original SEED-011 fixture-teardown bug
(``RuntimeError: Event loop is closed`` on the second / third test in the file).

Phase 073's ``_reset_pg_pool_singleton`` (lives in ``backend/tests/conftest.py``)
is intentionally NOT hoisted here - Phase 074 D-074-13 keeps it at root scope
because asyncpg pools matter to unit + integration tests alike. Both autouse
fixtures stack additively on every integration test (root -> integration -> file).

``_reset_sse_starlette_app_status`` stays in test_059_disconnect.py per D-074-12
(sse-starlette-specific; co-located version-pin assertion at 2.4.x; already
cross-imported by test_062 and test_063 - moving it would break the import path).
"""
import pytest


@pytest.fixture(autouse=True)
def _reset_redis_singleton():
    """Reset app.dependencies._redis so each test gets a Redis client bound to
    its own per-test event loop (pytest-asyncio function-scope creates a fresh
    loop per test). Without this, a singleton created in test N's loop is
    invoked by test N+1 against a closed loop -> RuntimeError("Event loop is closed").

    Mirrors the rationale of test_059_disconnect's _reset_sse_starlette_app_status
    fixture (RESEARCH.md Pitfall 6) - same loop-binding trap, different module.
    Required for any test that hits the real `get_redis()` singleton (no Redis
    dependency override). Hoisted from per-file copies per Phase 074 D-074-11.
    """
    import app.dependencies as _deps
    _deps._redis = None
    yield
    _deps._redis = None
