"""Phase 089 Plan 03 (G-5 verbatim move) — AgentLoopResult finalizer-seam test.

The verbatim move lifted the agent loop OUT of ``threads.py:agent_runner`` INTO
``app.services.agent_loop.run_agent_loop``. The producer's shielded finalizer
(``_shielded_finalize``) STAYS in threads.py and, after the move, can no longer
reach the persist callable / token totals / system-warning rows via the
``agent_runner`` closure — they now live inside ``run_agent_loop``.

The seam (SEAM.md §3 + the 089-03 ``result_sink`` deviation) carries those
finalizer-needed outputs back out:
  - ``run_agent_loop`` returns an ``AgentLoopResult`` (happy path) AND populates
    a by-reference ``result_sink`` dict in its outer ``finally`` (every exit
    path, incl. exception) with the bound ``persist`` /
    ``persist_system_warnings`` callables + token totals + warnings.
  - ``_shielded_finalize`` reads the sink, calls ``persist()`` to get the
    assistant message id, and passes it (plus the token totals) into
    ``finalize_run`` — BEFORE emitting the terminal sentinel (I10 / Pitfall 5:
    finalize_run UPDATE → sentinel order, byte-identical to pre-move).

This is the Wave-0-gap seam test from the 089 validation contract (RESEARCH
§"Wave 0 Gaps" L548 + §"Pitfall 5"). No existing test covered the
result-object → finalizer seam. Wire format + provider behavior are unchanged
(D-089-03); this test asserts only the SEAM (the loop returns what the finalizer
needs, and the terminal order holds).

Pattern mirrors test_075_4_terminal_race.py (finalizer order) +
test_provider_router.py (full send_message run with mocked LLM + asyncpg helpers).
"""
from __future__ import annotations

import asyncio
import json
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import httpx
import pytest
from httpx import ASGITransport

from app.dependencies import get_redis, get_supabase
from app.main import app
from app.services.agent_loop import (
    AgentLoopResult,
    RunContext,
    run_agent_loop,
)
from app.services.openai_service import CallingMode

from tests.integration._run_helpers import (
    _build_mock_supabase,
    _make_result,
)

THREAD_ID = str(uuid4())
USER_ID = "00000000-0000-0000-0000-000000000001"


def _clean_sse_chunk(content, finish_reason=None):
    """An OpenAI-shaped streaming chunk with EXPLICIT None for the optional
    fields the loop reads (reasoning_content / tool_calls / usage) so a bare
    MagicMock auto-attribute doesn't leak a non-JSON-serializable value into an
    SSE emit when the producer runs to completion (unlike the shared
    _make_sse_chunk helper, which leaves reasoning_content as an auto-MagicMock —
    fine for tests that never await the producer, fatal for ones that do)."""
    chunk = MagicMock()
    chunk.usage = None
    chunk.choices = [MagicMock()]
    chunk.choices[0].finish_reason = finish_reason
    delta = MagicMock()
    delta.content = content
    delta.tool_calls = None
    delta.reasoning_content = None
    chunk.choices[0].delta = delta
    return chunk


def _clean_chunks():
    for token in ("a", "b", "c"):
        yield _clean_sse_chunk(token)
    yield _clean_sse_chunk(None, finish_reason="stop")


@pytest.fixture(autouse=True)
def _reset_redis_singleton():
    """Each test gets a Redis client bound to its own per-test event loop."""
    import app.dependencies as _deps
    _deps._redis = None
    yield
    _deps._redis = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_user_settings() -> MagicMock:
    s = MagicMock()
    s.active_provider = "openai"
    s.llm_model = "gpt-5.4-mini"
    s.llm_api_key = "sk-test"
    s.llm_base_url = "https://api.openai.com/v1"
    s.openrouter_tool_strategy = "quality"
    s.web_search_enabled = True
    s.sandbox_enabled = True
    s.task_per_run_concurrency = 3
    return s


def _override_provider_passthrough(settings, provider):
    """Mirror test_provider_router: return the same settings unchanged so the
    MagicMock user_settings survives the resolution path."""
    settings.active_provider = provider
    return settings


def _run_id_from_insert_run(insert_run_mock: AsyncMock) -> str | None:
    """Extract the streaming run_id from the AsyncMock-patched insert_run."""
    for call in insert_run_mock.call_args_list:
        rid = call.kwargs.get("run_id")
        if rid is not None:
            return str(rid)
    return None


def _make_body() -> MagicMock:
    b = MagicMock()
    b.model = "gpt-5.4-mini"
    b.provider = None
    b.agent_mode = "general"
    b.content = "seam test prompt"
    return b


