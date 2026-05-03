"""SC#3 idempotency (D-062-09): DELETE /runs/{run_id} on an already-terminal run
returns 204 silently with NO further work — no UPDATE, no Redis touch.

Three parametrized cases cover the full terminal status enum:
  - completed (natural success)
  - failed    (provider/timeout error)
  - cancelled (idempotent re-call after a successful prior cancel)

Phase 062 Plan 03 (D-062-09).
"""
import pytest
from uuid import uuid4

import httpx
from httpx import ASGITransport

from app.dependencies import get_supabase
from app.main import app

from tests.integration._run_helpers import _build_mock_supabase
from tests.integration.test_059_disconnect import _reset_sse_starlette_app_status  # noqa: F401, E402

THREAD_A = str(uuid4())


@pytest.fixture(autouse=True)
def _reset_redis_singleton():
    """Reset app.dependencies._redis between tests (loop-binding trap — see
    test_062_stream_replay.py for full rationale, RESEARCH.md Pitfall 6).

    The DELETE handler invokes ``Depends(get_redis)`` even when the route
    early-returns on already-terminal status — FastAPI resolves all Depends
    BEFORE entering the route body, so the singleton is touched even though
    no Redis ops actually fire on this code path.
    """
    import app.dependencies as _deps
    _deps._redis = None
    yield
    _deps._redis = None


def _mock_runs_with_status(mock_supabase, run_id, terminal_status):
    """Configure mock_supabase to return a runs row with the given terminal status."""
    runs_builder = mock_supabase.table("runs")
    runs_builder.execute.side_effect = lambda *a, **k: type("R", (), {
        "data": {
            "run_id": str(run_id),
            "status": terminal_status,
            "thread_id": THREAD_A,
        },
        "count": None,
    })()
    return runs_builder


@pytest.mark.parametrize("terminal_status", ["completed", "failed", "cancelled"])
@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_terminal_returns_204_silent(terminal_status):
    """D-062-09 / SC#3 idempotent: DELETE on already-terminal run returns 204
    with NO further work.

    Captures the runs.update.call_args_list count BEFORE the DELETE and asserts
    it's unchanged AFTER — proves the early-return branch fired (no UPDATE).
    """
    mock_supabase = _build_mock_supabase()
    run_id = uuid4()
    runs_builder = _mock_runs_with_status(mock_supabase, run_id, terminal_status)

    # Capture pre-DELETE UPDATE call count (anti-false-RED guard: if the
    # route doesn't early-return and instead falls through to a zombie heal
    # or happy-path branch, we WILL see an UPDATE here).
    update_count_pre = len(runs_builder.update.call_args_list)

    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    try:
        async with httpx.AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as c:
            resp = await c.delete(
                f"/runs/{run_id}",
                headers={"Authorization": "Bearer test-token"},
            )
        assert resp.status_code == 204, (
            f"Expected 204 silent for status={terminal_status!r}; "
            f"got {resp.status_code} body={resp.text}"
        )
        update_count_post = len(runs_builder.update.call_args_list)
        assert update_count_pre == update_count_post, (
            f"Expected NO UPDATE on already-terminal DELETE (status={terminal_status!r}); "
            f"pre={update_count_pre} post={update_count_post}"
        )
    finally:
        app.dependency_overrides.pop(get_supabase, None)
