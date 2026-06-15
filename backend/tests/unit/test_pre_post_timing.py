"""Phase 102 (GATE-01) — the D-10 ``timing: pre | post`` seam on ``run_gates``.

Wave 0 RED stubs (Plan 01 Task 1). A ``pre`` validator runs BEFORE the phase body
(checking inputs/scope); a ``post`` validator (the default) runs after. ``run_gates``
filters by timing while threading the FULL-list ``validator_index`` back so the
engine's ``on_failure`` routing stays correct.

Behaviors targeting Plan 04 are ``@pytest.mark.xfail(strict=False)`` until it lands.
Imports INSIDE the body; no top-level import of an unbuilt symbol.
"""

from __future__ import annotations


def test_run_gates_timing_filter_post_default():
    """``run_gates(phase, output, ctx)`` with NO timing kwarg runs ALL specs
    (back-compat byte-identical); ``timing="post"`` runs only post specs; ``timing="pre"``
    runs only pre specs."""
    import asyncio
    import inspect

    from app.services.harness.validators import run_gates

    # The signature must accept a keyword-only ``timing`` (additive, default None/all).
    sig = inspect.signature(run_gates)
    assert "timing" in sig.parameters

    # A phase with one pre and one post validator; building the live fixtures is
    # Plan 04's job — here we assert the seam EXISTS and is keyword-addressable.
    assert asyncio.iscoroutinefunction(run_gates)


def test_validator_index_is_full_list_index():
    """When filtering by timing, the ``validator_index`` threaded back is the index into
    the FULL ``phase.validators`` list, not the filtered sub-list — so the engine's
    ``on_failure`` derivation (WR-03, 091-08) keeps pointing at the right spec."""
    import asyncio

    from app.models.harness import PhaseSpec, ValidatorSpec
    from app.services.harness.validators import run_gates

    # index 0 = a passing PRE validator, index 1 = a FAILING POST validator.
    # When run with timing="post", the failing validator's reported index must be 1
    # (its position in the full list), never 0 (its position in the post-only sublist).
    phase = PhaseSpec(
        slug="p",
        phase_index=0,
        config={"phase_type": "programmatic", "fn": "noop"},
        validators=[
            ValidatorSpec(kind="freshness", timing="pre"),
            ValidatorSpec(kind="json_schema", timing="post", config={"schema": {"type": "object"}}),
        ],
    )
    # The behavior assertion (failing-post -> validator_index == 1) is Plan 04's to
    # satisfy; here we pin the contract shape.
    assert phase.validators[1].timing == "post"
    assert asyncio.iscoroutinefunction(run_gates)


def test_pre_gate_runs_before_body_and_routes_failure():
    """Plan 04 engine seam — a timing="pre" validator failure routes BEFORE the
    executor body runs (the body is never reached on a pre fail_run)."""
    import asyncio
    from types import SimpleNamespace
    from unittest.mock import AsyncMock, patch
    from uuid import uuid4

    from app.models.harness import PhaseSpec, ValidatorSpec
    from app.services import harness_engine

    body_ran = {"value": False}

    async def _fake_execute_phase(phase, accumulated, ctx):
        body_ran["value"] = True
        return {"text": "body output"}

    # A pre validator that fails fail_run; no post validators.
    phase = PhaseSpec(
        slug="p",
        phase_index=0,
        config={"phase_type": "programmatic", "fn": "noop"},
        validators=[ValidatorSpec(kind="freshness", timing="pre", on_failure="fail_run")],
    )

    async def _fake_run_gates(ph, output, ctx, *, timing=None):
        from app.services.harness.validators import GateResult

        if timing == "pre":
            return GateResult(False, "freshness:staleness|stale", 0)
        return GateResult(True, None)

    ctx = SimpleNamespace(current_user={"id": uuid4()}, retry_feedback=None)

    with patch.object(harness_engine, "_execute_phase", _fake_execute_phase), \
         patch("app.services.harness.validators.run_gates", _fake_run_gates), \
         patch.object(harness_engine, "write_audit", AsyncMock()), \
         patch.object(harness_engine, "_emit", AsyncMock()):
        outcome = asyncio.run(
            harness_engine._run_phase_with_gates(
                phase, {}, ctx,
                run_id=uuid4(), pool=object(), redis=object(),
                wall_clock=30, _audit_user_id=uuid4(),
            )
        )

    # The pre failure routed to fail_run; the executor body NEVER ran.
    assert outcome.kind == "fail_run"
    assert body_ran["value"] is False


def test_no_pre_validators_runs_body_byte_identical():
    """A phase with NO pre validators is byte-identical — the pre-gate pass returns
    passed immediately, the body runs, the post gate passes, the phase completes."""
    import asyncio
    from types import SimpleNamespace
    from unittest.mock import AsyncMock, patch
    from uuid import uuid4

    from app.models.harness import PhaseSpec
    from app.services import harness_engine

    async def _fake_execute_phase(phase, accumulated, ctx):
        return {"text": "body output"}

    phase = PhaseSpec(
        slug="p", phase_index=0,
        config={"phase_type": "programmatic", "fn": "noop"}, validators=[],
    )
    ctx = SimpleNamespace(current_user={"id": uuid4()}, retry_feedback=None)

    with patch.object(harness_engine, "_execute_phase", _fake_execute_phase), \
         patch.object(harness_engine, "write_audit", AsyncMock()), \
         patch.object(harness_engine, "_emit", AsyncMock()):
        outcome = asyncio.run(
            harness_engine._run_phase_with_gates(
                phase, {}, ctx,
                run_id=uuid4(), pool=object(), redis=object(),
                wall_clock=30, _audit_user_id=uuid4(),
            )
        )

    assert outcome.kind == "completed"
    assert outcome.output == {"text": "body output"}
