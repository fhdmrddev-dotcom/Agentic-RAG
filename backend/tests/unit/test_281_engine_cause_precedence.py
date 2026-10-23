"""Phase 281 (FIX-09 / D-04 / D-05 / D-25 / D-26 / D-30 / D-32) — engine cause precedence.

The golden run 43b34171's emit step diagnosed its own failure (a missing ``rows`` key, then
narration), and the declared post-gate ``citations_required`` validator — which only sees
the failure output's SHAPE — then overwrote it: ``run_failed.reason`` read
``Phase 2 (emit) gate failed after 3 attempt(s): citations_required: no field_map on
output``. "The least informative error wins by being last."

These cases drive ``_run_phase_with_gates`` on the ``test_pre_post_timing.py`` harness (no
root conftest fixtures, so the ``test_harness_gates`` hang cannot reach them). Expected
strings are BUILT by calling ``compose_emit_failure`` — the words are never retyped here.
"""

from __future__ import annotations

import ast
import asyncio
import inspect
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

VALIDATOR_TEXT = "citations_required: no field_map on output"


def _phase(name="Write the report", *, max_retries=2):
    from app.models.harness import PhaseSpec, ValidatorSpec

    return PhaseSpec(
        slug="write-report",
        phase_index=1,
        name=name,
        config={"phase_type": "programmatic", "fn": "noop"},
        validators=[
            ValidatorSpec(kind="citations_required", on_failure="fail_run", max_retries=max_retries)
        ],
    )


def _ec():
    from app.services.harness import emit_cause

    return emit_cause


def _golden_invocations():
    """Per ENGINE attempt, the records the executor returned (9 sealed calls in total)."""
    ec = _ec()
    miss = lambda n: ec.shot_record(n, [ec.KIND_MISSING_FIELDS], missing=["rows"])  # noqa: E731
    return [
        [miss(1), miss(2), miss(3)],
        [miss(1), miss(2), ec.shot_record(3, [ec.KIND_NARRATED])],
        [miss(1), miss(2), ec.shot_record(3, [ec.KIND_NARRATED])],
    ]


def _failure_output(records, failure, *, text=None):
    """The ``_emit_failure_output`` shape (``_surfaced`` + ``attempt_causes``)."""
    return {
        "text": text if text is not None else _ec().compose_emit_failure(records),
        "failure": failure,
        "_surfaced": True,
        "attempt_causes": records,
    }


def _drive(phase, outputs, *, validator_text=VALIDATOR_TEXT):
    """Run ``_run_phase_with_gates`` over a queue of executor outputs; the post gate always
    fails with ``validator_text``. Returns (outcome, executions, feedback_seen, audit, emit)."""
    from app.services import harness_engine

    queue = list(outputs)
    executions = {"n": 0}
    feedback_seen: list = []

    async def _fake_execute_phase(ph, accumulated, ctx):
        feedback_seen.append(ctx.retry_feedback)
        executions["n"] += 1
        return queue.pop(0)

    async def _fake_run_gates(ph, output, ctx, *, timing=None):
        from app.services.harness.validators import GateResult

        if timing == "pre":
            return GateResult(True, None)
        return GateResult(False, validator_text, 0)

    ctx = SimpleNamespace(current_user={"id": uuid4()}, retry_feedback=None)
    audit = AsyncMock()
    emit = AsyncMock()
    with patch.object(harness_engine, "_execute_phase", _fake_execute_phase), \
         patch("app.services.harness.validators.run_gates", _fake_run_gates), \
         patch.object(harness_engine, "write_audit", audit), \
         patch.object(harness_engine, "_emit", emit):
        outcome = asyncio.run(
            harness_engine._run_phase_with_gates(
                phase, {}, ctx,
                run_id=uuid4(), pool=object(), redis=object(),
                wall_clock=30, _audit_user_id=uuid4(),
            )
        )
    return outcome, executions["n"], feedback_seen, audit, emit


def _golden_outputs():
    inv = _golden_invocations()
    return [
        _failure_output(inv[0], "template_fields_missing"),
        _failure_output(inv[1], "model_failed_to_emit"),
        _failure_output(inv[2], "model_failed_to_emit"),
    ]


def _all_records():
    return [r for inv in _golden_invocations() for r in inv]


def test_the_executor_diagnosis_wins_and_is_the_final_reason():
    outcome, n, _, _, _ = _drive(_phase(), _golden_outputs())
    assert n == 3
    assert outcome.kind == "fail_run"
    expected = _ec().compose_emit_failure(_all_records(), step_name="Write the report")
    assert outcome.reason == expected
    assert outcome.reason.startswith('Step "Write the report" failed after 9 attempts:')
    for absent in ("write-report", "Phase 2 (", "citations_required", "no field_map", "invented="):
        assert absent not in outcome.reason, absent


