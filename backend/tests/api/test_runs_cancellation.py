"""D-067-04 — runs.py xread cancellation differentiation tests.

Phase 067 BLK-2 closure: asserts the post-Plan-03 behavior at the three
xread call sites in `replay_tail_consumer`:

Test 1 (asyncio.CancelledError path):
  - monkey-patch xread to raise CancelledError
  - assert INFO log record present
  - assert no "Traceback" substring in any log record
  - assert CancelledError is re-raised (Phase 059 D-059-04 cooperative
    cancellation invariant)

Test 2 (RedisTimeoutError path — the cancellation-equivalent):
  - monkey-patch xread to raise redis.exceptions.TimeoutError
  - assert INFO log record contains the canonical substring
    "consumer disconnected; xread cancellation-equivalent"
  - assert no "Traceback" substring
  - assert a sentinel SSE error event is yielded (not propagated as 503)

Test 3 (genuine RedisError keeps traceback):
  - monkey-patch xread to raise redis.exceptions.ConnectionError
  - assert ERROR-level log record present (logger.exception)
  - assert exc_info is non-None on the error record (full traceback intact)

Verifies:
  - Phase 059 D-059-04 cooperative cancellation contract.
  - D-067-04 INFO-not-traceback differentiation.
  - No regression to genuine-failure traceback diagnostics.

Note on signature: the actual replay_tail_consumer signature is
`(redis, run_id, since, settings)` — four positional args, redis FIRST,
settings FOURTH (per backend/app/api/runs.py:76). The plan's call notes
loosely described `(run_id, since, redis)` but explicitly authorized the
executor (Rule 3) to adapt to the actual signature. We pass a SimpleNamespace
settings stub with a generous consumer_timeout_seconds so the deadline
guard doesn't fire mid-test.
"""
import asyncio
import json
import logging
from types import SimpleNamespace
from unittest.mock import MagicMock, AsyncMock
from uuid import uuid4

import pytest
import redis.exceptions

from app.api.runs import replay_tail_consumer


CANONICAL_INFO_SUBSTRING = "consumer disconnected; xread cancellation-equivalent"


def _build_redis_mock(xread_side_effect):
    """Build a Mock redis client whose xread raises the supplied exception.

    Other methods (`exists`) are stubbed to return True so the post-BLOCK
    probe path does not conflate with the xread error.
    """
    client = MagicMock()
    client.xread = AsyncMock(side_effect=xread_side_effect)
    client.exists = AsyncMock(return_value=True)
    return client


def _build_settings_stub():
    """SimpleNamespace stub for the settings positional arg.

    replay_tail_consumer reads only `settings.consumer_timeout_seconds`
    (used to compute the deadline). 600s is well above the test timeout
    so the deadline guard never fires before the xread side_effect does.
    """
    return SimpleNamespace(consumer_timeout_seconds=600)


@pytest.mark.asyncio
@pytest.mark.timeout(10)
async def test_xread_cancellation_logs_info_no_traceback(caplog):
    """D-067-04 / Phase 059 D-059-04: CancelledError on xread → INFO log,
    no traceback, re-raised cooperatively.
    """
    run_id = uuid4()
    client = _build_redis_mock(asyncio.CancelledError())
    settings_stub = _build_settings_stub()

    # runs.py uses `logger = logging.getLogger(__name__)`. Set caplog level
    # at the module logger so we capture INFO and above for that module.
    caplog.set_level(logging.INFO, logger="app.api.runs")

    gen = replay_tail_consumer(client, run_id, "0", settings_stub)

    with pytest.raises(asyncio.CancelledError):
        async for _ in gen:
            pass

    # Phase 059 D-059-04: at least one INFO record (the cooperative
    # cancellation log line in runs.py).
    info_records = [r for r in caplog.records if r.levelno == logging.INFO]
    assert len(info_records) >= 1, (
        f"Expected at least one INFO record on CancelledError; got "
        f"{[(r.levelname, r.message) for r in caplog.records]!r}"
    )

    # D-067-04: no traceback rendered. logger.info() does NOT emit traceback
    # metadata (exc_info is None on level=INFO calls in runs.py).
    for r in caplog.records:
        text = r.getMessage()
        assert "Traceback" not in text, (
            f"D-067-04 violation: 'Traceback' substring found in record "
            f"{r.levelname}: {text!r}"
        )
        if r.levelno == logging.INFO:
            assert r.exc_info is None, (
                f"D-067-04 violation: INFO record carries exc_info: {r.message!r}"
            )


