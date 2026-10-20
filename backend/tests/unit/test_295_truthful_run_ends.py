"""Phase 295 plan 04 (RUN-04): every run ends in a true state, with a recorded reason.

Section 1 (D-23 / D-14 / D-44, BUG-261015-01): one failure, one message, and the audit names
the real cause. Before this plan an emit step with a declared validator wrote one chat message
per ENGINE attempt (the executor's ``_surface_failure_message``) plus the engine's final one,
and the thread read "failed after 3 attempts" three times, then "failed after 9 attempts".

The run_workflow drives reuse the circuit-breaker suite's recording pool and fake Redis (the
real engine loop, no Postgres, no hang: nothing here requests a root fixture that touches the
registry). Messages are counted through the REAL ``phase_types._surface_failure_message``
wrapper: the executor fake calls it exactly as ``_exec_llm_emit`` does, and the engine's own
writer (``harness_engine._surface_failure_message``) is the one patched counter both reach.
"""
from __future__ import annotations

import asyncio
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from tests.unit.test_scheduler_circuit_breaker import _FakeRedis, _RecordingPool, _rows

VALIDATOR_TEXT = "citations_required: no field_map on output"
STEP = "Write the report"


# ── fixtures-by-hand ────────────────────────────────────────────────────────────────────────


def _ec():
    from app.services.harness import emit_cause

    return emit_cause


def _failure(failure: str, n: int):
    ec = _ec()
    records = [ec.shot_record(i + 1, [ec.KIND_MISSING_FIELDS], missing=["rows"]) for i in range(n)]
    return {
        "text": ec.compose_emit_failure(records),
        "failure": failure,
        "_surfaced": True,
        "attempt_causes": records,
    }


def _definition(*, validators, phases=2):
    from app.models.harness import WorkflowDefinition

    return WorkflowDefinition.model_validate({
        "slug": "wf", "version": 1, "name": "WF", "status": "draft",
        "phases": [
            {
                "slug": f"p{i}", "phase_index": i, "name": STEP if i == 0 else f"Step {i}",
                "config": {"phase_type": "programmatic", "fn": "noop"},
                "validators": validators if i == 0 else [],
            }
            for i in range(phases)
        ],
    })


def _validator(on_failure="fail_run", max_retries=1):
    return {"kind": "citations_required", "on_failure": on_failure, "max_retries": max_retries}


class _Executor:
    """Phase 0 replays ``outputs`` and surfaces each failure through the REAL wrapper, the way
    ``_exec_llm_emit`` does on every invocation; later phases return plain text."""

    def __init__(self, outputs):
        self.outputs = list(outputs)

    async def __call__(self, phase, accumulated, ctx):
        from app.services.harness import phase_types

        if phase.slug != "p0":
            return {"text": f"done {phase.slug}"}
        out = self.outputs.pop(0)
        if out.get("failure"):
            await phase_types._surface_failure_message(ctx, ctx.run_id, out["text"], object())
        return out


def _drive_workflow(definition, outputs, *, gate_fails=True):
    from app.services import harness_engine
    from app.services.harness.validators import GateResult

    async def _gates(phase, output, ctx, *, timing=None):
        if timing == "pre" or phase.slug != "p0" or not gate_fails:
            return GateResult(True, None)
        return GateResult(False, VALIDATOR_TEXT, 0)

    run_id = uuid.uuid4()
    pool = _RecordingPool(rows=_rows(len(definition.phases)))
    ctx = type("C", (), {})()
    ctx.run_id = run_id
    ctx.current_user = {"id": str(uuid.uuid4())}
    ctx.thread_id = str(uuid.uuid4())
    surface = AsyncMock(return_value="m-1")
    with patch.object(harness_engine, "_execute_phase", new=_Executor(outputs)), \
         patch("app.services.harness.validators.run_gates", _gates), \
         patch.object(harness_engine, "_surface_failure_message", surface):
        asyncio.run(harness_engine.run_workflow(run_id, definition, ctx, pool=pool, redis=_FakeRedis()))
    return SimpleNamespace(surface=surface, pool=pool, ctx=ctx)


def _messages(run):
    return [c.args[2] for c in run.surface.await_args_list]


def _audit_text(run):
    return " ".join(str(a) for a in run.pool.audit_rows())


