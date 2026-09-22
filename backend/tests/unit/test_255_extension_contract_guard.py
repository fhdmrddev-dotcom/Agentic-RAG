"""Phase 255 (EXT-02) — Mechanical guard for the closed-core extension contract.

The Extension Contract (docs/EXTENSION-CONTRACT.md / SEED-291) guarantees that:
    "A plugin is DATA, an EXTERNAL PROCESS, or SANDBOXED CODE. Never engine code."

This suite enforces that:
1. PHASE_TYPE_REGISTRY_ENTRIES has exactly 7 executors (the D-14 red line).
2. PROGRAMMATIC_PHASE_REGISTRY has only the 2 verified static functions.
3. EMITTER_REGISTRY has only the verified static emitters.
4. _TOOL_REGISTRY in tool_dispatcher.py contains only static built-in tools.
5. VALIDATOR_REGISTRY and PROGRAMMATIC_VALIDATOR_REGISTRY are closed.
6. None of the six trigger files employ dynamic code execution (eval, exec, importlib).
"""

import ast
import re
from pathlib import Path
import pytest

from app.services.harness.phase_types import PHASE_TYPE_REGISTRY_ENTRIES
from app.services.harness.programmatic import PROGRAMMATIC_PHASE_REGISTRY
from app.services.harness.emitters import EMITTER_REGISTRY
from app.services.harness.validators import (
    VALIDATOR_REGISTRY,
    PROGRAMMATIC_VALIDATOR_REGISTRY,
)
from app.services.tool_dispatcher import _TOOL_REGISTRY

# The 6 closed-core trigger files from SEED-291:
TRIGGER_FILES = [
    Path("app/services/harness/phase_types.py"),
    Path("app/services/harness/validator_kinds.py"),
    Path("app/services/harness/emitters.py"),
    Path("app/services/harness/programmatic.py"),
    Path("app/services/tool_dispatcher.py"),
    Path("app/services/agent_loop.py"),
]


def test_phase_type_registry_is_closed():
    """EXT-01/02: PHASE_TYPE_REGISTRY_ENTRIES must contain exactly the 7 verified executors."""
    expected_executors = {
        "programmatic",
        "llm_single",
        "llm_agent",
        "llm_batch_agents",
        "llm_human_input",
        "llm_emit",
        "external_action",
    }
    actual_executors = set(PHASE_TYPE_REGISTRY_ENTRIES.keys())
    assert actual_executors == expected_executors, (
        f"Closed core violation: PHASE_TYPE_REGISTRY_ENTRIES must have exactly 7 executors. "
        f"Diff: added={actual_executors - expected_executors}, missing={expected_executors - actual_executors}"
    )


def test_programmatic_phase_registry_is_closed():
    """EXT-01/02: PROGRAMMATIC_PHASE_REGISTRY must only contain verified static functions."""
    expected = {"split_topic", "eval_slow_step"}
    actual = set(PROGRAMMATIC_PHASE_REGISTRY.keys())
    assert actual == expected, (
        f"Closed core violation: PROGRAMMATIC_PHASE_REGISTRY must have exactly {expected}. "
        f"Found: {actual}"
    )


def test_emitter_registry_is_closed():
    """EXT-01/02: EMITTER_REGISTRY must only contain verified static emitters."""
    expected = {"render_template"}
    actual = set(EMITTER_REGISTRY.keys())
    assert actual == expected, (
        f"Closed core violation: EMITTER_REGISTRY must have exactly {expected}. Found: {actual}"
    )


def test_tool_registry_is_closed():
    """EXT-01/02: _TOOL_REGISTRY in tool_dispatcher.py must contain only built-in tools."""
    expected_tools = {
        "ls", "tree", "grep", "glob", "read_document",
        "search_documents", "query_documents", "web_search",
        "analyze_document", "load_skill", "save_skill",
        "read_skill_file", "execute_code", "remember", "recall",
        "query_tables", "workspace_write", "workspace_read",
        "workspace_list", "workspace_delete", "workspace_diff",
        "write_todos", "task", "ask_user", "render_template",
        "query_documents_by_view", "get_related_documents",
        "fetch_document_file", "attach_skill_file",
    }
    actual_tools = set(_TOOL_REGISTRY.keys())
    assert actual_tools == expected_tools, (
        f"Closed core violation: _TOOL_REGISTRY drift detected. "
        f"Diff: added={actual_tools - expected_tools}, missing={expected_tools - actual_tools}"
    )


def test_validator_registries_are_closed():
    """EXT-01/02: Validator registries must be closed and static."""
    # PROGRAMMATIC_VALIDATOR_REGISTRY should be empty in core
    assert len(PROGRAMMATIC_VALIDATOR_REGISTRY) == 0, (
        f"PROGRAMMATIC_VALIDATOR_REGISTRY must be empty; found {PROGRAMMATIC_VALIDATOR_REGISTRY}"
    )
    # VALIDATOR_REGISTRY must contain the 10 standard gate kinds
    expected_validators = {
        "citations_required",
        "output_file_valid",
        "structure_check",
        "llm_judge_rubric",
        "freshness",
        "action_risk_approval",
        "programmatic",
        "json_schema",
        "regex_match",
        "workspace_file_exists",
    }
    actual_validators = set(VALIDATOR_REGISTRY.keys())
    assert actual_validators == expected_validators, (
        f"VALIDATOR_REGISTRY drift detected: {actual_validators ^ expected_validators}"
    )


def test_no_dynamic_code_execution_in_trigger_paths():
    """EXT-02: Zero occurrences of importlib, eval, or exec in the six trigger paths."""
    backend_app_dir = Path(__file__).resolve().parent.parent.parent / "app"

    forbidden_re = re.compile(r"\b(importlib|eval\s*\(|(?<!a)exec\s*\(|__import__\s*\()")

    violations = []
    for rel_path in TRIGGER_FILES:
        file_path = backend_app_dir.parent / rel_path
        if not file_path.exists():
            violations.append(f"File not found: {rel_path}")
            continue

        content = file_path.read_text(encoding="utf-8")
        lines = content.splitlines()
        for idx, line in enumerate(lines, 1):
            code_part = line.split("#")[0].strip()
            if forbidden_re.search(code_part):
                violations.append(f"{rel_path}:{idx} -> {line.strip()}")

    assert not violations, (
        f"Closed core violation: dynamic code execution primitives found in trigger files:\n"
        + "\n".join(violations)
    )
