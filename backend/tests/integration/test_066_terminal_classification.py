"""Phase 066 SC#4 + T-066-01: terminal-state classification correctness.

Three branches in agent_runner's outer try/except (threads.py:~2140-2159):
- TimeoutError       -> status='timed_out',  error=f"timed_out: ..."  (Plan 02 format)
- CancelledError     -> status='cancelled',  error=None  (raises after — UNCHANGED)
- generic Exception  -> status='failed',     error=f"failed: <Class>: <truncated<=200>"

Plus the partition guard (T-066-01): DELETE /runs/{rid} (cancel verb) writes
status='cancelled' — NEVER 'timed_out'. The two terminal states are
strictly partitioned by source.
"""
import time
from unittest.mock import patch
from uuid import uuid4

import httpx
import pytest

from app.dependencies import get_supabase
from app.main import app
from app.services.openai_service import CallingMode

from tests.integration._run_helpers import (  # noqa: E402
    _build_mock_supabase,
    _make_done_chunk,
    _make_sse_chunk,
    await_producer_finalized,
    setup_zombie_state,
)
from tests.integration.test_059_disconnect import (  # noqa: F401, E402
    _reset_sse_starlette_app_status,
)

THREAD_A = str(uuid4())


@pytest.fixture(autouse=True)
def _reset_redis_singleton():
    """Reset app.dependencies._redis between tests — see test_062_stream_replay.py
    for full rationale. Required because the DELETE handler hits the real
    get_redis() singleton (zombie-heal test path).
    """
    import app.dependencies as _deps
    _deps._redis = None
    yield
    _deps._redis = None


def _stalling_chunks():
    """Sleeps past the lowered per-call budget — fires TimeoutError."""
    time.sleep(5.0)  # exceeds the patched per_call_budget (1s)
    yield _make_sse_chunk("never_emitted ")
    yield _make_done_chunk()


def _crashing_chunks():
    """Raises mid-stream — exercises the generic Exception branch.

    The detail string is intentionally >200 chars so the T-066-02 truncation
    cap is exercised.
    """
    yield _make_sse_chunk("hello ")
    raise RuntimeError("simulated provider crash with very long detail " * 30)


@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_timeout_branch_writes_timed_out(redis_client, monkeypatch):
    """SC#4: TimeoutError -> runs UPDATE with status='timed_out' + error prefix='timed_out:'.

    Plan 02 emits the per-call asyncio.timeout wrap and the outer except
    branch refines _terminal_error to the D-066-07 format
    `f"timed_out: {Ns} per-call deadline exceeded at iteration {N} (model={...})"`.
    """
    # threads.py uses a local import: `from app.config import get_per_call_timeout`
    # inside the agent loop, so patching the source module's attribute is the
    # right interception point (resolves to the patched value at call time).
    import app.config as _app_config
    monkeypatch.setattr(_app_config, "get_per_call_timeout", lambda *a, **k: 1)

    mock_supabase = _build_mock_supabase()
    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    try:
        with patch(
            "app.api.threads.create_adaptive_streaming_chat",
            side_effect=lambda *a, **k: (iter(_stalling_chunks()), CallingMode.NATIVE),
        ), patch(
            "app.services.suggestion_service.generate_suggestions",
            return_value=([], None),
        ), patch(
            "app.api.threads.generate_thread_title",
            return_value=("T", None),
        ):
            async with httpx.AsyncClient(app=app, base_url="http://test") as c:
                async with c.stream(
                    "POST",
                    f"/threads/{THREAD_A}/messages",
                    json={"content": "hello"},
                    headers={"Authorization": "Bearer test-token"},
                    timeout=30.0,
                ) as r:
                    async for _line in r.aiter_lines():
                        pass

            await await_producer_finalized(mock_supabase)

            # Assert: runs UPDATE with status='timed_out' AND error.startswith('timed_out:')
            runs_builder = mock_supabase.table("runs")
            timed_out_updates = [
                c for c in runs_builder.update.call_args_list
                if (
                    c.args
                    and isinstance(c.args[0], dict)
                    and c.args[0].get("status") == "timed_out"
                    and isinstance(c.args[0].get("error"), str)
                    and c.args[0]["error"].startswith("timed_out:")
                )
            ]
            assert timed_out_updates, (
                f"Expected runs UPDATE with status='timed_out' AND "
                f"error.startswith('timed_out:'); "
                f"got: {runs_builder.update.call_args_list}"
            )
    finally:
        app.dependency_overrides.pop(get_supabase, None)


