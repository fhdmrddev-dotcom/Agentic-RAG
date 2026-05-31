"""Phase 091 — TOOL-05 tool-budget contracts (Wave-0 skeleton).

The get_tools budget guard (cap at max_tools, always retain whitelist tools, no
cap when max_tools absent) is owned by Plan 06. Each skip names Plan 06. One
live assert pins the whitelist-source shape the budget guard reads.
"""
from __future__ import annotations

import pytest

from app.models.harness import LlmAgentPhaseConfig


def test_budget_whitelist_source_is_available_tools():
    """LIVE anchor — the budget guard's retain-set is the phase's available_tools."""
    cfg = LlmAgentPhaseConfig.model_validate(
        {"phase_type": "llm_agent", "prompt": "x",
         "available_tools": ["search_documents", "execute_code"]}
    )
    assert set(cfg.available_tools) == {"search_documents", "execute_code"}


@pytest.mark.skip(reason="Wave 0 contract — flipped live by Plan 06")
def test_budget_caps_at_max_tools(make_tool_context):
    """get_tools filtered then capped at MODEL_CAPABILITIES[model].max_tools."""
    raise NotImplementedError


@pytest.mark.skip(reason="Wave 0 contract — flipped live by Plan 06")
def test_whitelist_tools_always_retained(make_tool_context):
    """When the cap fires, every whitelist tool is retained (lowest-priority dropped first)."""
    raise NotImplementedError


@pytest.mark.skip(reason="Wave 0 contract — flipped live by Plan 06")
def test_no_cap_when_max_tools_absent(make_tool_context):
    """A model with no max_tools → all tools returned unchanged (soft ceiling)."""
    raise NotImplementedError
