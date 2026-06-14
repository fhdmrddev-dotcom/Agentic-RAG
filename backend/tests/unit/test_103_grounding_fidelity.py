"""Phase 103 (REQ-2 / WFAUTH-02) — grounding fidelity (folder ⊆ subtree + registry).

Wave 0 (Plan 01 Task 1) authors these stubs; **Plan 02** fills them. Both cases are
``@pytest.mark.xfail(strict=False)`` until the ``workflow_authoring`` grounding check
lands in Plan 02, so the Wave-0 suite exits 0.

Target behaviors (Plan 02) — distinct from ``model_validate()`` shape-only:
  - every phase ``folder_scope`` UUID is a SUBSET of the bound project subtree
    (reuse ``assert_folder_scopes_subset`` from ``harness/scope.py``);
  - every ``available_tools`` entry ∈ the real tool registry; every ``skill_ref``
    ∈ the owner/global skill set. A hallucinated folder/tool/skill is REJECTED
    (not silently accepted).

CONVENTION (Phase 102 posture): imports INSIDE the test bodies.
"""

from __future__ import annotations

import pytest


@pytest.mark.xfail(reason="Plan 02 wires folder_scope ⊆ subtree grounding (scope.assert_folder_scopes_subset)", strict=False)
@pytest.mark.asyncio
async def test_folder_scopes_subset_of_bound_subtree():
    """Every generated phase ``folder_scope`` UUID is a subset of the bound project
    subtree; a folder outside the subtree is rejected."""
    from app.services import workflow_authoring  # noqa: F401 — Plan 02 creates this

    raise AssertionError("Plan 02 fills: assert folder_scope ⊆ subtree; outside -> rejected")


@pytest.mark.xfail(reason="Plan 02 wires tool/skill registry membership grounding", strict=False)
@pytest.mark.asyncio
async def test_tools_and_skills_in_registry():
    """Every ``available_tools`` ∈ the real tool registry and every ``skill_ref`` ∈
    the owner/global skill set; a hallucinated tool/skill is rejected."""
    from app.services import workflow_authoring  # noqa: F401

    raise AssertionError("Plan 02 fills: assert tools/skills ∈ registry; hallucinated -> rejected")
