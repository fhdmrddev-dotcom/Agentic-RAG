"""Phase 091 — HARNESS-01 engine contracts (Wave-0 skeleton + live model tests).

Plan 01 (Wave 1) creates this file. The ``test_models_*`` group is LIVE NOW —
it pins the finalized ``harness.py`` PhaseConfig field shapes (Plan 01 Task 1).
The phase-dispatch / ordered-transition / completion contracts are SKIPPED
Wave-0 contracts flipped live by Plan 02 / Plan 03.

Every skip names the owning plan so the contract is greppable.
"""
from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.models.harness import (
    LlmAgentPhaseConfig,
    LlmBatchAgentsPhaseConfig,
    LlmHumanInputPhaseConfig,
    LlmSinglePhaseConfig,
    ProgrammaticPhaseConfig,
    WorkflowDefinition,
)


# ═══════════════════════════════════════════════════════════════════════
# LIVE NOW — HARNESS-01 model contracts (Plan 01 Task 1)
# ═══════════════════════════════════════════════════════════════════════


class TestModelsFinalized:
    """The 5 PhaseConfig models carry every field the engine reads."""

    def test_models_programmatic_accepts_input_keys(self):
        cfg = ProgrammaticPhaseConfig.model_validate(
            {"phase_type": "programmatic", "fn": "split_topic", "input_keys": ["topic"]}
        )
        assert cfg.fn == "split_topic"
        assert cfg.input_keys == ["topic"]

    def test_models_programmatic_input_keys_defaults_empty(self):
        cfg = ProgrammaticPhaseConfig.model_validate(
            {"phase_type": "programmatic", "fn": "noop"}
        )
        assert cfg.input_keys == []

    def test_models_llm_single_accepts_model_temperature_overrides(self):
        cfg = LlmSinglePhaseConfig.model_validate(
            {
                "phase_type": "llm_single",
                "prompt": "Summarize.",
                "model": "gpt-5.4",
                "temperature": 0.2,
            }
        )
        assert cfg.model == "gpt-5.4"
        assert cfg.temperature == 0.2

    def test_models_llm_single_overrides_default_none(self):
        cfg = LlmSinglePhaseConfig.model_validate(
            {"phase_type": "llm_single", "prompt": "Summarize."}
        )
        assert cfg.model is None
        assert cfg.temperature is None

    def test_models_llm_agent_has_wall_clock_and_model(self):
        cfg = LlmAgentPhaseConfig.model_validate(
            {
                "phase_type": "llm_agent",
                "prompt": "Research.",
                "available_tools": ["search_documents"],
                "max_steps": 8,
                "wall_clock_seconds": 600,
                "model": "claude-opus",
            }
        )
        assert cfg.wall_clock_seconds == 600
        assert cfg.model == "claude-opus"
        assert cfg.max_steps == 8

    def test_models_llm_agent_wall_clock_defaults_none(self):
        cfg = LlmAgentPhaseConfig.model_validate(
            {
                "phase_type": "llm_agent",
                "prompt": "Research.",
                "available_tools": ["search_documents"],
            }
        )
        assert cfg.wall_clock_seconds is None
        assert cfg.model is None
        assert cfg.max_steps == 10  # LOCKED default

    def test_models_batch_agents_has_wall_clock_model_and_merge_literal(self):
        cfg = LlmBatchAgentsPhaseConfig.model_validate(
            {
                "phase_type": "llm_batch_agents",
                "prompt": "Review each.",
                "available_tools": ["search_documents"],
                "merge_strategy": "concat_numbered",
                "wall_clock_seconds": 900,
                "model": "gpt-5.4",
            }
        )
        assert cfg.merge_strategy == "concat_numbered"
        assert cfg.wall_clock_seconds == 900
        assert cfg.model == "gpt-5.4"
        assert cfg.max_parallel_agents == 5  # LOCKED default

    def test_models_batch_agents_merge_strategy_rejects_unknown(self):
        with pytest.raises(ValidationError):
            LlmBatchAgentsPhaseConfig.model_validate(
                {
                    "phase_type": "llm_batch_agents",
                    "prompt": "Review.",
                    "available_tools": ["search_documents"],
                    "merge_strategy": "interleave",  # not a Literal member
                }
            )

    def test_models_human_input_has_options_and_timeout(self):
        cfg = LlmHumanInputPhaseConfig.model_validate(
            {
                "phase_type": "llm_human_input",
                "prompt": "Pick a topic.",
                "options": ["A", "B", "C"],
                "timeout_seconds": 600,
            }
        )
        assert cfg.options == ["A", "B", "C"]
        assert cfg.timeout_seconds == 600

    def test_models_human_input_defaults(self):
        cfg = LlmHumanInputPhaseConfig.model_validate(
            {"phase_type": "llm_human_input", "prompt": "Free text?"}
        )
        assert cfg.options == []  # empty = free-text
        assert cfg.timeout_seconds == 300  # per-call default

    def test_models_extra_forbid_preserved_unknown_key_rejected(self):
        with pytest.raises(ValidationError):
            LlmSinglePhaseConfig.model_validate(
                {"phase_type": "llm_single", "prompt": "x", "bogus_key": 1}
            )

    def test_models_no_final_output_field_anywhere(self):
        # D-11 — no v1 final_output knob on any phase config.
        for model in (
            ProgrammaticPhaseConfig,
            LlmSinglePhaseConfig,
            LlmAgentPhaseConfig,
            LlmBatchAgentsPhaseConfig,
            LlmHumanInputPhaseConfig,
        ):
            assert "final_output" not in model.model_fields

    def test_models_four_seed_definitions_parse(self, four_seed_defs):
        # The 4 canonical seed shapes parse with zero ValidationError.
        defs = four_seed_defs()
        assert len(defs) == 4
        for wf in defs:
            assert isinstance(wf, WorkflowDefinition)
            assert len(wf.phases) >= 1

    def test_models_unknown_phase_key_in_definition_rejected(self, build_workflow_definition):
        # extra='forbid' propagates through the discriminated union.
        with pytest.raises(ValidationError):
            build_workflow_definition(
                [
                    {
                        "slug": "p0",
                        "phase_index": 0,
                        "config": {
                            "phase_type": "llm_single",
                            "prompt": "x",
                            "injected": "evil",
                        },
                    }
                ]
            )

    def test_models_five_phase_types_all_constructible(self, build_workflow_definition):
        wf = build_workflow_definition(
            [
                {"slug": "p0", "phase_index": 0,
                 "config": {"phase_type": "programmatic", "fn": "split_topic", "input_keys": ["topic"]}},
                {"slug": "p1", "phase_index": 1,
                 "config": {"phase_type": "llm_single", "prompt": "s"}},
                {"slug": "p2", "phase_index": 2,
                 "config": {"phase_type": "llm_agent", "prompt": "a", "available_tools": ["search_documents"]}},
                {"slug": "p3", "phase_index": 3,
                 "config": {"phase_type": "llm_batch_agents", "prompt": "b", "available_tools": ["search_documents"]}},
                {"slug": "p4", "phase_index": 4,
                 "config": {"phase_type": "llm_human_input", "prompt": "h"}},
            ]
        )
        kinds = {p.config.phase_type for p in wf.phases}
        assert kinds == {
            "programmatic",
            "llm_single",
            "llm_agent",
            "llm_batch_agents",
            "llm_human_input",
        }


