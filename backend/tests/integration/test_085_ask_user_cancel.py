"""Phase 085 Plan 03 Task 3 — cancel_run integration with ask_user cancel sentinel.

Covers:
  - Test 6: when a run has active ask_user channels in the channels:set,
            DELETE /runs/{rid} publishes ``{"kind": "cancel"}`` to each channel
            BEFORE task.cancel() runs.
  - Test 7: when no ask_user channels are active, the cancel-sentinel path is
            a no-op (no spurious PUBLISH).

The PUBLISH-BEFORE-task.cancel() ordering is verified by inspecting the
ask_user_service.publish_cancel_sentinel call vs the RUN_TASKS task.cancel()
call via patches that record call-time.
"""
from __future__ import annotations

import asyncio
import json
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest


THREAD_ID = "88888888-8888-8888-8888-888888888888"


def _seed_streaming_run_with_task(mock_execute_result, run_id):
    """Make the supabase ownership SELECT return a streaming run for this user."""
    mock_execute_result.data = {
        "run_id": str(run_id),
        "thread_id": THREAD_ID,
        "status": "streaming",
    }


@pytest.mark.asyncio
async def test_cancel_run_publishes_cancel_sentinel_when_channels_active(
    redis_client, client, mock_execute_result,
):
    """Test 6: DELETE /runs/{rid} with active ask_user channels publishes
    cancel sentinel to each channel BEFORE task.cancel()."""
    from app.api.threads import RUN_TASKS

    run_id = uuid4()
    _seed_streaming_run_with_task(mock_execute_result, run_id)

    # Pre-populate the channels:set with 2 active channels — as if 2 ask_user
    # calls were paused on this run.
    set_key = f"ask_user:channels:{run_id}"
    ch_a = f"ask_user:{run_id}:tcid-a"
    ch_b = f"ask_user:{run_id}:tcid-b"
    await redis_client.sadd(set_key, ch_a, ch_b)

    # Register a fake task in RUN_TASKS so cancel_run hits the happy path.
    # A long-running asyncio.sleep ensures task.done() is False at the time
    # of the DELETE; we'll cancel + collect it at the end of the test.
    fake_task = asyncio.create_task(asyncio.sleep(60))
    RUN_TASKS[run_id] = fake_task

    # Subscribe to both channels so we can observe the publishes.
    pubsub = redis_client.pubsub()
    received_payloads = []
    cancel_call_order = []

    real_cancel = fake_task.cancel

    def _recording_cancel(*a, **k):
        cancel_call_order.append("task.cancel")
        return real_cancel(*a, **k)

    fake_task.cancel = _recording_cancel  # type: ignore[assignment]

    try:
        await pubsub.subscribe(ch_a, ch_b)
        # Drain the subscribe acks
        for _ in range(2):
            await pubsub.get_message(timeout=1.0)

        # Patch publish_cancel_sentinel so we can record when it fires.
        # We still want it to actually publish — call the real implementation
        # from inside the recorder.
        from app.services import ask_user_service
        real_publish = ask_user_service.publish_cancel_sentinel

        async def _recording_publish(*a, **k):
            cancel_call_order.append("publish_cancel_sentinel")
            return await real_publish(*a, **k)

        with patch.object(
            ask_user_service, "publish_cancel_sentinel", side_effect=_recording_publish,
        ):
            resp = client.delete(f"/runs/{run_id}")
            assert resp.status_code == 204, resp.text

        # Confirm the call order: PUBLISH before task.cancel
        assert cancel_call_order == ["publish_cancel_sentinel", "task.cancel"], (
            f"PUBLISH-first invariant violated: {cancel_call_order}"
        )

        # Both channels must have received a cancel sentinel.
        for _ in range(2):
            msg = await pubsub.get_message(
                ignore_subscribe_messages=True, timeout=2.0
            )
            if msg is not None and msg["type"] == "message":
                received_payloads.append(json.loads(msg["data"]))

        assert len(received_payloads) == 2, (
            f"expected 2 cancel sentinels, got {received_payloads}"
        )
        for body in received_payloads:
            assert body == {"kind": "cancel"}
    finally:
        try:
            await pubsub.unsubscribe(ch_a, ch_b)
        except Exception:
            pass
        try:
            await asyncio.wait_for(pubsub.aclose(), timeout=2.0)
        except Exception:
            pass
        # Cleanup
        RUN_TASKS.pop(run_id, None)
        try:
            await asyncio.wait_for(asyncio.gather(fake_task, return_exceptions=True), timeout=2.0)
        except Exception:
            pass
        try:
            await redis_client.delete(set_key)
        except Exception:
            pass


@pytest.mark.asyncio
async def test_cancel_run_with_no_ask_user_channels_is_noop(
    redis_client, client, mock_execute_result,
):
    """Test 7: cancel_run with no active ask_user channels — publish_cancel_sentinel
    runs (always) but no PUBLISH actually happens (empty SET no-op).

    The helper is no-op-safe; we verify by subscribing to a channel under this
    run and asserting NO message arrives in a short window.
    """
    from app.api.threads import RUN_TASKS

    run_id = uuid4()
    _seed_streaming_run_with_task(mock_execute_result, run_id)

    # NO entries in the channels:set this time.
    set_key = f"ask_user:channels:{run_id}"
    assert (await redis_client.scard(set_key)) == 0

    fake_task = asyncio.create_task(asyncio.sleep(60))
    RUN_TASKS[run_id] = fake_task

    # Subscribe to a hypothetical channel for this run.
    ch = f"ask_user:{run_id}:tcid-noone-home"
    pubsub = redis_client.pubsub()
    try:
        await pubsub.subscribe(ch)
        await pubsub.get_message(timeout=1.0)  # drain ack

        resp = client.delete(f"/runs/{run_id}")
        assert resp.status_code == 204, resp.text

        # Wait briefly to confirm NO message arrives (no spurious PUBLISH).
        msg = await pubsub.get_message(
            ignore_subscribe_messages=True, timeout=1.0
        )
        assert msg is None, f"unexpected publish: {msg}"
    finally:
        try:
            await pubsub.unsubscribe(ch)
        except Exception:
            pass
        try:
            await asyncio.wait_for(pubsub.aclose(), timeout=2.0)
        except Exception:
            pass
        RUN_TASKS.pop(run_id, None)
        try:
            await asyncio.wait_for(asyncio.gather(fake_task, return_exceptions=True), timeout=2.0)
        except Exception:
            pass
