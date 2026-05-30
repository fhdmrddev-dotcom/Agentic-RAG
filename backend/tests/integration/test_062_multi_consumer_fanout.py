"""SC#4 — multi-consumer fan-out test.

Per RESEARCH Open Question 3 + Pitfall 7: tries the parallel-c.stream
pattern first (the truer end-to-end test). If it hangs in practice on
the same event loop, the executor SHOULD switch to the data-layer
fallback (one httpx consumer + one direct redis_client.xread consumer)
— see the comment block in the test body.

The plan does NOT ship the fallback by default; it's documented in case
the canonical pattern fails in CI or local runs.

Two parallel httpx.AsyncClient consumers of the SAME run_id (via
GET /runs/{rid}/stream?since=0) both receive identical event sequences
ending in a TERMINAL_TYPES sentinel — proving multi-consumer fan-out at
the API layer (SC#4). XREAD is non-destructive at the Redis layer, so
two consumers maintain independent read cursors against the same stream.

Threat refs:
  - T-062-04 (DoS via parallel-consumer connection exhaustion) — this
    test deliberately exercises the threat scenario at small scale to
    prove the fan-out works correctly. Production-scale rate-limiting
    is documented as accepted/deferred per Plan 02 threat_model + 062
    CONTEXT.md "Out of Scope".
"""
import asyncio
import json
import pytest
from unittest.mock import patch
from uuid import uuid4

import httpx
from httpx import ASGITransport

from app.api.threads import TERMINAL_TYPES
from app.dependencies import get_supabase
from app.main import app
from app.services.openai_service import CallingMode

from tests.integration._run_helpers import (
    _build_mock_supabase,
    _extract_run_id_from_mock,
    _slow_chunks,
    await_producer_finalized,
)
from tests.integration.test_059_disconnect import _reset_sse_starlette_app_status  # noqa: F401, E402

THREAD_A = str(uuid4())


@pytest.fixture(autouse=True)
def _reset_redis_singleton():
    """Reset app.dependencies._redis between tests — see test_062_stream_replay.py
    for full rationale (Pitfall 6 loop-binding trap).
    """
    import app.dependencies as _deps
    _deps._redis = None
    yield
    _deps._redis = None


async def _consume_stream(client: httpx.AsyncClient, run_id: str) -> list[str]:
    """Drain GET /runs/{rid}/stream?since=0 to natural close; return raw `data: ...` payloads.

    Each consumer maintains its OWN XREAD cursor inside the route handler's
    replay_tail_consumer instance — XREAD is non-destructive, so both
    consumers see the full sequence independently.
    """
    events: list[str] = []
    async with client.stream(
        "GET", f"/runs/{run_id}/stream?since=0",
        headers={"Authorization": "Bearer test-token"},
        timeout=30.0,
    ) as resp:
        assert resp.status_code == 200, \
            f"Expected 200; got {resp.status_code} body={await resp.aread()!r}"
        async for line in resp.aiter_lines():
            if line.startswith("data: "):
                events.append(line[6:])
    return events


