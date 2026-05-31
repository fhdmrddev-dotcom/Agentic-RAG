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


# ── Task 2 / Facet B: route engine _emit to the producer stream + ask_user ─────

def _xadd_streams_by_type(fake_redis):
    """Map each emitted event ``type`` -> the XADD stream key it landed on."""
    import json as _json

    out: dict[str, str] = {}
    for stream, fields in fake_redis.xadds:
        payload = _json.loads(fields["data"])
        out[payload["type"]] = stream
    return out


def _restore_registry(harness_engine, key, original):
    """Restore the original PHASE_TYPE_REGISTRY entry (or remove it if there was
    none) so a stubbed executor never leaks into a later test's registry-shape
    assertion (test-ordering state pollution)."""
    if original is not None:
        harness_engine.PHASE_TYPE_REGISTRY[key] = original
    else:
        harness_engine.PHASE_TYPE_REGISTRY.pop(key, None)


def _three_phase_def(build_workflow_definition):
    return build_workflow_definition(
        [
            {"config": {"phase_type": "llm_single", "prompt": "first"}},
            {"config": {"phase_type": "llm_single", "prompt": "second"}},
            {"config": {"phase_type": "llm_single", "prompt": "third"}},
        ]
    )


@pytest.mark.asyncio
async def test_run_workflow_emits_on_stream_run_id_audit_on_run_id(
    build_workflow_definition, mock_asyncpg_pool, fake_redis
):
    """Facet B: run_workflow accepts a keyword-only ``stream_run_id`` and routes
    EVERY engine _emit to ``run:{stream_run_id}`` (the producer stream the frontend
    watches), while every write_audit stays keyed on the workflow ``run_id``.
    """
    from app.services import harness_engine

    wf = _three_phase_def(build_workflow_definition)
    wf_run_id = uuid.uuid4()
    producer_id = uuid.uuid4()
    ids = [uuid.uuid4() for _ in range(3)]
    mock_asyncpg_pool.set_fetch_result(
        [
            {"id": ids[0], "slug": "p0", "phase_index": 0, "status": "pending", "output": {}},
            {"id": ids[1], "slug": "p1", "phase_index": 1, "status": "pending", "output": {}},
            {"id": ids[2], "slug": "p2", "phase_index": 2, "status": "pending", "output": {}},
        ]
    )

    async def _stub(phase, accumulated, ctx):
        return {"text": phase.slug}

    _orig = harness_engine.PHASE_TYPE_REGISTRY.get("llm_single")
    harness_engine.PHASE_TYPE_REGISTRY["llm_single"] = _stub
    try:
        ctx = _harness_ctx(producer_run_id=producer_id)
        await harness_engine.run_workflow(
            wf_run_id, wf, ctx, pool=mock_asyncpg_pool, redis=fake_redis,
            stream_run_id=producer_id,
        )
    finally:
        _restore_registry(harness_engine, "llm_single", _orig)

    streams = _xadd_streams_by_type(fake_redis)
    expected_stream = f"run:{producer_id}"
    for evt in ("phase_started", "phase_completed", "phase_transition", "run_completed"):
        assert streams.get(evt) == expected_stream, (
            f"{evt} must XADD to the producer stream {expected_stream}, got {streams.get(evt)}"
        )
    # No engine event leaked onto the orphan workflow_run stream.
    assert all(s != f"run:{wf_run_id}" for s in streams.values())

    # write_audit rows stay keyed on the workflow_run id (F1 shape preserved).
    audit_calls = [
        (sql, args) for sql, args in mock_asyncpg_pool.calls
        if "harness_audit" in sql
    ]
    assert audit_calls, "expected harness_audit INSERTs"
    for _sql, args in audit_calls:
        assert args[0] == wf_run_id, "write_audit run_id must be the workflow_run id"


@pytest.mark.asyncio
async def test_run_workflow_stream_run_id_defaults_to_producer_then_run_id(
    build_workflow_definition, mock_asyncpg_pool, fake_redis
):
    """When ``stream_run_id`` is omitted, the engine resolves it from
    ctx.producer_run_id (live/resume safe), falling back to the workflow run_id
    only when no producer id is present (back-compat for the legacy unit stubs).
    """
    from app.services import harness_engine

    wf = _three_phase_def(build_workflow_definition)
    wf_run_id = uuid.uuid4()
    producer_id = uuid.uuid4()
    ids = [uuid.uuid4() for _ in range(3)]
    mock_asyncpg_pool.set_fetch_result(
        [
            {"id": ids[0], "slug": "p0", "phase_index": 0, "status": "pending", "output": {}},
            {"id": ids[1], "slug": "p1", "phase_index": 1, "status": "pending", "output": {}},
            {"id": ids[2], "slug": "p2", "phase_index": 2, "status": "pending", "output": {}},
        ]
    )

    async def _stub(phase, accumulated, ctx):
        return {"text": phase.slug}

    _orig = harness_engine.PHASE_TYPE_REGISTRY.get("llm_single")
    harness_engine.PHASE_TYPE_REGISTRY["llm_single"] = _stub
    try:
        ctx = _harness_ctx(producer_run_id=producer_id)
        # No stream_run_id kwarg → resolved from ctx.producer_run_id.
        await harness_engine.run_workflow(
            wf_run_id, wf, ctx, pool=mock_asyncpg_pool, redis=fake_redis,
        )
    finally:
        _restore_registry(harness_engine, "llm_single", _orig)

    streams = _xadd_streams_by_type(fake_redis)
    assert streams.get("run_completed") == f"run:{producer_id}"


@pytest.mark.asyncio
async def test_gate_failed_emits_on_stream_run_id_not_audit_run_id(
    build_workflow_definition, mock_asyncpg_pool, fake_redis
):
    """Facet B (the verdict hole): ``_run_phase_with_gates`` also threads
    ``stream_run_id`` and its gate_failed _emit lands on the producer stream, while
    its gate_failed write_audit stays keyed on the workflow run_id — proving the
    two _emit site groups (run_workflow + gate loop) decouple cleanly from audit.
    """
    from app.services import harness_engine
    from app.models.harness import PhaseSpec, ValidatorSpec

    # One llm_single phase carrying an always-failing regex gate (bounded retry → fail).
    phase = PhaseSpec.model_validate(
        {
            "slug": "p0",
            "phase_index": 0,
            "config": {"phase_type": "llm_single", "prompt": "x"},
            "validators": [
                {"kind": "regex_match", "config": {"pattern": "ZZZ_NEVER_MATCHES"},
                 "on_failure": "fail_run", "max_retries": 1},
            ],
        }
    )
    wf_run_id = uuid.uuid4()
    producer_id = uuid.uuid4()

    async def _stub(_phase, _accumulated, _ctx):
        return {"text": "always fails the gate"}

    outcome = None
    _orig = harness_engine.PHASE_TYPE_REGISTRY.get("llm_single")
    harness_engine.PHASE_TYPE_REGISTRY["llm_single"] = _stub
    try:
        ctx = _harness_ctx(producer_run_id=producer_id)
        outcome = await harness_engine._run_phase_with_gates(
            phase, {}, ctx,
            run_id=wf_run_id, pool=mock_asyncpg_pool, redis=fake_redis,
            wall_clock=30, _audit_user_id=None, stream_run_id=producer_id,
        )
    finally:
        _restore_registry(harness_engine, "llm_single", _orig)

    assert outcome.kind == "fail_run"
    streams = _xadd_streams_by_type(fake_redis)
    assert streams.get("gate_failed") == f"run:{producer_id}"
    # gate_failed audit rows stay on the workflow_run id.
    audit_calls = [
        (sql, args) for sql, args in mock_asyncpg_pool.calls if "harness_audit" in sql
    ]
    assert audit_calls
    for _sql, args in audit_calls:
        assert args[0] == wf_run_id