def _make_redis_mock() -> MagicMock:
    """Redis mock that records XADD calls in order so we can assert the
    finalize_run → terminal-sentinel ordering (I10)."""
    redis_mock = MagicMock()
    redis_mock.xadd = AsyncMock(return_value=b"1-0")
    redis_mock.expire = AsyncMock(return_value=True)
    redis_mock.zadd = AsyncMock(return_value=1)
    redis_mock.zrem = AsyncMock(return_value=1)
    redis_mock.aclose = AsyncMock(return_value=None)
    return redis_mock


# ---------------------------------------------------------------------------
# 1. Direct run_agent_loop seam test — the loop returns an AgentLoopResult
#    whose persist callable yields a valid id + token totals + warnings list.
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_run_agent_loop_returns_agent_loop_result_with_valid_persist():
    """run_agent_loop returns an AgentLoopResult whose persist() yields a
    non-None message id, whose token totals are populated, and whose
    persisted_system_warnings is a list. Also populates the result_sink with the
    same surface (the by-reference path the finalizer reads on all exit paths)."""
    mock_supabase = _build_mock_supabase()
    # history SELECT returns empty; thread folder SELECT returns no folder.
    mock_supabase.table("threads").execute.side_effect = (
        lambda *a, **k: _make_result({"id": THREAD_ID, "folder_id": None})
    )
    redis_mock = _make_redis_mock()

    persisted_id = uuid4()
    insert_message_mock = AsyncMock(return_value=persisted_id)

    ctx = RunContext(
        run_id=uuid4(),
        thread_id=THREAD_ID,
        current_user={"id": USER_ID},
        user_settings=_make_user_settings(),
        body=_make_body(),
        redis=redis_mock,
        supabase=mock_supabase,
        resolved_model="gpt-5.4-mini",
        resolved_provider="openai",
    )

    _emit = AsyncMock(return_value=None)
    _emit_terminal = AsyncMock(return_value=None)

    def _spawn(coro):
        return asyncio.ensure_future(coro)

    result_sink: dict = {}

    with patch(
        "app.services.provider_gateway.openai_compat.create_adaptive_streaming_chat",
        side_effect=lambda *a, **k: (iter(_clean_chunks()), CallingMode.NATIVE),
    ), patch(
        "app.services.agent_loop.get_pg_pool",
        new=AsyncMock(return_value=MagicMock()),
    ), patch(
        "app.services.agent_loop.insert_assistant_message",
        new=insert_message_mock,
    ), patch(
        "app.services.suggestion_service.generate_suggestions",
        return_value=([], None),
    ):
        result = await run_agent_loop(
            ctx,
            emit=_emit,
            emit_terminal=_emit_terminal,
            spawn=_spawn,
            result_sink=result_sink,
        )

    # --- the return-value seam (SEAM.md §3) ---
    assert isinstance(result, AgentLoopResult), (
        "run_agent_loop must return an AgentLoopResult (the finalizer-output bag)"
    )
    # persist() yields the inserted assistant-message id the finalizer feeds into
    # finalize_run(message_id=...).
    msg_id = await result.persist()
    assert msg_id == str(persisted_id), (
        f"AgentLoopResult.persist() must return the persisted message id; "
        f"got {msg_id!r}"
    )
    insert_message_mock.assert_awaited()  # the loop's persist fn hit the DB helper
    # persisted_system_warnings is a list (empty for this clean run).
    assert isinstance(result.persisted_system_warnings, list)
    # full_content_final carries the streamed tokens ("a"+"b"+"c").
    assert result.full_content_final == "abc"

    # --- the by-reference result_sink seam (089-03 deviation) ---
    # The finalizer reads the sink on EVERY exit path; it must carry the same
    # persist callable + warnings list + token totals.
    assert callable(result_sink["persist"])
    assert callable(result_sink["persist_system_warnings"])
    assert isinstance(result_sink["persisted_system_warnings"], list)
    assert "input_tokens_total" in result_sink
    assert "output_tokens_total" in result_sink
    assert result_sink["full_content_final"] == "abc"


