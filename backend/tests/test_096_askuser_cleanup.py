"""Phase 096 Plan 03 — BUG-260605-01 backend fix contracts (D-06).

Task 1: terminal-site ask_user expiry cleanup in ``harness_engine.py`` — every
terminal site resolves any outstanding ask_user prompt for that run with an
INSERT-only expiry write (a system message shaped as the matching
``ask_user_response`` with ``expired: true``) that the EXISTING /pending
NOT EXISTS correlation in ``panel.py`` excludes naturally.

Task 2: /pending liveness filter (``panel.py``) — prompts whose owning run is
dead are excluded for BOTH ID namespaces (workflow_runs-keyed harness prompts
AND runs-keyed Deep prompts); unknown/legacy run ids fail OPEN (Pitfall 6 —
the filter must never eat live Deep prompts or legacy prompts).

Modeled on test_harness_resume.py:174-232 (mock_asyncpg_pool SQL-order
recording — conftest.py).
"""
from __future__ import annotations

import asyncio
import uuid
from types import SimpleNamespace

import pytest


class _NoopRedis:
    """Minimal redis stand-in for the engine's _emit XADD (records nothing)."""

    async def xadd(self, *args, **kwargs):
        return "0-0"


def _expiry_insert_indices(calls):
    """Indices of ``INSERT INTO messages`` calls carrying an ask_user_response
    expiry payload (``kind == 'ask_user_response'`` with ``expired`` truthy)."""
    out = []
    for i, (sql, args) in enumerate(calls):
        if "INSERT INTO messages" not in str(sql):
            continue
        for a in args:
            if (
                isinstance(a, list)
                and a
                and isinstance(a[0], dict)
                and a[0].get("kind") == "ask_user_response"
            ):
                out.append(i)
    return out


def _first_index(calls, needle):
    """Index of the first recorded call whose SQL contains ``needle`` (or None)."""
    for i, (sql, _args) in enumerate(calls):
        if needle in str(sql):
            return i
    return None


def _phase_rows(phase_id):
    return [
        {"id": phase_id, "slug": "p0", "phase_index": 0, "status": "pending", "output": {}}
    ]


def _pending_prompt_rows(tcid, owner_id):
    """Rows the cleanup helper's pending-prompt SELECT returns (one prompt)."""
    return [{"tool_call_id": tcid, "user_id": owner_id}]


# ═══════════════════════════════════════════════════════════════════════════
# Task 1 — terminal-site cleanup (harness_engine.py)
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_fail_run_site_expires_pending_prompt(
    monkeypatch, mock_asyncpg_pool, build_workflow_definition
):
    """Test 1: the fail_run terminal site INSERTs one expiry row per pending
    prompt of that run — system message, kind=ask_user_response, matching
    tool_call_id, expired=true (assert via pool.calls)."""
    from app.services import harness_engine

    wf = build_workflow_definition.single_phase(
        {"phase_type": "llm_single", "prompt": "x"}
    )
    run_id = uuid.uuid4()
    owner_id = uuid.uuid4()
    mock_asyncpg_pool.set_fetch_results([
        _phase_rows(uuid.uuid4()),                    # load_run_phases
        _pending_prompt_rows("tc-dead", owner_id),    # cleanup pending SELECT
    ])

    async def _fail(phase, accumulated, ctx, **kwargs):
        return harness_engine.PhaseOutcome("fail_run", None, None, "gate exhausted")

    monkeypatch.setattr(harness_engine, "_run_phase_with_gates", _fail)

    ctx = SimpleNamespace(thread_id=str(uuid.uuid4()))
    await harness_engine.run_workflow(
        run_id, wf, ctx, pool=mock_asyncpg_pool, redis=_NoopRedis()
    )

    inserts = _expiry_insert_indices(mock_asyncpg_pool.calls)
    assert len(inserts) == 1, "fail_run site must write exactly one expiry row"
    _sql, args = mock_asyncpg_pool.calls[inserts[0]]
    payload = next(a for a in args if isinstance(a, list))[0]
    assert payload["kind"] == "ask_user_response"
    assert payload["tool_call_id"] == "tc-dead"
    assert payload["expired"] is True


