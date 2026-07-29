"""Phase 185 (GOVERN-03 / SPEC Req 9) — the indefinite ask_user wait, and the L-8 TTL.

Two claims, proved separately:

1. **RESEARCH assumption A1** — ``asyncio.wait_for(coro, timeout=None)`` waits for the
   coroutine rather than raising or returning early. It is documented stdlib behaviour,
   but the whole fail-closed posture of the armed action-risk checkpoint rests on it and
   it was UNTESTED in this repo, so it is asserted directly before anything is built on
   it. If a future Python changes that semantic, this test goes red BEFORE the armed
   gate silently starts expiring into "yes".
2. **L-8** — ``ask_user:channels:{run_id}`` (the discovery index the Stop sweep and the
   graceful-shutdown sweep read) carries a 3600s TTL. An indefinite wait routinely
   outlives it, which would make the run un-Stoppable and un-drainable. The poll loop
   now re-arms the TTL, best-effort.

MOCKS (``feedback_mock_completeness``): the ONLY network dependency here is Redis, and
it is fully faked — ``pubsub()``, ``subscribe``/``get_message``/``unsubscribe``/``aclose``
plus ``sadd``/``expire``/``srem`` are all explicit attributes on the fake, so nothing
reaches a real connection. Imports inside the bodies, ``asyncio.run`` at the call — the
``test_ask_user_disposition.py`` posture.
"""

from __future__ import annotations

import asyncio
import json
from unittest.mock import AsyncMock, patch

import pytest


# ── the fake Redis: enough surface for _subscribe_and_block, nothing more ─────
class _FakePubSub:
    """A pub/sub double whose ``get_message`` yields ``None`` (the 1.0s idle tick)
    ``idle_ticks`` times before delivering ``payload`` — i.e. it MAKES the caller wait."""

    def __init__(self, payload: dict | None, idle_ticks: int = 2):
        self._payload = payload
        self._idle_left = idle_ticks
        self.subscribed: list[str] = []
        self.unsubscribed: list[str] = []
        self.closed = False

    async def subscribe(self, channel):
        self.subscribed.append(channel)

    async def get_message(self, ignore_subscribe_messages=True, timeout=1.0):
        if self._idle_left > 0:
            self._idle_left -= 1
            await asyncio.sleep(0)  # yield to the loop, exactly as the real poll does
            return None
        return {"type": "message", "data": json.dumps(self._payload)}

    async def unsubscribe(self, channel):
        self.unsubscribed.append(channel)

    async def aclose(self):
        self.closed = True


class _FakeRedis:
    def __init__(self, pubsub: _FakePubSub, refresh_expire_raises: bool = False):
        self._pubsub = pubsub
        # Only the REFRESHES fail — the initial advertise at the SADD site is shipped,
        # unguarded code whose failure mode this plan does not change.
        self._refresh_expire_raises = refresh_expire_raises
        self.sadd_calls: list[tuple] = []
        self.expire_calls: list[tuple] = []
        self.srem_calls: list[tuple] = []

    def pubsub(self):
        return self._pubsub

    async def sadd(self, key, member):
        self.sadd_calls.append((key, member))

    async def expire(self, key, ttl):
        self.expire_calls.append((key, ttl))
        if self._refresh_expire_raises and len(self.expire_calls) > 1:
            raise RuntimeError("redis EXPIRE unavailable")

    async def srem(self, key, member):
        self.srem_calls.append((key, member))


# ── 1. assumption A1, asserted directly ──────────────────────────────────────
def test_wait_for_with_timeout_none_returns_rather_than_raising():
    """RESEARCH A1. ``asyncio.wait_for(coro, timeout=None)`` does NOT raise and does NOT
    return early — it returns the coroutine's value however long that takes. This is the
    single stdlib fact the armed checkpoint's fail-closed posture is built on: passing
    ``None`` down to ``asyncio.wait_for`` at ``ask_user_service.py``'s block site is what
    turns "no answer" into "the run never proceeds" instead of "the run advances"."""

    async def _slow():
        await asyncio.sleep(0.05)
        return "answered"

    async def _drive():
        return await asyncio.wait_for(_slow(), timeout=None)

    assert asyncio.run(_drive()) == "answered"

    # POSITIVE CONTROL: the same helper under a too-short FLOAT timeout DOES raise, so
    # the assertion above is about `None` specifically and not about wait_for being inert.
    async def _drive_short():
        return await asyncio.wait_for(_slow(), timeout=0.001)

    with pytest.raises(asyncio.TimeoutError):
        asyncio.run(_drive_short())


