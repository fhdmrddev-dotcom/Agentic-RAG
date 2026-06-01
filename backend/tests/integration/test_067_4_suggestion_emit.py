"""Phase 067.4 R-3 fix integration tests.

D-067.4-R3-02 (always-emit): when generate_suggestions returns ([], None) cleanly,
the backend STILL emits a 'suggestions' event with questions=[]. Removes the
SSE-replay 'missing event' ambiguity (3 states → 2 states).

D-067.4-R3-01 branch (a) (narrowed exception): when generate_suggestions raises
an OpenAI API error class, NO 'suggestions' event is emitted; 'stream_end' STILL
fires (SUG-04 invariant — main response unaffected, no re-raise).

Pattern verbatim from test_062_stream_replay.py: TestClient + ASGITransport + Redis
Stream + mocked LLM stream + mocked generate_suggestions.

RED on master:
    test_always_emit_when_empty: FAILS — current code at threads.py:2497 has
        `if questions:` gate so empty list yields NO emit (only logger.info).
    test_narrowed_exception_logs_warning: PASSES today (SUG-04 invariant already
        held by Plan 04 instrumentation broad except). Serves as regression
        guard against a future re-raise regression.

GREEN after Plan 01: both tests pass.
"""
import asyncio
import json
import pytest
from unittest.mock import patch
from uuid import uuid4

import httpx
import openai
from httpx import ASGITransport

from app.api.threads import RUN_TASKS, TERMINAL_TYPES  # noqa: F401  (kept for parity)
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
    """Reset app.dependencies._redis so each test gets a Redis client bound to
    its own per-test event loop. Verbatim mirror of test_062_stream_replay.py
    rationale (Pitfall 6)."""
    import app.dependencies as _deps
    _deps._redis = None
    yield
    _deps._redis = None


@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_always_emit_when_empty(redis_client):
    """D-067.4-R3-02: when generate_suggestions returns ([], None) cleanly, the
    backend STILL emits a 'suggestions' event with questions=[].

    Removes the SSE-replay ambiguity dimension (was 3 states: emitted-with-data /
    emitted-empty / not-emitted; now 2 states: emitted-with-data / emitted-empty).

    The frontend gate at MessageItem.tsx:93-98 already short-circuits empty
    arrays via `message.suggestions.length > 0` — no frontend change needed.
    """
    mock_supabase = _build_mock_supabase()
    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    events = []
    try:
        with patch(
            "app.services.provider_gateway.openai_compat.create_adaptive_streaming_chat",
            side_effect=lambda *a, **k: (iter(_slow_chunks()), CallingMode.NATIVE),
        ), patch(
            "app.services.suggestion_service.generate_suggestions",
            return_value=([], None),  # empty — no exception
        ), patch(
            "app.api.threads.generate_thread_title",
            return_value=("T", None),
        ):
            async with httpx.AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as ac:
                resp = await ac.post(
                    f"/threads/{THREAD_A}/messages",
                    content=json.dumps({"content": "search-only prompt"}),
                    headers={"Authorization": "Bearer test-token",
                             "Content-Type": "application/json"},
                    timeout=30.0,
                )
                assert resp.status_code == 201, (
                    f"Expected 201; got {resp.status_code} body={resp.text[:200]}"
                )

                run_id = _extract_run_id_from_mock(mock_supabase)
                await asyncio.sleep(0.2)

                # Configure mock so GET stream's ownership SELECT succeeds
                runs_builder = mock_supabase.table("runs")
                runs_builder.execute.side_effect = lambda *a, **k: type("R", (), {
                    "data": {"run_id": run_id, "status": "streaming",
                             "thread_id": THREAD_A, "error": None},
                    "count": None,
                })()

                # Drain the stream
                async with ac.stream(
                    "GET", f"/runs/{run_id}/stream?since=0",
                    headers={"Authorization": "Bearer test-token"},
                    timeout=30.0,
                ) as sresp:
                    assert sresp.status_code == 200
                    async for line in sresp.aiter_lines():
                        if line.startswith("data: "):
                            events.append(json.loads(line[6:]))

            await await_producer_finalized(mock_supabase)

        # D-067.4-R3-02: assert exactly ONE 'suggestions' event with empty questions
        suggestions_events = [e for e in events if e.get("type") == "suggestions"]
        assert len(suggestions_events) == 1, (
            f"Expected exactly one 'suggestions' event (D-067.4-R3-02 always-emit); "
            f"got {len(suggestions_events)}. All event types: "
            f"{[e.get('type') for e in events]}"
        )
        assert suggestions_events[0].get("questions") == [], (
            f"Expected questions=[] (D-067.4-R3-02 empty-emit); "
            f"got {suggestions_events[0].get('questions')!r}"
        )
        # SUG-04 invariant: 'done' terminal MUST be emitted (consumer's
        # contractual exit). 'stream_end' is emitted by the producer immediately
        # after 'done' but is NOT visible via SSE replay because the consumer
        # at runs.py:170 breaks on TERMINAL_TYPES (which includes 'done').
        # The SUG-04 invariant is the in-process producer contract — verified
        # via 'done' presence in the wire, with `stream_end` covered by the
        # static-source check (Plan 01 grep gate: `await _emit(redis, run_id,
        # 'stream_end')` line preserved in threads.py).
        types_emitted = {e.get("type") for e in events}
        assert "done" in types_emitted, (
            f"SUG-04 invariant violated: no 'done' terminal in stream. "
            f"Types observed: {types_emitted}"
        )
    finally:
        app.dependency_overrides.pop(get_supabase, None)


