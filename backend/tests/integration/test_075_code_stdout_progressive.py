"""Phase 075 Plan 02 ship gate (POLISH-SEED-008-02 + SC #2 + SC #4 + D-075-07).

Real-sandbox integration tests for line-by-line code_stdout SSE rewire.

These tests drive a Docker container through the full agent loop and capture
the SSE wire to assert:

  Test 1 (test_five_step_printer_produces_progressive_events):
    A 5-step printer cell `for i in range(5): print(i); time.sleep(1)`
    produces ≥3 distinct `code_stdout` SSE events across ≥1.0 second
    elapsed (SC #2).

  Test 2 (test_captured_at_monotonic):
    The same cell yields a `captured_at` field that is monotonically
    non-decreasing across all `code_stdout` events.

  Test 3 (test_no_duplicate_emit_at_completion):
    No `code_stdout` event arrives AFTER any terminal-marker event — the
    post-completion stdout/stderr emit block at threads.py:2210-2218 is
    DELETED per D-075-07.

  Test 4 (test_silent_workload_emits_heartbeat):
    A silent `time.sleep(5)` cell (no prints) yields ≥4 `code_executing`
    heartbeat events within the 5-second window (D-075-08 invariant; SC #4
    regression guard — heartbeats still fire on truly silent workloads).

All four tests are gated behind SANDBOX_ENABLED=1 because they require a
running Docker daemon. CI without Docker will skip them; the post-merge
manual UAT (Chrome MCP) covers live experience verification.

Test pattern source: backend/tests/integration/test_063_post_then_subscribe.py
(POST-then-GET-stream + 3-patch scaffold).

`_reset_redis_singleton` autouse fixture from conftest.py auto-applies
(per Phase 074 D-074-11).
"""
import json
import os
import pytest
from unittest.mock import patch
from uuid import uuid4

import httpx
from httpx import ASGITransport

from app.api.threads import TERMINAL_TYPES
from app.dependencies import get_supabase
from app.main import app
from app.services.openai_service import CallingMode

from tests.integration._run_helpers import _build_mock_supabase


# Phase 075.1 Plan 02 Task 3 fix: under pytest-asyncio's asyncio_mode=auto,
# module-level `pytestmark = pytest.mark.skipif(...)` can collect tests but
# silently no-op them when the condition fires inside the asyncio event-loop
# dispatch — they appear "passed" without actually executing the bodies. The
# Plan 02 ship gate (5/5 PASS on this file) thus could silently regress to
# 0/5 ACTUALLY-RAN with no visible signal. Switch to a per-function
# decorator that fires BEFORE the event loop attaches — same pattern as
# test_075_tool_args_progress.py (Phase 074 D-074-11). Per-function decorators
# also make the skip visible at collection time (pytest --collect-only -q
# lists 4 test items; with SANDBOX_ENABLED unset, pytest -v shows 4 SKIPPED
# lines with the documented reason).
_SANDBOX_REQUIRED = pytest.mark.skipif(
    not os.environ.get("SANDBOX_ENABLED"),
    reason="Requires Docker daemon (SANDBOX_ENABLED=1)",
)


THREAD_A = str(uuid4())


def _five_step_printer_chunks():
    """Mock OpenAI streaming chunks asking the agent to run a 5-step printer.

    The agent emits a single execute_code tool call with the printer payload,
    then a final assistant text turn after the tool result returns.

    Shape mirrors the slow-chunks pattern in test_063_post_then_subscribe.py
    but with a `tool_calls` delta carrying the execute_code arguments.
    """
    # Use the same MagicMock-shaped chunk pattern as test_063's _slow_chunks
    # (see _run_helpers._slow_chunks for the canonical example). For Plan 02's
    # ship gate we drive the sandbox path directly — the test verifies the
    # SSE wire shape, not the agent's text-generation behavior.
    from unittest.mock import MagicMock

    code_body = "import time\nfor i in range(5):\n    print(i)\n    time.sleep(1)\n"
    arguments_json = json.dumps({"code": code_body})

    # Chunk 1: tool_call delta — name + arguments arrive
    chunk1 = MagicMock()
    chunk1.choices = [MagicMock()]
    chunk1.choices[0].delta.content = None
    chunk1.choices[0].delta.tool_calls = [MagicMock()]
    chunk1.choices[0].delta.tool_calls[0].index = 0
    chunk1.choices[0].delta.tool_calls[0].id = "call_75p2_001"
    chunk1.choices[0].delta.tool_calls[0].function.name = "execute_code"
    chunk1.choices[0].delta.tool_calls[0].function.arguments = arguments_json
    chunk1.choices[0].finish_reason = None
    chunk1.usage = None

    # Chunk 2: finish_reason=tool_calls signals end of LLM streaming for this iteration
    chunk2 = MagicMock()
    chunk2.choices = [MagicMock()]
    chunk2.choices[0].delta.content = None
    chunk2.choices[0].delta.tool_calls = None
    chunk2.choices[0].finish_reason = "tool_calls"
    chunk2.usage = None

    yield chunk1
    yield chunk2

    # Chunk 3: after the tool result, the agent emits a final summary text
    chunk3 = MagicMock()
    chunk3.choices = [MagicMock()]
    chunk3.choices[0].delta.content = "Done."
    chunk3.choices[0].delta.tool_calls = None
    chunk3.choices[0].finish_reason = None
    chunk3.usage = None

    chunk4 = MagicMock()
    chunk4.choices = [MagicMock()]
    chunk4.choices[0].delta.content = None
    chunk4.choices[0].delta.tool_calls = None
    chunk4.choices[0].finish_reason = "stop"
    chunk4.usage = None

    yield chunk3
    yield chunk4


