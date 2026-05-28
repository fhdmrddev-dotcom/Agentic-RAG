"""Phase 085 Plan 01 — tool registry assertions for write_todos.

This file asserts the lower bound after Plan 01 (>=22 entries — adds write_todos).
Plans 02 and 03 add `task` and `ask_user`; the phase-end gate is exactly 24.
"""
from __future__ import annotations

from app.services.tool_dispatcher import _TOOL_REGISTRY


def test_write_todos_in_registry():
    """After Task 3, write_todos must be a registry key."""
    assert "write_todos" in _TOOL_REGISTRY


def test_registry_minimum_size_after_085_plan_01():
    """Plan 01 adds 1 tool (write_todos); plans 02 + 03 add 2 more.

    Lower bound = 22 (21 Phase 084 baseline + 1 write_todos).
    Phase-end gate tightens to 24 after Plans 02 + 03 land.
    """
    assert len(_TOOL_REGISTRY) >= 22
