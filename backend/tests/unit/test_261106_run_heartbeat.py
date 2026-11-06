"""BUG-261106-03 — a live workflow run is driven twice when a sibling worker boots.

Measured on production 2026-11-06: runs ``0c8183fc`` (tester RUN-007) and ``dc6e4c56`` each
logged TWO ``phase_started`` for step 1, and their ``claimed_at`` equals the second start
(05:06:53, 12:20:17). Nothing else in 30 days carried a claim.

Cause: ``resume_stranded_workflows`` runs in every worker's lifespan and re-drives any
``active`` run with an ``active`` step. ``claim_run``'s CAS only stops two SWEEPS racing: a
fresh run never takes a claim, so its live producer looks exactly like a dead one. When
uvicorn restarts ONE of the two workers, that worker's boot sweep claims the run the OTHER
worker is still driving.

Fix: a producer proves it is alive. ``run_heartbeat`` refreshes ``workflow_runs.updated_at``
every ``lease / 5`` seconds for as long as a step is executing, however slow the model is.
``claim_run`` only takes an ``active`` run whose heartbeat is older than the lease. A worker
that died mid-run is picked up by a second boot pass, one lease later.

The SQL tests run the REAL statements against a session-local TEMP ``workflow_runs`` (temp
tables shadow ``public`` on the search path), so the shared local database is never written.
"""

from __future__ import annotations

import asyncio
import inspect
import os
import uuid

import pytest

_DSN = os.environ.get("POSTGRES_DSN", "postgresql://postgres:postgres@127.0.0.1:54322/postgres")
LEASE = 300


async def _temp_runs_conn():
    import asyncpg

    try:
        conn = await asyncio.wait_for(asyncpg.connect(_DSN), timeout=2.0)
    except Exception:  # noqa: BLE001
        pytest.skip(f"local Postgres not reachable on {_DSN}")
    await conn.execute(
        "CREATE TEMP TABLE workflow_runs ("
        " id uuid PRIMARY KEY, status text NOT NULL,"
        " claimed_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now())"
    )
    return conn


async def _insert(conn, *, status="active", claimed_ago=None, beat_ago=0):
    run_id = uuid.uuid4()
    await conn.execute(
        "INSERT INTO workflow_runs (id, status, claimed_at, updated_at) VALUES ("
        " $1, $2,"
        " CASE WHEN $3::float8 IS NULL THEN NULL ELSE now() - make_interval(secs => $3::float8) END,"
        " now() - make_interval(secs => $4::float8))",
        run_id, status, claimed_ago, float(beat_ago),
    )
    return run_id


# ── claim_run: the sweep may only take a run whose producer is dead ──────────────


@pytest.mark.asyncio
async def test_dc6e4c56_a_live_run_is_not_claimed_by_a_booting_sibling():
    """The exact production state at 12:20:17: active, never claimed, its producer wrote
    23 s ago. Before the fix ``claim_run`` returned True and a second copy started."""
    from app.db.workflows import claim_run

    conn = await _temp_runs_conn()
    try:
        run_id = await _insert(conn, status="active", claimed_ago=None, beat_ago=23)
        assert await claim_run(conn, run_id, LEASE) is False
    finally:
        await conn.close()


@pytest.mark.asyncio
async def test_a_run_whose_producer_stopped_beating_is_claimed():
    from app.db.workflows import claim_run

    conn = await _temp_runs_conn()
    try:
        run_id = await _insert(conn, status="active", claimed_ago=None, beat_ago=LEASE + 1)
        assert await claim_run(conn, run_id, LEASE) is True
    finally:
        await conn.close()


@pytest.mark.asyncio
async def test_a_paused_run_is_claimable_however_recently_it_was_written():
    """A paused run has no producer by design: the answer route must still re-drive it at once."""
    from app.db.workflows import claim_run

    conn = await _temp_runs_conn()
    try:
        run_id = await _insert(conn, status="paused", claimed_ago=None, beat_ago=0)
        assert await claim_run(conn, run_id, LEASE) is True
    finally:
        await conn.close()


@pytest.mark.asyncio
async def test_two_sweeps_racing_a_dead_run_still_produce_one_winner():
    from app.db.workflows import claim_run

    conn = await _temp_runs_conn()
    try:
        run_id = await _insert(conn, status="active", claimed_ago=None, beat_ago=LEASE + 1)
        results = [await claim_run(conn, run_id, LEASE), await claim_run(conn, run_id, LEASE)]
        assert results == [True, False]
    finally:
        await conn.close()


