"""Phase 091 — HARNESS-05 whitelist-guard contracts (Wave-0 skeleton).

The dispatch_tool whitelist guard (clean refusal envelope, matching
tool_call_id, Deep-Mode no-op, tool_refused audit) is owned by Plan 06. Each
skip names Plan 06. One live assert pins the ToolContext phase_whitelist
passthrough the factory carries.
"""
from __future__ import annotations

import pytest

from app.models.harness import LlmAgentPhaseConfig


def test_whitelist_context_carries_phase_whitelist(make_tool_context):
    """LIVE anchor — the ctx factory exposes phase_whitelist (None = Deep Mode).

    The whitelist itself is sourced from a phase config's available_tools — the
    guard (Plan 06) converts available_tools → phase_whitelist on the ToolContext.
    """
    cfg = LlmAgentPhaseConfig.model_validate(
        {"phase_type": "llm_agent", "prompt": "x", "available_tools": ["search_documents"]}
    )
    ctx = make_tool_context(phase_whitelist=frozenset(cfg.available_tools))
    assert ctx.phase_whitelist == frozenset({"search_documents"})
    assert make_tool_context().phase_whitelist is None  # Deep Mode default


@pytest.mark.skip(reason="Wave 0 contract — flipped live by Plan 06")
def test_out_of_whitelist_refused_clean_tool_result(make_tool_context):
    """dispatch_tool of a non-whitelisted tool returns a clean
    {"error":"tool_not_available_in_phase","allowed":[...]} ToolResult (no raise)."""
    raise NotImplementedError


@pytest.mark.skip(reason="Wave 0 contract — flipped live by Plan 06")
def test_refusal_carries_matching_tool_call_id(make_tool_context):
    """The refusal tool_result is attached to the ORIGINAL tool_call_id."""
    raise NotImplementedError


@pytest.mark.skip(reason="Wave 0 contract — flipped live by Plan 06")
def test_deep_mode_none_is_noop(make_tool_context):
    """phase_whitelist=None → guard skipped → dispatch byte-identical to pre-091."""
    raise NotImplementedError


@pytest.mark.skip(reason="Wave 0 contract — flipped live by Plan 06")
def test_refusal_audited(make_tool_context, fake_redis):
    """A refused tool writes a harness_audit tool_refused row."""
    raise NotImplementedError
