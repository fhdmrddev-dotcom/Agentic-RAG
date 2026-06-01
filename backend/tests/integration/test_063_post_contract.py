"""D-063-01: POST /threads/{thread_id}/messages contract.

Phase 063 Plan 01 (Wave 0 — D-063-01 contract surface) + Plan 05 fill-in.

These two tests bind the new POST contract:

  POST /threads/{thread_id}/messages
  Returns: HTTP 201 application/json
  Body:    {"message_id": "<user_message_uuid>", "run_id": "<run_uuid>"}

Plan 05 update: ``test_post_returns_before_producer_first_xadd`` now uses
the real Redis fixture + a slow-mock LLM to assert the timing invariant
(POST returns BEFORE the producer's first XADD lands). This proves
Pitfall 4 — the runs row is SELECT-able before the producer makes
visible progress, and the response is NOT awaiting producer scheduling.

Pattern source: backend/tests/integration/test_062_stream_replay.py:36-51
(per-file ``_reset_redis_singleton`` autouse fixture, D-062-14).

Anti-false-RED guard:
  ``assert resp.headers.get("content-type", "").startswith("application/json")``
  is asserted BEFORE the body shape check so a stale SSE response (which
  has content-type ``text/event-stream``) reports a recognizable contract
  error rather than tripping over a different code path.
"""
import time as _time_mod
from unittest.mock import MagicMock, patch
from uuid import uuid4

import httpx
import pytest
from httpx import ASGITransport

from app.dependencies import get_supabase
from app.main import app
from app.services.openai_service import CallingMode
from tests.integration._run_helpers import (
    _build_mock_supabase,
    _make_result,
    _make_table_builder,
    _message_row,
    _slow_chunks,
    _thread_row,
    USER_ID,  # noqa: F401
)
from tests.integration.test_059_disconnect import _reset_sse_starlette_app_status  # noqa: F401, E402


def _build_fast_mock_supabase():
    """``_build_mock_supabase`` clone WITHOUT the 1.5s slow-INSERT sleep.

    The shared 058 fixture sleeps 1.5s on the first messages.INSERT so the
    cross-tab race test can prove aexec() unblocks the event loop. Plan 05
    timing tests need a fast pre-stream path — the SLOW_INSERT_DELAY would
    blow past the < 0.5s response-time threshold for unrelated reasons
    (058 surface, not Pitfall 4).
    """
    state = {"messages_select_count": 0}

    def messages_execute(*args, **kwargs):
        state["messages_select_count"] += 1
        if state["messages_select_count"] == 1:
            return _make_result([_message_row()])
        return _make_result([])

    def threads_execute(*args, **kwargs):
        return _make_result(_thread_row())

    def runs_execute(*args, **kwargs):
        return _make_result([])

    def default_execute(*args, **kwargs):
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

THREAD_A = str(uuid4())


@pytest.fixture(autouse=True)
def _reset_redis_singleton():
    """Reset app.dependencies._redis between tests.

    Loop-binding trap (Pitfall 6 / D-062-14): pytest-asyncio function-scope
    creates a fresh event loop per test. The cached singleton would
    otherwise be invoked by test N+1 against test N's closed loop with
    ``RuntimeError: Event loop is closed``.

    Required for ``test_post_returns_before_producer_first_xadd`` because
    it now uses real Redis (the ``redis_client`` fixture) so the producer
    actually XADDs to a live stream. Verbatim copy from
    test_062_stream_replay.py:36-51.
    """
    import app.dependencies as _deps
    _deps._redis = None
    yield
    _deps._redis = None


@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_post_returns_message_and_run_ids():
    """D-063-01: POST returns 201 + JSON {message_id, run_id}, NOT EventSourceResponse.

    Anti-false-RED guards:
      (1) status_code == 201 (route exists and committed)
      (2) content-type starts with 'application/json' (NOT 'text/event-stream' —
          this is the contract assertion that fails on legacy code)
      (3) body has both message_id AND run_id keys
    """
    mock_supabase = _build_mock_supabase()

    # Configure the threads ownership SELECT to return a row so the route reaches
    # the messages INSERT path. _build_mock_supabase already wires this for
    # threads/messages/runs tables (see _run_helpers.py:179-237).
    threads_builder = mock_supabase.table("threads")
    threads_builder.execute.side_effect = lambda *a, **k: _make_result({"id": THREAD_A})

    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    try:
        async with httpx.AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as c:
            resp = await c.post(
                f"/threads/{THREAD_A}/messages",
                headers={"Authorization": "Bearer test-token"},
                json={"content": "hello", "agent_mode": "default"},
            )

        assert resp.status_code == 201, (
            f"Expected 201; got {resp.status_code} body={resp.text[:300]}"
        )

        # Anti-false-RED guard: response must be JSON, NOT text/event-stream.
        # On master, send_message returned EventSourceResponse → content-type
        # was 'text/event-stream', so this assertion fired the recognizable
        # contract error. After 063-02 it's JSON.
        ctype = resp.headers.get("content-type", "")
        assert ctype.startswith("application/json"), (
            f"Expected JSON content-type, got {ctype!r}"
        )

        body = resp.json()
        assert "message_id" in body and "run_id" in body, (
            f"Expected {{message_id, run_id}}; got {body!r}"
        )
    finally:
        app.dependency_overrides.pop(get_supabase, None)