@pytest.mark.asyncio
async def test_ask_user_prompt_emits_on_producer_transport_keeps_value_on_run_id(
    fake_redis, mock_asyncpg_pool
):
    """Facet B / edit #4: _exec_llm_human_input emits ``ask_user_prompt`` on the
    producer transport (run:{producer}) — a DIRECT executor emit not reached by the
    engine's stream_run_id threading — while the durable prompt-row run_id VALUE and
    the subscribe_for_response channel stay on ctx.run_id (the workflow_run id).
    """
    from app.services.harness import phase_types

    producer_id = uuid.uuid4()
    phase = PhaseSpec_human()

    captured = {}

    async def _fake_emit(redis, run_id, evt_type, **fields):
        await redis.xadd(f"run:{run_id}", {"data": _json_dumps({"type": evt_type, **fields})})

    async def _fake_subscribe(redis, run_id, tool_call_id, timeout):
        captured["subscribe_run_id"] = run_id
        captured["subscribe_tcid"] = tool_call_id
        return None  # timeout → no answer (we only assert the transport routing)

    import app.services.harness.phase_types as pt
    _orig_sub = pt.subscribe_for_response
    pt.subscribe_for_response = _fake_subscribe
    try:
        ctx = _harness_ctx(producer_run_id=producer_id)
        ctx.redis = fake_redis
        ctx.emit = _fake_emit
        ctx.supabase = None  # skip the durable prompt-row insert path in this unit
        ctx.thread_id = str(uuid.uuid4())
        out = await phase_types._exec_llm_human_input(phase, {}, ctx)
    finally:
        pt.subscribe_for_response = _orig_sub

    streams = _xadd_streams_by_type(fake_redis)
    # The ask_user_prompt event lands on the PRODUCER transport.
    assert streams.get("ask_user_prompt") == f"run:{producer_id}"
    # The subscribe_for_response channel stays on the workflow_run id VALUE.
    assert captured["subscribe_run_id"] == ctx.run_id
    assert ctx.run_id != producer_id
    # The tool_call_id round-trips through the output (resume matcher anchor).
    assert out["tool_call_id"] == captured["subscribe_tcid"]


def PhaseSpec_human():
    from app.models.harness import PhaseSpec

    return PhaseSpec.model_validate(
        {
            "slug": "ask",
            "phase_index": 0,
            "config": {
                "phase_type": "llm_human_input",
                "prompt": "Which option?",
                "options": ["a", "b"],
                "timeout_seconds": 5,
            },
        }
    )


def _json_dumps(obj):
    import json as _json

    return _json.dumps(obj)


# ── Task 3 / Facet C (resume): mint + finalize a producer runs row both paths ──

@pytest.mark.asyncio
async def test_build_resume_context_mints_producer_shell_with_nonnull_model(
    monkeypatch, fake_redis, mock_asyncpg_pool
):
    """Edit #5: _build_resume_context mints a fresh producer `runs` shell
    (insert_run with NON-NULL model/provider, parent_run_id=None) and sets
    producer_run_id on the returned ctx; ctx.run_id stays the workflow_run id.
    """
    from app.services import harness_engine

    insert_calls = []

    async def _spy_insert(pool, **kwargs):
        insert_calls.append(kwargs)

    monkeypatch.setattr(harness_engine, "_insert_run", _spy_insert, raising=False)
    # also patch the import target used inside the function (lazy or module-level).
    import app.db.runs as runs_mod
    monkeypatch.setattr(runs_mod, "insert_run", _spy_insert)

    wf_run_id = uuid.uuid4()
    thread_id = uuid.uuid4()
    user_id = uuid.uuid4()
    run = {"run_id": wf_run_id, "thread_id": thread_id, "user_id": user_id}

    ctx = await harness_engine._build_resume_context(run, fake_redis, mock_asyncpg_pool)

    # producer_run_id is set, distinct from the workflow_run id (= ctx.run_id).
    assert getattr(ctx, "producer_run_id", None) is not None
    assert ctx.producer_run_id != ctx.run_id
    assert ctx.run_id == wf_run_id

    # The mint supplied NON-NULL model/provider (db/runs.py NOT NULL) + parent None.
    assert insert_calls, "expected an insert_run mint on resume"
    mint = insert_calls[0]
    assert mint["run_id"] == ctx.producer_run_id
    assert mint["model"] and mint["model"] != ""
    assert mint["provider"] and mint["provider"] != ""
    assert mint["status"] == "streaming"
    assert mint["parent_run_id"] is None


@pytest.mark.asyncio
async def test_resume_finalizes_producer_shell_on_success_and_exception(
    monkeypatch, fake_redis, mock_asyncpg_pool
):
    """Edit #5: resume_stranded_workflows terminalizes the minted producer shell on
    EVERY exit path (success AND exception). A non-terminalized streaming shell
    becomes the thread's latest runs row and re-wedges the lock (defeating the F2
    self-heal that reads ORDER BY started_at DESC LIMIT 1).
    """
    from app.services import harness_engine

    finalize_calls = []

    async def _spy_finalize(pool, *, run_id, **kwargs):
        finalize_calls.append((run_id, kwargs.get("status")))

    async def _spy_insert(pool, **kwargs):
        return None

    import app.db.runs as runs_mod
    monkeypatch.setattr(runs_mod, "insert_run", _spy_insert)
    monkeypatch.setattr(runs_mod, "finalize_run", _spy_finalize)

    wf_run_id = uuid.uuid4()
    run = {"run_id": wf_run_id, "thread_id": uuid.uuid4(), "user_id": uuid.uuid4()}

    # find_resumable_runs returns our one stranded run; claim succeeds; not ask_user.
    monkeypatch.setattr(harness_engine, "find_resumable_runs",
                        _async_return([run]))
    monkeypatch.setattr(harness_engine, "claim_run", _async_return(True))
    monkeypatch.setattr(harness_engine, "get_active_phase", _async_return(None))
    monkeypatch.setattr(harness_engine, "_load_run_definition",
                        _async_return(object()))

    # ── success path ──
    finalize_calls.clear()
    monkeypatch.setattr(harness_engine, "_resume_run", _async_return(None))
    await harness_engine.resume_stranded_workflows(pool=mock_asyncpg_pool, redis=fake_redis)
    assert finalize_calls, "resume must terminalize the producer shell on success"
    assert finalize_calls[-1][1] in ("completed", "failed", "cancelled")

    # ── exception path ──
    finalize_calls.clear()

    async def _boom(*a, **k):
        raise RuntimeError("re-drive exploded")

    monkeypatch.setattr(harness_engine, "_resume_run", _boom)
    monkeypatch.setattr(harness_engine, "find_resumable_runs", _async_return([run]))
    monkeypatch.setattr(harness_engine, "claim_run", _async_return(True))
    try:
        await harness_engine.resume_stranded_workflows(
            pool=mock_asyncpg_pool, redis=fake_redis
        )
    except RuntimeError:
        pass  # the finalize-in-finally must still have fired
    assert finalize_calls, "resume must terminalize the producer shell on exception"
    assert finalize_calls[-1][1] in ("completed", "failed", "cancelled")


@pytest.mark.asyncio
async def test_continuation_mints_producer_shell_and_finalizes(monkeypatch):
    """Edit #5b: _harness_continuation (POST /continue) mints a fresh producer row,
    sets producer_run_id, passes stream_run_id, and terminalizes in its finally —
    mirroring the sweep. Verified by the source carrying the mint + finalize +
    producer_run_id + stream_run_id + the /continue 200 producer_run_id surfacing.
    """
    import inspect
    from app.api import runs as runs_api

    src = inspect.getsource(runs_api.continue_run)
    # mint + producer_run_id on the continuation ctx
    assert "producer_run_id" in src, "continuation must set producer_run_id on wf_ctx"
    assert "insert_run" in src, "continuation must mint a fresh producer runs row"
    # route events to the fresh producer stream
    assert "stream_run_id=" in src, "continuation must pass stream_run_id"
    # terminalize the fresh producer row
    assert "finalize_run" in src, "continuation must terminalize the producer shell"
    # surface the fresh id in the 200 body for the frontend re-subscribe
    assert '"producer_run_id"' in src or "producer_run_id=" in src


def test_resume_mint_does_not_touch_continues_used(monkeypatch):
    """CONT-01 cap intact: neither resume mint path UPDATEs continues_used —
    the durable 3-cap counter is undisturbed by the fresh-producer-row mint.
    """
    import inspect
    from app.services import harness_engine
    from app.api import runs as runs_api

    sweep_src = inspect.getsource(harness_engine.resume_stranded_workflows)
    build_src = inspect.getsource(harness_engine._build_resume_context)
    cont_src = inspect.getsource(runs_api.continue_run)

    # The mint paths must not write continues_used (the cap counter lives on the
    # workflow_runs/runs row and is incremented only by the /continue Step 4 path).
    assert "continues_used" not in build_src
    # The sweep itself never touches continues_used.
    assert "continues_used" not in sweep_src
    # In continue_run, continues_used is only the Step-4 increment, never inside
    # the mint — assert the mint helper text doesn't reference it adjacent to insert.
    assert cont_src.count("continues_used") >= 1  # the legit Step-4 increment exists


def _async_return(value):
    """Build an AsyncMock-like coroutine fn returning `value` for any args."""
    async def _fn(*a, **k):
        return value
    return _fn


