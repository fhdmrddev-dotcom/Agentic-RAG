"""Phase 091 — HARNESS-03 resumability contracts.

2-phase write order + crash-leaves-active are flipped LIVE by Plan 02 (this
file); the startup sweep / claim / ask_user re-subscribe contracts by Plan 04.
Each remaining skip names its owning plan. One live structural assert keeps the
module non-trivial.
"""
from __future__ import annotations

import uuid

import pytest

from app.models.harness import WorkflowDefinition


def test_resume_module_uses_real_definition_shape(build_workflow_definition):
    """LIVE structural anchor — a resumable run is a real parsed WorkflowDefinition."""
    wf = build_workflow_definition.single_phase(
        {"phase_type": "llm_agent", "prompt": "x", "available_tools": ["search_documents"]}
    )
    assert isinstance(wf, WorkflowDefinition)
    assert wf.phases[0].phase_index == 0


def _active_completed_indices(calls):
    """Return (first active-UPDATE index, first completed-UPDATE index) over calls."""
    active_idx = completed_idx = None
    for i, (sql, _args) in enumerate(calls):
        if "status='active'" in sql and active_idx is None:
            active_idx = i
        if "status='completed'" in sql and completed_idx is None:
            completed_idx = i
    return active_idx, completed_idx


# ── HARNESS-03 2-phase write (Plan 02 — LIVE) ───────────────────────────────

@pytest.mark.asyncio
async def test_two_phase_write_active_before_completed(
    mock_asyncpg_pool, build_workflow_definition
):
    """active-UPDATE index < completed-UPDATE index in mock_asyncpg_pool.calls.

    Drives one phase through the engine with a stubbed executor and asserts the
    helper's two ordered atomic UPDATEs land in the right order on the pool.
    """
    from app.services import harness_engine

    wf = build_workflow_definition.single_phase(
        {"phase_type": "llm_single", "prompt": "Summarize."}
    )
    run_id = uuid.uuid4()
    phase_id = uuid.uuid4()
    # load_run_phases reads via pool.fetch → seed one pending phase row.
    mock_asyncpg_pool.set_fetch_result(
        [{"id": phase_id, "slug": "p0", "phase_index": 0, "status": "pending", "output": {}}]
    )

    async def _stub(phase, accumulated, ctx):
        return {"text": "done"}

    harness_engine.PHASE_TYPE_REGISTRY["llm_single"] = _stub
    try:
        ctx = type("C", (), {})()
        await harness_engine.run_workflow(
            run_id, wf, ctx, pool=mock_asyncpg_pool, redis=_NoopRedis()
        )
    finally:
        harness_engine.PHASE_TYPE_REGISTRY.pop("llm_single", None)

    active_idx, completed_idx = _active_completed_indices(mock_asyncpg_pool.calls)
    assert active_idx is not None, "no status='active' UPDATE recorded"
    assert completed_idx is not None, "no status='completed' UPDATE recorded"
    assert active_idx < completed_idx, "active must be written BEFORE completed"


@pytest.mark.asyncio
async def test_crash_leaves_phase_active_not_completed(
    mock_asyncpg_pool, build_workflow_definition
):
    """execute raising mid-phase → NO status='completed' UPDATE for that phase."""
    from app.services import harness_engine

    wf = build_workflow_definition.single_phase(
        {"phase_type": "llm_single", "prompt": "Summarize."}
    )
    run_id = uuid.uuid4()
    phase_id = uuid.uuid4()
    mock_asyncpg_pool.set_fetch_result(
        [{"id": phase_id, "slug": "p0", "phase_index": 0, "status": "pending", "output": {}}]
    )

    async def _boom(phase, accumulated, ctx):
        raise RuntimeError("phase blew up mid-work")

    harness_engine.PHASE_TYPE_REGISTRY["llm_single"] = _boom
    try:
        ctx = type("C", (), {})()
        with pytest.raises(RuntimeError):
            await harness_engine.run_workflow(
                run_id, wf, ctx, pool=mock_asyncpg_pool, redis=_NoopRedis()
            )
    finally:
        harness_engine.PHASE_TYPE_REGISTRY.pop("llm_single", None)

    active_idx, completed_idx = _active_completed_indices(mock_asyncpg_pool.calls)
    assert active_idx is not None, "phase should have been marked active first"
    assert completed_idx is None, "a crashed phase must NEVER be marked completed"


class _NoopRedis:
    """Minimal redis stand-in for the engine's _emit XADD (records nothing)."""

    async def xadd(self, *args, **kwargs):
        return "0-0"


# ── HARNESS-03 startup sweep + ask_user resume (Plan 04) ────────────────────

@pytest.mark.skip(reason="Wave 0 contract — flipped live by Plan 04")
def test_sweep_reruns_active_phase(mock_asyncpg_pool, fake_redis, make_run_context):
    """Startup sweep re-runs an active-on-restart phase (idempotent claim)."""
    raise NotImplementedError


@pytest.mark.skip(reason="Wave 0 contract — flipped live by Plan 04")
def test_ask_user_answered_not_reasked(mock_asyncpg_pool, fake_redis):
    """A durably-answered ask_user prompt is NOT re-emitted on resume."""
    raise NotImplementedError


@pytest.mark.skip(reason="Wave 0 contract — flipped live by Plan 04")
def test_ask_user_pending_resubscribes_and_reemits(fake_redis):
    """Pending ask_user: re-SUBSCRIBE precedes re-emit XADD in fake_redis.events (Pitfall 2)."""
    raise NotImplementedError
