"""GET /threads/{tid}/messages — JOIN public.runs via message_id (D-063.1-13).

Phase 063.1 Plan 01 Task 3 (Gap-002 fix).

Three integration tests covering D-063.1-13/14/15:

  1. Happy path — assistant row gets run_id + run_status from the FK match;
     user row gets nulls for both fields.
  2. Pre-run-backed null — runs SELECT returns []; both message rows return
     null for run_id and run_status (Resume button correctly suppressed
     for messages predating migration 035).
  3. Cross-user 404 + no leak (T-063.1-01 mitigation, mirrors
     test_063_cross_user_no_runid_leak.py shape) — threads ownership SELECT
     returns None; route 404s BEFORE the runs SELECT fires; response body
     contains neither THREAD_A nor any run_id strings.

Mock-supabase pattern matches test_062_active_runs.py:13-66 (mock-supabase
only, no Redis). Per-test side_effect chains route the threads / messages /
runs builders independently — _build_mock_supabase already routes them via
per-table builders, so we only need to override .execute.side_effect on the
specific builders this route touches.
"""
import pytest
from uuid import uuid4
import httpx
from httpx import ASGITransport

from app.dependencies import get_supabase, get_current_user
from app.main import app
from tests.integration._run_helpers import _build_mock_supabase, _make_result, USER_ID
from tests.integration.test_059_disconnect import _reset_sse_starlette_app_status  # noqa: F401, E402

THREAD_A = str(uuid4())
OTHER_USER = {"id": "00000000-0000-0000-0000-000000000099", "email": "other@example.com"}

# Stable UUIDs for assertions across tests.
USER_MSG_ID = "00000000-0000-0000-0000-0000000000a1"
ASSISTANT_MSG_ID = "00000000-0000-0000-0000-0000000000a2"
RUN_ID = "00000000-0000-0000-0000-0000000000b1"


@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_get_messages_includes_run_id_and_run_status_for_assistant_rows():
    """D-063.1-13/15: GET /threads/{tid}/messages returns run_id and run_status
    on assistant rows joined from public.runs via message_id FK.

    User rows have neither field populated (null) because runs.message_id
    only ever points at assistant messages (the producer's lifecycle row).
    """
    mock_supabase = _build_mock_supabase()

    threads_builder = mock_supabase.table("threads")
    threads_builder.execute.side_effect = lambda *a, **k: _make_result({"id": THREAD_A})

    msgs_builder = mock_supabase.table("messages")
    msgs_builder.execute.side_effect = lambda *a, **k: _make_result([
        {"id": USER_MSG_ID, "thread_id": THREAD_A, "user_id": USER_ID,
         "role": "user", "content": "hi", "created_at": "2026-05-04T00:00:00Z",
         "updated_at": "2026-05-04T00:00:00Z"},
        {"id": ASSISTANT_MSG_ID, "thread_id": THREAD_A, "user_id": USER_ID,
         "role": "assistant", "content": "hello", "created_at": "2026-05-04T00:00:01Z",
         "updated_at": "2026-05-04T00:00:01Z"},
    ])

    runs_builder = mock_supabase.table("runs")
    runs_builder.execute.side_effect = lambda *a, **k: _make_result([
        {"run_id": RUN_ID, "message_id": ASSISTANT_MSG_ID, "status": "completed"},
    ])

    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    try:
        async with httpx.AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as c:
            resp = await c.get(
                f"/threads/{THREAD_A}/messages",
                headers={"Authorization": "Bearer test-token"},
            )

        assert resp.status_code == 200, f"got {resp.status_code} body={resp.text}"
        body = resp.json()
        assert len(body) == 2, f"Expected 2 messages; got {len(body)} body={body!r}"

        # User row: run_id and run_status both null (no FK match).
        user_row = next(m for m in body if m["role"] == "user")
        assert user_row.get("run_id") is None, (
            f"Expected user row run_id=None; got {user_row.get('run_id')!r}"
        )
        assert user_row.get("run_status") is None, (
            f"Expected user row run_status=None; got {user_row.get('run_status')!r}"
        )

        # Assistant row: run_id and run_status populated from runs.
        asst_row = next(m for m in body if m["role"] == "assistant")
        assert asst_row["run_id"] == RUN_ID, (
            f"Expected assistant run_id={RUN_ID}; got {asst_row.get('run_id')!r}"
        )
        assert asst_row["run_status"] == "completed", (
            f"Expected assistant run_status='completed'; got {asst_row.get('run_status')!r}"
        )

        # WR-03 fix: assert the runs builder chain was filtered on BOTH
        # thread_id AND user_id. The mock's .execute returns the same
        # payload regardless of how the production code chains its .eq()
        # calls, so this assertion is the only thing that catches a
        # regression that drops the .eq("user_id", ...) defense-in-depth
        # filter (production source line 637, T-063.1-04 mitigation).
        # The eq() builder is a Mock — call_args_list captures every call;
        # we extract (col_name, value) tuples and test for membership.
        eq_kwargs = {(c.args[0], c.args[1]) for c in runs_builder.eq.call_args_list}
        assert ("thread_id", THREAD_A) in eq_kwargs, (
            f"Expected runs SELECT filtered on thread_id={THREAD_A}; "
            f"got eq() calls={eq_kwargs!r}"
        )
        assert ("user_id", USER_ID) in eq_kwargs, (
            f"Expected runs SELECT filtered on user_id={USER_ID} "
            f"(defense-in-depth alongside RLS, T-063.1-04 mitigation); "
            f"got eq() calls={eq_kwargs!r}"
        )
    finally:
        app.dependency_overrides.pop(get_supabase, None)


