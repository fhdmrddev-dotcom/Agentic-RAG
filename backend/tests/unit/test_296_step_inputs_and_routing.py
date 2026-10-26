"""Phase 296-06 Task 2 — the first step sees the launch answers; a pinned model runs where it was
pinned (or says why not); the citation retry needs evidence; unanswered optional inputs read null.

* **291-S6-F8.** The first LLM step's user turn is the kickoff (``_first_phase_user_turn``). A
  declared answer must reach it EXACTLY ONCE on every start path: (a) in-app
  (``launch_kickoff``, fixed by 293-05), (b) key (``inbound_kickoff``, inside the untrusted
  envelope, fixed by 293-05), (c) schedule and (d) publish golden run. Internal keys never appear.
* **293-F-4.** An emit step pinned to another provider's model is routed to THAT provider. An agent
  step's pinned model goes through ``task_service._resolve_sub_agent_effective_model``, which
  swaps it silently; the step now says so (``model_fallback`` sub-step + ``policy_applied``).
* **291-IN-01.** The emit citation retry fires only when KB evidence exists; the person's own
  ``input:`` ids are not evidence.
* **291-IN-06.** An optional declared input left unanswered is overlaid as an explicit null.
"""
from __future__ import annotations

import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from tests.unit.test_256_llm_emit_rollup import (  # noqa: F401 — fixture + fakes
    _fake_ctx,
    _fake_phase,
    _forced_ok,
    _patch_executor,
    _retrieved,
)

_DEF = {
    "slug": "brief", "version": 1, "name": "Brief to file",
    "phases": [{"slug": "check", "phase_index": 0,
                "config": {"phase_type": "llm_single", "prompt": "Validate the inputs."}}],
    "inputs": [
        {"key": "topic", "label": "Topic", "type": "text"},
        {"key": "notes", "label": "Notes", "type": "text", "required": False},
    ],
}
INTERNAL = ("kickoff_prompt", "_untrusted_inputs", "_schedule_id", "_schedule_max")


def _first_turn(inputs: dict) -> str:
    from app.services.harness.phase_types import _first_phase_user_turn

    return _first_phase_user_turn({}, SimpleNamespace(inputs=inputs))


def _assert_clean(turn: str):
    for k in INTERNAL:
        assert k not in turn, k


# ── 291-S6-F8: one test per start path ──────────────────────────────────────────────────────


def test_s6_f8_a_in_app_start_already_folds_the_answer_once():
    """(a) Already fixed by 293-05 D-3: the in-app kickoff is ``launch_kickoff``."""
    from app.models.harness import WorkflowDefinition
    from app.services.inbound_inputs import launch_kickoff

    values = {"topic": "Lisbon"}
    inputs = {**values, "kickoff_prompt": launch_kickoff("", WorkflowDefinition.model_validate(_DEF), values)}
    turn = _first_turn(inputs)
    assert turn.count("topic: Lisbon") == 1
    _assert_clean(turn)


def test_s6_f8_b_key_start_carries_the_answer_once_inside_the_envelope():
    """(b) Already fixed by 293-05 F-1: the key kickoff is ``inbound_kickoff`` (TRUST-03)."""
    from app.services.inbound_inputs import UNTRUSTED_FLAG, inbound_kickoff, wrap_untrusted_input

    values = {"topic": "Lisbon"}
    inputs = {**values, "kickoff_prompt": inbound_kickoff("Brief to file", values), UNTRUSTED_FLAG: True}
    turn = _first_turn(inputs)
    assert turn.count("Lisbon") == 1
    assert wrap_untrusted_input("topic", "Lisbon") in turn
    _assert_clean(turn)


@pytest.mark.asyncio
async def test_s6_f8_c_a_scheduled_start_folds_the_answer_once():
    from app.services.entitlement_service import EntitlementResult
    from app.services.scheduler_service import launch_scheduled_run

    schedule = {
        "id": uuid4(), "user_id": str(uuid4()), "workflow_id": str(uuid4()), "org_id": str(uuid4()),
        "name": "Monday brief", "inputs": {"topic": "Lisbon", "kickoff_prompt": "Weekly brief"},
        "max_tokens_per_run": 500_000, "max_duration_seconds": 1_800,
    }
    with (
        patch("app.db.workflows.get_definition", AsyncMock(return_value={"definition": _DEF})),
        patch("app.services.entitlement_service.check_entitlement",
              AsyncMock(return_value=EntitlementResult(allowed=True, capability="workflows"))),
        patch("app.services.unattended_launch.launch_unattended_run",
              AsyncMock(return_value=uuid4())) as core,
    ):
        await launch_scheduled_run(schedule, pool=MagicMock(), redis=MagicMock())
    inputs = core.call_args.kwargs["inputs"]
    turn = _first_turn(inputs)
    assert turn.startswith("Weekly brief")
    assert turn.count("topic: Lisbon") == 1
    _assert_clean(turn)
    assert inputs["topic"] == "Lisbon"  # the declared value still reaches action arguments


