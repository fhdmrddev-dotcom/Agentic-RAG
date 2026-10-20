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