# ── 2. None reaches the block primitive, unmangled ───────────────────────────
def test_subscribe_for_response_passes_none_straight_through():
    """``subscribe_for_response(..., None)`` hands ``None`` to ``_subscribe_and_block``
    verbatim — no ``float()`` cast on the way (which would ``TypeError`` before the wait
    could ever start). The annotation widening is only half the fix; this is the other."""
    from uuid import uuid4

    from app.services import ask_user_service

    block = AsyncMock(return_value=None)
    with patch.object(ask_user_service, "_subscribe_and_block", block):
        asyncio.run(
            ask_user_service.subscribe_for_response(object(), uuid4(), "tc-1", None)
        )

    args, _kwargs = block.await_args
    assert args[3] is None, "the None timeout was mangled on the way to the block site"


def test_indefinite_subscribe_waits_and_returns_the_payload():
    """End to end over the REAL ``_subscribe_and_block`` with a faked Redis:
    ``timeout_seconds=None`` neither raises ``TypeError`` nor short-circuits — the poll
    loop idles twice and then returns the answer that finally arrives."""
    from uuid import uuid4

    from app.services.ask_user_service import subscribe_for_response

    pubsub = _FakePubSub({"kind": "response", "response_text": "Approve and run this step"})
    redis = _FakeRedis(pubsub)
    run_id = uuid4()

    payload = asyncio.run(subscribe_for_response(redis, run_id, "tc-1", None))

    assert payload == {"kind": "response", "response_text": "Approve and run this step"}
    # The load-bearing ordering is intact: SUBSCRIBE happened, then the advertise.
    assert pubsub.subscribed == [f"ask_user:{run_id}:tc-1"]
    assert redis.sadd_calls == [(f"ask_user:channels:{run_id}", f"ask_user:{run_id}:tc-1")]
    # And the cleanup ran (unsubscribe / aclose / SREM).
    assert pubsub.unsubscribed == [f"ask_user:{run_id}:tc-1"]
    assert pubsub.closed is True
    assert redis.srem_calls == [(f"ask_user:channels:{run_id}", f"ask_user:{run_id}:tc-1")]


# ── 3. L-8 — the discovery index stays alive for the whole wait ──────────────
def test_channels_set_ttl_is_re_armed_from_inside_the_poll_loop():
    """L-8. With the refresh interval driven to 0 (so every tick qualifies), a wait that
    idles twice re-arms ``ask_user:channels:{run_id}``'s 3600s TTL — on top of the one
    the SADD sets. Without this, a >1h wait falls out of the discovery index and a user
    pressing Stop (or a graceful drain) can no longer FIND the waiting subscriber."""
    from uuid import uuid4

    from app.services import ask_user_service

    pubsub = _FakePubSub({"kind": "cancel"}, idle_ticks=2)
    redis = _FakeRedis(pubsub)
    run_id = uuid4()

    with patch.object(ask_user_service, "_CHANNELS_TTL_REFRESH_SECONDS", 0):
        payload = asyncio.run(
            ask_user_service.subscribe_for_response(redis, run_id, "tc-1", None)
        )

    assert payload == {"kind": "cancel"}
    key = f"ask_user:channels:{run_id}"
    # 1 initial advertise + one refresh per poll tick (2 idle + 1 delivering).
    assert redis.expire_calls[0] == (key, 3600)
    assert len(redis.expire_calls) > 1, "the TTL was never re-armed inside the wait"
    assert all(call == (key, 3600) for call in redis.expire_calls), (
        "a refresh used a different key or TTL than the original advertise"
    )


def test_a_failing_ttl_refresh_never_breaks_the_wait():
    """The refresh is HOUSEKEEPING. If Redis rejects the EXPIRE, the rendezvous must
    still complete — a failed index refresh may never cost a user their answer."""
    from uuid import uuid4

    from app.services import ask_user_service

    pubsub = _FakePubSub({"kind": "response", "response_text": "Do not run it"}, idle_ticks=2)
    redis = _FakeRedis(pubsub, refresh_expire_raises=True)

    with patch.object(ask_user_service, "_CHANNELS_TTL_REFRESH_SECONDS", 0):
        payload = asyncio.run(
            ask_user_service.subscribe_for_response(redis, uuid4(), "tc-1", None)
        )

    assert payload == {"kind": "response", "response_text": "Do not run it"}
    assert len(redis.expire_calls) > 1  # it kept trying, and kept going


def test_no_parallel_subscribe_forever_helper_was_added():
    """The substrate has exactly ONE copy of the load-bearing SUBSCRIBE → SADD → block
    ordering (Pitfall 2). A second 'subscribe_forever' entry point would be a place for
    that ordering to drift, so the indefinite mode is a PARAMETER, not a sibling."""
    from app.services import ask_user_service

    assert not hasattr(ask_user_service, "subscribe_forever")
    assert not hasattr(ask_user_service, "_subscribe_and_block_forever")
