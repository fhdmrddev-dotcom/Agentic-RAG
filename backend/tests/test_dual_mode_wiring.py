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
    owner_id = uuid.uuid4()

    returned = await create_workflow_run(
        mock_asyncpg_pool,
        thread_id=thread_id,
        definition_id=definition_id,
        definition=wf,
        inputs={"kickoff_prompt": "hello"},
        model="gpt-5.4",
        user_id=owner_id,
    )
    assert returned == new_run_id

    calls = mock_asyncpg_pool.calls
    run_insert_idx = next(
        i for i, (sql, _) in enumerate(calls)
        if "INSERT INTO workflow_runs" in sql
    )
    # Phase 092-05 F1: the run-owner user_id is in the INSERT column list AND bound.
    run_insert_sql, run_insert_args = calls[run_insert_idx]
    assert "user_id" in run_insert_sql
    assert owner_id in run_insert_args
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

    owner_id = uuid.uuid4()
    await create_workflow_run(
        mock_asyncpg_pool,
        thread_id=uuid.uuid4(),
        definition_id=uuid.uuid4(),
        definition=wf,
        inputs={"kickoff_prompt": "research mitochondria"},
        model="claude-opus-4-8",
        user_id=owner_id,
    )

    run_insert = next(
        (sql, args) for sql, args in mock_asyncpg_pool.calls
        if "INSERT INTO workflow_runs" in sql
    )
    sql, args = run_insert
    # inputs written as json.dumps + $3::jsonb (NOT a plain dict — this file has
    # no pool JSONB codec); model on $4; user_id on $5 (Phase 092-05 F1).
    assert "$3::jsonb" in sql
    assert json.loads(args[2]) == {"kickoff_prompt": "research mitochondria"}
    assert args[3] == "claude-opus-4-8"
    assert args[4] == owner_id


# ── F1 (092-05): write_audit binds the run-owner user_id ─────────────────────

@pytest.mark.asyncio
async def test_write_audit_includes_user_id_in_insert(mock_asyncpg_pool):
    """F1: write_audit MUST issue a 4-column INSERT
    ``(run_id, user_id, event_type, metadata)`` binding the owner user_id (the
    column is NOT NULL — the prior 3-column INSERT killed every live run). Assert
    the SQL string shape + the exact bind order against the mock pool.
    """
    import json

    from app.db.workflows import write_audit

    run_id = uuid.uuid4()
    owner_id = uuid.uuid4()
    await write_audit(
        mock_asyncpg_pool,
        run_id,
        user_id=owner_id,
        event_type="phase_started",
        metadata={"phase": "p0"},
    )

    sql, args = mock_asyncpg_pool.calls[-1]
    assert "INSERT INTO harness_audit (run_id, user_id, event_type, metadata)" in sql
    # bind order: run_id, user_id, event_type, json.dumps(metadata)
    assert args[0] == run_id
    assert args[1] == owner_id
    assert args[2] == "phase_started"
    assert json.loads(args[3]) == {"phase": "p0"}


@pytest.mark.asyncio
async def test_write_audit_rejects_unknown_event_type_before_insert(mock_asyncpg_pool):
    """The _AUDIT_EVENT_TYPES fail-fast guard is preserved: an unknown event_type
    raises ValueError BEFORE any INSERT is issued (no harness_audit write recorded).
    """
    from app.db.workflows import write_audit

    with pytest.raises(ValueError, match="event_type"):
        await write_audit(
            mock_asyncpg_pool,
            uuid.uuid4(),
            user_id=uuid.uuid4(),
            event_type="not_a_real_event",
            metadata={},
        )
    # the guard fires before the INSERT — nothing recorded.
    assert not any(
        "INSERT INTO harness_audit" in sql for sql, _ in mock_asyncpg_pool.calls
    )


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


# ── F2 (092-05): a harness run that escapes terminalizes + clears the anchor ──