# ═══════════════════════════════════════════════════════════════════════
# LIVE — HARNESS-01 engine contracts (Plan 02)
# ═══════════════════════════════════════════════════════════════════════

import uuid  # noqa: E402


class _NoopRedis:
    """Records nothing; satisfies the engine's _emit XADD."""

    def __init__(self):
        self.xadds = []

    async def xadd(self, stream, fields, *args, **kwargs):
        self.xadds.append((stream, fields))
        return "0-0"


@pytest.mark.skip(reason="Wave 0 contract — flipped live by Plan 03 (5 real executors)")
def test_phase_dispatch_routes_each_of_5_types(build_workflow_definition):
    """HARNESS-01: each of the 5 phase_type literals routes to its executor."""
    raise NotImplementedError


@pytest.mark.asyncio
async def test_engine_drives_ordered_transitions(
    build_workflow_definition, mock_asyncpg_pool
):
    """HARNESS-01: engine drives phases in phase_index order with audited transitions."""
    from app.services import harness_engine

    wf = build_workflow_definition(
        [
            {"config": {"phase_type": "llm_single", "prompt": "first"}},
            {"config": {"phase_type": "llm_single", "prompt": "second"}},
            {"config": {"phase_type": "llm_single", "prompt": "third"}},
        ]
    )
    run_id = uuid.uuid4()
    ids = [uuid.uuid4() for _ in range(3)]
    mock_asyncpg_pool.set_fetch_result(
        [
            {"id": ids[0], "slug": "p0", "phase_index": 0, "status": "pending", "output": {}},
            {"id": ids[1], "slug": "p1", "phase_index": 1, "status": "pending", "output": {}},
            {"id": ids[2], "slug": "p2", "phase_index": 2, "status": "pending", "output": {}},
        ]
    )

    visited: list[str] = []

    async def _stub(phase, accumulated, ctx):
        visited.append(phase.slug)
        return {"text": phase.slug}

    harness_engine.PHASE_TYPE_REGISTRY["llm_single"] = _stub
    try:
        ctx = type("C", (), {})()
        await harness_engine.run_workflow(
            run_id, wf, ctx, pool=mock_asyncpg_pool, redis=_NoopRedis()
        )
    finally:
        harness_engine.PHASE_TYPE_REGISTRY.pop("llm_single", None)

    # Phases ran in phase_index order (the LLM did NOT pick the next phase).
    assert visited == ["p0", "p1", "p2"]
    # A terminal run_completed UPDATE on workflow_runs landed.
    assert any(
        "UPDATE workflow_runs SET status = $2" in sql for sql, _ in mock_asyncpg_pool.calls
    )


