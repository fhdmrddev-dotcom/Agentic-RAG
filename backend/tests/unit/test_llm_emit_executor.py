"""Phase 101.1 (D-01 / D-10 / D-12) — the ``_exec_llm_emit`` executor contract.

Wave 0 RED stubs. The 6th harness executor (``_exec_llm_emit``) lands in the
DOWNSTREAM executor plan. These tests are ``xfail(strict=False)`` RED-by-design and
get un-marked to GREEN by that plan.

  - Pitfall 5 / D-01: the emit step does its OWN sealed forced single call — it MUST
    NOT route through the open agent loop (``run_task_sub_agent``), which is the exact
    GAP-A root cause (reasoning models narrate under ``tool_choice=auto``).
  - GAP-B / D-10: the bound library template AssetRef is injected at phase-build time —
    the model NEVER selects the template.
  - D-12: every emit transition writes an INSERT-only ``harness_audit`` receipt.

CONVENTION: ``from app.services... import ...`` is INSIDE each test body so a
not-yet-existing symbol never breaks COLLECTION.
"""

from __future__ import annotations

import pytest


@pytest.mark.xfail(strict=False, reason="101.1 executor plan (Pitfall 5 / D-01) — un-marks to GREEN")
def test_emit_never_uses_agent_loop():
    """``_exec_llm_emit`` MUST NOT invoke the open agent loop (``run_task_sub_agent``)
    — it runs a sealed forced single call instead (the GAP-A root-cause guard).
    Proven by source inspection of the executor."""
    import inspect

    from app.services.harness import phase_types

    src = inspect.getsource(phase_types._exec_llm_emit)
    assert "run_task_sub_agent" not in src, (
        "_exec_llm_emit must not call the open agent loop (GAP-A root cause / Pitfall 5)"
    )


@pytest.mark.xfail(strict=False, reason="101.1 executor plan (GAP-B / D-10) — un-marks to GREEN")
def test_bound_assetref_injected():
    """The bound library template ``AssetRef`` is resolved server-side and injected
    into the emit args at phase-build time — the model never selects the template
    (closes the GAP-B fall-through to the ephemeral-upload branch)."""
    from app.services.harness.phase_types import _emit_bound_asset_ref  # noqa: F401

    pytest.skip("AssetRef injection lands in the executor plan")


@pytest.mark.xfail(strict=False, reason="101.1 executor plan (D-12) — un-marks to GREEN")
def test_emit_writes_audit_receipt():
    """Every emit transition writes an INSERT-only ``harness_audit`` receipt
    (``emit_forced`` / ``emit_validated`` / ...) keyed to run_id + definition@version."""
    from app.db.workflows import _AUDIT_EVENT_TYPES

    # The receipt kinds the executor writes must be accepted by the audit helper.
    assert "emit_forced" in _AUDIT_EVENT_TYPES
    assert "emit_validated" in _AUDIT_EVENT_TYPES
