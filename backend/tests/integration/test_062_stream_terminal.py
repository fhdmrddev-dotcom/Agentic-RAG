"""SC#2 (already-terminal): GET /runs/{rid}/stream on a terminal run replays the
buffer (which already contains the terminal sentinel per D-061-12) and closes
naturally — same code path as live runs.

Phase 062 Plan 02 (D-062-05).
"""
import json
import pytest
from uuid import uuid4

import httpx
from httpx import ASGITransport

from app.dependencies import get_supabase
from app.main import app

from tests.integration._run_helpers import _build_mock_supabase
from tests.integration.test_059_disconnect import _reset_sse_starlette_app_status  # noqa: F401, E402

THREAD_A = str(uuid4())


@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_terminal_run_replays_and_closes(redis_client):
    """D-062-05: GET stream on already-terminal run replays buffer (incl. in-buffer
    sentinel from D-061-12) and closes naturally — same code path as live runs."""
    mock_supabase = _build_mock_supabase()
    run_id = str(uuid4())
    stream_key = f"run:{run_id}"

    # Pre-populate 3 deltas + terminal sentinel
    for i in range(3):
        await redis_client.xadd(
            stream_key, {"data": json.dumps({"type": "delta", "content": f"tok{i}"})}
        )
    await redis_client.xadd(stream_key, {"data": json.dumps({"type": "done"})})

    # Mock runs SELECT — status='completed' (already-terminal in Postgres too)
    runs_builder = mock_supabase.table("runs")
    runs_builder.execute.side_effect = lambda *a, **k: type("R", (), {
        "data": {"run_id": run_id, "status": "completed",
                 "thread_id": THREAD_A, "error": None},
        "count": None,
    })()
    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    try:
        events = []
        async with httpx.AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as ac:
            async with ac.stream(
                "GET", f"/runs/{run_id}/stream?since=0",
                headers={"Authorization": "Bearer test-token"},
                timeout=10.0,
            ) as resp:
                assert resp.status_code == 200, \
                    f"Expected 200; got {resp.status_code}"
                async for line in resp.aiter_lines():
                    if line.startswith("data: "):
                        events.append(json.loads(line[6:]))

        assert len(events) == 4, \
            f"Expected exactly 4 events (3 delta + 1 terminal); got {len(events)}: {events}"
        assert events[-1]["type"] == "done", \
            f"Expected terminal type=done; got {events[-1]}"
        assert all(e["type"] == "delta" for e in events[:3]), \
            f"Expected first 3 to be deltas; got {events[:3]}"
    finally:
        app.dependency_overrides.pop(get_supabase, None)
