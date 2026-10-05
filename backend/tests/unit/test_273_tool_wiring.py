"""Phase 273-03 — ``show_artifact`` wiring (D-01, D-11, D-14, D-15, I-1, Pitfall 8).

The closed tool core moves by exactly ONE deliberate, counted tool. What this suite pins:

* dual wiring — one schema in ``get_tools()`` AND one ``_TOOL_REGISTRY`` line, the entry being the
  handler module's own function (a registry entry the model never sees is dead; a schema with no
  handler is a crash);
* the counts by ``len`` against PHASE_BASE (registry 29 → 30; get_tools 25 → 26 / 28 → 29 /
  23 → 24), never substring-matched;
* chat top-level only — ``CHAT_ONLY_TOOLS`` subtracted from the harness authoring offer (stays 28),
  excluded from task sub-agents, absent from the explorer;
* the schema survives every provider boundary (Gemini sanitizer, Anthropic conversion) and its
  enums are DERIVED from the closed Literals (I-1);
* the D-11 guidance lives in the tool DESCRIPTION and ``SYSTEM_PROMPT`` is byte-identical to
  PHASE_BASE (D-15).
"""
from __future__ import annotations

import ast
import json
import subprocess
from pathlib import Path
from types import SimpleNamespace

import pytest

PHASE_BASE = "f764734979c25696544b2408232f4fbdc779ae5f"
REPO_ROOT = Path(__file__).resolve().parents[3]


def _names(tools):
    return [t["function"]["name"] for t in tools]


# ── Dual wiring + counts ───────────────────────────────────────────────────────────────────────


def test_registry_entry_is_the_handler_module_function():
    from app.services import show_artifact_tool
    from app.services.tool_dispatcher import _TOOL_REGISTRY

    assert "show_artifact" in _TOOL_REGISTRY
    assert _TOOL_REGISTRY["show_artifact"] is show_artifact_tool.handle_show_artifact


def test_registry_is_thirty():
    from app.services.tool_dispatcher import _TOOL_REGISTRY

    # PHASE_BASE: 29. Phase 273 adds exactly one tool (show_artifact).
    assert len(_TOOL_REGISTRY) == 30


def test_get_tools_counts():
    from app.services.openai_service import get_tools

    base = _names(get_tools(SimpleNamespace(web_search_enabled=False, sandbox_enabled=False)))
    assert len(base) == 26  # PHASE_BASE 25
    assert "show_artifact" in base
    every = _names(get_tools(SimpleNamespace(web_search_enabled=True, sandbox_enabled=True)))
    assert len(every) == 29  # PHASE_BASE 28
    assert "show_artifact" in every
    none = _names(get_tools(SimpleNamespace(web_search_enabled=False, sandbox_enabled=False,
                                            self_improve_enabled=False)))
    assert len(none) == 24  # PHASE_BASE 23
    assert "show_artifact" in none
    assert len(set(every)) == len(every)


def test_show_artifact_follows_ask_user():
    from app.services.openai_service import get_tools

    names = _names(get_tools(SimpleNamespace(web_search_enabled=False, sandbox_enabled=False)))
    assert names[names.index("ask_user") + 1] == "show_artifact"


def test_not_offered_to_the_explorer():
    from app.services.openai_service import get_explorer_tools

    assert "show_artifact" not in _names(get_explorer_tools())


def test_excluded_from_sub_agents():
    from app.services.tool_dispatcher import _SUB_AGENT_EXCLUDED

    assert "show_artifact" in _SUB_AGENT_EXCLUDED


def test_chat_only_tools_is_exactly_show_artifact():
    from app.services.openai_service import CHAT_ONLY_TOOLS

    assert CHAT_ONLY_TOOLS == frozenset({"show_artifact"})


@pytest.mark.asyncio
async def test_harness_authoring_offer_excludes_chat_only_tools(monkeypatch):
    """The workflow builder's offer (``GroundingBundle.tools``) never contains show_artifact and
    stays 28 with every gate on (frontend ``components/workflows/toolNames.test.ts:56``)."""
    from unittest.mock import MagicMock

    import app.models.user_settings as us
    import app.services.openai_service as oai
    from app.services.harness.grounding import assemble_grounding_bundle

    # get_tools(None) reads the module-level `settings` (web/sandbox are read-only properties
    # there, so the module attribute is swapped) and the self-improve helper function-locally.
    monkeypatch.setattr(oai, "settings", SimpleNamespace(web_search_enabled=True, sandbox_enabled=True))
    monkeypatch.setattr(us, "self_improve_enabled", lambda: True)
    bundle = await assemble_grounding_bundle(supabase=MagicMock(),
                                             user_id="0f3a9c71-2b6e-4f18-a5d4-7e8b9c0d1a2f")
    assert "show_artifact" not in bundle.tools
    assert "show_artifact" not in bundle.tool_names
    assert len(bundle.tools) == 28


