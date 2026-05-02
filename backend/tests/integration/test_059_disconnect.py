"""Integration test for Phase 061 — agent producer SURVIVES client disconnect.

Phase 061 contract inversion (D-061-16). The original 059 test asserted
'producer cancelled within 1s of disconnect' (CONCUR-02 invariant). With
the run-backed streaming architecture (D-v2.5-08), the producer is
decoupled from the consumer — disconnecting the consumer does NOT cancel
the producer. The producer runs to natural completion or the 120s
asyncio.timeout (D-061-01).

This file's earlier name pattern (test_059_disconnect.py) is preserved
so the file's commit history shows the contract-inversion as a single
reviewable diff. The test name is renamed to make the new assertion
explicit: test_agent_task_SURVIVES_on_disconnect.

Phase 061 invariants (the inversion of 059's I1-I4):
  I1': producer XLEN GROWS for >= 5s after consumer disconnect (was: cancelled within 1s)
  I2': zero or more LLM calls fire after disconnect (was: zero)
  I3': consumer's finally is a no-op — does NOT call task.cancel (D-061-03)
  I4': shielded persist + runs UPDATE + EXPIRE all run in producer's finally (preserved from 059)

Pattern source: tests/integration/test_058_concurrency.py (058 fixture style)
              + tests/integration/test_059_disconnect.py (this file's previous form).
Reviewer note: this is intentional, NOT a regression. See 061-VERIFICATION.md
Section "Contract Inversion" + the commit message for this rewrite.

Refs: D-v2.5-08, D-061-03, D-061-16, Phase 061
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

    WR-07: assert the sse-starlette version we validated this against — any
    minor-version bump that renames or relocates AppStatus would silently
    break the fixture without obvious failure mode otherwise. Currently
    pinned to 2.4.x in requirements.txt; bump this guard alongside the pin.
    """
    import sse_starlette
    assert sse_starlette.__version__.startswith("2.4."), (
        f"AppStatus reset fixture validated only for sse-starlette 2.4.x; "
        f"installed version {sse_starlette.__version__!r} may have moved or "
        f"renamed AppStatus. Re-validate fixture before bumping the version "
        f"assertion."
    )
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
# Tests — Phase 061 contract inversion (D-061-16) of the original 059 body.
# ---------------------------------------------------------------------

@pytest.mark.asyncio
@pytest.mark.timeout(15)   # belt-and-suspenders against Pitfalls 4 & 7
async def test_agent_task_SURVIVES_on_disconnect(redis_client):
    """D-061-16 contract inversion: producer SURVIVES consumer disconnect.

    Phase 061 (D-v2.5-08) — replaces 059's CONCUR-02 assertion. Killing
    the consumer does NOT kill the producer; XLEN grows over the next 5s.
    See file docstring for the I1'-I4' invariants.

    Reviewer note: this is intentional, NOT a regression. See
    .planning/phases/061-run-backed-streaming-backend/061-VERIFICATION.md
    Section "Contract Inversion" + the commit message for this rewrite.
    """
    from app.api.threads import TERMINAL_TYPES
    from tests.integration._run_helpers import _extract_run_id_from_mock

    mock_supabase = _build_mock_supabase()
    counter = LLMCallCounter()

    from tests.conftest import _supabase as _conftest_supabase
    app.dependency_overrides[get_supabase] = lambda: mock_supabase

    # Patch generate_suggestions and generate_thread_title so the agent's
    # post-stream code does not invoke a real LLM client with the test API
    # key. Same rationale as 059 (these are NOT the surface under test).
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

            run_id = _extract_run_id_from_mock(mock_supabase)
            stream_key = f"run:{run_id}"

            # Snapshot XLEN at disconnect
            xlen_at_disconnect = await redis_client.xlen(stream_key)

            # I1' INVERSION: producer keeps running for >= 5s post-disconnect
            await asyncio.sleep(5.0)
            xlen_after = await redis_client.xlen(stream_key)
            assert xlen_after > xlen_at_disconnect, (
                f"D-061-16 inversion: producer should KEEP RUNNING after disconnect. "
                f"At disconnect: {xlen_at_disconnect}; after 5s: {xlen_after}"
            )

            # I2' INVERSION: LLM calls AFTER disconnect are now allowed (>= 0).
            # The original 059 test required exactly zero post-disconnect LLM
            # calls; that strict-zero assertion is intentionally REMOVED per
            # D-061-16 (D-v2.5-08). The producer is now decoupled from the
            # consumer's lifetime and may legitimately fire additional LLM
            # iterations after the SSE connection is gone.
            count_after = counter.count_after(t_disconnect)
            assert count_after >= 0, (
                f"Inverted assertion holds trivially (count_after={count_after}); "
                f"see I2' note in file docstring."
            )

            # I3' / I4': terminal sentinel eventually lands (producer reaches
            # its finally; shielded persist + runs UPDATE + EXPIRE all run
            # there). Consumer's finally is a no-op (D-061-03).
            entries = await redis_client.xrange(stream_key)
            terminal = [
                e for e in entries
                if json.loads(e[1]["data"]).get("type") in TERMINAL_TYPES
            ]
            assert terminal, (
                f"Expected terminal sentinel; got: {entries}"
            )

            # Body chunks confirm at least one event reached the consumer before
            # disconnect, ruling out a no-op test path (preserved from 059).
            assert body_chunks, (
                "Expected at least one body chunk before disconnect — the test "
                "helper triggers disconnect AFTER the first chunk arrives. Zero "
                "chunks means the producer never wrote anything, which would "
                "make the rest of this test vacuous."
            )
    finally:
        app.dependency_overrides[get_supabase] = lambda: _conftest_supabase


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
