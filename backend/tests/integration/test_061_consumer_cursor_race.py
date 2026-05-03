"""Regression tests for WR-01: consumer cursor `$` race.

Per 061-REVIEW.md WR-01: the consumer transitions from replay-phase cursor
(`last_id = entry_id`) to tail-phase cursor (`last_id = "$"`) after replay
drains. Race window: events XADDed between the empty xread and the first
tail xread are silently missed.

Phase 061.1 D-061.1-07 fix: keep `last_id` at the value of the last replayed
entry id (or '0' if replay was empty). XREAD with a past id and BLOCK still
returns only NEW entries — equivalent to '$' semantically but without the race.

These tests xfail until Task 6 (IN-04) lands, because `event_consumer` is
currently a closure inside `send_message` and therefore not importable at
module level. After T6's extraction the tests become live and PASS.
"""
import asyncio
import json
from uuid import uuid4

import pytest

pytestmark = pytest.mark.asyncio


class _FakeRedisCursorRace:
    """Scripted xread mock — yields entries in a controlled order to
    reproduce the empty-replay → tail-with-pre-existing-entry race.

    Behavior:
      - First xread (replay phase, last_id='0'): returns [] (replay drains empty)
      - Second xread (tail phase):
          * If the consumer (BUG) passes last_id='$' → returns [] (matches real
            Redis: '$' only yields entries arriving AFTER the call)
          * If the consumer (FIX) passes the carried-forward last_id ('0' since
            replay drained empty) → returns the entry that was XADDed during
            the race window (id='1-0', payload `{"type": "done"}`)
      - Subsequent calls: empty.
    """

    def __init__(self):
        self.xread_calls: list[dict] = []
        self._tail_yielded = False

    async def xread(self, streams, count=None, block=None):
        self.xread_calls.append(
            {"streams": dict(streams), "count": count, "block": block}
        )
        stream_key, last_id = next(iter(streams.items()))

        # First call: replay phase, last_id='0' → empty
        if last_id == "0" and not self._tail_yielded and block is None:
            return []

        # Tail phase
        if not self._tail_yielded:
            self._tail_yielded = True
            # BUG path: last_id == '$' → real Redis returns nothing because
            # the entry was XADDed BEFORE this xread call.
            if last_id == "$":
                return []
            # FIX path: last_id is a real id (or '0') → return the pre-existing entry.
            return [
                (stream_key, [("1-0", {"data": json.dumps({"type": "done"})})])
            ]

        # Any subsequent calls (test should have already returned)
        return []


async def test_consumer_does_not_miss_event_added_between_replay_and_tail():
    """RED until Task 3b (cursor fix) + Task 6 (event_consumer extraction) land.

    With the bug (`last_id = "$"` reset between replay and tail), the consumer
    misses an entry XADDed during the race window and would block until deadline.
    With the fix, the consumer carries `last_id` forward from replay (here: '0',
    since replay drained empty) and the tail xread surfaces the pre-existing entry.
    """
    try:
        from app.api.threads import event_consumer
    except ImportError:
        pytest.xfail(
            "event_consumer not yet extracted to module level — see IN-04 / Task 6"
        )

    from app.config import Settings

    redis = _FakeRedisCursorRace()
    settings = Settings()
    run_id = uuid4()

    gen = event_consumer(redis=redis, run_id=run_id, settings=settings)
    try:
        first_event = await asyncio.wait_for(gen.__anext__(), timeout=2.0)
    finally:
        await gen.aclose()

    payload = json.loads(first_event["data"])
    assert payload["type"] == "done", (
        f"Consumer should yield the `done` entry that producer XADDed during "
        f"the race window. Got payload={payload}; xread call sequence="
        f"{redis.xread_calls}"
    )


async def test_tail_phase_uses_last_replayed_id_not_dollar():
    """Asserts the WR-01 fix shape: tail-phase xread is invoked with the
    last replay cursor (or '0' when replay drained empty), not '$'."""
    try:
        from app.api.threads import event_consumer
    except ImportError:
        pytest.xfail(
            "event_consumer not yet extracted to module level — see IN-04 / Task 6"
        )

    from app.config import Settings

    redis = _FakeRedisCursorRace()
    settings = Settings()
    run_id = uuid4()

    gen = event_consumer(redis=redis, run_id=run_id, settings=settings)
    try:
        try:
            await asyncio.wait_for(gen.__anext__(), timeout=2.0)
        except StopAsyncIteration:
            pass
    finally:
        await gen.aclose()

    # Find the tail-phase xread call (block != None means tail).
    tail_calls = [c for c in redis.xread_calls if c.get("block")]
    assert tail_calls, (
        f"Expected at least one tail-phase xread (block != None); "
        f"got calls={redis.xread_calls}"
    )
    tail_last_id = next(iter(tail_calls[0]["streams"].values()))
    assert tail_last_id != "$", (
        f"Tail phase used `$` cursor — WR-01 fix not applied. Expected last "
        f"replayed id or '0'; got '{tail_last_id}'."
    )


async def test_terminal_type_break_unchanged():
    """No-regression: TERMINAL_TYPES break logic from D-061-12 still works.

    The replay phase yields a `done` entry; the consumer must yield it then
    return without entering the tail phase.
    """
    try:
        from app.api.threads import event_consumer
    except ImportError:
        pytest.xfail(
            "event_consumer not yet extracted to module level — see IN-04 / Task 6"
        )

    from app.config import Settings

    class _RedisOneEntryThenStop:
        def __init__(self):
            self.calls = 0

        async def xread(self, streams, count=None, block=None):
            self.calls += 1
            if self.calls == 1:
                stream_key = next(iter(streams.keys()))
                return [
                    (stream_key, [("1-0", {"data": json.dumps({"type": "done"})})])
                ]
            return []

    redis = _RedisOneEntryThenStop()
    settings = Settings()
    run_id = uuid4()

    events = []
    async for event in event_consumer(redis=redis, run_id=run_id, settings=settings):
        events.append(event)

    assert len(events) == 1
    assert json.loads(events[0]["data"])["type"] == "done"
    # Should NEVER have entered tail phase
    assert redis.calls == 1, (
        f"Consumer entered tail phase unexpectedly (xread calls={redis.calls})"
    )
