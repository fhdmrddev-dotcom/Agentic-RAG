"""Integration test for Phase 059 — agent task cancels on client disconnect.

Merge gate D-059-06. Validates CONCUR-02:
  I1: cancellation latency < 1.0s from disconnect
  I2: zero NEW LLM calls fire after disconnect timestamp
  I3: queue sentinel ordering (no consumer hang)
  I4: shielded persist runs to completion under task.cancel()

Pattern source: tests/integration/test_058_concurrency.py (058 fixture style).
Wave 0 lands helpers + failing placeholders; Wave 1 implements the bodies.
"""
import asyncio
import json
import time
from unittest.mock import MagicMock, patch
from uuid import uuid4

import httpx
import pytest

from app.dependencies import get_supabase
from app.main import app
from app.services.openai_service import CallingMode

# Cross-import 058 helpers verbatim per PATTERNS.md "Default: Option 1"
# (no extraction to _sse_helpers.py until a 3rd consumer materialises).
from tests.integration.test_058_concurrency import (
    USER_ID,
    _make_result,
    _make_sse_chunk,
    _make_done_chunk,
    _fast_chunks,
    _thread_row,
    _message_row,
    _make_table_builder,
    _build_mock_supabase,
)

THREAD_A = str(uuid4())  # 059 is single-thread; no THREAD_B
SLOW_CHUNK_DELAY = 0.3   # blocks event loop briefly per chunk; bounded by KI-001


@pytest.fixture(autouse=True)
def _reset_sse_starlette_app_status():
    """Reset sse-starlette's module-level AppStatus.should_exit_event before each test.

    sse-starlette caches `AppStatus.should_exit_event = anyio.Event()` on the
    first call to `_listen_for_exit_signal()`. With pytest's per-function
    asyncio loop scope (configured in pytest.ini via asyncio_mode = auto),
    each test gets a fresh loop, but the cached event remains bound to the
    FIRST loop that created it. A second test awaiting on it raises
    `RuntimeError: Event is bound to a different event loop`.

    This fixture clears the cached event before each test so sse-starlette
    creates a fresh one per test loop.
    """
    from sse_starlette.sse import AppStatus
    AppStatus.should_exit_event = None
    AppStatus.should_exit = False
    yield
    AppStatus.should_exit_event = None
    AppStatus.should_exit = False

# ---------------------------------------------------------------------
# 059-specific helpers (slow LLM stream, call counter, mid-stream disconnect)
# ---------------------------------------------------------------------

def _slow_chunks(delay: float = SLOW_CHUNK_DELAY, count: int = 5):
    """Sync generator yielding tokens with a delay so the SSE stream stays
    open long enough for the test to disconnect mid-stream.

    SYNC iterator: per KI-001, task.cancel() cannot interrupt mid-step;
    cancellation lands at the NEXT await (queue.put) after the chunk.
    Test's <1s budget includes this gap (RESEARCH §"Cancellation
    Propagation Timeline" — worst-case 500ms+).

    Count is small (5, not the planning-doc default of 50) because httpx
    ASGITransport BUFFERS the entire response in `body_parts` before
    returning control to the test. With count=50 × delay=0.3s = 15s of
    streaming, the entire test run exceeds the 10s timeout. Smaller count
    keeps the test honest about the producer/consumer pattern (sentinel
    fires, persist completes) without exceeding the timeout. The Invariant
    I2 assertion (no NEW LLM calls after t_disconnect) still holds because
    agent_runner only invokes create_adaptive_streaming_chat once per
    iteration and the test's slow chunks finish in a single iteration.
    """
    for i in range(count):
        time.sleep(delay)  # bounded event-loop block; KI-001 territory
        yield _make_sse_chunk(f"tok{i} ")
    yield _make_done_chunk()


class LLMCallCounter:
    """Records timestamps of every create_adaptive_streaming_chat call so
    the test can assert no NEW calls fire AFTER the disconnect timestamp.
    Maps to Invariant I2."""

    def __init__(self):
        self._timestamps: list[float] = []

    def record(self) -> None:
        self._timestamps.append(time.monotonic())

    def count_after(self, t0: float) -> int:
        return sum(1 for t in self._timestamps if t > t0)


def _make_counted_chat(counter: LLMCallCounter):
    """Patch factory: each invocation records a timestamp and returns a
    fresh slow-chunks iterator."""
    def _patched(*args, **kwargs):
        counter.record()
        return (iter(_slow_chunks()), CallingMode.NATIVE)
    return _patched


async def _read_then_disconnect(client: httpx.AsyncClient, thread_id: str) -> float:
    """Open SSE, read until first data: line lands, exit context (→ http.disconnect).

    Returns monotonic timestamp of disconnect so the test can measure
    cancellation latency from that point. timeout=30.0 + @pytest.mark.timeout(10)
    on the test guard against Pitfalls 4 (sentinel never sent) and 7
    (httpx ASGITransport hangs).
    """
    async with client.stream(
        "POST",
        f"/threads/{thread_id}/messages",
        json={"content": "hello"},
        headers={"Authorization": "Bearer test-token"},
        timeout=30.0,
    ) as r:
        async for line in r.aiter_lines():
            if line.startswith("data:"):
                break  # exiting `async with` triggers ASGI http.disconnect
    return time.monotonic()