def _composed(*outputs):
    records = [r for o in outputs for r in o["attempt_causes"]]
    return _ec().compose_emit_failure(records, step_name=STEP)


# ── D-23: one failure, one message ──────────────────────────────────────────────────────────


def test_a_validated_emit_failing_twice_then_failing_the_run_writes_one_message():
    outs = [_failure("template_fields_missing", 3), _failure("model_failed_to_emit", 2)]
    run = _drive_workflow(_definition(validators=[_validator()]), list(outs))
    msgs = _messages(run)
    assert len(msgs) == 1, msgs
    assert msgs[0] == _composed(*outs)
    assert "failed after 5 attempts" in msgs[0]


def test_a_phase_without_validators_keeps_the_executors_only_message():
    """D-50: the suppression must never drop the only message."""
    out = _failure("model_failed_to_emit", 2)
    run = _drive_workflow(_definition(validators=[]), [out], gate_fails=False)
    msgs = _messages(run)
    assert msgs == [out["text"]]


def test_a_valid_skip_to_surfaces_once_when_the_engine_owned_the_message():
    outs = [_failure("template_fields_missing", 1), _failure("model_failed_to_emit", 1)]
    run = _drive_workflow(_definition(validators=[_validator("skip_to_phase:p1")]), list(outs))
    msgs = _messages(run)
    assert len(msgs) == 1, msgs


def test_completed_with_failure_surfaces_the_composed_cause_once():
    """The gate passes over an output that still carries ``failure`` (a validator that does
    not see it): the phase flips failed and the run continues. One message, the cause."""
    out = _failure("model_failed_to_emit", 2)
    run = _drive_workflow(_definition(validators=[_validator()]), [out], gate_fails=False)
    msgs = _messages(run)
    assert msgs == [_composed(out)]


def test_no_message_and_no_audit_names_the_validator_shape_for_a_diagnosed_failure():
    outs = [_failure("template_fields_missing", 3), _failure("model_failed_to_emit", 2)]
    run = _drive_workflow(_definition(validators=[_validator()]), list(outs))
    blob = " ".join(_messages(run)) + " " + _audit_text(run)
    assert "no field_map on output" not in blob
    assert "citations_required" not in blob


# ── D-14 / D-44: the gate_failed audit names the executor's cause ───────────────────────────


def _drive_gates(outputs):
    from app.models.harness import PhaseSpec, ValidatorSpec
    from app.services import harness_engine
    from app.services.harness.validators import GateResult

    phase = PhaseSpec(
        slug="write-report", phase_index=1, name=STEP,
        config={"phase_type": "programmatic", "fn": "noop"},
        validators=[ValidatorSpec(kind="citations_required", on_failure="fail_run", max_retries=2)],
    )
    queue = list(outputs)

    async def _exec(ph, acc, ctx):
        return queue.pop(0)

    async def _gates(ph, output, ctx, *, timing=None):
        if timing == "pre":
            return GateResult(True, None)
        return GateResult(False, VALIDATOR_TEXT, 0)

    audit = AsyncMock()
    ctx = SimpleNamespace(current_user={"id": uuid.uuid4()}, retry_feedback=None)
    with patch.object(harness_engine, "_execute_phase", _exec), \
         patch("app.services.harness.validators.run_gates", _gates), \
         patch.object(harness_engine, "write_audit", audit), \
         patch.object(harness_engine, "_emit", AsyncMock()):
        asyncio.run(harness_engine._run_phase_with_gates(
            phase, {}, ctx, run_id=uuid.uuid4(), pool=object(), redis=object(),
            wall_clock=30, _audit_user_id=uuid.uuid4(),
        ))
    return [c.kwargs["metadata"] for c in audit.call_args_list
            if c.kwargs.get("event_type") == "gate_failed"]


def test_a_diagnosed_failure_records_the_composed_cause_as_validator_error():
    outs = [_failure("template_fields_missing", 3), _failure("model_failed_to_emit", 2),
            _failure("model_failed_to_emit", 2)]
    rows = _drive_gates(outs)
    assert rows
    for row in rows:
        assert row["validator_error"] == row["error"]
        assert "no field_map" not in row["validator_error"]


def test_an_undiagnosed_failure_keeps_the_validators_message():
    rows = _drive_gates([{"text": "x"}, {"text": "y"}, {"text": "z"}])
    assert rows and all(r["validator_error"] == VALIDATOR_TEXT for r in rows)


