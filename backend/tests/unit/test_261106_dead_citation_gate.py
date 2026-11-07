"""BUG-261106-01 (tester report BUG-19) — a citation check an agent step can never pass.

The AI drafter emitted, on every agent step, a validator the model invented:

    {"kind": "citations_required", "config": {"require_citations": true}, ...}

``citations_required`` reads ``mode``, not ``require_citations``, so the mode fell back to
``deterministic``. Deterministic mode checks ``output["field_map"]``, which only an
``llm_emit`` step returns — an agent step returns ``{text, citations, ...}``. So the gate
failed on every attempt with ``citations_required: no field_map on output`` (live run
RUN-007, 2026-11-06), before the engine's own *must prove it* gate ever ran.

Two halves, both driven here:
  * the ENGINE no longer runs such a gate on a step where it adds its own citation gate —
    this heals drafts already saved with it, which the editor cannot remove (BUG-25);
  * the DRAFTER no longer returns one, so new drafts are clean even on steps the engine
    does not gate.
"""

from __future__ import annotations

import asyncio
import copy
from types import SimpleNamespace

import pytest

#: The exact validator RUN-007's definition carried (copied from the run receipt).
DRAFTER_GATE = {
    "kind": "citations_required",
    "config": {"require_citations": True},
    "on_failure": "fail_run",
    "max_retries": 2,
}


def _agent_phase(*, tools: list[str], validators: list[dict], phase_type: str = "llm_agent"):
    from app.models.harness import PhaseSpec

    return PhaseSpec(
        slug="research",
        phase_index=0,
        name="Look up the joiner and the policies",
        config={
            "phase_type": phase_type,
            "prompt": "Find the joiner and the rules that apply.",
            "available_tools": tools,
        },
        validators=validators,
    )


def _agent_output(text: str, citations: list) -> dict:
    """The shape ``_exec_llm_agent`` returns. No ``field_map`` — that is the whole bug."""
    return {
        "text": text,
        "sub_run_id": "sub-1",
        "source_refs": [{"doc": "d"}],
        "citations": citations,
        "similarity_scores": [0.7],
    }


# ── the predicate ─────────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "config",
    [{"require_citations": True}, {}, {"mode": "deterministic"}, {"mode": "emit"}],
)
def test_a_field_map_gate_on_an_agent_step_is_dead(config):
    from app.models.harness import ValidatorSpec
    from app.services.harness.grounding import citation_gate_can_never_pass

    phase = _agent_phase(tools=["search_documents"], validators=[])
    spec = ValidatorSpec(kind="citations_required", config=config)
    assert citation_gate_can_never_pass(phase, spec) is True


@pytest.mark.parametrize("mode", ["presence", "retrieved_and_cited"])
def test_a_marker_gate_on_an_agent_step_is_alive(mode):
    from app.models.harness import ValidatorSpec
    from app.services.harness.grounding import citation_gate_can_never_pass

    phase = _agent_phase(tools=["search_documents"], validators=[])
    spec = ValidatorSpec(kind="citations_required", config={"mode": mode})
    assert citation_gate_can_never_pass(phase, spec) is False


def test_a_field_map_gate_on_a_fill_step_is_alive():
    """``llm_emit`` returns a ``field_map``, so deterministic mode is real work there."""
    from app.models.harness import PhaseSpec, ValidatorSpec
    from app.services.harness.grounding import citation_gate_can_never_pass

    phase = PhaseSpec(
        slug="fill",
        phase_index=0,
        config={"phase_type": "llm_emit", "emitter": "render_template", "prompt": "Fill it."},
    )
    spec = ValidatorSpec(kind="citations_required", config={})
    assert citation_gate_can_never_pass(phase, spec) is False


def test_other_validator_kinds_are_never_judged_dead():
    from app.models.harness import ValidatorSpec
    from app.services.harness.grounding import citation_gate_can_never_pass

    phase = _agent_phase(tools=["search_documents"], validators=[])
    spec = ValidatorSpec(kind="regex_match", config={"pattern": "x"})
    assert citation_gate_can_never_pass(phase, spec) is False


# ── the engine seam: RUN-007, replayed ──────────────────────────────────────────


def test_RUN_007_a_grounded_answer_now_passes_the_gates():
    """The drafted step from RUN-007, with a correct grounded answer. Before the fix the
    drafter's gate ran first and failed ``no field_map on output`` — on every attempt."""
    from app.services.harness.grounding import effective_phase
    from app.services.harness.validators import run_gates

    raw = _agent_phase(tools=["search_documents", "read_document"], validators=[DRAFTER_GATE])
    eff = effective_phase(raw, total_phases=2)

    result = asyncio.run(
        run_gates(eff, _agent_output("Probation is 6 months for G4 [1].", [{"chunk_id": "c1"}]), None)
    )
    assert result.passed is True, result.error_message