@pytest.mark.asyncio
async def test_the_heartbeat_statement_only_touches_an_active_run():
    """A paused run must never be kept 'alive' — it would block the answer route's claim."""
    from app.db.workflows import touch_run_liveness

    conn = await _temp_runs_conn()
    try:
        active = await _insert(conn, status="active", beat_ago=LEASE + 1)
        paused = await _insert(conn, status="paused", beat_ago=LEASE + 1)
        await touch_run_liveness(conn, active)
        await touch_run_liveness(conn, paused)
        ages = dict(await conn.fetch(
            "SELECT id, extract(epoch FROM now() - updated_at) FROM workflow_runs"
        ))
        assert ages[active] < 5
        assert ages[paused] > LEASE
    finally:
        await conn.close()


# ── run_heartbeat: beats for as long as the step runs, whatever the model does ──


class _RecordingPool:
    def __init__(self, fail: bool = False):
        self.calls: list[tuple] = []
        self.fail = fail

    async def execute(self, sql, *args):
        self.calls.append((sql, args))
        if self.fail:
            raise ConnectionError("pool down")
        return "UPDATE 1"


@pytest.mark.asyncio
async def test_a_slow_model_call_keeps_beating():
    """The operator's question, as a test: one model call far longer than the interval (a
    27B model on a home GPU) must keep the run alive the whole time."""
    from app.services.harness.run_heartbeat import run_heartbeat

    pool = _RecordingPool()
    run_id = uuid.uuid4()
    async with run_heartbeat(pool, run_id, interval_seconds=0.02):
        await asyncio.sleep(0.2)  # "one slow model call", ten intervals long
    assert len(pool.calls) >= 5
    assert all(args == (run_id,) for _sql, args in pool.calls)


@pytest.mark.asyncio
async def test_the_heartbeat_stops_when_the_step_ends():
    from app.services.harness.run_heartbeat import run_heartbeat

    pool = _RecordingPool()
    async with run_heartbeat(pool, uuid.uuid4(), interval_seconds=0.02):
        await asyncio.sleep(0.07)
    after_exit = len(pool.calls)
    await asyncio.sleep(0.1)
    assert len(pool.calls) == after_exit


@pytest.mark.asyncio
async def test_the_heartbeat_stops_when_the_step_raises():
    from app.services.harness.run_heartbeat import run_heartbeat

    pool = _RecordingPool()
    with pytest.raises(RuntimeError):
        async with run_heartbeat(pool, uuid.uuid4(), interval_seconds=0.02):
            raise RuntimeError("step crashed")
    await asyncio.sleep(0.08)
    assert pool.calls == []


@pytest.mark.asyncio
async def test_a_failing_heartbeat_never_breaks_the_step():
    from app.services.harness.run_heartbeat import run_heartbeat

    pool = _RecordingPool(fail=True)
    async with run_heartbeat(pool, uuid.uuid4(), interval_seconds=0.02):
        await asyncio.sleep(0.1)
    assert len(pool.calls) >= 2  # it kept trying; the body finished normally


@pytest.mark.asyncio
async def test_a_step_shorter_than_one_interval_writes_nothing():
    """Every existing engine test drives instant steps: the heartbeat must add no statement."""
    from app.services.harness.run_heartbeat import run_heartbeat

    pool = _RecordingPool()
    async with run_heartbeat(pool, uuid.uuid4(), interval_seconds=0.5):
        pass
    await asyncio.sleep(0.05)
    assert pool.calls == []


def test_the_interval_leaves_four_missed_beats_inside_one_lease():
    from app.config import settings
    from app.services.harness.run_heartbeat import heartbeat_interval_seconds

    assert heartbeat_interval_seconds() * 5 <= settings.harness_resume_lease_seconds


# ── wiring ────────────────────────────────────────────────────────────────────


def test_every_step_runs_inside_the_heartbeat():
    """Sited beside ``cancellation_watch`` / ``duration_watch``: the per-step scope that is
    torn down on every exit path."""
    from app.services import harness_engine

    src = inspect.getsource(harness_engine.run_workflow)
    watch = src.index("async with cancellation_watch(redis, run_id)")
    body = src.index("outcome = await _run_phase_with_gates(", watch)
    assert "run_heartbeat(pool, run_id)" in src[watch:body]


@pytest.mark.asyncio
async def test_the_late_pass_considers_active_runs_only():
    """Paused runs were handled by the first pass and are re-driven by the answer route."""
    from app.db.workflows import find_resumable_runs

    seen: dict = {}

    class _Pool:
        async def fetch(self, sql, *args):
            seen["sql"], seen["args"] = sql, args
            return []

    await find_resumable_runs(_Pool(), include_paused=False)
    assert "'paused'" not in seen["sql"]
    await find_resumable_runs(_Pool())
    assert "'paused'" in seen["sql"]


def test_the_lifespan_schedules_a_late_pass_behind_the_boot_sweep_flag():
    import app.main as main

    src = inspect.getsource(main)
    assert "include_paused=False" in src
    late = src.index("_resume_stranded_late")
    assert "RUN_BOOT_SWEEPS" in src[late: late + 2500]
