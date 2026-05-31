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

def test_published_workflows_list_endpoint(client, mock_asyncpg_pool):
    """MODE-01 / D-01: GET /workflows/published returns the picker feed
    (id/slug/name), owner-scoped via list_published_workflows.
    """
    from unittest.mock import AsyncMock, patch

    wf_id = uuid.uuid4()
    mock_asyncpg_pool.set_fetch_result(
        [{"id": wf_id, "slug": "research_summarize", "name": "Research -> Summarize"}]
    )
    with patch("app.api.workflows.get_pg_pool",
               AsyncMock(return_value=mock_asyncpg_pool)):
        resp = client.get("/workflows/published")

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body == [
        {"id": str(wf_id), "slug": "research_summarize",
         "name": "Research -> Summarize"}
    ]


def _branch_test_supabase(thread_id, *, active_workflow_run_id=None,
                          workflow_def_row=None):
    """A per-test supabase mock for the send_message branch/lock tests.

    Routes the handler's reads:
      - threads ownership SELECT -> {id, active_workflow_run_id}
      - threads title SELECT     -> {"title": "Existing"} (skip title-gen)
      - messages INSERT          -> [{"id": <uuid>}]
      - workflow_definitions SELECT -> ``workflow_def_row`` (kickoff resolve)
    """
    from unittest.mock import MagicMock

    def _result(data):
        r = MagicMock()
        r.data = data
        return r

    threads_state = {"select_count": 0}

    def _threads_execute(*a, **k):
        threads_state["select_count"] += 1
        # 1st threads read = ownership SELECT (id + anchor);
        # later threads read = title check.
        if threads_state["select_count"] == 1:
            return _result({"id": str(thread_id),
                            "active_workflow_run_id": active_workflow_run_id})
        return _result({"title": "Existing"})

    def _messages_execute(*a, **k):
        return _result([{"id": str(uuid.uuid4())}])

    def _defs_execute(*a, **k):
        return _result(workflow_def_row)

    def _default_execute(*a, **k):
        return _result([])

    def _builder(execute_fn):
        b = MagicMock()
        for m in ("select", "insert", "update", "delete", "eq", "neq", "in_",
                  "order", "limit", "single", "maybe_single", "is_", "or_",
                  "gte", "lt", "range"):
            getattr(b, m).return_value = b
        b.execute.side_effect = execute_fn
        return b

    builders = {
        "threads": _builder(_threads_execute),
        "messages": _builder(_messages_execute),
        "workflow_definitions": _builder(_defs_execute),
        "runs": _builder(_default_execute),
    }
    default_builder = _builder(_default_execute)
    sb = MagicMock()
    sb.table.side_effect = lambda name: builders.get(name, default_builder)
    sb.rpc.return_value = default_builder
    return sb


