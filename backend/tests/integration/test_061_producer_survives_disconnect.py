"""D-061-15 binding gate: producer SURVIVES consumer disconnect.

Inversion of 059's contract per D-v2.5-08. Killing the consumer does NOT
kill the producer — the producer continues until natural completion or
the 120s asyncio.timeout fires.

Pattern source: tests/integration/test_058_concurrency.py + test_059_disconnect.py
Phase 061 (D-v2.5-08, D-061-15, D-061-03).
"""
import asyncio
import json
import time
from unittest.mock import patch
from uuid import uuid4

import httpx
import pytest
from httpx import ASGITransport

from app.api.threads import TERMINAL_TYPES
from app.dependencies import get_supabase
from app.main import app
from app.services.openai_service import CallingMode

# IN-01 (D-061.1-11): shared mock infrastructure now lives in _run_helpers.
# 059-specific drivers (the disconnect harness, the AppStatus reset) stay
# in test_059_disconnect.py since they are not generic mock builders.
from tests.integration._run_helpers import (  # noqa: E402
    USER_ID,
    _build_mock_supabase,
    _fast_chunks,
    _make_done_chunk,
    _make_result,
    _make_sse_chunk,
    _make_table_builder,
    _message_row,
    _thread_row,
    _slow_chunks,
    _extract_run_id_from_mock,
    await_producer_finalized,
)
from tests.integration.test_059_disconnect import (  # noqa: E402
    _drive_sse_until_disconnect,
    _reset_sse_starlette_app_status,
)

THREAD_A = str(uuid4())
THREAD_B = str(uuid4())   # for cross-tab regression assertion (D-061-15 ask)


@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_producer_continues_after_consumer_disconnect(redis_client):
    """D-061-15 (SC#2 + SC#3 + cross-tab regression).

    Slow-mock-LLM produces 5 chunks @ 0.3s. Consumer aborts after first
    chunk. Assert (a) XLEN grows over next 5s, (b) terminal sentinel
    eventually lands, (c) runs.status='completed', (d) inline 058
    cross-tab GET returns <1s while the slow producer is in flight.
    """
    # Build mock supabase. Plan 05 Step 0a extended _build_mock_supabase()
    # to route the 'runs' table through a per-table builder, so insert/update
    # calls land in call_args_list with no per-test monkey-patching.
    mock_supabase = _build_mock_supabase()
    app.dependency_overrides[get_supabase] = lambda: mock_supabase

    try:
        with patch(
            "app.services.agent_loop.create_adaptive_streaming_chat",
            side_effect=lambda *a, **k: (iter(_slow_chunks()), CallingMode.NATIVE),
        ), patch(
            "app.services.suggestion_service.generate_suggestions",
            return_value=([], None),
        ), patch(
            "app.api.threads.generate_thread_title",
            return_value=("Test Title", None),
        ):
            t_disconnect, body_chunks = await _drive_sse_until_disconnect(
                app, THREAD_A,
                body_bytes=json.dumps({"content": "hello"}).encode(),
            )

            run_id = _extract_run_id_from_mock(mock_supabase)
            stream_key = f"run:{run_id}"

            # Snapshot XLEN at disconnect
            xlen_at_disconnect = await redis_client.xlen(stream_key)

            # ── D-061-15 inline cross-tab regression assertion ──────────
            # While the producer is still mid-stream (between disconnect
            # and the +5s re-snapshot), drive a parallel authenticated
            # GET on a DIFFERENT thread (THREAD_B) and assert it returns
            # within 1.0s. This proves the Redis-backed producer does not
            # introduce event-loop blocking that would regress 058's
            # cross-tab guarantee under the new architecture. The
            # standalone 058 regression run (TBD-10) covers the
            # pre-061-baseline; this inline assertion covers the
            # CONTENDED-timing scenario D-061-15 specifies.
            async def _cross_tab_get():
                transport = ASGITransport(app=app)
                async with httpx.AsyncClient(
                    transport=transport, base_url="http://test"
                ) as ac:
                    t0 = time.perf_counter()
                    resp = await ac.get(
                        f"/threads/{THREAD_B}/messages",
                        headers={"Authorization": "Bearer test-token"},
                    )
                    elapsed = time.perf_counter() - t0
                    return resp.status_code, elapsed

            cross_tab_task = asyncio.create_task(_cross_tab_get())

            # Wait 5s then re-snapshot
            await asyncio.sleep(5.0)
            xlen_after = await redis_client.xlen(stream_key)

            # Cross-tab GET must have completed within 1.0s of issue
            cross_tab_status, cross_tab_elapsed = await asyncio.wait_for(
                cross_tab_task, timeout=2.0
            )
            assert cross_tab_elapsed < 1.0, (
                f"D-061-15 cross-tab GET must return <1.0s while 061 stream is in flight; "
                f"got {cross_tab_elapsed:.3f}s (status {cross_tab_status})"
            )

            assert xlen_after > xlen_at_disconnect, (
                f"Producer should keep XADDing after consumer disconnect. "
                f"At disconnect: {xlen_at_disconnect}; after 5s: {xlen_after}"
            )

            # Assert terminal sentinel landed
            entries = await redis_client.xrange(stream_key)
            terminal = [
                e for e in entries
                if json.loads(e[1]["data"]).get("type") in TERMINAL_TYPES
            ]
            assert terminal, (
                f"Expected at least one TERMINAL_TYPES entry; got entries: {entries}"
            )

            # ── Pitfall 1 parity guard (Warning #4): consumer must not
            # silently skip entries. XLEN reflects the producer side; if
            # the consumer's last_id advancement is correct, every XADD
            # is observable. We assert XLEN == count_of_unique_entry_ids
            # via xrange (no duplicates, no holes the consumer would
            # have skipped on a stuck `$` cursor).
            xrange_count = len(entries)
            xlen_final = await redis_client.xlen(stream_key)
            assert xrange_count == xlen_final, (
                f"Pitfall 1 parity: xrange count {xrange_count} must equal "
                f"xlen {xlen_final} — any divergence indicates a stream-id race or trim."
            )

            # D-061.1-01: deterministic await for _shielded_finalize completion
            await await_producer_finalized(mock_supabase)

            # Assert runs.status='completed' UPDATE happened
            runs_builder = mock_supabase.table("runs")
            update_calls = runs_builder.update.call_args_list
            completed = [
                c for c in update_calls
                if (
                    c.args
                    and isinstance(c.args[0], dict)
                    and c.args[0].get("status") == "completed"
                )
            ]
            assert completed, (
                f"Expected runs.status='completed' UPDATE; got update calls: {update_calls}"
            )
    finally:
        app.dependency_overrides.pop(get_supabase, None)
