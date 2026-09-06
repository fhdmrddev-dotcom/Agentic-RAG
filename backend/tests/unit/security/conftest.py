"""Phase 236: The Corpus Under Attack — Mutation Testing Harness & Fixtures (SC#2).

Ratified by Operator Ruling on BUS-163:
Provides a pytest runtime fixture that monkeypatches named defense modules when
invoked with `pytest --disable-defense=<defense_name>`.

Asserts pre-patch target existence before applying monkeypatch (preventing silent no-op).
"""

from __future__ import annotations

import importlib
import re
import sys
import pytest
from app.services.tool_dispatcher import ToolResult


DEFENSE_TARGETS = {
    "tool_dispatcher_trifecta": {
        "module": "app.services.tool_dispatcher",
        "symbol": "_handle_connector_chat_tool",
        "description": "TRUST-03 trifecta fence in tool_dispatcher (forces posture='ask')",
    },
    "chat_tools_envelope": {
        "module": "app.services.connectors.chat_tools",
        "symbol": "wrap_untrusted_tool_result",
        "description": "wrap_untrusted_tool_result XML isolation envelope",
    },
    "service_tools_param_fence": {
        "module": "app.services.connectors.service_tools",
        "symbol": "_ISSUE_KEY",
        "description": "_ISSUE_KEY regex validation & parameter transport fence",
    },
    "embedding_metadata_prompt": {
        "module": "app.services.embedding_service",
        "symbol": "METADATA_EXTRACTION_ANTI_INJECTION",
        "description": "METADATA_EXTRACTION_ANTI_INJECTION boundary constant",
    },
    "eval_runner_evidence_prompt": {
        "module": "app.services.eval_runner_service",
        "symbol": "EVAL_JUDGE_RUBRIC",
        "description": "EVAL_JUDGE_RUBRIC data-not-command clause & _EVIDENCE_BLOCK_CAP",
    },
    "phase_types_grounding_tag": {
        "module": "app.services.harness.phase_types",
        "symbol": "_emit_evidence",
        "description": "_emit_evidence grounding tag filtering (valid_ids)",
    },
    "validator_kinds_grounded": {
        "module": "app.services.harness.validator_kinds",
        "symbol": "JUDGE_RUBRIC_CORE",
        "description": "JUDGE_RUBRIC_CORE grounded_in_evidence check",
    },
    "skill_proposer_evidence": {
        "module": "app.services.skill_proposer_service",
        "symbol": "SKILL_PROPOSER_EVIDENCE_DELIMITER",
        "description": "SKILL_PROPOSER_EVIDENCE_DELIMITER evidence isolation constant",
    },
}


def pytest_addoption(parser):
    parser.addoption(
        "--disable-defense",
        action="store",
        default=None,
        help="Disable a specific security defense module via runtime monkeypatch for mutation testing (SC#2).",
    )


def _patch_symbol(monkeypatch, mod, symbol_name, patched_value):
    """Monkeypatch symbol on target module and test module namespace if present."""
    monkeypatch.setattr(mod, symbol_name, patched_value)
    test_mod = sys.modules.get("tests.unit.security.test_adversarial_corpus")
    if test_mod and hasattr(test_mod, symbol_name):
        monkeypatch.setattr(test_mod, symbol_name, patched_value)


@pytest.fixture(autouse=True)
def apply_defense_mutation(request, monkeypatch):
    defense_to_disable = request.config.getoption("--disable-defense")
    if not defense_to_disable:
        return

    if defense_to_disable not in DEFENSE_TARGETS:
        pytest.fail(
            f"Invalid defense name '{defense_to_disable}'. "
            f"Valid defenses are: {sorted(DEFENSE_TARGETS.keys())}"
        )

    meta = DEFENSE_TARGETS[defense_to_disable]
    mod_name = meta["module"]
    symbol_name = meta["symbol"]

    # Import target module
    mod = importlib.import_module(mod_name)

    # Pre-patch existence assertion (BUS-163 strict fence: verify target exists before patching)
    assert hasattr(mod, symbol_name), (
        f"MUTATION HARNESS FENCE ERROR: Target symbol '{symbol_name}' does not exist on module '{mod_name}'. "
        "The defense target may have moved or been renamed."
    )

    # Apply specific mutation
    if defense_to_disable == "tool_dispatcher_trifecta":
        async def _unfenced_handle_connector_chat_tool(service_id, action_tool_name, args, ctx):
            # Insecure bypass: returns success directly without enforcing posture='ask' or tool_approval_required
            return ToolResult(result=f"Executed {action_tool_name} directly without approval.")
        _patch_symbol(monkeypatch, mod, "_handle_connector_chat_tool", _unfenced_handle_connector_chat_tool)

    elif defense_to_disable == "chat_tools_envelope":
        # Insecure bypass: returns unwrapped raw output without <external_tool_result> isolation envelope
        _patch_symbol(
            monkeypatch,
            mod,
            "wrap_untrusted_tool_result",
            lambda service_name, tool_name, raw_output: raw_output,
        )

    elif defense_to_disable == "service_tools_param_fence":
        # Insecure bypass: replaces regex with wildcard accepting arbitrary injection strings
        _patch_symbol(monkeypatch, mod, "_ISSUE_KEY", re.compile(r".*"))

    elif defense_to_disable == "embedding_metadata_prompt":
        # Insecure bypass: removes prompt anti-injection clause
        _patch_symbol(monkeypatch, mod, "METADATA_EXTRACTION_ANTI_INJECTION", "")

    elif defense_to_disable == "eval_runner_evidence_prompt":
        # Insecure bypass: strips DATA instruction clause and disables evidence length cap
        _patch_symbol(monkeypatch, mod, "EVAL_JUDGE_RUBRIC", "Lenient judge rubric with no DATA boundary.")
        assert hasattr(mod, "_EVIDENCE_BLOCK_CAP")
        _patch_symbol(monkeypatch, mod, "_EVIDENCE_BLOCK_CAP", 10_000_000)

    elif defense_to_disable == "phase_types_grounding_tag":
        # Insecure bypass: includes fake <doc id=...> tags injected into passage text in valid_ids
        orig_emit = mod._emit_evidence

        def _insecure_emit(accumulated_outputs):
            spotlight, valid_ids = orig_emit(accumulated_outputs)
            injected = set(re.findall(r'<doc id="([^"]+)"', spotlight))
            return spotlight, valid_ids | injected

        _patch_symbol(monkeypatch, mod, "_emit_evidence", _insecure_emit)

    elif defense_to_disable == "validator_kinds_grounded":
        # Insecure bypass: removes grounded_in_evidence rubric
        _patch_symbol(monkeypatch, mod, "JUDGE_RUBRIC_CORE", "Lenient rubric core.")

    elif defense_to_disable == "skill_proposer_evidence":
        # Insecure bypass: removes evidence block isolation delimiter
        _patch_symbol(monkeypatch, mod, "SKILL_PROPOSER_EVIDENCE_DELIMITER", "")
