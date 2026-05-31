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

import uuid
from unittest.mock import AsyncMock, patch

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

def test_thread_workflow_state_shape(client, mock_asyncpg_pool, mock_execute_result):
    """SC#5: GET /threads/{id}/workflow returns ThreadWorkflowState carrying
    mode / locked / active_workflow_run_id / run_status / current_phase_* /
    lock_is_stale / cap_paused / continues_used / continues_remaining.

    Harness case: a live ('active') workflow run holding the lock at phase 1/3.
    """
    thread_id = uuid.uuid4()
    run_id = uuid.uuid4()
    # ownership SELECT returns the thread + its anchor.
    mock_execute_result.data = {
        "id": str(thread_id),
        "active_workflow_run_id": str(run_id),
    }
    # workflow_runs join, then the (skipped) deep cap_paused probe — but the run
    # is 'active' so cap_paused=False and the deep probe DOES run -> None.
    mock_asyncpg_pool.set_fetchrow_results([
        {
            "status": "active",
            "continues_used": 0,
            "definition_slug": "research_summarize",
            "definition_name": "Research -> Summarize",
            "current_phase_slug": "summarize",
            "current_phase_index": 1,
            "total_phases": 3,
        },
        None,  # latest cap_paused runs row — none
    ])

    with patch("app.api.threads.get_pg_pool",
               AsyncMock(return_value=mock_asyncpg_pool)):
        resp = client.get(f"/threads/{thread_id}/workflow")

    assert resp.status_code == 200, resp.text
    body = resp.json()
    # full shape present.
    for key in ("thread_id", "mode", "locked", "active_workflow_run_id",
                "run_status", "definition_slug", "definition_name",
                "current_phase_slug", "current_phase_index", "total_phases",
                "lock_is_stale", "cap_paused", "continues_used",
                "continues_remaining"):
        assert key in body, f"missing {key}"
    assert body["mode"] == "harness"
    assert body["locked"] is True
    assert body["lock_is_stale"] is False
    assert body["run_status"] == "active"
    assert body["definition_slug"] == "research_summarize"
    assert body["current_phase_index"] == 1
    assert body["total_phases"] == 3
    assert body["cap_paused"] is False
    assert body["continues_used"] == 0
    assert body["continues_remaining"] == 3


def test_lock_is_stale_when_run_terminal_or_absent(
    client, mock_asyncpg_pool, mock_execute_result
):
    """SC#5: the endpoint reports lock_is_stale=true when the anchor is set but
    the workflow run row is terminal or missing (the self-heal signal). The
    frontend renders such a thread as Deep.
    """
    thread_id = uuid.uuid4()
    run_id = uuid.uuid4()
    mock_execute_result.data = {
        "id": str(thread_id),
        "active_workflow_run_id": str(run_id),
    }
    # workflow_runs join -> terminal 'completed'; deep probe -> None.
    mock_asyncpg_pool.set_fetchrow_results([
        {
            "status": "completed",
            "continues_used": 0,
            "definition_slug": "wf",
            "definition_name": "WF",
            "current_phase_slug": None,
            "current_phase_index": None,
            "total_phases": 2,
        },
        None,
    ])

    with patch("app.api.threads.get_pg_pool",
               AsyncMock(return_value=mock_asyncpg_pool)):
        resp = client.get(f"/threads/{thread_id}/workflow")

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["lock_is_stale"] is True   # anchor set, run terminal
    assert body["locked"] is False         # terminal -> not locked


def test_get_workflow_is_pure_read_never_writes(
    client, mock_asyncpg_pool, mock_execute_result
):
    """SC#5: the GET never mutates the anchor — the lock-clear is owned by the
    cancel/terminal path, not by a read. Assert no UPDATE/INSERT is recorded
    against the pool.
    """
    thread_id = uuid.uuid4()
    # Deep thread (no anchor) — only the deep cap_paused probe runs.
    mock_execute_result.data = {
        "id": str(thread_id),
        "active_workflow_run_id": None,
    }
    mock_asyncpg_pool.set_fetchrow_results([None])

    with patch("app.api.threads.get_pg_pool",
               AsyncMock(return_value=mock_asyncpg_pool)):
        resp = client.get(f"/threads/{thread_id}/workflow")

    assert resp.status_code == 200, resp.text
    assert resp.json()["mode"] == "deep"
    # No write SQL recorded — pure read.
    for sql, _ in mock_asyncpg_pool.calls:
        upper = sql.upper()
        assert "UPDATE" not in upper and "INSERT" not in upper and "DELETE" not in upper, (
            f"GET reconcile must not write; saw: {sql}"
        )
