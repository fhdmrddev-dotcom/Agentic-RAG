"""Phase 091 Plan 01 Task 2 — conftest smoke test.

Proves the 5 new shared harness fixtures import and compose. The matching
``-k "conftest_smoke or fixtures_importable"`` quick target runs this module.
"""
from __future__ import annotations


def test_fixtures_importable(
    mock_asyncpg_pool,
    fake_redis,
    make_tool_context,
    make_run_context,
    build_workflow_definition,
):
    """conftest_smoke: every Plan-01 harness fixture is importable + composes."""
    # asyncpg UPDATE-order recorder starts empty + supports per-test injection.
    assert mock_asyncpg_pool.calls == []
    mock_asyncpg_pool.set_fetchrow_result({"status": "active"})
    assert mock_asyncpg_pool._fetchrow_result == {"status": "active"}

    # fake redis pub/sub + xadd surfaces present.
    assert fake_redis.xadds == []
    assert fake_redis.pubsub() is not None
    fake_redis.push_message({"type": "message", "data": "hi"})  # inbound queue works

    # context factory carries the phase_whitelist passthrough (Plan 06).
    ctx = make_tool_context(phase_whitelist=frozenset({"search_documents"}))
    assert ctx.phase_whitelist == frozenset({"search_documents"})
    # default = None (Deep Mode no-op).
    assert make_tool_context().phase_whitelist is None

    # run-identity bag.
    rc = make_run_context()
    assert rc.run_id is not None and rc.thread_id is not None

    # builder parses a single phase + the 4 seeds.
    wf = build_workflow_definition.single_phase(
        {"phase_type": "llm_single", "prompt": "x"}
    )
    assert wf.phases[0].config.phase_type == "llm_single"
    seeds = build_workflow_definition.four_seed_defs()
    assert len(seeds) == 4

    # all 5 phase types appear across the 4 seeds.
    kinds = {p.config.phase_type for seed in seeds for p in seed.phases}
    assert kinds == {
        "programmatic",
        "llm_single",
        "llm_agent",
        "llm_batch_agents",
        "llm_human_input",
    }
