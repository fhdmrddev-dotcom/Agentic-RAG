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

import uuid

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
    from app.db.workflows import create_workflow_run

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
    new_run_id = uuid.uuid4()
    mock_asyncpg_pool.set_fetchval_result(new_run_id)
    thread_id = uuid.uuid4()
    definition_id = uuid.uuid4()

    returned = await create_workflow_run(
        mock_asyncpg_pool,
        thread_id=thread_id,
        definition_id=definition_id,
        definition=wf,
        inputs={"kickoff_prompt": "hello"},
        model="gpt-5.4",
    )
    assert returned == new_run_id

    calls = mock_asyncpg_pool.calls
    run_insert_idx = next(
        i for i, (sql, _) in enumerate(calls)
        if "INSERT INTO workflow_runs" in sql
    )
    phase_insert_idxs = [
        i for i, (sql, _) in enumerate(calls)
        if "INSERT INTO workflow_phases" in sql
    ]
    threads_update_idx = next(
        i for i, (sql, _) in enumerate(calls)
        if "UPDATE threads SET active_workflow_run_id" in sql
    )

    # exactly one workflow_runs INSERT, one phase INSERT per PhaseSpec (3).
    assert sum(1 for sql, _ in calls if "INSERT INTO workflow_runs" in sql) == 1
    assert len(phase_insert_idxs) == 3
    # FK order: workflow_runs INSERT precedes the threads anchor UPDATE (Landmine 9).
    assert run_insert_idx < threads_update_idx
    # phase rows insert with the returned run id, in phase_index order.
    phase_args = [calls[i][1] for i in phase_insert_idxs]
    assert [a[0] for a in phase_args] == [new_run_id, new_run_id, new_run_id]
    assert [a[1] for a in phase_args] == [0, 1, 2]  # phase_index order
    assert [a[2] for a in phase_args] == ["a", "b", "c"]  # slug order
    # the anchor UPDATE points the thread at the new run.
    assert calls[threads_update_idx][1] == (thread_id, new_run_id)


@pytest.mark.asyncio
async def test_create_workflow_run_persists_inputs_and_model(
    mock_asyncpg_pool, build_workflow_definition
):
    """SEED-047: the workflow_runs INSERT writes the `inputs` jsonb (kickoff
    inputs) and the `model` column so the resume ctx can rehydrate them.
    """
    import json

    from app.db.workflows import create_workflow_run

    wf = build_workflow_definition(
        [{"slug": "a", "phase_index": 0,
          "config": {"phase_type": "llm_single", "prompt": "x"}}]
    )
    mock_asyncpg_pool.set_fetchval_result(uuid.uuid4())

    await create_workflow_run(
        mock_asyncpg_pool,
        thread_id=uuid.uuid4(),
        definition_id=uuid.uuid4(),
        definition=wf,
        inputs={"kickoff_prompt": "research mitochondria"},
        model="claude-opus-4-8",
    )

    run_insert = next(
        (sql, args) for sql, args in mock_asyncpg_pool.calls
        if "INSERT INTO workflow_runs" in sql
    )
    sql, args = run_insert
    # inputs written as json.dumps + $3::jsonb (NOT a plain dict — this file has
    # no pool JSONB codec); model on $4.
    assert "$3::jsonb" in sql
    assert json.loads(args[2]) == {"kickoff_prompt": "research mitochondria"}
    assert args[3] == "claude-opus-4-8"


@pytest.mark.asyncio
async def test_list_published_workflows_scopes_to_published_owned_or_global(
    mock_asyncpg_pool
):
    """The picker feed: only status='published' rows, scoped to (is_global OR
    created_by=user). The WHERE clause enforces the RLS-mirroring predicate
    (T-092-07) and the result carries id/slug/name.
    """
    from app.db.workflows import list_published_workflows

    wf_id = uuid.uuid4()
    mock_asyncpg_pool.set_fetch_result(
        [{"id": wf_id, "slug": "research_summarize", "name": "Research -> Summarize"}]
    )
    user_id = uuid.uuid4()

    rows = await list_published_workflows(mock_asyncpg_pool, user_id=user_id)

    assert rows == [
        {"id": wf_id, "slug": "research_summarize", "name": "Research -> Summarize"}
    ]
    sql, args = mock_asyncpg_pool.calls[-1]
    assert "status = 'published'" in sql
    assert "is_global = true OR created_by = $1" in sql
    assert args == (user_id,)


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
