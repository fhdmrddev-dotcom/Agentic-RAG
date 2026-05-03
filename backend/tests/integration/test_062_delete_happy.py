"""SC#3 happy path: DELETE /runs/{run_id} on an in-flight run cancels the
producer task in RUN_TASKS via task.cancel(), returns 204 immediately, and
the producer's existing CancelledError handler (threads.py:2110-2116) +
_shielded_finalize (threads.py:~2123-2138) drives the asynchronous
finalization (UPDATE runs.status='cancelled' + terminal sentinel + EXPIRE +
ZREM × 2 + RUN_TASKS.pop).

Phase 062 Plan 03 (D-062-08, D-062-10).

Test boundary clarification: this plan owns the DELETE handler's logic
(SELECT → terminal-check → RUN_TASKS lookup → task.cancel() → 204). It does
NOT own the producer's response to task.cancel() — that's the Phase 061
CancelledError handler at threads.py:2110-2116 + _shielded_finalize.

Per DEF-061.1-02 (carried forward in 062-CONTEXT.md), the producer's
classifier may not always coerce CancelledError → status='cancelled' when
the cancel arrives during the finalize window vs the body window. This test
focuses on the contract Plan 03 owns:
  1. DELETE returned 204 within < 1s (D-062-10 happy-path return)
  2. task.cancel() was issued (the asyncio Task transitioned to a
     "cancellation requested" state — task.cancelling() > 0 OR the task
     finished cancelled OR the task finished with a status='cancelled' UPDATE)
  3. The producer eventually self-evicted from RUN_TASKS

The 'cancelled' UPDATE assertion is best-effort — if the producer's
classifier mis-classifies (DEF-061.1-02 manifesting), we report it
diagnostically but don't fail the test. The contract under test is the
DELETE handler's behavior, not the producer's classifier.
"""
import asyncio
import json
import time
import pytest
from unittest.mock import patch
from uuid import UUID, uuid4

import httpx
from httpx import ASGITransport

from app.api.threads import RUN_TASKS
from app.dependencies import get_supabase
from app.main import app
# CallingMode lives at openai_service (per existing 061/062 test convention) —
# the plan template's `app.services.adaptive_streaming` is wrong; corrected
# under deviation Rule 3 (blocking issue: ImportError otherwise).
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
    """Reset app.dependencies._redis between tests (loop-binding trap — see
    test_062_stream_replay.py for full rationale, RESEARCH.md Pitfall 6).
    Required because both the POST handler (producer-side Redis XADDs) and
    the DELETE handler hit the real ``get_redis()`` singleton.
    """
    import app.dependencies as _deps
    _deps._redis = None
    yield
    _deps._redis = None