@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_harness_failure_terminalizes_and_clears_anchor(
    fake_redis, mock_asyncpg_pool
):
    """F2: when the harness producer branch raises (run_workflow blows up before
    reaching its own finish_run), the producer's finalize path calls
    finish_run(pool, <workflow run id>, "failed") exactly once — terminalizing
    workflow_runs AND clearing threads.active_workflow_run_id. Without this the
    thread is wedged locked (lock_is_stale=false, no UI recovery).
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

    # run_workflow blows up mid-run (never reaches its own finish_run).
    boom = AsyncMock(side_effect=RuntimeError("phase exploded"))
    finish_spy = AsyncMock()

    app.dependency_overrides[get_supabase] = lambda: sb
    app.dependency_overrides[get_redis] = lambda: fake_redis
    try:
        with patch("app.api.threads.get_pg_pool", AsyncMock(return_value=mock_asyncpg_pool)), \
             patch("app.api.threads.insert_run", AsyncMock()), \
             patch("app.api.threads.create_workflow_run",
                   AsyncMock(return_value=new_run_id)), \
             patch("app.api.threads.generate_thread_title", return_value=("T", None)), \
             patch("app.api.threads.finalize_run", AsyncMock()), \
             patch("app.db.workflows.finish_run", finish_spy), \
             patch("app.services.harness_engine.run_workflow", boom), \
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

            from app.api.threads import RUN_TASKS
            run_id = UUID(resp.json()["run_id"])
            task = RUN_TASKS.get(run_id)
            if task is not None:
                try:
                    await _asyncio.wait_for(task, timeout=5.0)
                except Exception:
                    pass

            # F2: finish_run called exactly once, on the WORKFLOW run id, 'failed'
            # — terminalizes workflow_runs + clears the anchor (no wedged lock).
            assert finish_spy.await_count == 1
            assert finish_spy.await_args.args[1] == new_run_id
            assert finish_spy.await_args.args[2] == "failed"
    finally:
        app.dependency_overrides.pop(get_supabase, None)
        app.dependency_overrides.pop(get_redis, None)


@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_deep_run_failure_does_not_terminalize_workflow(
    fake_redis, mock_asyncpg_pool
):
    """F2 negative: a Deep send (no workflow anchor) that fails MUST NOT call the
    workflow finish_run from the producer finalize path — the F2 terminalize is
    gated on _active_workflow_run_id and a Deep run leaves it None (byte-identical).
    """
    import asyncio as _asyncio
    from unittest.mock import AsyncMock, patch
    from uuid import UUID

    import httpx
    from httpx import ASGITransport

    from app.main import app
    from app.dependencies import get_supabase, get_redis

    thread_id = uuid.uuid4()
    # Deep thread — no workflow_definition_id, no anchor.
    sb = _branch_test_supabase(thread_id)

    boom = AsyncMock(side_effect=RuntimeError("deep loop exploded"))
    finish_spy = AsyncMock()

    app.dependency_overrides[get_supabase] = lambda: sb
    app.dependency_overrides[get_redis] = lambda: fake_redis
    try:
        with patch("app.api.threads.get_pg_pool", AsyncMock(return_value=mock_asyncpg_pool)), \
             patch("app.api.threads.insert_run", AsyncMock()), \
             patch("app.api.threads.generate_thread_title", return_value=("T", None)), \
             patch("app.api.threads.finalize_run", AsyncMock()), \
             patch("app.db.workflows.finish_run", finish_spy), \
             patch("app.api.threads.run_agent_loop", boom):
            async with httpx.AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as c:
                resp = await c.post(
                    f"/threads/{thread_id}/messages",
                    headers={"Authorization": "Bearer test-token"},
                    json={"content": "just a deep chat"},
                )
            assert resp.status_code == 201, resp.text

            from app.api.threads import RUN_TASKS
            run_id = UUID(resp.json()["run_id"])
            task = RUN_TASKS.get(run_id)
            if task is not None:
                try:
                    await _asyncio.wait_for(task, timeout=5.0)
                except Exception:
                    pass

            # No workflow anchor -> the F2 terminalize never fires.
            assert finish_spy.await_count == 0
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

@pytest.mark.asyncio
async def test_cancel_clears_anchor_in_same_transaction(mock_asyncpg_pool):
    """SC#2: the Harness terminal write (finish_run, the single authoritative
    clear site for the workflow_runs row — Landmine 5) clears
    threads.active_workflow_run_id in the SAME transaction as the
    workflow_runs terminal-status write, and fires exactly once. Assert against
    mock_asyncpg_pool.calls: a transaction span wraps BOTH the workflow_runs
    status UPDATE and the threads anchor-clear, and the anchor-clear is keyed by
    this run's id (= the FK target), so no dangling lock survives a terminal run.
    """
    from app.db.workflows import finish_run

    run_id = uuid.uuid4()
    await finish_run(mock_asyncpg_pool, run_id, "completed")

    calls = mock_asyncpg_pool.calls
    # exactly one workflow_runs terminal UPDATE.
    wf_update_idxs = [
        i for i, (sql, _) in enumerate(calls)
        if "UPDATE workflow_runs SET status" in sql
    ]
    assert len(wf_update_idxs) == 1
    # exactly one anchor-clear, keyed by this run id (the FK target), set to NULL.
    clear_idxs = [
        i for i, (sql, _) in enumerate(calls)
        if "active_workflow_run_id = NULL" in sql
    ]
    assert len(clear_idxs) == 1
    assert calls[clear_idxs[0]][1] == (run_id,)
    # both writes ride the SAME transaction span (enter < both writes < exit).
    enter_idx = next(i for i, (sql, _) in enumerate(calls) if sql == "transaction_enter")
    exit_idx = next(i for i, (sql, _) in enumerate(calls) if sql == "transaction_exit")
    assert enter_idx < wf_update_idxs[0] < exit_idx
    assert enter_idx < clear_idxs[0] < exit_idx


def test_cap_paused_is_not_in_cancel_idempotency_terminal_set():
    """SC#2 corollary: cap_paused is NON-terminal and MUST remain cancellable —
    it must NOT be added to the cancel_run idempotency terminal set (runs.py:650),
    so a cancel of a cap_paused run transitions it to cancelled (and clears the
    lock), instead of short-circuiting 204 as already-terminal.
    """
    import inspect
    from app.api import runs as runs_mod

    src = inspect.getsource(runs_mod.cancel_run)
    # the idempotency guard lists the genuinely-terminal statuses verbatim.
    assert '("completed", "failed", "cancelled", "timed_out")' in src
    # cap_paused must NOT appear inside that terminal idempotency tuple — find the
    # guard line and assert cap_paused is absent from it (so a cap_paused run
    # falls THROUGH to the cancel write + anchor clear, staying cancellable).
    guard_line = next(
        ln for ln in src.splitlines()
        if 'row["status"] in (' in ln
    )
    assert "cap_paused" not in guard_line


# ═════════════════════════════════════════════════════════════════════════════
# 092-07 — F4 id-routing gap-closure (producer_run_id / stream_run_id / resume)
# ═════════════════════════════════════════════════════════════════════════════
#
# F4: the harness engine threads the workflow_runs.id as ctx.run_id, but the
# sub-agent parent_run_id FK (runs.parent_run_id → runs.run_id) and the SSE
# transport both require the producer runs.run_id. The fix is ADDITIVE — a second
# `producer_run_id` field on the harness ctx bag + a `stream_run_id` engine arg —
# WITHOUT reassigning ctx.run_id (still the workflow_run id for audit/terminal/
# definition/resume-match). These tests are the unit/contract backstop; the
# live-DB FK proof is tests/integration/test_092_subagent_parent_fk_live.py.


def _harness_ctx(producer_run_id="__set__", **overrides):
    """A harness-shaped engine ctx bag (SimpleNamespace, NOT a RunContext).

    By default carries BOTH run_id (the workflow_run id) and producer_run_id (the
    producer runs id). Pass producer_run_id=None to model an unpatched/missing
    site (the fail-closed guard target).
    """
    from types import SimpleNamespace

    wf_run_id = uuid.uuid4()
    if producer_run_id == "__set__":
        producer_run_id = uuid.uuid4()
    defaults = dict(
        run_id=wf_run_id,
        thread_id=str(uuid.uuid4()),
        current_user={"id": str(uuid.uuid4())},
        user_settings=None,
        redis=None,
        pool=None,
        emit=None,
        retry_feedback=None,
        model="gpt-5.4-mini",
    )
    if producer_run_id is not None:
        defaults["producer_run_id"] = producer_run_id
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


def _llm_agent_phase():
    """A minimal llm_agent PhaseSpec the phase-tool-context builder reads."""
    from app.models.harness import PhaseSpec

    return PhaseSpec.model_validate(
        {
            "slug": "research",
            "phase_index": 0,
            "config": {
                "phase_type": "llm_agent",
                "prompt": "do research",
                "available_tools": ["search_documents"],
            },
        }
    )


# ── Task 1 / Facet A: producer_run_id on wf_ctx + fail-closed parent sourcing ──

def test_producer_run_id_distinct_from_run_id_on_wf_ctx():
    """The harness producer branch (threads.py) builds wf_ctx with BOTH run_id (the
    workflow_run id) AND producer_run_id (the producer runs id). The edit is a
    source-level addition; assert the SimpleNamespace shape contract here and the
    threads.py source carries `producer_run_id=run_id`.
    """
    import inspect
    from app.api import threads as threads_mod

    # The agent_runner harness branch must add producer_run_id=run_id to wf_ctx.
    src = inspect.getsource(threads_mod)
    assert "producer_run_id=run_id" in src, (
        "wf_ctx must carry producer_run_id=run_id (the producer runs.run_id is the "
        "FK target for sub-agent parent_run_id; ctx.run_id stays the workflow_run id)"
    )
    # Contract: the two ids are distinct values on the bag.
    ctx = _harness_ctx()
    assert ctx.producer_run_id != ctx.run_id


def test_phase_tool_context_sources_run_id_from_producer_run_id():
    """_build_phase_tool_context sources the sub-agent parent ToolContext.run_id
    from ctx.producer_run_id (NOT ctx.run_id). This is the FK fix chokepoint for
    BOTH _exec_llm_agent and _exec_llm_batch_agents.
    """
    from app.services.harness.phase_types import _build_phase_tool_context

    ctx = _harness_ctx()
    tool_ctx = _build_phase_tool_context(_llm_agent_phase(), ctx)
    assert tool_ctx.run_id == ctx.producer_run_id
    assert tool_ctx.run_id != ctx.run_id
    # This ToolContext IS the parent — its own parent_run_id stays None.
    assert tool_ctx.parent_run_id is None


def test_phase_tool_context_fail_closed_when_producer_run_id_missing():
    """The fail-closed guard: a harness ctx WITHOUT producer_run_id RAISES rather
    than silently falling back to ctx.run_id (the workflow_run id) and re-triggering
    runs_parent_run_id_fkey for all 7 providers on any unpatched site.
    """
    from app.services.harness.phase_types import _build_phase_tool_context

    ctx = _harness_ctx(producer_run_id=None)
    with pytest.raises(ValueError, match="producer_run_id"):
        _build_phase_tool_context(_llm_agent_phase(), ctx)


def test_deep_guard_build_phase_tool_context_unreachable_from_deep():
    """Deep-path guard: _build_phase_tool_context is harness-executor-only. The
    Deep path builds its ToolContext in task_service from a producer runs id and
    NEVER reaches this fn. Assert the Deep parent-id source (task_service) is
    unchanged: parent_run_id=parent_ctx.run_id (the producer runs id), so Deep is
    byte-identical and independent of producer_run_id.
    """
    import inspect
    from app.services import task_service as ts_mod

    src = inspect.getsource(ts_mod)
    assert "parent_run_id=parent_ctx.run_id" in src, (
        "task_service must remain UNCHANGED — Deep already threads the producer "
        "runs id end-to-end; the Facet A fix is upstream (phase_types) only"
    )
    # _build_phase_tool_context lives in the harness package, not task_service —
    # the Deep loop never imports/calls it.
    assert "_build_phase_tool_context" not in src
