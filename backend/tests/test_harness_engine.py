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
        assert cfg.max_steps == 12  # LOCKED default (093-09: 10 → 12, D-19 headroom)

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


def test_phase_dispatch_routes_each_of_5_types():
    """HARNESS-01: each phase_type literal routes to its executor.

    101.1 (D-04): the 6th phase type ``llm_emit`` (the SEALED FORCED EMIT) joins the
    original 5. 189 (CONN-01 / D-01): the 7th, ``external_action`` — the governed step
    that reaches outside and, in this milestone, SENDS NOTHING. The dispatch registry
    resolves all 7.

    ⚠ The test NAME still says 5 and is deliberately left alone: it is referenced by the
    §D15 baseline command and by two prior SUMMARYs, and renaming it would make a
    green-to-green comparison across plans impossible to grep. The ROSTER below is the
    contract; the name is a label that was already stale at 101.1.
    """
    import app.services.harness  # noqa: F401 — triggers register_all()
    from app.services.harness_engine import PHASE_TYPE_REGISTRY

    assert set(PHASE_TYPE_REGISTRY) == {
        "programmatic",
        "llm_single",
        "llm_agent",
        "llm_batch_agents",
        "llm_human_input",
        "llm_emit",  # 101.1 — the 6th (forced-emit phase, D-04)
        "external_action",  # 189 — the 7th (governed external action, D-01/SC#4)
    }
    # Every registered executor is callable (the dispatch seam resolves each).
    for executor in PHASE_TYPE_REGISTRY.values():
        assert callable(executor)


@pytest.mark.asyncio
async def test_external_action_dispatches_without_phase_type_not_registered():
    """V02 (189 / SC#1) — ``_execute_phase`` resolves ``external_action``.

    The registry-membership assertion above proves the KEY is present; this drives the
    engine's OWN dispatch function, which is the thing that raises
    ``PhaseTypeNotRegistered``. A 7th type registered under a key the engine never looks
    up would satisfy the set assertion and still kill every run.

    ANTI-VACUITY: an unregistered type is driven FIRST and observed raising, so the
    absence of a raise below is a measurement rather than a hopeful silence.
    """
    import app.services.harness  # noqa: F401 — triggers register_all()
    from app.models.harness import WorkflowDefinition
    from app.services.harness_engine import PhaseTypeNotRegistered, _execute_phase

    # The control: the dispatch really does raise for a type it does not know.
    unknown = SimpleNamespace(
        slug="ghost", config=SimpleNamespace(phase_type="no_such_phase_type")
    )
    with pytest.raises(PhaseTypeNotRegistered):
        await _execute_phase(unknown, {}, SimpleNamespace())

    wf = WorkflowDefinition.model_validate({
        "slug": "v02-external-action-dispatch",
        "version": 1,
        "name": "V02 dispatch",
        "status": "draft",
        "phases": [{
            "slug": "notify",
            "phase_index": 0,
            "config": {
                "phase_type": "external_action",
                "capability": "send_email",
                "available_tools": ["send_email"],
            },
        }],
    })

    output = await _execute_phase(wf.phases[0], {}, SimpleNamespace(inputs={}))

    assert isinstance(output, dict)
    assert isinstance(output.get("text"), str)
    assert output["recorded_intent"]["capability"] == "send_email"


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
# CR-02 (091-08) — large outputs are stored INLINE, never silently discarded
# ═══════════════════════════════════════════════════════════════════════


def test_persist_output_large_payload_stored_inline_not_placeholder():
    """A > 64 KB output round-trips through _persist_output with FULL content (CR-02)."""
    from app.services.harness_engine import _OUTPUT_INLINE_LIMIT, _persist_output

    big_text = "x" * (_OUTPUT_INLINE_LIMIT + 10_000)  # comfortably over the limit
    output = {"text": big_text}
    durable = _persist_output(output)
    # NEVER the dead placeholder; the full payload is preserved inline.
    assert "_spilled_path" not in durable, "must not emit a pending spill placeholder"
    assert durable == output, "full content preserved inline (no data loss)"
    assert durable["text"] == big_text


def test_persist_output_small_payload_unchanged():
    """A small output passes through unchanged (no behavior change)."""
    from app.services.harness_engine import _persist_output

    out = {"text": "small"}
    assert _persist_output(out) == out


def test_persist_output_honors_real_spilled_path():
    """A real _spilled_path (future bucket spill) is honored path-only when present."""
    from app.services.harness_engine import _OUTPUT_INLINE_LIMIT, _persist_output

    output = {"text": "y" * (_OUTPUT_INLINE_LIMIT + 5_000),
              "_spilled_path": "workspace-files://run/abc.json"}
    durable = _persist_output(output)
    assert durable == {"_spilled_path": "workspace-files://run/abc.json"}