# ---------------------------------------------------------------------------
# 2. Full producer-path seam test — the finalizer gets a valid persisted id and
#    the terminal sentinel fires AFTER finalize_run (I10 / Pitfall 5 order).
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
@pytest.mark.timeout(20)
async def test_finalizer_receives_persisted_id_and_terminal_order_holds():
    """Drive a full send_message run; assert the shielded finalizer (STAYS in
    threads.py) receives a valid (non-None) persisted message id via the loop's
    result_sink AND that finalize_run is awaited BEFORE the terminal sentinel
    XADD (I10 / Pitfall 5 — byte-identical post-move)."""
    from app.api.threads import RUN_TASKS

    mock_supabase = _build_mock_supabase()
    mock_supabase.table("threads").execute.side_effect = (
        lambda *a, **k: _make_result({"id": THREAD_ID, "folder_id": None})
    )
    redis_mock = _make_redis_mock()

    persisted_id = uuid4()
    insert_run_mock = AsyncMock(return_value=None)
    finalize_run_mock = AsyncMock(return_value=None)
    insert_message_mock = AsyncMock(return_value=persisted_id)

    # Record relative order of finalize_run vs the terminal-sentinel XADD.
    order: list[str] = []

    async def _finalize_side_effect(*a, **k):
        order.append("finalize_run")
        return None

    finalize_run_mock.side_effect = _finalize_side_effect

    _orig_xadd = redis_mock.xadd

    async def _xadd_side_effect(key, fields, *a, **k):
        # The terminal sentinel goes through _emit_terminal → xadd WITHOUT a
        # maxlen kwarg (Pitfall 5). The per-event _emit passes maxlen=.
        data = fields.get("data")
        if data:
            try:
                payload = json.loads(data)
                if payload.get("type") in ("done", "error", "cancelled", "timed_out"):
                    order.append("terminal_sentinel")
            except (ValueError, TypeError):
                pass
        return b"1-0"

    redis_mock.xadd = AsyncMock(side_effect=_xadd_side_effect)

    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    app.dependency_overrides[get_redis] = lambda: redis_mock

    captured_run_id: list[str] = []
    try:
        with patch(
            "app.api.threads.load_user_settings",
            return_value=_make_user_settings(),
        ), patch(
            "app.api.threads.override_provider",
            side_effect=_override_provider_passthrough,
        ), patch(
            "app.services.provider_gateway.openai_compat.create_adaptive_streaming_chat",
            side_effect=lambda *a, **k: (iter(_clean_chunks()), CallingMode.NATIVE),
        ), patch(
            "app.api.threads.generate_thread_title",
            return_value=("T", None),
        ), patch(
            "app.services.suggestion_service.generate_suggestions",
            return_value=([], None),
        ), patch(
            "app.api.threads.insert_run",
            new=insert_run_mock,
        ), patch(
            "app.api.threads.finalize_run",
            new=finalize_run_mock,
        ), patch(
            "app.services.agent_loop.insert_assistant_message",
            new=insert_message_mock,
        ), patch(
            "app.services.agent_loop.get_pg_pool",
            new=AsyncMock(return_value=MagicMock()),
        ), patch(
            "app.api.threads.get_pg_pool",
            new=AsyncMock(return_value=MagicMock()),
        ):
            async with httpx.AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as ac:
                resp = await ac.post(
                    f"/threads/{THREAD_ID}/messages",
                    content=json.dumps({"content": "seam test prompt"}),
                    headers={
                        "Authorization": "Bearer test-token",
                        "Content-Type": "application/json",
                    },
                    timeout=30.0,
                )
                assert resp.status_code == 201, (
                    f"Expected 201; got {resp.status_code} body={resp.text[:300]}"
                )
                run_id = _run_id_from_insert_run(insert_run_mock)
                assert run_id, "insert_run was never called with a run_id"
                captured_run_id.append(run_id)

                # Await the producer to finalize (the shielded finalizer ran).
                from uuid import UUID
                task = RUN_TASKS.get(UUID(run_id))
                if task is not None:
                    await asyncio.wait_for(task, timeout=15.0)

        # --- the finalizer-seam assertions ---
        finalize_run_mock.assert_awaited()
        # The persisted assistant-message id (from the loop's persist callable via
        # the result_sink) flowed into finalize_run(message_id=...).
        _fk = finalize_run_mock.await_args.kwargs
        assert _fk.get("message_id") == persisted_id, (
            "finalize_run must receive the assistant-message id the loop's persist "
            f"callable produced (result_sink seam); got {_fk.get('message_id')!r}"
        )
        insert_message_mock.assert_awaited()

        # --- the I10 / Pitfall 5 terminal-order assertion ---
        assert "finalize_run" in order, "finalize_run was never invoked"
        assert "terminal_sentinel" in order, "terminal sentinel was never emitted"
        assert order.index("finalize_run") < order.index("terminal_sentinel"), (
            "I10 / Pitfall 5: finalize_run UPDATE MUST be awaited BEFORE the "
            f"terminal sentinel XADD (so SSE 'done' implies DB-committed). order={order}"
        )
    finally:
        redis_mock.xadd = _orig_xadd
        app.dependency_overrides.pop(get_supabase, None)
        app.dependency_overrides.pop(get_redis, None)
        from uuid import UUID
        for run_id_str in captured_run_id:
            try:
                task = RUN_TASKS.get(UUID(run_id_str))
                if task is not None and not task.done():
                    task.cancel()
                    try:
                        await asyncio.wait_for(task, timeout=2.0)
                    except (asyncio.CancelledError, asyncio.TimeoutError, Exception):
                        pass
            except Exception:
                pass
