"""Phase 085 Plan 03 — ask_user pub/sub helpers + _handle_ask_user integration tests.

Task 1 tests (subscribe_for_response + publish_response + publish_cancel_sentinel
+ broadcast_shutdown_sentinel_to_all): Tests 1-7.
Task 2 tests (_handle_ask_user with SUBSCRIBE-first ordering): Tests T2-1..T2-8.

Requires a running Redis (docker-compose.dev.yml). Tests use the function-scoped
``redis_client`` fixture from backend/tests/conftest.py; UUID-based test isolation
makes parallel runs safe.
"""
from __future__ import annotations

import asyncio
import json
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest


# ────────────────────────────────────────────────────────────────────────
# Task 1 — ask_user_service helpers
# ────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_subscribe_for_response_returns_none_on_timeout(redis_client):
    """Test 1: no PUBLISH within timeout → returns None."""
    from app.services.ask_user_service import subscribe_for_response

    run_id = uuid4()
    result = await subscribe_for_response(
        redis_client, run_id, "tcid-timeout", timeout_seconds=0.5
    )
    assert result is None


@pytest.mark.asyncio
async def test_subscribe_for_response_returns_payload_on_publish(redis_client):
    """Test 2: PUBLISH on the correct channel → handler returns the parsed payload."""
    from app.services.ask_user_service import subscribe_for_response

    run_id = uuid4()
    tcid = "tcid-publish-resume"
    channel = f"ask_user:{run_id}:{tcid}"

    async def _publisher():
        # Give the SUBSCRIBE coroutine time to register (Pitfall 2 — race
        # avoidance is the whole point; in tests we sleep generously).
        await asyncio.sleep(0.3)
        await redis_client.publish(channel, json.dumps({
            "kind": "response",
            "response_text": "hello user",
            "choice_index": 1,
        }))

    pub_task = asyncio.create_task(_publisher())
    try:
        result = await subscribe_for_response(
            redis_client, run_id, tcid, timeout_seconds=5.0
        )
    finally:
        await pub_task

    assert result is not None
    assert result["kind"] == "response"
    assert result["response_text"] == "hello user"
    assert result["choice_index"] == 1


@pytest.mark.asyncio
async def test_subscribe_for_response_adds_channel_to_set(redis_client):
    """Test 3: SADD on the channels:set happens within the subscribe lifecycle."""
    from app.services.ask_user_service import subscribe_for_response

    run_id = uuid4()
    tcid = "tcid-sadd"
    channel = f"ask_user:{run_id}:{tcid}"
    set_key = f"ask_user:channels:{run_id}"

    # Start the SUBSCRIBE; it will block waiting for a PUBLISH.
    sub_task = asyncio.create_task(
        subscribe_for_response(redis_client, run_id, tcid, timeout_seconds=2.0)
    )
    try:
        # Give it time to register + SADD
        await asyncio.sleep(0.3)
        members = await redis_client.smembers(set_key)
        assert channel in members, f"channel {channel} not in {members}"
    finally:
        sub_task.cancel()
        try:
            await sub_task
        except (asyncio.CancelledError, Exception):
            pass


@pytest.mark.asyncio
async def test_subscribe_for_response_removes_channel_on_finally(redis_client):
    """Test 4: SREM on the channels:set happens after the helper exits (timeout path)."""
    from app.services.ask_user_service import subscribe_for_response

    run_id = uuid4()
    tcid = "tcid-srem"
    channel = f"ask_user:{run_id}:{tcid}"
    set_key = f"ask_user:channels:{run_id}"

    result = await subscribe_for_response(
        redis_client, run_id, tcid, timeout_seconds=0.3
    )
    assert result is None  # timed out

    # After return, the channel must be gone from the SET.
    members = await redis_client.smembers(set_key)
    assert channel not in members, (
        f"channel {channel} still in SET {members} after helper exit"
    )