@pytest.mark.asyncio
async def test_engine_persists_large_phase_output_inline(
    build_workflow_definition, mock_asyncpg_pool
):
    """The engine's complete_phase write carries the FULL large output, not a placeholder."""
    import json as _json

    from app.services import harness_engine
    from app.services.harness_engine import _OUTPUT_INLINE_LIMIT

    wf = build_workflow_definition(
        [{"config": {"phase_type": "llm_single", "prompt": "draft"}}]
    )
    run_id = uuid.uuid4()
    phase_id = uuid.uuid4()
    mock_asyncpg_pool.set_fetch_result(
        [{"id": phase_id, "slug": "p0", "phase_index": 0, "status": "pending", "output": {}}]
    )
    big_text = "z" * (_OUTPUT_INLINE_LIMIT + 8_000)

    async def _stub(phase, accumulated, ctx):
        return {"text": big_text}

    harness_engine.PHASE_TYPE_REGISTRY["llm_single"] = _stub
    try:
        ctx = type("C", (), {})()
        await harness_engine.run_workflow(
            run_id, wf, ctx, pool=mock_asyncpg_pool, redis=_NoopRedis()
        )
    finally:
        harness_engine.PHASE_TYPE_REGISTRY.pop("llm_single", None)

    # The completed-phase UPDATE persisted the full payload (output is arg $2 json).
    completed_args = [
        args for sql, args in mock_asyncpg_pool.calls
        if "SET status='completed'" in sql
    ]
    assert len(completed_args) == 1
    persisted = _json.loads(completed_args[0][1])  # the output=$2::jsonb json string
    assert persisted == {"text": big_text}, "full output stored inline, no placeholder"
    assert "_spilled_path" not in persisted


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


# ═══════════════════════════════════════════════════════════════════════
# LIVE — Plan 03: the 5 phase-type executors (Task 3)
# ═══════════════════════════════════════════════════════════════════════

from types import SimpleNamespace  # noqa: E402
from unittest.mock import AsyncMock, patch  # noqa: E402


def _phase(config_dict):
    """Build a single typed PhaseSpec from a config dict."""
    from app.models.harness import PhaseSpec

    return PhaseSpec.model_validate(
        {"slug": "p0", "phase_index": 0, "config": config_dict}
    )


def _exec_ctx(**overrides):
    """A minimal harness run-ctx bag the executors read substrate off of."""
    defaults = dict(
        redis=_NoopRedis(),
        run_id=uuid.uuid4(),
        # Facet A (092-07): the harness ctx carries the producer runs.run_id as the
        # FK target for sub-agent parent_run_id (run_id stays the workflow_run id).
        # _build_phase_tool_context now sources the parent id from this fail-closed,
        # so the executor-path ctx MUST set it (the live producer + both resume
        # paths do). A distinct value asserts the two ids never collapse.
        producer_run_id=uuid.uuid4(),
        thread_id=str(uuid.uuid4()),
        supabase=None,
        pool=None,
        user_settings=None,
        current_user={"id": "00000000-0000-0000-0000-000000000001"},
        folder_subtree_ids=None,
        scoped_folder_path=None,
        emit=AsyncMock(),
        spawn=lambda *a, **k: None,
        model="gpt-4o",
        per_run_task_semaphore=None,
        retry_feedback=None,
        inputs={},
    )
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


