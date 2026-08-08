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


def test_audit_accepts_102_kinds():
    """After Task 3 (migration 070 CHECK + the ``_AUDIT_EVENT_TYPES`` extension), every
    102 receipt kind is in the fail-fast frozenset; the total is 22 (16 prior + 6 new).
    Un-marked to GREEN by this plan's Task 3 (the lockstep is satisfied offline here)."""
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

    # 16 prior + 6 new = 22 total kinds at Phase 102.
    # Phase 185 / migration 114 (BUG-260731-02) adds the armed action-risk pause kind
    # `action_risk_pending` → 23. Phase 190 / migration 117 (CONN-02/CONN-03, plan
    # 190-03) adds the send receipt `external_action_sent` → 24. This pin is bumped in
    # lockstep with the _AUDIT_EVENT_TYPES extension; the drift guard that keeps the
    # Python set equal to the SQL CHECK lives in
    # tests/unit/test_audit_event_registration.py.
    assert len(_AUDIT_EVENT_TYPES) == 24