# ── the run_handoff helpers, directly ───────────────────────────────────────────────────────


def test_claim_failure_message_follows_the_phases_validators():
    from app.services.harness.run_handoff import claim_failure_message

    ctx = SimpleNamespace()
    claim_failure_message(ctx, SimpleNamespace(validators=[object()]))
    assert ctx.engine_owns_failure_message is True
    claim_failure_message(ctx, SimpleNamespace(validators=[]))
    assert ctx.engine_owns_failure_message is False


def test_claim_failure_message_tolerates_a_frozen_ctx():
    from app.services.harness.run_handoff import claim_failure_message

    class _Frozen:
        __slots__ = ()

    claim_failure_message(_Frozen(), SimpleNamespace(validators=[object()]))  # never raises


@pytest.mark.parametrize("owned, expect_unless, expect_if", [(True, 0, 1), (False, 1, 0)])
def test_the_two_surface_helpers_are_mirror_images(owned, expect_unless, expect_if):
    from app.services.harness.run_handoff import surface_if_engine_owned, surface_unless_engine_owns

    ctx = SimpleNamespace(engine_owns_failure_message=owned)
    s1, s2 = AsyncMock(return_value="m"), AsyncMock(return_value="m")
    asyncio.run(surface_unless_engine_owns(ctx, "r", "why", "pool", s1))
    asyncio.run(surface_if_engine_owned(ctx, "r", "why", "pool", s2))
    assert s1.await_count == expect_unless
    assert s2.await_count == expect_if


# ═════════════════════════════════════════════════════════════════════════════════════════════
#  Section 2 (D-19 / D-20 / D-41 / D-49): a cancel reads cancelled; a resume that escapes is
#  finalised with words; the sweep's dead definition ends failed; the Stop is recorded.
# ═════════════════════════════════════════════════════════════════════════════════════════════

import json  # noqa: E402

from app.services.harness_engine import set_app_shutting_down  # noqa: E402


class _NullAsync:
    def __init__(self, value):
        self.value = value

    async def __aenter__(self):
        return self.value

    async def __aexit__(self, *exc):
        return False


class _EndCon:
    def __init__(self, pool):
        self._pool = pool

    async def execute(self, sql, *args):
        return await self._pool.execute(sql, *args)

    def transaction(self):
        return _NullAsync(None)


class _EndPool:
    """Records SQL. The guarded terminal UPDATE wins only while ``status`` is in its list."""

    def __init__(self, *, status="active", display_name="Fahad Murad", active_phase=True):
        self.calls: list = []
        self.status = status
        self.display_name = display_name
        self.phase_id = uuid.uuid4()
        self.active_phase = active_phase

    async def fetchval(self, sql, *args):
        self.calls.append((sql, args))
        if sql.lstrip().startswith("UPDATE workflow_runs SET status"):
            if self.status in args[2]:
                self.status = args[1]
                return args[0]
            return None
        if "FROM profiles" in sql:
            return self.display_name
        if "SELECT status FROM workflow_runs" in sql:
            return self.status
        return None

    async def fetchrow(self, sql, *args):
        self.calls.append((sql, args))
        if "FROM workflow_phases" in sql and self.active_phase:
            return {"id": self.phase_id, "slug": "p0", "phase_index": 0, "status": "active",
                    "output": {}, "started_at": None, "completed_at": None}
        return None

    async def fetch(self, sql, *args):
        self.calls.append((sql, args))
        return []

    async def execute(self, sql, *args):
        self.calls.append((sql, args))
        return "UPDATE 1"

    def acquire(self):
        return _NullAsync(_EndCon(self))

    # readers
    def audits(self, kind=None):
        out = []
        for sql, args in self.calls:
            if "INSERT INTO harness_audit" in sql and (kind is None or args[2] == kind):
                out.append((args[2], json.loads(args[3])))
        return out

    def terminal_writes(self):
        """The GUARDED terminal writes (the winner check), not ``finish_run``'s own UPDATE."""
        return [args[1] for sql, args in self.calls
                if sql.lstrip().startswith("UPDATE workflow_runs SET status") and "ANY(" in sql]

    def finish_runs(self):
        return [args[1] for sql, args in self.calls if "UPDATE workflow_runs SET status = $2 " in sql
                and "ANY" not in sql]

    def phase_failures(self):
        return [args for sql, args in self.calls if "UPDATE workflow_phases SET status='failed'" in sql]