class TestPhaseExecutors:
    """The 5 executors wrap their shipped substrate (no loop reimplementation)."""

    @pytest.mark.asyncio
    async def test_programmatic_runs_registered_fn(self):
        from app.services.harness import phase_types

        phase = _phase({"phase_type": "programmatic", "fn": "split_topic",
                        "input_keys": ["topic"]})
        ctx = _exec_ctx(inputs={"topic": "alpha; beta"})
        out = await phase_types._exec_programmatic(phase, {}, ctx)
        assert out["sub_questions"] == ["alpha", "beta"]

    @pytest.mark.asyncio
    async def test_programmatic_unknown_fn_raises(self):
        from app.services.harness import phase_types

        phase = _phase({"phase_type": "programmatic", "fn": "not_registered"})
        with pytest.raises(KeyError):
            await phase_types._exec_programmatic(phase, {}, _exec_ctx())

    @pytest.mark.asyncio
    async def test_llm_single_calls_stream_with_prompt(self):
        from app.services.harness import phase_types

        captured = {}

        async def _fake_stream(*, messages, tools, model, user_settings):
            captured["messages"] = messages
            captured["tools"] = tools
            return ("the summary", [])

        phase = _phase({"phase_type": "llm_single", "prompt": "Summarize."})
        with patch.object(phase_types, "_stream_one_iteration", _fake_stream):
            out = await phase_types._exec_llm_single(
                phase, {"prev": {"text": "prior content"}}, _exec_ctx()
            )
        assert out == {"text": "the summary"}
        assert captured["messages"][0] == {"role": "system", "content": "Summarize."}
        assert captured["messages"][1]["content"] == "prior content"
        assert captured["tools"] == []  # llm_single uses no tools

    @pytest.mark.asyncio
    async def test_llm_single_consumes_retry_feedback(self):
        """CONSUMER side — ctx.retry_feedback is appended to the prompt (Plan 05 sets it)."""
        from app.services.harness import phase_types

        captured = {}

        async def _fake_stream(*, messages, tools, model, user_settings):
            captured["sys"] = messages[0]["content"]
            return ("x", [])

        phase = _phase({"phase_type": "llm_single", "prompt": "Base prompt."})
        ctx = _exec_ctx(retry_feedback="The JSON was missing the 'title' field.")
        with patch.object(phase_types, "_stream_one_iteration", _fake_stream):
            await phase_types._exec_llm_single(phase, {}, ctx)
        assert "Base prompt." in captured["sys"]
        assert "missing the 'title' field" in captured["sys"]

    @pytest.mark.asyncio
    async def test_llm_agent_wires_whitelist_prompt_and_explorer_cap(self):
        from app.services.harness import phase_types

        captured = {}

        async def _fake_sub_agent(*, parent_ctx, description, instructions,
                                  allowed_tools, max_steps, system_prompt_override=None, tools_override=None):
            captured["whitelist"] = parent_ctx.phase_whitelist
            captured["allowed_tools"] = allowed_tools
            captured["max_steps"] = max_steps
            captured["system_prompt_override"] = system_prompt_override
            return {"sub_run_id": uuid.uuid4(), "summary": "agent done", "status": "completed"}

        # max_steps omitted -> model default 12 -> substitutes to the harness
        # per-phase cap (093-09: 10/8 → 12/12 in lockstep, D-19 headroom).
        phase = _phase({"phase_type": "llm_agent", "prompt": "Research it.",
                        "available_tools": ["search_documents"]})
        with patch.object(phase_types, "run_task_sub_agent", _fake_sub_agent):
            out = await phase_types._exec_llm_agent(phase, {}, _exec_ctx())
        assert out["text"] == "agent done"
        assert captured["whitelist"] == frozenset({"search_documents"})  # D-05 layer 2
        assert captured["allowed_tools"] == ["search_documents"]
        assert captured["system_prompt_override"] == "Research it."  # OQ1
        assert captured["max_steps"] == 12  # harness per-phase cap (093-09 / D-19)

    @pytest.mark.asyncio
    async def test_llm_agent_respects_explicit_max_steps(self):
        from app.services.harness import phase_types

        captured = {}

        async def _fake_sub_agent(*, parent_ctx, description, instructions,
                                  allowed_tools, max_steps, system_prompt_override=None, tools_override=None):
            captured["max_steps"] = max_steps
            return {"sub_run_id": uuid.uuid4(), "summary": "ok", "status": "completed"}

        # Explicit non-default max_steps is NOT clamped.
        phase = _phase({"phase_type": "llm_agent", "prompt": "x",
                        "available_tools": ["search_documents"], "max_steps": 3})
        with patch.object(phase_types, "run_task_sub_agent", _fake_sub_agent):
            await phase_types._exec_llm_agent(phase, {}, _exec_ctx())
        assert captured["max_steps"] == 3

    @pytest.mark.asyncio
    async def test_batch_agents_fans_out_and_merges_numbered(self):
        from app.services.harness import phase_types

        calls = []

        async def _fake_sub_agent(*, parent_ctx, description, instructions,
                                  allowed_tools, max_steps, system_prompt_override=None, tools_override=None):
            calls.append(system_prompt_override)
            # echo the sub-question back as the summary
            q = system_prompt_override.rsplit("Sub-question: ", 1)[-1]
            return {"sub_run_id": uuid.uuid4(), "summary": f"ans:{q}", "status": "completed"}

        phase = _phase({"phase_type": "llm_batch_agents", "prompt": "Review.",
                        "available_tools": ["search_documents"],
                        "merge_strategy": "concat_numbered"})
        acc = {"split": {"sub_questions": ["q1", "q2", "q3"]}}
        with patch.object(phase_types, "run_task_sub_agent", _fake_sub_agent):
            out = await phase_types._exec_llm_batch_agents(phase, acc, _exec_ctx())
        assert len(calls) == 3  # fanned out over the 3 sub-questions
        assert out["text"] == "## Result 1\nans:q1\n\n## Result 2\nans:q2\n\n## Result 3\nans:q3"
        assert len(out["sub_run_ids"]) == 3

    @pytest.mark.asyncio
    async def test_batch_agents_concat_merge(self):
        from app.services.harness import phase_types

        async def _fake_sub_agent(*, parent_ctx, description, instructions,
                                  allowed_tools, max_steps, system_prompt_override=None, tools_override=None):
            q = system_prompt_override.rsplit("Sub-question: ", 1)[-1]
            return {"sub_run_id": uuid.uuid4(), "summary": q, "status": "completed"}

        phase = _phase({"phase_type": "llm_batch_agents", "prompt": "R.",
                        "available_tools": ["search_documents"]})  # default concat
        acc = {"split": {"sub_questions": ["a", "b"]}}
        with patch.object(phase_types, "run_task_sub_agent", _fake_sub_agent):
            out = await phase_types._exec_llm_batch_agents(phase, acc, _exec_ctx())
        assert out["text"] == "a\n\nb"

    @pytest.mark.asyncio
    async def test_human_input_blocks_and_returns_answer(self):
        from app.services.harness import phase_types

        captured = {}

        async def _fake_subscribe(redis, run_id, tool_call_id, timeout_seconds):
            captured["tool_call_id"] = tool_call_id
            captured["timeout"] = timeout_seconds
            return {"kind": "response", "response_text": "Doc B", "choice_index": 1}

        phase = _phase({"phase_type": "llm_human_input", "prompt": "Which doc?",
                        "options": ["Doc A", "Doc B"], "timeout_seconds": 300})
        with patch.object(phase_types, "subscribe_for_response", _fake_subscribe):
            out = await phase_types._exec_llm_human_input(phase, {}, _exec_ctx())
        assert out["text"] == "Which doc?"
        assert out["answer"] == "Doc B"
        # tool_call_id is stored so Plan 04 resume can re-subscribe against it.
        assert out["tool_call_id"] == captured["tool_call_id"]
        assert captured["timeout"] == 300

    @pytest.mark.asyncio
    async def test_human_input_choice_click_resolves_option_text(self):
        """BUG-260607-01 regression (harness twin of the Deep dispatcher fix):
        a choice-click answer arrives as {response_text: "", choice_index: N} —
        the phase must resolve options[N], never advance the workflow on a
        silently-empty answer."""
        from app.services.harness import phase_types

        async def _fake_subscribe(redis, run_id, tool_call_id, timeout_seconds):
            return {"kind": "response", "response_text": "", "choice_index": 1}

        phase = _phase({"phase_type": "llm_human_input", "prompt": "Which doc?",
                        "options": ["Doc A", "Doc B"], "timeout_seconds": 300})
        with patch.object(phase_types, "subscribe_for_response", _fake_subscribe):
            out = await phase_types._exec_llm_human_input(phase, {}, _exec_ctx())
        assert out["answer"] == "Doc B"

    @pytest.mark.asyncio
    async def test_human_input_choice_click_out_of_range_stays_empty(self):
        """BUG-260607-01 guard rail: out-of-range choice_index + empty text
        degrades to "" (no crash, no wrong option picked)."""
        from app.services.harness import phase_types

        async def _fake_subscribe(redis, run_id, tool_call_id, timeout_seconds):
            return {"kind": "response", "response_text": "", "choice_index": 9}

        phase = _phase({"phase_type": "llm_human_input", "prompt": "Which doc?",
                        "options": ["Doc A", "Doc B"], "timeout_seconds": 300})
        with patch.object(phase_types, "subscribe_for_response", _fake_subscribe):
            out = await phase_types._exec_llm_human_input(phase, {}, _exec_ctx())
        assert out["answer"] == ""

    @pytest.mark.asyncio
    async def test_human_input_clamps_timeout_to_hard_cap(self):
        from app.services.harness import phase_types
        from app.config import settings

        captured = {}

        async def _fake_subscribe(redis, run_id, tool_call_id, timeout_seconds):
            captured["timeout"] = timeout_seconds
            return None  # timeout

        # Request way above the 1800s hard cap.
        phase = _phase({"phase_type": "llm_human_input", "prompt": "?",
                        "timeout_seconds": 99999})
        with patch.object(phase_types, "subscribe_for_response", _fake_subscribe):
            out = await phase_types._exec_llm_human_input(phase, {}, _exec_ctx())
        assert captured["timeout"] == settings.ask_user_max_timeout_seconds
        assert out["answer"] == ""  # no response on timeout


