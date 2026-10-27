"""296-05 (inventory row 289-V-2) — the answer re-drive's failure arms, driven against REAL Postgres.

289-REVIEW WR-01 (a raising re-drive stranded its run) and WR-06 (an unloadable definition left an
answered run ``paused``) were fixed and pinned by ``test_289_redrive_failure.py`` and
``test_296_run_ends_truthfully.py`` — but every one of those tests runs on a FAKE pool that
pattern-matches SQL text, so the real ``claim_run`` CAS, the real conditional terminal write in
``_fail_redrive``, the real ``finish_run`` and the real ``write_audit`` were never executed
against a database (289-VERIFICATION V-2: "never live-driven").

This file drives the REAL ``_redrive_paused_workflow_run`` against the local Supabase Postgres,
with faults injected at the two seams the review named:

  * the SPAWN — ``_resume_run`` raises inside the spawned producer (WR-01's arm);
  * the CLAIM — another worker holds a live ``claimed_at`` lease (WR-06b's held retry), once and
    then twice;
  * the DEFINITION — ``_load_run_definition`` returns None (WR-06).

Only the ENGINE edges are faked (definition load, context build, the producer itself). Every SQL
statement the route runs is the shipped one, and every verdict is read back from the database.

⚠ DB hygiene: each test inserts ONE fresh thread, run and phase (FK parents borrowed from an
existing run, as ``test_l01_finish_run_terminal_guard.py`` does), and deletes them — plus any
audit rows they produced — in ``finally``. No existing row is touched. Skips cleanly when
``:54322`` is down or ``workflow_runs`` is empty; a skip is not a pass.
"""
from __future__ import annotations

import asyncio
import json
import os
import uuid
from types import SimpleNamespace

import asyncpg
import pytest
import pytest_asyncio

_DSN = os.environ.get("POSTGRES_DSN", "postgresql://postgres:postgres@127.0.0.1:54322/postgres")


def _reachable() -> bool:
    async def _probe():
        con = await asyncio.wait_for(asyncpg.connect(_DSN), timeout=2.0)
        await con.close()

    try:
        loop = asyncio.new_event_loop()
        try:
            loop.run_until_complete(_probe())
        finally:
            loop.close()
        return True
    except Exception:
        return False


pytestmark = pytest.mark.skipif(not _reachable(), reason=f"local Postgres on {_DSN} not reachable")


class _NoopRedis:
    async def xadd(self, key, fields, **kwargs):
        return "0-0"


@pytest_asyncio.fixture
async def pool():
    from app.dependencies import _init_pg_connection  # the app pool's jsonb codec, not a bare pool

    p = await asyncpg.create_pool(_DSN, min_size=1, max_size=4, init=_init_pg_connection)
    try:
        yield p
    finally:
        await p.close()


@pytest_asyncio.fixture
async def paused_run(pool):
    """One answered-and-paused run on its own thread, with one active step. Removed after."""
    parent = await pool.fetchrow(
        "SELECT wr.definition_id, wr.org_id, t.user_id FROM workflow_runs wr "
        "JOIN threads t ON t.id = wr.thread_id LIMIT 1"
    )
    if parent is None:
        pytest.skip("workflow_runs is empty — no FK parents to borrow")
    thread_id, run_id, phase_id = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    await pool.execute(
        "INSERT INTO threads (id, user_id, org_id, title) VALUES ($1, $2, $3, '296-05 re-drive fault')",
        thread_id, parent["user_id"], parent["org_id"],
    )
    await pool.execute(
        "INSERT INTO workflow_runs (id, thread_id, definition_id, user_id, org_id, status, "
        "is_golden_run) VALUES ($1, $2, $3, $4, $5, 'paused', false)",
        run_id, thread_id, parent["definition_id"], parent["user_id"], parent["org_id"],
    )
    await pool.execute(
        "INSERT INTO workflow_phases (id, workflow_run_id, phase_index, slug, status, org_id) "
        "VALUES ($1, $2, 0, 'approve', 'active', $3)",
        phase_id, run_id, parent["org_id"],
    )
    await pool.execute("UPDATE threads SET active_workflow_run_id = $2 WHERE id = $1", thread_id, run_id)
    try:
        yield SimpleNamespace(run_id=run_id, thread_id=thread_id, phase_id=phase_id,
                              user_id=parent["user_id"])
    finally:
        await pool.execute("UPDATE threads SET active_workflow_run_id = NULL WHERE id = $1", thread_id)
        await pool.execute("DELETE FROM harness_audit WHERE run_id = $1", run_id)
        await pool.execute("DELETE FROM workflow_phases WHERE workflow_run_id = $1", run_id)
        await pool.execute("DELETE FROM workflow_runs WHERE id = $1", run_id)
        await pool.execute("DELETE FROM threads WHERE id = $1", thread_id)
        left = await pool.fetchval(
            "SELECT (SELECT count(*) FROM workflow_runs WHERE id = $1) "
            "+ (SELECT count(*) FROM threads WHERE id = $2)", run_id, thread_id,
        )
        assert left == 0, "the test left rows in the local DB"


