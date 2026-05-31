"""Phase 092 — MODE-01 / MODE-02 wiring contracts (Wave 0 scaffold).

These are the RED/contract anchors the downstream backend plans flip from
``@pytest.mark.skip`` stubs to live assertions:

  * create_workflow_run atomicity (Q5)           -> Plan 02
  * inputs/model persistence (SEED-047)          -> Plan 02
  * producer mode-branch above the loop (SC#1)   -> Plan 02
  * cancel/terminal clears the anchor (SC#2)     -> Plan 03

Each skip names its owning plan so each downstream plan removes its OWN skip.
One live structural anchor keeps the module non-trivial under collection.

Fixtures consumed (backend/tests/conftest.py): build_workflow_definition,
mock_asyncpg_pool, make_run_context, fake_redis.
"""
from __future__ import annotations

import pytest

from app.models.harness import WorkflowDefinition


# ── LIVE structural anchor ───────────────────────────────────────────────────

def test_wiring_module_uses_real_definition_shape(build_workflow_definition):
    """A harness kickoff is driven by a real parsed WorkflowDefinition.

    Live anchor: the create_workflow_run helper (Plan 02) inserts one
    workflow_phases row per PhaseSpec in phase_index order — this asserts the
    builder produces the ordered phase list the helper iterates.
    """
    wf = build_workflow_definition(
        [
            {"slug": "a", "phase_index": 0,
             "config": {"phase_type": "llm_single", "prompt": "x"}},
            {"slug": "b", "phase_index": 1,
             "config": {"phase_type": "llm_single", "prompt": "y"}},
            {"slug": "c", "phase_index": 2,
             "config": {"phase_type": "llm_single", "prompt": "z"}},
        ]
    )
    assert isinstance(wf, WorkflowDefinition)
    assert [p.phase_index for p in wf.phases] == [0, 1, 2]


# ── Q5: create_workflow_run atomicity (Plan 02) ──────────────────────────────

@pytest.mark.skip(reason="contract — owned by plan 02 (create_workflow_run)")
@pytest.mark.asyncio
async def test_create_workflow_run_inserts_run_phases_and_sets_anchor_atomically(
    mock_asyncpg_pool, build_workflow_definition
):
    """Q5: one workflow_runs INSERT + one workflow_phases INSERT per PhaseSpec +
    the threads UPDATE, all inside a SINGLE transaction, FK-ordered (the
    workflow_runs INSERT precedes the threads UPDATE — Landmine 9).

    Build a 3-phase definition; assert 3 phase-row inserts recorded and the
    threads anchor UPDATE lands AFTER the workflow_runs INSERT.
    """
    raise NotImplementedError("Plan 02 implements create_workflow_run")


@pytest.mark.skip(reason="contract — owned by plan 02 (SEED-047 inputs/model)")
@pytest.mark.asyncio
async def test_create_workflow_run_persists_inputs_and_model(
    mock_asyncpg_pool, build_workflow_definition
):
    """SEED-047: the workflow_runs INSERT writes the `inputs` jsonb (kickoff
    inputs) and the `model` column so the resume ctx can rehydrate them.
    """
    raise NotImplementedError("Plan 02 persists inputs + model at creation")


# ── SC#1: producer mode-branch above the loop (Plan 02) ──────────────────────

@pytest.mark.skip(reason="contract — owned by plan 02 (producer mode-branch)")
@pytest.mark.asyncio
async def test_producer_branches_harness_when_anchor_set(make_run_context):
    """SC#1: active_workflow_run_id not None -> run_workflow path; None ->
    run_agent_loop path (Deep, byte-identical). Branch lives ABOVE the loop in
    agent_runner, NEVER in a provider branch. Assert via a spy on which branch
    is taken.
    """
    raise NotImplementedError("Plan 02 wires the producer mode-branch")


# ── SC#2: cancel/terminal clears the anchor in the same transaction (Plan 03) ─

@pytest.mark.skip(reason="contract — owned by plan 03 (lock-clear txn)")
@pytest.mark.asyncio
async def test_cancel_clears_anchor_in_same_transaction(mock_asyncpg_pool):
    """SC#2: after the terminal-status write, threads.active_workflow_run_id is
    NULL, and the clear rides the SAME UPDATE/transaction as the terminal-status
    write (no dangling lock). Assert against mock_asyncpg_pool.calls.
    """
    raise NotImplementedError("Plan 03 clears the anchor on cancel/terminal")
