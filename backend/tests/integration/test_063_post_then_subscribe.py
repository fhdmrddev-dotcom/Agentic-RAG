"""D-063-01 roundtrip: POST returns JSON {message_id, run_id}, then GET
/runs/{run_id}/stream?since=0 drains until any TERMINAL_TYPES event.

Phase 063 Plan 01 (Wave 0). End-to-end regression guard combining:
  - Phase 063 new POST contract (returns JSON, NOT SSE)
  - Phase 062 GET /runs/{rid}/stream replay-and-tail consumer

Pattern source: backend/tests/integration/test_062_stream_replay.py:54-100
(producer-drive-via-POST + GET stream pattern). The 062 form opens
``ac.stream("POST", ...)`` because the legacy POST returned SSE; this 063
form opens a plain ``ac.post(...)`` and reads ``run_id`` from the JSON
body, then opens GET stream against /runs/{rid}/stream?since=0.

This file uses real Redis (the ``redis_client`` fixture from 061
conftest) so we exercise the actual XADD/XREAD path used by replay-tail.
The ``_reset_redis_singleton`` autouse fixture is copied verbatim from
test_062_stream_replay.py:36-51 (D-062-14 / Phase 062 Plan 02 deviation
Rule 3) — required because pytest-asyncio function-scope creates a fresh
loop per test, and the cached singleton would otherwise be invoked
against a closed loop with ``RuntimeError: Event loop is closed``.

RED reason at this commit: POST currently returns SSE not JSON, so
``resp.json()`` raises (or the status is wrong) — RED for contract
mismatch, not import/collection error.
"""
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

from tests.integration._run_helpers import _build_mock_supabase, _slow_chunks
from tests.integration.test_059_disconnect import _reset_sse_starlette_app_status  # noqa: F401, E402

THREAD_A = str(uuid4())


@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_post_then_get_stream_renders_full_response(redis_client):
    """D-063-01: POST returns JSON envelope; GET /runs/{rid}/stream?since=0
    drains delta+terminal events.

    Steps:
      1. POST /threads/{tid}/messages → expect 201 JSON {message_id, run_id}.
      2. Read run_id from resp.json()["run_id"].
      3. Open GET /runs/{run_id}/stream?since=0 — drain until any
         TERMINAL_TYPES event arrives.
      4. Assert at least one delta event seen AND last event is terminal.

    Patches mirror test_062_stream_replay.py exactly:
      - app.api.threads.create_adaptive_streaming_chat → slow chunks
      - app.services.suggestion_service.generate_suggestions → no-op
      - app.api.threads.generate_thread_title → fixed title
    """
    mock_supabase = _build_mock_supabase()
    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    try:
        with patch(
            "app.api.threads.create_adaptive_streaming_chat",
            side_effect=lambda *a, **k: (iter(_slow_chunks()), CallingMode.NATIVE),
        ), patch(
            "app.services.suggestion_service.generate_suggestions",
            return_value=([], None),
        ), patch(
            "app.api.threads.generate_thread_title",
            return_value=("T", None),
        ):
            async with httpx.AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as ac:
                # Step 1 (063 form): POST returns JSON, not SSE.
                resp = await ac.post(
                    f"/threads/{THREAD_A}/messages",
                    headers={"Authorization": "Bearer test-token"},
                    json={"content": "hello", "agent_mode": "default"},
                )
                assert resp.status_code == 201, (
                    f"D-063-01: expected 201 JSON envelope; got "
                    f"{resp.status_code}, content-type="
                    f"{resp.headers.get('content-type')!r}, body={resp.text[:200]}"
                )

                # Anti-false-RED guard: response must be JSON, NOT SSE.
                ctype = resp.headers.get("content-type", "")
                assert ctype.startswith("application/json"), (
                    f"Expected JSON content-type, got {ctype!r}"
                )

                body = resp.json()
                assert "run_id" in body, (
                    f"Expected run_id in response body; got {body!r}"
                )
                run_id = body["run_id"]

                # Phase 063 D-063-01 / Pitfall 4: POST returns synchronously
                # while the producer is still scheduling its first XADD.
                # Give the producer a small window to emit at least one
                # event before the GET stream opens — otherwise the consumer
                # may observe an empty Redis key + runs.status='streaming'
                # and synthesize 'buffer_expired_while_streaming' instead of
                # tailing actual deltas.
                import asyncio as _asyncio_inner
                await _asyncio_inner.sleep(0.2)

                # Step 3: configure mock so GET stream's ownership SELECT
                # succeeds (mirrors test_062_stream_replay.py:94-99).
                runs_builder = mock_supabase.table("runs")
                runs_builder.execute.side_effect = lambda *a, **k: type("R", (), {
                    "data": {"run_id": run_id, "status": "streaming",
                             "thread_id": THREAD_A, "error": None},
                    "count": None,
                })()

                # Step 4: GET /runs/{rid}/stream?since=0 — drain to terminal.
                events = []
                async with ac.stream(
                    "GET", f"/runs/{run_id}/stream?since=0",
                    headers={"Authorization": "Bearer test-token"},
                    timeout=30.0,
                ) as stream_resp:
                    assert stream_resp.status_code == 200, (
                        f"GET /runs/{{rid}}/stream expected 200; got "
                        f"{stream_resp.status_code}"
                    )
                    async for line in stream_resp.aiter_lines():
                        if line.startswith("data: "):
                            payload = json.loads(line[6:])
                            events.append(payload)
                            if payload.get("type") in TERMINAL_TYPES:
                                break

        # Assertions: replay produced at least one delta + terminated cleanly.
        assert any(e.get("type") == "delta" for e in events), (
            f"Expected at least one delta event; got types="
            f"{[e.get('type') for e in events]}"
        )
        assert events and events[-1].get("type") in TERMINAL_TYPES, (
            f"Expected last event in TERMINAL_TYPES={TERMINAL_TYPES}; "
            f"got events={events[-3:] if events else events!r}"
        )
    finally:
        app.dependency_overrides.pop(get_supabase, None)
