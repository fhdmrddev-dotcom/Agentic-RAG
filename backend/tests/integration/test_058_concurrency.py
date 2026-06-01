"""Integration test for Phase 058 — cross-tab GET unblocked during SSE streaming.

D-058-09 gate: passes only when the aexec() wrapping is in effect so that
a concurrent GET on Thread B returns within 1.0s while Thread A's SSE stream
is actively in-flight.

Pre-058 behaviour: the sync .execute() inside send_message/event_stream holds
the asyncio event loop; the GET on Thread B queues until the SSE finishes.
Post-058 behaviour: aexec() dispatches .execute() to a threadpool worker via
starlette.concurrency.run_in_threadpool, freeing the event loop; the GET
returns in well under a second.

Uses httpx.AsyncClient (NOT sync TestClient) because genuine asyncio.create_task
concurrency is required. Sync TestClient runs each request serially in one
thread and cannot exhibit the concurrency bug we are guarding against.

This is the first httpx.AsyncClient test in the repo; it intentionally does
NOT migrate the existing TestClient-based suites — those remain valuable for
non-concurrency assertions.

Patch targets (verified against the actual repo):
  - app.services.provider_gateway.openai_compat.create_adaptive_streaming_chat — the streaming entry point
    looked up inside event_stream's OpenAI/OpenRouter branch (NOT
    create_streaming_chat — that name is not imported into threads.py).
    The function returns a (stream_iterator, calling_mode) tuple.
  - app.dependencies.get_supabase — overridden via app.dependency_overrides
    for this test only, to install a per-table mock that routes by table
    name. This is needed because two threads execute concurrently with
    interleaved DB calls; a flat side_effect queue is order-fragile.
  - app.dependencies.get_current_user — already wired by conftest at
    import time; we keep that override.

Test design (deviation from plan note 2 — see SUMMARY.md "Deviations"):
  The plan suggested using a slow LLM (`time.sleep(0.2)` per chunk) to keep
  the SSE stream open. That approach blocks the event loop directly because
  event_stream iterates the LLM stream with a sync `for chunk in stream:`
  loop on the event-loop thread (a Phase 059 concern, not 058). Instead, we
  make the pre-stream user-message INSERT (D-058-02, threads.py:511) slow
  by sleeping inside the mock execute() — that sleep runs on the threadpool
  worker (because aexec wraps it in run_in_threadpool) and is the *exact*
  surface 058 was designed to fix. If aexec wrapping is in effect, the event
  loop is free during that sleep and the cross-tab GET completes immediately.
"""
import asyncio
import time
from unittest.mock import patch
from uuid import uuid4

import httpx
import pytest

from app.dependencies import get_supabase
from app.main import app
from app.services.openai_service import CallingMode

# IN-01 (D-061.1-11): mock infrastructure was relocated to
# tests/integration/_run_helpers.py so this file stops being a defacto
# helper-provider for downstream test files. Importers preserved here
# under their original names for backward-compatibility — test_059 and
# test_061_* still cross-import via this module per PATTERNS.md.
from tests.integration._run_helpers import (  # noqa: F401 — re-exported
    USER_ID,
    SLOW_INSERT_DELAY,
    _make_result,
    _make_sse_chunk,
    _make_done_chunk,
    _fast_chunks,
    _slow_chunks,
    _thread_row as _thread_row_helper,
    _message_row as _message_row_helper,
    _make_table_builder,
    _build_mock_supabase as _build_mock_supabase_helper,
)


# ---------------------------------------------------------------------------
# Module-local thread ids (this test's cross-tab assertion needs two)
# ---------------------------------------------------------------------------

THREAD_A = str(uuid4())
THREAD_B = str(uuid4())


# ---------------------------------------------------------------------------
# Module-local wrappers around relocated helpers
# ---------------------------------------------------------------------------
# The shared helpers live in _run_helpers.py with placeholder thread ids
# (since most consumers don't care which thread row they get). This file's
# 058 cross-tab test cares — it inspects the threads_execute alternation —
# so we wrap with module-local THREAD_A/THREAD_B substitutions to preserve
# the prior behaviour exactly.

def _thread_row(thread_id: str):
    return _thread_row_helper(thread_id)


def _message_row(role: str = "user", content: str = "hello", thread_id: str = None):
    return _message_row_helper(role=role, content=content, thread_id=thread_id or THREAD_A)


def _build_mock_supabase():
    """058's cross-tab test wants threads_execute to alternate between
    THREAD_A and THREAD_B. Compose a thin override around the shared
    helper to preserve that behaviour without forking the helper.
    """
    from unittest.mock import MagicMock

    state = {"messages_select_count": 0, "threads_select_count": 0}

    def messages_execute(*args, **kwargs):
        state["messages_select_count"] += 1
        if state["messages_select_count"] == 1:
            time.sleep(SLOW_INSERT_DELAY)
            return _make_result([_message_row(thread_id=THREAD_A)])
        return _make_result([])

    def threads_execute(*args, **kwargs):
        state["threads_select_count"] += 1
        thread_id = THREAD_A if state["threads_select_count"] % 2 == 1 else THREAD_B
        return _make_result(_thread_row(thread_id))

    def default_execute(*args, **kwargs):
        return _make_result([])

    def runs_execute(*args, **kwargs):
        return _make_result([])

    builders = {
        "threads": _make_table_builder(threads_execute),
        "messages": _make_table_builder(messages_execute),
        "runs": _make_table_builder(runs_execute),
    }
    default_builder = _make_table_builder(default_execute)

    sb = MagicMock()
    sb.table.side_effect = lambda name: builders.get(name, default_builder)
    sb.rpc.return_value = default_builder

    storage_bucket = MagicMock()
    storage_bucket.upload.return_value = MagicMock()
    storage_bucket.download.return_value = b""
    sb.storage.from_.return_value = storage_bucket

    return sb


