"""Shared 061 / 061.1 test helpers — extracted to avoid relative cross-test imports.

Imported by test_061_producer_survives_disconnect.py, test_061_ttl.py,
test_061_runs_table.py, test_061_hard_timeout.py, test_058_concurrency.py,
and the rewritten test_059_disconnect.py via absolute path:

    from tests.integration._run_helpers import (
        _build_mock_supabase, _fast_chunks, _slow_chunks,
        _make_table_builder, _thread_row, _extract_run_id_from_mock,
        await_producer_finalized,
    )

Absolute imports match the established 058/059 cross-import convention;
relative imports across sibling test files are inconsistent with the
rest of the suite and break collect-time module resolution under pytest.

History:
- Phase 061 Plan 05: introduced ``_extract_run_id_from_mock`` only.
- Phase 061.1 Plan 02 Task 1 (IN-01, D-061.1-11): relocated mock builders
  from ``test_058_concurrency.py:170-237`` so test_058 stops being a
  defacto helper-provider for downstream test files.
- Phase 061.1 Plan 02 Task 1 (D-061.1-01/02/03): added ``await_producer_finalized``
  — the keystone helper that closes the 5 S2 integration test races by
  awaiting the producer task in ``RUN_TASKS`` (or returning immediately
  when the task has already self-evicted, which proves finalization
  per D-061-04 ordering).
- Phase 061.1 Plan 02 Task 2 (IN-02, D-061.1-12): hardened
  ``_extract_run_id_from_mock`` to filter by ``status='streaming'``
  rather than always taking ``call_args_list[0]``.
"""
import asyncio
import time
from typing import Any, Callable
from unittest.mock import MagicMock
from uuid import UUID, uuid4

import pytest


# ─────────────────────────────────────────────────────────────────────────────
# Constants — mirrored from former test_058_concurrency.py:60-69
# ─────────────────────────────────────────────────────────────────────────────

# conftest.mock_user_data uses this exact id; tests that need a stable
# user_id reference it via this constant.
USER_ID = "00000000-0000-0000-0000-000000000001"

# Per-test-module THREAD_A / THREAD_B are still uuid4()'d at import
# time; this is a default placeholder used by _message_row when no
# thread_id is supplied.
_DEFAULT_THREAD_PLACEHOLDER = "00000000-0000-0000-0000-000000000000"

# Slow window for the pre-stream INSERT in 058's cross-tab test.
SLOW_INSERT_DELAY = 1.5


# ─────────────────────────────────────────────────────────────────────────────
# Mock builders (low-level — mimic supabase APIResponse contract + chunks)
# ─────────────────────────────────────────────────────────────────────────────

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
    ``time.sleep`` here, because event_stream iterates the stream with a
    sync ``for chunk in stream:`` loop directly on the event-loop thread.
    A slow sync iterator would block the event loop regardless of aexec()
    correctness (a Phase 059 concern — see CONTEXT.md "Out of scope").
    """
    for token in ("a", "b", "c"):
        yield _make_sse_chunk(token)
    yield _make_done_chunk()


def _slow_chunks(delay: float = 0.3, count: int = 5):
    """Sync generator yielding tokens with a delay so the SSE stream stays
    open long enough for tests to disconnect mid-stream.

    SYNC iterator: per KI-001, ``task.cancel()`` cannot interrupt mid-step;
    cancellation lands at the NEXT await (queue.put) after the chunk.

    ``count=5`` keeps total nominal stream time at ~1.5s of ``time.sleep`` —
    long enough that disconnect is genuinely mid-stream (not after natural
    completion) yet short enough that even a broken cancellation contract
    only delays the test by the remaining un-slept chunks rather than
    wedging the suite.
    """
    for i in range(count):
        time.sleep(delay)  # bounded event-loop block; KI-001 territory
        yield _make_sse_chunk(f"tok{i} ")
    yield _make_done_chunk()


def _thread_row(thread_id: str = _DEFAULT_THREAD_PLACEHOLDER) -> dict:
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
        "thread_id": thread_id or _DEFAULT_THREAD_PLACEHOLDER,
        "user_id": USER_ID,
        "role": role,
        "content": content,
        "tool_calls": None,
        "created_at": "2026-05-01T00:00:00+00:00",
        "updated_at": "2026-05-01T00:00:00+00:00",
    }


def _make_table_builder(execute_fn: Callable[..., Any]) -> MagicMock:
    """Build a chainable mock that routes every chained method back to itself
    and dispatches ``.execute()`` to the supplied callable.

    WR-06 (D-061.1-13): includes ``upsert.return_value = b`` so handlers that
    chain ``.upsert(...).execute()`` (e.g., the user_memory remember tool)
    don't silently land on a fresh unconfigured MagicMock.
    """
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

    The ``messages`` table builder serves the pre-stream INSERT slowly (1.5s)
    so the cross-tab GET races against an in-flight aexec(). All other
    table calls return immediately.

    Why per-table routing? asyncio interleaving makes Thread A and Thread B
    DB calls non-deterministic in order. A flat side_effect queue triggers
    response-validation errors when Thread B picks up a row meant for
    Thread A. Per-table routing keeps each thread's responses well-shaped.

    Phase 061 (Plan 05 Step 0a): the ``runs`` table is also routed through a
    per-table builder so test_061_*.py can inspect ``insert``/``update``
    ``call_args_list``.
    """
    # Track call counts per table to vary responses if needed
    state = {"messages_select_count": 0, "threads_select_count": 0}

    # We use the placeholder thread row here; the 058 cross-tab test that
    # actually inspects the thread_id wraps this builder in a private helper.
    # Other tests do not care which thread_id is returned — they only check
    # that ``.data`` is truthy.
    thread_a_id = _DEFAULT_THREAD_PLACEHOLDER
    thread_b_id = _DEFAULT_THREAD_PLACEHOLDER

    def messages_execute(*args, **kwargs):
        # The pre-stream INSERT is the FIRST messages-table .execute() call
        # from Thread A's send_message handler. Make it slow.
        # Subsequent calls (history SELECT, persist assistant, etc.) are fast.
        state["messages_select_count"] += 1
        if state["messages_select_count"] == 1:
            time.sleep(SLOW_INSERT_DELAY)  # simulate slow DB INSERT
            return _make_result([_message_row(thread_id=thread_a_id)])
        # Subsequent messages-table calls: empty list (history, GET-B messages)
        return _make_result([])

    def threads_execute(*args, **kwargs):
        # Threads-table calls return either the thread row or an empty result.
        # Both Thread A's ownership SELECT and Thread B's ownership SELECT
        # need a successful row; we don't distinguish — both get one.
        state["threads_select_count"] += 1
        thread_id = thread_a_id if state["threads_select_count"] % 2 == 1 else thread_b_id
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


