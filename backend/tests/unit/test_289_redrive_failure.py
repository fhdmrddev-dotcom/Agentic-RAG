"""Phase 289 (289-01, D-12 / SEED-360) — a paused run whose re-drive fails ends TRUTHFULLY.

Before 289, ``_redrive_paused_workflow_run`` had two holes, and both left a run ``active`` with
no producer behind it (F-3, reproduced live in 289-01-SUMMARY.md):

  1. ``_wake``'s ``except`` only logged. A raising ``_resume_run`` (the live failure was
     ``operator does not exist: uuid = text``) stranded the run and its human-input phase.
  2. ``_build_resume_context`` ran OUTSIDE ``_wake``, after ``resume_run`` had already flipped the
     run ``paused`` -> ``active``. A raise there reached the route's belt, which logs and returns
     200, so the run was left ``active`` too.

The fix is ONE helper, ``_fail_redrive``, called from both holes: the active phase is failed with
the worded reason, the run is finished ``failed`` (which also clears the thread anchor), and a
``run_failed`` audit row records why. Terminal is ``failed``, never re-paused (research A4): the
answer row already exists, so ``/pending`` would omit the prompt and no surface could answer it
again.

The fake pool and helpers are COPIED from ``tests/test_200_human_gate_pause.py`` (not imported:
this file lives in ``tests/unit`` and that one does not).
"""
from __future__ import annotations

import asyncio
import json
import uuid
from types import SimpleNamespace

import pytest

REASON = "Your answer was saved, but the run could not continue."


class _NoopRedis:
    async def xadd(self, key, fields, **kwargs):
        return "0-0"


class _FakeCon:
    def __init__(self, pool):
        self.pool = pool

    async def execute(self, sql, *args):
        return await self.pool.execute(sql, *args)

    def transaction(self):
        return _NullCtx(None)


class _NullCtx:
    def __init__(self, value):
        self.value = value

    async def __aenter__(self):
        return self.value

    async def __aexit__(self, *exc):
        return False


class _RedriveFakePool:
    """Records SQL and serves the rows the re-drive and its failure arm ask for."""

    def __init__(self, row, *, run_status="active", active_phase="default", fail_phase_raises=False):
        self.row = row
        self.calls: list = []
        self.claimed = True
        self.run_status = run_status
        self.phase_id = uuid.uuid4()
        self.active_phase = (
            {"id": self.phase_id, "slug": "approve", "phase_index": 1, "status": "active",
             "output": {}, "started_at": None, "completed_at": None}
            if active_phase == "default" else active_phase
        )
        self.fail_phase_raises = fail_phase_raises

    async def fetchrow(self, sql, *args):
        self.calls.append((sql, args))
        if "FROM workflow_runs wr" in sql and "wr.status = 'paused'" in sql:
            return self.row
        if "SET claimed_at = now()" in sql:
            return {"id": args[0]} if self.claimed else None
        if "FROM workflow_phases" in sql and "status = 'active'" in sql:
            return self.active_phase
        return None

    async def execute(self, sql, *args):
        self.calls.append((sql, args))
        if self.fail_phase_raises and "UPDATE workflow_phases SET status='failed'" in sql:
            raise RuntimeError("planted fail_phase failure")
        return "UPDATE 1"

    async def fetch(self, sql, *args):
        self.calls.append((sql, args))
        return []

    async def fetchval(self, sql, *args):
        self.calls.append((sql, args))
        if "FROM workflow_runs" in sql and "status" in sql:
            return self.run_status
        return None

    def acquire(self):
        return _NullCtx(_FakeCon(self))


def _paused_row(**over):
    row = {
        "run_id": uuid.uuid4(),
        "thread_id": uuid.uuid4(),
        "current_phase_id": uuid.uuid4(),
        "inputs": {},
        "org_id": None,
        "is_golden_run": False,
        "user_id": uuid.uuid4(),
    }
    row.update(over)
    return row


