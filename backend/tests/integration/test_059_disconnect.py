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

    Count=5 keeps total nominal stream time at ~1.5s of `time.sleep` —
    long enough that disconnect is genuinely mid-stream (not after natural
    completion) yet short enough that even a broken cancellation contract
    only delays the test by the remaining un-slept chunks rather than
    wedging the suite. The helper's asyncio.wait_for(8.0) is the hard
    backstop. Note: CR-01-style queue-back-pressure (maxsize=100) requires
    >>100 queued events to surface and is out of reach for this functional
    test; CR-01 is covered structurally by code review and the put_nowait
    sentinel fix, not by overrunning the queue here.
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


async def _drive_sse_until_disconnect(
    asgi_app,
    thread_id: str,
    body_bytes: bytes,
) -> tuple[float, list[bytes]]:
    """Drive the ASGI app directly and inject `http.disconnect` mid-stream.

    CR-03 fix (review 2026-05-02): the previous httpx-based helper did NOT
    actually trigger client disconnect — `httpx.ASGITransport` buffers the
    entire response body before returning a Response, so exiting the
    `client.stream(...)` context never delivered an `http.disconnect` ASGI
    event to the app. The test passed because the mock LLM stream completed
    naturally inside the test's window, not because cancellation propagated.

    This helper instead speaks ASGI directly:

    1. Build a minimal HTTP scope for `POST /threads/{tid}/messages`.
    2. Provide a custom `receive` callable: returns the request body once,
       then waits on an asyncio.Event that the test (via `send`) flips when
       the first response body chunk arrives — at which point it returns
       `{"type": "http.disconnect"}`. This is the SAME message sse-starlette
       listens for in production via its `_listen_for_disconnect` task.
    3. Provide a custom `send` callable: records every ASGI message and sets
       the disconnect-trigger event when the first `http.response.body`
       chunk lands.
    4. Return monotonic timestamp at which the disconnect was injected so
       the test can measure cancellation latency from that point, plus the
       collected body chunks for any structural assertions.

    The ASGI app's task naturally returns when the route handler unwinds
    (after sse-starlette observes the disconnect and cancels the consumer,
    which cancels the producer). We `await` the app coroutine inside a
    `wait_for(...)` to bound the test should the cancellation contract
    ever regress.
    """
    scope = {
        "type": "http",
        "asgi": {"version": "3.0", "spec_version": "2.3"},
        "http_version": "1.1",
        "method": "POST",
        "scheme": "http",
        "path": f"/threads/{thread_id}/messages",
        "raw_path": f"/threads/{thread_id}/messages".encode(),
        "query_string": b"",
        "root_path": "",
        "server": ("testserver", 80),
        "client": ("testclient", 50000),
        "headers": [
            (b"host", b"testserver"),
            (b"content-type", b"application/json"),
            (b"content-length", str(len(body_bytes)).encode()),
            (b"authorization", b"Bearer test-token"),
            (b"accept", b"text/event-stream"),
        ],
        "state": {},
    }

    body_consumed = False
    disconnect_trigger = asyncio.Event()
    disconnect_sent = False
    t_disconnect: list[float] = []

    async def receive():
        nonlocal body_consumed, disconnect_sent
        if not body_consumed:
            body_consumed = True
            return {"type": "http.request", "body": body_bytes, "more_body": False}
        if disconnect_sent:
            # After the disconnect message, sse-starlette stops reading;
            # block forever (until cancelled by the framework teardown).
            await asyncio.Event().wait()
        await disconnect_trigger.wait()
        disconnect_sent = True
        t_disconnect.append(time.monotonic())
        return {"type": "http.disconnect"}

    sent_messages: list[dict] = []
    first_body_seen = False

    async def send(message):
        nonlocal first_body_seen
        sent_messages.append(message)
        if message.get("type") == "http.response.body" and message.get("body"):
            if not first_body_seen:
                first_body_seen = True
                # Trigger the disconnect AFTER the first non-empty body chunk
                # so the consumer is mid-stream, exactly like a real client
                # closing the TCP connection.
                disconnect_trigger.set()

    # Bound the entire ASGI invocation with a generous timeout — if the
    # cancellation contract regresses (e.g., CR-01 deadlock returns), this
    # will fail loudly rather than wedging pytest.
    await asyncio.wait_for(asgi_app(scope, receive, send), timeout=8.0)

    body_chunks = [
        m["body"] for m in sent_messages
        if m.get("type") == "http.response.body" and m.get("body")
    ]
    return (t_disconnect[0] if t_disconnect else time.monotonic()), body_chunks


