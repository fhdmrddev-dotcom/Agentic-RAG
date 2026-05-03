"""SC#1: GET /threads/{thread_id}/active-runs — streaming-only filter, bare list, empty case, 422 on malformed UUID.

Phase 062 Plan 01 (D-062-02 streaming-only, D-062-03 wire shape, D-062-04
bare-list response, D-062-12 cross-user 404, T-062-01 mitigation).

Mock-supabase-only test pattern (no Redis fixture needed) — mirrors
test_061_runs_table.py:1-92. The five tests collectively prove SC#1:
streaming-only filter is in the SELECT call args, response items conform
to the ActiveRunResponse Pydantic shape, empty case returns 200 [],
malformed UUID is rejected with 422 before any handler runs, and the
ownership SELECT on threads runs first (mirroring get_messages:597-606).
"""
import pytest
from uuid import uuid4
import httpx
from httpx import ASGITransport

from app.dependencies import get_supabase
from app.main import app
from tests.integration._run_helpers import _build_mock_supabase, _make_result, USER_ID
from tests.integration.test_059_disconnect import _reset_sse_starlette_app_status  # noqa: F401, E402

THREAD_A = str(uuid4())


@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_returns_streaming_only_filter():
    """D-062-02: SELECT must include .eq('status','streaming') AND .order('started_at', desc=True)."""
    mock_supabase = _build_mock_supabase()

    # Configure the threads ownership SELECT to return a row (so we reach the runs SELECT)
    threads_builder = mock_supabase.table("threads")
    threads_builder.execute.side_effect = lambda *a, **k: _make_result({"id": THREAD_A})

    # Configure the runs SELECT to return a single streaming row
    runs_builder = mock_supabase.table("runs")
    runs_builder.execute.side_effect = lambda *a, **k: _make_result([
        {"run_id": "00000000-0000-0000-0000-000000000010",
         "started_at": "2026-05-03T00:00:00+00:00",
         "status": "streaming"},
    ])

    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    try:
        async with httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            resp = await c.get(
                f"/threads/{THREAD_A}/active-runs",
                headers={"Authorization": "Bearer test-token"},
            )

        assert resp.status_code == 200, f"Expected 200; got {resp.status_code} body={resp.text}"
        body = resp.json()
        assert isinstance(body, list), f"Expected JSON list; got {type(body).__name__}"

        # D-062-02: streaming-only filter MUST be in the runs SELECT call args
        eq_calls = runs_builder.eq.call_args_list
        assert any(c.args == ("status", "streaming") for c in eq_calls), \
            f"Expected .eq('status', 'streaming') in runs SELECT call args; got {eq_calls}"

        # Discretion: ORDER BY started_at DESC for deterministic ordering
        order_calls = runs_builder.order.call_args_list
        assert any(c.args == ("started_at",) and c.kwargs.get("desc") is True for c in order_calls), \
            f"Expected .order('started_at', desc=True) in runs SELECT; got {order_calls}"
    finally:
        app.dependency_overrides.pop(get_supabase, None)


@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_returns_response_model_shape():
    """D-062-03 + D-062-04: each item is exactly {run_id, started_at, status} with status='streaming'."""
    mock_supabase = _build_mock_supabase()

    threads_builder = mock_supabase.table("threads")
    threads_builder.execute.side_effect = lambda *a, **k: _make_result({"id": THREAD_A})

    runs_builder = mock_supabase.table("runs")
    # Include an extra field 'current_offset' in the source row to prove that
    # Pydantic's response_model strips it (D-062-04 forward-compat — no cursor on wire)
    runs_builder.execute.side_effect = lambda *a, **k: _make_result([
        {"run_id": "00000000-0000-0000-0000-000000000020",
         "started_at": "2026-05-03T01:00:00+00:00",
         "status": "streaming",
         "current_offset": "1234-0"},  # MUST be filtered out by response_model
    ])

    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    try:
        async with httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            resp = await c.get(
                f"/threads/{THREAD_A}/active-runs",
                headers={"Authorization": "Bearer test-token"},
            )

        assert resp.status_code == 200, f"Expected 200; got {resp.status_code} body={resp.text}"
        body = resp.json()
        assert len(body) == 1, f"Expected 1 item; got {len(body)}"

        item = body[0]
        # D-062-03: keys exactly {run_id, started_at, status}
        assert set(item.keys()) == {"run_id", "started_at", "status"}, \
            f"Expected keys {{run_id, started_at, status}}; got {set(item.keys())}"
        assert item["status"] == "streaming", f"Expected status='streaming'; got {item['status']}"
        assert "current_offset" not in item, \
            f"D-062-03: cursor field must NOT be present in wire shape; got {item}"
    finally:
        app.dependency_overrides.pop(get_supabase, None)