@pytest.mark.asyncio
async def test_missing_skip_target_site_expires_pending_prompt(
    monkeypatch, mock_asyncpg_pool, build_workflow_definition
):
    """Site coverage: the missing-skip-target failure site (the second
    finish_run(..., 'failed')) also resolves pending prompts."""
    from app.services import harness_engine

    wf = build_workflow_definition.single_phase(
        {"phase_type": "llm_single", "prompt": "x"}
    )
    run_id = uuid.uuid4()
    owner_id = uuid.uuid4()
    mock_asyncpg_pool.set_fetch_results([
        _phase_rows(uuid.uuid4()),
        _pending_prompt_rows("tc-skip", owner_id),
    ])

    async def _skip(phase, accumulated, ctx, **kwargs):
        # Target slug does not exist in the definition → runtime fail-safe.
        return harness_engine.PhaseOutcome("skip_to", None, "no_such_phase", "r")

    monkeypatch.setattr(harness_engine, "_run_phase_with_gates", _skip)

    ctx = SimpleNamespace(thread_id=str(uuid.uuid4()))
    await harness_engine.run_workflow(
        run_id, wf, ctx, pool=mock_asyncpg_pool, redis=_NoopRedis()
    )

    assert len(_expiry_insert_indices(mock_asyncpg_pool.calls)) == 1


@pytest.mark.asyncio
async def test_cancel_mid_phase_expires_pending_prompt(
    monkeypatch, mock_asyncpg_pool, build_workflow_definition
):
    """Cancel path: a CancelledError landing in the phase await (where a
    paused ask_user blocks) triggers the expiry write, then re-raises — the
    threads.py F2 backstop terminalizes workflow_runs afterwards."""
    from app.services import harness_engine

    wf = build_workflow_definition.single_phase(
        {"phase_type": "llm_single", "prompt": "x"}
    )
    run_id = uuid.uuid4()
    owner_id = uuid.uuid4()
    mock_asyncpg_pool.set_fetch_results([
        _phase_rows(uuid.uuid4()),
        _pending_prompt_rows("tc-cancelled", owner_id),
    ])

    async def _cancelled(phase, accumulated, ctx, **kwargs):
        raise asyncio.CancelledError()

    monkeypatch.setattr(harness_engine, "_run_phase_with_gates", _cancelled)

    ctx = SimpleNamespace(thread_id=str(uuid.uuid4()))
    with pytest.raises(asyncio.CancelledError):
        await harness_engine.run_workflow(
            run_id, wf, ctx, pool=mock_asyncpg_pool, redis=_NoopRedis()
        )

    inserts = _expiry_insert_indices(mock_asyncpg_pool.calls)
    assert len(inserts) == 1, "cancel escape must still expire the pending prompt"


def _resume_stubs(monkeypatch, harness_engine, run_id, thread_id, *, redrive):
    """Monkeypatch the sweep collaborators (test_sweep_reruns_active_phase model)."""

    async def _find(pool):
        return [{
            "run_id": run_id, "thread_id": thread_id,
            "current_phase_id": None, "user_id": uuid.uuid4(), "inputs": {},
            "org_id": uuid.uuid4(),  # Phase 163 — resume ctx builds an org-scoped service-role client
        }]

    async def _claim(pool, rid, lease_seconds):
        return True

    async def _active(pool, rid):
        # A non-ask_user phase (no llm_human_input re-emit branch).
        return {"id": uuid.uuid4(), "slug": "p0", "phase_index": 0,
                "status": "active", "output": {}}

    async def _load_def(pool, rid):
        # Truthy sentinel — the stubbed redrive ignores the definition, but it
        # must be non-None or the sweep's WR-02 missing-definition guard skips
        # the run before the redrive (test_dual_mode_wiring.py uses object() too).
        return object()

    monkeypatch.setattr(harness_engine, "find_resumable_runs", _find)
    monkeypatch.setattr(harness_engine, "claim_run", _claim)
    monkeypatch.setattr(harness_engine, "get_active_phase", _active)
    monkeypatch.setattr(harness_engine, "_load_run_definition", _load_def)
    monkeypatch.setattr(harness_engine, "_resume_run", redrive)


