"""Phase 102 (D-12) — the ``harness_audit`` 102-kind extension + ``_AUDIT_EVENT_TYPES``
lockstep with migration 070.

Wave 0 stub (Plan 01 Task 1) that is GREEN at the end of THIS plan: Task 3 extends
``_AUDIT_EVENT_TYPES`` from 16 -> 22 in lockstep with the migration 070 CHECK and
un-marks this test. The 6 new 102 receipt kinds are the judge / publish / policy /
ask_user-approval governance events (Phase 107 reads them as a pure query later).

Runs OFFLINE — asserts the in-process fail-fast frozenset (NOT a live DB write).
CONVENTION: ``from app... import ...`` is INSIDE the test body so a not-yet-extended
symbol never breaks COLLECTION.
"""

from __future__ import annotations

import pytest

# The 6 new 102 receipt kinds migration 070 adds to the CHECK (lockstep with
# _AUDIT_EVENT_TYPES). CONTEXT D-12 / Claude's-discretion receipt naming.
_KINDS_102 = [
    "judge_verdict",
    "publish_attempted",
    "publish_blocked",
    "publish_succeeded",
    "policy_applied",
    "validator_ask_user_approved",
]


@pytest.mark.xfail(strict=False, reason="Task 3 (this plan) un-marks to GREEN after the lockstep extension")
def test_audit_accepts_102_kinds():
    """After Task 3 (migration 070 CHECK + the ``_AUDIT_EVENT_TYPES`` extension), every
    102 receipt kind is in the fail-fast frozenset; the total is 22 (16 prior + 6 new)."""
    from app.db.workflows import _AUDIT_EVENT_TYPES

    for kind in _KINDS_102:
        assert kind in _AUDIT_EVENT_TYPES, (
            f"102 receipt kind {kind!r} missing from _AUDIT_EVENT_TYPES"
        )

    # The 16 prior kinds (9 from 059 + 7 emit from 069) are still present (additive).
    for kind in (
        "phase_started",
        "phase_completed",
        "phase_transition",
        "gate_passed",
        "gate_failed",
        "tool_refused",
        "run_started",
        "run_completed",
        "run_failed",
        "emit_forced",
        "emit_recovered",
        "emit_validated",
        "emit_rejected",
        "emit_rendered",
        "emit_integrity_failed",
        "emit_failed",
    ):
        assert kind in _AUDIT_EVENT_TYPES

    # 16 prior + 6 new = 22 total kinds.
    assert len(_AUDIT_EVENT_TYPES) == 22