async def _run_redrive(monkeypatch, *, pool, resume_raises=False, build_raises=False):
    """Drive the REAL `_redrive_paused_workflow_run` with its edges faked."""
    from app.api import runs as runs_api

    async def _fake_get_pool():
        return pool

    async def _fake_load_def(_pool, _run_id):
        return object()

    async def _fake_build_ctx(_row, _redis, _pool):
        if build_raises:
            raise RuntimeError("planted _build_resume_context failure")
        return SimpleNamespace(producer_run_id=None)

    async def _fake_resume(run_id, defn, ctx, *, pool, redis):
        if resume_raises:
            raise RuntimeError("planted _resume_run failure")

    monkeypatch.setattr("app.dependencies.get_pg_pool", _fake_get_pool)
    monkeypatch.setattr("app.services.harness_engine._load_run_definition", _fake_load_def)
    monkeypatch.setattr("app.services.harness_engine._build_resume_context", _fake_build_ctx)
    monkeypatch.setattr("app.services.harness_engine._resume_run", _fake_resume)

    ok = await runs_api._redrive_paused_workflow_run(pool.row["run_id"], "tc-answered", _NoopRedis())
    for _ in range(10):
        await asyncio.sleep(0)  # let the spawned task run before asserting
    return ok


def _phase_fail_writes(pool):
    return [(s, a) for s, a in pool.calls if "UPDATE workflow_phases SET status='failed'" in s]


def _run_finish_writes(pool):
    return [(s, a) for s, a in pool.calls if "UPDATE workflow_runs SET status = $2" in s]


def _audit_writes(pool):
    return [(s, a) for s, a in pool.calls if "INSERT INTO harness_audit" in s]


def _assert_the_three_writes(pool, row):
    phase = _phase_fail_writes(pool)
    assert len(phase) == 1, "the active phase must be failed exactly once"
    assert phase[0][1][0] == pool.phase_id
    assert phase[0][1][1]["_failure_reason"] == REASON

    finish = _run_finish_writes(pool)
    assert len(finish) == 1, "the run must be finished exactly once"
    assert finish[0][1] == (row["run_id"], "failed")

    audit = _audit_writes(pool)
    assert len(audit) == 1
    run_id, user_id, event_type, metadata = audit[0][1]
    assert run_id == row["run_id"]
    assert user_id == row["user_id"], "the audit row is written as the run's owner"
    assert event_type == "run_failed"
    assert json.loads(metadata) == {"reason": "ask_user re-drive failed"}


@pytest.mark.asyncio
async def test_a_raising_resume_ends_the_run_failed_with_words(monkeypatch):
    """(a) `_resume_run` raises inside `_wake` -> phase failed + run failed + run_failed audit."""
    row = _paused_row()
    pool = _RedriveFakePool(row)
    ok = await _run_redrive(monkeypatch, pool=pool, resume_raises=True)

    assert ok is True, "the re-drive was spawned; its failure is handled inside the task"
    _assert_the_three_writes(pool, row)


@pytest.mark.asyncio
async def test_a_raising_build_context_ends_the_run_failed_and_still_returns(monkeypatch):
    """(b) `_build_resume_context` raises after `resume_run` -> same three writes, no raise."""
    row = _paused_row()
    pool = _RedriveFakePool(row)
    ok = await _run_redrive(monkeypatch, pool=pool, build_raises=True)

    assert ok is True, "the answer is recorded and the run is ended truthfully; nothing escapes"
    resumes = [s for s, _a in pool.calls if "UPDATE workflow_runs SET status = 'active'" in s]
    assert len(resumes) == 1, "precondition: the run had already been flipped off paused"
    _assert_the_three_writes(pool, row)


@pytest.mark.asyncio
async def test_a_run_already_terminal_is_not_rewritten(monkeypatch):
    """(c) the arm reads the run's status first; a terminal run is left exactly as it is."""
    row = _paused_row()
    pool = _RedriveFakePool(row, run_status="failed")
    ok = await _run_redrive(monkeypatch, pool=pool, resume_raises=True)

    assert ok is True
    assert _phase_fail_writes(pool) == []
    assert _run_finish_writes(pool) == []
    assert _audit_writes(pool) == []


