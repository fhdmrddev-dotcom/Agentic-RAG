"""Phase 075 Plan 01 ship gate (POLISH-SEED-008-01).

Test surface:
  * happy-path shape — GET /threads/{tid}/snapshot returns
    {messages, active_runs, since_cursors} for the thread owner.
  * T-062-01 mirror — cross-user request → 404, no body leak, runs SELECT
    never called (short-circuit invariant).
  * D-062-13 / D-075-04 mirror — Redis-down → 503 + Retry-After: 10.

Autouse fixture _reset_redis_singleton from conftest.py auto-applies
(per D-074-11). This file does NOT redeclare it.

Mock-supabase pattern mirrors test_063_1_messages_runs_join.py — the runs
table builder's eq()/order() chain is configured per test, then the route
runs the helper extraction (_enrich_messages_with_runs from D-075-03)
against the same mock infrastructure.
"""
import pytest
from unittest.mock import AsyncMock
from uuid import uuid4

import httpx
from httpx import ASGITransport
from redis.exceptions import RedisError

from app.dependencies import get_supabase, get_current_user, get_redis
from app.main import app

from tests.integration._run_helpers import _build_mock_supabase, _make_result, USER_ID

# Stable UUIDs for assertions across tests.
THREAD_A = str(uuid4())
OWNER_USER = {"id": USER_ID, "email": "owner@example.com"}
OTHER_USER = {"id": "00000000-0000-0000-0000-000000000099", "email": "other@example.com"}

USER_MSG_ID = "00000000-0000-0000-0000-0000000000a1"
ASSISTANT_MSG_ID = "00000000-0000-0000-0000-0000000000a2"
RUN_ID = "00000000-0000-0000-0000-0000000000b1"
SINCE_CURSOR = "1731936000000-0"