@pytest.mark.asyncio
@pytest.mark.timeout(10)
async def test_xread_redis_timeout_logs_info_no_traceback(caplog):
    """D-067-04: RedisTimeoutError (redis-py async_timeout wrapper conversion)
    on xread → INFO log with canonical substring, no traceback, sentinel SSE
    error event yielded (NOT a 503).
    """
    run_id = uuid4()
    client = _build_redis_mock(redis.exceptions.TimeoutError("socket timeout (test)"))
    settings_stub = _build_settings_stub()

    caplog.set_level(logging.INFO, logger="app.api.runs")

    gen = replay_tail_consumer(client, run_id, "0", settings_stub)

    # Drive the generator and capture all yielded SSE events.
    yielded = []
    async for event in gen:
        yielded.append(event)

    # D-067-04: canonical INFO substring present (this MUST match the
    # substring used in Plan 03 Task 2 INFO log calls).
    info_messages = [r.getMessage() for r in caplog.records if r.levelno == logging.INFO]
    assert any(CANONICAL_INFO_SUBSTRING in m for m in info_messages), (
        f"Expected INFO record containing {CANONICAL_INFO_SUBSTRING!r}; "
        f"got {info_messages!r}"
    )

    # D-067-04: no traceback rendered (logger.info, not .exception).
    for r in caplog.records:
        text = r.getMessage()
        assert "Traceback" not in text, (
            f"D-067-04 violation: 'Traceback' in record {r.levelname}: {text!r}"
        )
        if r.levelno == logging.INFO:
            assert r.exc_info is None, (
                f"D-067-04 violation: INFO record carries exc_info: {r.message!r}"
            )

    # Sentinel SSE error event yielded (replay phase site #1 yields
    # `redis_timeout`; tail phase yields the same; site #3 falls through
    # without yielding). This test exercises the replay phase (first xread
    # call), so we expect AT LEAST one event whose JSON body has
    # `type: "error"`.
    assert len(yielded) >= 1, (
        "Expected at least one yielded SSE event on RedisTimeoutError "
        "(replay phase yields a sentinel before returning)."
    )
    first_event = yielded[0]
    body = json.loads(first_event["data"])
    assert body.get("type") == "error", (
        f"Expected first yielded event to be type:error sentinel; got {body!r}"
    )


@pytest.mark.asyncio
@pytest.mark.timeout(10)
async def test_xread_genuine_redis_error_keeps_traceback(caplog):
    """D-067-04 (regression guard): genuine RedisError (e.g. ConnectionError
    from cluster failover) STILL produces full traceback at ERROR level —
    only the narrow RedisTimeoutError clause is downgraded to INFO.
    """
    run_id = uuid4()
    # ConnectionError is a RedisError subclass that is NOT TimeoutError.
    # This is the canonical "cluster failover / OOM / connection reset" case.
    client = _build_redis_mock(
        redis.exceptions.ConnectionError("simulated cluster failover")
    )
    settings_stub = _build_settings_stub()

    caplog.set_level(logging.DEBUG, logger="app.api.runs")

    gen = replay_tail_consumer(client, run_id, "0", settings_stub)

    # Drive the generator. The except RedisError clause yields a sentinel
    # error event and returns; no exception propagates to the caller.
    yielded = []
    async for event in gen:
        yielded.append(event)

    # D-067-04 regression guard: ERROR-level record present (logger.exception
    # emits at ERROR with exc_info set).
    error_records = [r for r in caplog.records if r.levelno >= logging.ERROR]
    assert len(error_records) >= 1, (
        f"Expected at least one ERROR record on genuine RedisError; "
        f"got {[(r.levelname, r.message) for r in caplog.records]!r}"
    )

    # Full traceback intact: at least one ERROR record carries exc_info
    # (logger.exception sets exc_info to the active exception tuple). When
    # exc_info is set, log handlers render the traceback — this is what we
    # are asserting NOT regressed.
    records_with_exc = [r for r in error_records if r.exc_info is not None]
    assert len(records_with_exc) >= 1, (
        f"Expected at least one ERROR record with exc_info set "
        f"(traceback intact); got exc_info={[r.exc_info for r in error_records]!r}"
    )
