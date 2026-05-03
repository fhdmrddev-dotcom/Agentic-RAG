"""SC#2 (TTL-expired): GET /runs/{rid}/stream on a TTL-expired run (redis.exists=0)
yields exactly ONE synthetic terminal SSE event mapped from runs.status via
_RUN_STATUS_TO_TERMINAL_TYPE, with error='buffer_expired'.

Phase 062 Plan 02 (D-062-06). Four tests cover the three terminal status mappings
(completed→done, failed→error, cancelled→cancelled) plus the missing-row fallback
(404 not 500).
"""
import json
import pytest
from uuid import uuid4

import httpx
from httpx import ASGITransport

from app.dependencies import get_supabase
from app.main import app

from tests.integration._run_helpers import _build_mock_supabase, _make_result
from tests.integration.test_059_disconnect import _reset_sse_starlette_app_status  # noqa: F401, E402

THREAD_A = str(uuid4())


def _mock_runs_returning(mock_supabase, payload):
    """Local helper: configure the runs SELECT to return `payload` (a dict, list, or None)."""
    runs_builder = mock_supabase.table("runs")
    if payload is None:
        runs_builder.execute.side_effect = lambda *a, **k: _make_result(None)
    else:
        runs_builder.execute.side_effect = lambda *a, **k: type("R", (), {
            "data": payload, "count": None,
        })()
    return runs_builder


@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_emits_synthetic_terminal_when_buffer_expired_completed(redis_client):
    """D-062-06: TTL-expired buffer (redis.exists=0) + status='completed' →
    ONE synthetic SSE event with type='done', error='buffer_expired'."""
    mock_supabase = _build_mock_supabase()
    run_id = str(uuid4())
    # Do NOT populate run:{run_id} — redis.exists returns 0
    _mock_runs_returning(mock_supabase, {
        "run_id": run_id, "status": "completed", "error": None, "thread_id": THREAD_A,
    })
    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    try:
        events = []
        async with httpx.AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as ac:
            async with ac.stream(
                "GET", f"/runs/{run_id}/stream?since=0",
                headers={"Authorization": "Bearer test-token"},
                timeout=5.0,
            ) as resp:
                assert resp.status_code == 200, \
                    f"Expected 200; got {resp.status_code}"
                async for line in resp.aiter_lines():
                    if line.startswith("data: "):
                        events.append(json.loads(line[6:]))

        assert len(events) == 1, \
            f"Expected exactly 1 synthetic event; got {len(events)}: {events}"
        ev = events[0]
        assert ev["type"] == "done", f"completed → done; got {ev['type']}"
        assert ev["error"] == "buffer_expired", \
            f"Expected error='buffer_expired'; got {ev}"
        assert ev["runs_status"] == "completed", \
            f"Expected runs_status='completed'; got {ev}"
    finally:
        app.dependency_overrides.pop(get_supabase, None)


@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_emits_synthetic_terminal_when_buffer_expired_failed(redis_client):
    """D-062-06: status='failed' → type='error' via _RUN_STATUS_TO_TERMINAL_TYPE."""
    mock_supabase = _build_mock_supabase()
    run_id = str(uuid4())
    _mock_runs_returning(mock_supabase, {
        "run_id": run_id, "status": "failed", "error": "TimeoutError",
        "thread_id": THREAD_A,
    })
    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    try:
        events = []
        async with httpx.AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as ac:
            async with ac.stream(
                "GET", f"/runs/{run_id}/stream?since=0",
                headers={"Authorization": "Bearer test-token"},
                timeout=5.0,
            ) as resp:
                async for line in resp.aiter_lines():
                    if line.startswith("data: "):
                        events.append(json.loads(line[6:]))

        assert len(events) == 1, \
            f"Expected exactly 1 synthetic event; got {len(events)}: {events}"
        ev = events[0]
        assert ev["type"] == "error", f"failed → error; got {ev['type']}"
        assert ev["error"] == "buffer_expired"
        assert ev["runs_status"] == "failed"
        assert ev["runs_error"] == "TimeoutError"
    finally:
        app.dependency_overrides.pop(get_supabase, None)


@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_emits_synthetic_terminal_when_buffer_expired_cancelled(redis_client):
    """D-062-06: status='cancelled' → type='cancelled' via _RUN_STATUS_TO_TERMINAL_TYPE."""
    mock_supabase = _build_mock_supabase()
    run_id = str(uuid4())
    _mock_runs_returning(mock_supabase, {
        "run_id": run_id, "status": "cancelled", "error": "cancelled_by_user",
        "thread_id": THREAD_A,
    })
    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    try:
        events = []
        async with httpx.AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as ac:
            async with ac.stream(
                "GET", f"/runs/{run_id}/stream?since=0",
                headers={"Authorization": "Bearer test-token"},
                timeout=5.0,
            ) as resp:
                async for line in resp.aiter_lines():
                    if line.startswith("data: "):
                        events.append(json.loads(line[6:]))

        assert len(events) == 1, \
            f"Expected exactly 1 synthetic event; got {len(events)}: {events}"
        ev = events[0]
        assert ev["type"] == "cancelled", f"cancelled → cancelled; got {ev['type']}"
        assert ev["error"] == "buffer_expired"
        assert ev["runs_status"] == "cancelled"
        assert ev["runs_error"] == "cancelled_by_user"
    finally:
        app.dependency_overrides.pop(get_supabase, None)


@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_404_when_runs_row_missing(redis_client):
    """D-062-06 fallback: row missing → 404, not 500."""
    mock_supabase = _build_mock_supabase()
    run_id = str(uuid4())
    _mock_runs_returning(mock_supabase, None)
    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    try:
        async with httpx.AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as ac:
            resp = await ac.get(
                f"/runs/{run_id}/stream?since=0",
                headers={"Authorization": "Bearer test-token"},
            )
        assert resp.status_code == 404, \
            f"Expected 404 on missing runs row; got {resp.status_code} body={resp.text}"
        # Anti-false-RED guard: route's HTTPException uses 'Run not found';
        # FastAPI's default unregistered-route 404 uses 'Not Found'.
        body = resp.json()
        assert body.get("detail") == "Run not found", \
            f"Expected detail='Run not found' (route's HTTPException); got {body!r}"
    finally:
        app.dependency_overrides.pop(get_supabase, None)
