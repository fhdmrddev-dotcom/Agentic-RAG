"""Phase 085 Plan 03 Task 4 — uvicorn lifespan shutdown sentinel tests.

Covers:
  - Test 1: at lifespan shutdown, broadcast_shutdown_sentinel_to_all runs
            BEFORE the RUN_TASKS cancel loop (verified by call-order recording).
  - Test 2: if broadcast_shutdown_sentinel_to_all raises, lifespan still
            proceeds to cancel RUN_TASKS (never block shutdown on Redis
            failure per RESEARCH §A.6).
  - Test 3 (end-to-end integration): a paused _handle_ask_user waiting on a
            channel listed in ``ask_user:channels:{rid}`` receives
            ``{"kind": "shutdown"}`` and returns
            ``ToolResult("ask_user interrupted by server shutdown")``.
"""
from __future__ import annotations

import asyncio
import json
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest


@pytest.mark.asyncio
async def test_shutdown_broadcast_before_run_tasks_cancel(monkeypatch):
    """Test 1: broadcast call happens BEFORE the RUN_TASKS cancel loop.

    Verifies the textual + runtime ordering invariant: the lifespan shutdown
    block in main.py calls broadcast_shutdown_sentinel_to_all (via wait_for)
    BEFORE iterating RUN_TASKS and calling task.cancel() on each.
    """
    from app.main import lifespan

    call_order = []

    async def _fake_broadcast(_redis):
        call_order.append("broadcast")

    fake_run_id = uuid4()
    fake_task = asyncio.create_task(asyncio.sleep(60))

    def _recording_cancel():
        call_order.append("task_cancel")
        # Genuinely cancel so the gather below doesn't hang.
        asyncio.Task.cancel(fake_task)

    fake_task.cancel = _recording_cancel  # type: ignore[assignment]

    # Patch the broadcast helper at its import site within main.py
    # (lifespan does a lazy `from app.services.ask_user_service import
    # broadcast_shutdown_sentinel_to_all`). Patching the source module
    # is the canonical patch site.
    with patch(
        "app.services.ask_user_service.broadcast_shutdown_sentinel_to_all",
        side_effect=_fake_broadcast,
    ), patch(
        "app.api.threads.RUN_TASKS", {fake_run_id: fake_task},
    ), patch(
        "app.dependencies.get_redis", return_value=MagicMock(),
    ):
        # We exercise the lifespan by manually driving its async context
        # manager. Skip the startup body — it depends on env + asyncpg —
        # by stubbing the inner yields and only running the shutdown half.
        # Cleanest is to call lifespan() yielding immediately, then trigger
        # the cleanup. asynccontextmanager exposes __aenter__/__aexit__.
        app_mock = MagicMock()
        agen = lifespan(app_mock)
        # __aenter__ runs the startup half + reaches `yield`
        try:
            await agen.__aenter__()
        except Exception:
            # Startup has env-dependent paths (anyio limiter, migrations);
            # if those fail in a unit context, skip directly to teardown.
            pass
        # __aexit__ runs the shutdown half
        try:
            await agen.__aexit__(None, None, None)
        except Exception:
            # Downstream pg-pool/supabase close can fail in unit context —
            # the ordering invariant is captured in call_order regardless.
            pass

    # Confirm ordering: broadcast fired BEFORE task_cancel.
    assert "broadcast" in call_order, (
        f"shutdown broadcast was not called; call_order={call_order}"
    )
    assert "task_cancel" in call_order, (
        f"RUN_TASKS cancel was not called; call_order={call_order}"
    )
    b_idx = call_order.index("broadcast")
    c_idx = call_order.index("task_cancel")
    assert b_idx < c_idx, (
        f"PUBLISH-first ordering violated: {call_order}"
    )


@pytest.mark.asyncio
async def test_shutdown_proceeds_when_broadcast_raises():
    """Test 2: broadcast_shutdown_sentinel_to_all raising does NOT block
    the RUN_TASKS cancel loop (best-effort discipline per RESEARCH §A.6)."""
    from app.main import lifespan

    fake_run_id = uuid4()
    fake_task = asyncio.create_task(asyncio.sleep(60))

    cancel_called = []

    def _recording_cancel():
        cancel_called.append(True)
        asyncio.Task.cancel(fake_task)

    fake_task.cancel = _recording_cancel  # type: ignore[assignment]

    async def _raising_broadcast(_redis):
        raise RuntimeError("simulated Redis failure during shutdown")

    with patch(
        "app.services.ask_user_service.broadcast_shutdown_sentinel_to_all",
        side_effect=_raising_broadcast,
    ), patch(
        "app.api.threads.RUN_TASKS", {fake_run_id: fake_task},
    ), patch(
        "app.dependencies.get_redis", return_value=MagicMock(),
    ):
        app_mock = MagicMock()
        agen = lifespan(app_mock)
        try:
            await agen.__aenter__()
        except Exception:
            pass
        try:
            await agen.__aexit__(None, None, None)
        except Exception:
            pass

    assert cancel_called, (
        "RUN_TASKS cancel was NOT called after broadcast raised — "
        "lifespan blocked on Redis failure (violates best-effort rule)"
    )


@pytest.mark.asyncio
async def test_paused_handler_receives_shutdown_sentinel_end_to_end(redis_client):
    """Test 3: an end-to-end integration — call broadcast_shutdown_sentinel_to_all
    directly with a SUBSCRIBE coroutine waiting on the channel; assert the
    handler wakes with kind='shutdown' and returns the expected text.

    Doesn't drive the full lifespan; the lifespan integration is covered by
    Tests 1-2. This test pins the wire contract.
    """
    from app.services.ask_user_service import broadcast_shutdown_sentinel_to_all
    from app.services.tool_dispatcher import _handle_ask_user, ToolContext

    run_id = uuid4()
    tcid = "tcid-shutdown-e2e"

    ctx = ToolContext(
        redis=redis_client,
        run_id=run_id,
        thread_id="99999999-9999-9999-9999-999999999999",
        supabase=MagicMock(),
        pool=MagicMock(),
        user_settings=None,
        current_user={"id": "00000000-0000-0000-0000-000000000001"},
        folder_subtree_ids=None,
        scoped_folder_path=None,
        emit=AsyncMock(),
        spawn=lambda c: None,
        model="gpt-4o",
        previous_files_in_run={},
        parent_run_id=None,
        per_run_task_semaphore=asyncio.Semaphore(3),
        available_tools=["search_documents"],
        tool_call_id=tcid,
    )

    async def _broadcaster():
        # Give the handler time to register the SUBSCRIBE + SADD before we
        # sweep.
        await asyncio.sleep(0.4)
        await broadcast_shutdown_sentinel_to_all(redis_client)

    bcast_task = asyncio.create_task(_broadcaster())

    with patch(
        "app.services.tool_dispatcher.aexec",
        AsyncMock(return_value=MagicMock(data=[])),
    ):
        try:
            result = await _handle_ask_user(
                {"prompt": "anything?", "timeout_seconds": 5},
                ctx,
            )
        finally:
            await bcast_task

    try:
        await redis_client.delete(f"ask_user:channels:{run_id}")
    except Exception:
        pass

    assert "interrupted by server shutdown" in result.result.lower()
