"""Phase 101.1-08 (gap 4 backend half) — snapshot 'no such key' degrades, not 503.

The 500/503 this closes: GET /threads/{id}/snapshot's per-active-run cursor loop
caught EVERY RedisError (incl. ResponseError) → 503. But ``xinfo_stream`` raises
``ResponseError("no such key")`` when a TERMINAL run's Redis buffer was already
GC'd — that run is simply done, not a Redis outage. The whole snapshot should NOT
503 for a reaped buffer; it should DEGRADE — skip that run's cursor (the DB
reconcile is the source of truth, D-v2.5-03) and return 200.

Fix (Task 3, G-5 behavior-only): a SPECIFIC ``except ResponseError`` branch BEFORE
the broad ``except (RedisError, asyncio.TimeoutError, OSError)`` — if the error is a
missing key, ``continue`` (skip that run's cursor); otherwise re-raise into the
broad 503 path. A genuine connection-level RedisError still 503s.

Mock layout mirrors test_075_snapshot.py (the analog ship-gate file).
"""
import pytest
from unittest.mock import AsyncMock
from uuid import uuid4

import httpx
from httpx import ASGITransport
from redis.exceptions import RedisError, ResponseError, ConnectionError as RedisConnectionError

from app.dependencies import get_supabase, get_current_user, get_redis
from app.main import app

from tests.integration._run_helpers import _build_mock_supabase, _make_result, USER_ID

THREAD_A = str(uuid4())
OWNER_USER = {"id": USER_ID, "email": "owner@example.com"}

RUN_ID = "00000000-0000-0000-0000-0000000000c1"
SINCE_CURSOR = "1731936000000-0"


def _wire_owner_with_one_active_run(mock_supabase):
    """Owner ownership + 0 messages + 1 streaming active run (the run whose buffer
    is probed by xinfo_stream). Mirrors test_075_snapshot.py's runs side_effect."""
    threads_builder = mock_supabase.table("threads")
    threads_builder.execute.side_effect = lambda *a, **k: _make_result({"id": THREAD_A})

    msgs_builder = mock_supabase.table("messages")
    msgs_builder.execute.side_effect = lambda *a, **k: _make_result([])

    runs_builder = mock_supabase.table("runs")
    runs_results = [
        _make_result([]),  # helper merge: no FK matches
        _make_result([
            {"run_id": RUN_ID, "started_at": "2026-06-11T00:00:01Z", "status": "streaming"},
        ]),
    ]
    idx = {"i": 0}

    def _runs_execute(*a, **k):
        i = idx["i"]
        idx["i"] = min(i + 1, len(runs_results) - 1)
        return runs_results[i]

    runs_builder.execute.side_effect = _runs_execute


async def _get_snapshot(mock_supabase, mock_redis):
    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    app.dependency_overrides[get_current_user] = lambda: OWNER_USER
    app.dependency_overrides[get_redis] = lambda: mock_redis
    try:
        async with httpx.AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as c:
            return await c.get(
                f"/threads/{THREAD_A}/snapshot",
                headers={"Authorization": "Bearer test-token"},
            )
    finally:
        app.dependency_overrides.pop(get_supabase, None)
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_redis, None)


@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_snapshot_no_such_key_degrades_to_200():
    """Test 1: a GC'd run buffer (xinfo_stream raises ResponseError('no such key'))
    returns 200 with that run simply ABSENT from since_cursors — NOT 503."""
    mock_supabase = _build_mock_supabase()
    _wire_owner_with_one_active_run(mock_supabase)

    mock_redis = AsyncMock()
    mock_redis.xinfo_stream = AsyncMock(side_effect=ResponseError("no such key"))

    resp = await _get_snapshot(mock_supabase, mock_redis)

    assert resp.status_code == 200, (
        f"GC'd buffer must degrade to 200, not 503; got {resp.status_code} body={resp.text}"
    )
    body = resp.json()
    assert "since_cursors" in body
    # The terminal run's cursor is skipped (the DB reconcile is the source of truth).
    assert RUN_ID not in body["since_cursors"], (
        f"a GC'd run's cursor must be skipped; got {body['since_cursors']!r}"
    )
    # active_runs still surfaces the run (so the client reconciles its terminal state).
    assert len(body["active_runs"]) == 1


@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_snapshot_real_outage_still_503():
    """Test 2 (regression): a genuine connection-level RedisError (ConnectionError)
    STILL returns 503 + Retry-After — a real outage must not be masked."""
    mock_supabase = _build_mock_supabase()
    _wire_owner_with_one_active_run(mock_supabase)

    mock_redis = AsyncMock()
    mock_redis.xinfo_stream = AsyncMock(side_effect=RedisConnectionError("connection refused"))

    resp = await _get_snapshot(mock_supabase, mock_redis)

    assert resp.status_code == 503, (
        f"a real Redis outage must still 503; got {resp.status_code} body={resp.text}"
    )
    assert resp.headers.get("Retry-After") == "10"
    assert resp.json().get("detail") == "Streaming infrastructure unavailable"


@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_snapshot_healthy_key_returns_cursor():
    """Test 3 (regression): a healthy stream key returns its cursor normally."""
    mock_supabase = _build_mock_supabase()
    _wire_owner_with_one_active_run(mock_supabase)

    mock_redis = AsyncMock()
    mock_redis.xinfo_stream = AsyncMock(return_value={
        "length": 3,
        "first-entry": (SINCE_CURSOR, {b"data": b"{}"}),
        "last-entry": ("1731936000003-0", {b"data": b"{}"}),
    })

    resp = await _get_snapshot(mock_supabase, mock_redis)

    assert resp.status_code == 200, f"got {resp.status_code} body={resp.text}"
    body = resp.json()
    assert body["since_cursors"].get(RUN_ID) == SINCE_CURSOR, (
        f"a healthy key must return its cursor; got {body['since_cursors']!r}"
    )


@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_snapshot_non_missing_response_error_still_503():
    """Test 2b: a ResponseError that is NOT a missing key (a real fault) must NOT be
    swallowed — it falls through to the broad 503 path."""
    mock_supabase = _build_mock_supabase()
    _wire_owner_with_one_active_run(mock_supabase)

    mock_redis = AsyncMock()
    mock_redis.xinfo_stream = AsyncMock(side_effect=ResponseError("WRONGTYPE Operation against a key"))

    resp = await _get_snapshot(mock_supabase, mock_redis)

    assert resp.status_code == 503, (
        f"a non-missing-key ResponseError is a real fault and must 503; "
        f"got {resp.status_code} body={resp.text}"
    )
