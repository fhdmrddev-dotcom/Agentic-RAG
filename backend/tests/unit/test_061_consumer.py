"""Unit tests for the two-mode XREAD consumer — Phase 061 Pitfall 1 + D-061-12.

Phase 061.1 IN-04 (D-061.1-10): event_consumer was lifted from a closure inside
`send_message` to a module-level async generator. These tests now drive the REAL
function with a fake redis sequence instead of replicating the cursor-advancement
contract in-test.
"""
import asyncio
import json
from uuid import uuid4

import pytest


@pytest.mark.asyncio
async def test_xread_advances_last_id():
    """After receiving an entry with id '1620000000000-0', subsequent XREAD MUST
    use that id, NOT '$' or '0' (Pitfall 1).

    Phase 061.1 IN-04: this test now invokes the REAL `event_consumer` from
    `app.api.threads` with a fake redis whose `xread()` returns a scripted
    sequence. We assert (a) the consumer yields the events, and (b) the
    second xread call uses the actual returned id, not '$' or '0'.
    """
    from app.api.threads import event_consumer
    from app.config import Settings

    class _FakeRedisAdvancesCursor:
        """Stub redis whose xread yields a known sequence so we can assert
        cursor advancement.
        """

        def __init__(self):
            self.calls: list[dict] = []
            # Replay (last_id='0'): one entry; then drain empty so the
            # consumer transitions to tail. Tail (block != None): one entry,
            # then drain empty so we can examine call args.
            self._replay_entry = (
                "1620000000000-0",
                {"data": json.dumps({"type": "delta", "content": "x"})},
            )
            self._tail_entry = (
                "1620000001000-0",
                {"data": json.dumps({"type": "done"})},
            )
            self._replay_yielded = False
            self._tail_yielded = False

        async def xread(self, streams, count=None, block=None):
            self.calls.append(
                {"streams": dict(streams), "count": count, "block": block}
            )
            stream_key, last_id = next(iter(streams.items()))
            # Replay phase (block is None)
            if block is None:
                if not self._replay_yielded:
                    self._replay_yielded = True
                    return [(stream_key, [self._replay_entry])]
                return []  # drained → consumer breaks out of replay loop
            # Tail phase (block != None) — yield the terminal once
            if not self._tail_yielded:
                self._tail_yielded = True
                return [(stream_key, [self._tail_entry])]
            return []

    redis = _FakeRedisAdvancesCursor()
    settings = Settings()
    run_id = uuid4()

    events = []
    async for event in event_consumer(redis=redis, run_id=run_id, settings=settings):
        events.append(event)

    # Two events flowed: the delta and the done sentinel.
    assert len(events) == 2, f"Expected 2 events, got {len(events)}: {events}"
    assert json.loads(events[0]["data"])["type"] == "delta"
    assert json.loads(events[1]["data"])["type"] == "done"

    # Pitfall 1 assertion: locate the tail-phase xread call (block != None) and
    # verify its last_id is the LAST replay-returned id, NOT '$' or '0'.
    tail_calls = [c for c in redis.calls if c.get("block")]
    assert tail_calls, f"Expected tail-phase xread call (block != None); got {redis.calls}"
    tail_last_id = next(iter(tail_calls[0]["streams"].values()))
    assert tail_last_id == "1620000000000-0", (
        f"After first replay entry, last_id should advance to the entry id "
        f"'1620000000000-0'; tail xread used {tail_last_id!r}. "
        f"WR-01 (D-061.1-07) regressed if tail_last_id == '$'."
    )


@pytest.mark.asyncio
async def test_consumer_breaks_on_terminal_done():
    """Stand-in for event_consumer break-on-terminal-type (D-061-12).

    Mirrors the consumer's TERMINAL_TYPES check.
    """
    from app.api.threads import TERMINAL_TYPES
    assert "done" in TERMINAL_TYPES
    assert "error" in TERMINAL_TYPES
    assert "cancelled" in TERMINAL_TYPES
    assert "delta" not in TERMINAL_TYPES


@pytest.mark.asyncio
async def test_consumer_breaks_on_terminal_error():
    """Same as above but with type='error' — TERMINAL_TYPES contract."""
    from app.api.threads import TERMINAL_TYPES
    # type='error' must be in TERMINAL_TYPES so the consumer breaks
    assert "error" in TERMINAL_TYPES
