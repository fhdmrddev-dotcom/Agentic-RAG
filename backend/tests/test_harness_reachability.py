"""Phase 091 — HARNESS-07 reachability-lint contracts (Wave-0 skeleton).

The publish-time reachability lint (orphan phase, unsatisfiable skip_to_phase,
missing terminal, 4-seeds-lint-clean) is owned by Plan 02 (lint fn) / Plan 07
(seeds). Each skip names its owning plan. One live assert pins the 4 seeds as a
real lint target.
"""
from __future__ import annotations

import pytest

from app.models.harness import WorkflowDefinition


def test_reachability_seeds_are_real_definitions(four_seed_defs):
    """LIVE anchor — the 4 seeds the lint must pass are parsed WorkflowDefinitions."""
    defs = four_seed_defs()
    assert len(defs) == 4
    assert all(isinstance(wf, WorkflowDefinition) for wf in defs)
    # phase_index sequences are contiguous from 0 (the lint's well-formedness floor).
    for wf in defs:
        idxs = sorted(p.phase_index for p in wf.phases)
        assert idxs == list(range(len(wf.phases)))


@pytest.mark.skip(reason="Wave 0 contract — flipped live by Plan 02")
def test_lint_flags_orphan_phase(build_workflow_definition):
    """A phase no transition can reach is flagged by the reachability lint."""
    raise NotImplementedError


@pytest.mark.skip(reason="Wave 0 contract — flipped live by Plan 02")
def test_lint_flags_unsatisfiable_skip_to_phase(build_workflow_definition):
    """on_failure='skip_to_phase:<missing-slug>' is flagged at publish time."""
    raise NotImplementedError


@pytest.mark.skip(reason="Wave 0 contract — flipped live by Plan 02")
def test_lint_flags_missing_terminal(build_workflow_definition):
    """A definition with no terminal phase is flagged."""
    raise NotImplementedError


@pytest.mark.skip(reason="Wave 0 contract — flipped live by Plan 02/07")
def test_4_seeds_lint_clean(four_seed_defs):
    """All 4 canonical seeds pass the reachability lint with zero findings."""
    raise NotImplementedError