def _resume(pool, raises, *, shutting_down=False):
    from app.services import harness_engine

    async def _rw(*a, **k):
        if raises is not None:
            raise raises

    ctx = SimpleNamespace(current_user={"id": str(uuid.uuid4())})
    set_app_shutting_down(shutting_down)
    try:
        with patch.object(harness_engine, "run_workflow", _rw):
            asyncio.run(harness_engine._resume_run(uuid.uuid4(), object(), ctx, pool=pool, redis=None))
    finally:
        set_app_shutting_down(False)


# ── D-49: an in-process waiter reads a cancel as a cancel ───────────────────────────────────


def _author_phase():
    from app.models.harness import PhaseSpec, ValidatorSpec

    return PhaseSpec(
        slug="check", phase_index=0, config={"phase_type": "programmatic", "fn": "noop"},
        validators=[ValidatorSpec(kind="freshness", timing="pre", on_failure="ask_user")],
    )


def test_a_cancel_during_an_author_ask_user_wait_raises_cancelled_not_aborted():
    from app.services import harness_engine
    from app.services.harness import engine_ask

    audit = AsyncMock()
    subscribe = AsyncMock(return_value={"kind": "cancel"})
    ctx = SimpleNamespace(supabase=None, thread_id=None, current_user={"id": uuid.uuid4()},
                          producer_run_id=uuid.uuid4(), emit=AsyncMock())
    with patch.object(engine_ask, "write_audit", audit), \
         patch("app.services.ask_user_service.subscribe_for_response", subscribe), \
         pytest.raises(asyncio.CancelledError):
        asyncio.run(harness_engine._resolve_failure_with_ask_user(
            _author_phase(), "freshness:staleness|stale", 0, 0,
            run_id=uuid.uuid4(), pool=object(), redis=object(), ctx=ctx,
            _audit_user_id=uuid.uuid4(), is_pre=True,
        ))
    kinds = [c.kwargs.get("event_type") for c in audit.await_args_list]
    assert "run_failed" not in kinds


def _human_phase():
    return SimpleNamespace(config=SimpleNamespace(prompt="Approve?", options=["Yes", "No"],
                                                  timeout_seconds=60))


def _human_ctx():
    return SimpleNamespace(run_id=uuid.uuid4(), redis=object(), supabase=None, thread_id=None,
                           current_user={}, emit=None, is_golden_run=False,
                           resume_answered_tool_call_id=None, producer_run_id=None)


def test_a_cancel_during_a_human_step_wait_raises_cancelled_and_never_completes_it():
    from app.services.harness import human_input

    with patch.object(human_input, "subscribe_for_response",
                      AsyncMock(return_value={"kind": "cancel"})), \
         pytest.raises(asyncio.CancelledError):
        asyncio.run(human_input._exec_llm_human_input(_human_phase(), {}, _human_ctx()))


def test_a_timeout_still_pauses_the_human_step():
    from app.services.harness import human_input

    with patch.object(human_input, "subscribe_for_response", AsyncMock(return_value=None)), \
         pytest.raises(human_input.HumanInputTimeout):
        asyncio.run(human_input._exec_llm_human_input(_human_phase(), {}, _human_ctx()))


def test_the_timeout_branch_is_not_widened():
    from pathlib import Path

    src = (Path(__file__).resolve().parents[2] / "app/services/harness/human_input.py").read_text(
        encoding="utf-8"
    )
    assert src.count("    if payload is None:\n") == 1
    assert "if not payload:" not in src


# ── D-41 / D-20: _resume_run terminalizes on escape ─────────────────────────────────────────


def test_a_cancelled_resume_ends_cancelled_with_no_run_failed_and_reraises():
    pool = _EndPool()
    with pytest.raises(asyncio.CancelledError):
        _resume(pool, asyncio.CancelledError())
    assert pool.terminal_writes() == ["cancelled"]
    assert pool.finish_runs() == ["cancelled"]
    assert pool.audits("run_failed") == []