@pytest.mark.asyncio
@pytest.mark.timeout(30)
async def test_two_consumers_receive_identical_sequences(redis_client):
    """SC#4: XREAD is non-destructive; two parallel consumers see identical sequences.

    Approach (per RESEARCH Open Question 3):
      - CANONICAL: parallel httpx.AsyncClient.stream via asyncio.gather. Both
        consumers run on the SAME event loop against the same ASGI app
        instance; the route handler spawns an independent
        replay_tail_consumer for each (D-062-05 + non-destructive XREAD).
      - FALLBACK (Pitfall 7 — same-loop trap): if the parallel c.stream
        pattern hangs in practice (e.g., one consumer's BLOCK 5000 starves
        the other's progress), switch to:
            * one httpx consumer (drives the route end-to-end) + one direct
              redis_client.xread loop (data-layer assertion).
            * Both compare the entries they each see; SC#4's claim is
              proven at the storage layer even when end-to-end hangs.

    This file SHIPS the canonical pattern. If a future run reports a hang,
    update this docstring + the pattern below to the fallback.
    """
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
            return_value=("T", None),
        ):
            # Step 1: POST → producer spins up.
            # Phase 063 D-063-01 rewrite: POST returns 201 + JSON envelope
            # synchronously; the producer task runs detached. We no longer
            # need to drain a single SSE chunk to "spawn" the producer —
            # the runs INSERT (and RUN_TASKS registration) is complete by
            # the time POST returns.
            async with httpx.AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as ac:
                resp = await ac.post(
                    f"/threads/{THREAD_A}/messages",
                    content=json.dumps({"content": "hello"}),
                    headers={"Authorization": "Bearer test-token",
                             "Content-Type": "application/json"},
                    timeout=30.0,
                )
                assert resp.status_code == 201, (
                    f"D-063-01: expected 201; got {resp.status_code} body={resp.text[:200]}"
                )

            # Step 2: extract the run_id from mock_supabase's runs INSERT
            run_id_str = _extract_run_id_from_mock(mock_supabase)

            # Phase 063 D-063-01 / Pitfall 4: POST returns synchronously
            # while the producer is still scheduling its first XADD. Give
            # the producer a small window to enter its body so each GET
            # stream consumer's replay phase has events to surface
            # (otherwise consumer 2's slower start may observe an empty
            # Redis key + runs.status='streaming' and synthesize
            # 'buffer_expired_while_streaming' instead of tailing).
            await asyncio.sleep(0.2)

            # Step 3: configure the runs SELECT mock so each consumer's
            # ownership SELECT in stream_run() returns a streaming row.
            runs_builder = mock_supabase.table("runs")
            runs_builder.execute.side_effect = lambda *a, **k: type("R", (), {
                "data": {"run_id": run_id_str, "status": "streaming",
                         "thread_id": THREAD_A, "error": None},
                "count": None,
            })()

            # Step 4: spin up TWO independent consumers via asyncio.gather.
            # Each AsyncClient creates its own ASGI request scope; the route
            # handler instantiates a fresh replay_tail_consumer per request.
            async with httpx.AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as c1, httpx.AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as c2:
                events1, events2 = await asyncio.gather(
                    _consume_stream(c1, run_id_str),
                    _consume_stream(c2, run_id_str),
                )

            # Step 5: producer finalizes (D-061.1-01 keystone)
            await await_producer_finalized(mock_supabase)

        # ── SC#4 assertions ────────────────────────────────────────────
        assert events1, "Consumer 1 received no events"
        assert events2, "Consumer 2 received no events"

        # Both consumers must end with a TERMINAL_TYPES type
        last1 = json.loads(events1[-1])
        last2 = json.loads(events2[-1])
        assert last1["type"] in TERMINAL_TYPES, \
            f"c1 last event type {last1['type']!r} not in TERMINAL_TYPES; events1[-3:]={events1[-3:]}"
        assert last2["type"] in TERMINAL_TYPES, \
            f"c2 last event type {last2['type']!r} not in TERMINAL_TYPES; events2[-3:]={events2[-3:]}"

        # Multi-consumer fan-out: identical sequences (the SC#4 contract).
        # If this fails, two consumers diverged → XREAD is consuming entries
        # destructively (which would be a Redis Streams misconfiguration, not
        # a 062 bug — XREAD is documented non-destructive) OR the route
        # handler instantiated a shared cursor across requests (a real bug).
        assert events1 == events2, (
            f"Multi-consumer divergence: c1 has {len(events1)} events, "
            f"c2 has {len(events2)} events. First diff at index "
            f"{next((i for i, (a, b) in enumerate(zip(events1, events2)) if a != b), 'N/A')}. "
            f"c1[-3:]={events1[-3:]}, c2[-3:]={events2[-3:]}"
        )
    finally:
        app.dependency_overrides.pop(get_supabase, None)
