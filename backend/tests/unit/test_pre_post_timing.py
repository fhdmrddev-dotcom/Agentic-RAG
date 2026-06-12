"""Phase 102 (GATE-01) — the D-10 ``timing: pre | post`` seam on ``run_gates``.

Wave 0 RED stubs (Plan 01 Task 1). A ``pre`` validator runs BEFORE the phase body
(checking inputs/scope); a ``post`` validator (the default) runs after. ``run_gates``
filters by timing while threading the FULL-list ``validator_index`` back so the
engine's ``on_failure`` routing stays correct.

Behaviors targeting Plan 04 are ``@pytest.mark.xfail(strict=False)`` until it lands.
Imports INSIDE the body; no top-level import of an unbuilt symbol.
"""

from __future__ import annotations

import pytest


@pytest.mark.xfail(strict=False, reason="Plan 04 not yet landed")
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


@pytest.mark.xfail(strict=False, reason="Plan 04 not yet landed")
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