@pytest.mark.asyncio
async def test_publish_response_publishes_correct_payload(redis_client):
    """Test 5: publish_response PUBLISHes the right JSON to ``ask_user:{rid}:{tcid}``."""
    from app.services.ask_user_service import publish_response

    run_id = uuid4()
    tcid = "tcid-pub-shape"
    channel = f"ask_user:{run_id}:{tcid}"

    pubsub = redis_client.pubsub()
    try:
        await pubsub.subscribe(channel)
        # Drain the subscribe-ack message.
        await pubsub.get_message(timeout=1.0)

        # Now publish via our helper.
        subscriber_count = await publish_response(
            redis_client, run_id, tcid, "yes please", 0
        )
        assert subscriber_count >= 1, (
            f"expected >=1 subscriber (ours), got {subscriber_count}"
        )

        # Wait for the message to come back through the same pubsub.
        msg = await pubsub.get_message(
            ignore_subscribe_messages=True, timeout=2.0
        )
        assert msg is not None and msg["type"] == "message"
        payload = json.loads(msg["data"])
        assert payload["kind"] == "response"
        assert payload["response_text"] == "yes please"
        assert payload["choice_index"] == 0
    finally:
        try:
            await pubsub.unsubscribe(channel)
        except Exception:
            pass
        try:
            await asyncio.wait_for(pubsub.aclose(), timeout=2.0)
        except Exception:
            pass


@pytest.mark.asyncio
async def test_publish_cancel_sentinel_publishes_to_all_channels(redis_client):
    """Test 6: publish_cancel_sentinel iterates the SET and publishes ``cancel`` to each.

    Also verifies the empty-SET no-op path.
    """
    from app.services.ask_user_service import publish_cancel_sentinel

    run_id = uuid4()
    set_key = f"ask_user:channels:{run_id}"
    ch_a = f"ask_user:{run_id}:tcid-a"
    ch_b = f"ask_user:{run_id}:tcid-b"

    # Pre-populate the SET with 2 channels.
    await redis_client.sadd(set_key, ch_a, ch_b)

    # Subscribe to both channels so we can observe the publishes.
    pubsub = redis_client.pubsub()
    try:
        await pubsub.subscribe(ch_a, ch_b)
        # Drain the subscribe acks.
        for _ in range(2):
            await pubsub.get_message(timeout=1.0)

        await publish_cancel_sentinel(redis_client, run_id)

        # Both channels must have received the cancel sentinel.
        received = []
        for _ in range(2):
            msg = await pubsub.get_message(
                ignore_subscribe_messages=True, timeout=2.0
            )
            if msg is not None and msg["type"] == "message":
                received.append((msg["channel"], json.loads(msg["data"])))

        assert len(received) == 2, f"expected 2 messages, got {received}"
        for _ch, body in received:
            assert body == {"kind": "cancel"}, f"unexpected body: {body}"
    finally:
        try:
            await pubsub.unsubscribe(ch_a, ch_b)
        except Exception:
            pass
        try:
            await asyncio.wait_for(pubsub.aclose(), timeout=2.0)
        except Exception:
            pass
        await redis_client.delete(set_key)

    # Empty-SET no-op path
    other_run = uuid4()
    await publish_cancel_sentinel(redis_client, other_run)  # must not raise


@pytest.mark.asyncio
async def test_broadcast_shutdown_sentinel_to_all_publishes_everywhere(redis_client):
    """Test 7: broadcast_shutdown_sentinel SCANs all ``ask_user:channels:*`` keys
    and PUBLISHes ``{"kind": "shutdown"}`` to every channel."""
    from app.services.ask_user_service import broadcast_shutdown_sentinel_to_all

    run_a = uuid4()
    run_b = uuid4()
    set_a = f"ask_user:channels:{run_a}"
    set_b = f"ask_user:channels:{run_b}"
    ch_a = f"ask_user:{run_a}:tcid-shut-a"
    ch_b = f"ask_user:{run_b}:tcid-shut-b"

    await redis_client.sadd(set_a, ch_a)
    await redis_client.sadd(set_b, ch_b)

    pubsub = redis_client.pubsub()
    try:
        await pubsub.subscribe(ch_a, ch_b)
        for _ in range(2):
            await pubsub.get_message(timeout=1.0)

        await broadcast_shutdown_sentinel_to_all(redis_client)

        received = []
        for _ in range(2):
            msg = await pubsub.get_message(
                ignore_subscribe_messages=True, timeout=2.0
            )
            if msg is not None and msg["type"] == "message":
                received.append(json.loads(msg["data"]))

        assert len(received) == 2, f"expected 2 messages, got {received}"
        for body in received:
            assert body == {"kind": "shutdown"}
    finally:
        try:
            await pubsub.unsubscribe(ch_a, ch_b)
        except Exception:
            pass
        try:
            await asyncio.wait_for(pubsub.aclose(), timeout=2.0)
        except Exception:
            pass
        await redis_client.delete(set_a, set_b)


