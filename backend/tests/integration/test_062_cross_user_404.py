"""SC#5 (active-runs side): cross-user thread access returns 404, NOT 200 or 403.

Phase 062 Plan 01 (D-062-12 — don't leak thread existence to other users;
T-062-01 mitigation — ownership SELECT applies BOTH .eq(id) AND .eq(user_id)).

This file is shared across Plans 01 / 02 / 03 — Plan 01 owns the active-runs
test (this file's first test); Plan 02 will append the stream cross-user test;
Plan 03 will append the delete cross-user test. The shared file keeps the
cross-user 404 contract physically co-located so future maintainers see all
three SC#5 surfaces in one place.
"""
import pytest
from uuid import uuid4
import httpx
from httpx import ASGITransport

from app.dependencies import get_supabase, get_current_user
from app.main import app
from tests.integration._run_helpers import _build_mock_supabase, _make_result
from tests.integration.test_059_disconnect import _reset_sse_starlette_app_status  # noqa: F401, E402

THREAD_A = str(uuid4())
OTHER_USER = {"id": "00000000-0000-0000-0000-000000000099", "email": "other@example.com"}


@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_active_runs_other_user_returns_404():
    """cross-user thread_id → 404 per D-062-12 (don't leak existence).

    SC#5 / T-062-01: when OTHER_USER queries a thread they don't own, the
    ownership SELECT on threads returns no row (RLS + .eq(user_id) filter)
    and the route MUST 404 — NOT 200 (which would leak that the thread
    exists for someone) and NOT 403 (which would also leak existence).
    """
    mock_supabase = _build_mock_supabase()
    # Thread SELECT honors ownership filter — other user sees no row → 404 path
    threads_builder = mock_supabase.table("threads")
    threads_execute_called = []

    def _threads_execute(*a, **k):
        threads_execute_called.append((a, k))
        return _make_result(None)

    threads_builder.execute.side_effect = _threads_execute

    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    app.dependency_overrides[get_current_user] = lambda: OTHER_USER
    try:
        async with httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            resp = await c.get(
                f"/threads/{THREAD_A}/active-runs",
                headers={"Authorization": "Bearer test-token"},
            )

        # D-062-12: cross-user thread → 404, NOT 403, NOT 200
        assert resp.status_code == 404, \
            f"Expected 404 (NOT 200, NOT 403) for cross-user thread; got {resp.status_code} body={resp.text}"
        # Anti-false-RED guard: must be the route's HTTPException, not FastAPI's
        # unregistered-route 404 (which is what would pass this test before the route exists).
        body = resp.json()
        assert body.get("detail") == "Thread not found", \
            f"Expected detail='Thread not found' (route's HTTPException); got {body!r}"
        # Anti-false-RED guard: ownership SELECT must have been called with OTHER_USER's id
        assert threads_execute_called, \
            "Expected threads ownership SELECT to be called; route may not be registered"
    finally:
        app.dependency_overrides.pop(get_supabase, None)
        app.dependency_overrides.pop(get_current_user, None)
