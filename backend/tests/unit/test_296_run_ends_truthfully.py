"""Phase 296-02 Task 2 — every run-end path tells the truth.

* 289-IN-05   ``_redrive_paused_workflow_run`` returns True ONLY when it spawned a re-drive.
* 289-WR-06b  a lost ``claim_run`` retries ONCE after the lease, as a held task; never loops.
* 295-IN-07   the failed re-drive's ``run_failed`` audit carries the worded sentence.
* 295-IN-01   the unloadable-definition end expires the run's pending prompt (winner only).
* 295-IN-02   the reconciler ends a run whose every step completed as ``completed``.
* 295-IN-03   the zombie-arm cancel strips ``_awaiting_answer`` from the cancelled step.
* 295-RES-b   a Stop that reaches a LIVE producer still records who stopped it.
"""
from __future__ import annotations

import asyncio
import json
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from tests.unit.test_289_redrive_failure import _NoopRedis, _paused_row, _RedriveFakePool
from tests.unit.test_295_truthful_run_ends import (
    _candidate,
    _EndPool,
    _f2,
    _reconcile,
    _ReconcilePool,
)
from tests.unit.test_scheduler_circuit_breaker import _FakeRedis

SENTENCE = "The run couldn't continue after the answer was given."


class _GetRedis(_FakeRedis):
    async def get(self, key):
        return self.store.get(key)


# ── the answer re-drive ────────────────────────────────────────────────────────────────────
def _patch_redrive(monkeypatch, pool, *, build_raises=False, resume=None):
    async def _get_pool():
        return pool

    async def _build(_row, _redis, _pool):
        if build_raises:
            raise RuntimeError("planted")
        return SimpleNamespace(producer_run_id=None)

    monkeypatch.setattr("app.dependencies.get_pg_pool", _get_pool)
    monkeypatch.setattr("app.services.harness_engine._load_run_definition",
                        AsyncMock(return_value=object()))
    monkeypatch.setattr("app.services.harness_engine._build_resume_context", _build)
    monkeypatch.setattr("app.services.harness_engine._resume_run", resume or AsyncMock())


def test_a_failed_context_build_spawns_nothing_and_returns_false(monkeypatch):
    from app.api import runs as runs_api

    row = _paused_row()
    pool = _RedriveFakePool(row)
    _patch_redrive(monkeypatch, pool, build_raises=True)
    ok = asyncio.run(runs_api._redrive_paused_workflow_run(row["run_id"], "tc", _NoopRedis()))
    assert ok is False, "no task was spawned, so the re-drive did not happen"


def test_a_spawned_re_drive_returns_true(monkeypatch):
    from app.api import runs as runs_api

    row = _paused_row()
    pool = _RedriveFakePool(row)
    _patch_redrive(monkeypatch, pool)

    async def _go():
        ok = await runs_api._redrive_paused_workflow_run(row["run_id"], "tc", _NoopRedis())
        for _ in range(10):
            await asyncio.sleep(0)
        return ok

    assert asyncio.run(_go()) is True


def test_the_re_drive_select_carries_the_runs_model_and_metadata(monkeypatch):
    from app.api import runs as runs_api

    row = _paused_row()
    pool = _RedriveFakePool(row)
    pool.claimed = False
    _patch_redrive(monkeypatch, pool)
    monkeypatch.setattr(runs_api, "_REDRIVE_RETRY_DELAY_SECONDS", 0, raising=False)
    asyncio.run(runs_api._redrive_paused_workflow_run(row["run_id"], "tc", _NoopRedis(),
                                                      _retry=False))
    select = next(s for s, _a in pool.calls if "FROM workflow_runs wr" in s)
    assert "wr.model" in select and "wr.metadata" in select


def test_a_lost_claim_retries_once_after_the_lease_and_never_loops(monkeypatch):
    from app.api import runs as runs_api

    row = _paused_row()
    pool = _RedriveFakePool(row)
    pool.claimed = False  # both claims lose
    _patch_redrive(monkeypatch, pool)
    sleeps: list = []

    async def _sleep(s):
        sleeps.append(s)

    monkeypatch.setattr(runs_api.asyncio, "sleep", _sleep)

    async def _go():
        ok = await runs_api._redrive_paused_workflow_run(row["run_id"], "tc", _NoopRedis())
        held = list(runs_api._BACKGROUND_TASKS)
        for t in held:
            await t
        return ok, held

    ok, held = asyncio.run(_go())
    assert ok is False
    assert len(held) == 1, "exactly one retry task, held by a strong reference"
    claims = [s for s, _a in pool.calls if "SET claimed_at = now()" in s]
    assert len(claims) == 2, "the retry claims once more and stops"
    assert len(sleeps) == 1 and sleeps[0] > 0
    assert not runs_api._BACKGROUND_TASKS, "the done task leaves the set"


def test_a_failed_re_drive_audit_reads_the_worded_sentence():
    from app.api import runs as runs_api

    row = _paused_row()
    pool = _RedriveFakePool(row)
    asyncio.run(runs_api._fail_redrive(pool, row["run_id"], row["user_id"]))
    audits = [a for s, a in pool.calls if "INSERT INTO harness_audit" in s]
    assert len(audits) == 1
    assert json.loads(audits[0][3]) == {"reason": SENTENCE}
    assert runs_api.REDRIVE_FAILED_REASON == SENTENCE


def test_no_code_like_reason_is_left_in_the_answer_route():
    from pathlib import Path

    src = (Path(__file__).resolve().parents[2] / "app/api/runs.py").read_text(encoding="utf-8")
    code = [ln for ln in src.splitlines() if not ln.lstrip().startswith("#")]
    assert not any("ask_user re-drive failed" in ln for ln in code)


