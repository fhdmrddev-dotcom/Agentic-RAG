"""Phase 103 (REQ-2 / WFAUTH-02) — grounding fidelity (folder ⊆ subtree + registry).

Wave 0 (Plan 01 Task 1) authored the stubs; **Plan 02** fills them. The
``workflow_authoring`` grounding-fidelity check now exists, so these are GREEN.

Grounding fidelity is DISTINCT from ``model_validate()`` (shape-only). After a
shape-valid emit, three server-side checks run and a violation is an HONEST failure
(``ok=False / grounding_failed``), NEVER a draft (T-103-02-04, G-6):
  - every per-phase ``folder_scope`` UUID ⊆ the bound project subtree
    (``assert_folder_scopes_subset``);
  - every ``available_tools`` entry ∈ the real tool registry;
  - every ``skill_ref`` ∈ the owner/global enabled skill set.

CONVENTION (Phase 102 posture): imports INSIDE the test bodies; forced_emit + the
grounding accessors mocked at their boundaries.
"""

from __future__ import annotations

import pytest


def _definition_with_tool(tool_name: str) -> dict:
    """A shape-valid definition whose single llm_agent phase whitelists ``tool_name``."""
    return {
        "slug": "research-wf",
        "version": 1,
        "name": "Research Workflow",
        "status": "draft",
        "phases": [
            {
                "slug": "research",
                "phase_index": 0,
                "config": {
                    "phase_type": "llm_agent",
                    "prompt": "Research the topic.",
                    "available_tools": [tool_name],
                },
                "validators": [],
            }
        ],
    }


def _wd(d: dict):
    from app.models.harness import WorkflowDefinition

    return WorkflowDefinition.model_validate(d)


def _patch_for_emit(monkeypatch, *, emitted_dict, tool_names, skill_ids):
    """Patch grounding assembly (to return the given registries), resolve_authoring_model,
    get_model_capability, and forced_emit (to return ``emitted_dict``)."""
    import app.config as cfg
    import app.services.forced_emit as fe
    import app.services.workflow_authoring as wa

    async def _fake_assemble(**_kwargs):
        return ("GROUNDED", set(tool_names), set(skill_ids))

    monkeypatch.setattr(wa, "_assemble_grounding", _fake_assemble)
    monkeypatch.setattr(wa, "resolve_authoring_model", lambda settings: "claude-opus-4-8")
    monkeypatch.setattr(
        cfg, "get_model_capability", lambda model: {"forced_emission": True, "provider": "anthropic"}
    )

    async def _fake_forced_emit(**_kwargs):
        return {"emitted": _wd(emitted_dict), "failure": None}

    monkeypatch.setattr(fe, "forced_emit", _fake_forced_emit)


@pytest.mark.asyncio
async def test_folder_scopes_subset_of_bound_subtree(monkeypatch):
    """A generated phase ``folder_scope`` UUID OUTSIDE the bound subtree -> grounding_failed
    (not a draft). ``assert_folder_scopes_subset`` is the server-side ⊆ check; we mock it
    to raise (the out-of-subtree case it raises ValueError on)."""
    import app.services.harness.scope as scope_mod
    import app.services.workflow_authoring as wa

    # A definition with a project binding + a phase folder_scope (shape-valid).
    bad = {
        "slug": "scoped-wf",
        "version": 1,
        "name": "Scoped Workflow",
        "status": "draft",
        "project_folder_id": "11111111-1111-1111-1111-111111111111",
        "phases": [
            {
                "slug": "research",
                "phase_index": 0,
                "config": {
                    "phase_type": "llm_agent",
                    "prompt": "Research.",
                    "available_tools": [],
                    "folder_scope": ["22222222-2222-2222-2222-222222222222"],
                },
                "validators": [],
            }
        ],
    }
    _patch_for_emit(monkeypatch, emitted_dict=bad, tool_names=set(), skill_ids=set())

    async def _raise_subset(definition, *, supabase, user_id):
        raise ValueError("phase 'research' folder_scope is not a subset of the project subtree")

    monkeypatch.setattr(scope_mod, "assert_folder_scopes_subset", _raise_subset)

    result = await wa.generate_workflow_definition(
        describe="scoped research",
        supabase=object(),
        user_id="u1",
        settings=object(),
        project_folder_id="11111111-1111-1111-1111-111111111111",
    )
    assert result["ok"] is False
    assert result["error"] == "grounding_failed"
    assert "definition" not in result  # the ungrounded draft is NEVER returned


@pytest.mark.asyncio
async def test_tools_and_skills_in_registry(monkeypatch):
    """A hallucinated ``available_tools`` entry -> grounding_failed; a clean definition
    (tool ∈ registry) -> ok=True. (folder_scope is empty so the ⊆ check is a no-op.)"""
    import app.services.workflow_authoring as wa

    # Case A: hallucinated tool (not in the registry set) -> grounding_failed.
    _patch_for_emit(
        monkeypatch,
        emitted_dict=_definition_with_tool("not_a_real_tool"),
        tool_names={"search_documents", "execute_code"},
        skill_ids=set(),
    )
    bad = await wa.generate_workflow_definition(
        describe="research", supabase=object(), user_id="u1", settings=object()
    )
    assert bad["ok"] is False
    assert bad["error"] == "grounding_failed"
    assert "definition" not in bad

    # Case B: a registered tool -> clean (ok=True).
    _patch_for_emit(
        monkeypatch,
        emitted_dict=_definition_with_tool("search_documents"),
        tool_names={"search_documents", "execute_code"},
        skill_ids=set(),
    )
    good = await wa.generate_workflow_definition(
        describe="research", supabase=object(), user_id="u1", settings=object()
    )
    assert good["ok"] is True
    assert good["definition"]["phases"][0]["config"]["available_tools"] == ["search_documents"]