@pytest.mark.asyncio
async def test_s6_f8_c_a_schedule_without_declared_answers_is_byte_identical():
    from app.services.entitlement_service import EntitlementResult
    from app.services.scheduler_service import launch_scheduled_run

    schedule = {
        "id": uuid4(), "user_id": str(uuid4()), "workflow_id": str(uuid4()), "org_id": str(uuid4()),
        "name": "Monday brief", "inputs": {"kickoff_prompt": "Weekly brief"},
        "max_tokens_per_run": 500_000, "max_duration_seconds": 1_800,
    }
    with (
        patch("app.db.workflows.get_definition", AsyncMock(return_value={"definition": _DEF})),
        patch("app.services.entitlement_service.check_entitlement",
              AsyncMock(return_value=EntitlementResult(allowed=True, capability="workflows"))),
        patch("app.services.unattended_launch.launch_unattended_run",
              AsyncMock(return_value=uuid4())) as core,
    ):
        await launch_scheduled_run(schedule, pool=MagicMock(), redis=MagicMock())
    assert core.call_args.kwargs["inputs"]["kickoff_prompt"] == "Weekly brief"


class _Stop(Exception):
    pass


@pytest.mark.asyncio
async def test_s6_f8_d_the_publish_golden_run_folds_the_stand_in_once():
    from app.models.harness import WorkflowDefinition
    from app.services.harness import publish_service

    captured: dict = {}

    async def _create_run(_pool, **kwargs):
        captured.update(kwargs)
        raise _Stop()

    sb = MagicMock()
    sb.table.return_value.insert.return_value.execute.return_value = SimpleNamespace(
        data=[{"id": str(uuid4())}]
    )
    with (
        patch.object(publish_service, "_resolve_publish_supabase", AsyncMock(return_value=(sb, None))),
        patch("app.models.user_settings.load_user_settings", MagicMock(return_value=None)),
        patch("app.services.sub_agent_models.resolve_workflow_ctx_model", MagicMock(return_value="gpt-5.5")),
        patch("app.db.workflows.create_workflow_run", _create_run),
    ):
        with pytest.raises(_Stop):
            await publish_service._drive_golden_run(
                definition_id=uuid4(), definition=WorkflowDefinition.model_validate(_DEF),
                golden_input="Write the brief.", user_id=uuid4(), pool=MagicMock(),
                redis=MagicMock(), supabase=MagicMock(),
            )
    turn = _first_turn(captured["inputs"])
    assert turn.startswith("Write the brief.")
    assert turn.count(f"topic: {publish_service.GOLDEN_TEXT_STAND_IN}") == 1
    _assert_clean(turn)


# ── 293-F-4: an emit step pinned to another provider's model ─────────────────────────────────


async def test_f4_an_emit_step_pinned_to_another_providers_model_goes_to_that_provider(_patch_executor):
    from app.services.harness import phase_types

    _patch_executor["forced_queue"] = [_forced_ok(input_tokens=1, output_tokens=1)]
    phase = _fake_phase()
    phase.config.model = "gpt-5.6-luna"
    ctx = _fake_ctx(model="deepseek-v4-pro")
    ctx.provider = "deepseek"
    await phase_types._exec_llm_emit(phase, _retrieved(), ctx)
    assert _patch_executor["forced_calls"][0]["provider"] == "openai"
    assert _patch_executor["forced_calls"][0]["model"] == "gpt-5.6-luna"


async def test_f4_an_unpinned_emit_step_keeps_the_runs_provider(_patch_executor):
    from app.services.harness import phase_types

    _patch_executor["forced_queue"] = [_forced_ok(input_tokens=1, output_tokens=1)]
    ctx = _fake_ctx(model="gpt-5.6-luna")
    ctx.provider = "deepseek"  # a recorded run provider still wins when the step pins nothing
    await phase_types._exec_llm_emit(_fake_phase(), _retrieved(), ctx)
    assert _patch_executor["forced_calls"][0]["provider"] == "deepseek"


# ── 293-F-4: an agent step pinned to another provider's model (measured, then told) ──────────


class _Owner(SimpleNamespace):
    """Owner settings: the fields the resolver reads, and None for any other setting read."""

    def __getattr__(self, name):
        return None


def _owner(provider="deepseek", llm_model="deepseek-v4-pro"):
    return _Owner(active_provider=provider, llm_model=llm_model, available_models=[],
                  sub_agent_model=None)


def test_f4_measure_the_agent_step_resolver_swaps_a_cross_provider_pin_silently():
    """The measurement D-02 asks for: the sub-agent resolver does NOT honour the pin."""
    from app.services.task_service import _resolve_sub_agent_effective_model

    assert _resolve_sub_agent_effective_model(_owner(), ctx_model="gpt-5.6-luna") == "deepseek-v4-pro"


def _agent_phase(model):
    cfg = SimpleNamespace(
        phase_type="llm_agent", prompt="Research.", model=model, max_steps=8, folder_scope=None,
        skill_ref=None, skill_snapshot=None, available_tools=["search_documents"],
    )
    return SimpleNamespace(slug="research", phase_index=0, config=cfg, validators=[])


