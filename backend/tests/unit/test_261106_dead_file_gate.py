"""BUG-261106-02 (tester report BUG-19b) — a file check an agent step can never pass.

The sibling of BUG-261106-01. The AI drafter gave an agent step that writes a markdown
welcome pack this validator, with keys the model invented:

    {"kind": "output_file_valid",
     "config": {"extensions": [".md"], "must_contain": ["Still to confirm"],
                "required_filename_pattern": "^welcome_pack_.*\\.md$"}, ...}

``output_file_valid`` reads none of those keys. It checks ``output["output_file"]``, which
only a fill step (``llm_emit``) returns, or a ``config.path`` in the workspace. An agent
step returns ``{text, citations, ...}``, so the filename is ``''`` and the gate fails every
attempt with ``output_file_valid: unsupported format '' ('')`` (live run dc6e4c56,
2026-11-06, after the BUG-261106-01 fix let step one pass).
"""

from __future__ import annotations

import asyncio
import copy

import pytest

#: The exact validator run dc6e4c56's definition carried on step two.
DRAFTER_FILE_GATE = {
    "kind": "output_file_valid",
    "config": {
        "extensions": [".md"],
        "must_contain": ["Still to confirm"],
        "required_filename_pattern": "^welcome_pack_.*\\.md$",
    },
    "timing": "post",
    "on_failure": "fail_run",
    "max_retries": 2,
}
DRAFTER_CITATION_GATE = {
    "kind": "citations_required",
    "config": {"require_citations": True},
    "timing": "post",
    "on_failure": "fail_run",
    "max_retries": 2,
}


def _phase(*, validators: list[dict], phase_type: str = "llm_agent", tools=None):
    from app.models.harness import PhaseSpec

    config = {"phase_type": phase_type, "prompt": "Write the welcome pack from step one."}
    if phase_type == "llm_emit":
        config["emitter"] = "render_template"
    elif phase_type == "programmatic":
        config = {"phase_type": "programmatic", "fn": "noop"}
    elif phase_type == "llm_single":
        pass
    else:
        config["available_tools"] = tools if tools is not None else [
            "workspace_write", "workspace_read", "search_documents", "read_document",
        ]
    return PhaseSpec(
        slug="write_welcome_pack",
        phase_index=1,
        name="Write cited welcome pack",
        config=config,
        validators=validators,
    )


def _agent_output() -> dict:
    """The shape ``_exec_llm_agent`` returns — no ``output_file``."""
    return {
        "text": "# Welcome, Ravi [1]\n\n## Still to confirm\n- locker [2]",
        "sub_run_id": "sub-2",
        "source_refs": [{"doc": "d"}],
        "citations": [{"chunk_id": "c1"}, {"chunk_id": "c2"}],
        "similarity_scores": [0.7],
    }


# ── the predicate ─────────────────────────────────────────────────────────────


@pytest.mark.parametrize("phase_type", ["llm_agent", "llm_single", "programmatic"])
def test_a_file_gate_with_no_file_to_check_is_dead(phase_type):
    from app.models.harness import ValidatorSpec
    from app.services.harness.grounding import file_gate_can_never_pass

    phase = _phase(validators=[], phase_type=phase_type, tools=[])
    spec = ValidatorSpec.model_validate(DRAFTER_FILE_GATE)
    assert file_gate_can_never_pass(phase, spec) is True


@pytest.mark.parametrize("path", ["out/welcome.md", "notes.txt", "noext", ""])
def test_a_config_path_the_check_cannot_open_is_still_dead(path):
    from app.models.harness import ValidatorSpec
    from app.services.harness.grounding import file_gate_can_never_pass

    spec = ValidatorSpec(kind="output_file_valid", config={"path": path})
    assert file_gate_can_never_pass(_phase(validators=[]), spec) is True


@pytest.mark.parametrize("path", ["out/pack.docx", "Deck.PPTX", "sheet.xlsx", "pack.pdf"])
def test_a_config_path_the_check_can_open_is_alive(path):
    """An agent can write that file with ``workspace_write``; the gate is real work."""
    from app.models.harness import ValidatorSpec
    from app.services.harness.grounding import file_gate_can_never_pass

    spec = ValidatorSpec(kind="output_file_valid", config={"path": path})
    assert file_gate_can_never_pass(_phase(validators=[]), spec) is False


def test_a_file_gate_on_a_fill_step_is_alive():
    """``llm_emit`` returns ``output_file`` — the one producer the check was built for."""
    from app.models.harness import ValidatorSpec
    from app.services.harness.grounding import file_gate_can_never_pass

    spec = ValidatorSpec(kind="output_file_valid", config={})
    assert file_gate_can_never_pass(_phase(validators=[], phase_type="llm_emit"), spec) is False