def _silent_sleep_chunks():
    """Mock chunks asking the agent to run `time.sleep(5)` — no prints."""
    from unittest.mock import MagicMock

    code_body = "import time\ntime.sleep(5)\n"
    arguments_json = json.dumps({"code": code_body})

    chunk1 = MagicMock()
    chunk1.choices = [MagicMock()]
    chunk1.choices[0].delta.content = None
    chunk1.choices[0].delta.tool_calls = [MagicMock()]
    chunk1.choices[0].delta.tool_calls[0].index = 0
    chunk1.choices[0].delta.tool_calls[0].id = "call_75p2_002"
    chunk1.choices[0].delta.tool_calls[0].function.name = "execute_code"
    chunk1.choices[0].delta.tool_calls[0].function.arguments = arguments_json
    chunk1.choices[0].finish_reason = None
    chunk1.usage = None

    chunk2 = MagicMock()
    chunk2.choices = [MagicMock()]
    chunk2.choices[0].delta.content = None
    chunk2.choices[0].delta.tool_calls = None
    chunk2.choices[0].finish_reason = "tool_calls"
    chunk2.usage = None

    yield chunk1
    yield chunk2

    chunk3 = MagicMock()
    chunk3.choices = [MagicMock()]
    chunk3.choices[0].delta.content = "Slept."
    chunk3.choices[0].delta.tool_calls = None
    chunk3.choices[0].finish_reason = None
    chunk3.usage = None

    chunk4 = MagicMock()
    chunk4.choices = [MagicMock()]
    chunk4.choices[0].delta.content = None
    chunk4.choices[0].delta.tool_calls = None
    chunk4.choices[0].finish_reason = "stop"
    chunk4.usage = None

    yield chunk3
    yield chunk4