@pytest.mark.asyncio
async def test_resume_finalizer_expires_pending_prompt(
    monkeypatch, fake_redis, mock_asyncpg_pool
):
    """Test 2a: the resume finalizer fires the expiry write on the SUCCESS exit
    path, AFTER the producer-shell finalize (the finally:-style guarantee)."""
    from app.services import harness_engine

    run_id = uuid.uuid4()
    owner_id = uuid.uuid4()

    async def _ok(rid, definition, ctx, *, pool, redis):
        return None

    _resume_stubs(monkeypatch, harness_engine, run_id, uuid.uuid4(), redrive=_ok)
    # The only pool.fetch in this drive is the cleanup pending-prompt SELECT.
    mock_asyncpg_pool.set_fetch_result(
        _pending_prompt_rows("tc-stranded", owner_id)
    )

    count = await harness_engine.resume_stranded_workflows(
        pool=mock_asyncpg_pool, redis=fake_redis
    )
    assert count == 1

    inserts = _expiry_insert_indices(mock_asyncpg_pool.calls)
    assert len(inserts) == 1, "resume finalizer must expire the pending prompt"
    # The producer-shell terminal write (UPDATE runs) precedes the expiry insert.
    fin_idx = _first_index(mock_asyncpg_pool.calls, "UPDATE runs")
    assert fin_idx is not None and fin_idx < inserts[0], (
        "expiry must land at/after the terminal-status write"
    )


@pytest.mark.asyncio
async def test_resume_finalizer_expires_on_failed_redrive(
    monkeypatch, fake_redis, mock_asyncpg_pool
):
    """Test 2b: the expiry write fires on the FAILURE exit path too (every
    resume exit path is covered)."""
    from app.services import harness_engine

    run_id = uuid.uuid4()
    owner_id = uuid.uuid4()

    async def _boom(rid, definition, ctx, *, pool, redis):
        raise RuntimeError("redrive blew up")

    _resume_stubs(monkeypatch, harness_engine, run_id, uuid.uuid4(), redrive=_boom)
    mock_asyncpg_pool.set_fetch_result(
        _pending_prompt_rows("tc-stranded-fail", owner_id)
    )

    with pytest.raises(RuntimeError):
        await harness_engine.resume_stranded_workflows(
            pool=mock_asyncpg_pool, redis=fake_redis
        )

    assert len(_expiry_insert_indices(mock_asyncpg_pool.calls)) == 1


@pytest.mark.asyncio
async def test_no_pending_prompt_is_a_noop(
    monkeypatch, mock_asyncpg_pool, build_workflow_definition
):
    """Test 3: a failing run with NO pending prompt produces ZERO expiry
    inserts (cleanup is no-op safe) while still terminalizing the run."""
    from app.services import harness_engine

    wf = build_workflow_definition.single_phase(
        {"phase_type": "llm_single", "prompt": "x"}
    )
    run_id = uuid.uuid4()
    mock_asyncpg_pool.set_fetch_results([
        _phase_rows(uuid.uuid4()),
        [],  # cleanup pending SELECT — nothing outstanding
    ])

    async def _fail(phase, accumulated, ctx, **kwargs):
        return harness_engine.PhaseOutcome("fail_run", None, None, "gate exhausted")

    monkeypatch.setattr(harness_engine, "_run_phase_with_gates", _fail)

    ctx = SimpleNamespace(thread_id=str(uuid.uuid4()))
    await harness_engine.run_workflow(
        run_id, wf, ctx, pool=mock_asyncpg_pool, redis=_NoopRedis()
    )

    assert _expiry_insert_indices(mock_asyncpg_pool.calls) == []
    # The run still terminalized normally.
    assert _first_index(mock_asyncpg_pool.calls, "UPDATE workflow_runs SET status") is not None


