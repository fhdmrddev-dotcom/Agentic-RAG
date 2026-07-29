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

# Phase 185 (L-8) — how often the poll loop re-arms the ``ask_user:channels:{run_id}``
# discovery-index TTL. Must be comfortably shorter than the 3600s TTL itself so a
# handful of consecutive failed refreshes cannot let the advertisement lapse.
_CHANNELS_TTL_REFRESH_SECONDS = 300


async def _subscribe_and_block(
    redis: "aioredis.Redis",
    run_id: UUID,
    tool_call_id: str,
    timeout_seconds: float | None,
    *,
    on_subscribed=None,
) -> "dict | None":
    """SUBSCRIBE → SADD → (optional in-window hook) → block-on-message → cleanup.

    The SINGLE-SOURCED block primitive shared by ``subscribe_for_response`` (the
    live ask_user handler path) and ``resume_pending_prompt`` (the Plan 04 resume
    path) so the subscribe/advertise/block/cleanup logic can NEVER drift between
    the two. The ordering is load-bearing (Pitfall 2 — PUBLISH-before-SUBSCRIBE):
    SUBSCRIBE happens FIRST, then SADD, then ``on_subscribed`` (the caller's
    user-visible signal — e.g. the resume re-emit) runs INSIDE the subscribed
    window so a fast answer can't be published into a no-subscriber gap and lost.

    ``timeout_seconds=None`` means **wait indefinitely** — the Phase 185 armed
    action-risk-checkpoint disposition (GOVERN-03 / SPEC Req 9). This is a
    TYPE-ONLY widening on the default path: ``asyncio.wait_for(coro,
    timeout=None)`` already waits forever, no shipped caller passes ``None``, and
    both live call sites (``harness_engine.py`` and ``harness/phase_types.py``)
    hard-cast with ``float()``, so no existing behaviour can reach this mode.

    Pitfall mitigations are unchanged from the original handler: get_message
    timeout=1.0 (never 0 — Pitfall 1); aclose under a 2s wait_for (Pitfall 3);
    each cleanup step in its own try/except (idempotent cleanup discipline).
    """
    channel = f"ask_user:{run_id}:{tool_call_id}"
    channels_set_key = f"ask_user:channels:{run_id}"
    pubsub = redis.pubsub()
    try:
        await pubsub.subscribe(channel)                  # SUBSCRIBE first
        await redis.sadd(channels_set_key, channel)      # advertise to sweep paths
        await redis.expire(channels_set_key, 3600)       # safety TTL — auto-clear leaks

        # In-window hook (subscribe-before-emit — Pitfall 2): the resume path
        # re-emits the pending prompt HERE, AFTER the subscribe is registered.
        if on_subscribed is not None:
            await on_subscribed()

        async def _wait():
            # Phase 185 (L-8) — keep the channel FINDABLE for the whole wait.
            # The SADD above advertises this channel in ``ask_user:channels:{run_id}``
            # under a 3600s safety TTL. The WAIT itself is independent of that SET (the
            # SUBSCRIBE survives its expiry); the SET is only the DISCOVERY INDEX that
            # ``publish_cancel_sentinel`` (a user pressing Stop) and
            # ``broadcast_shutdown_sentinel_to_all`` (a graceful restart) sweep to find
            # a still-waiting subscriber. Once it expires, a >1h wait becomes
            # un-Stoppable and un-drainable — and an INDEFINITE wait (timeout_seconds
            # is None) routinely exceeds an hour. So re-arm the same TTL from inside the
            # poll loop, which already ticks at most once a second. Best-effort: a
            # failed refresh logs and the wait continues (never break the rendezvous
            # over a housekeeping write).
            _last_ttl_refresh = asyncio.get_running_loop().time()
            while True:
                msg = await pubsub.get_message(
                    ignore_subscribe_messages=True,
                    timeout=1.0,                         # Pitfall 1 — never 0
                )
                _now = asyncio.get_running_loop().time()
                if _now - _last_ttl_refresh >= _CHANNELS_TTL_REFRESH_SECONDS:
                    _last_ttl_refresh = _now
                    try:
                        # The SAME 3600s safety TTL the SADD above set — re-armed, not
                        # extended, so a leaked entry still auto-clears an hour after
                        # the waiter is gone.
                        await redis.expire(channels_set_key, 3600)
                    except Exception:  # noqa: BLE001
                        logger.warning(
                            "ask_user: channels-SET TTL refresh failed for %s "
                            "(wait continues)", channels_set_key,
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


async def subscribe_for_response(
    redis: "aioredis.Redis",
    run_id: UUID,
    tool_call_id: str,
    timeout_seconds: float | None,
) -> "dict | None":
    """Block until a PUBLISH arrives on ``ask_user:{run_id}:{tool_call_id}`` or
    ``timeout_seconds`` elapses.

    ``timeout_seconds=None`` means **wait indefinitely** — the Phase 185 armed
    action-risk-checkpoint disposition (GOVERN-03 / SPEC Req 9): with the
    checkpoint set, no answer must mean the run never proceeds, so there is no
    expiry that could quietly read as "yes". This is a TYPE-ONLY change on the
    default path: ``asyncio.wait_for(coro, timeout=None)`` already waits forever,
    no pre-185 caller passes ``None``, and both live call sites
    (``harness_engine._resolve_failure_with_ask_user`` and
    ``harness/phase_types._exec_llm_human_input``) hard-cast with ``float()``.

    COST OF AN INDEFINITE WAIT, measured (RESEARCH §"Event-loop safety"): one
    suspended coroutine and one Redis pub/sub connection. The wait is a pure
    asyncio poll — ``await pubsub.get_message(..., timeout=1.0)`` inside a
    ``while True`` — so it occupies neither the event loop nor a threadpool
    worker, and D-v2.5-01 (no blocking I/O in an async handler) is satisfied.

    Registers the channel in ``ask_user:channels:{run_id}`` SET on entry and
    removes it on exit (so the cancel + shutdown sweep paths can find it); the
    SET's TTL is re-armed from inside the poll loop so an indefinite wait stays
    Stoppable and drainable past the 3600s mark (L-8).

    Returns:
        Parsed JSON payload dict on PUBLISH (e.g. ``{"kind": "response",
        "response_text": "yes", "choice_index": null}``), or ``None`` on timeout
        / unparseable payload.

    Delegates to the single-sourced ``_subscribe_and_block`` primitive (no
    ``on_subscribed`` hook — this path's user-visible signal is owned by the
    dispatcher handler that calls it). Externally-observable behavior is
    UNCHANGED from the pre-refactor inline body for every non-``None`` timeout.
    """
    return await _subscribe_and_block(
        redis, run_id, tool_call_id, timeout_seconds
    )


async def _emit_ask_user_prompt(
    redis: "aioredis.Redis",
    run_id: UUID,
    tool_call_id: str,
    prompt: str,
    options: "list | None",
    timeout_seconds: float,
) -> None:
    """XADD an ``ask_user_prompt`` event to ``run:{run_id}`` (mirrors the engine _emit).

    One canonical event so the reconnected frontend re-renders the question on
    resume. Same stream/shape the live ``_exec_llm_human_input`` path emits.
    """
    await redis.xadd(
        f"run:{run_id}",
        {
            "data": json.dumps(
                {
                    "type": "ask_user_prompt",
                    "tool_call_id": tool_call_id,
                    "prompt": prompt,
                    "options": options or [],
                    "timeout_seconds": timeout_seconds,
                }
            )
        },
        maxlen=10000,
        approximate=True,
    )


async def resume_pending_prompt(
    redis: "aioredis.Redis",
    run_id: UUID,
    tool_call_id: str,
    prompt: str,
    options: "list | None",
    timeout_seconds: float,
) -> "dict | None":
    """Resume a still-PENDING ask_user prompt after a restart (HARNESS-03 / Plan 04).

    Mirrors the LIVE ask_user flow EXCEPT it does NOT re-INSERT the durable prompt
    row (it already exists — Plan 04 Task 1 fetched it via ``get_pending_ask_user``).
    The ordering is the load-bearing correctness rule (Pitfall 2):

      1. SUBSCRIBE ``ask_user:{run_id}:{tool_call_id}``  — the old subscriber died
         with the worker; re-subscribe FIRST.
      2. SADD ``ask_user:channels:{run_id}``             — re-advertise to the
         cancel/shutdown sweeps.
      3. (skip the durable prompt-row INSERT — it already exists.)
      4. _emit ``ask_user_prompt``                       — re-render on the
         reconnected frontend. MUST be AFTER (1) so a fast answer published in the
         emit→subscribe window can't be lost.
      5. block on get_message under ``asyncio.wait_for(timeout)``.

    Steps 1/2/5 are the shared ``_subscribe_and_block`` primitive; step 4 runs in
    its ``on_subscribed`` window (guaranteeing subscribe-before-emit). Returns the
    parsed wake payload (response / cancel / shutdown) or ``None`` on timeout —
    identical to ``subscribe_for_response``.
    """
    async def _reemit():
        await _emit_ask_user_prompt(
            redis, run_id, tool_call_id, prompt, options, timeout_seconds
        )

    # Phase 185 (L-7): plan 185-05 widens this cast so an armed action-risk gate can be
    # resumed with timeout_seconds=None. Left as-is here — behaviour unchanged.
    return await _subscribe_and_block(
        redis, run_id, tool_call_id, float(timeout_seconds), on_subscribed=_reemit
    )


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