@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_producer_branches_harness_when_anchor_set(
    fake_redis, mock_asyncpg_pool
):
    """SC#1: a kickoff send creates a workflow run + sets the anchor, and the
    producer branches to run_workflow (NOT run_agent_loop). The Deep path stays
    on run_agent_loop. The branch lives ABOVE the loop in agent_runner, never in
    a provider branch. Asserted via spies on both call paths.
    """
    import asyncio as _asyncio
    from unittest.mock import AsyncMock, patch
    from uuid import UUID

    import httpx
    from httpx import ASGITransport

    from app.main import app
    from app.dependencies import get_supabase, get_redis

    thread_id = uuid.uuid4()
    def_id = uuid.uuid4()
    new_run_id = uuid.uuid4()

    # Kickoff resolves a published, global definition.
    def_row = {
        "id": str(def_id),
        "status": "published",
        "is_global": True,
        "created_by": str(uuid.uuid4()),
        "definition": {
            "slug": "wf", "version": 1, "name": "WF", "status": "published",
            "phases": [{"slug": "p0", "phase_index": 0,
                        "config": {"phase_type": "llm_single", "prompt": "x"}}],
        },
    }
    sb = _branch_test_supabase(thread_id, workflow_def_row=def_row)

    harness_spy = AsyncMock()
    deep_spy = AsyncMock()

    app.dependency_overrides[get_supabase] = lambda: sb
    app.dependency_overrides[get_redis] = lambda: fake_redis
    try:
        with patch("app.api.threads.get_pg_pool", AsyncMock(return_value=mock_asyncpg_pool)), \
             patch("app.api.threads.insert_run", AsyncMock()), \
             patch("app.api.threads.create_workflow_run",
                   AsyncMock(return_value=new_run_id)), \
             patch("app.api.threads.generate_thread_title", return_value=("T", None)), \
             patch("app.api.threads.run_agent_loop", deep_spy), \
             patch("app.services.harness_engine.run_workflow", harness_spy), \
             patch("app.services.harness_engine._load_run_definition",
                   AsyncMock(return_value=None)):
            async with httpx.AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as c:
                resp = await c.post(
                    f"/threads/{thread_id}/messages",
                    headers={"Authorization": "Bearer test-token"},
                    json={"content": "research X",
                          "workflow_definition_id": str(def_id)},
                )
            assert resp.status_code == 201, resp.text

            # Await the spawned producer so the branch runs.
            from app.api.threads import RUN_TASKS
            run_id = UUID(resp.json()["run_id"])
            task = RUN_TASKS.get(run_id)
            if task is not None:
                try:
                    await _asyncio.wait_for(task, timeout=5.0)
                except Exception:
                    pass

            # Harness branch taken; Deep loop NOT called.
            assert harness_spy.await_count == 1
            assert deep_spy.await_count == 0
            # run_workflow driven on the new workflow run id.
            assert harness_spy.await_args.args[0] == new_run_id
    finally:
        app.dependency_overrides.pop(get_supabase, None)
        app.dependency_overrides.pop(get_redis, None)


@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_locked_thread_deep_send_refused_409(fake_redis, mock_asyncpg_pool):
    """SC#2 / MODE-02: a Deep send on a thread whose anchor points at a
    NON-TERMINAL workflow run is refused server-side with HTTP 409 — the binding
    backstop, not just a grayed button. No user message is persisted.
    """
    from unittest.mock import AsyncMock, patch

    import httpx
    from httpx import ASGITransport

    from app.main import app
    from app.dependencies import get_supabase, get_redis

    thread_id = uuid.uuid4()
    locked_run_id = uuid.uuid4()
    sb = _branch_test_supabase(thread_id, active_workflow_run_id=str(locked_run_id))

    # The locked run is non-terminal ('active') -> the lock holds.
    mock_asyncpg_pool.set_fetchval_result("active")

    app.dependency_overrides[get_supabase] = lambda: sb
    app.dependency_overrides[get_redis] = lambda: fake_redis
    try:
        with patch("app.api.threads.get_pg_pool",
                   AsyncMock(return_value=mock_asyncpg_pool)):
            async with httpx.AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as c:
                resp = await c.post(
                    f"/threads/{thread_id}/messages",
                    headers={"Authorization": "Bearer test-token"},
                    json={"content": "switch me back to deep"},
                )
        assert resp.status_code == 409, resp.text
        assert "workflow-locked" in resp.json()["detail"].lower()
    finally:
        app.dependency_overrides.pop(get_supabase, None)
        app.dependency_overrides.pop(get_redis, None)


# ── SC#2: cancel/terminal clears the anchor in the same transaction (Plan 03) ─

@pytest.mark.skip(reason="contract — owned by plan 03 (lock-clear txn)")
@pytest.mark.asyncio
async def test_cancel_clears_anchor_in_same_transaction(mock_asyncpg_pool):
    """SC#2: after the terminal-status write, threads.active_workflow_run_id is
    NULL, and the clear rides the SAME UPDATE/transaction as the terminal-status
    write (no dangling lock). Assert against mock_asyncpg_pool.calls.
    """
    raise NotImplementedError("Plan 03 clears the anchor on cancel/terminal")
