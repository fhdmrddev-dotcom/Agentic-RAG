"""Phase 091 — HARNESS-04 validation-gate contracts (Wave-0 skeleton).

All gate execution (4 validator kinds, bounded retry, short-circuit,
skip_to_phase routing, step/wall-clock caps, fail_run-keeps-partial) is owned by
Plan 05. Each skip names Plan 05. One live assert pins the ValidatorSpec shape.
"""
from __future__ import annotations

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


@pytest.mark.skip(reason="Wave 0 contract — flipped live by Plan 05")
def test_each_of_4_validator_kinds_pass_and_fail():
    """json_schema / regex_match / workspace_file_exists / programmatic each pass + fail."""
    raise NotImplementedError


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
