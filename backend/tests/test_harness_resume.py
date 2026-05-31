"""Phase 091 — HARNESS-03 resumability contracts (Wave-0 skeleton).

2-phase write order + crash-leaves-active are flipped live by Plan 02; the
startup sweep / claim / ask_user re-subscribe contracts by Plan 04. Each skip
names its owning plan. One live structural assert keeps the module non-trivial.
"""
from __future__ import annotations

import pytest

from app.models.harness import WorkflowDefinition


def test_resume_module_uses_real_definition_shape(build_workflow_definition):
    """LIVE structural anchor — a resumable run is a real parsed WorkflowDefinition."""
    wf = build_workflow_definition.single_phase(
        {"phase_type": "llm_agent", "prompt": "x", "available_tools": ["search_documents"]}
    )
    assert isinstance(wf, WorkflowDefinition)
    assert wf.phases[0].phase_index == 0


# ── HARNESS-03 2-phase write (Plan 02) ──────────────────────────────────────

@pytest.mark.skip(reason="Wave 0 contract — flipped live by Plan 02")
def test_two_phase_write_active_before_completed(mock_asyncpg_pool, make_run_context):
    """active-UPDATE index < completed-UPDATE index in mock_asyncpg_pool.calls."""
    raise NotImplementedError


@pytest.mark.skip(reason="Wave 0 contract — flipped live by Plan 02")
def test_crash_leaves_phase_active_not_completed(mock_asyncpg_pool, make_run_context):
    """execute raising mid-phase → NO status='completed' UPDATE for that phase."""
    raise NotImplementedError


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