@pytest.mark.asyncio
async def test_a_failing_failure_arm_is_logged_and_swallowed(monkeypatch, caplog):
    """(d) `_fail_redrive`'s own write raising never escapes, on either hole."""
    row = _paused_row()
    pool = _RedriveFakePool(row, fail_phase_raises=True)
    ok = await _run_redrive(monkeypatch, pool=pool, build_raises=True)
    assert ok is True

    row2 = _paused_row()
    pool2 = _RedriveFakePool(row2, fail_phase_raises=True)
    ok2 = await _run_redrive(monkeypatch, pool=pool2, resume_raises=True)
    assert ok2 is True
    assert any(str(row2["run_id"]) in r.getMessage() for r in caplog.records)


@pytest.mark.asyncio
async def test_no_active_phase_still_finishes_the_run_failed(monkeypatch):
    """(e) `get_active_phase` returns None -> no phase write, but the run and audit still land."""
    row = _paused_row()
    pool = _RedriveFakePool(row, active_phase=None)
    ok = await _run_redrive(monkeypatch, pool=pool, resume_raises=True)

    assert ok is True
    assert _phase_fail_writes(pool) == []
    assert _run_finish_writes(pool) and _run_finish_writes(pool)[0][1] == (row["run_id"], "failed")
    assert len(_audit_writes(pool)) == 1


# ── 289-REVIEW WR-01 — no minted producer shell is left un-finalized when the context build raises ──


def _shell_spies(monkeypatch):
    inserted: list = []
    finalized: list = []

    async def _fake_insert_run(_pool, **kw):
        inserted.append(kw)

    async def _fake_finalize_run(_pool, **kw):
        finalized.append(kw)

    monkeypatch.setattr("app.db.runs.insert_run", _fake_insert_run)
    monkeypatch.setattr("app.db.runs.finalize_run", _fake_finalize_run)
    return inserted, finalized


def _stranded(inserted, finalized):
    done = {f["run_id"] for f in finalized}
    return [i["run_id"] for i in inserted if i["status"] == "streaming" and i["run_id"] not in done]


@pytest.mark.asyncio
async def test_a_build_context_raise_never_strands_a_streaming_shell(monkeypatch):
    """WR-01: `get_service_role_supabase` refuses a falsy org and used to raise AFTER the shell
    INSERT. The caller never gets `ctx`, so it cannot finalize the shell; a stranded
    `streaming` row becomes the thread's latest runs row and defeats the F2 self-heal.
    (RED at `test(289-REVIEW): WR-01 RED`: one shell inserted, none finalized.)
    """
    from app.services.harness_engine import _build_resume_context

    inserted, finalized = _shell_spies(monkeypatch)
    row = _paused_row(org_id=None)  # and the fake pool's org read answers None too
    pool = _RedriveFakePool(row)

    with pytest.raises(ValueError):
        await _build_resume_context(dict(row), _NoopRedis(), pool)

    assert _stranded(inserted, finalized) == []


@pytest.mark.asyncio
async def test_a_raise_where_the_insert_used_to_precede_it_never_strands_a_shell(monkeypatch):
    """WR-01, the other fallible step after the old INSERT point: the ctx-model resolution."""
    from app.services.harness_engine import _build_resume_context

    inserted, finalized = _shell_spies(monkeypatch)
    monkeypatch.setattr("app.dependencies.get_service_role_supabase", lambda _org: object())
    monkeypatch.setattr("app.models.user_settings.load_user_settings", lambda _uid: None)

    def _boom(_settings):
        raise RuntimeError("planted ctx-model failure")

    monkeypatch.setattr("app.services.sub_agent_models.resolve_workflow_ctx_model", _boom)
    row = _paused_row(org_id=uuid.uuid4())
    pool = _RedriveFakePool(row)

    with pytest.raises(RuntimeError):
        await _build_resume_context(dict(row), _NoopRedis(), pool)

    assert _stranded(inserted, finalized) == []