def _wire(monkeypatch, pool, *, definition=object(), resume=None):
    """Fake only the ENGINE edges; every SQL statement the route runs is the shipped one."""
    seen = {"resumed": 0}

    async def _get_pool():
        return pool

    async def _load_def(_pool, _run_id):
        return definition

    async def _build_ctx(_row, _redis, _pool):
        return SimpleNamespace(producer_run_id=None)

    async def _resume(run_id, defn, ctx, *, pool, redis):
        seen["resumed"] += 1
        seen["flag"] = ctx.resume_answered_tool_call_id
        if resume is not None:
            await resume()

    monkeypatch.setattr("app.dependencies.get_pg_pool", _get_pool)
    monkeypatch.setattr("app.services.harness_engine._load_run_definition", _load_def)
    monkeypatch.setattr("app.services.harness_engine._build_resume_context", _build_ctx)
    monkeypatch.setattr("app.services.harness_engine._resume_run", _resume)
    return seen


async def _drain():
    """Wait for the held retry (`_BACKGROUND_TASKS`) AND the spawned producer (`RUN_TASKS`).

    Every write here is real I/O, so yielding with ``sleep(0)`` is not enough: a first version
    read the DB while ``_fail_redrive`` was between its status write and ``finish_run``.
    """
    from app.api import runs as runs_api

    for _ in range(200):
        pending = list(runs_api._BACKGROUND_TASKS) + list(runs_api.RUN_TASKS.values())
        if not pending:
            break
        await asyncio.wait(pending, timeout=0.1)


async def _state(pool, run):
    row = await pool.fetchrow(
        "SELECT wr.status, t.active_workflow_run_id AS anchor FROM workflow_runs wr "
        "JOIN threads t ON t.id = wr.thread_id WHERE wr.id = $1", run.run_id,
    )
    phase = await pool.fetchrow("SELECT status, output FROM workflow_phases WHERE id = $1", run.phase_id)
    audits = await pool.fetch(
        "SELECT event_type, metadata FROM harness_audit WHERE run_id = $1 ORDER BY created_at",
        run.run_id,
    )
    return row, phase, audits


def _meta(value):
    return json.loads(value) if isinstance(value, str) else (value or {})


@pytest.mark.asyncio
async def test_a_spawn_fault_ends_the_run_failed_in_the_database(monkeypatch, pool, paused_run):
    """WR-01's arm: the producer raises after the run went active. The DB must read failed."""
    from app.api import runs as runs_api

    async def _boom():
        raise RuntimeError("planted producer failure")

    seen = _wire(monkeypatch, pool, resume=_boom)
    spawned = await runs_api._redrive_paused_workflow_run(paused_run.run_id, "tc-296", _NoopRedis())
    await _drain()

    assert spawned is True, "a re-drive that started must say so (289-IN-05)"
    assert seen["resumed"] == 1 and seen["flag"] == "tc-296"
    row, phase, audits = await _state(pool, paused_run)
    assert row["status"] == "failed", "the run must END, never be left active with no producer"
    assert row["anchor"] is None, "finish_run clears the thread anchor"
    assert phase["status"] == "failed"
    assert _meta(phase["output"]).get("_failure_reason") == runs_api.REDRIVE_FAILED_REASON
    failed = [a for a in audits if a["event_type"] == "run_failed"]
    assert len(failed) == 1, f"exactly one run_failed audit, got {[a['event_type'] for a in audits]}"
    assert _meta(failed[0]["metadata"]) == {"reason": runs_api.REDRIVE_FAILED_REASON}