def test_RUN_007_the_engine_gate_still_bites():
    """Dropping the dead gate must not loosen anything: an answer that read nothing still
    fails, now on the engine's own gate with its honest reason."""
    from app.services.harness.grounding import effective_phase
    from app.services.harness.validators import run_gates

    raw = _agent_phase(tools=["search_documents"], validators=[DRAFTER_GATE])
    eff = effective_phase(raw, total_phases=2)

    assert [v.config for v in eff.validators] == [{"mode": "retrieved_and_cited"}]
    result = asyncio.run(run_gates(eff, _agent_output("Probation is 6 months.", []), None))
    assert result.passed is False
    assert "nothing was retrieved" in result.error_message


def test_D_185_05_a_live_author_gate_still_runs_beside_the_engine_gate():
    """The engine never displaces a gate that can pass — only one that cannot."""
    from app.services.harness.grounding import effective_phase

    presence = {"kind": "citations_required", "config": {"mode": "presence", "min_markers": 2}}
    raw = _agent_phase(tools=["search_documents"], validators=[presence, DRAFTER_GATE])
    eff = effective_phase(raw, total_phases=2)

    assert [v.config for v in eff.validators] == [
        {"mode": "presence", "min_markers": 2},
        {"mode": "retrieved_and_cited"},
    ]


def test_the_stored_definition_is_not_touched():
    """The seam is parse-time only: the phase it was handed still carries what was saved."""
    from app.services.harness.grounding import effective_phase

    raw = _agent_phase(tools=["search_documents"], validators=[DRAFTER_GATE])
    effective_phase(raw, total_phases=2)
    assert [v.config for v in raw.validators] == [{"require_citations": True}]


# ── the drafter ───────────────────────────────────────────────────────────────

STUB_SETTINGS = SimpleNamespace(harness_authoring_model="claude-opus-4-8")
STUB_PROVIDER = "stub-provider-not-a-real-one"
DESCRIBE = "Given a new joiner's employee ID, write their onboarding summary from our HR files."


def _emitted_definition() -> dict:
    presence = {"kind": "citations_required", "config": {"mode": "presence", "min_markers": 1}}
    return {
        "slug": "onboarding-summary",
        "version": 1,
        "name": "Onboarding summary",
        "status": "draft",
        "phases": [
            {
                "slug": "research",
                "phase_index": 0,
                "name": "Look up the joiner and the policies",
                "config": {
                    "phase_type": "llm_agent",
                    "prompt": "Find the joiner and the rules that apply.",
                    "available_tools": ["search_documents"],
                },
                "validators": [copy.deepcopy(DRAFTER_GATE)],
            },
            {
                "slug": "write",
                "phase_index": 1,
                "name": "Write the summary",
                "config": {
                    "phase_type": "llm_agent",
                    "prompt": "Write the summary from what step one found.",
                    "available_tools": [],
                },
                "validators": [copy.deepcopy(DRAFTER_GATE), presence],
            },
        ],
    }


def _arm(monkeypatch):
    import app.config as cfg
    import app.models.user_settings as us
    import app.services.forced_emit as fe
    import app.services.workflow_authoring as wa
    from app.models.harness import WorkflowDefinition

    async def _fake_assemble(**_kwargs):
        return ("GROUNDED", set(), set())

    async def _fake_fidelity(*_args, **_kwargs):
        return None

    async def _fake_vocabulary(**_kwargs):
        return {}

    emitted = WorkflowDefinition.model_validate(_emitted_definition())

    async def _fake_forced_emit(**_kwargs):
        return {"emitted": emitted}

    monkeypatch.setattr(wa, "_assemble_grounding", _fake_assemble)
    monkeypatch.setattr(wa, "_check_grounding_fidelity", _fake_fidelity)
    monkeypatch.setattr(wa, "_resolve_allowed_vocabulary", _fake_vocabulary)
    monkeypatch.setattr(
        cfg, "get_model_capability", lambda _m: {"forced_emission": True, "provider": STUB_PROVIDER}
    )
    monkeypatch.setattr(
        us, "load_user_settings", lambda _uid: SimpleNamespace(active_provider=STUB_PROVIDER)
    )
    monkeypatch.setattr(fe, "forced_emit", _fake_forced_emit)


@pytest.mark.asyncio
async def test_the_drafter_returns_no_dead_citation_gate(monkeypatch):
    """Both steps lose the dead gate — including step two, which reads nothing, so the
    engine adds no gate there and could not have healed it at run time."""
    import app.services.workflow_authoring as wa

    _arm(monkeypatch)
    result = await wa.generate_workflow_definition(
        describe=DESCRIBE, supabase=object(), user_id="u1", settings=STUB_SETTINGS
    )
    assert result["ok"] is True, result

    phases = result["definition"]["phases"]
    assert phases[0]["validators"] == []
    assert [v["config"] for v in phases[1]["validators"]] == [{"mode": "presence", "min_markers": 1}]
