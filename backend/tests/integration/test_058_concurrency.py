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
  - app.api.threads.create_adaptive_streaming_chat — the streaming entry point
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
from unittest.mock import MagicMock, patch
from uuid import uuid4

import httpx
import pytest

from app.dependencies import get_supabase
from app.main import app
from app.services.openai_service import CallingMode


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# conftest.mock_user_data uses this exact id; both Thread A and Thread B must
# scope to it so the mock supabase responses match expectations.
USER_ID = "00000000-0000-0000-0000-000000000001"
THREAD_A = str(uuid4())
THREAD_B = str(uuid4())

# Slow window for the pre-stream INSERT — long enough that the GET MUST
# overlap with it, short enough to keep the test under a few seconds.
SLOW_INSERT_DELAY = 1.5


# ---------------------------------------------------------------------------
# Helpers (private to this module — keep test self-contained)
# ---------------------------------------------------------------------------

def _make_result(data):
    """Mimic the supabase APIResponse contract used by aexec() consumers."""
    r = MagicMock()
    r.data = data
    r.count = len(data) if isinstance(data, list) else None
    return r


def _make_sse_chunk(content: str):
    """One delta SSE chunk in the shape create_adaptive_streaming_chat yields."""
    chunk = MagicMock()
    chunk.choices = [MagicMock()]
    chunk.choices[0].finish_reason = None
    chunk.choices[0].delta = MagicMock()
    chunk.choices[0].delta.content = content
    chunk.choices[0].delta.tool_calls = None
    return chunk


def _make_done_chunk():
    """Final SSE chunk with finish_reason='stop' (signals stream end)."""
    chunk = MagicMock()
    chunk.choices = [MagicMock()]
    chunk.choices[0].finish_reason = "stop"
    chunk.choices[0].delta = MagicMock()
    chunk.choices[0].delta.content = None
    chunk.choices[0].delta.tool_calls = None
    return chunk


def _fast_chunks():
    """Sync generator that yields a few tokens immediately, then DONE.

    The LLM stream itself returns fast — we deliberately do NOT introduce
    `time.sleep` here, because event_stream iterates the stream with a
    sync `for chunk in stream:` loop directly on the event-loop thread.
    A slow sync iterator would block the event loop regardless of aexec()
    correctness (that is a Phase 059 concern — see CONTEXT.md "Out of scope").
    """
    for token in ("a", "b", "c"):
        yield _make_sse_chunk(token)
    yield _make_done_chunk()


def _thread_row(thread_id: str):
    """A minimal threads-table row matching production schema."""
    return {
        "id": thread_id,
        "user_id": USER_ID,
        "title": "058 concurrency test",
        "folder_id": None,
        "created_at": "2026-05-01T00:00:00+00:00",
        "updated_at": "2026-05-01T00:00:00+00:00",
    }


def _message_row(role: str = "user", content: str = "hello", thread_id: str = None):
    return {
        "id": str(uuid4()),
        "thread_id": thread_id or THREAD_A,
        "user_id": USER_ID,
        "role": role,
        "content": content,
        "tool_calls": None,
        "created_at": "2026-05-01T00:00:00+00:00",
        "updated_at": "2026-05-01T00:00:00+00:00",
    }


def _make_table_builder(execute_fn):
    """Build a chainable mock that routes every chained method back to itself
    and dispatches `.execute()` to the supplied callable."""
    b = MagicMock()
    b.select.return_value = b
    b.insert.return_value = b
    b.update.return_value = b
    b.delete.return_value = b
    b.upsert.return_value = b
    b.eq.return_value = b
    b.neq.return_value = b
    b.in_.return_value = b
    b.or_.return_value = b
    b.is_.return_value = b
    b.order.return_value = b
    b.limit.return_value = b
    b.single.return_value = b
    b.maybe_single.return_value = b
    b.gte.return_value = b
    b.lt.return_value = b
    b.range.return_value = b
    b.execute.side_effect = execute_fn
    return b


def _build_mock_supabase():
    """Build a mock supabase client with per-table routing.

    The `messages` table builder serves the pre-stream INSERT slowly (1.5s)
    so the cross-tab GET races against an in-flight aexec(). All other
    table calls return immediately.

    Why per-table routing? asyncio interleaving makes Thread A and Thread B
    DB calls non-deterministic in order. A flat side_effect queue triggers
    response-validation errors when Thread B picks up a row meant for
    Thread A. Per-table routing keeps each thread's responses well-shaped.
    """
    # Track call counts per table to vary responses if needed
    state = {"messages_select_count": 0, "threads_select_count": 0}

    def messages_execute(*args, **kwargs):
        # The pre-stream INSERT is the FIRST messages-table .execute() call
        # from Thread A's send_message handler. Make it slow.
        # Subsequent calls (history SELECT, persist assistant, etc.) are fast.
        state["messages_select_count"] += 1
        if state["messages_select_count"] == 1:
            time.sleep(SLOW_INSERT_DELAY)  # simulate slow DB INSERT
            return _make_result([_message_row(thread_id=THREAD_A)])
        # Subsequent messages-table calls: empty list (history, GET-B messages)
        return _make_result([])

    def threads_execute(*args, **kwargs):
        # Threads-table calls return either the thread row or an empty result.
        # Both Thread A's ownership SELECT and Thread B's ownership SELECT
        # need a successful row; we don't distinguish — both get one.
        # Folder-scope SELECT (`.select("folder_id").eq("id", tid).single()`)
        # also runs against threads — the same row works (folder_id=None).
        state["threads_select_count"] += 1
        # Return alternately for A and B; both succeed because the handler
        # only checks `.data` truthiness.
        thread_id = THREAD_A if state["threads_select_count"] % 2 == 1 else THREAD_B
        return _make_result(_thread_row(thread_id))

    def default_execute(*args, **kwargs):
        # Catch-all for skills, user_memory, audit, etc.
        return _make_result([])

    def runs_execute(*args, **kwargs):
        # Phase 061 (D-061-11): the runs table mock returns an empty result —
        # tests assert against the INSERT/UPDATE call_args_list, not the body.
        return _make_result([])

    builders = {
        "threads": _make_table_builder(threads_execute),
        "messages": _make_table_builder(messages_execute),
        # Phase 061 (Plan 05 Step 0a): route the `runs` table through a
        # per-table builder so test_061_*.py can inspect insert/update
        # call_args_list. PATTERNS.md endorses extending in place rather
        # than monkey-patching across the four 061 integration test files.
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
    """Open the SSE stream and read until exhausted or cancelled.

    No assertions here — the only role of this coroutine is to keep the SSE
    connection open while the cross-tab GET races against it.
    """
    try:
        async with client.stream(
            "POST",
            f"/threads/{thread_id}/messages",
            json={"content": "hello"},
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
            "app.api.threads.create_adaptive_streaming_chat",
            return_value=(iter(_fast_chunks()), CallingMode.NATIVE),
        ):
            async with httpx.AsyncClient(app=app, base_url="http://test") as c:
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
