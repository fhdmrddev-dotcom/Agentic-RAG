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


# ── Phase 093 / D-10 — INPUT_UNSATISFIED lint rule (T-093-DOS) ───────────────


def test_lint_flags_input_unsatisfied_unproduced_key(build_workflow_definition):
    """A programmatic phase reading an input_key no upstream phase produces is flagged.

    'never_produced' is neither an upstream phase slug/output nor a known run input
    (kickoff_prompt/topic) -> the run would strand at runtime, so publish-time lint
    rejects it (safe-by-construction, D-10).
    """
    wf = build_workflow_definition(
        [
            {"config": {"phase_type": "llm_single", "prompt": "entry"}},
            {"config": {"phase_type": "programmatic", "fn": "split_topic",
                        "input_keys": ["never_produced"]}},
        ]
    )
    findings = [e for e in lint_workflow(wf) if e.code == "input_unsatisfied"]
    assert findings, "expected an input_unsatisfied finding"
    # phase_slug points at the offending phase (auto-slug 'p1' for the 2nd phase).
    assert findings[0].phase_slug == wf.phases[1].slug


def test_lint_accepts_kickoff_prompt_as_known_run_input(build_workflow_definition):
    """A phase reading the run input 'kickoff_prompt' produces NO input_unsatisfied error."""
    wf = build_workflow_definition(
        [
            {"config": {"phase_type": "programmatic", "fn": "split_topic",
                        "input_keys": ["kickoff_prompt"]}},
            {"config": {"phase_type": "llm_single", "prompt": "merge"}},
        ]
    )
    codes = [e.code for e in lint_workflow(wf)]
    assert "input_unsatisfied" not in codes, codes


def test_lint_accepts_upstream_produced_slug(build_workflow_definition):
    """A phase reading an UPSTREAM phase's slug as its input_key is satisfied."""
    wf = build_workflow_definition(
        [
            {"slug": "gather", "phase_index": 0,
             "config": {"phase_type": "llm_single", "prompt": "gather"}},
            {"slug": "use", "phase_index": 1,
             "config": {"phase_type": "programmatic", "fn": "split_topic",
                        "input_keys": ["gather"]}},
        ]
    )
    codes = [e.code for e in lint_workflow(wf)]
    assert "input_unsatisfied" not in codes, codes


def test_4_seeds_lint_clean_after_split_topic_fix(four_seed_defs):
    """After the migration-065 seed shape (split phase input_keys includes
    'kickoff_prompt'), all 4 seeds STILL lint clean — including the new
    INPUT_UNSATISFIED rule. Mirrors the migration in-test so the seed fix + lint
    rule land together (D-10: seeds must lint clean after the fix)."""
    defs = four_seed_defs()
    for wf in defs:
        if wf.slug == "literature_review":
            # Mirror migration 065: split phase reads kickoff_prompt as well as topic.
            wf.phases[0].config.input_keys = ["topic", "kickoff_prompt"]
    for wf in defs:
        errors = lint_workflow(wf)
        assert errors == [], f"{wf.slug} should lint clean after the fix, got {errors}"