async def _consume_sse(client: httpx.AsyncClient, thread_id: str) -> None:
    """Phase 063 D-063-01 rewrite: POST → JSON, then open GET stream.

    Original 058 form drained SSE off a single POST request. After the
    063-02 hard cutover, POST returns 201 + JSON synchronously, then the
    client opens a separate GET /runs/{rid}/stream to consume tokens.
    We replicate that two-step shape here so the cross-tab race in the
    parent test exercises the GET stream's open period (the modern
    equivalent of "while SSE is in-flight").

    No assertions here — the only role of this coroutine is to keep the
    GET stream connection open while the cross-tab GET races against it.

    The slow messages.INSERT (058 SLOW_INSERT_DELAY) happens INSIDE the
    POST handler, before this function gets the run_id. Under the 058
    aexec wrapping, that INSERT is parked on a threadpool worker and the
    event loop is free for the cross-tab GET — that's the original
    D-058-09 invariant, and it still holds under 063 (the slow-INSERT
    is on the POST path, not the GET stream path).
    """
    try:
        # Phase 063 step 1: POST returns JSON synchronously.
        post_resp = await client.post(
            f"/threads/{thread_id}/messages",
            json={"content": "hello"},
            headers={"Authorization": "Bearer test-token"},
            timeout=30.0,
        )
        if post_resp.status_code != 201:
            return  # nothing to subscribe to; let the parent assertion run
        run_id = post_resp.json().get("run_id")
        if not run_id:
            return
        # Phase 063 step 2: open GET stream and drain until done.
        async with client.stream(
            "GET",
            f"/runs/{run_id}/stream?since=0",
            headers={"Authorization": "Bearer test-token"},
            timeout=30.0,
        ) as r:
            async for _ in r.aiter_lines():
                pass
    except asyncio.CancelledError:
        # Cancellation during teardown is expected.
        raise
    except Exception:
        # Swallow other errors so the assertion in the parent can run.
        pass


# ---------------------------------------------------------------------------
# Test
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_cross_tab_unblocked_during_sse():
    """GET /threads/B/messages returns <1.0s while Thread A's SSE is streaming.

    This is the D-058-09 gate. If it fails, the aexec() wrapping is not in
    effect and the event loop is still blocking on sync .execute() calls.

    Strategy: make the pre-stream user-message INSERT slow (1.5s) by
    sleeping inside the mock messages-table execute(). Because aexec()
    wraps execute() in run_in_threadpool, the sleep occupies a worker
    thread and the event loop is free. The cross-tab GET should therefore
    complete in well under a second. Pre-058, the same sleep would block
    the event loop and the GET would hang for the full 1.5s.
    """
    mock_supabase = _build_mock_supabase()

    # Override the Supabase dependency for this test only. We restore the
    # conftest-installed override in the finally block so other tests are
    # unaffected.
    from tests.conftest import _supabase as _conftest_supabase
    app.dependency_overrides[get_supabase] = lambda: mock_supabase

    try:
        # Patch the actual streaming entrypoint looked up inside event_stream.
        # NOTE: it returns (stream, calling_mode) — must mock the tuple.
        with patch(
            "app.services.provider_gateway.openai_compat.create_adaptive_streaming_chat",
            return_value=(iter(_fast_chunks()), CallingMode.NATIVE),
        ):
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as c:
                # Start the SSE stream on Thread A — keeps the event loop busy
                # awaiting the slow INSERT (which is parked on a threadpool
                # worker). If aexec() wrapping is correct, the event loop is
                # FREE to service other requests during this await.
                sse_task = asyncio.create_task(_consume_sse(c, THREAD_A))

                # Give the SSE handler a moment to enter send_message and
                # reach the slow `await aexec(messages.insert(...))` line.
                await asyncio.sleep(0.1)

                # Race: GET Thread B's messages while Thread A's pre-stream
                # INSERT is in flight.
                t0 = time.monotonic()
                r = await c.get(
                    f"/threads/{THREAD_B}/messages",
                    headers={"Authorization": "Bearer test-token"},
                )
                elapsed = time.monotonic() - t0

                # Cancel the SSE task now that we have our measurement, then
                # await it inside a try/except so the test exits cleanly even
                # on assertion failure. CancelledError must be caught here
                # because some Python/anyio versions re-raise during teardown.
                sse_task.cancel()
                try:
                    await sse_task
                except (asyncio.CancelledError, Exception):
                    pass
    finally:
        # Restore the conftest-installed override so subsequent tests use
        # the shared mock supabase as expected.
        app.dependency_overrides[get_supabase] = lambda: _conftest_supabase

    # Print elapsed time for observability under pytest -s. Useful when
    # comparing against the ~1.5s pre-058 baseline if the assertion ever
    # regresses; a healthy run is in the tens of milliseconds.
    print(f"\n[058-03] cross-tab GET elapsed: {elapsed*1000:.1f}ms "
          f"(threshold < 1000ms)")

    assert elapsed < 1.0, (
        f"GET /threads/{THREAD_B}/messages took {elapsed:.2f}s while Thread A "
        f"was awaiting a slow aexec() — aexec() wrapping may not be in effect "
        f"(pre-058 blocking behaviour). Expected < 1.0s."
    )
    assert r.status_code == 200, (
        f"Expected 200 from GET /threads/{THREAD_B}/messages, "
        f"got {r.status_code}: {r.text[:200]}"
    )