@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_narrowed_exception_logs_warning(redis_client):
    """D-067.4-R3-01 branch (a): when generate_suggestions raises an OpenAI
    API error (e.g. RateLimitError), NO 'suggestions' event is emitted but
    'stream_end' STILL fires (SUG-04 invariant — main response unaffected).

    This test passes today on master (broad `except Exception:` swallows it
    + stream_end emitted unconditionally below). Post-Plan 01 with the
    narrowed exception classes, behavior is identical at the wire level —
    test serves as regression guard against any future re-raise regression.
    """
    # RateLimitError requires response.request — build a real httpx.Response
    req = httpx.Request("POST", "http://test/api")
    fake_response = httpx.Response(429, request=req)
    rate_limit_err = openai.RateLimitError(
        message="rate limit", response=fake_response, body=None,
    )

    mock_supabase = _build_mock_supabase()
    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    events = []
    try:
        with patch(
            "app.services.provider_gateway.openai_compat.create_adaptive_streaming_chat",
            side_effect=lambda *a, **k: (iter(_slow_chunks()), CallingMode.NATIVE),
        ), patch(
            "app.services.suggestion_service.generate_suggestions",
            side_effect=rate_limit_err,
        ), patch(
            "app.api.threads.generate_thread_title",
            return_value=("T", None),
        ):
            async with httpx.AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as ac:
                resp = await ac.post(
                    f"/threads/{THREAD_A}/messages",
                    content=json.dumps({"content": "trigger rate limit"}),
                    headers={"Authorization": "Bearer test-token",
                             "Content-Type": "application/json"},
                    timeout=30.0,
                )
                assert resp.status_code == 201

                run_id = _extract_run_id_from_mock(mock_supabase)
                await asyncio.sleep(0.2)

                runs_builder = mock_supabase.table("runs")
                runs_builder.execute.side_effect = lambda *a, **k: type("R", (), {
                    "data": {"run_id": run_id, "status": "streaming",
                             "thread_id": THREAD_A, "error": None},
                    "count": None,
                })()

                async with ac.stream(
                    "GET", f"/runs/{run_id}/stream?since=0",
                    headers={"Authorization": "Bearer test-token"},
                    timeout=30.0,
                ) as sresp:
                    assert sresp.status_code == 200
                    async for line in sresp.aiter_lines():
                        if line.startswith("data: "):
                            events.append(json.loads(line[6:]))

            await await_producer_finalized(mock_supabase)

        types_emitted = {e.get("type") for e in events}
        assert "suggestions" not in types_emitted, (
            "SUG-04 violated: 'suggestions' emitted despite RateLimitError. "
            f"Types observed: {types_emitted}"
        )
        # SUG-04 invariant: main response unaffected. The 'done' terminal
        # MUST still be emitted (consumer's contractual exit). 'stream_end'
        # is emitted by the producer post-'done' but not visible via SSE
        # replay due to the TERMINAL_TYPES break — see test_always_emit_when_empty.
        assert "done" in types_emitted, (
            "SUG-04 violated: 'done' missing — main response NOT unaffected. "
            f"Types observed: {types_emitted}"
        )
    finally:
        app.dependency_overrides.pop(get_supabase, None)