# ────────────────────────────────────────────────────────────────────────
# Task 2 — _handle_ask_user dispatcher integration
# ────────────────────────────────────────────────────────────────────────


THREAD_ID = "66666666-6666-6666-6666-666666666666"


def _build_ctx(redis, *, tool_call_id="tcid-default", run_id=None):
    """Construct a ToolContext suitable for calling _handle_ask_user.

    Uses a MagicMock for supabase + an AsyncMock-wrapped aexec via patch when
    needed at call sites. emit is an AsyncMock so tests can inspect SSE calls.
    """
    from app.services.tool_dispatcher import ToolContext
    if run_id is None:
        run_id = uuid4()
    return ToolContext(
        redis=redis,
        run_id=run_id,
        thread_id=THREAD_ID,
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
        tool_call_id=tool_call_id,
    )


@pytest.mark.asyncio
async def test_handle_ask_user_empty_prompt_returns_error(redis_client):
    """Test T2-1: empty prompt → ToolResult with 'non-empty prompt'."""
    from app.services.tool_dispatcher import _handle_ask_user

    ctx = _build_ctx(redis_client, tool_call_id="tcid-empty")
    result = await _handle_ask_user({"prompt": "  "}, ctx)
    assert "non-empty prompt" in result.result.lower()


@pytest.mark.asyncio
async def test_handle_ask_user_missing_tool_call_id_returns_error(redis_client):
    """Defensive: ctx.tool_call_id empty → ToolResult error (handler can't
    name the channel without it)."""
    from app.services.tool_dispatcher import _handle_ask_user

    ctx = _build_ctx(redis_client, tool_call_id="")
    result = await _handle_ask_user({"prompt": "anything?"}, ctx)
    assert "tool_call_id" in result.result.lower()


@pytest.mark.asyncio
async def test_handle_ask_user_subscribe_first_ordering(redis_client):
    """Test T2-2: SADD on channels:set + SUBSCRIBE happen BEFORE the messages
    row insert + SSE emit (load-bearing order — FC#10 / T-085-T16).

    Patches aexec to record call-order vs SADD; emits also patched.
    """
    from app.services.tool_dispatcher import _handle_ask_user

    run_id = uuid4()
    tcid = "tcid-order"
    set_key = f"ask_user:channels:{run_id}"
    call_order = []

    # Wrap redis.sadd to record when it fires (within the helper).
    real_sadd = redis_client.sadd

    async def _sadd_recorder(*args, **kwargs):
        call_order.append("sadd")
        return await real_sadd(*args, **kwargs)

    async def _aexec_recorder(*_a, **_k):
        call_order.append("messages_insert")
        return MagicMock(data=[])

    ctx = _build_ctx(redis_client, tool_call_id=tcid, run_id=run_id)

    async def _emit_recorder(*_a, **_k):
        call_order.append("sse_emit")

    ctx.emit = _emit_recorder

    # Schedule a publish AFTER the SSE emit happens so the handler returns.
    async def _publisher():
        # The handler emits well before this fires; we just need to break it
        # out of the get_message loop within the timeout budget.
        await asyncio.sleep(0.5)
        await redis_client.publish(
            f"ask_user:{run_id}:{tcid}",
            json.dumps({"kind": "response", "response_text": "ok", "choice_index": None}),
        )

    pub_task = asyncio.create_task(_publisher())

    # Patch redis.sadd just for this test
    with patch.object(redis_client, "sadd", _sadd_recorder), \
         patch("app.services.tool_dispatcher.aexec", side_effect=_aexec_recorder):
        try:
            result = await _handle_ask_user(
                {"prompt": "pick a", "timeout_seconds": 5},
                ctx,
            )
        finally:
            await pub_task

    # Cleanup the channels set key
    try:
        await redis_client.delete(set_key)
    except Exception:
        pass

    # Order MUST be: sadd → messages_insert → sse_emit. Anything else means
    # the ordering invariant has been broken — the race window is open.
    assert call_order[0] == "sadd", f"expected sadd first, got {call_order}"
    assert "messages_insert" in call_order
    assert "sse_emit" in call_order
    sadd_idx = call_order.index("sadd")
    insert_idx = call_order.index("messages_insert")
    emit_idx = call_order.index("sse_emit")
    assert sadd_idx < insert_idx < emit_idx, (
        f"order invariant violated: {call_order}"
    )
    # And the response was correctly returned.
    assert result.result == "ok"


