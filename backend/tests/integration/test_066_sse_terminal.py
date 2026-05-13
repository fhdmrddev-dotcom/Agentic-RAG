"""Phase 066 SC#5: SSE consumer receives a distinct `timed_out` terminal sentinel.

Wire format from D-066-06: TERMINAL_TYPES adds 'timed_out'; consumer breaks
on any TERMINAL_TYPES entry. The sentinel data shape is
{"type": "timed_out", "error": "<formatted string>"} — distinct from
{"type": "error", ...} (real failure) and {"type": "cancelled", ...} (user-Stop).
"""
import json
import time
from unittest.mock import patch
from uuid import uuid4

import httpx
import pytest

from app.dependencies import get_supabase
from app.main import app
from app.services.openai_service import CallingMode

from tests.integration._run_helpers import (  # noqa: E402
    _build_mock_supabase,
    _make_done_chunk,
    _make_sse_chunk,
    _extract_run_id_from_mock,
    await_producer_finalized,
)
from tests.integration.test_059_disconnect import (  # noqa: F401, E402
    _reset_sse_starlette_app_status,
)

THREAD_A = str(uuid4())


def _stalling_chunks():
    time.sleep(5.0)
    yield _make_sse_chunk("never ")
    yield _make_done_chunk()


@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_consumer_receives_timed_out_sentinel(redis_client, monkeypatch):
    """SC#5: Redis Stream contains a {type:'timed_out'} terminal entry — distinct from error/cancelled."""
    import app.config as _app_config
    monkeypatch.setattr(_app_config, "get_per_call_timeout", lambda *a, **k: 1)

    mock_supabase = _build_mock_supabase()
    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    try:
        with patch(
            "app.api.threads.create_adaptive_streaming_chat",
            side_effect=lambda *a, **k: (iter(_stalling_chunks()), CallingMode.NATIVE),
        ), patch(
            "app.services.suggestion_service.generate_suggestions",
            return_value=([], None),
        ), patch(
            "app.api.threads.generate_thread_title",
            return_value=("T", None),
        ):
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as c:
                async with c.stream(
                    "POST",
                    f"/threads/{THREAD_A}/messages",
                    json={"content": "hello"},
                    headers={"Authorization": "Bearer test-token"},
                    timeout=30.0,
                ) as r:
                    async for _line in r.aiter_lines():
                        pass
            await await_producer_finalized(mock_supabase)

            run_id = _extract_run_id_from_mock(mock_supabase)
            stream_key = f"run:{run_id}"

            entries = await redis_client.xrange(stream_key)
            decoded = [json.loads(e[1]["data"]) for e in entries]
            timed_out_sentinels = [d for d in decoded if d.get("type") == "timed_out"]
            assert timed_out_sentinels, (
                f"Expected at least one terminal sentinel with type='timed_out'; "
                f"all events: {decoded}"
            )

            # The error payload (if present) starts with 'timed_out:' prefix
            payload = timed_out_sentinels[0]
            if payload.get("error"):
                assert payload["error"].startswith("timed_out:"), (
                    f"timed_out sentinel error must start with 'timed_out:' prefix per D-066-07; "
                    f"got: {payload['error']!r}"
                )
    finally:
        app.dependency_overrides.pop(get_supabase, None)


@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_timed_out_sentinel_distinct_from_error_and_cancelled(redis_client, monkeypatch):
    """SC#5 negation: the timed_out sentinel does NOT also emit type='cancelled' terminal.

    Note on type='error': during the timed_out path, the broad inner Exception
    handler (Plan 04 Rule 1 fix) flushes a friendly `error` SSE event BEFORE
    re-raising to the outer classifier. This is by design (consumers see a
    user-friendly message). The KEY contract is that the TERMINAL sentinel
    (the last entry in the stream that closes consumers) is type='timed_out',
    not type='error' or type='cancelled'. _emit_terminal exempts the terminal
    entry from MAXLEN trimming (Pitfall 5), so the terminal sentinel is
    deterministically the LAST entry.
    """
    import app.config as _app_config
    monkeypatch.setattr(_app_config, "get_per_call_timeout", lambda *a, **k: 1)

    mock_supabase = _build_mock_supabase()
    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    try:
        with patch(
            "app.api.threads.create_adaptive_streaming_chat",
            side_effect=lambda *a, **k: (iter(_stalling_chunks()), CallingMode.NATIVE),
        ), patch(
            "app.services.suggestion_service.generate_suggestions",
            return_value=([], None),
        ), patch(
            "app.api.threads.generate_thread_title",
            return_value=("T", None),
        ):
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as c:
                async with c.stream(
                    "POST",
                    f"/threads/{THREAD_A}/messages",
                    json={"content": "hello"},
                    headers={"Authorization": "Bearer test-token"},
                    timeout=30.0,
                ) as r:
                    async for _line in r.aiter_lines():
                        pass
            await await_producer_finalized(mock_supabase)

            run_id = _extract_run_id_from_mock(mock_supabase)
            stream_key = f"run:{run_id}"

            entries = await redis_client.xrange(stream_key)
            decoded = [json.loads(e[1]["data"]) for e in entries]

            # Find TERMINAL sentinel — must be the last entry whose type is in
            # the production TERMINAL_TYPES (done/error/cancelled/timed_out).
            from app.api.threads import TERMINAL_TYPES
            terminal_entries = [d for d in decoded if d.get("type") in TERMINAL_TYPES]
            assert terminal_entries, (
                f"Expected at least one terminal sentinel; got events: {decoded}"
            )
            # Terminal sentinel must be 'timed_out' on the per-call timeout path.
            assert terminal_entries[-1]["type"] == "timed_out", (
                f"D-066-06 partition violation: terminal sentinel type "
                f"should be 'timed_out' on per-call timer path; "
                f"got terminal_entries={terminal_entries}"
            )
            # Cancelled sentinel must NOT appear on the timer path.
            cancelled_terminals = [
                d for d in terminal_entries if d.get("type") == "cancelled"
            ]
            assert not cancelled_terminals, (
                f"timed_out path MUST NOT emit a cancelled terminal sentinel; "
                f"got: {cancelled_terminals}"
            )
    finally:
        app.dependency_overrides.pop(get_supabase, None)