@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_post_returns_before_producer_first_xadd(redis_client):
    """D-063-01 timing invariant (Pitfall 4 — Plan 05 fill-in).

    Asserts that POST /threads/{tid}/messages returns synchronously BEFORE
    the producer task makes visible progress in Redis. This proves:

      (a) The runs row INSERT happened pre-return (Pitfall 4 — frontend's
          subsequent GET /runs/{rid}/stream MUST be able to SELECT the row).
      (b) The response is NOT blocking on the producer's first XADD —
          the producer task is detached via ``asyncio.create_task`` and
          its first XADD may arrive any time after the response.

    Strategy:
      - Patch ``create_adaptive_streaming_chat`` with ``_slow_chunks`` so
        the producer's first delta XADD is delayed by ~0.3s — well after
        any reasonable POST response time.
      - Measure wall-clock POST latency: must be < 0.5s (response is NOT
        awaiting the slow producer).
      - Snapshot ``XLEN run:{run_id}`` immediately after POST returns:
        must be very small (typically 0) — proving the producer hasn't
        had time to XADD anything substantial.

    Pattern source: 063-PATTERNS.md "test_063_post_contract.py" section
    + 063-05-PLAN.md "Concrete approach" steps 1-5.
    """
    # Use the fast variant — the shared _build_mock_supabase has a 1.5s sleep
    # on the messages INSERT (058 cross-tab surface) which is unrelated to
    # the Pitfall 4 invariant under test here.
    mock_supabase = _build_fast_mock_supabase()
    app.dependency_overrides[get_supabase] = lambda: mock_supabase

    try:
        with patch(
            "app.services.provider_gateway.openai_compat.create_adaptive_streaming_chat",
            side_effect=lambda *a, **k: (iter(_slow_chunks(delay=0.3, count=10)),
                                         CallingMode.NATIVE),
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
                # Time the POST response. Producer's first XADD is gated by
                # a 0.3s sync sleep; if the response is awaiting it, we'd
                # see > 0.3s here. Healthy: tens of ms.
                t0 = _time_mod.monotonic()
                resp = await ac.post(
                    f"/threads/{THREAD_A}/messages",
                    headers={"Authorization": "Bearer test-token"},
                    json={"content": "hello", "agent_mode": "default"},
                )
                t1 = _time_mod.monotonic()

            # Contract: 201 + JSON envelope (matches test_post_returns_message_and_run_ids).
            assert resp.status_code == 201, (
                f"D-063-01: POST must return 201 with JSON envelope; got "
                f"{resp.status_code}, content-type="
                f"{resp.headers.get('content-type')!r}, body={resp.text[:200]}"
            )
            ctype = resp.headers.get("content-type", "")
            assert ctype.startswith("application/json"), (
                f"Expected JSON content-type, got {ctype!r}"
            )

            body = resp.json()
            run_id = body["run_id"]
            stream_key = f"run:{run_id}"

            # Timing invariant: response returns well under the 0.3s/chunk
            # producer pace. If we exceeded 0.5s, the response is blocking
            # on producer scheduling — Pitfall 4 violated.
            elapsed = t1 - t0
            assert elapsed < 0.5, (
                f"D-063-01 Pitfall 4: POST must return synchronously without "
                f"awaiting producer's first XADD. Got elapsed={elapsed:.3f}s "
                f"(>= 0.5s threshold; producer chunk-delay is 0.3s, so > 0.5s "
                f"means the response was awaiting producer progress)."
            )

            # XLEN invariant: at response time, the producer has at most
            # had time to emit a small handful of lifecycle events
            # (``iteration_start``, ``planning``) before its sync LLM call
            # blocks on ``_slow_chunks``' first 0.3s sleep. A blocking
            # response (which awaited the producer's full first iteration)
            # would have driven XLEN much higher (>= 1 delta + tool events).
            #
            # We assert XLEN < 5 — well below the producer's natural
            # progression. The primary timing signal (elapsed < 0.5s above)
            # is the load-bearing assertion; XLEN is corroborating evidence
            # that no producer-side LLM ticks landed during the response.
            xlen_at_return = await redis_client.xlen(stream_key)
            assert xlen_at_return < 5, (
                f"D-063-01 Pitfall 4: at POST response time, the producer's "
                f"buffer should be empty or near-empty (response did not "
                f"await producer XADDs). Got XLEN={xlen_at_return} for "
                f"run:{run_id} — high values indicate the response was "
                f"blocking on producer progress."
            )

            # Cleanup: cancel + await the producer task so it doesn't leak
            # into the next test's RUN_TASKS or hold a teardown reference
            # to the per-test event loop. Without this, a still-running
            # producer's next XADD lands against a closed loop on test
            # exit (Pitfall 6 — RuntimeError: Event loop is closed).
            import asyncio as _asyncio
            from app.api.threads import RUN_TASKS as _RUN_TASKS
            from uuid import UUID as _UUID
            try:
                _task = _RUN_TASKS.get(_UUID(run_id))
                if _task is not None and not _task.done():
                    _task.cancel()
                    try:
                        await _asyncio.wait_for(_task, timeout=5.0)
                    except (_asyncio.CancelledError, _asyncio.TimeoutError, Exception):
                        pass
            except Exception:
                pass
            try:
                await redis_client.delete(stream_key)
            except Exception:
                pass
    finally:
        app.dependency_overrides.pop(get_supabase, None)