@pytest.mark.asyncio
async def test_expiry_write_lands_after_terminal_status_write(
    monkeypatch, mock_asyncpg_pool, build_workflow_definition
):
    """Test 4: cleanup write order — the expiry INSERT happens at/after the
    terminal-status write (finish_run's UPDATE workflow_runs), never before."""
    from app.services import harness_engine

    wf = build_workflow_definition.single_phase(
        {"phase_type": "llm_single", "prompt": "x"}
    )
    run_id = uuid.uuid4()
    owner_id = uuid.uuid4()
    mock_asyncpg_pool.set_fetch_results([
        _phase_rows(uuid.uuid4()),
        _pending_prompt_rows("tc-order", owner_id),
    ])

    async def _fail(phase, accumulated, ctx, **kwargs):
        return harness_engine.PhaseOutcome("fail_run", None, None, "gate exhausted")

    monkeypatch.setattr(harness_engine, "_run_phase_with_gates", _fail)

    ctx = SimpleNamespace(thread_id=str(uuid.uuid4()))
    await harness_engine.run_workflow(
        run_id, wf, ctx, pool=mock_asyncpg_pool, redis=_NoopRedis()
    )

    calls = mock_asyncpg_pool.calls
    terminal_idx = _first_index(calls, "UPDATE workflow_runs SET status")
    inserts = _expiry_insert_indices(calls)
    assert terminal_idx is not None, "no terminal-status write recorded"
    assert inserts, "no expiry insert recorded"
    assert terminal_idx < inserts[0], (
        "expiry insert must come AFTER the terminal-status write, never before"
    )


# ═══════════════════════════════════════════════════════════════════════════
# Task 2 — /pending liveness filter, dual ID namespace (panel.py)
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_pending_excludes_terminal_harness_prompt(mock_asyncpg_pool):
    """Test 5: a harness prompt whose workflow_runs.status is terminal (failed)
    is EXCLUDED from /pending."""
    from app.api import panel

    rid = str(uuid.uuid4())
    mock_asyncpg_pool.set_fetchrow_results([
        {"status": "failed", "active_workflow_run_id": uuid.UUID(rid)},
    ])
    assert await panel._prompt_run_is_live(mock_asyncpg_pool, rid) is False
    # The uuid column is compared via a ::text cast (no cast errors on
    # malformed prompt run_ids).
    sql = mock_asyncpg_pool.calls[0][0]
    assert "::text = $1" in sql


@pytest.mark.asyncio
async def test_pending_excludes_stale_anchor_harness_prompt(mock_asyncpg_pool):
    """Test 6: a harness prompt whose run is non-terminal but is NOT the
    thread's active_workflow_run_id anchor (stale anchor) is EXCLUDED —
    submit would 404 at the runs.py anchor-confirm, so showing it is dishonest."""
    from app.api import panel

    rid = str(uuid.uuid4())
    mock_asyncpg_pool.set_fetchrow_results([
        {"status": "active", "active_workflow_run_id": uuid.uuid4()},  # ≠ rid
    ])
    assert await panel._prompt_run_is_live(mock_asyncpg_pool, rid) is False

    # Counter-case: live AND anchored → INCLUDED (the happy harness path).
    mock_asyncpg_pool.set_fetchrow_results([
        {"status": "active", "active_workflow_run_id": uuid.UUID(rid)},
    ])
    assert await panel._prompt_run_is_live(mock_asyncpg_pool, rid) is True


@pytest.mark.asyncio
async def test_pending_keeps_live_deep_prompt(mock_asyncpg_pool):
    """Test 7 (Pitfall 6 guard): a Deep prompt (runs-keyed) whose runs.status
    is 'streaming' is INCLUDED — the filter must not eat the runs namespace."""
    from app.api import panel

    rid = str(uuid.uuid4())
    mock_asyncpg_pool.set_fetchrow_results([
        None,                       # workflow_runs miss (Deep namespace)
        {"status": "streaming"},    # runs hit — live
    ])
    assert await panel._prompt_run_is_live(mock_asyncpg_pool, rid) is True