@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_pre_run_backed_messages_return_null_run_fields():
    """D-063.1-13: pre-run-backed messages (predate migration 035) have no
    matching public.runs row — both run_id and run_status return null without
    error. The Resume button only renders on runStatus === 'failed', so null
    is the correct "no Resume" signal for legacy messages.
    """
    mock_supabase = _build_mock_supabase()

    threads_builder = mock_supabase.table("threads")
    threads_builder.execute.side_effect = lambda *a, **k: _make_result({"id": THREAD_A})

    msgs_builder = mock_supabase.table("messages")
    msgs_builder.execute.side_effect = lambda *a, **k: _make_result([
        {"id": USER_MSG_ID, "thread_id": THREAD_A, "user_id": USER_ID,
         "role": "user", "content": "hi", "created_at": "2026-05-04T00:00:00Z",
         "updated_at": "2026-05-04T00:00:00Z"},
        {"id": ASSISTANT_MSG_ID, "thread_id": THREAD_A, "user_id": USER_ID,
         "role": "assistant", "content": "hello", "created_at": "2026-05-04T00:00:01Z",
         "updated_at": "2026-05-04T00:00:01Z"},
    ])

    # Empty runs list — no FK matches for any message.
    runs_builder = mock_supabase.table("runs")
    runs_builder.execute.side_effect = lambda *a, **k: _make_result([])

    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    try:
        async with httpx.AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as c:
            resp = await c.get(
                f"/threads/{THREAD_A}/messages",
                headers={"Authorization": "Bearer test-token"},
            )

        assert resp.status_code == 200, f"got {resp.status_code} body={resp.text}"
        body = resp.json()
        assert len(body) == 2, f"Expected 2 messages; got {len(body)} body={body!r}"

        # Both rows: null for run_id and run_status (no runs in fixture).
        for m in body:
            assert m.get("run_id") is None, (
                f"Expected run_id=None for {m['role']} row; got {m.get('run_id')!r}"
            )
            assert m.get("run_status") is None, (
                f"Expected run_status=None for {m['role']} row; got {m.get('run_status')!r}"
            )
    finally:
        app.dependency_overrides.pop(get_supabase, None)


@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_cross_user_messages_get_404_no_leak():
    """D-063.1-14 / T-063.1-01 mitigation: cross-user GET /threads/{tid}/messages
    returns 404 from the threads ownership SELECT failure. The route MUST
    short-circuit BEFORE the runs SELECT fires. Response body must contain
    NEITHER the queried thread_id NOR any run_id strings (mirrors
    test_063_cross_user_no_runid_leak.py shape).

    Anti-false-RED: if the route doesn't exist or returns a different status,
    the body assertion failure message includes the actual body for diagnosis.
    """
    mock_supabase = _build_mock_supabase()

    # Threads ownership SELECT returns no row (cross-user). Route MUST 404
    # at this point and never touch the runs SELECT.
    threads_builder = mock_supabase.table("threads")
    threads_builder.execute.side_effect = lambda *a, **k: _make_result(None)

    # Track whether the runs SELECT was reached. If it was, the route's
    # ownership-check ordering is broken — the leakage guard must hold even
    # if a future refactor reorders the queries.
    runs_builder = mock_supabase.table("runs")
    runs_execute_called = []

    def _runs_execute(*a, **k):
        runs_execute_called.append((a, k))
        return _make_result([])

    runs_builder.execute.side_effect = _runs_execute

    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    app.dependency_overrides[get_current_user] = lambda: OTHER_USER
    try:
        async with httpx.AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as c:
            resp = await c.get(
                f"/threads/{THREAD_A}/messages",
                headers={"Authorization": "Bearer test-token"},
            )

        assert resp.status_code == 404, f"got {resp.status_code} body={resp.text}"

        # T-063.1-01 leakage guards: the route's HTTPException uses
        # 'Thread not found'; FastAPI's default unregistered-route 404 uses
        # 'Not Found' — anti-false-RED for missing route.
        body = resp.json()
        assert body.get("detail") == "Thread not found", (
            f"Expected detail='Thread not found' (route's HTTPException); got {body!r}"
        )

        # Response body must NOT contain the queried thread_id or any run_id
        # field (the route never reaches the runs SELECT, so no run data
        # could possibly land in the response).
        body_text = resp.text
        assert THREAD_A not in body_text, (
            f"Information disclosure: response body contains queried thread_id "
            f"{THREAD_A!r}; body={body_text!r}"
        )
        assert "run_id" not in body_text, (
            f"Information disclosure: response body contains 'run_id' field; "
            f"body={body_text!r}"
        )

        # Short-circuit invariant: runs SELECT MUST NOT have been called.
        assert not runs_execute_called, (
            f"Expected runs SELECT to short-circuit on ownership 404; "
            f"got {len(runs_execute_called)} runs.execute() calls"
        )
    finally:
        app.dependency_overrides.pop(get_supabase, None)
        app.dependency_overrides.pop(get_current_user, None)
