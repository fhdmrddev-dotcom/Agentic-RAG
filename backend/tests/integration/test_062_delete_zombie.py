"""SC#3 zombie heal (D-062-11): DELETE on a run where ``runs.status='streaming'``
in Postgres but ``RUN_TASKS[run_id]`` is missing (process restarted, producer
died without finalizing) heals the state:

  1. UPDATE runs SET status='cancelled', error='cancelled_by_user', completed_at=now()
  2. (if buffer exists) Synthetic terminal sentinel via _emit_terminal(reason='zombie_healed')
  3. ZREM run_id from runs:active and runs_by_thread:{thread_id}
  4. EXPIRE 60 on the stream key (failed/cancelled bucket — D-061-04)
  5. Return 204

This test fully exercises the zombie-heal branch — the "user intent honored
even when producer is dead" pathway.

Phase 062 Plan 03 (D-062-11, T-062-03 best-effort Redis ops).
"""
import json
import pytest
from uuid import UUID, uuid4

import httpx
from httpx import ASGITransport

from app.api.threads import RUN_TASKS
from app.dependencies import get_supabase
from app.main import app

from tests.integration._run_helpers import (
    _build_mock_supabase,
    setup_zombie_state,
)
from tests.integration.test_059_disconnect import _reset_sse_starlette_app_status  # noqa: F401, E402

THREAD_A = str(uuid4())


@pytest.fixture(autouse=True)
def _reset_redis_singleton():
    """Reset app.dependencies._redis between tests (loop-binding trap — see
    test_062_stream_replay.py for full rationale, RESEARCH.md Pitfall 6).
    Required because the DELETE handler hits the real ``get_redis()``
    singleton for the zombie-heal Redis ops (XADD synthetic terminal,
    ZREM × 2, EXPIRE).
    """
    import app.dependencies as _deps
    _deps._redis = None
    yield
    _deps._redis = None


@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_heals_zombie_state(redis_client):
    """D-062-11 zombie heal: runs.status='streaming' but RUN_TASKS missing.

    Setup: setup_zombie_state pre-populates Redis without spawning a
    producer (so RUN_TASKS stays empty for this run_id) AND configures the
    runs SELECT mock to return a streaming-status row.

    DELETE must drive the full 4-step zombie-heal sequence + return 204.
    """
    mock_supabase = _build_mock_supabase()
    run_id = uuid4()

    await setup_zombie_state(
        redis_client, mock_supabase, run_id, THREAD_A, n_entries=1
    )

    # Confirm precondition: RUN_TASKS does NOT contain run_id (zombie state).
    # If this fails the test is meaningless — it would just be the happy-path
    # branch under another name.
    assert run_id not in RUN_TASKS, (
        f"Zombie precondition broken: run_id {run_id} unexpectedly in RUN_TASKS"
    )

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
            f"Expected 204 from zombie heal; got {resp.status_code} body={resp.text}"
        )

        # ── (a) Postgres UPDATE with cancelled + cancelled_by_user ────────
        runs_builder = mock_supabase.table("runs")
        update_calls = runs_builder.update.call_args_list
        cancelled = [
            c for c in update_calls
            if c.args and isinstance(c.args[0], dict)
            and c.args[0].get("status") == "cancelled"
            and c.args[0].get("error") == "cancelled_by_user"
        ]
        assert cancelled, (
            f"Expected zombie-heal UPDATE with status=cancelled+error=cancelled_by_user; "
            f"got {update_calls}"
        )

        # ── (b) Synthetic terminal sentinel landed in the Redis Stream ─────
        stream_key = f"run:{run_id}"
        entries = await redis_client.xrange(stream_key)
        terminal_entries = [
            e for e in entries
            if json.loads(e[1]["data"]).get("type") == "cancelled"
            and json.loads(e[1]["data"]).get("reason") == "zombie_healed"
        ]
        assert terminal_entries, (
            f"Expected zombie_healed terminal sentinel in stream; "
            f"got entries={entries}"
        )

        # ── (c) ZREM cleared sorted-set membership ─────────────────────────
        assert await redis_client.zscore("runs:active", str(run_id)) is None, (
            f"Expected runs:active ZREMd for run {run_id}"
        )
        assert await redis_client.zscore(
            f"runs_by_thread:{THREAD_A}", str(run_id)
        ) is None, (
            f"Expected runs_by_thread:{THREAD_A} ZREMd for run {run_id}"
        )

        # ── (d) EXPIRE 60s applied (failed/cancelled bucket per D-061-04) ──
        ttl = await redis_client.ttl(stream_key)
        assert 30 < ttl <= 65, (
            f"Expected ~60s EXPIRE on zombie heal; got TTL={ttl}"
        )
    finally:
        app.dependency_overrides.pop(get_supabase, None)
