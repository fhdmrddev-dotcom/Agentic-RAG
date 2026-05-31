"""Phase 091 — HARNESS-04 validation-gate contracts (Wave-0 skeleton).

All gate execution (4 validator kinds, bounded retry, short-circuit,
skip_to_phase routing, step/wall-clock caps, fail_run-keeps-partial) is owned by
Plan 05. Each skip names Plan 05. One live assert pins the ValidatorSpec shape.
"""
from __future__ import annotations

from types import SimpleNamespace

import pytest

from app.models.harness import ValidatorSpec


def test_gates_validator_spec_shape_is_live():
    """LIVE anchor — the 4 validator kinds parse and on_failure defaults to fail_run."""
    spec = ValidatorSpec.model_validate({"kind": "json_schema", "config": {"type": "object"}})
    assert spec.kind == "json_schema"
    assert spec.on_failure == "fail_run"
    assert spec.max_retries == 2
    for kind in ("json_schema", "regex_match", "workspace_file_exists", "programmatic"):
        assert ValidatorSpec.model_validate({"kind": kind}).kind == kind


def _phase_with(validators):
    """A minimal duck-typed phase carrying validators (run_gates reads .validators)."""
    specs = [ValidatorSpec.model_validate(v) for v in validators]
    return SimpleNamespace(slug="p0", validators=specs)


@pytest.mark.asyncio
async def test_each_of_4_validator_kinds_pass_and_fail(mock_asyncpg_pool):
    """json_schema / regex_match / workspace_file_exists / programmatic each pass + fail."""
    from app.services.harness.validators import (
        VALIDATOR_REGISTRY,
        GateResult,
        register_programmatic_validator,
        run_gates,
    )

    # All 4 kinds are registered.
    assert {"json_schema", "regex_match", "workspace_file_exists", "programmatic"} <= set(
        VALIDATOR_REGISTRY
    )

    ctx = SimpleNamespace(pool=mock_asyncpg_pool, thread_id="11111111-1111-1111-1111-111111111111")

    # ── json_schema ──────────────────────────────────────────────────────────
    schema = {"type": "object", "properties": {"text": {"type": "string", "minLength": 1}}, "required": ["text"]}
    js_pass = await run_gates(_phase_with([{"kind": "json_schema", "config": {"schema": schema}}]), {"text": "hello"}, ctx)
    assert js_pass.passed and js_pass.error_message is None
    js_fail = await run_gates(_phase_with([{"kind": "json_schema", "config": {"schema": schema}}]), {"text": ""}, ctx)
    assert js_fail.passed is False and js_fail.error_message  # descriptive jsonschema message

    # ── regex_match ──────────────────────────────────────────────────────────
    rx_pass = await run_gates(_phase_with([{"kind": "regex_match", "config": {"pattern": r"DONE"}}]), {"text": "all DONE here"}, ctx)
    assert rx_pass.passed
    rx_fail = await run_gates(_phase_with([{"kind": "regex_match", "config": {"pattern": r"DONE"}}]), {"text": "still going"}, ctx)
    assert rx_fail.passed is False and "did not match" in rx_fail.error_message

    # ── workspace_file_exists (mocked DB lookup via the recording pool) ──────
    mock_asyncpg_pool.set_fetchrow_result({"id": "f", "path": "report.md"})
    wf_pass = await run_gates(_phase_with([{"kind": "workspace_file_exists", "config": {"path": "report.md"}}]), {"text": "x"}, ctx)
    assert wf_pass.passed
    mock_asyncpg_pool.set_fetchrow_result(None)
    wf_fail = await run_gates(_phase_with([{"kind": "workspace_file_exists", "config": {"path": "missing.md"}}]), {"text": "x"}, ctx)
    assert wf_fail.passed is False and "does not exist" in wf_fail.error_message

    # ── programmatic (closed registry; unknown fn raises) ────────────────────
    @register_programmatic_validator("_test_nonempty")
    async def _nonempty(output, config, ctx):  # noqa: ARG001
        ok = bool((output.get("text") or "").strip())
        return GateResult(ok, None if ok else "output text is empty")

    pg_pass = await run_gates(_phase_with([{"kind": "programmatic", "config": {"fn": "_test_nonempty"}}]), {"text": "ok"}, ctx)
    assert pg_pass.passed
    pg_fail = await run_gates(_phase_with([{"kind": "programmatic", "config": {"fn": "_test_nonempty"}}]), {"text": "  "}, ctx)
    assert pg_fail.passed is False and pg_fail.error_message == "output text is empty"

    with pytest.raises(KeyError):
        await run_gates(_phase_with([{"kind": "programmatic", "config": {"fn": "_never_registered"}}]), {"text": "x"}, ctx)


@pytest.mark.asyncio
async def test_run_gates_returns_first_failure(mock_asyncpg_pool):
    """run_gates returns the FIRST failing GateResult; passes only if all pass."""
    from app.services.harness.validators import run_gates

    ctx = SimpleNamespace(pool=mock_asyncpg_pool, thread_id="t")
    # First gate passes, second fails → the second's failure is returned.
    phase = _phase_with(
        [
            {"kind": "regex_match", "config": {"pattern": r"a"}},
            {"kind": "regex_match", "config": {"pattern": r"ZZZ"}},
        ]
    )
    result = await run_gates(phase, {"text": "a b c"}, ctx)
    assert result.passed is False and "ZZZ" in result.error_message

    # No validators → pass.
    empty = await run_gates(SimpleNamespace(slug="p", validators=[]), {"text": "x"}, ctx)
    assert empty.passed and empty.error_message is None


@pytest.mark.skip(reason="Wave 0 contract — flipped live by Plan 05")
def test_bounded_retry_reaches_failed_after_3_attempts():
    """An always-failing gate (max_retries=2) terminates in exactly 3 attempts — never loops."""
    raise NotImplementedError


@pytest.mark.skip(reason="Wave 0 contract — flipped live by Plan 05")
def test_consecutive_identical_short_circuits():
    """Identical consecutive output short-circuits the retry loop."""
    raise NotImplementedError


@pytest.mark.skip(reason="Wave 0 contract — flipped live by Plan 05")
def test_retry_feeds_error_into_prompt(make_run_context):
    """The validator error is fed back into the retry prompt (visible self-correction)."""
    raise NotImplementedError


@pytest.mark.skip(reason="Wave 0 contract — flipped live by Plan 05")
def test_skip_to_phase_routing(build_workflow_definition):
    """on_failure='skip_to_phase:<slug>' routes to the named phase (D-9)."""
    raise NotImplementedError


@pytest.mark.skip(reason="Wave 0 contract — flipped live by Plan 05")
def test_caps_step_and_wall_clock(make_run_context):
    """Per-phase step cap AND asyncio.wait_for wall-clock cap both enforced (D-12)."""
    raise NotImplementedError


@pytest.mark.skip(reason="Wave 0 contract — flipped live by Plan 05")
def test_fail_run_keeps_partial_outputs(mock_asyncpg_pool):
    """fail_run keeps completed phases' outputs + a plain-language chat reason (D-07)."""
    raise NotImplementedError