@pytest.mark.asyncio
async def test_the_success_path_still_mints_exactly_one_shell_in_the_runs_org(monkeypatch):
    """The move must not drop the shell: one `streaming` INSERT, id == ctx.producer_run_id."""
    from app.services.harness_engine import _build_resume_context

    inserted, _finalized = _shell_spies(monkeypatch)
    monkeypatch.setattr("app.dependencies.get_service_role_supabase", lambda _org: object())
    monkeypatch.setattr("app.models.user_settings.load_user_settings", lambda _uid: None)
    org = uuid.uuid4()
    row = _paused_row(org_id=org)
    pool = _RedriveFakePool(row)

    ctx = await _build_resume_context(dict(row), _NoopRedis(), pool)

    assert len(inserted) == 1
    assert inserted[0]["status"] == "streaming"
    assert inserted[0]["run_id"] == ctx.producer_run_id
    assert inserted[0]["org_id"] == str(org)


# ── 289-REVIEW WR-02 — the terminal write IS the guard; the fail arm emits run_failed ──


class _RecordingRedis(_NoopRedis):
    def __init__(self):
        self.events: list = []

    async def xadd(self, key, fields, **kwargs):
        self.events.append((key, json.loads(fields["data"])))
        return "0-0"


class _StopRacesPool(_RedriveFakePool):
    """A Stop lands between `_fail_redrive`'s status read and its terminal write.

    The status read answers `active`; by the time any write arrives the run is `cancelled`.
    The terminal writes emulate `finish_run`'s guard (a different terminal value is refused).
    """

    async def fetchval(self, sql, *args):
        out = await super().fetchval(sql, *args)
        if "SELECT status FROM workflow_runs" in sql:
            self.run_status = "cancelled"
        return out

    async def execute(self, sql, *args):
        if "UPDATE workflow_runs SET status = $2" in sql:
            self.calls.append((sql, args))
            return "UPDATE 0" if self.run_status in ("completed", "failed", "cancelled") \
                and self.run_status != args[1] else "UPDATE 1"
        return await super().execute(sql, *args)


@pytest.mark.asyncio
async def test_a_stop_racing_the_fail_arm_leaves_no_failure_record(monkeypatch):
    """WR-02: a run the person cancelled must not get a `run_failed` audit or a failed phase."""
    row = _paused_row()
    pool = _StopRacesPool(row)
    ok = await _run_redrive(monkeypatch, pool=pool, resume_raises=True)

    assert ok is True
    assert _audit_writes(pool) == [], "no run_failed audit on a run that ended cancelled"
    assert _phase_fail_writes(pool) == [], "no failed phase on a run that ended cancelled"


@pytest.mark.asyncio
async def test_the_fail_arm_emits_run_failed_like_the_engine(monkeypatch):
    """WR-02: the engine's fail arm emits `run_failed`; the re-drive's fail arm must too."""
    row = _paused_row()
    pool = _RedriveFakePool(row)
    redis = _RecordingRedis()
    from app.api import runs as runs_api

    async def _fake_get_pool():
        return pool

    async def _fake_load_def(_pool, _run_id):
        return object()

    async def _fake_build_ctx(_row, _redis, _pool):
        return SimpleNamespace(producer_run_id=None)

    async def _fake_resume(run_id, defn, ctx, *, pool, redis):
        raise RuntimeError("planted _resume_run failure")

    monkeypatch.setattr("app.dependencies.get_pg_pool", _fake_get_pool)
    monkeypatch.setattr("app.services.harness_engine._load_run_definition", _fake_load_def)
    monkeypatch.setattr("app.services.harness_engine._build_resume_context", _fake_build_ctx)
    monkeypatch.setattr("app.services.harness_engine._resume_run", _fake_resume)

    await runs_api._redrive_paused_workflow_run(row["run_id"], "tc-answered", redis)
    for _ in range(10):
        await asyncio.sleep(0)

    failed = [(k, e) for k, e in redis.events if e.get("type") == "run_failed"]
    assert len(failed) == 1
    assert failed[0][0] == f"run:{row['run_id']}"
    assert failed[0][1]["reason"] == REASON