# ─────────────────────────────────────────────────────────────────────────────
# Run-id extraction (IN-02 hardened — D-061.1-12)
# ─────────────────────────────────────────────────────────────────────────────

def _extract_run_id_from_mock(mock_supabase: Any) -> str:
    """Find the 'streaming' run INSERT in ``mock_supabase``'s call args list.

    Phase 061 producer (threads.py:610) calls
        ``supabase.table("runs").insert({"run_id": str(run_id), "thread_id": ..., "status": "streaming", ...})``.
    Plan 05 Step 0a extended ``_build_mock_supabase`` to route the 'runs' table
    through a per-table builder, so the insert call lands in ``call_args_list``
    with the payload as ``args[0]``.

    IN-02 (D-061.1-12): filter by ``payload.get('status') == 'streaming'`` rather
    than always taking ``call_args_list[0]``. Future spawn-failure cleanup paths
    that may add a retry-INSERT no longer break this helper.
    """
    runs_builder = mock_supabase.table("runs")
    insert_calls = runs_builder.insert.call_args_list
    assert insert_calls, "Expected at least one runs INSERT call (D-061-11 lifecycle)"

    for call in insert_calls:
        # call_args is (args, kwargs) — payload is args[0]; supabase-py also
        # accepts the kwarg form as a fallback shape.
        payload = call.args[0] if call.args else call.kwargs.get("data")
        if isinstance(payload, dict) and payload.get("status") == "streaming":
            assert "run_id" in payload, (
                f"Expected streaming runs INSERT to carry 'run_id'; got {payload!r}"
            )
            return payload["run_id"]

    # No streaming INSERT found — collect payload shapes for the assertion message.
    observed = [
        (call.args[0] if call.args else call.kwargs.get("data"))
        for call in insert_calls
    ]
    raise AssertionError(
        f"No 'streaming' run insert found in mock call args. Observed payloads: {observed!r}"
    )


# ─────────────────────────────────────────────────────────────────────────────
# Producer-finalization await (D-061.1-01/02/03 — the keystone S2 race fix)
# ─────────────────────────────────────────────────────────────────────────────