@pytest.mark.asyncio
async def test_completion_final_phase_output_is_chat_message(
    build_workflow_definition, mock_asyncpg_pool
):
    """HARNESS-01/D-10: the terminal phase output IS the chat message (no extra LLM call)."""
    from app.services import harness_engine

    wf = build_workflow_definition(
        [
            {"config": {"phase_type": "llm_single", "prompt": "draft"}},
            {"config": {"phase_type": "llm_single", "prompt": "final"}},
        ]
    )
    run_id = uuid.uuid4()
    ids = [uuid.uuid4(), uuid.uuid4()]
    mock_asyncpg_pool.set_fetch_result(
        [
            {"id": ids[0], "slug": "p0", "phase_index": 0, "status": "pending", "output": {}},
            {"id": ids[1], "slug": "p1", "phase_index": 1, "status": "pending", "output": {}},
        ]
    )

    async def _stub(phase, accumulated, ctx):
        return {"text": f"output of {phase.slug}"}

    harness_engine.PHASE_TYPE_REGISTRY["llm_single"] = _stub
    try:
        ctx = type("C", (), {})()
        await harness_engine.run_workflow(
            run_id, wf, ctx, pool=mock_asyncpg_pool, redis=_NoopRedis()
        )
    finally:
        harness_engine.PHASE_TYPE_REGISTRY.pop("llm_single", None)

    # The FINAL phase's output is set as the chat message verbatim (D-10).
    assert ctx.final_output == {"text": "output of p1"}


# ═══════════════════════════════════════════════════════════════════════
# LIVE — Plan 03: programmatic registry + split_topic (Task 1)
# ═══════════════════════════════════════════════════════════════════════


class TestProgrammaticRegistry:
    """Closed PROGRAMMATIC_PHASE_REGISTRY + decorator + idempotent split_topic."""

    def test_registry_is_closed_dict_with_split_topic(self):
        from app.services.harness.programmatic import PROGRAMMATIC_PHASE_REGISTRY

        assert isinstance(PROGRAMMATIC_PHASE_REGISTRY, dict)
        assert "split_topic" in PROGRAMMATIC_PHASE_REGISTRY

    def test_register_programmatic_decorator_registers(self):
        from app.services.harness.programmatic import (
            PROGRAMMATIC_PHASE_REGISTRY,
            register_programmatic,
        )

        @register_programmatic("_unit_test_fn")
        async def _fn(input, ctx):
            return {"ok": True}

        try:
            assert PROGRAMMATIC_PHASE_REGISTRY["_unit_test_fn"] is _fn
        finally:
            PROGRAMMATIC_PHASE_REGISTRY.pop("_unit_test_fn", None)

    @pytest.mark.asyncio
    async def test_split_topic_splits_on_clauses(self):
        from app.services.harness.programmatic import split_topic

        out = await split_topic(
            {"topic": "transformers in NLP; diffusion models and reinforcement learning"},
            None,
        )
        assert out["sub_questions"] == [
            "transformers in NLP",
            "diffusion models",
            "reinforcement learning",
        ]

    @pytest.mark.asyncio
    async def test_split_topic_single_topic_fallback(self):
        from app.services.harness.programmatic import split_topic

        out = await split_topic({"topic": "quantum computing"}, None)
        assert out["sub_questions"] == ["quantum computing"]

    @pytest.mark.asyncio
    async def test_split_topic_empty_topic(self):
        from app.services.harness.programmatic import split_topic

        out = await split_topic({"topic": ""}, None)
        assert out["sub_questions"] == []
        out2 = await split_topic({}, None)
        assert out2["sub_questions"] == []

    @pytest.mark.asyncio
    async def test_split_topic_is_idempotent(self):
        """Pattern 3 — same input twice yields identical output (resume-safe)."""
        from app.services.harness.programmatic import split_topic

        topic = {"topic": "A and B and C"}
        first = await split_topic(dict(topic), None)
        second = await split_topic(dict(topic), None)
        assert first == second
        assert first["sub_questions"] == ["A", "B", "C"]