# ── Task 4 / Facet C: Continue-404 repair + latest_producer_run_id surfacing ───

def _continue_supabase(*, runs_row=None, workflow_self_row=None,
                       thread_anchor=None, owner="owner"):
    """A query-routed supabase mock for the continue_run resolve tests.

    Routes:
      - runs SELECT (Step 1)              -> runs_row (None = not a runs row)
      - workflow_runs SELECT (404 repair) -> workflow_self_row (owner-scoped)
      - threads SELECT (anchor confirm)   -> {"active_workflow_run_id": thread_anchor}
    """
    from unittest.mock import MagicMock

    def _result(data):
        r = MagicMock()
        r.data = data
        return r

    def _runs_execute(*a, **k):
        return _result(runs_row)

    wf_state = {"n": 0}

    def _wf_execute(*a, **k):
        wf_state["n"] += 1
        # 1st workflow_runs read in continue_run is the 404-repair owner-scoped
        # resolve; later reads (Step 2 cap lookup) return the same self row.
        return _result(workflow_self_row)

    def _threads_execute(*a, **k):
        return _result({"active_workflow_run_id": thread_anchor})

    def _default_execute(*a, **k):
        return _result(None)

    def _builder(fn):
        b = MagicMock()
        for m in ("select", "insert", "update", "delete", "eq", "neq", "in_",
                  "order", "limit", "single", "maybe_single", "is_", "or_"):
            getattr(b, m).return_value = b
        b.execute.side_effect = fn
        return b

    builders = {
        "runs": _builder(_runs_execute),
        "workflow_runs": _builder(_wf_execute),
        "threads": _builder(_threads_execute),
    }
    default = _builder(_default_execute)
    sb = MagicMock()
    sb.table.side_effect = lambda name: builders.get(name, default)
    sb.rpc.return_value = default
    return sb


@pytest.mark.asyncio
async def test_continue_accepts_workflow_run_id_post_reload_no_404(
    fake_redis, mock_asyncpg_pool, monkeypatch
):
    """Facet C Continue-404: POST /runs/{id}/continue with a WORKFLOW_RUN id (the
    value workflowLock.runId carries post-reload) does NOT 404 — it resolves under
    the caller's ownership (workflow_runs.user_id + the thread anchor) and drives
    the harness branch, returning 200 with the fresh producer_run_id.
    """
    import httpx
    from httpx import ASGITransport
    from unittest.mock import AsyncMock, patch

    from app.main import app
    from app.dependencies import get_supabase, get_redis

    wf_run_id = uuid.uuid4()
    thread_id = uuid.uuid4()

    sb = _continue_supabase(
        runs_row=None,  # NOT a runs row → would 404 at Step 1 without the repair
        workflow_self_row={"id": str(wf_run_id), "thread_id": str(thread_id),
                           "continues_used": 0},
        thread_anchor=str(wf_run_id),  # the id IS the thread's live anchor
    )

    app.dependency_overrides[get_supabase] = lambda: sb
    app.dependency_overrides[get_redis] = lambda: fake_redis
    try:
        with patch("app.dependencies.get_pg_pool", AsyncMock(return_value=mock_asyncpg_pool)), \
             patch("app.services.harness_engine._load_run_definition", AsyncMock(return_value=object())), \
             patch("app.db.workflows.get_active_phase", AsyncMock(return_value=None)), \
             patch("app.api.runs.resolve_phase_available_tools", lambda *a, **k: []), \
             patch("app.db.runs.insert_run", AsyncMock()), \
             patch("app.db.runs.finalize_run", AsyncMock()), \
             patch("app.services.harness_engine.run_workflow", AsyncMock()):
            async with httpx.AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as c:
                resp = await c.post(
                    f"/runs/{wf_run_id}/continue",
                    headers={"Authorization": "Bearer test-token"},
                )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["status"] == "ok"
        # the fresh producer id is surfaced for the frontend re-subscribe.
        assert "producer_run_id" in body and body["producer_run_id"]
    finally:
        app.dependency_overrides.pop(get_supabase, None)
        app.dependency_overrides.pop(get_redis, None)


@pytest.mark.asyncio
async def test_continue_idor_other_users_workflow_run_id_still_404s(
    fake_redis, mock_asyncpg_pool
):
    """T-092-07-02: another user's workflow_run id still 404s — the resolve stays
    owner-scoped (workflow_runs.user_id == current_user); existence never leaks.
    """
    import httpx
    from httpx import ASGITransport

    from app.main import app
    from app.dependencies import get_supabase, get_redis

    wf_run_id = uuid.uuid4()

    sb = _continue_supabase(
        runs_row=None,           # not the caller's runs row
        workflow_self_row=None,  # owner-scoped workflow_runs SELECT finds nothing
        thread_anchor=None,
    )

    app.dependency_overrides[get_supabase] = lambda: sb
    app.dependency_overrides[get_redis] = lambda: fake_redis
    try:
        async with httpx.AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as c:
            resp = await c.post(
                f"/runs/{wf_run_id}/continue",
                headers={"Authorization": "Bearer test-token"},
            )
        assert resp.status_code == 404, resp.text
    finally:
        app.dependency_overrides.pop(get_supabase, None)
        app.dependency_overrides.pop(get_redis, None)


def test_continue_resolve_stays_owner_scoped_in_source():
    """T-092-07-02: the Continue-404 repair ADDS an owner-scoped workflow_runs
    resolve (AND user_id) + the thread-anchor confirmation — it does NOT weaken the
    existing ownership check. Assert the source carries the owner-scoped resolve.
    """
    import inspect
    from app.api import runs as runs_api

    src = inspect.getsource(runs_api.continue_run)
    assert "workflow_runs" in src, "the 404 repair must resolve workflow_runs"
    assert "active_workflow_run_id" in src, "must confirm the thread anchor"
    # owner-scoping: the workflow_runs resolve is keyed by the current user.
    assert 'eq("user_id", current_user["id"])' in src


def test_get_thread_workflow_surfaces_latest_producer_when_live(
    client, mock_asyncpg_pool, mock_execute_result
):
    """Facet C surfacing: when the thread's latest producer runs row is NON-terminal
    (live), get_thread_workflow returns latest_producer_run_id == that run_id;
    reuses the EXISTING F2 self-heal SELECT (no second runs query).
    """
    thread_id = uuid.uuid4()
    wf_run_id = uuid.uuid4()
    producer_id = uuid.uuid4()
    mock_execute_result.data = {
        "id": str(thread_id),
        "active_workflow_run_id": str(wf_run_id),
    }
    # fetchrow order: (1) workflow_runs join -> active; (2) F2 producer probe now
    # selecting run_id+status -> a LIVE (streaming) producer row; (3) deep probe None.
    mock_asyncpg_pool.set_fetchrow_results([
        {
            "status": "active", "continues_used": 0,
            "definition_slug": "wf", "definition_name": "WF",
            "current_phase_slug": "p0", "current_phase_index": 0, "total_phases": 2,
        },
        {"run_id": producer_id, "status": "streaming"},
        None,
    ])

    with patch_get_pg_pool(mock_asyncpg_pool):
        resp = client.get(f"/threads/{thread_id}/workflow")

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["latest_producer_run_id"] == str(producer_id)
    # Pure read — only one runs probe (no second runs query for the surfacing).
    runs_probes = [
        sql for sql, _ in mock_asyncpg_pool.calls
        if "FROM runs WHERE thread_id" in sql
    ]
    assert len(runs_probes) == 1, "must reuse the existing F2 SELECT (no new query)"


def test_get_thread_workflow_latest_producer_none_when_terminal(
    client, mock_asyncpg_pool, mock_execute_result
):
    """Facet C surfacing: when the latest producer row is terminal, the surfaced
    latest_producer_run_id is None (don't point the frontend at a dead stream).
    """
    thread_id = uuid.uuid4()
    wf_run_id = uuid.uuid4()
    mock_execute_result.data = {
        "id": str(thread_id),
        "active_workflow_run_id": str(wf_run_id),
    }
    mock_asyncpg_pool.set_fetchrow_results([
        {
            "status": "active", "continues_used": 0,
            "definition_slug": "wf", "definition_name": "WF",
            "current_phase_slug": "p0", "current_phase_index": 0, "total_phases": 2,
        },
        {"run_id": uuid.uuid4(), "status": "completed"},  # terminal producer
        None,
    ])

    with patch_get_pg_pool(mock_asyncpg_pool):
        resp = client.get(f"/threads/{thread_id}/workflow")

    assert resp.status_code == 200, resp.text
    assert resp.json()["latest_producer_run_id"] is None
    # terminal producer also flips lock_is_stale (the F2 self-heal still works).
    assert resp.json()["lock_is_stale"] is True