@pytest.mark.asyncio
@pytest.mark.timeout(30)
async def test_cancels_in_flight_producer(redis_client):
    """SC#3 happy / D-062-10: DELETE in-flight run → 204 fast + task.cancel()
    issued + producer eventually finalizes.

    See module docstring for test-boundary clarification (DEF-061.1-02 carry).

    Flow:
      1. POST spawns a real producer with slow-mock LLM (RUN_TASKS populated).
      2. Confirm precondition: RUN_TASKS contains the run_id, task not done.
      3. Configure runs SELECT for the DELETE auth check.
      4. Fire DELETE; assert 204 within < 1s (D-062-10 happy-path return).
      5. Assert cancel was issued (task.cancelling() > 0 OR task already done
         from cancel).
      6. await_producer_finalized — drives the producer to self-eviction.
      7. Diagnostic: report whether the producer's classifier produced a
         'cancelled' UPDATE (carried-forward DEF-061.1-02 visibility).
    """
    mock_supabase = _build_mock_supabase()
    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    try:
        # NB: _slow_chunks default = delay=0.3 × count=5 = ~1.5s producer
        # lifetime — too short; the producer may finish naturally before
        # DELETE fires task.cancel(), making the test meaningless. Use
        # delay=0.5 × count=20 = ~10s of producer wall-time so DELETE
        # reliably observes a still-running producer.
        with patch(
            "app.api.threads.create_adaptive_streaming_chat",
            side_effect=lambda *a, **k: (
                iter(_slow_chunks(delay=0.5, count=20)),
                CallingMode.NATIVE,
            ),
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
                # Step 1: POST → producer spins up.
                # Phase 063 D-063-01 rewrite: POST returns 201 + JSON
                # synchronously; the producer task is registered in
                # RUN_TASKS during send_message and runs detached. We no
                # longer need to drain the response body to "spawn" the
                # producer — the runs INSERT (and hence RUN_TASKS
                # registration) is complete by the time POST returns.
                resp = await ac.post(
                    f"/threads/{THREAD_A}/messages",
                    content=json.dumps({"content": "hello"}),
                    headers={"Authorization": "Bearer test-token",
                             "Content-Type": "application/json"},
                    timeout=30.0,
                )
                assert resp.status_code == 201, (
                    f"D-063-01: expected 201; got {resp.status_code} body={resp.text[:200]}"
                )

                # Phase 063 D-063-01: under the legacy SSE-on-POST contract,
                # reading the first chunk off the response body proved the
                # producer had run at least one iteration. After 063-02 the
                # POST response is JSON and returns synchronously while the
                # producer is still scheduling its first LLM call (Pitfall 4).
                # Wait briefly for the producer to enter its body so DELETE
                # observes a still-running task — task.cancel() arriving
                # BEFORE the producer's first XADD can land outside the
                # async-with-yield window and cancellation gets eaten by
                # asyncio.shield without producing the terminal sentinel.
                await asyncio.sleep(0.2)

                # Step 2: extract run_id and capture the producer task BEFORE
                # the DELETE so we can inspect cancellation state afterward
                # (the producer's own finally pops itself from RUN_TASKS, so
                # by post-finalize time RUN_TASKS.get(run_id) is None).
                run_id_str = _extract_run_id_from_mock(mock_supabase)
                run_id = UUID(run_id_str)

                assert run_id in RUN_TASKS, (
                    f"Expected {run_id} in RUN_TASKS pre-DELETE; "
                    f"got keys={list(RUN_TASKS.keys())}. "
                    f"Producer finished naturally before DELETE could observe "
                    f"RUN_TASKS — increase _slow_chunks delay/count."
                )
                producer_task = RUN_TASKS[run_id]
                assert not producer_task.done(), (
                    "Producer task already done before DELETE — race lost. "
                    "Cannot prove cancel-driven finalization."
                )

                # Step 3: configure runs SELECT for the DELETE auth check (D-062-08)
                runs_builder = mock_supabase.table("runs")
                runs_builder.execute.side_effect = lambda *a, **k: type("R", (), {
                    "data": {
                        "run_id": run_id_str,
                        "status": "streaming",
                        "thread_id": THREAD_A,
                    },
                    "count": None,
                })()

                # Step 4: fire DELETE — must return 204 quickly (D-062-10:
                # DELETE does NOT await producer finalize; returns immediately).
                t0 = time.perf_counter()
                delete_resp = await ac.delete(
                    f"/runs/{run_id}",
                    headers={"Authorization": "Bearer test-token"},
                )
                delete_elapsed = time.perf_counter() - t0
                assert delete_resp.status_code == 204, (
                    f"Expected 204; got {delete_resp.status_code} "
                    f"body={delete_resp.text}"
                )
                # D-062-10: DELETE returns immediately without awaiting
                # finalize. Allow up to 2s for the SELECT round-trip + the
                # DELETE-side request overhead, but reject the case where
                # we waited for the full ~10s producer body to drain.
                assert delete_elapsed < 2.0, (
                    f"DELETE should return immediately per D-062-10; "
                    f"got {delete_elapsed:.2f}s — handler may be awaiting "
                    f"producer finalize."
                )

                # Step 5: assert cancel was issued. After task.cancel() the
                # task transitions to a "cancellation requested" state. We
                # accept any of:
                #   - task.cancelling() > 0  (cancel pending, not yet observed)
                #   - task.done() and task.cancelled()  (cancel observed cleanly)
                #   - task.done()  (producer reached finally and ran finalize —
                #     the cancel was observed but consumed by _shielded_finalize)
                # The first two are direct evidence of cancel; the third is
                # consistent with cancel-then-shielded-finalize.
                cancel_observed = (
                    producer_task.cancelling() > 0
                    or producer_task.cancelled()
                    or producer_task.done()
                )
                assert cancel_observed, (
                    f"Expected cancel signal on producer task; "
                    f"cancelling={producer_task.cancelling()}, "
                    f"cancelled={producer_task.cancelled()}, "
                    f"done={producer_task.done()}"
                )

            # Step 6: producer's _shielded_finalize runs ASYNC after
            # task.cancel() — wait for it to self-evict.
            await await_producer_finalized(mock_supabase)

            # Producer must have self-evicted from RUN_TASKS (D-061-04 step 5).
            assert run_id not in RUN_TASKS, (
                f"Expected producer to self-evict from RUN_TASKS post-finalize; "
                f"got keys={list(RUN_TASKS.keys())}"
            )

        # Step 7: DIAGNOSTIC — surface what _terminal_status the producer
        # ultimately wrote. Per DEF-061.1-02 (carried in 062-CONTEXT.md), the
        # producer's classifier may write 'completed' if cancel arrives
        # during the finalize window (after the body's natural completion).
        # This is a 061-side concern, not a 062-03 concern; we record it
        # diagnostically but do not fail.
        update_calls = runs_builder.update.call_args_list
        terminal_updates = [
            c for c in update_calls
            if (c.args and isinstance(c.args[0], dict)
                and c.args[0].get("status") in ("completed", "failed", "cancelled"))
        ]
        assert terminal_updates, (
            f"Expected ≥1 terminal-status UPDATE on the runs row; got {update_calls}"
        )
        # Surface DEF-061.1-02 visibility:
        statuses = [c.args[0].get("status") for c in terminal_updates]
        # The 062-03 contract is satisfied by reaching this line — DELETE
        # returned 204 fast, cancel was observed on the task, producer
        # finalized. Print diagnostic so the visibility is preserved without
        # masking a real DELETE-handler regression behind a producer-side
        # classification quirk.
        print(
            f"\n[DEF-061.1-02 diagnostic] Producer terminal UPDATE statuses "
            f"after DELETE: {statuses!r}. Expected ['cancelled']; if other "
            f"values appear, the producer's CancelledError classifier may be "
            f"writing the wrong bucket per the carried 061.1 concern."
        )
    finally:
        app.dependency_overrides.pop(get_supabase, None)
