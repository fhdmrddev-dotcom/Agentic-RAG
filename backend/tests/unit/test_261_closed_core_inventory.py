from __future__ import annotations

import ast
import pathlib
import pytest

from app.services.harness.phase_types import PHASE_TYPE_REGISTRY_ENTRIES
from app.services.harness.emitters import EMITTER_REGISTRY
from app.services import tool_dispatcher
from app.services.tool_dispatcher import _TOOL_REGISTRY


APP_DIR = pathlib.Path(__file__).resolve().parent.parent.parent / "app"


def test_phase_type_registry_contains_zero_expert_executors():
    """PACK-01 / EXT-01 Red Line: PHASE_TYPE_REGISTRY_ENTRIES has strictly 7 executors.

    An Expert is purely data, with NO expert-specific executor or phase type.
    """
    assert len(PHASE_TYPE_REGISTRY_ENTRIES) == 7, (
        f"Inventory drift: expected 7 phase type executors, got {len(PHASE_TYPE_REGISTRY_ENTRIES)}: "
        f"{list(PHASE_TYPE_REGISTRY_ENTRIES.keys())}"
    )
    for key in PHASE_TYPE_REGISTRY_ENTRIES:
        assert "expert" not in key.lower(), f"Expert executor detected in phase types: {key}"


def test_emitter_registry_contains_zero_expert_emitters():
    """PACK-01: EMITTER_REGISTRY contains zero expert emitters and remains closed (exactly 1)."""
    assert len(EMITTER_REGISTRY) == 1, (
        f"Emitter registry drift: expected 1 emitter, got {len(EMITTER_REGISTRY)}: "
        f"{list(EMITTER_REGISTRY.keys())}"
    )
    for key in EMITTER_REGISTRY:
        assert "expert" not in key.lower(), f"Expert emitter detected: {key}"


def test_tool_dispatcher_contains_zero_expert_tools_or_dispatchers():
    """PACK-01: _TOOL_REGISTRY and tool_dispatcher have zero expert-specific tools and registry is closed (exactly 30)."""
    # Phase 273: 29 → 30 — show_artifact, the deliberate 30th tool (a closed-core change recorded at discuss).
    assert len(_TOOL_REGISTRY) == 30, (
        f"Tool registry drift: expected 30 tools, got {len(_TOOL_REGISTRY)}: "
        f"{sorted(list(_TOOL_REGISTRY.keys()))}"
    )
    for tool_name in _TOOL_REGISTRY:
        assert "expert" not in tool_name.lower(), f"Expert tool registered in _TOOL_REGISTRY: {tool_name}"

    dispatcher_path = APP_DIR / "services" / "tool_dispatcher.py"
    tree = ast.parse(dispatcher_path.read_text(encoding="utf-8"), filename=str(dispatcher_path))
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            if node.name.startswith("_handle_expert"):
                pytest.fail(f"Expert-specific tool handler found in tool_dispatcher: {node.name}")


def test_no_second_encoding_of_the_tool_set_survives():
    """Phase 267 (D-267-01) — RE-DRIVEN. This test used to pin `len(EXPERT_CORE_TOOLS) == 10` and
    its subset of `_TOOL_REGISTRY`: a fence against the second tool registry DRIFTING. Phase 267
    deleted that second encoding outright (an Expert no longer filters tools), so the stronger
    form of the same intent is that no such encoding exists to drift at all.
    """
    for name in ("EXPERT_CORE_TOOLS", "EXPERT_DELIVERABLE_TOOLS"):
        assert not hasattr(tool_dispatcher, name), f"{name} is back in tool_dispatcher"
    dispatcher_path = APP_DIR / "services" / "tool_dispatcher.py"
    tree = ast.parse(dispatcher_path.read_text(encoding="utf-8"), filename=str(dispatcher_path))
    module_names = {
        t.id
        for node in tree.body
        if isinstance(node, (ast.Assign, ast.AnnAssign))
        for t in (node.targets if isinstance(node, ast.Assign) else [node.target])
        if isinstance(t, ast.Name)
    }
    assert not [n for n in module_names if "expert" in n.lower() and "tool" in n.lower()], module_names


def test_expert_authoring_service_uses_forced_emit_and_has_no_execution_loop():
    """PACK-09: expert_authoring.py reuses forced_emit, has no while loops, and has no autonomous runtime."""
    authoring_path = APP_DIR / "services" / "expert_authoring.py"
    tree = ast.parse(authoring_path.read_text(encoding="utf-8"), filename=str(authoring_path))

    found_forced_emit = False
    for node in ast.walk(tree):
        # 1. No while loop
        if isinstance(node, ast.While):
            pytest.fail(f"While loop detected in expert_authoring.py:{node.lineno} — drafting must not run a loop")

        # 2. Check for forced_emit import
        if isinstance(node, ast.ImportFrom):
            if node.module == "app.services.forced_emit":
                for alias in node.names:
                    if alias.name == "forced_emit":
                        found_forced_emit = True

    assert found_forced_emit, "expert_authoring.py must import forced_emit from app.services.forced_emit"
