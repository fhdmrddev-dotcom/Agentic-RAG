"""Phase 085 Plan 02 — concurrency cap integration tests.

Covers:
  - Test 1 (Task 3): acquire_global_task_slot returns True on Lua=1, False on Lua=0
  - Test 2 (Task 3): release_global_task_slot calls redis.decr("tasks:global:active")
  - Test 7 (Task 4): per-run cap fires at the 4th simultaneous task() call (Semaphore(3) saturated)
  - Test 8 (Task 4): global cap returns refusal AND releases per-run semaphore
  - Test 11 (Task 4): after a successful spawn, the global slot RELEASE is called

The Lua script + per-run Semaphore + Redis counter are the core gates for
T-085-T8 (LLM spawns unbounded parallel task() calls). These tests pin the
gate behavior without requiring a live Redis (`AsyncMock` for redis.eval / decr).
"""
from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest


THREAD_ID = "44444444-4444-4444-4444-444444444444"
PARENT_RUN_ID = uuid4()


def _make_parent_ctx(*, per_run_concurrency=3, redis_eval_result=1, available_tools=None):
    """Build a ToolContext seeded for concurrency tests."""
    from app.services.tool_dispatcher import ToolContext
    redis = MagicMock()
    redis.eval = AsyncMock(return_value=redis_eval_result)
    redis.decr = AsyncMock(return_value=0)
    sem = asyncio.Semaphore(per_run_concurrency)
    return ToolContext(
        redis=redis,
        run_id=PARENT_RUN_ID,
        thread_id=THREAD_ID,
        supabase=MagicMock(),
        pool=MagicMock(),
        user_settings=None,
        current_user={"id": "test-user"},
        folder_subtree_ids=None,
        scoped_folder_path=None,
        emit=AsyncMock(),
        spawn=lambda c: None,
        parent_run_id=None,
        per_run_task_semaphore=sem,
        available_tools=available_tools
                        if available_tools is not None
                        else ["search_documents", "read_document", "web_search"],
    )


# ---------------------------------------------------------------------------
# Global concurrency slot helpers — Tests 1, 2 (Task 3)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_acquire_global_task_slot_returns_true_on_lua_success():
    """Test 1: redis.eval returns 1 -> helper returns True (slot acquired)."""
    from app.services.task_service import acquire_global_task_slot
    redis = MagicMock()
    redis.eval = AsyncMock(return_value=1)
    assert (await acquire_global_task_slot(redis, max_concurrent=20)) is True
    redis.eval.assert_awaited_once()


@pytest.mark.asyncio
async def test_acquire_global_task_slot_returns_false_on_lua_cap():
    """Test 1 (companion): redis.eval returns 0 -> cap reached -> helper returns False."""
    from app.services.task_service import acquire_global_task_slot
    redis = MagicMock()
    redis.eval = AsyncMock(return_value=0)
    assert (await acquire_global_task_slot(redis, max_concurrent=20)) is False


@pytest.mark.asyncio
async def test_acquire_global_task_slot_swallows_redis_error():
    """Defensive: Redis exception -> helper returns False (don't bubble to LLM)."""
    from app.services.task_service import acquire_global_task_slot
    redis = MagicMock()
    redis.eval = AsyncMock(side_effect=Exception("redis down"))
    assert (await acquire_global_task_slot(redis, max_concurrent=20)) is False


@pytest.mark.asyncio
async def test_release_global_task_slot_calls_decr():
    """Test 2: release decrements tasks:global:active counter."""
    from app.services.task_service import release_global_task_slot
    redis = MagicMock()
    redis.decr = AsyncMock(return_value=0)
    await release_global_task_slot(redis)
    redis.decr.assert_awaited_once_with("tasks:global:active")


@pytest.mark.asyncio
async def test_release_global_task_slot_swallows_redis_error():
    """Defensive: release exception is logged not raised."""
    from app.services.task_service import release_global_task_slot
    redis = MagicMock()
    redis.decr = AsyncMock(side_effect=Exception("redis down"))
    # Must not raise
    await release_global_task_slot(redis)


# ---------------------------------------------------------------------------
# _handle_task concurrency cap — Tests 7, 8, 11 (Task 4)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_handle_task_per_run_cap_fires_on_fourth_call():
    """Test 7: 4 concurrent task() calls on the same ctx (Semaphore(3)) —
    the 4th must get the per-run cap error.

    Patch run_task_sub_agent to sleep briefly so the first 3 hold their
    semaphore slots when the 4th tries to acquire. asyncio.wait_for(timeout=0)
    in _handle_task makes the 4th call non-blocking → "limit reached".
    """
    from app.services.tool_dispatcher import _handle_task
    ctx = _make_parent_ctx(per_run_concurrency=3)

    async def slow_spawn(**_kwargs):
        await asyncio.sleep(0.5)
        return {"summary": "ok", "status": "completed", "sub_run_id": uuid4()}

    args = {"description": "x", "tools": ["search_documents"]}

    with patch("app.services.task_service.run_task_sub_agent", side_effect=slow_spawn):
        coros = [_handle_task(args, ctx) for _ in range(4)]
        results = await asyncio.gather(*coros)

    refusal_count = sum(1 for r in results if "per-run concurrency" in r.result)
    success_count = sum(1 for r in results if r.result == "ok")
    assert refusal_count == 1, (
        f"Expected exactly 1 per-run-cap refusal, got {refusal_count}; "
        f"results={[r.result for r in results]}"
    )
    assert success_count == 3


@pytest.mark.asyncio
async def test_handle_task_global_cap_releases_per_run_semaphore():
    """Test 8: when global cap blocks, per-run semaphore must be released.

    Without this, a single global-cap-blocked call would permanently consume
    one of the 3 per-run slots — eventually starving the run.
    """
    from app.services.tool_dispatcher import _handle_task
    ctx = _make_parent_ctx(per_run_concurrency=3, redis_eval_result=0)
    pre_value = ctx.per_run_task_semaphore._value
    result = await _handle_task(
        {"description": "x", "tools": ["search_documents"]}, ctx
    )
    assert "concurrency limit reached" in result.result
    # Semaphore must be at its full count again — release happened
    assert ctx.per_run_task_semaphore._value == pre_value


@pytest.mark.asyncio
async def test_handle_task_release_global_slot_called_in_finally():
    """Test 11: after a successful spawn, the global slot release is called."""
    from app.services.tool_dispatcher import _handle_task
    ctx = _make_parent_ctx()
    fake_spawn = AsyncMock(
        return_value={"summary": "ok", "status": "completed", "sub_run_id": uuid4()}
    )
    with patch("app.services.task_service.run_task_sub_agent", fake_spawn):
        await _handle_task(
            {"description": "x", "tools": ["search_documents"]}, ctx
        )
    # release_global_task_slot calls redis.decr("tasks:global:active")
    ctx.redis.decr.assert_awaited_once_with("tasks:global:active")