# ── 295-IN-01: the unloadable definition expires the prompt ────────────────────────────────
class _ThreadPool(_EndPool):
    thread = uuid.uuid4()

    async def fetchrow(self, sql, *args):
        if "SELECT thread_id" in sql:
            self.calls.append((sql, args))
            return {"thread_id": self.thread, "org_id": None}
        return await super().fetchrow(sql, *args)


@pytest.mark.parametrize("status, expired", [("paused", 1), ("failed", 0)])
def test_an_unloadable_end_expires_the_prompt_only_when_it_wins(status, expired):
    from app.services import harness_engine
    from app.services.harness.run_handoff import fail_unloadable_definition

    pool = _ThreadPool(status=status)
    expire = AsyncMock()
    with patch.object(harness_engine, "_expire_pending_ask_user", expire):
        asyncio.run(fail_unloadable_definition(pool, uuid.uuid4()))
    assert expire.await_count == expired
    if expired:
        assert expire.await_args.args[1] == _ThreadPool.thread


# ── 295-IN-02: every step completed → completed ────────────────────────────────────────────
def test_a_run_whose_every_step_completed_ends_completed():
    c = {**_candidate("completed"), "all_completed": True}
    pool = _ReconcilePool([c])
    n, _expire = _reconcile(pool)
    assert n == 1 and pool.ended == {c["id"]: "completed"}
    assert pool.audits("run_failed") == []


def test_the_ended_steps_query_reports_whether_every_step_completed():
    pool = _ReconcilePool([])
    _reconcile(pool)
    sql = next(s for s, _a in pool.calls if "FROM workflow_runs wr" in s)
    assert "all_completed" in sql and "recorded_not_sent" in sql


# ── 295-IN-03: the cancelled step keeps no awaiting stash ──────────────────────────────────
def test_the_zombie_cancel_strips_the_awaiting_answer_stash():
    from app.db.workflows import cancel_active_phases

    pool = MagicMock()
    pool.execute = AsyncMock()
    asyncio.run(cancel_active_phases(pool, uuid.uuid4()))
    sql = pool.execute.await_args.args[0]
    assert "- '_awaiting_answer'" in sql
    assert "WHERE workflow_run_id = $1 AND status = 'active'" in sql


# ── 295-RES-b: a Stop on a live producer names the person ──────────────────────────────────
def test_the_broadcast_carries_who_stopped_it():
    from app.services.run_lifecycle import broadcast_run_cancellation, cancelled_by

    redis = _GetRedis()
    run_id = uuid.uuid4()
    asyncio.run(broadcast_run_cancellation(redis, run_id, stopped_by="user-u"))
    assert asyncio.run(cancelled_by(redis, run_id)) == "user-u"
    other = uuid.uuid4()
    asyncio.run(broadcast_run_cancellation(redis, other))
    assert asyncio.run(cancelled_by(redis, other)) is None


def test_a_stop_on_a_live_producer_broadcasts_the_stopper_before_the_cancel():
    from app.services import run_lifecycle

    order: list = []
    task = MagicMock()
    task.done.return_value = False
    task.cancel.side_effect = lambda: order.append("cancel")
    wf_id = str(uuid.uuid4())

    async def _broadcast(redis, run_id, reason="cancelled", *, stopped_by=None):
        order.append(("broadcast", str(run_id), stopped_by))
        return True

    anchor = MagicMock()
    anchor.data = {"active_workflow_run_id": wf_id}
    run_id = uuid.uuid4()
    with patch("app.api.threads.RUN_TASKS", {run_id: task}), \
         patch("app.services.ask_user_service.publish_cancel_sentinel", AsyncMock()), \
         patch("app.utils.db.aexec", AsyncMock(return_value=anchor)), \
         patch.object(run_lifecycle, "broadcast_run_cancellation", _broadcast):
        out = asyncio.run(run_lifecycle._cancel_run_internals(
            run_id=run_id, status="streaming", thread_id=str(uuid.uuid4()),
            redis=_GetRedis(), supabase=MagicMock(), stopped_by="user-u"))
    assert out == "task_cancelled"
    assert order == [("broadcast", wf_id, "user-u"), "cancel"]


def test_the_producer_escape_records_the_stopper():
    pool = _EndPool(status="active")
    redis = _GetRedis()
    record = AsyncMock(return_value=True)
    wf = uuid.uuid4()

    async def _go():
        from app.services import run_producer
        from app.services.run_lifecycle import broadcast_run_cancellation

        async def _get_pool():
            return pool

        await broadcast_run_cancellation(redis, wf, stopped_by="user-u")
        with patch("app.api.threads.get_pg_pool", new=_get_pool), \
             patch("app.dependencies.get_pg_pool", new=_get_pool), \
             patch("app.services.harness.run_handoff.record_stop", record):
            await run_producer._finalize_producer_run(
                run_id=uuid.uuid4(), thread_id=uuid.uuid4(), redis=redis, result_sink={},
                terminal_status="cancelled", terminal_error="x",
                active_workflow_run_id=wf, resolved_provider="openai", resolved_model="m",
            )

    asyncio.run(_go())
    record.assert_awaited_once()
    args, kwargs = record.await_args
    assert args[1] == wf and args[2] == "user-u" and kwargs["policy"] == "run_cancelled"


def test_a_cancel_with_no_stopper_names_nobody():
    """The circuit breaker's cancel carries no person: the escape records no Stop."""
    pool = _EndPool(status="active")
    with patch("app.services.harness.run_handoff.record_stop", AsyncMock()) as record:
        _f2(pool, "cancelled", cancel_known=True)
    record.assert_not_awaited()
