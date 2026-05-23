"""075.6 Plan 01 / SPEC Req #1 acceptance: code_so_far monotonic-prefix
growth on the Redis Stream run buffer. Sibling of
backend/tests/integration/test_075_tool_args_progress.py — reuses
seeded_thread + _capture_run_events + _make_openai_tool_chunk +
_slow_chunks_with_big_args fixtures by direct import.

VALIDATION.md row "Req #1 acceptance (monotonic prefix growth on Redis
stream)" — the binding gate that proves the additive `code_so_far`
field carries the FULL cumulative concatenated args (not the 5 KB tail)
AND grows monotonically prefix-wise across consecutive emits for the
same tool_index.

Three tests:
  1. test_code_so_far_monotonic_prefix_growth — consecutive events
     share the same tool_index and event N's `code_so_far` is a string
     prefix of event N+1's.
  2. test_code_so_far_non_empty_for_large_execute_code — every progress
     event's `code_so_far` is a non-empty string.
  3. test_code_so_far_grows_to_full_args_size — at the LAST progress
     event before tool_start, `len(code_so_far.encode("utf-8"))` equals
     `total_args_bytes_so_far` (proves the field is the FULL cumulative,
     not the 5 KB sliding-window tail).
"""
import asyncio
import json
import os
from types import SimpleNamespace
from unittest.mock import patch
from uuid import UUID, uuid4

import asyncpg
import httpx
import pytest
import pytest_asyncio
from httpx import ASGITransport

from app.api.threads import TERMINAL_TYPES
from app.dependencies import get_supabase
from app.main import app
from app.services.openai_service import CallingMode

from tests.integration._run_helpers import _build_mock_supabase
# Cross-imported autouse fixture (same rationale as test_075_tool_args_progress.py):
# reset sse-starlette AppStatus per test so the cached anyio.Event doesn't
# leak across pytest-asyncio loops.
from tests.integration.test_059_disconnect import _reset_sse_starlette_app_status  # noqa: F401, E402
from tests.integration.test_075_tool_args_progress import (  # noqa: E402
    seeded_thread,
    _capture_run_events,
    _slow_chunks_with_big_args,
    _make_openai_tool_chunk,
    PG_AVAILABLE,
)


pytestmark = pytest.mark.skipif(
    not PG_AVAILABLE,
    reason="Local Postgres not reachable; skipping 075.6 integration tests",
)


@pytest.mark.asyncio
@pytest.mark.timeout(30)
async def test_code_so_far_monotonic_prefix_growth(seeded_thread):
    """075.6 Req #1 acceptance: consecutive tool_args_progress events
    for the same tool_index satisfy
    `events[N+1]["code_so_far"].startswith(events[N]["code_so_far"])`
    AND `len(events[N+1]["code_so_far"]) >= len(events[N]["code_so_far"])`.

    Drives `_slow_chunks_with_big_args(tool_name="execute_code",
    chunk_size=2048, n_chunks=8)` → 16 KB total → boundaries at 5/10/15
    KB → ≥3 progress events.
    """
    events = await _capture_run_events(
        list(_slow_chunks_with_big_args(
            tool_name="execute_code",
            chunk_size=2048,
            n_chunks=8,
        )),
        seeded_thread,
    )
    progress = [e for e in events if e.get("type") == "tool_args_progress"]
    assert len(progress) >= 2, (
        f"Expected >=2 progress events; got {len(progress)}. "
        f"All types: {[e.get('type') for e in events]}"
    )

    # Group by tool_index, then assert prefix-monotonic on each group.
    by_index: dict[int, list[dict]] = {}
    for e in progress:
        by_index.setdefault(e["tool_index"], []).append(e)

    for idx, evts in by_index.items():
        for prev, curr in zip(evts, evts[1:]):
            assert curr["code_so_far"].startswith(prev["code_so_far"]), (
                f"tool_index={idx}: code_so_far is NOT prefix-monotonic. "
                f"prev_len={len(prev['code_so_far'])} "
                f"curr_len={len(curr['code_so_far'])}"
            )
            assert len(curr["code_so_far"]) >= len(prev["code_so_far"]), (
                f"tool_index={idx}: code_so_far length must be non-decreasing; "
                f"prev_len={len(prev['code_so_far'])} > "
                f"curr_len={len(curr['code_so_far'])}"
            )


@pytest.mark.asyncio
@pytest.mark.timeout(30)
async def test_code_so_far_non_empty_for_large_execute_code(seeded_thread):
    """075.6 Req #1 acceptance: every `tool_args_progress` event carries
    a non-empty `code_so_far` string. Driven by the same 16 KB execute_code
    fixture as the monotonic-prefix test."""
    events = await _capture_run_events(
        list(_slow_chunks_with_big_args(
            tool_name="execute_code",
            chunk_size=2048,
            n_chunks=8,
        )),
        seeded_thread,
    )
    progress = [e for e in events if e.get("type") == "tool_args_progress"]
    assert progress, (
        f"No tool_args_progress events to assert against. "
        f"All types: {[e.get('type') for e in events]}"
    )
    for e in progress:
        assert "code_so_far" in e, (
            f"tool_args_progress event missing `code_so_far` key: {e}"
        )
        assert isinstance(e["code_so_far"], str), (
            f"`code_so_far` must be a str; got {type(e['code_so_far'])}"
        )
        assert e["code_so_far"], (
            f"`code_so_far` must be non-empty; got {e['code_so_far']!r} "
            f"(total_args_bytes_so_far={e.get('total_args_bytes_so_far')})"
        )


@pytest.mark.asyncio
@pytest.mark.timeout(30)
async def test_code_so_far_grows_to_full_args_size(seeded_thread):
    """075.6 Req #1 acceptance: `code_so_far` is the FULL cumulative
    concatenated args string — NOT the 5 KB sliding-window tail (that's
    `args_so_far`). Proof: at the LAST progress event before `tool_start`,
    `len(code_so_far.encode("utf-8")) == total_args_bytes_so_far`.

    Contrast with `args_so_far`, whose encoded length is bounded by 5120
    bytes (verified separately by `test_args_so_far_bounded`)."""
    events = await _capture_run_events(
        list(_slow_chunks_with_big_args(
            tool_name="execute_code",
            chunk_size=2048,
            n_chunks=8,
        )),
        seeded_thread,
    )
    progress = [e for e in events if e.get("type") == "tool_args_progress"]
    assert progress, "No tool_args_progress events to assert against"

    # The last progress event arrives before tool_start (D-075-10 ordering).
    last = progress[-1]
    code_bytes = len(last["code_so_far"].encode("utf-8"))
    total_bytes = last["total_args_bytes_so_far"]
    assert code_bytes == total_bytes, (
        f"`code_so_far` must equal full cumulative args. "
        f"len(code_so_far.encode('utf-8'))={code_bytes} != "
        f"total_args_bytes_so_far={total_bytes}. "
        f"(If equal to 5120 always, the field was wired to the 5 KB tail "
        f"instead of the full cumulative — see RESEARCH Pitfall 3.)"
    )
    # And confirm code_so_far is meaningfully larger than the 5 KB tail —
    # i.e., not silently truncated to the sliding-window upper bound.
    assert code_bytes > 5120, (
        f"Expected code_so_far on the LAST progress event to exceed 5 KB "
        f"(16 KB cumulative is sent); got {code_bytes} bytes — suggests "
        f"the field was inadvertently bound to the sliding-window tail."
    )