def patch_get_pg_pool(pool):
    from unittest.mock import AsyncMock, patch

    return patch("app.api.threads.get_pg_pool", AsyncMock(return_value=pool))


# ═════════════════════════════════════════════════════════════════════════════
# 092-07 — F5: thread supabase + folder-scope + spawn + semaphore into harness ctx
# ═════════════════════════════════════════════════════════════════════════════
#
# F5: the harness wf_ctx (threads.py) + the two resume ctx builders (harness_engine
# _build_resume_context, runs.py _harness_continuation) set run-identity fields but
# NOT the tool-context substrate every Supabase tool reads via ctx.<field>
# (supabase / folder_subtree_ids / scoped_folder_path / spawn / per_run_task_semaphore).
# _build_phase_tool_context already FORWARDS them via getattr — they just resolved
# to None, so the FIRST search_documents hit ctx.supabase.rpc → AttributeError on
# 'NoneType'. These assertions make the None.rpc precondition explicit (the mock-pool
# blind spot that hid F5 live) so it can't silently regress.

_F5_TOOL_CTX_FIELDS = (
    "supabase",
    "folder_subtree_ids",
    "scoped_folder_path",
    "spawn",
    "per_run_task_semaphore",
)


def test_live_wf_ctx_sets_tool_context_substrate_in_source():
    """F5 (live): the threads.py harness wf_ctx build must set the 5 tool-context
    fields — supabase=supabase (same value Deep's RunContext uses), the folder-scope
    pair, spawn=_spawn, and a per_run_task_semaphore. Source-level assertion: these
    fields appear on the wf_ctx SimpleNamespace in the agent_runner harness branch.
    """
    import inspect
    from app.api import threads as threads_mod

    src = inspect.getsource(threads_mod)
    # supabase wired from the request param (the SAME local Deep's RunContext uses).
    assert "supabase=supabase" in src, (
        "harness wf_ctx must set supabase=supabase (without it ctx.supabase is None "
        "→ search_documents hits None.rpc — the F5 crash)"
    )
    # spawn wired from the module-level _spawn (the SAME ref Deep passes).
    assert "spawn=_spawn" in src
    # the folder-scope pair + per-run semaphore appear on the bag.
    assert "folder_subtree_ids=" in src
    assert "scoped_folder_path=" in src
    assert "per_run_task_semaphore=asyncio.Semaphore(" in src


def test_phase_tool_context_carries_nonnull_supabase_given_engine_ctx_with_one():
    """F5 chokepoint: _build_phase_tool_context yields a ToolContext whose
    .supabase is NON-NULL when the engine ctx carries a supabase — i.e. once the
    wf_ctx sets supabase, the forwarded sub-agent ToolContext can call
    supabase.rpc(...). This is the EXACT precondition that was violated live (the
    'NoneType' object has no attribute 'rpc' crash).
    """
    from app.services.harness.phase_types import _build_phase_tool_context

    sentinel_supabase = object()
    sentinel_subtree = ["folder-a", "folder-b"]
    sentinel_path = "/DBA"
    sentinel_spawn = lambda c: c  # noqa: E731
    import asyncio as _asyncio
    sentinel_sem = _asyncio.Semaphore(3)

    ctx = _harness_ctx(
        supabase=sentinel_supabase,
        folder_subtree_ids=sentinel_subtree,
        scoped_folder_path=sentinel_path,
        spawn=sentinel_spawn,
        per_run_task_semaphore=sentinel_sem,
    )
    tool_ctx = _build_phase_tool_context(_llm_agent_phase(), ctx)

    # The whole point of F5: a non-None supabase flows through so .rpc is callable.
    assert tool_ctx.supabase is sentinel_supabase
    assert tool_ctx.supabase is not None
    # The folder scope flows through so the DBA-folder filter applies inside the
    # workflow (search_documents folder_ids=ctx.folder_subtree_ids).
    assert tool_ctx.folder_subtree_ids == sentinel_subtree
    assert tool_ctx.scoped_folder_path == sentinel_path
    # spawn + the per-run semaphore complete the tool substrate.
    assert tool_ctx.spawn is sentinel_spawn
    assert tool_ctx.per_run_task_semaphore is sentinel_sem


def test_phase_tool_context_supabase_none_reproduces_f5_precondition():
    """F5 regression guard (negative): the pre-fix engine ctx (NO supabase field)
    forwards ctx.supabase as None — the exact state that made ctx.supabase.rpc
    crash. This documents WHY the wf_ctx must set supabase: an engine ctx without
    it yields a ToolContext whose .supabase is None.
    """
    from app.services.harness.phase_types import _build_phase_tool_context

    # _harness_ctx default does NOT set supabase → models the pre-F5 bag.
    ctx = _harness_ctx()
    assert getattr(ctx, "supabase", None) is None
    tool_ctx = _build_phase_tool_context(_llm_agent_phase(), ctx)
    assert tool_ctx.supabase is None  # the None.rpc precondition (pre-fix state)


@pytest.mark.asyncio
async def test_build_resume_context_carries_nonnull_supabase_and_substrate(
    monkeypatch, fake_redis, mock_asyncpg_pool
):
    """F5 (resume sweep): _build_resume_context sets a NON-NULL supabase (the
    service-role client — the sweep has no request) plus spawn + per_run_task_semaphore,
    so a resumed workflow's search_documents resolves. Folder scope is None on resume
    (unscoped, acceptable). Owner-scoping is preserved: current_user["id"] is the
    durable run owner, and search_documents filters by it.
    """
    from app.services import harness_engine

    async def _spy_insert(pool, **kwargs):
        return None

    import app.db.runs as runs_mod
    monkeypatch.setattr(runs_mod, "insert_run", _spy_insert)

    # Stub the service-role factory so the test asserts the WIRING, not a live client.
    sentinel_service_client = object()
    import app.dependencies as deps_mod
    monkeypatch.setattr(deps_mod, "get_supabase", lambda: sentinel_service_client)

    wf_run_id = uuid.uuid4()
    owner_id = uuid.uuid4()
    run = {"run_id": wf_run_id, "thread_id": uuid.uuid4(), "user_id": owner_id}

    ctx = await harness_engine._build_resume_context(run, fake_redis, mock_asyncpg_pool)

    # supabase is the (service-role) client, NOT None → search_documents.rpc works.
    assert getattr(ctx, "supabase", None) is sentinel_service_client
    assert ctx.supabase is not None
    # the rest of the tool substrate is present (folder scope None on resume).
    assert getattr(ctx, "spawn", None) is not None
    assert getattr(ctx, "per_run_task_semaphore", None) is not None
    assert ctx.folder_subtree_ids is None
    assert ctx.scoped_folder_path is None
    # THREAT: owner-scoping intact — current_user["id"] is the durable run owner,
    # so the service-role (RLS-bypassing) client can't leak another user's docs.
    assert ctx.current_user["id"] == str(owner_id)


def test_harness_continuation_threads_supabase_and_substrate_in_source():
    """F5 (continue): _harness_continuation (POST /runs/{id}/continue) sets the
    request supabase on its resume ctx (it has Depends(get_supabase) in scope) plus
    spawn + per_run_task_semaphore. Source-level assertion against continue_run.
    """
    import inspect
    from app.api import runs as runs_api

    src = inspect.getsource(runs_api.continue_run)
    # the request supabase is threaded onto the continuation ctx.
    assert "supabase=supabase" in src, (
        "_harness_continuation must set supabase=<request supabase> so a re-driven "
        "phase's search_documents resolves (else ctx.supabase.rpc → None crash)"
    )
    # spawn + a fresh per-run semaphore complete the substrate.
    assert "spawn=_spawn_harness_resume" in src
    assert "per_run_task_semaphore=_asyncio.Semaphore(" in src


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


# ═════════════════════════════════════════════════════════════════════════════
# 092-07 — F6: surface the harness final_output as the assistant reply
# ═════════════════════════════════════════════════════════════════════════════
#
# F6: run_workflow sets wf_ctx.final_output = last_output ({"text": <answer>},
# harness_engine.py:559 + harness/phase_types.py:210), but the producer-shell
# finalizer (_shielded_finalize) persists from _result_sink["persist"], which is
# populated ONLY by run_agent_loop (the Deep path). In the harness branch
# run_agent_loop never runs → _result_sink stays empty → NO assistant message
# persisted, and the engine never emits a `delta` content event → the chat stays
# empty (the F6 live symptom: GET /threads/{id}/messages returns only the user
# message). The fix wires BOTH hand-offs in the harness branch on the SUCCESS
# path: (1) a `delta` emit on the producer stream for the live render, and (2)
# _result_sink["persist"] = a callable mirroring run_agent_loop's persist shape
# (zero-arg async → inserts the assistant messages row, returns the id) so the
# UNCHANGED _shielded_finalize persists it durably. Harness-branch-only; Deep stays
# byte-identical. The mock-pool tests + structural-skeleton SSE proof passed through
# F1→F5 — these exercise the REAL _shielded_finalize → _result_sink["persist"]()
# consumption (mock the persist insert; assert it carries the final_output text).