# ═══════════════════════════════════════════════════════════════════════
# 189 (CONN-01 / D-05) — THE THIRD BRANCH AT THE STATUS-WRITE SEAM
#
# An approved external action RECORDS what it would have done and THE RUN
# CONTINUES. The status write is a THIRD branch beside the 101.1 emit-failure
# sentinel, inside the same if/else — so "the run continues" is bought by
# PLACEMENT (the unconditional advance_current_phase sits just below), never by
# new control flow.
#
# ⚠ WHY EVERY TEST HERE ASSERTS THE NEXT PHASE RAN. A status assertion alone
# cannot tell "continued" from "halted here": a branch that wrote the row and
# then returned would satisfy it completely. That is the fail-open shape Phase
# 188 spent two plans closing, and 189-05's PLANT E / 189-09's PLANT H both
# proved it passes a headline test unnoticed. The subsequent phase's executor
# running is the only thing that distinguishes them.
# ═══════════════════════════════════════════════════════════════════════

_RECORDED_SQL = "SET status='recorded_not_sent'"
_COMPLETED_SQL = "SET status='completed'"


def _external_action_definition(
    build_workflow_definition, *, capability="send_email", connection_id=None
):
    """A 2-phase workflow: the governed external action, then an ordinary step.

    The SECOND phase exists solely so "the run continues" is observable. Its type is
    a shipped one (``llm_single``) whose executor is stubbed in the drive below, so no
    provider is ever called.

    ── PHASE 190 · ``connection_id`` IS OPTIONAL, AND WHY THAT MATTERS ──────────────────
    Every caller but one leaves it ``None``, which keeps those drives byte-identical: an
    UNBOUND step is D-17's permanent ``recorded_not_sent`` terminal and it is what they
    assert. The golden-run fence below binds one, because **without a bound connection that
    fence cannot fail** — an unbound step sends nothing whether or not D-16's gate exists,
    so the "re-open trigger, expressed as a check" would have stayed green through the very
    commit it was armed for. Measured, not assumed (Phase 190 plan 190-13).

    D-13's field is a real, optional member of ``ExternalActionPhaseConfig`` from plan
    190-06, so this stays a MODEL-VALIDATED definition rather than a look-alike.
    """
    _external = {"phase_type": "external_action", "capability": capability}
    if connection_id is not None:
        _external["connection_id"] = connection_id
    return build_workflow_definition(
        [
            {
                "slug": "notify",
                "phase_index": 0,
                "config": _external,
            },
            {
                "slug": "wrap-up",
                "phase_index": 1,
                "config": {"phase_type": "llm_single", "prompt": "Summarise what happened."},
            },
        ]
    )