@pytest.mark.asyncio
async def test_pending_excludes_terminal_deep_prompt(mock_asyncpg_pool):
    """Test 8: a Deep prompt whose runs.status is terminal is EXCLUDED."""
    from app.api import panel

    rid = str(uuid.uuid4())
    for terminal in ("completed", "failed"):
        mock_asyncpg_pool.set_fetchrow_results([None, {"status": terminal}])
        assert await panel._prompt_run_is_live(mock_asyncpg_pool, rid) is False, (
            f"runs.status={terminal!r} must be excluded"
        )


@pytest.mark.asyncio
async def test_pending_keeps_unknown_and_legacy_prompts(mock_asyncpg_pool):
    """Test 9: a prompt with NO resolvable run_id (legacy/unknown namespace)
    is INCLUDED — fail-open; never break legacy prompts."""
    from app.api import panel

    # Unknown id: misses BOTH namespaces → keep.
    mock_asyncpg_pool.set_fetchrow_results([None, None])
    assert await panel._prompt_run_is_live(mock_asyncpg_pool, "rid-unknown") is True

    # Legacy prompt with no run_id at all: keep, with ZERO liveness queries.
    fresh_calls_before = len(mock_asyncpg_pool.calls)
    assert await panel._prompt_run_is_live(mock_asyncpg_pool, None) is True
    assert await panel._prompt_run_is_live(mock_asyncpg_pool, "") is True
    assert len(mock_asyncpg_pool.calls) == fresh_calls_before, (
        "missing run_id must short-circuit without querying"
    )


def test_pending_route_filters_dead_prompt_keeps_legacy(
    client, mock_execute_result,
):
    """Route wiring: GET /ask_user/pending drops a dead-harness prompt and keeps
    a legacy (no-run_id) prompt; payload shape unchanged; ownership gate first."""
    from datetime import datetime, timezone
    from unittest.mock import AsyncMock, MagicMock, patch

    thread_id = "55555555-5555-5555-5555-555555555555"
    mock_execute_result.data = {"id": thread_id}  # ownership SELECT hit

    dead_rid = str(uuid.uuid4())
    created = datetime(2026, 6, 7, 12, 0, 0, tzinfo=timezone.utc)
    pool_rows = [
        {
            "id": uuid.uuid4(),
            "tool_calls": [{
                "kind": "ask_user_prompt", "tool_call_id": "tc-dead",
                "prompt": "dead?", "options": ["a"], "timeout_seconds": 300,
                "run_id": dead_rid,
            }],
            "created_at": created,
        },
        {
            "id": uuid.uuid4(),
            "tool_calls": [{
                "kind": "ask_user_prompt", "tool_call_id": "tc-legacy",
                "prompt": "legacy?", "options": None, "timeout_seconds": 60,
            }],
            "created_at": created,
        },
    ]
    mock_pool = MagicMock()
    mock_pool.fetch = AsyncMock(return_value=pool_rows)
    # Only the dead prompt resolves in workflow_runs (terminal) — one fetchrow.
    mock_pool.fetchrow = AsyncMock(
        side_effect=[{"status": "failed", "active_workflow_run_id": None}]
    )

    async def _async_pool():
        return mock_pool

    with patch("app.api.panel.get_pg_pool", side_effect=_async_pool):
        resp = client.get(f"/threads/{thread_id}/ask_user/pending")

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert len(body) == 1, "the dead-run prompt must be filtered out"
    assert body[0]["tool_call_id"] == "tc-legacy"
    # Payload shape unchanged (panel.py:144-155 consumers).
    assert set(body[0].keys()) == {
        "message_id", "tool_call_id", "prompt", "options",
        "timeout_seconds", "run_id", "draft", "created_at",
    }
