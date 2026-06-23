"""Structural assertion that the D-01 catalog note reconciles with LOAD_SKILL_TOOL.

This guards the Pitfall 1 fidelity invariant: the runtime "## Available Skills" note
in agent_loop.py and the Plan 03 Tuner classifier must measure the SAME production
firing policy. We assert (a) the shared LOAD_SKILL_POLICY constant is the relaxed
description-driven text, (b) agent_loop.py imports it and no longer carries the old
over-conservative wording, and (c) it tells the same story as LOAD_SKILL_TOOL.
"""
from __future__ import annotations

import inspect

import app.services.agent_loop as agent_loop
from app.services.openai_service import LOAD_SKILL_TOOL
from app.services.skill_lint import LOAD_SKILL_POLICY


def test_policy_constant_is_relaxed_and_description_driven():
    assert "load_skill" in LOAD_SKILL_POLICY
    # The relaxed policy fires on intent/description match...
    low = LOAD_SKILL_POLICY.lower()
    assert "match" in low
    # ...and must NOT carry the retired over-conservative wording.
    assert "ONLY call" not in LOAD_SKILL_POLICY
    assert "Never auto-load" not in LOAD_SKILL_POLICY
    assert "explicitly names" not in LOAD_SKILL_POLICY


def test_agent_loop_imports_shared_policy_and_drops_old_wording():
    # agent_loop binds the shared constant (single source of truth).
    assert agent_loop.LOAD_SKILL_POLICY is LOAD_SKILL_POLICY

    src = inspect.getsource(agent_loop)
    # The catalog note no longer hardcodes the conservative instruction.
    assert "ONLY call" not in src
    assert "Never auto-load" not in src
    # The note still uses the shared policy constant + the catalog header.
    assert "LOAD_SKILL_POLICY" in src
    assert "## Available Skills" in src


def test_note_reconciles_with_load_skill_tool():
    # Both surfaces tell ONE story: fire load_skill when the request matches a skill.
    tool_desc = LOAD_SKILL_TOOL["function"]["description"].lower()
    assert "load_skill" in LOAD_SKILL_POLICY.lower()
    assert "match" in tool_desc and "catalog" in tool_desc
    # Neither surface restricts firing to explicit name mentions only.
    assert "explicitly names" not in LOAD_SKILL_POLICY
    assert "only call" not in tool_desc
