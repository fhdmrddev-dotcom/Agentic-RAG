"""Phase 085 D-085-01..07 — ask_user Redis pub/sub helpers (FIRST PUB/SUB USAGE in the repo).

Channel naming convention:
  - ``ask_user:{run_id}:{tool_call_id}``  — one pub/sub channel per paused tool call.
    A single subscriber (the worker running ``_handle_ask_user`` for that call)
    blocks on this channel. Multiple parallel ``ask_user`` calls within the same
    run get distinct channels via the unique ``tool_call_id``.

  - ``ask_user:channels:{run_id}``        — Redis SET of all channels currently
    active for this run. Used by:
      • runs.py:cancel_run to PUBLISH a cancel sentinel to every paused handler
        when the user hits Stop (cross-worker rendezvous — POST may land on any
        worker, paused handler may be on any worker).
      • main.py lifespan shutdown — SCAN ``ask_user:channels:*`` + PUBLISH a
        shutdown sentinel to every channel so paused handlers wake before the
        RUN_TASKS cancel loop nukes them.

CRITICAL ordering (RESEARCH §A.3 — PUBLISH-before-SUBSCRIBE race mitigation):
  Callers MUST register the SUBSCRIBE + SADD BEFORE persisting any user-visible
  signal (SSE event, messages-row insert). Without this, a fast user response
  can PUBLISH before SUBSCRIBE registers → message lost → agent hangs forever.

  ``subscribe_for_response`` enforces SUBSCRIBE → SADD → block-on-message in
  that order WITHIN the helper. The handler ``_handle_ask_user`` cannot use this
  helper directly for the full flow because the SSE emit + messages-row insert
  must happen AFTER the SADD but BEFORE the block — so the dispatcher's handler
  inlines the same ordering. This module's helper is used by tests + cancel +
  shutdown paths where the persistence step does not apply.

References:
  - RESEARCH.md §A.1 (subscribe lifecycle)
  - RESEARCH.md §A.3 (PUBLISH-before-SUBSCRIBE race window mitigation)
  - RESEARCH.md §A.5 (cancel sentinel cross-worker rendezvous)
  - RESEARCH.md §A.6 (shutdown sentinel broadcast)
  - RESEARCH.md §A.7 (durability of the POST response row even if SUBSCRIBE is dead)
  - RESEARCH.md Pitfalls 1-3 (get_message timeout=0 spin-loop; PUBLISH race;
    pubsub.aclose hang)
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import TYPE_CHECKING
from uuid import UUID

if TYPE_CHECKING:
    import redis.asyncio as aioredis

logger = logging.getLogger(__name__)


async def subscribe_for_response(
    redis: "aioredis.Redis",
    run_id: UUID,
    tool_call_id: str,
    timeout_seconds: float,
) -> "dict | None":
    """Block until a PUBLISH arrives on ``ask_user:{run_id}:{tool_call_id}`` or
    ``timeout_seconds`` elapses.

    Registers the channel in ``ask_user:channels:{run_id}`` SET on entry and
    removes it on exit (so the cancel + shutdown sweep paths can find it).

    Returns:
        Parsed JSON payload dict on PUBLISH (e.g. ``{"kind": "response",
        "response_text": "yes", "choice_index": null}``), or ``None`` on timeout
        / unparseable payload.

    Pitfall mitigations:
        - ``pubsub.get_message(timeout=1.0)`` — never 0 (Pitfall 1 — redis-py
          spin-loops at 100% CPU when timeout is 0).
        - ``asyncio.wait_for(pubsub.aclose(), timeout=2.0)`` in finally
          (Pitfall 3 — aclose can hang on a half-dead Redis socket).
        - All cleanup steps wrapped in their own try/except so a single failure
          doesn't mask the rest (idempotent cleanup discipline).
    """
    channel = f"ask_user:{run_id}:{tool_call_id}"
    channels_set_key = f"ask_user:channels:{run_id}"
    pubsub = redis.pubsub()
    try:
        await pubsub.subscribe(channel)                  # SUBSCRIBE first
        await redis.sadd(channels_set_key, channel)      # advertise to sweep paths
        await redis.expire(channels_set_key, 3600)       # safety TTL — auto-clear leaks

        async def _wait():
            while True:
                msg = await pubsub.get_message(
                    ignore_subscribe_messages=True,
                    timeout=1.0,                         # Pitfall 1 — never 0
                )
                if msg is not None and msg.get("type") == "message":
                    try:
                        return json.loads(msg["data"])
                    except (TypeError, ValueError):
                        logger.warning(
                            "ask_user: unparseable PUBLISH payload on %s", channel
                        )
                        return None

        try:
            return await asyncio.wait_for(_wait(), timeout=timeout_seconds)
        except asyncio.TimeoutError:
            return None
    finally:
        try:
            await pubsub.unsubscribe(channel)
        except Exception:  # noqa: BLE001
            logger.exception("ask_user: unsubscribe failed for %s", channel)
        try:
            await asyncio.wait_for(pubsub.aclose(), timeout=2.0)  # Pitfall 3
        except Exception:  # noqa: BLE001
            logger.exception("ask_user: pubsub.aclose failed for %s", channel)
        try:
            await redis.srem(channels_set_key, channel)
        except Exception:  # noqa: BLE001
            logger.exception("ask_user: SREM failed for %s", channels_set_key)


async def publish_response(
    redis: "aioredis.Redis",
    run_id: UUID,
    tool_call_id: str,
    response_text: str,
    choice_index: "int | None",
) -> int:
    """PUBLISH the user's response to the paused handler.

    Returns the Redis subscriber count (0 means the SUBSCRIBE is dead — POST
    endpoint still returns 200 because the messages row was persisted FIRST
    per RESEARCH §A.7 durability path).
    """
    channel = f"ask_user:{run_id}:{tool_call_id}"
    payload = json.dumps({
        "kind": "response",
        "response_text": response_text,
        "choice_index": choice_index,
    })
    return await redis.publish(channel, payload)


async def publish_cancel_sentinel(redis: "aioredis.Redis", run_id: UUID) -> None:
    """Broadcast a cancel sentinel to ALL active ask_user channels for ``run_id``.

    Called from ``runs.py:cancel_run`` BEFORE ``task.cancel()`` per RESEARCH §A.5
    PUBLISH-first ordering — the paused handler must wake and return a normal
    ``ToolResult`` so the agent loop can iterate once more (writing the response
    row) BEFORE CancelledError propagates.

    No-op if the SET is empty (no active ask_user channels for this run).
    Best-effort — never raises; logs and continues on any Redis error.
    """
    channels_set_key = f"ask_user:channels:{run_id}"
    try:
        channels = await redis.smembers(channels_set_key)
    except Exception:  # noqa: BLE001
        logger.exception("ask_user: SMEMBERS failed for %s", channels_set_key)
        return
    payload = json.dumps({"kind": "cancel"})
    for ch in channels:
        try:
            await redis.publish(ch, payload)
        except Exception:  # noqa: BLE001
            logger.exception("ask_user: cancel publish failed for %s", ch)


async def broadcast_shutdown_sentinel_to_all(redis: "aioredis.Redis") -> None:
    """Broadcast a shutdown sentinel to EVERY active ask_user channel system-wide.

    Called from ``main.py`` lifespan shutdown BEFORE the RUN_TASKS cancel loop
    per RESEARCH §A.6. SCANs ``ask_user:channels:*``, SMEMBERS each, PUBLISHes
    ``{"kind": "shutdown"}`` to every channel found. Paused handlers wake and
    return ``ToolResult("ask_user interrupted by server shutdown")``; the agent
    loop iterates once more, then the normal RUN_TASKS cancel propagates.

    Best-effort — never blocks shutdown on Redis failure. Each SCAN page +
    SMEMBERS + PUBLISH wrapped in its own try/except (one bad key doesn't kill
    the sweep).
    """
    payload = json.dumps({"kind": "shutdown"})
    try:
        async for key in redis.scan_iter("ask_user:channels:*", count=100):
            try:
                channels = await redis.smembers(key)
                for ch in channels:
                    try:
                        await redis.publish(ch, payload)
                    except Exception:  # noqa: BLE001
                        logger.exception(
                            "ask_user shutdown publish failed for %s", ch
                        )
            except Exception:  # noqa: BLE001
                logger.exception(
                    "ask_user shutdown SMEMBERS failed for key=%s", key
                )
    except Exception:  # noqa: BLE001
        logger.exception("ask_user shutdown SCAN failed")
