"""Publish-time reachability lint for workflow definitions (Phase 091 / HARNESS-07).

A PURE function — no I/O, no DB, no engine import. It is the publish-time gate
(the HTTP publish endpoint is deferred to Phase 092 per Open Question 5) that
rejects definition graphs which would hang or strand a run at runtime
(T-091-04 / DoS mitigation):

  - ORPHAN_PHASE       : a phase no transition can reach from the entry.
  - UNSATISFIABLE_SKIP : an ``on_failure='skip_to_phase:<slug>'`` target slug that
                         does not exist.
  - NO_TERMINAL        : no phase from which run completion is reachable (a cycle
                         that can never reach the final index).
  - BAD_INDEX          : duplicate slug or non-contiguous ``phase_index`` (the
                         well-formedness floor).

The graph: nodes = phases; edges = the sequential ``i -> i+1`` link PLUS every
``skip_to_phase:<slug>`` parsed out of each phase's ``validators[].on_failure``.
The 4 canonical seed shapes lint clean (zero findings).
"""

from __future__ import annotations

from typing import NamedTuple

from app.models.harness import WorkflowDefinition


class LintError(NamedTuple):
    code: str
    phase_slug: str | None
    message: str


def parse_skip_target(on_failure: str) -> str | None:
    """Return the slug after ``skip_to_phase:`` or None for non-skip dispositions.

    ``'skip_to_phase:gather'`` -> ``'gather'``; ``'fail_run'`` / ``'retry'`` -> None.
    """
    prefix = "skip_to_phase:"
    if isinstance(on_failure, str) and on_failure.startswith(prefix):
        target = on_failure[len(prefix):].strip()
        return target or None
    return None


def _skip_targets(phase) -> list[str]:
    """Every skip_to_phase target slug declared on a phase's validators."""
    out: list[str] = []
    for v in phase.validators:
        target = parse_skip_target(v.on_failure)
        if target is not None:
            out.append(target)
    return out


def lint_workflow(definition: WorkflowDefinition) -> list[LintError]:
    """Lint a workflow definition for orphans / dangling skips / missing terminal.

    Pure: returns a list of :class:`LintError` (empty == clean). No I/O.
    """
    errors: list[LintError] = []
    phases = definition.phases
    if not phases:
        errors.append(LintError("no_terminal", None, "definition has no phases"))
        return errors

    # ── BAD_INDEX: unique slugs + contiguous 0..N-1 phase_index ──────────────
    seen_slugs: set[str] = set()
    for p in phases:
        if p.slug in seen_slugs:
            errors.append(
                LintError("bad_index", p.slug, f"duplicate phase slug {p.slug!r}")
            )
        seen_slugs.add(p.slug)

    indices = sorted(p.phase_index for p in phases)
    if indices != list(range(len(phases))):
        errors.append(
            LintError(
                "bad_index",
                None,
                f"phase_index must be contiguous 0..{len(phases) - 1}, got {indices}",
            )
        )

    by_slug = {p.slug: p for p in phases}
    by_index_value = {p.phase_index: p for p in phases}
    min_index = min(p.phase_index for p in phases)
    max_index = max(p.phase_index for p in phases)

    # ── UNSATISFIABLE_SKIP: every skip target slug must exist ────────────────
    for p in phases:
        for target in _skip_targets(p):
            if target not in by_slug:
                errors.append(
                    LintError(
                        "unsatisfiable_skip",
                        p.slug,
                        f"skip_to_phase target {target!r} is not an existing phase",
                    )
                )

    # ── Build the edge set (sequential + valid skip edges) ───────────────────
    # Sequential edges link a phase to the phase whose phase_index is exactly +1.
    # When indices are non-contiguous (a gap), the sequential walk CANNOT bridge
    # the gap → the phase after the gap is genuinely unreachable (an orphan).
    adjacency: dict[str, set[str]] = {p.slug: set() for p in phases}
    for p in phases:
        successor = by_index_value.get(p.phase_index + 1)
        if successor is not None:
            adjacency[p.slug].add(successor.slug)
        for target in _skip_targets(p):
            if target in by_slug:
                adjacency[p.slug].add(target)

    # ── ORPHAN_PHASE: every phase except the entry must be reachable ─────────
    entry = by_index_value[min_index].slug
    reachable: set[str] = set()
    stack = [entry]
    while stack:
        node = stack.pop()
        if node in reachable:
            continue
        reachable.add(node)
        stack.extend(adjacency.get(node, ()))

    for p in sorted(phases, key=lambda q: q.phase_index):
        if p.slug != entry and p.slug not in reachable:
            errors.append(
                LintError("orphan_phase", p.slug, f"phase {p.slug!r} is unreachable")
            )

    # ── NO_TERMINAL: the terminal (highest-index) phase must be reachable ────
    # Completion is reachable iff the final phase is reachable from the entry.
    # A cycle that loops back before the terminal index leaves it unreachable.
    terminal = by_index_value[max_index].slug
    if terminal not in reachable:
        errors.append(
            LintError(
                "no_terminal",
                None,
                "no terminal phase is reachable (cycle never reaches completion)",
            )
        )

    return errors