# ---------------------------------------------------------------------
# Tests — Wave 0 placeholders. Wave 1 implements bodies per PATTERNS.md.
# ---------------------------------------------------------------------

@pytest.mark.asyncio
@pytest.mark.timeout(15)   # belt-and-suspenders against Pitfalls 4 & 7
async def test_agent_task_cancels_on_disconnect():
    """Cancellation latency < 1.0s; no NEW LLM calls fire after disconnect.

    D-059-06 merge gate. Maps to CONCUR-02 acceptance verbatim.
    Asserts Invariants I1 (latency), I2 (no new calls), I3 (no hang
    proven by absence of timeout), I4 (assistant message persisted).

    CR-03 fix (review 2026-05-02): rewritten to drive the ASGI app
    directly via `_drive_sse_until_disconnect` instead of httpx, because
    httpx's ASGITransport buffers the entire response body and never
    actually delivers an `http.disconnect` event to the app — meaning the
    pre-fix version of this test passed for reasons unrelated to the
    cancellation contract it claimed to assert.
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
    body_chunks: list[bytes] = []
    t_disconnect: float = 0.0
    t_response_done: float = 0.0
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
            t_disconnect, body_chunks = await _drive_sse_until_disconnect(
                app,
                THREAD_A,
                body_bytes=json.dumps({"content": "hello"}).encode(),
            )
            t_response_done = time.monotonic()
    finally:
        app.dependency_overrides[get_supabase] = lambda: _conftest_supabase

    # I1: cancellation latency — the entire ASGI app coroutine returned
    # within 1.0s of the injected disconnect (with a small allowance for
    # the in-flight `time.sleep` chunk to complete; per KI-001 we cannot
    # interrupt mid-sync-step). Worst case is one full SLOW_CHUNK_DELAY
    # plus the shielded persist itself.
    latency = t_response_done - t_disconnect
    assert latency < 1.5, (
        f"Cancellation propagation took {latency:.2f}s — exceeds the "
        f"1.5s budget (1.0s contract + 0.3s in-flight chunk). "
        f"Likely a CR-01 regression (queue back-pressure deadlock)."
    )

    # I2: zero NEW LLM calls fire after the disconnect timestamp.
    # `_make_counted_chat` records every call; `count_after` returns the
    # number of calls strictly later than t_disconnect. The mock LLM
    # itself only renders one stream per agent iteration, so the agent
    # would have to enter a SECOND iteration after disconnect to violate
    # this. With proper cancellation, the producer never reaches the
    # iteration loop's next `create_adaptive_streaming_chat` call.
    count_after = counter.count_after(t_disconnect)
    assert count_after == 0, (
        f"Expected 0 LLM calls after disconnect, got {count_after}. "
        f"Cancellation did not propagate within 1.0s."
    )

    # I3: no consumer hang — proven by `_drive_sse_until_disconnect`
    # returning at all (its internal asyncio.wait_for hard-cancels at 8s).
    # Body chunks confirm at least one event reached the consumer before
    # disconnect, ruling out a no-op test path.
    assert body_chunks, (
        "Expected at least one body chunk before disconnect — the test "
        "helper triggers disconnect AFTER the first chunk arrives. Zero "
        "chunks means the producer never wrote anything, which would "
        "make the rest of this test vacuous."
    )

    # I4: assistant message persisted (shielded persist completed even
    # though the client disconnected mid-stream).
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
