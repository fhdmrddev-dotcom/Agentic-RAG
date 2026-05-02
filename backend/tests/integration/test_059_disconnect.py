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

# ---------------------------------------------------------------------
# 059-specific helpers (slow LLM stream, call counter, mid-stream disconnect)
# ---------------------------------------------------------------------

def _slow_chunks(delay: float = SLOW_CHUNK_DELAY, count: int = 50):
    """Sync generator yielding tokens with a delay so the SSE stream stays
    open long enough for the test to disconnect mid-stream.

    SYNC iterator: per KI-001, task.cancel() cannot interrupt mid-step;
    cancellation lands at the NEXT await (queue.put) after the chunk.
    Test's <1s budget includes this gap (RESEARCH §"Cancellation
    Propagation Timeline" — worst-case 500ms+).
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


async def _read_then_disconnect(client: httpx.AsyncClient, thread_id: str) -> float:
    """Open SSE, read until first data: line lands, exit context (→ http.disconnect).

    Returns monotonic timestamp of disconnect so the test can measure
    cancellation latency from that point. timeout=30.0 + @pytest.mark.timeout(10)
    on the test guard against Pitfalls 4 (sentinel never sent) and 7
    (httpx ASGITransport hangs).
    """
    async with client.stream(
        "POST",
        f"/threads/{thread_id}/messages",
        json={"content": "hello"},
        headers={"Authorization": "Bearer test-token"},
        timeout=30.0,
    ) as r:
        async for line in r.aiter_lines():
            if line.startswith("data:"):
                break  # exiting `async with` triggers ASGI http.disconnect
    return time.monotonic()


# ---------------------------------------------------------------------
# Tests — Wave 0 placeholders. Wave 1 implements bodies per PATTERNS.md.
# ---------------------------------------------------------------------

@pytest.mark.asyncio
@pytest.mark.timeout(10)
async def test_agent_task_cancels_on_disconnect():
    """D-059-06 merge gate. Asserts I1+I2+I3+I4. Implemented in Wave 1."""
    pytest.fail(
        "Wave 1 not yet implemented — see plan 059-03-PLAN.md. "
        "This placeholder confirms test collection works in Wave 0."
    )


@pytest.mark.asyncio
@pytest.mark.timeout(10)
async def test_normal_stream_unchanged():
    """Smoke: happy-path stream still emits delta/done/stream_end events.
    Wave 1 fills body; Wave 0 placeholder fails."""
    pytest.fail(
        "Wave 1 not yet implemented — see plan 059-03-PLAN.md."
    )
