"""D-063-01: POST /threads/{thread_id}/messages contract — Wave-0 RED stubs.

Phase 063 Plan 01 (Wave 0 — D-063-01 contract surface).

These two tests bind the new POST contract:

  POST /threads/{thread_id}/messages
  Returns: HTTP 201 application/json
  Body:    {"message_id": "<user_message_uuid>", "run_id": "<run_uuid>"}

against current master, where ``send_message`` still returns
``EventSourceResponse(event_consumer(...))`` per the legacy SSE-on-POST
shape — so both tests RED-fail at this commit. Plan 02 makes them GREEN
by deleting ``event_consumer`` (threads.py:331-426) and replacing the
``EventSourceResponse`` return at threads.py:2241-2244 with a
``JSONResponse(status_code=201, content={"message_id", "run_id"})``.

Pattern source: backend/tests/integration/test_062_active_runs.py:13-66
(mock-supabase-only, no Redis fixture — the contract under test is the
response shape, not Redis I/O). See 063-PATTERNS.md "test_063_post_contract.py"
section for the full skeleton.

Anti-false-RED guard:
  ``assert resp.headers.get("content-type", "").startswith("application/json")``
  is asserted BEFORE the body shape check so a stale SSE response (which
  has content-type ``text/event-stream``) reports a recognizable contract
  error rather than tripping over a different code path.
"""
import pytest
from uuid import uuid4
import httpx
from httpx import ASGITransport

from app.dependencies import get_supabase
from app.main import app
from tests.integration._run_helpers import _build_mock_supabase, _make_result, USER_ID  # noqa: F401
from tests.integration.test_059_disconnect import _reset_sse_starlette_app_status  # noqa: F401, E402

THREAD_A = str(uuid4())


@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_post_returns_message_and_run_ids():
    """D-063-01: POST returns 201 + JSON {message_id, run_id}, NOT EventSourceResponse.

    Anti-false-RED guards:
      (1) status_code == 201 (route exists and committed)
      (2) content-type starts with 'application/json' (NOT 'text/event-stream' —
          this is the contract assertion that fails on legacy code)
      (3) body has both message_id AND run_id keys
    """
    mock_supabase = _build_mock_supabase()

    # Configure the threads ownership SELECT to return a row so the route reaches
    # the messages INSERT path. _build_mock_supabase already wires this for
    # threads/messages/runs tables (see _run_helpers.py:179-237).
    threads_builder = mock_supabase.table("threads")
    threads_builder.execute.side_effect = lambda *a, **k: _make_result({"id": THREAD_A})

    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    try:
        async with httpx.AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as c:
            resp = await c.post(
                f"/threads/{THREAD_A}/messages",
                headers={"Authorization": "Bearer test-token"},
                json={"content": "hello", "agent_mode": "default"},
            )

        assert resp.status_code == 201, (
            f"Expected 201; got {resp.status_code} body={resp.text[:300]}"
        )

        # Anti-false-RED guard: response must be JSON, NOT text/event-stream.
        # On master, send_message returns EventSourceResponse → content-type is
        # 'text/event-stream', so this assertion fires the recognizable contract
        # error. NOT a collection / import error.
        ctype = resp.headers.get("content-type", "")
        assert ctype.startswith("application/json"), (
            f"Expected JSON content-type, got {ctype!r}"
        )

        body = resp.json()
        assert "message_id" in body and "run_id" in body, (
            f"Expected {{message_id, run_id}}; got {body!r}"
        )
    finally:
        app.dependency_overrides.pop(get_supabase, None)


@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_post_returns_before_producer_first_xadd():
    """D-063-01 timing invariant: POST returns BEFORE the producer's first XADD
    lands in Redis (producer is spawned via ``asyncio.create_task``, the route
    returns the JSON envelope while the producer is still scheduling its first
    LLM call).

    Plan 01 RED-form: at this commit, ``send_message`` still returns SSE on
    POST (no JSON envelope at all), so ``status_code == 201`` fails first
    with the legacy SSE response. The full timing-guard assertion lands in
    Plan 02 once the JSON envelope ships.

    TODO: Plan 02 fills the timing assertion. Suggested form:
        - Use real Redis (redis_client fixture) + _reset_redis_singleton autouse
        - patch create_adaptive_streaming_chat with _slow_chunks (0.3s/chunk)
        - resp = await ac.post(...)
        - run_id = resp.json()["run_id"]
        - xlen_at_return = await redis_client.xlen(f"run:{run_id}")
        - assert xlen_at_return == 0, (
              "POST must return BEFORE producer's first XADD; "
              f"got XLEN={xlen_at_return} at response time"
          )
    """
    mock_supabase = _build_mock_supabase()
    threads_builder = mock_supabase.table("threads")
    threads_builder.execute.side_effect = lambda *a, **k: _make_result({"id": THREAD_A})

    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    try:
        async with httpx.AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as c:
            resp = await c.post(
                f"/threads/{THREAD_A}/messages",
                headers={"Authorization": "Bearer test-token"},
                json={"content": "hello", "agent_mode": "default"},
            )

        # Wave-0 form: assert the new contract returns 201. On master, the
        # legacy EventSourceResponse path returns 200 with SSE content-type,
        # so this RED-fails for the right reason (contract mismatch).
        assert resp.status_code == 201, (
            f"D-063-01: POST must return 201 with JSON envelope; got "
            f"{resp.status_code}, content-type="
            f"{resp.headers.get('content-type')!r}, body={resp.text[:200]}"
        )
    finally:
        app.dependency_overrides.pop(get_supabase, None)
