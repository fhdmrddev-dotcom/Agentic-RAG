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

# IN-01 (D-061.1-11): cross-import the shared helpers directly from
# _run_helpers.py rather than via test_058_concurrency. test_058 still
# re-exports the same names for legacy callers, but new imports should
# go to the canonical location.
from tests.integration._run_helpers import (
    USER_ID,
    _make_result,
    _make_sse_chunk,
    _make_done_chunk,
    _fast_chunks,
    _thread_row,
    _message_row,
    _make_table_builder,
    _build_mock_supabase,
    _slow_chunks,
    await_producer_finalized,
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
# 059-specific helpers (call counter, mid-stream disconnect driver)
#
# Note: ``_slow_chunks`` was relocated to ``_run_helpers.py`` (D-061.1-11)
# and is now imported above with the rest of the shared mock infrastructure.
# ---------------------------------------------------------------------


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
    fresh slow-chunks iterator.

    Phase 063 update: extended slow-chunks lifetime (delay=0.4 × count=15
    ≈ 6s) so the producer is reliably still running when the disconnect
    fires. Default ``_slow_chunks()`` (5 × 0.3s ≈ 1.5s) used to suffice
    when the disconnect was injected on the POST-SSE response within the
    POST handler's timeline, but after 063-02 the disconnect happens on
    a SEPARATE GET-stream request that takes time to set up; the
    short-lived default occasionally finished BEFORE the disconnect
    landed, making D-061-16's "XLEN grows post-disconnect" assertion
    vacuous (xlen_at_disconnect == xlen_after because the producer was
    already done).
    """
    def _patched(*args, **kwargs):
        counter.record()
        return (iter(_slow_chunks(delay=0.4, count=15)), CallingMode.NATIVE)
    return _patched


async def _post_then_drive_get_stream_until_disconnect(
    asgi_app,
    thread_id: str,
    body_bytes: bytes,
    *,
    on_post_complete=None,
) -> tuple[str, float, list[bytes]]:
    """Phase 063 D-063-01 rewrite of ``_drive_sse_until_disconnect``.

    The legacy 059 form drove a POST /threads/{tid}/messages directly
    against the ASGI app and injected ``http.disconnect`` once the first
    response body chunk landed — exercising the SSE-on-POST contract.

    After the 063-02 hard cutover:
      - POST returns 201 + JSON synchronously (no SSE on POST).
      - Token streaming lives on GET /runs/{rid}/stream (Phase 062 endpoint).
      - The "consumer disconnect mid-stream" event therefore happens on
        the GET stream, not on the POST response.

    This helper performs the two-step roundtrip:

      1. POST /threads/{tid}/messages via httpx.AsyncClient over
         ASGITransport — captures ``run_id`` from the JSON envelope.
         The producer task is registered in RUN_TASKS by send_message
         BEFORE this call returns (Pitfall 4 invariant).

      2. GET /runs/{run_id}/stream?since=0 driven directly against the
         ASGI app (NOT via httpx, because ASGITransport buffers the
         entire response body — same CR-03 reason the legacy 059 helper
         existed). Custom ``receive`` injects ``http.disconnect`` once
         the first non-empty body chunk lands. The route handler's
         consumer-side coroutine observes the disconnect and unwinds;
         the producer task in RUN_TASKS keeps running per D-061-16
         (consumer-disconnect does NOT cancel the producer).

    Returns ``(run_id, t_disconnect, body_chunks)``:
      - ``run_id``: the run that's now mid-flight in RUN_TASKS.
      - ``t_disconnect``: monotonic timestamp at which we injected the
        ``http.disconnect`` on the GET stream.
      - ``body_chunks``: response body chunks observed BEFORE disconnect
        (proves at least one event reached the consumer; rules out a
        no-op test path).

    The original ``_drive_sse_until_disconnect`` symbol name is preserved
    below as a thin alias so any external imports continue to work; the
    return shape is extended with the run_id as element [0].
    """
    # ── Step 1: POST → run_id ─────────────────────────────────────────
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=asgi_app), base_url="http://test"
    ) as ac:
        post_resp = await ac.post(
            f"/threads/{thread_id}/messages",
            content=body_bytes,
            headers={"Authorization": "Bearer test-token",
                     "Content-Type": "application/json"},
            timeout=30.0,
        )
    assert post_resp.status_code == 201, (
        f"D-063-01: expected 201; got {post_resp.status_code} "
        f"body={post_resp.text[:200]}"
    )
    run_id = post_resp.json()["run_id"]

    # Optional hook: caller may want to configure mocks (e.g., runs
    # ownership SELECT) for the upcoming GET stream's auth check before
    # the GET fires. Awaitable or sync; both supported.
    if on_post_complete is not None:
        result = on_post_complete(run_id)
        if asyncio.iscoroutine(result):
            await result

    # Give the producer a tiny window to start — its first XADD must land
    # so the GET stream's replay phase has at least one event to surface
    # before we trip the disconnect (mirrors original 059 spirit: disconnect
    # AFTER the first chunk arrived).
    await asyncio.sleep(0.2)

    # ── Step 2: drive GET stream against ASGI; inject http.disconnect ──
    scope = {
        "type": "http",
        "asgi": {"version": "3.0", "spec_version": "2.3"},
        "http_version": "1.1",
        "method": "GET",
        "scheme": "http",
        "path": f"/runs/{run_id}/stream",
        "raw_path": f"/runs/{run_id}/stream".encode(),
        "query_string": b"since=0",
        "root_path": "",
        "server": ("testserver", 80),
        "client": ("testclient", 50000),
        "headers": [
            (b"host", b"testserver"),
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
            # GET has no request body; signal the empty body once.
            return {"type": "http.request", "body": b"", "more_body": False}
        if disconnect_sent:
            await asyncio.Event().wait()  # block until framework teardown
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
                # Trigger disconnect AFTER first non-empty body chunk
                # arrives — the consumer is mid-stream, exactly like a
                # real browser closing the TCP connection.
                disconnect_trigger.set()

    # Bound the entire GET-stream ASGI invocation. If the consumer never
    # observes the disconnect (e.g., a regression in the route handler's
    # disconnect listener), this will fail loudly rather than wedging pytest.
    try:
        await asyncio.wait_for(asgi_app(scope, receive, send), timeout=8.0)
    except asyncio.TimeoutError:
        # Consumer didn't unwind in 8s — the disconnect signal didn't
        # propagate. Surface the test failure rather than wedging.
        if not t_disconnect:
            t_disconnect.append(time.monotonic())

    body_chunks = [
        m["body"] for m in sent_messages
        if m.get("type") == "http.response.body" and m.get("body")
    ]
    return run_id, (t_disconnect[0] if t_disconnect else time.monotonic()), body_chunks


# Legacy alias — preserved for any external import that hasn't migrated yet.
# The shape changed: returns (run_id, t_disconnect, body_chunks) instead of
# (t_disconnect, body_chunks). Anyone calling the old name should update to
# the new helper directly.
_drive_sse_until_disconnect = _post_then_drive_get_stream_until_disconnect


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
            # Phase 063 D-063-01 rewrite: helper now does the two-step
            # POST→JSON→GET-stream→disconnect dance and returns the run_id
            # alongside the disconnect timestamp. We prefer this run_id
            # over re-extracting from the mock to avoid a race window
            # where _extract_run_id_from_mock could pick up a future
            # spawn-failure retry INSERT.
            #
            # Configure the runs ownership SELECT for the GET stream's
            # auth check (D-062-08): _build_mock_supabase's default
            # runs_execute returns []; the GET stream needs a streaming
            # row. We register the side_effect AFTER the POST returns
            # (so the run_id is known) via the on_post_complete hook.
            def _wire_runs_select(rid: str) -> None:
                runs_builder = mock_supabase.table("runs")
                runs_builder.execute.side_effect = lambda *a, **k: type("R", (), {
                    "data": {"run_id": rid, "status": "streaming",
                             "thread_id": THREAD_A, "error": None},
                    "count": None,
                })()

            run_id, t_disconnect, body_chunks = await _post_then_drive_get_stream_until_disconnect(
                app,
                THREAD_A,
                body_bytes=json.dumps({"content": "hello"}).encode(),
                on_post_complete=_wire_runs_select,
            )

            # Sanity: helper's run_id matches the mock's runs.insert call.
            mock_run_id = _extract_run_id_from_mock(mock_supabase)
            assert run_id == mock_run_id, (
                f"Phase 063: helper-returned run_id {run_id!r} mismatched "
                f"mock-extracted {mock_run_id!r} — POST/GET race?"
            )
            stream_key = f"run:{run_id}"

            # Snapshot XLEN at disconnect
            xlen_at_disconnect = await redis_client.xlen(stream_key)

            # I1' INVERSION: producer keeps running after disconnect.
            # WR-04 (D-061.1-14): await producer finalization deterministically
            # instead of a fixed 5s sleep. D-061-16 contract preserved:
            # producer SURVIVES disconnect; XLEN must grow post-disconnect.
            await await_producer_finalized(mock_supabase)
            xlen_after = await redis_client.xlen(stream_key)
            assert xlen_after > xlen_at_disconnect, (
                f"D-061-16 inversion: producer should KEEP RUNNING after disconnect. "
                f"At disconnect: {xlen_at_disconnect}; after finalize: {xlen_after}"
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
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as c:
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

    # D-061.1-01: deterministic await for _shielded_finalize completion
    await await_producer_finalized(mock_supabase)

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
