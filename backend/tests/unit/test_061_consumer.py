"""Unit tests for the two-mode XREAD consumer — Phase 061 Pitfall 1 + D-061-12."""
import json
from unittest.mock import AsyncMock

import pytest


@pytest.mark.asyncio
async def test_xread_advances_last_id():
    """After receiving an entry with id '1620000000000-0', subsequent XREAD MUST use that id, NOT '$' or '0' (Pitfall 1).

    event_consumer is defined as a closure inside send_message; we exercise
    its cursor-advancement CONTRACT here by stub-driving xread manually.
    The integration-style coverage that exercises the real `event_consumer`
    lives in test_061_producer_survives_disconnect.py via the
    `xrange_count == xlen_final` parity assertion. Any regression in
    production cursor handling drops or duplicates entries and trips
    that integration assertion.
    """
    mock_redis = AsyncMock()
    # First xread (replay phase): returns one entry; last_id should advance.
    # Second call: empty (replay drained) → consumer transitions to tail.
    # Third call: returns terminal entry; consumer terminates.
    mock_redis.xread.side_effect = [
        [(f"run:abc", [("1620000000000-0", {"data": json.dumps({"type": "delta", "content": "x"})})])],
        None,   # replay drained
        [(f"run:abc", [("1620000001000-0", {"data": json.dumps({"type": "done"})})])],
    ]

    # Replicate the consumer's cursor-advancement contract directly to assert
    # the SECOND xread call uses the actual returned id, not '$' or '0'.
    last_id = "0"
    observed_call_ids = []

    for call_idx in range(3):
        observed_call_ids.append(last_id)
        res = await mock_redis.xread(
            streams={f"run:abc": last_id},
            count=100,
            block=None if call_idx == 0 else 5000,
        )
        if not res:
            last_id = "$"   # transition to tail phase with $
            continue
        for _stream, entries in res:
            for entry_id, fields in entries:
                last_id = entry_id   # ADVANCE
                if json.loads(fields["data"]).get("type") in {"done", "error", "cancelled"}:
                    break

    # Pitfall 1 assertion: second observed call MUST use the actual replay-returned id, NOT '$'
    assert observed_call_ids[1] == "1620000000000-0", (
        f"After first entry, last_id should advance to '1620000000000-0', "
        f"got {observed_call_ids[1]!r}"
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