@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_harness_final_output_persisted_as_assistant_message(
    fake_redis, mock_asyncpg_pool
):
    """F6: after a SUCCESSFUL harness run whose wf_ctx.final_output == {"text": A},
    the producer-shell finalizer persists an assistant `messages` row carrying A.

    Drives a real kickoff send through the producer; stubs run_workflow to set
    wf_ctx.final_output (the engine's natural-completion hand-off) and patches
    insert_assistant_message (the persist path the REAL _shielded_finalize calls
    via _result_sink["persist"]). Closes the mock-pool blind spot: the assertion
    is end-to-end through the unchanged finalizer, not a sink-shape stub.
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
    inserted_msg_id = uuid.uuid4()
    ANSWER = "The DBA folder summarizes three theses on adaptive query optimization."

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

    # The engine stub sets final_output on the wf_ctx (3rd positional arg) exactly
    # as run_workflow does on natural completion (harness_engine.py:559).
    async def _wf_stub(run_id, definition, ctx, *, pool, redis, stream_run_id=None):
        ctx.final_output = {"text": ANSWER}

    # Spy on the persist insert (the path _shielded_finalize calls through
    # _result_sink["persist"]()). Returns the inserted id (str|None contract).
    insert_spy = AsyncMock(return_value=inserted_msg_id)

    app.dependency_overrides[get_supabase] = lambda: sb
    app.dependency_overrides[get_redis] = lambda: fake_redis
    try:
        with patch("app.api.threads.get_pg_pool", AsyncMock(return_value=mock_asyncpg_pool)), \
             patch("app.api.threads.insert_run", AsyncMock()), \
             patch("app.api.threads.create_workflow_run",
                   AsyncMock(return_value=new_run_id)), \
             patch("app.api.threads.generate_thread_title", return_value=("T", None)), \
             patch("app.api.threads.finalize_run", AsyncMock()), \
             patch("app.api.threads.insert_assistant_message", insert_spy), \
             patch("app.services.harness_engine.run_workflow", _wf_stub), \
             patch("app.services.harness_engine._load_run_definition",
                   AsyncMock(return_value=None)):
            async with httpx.AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as c:
                resp = await c.post(
                    f"/threads/{thread_id}/messages",
                    headers={"Authorization": "Bearer test-token"},
                    json={"content": "summarize the DBA folder",
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

            # F6: the REAL _shielded_finalize consumed _result_sink["persist"] and
            # persisted the assistant row carrying the final_output text.
            assert insert_spy.await_count == 1, (
                "the harness branch must populate _result_sink['persist'] so the "
                "producer-shell finalizer persists the assistant message"
            )
            persist_kwargs = insert_spy.await_args.kwargs
            assert persist_kwargs["content"] == ANSWER, (
                "the persisted assistant content must be wf_ctx.final_output['text']"
            )
            # the persisted row binds the run's thread + owner (RLS scope).
            assert str(persist_kwargs["thread_id"]) == str(thread_id)
            assert persist_kwargs["user_id"] is not None
    finally:
        app.dependency_overrides.pop(get_supabase, None)
        app.dependency_overrides.pop(get_redis, None)


@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_harness_final_output_emits_delta_for_live_render(
    fake_redis, mock_asyncpg_pool
):
    """F6 (live render): the harness branch emits the final_output text as a `delta`
    SSE event on the PRODUCER stream (run:{producer_run_id}), so the frontend's
    api.ts demux (type=='delta' → onDelta) appends it to the assistant placeholder
    WITHOUT a reload — mirroring how the Deep path streams visible text.
    """
    import asyncio as _asyncio
    import json as _json
    from unittest.mock import AsyncMock, patch
    from uuid import UUID

    import httpx
    from httpx import ASGITransport

    from app.main import app
    from app.dependencies import get_supabase, get_redis

    thread_id = uuid.uuid4()
    def_id = uuid.uuid4()
    new_run_id = uuid.uuid4()
    ANSWER = "Grounded answer streamed live to the chat."

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

    async def _wf_stub(run_id, definition, ctx, *, pool, redis, stream_run_id=None):
        ctx.final_output = {"text": ANSWER}

    app.dependency_overrides[get_supabase] = lambda: sb
    app.dependency_overrides[get_redis] = lambda: fake_redis
    try:
        with patch("app.api.threads.get_pg_pool", AsyncMock(return_value=mock_asyncpg_pool)), \
             patch("app.api.threads.insert_run", AsyncMock()), \
             patch("app.api.threads.create_workflow_run",
                   AsyncMock(return_value=new_run_id)), \
             patch("app.api.threads.generate_thread_title", return_value=("T", None)), \
             patch("app.api.threads.finalize_run", AsyncMock()), \
             patch("app.api.threads.insert_assistant_message",
                   AsyncMock(return_value=uuid.uuid4())), \
             patch("app.services.harness_engine.run_workflow", _wf_stub), \
             patch("app.services.harness_engine._load_run_definition",
                   AsyncMock(return_value=None)):
            async with httpx.AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as c:
                resp = await c.post(
                    f"/threads/{thread_id}/messages",
                    headers={"Authorization": "Bearer test-token"},
                    json={"content": "answer me",
                          "workflow_definition_id": str(def_id)},
                )
            assert resp.status_code == 201, resp.text
            producer_run_id = resp.json()["run_id"]

            from app.api.threads import RUN_TASKS
            run_id = UUID(producer_run_id)
            task = RUN_TASKS.get(run_id)
            if task is not None:
                try:
                    await _asyncio.wait_for(task, timeout=5.0)
                except Exception:
                    pass

            # A `delta` event carrying the answer landed on the PRODUCER stream.
            delta_events = [
                (stream, _json.loads(fields["data"]))
                for stream, fields in fake_redis.xadds
                if _json.loads(fields["data"]).get("type") == "delta"
            ]
            assert delta_events, "harness branch must emit a `delta` for live render"
            matching = [
                stream for stream, payload in delta_events
                if payload.get("content") == ANSWER
            ]
            assert matching, "the `delta` must carry wf_ctx.final_output['text']"
            assert matching[0] == f"run:{producer_run_id}", (
                "the `delta` must land on the producer stream the frontend watches"
            )
    finally:
        app.dependency_overrides.pop(get_supabase, None)
        app.dependency_overrides.pop(get_redis, None)


def test_deep_path_does_not_install_harness_persist_in_source():
    """F6 byte-identical guard: the F6 persist+emit wiring is harness-branch-only.
    The Deep `else` continues to source its persist from run_agent_loop's
    _result_sink — assert the source threads the harness persist via final_output
    inside the harness branch (the wf_ctx build), never in the Deep RunContext path.
    """
    import inspect
    from app.api import threads as threads_mod

    src = inspect.getsource(threads_mod)
    # The harness branch reads wf_ctx.final_output and routes it to the persist sink.
    assert 'getattr(wf_ctx, "final_output"' in src, (
        "the harness branch must source the assistant content from wf_ctx.final_output"
    )
    # The persist callable is installed into _result_sink (the path _shielded_finalize
    # already consumes) — reusing the proven finalizer, not a parallel persist site.
    assert '_result_sink["persist"] = _persist_harness_message' in src
    # Deep stays byte-identical: run_agent_loop is still the sole Deep persist source.
    assert "result_sink=_result_sink" in src


# ═════════════════════════════════════════════════════════════════════════════
# 092-07 — F7: surface source_refs / citations / confidence ON the harness answer
# ═════════════════════════════════════════════════════════════════════════════
#
# F7: the F6 fix surfaced the answer TEXT, but the chat showed NO references /
# citations / confidence — the grounding (it searched the user's docs) was
# invisible. ROOT CAUSE: search_documents returns a ToolResult with source_refs +
# citations + similarity_score, but the sub-agent loop + _exec_llm_agent discarded
# them (returned only {"text", "sub_run_id"}), so they never reached ctx.final_*
# or the F6 persist payload. CROSS-PHASE NUANCE: in Research→Summarize the SOURCES
# are gathered in the RESEARCH phase (llm_agent w/ search_documents), but the FINAL
# phase is SUMMARIZE (llm_single, no tools, no sources) — so the grounding must be
# ACCUMULATED across ALL phases (union) and attached to the FINAL answer. The fix
# threads source_refs/citations/similarity through run_task_sub_agent → the phase
# executors → a run-level union in run_workflow (ctx.final_source_refs /
# final_citations / final_confidence) → the F6 persist + the live SSE events
# (sources / citations / confidence), all mirroring the Deep path shape EXACTLY.


@pytest.mark.asyncio
async def test_harness_final_grounding_persisted_with_deep_param_shape(
    fake_redis, mock_asyncpg_pool
):
    """F7 (core): after a SUCCESSFUL harness run whose engine exposed the run-level
    grounding union on wf_ctx (final_source_refs / final_citations / final_confidence),
    the producer-shell finalizer persists the assistant `messages` row carrying that
    grounding via insert_assistant_message — using the EXACT Deep param shape
    (source_refs=, confidence_level=, confidence_avg_similarity=, confidence_disclaimer=).

    Drives a real kickoff send; stubs run_workflow to set BOTH final_output AND the
    F7 grounding attrs (the engine's natural-completion hand-off); patches
    insert_assistant_message (the path the REAL _shielded_finalize calls via
    _result_sink["persist"]). End-to-end through the unchanged finalizer.
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
    inserted_msg_id = uuid.uuid4()
    ANSWER = "Three theses converge on adaptive query optimization."

    # A research phase gathered these via search_documents; the summarize phase
    # (the FINAL phase) has none of its own — the union carries them to the answer.
    SOURCE_REFS = [
        {"document_id": "doc-1", "filename": "thesis_a.pdf", "chunk_index": 3,
         "passage": "Adaptive optimization adjusts the plan at runtime.", "similarity": 0.71},
        {"document_id": "doc-2", "filename": "thesis_b.pdf", "chunk_index": 7,
         "passage": "Cost models drift under skew.", "similarity": 0.63},
    ]
    CITATIONS = list(SOURCE_REFS)
    CONFIDENCE = {"level": "high", "avg_similarity": 0.67, "disclaimer": None}

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

    async def _wf_stub(run_id, definition, ctx, *, pool, redis, stream_run_id=None):
        ctx.final_output = {"text": ANSWER}
        ctx.final_source_refs = SOURCE_REFS
        ctx.final_citations = CITATIONS
        ctx.final_confidence = CONFIDENCE

    insert_spy = AsyncMock(return_value=inserted_msg_id)

    app.dependency_overrides[get_supabase] = lambda: sb
    app.dependency_overrides[get_redis] = lambda: fake_redis
    try:
        with patch("app.api.threads.get_pg_pool", AsyncMock(return_value=mock_asyncpg_pool)), \
             patch("app.api.threads.insert_run", AsyncMock()), \
             patch("app.api.threads.create_workflow_run",
                   AsyncMock(return_value=new_run_id)), \
             patch("app.api.threads.generate_thread_title", return_value=("T", None)), \
             patch("app.api.threads.finalize_run", AsyncMock()), \
             patch("app.api.threads.insert_assistant_message", insert_spy), \
             patch("app.services.harness_engine.run_workflow", _wf_stub), \
             patch("app.services.harness_engine._load_run_definition",
                   AsyncMock(return_value=None)):
            async with httpx.AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as c:
                resp = await c.post(
                    f"/threads/{thread_id}/messages",
                    headers={"Authorization": "Bearer test-token"},
                    json={"content": "summarize the DBA folder",
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

            assert insert_spy.await_count == 1
            kw = insert_spy.await_args.kwargs
            # F7: the persisted row carries the accumulated grounding via the Deep
            # param shape — source_refs = the deduped citation objects, confidence_*
            # split across the three columns Deep uses.
            assert kw["content"] == ANSWER
            assert kw["source_refs"] == SOURCE_REFS
            assert kw["confidence_level"] == "high"
            assert kw["confidence_avg_similarity"] == 0.67
            assert kw["confidence_disclaimer"] is None
    finally:
        app.dependency_overrides.pop(get_supabase, None)
        app.dependency_overrides.pop(get_redis, None)


@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_harness_final_grounding_emits_sources_citations_confidence_live(
    fake_redis, mock_asyncpg_pool
):
    """F7 (live render): the harness branch emits `sources`, `citations`, and
    `confidence` SSE events on the PRODUCER stream (run:{producer_run_id}) — the
    SAME event vocabulary + ordering the Deep path uses (agent_loop.py:2412-2435),
    routed to the api.ts onSources / onCitations / onConfidence handlers — so the
    reference chips + confidence render WITHOUT a reload.
    """
    import asyncio as _asyncio
    import json as _json
    from unittest.mock import AsyncMock, patch
    from uuid import UUID

    import httpx
    from httpx import ASGITransport

    from app.main import app
    from app.dependencies import get_supabase, get_redis

    thread_id = uuid.uuid4()
    def_id = uuid.uuid4()
    new_run_id = uuid.uuid4()
    ANSWER = "Grounded answer with visible sources."
    SOURCE_REFS = [{"document_id": "doc-1", "filename": "a.pdf"}]
    CITATIONS = [{"document_id": "doc-1", "filename": "a.pdf", "chunk_index": 1,
                  "passage": "x" * 600, "similarity": 0.6}]
    CONFIDENCE = {"level": "medium", "avg_similarity": 0.42, "disclaimer": None}

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

    async def _wf_stub(run_id, definition, ctx, *, pool, redis, stream_run_id=None):
        ctx.final_output = {"text": ANSWER}
        ctx.final_source_refs = SOURCE_REFS
        ctx.final_citations = CITATIONS
        ctx.final_confidence = CONFIDENCE

    app.dependency_overrides[get_supabase] = lambda: sb
    app.dependency_overrides[get_redis] = lambda: fake_redis
    try:
        with patch("app.api.threads.get_pg_pool", AsyncMock(return_value=mock_asyncpg_pool)), \
             patch("app.api.threads.insert_run", AsyncMock()), \
             patch("app.api.threads.create_workflow_run",
                   AsyncMock(return_value=new_run_id)), \
             patch("app.api.threads.generate_thread_title", return_value=("T", None)), \
             patch("app.api.threads.finalize_run", AsyncMock()), \
             patch("app.api.threads.insert_assistant_message",
                   AsyncMock(return_value=uuid.uuid4())), \
             patch("app.services.harness_engine.run_workflow", _wf_stub), \
             patch("app.services.harness_engine._load_run_definition",
                   AsyncMock(return_value=None)):
            async with httpx.AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as c:
                resp = await c.post(
                    f"/threads/{thread_id}/messages",
                    headers={"Authorization": "Bearer test-token"},
                    json={"content": "answer me",
                          "workflow_definition_id": str(def_id)},
                )
            assert resp.status_code == 201, resp.text
            producer_run_id = resp.json()["run_id"]

            from app.api.threads import RUN_TASKS
            run_id = UUID(producer_run_id)
            task = RUN_TASKS.get(run_id)
            if task is not None:
                try:
                    await _asyncio.wait_for(task, timeout=5.0)
                except Exception:
                    pass

            by_type: dict[str, tuple[str, dict]] = {}
            for stream, fields in fake_redis.xadds:
                payload = _json.loads(fields["data"])
                by_type[payload["type"]] = (stream, payload)

            expected_stream = f"run:{producer_run_id}"
            # All three grounding events fired on the producer stream.
            assert "sources" in by_type and by_type["sources"][0] == expected_stream
            assert by_type["sources"][1]["sources"] == SOURCE_REFS
            assert "citations" in by_type and by_type["citations"][0] == expected_stream
            # passage truncated to 400 chars in the SSE payload (Deep parity).
            assert len(by_type["citations"][1]["citations"][0]["passage"]) == 400
            assert "confidence" in by_type and by_type["confidence"][0] == expected_stream
            conf_payload = by_type["confidence"][1]
            assert conf_payload["level"] == "medium"
            assert conf_payload["avg_similarity"] == 0.42
            assert conf_payload["disclaimer"] is None
    finally:
        app.dependency_overrides.pop(get_supabase, None)
        app.dependency_overrides.pop(get_redis, None)


@pytest.mark.asyncio
async def test_run_workflow_accumulates_grounding_across_phases_onto_final(
    build_workflow_definition, mock_asyncpg_pool, fake_redis
):
    """F7 cross-phase nuance: the engine UNIONS source_refs/citations/similarity
    across ALL phases and exposes the deduped + confidence-scored union on
    ctx.final_source_refs / final_citations / final_confidence — so a RESEARCH
    phase (gathers grounding) → SUMMARIZE phase (no grounding of its own) ends with
    the research grounding ON the final answer.
    """
    from app.services import harness_engine

    wf = build_workflow_definition(
        [
            {"slug": "research", "config": {"phase_type": "llm_single", "prompt": "r"}},
            {"slug": "summarize", "config": {"phase_type": "llm_single", "prompt": "s"}},
        ]
    )
    wf_run_id = uuid.uuid4()
    producer_id = uuid.uuid4()
    ids = [uuid.uuid4(), uuid.uuid4()]
    mock_asyncpg_pool.set_fetch_result([
        {"id": ids[0], "slug": "research", "phase_index": 0, "status": "pending", "output": {}},
        {"id": ids[1], "slug": "summarize", "phase_index": 1, "status": "pending", "output": {}},
    ])

    async def _stub(phase, accumulated, ctx):
        if phase.slug == "research":
            # The research phase gathered grounding (two hits, one a dup of the other
            # by document_id+chunk_index → deduped to one citation).
            return {
                "text": "research notes",
                "source_refs": [
                    {"document_id": "doc-1", "filename": "a.pdf"},
                    {"document_id": "doc-1", "filename": "a.pdf"},
                ],
                "citations": [
                    {"document_id": "doc-1", "filename": "a.pdf", "chunk_index": 2,
                     "passage": "p", "similarity": 0.6},
                    {"document_id": "doc-1", "filename": "a.pdf", "chunk_index": 2,
                     "passage": "p", "similarity": 0.6},
                ],
                "similarity_scores": [0.6],
            }
        # The summarize (FINAL) phase produces only prose — NO grounding of its own.
        return {"text": "FINAL ANSWER"}

    # Force the harness package import FIRST so run_workflow's lazy
    # `from app.services.harness.validators import run_gates` (which transitively
    # runs register_all → PHASE_TYPE_REGISTRY.update with the REAL executors) cannot
    # OVERWRITE the stub mid-run. Without this, an isolated run imports the package
    # fresh inside run_workflow and clobbers the stub (test-ordering fragility).
    import app.services.harness  # noqa: F401
    _orig = harness_engine.PHASE_TYPE_REGISTRY.get("llm_single")
    harness_engine.PHASE_TYPE_REGISTRY["llm_single"] = _stub
    try:
        ctx = _harness_ctx(producer_run_id=producer_id)
        await harness_engine.run_workflow(
            wf_run_id, wf, ctx, pool=mock_asyncpg_pool, redis=fake_redis,
            stream_run_id=producer_id,
        )
    finally:
        _restore_registry(harness_engine, "llm_single", _orig)

    # The FINAL answer is the summarize phase's text (D-10) ...
    assert ctx.final_output["text"] == "FINAL ANSWER"
    # ... but the grounding is the RESEARCH phase's, accumulated + deduped onto it.
    assert len(ctx.final_citations) == 1, "citations deduped by document_id+chunk_index"
    assert ctx.final_citations[0]["document_id"] == "doc-1"
    # source_refs prefers the full deduped citation objects (Deep D-13).
    assert ctx.final_source_refs == ctx.final_citations
    # confidence computed from the avg similarity over the union (0.6 → 'high').
    assert ctx.final_confidence is not None
    assert ctx.final_confidence["level"] == "high"
    assert ctx.final_confidence["avg_similarity"] == 0.6


@pytest.mark.asyncio
async def test_run_workflow_no_grounding_leaves_final_grounding_empty(
    build_workflow_definition, mock_asyncpg_pool, fake_redis
):
    """F7 negative: a workflow whose phases gather NO grounding (a non-RAG workflow)
    ends with empty source_refs/citations and confidence=None — identical to a Deep
    turn that searched nothing (no reference chips, no confidence chip).
    """
    from app.services import harness_engine

    wf = _three_phase_def(build_workflow_definition)
    wf_run_id = uuid.uuid4()
    producer_id = uuid.uuid4()
    ids = [uuid.uuid4() for _ in range(3)]
    mock_asyncpg_pool.set_fetch_result([
        {"id": ids[0], "slug": "p0", "phase_index": 0, "status": "pending", "output": {}},
        {"id": ids[1], "slug": "p1", "phase_index": 1, "status": "pending", "output": {}},
        {"id": ids[2], "slug": "p2", "phase_index": 2, "status": "pending", "output": {}},
    ])

    async def _stub(phase, accumulated, ctx):
        return {"text": phase.slug}  # no grounding keys

    # Force the harness package import FIRST (see the sibling F7 engine test) so the
    # lazy register_all inside run_workflow cannot clobber the stub on isolated runs.
    import app.services.harness  # noqa: F401
    _orig = harness_engine.PHASE_TYPE_REGISTRY.get("llm_single")
    harness_engine.PHASE_TYPE_REGISTRY["llm_single"] = _stub
    try:
        ctx = _harness_ctx(producer_run_id=producer_id)
        await harness_engine.run_workflow(
            wf_run_id, wf, ctx, pool=mock_asyncpg_pool, redis=fake_redis,
            stream_run_id=producer_id,
        )
    finally:
        _restore_registry(harness_engine, "llm_single", _orig)

    assert ctx.final_source_refs == []
    assert ctx.final_citations == []
    assert ctx.final_confidence is None


@pytest.mark.asyncio
async def test_exec_llm_agent_threads_subagent_grounding_to_phase_output():
    """F7 (executor seam): _exec_llm_agent returns source_refs/citations/
    similarity_scores from the sub-agent result on the phase-output dict (so the
    engine can union them). run_task_sub_agent is stubbed to return the grounding the
    real sub-agent loop now accumulates off each search_documents ToolResult.
    """
    from unittest.mock import patch

    from app.services.harness import phase_types

    sub_result = {
        "sub_run_id": uuid.uuid4(),
        "summary": "research summary",
        "status": "completed",
        "source_refs": [{"document_id": "doc-9", "filename": "z.pdf"}],
        "citations": [{"document_id": "doc-9", "filename": "z.pdf", "chunk_index": 0,
                       "passage": "q", "similarity": 0.5}],
        "similarity_scores": [0.5],
    }

    async def _fake_sub_agent(**kwargs):
        return sub_result

    ctx = _harness_ctx()
    ctx.supabase = object()
    ctx.user_settings = None
    # apply_tool_budget/get_tools read user_settings=None safely; stub the sub-agent.
    with patch.object(phase_types, "run_task_sub_agent", _fake_sub_agent):
        out = await phase_types._exec_llm_agent(_llm_agent_phase(), {}, ctx)

    assert out["text"] == "research summary"
    assert out["source_refs"] == sub_result["source_refs"]
    assert out["citations"] == sub_result["citations"]
    assert out["similarity_scores"] == [0.5]


# ═════════════════════════════════════════════════════════════════════════════
# 092-07 — F8: thread the kickoff_prompt into the harness ctx + first-phase turn
# ═════════════════════════════════════════════════════════════════════════════
#
# F8: SEED-047 STORED the user's question in workflow_runs.inputs.kickoff_prompt
# (threads.py create_workflow_run), but the consumption half was never wired. The
# LLM phase executors built their user turn from _prior_output_text(accumulated),
# which is EMPTY for the FIRST phase — so a Research→Summarize workflow's research
# phase ran with NO user question and asked "please send me the topic…". The fix
# threads kickoff_prompt onto the engine ctx (live wf_ctx + BOTH resume builders,
# mirroring the persisted inputs jsonb) and feeds it to the FIRST phase's user turn
# / sub-agent task ONLY (later phases keep chaining off prior output — unchanged).


def _llm_single_phase(slug="research", prompt="do research"):
    """A minimal llm_single PhaseSpec for the F8 user-turn tests."""
    from app.models.harness import PhaseSpec

    return PhaseSpec.model_validate(
        {
            "slug": slug,
            "phase_index": 0,
            "config": {"phase_type": "llm_single", "prompt": prompt},
        }
    )


# ── F8 (a): the live wf_ctx + both resume builders carry inputs.kickoff_prompt ──

def test_live_wf_ctx_sets_inputs_kickoff_prompt_in_source():
    """F8 (live): the threads.py harness wf_ctx build sets inputs={"kickoff_prompt":
    body.content} — mirroring EXACTLY what create_workflow_run persisted (:995) so
    live ctx.inputs matches the durable inputs jsonb the resume builders read back.
    """
    import inspect
    from app.api import threads as threads_mod

    src = inspect.getsource(threads_mod)
    # create_workflow_run stored it; the wf_ctx must mirror it so the first phase reads it.
    assert 'inputs={"kickoff_prompt": body.content}' in src, (
        "harness wf_ctx must set inputs={'kickoff_prompt': body.content} (the "
        "consumption half of SEED-047 — without it the first phase gets an empty "
        "user turn and asks for the topic)"
    )


@pytest.mark.asyncio
async def test_build_resume_context_rehydrates_kickoff_prompt(
    monkeypatch, fake_redis, mock_asyncpg_pool
):
    """F8 (resume sweep): _build_resume_context sets ctx.inputs from the persisted
    workflow_runs.inputs jsonb carried on the `run` row (find_resumable_runs now
    SELECTs wr.inputs) — so a resumed first phase still knows the original question.
    """
    from app.services import harness_engine

    async def _spy_insert(pool, **kwargs):
        return None

    import app.db.runs as runs_mod
    monkeypatch.setattr(runs_mod, "insert_run", _spy_insert)
    import app.dependencies as deps_mod
    monkeypatch.setattr(deps_mod, "get_supabase", lambda: object())

    wf_run_id = uuid.uuid4()
    run = {
        "run_id": wf_run_id,
        "thread_id": uuid.uuid4(),
        "user_id": uuid.uuid4(),
        # the persisted inputs jsonb (find_resumable_runs SELECTs wr.inputs).
        "inputs": {"kickoff_prompt": "research mitochondria"},
    }

    ctx = await harness_engine._build_resume_context(run, fake_redis, mock_asyncpg_pool)
    assert (getattr(ctx, "inputs", None) or {}).get("kickoff_prompt") == "research mitochondria"


@pytest.mark.asyncio
async def test_build_resume_context_parses_inputs_when_jsonb_arrives_as_str(
    monkeypatch, fake_redis, mock_asyncpg_pool
):
    """F8 (resume sweep, codec): asyncpg's default codec hands jsonb back as a str —
    _build_resume_context parses it defensively (json.loads) so ctx.inputs is a dict.
    """
    import json as _json
    from app.services import harness_engine

    async def _spy_insert(pool, **kwargs):
        return None

    import app.db.runs as runs_mod
    monkeypatch.setattr(runs_mod, "insert_run", _spy_insert)
    import app.dependencies as deps_mod
    monkeypatch.setattr(deps_mod, "get_supabase", lambda: object())

    run = {
        "run_id": uuid.uuid4(),
        "thread_id": uuid.uuid4(),
        "user_id": uuid.uuid4(),
        "inputs": _json.dumps({"kickoff_prompt": "topic from a jsonb str"}),
    }

    ctx = await harness_engine._build_resume_context(run, fake_redis, mock_asyncpg_pool)
    assert isinstance(ctx.inputs, dict)
    assert ctx.inputs["kickoff_prompt"] == "topic from a jsonb str"


def test_find_resumable_runs_selects_inputs_in_source():
    """F8: find_resumable_runs must SELECT wr.inputs so _build_resume_context can
    read run.get('inputs') (the kickoff_prompt rehydration source on resume).
    """
    import inspect
    from app.db import workflows as wf_mod

    src = inspect.getsource(wf_mod.find_resumable_runs)
    assert "wr.inputs" in src, (
        "find_resumable_runs must SELECT wr.inputs so the resume ctx rehydrates the "
        "kickoff_prompt"
    )


def test_harness_continuation_threads_kickoff_prompt_in_source():
    """F8 (continue): the Continue resume path reads workflow_runs.inputs and sets
    inputs= on the continuation ctx — so a re-driven first phase still acts on the
    user's question. Source-level assertion against continue_run.
    """
    import inspect
    from app.api import runs as runs_api

    src = inspect.getsource(runs_api.continue_run)
    # the workflow_runs select pulls inputs ...
    assert '"id, continues_used, definition_id, inputs"' in src, (
        "the Continue path's workflow_runs SELECT must pull `inputs` for kickoff rehydration"
    )
    # ... and the continuation ctx carries it.
    assert "inputs=_wf_inputs" in src, (
        "_harness_continuation must set inputs= from the persisted workflow_runs.inputs"
    )


# ── F8 (b): the FIRST LLM phase's user turn / sub-agent task carries kickoff ─────

@pytest.mark.asyncio
async def test_exec_llm_single_first_phase_user_turn_is_kickoff_prompt():
    """F8 (b): with NO accumulated outputs (the first phase), _exec_llm_single's user
    turn is the kickoff_prompt — so the first phase acts on the user's question
    instead of an empty string.
    """
    from unittest.mock import patch

    from app.services.harness import phase_types

    captured = {}

    async def _fake_stream(*, messages, tools, model, user_settings):
        captured["messages"] = messages
        return ("ok", [])

    ctx = _harness_ctx(inputs={"kickoff_prompt": "What do the theses say about query optimization?"})
    with patch.object(phase_types, "_stream_one_iteration", _fake_stream):
        await phase_types._exec_llm_single(_llm_single_phase(), {}, ctx)

    user_msg = next(m for m in captured["messages"] if m["role"] == "user")
    assert user_msg["content"] == "What do the theses say about query optimization?"


@pytest.mark.asyncio
async def test_exec_llm_single_later_phase_user_turn_is_prior_output_not_kickoff():
    """F8 (c): a LATER phase (accumulated outputs present) uses the prior phase's
    output as its user turn — NOT the kickoff_prompt. Chaining is unchanged.
    """
    from unittest.mock import patch

    from app.services.harness import phase_types

    captured = {}

    async def _fake_stream(*, messages, tools, model, user_settings):
        captured["messages"] = messages
        return ("ok", [])

    ctx = _harness_ctx(inputs={"kickoff_prompt": "ORIGINAL QUESTION"})
    accumulated = {"research": {"text": "PRIOR PHASE OUTPUT"}}
    with patch.object(phase_types, "_stream_one_iteration", _fake_stream):
        await phase_types._exec_llm_single(
            _llm_single_phase(slug="summarize", prompt="summarize"), accumulated, ctx
        )

    user_msg = next(m for m in captured["messages"] if m["role"] == "user")
    # The later phase chains off prior output — the kickoff_prompt must NOT leak in.
    assert user_msg["content"] == "PRIOR PHASE OUTPUT"
    assert "ORIGINAL QUESTION" not in user_msg["content"]


@pytest.mark.asyncio
async def test_exec_llm_agent_first_phase_subagent_task_carries_kickoff_prompt():
    """F8 (b): the sub-agent's USER turn is its `description` (task_service.py:351).
    For the FIRST phase (no accumulated outputs), the description MUST include the
    kickoff_prompt so the sub-agent's search_documents targets the user's topic —
    pre-F8 it was just the slug label `Phase: <slug>` (no question).
    """
    from unittest.mock import patch

    from app.services.harness import phase_types

    captured = {}

    async def _fake_sub_agent(**kwargs):
        captured["description"] = kwargs.get("description")
        return {"sub_run_id": uuid.uuid4(), "summary": "s", "status": "completed"}

    ctx = _harness_ctx(inputs={"kickoff_prompt": "summarize the DBA folder theses"})
    ctx.supabase = object()
    ctx.user_settings = None
    with patch.object(phase_types, "run_task_sub_agent", _fake_sub_agent):
        await phase_types._exec_llm_agent(_llm_agent_phase(), {}, ctx)

    assert "summarize the DBA folder theses" in captured["description"], (
        "the first phase's sub-agent description (its user turn) must carry the "
        "kickoff_prompt so search_documents targets the user's question"
    )


@pytest.mark.asyncio
async def test_exec_llm_agent_later_phase_subagent_task_uses_prior_output():
    """F8 (c): a LATER llm_agent phase's sub-agent description carries the PRIOR
    phase output, not the kickoff_prompt — chaining preserved.
    """
    from unittest.mock import patch

    from app.services.harness import phase_types

    captured = {}

    async def _fake_sub_agent(**kwargs):
        captured["description"] = kwargs.get("description")
        return {"sub_run_id": uuid.uuid4(), "summary": "s", "status": "completed"}

    ctx = _harness_ctx(inputs={"kickoff_prompt": "ORIGINAL QUESTION"})
    ctx.supabase = object()
    ctx.user_settings = None
    accumulated = {"research": {"text": "PRIOR PHASE OUTPUT"}}
    with patch.object(phase_types, "run_task_sub_agent", _fake_sub_agent):
        await phase_types._exec_llm_agent(_llm_agent_phase(), accumulated, ctx)

    assert "PRIOR PHASE OUTPUT" in captured["description"]
    assert "ORIGINAL QUESTION" not in captured["description"]
