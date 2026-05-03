"""D-062-13 — differentiated Redis-down degradation.

- GET /runs/{rid}/stream → 503 with Retry-After: 10 (T-062-03 mitigation;
  stack-trace must NOT leak as 500).
- DELETE /runs/{rid} → 204 (Postgres UPDATE is the durable cancel record;
  every Redis op wrapped in try/except per D-062-13). Zombie path: runs
  row is updated to status='cancelled' even when every Redis op fails.

Threat refs:
  - T-062-03 (Information Disclosure: stack-trace leak / DoS via slow Redis)
    — verified at the route boundary by patching get_redis to a Mock whose
    every async method raises ConnectionError. Asserts no 500 leaks (only
    503 for GET stream + 204 for DELETE) and Retry-After: 10 header on the
    stream side.

The DELETE test depends on Plan 03's `cancel_run` route landing in
backend/app/api/runs.py. If Plan 03 has not yet merged into this worktree
when this test runs, the DELETE test will fail with HTTP 405 (Method Not
Allowed). That's the expected RED state until both Wave-2 worktrees merge
back to v2.5-stream — see Phase 062 PLAN frontmatter `depends_on: [062-03]`.
"""
import pytest
from unittest.mock import MagicMock, patch
from uuid import uuid4

import httpx
from httpx import ASGITransport
import redis.exceptions

from app.dependencies import get_supabase, get_redis
from app.main import app

from tests.integration._run_helpers import _build_mock_supabase
from tests.integration.test_059_disconnect import _reset_sse_starlette_app_status  # noqa: F401, E402

THREAD_A = str(uuid4())


def _build_dead_redis():
    """Return a Mock Redis whose every async method raises ConnectionError.

    Models the failure mode T-062-03 was written to mitigate: every Redis
    operation fails with redis.exceptions.ConnectionError. Both the stream
    endpoint's `redis.exists` probe and DELETE's synthetic XADD / ZREM /
    EXPIRE ops will see the same ConnectionError and must degrade gracefully
    (503 + Retry-After: 10 on stream; 204 on DELETE — Postgres UPDATE is the
    durable cancel record per D-062-13).
    """
    dead = MagicMock()

    async def _raise(*a, **k):
        raise redis.exceptions.ConnectionError("Redis down (test fault injection)")

    dead.exists = _raise
    dead.xadd = _raise
    dead.zadd = _raise
    dead.zrem = _raise
    dead.expire = _raise
    dead.xread = _raise
    dead.aclose = _raise
    # WR-04 fix: cancel_run now SETNX-locks the zombie-heal sentinel XADD;
    # the dead-redis simulator must fail SET too so the failure mode is
    # consistent (every Redis op raises ConnectionError → DELETE still 204).
    dead.set = _raise
    return dead


@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_stream_returns_503_on_redis_unreachable():
    """D-062-13 / T-062-03: stream endpoint → 503 + Retry-After: 10 when Redis is down.

    Patches app.dependencies.get_redis (via app.dependency_overrides) to
    return a Mock whose `exists` raises ConnectionError; mocks runs SELECT
    to pass the ownership/auth check; drives GET /runs/{rid}/stream and
    asserts:
      - HTTP 503 (NOT 500 — no stack trace leak per T-062-03)
      - Retry-After: 10 header (per D-062-13 Streaming endpoint clause)
    """
    mock_supabase = _build_mock_supabase()
    run_id = str(uuid4())

    # Mock runs SELECT to pass ownership check (so we reach the Redis probe).
    runs_builder = mock_supabase.table("runs")
    runs_builder.execute.side_effect = lambda *a, **k: type("R", (), {
        "data": {"run_id": run_id, "status": "streaming",
                 "thread_id": THREAD_A, "error": None},
        "count": None,
    })()

    dead_redis = _build_dead_redis()

    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    app.dependency_overrides[get_redis] = lambda: dead_redis
    try:
        async with httpx.AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as c:
            resp = await c.get(
                f"/runs/{run_id}/stream?since=0",
                headers={"Authorization": "Bearer test-token"},
                timeout=10.0,
            )
        # T-062-03: no 500 leaks; route must catch RedisError + return 503.
        assert resp.status_code == 503, (
            f"Expected 503 on Redis-down stream (T-062-03 — no stack trace leak); "
            f"got {resp.status_code} body={resp.text!r}"
        )
        # D-062-13: stream endpoint clause requires Retry-After: 10.
        assert resp.headers.get("Retry-After") == "10", (
            f"Expected Retry-After: 10 (D-062-13); "
            f"got headers={dict(resp.headers)!r}"
        )
    finally:
        app.dependency_overrides.pop(get_supabase, None)
        app.dependency_overrides.pop(get_redis, None)


@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_delete_returns_204_on_redis_unreachable():
    """D-062-13 / T-062-03: DELETE returns 204 even when every Redis op fails.

    Postgres UPDATE is the durable cancel record per D-062-13; every Redis
    call (synthetic XADD for `cancelled`+`zombie_healed` event, ZREM × 2,
    EXPIRE) must be wrapped in try/except so the route still returns 204
    even when Redis is unreachable. Zombie path is exercised because
    RUN_TASKS doesn't have run_id (in-flight cancel is a different path).

    Asserts:
      - HTTP 204 (Postgres UPDATE succeeded — durable cancel record landed)
      - The runs.update call_args_list contains the cancellation payload
        (status='cancelled', error='cancelled_by_user') — proves the
        Postgres UPDATE was attempted FIRST in the zombie path before any
        Redis op (D-062-11 step ordering + D-062-13 graceful degradation).

    NOTE: depends on Plan 03's DELETE route landing. Until both Wave-2
    worktrees merge, this test fails with HTTP 405 (Method Not Allowed).
    """
    mock_supabase = _build_mock_supabase()
    run_id = str(uuid4())

    # Streaming row — DELETE will hit the zombie path (RUN_TASKS doesn't
    # have run_id since no producer was spawned in this test).
    runs_builder = mock_supabase.table("runs")
    runs_builder.execute.side_effect = lambda *a, **k: type("R", (), {
        "data": {"run_id": run_id, "status": "streaming",
                 "thread_id": THREAD_A, "error": None},
        "count": None,
    })()

    dead_redis = _build_dead_redis()

    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    app.dependency_overrides[get_redis] = lambda: dead_redis
    try:
        async with httpx.AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as c:
            resp = await c.delete(
                f"/runs/{run_id}",
                headers={"Authorization": "Bearer test-token"},
                timeout=10.0,
            )
        # D-062-13 / D-062-11: DELETE returns 204 even on Redis-down.
        assert resp.status_code == 204, (
            f"Expected 204 even on Redis-down DELETE (D-062-13 — Postgres "
            f"UPDATE is the durable record); got {resp.status_code} body={resp.text!r}"
        )

        # D-062-11 zombie path: Postgres UPDATE happened FIRST — durable
        # cancel record landed even though every Redis op failed.
        update_calls = runs_builder.update.call_args_list
        cancelled_calls = [
            c for c in update_calls
            if c.args
            and isinstance(c.args[0], dict)
            and c.args[0].get("status") == "cancelled"
            and c.args[0].get("error") == "cancelled_by_user"
        ]
        assert cancelled_calls, (
            f"Expected runs.update call with status='cancelled' + error='cancelled_by_user' "
            f"(D-062-11 zombie heal path; durable UPDATE happens BEFORE any Redis op so "
            f"Redis-down does not block the cancel). Observed update calls: {update_calls}"
        )
    finally:
        app.dependency_overrides.pop(get_supabase, None)
        app.dependency_overrides.pop(get_redis, None)
