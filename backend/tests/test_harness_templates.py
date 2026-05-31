"""Phase 091 — HARNESS-07 seed-template contracts (Wave-0 skeleton).

End-to-end seed execution (each seed runs through the engine on a mocked LLM) is
owned by Plan 07. The parse + 5-type-coverage contracts are LIVE NOW (they only
need the finalized models from Task 1 + the four_seed_defs fixture). Skips name
Plan 07.
"""
from __future__ import annotations

import pytest

from app.models.harness import WorkflowDefinition


def test_each_seed_parses_via_model_validate(four_seed_defs):
    """LIVE — each of the 4 seed shapes parses via WorkflowDefinition.model_validate."""
    defs = four_seed_defs()
    assert len(defs) == 4
    for wf in defs:
        assert isinstance(wf, WorkflowDefinition)
        assert wf.status in ("draft", "published")
        assert len(wf.phases) >= 1


def test_seeds_cover_all_5_phase_types(four_seed_defs):
    """LIVE — the 4 seeds collectively exercise every one of the 5 phase types."""
    kinds = {p.config.phase_type for wf in four_seed_defs() for p in wf.phases}
    assert kinds == {
        "programmatic",
        "llm_single",
        "llm_agent",
        "llm_batch_agents",
        "llm_human_input",
    }


@pytest.mark.skip(reason="Wave 0 contract — flipped live by Plan 07")
def test_each_seed_runs_end_to_end_mocked_llm(make_run_context, fake_redis, mock_asyncpg_pool):
    """Each seed runs through the engine (mocked LLM): ordered completion + chat-msg +
    SSE + gate + batch + human-input branches all fire."""
    raise NotImplementedError