# ── Schema shape across the provider boundaries ────────────────────────────────────────────────


def _walk(node, visit):
    if isinstance(node, dict):
        visit(node)
        for v in node.values():
            _walk(v, visit)
    elif isinstance(node, list):
        for v in node:
            _walk(v, visit)


def test_schema_has_no_union_keywords():
    from app.services.openai_service import SHOW_ARTIFACT_TOOL

    found = []
    _walk(SHOW_ARTIFACT_TOOL["function"]["parameters"],
          lambda d: found.extend(k for k in ("anyOf", "oneOf", "allOf", "additionalProperties") if k in d))
    assert found == []


def test_schema_enums_are_derived_from_the_closed_literals():
    from app.models.artifact import ARTIFACT_COMPONENTS, CHART_KINDS
    from app.services.openai_service import SHOW_ARTIFACT_TOOL

    fn = SHOW_ARTIFACT_TOOL["function"]
    assert fn["name"] == "show_artifact"
    props = fn["parameters"]["properties"]
    assert tuple(props["component"]["enum"]) == ARTIFACT_COMPONENTS
    assert tuple(props["chart"]["properties"]["kind"]["enum"]) == CHART_KINDS
    assert fn["parameters"]["required"] == ["component", "title"]


def test_schema_converts_for_gemini_with_no_type_arrays():
    from app.services.google_service import _convert_tools_to_google
    from app.services.openai_service import SHOW_ARTIFACT_TOOL

    converted = _convert_tools_to_google([SHOW_ARTIFACT_TOOL])
    assert converted
    dumped = [t.model_dump(mode="json", exclude_none=True) for t in converted]
    bad = []
    _walk(dumped, lambda d: bad.append(d["type"]) if isinstance(d.get("type"), list) else None)
    assert bad == []
    assert "show_artifact" in json.dumps(dumped)


def test_schema_converts_for_anthropic():
    from app.services.anthropic_service import _convert_tools_to_anthropic
    from app.services.openai_service import SHOW_ARTIFACT_TOOL

    (tool,) = _convert_tools_to_anthropic([SHOW_ARTIFACT_TOOL])
    assert tool["name"] == "show_artifact"
    assert tool["input_schema"]["properties"]["component"]["enum"] == ["chart", "table", "metric"]


# ── Description (D-11) + SYSTEM_PROMPT unchanged (D-15) ────────────────────────────────────────


def test_description_carries_the_guidance_and_a_valid_example():
    from app.models.artifact import ArtifactRefusal, validate_args
    from app.services.openai_service import SHOW_ARTIFACT_TOOL

    desc = SHOW_ARTIFACT_TOOL["function"]["description"]
    assert len(desc) <= 3000
    for needle in ("execute_code", "PNG", "from_artifact", "500"):
        assert needle in desc, needle
    start = desc.index('{"component"')
    example, _ = json.JSONDecoder().raw_decode(desc[start:])
    parsed = validate_args(example)
    assert not isinstance(parsed, ArtifactRefusal), parsed


def _system_prompt_from(src: str) -> str:
    for node in ast.parse(src).body:
        if isinstance(node, ast.Assign) and any(getattr(t, "id", None) == "SYSTEM_PROMPT" for t in node.targets):
            return ast.literal_eval(node.value)
    raise AssertionError("SYSTEM_PROMPT assignment not found")


def test_system_prompt_is_byte_identical_to_phase_base():
    from app.services.agent_loop import SYSTEM_PROMPT

    base_src = subprocess.run(
        ["git", "show", f"{PHASE_BASE}:backend/app/services/agent_loop.py"],
        cwd=REPO_ROOT, capture_output=True, text=True, encoding="utf-8", check=True,
    ).stdout
    assert SYSTEM_PROMPT == _system_prompt_from(base_src)
    assert "show_artifact" not in SYSTEM_PROMPT
