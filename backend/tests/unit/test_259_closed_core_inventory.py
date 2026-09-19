from __future__ import annotations

import ast
import pathlib
import pytest

from app.services.harness.phase_types import PHASE_TYPE_REGISTRY_ENTRIES
from app.services.harness.emitters import EMITTER_REGISTRY
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
    """PACK-01: _TOOL_REGISTRY and tool_dispatcher have zero expert-specific tools and registry is closed (exactly 29)."""
    assert len(_TOOL_REGISTRY) == 29, (
        f"Tool registry drift: expected 29 tools, got {len(_TOOL_REGISTRY)}: "
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


def test_no_expert_runtime_or_loop_modules_exist():
    """PACK-01: Zero files in backend/app/services match expert runtime, agent, or loop patterns."""
    services_dir = APP_DIR / "services"
    forbidden_patterns = ["*expert*agent*", "*expert*loop*", "*expert*runtime*", "*expert*executor*"]

    for pattern in forbidden_patterns:
        matches = list(services_dir.glob(pattern))
        assert len(matches) == 0, f"Forbidden expert execution runtime module found: {matches}"


def test_expert_service_is_pure_data_manifest_ast():
    """PACK-01: AST inspection proves expert_service.py has no execution loop and no LLM runtime."""
    service_path = APP_DIR / "services" / "expert_service.py"
    tree = ast.parse(service_path.read_text(encoding="utf-8"), filename=str(service_path))

    for node in ast.walk(tree):
        # 1. No while loop (no execution or agent loop)
        if isinstance(node, ast.While):
            pytest.fail(f"While loop detected in expert_service.py:{node.lineno} — expert must have no execution loop")

        # 2. No direct model client imports
        if isinstance(node, ast.Import):
            for alias in node.names:
                if alias.name in ("openai", "anthropic", "litellm", "google.generativeai"):
                    pytest.fail(f"LLM client import detected in expert_service.py:{node.lineno} ({alias.name})")
        if isinstance(node, ast.ImportFrom):
            if node.module and any(p in node.module for p in ("openai", "anthropic", "litellm", "agent_loop")):
                pytest.fail(f"Forbidden LLM or agent loop import in expert_service.py:{node.lineno} ({node.module})")