@pytest.mark.asyncio
async def test_handle_ask_user_response_publish_returns_text(redis_client):
    """Test T2-3: PUBLISH ``{"kind": "response", ...}`` → ToolResult(result=response_text)."""
    from app.services.tool_dispatcher import _handle_ask_user

    run_id = uuid4()
    tcid = "tcid-response"
    channel = f"ask_user:{run_id}:{tcid}"

    async def _publisher():
        await asyncio.sleep(0.4)
        await redis_client.publish(channel, json.dumps({
            "kind": "response",
            "response_text": "the answer is 42",
            "choice_index": None,
        }))

    ctx = _build_ctx(redis_client, tool_call_id=tcid, run_id=run_id)
    pub_task = asyncio.create_task(_publisher())

    with patch("app.services.tool_dispatcher.aexec", AsyncMock(return_value=MagicMock(data=[]))):
        try:
            result = await _handle_ask_user(
                {"prompt": "what is the meaning of life?", "timeout_seconds": 5},
                ctx,
            )
        finally:
            await pub_task

    try:
        await redis_client.delete(f"ask_user:channels:{run_id}")
    except Exception:
        pass

    assert result.result == "the answer is 42"


@pytest.mark.asyncio
async def test_handle_ask_user_cancel_sentinel_returns_cancel_text(redis_client):
    """Test T2-4: PUBLISH ``{"kind": "cancel"}`` → ToolResult('ask_user cancelled by user stop')."""
    from app.services.tool_dispatcher import _handle_ask_user

    run_id = uuid4()
    tcid = "tcid-cancel"
    channel = f"ask_user:{run_id}:{tcid}"

    async def _publisher():
        await asyncio.sleep(0.4)
        await redis_client.publish(channel, json.dumps({"kind": "cancel"}))

    ctx = _build_ctx(redis_client, tool_call_id=tcid, run_id=run_id)
    pub_task = asyncio.create_task(_publisher())

    with patch("app.services.tool_dispatcher.aexec", AsyncMock(return_value=MagicMock(data=[]))):
        try:
            result = await _handle_ask_user(
                {"prompt": "anything?", "timeout_seconds": 5},
                ctx,
            )
        finally:
            await pub_task

    try:
        await redis_client.delete(f"ask_user:channels:{run_id}")
    except Exception:
        pass

    assert "cancelled by user stop" in result.result.lower()


