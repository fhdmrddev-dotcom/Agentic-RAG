"""Phase 092 — SC#5 GET /threads/{id}/workflow reconcile contracts (Wave 0).

The RED/contract anchors Plan 02 flips from ``@pytest.mark.skip`` stubs to live
assertions:

  * ThreadWorkflowState response shape (SC#5)            -> Plan 02
  * lock_is_stale heal signal (SC#5)                     -> Plan 02
  * the GET is a PURE READ — never writes the anchor (SC#5) -> Plan 02

Each skip names its owning plan. One live structural anchor keeps the module
non-trivial under collection.

Fixtures consumed (backend/tests/conftest.py): client, mock_asyncpg_pool,
mock_builder, mock_execute_result.
"""
from __future__ import annotations

import pytest


# ── LIVE structural anchor ───────────────────────────────────────────────────

def test_lock_is_stale_derivation_rule():
    """SC#5: lock_is_stale is True iff active_workflow_run_id is set BUT the run
    row is missing or terminal. Live anchor on the pure derivation rule the
    GET endpoint computes (Plan 02 wires it against the joined read).

    A thread is never stuck Harness-locked with a terminal/absent run — the
    frontend renders lock_is_stale as Deep.
    """
    terminal = {"completed", "failed", "cancelled"}

    def lock_is_stale(active_workflow_run_id, run_status):
        # anchor set but run absent (None status) or terminal -> stale.
        if active_workflow_run_id is None:
            return False
        return run_status is None or run_status in terminal

    assert lock_is_stale(None, None) is False          # Deep — no anchor
    assert lock_is_stale("r1", "active") is False       # live lock — not stale
    assert lock_is_stale("r1", "cap_paused") is False   # paused is non-terminal
    assert lock_is_stale("r1", None) is True            # anchor set, run absent
    assert lock_is_stale("r1", "completed") is True     # anchor set, run terminal


# ── SC#5: ThreadWorkflowState shape (Plan 02) ────────────────────────────────

@pytest.mark.skip(reason="contract — owned by plan 02 (ThreadWorkflowState shape)")
def test_thread_workflow_state_shape(client):
    """SC#5: GET /threads/{id}/workflow returns ThreadWorkflowState carrying
    mode / locked / active_workflow_run_id / run_status / current_phase_* /
    lock_is_stale / cap_paused / continues_used / continues_remaining.
    """
    raise NotImplementedError("Plan 02 adds the GET /threads/{id}/workflow endpoint")


@pytest.mark.skip(reason="contract — owned by plan 02 (lock_is_stale heal)")
def test_lock_is_stale_when_run_terminal_or_absent(client, mock_asyncpg_pool):
    """SC#5: the endpoint reports lock_is_stale=true when the anchor is set but
    the workflow run row is terminal or missing (the self-heal signal).
    """
    raise NotImplementedError("Plan 02 computes lock_is_stale diagnostically")


@pytest.mark.skip(reason="contract — owned by plan 02 (pure-read invariant)")
def test_get_workflow_is_pure_read_never_writes(client, mock_asyncpg_pool):
    """SC#5: the GET never mutates the anchor — the lock-clear is owned by the
    cancel/terminal path, not by a read. Assert no UPDATE/INSERT is recorded.
    """
    raise NotImplementedError("Plan 02 keeps the GET a pure read")
