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


from app.models.harness import WorkflowDefinition  # noqa: E402
from app.services.harness import lint_workflow, parse_skip_target  # noqa: E402


def _raw_def(name, phases):
    """Build a WorkflowDefinition from raw phase dicts (bypasses auto-index)."""
    return WorkflowDefinition.model_validate(
        {"slug": "wf", "version": 1, "name": name, "status": "draft", "phases": phases}
    )


def test_parse_skip_target_extracts_slug():
    assert parse_skip_target("skip_to_phase:gather") == "gather"
    assert parse_skip_target("fail_run") is None
    assert parse_skip_target("retry") is None
    assert parse_skip_target("skip_to_phase:") is None


def test_lint_flags_orphan_phase():
    """A phase the sequential+skip walk cannot reach from the entry is flagged.

    A genuine orphan: a gap in phase_index (0, then 2) means the sequential walk
    (0->1) cannot bridge to index 2, and no skip edge points at it either, so the
    index-2 phase is unreachable from the entry.
    """
    wf = _raw_def(
        "orphaned",
        [
            {"slug": "a", "phase_index": 0,
             "config": {"phase_type": "llm_single", "prompt": "a"}},
            # No phase at index 1 → the sequential walk stops at 'a'; 'island'
            # (index 2) has no inbound edge → orphan.
            {"slug": "island", "phase_index": 2,
             "config": {"phase_type": "llm_single", "prompt": "island"}},
        ],
    )
    codes = [e.code for e in lint_workflow(wf)]
    assert "orphan_phase" in codes


def test_lint_flags_unsatisfiable_skip_to_phase(build_workflow_definition):
    """on_failure='skip_to_phase:<missing-slug>' is flagged at publish time."""
    wf = build_workflow_definition(
        [
            {
                "config": {"phase_type": "llm_single", "prompt": "entry"},
                "validators": [
                    {"kind": "regex_match", "on_failure": "skip_to_phase:does_not_exist"}
                ],
            },
            {"config": {"phase_type": "llm_single", "prompt": "tail"}},
        ]
    )
    codes = [e.code for e in lint_workflow(wf)]
    assert "unsatisfiable_skip" in codes


def test_lint_flags_missing_terminal():
    """A graph whose terminal (highest index) is unreachable is flagged.

    'entry' (index 0) has no sequential successor at index 1 — there's a gap to
    the terminal at index 2 — so the terminal is unreachable: no_terminal.
    """
    wf = _raw_def(
        "no-terminal",
        [
            {"slug": "entry", "phase_index": 0,
             "config": {"phase_type": "llm_single", "prompt": "entry"}},
            {"slug": "terminal", "phase_index": 2,
             "config": {"phase_type": "llm_single", "prompt": "terminal"}},
        ],
    )
    codes = [e.code for e in lint_workflow(wf)]
    assert "no_terminal" in codes

    # An empty definition is also terminal-less.
    empty = _raw_def("empty", [])
    assert [e.code for e in lint_workflow(empty)] == ["no_terminal"]


def test_4_seeds_lint_clean(four_seed_defs):
    """All 4 canonical seeds pass the reachability lint with zero findings."""
    defs = four_seed_defs()
    assert len(defs) == 4
    for wf in defs:
        errors = lint_workflow(wf)
        assert errors == [], f"{wf.slug} should lint clean, got {errors}"