def _drive_approved_external_action(
    wf, pool, *, is_golden_run=False, loop=None, extra_inputs=None
):
    """Drive the REAL ``run_workflow`` over ``wf`` with the human APPROVING.

    Returns ``SimpleNamespace(run_id, ids, visited, audits, emits)``.

    ``_resolve_failure_with_ask_user`` returning ``None`` IS an approval — that is the
    shipped contract of the armed action-risk checkpoint ("Only an approval returns None
    and falls through"). Patching it here is the cheapest honest way to stand a person's
    YES up in a unit test: the checkpoint itself, the arming read and everything after it
    stay real, and the test can never hang on an ask channel.

    ``audits`` records ``(event_type, metadata)`` for EVERY ``write_audit`` the drive
    performs, so "no completion receipt for this phase" is a measured absence rather than
    a reading of the source.
    """
    import asyncio

    from app.services import harness_engine

    run_id = uuid.uuid4()
    ids = [uuid.uuid4() for _ in wf.phases]
    pool.set_fetch_result(
        [
            {"id": ids[i], "slug": p.slug, "phase_index": p.phase_index,
             "status": "pending", "output": {}}
            for i, p in enumerate(wf.phases)
        ]
    )

    visited: list[str] = []
    audits: list[tuple] = []
    emits: list[str] = []
    # CR-02: the SSE half, with its payload. ``emits`` (names only) is kept beside it
    # unchanged so nothing that reads it has to care about the wider capture.
    emit_calls: list[tuple] = []

    async def _stub(phase, accumulated, ctx):
        visited.append(phase.slug)
        return {"text": f"output of {phase.slug}"}

    async def _audit_spy(pool_, run_id_, *, user_id=None, event_type=None, metadata=None):
        audits.append((event_type, metadata))

    async def _emit_spy(redis_, stream_run_id_, event, **kw):
        emits.append(event)
        emit_calls.append((event, kw))

    real_execute = harness_engine._execute_phase

    async def _dispatch(phase, accumulated, ctx):
        """Real dispatch for external_action; the stub for every other type."""
        if getattr(phase.config, "phase_type", None) == "external_action":
            return await real_execute(phase, accumulated, ctx)
        return await _stub(phase, accumulated, ctx)

    # WR-06: ``is_golden_run`` rides the ctx bag at exactly one production site
    # (``publish_service._drive_golden_run``). Defaulting False keeps every existing caller
    # byte-identical; the golden-run fence below is the only drive that flips it.
    ctx = SimpleNamespace(
        # `extra_inputs` defaults to None, so every existing caller's bag is byte-identical.
        # The golden-run fence supplies the ONE argument a real send needs, because an
        # external_action step with nothing to send fails on its own arguments long before it
        # reaches a socket — measured, as that fence first failing on
        # "'text' must be a non-empty string" instead of on egress.
        inputs={
            "kickoff_prompt": "send Sarah the renewal summary",
            **(extra_inputs or {}),
        },
        is_golden_run=is_golden_run,
        # Phase 190 / D-14: the RUN's org, which is what a credential lookup is scoped BY.
        # Unread by every unbound drive (they never reach the resolver); required by the
        # golden-run fence, whose whole point is to reach as far as the send would.
        org_id="aaaaaaaa-0000-4000-8000-000000000001",
    )

    with (
        patch.object(harness_engine, "_execute_phase", _dispatch),
        patch.object(harness_engine, "write_audit", _audit_spy),
        patch.object(harness_engine, "_emit", _emit_spy),
        # the person said YES (None == approved; see the docstring above)
        patch.object(
            harness_engine, "_resolve_failure_with_ask_user", AsyncMock(return_value=None)
        ),
    ):
        coro = harness_engine.run_workflow(run_id, wf, ctx, pool=pool, redis=_NoopRedis())
        # ``loop`` is an escape hatch for ONE caller — the WR-06 no-egress fence. It arms a
        # sentinel that raises on ``socket.socket.connect``, and ``asyncio.run`` builds a
        # FRESH event loop whose Windows proactor makes its self-pipe with ``socketpair()``
        # — i.e. an unavoidable ``connect`` INSIDE the armed region, which would trip the
        # sentinel on the harness rather than on the step (measured: the first version of
        # that fence failed in ``proactor_events._make_self_pipe``, not in the executor).
        # Passing a loop built BEFORE the sentinel arms keeps the raw-socket layer usable.
        # Every other caller passes nothing and keeps ``asyncio.run`` byte-identically.
        if loop is None:
            asyncio.run(coro)
        else:
            loop.run_until_complete(coro)

    return SimpleNamespace(
        run_id=run_id, ids=ids, visited=visited, audits=audits,
        emits=emits, emit_calls=emit_calls,
    )


def test_an_approved_external_action_records_not_sent_and_the_run_continues(
    build_workflow_definition, mock_asyncpg_pool
):
    """D-05 — the row says ``recorded_not_sent`` AND THE NEXT PHASE RAN.

    Two assertions, and the second is the one that cannot be satisfied by a status write:
      1. the external-action phase's row is flipped to ``recorded_not_sent`` (never
         ``completed`` — the lie D-08 declined to ship when it rejected deriving the word
         at render while the column stayed ``completed``);
      2. the SUBSEQUENT phase's executor ran and ``advance_current_phase`` was reached —
         D-05's "the run CONTINUES", proven by the run continuing.
    """
    import json as _json

    wf = _external_action_definition(build_workflow_definition)
    r = _drive_approved_external_action(wf, mock_asyncpg_pool)

    recorded = [
        (sql, args) for sql, args in mock_asyncpg_pool.calls if _RECORDED_SQL in sql
    ]
    assert len(recorded) == 1, (
        f"D-05: expected exactly ONE recorded_not_sent write, saw {len(recorded)}. "
        f"UPDATEs on workflow_phases: "
        f"{[s for s, _ in mock_asyncpg_pool.calls if 'workflow_phases' in s]!r}"
    )
    assert recorded[0][1][0] == r.ids[0], "the write landed on the wrong phase row"
    persisted = _json.loads(recorded[0][1][1])
    assert persisted["recorded_intent"]["capability"] == "send_email", (
        "the recorded intent must be durable on the row — the record IS the outcome"
    )

    # ── the external action was NOT written as completed ─────────────────────────
    completed_ids = [
        args[0] for sql, args in mock_asyncpg_pool.calls if _COMPLETED_SQL in sql
    ]
    assert r.ids[0] not in completed_ids, (
        "the governed external action was written 'completed' — the row would read as a "
        "successful send forever to anything querying workflow_phases directly (D-08)"
    )

    # ── THE RUN CONTINUES — the next phase RAN ───────────────────────────────────
    assert r.visited == ["wrap-up"], (
        f"D-05: the run did not continue past the external action. Phases whose executor "
        f"ran after it: {r.visited!r} (the external action's own executor is dispatched "
        f"for real and is not recorded there). A branch that returned or continued out of "
        f"the loop satisfies the status assertion above and still halts the run — that is "
        f"the whole reason this assertion exists."
    )
    assert r.ids[1] in completed_ids, "the following phase never reached its own write"
    advanced = [
        args for sql, args in mock_asyncpg_pool.calls
        if "UPDATE workflow_runs SET current_phase_id" in sql
    ]
    assert any(a[1] == r.ids[1] for a in advanced), (
        f"advance_current_phase never pointed at the next phase; cursor writes={advanced!r}"
    )