@pytest.mark.asyncio
async def test_handle_ask_user_shutdown_sentinel_returns_shutdown_text(redis_client):
    """Test T2-5: PUBLISH ``{"kind": "shutdown"}`` → ToolResult('interrupted by server shutdown')."""
    from app.services.tool_dispatcher import _handle_ask_user

    run_id = uuid4()
    tcid = "tcid-shutdown"
    channel = f"ask_user:{run_id}:{tcid}"

    async def _publisher():
        await asyncio.sleep(0.4)
        await redis_client.publish(channel, json.dumps({"kind": "shutdown"}))

    ctx = _build_ctx(redis_client, tool_call_id=tcid, run_id=run_id)
    pub_task = asyncio.create_task(_publisher())

    with patch("app.services.tool_dispatcher.aexec", AsyncMock(return_value=MagicMock(data=[]))):
        try:
            result = await _handle_ask_user(
                {"prompt": "anything?", "timeout_seconds": 5},
                ctx,
            )
        finally:
            await pub_task

    try:
        await redis_client.delete(f"ask_user:channels:{run_id}")
    except Exception:
        pass

    assert "interrupted by server shutdown" in result.result.lower()


@pytest.mark.asyncio
async def test_handle_ask_user_timeout_returns_timed_out(redis_client):
    """Test T2-6: no PUBLISH → ToolResult containing 'timed out' and timeout value."""
    from app.services.tool_dispatcher import _handle_ask_user

    ctx = _build_ctx(redis_client, tool_call_id="tcid-timeout")
    with patch("app.services.tool_dispatcher.aexec", AsyncMock(return_value=MagicMock(data=[]))):
        result = await _handle_ask_user(
            {"prompt": "no response coming", "timeout_seconds": 1},
            ctx,
        )

    try:
        await redis_client.delete(f"ask_user:channels:{ctx.run_id}")
    except Exception:
        pass

    text = result.result.lower()
    assert "timed out" in text
    assert "1" in text  # the timeout value somewhere


@pytest.mark.asyncio
async def test_registry_has_ask_user_entry():
    """Test T2-7: _TOOL_REGISTRY['ask_user'] is _handle_ask_user."""
    from app.services.tool_dispatcher import _TOOL_REGISTRY, _handle_ask_user
    assert _TOOL_REGISTRY.get("ask_user") is _handle_ask_user


@pytest.mark.asyncio
async def test_handle_ask_user_invalid_timeout_returns_error(redis_client):
    """Defensive: non-integer timeout_seconds → ToolResult error."""
    from app.services.tool_dispatcher import _handle_ask_user

    ctx = _build_ctx(redis_client, tool_call_id="tcid-bad-timeout")
    result = await _handle_ask_user(
        {"prompt": "anything?", "timeout_seconds": "not-a-number"},
        ctx,
    )
    assert "positive integer" in result.result.lower()


@pytest.mark.asyncio
async def test_handle_ask_user_parallel_calls_isolated(redis_client):
    """Test T2-8 cross-channel isolation proxy: two SUBSCRIBE coroutines on the
    SAME Redis client with different (run_id, tool_call_id) pairs each get only
    their own PUBLISH.

    Proves channel naming structure ``ask_user:{run_id}:{tool_call_id}`` isolates
    parallel ask_user calls — Worker B PUBLISHing to call A's channel doesn't
    wake call B's subscriber.
    """
    from app.services.ask_user_service import subscribe_for_response

    run_a = uuid4()
    run_b = uuid4()
    tcid_a = "tcid-iso-a"
    tcid_b = "tcid-iso-b"

    async def _publisher():
        await asyncio.sleep(0.3)
        # Only publish to A's channel; B's subscribe must time out.
        await redis_client.publish(
            f"ask_user:{run_a}:{tcid_a}",
            json.dumps({"kind": "response", "response_text": "a-answered", "choice_index": None}),
        )

    pub_task = asyncio.create_task(_publisher())

    a_task = asyncio.create_task(
        subscribe_for_response(redis_client, run_a, tcid_a, timeout_seconds=2.0)
    )
    b_task = asyncio.create_task(
        subscribe_for_response(redis_client, run_b, tcid_b, timeout_seconds=2.0)
    )

    try:
        a_result, b_result = await asyncio.gather(a_task, b_task)
    finally:
        await pub_task

    assert a_result == {
        "kind": "response", "response_text": "a-answered", "choice_index": None,
    }
    assert b_result is None  # B timed out — A's PUBLISH didn't leak to it