def test_other_kinds_are_never_judged_dead_by_the_file_predicate():
    from app.models.harness import ValidatorSpec
    from app.services.harness.grounding import file_gate_can_never_pass

    spec = ValidatorSpec(kind="workspace_file_exists", config={"path": "x.md"})
    assert file_gate_can_never_pass(_phase(validators=[]), spec) is False


def test_gate_can_never_pass_covers_both_dead_kinds():
    from app.models.harness import ValidatorSpec
    from app.services.harness.grounding import gate_can_never_pass

    phase = _phase(validators=[])
    assert gate_can_never_pass(phase, ValidatorSpec.model_validate(DRAFTER_FILE_GATE)) is True
    assert gate_can_never_pass(phase, ValidatorSpec.model_validate(DRAFTER_CITATION_GATE)) is True
    live = ValidatorSpec(kind="citations_required", config={"mode": "presence"})
    assert gate_can_never_pass(phase, live) is False


# ── the engine seam: run dc6e4c56, replayed ──────────────────────────────────────


def test_dc6e4c56_step_two_now_passes_the_gates():
    """Step two exactly as the run's definition snapshot carried it. Before the fix the
    file gate failed every attempt with ``unsupported format ''``."""
    from app.services.harness.grounding import effective_phase
    from app.services.harness.validators import run_gates

    raw = _phase(validators=[DRAFTER_CITATION_GATE, DRAFTER_FILE_GATE])
    eff = effective_phase(raw, total_phases=2)

    assert [v.kind for v in eff.validators] == ["citations_required"]
    assert eff.validators[0].config == {"mode": "retrieved_and_cited"}
    result = asyncio.run(run_gates(eff, _agent_output(), None))
    assert result.passed is True, result.error_message


def test_a_dead_file_gate_is_dropped_on_a_step_the_engine_does_not_gate():
    """No KB tools → no engine gate. The dead gate is still dropped: it guarded nothing."""
    from app.services.harness.grounding import effective_phase
    from app.services.harness.validators import run_gates

    raw = _phase(validators=[DRAFTER_FILE_GATE], tools=["workspace_write"])
    eff = effective_phase(raw, total_phases=2)

    assert eff.validators == []
    result = asyncio.run(run_gates(eff, _agent_output(), None))
    assert result.passed is True, result.error_message


def test_a_live_file_gate_is_kept():
    from app.services.harness.grounding import effective_phase

    live = {"kind": "output_file_valid", "config": {"path": "out/pack.docx"}}
    raw = _phase(validators=[live], tools=["workspace_write"])
    assert effective_phase(raw, total_phases=2) is raw


def test_a_dead_citation_gate_on_an_ungated_step_keeps_its_shipped_scope():
    """BUG-261106-01's engine arm only drops a dead citation gate where the engine appends
    its own. This fix must not widen that (the drafter still cleans new drafts)."""
    from app.services.harness.grounding import effective_phase

    raw = _phase(validators=[DRAFTER_CITATION_GATE], phase_type="programmatic")
    assert effective_phase(raw, total_phases=2) is raw


def test_a_phase_with_nothing_dead_and_nothing_added_is_returned_by_reference():
    """D-14: identity is structural — an ungoverned phase with live gates is not copied."""
    from app.services.harness.grounding import effective_phase

    presence = {"kind": "citations_required", "config": {"mode": "presence"}}
    raw = _phase(validators=[presence], tools=["workspace_write"])
    assert effective_phase(raw, total_phases=2) is raw


def test_the_stored_definition_keeps_the_file_gate():
    from app.services.harness.grounding import effective_phase

    raw = _phase(validators=[DRAFTER_FILE_GATE])
    effective_phase(raw, total_phases=2)
    assert [v.kind for v in raw.validators] == ["output_file_valid"]


# ── the drafter ───────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_the_drafter_returns_no_dead_file_gate(monkeypatch):
    import app.services.workflow_authoring as wa
    from app.models.harness import WorkflowDefinition
    from tests.unit import test_261106_dead_citation_gate as sibling

    live_file = {"kind": "output_file_valid", "config": {"path": "out/pack.docx"}}
    definition = sibling._emitted_definition()
    definition["phases"][1]["validators"] = [
        copy.deepcopy(DRAFTER_FILE_GATE), copy.deepcopy(live_file),
    ]
    sibling._arm(monkeypatch)

    emitted = WorkflowDefinition.model_validate(definition)

    async def _fake_forced_emit(**_kwargs):
        return {"emitted": emitted}

    import app.services.forced_emit as fe

    monkeypatch.setattr(fe, "forced_emit", _fake_forced_emit)

    result = await wa.generate_workflow_definition(
        describe=sibling.DESCRIBE, supabase=object(), user_id="u1", settings=sibling.STUB_SETTINGS
    )
    assert result["ok"] is True, result
    step_two = result["definition"]["phases"][1]["validators"]
    assert [v["config"] for v in step_two] == [{"path": "out/pack.docx"}]