async def await_producer_finalized(
    mock_supabase: Any,
    *,
    timeout: float = 10.0,
) -> None:
    """Await the producer task associated with ``mock_supabase``'s last
    'streaming' run. Use this in tests BEFORE asserting on
    ``mock_supabase`` ``call_args_list`` to eliminate the race window where
    ``_shielded_finalize`` is still detached.

    Implementation (D-061.1-01/02/03):
      1. Extract run_id via ``_extract_run_id_from_mock`` (IN-02 hardened).
      2. Look up the producer task in ``RUN_TASKS``.
      3. If task present: ``await asyncio.wait_for(task, timeout=timeout)``.
         Swallow ``CancelledError`` (test-shutdown path is fine);
         ``TimeoutError`` is a hard failure.
      4. If task is None (producer self-evicted): RETURN IMMEDIATELY.

         D-061.1-03 rationale: D-061-04 locks the shielded finalizer's 5-step
         ordering as ``sentinel → UPDATE → EXPIRE → ZREM → RUN_TASKS.pop``.
         Self-eviction is the LAST step, so by the time ``RUN_TASKS.get`` is
         empty, all observable side-effects (terminal sentinel, runs row
         UPDATE, EXPIRE, ZREM) have already landed. An xrange fallback poll
         would only mask a D-061-04 ordering regression — the right fix in
         that scenario is to restore the ordering, not to hide it in a test
         helper.
    """
    # Late import: production module reaches RUN_TASKS via app.api.threads.
    # Late import keeps the helpers importable in environments that haven't
    # configured the FastAPI app (e.g., pure unit-test bootstraps).
    from app.api.threads import RUN_TASKS    # registry — D-061-11

    run_id_str = _extract_run_id_from_mock(mock_supabase)
    run_id = UUID(run_id_str) if isinstance(run_id_str, str) else run_id_str

    task = RUN_TASKS.get(run_id)
    if task is None:
        # Producer already self-evicted (D-061-04 step 5). All observable
        # side-effects have landed by the contract; no further wait needed.
        return

    try:
        await asyncio.wait_for(task, timeout=timeout)
    except asyncio.CancelledError:
        # Test-shutdown path or producer was cancelled mid-finalize — both
        # acceptable; the side-effects we care about ran inside the
        # _shielded_finalize closure (asyncio.shield-protected per D-061-04).
        pass
    except asyncio.TimeoutError:
        pytest.fail(
            f"Producer task for run_id={run_id} did not finalize within {timeout}s. "
            f"RUN_TASKS keys: {list(RUN_TASKS.keys())}"
        )


# ─────────────────────────────────────────────────────────────────────────────
# Phase 062 helpers (D-062-11 zombie-state setup; SC#3 zombie-heal coverage)
# ─────────────────────────────────────────────────────────────────────────────

async def setup_zombie_state(
    redis_client,
    mock_supabase,
    run_id,
    thread_id,
    *,
    n_entries: int = 1,
):
    """Set up a zombie state for DELETE testing (D-062-11).

    Zombie = ``runs.status='streaming'`` in Postgres but ``RUN_TASKS[run_id]``
    is missing (process restarted, producer died without finalizing, etc.).
    The DELETE handler's "happy path" branch (RUN_TASKS lookup → task.cancel)
    cannot run; it must fall through to the zombie-heal branch instead.

    Effects:
      1. XADD ``n_entries`` delta entries to ``run:{run_id}`` (no producer
         involved — bypasses the normal producer XADD path entirely).
      2. ZADD ``run_id`` to ``runs:active`` and ``runs_by_thread:{thread_id}``
         sorted sets (mirrors the producer-side ZADDs from threads.py:642-643).
      3. Configure ``mock_supabase.table('runs').execute`` to return a
         streaming-status row so the DELETE auth check (D-062-08) passes.

    After calling this, the test fires DELETE and asserts the 4 zombie-heal
    effects per D-062-11:
      (a) Postgres UPDATE called with ``status='cancelled'`` and
          ``error='cancelled_by_user'``
      (b) Synthetic terminal sentinel ``{type: 'cancelled', reason: 'zombie_healed'}``
          landed in the Stream (gives any attached consumer a clean break)
      (c) ZREM cleared the run_id from BOTH sorted sets (runs:active and
          runs_by_thread:{thread_id})
      (d) EXPIRE 60s applied to the stream key (failed/cancelled bucket per
          D-061-04)
    """
    import json
    import time as _time

    stream_key = f"run:{run_id}"
    for i in range(n_entries):
        await redis_client.xadd(
            stream_key,
            {"data": json.dumps({"type": "delta", "content": f"tok{i}"})},
        )
    score = _time.time()
    await redis_client.zadd("runs:active", {str(run_id): score})
    await redis_client.zadd(f"runs_by_thread:{thread_id}", {str(run_id): score})

    # Configure mock SELECT — returns the streaming row needed by the DELETE
    # auth check (D-062-08). Mock-shape mirrors the live Postgres row from
    # the producer's INSERT (threads.py:610) plus the maybe_single() unwrap.
    runs_builder = mock_supabase.table("runs")
    runs_builder.execute.side_effect = lambda *a, **k: type("R", (), {
        "data": {
            "run_id": str(run_id),
            "status": "streaming",
            "thread_id": str(thread_id),
        },
        "count": None,
    })()