def test_a_recorded_not_sent_phase_writes_no_phase_completed_receipt(
    build_workflow_definition, mock_asyncpg_pool
):
    """T-189-31 — ``consequence is not receipt``, driven from the ledger.

    A ``phase_completed`` row for a phase that RECORDED rather than completed tells the
    audit ledger (which Phase 107 / GOV-02 reads as receipts) that the step completed. It
    did not. The branch suppresses it, exactly as the shipped emit-failure branch
    suppresses it for a phase it just flipped to ``failed``.

    D-09 is why no NEW event type replaces it: a new kind means a CHECK migration PLUS the
    Python literal set, and the shipped ``action_risk_pending`` receipt already records
    that a human was asked. The receipt for the recorded intent is Phase 190's, when it
    would describe a real consequence.

    ANTI-VACUITY: the ORDINARY phase in the same run must have its ``phase_completed``
    receipt — otherwise the absence below would be satisfied by a recorder wired to the
    wrong symbol or a drive that never reached the audit call at all.
    """
    wf = _external_action_definition(build_workflow_definition)
    r = _drive_approved_external_action(wf, mock_asyncpg_pool)

    completed_for = [
        (md or {}).get("phase") for et, md in r.audits if et == "phase_completed"
    ]

    # ── positive control: the ordinary phase DID get its receipt ─────────────────
    assert "wrap-up" in completed_for, (
        f"harness broken: no phase_completed receipt for the ORDINARY phase either "
        f"(receipts={completed_for!r}) — the absence asserted below would be vacuous"
    )

    assert "notify" not in completed_for, (
        "a phase_completed receipt was written for a phase that recorded and sent "
        "nothing. The ledger would say the step completed; consequence is not receipt."
    )
    # And no new audit KIND was invented to replace it (D-09).
    _SHIPPED_KINDS = {
        "run_started", "run_completed", "run_failed", "phase_started",
        "phase_completed", "phase_transition", "gate_passed", "gate_failed",
        "tool_refused", "action_risk_pending",
    }
    assert {et for et, _ in r.audits} <= _SHIPPED_KINDS, (
        f"D-09: an unregistered harness_audit event kind was written: "
        f"{sorted({et for et, _ in r.audits} - _SHIPPED_KINDS)!r}. A new kind needs a "
        f"CHECK migration AND the Python literal set; 189 introduces neither."
    )


def test_a_recorded_not_sent_phase_emits_its_own_live_event(
    build_workflow_definition, mock_asyncpg_pool
):
    """REVIEW CR-02 — the PRODUCER half of "the live surface must not say Complete".

    The branch used to emit NO SSE at all, on the argument that the client learns the
    truth from ``phaseStatusFromDb`` on reconcile. It does — on RELOAD. Live, the card
    never left ``running``, and BOTH client sweeps act on exactly ``{running, retrying}``:
    ``finalizeEarlierPhasesForThread`` (fired when the NEXT phase starts) repainted it
    "✓ Complete" mid-run within milliseconds, and ``finalizeAllPhasesForThread`` (fired at
    ``run_completed``) caught the last-phase case. Emitting nothing did not leave the card
    unresolved; it handed the sweeps a straggler to tidy.

    ⚠ THIS IS NOT A NEW AUDIT KIND, and the sibling
    ``test_a_recorded_not_sent_phase_writes_no_phase_completed_receipt`` still binds:
    D-09's "no new kind" argument is about ``harness_audit`` (a CHECK migration plus the
    Python literal set), and its ``_SHIPPED_KINDS`` assertion runs on the same drive as
    this one and is untouched. This is WIRE-ONLY — additive, and inert for any older
    client, because ``api.ts`` dispatches on an else-if chain and an unmatched type simply
    advances the cursor.

    THREE ASSERTIONS, because the first two are each satisfiable by a wrong fix:
      1. the recorded phase emits ``phase_recorded_not_sent`` carrying its own slug;
      2. it emits NO ``phase_completed`` — the lie the client maps to "✓ Complete";
      3. ANTI-VACUITY: the ordinary phase in the same run DOES emit ``phase_completed``
         and does NOT emit the new event, so neither absence above can be produced by a
         spy that never fired or by an emitter wired to the wrong branch.
    """
    wf = _external_action_definition(build_workflow_definition)
    r = _drive_approved_external_action(wf, mock_asyncpg_pool)

    def _phases_for(event: str) -> list:
        return [kw.get("phase") for et, kw in r.emit_calls if et == event]

    recorded = _phases_for("phase_recorded_not_sent")
    completed = _phases_for("phase_completed")

    # ── 3. anti-vacuity FIRST: the ordinary phase's live event still lands ───────
    assert "wrap-up" in completed, (
        f"harness broken: the ORDINARY phase emitted no phase_completed either "
        f"(emits={r.emit_calls!r}) — every absence asserted below would be vacuous"
    )
    assert "wrap-up" not in recorded, (
        f"the ordinary phase emitted the recorded-not-sent event: {r.emit_calls!r}"
    )

    # ── 1. the recorded phase announces its OWN terminal ─────────────────────────
    assert recorded == ["notify"], (
        f"CR-02: the recorded phase emitted no live event of its own "
        f"(phase_recorded_not_sent frames={recorded!r}, all emits={r.emits!r}). The card "
        f"then stays `running`, and both client sweeps upgrade `running` to `done` — so "
        f"the live surface prints '✓ Complete' for the one step whose entire reason for "
        f"existing is that it did not complete, while a reload shows 'Not sent'."
    )
    # The client keys the store row by slug, so the payload must carry it (and the index,
    # which the sweeps and the positional floor both read).
    payload = next(kw for et, kw in r.emit_calls if et == "phase_recorded_not_sent")
    assert payload.get("phase") == "notify"
    assert payload.get("phase_index") == 0

    # ── 2. and never the event that maps to "✓ Complete" ─────────────────────────
    assert "notify" not in completed, (
        f"a phase_completed SSE was emitted for a phase that recorded and sent nothing: "
        f"{r.emit_calls!r}. StreamsProvider.onPhaseCompleted maps it straight to `done`."
    )


