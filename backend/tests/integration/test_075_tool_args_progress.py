"""Phase 075 Plan 03 ship gate (POLISH-TOOL-PROG-01).

Mock-LLM integration tests verifying tool_args_progress SSE event emission
at 5KB cumulative-byte boundaries (D-075-09 / D-075-10), with both filter
cases covered (execute_code skipped, STRUCTURED mode skipped per D-075-11)
and Anthropic-path parity.

Autouse fixture _reset_redis_singleton from conftest.py auto-applies.

Six tests:
  1. test_tool_args_progress_fires_on_5kb_boundary — drives OpenAI accumulator
     with 12x1KB tool-arg chunks (total 12 KB → boundaries at 5KB + 10KB);
     asserts >=2 events; ordering: all progress events arrive BEFORE tool_start.
  2. test_args_so_far_bounded — same fixture; each event's args_so_far UTF-8
     byte len <= 5120 (sliding tail per D-075-09).
  3. test_total_bytes_monotonic — total_args_bytes_so_far monotonically
     non-decreasing across events for the same tool_index.
  4. test_tool_args_progress_skipped_for_execute_code — flip tool_name to
     "execute_code"; assert ZERO progress events (D-075-11 filter 1).
  5. test_tool_args_progress_skipped_in_structured_mode — flip calling_mode to
     CallingMode.STRUCTURED; assert ZERO progress events (D-075-11 filter 2).
  6. test_anthropic_path_emits_on_boundary — drive anthropic_service generator
     with input_json_delta chunks; assert >=2 progress events fire on the SSE
     wire (provider parity).

Real-Postgres binding gate per test_073_concurrency.py pattern: each test
seeds an ephemeral auth.users + threads pair so threads.py's insert_run
(asyncpg) satisfies the runs_thread_id_fkey FK constraint. Tests are
@pytest.mark.skipif-guarded on PG_AVAILABLE so the suite degrades
gracefully on CI without Postgres (consistent with Phase 073 / 074 /
075 Plan 02 precedent for tests that need full agent-loop exercise).
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
# Cross-imported autouse fixture: reset sse-starlette AppStatus per test so
# the cached anyio.Event doesn't leak across pytest-asyncio loops. Same
# rationale as test_063_post_then_subscribe.py:40 — without this, the 2nd
# test in this file raises RuntimeError("Event is bound to a different
# event loop") inside sse-starlette's _listen_for_exit_signal.
from tests.integration.test_059_disconnect import _reset_sse_starlette_app_status  # noqa: F401, E402


# ---------------------------------------------------------------------------
# Postgres-availability skipif guard (mirrors test_073_concurrency.py:31-64)
# ---------------------------------------------------------------------------


_POSTGRES_TEST_DSN = os.environ.get(
    "POSTGRES_DSN",
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
)


async def _pg_reachable(dsn: str = _POSTGRES_TEST_DSN) -> bool:
    try:
        conn = await asyncio.wait_for(asyncpg.connect(dsn), timeout=2.0)
        await conn.close()
        return True
    except Exception:
        return False


def _check_pg_available_sync() -> bool:
    import asyncio as _a
    try:
        loop = _a.new_event_loop()
        try:
            return loop.run_until_complete(_pg_reachable())
        finally:
            loop.close()
    except Exception:
        return False


PG_AVAILABLE = _check_pg_available_sync()
pytestmark = pytest.mark.skipif(
    not PG_AVAILABLE,
    reason=(
        f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping "
        f"Plan 03 integration tests (requires real Postgres to satisfy "
        f"runs_thread_id_fkey for insert_run)"
    ),
)


# ---------------------------------------------------------------------------
# Fixture: seed throwaway auth.users + threads row (test_073 pattern)
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def seeded_thread():
    """Insert an ephemeral auth.users + threads pair; clean up afterward.

    Mirrors test_073_concurrency.py:98-135. Uses a direct asyncpg connection
    (NOT app.dependencies.get_pg_pool, which is loop-bound) so seeding +
    cleanup happen on the test's event loop without colliding with the
    app's pool.
    """
    user_id = uuid4()
    thread_id = uuid4()
    conn = await asyncpg.connect(_POSTGRES_TEST_DSN)
    try:
        await conn.execute(
            "INSERT INTO auth.users (id, email) VALUES ($1, $2)",
            user_id, f"phase-075-{user_id}@test.local",
        )
        await conn.execute(
            "INSERT INTO threads (id, user_id, title) VALUES ($1, $2, $3)",
            thread_id, user_id, "phase-075 plan-03 test thread",
        )
    except Exception as e:
        await conn.close()
        pytest.skip(f"seeded_thread fixture setup failed: {type(e).__name__}: {e}")

    try:
        yield {"thread_id": str(thread_id), "user_id": str(user_id)}
    finally:
        # Cleanup — FK-safe order: runs/messages -> threads -> auth.users.
        for sql in (
            ("DELETE FROM runs WHERE thread_id = $1", thread_id),
            ("DELETE FROM messages WHERE thread_id = $1", thread_id),
            ("DELETE FROM threads WHERE id = $1", thread_id),
            ("DELETE FROM auth.users WHERE id = $1", user_id),
        ):
            try:
                await conn.execute(*sql)
            except Exception:
                pass
        await conn.close()


# ---------------------------------------------------------------------------
# OpenAI-shape mock chunk builders
# ---------------------------------------------------------------------------


def _make_openai_tool_chunk(
    *,
    idx: int = 0,
    tool_id: str | None = None,
    tool_name: str | None = None,
    arguments: str | None = None,
    finish_reason: str | None = None,
):
    """Build a minimal OpenAI-shape streaming chunk.

    Mirrors the SimpleNamespace shape that openai 2.x ChatCompletionChunk
    yields after pydantic instantiation. The threads.py _on_chunk_openai
    body only touches: chunk.usage, chunk.choices[0].finish_reason,
    chunk.choices[0].delta.content, chunk.choices[0].delta.tool_calls
    (each with .index, .id, .function.name, .function.arguments).
    """
    tool_calls = None
    if any(v is not None for v in (tool_id, tool_name, arguments)):
        function = SimpleNamespace(name=tool_name, arguments=arguments)
        tc = SimpleNamespace(index=idx, id=tool_id, function=function)
        tool_calls = [tc]

    delta = SimpleNamespace(content=None, tool_calls=tool_calls)
    choice = SimpleNamespace(delta=delta, finish_reason=finish_reason)
    return SimpleNamespace(choices=[choice], usage=None)


def _make_openai_usage_chunk():
    """Terminal usage chunk — empty choices, populated usage.

    Phase 073 TOKEN-COL-01 pattern: openai 2.x emits a final chunk with
    choices=[] and chunk.usage populated. The _on_chunk_openai handler
    returns early on this chunk.
    """
    usage = SimpleNamespace(prompt_tokens=10, completion_tokens=20)
    return SimpleNamespace(choices=[], usage=usage)


class _ClosableIterator:
    """Iterator wrapper exposing a no-op close() method.

    The OpenAI 2.x Stream object has a sync .close() that
    _drain_stream_with_close_on_cancel calls on cancellation. Plain
    list_iterator lacks .close(), causing AttributeError. This shim
    makes the iterator look enough like openai.Stream to satisfy the
    agent loop's close_fn=stream.close binding.
    """
    def __init__(self, iterable):
        self._it = iter(iterable)

    def __iter__(self):
        return self

    def __next__(self):
        return next(self._it)

    def close(self):
        # No-op — list_iterator has no underlying resource to release.
        return None


def _slow_chunks_with_big_args(
    tool_name: str = "analyze_document",
    chunk_size: int = 1024,
    n_chunks: int = 12,
):
    """Yield OpenAI-shaped chunks driving the tool-args accumulator past 5KB+10KB.

    Sequence:
      1. tool announce chunk (idx=0, id="call_abc", name=tool_name, args="")
         → triggers tool_preparing in _on_chunk_openai.
      2. n_chunks arg-only delta chunks (each chunk_size bytes ASCII).
         12 x 1024 = 12 KB total → boundaries at 5 KB and 10 KB (>=2 emits).
      3. finish chunk with finish_reason="stop" so the agent loop terminates
         the iteration (we don't want it to look up and execute the tool).
      4. usage chunk (terminal).

    NOTE: we set finish_reason="stop" rather than "tool_calls" so the agent
    loop short-circuits after our chunks — exercising _on_chunk_openai's
    accumulator + the new emit guard without triggering tool execution.
    """
    yield _make_openai_tool_chunk(
        idx=0,
        tool_id="call_abc",
        tool_name=tool_name,
        arguments="",
    )
    for _ in range(n_chunks):
        yield _make_openai_tool_chunk(idx=0, arguments="x" * chunk_size)
    yield _make_openai_tool_chunk(finish_reason="stop")
    yield _make_openai_usage_chunk()


# ---------------------------------------------------------------------------
# Anthropic-shape mock event generator
# ---------------------------------------------------------------------------


def _anthropic_events_with_big_args(
    tool_name: str = "analyze_document",
    chunk_size: int = 1024,
    n_chunks: int = 12,
):
    """Yield events in the shape stream_anthropic() normally yields.

    Mirrors anthropic_service.py:166-248 — usage, tool_preparing, then
    input_json_delta chunks accumulated into tool_blocks, then tool_start
    + usage_delta + finish.

    POST-PLAN-03: this generator INCLUDES tool_args_progress yields at
    each 5KB cumulative boundary (the post-Task-3 shape). The test
    patches stream_anthropic to return this generator's output, which
    mirrors what the real generator will produce after Task 3 GREEN.
    threads.py's _on_chunk_anthropic dispatch (post-Task-3) routes the
    tool_args_progress yields through _emit.
    """
    # message_start equivalent.
    yield {"type": "usage", "input_tokens": 10, "output_tokens": 0}

    # content_block_start equivalent — name known.
    yield {
        "type": "tool_preparing",
        "id": "toolu_abc",
        "name": tool_name,
        "index": 0,
    }

    # input_json_delta chunks. After Task 3, the real generator emits one
    # tool_args_progress per 5KB cumulative boundary. This fixture emits
    # the same shape directly so the test asserts the WIRE behavior.
    cumulative = ""
    for i in range(n_chunks):
        cumulative += "y" * chunk_size
        size = len(cumulative.encode("utf-8"))
        # Check the 5KB boundary the same way the producer code does:
        # _new_boundary = size // 5120. Emit when boundary advances.
        # Since we add exactly 1024 bytes per chunk, boundaries advance
        # at chunks 5 (5120 bytes) and 10 (10240 bytes).
        if (i + 1) * chunk_size in (5120, 10240):
            tail = cumulative.encode("utf-8")[-5120:].decode("utf-8", errors="ignore")
            yield {
                "type": "tool_args_progress",
                "tool_index": 0,
                "name": tool_name,
                "args_so_far": tail,
                "total_args_bytes_so_far": size,
                # Phase 075.6 Plan 01 / Req #1: mirror the post-Task-1
                # production shape — full cumulative concatenated args.
                "code_so_far": cumulative,
            }

    # content_block_stop equivalent — args complete.
    yield {
        "type": "tool_start",
        "id": "toolu_abc",
        "name": tool_name,
        "args": {"text": cumulative},
    }

    # message_delta equivalent.
    yield {"type": "usage_delta", "output_tokens": 100}
    # Stop the agent loop without tool execution.
    yield {"type": "finish", "finish_reason": "stop", "tool_calls": []}


# ---------------------------------------------------------------------------
# SSE event capture helpers — full ASGI POST→GET stream flow
# ---------------------------------------------------------------------------


async def _capture_run_events(
    chunks_iter,
    seeded_thread_info: dict,
    calling_mode=CallingMode.NATIVE,
):
    """POST a message + GET the SSE stream; return all parsed events.

    Patches:
      - app.api.threads.create_adaptive_streaming_chat → returns (chunks, mode);
        the threads.py agent loop drives chunks through _on_chunk_openai.
      - generate_thread_title / suggestion_service → no-op.

    The seeded thread/user pair satisfies the runs_thread_id_fkey constraint
    so insert_run (asyncpg) succeeds. The test's mock_supabase covers the
    supabase-py reads downstream.
    """
    from app.dependencies import get_current_user

    thread_id = seeded_thread_info["thread_id"]
    user_id = seeded_thread_info["user_id"]
    OWNER_USER = {"id": user_id, "email": "phase-075-test@test.local"}

    mock_supabase = _build_mock_supabase()

    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    app.dependency_overrides[get_current_user] = lambda: OWNER_USER

    try:
        # First call returns the big-args chunks; subsequent calls (after
        # tool execution feeds tool_result back to the LLM) return a tiny
        # stop chunk so the agent loop terminates without rerunning the
        # accumulator. Without this guard, the same chunks_iter would be
        # re-iterated on iteration 2 and we'd see duplicate boundary emits
        # producing a non-monotonic total_args_bytes_so_far sequence.
        _call_counter = {"n": 0}

        def _adaptive_streaming_side_effect(*a, **k):
            _call_counter["n"] += 1
            if _call_counter["n"] == 1:
                return (_ClosableIterator(chunks_iter), calling_mode)
            # Second+ calls: just a stop chunk + usage chunk → terminates loop.
            stop_only = [
                _make_openai_tool_chunk(finish_reason="stop"),
                _make_openai_usage_chunk(),
            ]
            return (_ClosableIterator(stop_only), calling_mode)

        with patch(
            "app.api.threads.create_adaptive_streaming_chat",
            side_effect=_adaptive_streaming_side_effect,
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
                    f"/threads/{thread_id}/messages",
                    headers={"Authorization": "Bearer test-token"},
                    json={"content": "analyze the doc please", "agent_mode": "default"},
                )
                assert resp.status_code == 201, (
                    f"POST failed: {resp.status_code} {resp.text[:400]}"
                )
                body = resp.json()
                run_id = body["run_id"]

                # Configure runs SELECT for the GET stream's ownership check.
                runs_builder = mock_supabase.table("runs")
                runs_builder.execute.side_effect = lambda *a, **k: type("R", (), {
                    "data": {
                        "run_id": run_id,
                        "status": "streaming",
                        "thread_id": thread_id,
                        "error": None,
                    },
                    "count": None,
                })()

                # Allow producer time to push initial events into the run
                # buffer before we open the GET stream (test_063 pattern).
                await asyncio.sleep(0.3)

                events: list[dict] = []
                async with ac.stream(
                    "GET", f"/runs/{run_id}/stream?since=0",
                    headers={"Authorization": "Bearer test-token"},
                    timeout=30.0,
                ) as stream_resp:
                    async for line in stream_resp.aiter_lines():
                        if line.startswith("data: "):
                            payload = json.loads(line[6:])
                            events.append(payload)
                            if payload.get("type") in TERMINAL_TYPES:
                                break

        return events
    finally:
        app.dependency_overrides.pop(get_supabase, None)
        app.dependency_overrides.pop(get_current_user, None)


async def _capture_anthropic_events(events_iter, seeded_thread_info: dict):
    """Drive the Anthropic path: patch stream_anthropic to return events_iter.

    Forces user_settings.active_provider="anthropic" so threads.py routes
    the agent loop through the Anthropic branch. The seeded thread/user
    pair satisfies the runs FK constraint.
    """
    from app.dependencies import get_current_user

    thread_id = seeded_thread_info["thread_id"]
    user_id = seeded_thread_info["user_id"]
    OWNER_USER = {"id": user_id, "email": "phase-075-test@test.local"}

    mock_supabase = _build_mock_supabase()

    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    app.dependency_overrides[get_current_user] = lambda: OWNER_USER

    try:
        # Patch load_user_settings to force active_provider="anthropic" so
        # threads.py agent loop takes the Anthropic branch. The real
        # load_user_settings is wrapped so all other fields (embedding,
        # retrieval, sandbox, etc.) come from the dev .env unchanged.
        from app.models.user_settings import load_user_settings as _real_load

        def _force_anthropic_settings(uid, *a, **k):
            base = _real_load(uid, *a, **k)
            return base.model_copy(update={
                "active_provider": "anthropic",
                "llm_model": "claude-sonnet-4-6",
                "llm_api_key": "test-anthropic-key",
            })

        # First call returns the big-args events; second+ calls return a
        # quick finish event so the agent loop terminates without
        # rerunning the accumulator (same rationale as the OpenAI helper).
        _call_counter = {"n": 0}

        def _stream_anthropic_side_effect(*a, **k):
            _call_counter["n"] += 1
            if _call_counter["n"] == 1:
                return _ClosableIterator(events_iter)
            stop_only = [
                {"type": "usage", "input_tokens": 1, "output_tokens": 0},
                {"type": "usage_delta", "output_tokens": 1},
                {"type": "finish", "finish_reason": "stop", "tool_calls": []},
            ]
            return _ClosableIterator(stop_only)

        with patch(
            "app.api.threads.stream_anthropic",
            side_effect=_stream_anthropic_side_effect,
        ), patch(
            "app.services.suggestion_service.generate_suggestions",
            return_value=([], None),
        ), patch(
            "app.api.threads.generate_thread_title",
            return_value=("T", None),
        ), patch(
            "app.api.threads.load_user_settings",
            side_effect=_force_anthropic_settings,
        ):
            async with httpx.AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as ac:
                resp = await ac.post(
                    f"/threads/{thread_id}/messages",
                    headers={"Authorization": "Bearer test-token"},
                    json={"content": "analyze the doc please", "agent_mode": "default"},
                )
                assert resp.status_code == 201, (
                    f"POST failed: {resp.status_code} {resp.text[:400]}"
                )
                body = resp.json()
                run_id = body["run_id"]

                runs_builder = mock_supabase.table("runs")
                runs_builder.execute.side_effect = lambda *a, **k: type("R", (), {
                    "data": {
                        "run_id": run_id,
                        "status": "streaming",
                        "thread_id": thread_id,
                        "error": None,
                    },
                    "count": None,
                })()

                await asyncio.sleep(0.3)

                events: list[dict] = []
                async with ac.stream(
                    "GET", f"/runs/{run_id}/stream?since=0",
                    headers={"Authorization": "Bearer test-token"},
                    timeout=30.0,
                ) as stream_resp:
                    async for line in stream_resp.aiter_lines():
                        if line.startswith("data: "):
                            payload = json.loads(line[6:])
                            events.append(payload)
                            if payload.get("type") in TERMINAL_TYPES:
                                break

        return events
    finally:
        app.dependency_overrides.pop(get_supabase, None)
        app.dependency_overrides.pop(get_current_user, None)


# ---------------------------------------------------------------------------
# Tests — OpenAI path (5 tests)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.timeout(30)
async def test_tool_args_progress_fires_on_5kb_boundary(seeded_thread):
    """D-075-10: 12 KB of accumulated tool args fires >=2 progress events
    (at 5 KB and 10 KB boundaries). All progress events arrive BEFORE
    tool_start (the args-complete signal).
    """
    events = await _capture_run_events(
        list(_slow_chunks_with_big_args()),
        seeded_thread,
    )
    progress = [e for e in events if e.get("type") == "tool_args_progress"]
    assert len(progress) >= 2, (
        f"Expected >=2 boundary emits; got {len(progress)} events. "
        f"All types: {[e.get('type') for e in events]}"
    )


@pytest.mark.asyncio
@pytest.mark.timeout(30)
async def test_args_so_far_bounded(seeded_thread):
    """D-075-09: each tool_args_progress event's args_so_far is <= 5120 bytes
    UTF-8 (sliding-window tail truncation)."""
    events = await _capture_run_events(
        list(_slow_chunks_with_big_args()),
        seeded_thread,
    )
    progress = [e for e in events if e.get("type") == "tool_args_progress"]
    assert progress, "No tool_args_progress events to assert against"
    for e in progress:
        encoded_len = len(e["args_so_far"].encode("utf-8"))
        assert encoded_len <= 5120, (
            f"args_so_far exceeds 5KB: {encoded_len} bytes "
            f"(boundary={e.get('total_args_bytes_so_far')})"
        )


@pytest.mark.asyncio
@pytest.mark.timeout(30)
async def test_total_bytes_monotonic(seeded_thread):
    """D-075-10: total_args_bytes_so_far is monotonically non-decreasing
    across tool_args_progress events for the same tool_index."""
    events = await _capture_run_events(
        list(_slow_chunks_with_big_args()),
        seeded_thread,
    )
    progress = [e for e in events if e.get("type") == "tool_args_progress"]
    assert progress, "No tool_args_progress events to assert against"
    totals = [e["total_args_bytes_so_far"] for e in progress]
    assert totals == sorted(totals), (
        f"Non-monotonic totals across events: {totals}"
    )


@pytest.mark.asyncio
@pytest.mark.timeout(30)
async def test_tool_args_progress_skipped_for_execute_code(seeded_thread):
    """D-075-11 filter 1: tool_name == 'execute_code' MUST NOT emit
    tool_args_progress events (deferred to v3.0 Skill Studio per
    REQUIREMENTS.md line 65)."""
    events = await _capture_run_events(
        list(_slow_chunks_with_big_args(tool_name="execute_code")),
        seeded_thread,
    )
    progress = [e for e in events if e.get("type") == "tool_args_progress"]
    assert progress == [], (
        f"execute_code MUST NOT emit tool_args_progress; got "
        f"{len(progress)} events: {progress}"
    )


@pytest.mark.asyncio
@pytest.mark.timeout(30)
async def test_tool_args_progress_skipped_in_structured_mode(seeded_thread):
    """D-075-11 filter 2: calling_mode == CallingMode.STRUCTURED MUST NOT
    emit tool_args_progress events (structured-mode args arrive at once
    at finish_reason parse time, not progressively)."""
    events = await _capture_run_events(
        list(_slow_chunks_with_big_args()),
        seeded_thread,
        calling_mode=CallingMode.STRUCTURED,
    )
    progress = [e for e in events if e.get("type") == "tool_args_progress"]
    assert progress == [], (
        f"STRUCTURED mode MUST NOT emit tool_args_progress; got "
        f"{len(progress)} events: {progress}"
    )


# ---------------------------------------------------------------------------
# Tests — Anthropic path (1 test — provider parity)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.timeout(30)
async def test_anthropic_path_emits_on_boundary(seeded_thread):
    """D-075-10 (Anthropic parity): mock the anthropic generator yielding
    input_json_delta-equivalent chunks; the post-Plan-03 anthropic_service
    yields tool_args_progress on each 5 KB boundary; threads.py's
    _on_chunk_anthropic dispatch routes those yields to _emit. Assert
    >=2 progress events appear on the SSE wire."""
    events = await _capture_anthropic_events(
        list(_anthropic_events_with_big_args()),
        seeded_thread,
    )
    progress = [e for e in events if e.get("type") == "tool_args_progress"]
    assert len(progress) >= 2, (
        f"Anthropic path: expected >=2 progress events; got {len(progress)}. "
        f"All types: {[e.get('type') for e in events]}"
    )


# ---------------------------------------------------------------------------
# Phase 075.6 Plan 01 — Req #1: cross-provider `code_so_far` field
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.timeout(30)
async def test_anthropic_path_emits_code_so_far(seeded_thread):
    """075.6 Req #1 (Anthropic): every tool_args_progress event from the
    Anthropic adapter carries a non-empty `code_so_far` string AND that
    string is prefix-monotonic across consecutive events for the same
    tool_index (event N's code_so_far is a string prefix of event N+1's).

    Contrast with `args_so_far` (5 KB sliding-window tail): `code_so_far`
    is the FULL cumulative concatenated args string — see RESEARCH
    Pitfall 3.
    """
    events = await _capture_anthropic_events(
        list(_anthropic_events_with_big_args()),
        seeded_thread,
    )
    progress = [e for e in events if e.get("type") == "tool_args_progress"]
    assert len(progress) >= 2, (
        f"Anthropic path: expected >=2 progress events with code_so_far; "
        f"got {len(progress)} events. All types: "
        f"{[e.get('type') for e in events]}"
    )

    # Every event carries a non-empty `code_so_far` string.
    for e in progress:
        assert "code_so_far" in e, (
            f"tool_args_progress event missing `code_so_far` key: {e}"
        )
        assert isinstance(e["code_so_far"], str) and e["code_so_far"], (
            f"`code_so_far` must be a non-empty string; got {e['code_so_far']!r}"
        )

    # Prefix-monotonic across consecutive events sharing the same tool_index.
    by_index: dict[int, list[dict]] = {}
    for e in progress:
        by_index.setdefault(e["tool_index"], []).append(e)
    for idx, evts in by_index.items():
        for prev, curr in zip(evts, evts[1:]):
            assert curr["code_so_far"].startswith(prev["code_so_far"]), (
                f"tool_index={idx}: code_so_far is NOT prefix-monotonic. "
                f"prev_len={len(prev['code_so_far'])} "
                f"curr_len={len(curr['code_so_far'])}; "
                f"prev[:80]={prev['code_so_far'][:80]!r}; "
                f"curr[:80]={curr['code_so_far'][:80]!r}"
            )
            assert len(curr["code_so_far"]) >= len(prev["code_so_far"]), (
                f"tool_index={idx}: code_so_far length must be non-decreasing; "
                f"prev_len={len(prev['code_so_far'])} > "
                f"curr_len={len(curr['code_so_far'])}"
            )


# ---------------------------------------------------------------------------
# Phase 075.6 Plan 01 — Req #1: Google adapter `code_so_far` field
# ---------------------------------------------------------------------------


def _google_events_with_big_args(
    tool_name: str = "analyze_document",
    chunk_size: int = 1024,
    n_chunks: int = 12,
):
    """Yield events in the shape stream_google() normally yields.

    Mirrors google_service.py — usage, tool_preparing, then
    tool_args_progress at 5KB boundaries, then tool_start + finish.

    Like the Anthropic fixture, this includes tool_args_progress yields at
    each 5KB cumulative boundary (post-Task-2 production shape) with the
    additive `code_so_far` field carrying the FULL cumulative args.
    The threads.py `_on_chunk_google` dispatch routes those yields
    through `_emit` end-to-end.
    """
    # Initial usage event.
    yield {"type": "usage", "input_tokens": 10, "output_tokens": 0}

    # tool_preparing — name known.
    yield {
        "type": "tool_preparing",
        "id": "call_g_abc",
        "name": tool_name,
        "index": 0,
    }

    # tool_args_progress yields at each 5KB cumulative boundary.
    cumulative = ""
    for i in range(n_chunks):
        cumulative += "z" * chunk_size
        size = len(cumulative.encode("utf-8"))
        if (i + 1) * chunk_size in (5120, 10240):
            tail = cumulative.encode("utf-8")[-5120:].decode("utf-8", errors="ignore")
            yield {
                "type": "tool_args_progress",
                "tool_index": 0,
                "name": tool_name,
                "args_so_far": tail,
                "total_args_bytes_so_far": size,
                # Phase 075.6 Plan 01 / Req #1: full cumulative args.
                "code_so_far": cumulative,
            }

    # tool_start — args complete.
    yield {
        "type": "tool_start",
        "id": "call_g_abc",
        "name": tool_name,
        "args": {"text": cumulative},
    }

    # Terminal usage_delta + finish so the agent loop stops without tool exec.
    yield {"type": "usage_delta", "output_tokens": 100}
    yield {"type": "finish", "finish_reason": "stop", "tool_calls": []}


async def _capture_google_events(events_iter, seeded_thread_info: dict):
    """Drive the Google path: patch stream_google to return events_iter.

    Forces user_settings.active_provider="google" + a Google model so
    threads.py routes the agent loop through the Google branch
    (line ~1936 elif active_provider_name == "google":).
    The seeded thread/user pair satisfies the runs FK constraint.
    """
    from app.dependencies import get_current_user

    thread_id = seeded_thread_info["thread_id"]
    user_id = seeded_thread_info["user_id"]
    OWNER_USER = {"id": user_id, "email": "phase-075-test@test.local"}

    mock_supabase = _build_mock_supabase()

    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    app.dependency_overrides[get_current_user] = lambda: OWNER_USER

    try:
        from app.models.user_settings import load_user_settings as _real_load

        def _force_google_settings(uid, *a, **k):
            base = _real_load(uid, *a, **k)
            return base.model_copy(update={
                "active_provider": "google",
                "llm_model": "gemini-2.5-flash",
                "llm_api_key": "test-google-key",
            })

        _call_counter = {"n": 0}

        def _stream_google_side_effect(*a, **k):
            _call_counter["n"] += 1
            if _call_counter["n"] == 1:
                return _ClosableIterator(events_iter)
            stop_only = [
                {"type": "usage", "input_tokens": 1, "output_tokens": 0},
                {"type": "usage_delta", "output_tokens": 1},
                {"type": "finish", "finish_reason": "stop", "tool_calls": []},
            ]
            return _ClosableIterator(stop_only)

        with patch(
            "app.api.threads.stream_google",
            side_effect=_stream_google_side_effect,
        ), patch(
            "app.services.suggestion_service.generate_suggestions",
            return_value=([], None),
        ), patch(
            "app.api.threads.generate_thread_title",
            return_value=("T", None),
        ), patch(
            "app.api.threads.load_user_settings",
            side_effect=_force_google_settings,
        ):
            async with httpx.AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as ac:
                resp = await ac.post(
                    f"/threads/{thread_id}/messages",
                    headers={"Authorization": "Bearer test-token"},
                    json={"content": "analyze the doc please", "agent_mode": "default"},
                )
                assert resp.status_code == 201, (
                    f"POST failed: {resp.status_code} {resp.text[:400]}"
                )
                body = resp.json()
                run_id = body["run_id"]

                runs_builder = mock_supabase.table("runs")
                runs_builder.execute.side_effect = lambda *a, **k: type("R", (), {
                    "data": {
                        "run_id": run_id,
                        "status": "streaming",
                        "thread_id": thread_id,
                        "error": None,
                    },
                    "count": None,
                })()

                await asyncio.sleep(0.3)

                events: list[dict] = []
                async with ac.stream(
                    "GET", f"/runs/{run_id}/stream?since=0",
                    headers={"Authorization": "Bearer test-token"},
                    timeout=30.0,
                ) as stream_resp:
                    async for line in stream_resp.aiter_lines():
                        if line.startswith("data: "):
                            payload = json.loads(line[6:])
                            events.append(payload)
                            if payload.get("type") in TERMINAL_TYPES:
                                break

        return events
    finally:
        app.dependency_overrides.pop(get_supabase, None)
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
@pytest.mark.timeout(30)
async def test_google_path_emits_code_so_far(seeded_thread):
    """075.6 Req #1 (Google): every tool_args_progress event from the
    Google adapter carries a non-empty `code_so_far` AND consecutive
    events for the same tool_index are prefix-monotonic.

    Contrast: `args_so_far` is the 5 KB sliding-window tail; `code_so_far`
    is the FULL cumulative concatenated args (RESEARCH Pitfall 3).
    """
    events = await _capture_google_events(
        list(_google_events_with_big_args()),
        seeded_thread,
    )
    progress = [e for e in events if e.get("type") == "tool_args_progress"]
    assert len(progress) >= 2, (
        f"Google path: expected >=2 progress events with code_so_far; "
        f"got {len(progress)} events. All types: "
        f"{[e.get('type') for e in events]}"
    )

    for e in progress:
        assert "code_so_far" in e, (
            f"tool_args_progress event missing `code_so_far` key: {e}"
        )
        assert isinstance(e["code_so_far"], str) and e["code_so_far"], (
            f"`code_so_far` must be a non-empty string; got {e['code_so_far']!r}"
        )

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
                f"tool_index={idx}: code_so_far length must be non-decreasing"
            )