async def _capture_sandbox_run(chunks_factory, timeout: float = 60.0):
    """POST a user message, then GET-stream the run buffer until terminal.

    Returns: list of parsed SSE event dicts.

    `chunks_factory` is a 0-arg callable returning a fresh generator each
    call (since the agent loop may iterate, the patch's side_effect is
    invoked once per iteration).
    """
    mock_supabase = _build_mock_supabase()
    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    events = []
    try:
        with patch(
            "app.api.threads.create_adaptive_streaming_chat",
            side_effect=lambda *a, **k: (chunks_factory(), CallingMode.NATIVE),
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
                resp = await ac.post(
                    f"/threads/{THREAD_A}/messages",
                    headers={"Authorization": "Bearer test-token"},
                    json={"content": "run the cell", "agent_mode": "default"},
                )
                assert resp.status_code == 201, (
                    f"POST expected 201; got {resp.status_code} body={resp.text[:300]}"
                )
                body = resp.json()
                run_id = body["run_id"]

                # Producer warm-up window (Phase 063 D-063-01 / Pitfall 4).
                import asyncio as _asyncio_inner
                await _asyncio_inner.sleep(0.2)

                # Mock ownership SELECT for /runs/{rid}/stream.
                runs_builder = mock_supabase.table("runs")
                runs_builder.execute.side_effect = lambda *a, **k: type("R", (), {
                    "data": {"run_id": run_id, "status": "streaming",
                             "thread_id": THREAD_A, "error": None},
                    "count": None,
                })()

                async with ac.stream(
                    "GET", f"/runs/{run_id}/stream?since=0",
                    headers={"Authorization": "Bearer test-token"},
                    timeout=timeout,
                ) as stream_resp:
                    assert stream_resp.status_code == 200, (
                        f"GET stream expected 200; got {stream_resp.status_code}"
                    )
                    async for line in stream_resp.aiter_lines():
                        if line.startswith("data: "):
                            payload = json.loads(line[6:])
                            events.append(payload)
                            if payload.get("type") in TERMINAL_TYPES:
                                break
    finally:
        app.dependency_overrides.pop(get_supabase, None)

    return events


@_SANDBOX_REQUIRED
@pytest.mark.asyncio
@pytest.mark.timeout(60)
async def test_five_step_printer_produces_progressive_events():
    """SC #2: 5-step printer produces ≥3 distinct code_stdout events ≥1s elapsed.

    With Plan 02's session.execute_command + python -u + line-buffer
    accumulator, each `print(i)` flushes immediately to the on_stdout
    callback; the line-buffer splits chunks on '\n' and emits one
    code_stdout SSE event per complete line. The test asserts ≥3
    distinct events (not 5 because intermediate flushes may merge if
    Docker's chunking aligns) and ≥1s elapsed.
    """
    events = await _capture_sandbox_run(_five_step_printer_chunks)
    stdout_events = [e for e in events if e.get("type") == "code_stdout"]
    assert len(stdout_events) >= 3, (
        f"Expected ≥3 code_stdout events; got {len(stdout_events)}: "
        f"{[e.get('content') for e in stdout_events]}"
    )
    timestamps = [e.get("captured_at") for e in stdout_events if e.get("captured_at") is not None]
    assert len(timestamps) >= 2, (
        f"Expected ≥2 captured_at timestamps; got {timestamps}"
    )
    elapsed = timestamps[-1] - timestamps[0]
    assert elapsed >= 1.0, (
        f"Expected ≥1.0s elapsed across code_stdout events; got {elapsed:.3f}s "
        f"timestamps={timestamps}"
    )


@_SANDBOX_REQUIRED
@pytest.mark.asyncio
@pytest.mark.timeout(60)
async def test_captured_at_monotonic():
    """SC #2 invariant: captured_at field is monotonically non-decreasing."""
    events = await _capture_sandbox_run(_five_step_printer_chunks)
    stdout_events = [e for e in events if e.get("type") == "code_stdout"]
    timestamps = [e.get("captured_at") for e in stdout_events if e.get("captured_at") is not None]
    assert timestamps == sorted(timestamps), (
        f"Non-monotonic captured_at: {timestamps}"
    )


@_SANDBOX_REQUIRED
@pytest.mark.asyncio
@pytest.mark.timeout(60)
async def test_no_duplicate_emit_at_completion():
    """D-075-07: no code_stdout event arrives AFTER sandbox completion.

    Walk events in arrival order; find the first code_execution_complete
    (or any tool_result) marker. Assert no code_stdout event appears
    AFTER that index — the post-completion stdout/stderr emit block at
    threads.py:2210-2218 must be DELETED for this test to pass.
    """
    events = await _capture_sandbox_run(_five_step_printer_chunks)
    # The sandbox emits 'code_execution_complete' when the tool finishes.
    # Any code_stdout AFTER that marker is a D-075-07 violation.
    completion_idx = next(
        (i for i, e in enumerate(events) if e.get("type") == "code_execution_complete"),
        None,
    )
    if completion_idx is None:
        # If no explicit completion marker, fall back to tool_result.
        completion_idx = next(
            (i for i, e in enumerate(events) if e.get("type") == "tool_result"),
            len(events),
        )
    post_completion_stdout = [
        e for e in events[completion_idx + 1:] if e.get("type") == "code_stdout"
    ]
    assert post_completion_stdout == [], (
        f"D-075-07 violation: {len(post_completion_stdout)} code_stdout event(s) "
        f"emitted AFTER completion marker at index {completion_idx}. "
        f"Lines: {[e.get('content') for e in post_completion_stdout]}"
    )


@_SANDBOX_REQUIRED
@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_silent_workload_emits_heartbeat():
    """D-075-08 / SC #4: silent workload (time.sleep(5)) emits ≥4
    code_executing heartbeats in the 5s window.

    The silent-window heartbeat guard fires the heartbeat only when
    `now - _last_output_at >= 1.0s`. With no stdout flushes during
    time.sleep(5), `_last_output_at` is never reset and the heartbeat
    fires every ~1s for the full 5-second window.
    """
    events = await _capture_sandbox_run(_silent_sleep_chunks, timeout=15.0)
    heartbeats = [e for e in events if e.get("type") == "code_executing"]
    assert len(heartbeats) >= 4, (
        f"SC #4 invariant broken: silent workload emitted "
        f"{len(heartbeats)} code_executing heartbeats; expected ≥4 in 5s window. "
        f"Event types: {[e.get('type') for e in events]}"
    )