def test_a_crashed_resume_ends_failed_with_one_worded_reason_and_reraises():
    pool = _EndPool()
    with pytest.raises(RuntimeError):
        _resume(pool, RuntimeError("planted secret detail"))
    assert pool.terminal_writes() == ["failed"]
    rows = pool.audits("run_failed")
    assert len(rows) == 1
    reason = rows[0][1]["reason"]
    assert reason and "planted" not in reason and "secret" not in reason
    assert len(pool.phase_failures()) == 1, "the stranded active phase is failed with the words"


def test_a_resume_escape_during_shutdown_writes_nothing():
    pool = _EndPool()
    with pytest.raises(asyncio.CancelledError):
        _resume(pool, asyncio.CancelledError(), shutting_down=True)
    assert pool.terminal_writes() == [] and pool.audits() == []


def test_an_already_terminal_run_is_never_rewritten_by_the_resume():
    pool = _EndPool(status="completed")
    with pytest.raises(RuntimeError):
        _resume(pool, RuntimeError("late"))
    assert pool.finish_runs() == [] and pool.audits() == []


def test_a_clean_resume_writes_nothing_of_its_own():
    pool = _EndPool()
    _resume(pool, None)
    assert pool.terminal_writes() == [] and pool.audits() == []


# ── the boot sweep ──────────────────────────────────────────────────────────────────────────


def _sweep(pool, runs, *, definition="def", resume_raises=None, finalize=None, expire=None):
    from app.services import harness_engine

    async def _resume_run(*a, **k):
        if resume_raises is not None:
            raise resume_raises

    async def _build(run, redis, pool_):
        return SimpleNamespace(producer_run_id=uuid.uuid4(), run_usage_box={}, org_id=None)

    finalize = finalize or AsyncMock()
    expire = expire or AsyncMock()
    with patch.object(harness_engine, "find_resumable_runs", AsyncMock(return_value=runs)), \
         patch.object(harness_engine, "claim_run", AsyncMock(return_value=True)), \
         patch.object(harness_engine, "get_active_phase",
                      AsyncMock(return_value={"slug": "p0", "config": {}, "output": None})), \
         patch.object(harness_engine, "_load_run_definition",
                      AsyncMock(return_value=None if definition is None else object())), \
         patch.object(harness_engine, "_build_resume_context", _build), \
         patch.object(harness_engine, "_resume_run", _resume_run), \
         patch.object(harness_engine, "_expire_pending_ask_user", expire), \
         patch("app.db.runs.finalize_run", finalize):
        resumed = asyncio.run(harness_engine.resume_stranded_workflows(pool=pool, redis=None))
    return resumed, finalize, expire


def _run(**over):
    return {"run_id": uuid.uuid4(), "thread_id": uuid.uuid4(), "user_id": uuid.uuid4(), **over}


class _TwoRunPool(_EndPool):
    """Each run starts ``active`` (the guarded write wins once per run id)."""

    def __init__(self, **kw):
        super().__init__(**kw)
        self.ended: set = set()

    async def fetchval(self, sql, *args):
        if sql.lstrip().startswith("UPDATE workflow_runs SET status"):
            self.calls.append((sql, args))
            if args[0] in self.ended:
                return None
            self.ended.add(args[0])
            return args[0]
        return await super().fetchval(sql, *args)


def test_the_sweep_finalises_a_run_whose_definition_will_not_load_and_moves_on():
    pool = _TwoRunPool()
    resumed, _, _ = _sweep(pool, [_run(), _run()], definition=None)
    assert resumed == 0
    rows = pool.audits("run_failed")
    assert len(rows) == 2, "each unloadable run gets ONE worded run_failed; the loop continues"
    assert all("could not be loaded" in r[1]["reason"] for r in rows)
    assert pool.terminal_writes() == ["failed", "failed"]


def test_the_sweep_writes_the_shell_cancelled_on_a_cancelled_re_drive():
    pool = _EndPool()
    finalize = AsyncMock()
    with pytest.raises(asyncio.CancelledError):
        _sweep(pool, [_run()], resume_raises=asyncio.CancelledError(), finalize=finalize)
    assert finalize.await_args.kwargs["status"] == "cancelled"


def test_the_sweep_writes_the_shell_completed_on_a_clean_re_drive():
    pool = _EndPool()
    _, finalize, _ = _sweep(pool, [_run()])
    assert finalize.await_args.kwargs["status"] == "completed"