def test_a_golden_run_of_an_external_action_performs_no_egress(
    build_workflow_definition, mock_asyncpg_pool, monkeypatch
):
    """REVIEW WR-06 — **THE RE-OPEN TRIGGER, AS A CHECK RATHER THAN AS PROSE.**

    D-19 puts ``is_golden_run`` on the ctx bag and the armed action-risk checkpoint then
    becomes a log line: *"the pause is skipped, the step still runs"*. For the five LLM
    types that is a virtue. For ``external_action`` the arming is not an author preference —
    ``PhaseSpec._external_action_is_always_armed`` pins it STRUCTURALLY, and it is the one
    guarantee D-04 exists to make. The golden-run branch bypasses it unconditionally, with
    no phase-type carve-out. **The day Phase 190 wires a real send, PUBLISHING a workflow
    would perform the external action, with nobody asked, once per publish attempt.**

    189 does not fix that by skipping the body (see the long comment on the branch in
    ``harness_engine._run_phase_with_gates`` for why: the carve-out would have to fabricate
    the recorded body to keep ``test_publish_service``'s assertions true, giving the one
    sentence a second composer). It PINS the inertness instead, so the risk cannot go live
    unnoticed:

      * the WIDENED transport sentinel is armed — httpx sync + async, ``smtplib.SMTP``,
        ``urllib.request.urlopen`` AND raw ``socket.socket.connect`` (review WR-03) —
        IMPORTED from the no-egress suite rather than re-typed, so a future widening there
        strengthens this fence automatically;
      * a REAL golden run is driven end to end (``is_golden_run=True``), not a unit call;
      * the phase must STILL land ``recorded_not_sent`` — because a fence that passed by
        the step silently not running would be the fail-open shape 189-05's PLANT E and
        189-09's PLANT H both describe.

    **THIS TEST PASSES TODAY BECAUSE THE STEP IS INERT. WHEN IT FAILS, READ WR-06.** The
    fix is Phase 190's and is one of two shapes, both named on that branch comment.

    ── ⚠ PHASE 190 · THIS FENCE WAS VACUOUS AND IT WAS MEASURED, NOT SUSPECTED ───────────
    189 armed this as *"the re-open trigger, expressed as a check rather than as prose"*.
    When plan 190-13 landed the send and ran it, it stayed **GREEN** — for two independent
    reasons, either of which alone would have let the publish-time-egress defect ship
    unnoticed through the very commit this fence exists to catch:

      1. **the step bound no connection**, so the executor took D-17's ``recorded_not_sent``
         branch and never reached a send at all — an unbound step is inert with or without
         D-16's gate;
      2. **``live_connectors`` resolves to ``"off"`` by cold default** (D-26), so even a
         bound step records rather than sends.

    Both preconditions are therefore SET HERE AND ASSERTED, and the assertions are the point:
    a fence whose trigger conditions are assumed is a fence that reports on its own setup.
    With them in place the executor was OBSERVED RED on the send commit and driven green by
    the one-line ``ctx.is_golden_run`` gate in that SAME commit — which is the evidence D-16
    asks for, and it did not exist until this rewrite.

    The resolver and DNS are stubbed so the case is hermetic: everything from the gates
    through the adapter to ``send_pinned_http`` is REAL, and the sentinel catches the socket.
    """
    import asyncio as _asyncio

    from app.security import egress as _egress
    from app.services.harness import phase_types as _phase_types
    from tests.unit.test_189_no_egress import _block_all_http

    wf = _external_action_definition(
        build_workflow_definition,
        capability="post_message",
        connection_id="cccccccc-0000-4000-8000-00000000000b",
    )

    # ── precondition 1, ASSERTED: the step really is bound ────────────────────────────
    assert getattr(wf.phases[0].config, "connection_id", None), (
        "this fence measures a SEND being suppressed; with no connection bound the step is "
        "inert for reasons that have nothing to do with D-16, and the fence reports on its "
        "own setup"
    )

    # ── precondition 2, ASSERTED: the kill-switch is ON for the duration ──────────────
    monkeypatch.setattr(_phase_types, "feature_audience", lambda _f: "everyone")
    assert _phase_types.feature_audience("live_connectors") != "off", (
        "with live_connectors off (its cold default) a bound step records rather than "
        "sends, and this fence would be green for D-26's reason rather than D-16's"
    )

    # A resolved connection, without a database. `.secret` is a property on the real object
    # and must stay one here: an eager attribute would decrypt nothing but would also stop
    # this stub modelling the lazy-materialisation contract plan 190-06 shipped.
    class _Resolved:
        connection_id = "cccccccc-0000-4000-8000-00000000000b"
        org_id = "aaaaaaaa-0000-4000-8000-000000000001"
        capability = "post_message"
        name = "ops channel"
        config = {"default_channel": "C0190"}

        @property
        def secret(self):
            return "xoxb-GOLDEN-RUN-MUST-NEVER-REACH-A-SOCKET"

    async def _stub_resolver(connection_id, *, org_id):
        return _Resolved()

    monkeypatch.setattr(_phase_types, "resolve_connection", _stub_resolver)
    # DNS, stubbed to a GLOBALLY ROUTABLE address so the guard's real logic runs without the
    # internet. ⚠ Not 203.0.113.x: TEST-NET-3 is documentation space and `is_global` is False
    # for it, so the guard refuses it — measured, as this fence first failing on
    # `address_not_public` rather than on the send it is meant to catch.
    monkeypatch.setattr(_egress, "_default_resolver", lambda h, p: ["93.184.216.34"])

    # ⚠ THE LOOP IS BUILT BEFORE THE SENTINEL ARMS, and that ordering is load-bearing on
    # Windows: `asyncio.run` creates a fresh proactor loop whose self-pipe is a
    # `socketpair()`, i.e. a `socket.connect` the sentinel would catch — measured, as the
    # first version of this fence failing in `proactor_events._make_self_pipe` rather than
    # in the executor. Building it first keeps the raw-socket layer armed for the STEP.
    loop = _asyncio.new_event_loop()
    try:
        # Armed BEFORE the drive: the golden-run branch and the executor both sit inside it.
        _block_all_http(monkeypatch)
        r = _drive_approved_external_action(
            wf,
            mock_asyncpg_pool,
            is_golden_run=True,
            loop=loop,
            extra_inputs={"text": "the renewal summary is attached"},
        )
    finally:
        loop.close()

    # ── the golden run really did take the D-19 branch: NOBODY was asked ─────────
    assert not any(et == "action_risk_pending" for et, _ in r.audits), (
        f"the golden run wrote an action_risk_pending receipt — it did NOT take the D-19 "
        f"auto-continue branch, so this fence is measuring the ordinary path: {r.audits!r}"
    )

    # ── ANTI-VACUITY: the governed step ACTUALLY RAN and recorded ────────────────
    recorded = [sql for sql, _ in mock_asyncpg_pool.calls if _RECORDED_SQL in sql]
    assert len(recorded) == 1, (
        f"the golden run's external-action phase never reached recorded_not_sent, so "
        f"'no egress' would be satisfied by a step that never ran: {recorded!r}"
    )
    # `visited` records only the STUBBED executors — the external_action phase goes through
    # the REAL `_execute_phase` (that is the point of `_dispatch`), so "notify" is
    # deliberately absent and its evidence is the `recorded_not_sent` write above. The
    # following phase appearing here is what proves the run CONTINUED rather than halting on
    # the governed step, which no status assertion can distinguish (189-05 PLANT E).
    assert r.visited == ["wrap-up"], (
        f"the run did not continue past the governed step: {r.visited!r}"
    )

    # ── the property: it ran, it recorded, and it sent NOTHING ──────────────────
    # `_block_all_http` raises `_EgressAttempted` on any transport touch. The engine catches
    # a phase exception and flips the row to `failed`, so an attempted send would have
    # produced ZERO `recorded_not_sent` writes and a `failed` one instead — which the
    # anti-vacuity assertion above already refuses. Asserted explicitly here too, so the
    # failure a future reader sees names egress rather than a missing status write.
    failed = [sql for sql, _ in mock_asyncpg_pool.calls if "SET status='failed'" in sql]
    assert failed == [], (
        f"WR-06: a phase was flipped to `failed` during a golden run with every transport "
        f"blocked — the external-action step attempted OUTBOUND EGRESS while publishing. "
        f"Publishing a workflow must never act in the world: the golden run validates "
        f"STRUCTURE, and the D-04 checkpoint that would have asked a person is exactly the "
        f"one D-19 skips. See the WR-06 comment on the golden-run branch in "
        f"harness_engine._run_phase_with_gates. writes={failed!r}"
    )