def test_gate_failed_audit_and_sse_carry_the_cause_and_keep_the_validator_text():
    outcome, _, _, audit, emit = _drive(_phase(), _golden_outputs())
    gate_rows = [c.kwargs["metadata"] for c in audit.call_args_list
                 if c.kwargs.get("event_type") == "gate_failed"]
    assert len(gate_rows) == 3
    assert gate_rows[-1]["error"] == outcome.reason
    # ⚠ RE-PINNED DELIBERATELY at Phase 295 plan 04 (D-14 / D-44), retired by name rather than
    #   tripped by surprise (the SEED-177 rule). This line used to read
    #   ``assert all(row["validator_error"] == VALIDATOR_TEXT for row in gate_rows)``: 281 kept
    #   the validator's text in the audit "so nothing is lost". For a DIAGNOSED emit failure that
    #   text is the validator reading the failure output's SHAPE ("no field_map on output"), so
    #   a no-template run's ledger named a citation error that never happened. The audit's
    #   validator_error is now the executor's composed cause, the same string as ``error``. An
    #   undiagnosed failure still records the validator's own message (test_295_truthful_run_ends).
    assert all(row["validator_error"] == row["error"] for row in gate_rows)
    assert not any(VALIDATOR_TEXT in row["validator_error"] for row in gate_rows)
    # attempt 0's row already carries the composed cause SO FAR (3 records).
    first = _ec().compose_emit_failure(_golden_invocations()[0], step_name="Write the report")
    assert gate_rows[0]["error"] == first
    sse = [c.kwargs for c in emit.call_args_list if len(c.args) > 2 and c.args[2] == "gate_failed"]
    assert [s["error"] for s in sse] == [row["error"] for row in gate_rows]


def test_retry_feedback_carries_the_executor_cause_not_the_validator_shape():
    """D-26 — a deliberate MODEL-INPUT change: the retry prompt carries the true cause."""
    _, _, feedback, _, _ = _drive(_phase(), _golden_outputs())
    assert feedback[0] is None
    assert "these fields were missing: rows" in feedback[1]
    assert "no field_map" not in feedback[1]
    assert "citations_required" not in feedback[1]


def test_identical_diagnosed_outputs_still_short_circuit():
    """Pitfall 4 / T-281-05: outputs that differ only in ``text`` / ``attempt_causes`` are
    the same attempt — exactly 2 executions, not 3."""
    ec = _ec()
    first = _failure_output([ec.shot_record(1, [ec.KIND_NARRATED])], "model_failed_to_emit",
                            text="first wording")
    second = _failure_output([ec.shot_record(1, [ec.KIND_NARRATED]), ec.shot_record(2, [ec.KIND_NARRATED])],
                             "model_failed_to_emit", text="second wording")
    outcome, n, _, _, _ = _drive(_phase(), [first, second, second])
    assert n == 2
    assert outcome.kind == "fail_run"


def test_a_non_diagnosed_failure_keeps_the_prefix_byte_identically():
    outcome, n, _, _, _ = _drive(_phase(), [{"text": "x"}, {"text": "x"}, {"text": "x"}])
    assert n == 2  # identical outputs, unchanged short-circuit
    assert outcome.reason == (
        "Phase 2 (write-report) gate failed after 2 attempt(s): "
        "citations_required: no field_map on output"
    )


@pytest.mark.parametrize("blank", [None, "   "])
def test_d32_unnamed_step_reads_this_step(blank):
    outcome, _, _, _, _ = _drive(_phase(name=blank), _golden_outputs())
    assert outcome.reason.startswith("This step failed after 9 attempts:")
    assert "write-report" not in outcome.reason


def _blocked(reason, name):
    from app.services.harness.publish_service import _blocked_step

    phases = [
        {"phase_index": 0, "slug": "gather", "status": "completed", "output": {"text": "ok"}},
        {"phase_index": 1, "slug": "write-report", "status": "failed",
         "output": {"_failure_reason": reason}},
    ]
    definition = SimpleNamespace(phases=[
        SimpleNamespace(phase_index=0, slug="gather", name=None),
        SimpleNamespace(phase_index=1, slug="write-report", name=name),
    ])
    return _blocked_step(phases, definition)


def test_d04_publish_twin_named():
    """One string: the gauntlet's cause IS the engine's reason (the prefix regex is a no-op)."""
    outcome, _, _, _, _ = _drive(_phase(), _golden_outputs())
    step = _blocked(outcome.reason, "Write the report")
    assert step["cause"] == step["reason"] == outcome.reason
    assert step["cause"].startswith('Step "Write the report" failed after 9 attempts:')
    assert step["step_name"] == "Write the report"


def test_d04_publish_twin_unnamed_keeps_step_name_null():
    outcome, _, _, _, _ = _drive(_phase(name=None), _golden_outputs())
    step = _blocked(outcome.reason, None)
    assert step["cause"] == step["reason"] == outcome.reason
    assert step["cause"].startswith("This step")
    assert step["step_name"] is None  # null-not-backfilled


def test_the_no_validator_branch_composes_the_same_cause():
    """SOURCE-LEVEL (driving run_workflow needs the root fixtures that hang): the emit-failure
    ``fail_phase`` call in ``run_workflow`` passes the composed cause — with the author-set
    name — and keeps the raw code only as the fallback."""
    from app.services import harness_engine

    tree = ast.parse(inspect.getsource(harness_engine.run_workflow).lstrip())
    hits = []
    for node in ast.walk(tree):
        if (
            isinstance(node, ast.Call)
            and getattr(node.func, "id", None) == "fail_phase"
            and any(k.arg == "output" and getattr(k.value, "id", None) == "durable_output"
                    for k in node.keywords)
            and len(node.args) >= 3
        ):
            hits.append(node.args[2])
    assert len(hits) == 1, f"expected one emit-failure fail_phase call, found {len(hits)}"
    reason = hits[0]
    assert isinstance(reason, ast.BoolOp) and isinstance(reason.op, ast.Or)
    composed, fallback = reason.values
    assert isinstance(composed, ast.Call) and getattr(composed.func, "id", None) == "compose_emit_failure"
    assert any(k.arg == "step_name" for k in composed.keywords)
    assert "attempt_causes" in ast.unparse(composed.args[0])
    assert ast.unparse(fallback) == "str(_emit_failure)"