async def _drive_agent(model, owner):
    from app.services.harness import phase_types

    subs, audits = [], []

    async def _substep(ctx, phase, *, status=None, failure=None):
        subs.append(status)

    async def _audit(ctx, *, event_type, metadata):
        audits.append((event_type, metadata))

    ctx = _fake_ctx(model="deepseek-v4-pro")
    ctx.user_settings = owner
    sub = AsyncMock(return_value={"summary": "done", "status": "completed", "sub_run_id": uuid4()})
    with (
        patch.object(phase_types, "_emit_phase_substep", _substep),
        patch.object(phase_types, "_emit_audit", _audit),
        patch.object(phase_types, "run_task_sub_agent", sub),
    ):
        await phase_types._exec_llm_agent(_agent_phase(model), {}, ctx)
    return subs, audits, sub


async def test_f4_an_agent_step_pinned_to_another_provider_says_where_it_ran():
    subs, audits, sub = await _drive_agent("gpt-5.6-luna", _owner())
    assert "model_fallback" in subs
    notes = [m for e, m in audits if e == "policy_applied"]
    assert len(notes) == 1
    assert notes[0]["message"] == (
        "This step asked for gpt-5.6-luna, which runs on another provider, "
        "so it ran on deepseek-v4-pro instead."
    )
    sub.assert_awaited_once()


async def test_f4_an_unpinned_agent_step_and_an_honoured_pin_say_nothing():
    subs, audits, _ = await _drive_agent(None, _owner())
    assert "model_fallback" not in subs and not audits
    honoured = _owner(provider="openai", llm_model="gpt-5.6-luna")
    subs, audits, _ = await _drive_agent("gpt-5.6-luna", honoured)
    assert "model_fallback" not in subs and not audits


# ── 291-IN-01: the citation retry needs KB evidence ─────────────────────────────────────────


def _uncited_fm():
    from app.services.template_render_service import EmitFieldMap

    return EmitFieldMap.model_validate({
        "scalars": [
            {"key": "project_name", "value": "Meridian", "source_chunk_id": None,
             "source_doc": None, "source_page": None},
            {"key": "owner", "value": "Bob", "source_chunk_id": None,
             "source_doc": None, "source_page": None},
        ],
        "rows": [],
    })


def _forced_uncited():
    out = _forced_ok(input_tokens=1, output_tokens=1)
    out["emitted"] = _uncited_fm()
    return out


def _ctx_with_user_input():
    ctx = _fake_ctx()
    ctx.inputs = {"kickoff_prompt": "Fill it.", "project_name": "Meridian"}
    ctx.definition.inputs = [{"key": "project_name", "label": "Project", "type": "text",
                              "source": "user"}]
    return ctx


async def test_in01_no_kb_evidence_means_no_citation_retry(_patch_executor):
    from app.services.harness import phase_types

    _patch_executor["forced_queue"] = [_forced_uncited() for _ in range(3)]
    await phase_types._exec_llm_emit(_fake_phase(), {}, _ctx_with_user_input())
    assert len(_patch_executor["forced_calls"]) == 1
    retried = [c for c in _patch_executor["forced_calls"] if "REJECTED by the citation gate" in c["system_prompt"]]
    assert retried == []


async def test_in01_with_kb_evidence_the_retry_still_fires(_patch_executor):
    from app.services.harness import phase_types

    _patch_executor["forced_queue"] = [_forced_uncited() for _ in range(3)]
    await phase_types._exec_llm_emit(_fake_phase(), _retrieved(), _ctx_with_user_input())
    assert len(_patch_executor["forced_calls"]) == phase_types._EMIT_MAX_ATTEMPTS


# ── 291-IN-06: an unanswered optional input is an explicit null ─────────────────────────────


def test_in06_an_unanswered_optional_input_is_overlaid_as_null():
    from app.services.harness.form_inputs import overlay_user_inputs

    definition = {"inputs": [
        {"key": "name", "type": "text", "source": "user"},
        {"key": "middle_name", "type": "text", "source": "user", "required": False},
    ]}
    legacy = {"scalars": {"middle_name": {"value": "Invented", "source_chunk_id": "chunk-9",
                                          "source_doc": None, "source_page": None}},
              "collections": {}}
    out, ids = overlay_user_inputs(legacy, definition, {"name": "Ada"}, ["name", "middle_name"])
    assert out["scalars"]["name"]["value"] == "Ada"
    assert "middle_name" in out["scalars"]
    assert out["scalars"]["middle_name"]["value"] is None
    assert out["scalars"]["middle_name"]["source_chunk_id"] is None
    assert ids == {"input:name"}
    assert legacy["scalars"]["middle_name"]["value"] == "Invented"  # never mutates its argument


def test_in06_an_answered_optional_input_and_a_required_blank_are_unchanged():
    from app.services.harness.form_inputs import overlay_user_inputs

    definition = {"inputs": [
        {"key": "name", "type": "text", "source": "user"},
        {"key": "middle_name", "type": "text", "source": "user", "required": False},
    ]}
    out, _ = overlay_user_inputs({"scalars": {}}, definition, {"middle_name": "Lee"},
                                 ["name", "middle_name"])
    assert out["scalars"]["middle_name"]["value"] == "Lee"
    assert "name" not in out["scalars"]  # a required blank is not invented as null here

