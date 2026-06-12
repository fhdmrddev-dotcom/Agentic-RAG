"""Phase 102 (QUAL-01) — the server-side publish path (the output-quality gate).

Wave 0 RED stubs (Plan 01 Task 1). ``POST /workflows/{id}/publish`` is the ONLY way a
draft becomes published (D-07), enforcing IN ORDER: structural lint (reachability) ->
golden run (real engine, real KB, flagged validation run) -> judge verdict -> flip.
A lint-clean workflow that produces bad output cannot publish (the HARD blocker).

A blocked publish returns a structured verdict naming the blocked stage + named failures
+ the golden ``workflow_run`` id (D-08). Behaviors target Plan 05; all
``xfail(strict=False)``. Imports INSIDE the body. The REAL acceptance is the LIVE
golden run (D-05, no-mock) on the UAT scoreboard — these offline stubs pin the contract.
"""

from __future__ import annotations

import pytest


@pytest.mark.xfail(strict=False, reason="Plan 05 not yet landed")
def test_publish_requires_business_requirement():
    """A draft with no ``business_requirement`` -> a structured 400-shaped block
    (``blocked_stage == "business_requirement"``), no flip (D-13)."""
    from app.services.harness import publish_service  # noqa: F401 — Plan 05 module

    # publish_workflow(...) over a draft with business_requirement=None returns a
    # structured block BEFORE any lint / golden run.
    assert hasattr(publish_service, "publish_workflow")


@pytest.mark.xfail(strict=False, reason="Plan 05 not yet landed")
def test_publish_pipeline_order():
    """Publish runs lint -> golden run -> judge -> flip in that order; a lint failure
    short-circuits BEFORE the golden run (no ``create_workflow_run`` call)."""
    from app.services.harness import publish_service  # noqa: F401

    # A lint-failing definition blocks with blocked_stage == "lint" and NEVER calls
    # create_workflow_run (asserted via a spy in Plan 05).
    assert hasattr(publish_service, "publish_workflow")


@pytest.mark.xfail(strict=False, reason="Plan 05 not yet landed")
def test_bad_output_blocks_publish():
    """A lint-clean workflow whose judge returns ``overall_passed=False`` -> blocked
    (``blocked_stage == "judge"``) + the ``golden_run_id`` is present + NO flip (the
    QUAL-01 hard blocker; the SEED-050 delegates-back-to-user trap)."""
    from app.services.harness import publish_service  # noqa: F401

    # A lint-clean def whose judge verdict overall_passed=False blocks at the judge
    # stage with the golden_run_id present and the definition left draft.
    assert hasattr(publish_service, "publish_workflow")