@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_failed_error_truncated_to_200_chars(redis_client, monkeypatch):
    """T-066-14 + D-066-07: generic Exception -> status='failed' AND truncated detail.

    Plan 01 SUMMARY documents the format string as
        f"failed: {type(e).__name__}: {(str(e) or '')[:200]}"
    so the runs.error length is bounded by 200 chars of detail + a small
    prefix overhead. This guards against API-key fragments / tracebacks
    leaking via the RLS-readable runs.error column (T-066-02 mitigation).
    """
    mock_supabase = _build_mock_supabase()
    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    try:
        with patch(
            "app.api.threads.create_adaptive_streaming_chat",
            side_effect=lambda *a, **k: (iter(_crashing_chunks()), CallingMode.NATIVE),
        ), patch(
            "app.services.suggestion_service.generate_suggestions",
            return_value=([], None),
        ), patch(
            "app.api.threads.generate_thread_title",
            return_value=("T", None),
        ):
            async with httpx.AsyncClient(app=app, base_url="http://test") as c:
                async with c.stream(
                    "POST",
                    f"/threads/{THREAD_A}/messages",
                    json={"content": "hello"},
                    headers={"Authorization": "Bearer test-token"},
                    timeout=30.0,
                ) as r:
                    async for _line in r.aiter_lines():
                        pass

            await await_producer_finalized(mock_supabase)

            runs_builder = mock_supabase.table("runs")
            failed_updates = [
                c for c in runs_builder.update.call_args_list
                if (
                    c.args
                    and isinstance(c.args[0], dict)
                    and c.args[0].get("status") == "failed"
                )
            ]
            assert failed_updates, (
                f"Expected runs UPDATE with status='failed'; "
                f"got: {runs_builder.update.call_args_list}"
            )
            err = failed_updates[-1].args[0]["error"]
            assert err.startswith("failed:"), (
                f"error must start with 'failed:'; got {err!r}"
            )
            # Per Plan 01 format `f"failed: {type(e).__name__}: {str(e)[:200]}"`:
            # cap = 200 (detail) + prefix overhead (`"failed: " + class_name + ": "`).
            # Allow generous prefix budget — 60 chars covers any reasonable
            # exception class name.
            MAX_LEN = 200 + 60
            assert len(err) <= MAX_LEN, (
                f"error length {len(err)} exceeds T-066-02 cap; full string: {err!r}"
            )
    finally:
        app.dependency_overrides.pop(get_supabase, None)


@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_delete_writes_cancelled_not_timed_out(redis_client):
    """T-066-01 partition guard: DELETE /runs/{rid} writes status='cancelled', NEVER 'timed_out'.

    The cancel handler at runs.py:386, 422-424 must continue producing
    'cancelled' even after Plan 02 introduced the timed_out lifecycle.
    Tests the zombie-heal path (RUN_TASKS empty + status='streaming' in mock).
    """
    mock_supabase = _build_mock_supabase()
    run_id = uuid4()

    # setup_zombie_state signature is (redis_client, mock_supabase, run_id, thread_id, *, n_entries=1)
    # — populates Redis stream + ZADDs + configures runs SELECT mock to
    # return a streaming-status row owned by the test user.
    await setup_zombie_state(redis_client, mock_supabase, run_id, THREAD_A)

    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    try:
        async with httpx.AsyncClient(app=app, base_url="http://test") as c:
            r = await c.delete(
                f"/runs/{run_id}",
                headers={"Authorization": "Bearer test-token"},
                timeout=10.0,
            )
        assert r.status_code == 204, (
            f"DELETE expected 204; got {r.status_code} body={r.text}"
        )

        runs_builder = mock_supabase.table("runs")
        cancel_updates = [
            c for c in runs_builder.update.call_args_list
            if c.args and isinstance(c.args[0], dict)
            and c.args[0].get("status") == "cancelled"
        ]
        assert cancel_updates, (
            f"DELETE must write status='cancelled' (T-066-01 partition guard); "
            f"got: {runs_builder.update.call_args_list}"
        )
        # T-066-01 negation: NEVER 'timed_out' from the cancel verb
        timed_out_updates = [
            c for c in runs_builder.update.call_args_list
            if c.args and isinstance(c.args[0], dict)
            and c.args[0].get("status") == "timed_out"
        ]
        assert not timed_out_updates, (
            f"DELETE MUST NOT write status='timed_out' (T-066-01 partition guard violated); "
            f"got: {timed_out_updates}"
        )
    finally:
        app.dependency_overrides.pop(get_supabase, None)


@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_delete_on_timed_out_row_short_circuits_silently(redis_client):
    """D-066-04 partition guard (inverse of T-066-01): DELETE on already-`timed_out`
    row MUST short-circuit at runs.py:388 with 204 and NO update — must not fall
    through to the zombie-heal path which would overwrite status to 'cancelled'.

    Regression test for the BLOCKER raised in 066-REVIEW.md: the cancel_run
    already-terminal short-circuit was missed when Plan 01 added the 5th
    lifecycle value. Without the fix, a late DELETE on `timed_out` silently
    rewrites the partition to 'cancelled'.
    """
    mock_supabase = _build_mock_supabase()
    run_id = uuid4()

    # Configure mock SELECT to return an already-`timed_out` row.
    runs_builder = mock_supabase.table("runs")
    runs_builder.execute.side_effect = lambda *a, **k: type("R", (), {
        "data": {
            "run_id": str(run_id),
            "status": "timed_out",
            "thread_id": str(THREAD_A),
        },
        "count": None,
    })()

    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    try:
        async with httpx.AsyncClient(app=app, base_url="http://test") as c:
            r = await c.delete(
                f"/runs/{run_id}",
                headers={"Authorization": "Bearer test-token"},
                timeout=10.0,
            )
        assert r.status_code == 204, (
            f"DELETE on `timed_out` row expected 204; got {r.status_code} body={r.text}"
        )

        # Short-circuit at runs.py:388 must fire — NO update should occur.
        # If the fix is missing, the zombie-heal path runs and writes status='cancelled'.
        cancel_updates = [
            c for c in runs_builder.update.call_args_list
            if c.args and isinstance(c.args[0], dict)
            and c.args[0].get("status") == "cancelled"
        ]
        assert not cancel_updates, (
            f"DELETE on `timed_out` row MUST NOT write status='cancelled' "
            f"(D-066-04 partition guard violated; cancel_run short-circuit at runs.py:388 "
            f"failed to admit `timed_out`); got: {cancel_updates}"
        )
        # Defense-in-depth: no update of any kind should fire.
        assert not runs_builder.update.call_args_list, (
            f"DELETE on `timed_out` row MUST short-circuit silently with NO update; "
            f"got: {runs_builder.update.call_args_list}"
        )
    finally:
        app.dependency_overrides.pop(get_supabase, None)
