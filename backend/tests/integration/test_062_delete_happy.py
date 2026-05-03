"""SC#3 happy path: DELETE /runs/{run_id} on an in-flight run cancels the
producer task in RUN_TASKS via task.cancel(), returns 204 immediately, and
the producer's existing CancelledError handler (threads.py:2110-2116) +
_shielded_finalize (threads.py:~2123-2138) drives the asynchronous
finalization (UPDATE runs.status='cancelled' + terminal sentinel + EXPIRE +
ZREM × 2 + RUN_TASKS.pop).

Phase 062 Plan 03 (D-062-08, D-062-10).
"""
import json
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
@pytest.mark.timeout(15)
async def test_cancels_in_flight_producer(redis_client):
    """SC#3 happy / D-062-10: DELETE in-flight run → task.cancel() → 204 →
    finalize-async → runs.status='cancelled' UPDATE lands via the existing
    _shielded_finalize.

    Flow:
      1. POST spawns a real producer with slow-mock LLM (RUN_TASKS populated).
      2. Confirm precondition: RUN_TASKS contains the run_id.
      3. Configure runs SELECT for the DELETE auth check.
      4. Fire DELETE; assert 204 within 1s.
      5. await_producer_finalized — drives the producer's CancelledError
         handler + _shielded_finalize to completion.
      6. Assert runs.status='cancelled' UPDATE landed (via _shielded_finalize).
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
                    # Read first line to confirm producer started, then disconnect
                    async for _line in r.aiter_lines():
                        break

                # Step 2: extract run_id from the producer's INSERT
                run_id_str = _extract_run_id_from_mock(mock_supabase)
                run_id = UUID(run_id_str)

                # Confirm precondition: RUN_TASKS contains the producer (D-062-10)
                assert run_id in RUN_TASKS, (
                    f"Expected {run_id} in RUN_TASKS pre-DELETE; "
                    f"got keys={list(RUN_TASKS.keys())}"
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

                # Step 4: fire DELETE — must return 204 immediately
                delete_resp = await ac.delete(
                    f"/runs/{run_id}",
                    headers={"Authorization": "Bearer test-token"},
                )
                assert delete_resp.status_code == 204, (
                    f"Expected 204; got {delete_resp.status_code} "
                    f"body={delete_resp.text}"
                )

            # Step 5: producer's _shielded_finalize runs ASYNC after task.cancel()
            # — wait for it to complete before asserting on UPDATE call args.
            await await_producer_finalized(mock_supabase)

        # Step 6: runs.status='cancelled' UPDATE landed via _shielded_finalize
        update_calls = runs_builder.update.call_args_list
        cancelled = [
            c for c in update_calls
            if (c.args and isinstance(c.args[0], dict)
                and c.args[0].get("status") == "cancelled")
        ]
        assert cancelled, (
            f"Expected runs.status='cancelled' UPDATE post-finalize; "
            f"got {update_calls}"
        )
    finally:
        app.dependency_overrides.pop(get_supabase, None)