@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_snapshot_returns_messages_active_runs_cursors():
    """D-075-01 happy path: owner GET /threads/{tid}/snapshot returns
    {messages, active_runs, since_cursors} in one round-trip.

    Mock layout:
      - threads ownership SELECT → row exists (owner match).
      - messages SELECT → 2 messages (user + assistant).
      - runs SELECT (helper merge) → 1 row matching ASSISTANT_MSG_ID.
      - runs SELECT (active_runs) → 1 streaming row with RUN_ID.
      - redis.xinfo_stream → returns synthetic first-entry id.

    Assertions:
      - 200 status.
      - response keys: messages, active_runs, since_cursors.
      - messages length 2; assistant row has run_id + run_status populated.
      - active_runs[0].run_id == RUN_ID.
      - since_cursors[RUN_ID] == SINCE_CURSOR.
    """
    mock_supabase = _build_mock_supabase()

    threads_builder = mock_supabase.table("threads")
    threads_builder.execute.side_effect = lambda *a, **k: _make_result({"id": THREAD_A})

    msgs_builder = mock_supabase.table("messages")
    msgs_builder.execute.side_effect = lambda *a, **k: _make_result([
        {"id": USER_MSG_ID, "thread_id": THREAD_A, "user_id": USER_ID,
         "role": "user", "content": "hi", "created_at": "2026-05-04T00:00:00Z",
         "updated_at": "2026-05-04T00:00:00Z"},
        {"id": ASSISTANT_MSG_ID, "thread_id": THREAD_A, "user_id": USER_ID,
         "role": "assistant", "content": "hello", "created_at": "2026-05-04T00:00:01Z",
         "updated_at": "2026-05-04T00:00:01Z"},
    ])

    # Per-call routing on the runs builder: the route calls runs twice —
    # once for the helper merge (selects run_id, message_id, status) and
    # once for the active_runs SELECT (selects run_id, started_at, status
    # filtered by status='streaming'). Both calls hit the same builder
    # mock so the side_effect cycles between them.
    runs_builder = mock_supabase.table("runs")
    runs_results = [
        # First call: helper merge — returns row matching ASSISTANT_MSG_ID.
        _make_result([
            {"run_id": RUN_ID, "message_id": ASSISTANT_MSG_ID, "status": "streaming"},
        ]),
        # Second call: active_runs SELECT — returns the same run as streaming.
        _make_result([
            {"run_id": RUN_ID, "started_at": "2026-05-04T00:00:01Z", "status": "streaming"},
        ]),
    ]
    runs_call_idx = {"i": 0}

    def _runs_execute(*a, **k):
        i = runs_call_idx["i"]
        runs_call_idx["i"] = min(i + 1, len(runs_results) - 1)
        return runs_results[i]

    runs_builder.execute.side_effect = _runs_execute

    # Mock the redis dependency directly so xinfo_stream returns a synthetic
    # first-entry id. The autouse _reset_redis_singleton fixture protects
    # against loop-binding issues even when we override the dependency.
    mock_redis = AsyncMock()
    mock_redis.xinfo_stream = AsyncMock(return_value={
        "length": 5,
        "first-entry": (SINCE_CURSOR, {b"data": b"{}"}),
        "last-entry": ("1731936000005-0", {b"data": b"{}"}),
    })

    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    app.dependency_overrides[get_current_user] = lambda: OWNER_USER
    app.dependency_overrides[get_redis] = lambda: mock_redis
    try:
        async with httpx.AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as c:
            resp = await c.get(
                f"/threads/{THREAD_A}/snapshot",
                headers={"Authorization": "Bearer test-token"},
            )

        assert resp.status_code == 200, f"got {resp.status_code} body={resp.text}"
        body = resp.json()

        # Shape assertions.
        assert "messages" in body, f"missing 'messages' key: {body!r}"
        assert "active_runs" in body, f"missing 'active_runs' key: {body!r}"
        assert "since_cursors" in body, f"missing 'since_cursors' key: {body!r}"

        # Messages: 2 rows; assistant row has run_id + run_status populated.
        assert len(body["messages"]) == 2, (
            f"Expected 2 messages; got {len(body['messages'])} body={body!r}"
        )
        asst = next(m for m in body["messages"] if m["role"] == "assistant")
        assert asst["run_id"] == RUN_ID, (
            f"Expected assistant run_id={RUN_ID}; got {asst.get('run_id')!r}"
        )
        assert asst["run_status"] == "streaming", (
            f"Expected assistant run_status='streaming'; got {asst.get('run_status')!r}"
        )

        # active_runs: 1 streaming run.
        assert len(body["active_runs"]) == 1, (
            f"Expected 1 active_run; got {len(body['active_runs'])} body={body!r}"
        )
        assert body["active_runs"][0]["run_id"] == RUN_ID, (
            f"Expected active_runs[0].run_id={RUN_ID}; got {body['active_runs'][0]!r}"
        )

        # since_cursors: server-derived from xinfo_stream.
        assert body["since_cursors"].get(RUN_ID) == SINCE_CURSOR, (
            f"Expected since_cursors[{RUN_ID!r}]={SINCE_CURSOR!r}; "
            f"got {body['since_cursors']!r}"
        )

        # xinfo_stream was called for the active run.
        mock_redis.xinfo_stream.assert_called_once()
        call_arg = mock_redis.xinfo_stream.call_args[0][0]
        assert call_arg == f"run:{RUN_ID}", (
            f"Expected xinfo_stream('run:{RUN_ID}'); got {call_arg!r}"
        )
    finally:
        app.dependency_overrides.pop(get_supabase, None)
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_redis, None)


