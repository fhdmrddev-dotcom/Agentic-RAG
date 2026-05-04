"""WR-09 / D-062-12 follow-up: cross-user GET stream + DELETE return 404
AND the response body does NOT contain the run_id (no leakage).

Phase 063 review pointed out that test_062_cross_user_404.py asserts the
status code (404) and the route's HTTPException detail ("Run not found"),
but does NOT assert that the response body lacks the run_id. A future
regression that accidentally echoes the queried run_id into the 404
response (e.g., ``detail=f"Run {run_id} not found"``) would silently
defeat T-062-01's "don't leak resource existence" property even though
the status code stayed 404.

This file adds the missing leakage assertion for both surfaces touched
by Phase 063's POST → run_id → GET stream / DELETE flow:

  1. POST /threads/{tid}/messages happy path returns a run_id.
  2. A different user attempting GET /runs/{rid}/stream and DELETE
     /runs/{rid} both get 404 with NO run_id in the body.

The mock is intentionally minimal: ``_build_mock_supabase`` with the
runs builder returning ``None`` for the cross-user query. We do NOT use
real Redis here — no actual streaming happens; the route 404s in Step 1
ownership SELECT before any Redis call.
"""
import pytest
from uuid import uuid4

import httpx
from httpx import ASGITransport

from app.dependencies import get_supabase, get_current_user
from app.main import app
from tests.integration._run_helpers import _build_mock_supabase, _make_result
from tests.integration.test_059_disconnect import _reset_sse_starlette_app_status  # noqa: F401, E402

OTHER_USER = {"id": "00000000-0000-0000-0000-000000000099", "email": "other@example.com"}


@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_get_stream_cross_user_404_does_not_leak_run_id():
    """WR-09 follow-up: cross-user GET stream returns 404 AND body does NOT
    contain the queried run_id (T-062-01 information-disclosure guard).
    """
    mock_supabase = _build_mock_supabase()
    run_id = str(uuid4())
    runs_builder = mock_supabase.table("runs")
    runs_builder.execute.side_effect = lambda *a, **k: _make_result(None)

    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    app.dependency_overrides[get_current_user] = lambda: OTHER_USER
    try:
        async with httpx.AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as c:
            resp = await c.get(
                f"/runs/{run_id}/stream?since=0",
                headers={"Authorization": "Bearer test-token"},
            )

        assert resp.status_code == 404, (
            f"Expected 404 on cross-user stream; got {resp.status_code} "
            f"body={resp.text}"
        )
        # T-062-01: response body must NOT contain the run_id.
        body_text = resp.text
        assert run_id not in body_text, (
            f"Information disclosure: response body contains queried run_id "
            f"{run_id!r}; body={body_text!r}"
        )
    finally:
        app.dependency_overrides.pop(get_supabase, None)
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_delete_cross_user_404_does_not_leak_run_id():
    """WR-09 follow-up: cross-user DELETE returns 404 AND body does NOT
    contain the queried run_id (T-062-01 / T-062-02 leakage guard).
    """
    mock_supabase = _build_mock_supabase()
    run_id = uuid4()
    runs_builder = mock_supabase.table("runs")
    runs_builder.execute.side_effect = lambda *a, **k: _make_result(None)

    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    app.dependency_overrides[get_current_user] = lambda: OTHER_USER
    try:
        async with httpx.AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as c:
            resp = await c.delete(
                f"/runs/{run_id}",
                headers={"Authorization": "Bearer test-token"},
            )

        assert resp.status_code == 404, (
            f"Expected 404 on cross-user DELETE; got {resp.status_code} "
            f"body={resp.text}"
        )
        # T-062-01: response body must NOT contain the run_id.
        body_text = resp.text
        assert str(run_id) not in body_text, (
            f"Information disclosure: response body contains queried run_id "
            f"{run_id!s}; body={body_text!r}"
        )
    finally:
        app.dependency_overrides.pop(get_supabase, None)
        app.dependency_overrides.pop(get_current_user, None)