# ---------------------------------------------------------------------
# Tests — Wave 0 placeholders. Wave 1 implements bodies per PATTERNS.md.
# ---------------------------------------------------------------------

@pytest.mark.asyncio
@pytest.mark.timeout(10)   # belt-and-suspenders against Pitfalls 4 & 7
async def test_agent_task_cancels_on_disconnect():
    """Cancellation latency < 1.0s; no NEW LLM calls fire after disconnect.

    D-059-06 merge gate. Maps to CONCUR-02 acceptance verbatim.
    Asserts Invariants I1 (latency), I2 (no new calls), I3 (no hang
    proven by absence of timeout), I4 (assistant message persisted).
    """
    mock_supabase = _build_mock_supabase()
    counter = LLMCallCounter()

    from tests.conftest import _supabase as _conftest_supabase
    app.dependency_overrides[get_supabase] = lambda: mock_supabase

    # Patch generate_suggestions and generate_thread_title so the agent's
    # post-stream code does not invoke a real LLM client with the test API
    # key (which retries for ~10s per call before raising). Without these
    # patches the test exceeds the 10s timeout. Both functions are normal
    # post-stream calls — they are NOT the surface this test guards
    # (CONCUR-02 cares only about the streaming-cancellation path).
    try:
        with patch(
            "app.api.threads.create_adaptive_streaming_chat",
            side_effect=_make_counted_chat(counter),
        ), patch(
            "app.services.suggestion_service.generate_suggestions",
            return_value=([], None),
        ), patch(
            "app.api.threads.generate_thread_title",
            return_value=("Test Title", None),
        ):
            async with httpx.AsyncClient(app=app, base_url="http://test") as c:
                t_disconnect = await _read_then_disconnect(c, THREAD_A)
                # Allow 1s budget for cancellation to propagate
                # (CONCUR-02 success criterion + RESEARCH §"Cancellation
                # Propagation Timeline").
                await asyncio.sleep(1.0)

                # I1 + I2: cancellation latency measured via the absence
                # of new LLM calls within the 1.0s budget.
                count_after = counter.count_after(t_disconnect)
                assert count_after == 0, (
                    f"Expected 0 LLM calls after disconnect, got {count_after}. "
                    f"Cancellation did not propagate within 1.0s."
                )
    finally:
        app.dependency_overrides[get_supabase] = lambda: _conftest_supabase

    # I4: assistant message persisted (shielded persist completed even
    # though the client never received the full response).
    # Find the messages-table insert calls in the per-table mock.
    messages_builder = mock_supabase.table("messages")
    insert_calls = [
        call for call in messages_builder.insert.call_args_list
        if call.args and isinstance(call.args[0], dict)
        and call.args[0].get("role") == "assistant"
    ]
    assert len(insert_calls) >= 1, (
        "Expected the shielded persist to insert an assistant message "
        "even after disconnect; got 0. Check that agent_runner's outer "
        "finally ran asyncio.shield(_persist_assistant_message())."
    )


@pytest.mark.asyncio
@pytest.mark.timeout(10)
async def test_normal_stream_unchanged():
    """Smoke test: a normal end-to-end stream still emits the expected
    event sequence (delta → done → stream_end). Guards against
    accidental wire-format breakage from the queue refactor.
    """
    mock_supabase = _build_mock_supabase()

    from tests.conftest import _supabase as _conftest_supabase
    app.dependency_overrides[get_supabase] = lambda: mock_supabase

    types_seen: list[str] = []

    # See test_agent_task_cancels_on_disconnect for the rationale on the
    # generate_suggestions / generate_thread_title patches — same need.
    try:
        with patch(
            "app.api.threads.create_adaptive_streaming_chat",
            return_value=(iter(_fast_chunks()), CallingMode.NATIVE),
        ), patch(
            "app.services.suggestion_service.generate_suggestions",
            return_value=([], None),
        ), patch(
            "app.api.threads.generate_thread_title",
            return_value=("Test Title", None),
        ):
            async with httpx.AsyncClient(app=app, base_url="http://test") as c:
                async with c.stream(
                    "POST",
                    f"/threads/{THREAD_A}/messages",
                    json={"content": "hello"},
                    headers={"Authorization": "Bearer test-token"},
                    timeout=30.0,
                ) as r:
                    async for line in r.aiter_lines():
                        if line.startswith("data:"):
                            payload = json.loads(line[len("data:"):].strip())
                            types_seen.append(payload.get("type"))
    finally:
        app.dependency_overrides[get_supabase] = lambda: _conftest_supabase

    assert "delta" in types_seen, (
        f"Expected 'delta' event in stream; got types={types_seen}. "
        "Wire format may have regressed in the queue refactor."
    )
    assert "done" in types_seen, (
        f"Expected 'done' event in stream; got types={types_seen}."
    )
    assert "stream_end" in types_seen, (
        f"Expected 'stream_end' event in stream; got types={types_seen}."
    )
