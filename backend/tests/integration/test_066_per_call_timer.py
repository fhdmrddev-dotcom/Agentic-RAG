"""Phase 066 SC#2: per-LLM-call asyncio.timeout machinery.

Three behaviors under test:
1. Timer fires within ~budget on a chunk-stalled stream (D-066-02).
2. Quick LLM stream completes well under budget — sanity (D-066-02).
3. Timer RESETS per iteration (asyncio.timeout reset semantics — RESEARCH.md Pattern 1).
4. Tool execution time does NOT count against the per-call budget (D-066-02 — timer
   scope = LLM stream block ONLY).

The (3) and (4) tests need to drive the agent loop through TWO iterations via
a tool call. The production code dispatches tools inline (no `dispatch_tool`
function exists), so we patch a specific tool's module-level import:
`app.api.threads.web_search`. The web_search call site at threads.py:~1574
is `tool_result = web_search(args["query"], settings.tavily_api_key, ...)` —
sync function, return value used directly. A patched callable can simulate
fast or slow tool exec without changing the agent-loop control flow.
"""
import time
from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4

import httpx
import pytest

from app.dependencies import get_supabase
from app.main import app
from app.services.openai_service import CallingMode

from tests.integration._run_helpers import (  # noqa: E402
    _build_mock_supabase,
    _make_done_chunk,
    _make_sse_chunk,
    await_producer_finalized,
)
from tests.integration.test_059_disconnect import (  # noqa: F401, E402
    _reset_sse_starlette_app_status,
)

THREAD_A = str(uuid4())


def _stalling_chunks():
    """Stalls 5s before any chunk — exercises the per-call timer.

    The sync `time.sleep` blocks the event loop, but the per-call
    `async with asyncio.timeout(...)` deadline is checked at the next
    awaitable yield point (after the chunk is yielded and `_emit` awaits
    redis.xadd). Pitfall 1 in 066-RESEARCH.md.
    """
    time.sleep(5.0)
    yield _make_sse_chunk("late ")
    yield _make_done_chunk()


def _quick_then_done_chunks():
    """Yields one delta then done — completes well under any reasonable budget."""
    yield _make_sse_chunk("hello ")
    yield _make_done_chunk()


@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_per_call_timer_fires_at_budget(redis_client, monkeypatch):
    """SC#2 (a): timer fires within ~budget — slow chunks -> timed_out."""
    import app.config as _app_config
    monkeypatch.setattr(_app_config, "get_per_call_timeout", lambda *a, **k: 1)

    mock_supabase = _build_mock_supabase()
    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    try:
        start = time.monotonic()
        with patch(
            "app.api.threads.create_adaptive_streaming_chat",
            side_effect=lambda *a, **k: (iter(_stalling_chunks()), CallingMode.NATIVE),
        ), patch(
            "app.services.suggestion_service.generate_suggestions",
            return_value=([], None),
        ), patch(
            "app.api.threads.generate_thread_title",
            return_value=("T", None),
        ):
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as c:
                async with c.stream(
                    "POST",
                    f"/threads/{THREAD_A}/messages",
                    json={"content": "hello"},
                    headers={"Authorization": "Bearer test-token"},
                    timeout=30.0,
                ) as r:
                    async for _line in r.aiter_lines():
                        pass
            await await_producer_finalized(mock_supabase)
        elapsed = time.monotonic() - start

        # Tolerance: the sync `time.sleep(5.0)` inside _stalling_chunks blocks
        # the event loop for the full 5s before the timer can be checked at
        # the next await boundary. Therefore the upper bound is
        # ~ stall (5s) + budget overhead + finalize <= 8s.
        # If elapsed >> 8s the timer never fired (regression).
        assert elapsed < 10, (
            f"Per-call timer should fire within ~stall+budget (~6-8s); "
            f"got {elapsed:.2f}s"
        )

        # Confirm runs UPDATE wrote timed_out
        runs_builder = mock_supabase.table("runs")
        timed_out_updates = [
            c for c in runs_builder.update.call_args_list
            if c.args and c.args[0].get("status") == "timed_out"
        ]
        assert timed_out_updates, (
            f"Expected status='timed_out' update; "
            f"got: {runs_builder.update.call_args_list}"
        )
    finally:
        app.dependency_overrides.pop(get_supabase, None)


