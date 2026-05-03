"""SC#2 (replay-then-tail): GET /runs/{rid}/stream?since={offset} replays buffered
events from `since` to current head, then live-tails new events as the producer
writes them, then closes on the producer's terminal sentinel.

Phase 062 Plan 02 (D-062-05, D-062-07). Two tests:
  1. test_replay_then_tail_to_terminal — drive a real producer via POST, then
     fire GET against the new endpoint, drain to natural close on terminal.
  2. test_replay_from_specific_offset — pre-populate via xadd, call GET with a
     non-zero `since`, assert only post-cursor entries are yielded.
"""
import asyncio
import json
import pytest
from unittest.mock import patch
from uuid import uuid4

import httpx
from httpx import ASGITransport

from app.api.threads import RUN_TASKS, TERMINAL_TYPES
from app.dependencies import get_supabase
from app.main import app
from app.services.openai_service import CallingMode

from tests.integration._run_helpers import (
    _build_mock_supabase,
    _extract_run_id_from_mock,
    _slow_chunks,
    await_producer_finalized,
)
from tests.integration.test_059_disconnect import _reset_sse_starlette_app_status  # noqa: F401, E402

THREAD_A = str(uuid4())


@pytest.fixture(autouse=True)
def _reset_redis_singleton():
    """Reset app.dependencies._redis so each test gets a Redis client bound to
    its own per-test event loop (pytest-asyncio function-scope creates a fresh
    loop per test). Without this, a singleton created in test N's loop is
    invoked by test N+1 against a closed loop → RuntimeError("Event loop is closed").

    Mirrors the rationale of test_059_disconnect's _reset_sse_starlette_app_status
    fixture (RESEARCH.md Pitfall 6) — same loop-binding trap, different module.
    Required for Phase 062's stream tests because the route handler hits the
    real `get_redis()` singleton (no Redis dependency override).
    """
    import app.dependencies as _deps
    _deps._redis = None
    yield
    _deps._redis = None


@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_replay_then_tail_to_terminal(redis_client):
    """SC#2: GET /runs/{rid}/stream?since=0 replays + tails until terminal sentinel.

    Spin up a real producer via POST (slow-mock LLM); extract run_id; fire
    GET against the new endpoint; drain to natural close on terminal.
    """
    mock_supabase = _build_mock_supabase()
    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    try:
        with patch(
            "app.api.threads.create_adaptive_streaming_chat",
            side_effect=lambda *a, **k: (iter(_slow_chunks()), CallingMode.NATIVE),
        ), patch(
            "app.services.suggestion_service.generate_suggestions",
            return_value=([], None),
        ), patch(
            "app.api.threads.generate_thread_title",
            return_value=("T", None),
        ):
            async with httpx.AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as ac:
                # Step 1: POST → producer spins up
                async with ac.stream(
                    "POST", f"/threads/{THREAD_A}/messages",
                    content=json.dumps({"content": "hello"}),
                    headers={"Authorization": "Bearer test-token",
                             "Content-Type": "application/json"},
                    timeout=30.0,
                ) as r:
                    # Read first chunk to confirm producer started, then disconnect
                    async for _line in r.aiter_lines():
                        break

                # Step 2: extract run_id from the mock's runs INSERT
                run_id = _extract_run_id_from_mock(mock_supabase)

                # Step 3: configure mock so GET stream's ownership SELECT succeeds
                runs_builder = mock_supabase.table("runs")
                runs_builder.execute.side_effect = lambda *a, **k: type("R", (), {
                    "data": {"run_id": run_id, "status": "streaming",
                             "thread_id": THREAD_A, "error": None},
                    "count": None,
                })()

                # Step 4: GET /runs/{rid}/stream?since=0 → drain to terminal
                events = []
                async with ac.stream(
                    "GET", f"/runs/{run_id}/stream?since=0",
                    headers={"Authorization": "Bearer test-token"},
                    timeout=30.0,
                ) as resp:
                    assert resp.status_code == 200, \
                        f"Expected 200; got {resp.status_code}"
                    async for line in resp.aiter_lines():
                        if line.startswith("data: "):
                            events.append(line[6:])

            # Step 5: producer finalizes
            await await_producer_finalized(mock_supabase)

        # Assertions (SC#2)
        assert len(events) >= 3, \
            f"Expected >=3 events; got {len(events)}: {events[:5]}"
        last = json.loads(events[-1])
        assert last["type"] in TERMINAL_TYPES, \
            f"Last event type {last['type']!r} not in TERMINAL_TYPES; events={events[-3:]}"
        # Proves replay phase yielded at least one delta before terminal
        non_terminal_types = {json.loads(e).get("type") for e in events[:-1]}
        assert non_terminal_types - TERMINAL_TYPES, \
            f"Expected at least one non-terminal event before terminal; got types={non_terminal_types}"
    finally:
        app.dependency_overrides.pop(get_supabase, None)


@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_replay_from_specific_offset(redis_client):
    """D-062-07: ?since=<entry_id> skips entries before that id; XREAD cursor honored."""
    mock_supabase = _build_mock_supabase()
    run_id = str(uuid4())
    stream_key = f"run:{run_id}"

    # Pre-populate 3 entries + a terminal sentinel
    ids = []
    for i in range(3):
        entry_id = await redis_client.xadd(
            stream_key, {"data": json.dumps({"type": "delta", "content": f"tok{i}"})}
        )
        ids.append(entry_id)
    await redis_client.xadd(stream_key, {"data": json.dumps({"type": "done"})})

    # Mock ownership SELECT to allow the GET
    runs_builder = mock_supabase.table("runs")
    runs_builder.execute.side_effect = lambda *a, **k: type("R", (), {
        "data": {"run_id": run_id, "status": "streaming",
                 "thread_id": THREAD_A, "error": None},
        "count": None,
    })()
    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    try:
        events = []
        async with httpx.AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as ac:
            async with ac.stream(
                "GET", f"/runs/{run_id}/stream?since={ids[1]}",
                headers={"Authorization": "Bearer test-token"},
                timeout=10.0,
            ) as resp:
                assert resp.status_code == 200, \
                    f"Expected 200; got {resp.status_code}"
                async for line in resp.aiter_lines():
                    if line.startswith("data: "):
                        events.append(json.loads(line[6:]))

        # Should see ONLY entries AFTER ids[1] (i.e., tok2 + done) — NOT tok0 or tok1
        contents = [e.get("content") for e in events if e.get("type") == "delta"]
        assert "tok0" not in contents, \
            f"Expected tok0 to be skipped (since={ids[1]}); got {contents}"
        assert "tok1" not in contents, \
            f"Expected tok1 to be skipped (since={ids[1]}); got {contents}"
        assert events[-1]["type"] == "done", \
            f"Expected last event done; got {events[-1]}"
    finally:
        app.dependency_overrides.pop(get_supabase, None)