@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_cross_user_returns_404():
    """T-062-01 / D-075-04 mirror: cross-user GET /threads/{tid}/snapshot
    returns 404 from the threads ownership SELECT failure. The route MUST
    short-circuit BEFORE the runs SELECT fires. Response body must contain
    NEITHER the queried thread_id NOR any 'run_id' strings.

    Mirrors test_063_1_messages_runs_join.py:223-256 shape — anti-false-RED
    assertion against the exact HTTPException detail string ensures we don't
    confuse a missing route's default 404 for the route's own short-circuit.
    """
    mock_supabase = _build_mock_supabase()

    # Threads ownership SELECT returns no row (cross-user). Route MUST 404
    # at this point and never touch the runs SELECT.
    threads_builder = mock_supabase.table("threads")
    threads_builder.execute.side_effect = lambda *a, **k: _make_result(None)

    # Track whether the runs SELECT was reached. If it was, the route's
    # ownership-check ordering is broken — the leakage guard must hold even
    # if a future refactor reorders the queries.
    runs_builder = mock_supabase.table("runs")
    runs_execute_called: list = []

    def _runs_execute(*a, **k):
        runs_execute_called.append((a, k))
        return _make_result([])

    runs_builder.execute.side_effect = _runs_execute

    # Redis mock — should never be called since the route 404s before reaching
    # any Redis probe. Configured anyway so accidental invocation doesn't
    # mask the test failure with an unrelated AttributeError.
    mock_redis = AsyncMock()
    mock_redis.xinfo_stream = AsyncMock(return_value=None)

    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    app.dependency_overrides[get_current_user] = lambda: OTHER_USER
    app.dependency_overrides[get_redis] = lambda: mock_redis
    try:
        async with httpx.AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as c:
            resp = await c.get(
                f"/threads/{THREAD_A}/snapshot",
                headers={"Authorization": "Bearer test-token"},
            )

        assert resp.status_code == 404, f"got {resp.status_code} body={resp.text}"

        # T-062-01 leakage guards: the route's HTTPException uses
        # 'Thread not found'; FastAPI's default unregistered-route 404 uses
        # 'Not Found' — anti-false-RED for missing route.
        body = resp.json()
        assert body.get("detail") == "Thread not found", (
            f"Expected detail='Thread not found' (route's HTTPException); got {body!r}"
        )

        # Response body must NOT contain the queried thread_id or any run_id
        # field (the route never reaches the runs SELECT, so no run data
        # could possibly land in the response).
        body_text = resp.text
        assert THREAD_A not in body_text, (
            f"Information disclosure: response body contains queried thread_id "
            f"{THREAD_A!r}; body={body_text!r}"
        )
        assert "run_id" not in body_text, (
            f"Information disclosure: response body contains 'run_id' field; "
            f"body={body_text!r}"
        )

        # Short-circuit invariant: runs SELECT MUST NOT have been called.
        assert not runs_execute_called, (
            f"Expected runs SELECT to short-circuit on ownership 404; "
            f"got {len(runs_execute_called)} runs.execute() calls"
        )

        # Redis MUST NOT have been called either (same short-circuit).
        mock_redis.xinfo_stream.assert_not_called()
    finally:
        app.dependency_overrides.pop(get_supabase, None)
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_redis, None)


@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_redis_down_returns_503():
    """D-062-13 / D-075-04 mirror: Redis-down → 503 + Retry-After: 10.

    Mock layout:
      - threads ownership SELECT → owner match.
      - messages SELECT → 0 messages (irrelevant to assertion).
      - runs SELECT (helper merge) → empty.
      - runs SELECT (active_runs) → 1 streaming row.
      - redis.xinfo_stream → raises RedisError on the active run probe.

    Assertions:
      - 503 status.
      - Retry-After: 10 header.
      - body detail == "Streaming infrastructure unavailable".
    """
    mock_supabase = _build_mock_supabase()

    threads_builder = mock_supabase.table("threads")
    threads_builder.execute.side_effect = lambda *a, **k: _make_result({"id": THREAD_A})

    msgs_builder = mock_supabase.table("messages")
    msgs_builder.execute.side_effect = lambda *a, **k: _make_result([])

    runs_builder = mock_supabase.table("runs")
    runs_results = [
        _make_result([]),  # helper merge: no FK matches
        _make_result([
            {"run_id": RUN_ID, "started_at": "2026-05-04T00:00:01Z", "status": "streaming"},
        ]),
    ]
    runs_call_idx = {"i": 0}

    def _runs_execute(*a, **k):
        i = runs_call_idx["i"]
        runs_call_idx["i"] = min(i + 1, len(runs_results) - 1)
        return runs_results[i]

    runs_builder.execute.side_effect = _runs_execute

    mock_redis = AsyncMock()
    mock_redis.xinfo_stream = AsyncMock(side_effect=RedisError("boom"))

    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    app.dependency_overrides[get_current_user] = lambda: OWNER_USER
    app.dependency_overrides[get_redis] = lambda: mock_redis
    try:
        async with httpx.AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as c:
            resp = await c.get(
                f"/threads/{THREAD_A}/snapshot",
                headers={"Authorization": "Bearer test-token"},
            )

        assert resp.status_code == 503, (
            f"Expected 503 on Redis down; got {resp.status_code} body={resp.text}"
        )
        assert resp.headers.get("Retry-After") == "10", (
            f"Expected Retry-After: 10 header; got headers={dict(resp.headers)!r}"
        )
        body = resp.json()
        assert body.get("detail") == "Streaming infrastructure unavailable", (
            f"Expected detail='Streaming infrastructure unavailable'; got {body!r}"
        )
    finally:
        app.dependency_overrides.pop(get_supabase, None)
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_redis, None)