def test_the_sweep_never_expires_the_prompt_of_a_run_that_paused_again():
    """295-03 deferred (a): a re-driven step that pauses AGAIN (another folder found nothing,
    or a human step re-asked) must keep its NEW prompt — the sweep's cleanup used to expire it,
    so it could never be answered."""
    pool = _EndPool(status="paused")
    _, _, expire = _sweep(pool, [_run()])
    assert expire.await_count == 0


def test_the_sweep_still_expires_prompts_of_a_run_that_ended():
    pool = _EndPool(status="completed")
    _, _, expire = _sweep(pool, [_run()])
    assert expire.await_count == 1


# ── api/runs.py's answer re-drive: the shell reads cancelled on a cancel ────────────────────


def test_the_answer_re_drive_writes_the_shell_cancelled_on_a_cancel(monkeypatch):
    from app.api import runs as runs_api
    from tests.unit.test_289_redrive_failure import _NoopRedis, _paused_row, _RedriveFakePool

    row = _paused_row()
    pool = _RedriveFakePool(row)
    statuses: list = []

    async def _get_pool():
        return pool

    async def _build(_row, _redis, _pool):
        return SimpleNamespace(producer_run_id=uuid.uuid4(), run_usage_box={})

    async def _resume(*a, **k):
        raise asyncio.CancelledError()

    async def _finalize(_pool, **kw):
        statuses.append(kw["status"])

    monkeypatch.setattr("app.dependencies.get_pg_pool", _get_pool)
    monkeypatch.setattr("app.services.harness_engine._load_run_definition",
                        AsyncMock(return_value=object()))
    monkeypatch.setattr("app.services.harness_engine._build_resume_context", _build)
    monkeypatch.setattr("app.services.harness_engine._resume_run", _resume)
    monkeypatch.setattr("app.db.runs.finalize_run", _finalize)

    async def _go():
        await runs_api._redrive_paused_workflow_run(row["run_id"], "tc", _NoopRedis())
        for _ in range(10):
            await asyncio.sleep(0)

    asyncio.run(_go())
    assert statuses == ["cancelled"]


# ── D-19: a Stop that wins records who stopped it ───────────────────────────────────────────


def _cancel(pool, *, stopped_by="default"):
    from app.services.run_lifecycle import cancel_workflow_run_internals

    kw = {}
    if stopped_by is not None:
        kw["stopped_by"] = uuid.uuid4() if stopped_by == "default" else stopped_by
    return asyncio.run(cancel_workflow_run_internals(
        pool=pool, workflow_run_id=uuid.uuid4(), redis=_FakeRedis(), **kw
    ))


def test_a_stop_on_a_paused_run_records_one_reason_naming_the_person():
    pool = _EndPool(status="paused")
    assert _cancel(pool) is True
    rows = pool.audits("policy_applied")
    assert rows == [("policy_applied", {"policy": "run_cancelled", "reason": "Stopped by Fahad Murad."})]
    assert pool.audits("run_failed") == []


def test_a_stop_without_a_display_name_never_reads_an_email():
    pool = _EndPool(status="active", display_name=None)
    _cancel(pool)
    rows = pool.audits("policy_applied")
    assert rows == [("policy_applied", {"policy": "run_cancelled",
                                        "reason": "Stopped by the person who started this run."})]


def test_a_stop_on_a_terminal_run_records_nothing():
    pool = _EndPool(status="failed")
    _cancel(pool)
    assert pool.audits() == []


def test_a_cancel_with_no_person_behind_it_records_no_stop_reason():
    """The circuit breaker composes the same cancel; it is not a Stop and names nobody."""
    pool = _EndPool(status="active")
    _cancel(pool, stopped_by=None)
    assert pool.audits() == []


def test_both_stop_routes_pass_the_person_who_pressed_stop():
    from pathlib import Path

    root = Path(__file__).resolve().parents[2] / "app"
    runs_src = (root / "api/runs.py").read_text(encoding="utf-8")
    life_src = (root / "services/run_lifecycle.py").read_text(encoding="utf-8")
    assert runs_src.count('stopped_by=current_user["id"]') == 2
    assert life_src.count("stopped_by=stopped_by") == 1
    assert life_src.count('"run_cancelled"') == 1