def test_an_output_with_no_sentinel_still_routes_to_complete_phase(
    build_workflow_definition, mock_asyncpg_pool
):
    """THE SHARED PATH IS A LITERAL NO-OP (the D-14 red line this phase inherits).

    A Deep / ordinary success output carries no sentinel key, so the third branch cannot
    see it and the phase still routes to ``complete_phase``. Driven as a real assertion:
    the ordinary two-phase run writes TWO ``completed`` rows and ZERO
    ``recorded_not_sent`` rows.
    """
    wf = build_workflow_definition(
        [
            {"config": {"phase_type": "llm_single", "prompt": "first"}},
            {"config": {"phase_type": "llm_single", "prompt": "second"}},
        ]
    )
    r = _drive_approved_external_action(wf, mock_asyncpg_pool)

    completed = [sql for sql, _ in mock_asyncpg_pool.calls if _COMPLETED_SQL in sql]
    recorded = [sql for sql, _ in mock_asyncpg_pool.calls if _RECORDED_SQL in sql]
    assert len(completed) == 2, (
        f"the ordinary path must still complete both phases: {completed!r}"
    )
    assert recorded == [], (
        f"an output with NO sentinel key was routed to the 189 branch: {recorded!r}. "
        f"The shared path must be byte-identical."
    )
    assert r.visited == ["p0", "p1"]