@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_quick_call_within_budget_completes(redis_client, monkeypatch):
    """SC#2 (b) — sanity: quick LLM stream completes (does NOT timed_out)."""
    import app.config as _app_config
    monkeypatch.setattr(_app_config, "get_per_call_timeout", lambda *a, **k: 5)

    mock_supabase = _build_mock_supabase()
    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    try:
        with patch(
            "app.api.threads.create_adaptive_streaming_chat",
            side_effect=lambda *a, **k: (iter(_quick_then_done_chunks()), CallingMode.NATIVE),
        ), patch(
            "app.services.suggestion_service.generate_suggestions",
            return_value=([], None),
        ), patch(
            "app.api.threads.generate_thread_title",
            return_value=("T", None),
        ):
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as c:
                async with c.stream(
                    "POST",
                    f"/threads/{THREAD_A}/messages",
                    json={"content": "hello"},
                    headers={"Authorization": "Bearer test-token"},
                    timeout=30.0,
                ) as r:
                    async for _line in r.aiter_lines():
                        pass
            await await_producer_finalized(mock_supabase)

        runs_builder = mock_supabase.table("runs")
        timed_out = [
            c for c in runs_builder.update.call_args_list
            if c.args and c.args[0].get("status") == "timed_out"
        ]
        assert not timed_out, (
            f"Quick call wrongly marked timed_out: {timed_out}"
        )
        completed = [
            c for c in runs_builder.update.call_args_list
            if c.args and c.args[0].get("status") == "completed"
        ]
        assert completed, (
            f"Expected status='completed'; "
            f"got: {runs_builder.update.call_args_list}"
        )
    finally:
        app.dependency_overrides.pop(get_supabase, None)


# ---------------------------------------------------------------------------
# Tests (3) and (4) drive the agent loop through TWO iterations via a
# web_search tool call. The first LLM stream yields a tool_call, the agent
# loop dispatches the tool, then a second LLM stream is requested for the
# follow-up. Each iteration is wrapped in its own per-call timer block —
# this is what we want to prove.
# ---------------------------------------------------------------------------


def _llm_yields_web_search_call(stall_seconds: float):
    """OpenAI-shaped chunks that yield a web_search tool call after `stall_seconds`."""
    def _gen():
        time.sleep(stall_seconds)
        # Tool call assembly — mimics OpenAI streaming-tool-call shape.
        # First chunk: tool_call with id + name (triggers tool_preparing)
        yield SimpleNamespace(
            choices=[SimpleNamespace(
                delta=SimpleNamespace(
                    content=None,
                    tool_calls=[SimpleNamespace(
                        index=0,
                        id="tc_1",
                        function=SimpleNamespace(name="web_search", arguments=""),
                    )],
                ),
                finish_reason=None,
            )],
        )
        # Second chunk: the arguments JSON
        yield SimpleNamespace(
            choices=[SimpleNamespace(
                delta=SimpleNamespace(
                    content=None,
                    tool_calls=[SimpleNamespace(
                        index=0,
                        id=None,
                        function=SimpleNamespace(name=None, arguments='{"query": "x"}'),
                    )],
                ),
                finish_reason=None,
            )],
        )
        # Third chunk: finish_reason='tool_calls' (closes the iteration)
        yield SimpleNamespace(
            choices=[SimpleNamespace(
                delta=SimpleNamespace(content=None, tool_calls=None),
                finish_reason="tool_calls",
            )],
        )
    return _gen()


def _llm_yields_done(stall_seconds: float):
    """Final-iteration chunks: stall, then a delta and `finish_reason='stop'`."""
    def _gen():
        time.sleep(stall_seconds)
        yield _make_sse_chunk("answer ")
        yield _make_done_chunk()
    return _gen()


@pytest.mark.asyncio
@pytest.mark.timeout(20)
async def test_timer_resets_per_iteration(redis_client, monkeypatch):
    """SC#2 (b) — D-066-02: per-iteration reset.

    per_call_budget=2s. Iteration 1 LLM call: 1.5s + tool_calls finish_reason
    -> tool dispatch (fast) -> Iteration 2 LLM call: 1.5s + done. Cumulative
    LLM wall-time ~3s > 2s budget — but each iteration is wrapped in a
    fresh `async with asyncio.timeout(per_call_budget)` block per Plan 02
    Subtask 2c. If the timer reset works, no TimeoutError fires.
    """
    import app.config as _app_config
    monkeypatch.setattr(_app_config, "get_per_call_timeout", lambda *a, **k: 2)

    streams = [
        (_llm_yields_web_search_call(stall_seconds=1.5), CallingMode.NATIVE),
        (_llm_yields_done(stall_seconds=1.5), CallingMode.NATIVE),
    ]

    mock_supabase = _build_mock_supabase()
    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    try:
        with patch(
            "app.api.threads.create_adaptive_streaming_chat",
            side_effect=lambda *a, **k: streams.pop(0),
        ), patch(
            # Patch the module-level web_search import in threads.py.
            # Inline tool dispatch at threads.py:~1574 calls
            #   tool_result = web_search(args["query"], ...)
            # — a sync function. A fast no-op patch keeps the agent loop's
            # tool->next-iteration boundary intact while we observe the
            # per-call timer behavior.
            "app.api.threads.web_search",
            new=lambda *a, **k: '{"results": []}',
        ), patch(
            "app.services.suggestion_service.generate_suggestions",
            return_value=([], None),
        ), patch(
            "app.api.threads.generate_thread_title",
            return_value=("T", None),
        ):
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as c:
                async with c.stream(
                    "POST",
                    f"/threads/{THREAD_A}/messages",
                    json={"content": "hello"},
                    headers={"Authorization": "Bearer test-token"},
                    timeout=30.0,
                ) as r:
                    async for _line in r.aiter_lines():
                        pass
            await await_producer_finalized(mock_supabase)

        runs_builder = mock_supabase.table("runs")
        timed_out = [
            c for c in runs_builder.update.call_args_list
            if c.args and c.args[0].get("status") == "timed_out"
        ]
        assert not timed_out, (
            f"D-066-02 regression: cumulative wall-time exceeded per-iteration "
            f"budget but timer did NOT reset between iterations. "
            f"Updates: {runs_builder.update.call_args_list}"
        )
        completed = [
            c for c in runs_builder.update.call_args_list
            if c.args and c.args[0].get("status") == "completed"
        ]
        assert completed, (
            f"Expected status='completed' after two within-budget iterations; "
            f"got: {runs_builder.update.call_args_list}"
        )
    finally:
        app.dependency_overrides.pop(get_supabase, None)