@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_empty_when_no_streaming():
    """D-062-04: empty case returns 200 with []."""
    mock_supabase = _build_mock_supabase()

    threads_builder = mock_supabase.table("threads")
    threads_builder.execute.side_effect = lambda *a, **k: _make_result({"id": THREAD_A})

    runs_builder = mock_supabase.table("runs")
    # No streaming runs — return empty list
    runs_builder.execute.side_effect = lambda *a, **k: _make_result([])

    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    try:
        async with httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            resp = await c.get(
                f"/threads/{THREAD_A}/active-runs",
                headers={"Authorization": "Bearer test-token"},
            )

        assert resp.status_code == 200, f"Expected 200; got {resp.status_code} body={resp.text}"
        body = resp.json()
        assert body == [], f"Expected []; got {body}"
    finally:
        app.dependency_overrides.pop(get_supabase, None)


@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_malformed_uuid_returns_422():
    """D-062-04: FastAPI auto-validates path param typed as UUID and rejects malformed input with 422."""
    # No mock setup needed — FastAPI rejects before any handler runs.
    async with httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        resp = await c.get(
            "/threads/not-a-uuid/active-runs",
            headers={"Authorization": "Bearer test-token"},
        )

    assert resp.status_code == 422, \
        f"Expected 422 for malformed UUID; got {resp.status_code} body={resp.text}"


@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_thread_ownership_select_runs_first():
    """Mirror get_messages:597-606 — ownership SELECT on threads runs FIRST; missing row → 404.

    Distinguishes "ownership-404" from "no-route-registered-404" by asserting:
      (1) the threads ownership SELECT was actually CALLED (proves the route ran)
      (2) the response detail is 'Thread not found' (the route's HTTPException),
          NOT FastAPI's default 'Not Found' (which is what an unregistered route returns)
      (3) the runs SELECT was NOT touched (proves short-circuit)
    Without these guards, the test passes even before the route exists — a false RED.
    """
    mock_supabase = _build_mock_supabase()

    # Threads ownership SELECT returns no row → route MUST 404 before touching runs
    threads_builder = mock_supabase.table("threads")
    threads_execute_called = []

    def _threads_execute(*a, **k):
        threads_execute_called.append((a, k))
        return _make_result(None)

    threads_builder.execute.side_effect = _threads_execute

    runs_builder = mock_supabase.table("runs")
    # Track runs SELECT calls; after the test we assert NO .execute() landed on runs
    # because the ownership 404 path must short-circuit before touching the runs table.
    runs_execute_called = []

    def _runs_execute(*a, **k):
        runs_execute_called.append((a, k))
        return _make_result([])

    runs_builder.execute.side_effect = _runs_execute

    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    try:
        async with httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            resp = await c.get(
                f"/threads/{THREAD_A}/active-runs",
                headers={"Authorization": "Bearer test-token"},
            )

        assert resp.status_code == 404, \
            f"Expected 404 when ownership SELECT returns no row; got {resp.status_code} body={resp.text}"
        # Anti-false-RED guard: the route's HTTPException uses 'Thread not found';
        # FastAPI's default unregistered-route 404 uses 'Not Found' (capitalized differently).
        # If the route doesn't exist yet, this assertion FAILS — which is what RED needs.
        body = resp.json()
        assert body.get("detail") == "Thread not found", \
            f"Expected detail='Thread not found' (route's HTTPException); got {body!r}"
        # Anti-false-RED guard: the route must have actually executed the threads SELECT.
        assert threads_execute_called, \
            "Expected threads ownership SELECT to be called; route may not be registered"
        # D-062-12 short-circuit: runs SELECT MUST NOT have been executed
        assert not runs_execute_called, \
            f"Expected runs SELECT to short-circuit on 404; got {len(runs_execute_called)} runs.execute() calls"
    finally:
        app.dependency_overrides.pop(get_supabase, None)