@pytest.mark.asyncio
async def test_a_lost_claim_waits_out_the_lease_then_re_drives_once(monkeypatch, pool, paused_run):
    """WR-06b's arm: another worker holds a live lease. The answer is not stranded: one held
    retry, after the lease, re-drives the run exactly once through the REAL claim CAS."""
    from app.api import runs as runs_api

    seen = _wire(monkeypatch, pool)
    monkeypatch.setattr(runs_api.settings, "harness_resume_lease_seconds", 1)
    await pool.execute("UPDATE workflow_runs SET claimed_at = now() WHERE id = $1", paused_run.run_id)

    spawned = await runs_api._redrive_paused_workflow_run(paused_run.run_id, "tc-296", _NoopRedis())
    assert spawned is False, "a lost claim spawns no producer"
    row, _phase, _audits = await _state(pool, paused_run)
    assert row["status"] == "paused" and seen["resumed"] == 0
    assert len(runs_api._BACKGROUND_TASKS) == 1, "exactly one held retry"

    await _drain()
    assert seen["resumed"] == 1, "the retry re-drove the run once the lease expired"
    row, _phase, _audits = await _state(pool, paused_run)
    assert row["status"] == "active", "resume_run moved it off paused before the producer ran"
    assert not runs_api._BACKGROUND_TASKS


@pytest.mark.asyncio
async def test_a_claim_lost_twice_stops_and_never_loops(monkeypatch, pool, paused_run):
    """The retry is ONE retry: if the lease is held again at retry time, the route logs and stops.
    The run stays paused (the boot sweep owns it from there) and no task is left behind."""
    from app.api import runs as runs_api

    seen = _wire(monkeypatch, pool)
    monkeypatch.setattr(runs_api.settings, "harness_resume_lease_seconds", 1)
    await pool.execute("UPDATE workflow_runs SET claimed_at = now() WHERE id = $1", paused_run.run_id)

    real_claim = None
    from app.db import workflows as db_workflows

    real_claim = db_workflows.claim_run
    calls = {"n": 0}

    async def _claim_then_reclaim(p, run_id, lease):
        calls["n"] += 1
        if calls["n"] == 2:  # just before the retry's CAS, another worker re-stamps the lease
            await p.execute("UPDATE workflow_runs SET claimed_at = now() WHERE id = $1", run_id)
        return await real_claim(p, run_id, lease)

    monkeypatch.setattr("app.db.workflows.claim_run", _claim_then_reclaim)
    assert await runs_api._redrive_paused_workflow_run(paused_run.run_id, "tc-296", _NoopRedis()) is False
    await _drain()

    assert calls["n"] == 2, "one first attempt and one retry — never a third"
    assert seen["resumed"] == 0
    assert not runs_api._BACKGROUND_TASKS
    row, _phase, audits = await _state(pool, paused_run)
    assert row["status"] == "paused" and not audits


@pytest.mark.asyncio
async def test_an_unloadable_definition_ends_the_answered_run_failed_from_paused(monkeypatch, pool, paused_run):
    """WR-06's arm: the definition will not load, so the run is never re-driven — it ENDS, from
    `paused`, with the worded reason, instead of staying paused with no prompt to answer."""
    from app.api import runs as runs_api

    seen = _wire(monkeypatch, pool, definition=None)
    spawned = await runs_api._redrive_paused_workflow_run(paused_run.run_id, "tc-296", _NoopRedis())
    await _drain()

    assert spawned is False and seen["resumed"] == 0
    row, phase, audits = await _state(pool, paused_run)
    assert row["status"] == "failed" and row["anchor"] is None
    assert _meta(phase["output"]).get("_failure_reason") == runs_api._REDRIVE_NO_DEFINITION_REASON
    failed = [a for a in audits if a["event_type"] == "run_failed"]
    assert len(failed) == 1
    assert _meta(failed[0]["metadata"]) == {"reason": runs_api._REDRIVE_NO_DEFINITION_REASON}