@pytest.mark.asyncio
@pytest.mark.timeout(60)
async def test_tool_exec_outside_timer(redis_client, monkeypatch):
    """SC#2 (c) -- D-066-02 + T-066-13: tool execution does NOT count against per-call budget.

    per_call_budget=2s. Iteration 1 LLM call: 0.3s (within budget). Tool
    dispatch (web_search) sleeps 5s (>budget). Iteration 2 LLM call: 0.3s.
    Total wall-time ~6s.

    If the tool dispatch were INSIDE the asyncio.timeout block, the 5s sleep
    would fire the 2s deadline. Plan 02 Subtask 2b/2c places the per-call
    timer ONLY around the SDK iteration block (`for chunk in stream:`) —
    tool dispatch happens OUTSIDE the `async with asyncio.timeout(...)` block,
    between iterations.

    NOTE: 5s tool sleep (not the plan's 90s) — sufficient to prove the
    contract (5s > 2s budget) without bloating CI runtime.
    """
    import app.config as _app_config
    monkeypatch.setattr(_app_config, "get_per_call_timeout", lambda *a, **k: 2)

    streams = [
        (_llm_yields_web_search_call(stall_seconds=0.3), CallingMode.NATIVE),
        (_llm_yields_done(stall_seconds=0.3), CallingMode.NATIVE),
    ]

    def _slow_web_search(*args, **kwargs):
        # Sync sleep — blocks the event loop. This is exactly what a slow
        # synchronous tool would do (e.g., a long Tavily call). The test
        # asserts that no TimeoutError fires DESPITE this 5s blocking sleep,
        # because the tool dispatch site is OUTSIDE the per-call timer wrap.
        time.sleep(5.0)
        return '{"results": [{"title": "x", "url": "u"}]}'

    mock_supabase = _build_mock_supabase()
    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    try:
        with patch(
            "app.api.threads.create_adaptive_streaming_chat",
            side_effect=lambda *a, **k: streams.pop(0),
        ), patch(
            "app.api.threads.web_search",
            new=_slow_web_search,
        ), patch(
            "app.services.suggestion_service.generate_suggestions",
            return_value=([], None),
        ), patch(
            "app.api.threads.generate_thread_title",
            return_value=("T", None),
        ):
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as c:
                async with c.stream(
                    "POST",
                    f"/threads/{THREAD_A}/messages",
                    json={"content": "hello"},
                    headers={"Authorization": "Bearer test-token"},
                    timeout=60.0,
                ) as r:
                    async for _line in r.aiter_lines():
                        pass
            await await_producer_finalized(mock_supabase)

        runs_builder = mock_supabase.table("runs")
        timed_out = [
            c for c in runs_builder.update.call_args_list
            if c.args and c.args[0].get("status") == "timed_out"
        ]
        assert not timed_out, (
            f"D-066-02/T-066-13 regression: tool exec time was counted against "
            f"per-call budget. 5s tool sleep with 2s budget produced timed_out — "
            f"timer scope must be LLM stream block ONLY. "
            f"Updates: {runs_builder.update.call_args_list}"
        )
        completed = [
            c for c in runs_builder.update.call_args_list
            if c.args and c.args[0].get("status") == "completed"
        ]
        assert completed, (
            f"Expected status='completed' (tool exec outside timer scope); "
            f"got: {runs_builder.update.call_args_list}"
        )
    finally:
        app.dependency_overrides.pop(get_supabase, None)
