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
  - INPUT_UNSATISFIED  : a phase whose ``config.input_keys`` reads a key that no
                         upstream phase produces and is not a known run input
                         (D-10 / T-093-DOS — strands the run at runtime).
  - the FIVE ARGUMENT-GAP codes (Phase 214 / STEP-03 / D-214-09 / D-214-10):
    ``no_source`` / ``ask_undeclared`` / ``upstream_unreachable`` / ``shape_unknown`` /
    ``unrenderable`` — a required argument of an ``external_action`` step that NOTHING
    can supply. See ``_check_external_action_arguments``.

The graph: nodes = phases; edges = the sequential ``i -> i+1`` link PLUS every
``skip_to_phase:<slug>`` parsed out of each phase's ``validators[].on_failure``.
The 4 canonical seed shapes lint clean (zero findings).

── PHASE 214 · WHERE AN ``inputSchema`` COMES FROM, WITHOUT BREAKING PURITY ───────────
This module is PURE and ``/workflows/validate`` imports ``lint_workflow`` import-light on
every canvas edit, so it may not perform a connection read. The two shapes therefore differ,
and the difference is the whole design:

  * a NATIVE capability step's schema is a PURE in-process lookup
    (``args.schema_for_bound_tool`` -> ``descriptors.descriptor_for``), so it is obtained
    HERE and every caller gets the same answer;
  * an MCP step's schema lives on the connection's discovered-tool snapshot, which is I/O.
    It arrives through the caller-supplied ``tool_schemas`` map
    (``{connection_id: {tool_name: inputSchema}}``) that ``publish_service`` builds — through
    the SAME ``schema_for_bound_tool`` accessor the executor uses, so the gate's schema and
    the executor's schema are identical BY CONSTRUCTION rather than by assertion (D-214-00).

⚠ WITHIN A SUPPLIED MAP, A MISSING ENTRY IS ``shape_unknown`` AND NEVER A PASS — *"unknown"
and "satisfied" must not look the same* (D-214-10). ``tool_schemas=None`` is a DIFFERENT
fact: it means the caller never looked. A caller that cannot resolve connections is not
entitled to conclude "unknown", so the MCP arm is skipped for it — which is exactly this
module's shipped division of labour, stated in ``publish_service``'s own docblock:
``POST /workflows/validate`` is the live ADVISORY surface, PUBLISH is the ENFORCING gate.
⛔ The publish gate ALWAYS supplies a map (never ``None``); an empty map there means "we
looked and found nothing", which blocks.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any, NamedTuple

from app.models.harness import WorkflowDefinition

# Phase 214 (D-214-00) — the ONE predicate the executor also resolves with, and the ONE
# schema accessor both sides obtain their ``inputSchema`` from. A second copy of either here
# is the drift that publishes a workflow which then fails at the send. ``args`` is a STRICT
# LEAF whose only module-scope imports are stdlib, so this import keeps ``lint_workflow``
# import-light for ``/validate`` (the purity claim on ``LINT_CODES`` below).
from app.services.connectors.args import schema_for_bound_tool, unsatisfiable_arguments


class LintError(NamedTuple):
    code: str
    phase_slug: str | None
    message: str
    # ── Phase 214 (STEP-03) — the three facts a STEP-03 refusal is composed FROM ────────
    # ⚠ THE BACKEND DOES NOT COMPOSE THE ENGLISH SENTENCE. D-213-15/-16 put the refusal in
    # this gate; sketch 215 §1 puts the WORDS in ``publishRefusalVocabulary.ts`` and asserts
    # them for character identity. So the wire carries KIND + STEP NAME + ARGUMENT NAME and
    # the client composes. ``message`` stays what it has always been — the diagnostic for the
    # log and the audit receipt, not the author's screen.
    #
    # ``step_name`` is the phase's AUTHORED name and is deliberately RAW here: the length
    # clamp and the non-printing scrub belong to the surface that persists it
    # (``publish_service._clean_label`` / ``_LABEL_MAX_CHARS``), which is where they already
    # live for the interactive-phase refusal. Defaulted to ``None`` so every existing
    # three-positional ``LintError(...)`` call site is untouched.
    step_name: str | None = None
    argument: str | None = None
    upstream: str | None = None


# ── the CANONICAL set of codes this module can emit (Phase 182 / VALID-01 / WR-05) ──
#
# Declared beside the type that CARRIES them. Published so downstream classifiers DERIVE
# the vocabulary instead of re-declaring the literals: ``api/workflows.py``'s
# ``POST /workflows/validate`` severity classifier composes its known-code set from THIS
# frozenset plus the grounding module's, so a code can never exist here and be unknown
# there by accident. Before the WR-05 gap closure that route held its own hardcoded copy
# of these strings and silently mis-classified anything it did not recognise.
#
# ADDING A CODE: a new ``LintError(...)`` code MUST be added to this set in the SAME
# commit. ``tests/unit/test_182_severity_codes.py`` scans this file's ``LintError(`` emit
# sites and fails when the two fall out of sync — the pairing is ENFORCED, not a
# convention, because a failures-only test differential cannot see a code that was added
# but never classified.
#
# A plain set of strings: this module stays PURE (no I/O, no engine import), which is
# exactly what lets ``/validate`` import ``lint_workflow`` import-light (Pitfall 1).
#
# ── Phase 214 (STEP-03) — the argument-gap vocabulary ─────────────────────────────────
#
# ⚠ THESE FIVE STRINGS HAVE THREE HOMES AND ONE SPELLING: ``args.ArgumentGapKind`` (the
# predicate that MINTS them), this set (the lint codes that CARRY them), and
# ``publishRefusalVocabulary.ts``'s ``ArgumentGapKind`` union (the words the client composes
# from them). They are DERIVED from the predicate's own kinds below rather than re-typed, so
# there is no fourth copy to drift.
ARGUMENT_GAP_CODES: frozenset[str] = frozenset(
    {
        "no_source",
        "ask_undeclared",
        "upstream_unreachable",
        "shape_unknown",
        "unrenderable",
    }
)

# ⚠ PHASE 214 — THE SCANNER HAS TWO ROUTES TO COVER NOW, AND THE SECOND ONE IS INVISIBLE TO
# IT. ``test_182_severity_codes.py``'s regex requires the code to be a STRING LITERAL in the
# ``LintError(`` call, so it cannot see STEP-03's five, which are emitted as
# ``LintError(gap.kind, ...)`` from the closed ``ARGUMENT_GAP_CODES`` vocabulary the
# argument predicate mints. Measured on the commit that added them: the scan returned the
# five ORIGINAL codes and the detector was GREEN while ten were reachable. That test now
# asserts ``scanned | ARGUMENT_GAP_CODES == LINT_CODES``, so BOTH routes are covered and a
# sixth code added by either still fails there. Do not re-type the five as literals to
# "help the scanner" — that would be the second copy D-214-00 exists to prevent.
LINT_CODES: frozenset[str] = frozenset(
    {
        "bad_index",
        "input_unsatisfied",
        "no_terminal",
        "orphan_phase",
        "unsatisfiable_skip",
    }
) | ARGUMENT_GAP_CODES


# D-10 (093): keys create_workflow_run stores on workflow_runs.inputs (threads.py:1233
# wf_ctx.inputs={"kickoff_prompt": ...}; the legacy seed key "topic" stays accepted).
#
# ⛔ PHASE 214 · THIS ALLOWLIST IS NOT WIDENED, AND THAT IS THE POINT (CONTEXT failure mode
# #10). An adapter's required arguments are NOT ``input_keys``, so widening this set would
# make the new gate pass by LOOSENING — the exact opposite of STEP-03. The argument check
# consults ``WorkflowDefinition.inputs[]`` instead, a different surface entirely, and this
# allowlist keeps its own narrower job.
_KNOWN_RUN_INPUT_KEYS = frozenset({"kickoff_prompt", "topic"})


#: ⚠ A SECOND SPELLING OF ``phase_types._BODY_ARG_FOR_CAPABILITY``, AND THE AGREEMENT IS
#: MECHANICAL RATHER THAN REMEMBERED — ``test_214_publish_arg_gate.py`` asserts the two maps
#: are equal, the same mechanism ``models/harness.py`` records for ``ArgumentSourceKind`` and
#: for the capability ``Literal``.
#:
#: It cannot simply be imported: that map sits beside a module-scope ``assert`` closing over
#: ``_PRE_CREDENTIAL_DESTINATION`` and ``EXTERNAL_ACTION_CAPABILITIES``, so it stays
#: harness-engine-side (``args.py``'s header records the same refusal to "tidy it in") — and
#: importing ``phase_types`` from here would pull the whole engine onto ``/validate``'s
#: per-keystroke path, destroying the import-lightness ``LINT_CODES``' docblock depends on.
#:
#: WHY THE EXEMPTION EXISTS AT ALL: the executor AUTO-FILLS this one field from the upstream
#: text when nothing else named it, so reporting it as unsourced would refuse at publish a
#: step that can in fact send — D-214-00's drift pointing the direction that costs an author
#: a working workflow. It exempts from ``no_source`` ONLY; an unrenderable or explicitly
#: mis-sourced body field is still a gap (``args.unsatisfiable_arguments`` owns that rule).
_BODY_ARGUMENT_FOR_CAPABILITY: dict[str, str] = {
    "send_email": "body",
    "create_ticket": "description",
    "post_message": "text",
}


def _gap_message(gap, *, step: str, slug: str | None) -> str:
    """The DIAGNOSTIC line for the log and the ``harness_audit`` receipt — never the copy.

    Sketch 215 §1 owns the author-facing sentence and asserts it for character identity in
    ``publishRefusalVocabulary.test.ts``; composing an English refusal here would create a
    second, unasserted copy of it. This string exists so an operator reading
    ``harness_audit.metadata.named_failures`` months later can tell what happened.
    """
    where = f"step {step!r}" if step else f"phase {slug!r}"
    if gap.kind == "shape_unknown":
        return (
            f"{where}: the bound action's argument shape is not knowable, so publish cannot "
            "tell which arguments it requires"
        )
    if gap.kind == "ask_undeclared":
        return (
            f"{where}: the required argument {gap.argument!r} is asked for at launch, but the "
            "workflow declares no matching input"
        )
    if gap.kind == "upstream_unreachable":
        return (
            f"{where}: the required argument {gap.argument!r} is taken from "
            f"{gap.upstream!r}, which does not run before it"
        )
    if gap.kind == "unrenderable":
        return (
            f"{where}: the required argument {gap.argument!r} has a shape the argument form "
            "cannot fill in"
        )
    return f"{where}: nothing supplies the required argument {gap.argument!r}"


def _check_external_action_arguments(
    phase,
    produced_slugs: set[str],
    definition,
    tool_schemas: Mapping[str, Any] | None,
) -> list[LintError]:
    """STEP-03 — every REQUIRED argument of ONE ``external_action`` step that nothing supplies.

    ⚠ PER-PHASE, NOT PER-DEFINITION, AND DELIBERATELY SO. D-214-09's *"From an earlier step"*
    arm is the predicate ``_check_input_contracts``' ``produced`` accumulator ALREADY computes
    — a slug is upstream iff it is in that set at the moment this phase is visited — so this
    function is called from INSIDE that one ordered walk and is handed the accumulator's
    current value. Writing it over ``phases`` would have meant a SECOND ordered walk and a
    second, drifting definition of "upstream".

    ⚠ ``produced_slugs`` IS PHASE SLUGS ONLY, not ``_check_input_contracts``' wider ``produced``
    (which also carries declared ``output_keys``). ``arg_sources.upstream_slug`` names a PHASE,
    and ``resolve_arguments`` reads ``accumulated_outputs[slug]`` — keyed by phase slug and by
    nothing else. Accepting an ``output_key`` here would let the gate pass a reference the
    executor then cannot resolve, which is D-214-00's drift in miniature.

    The gaps themselves come from ``args.unsatisfiable_arguments`` — the SAME predicate
    ``resolve_arguments`` is the other half of. There is no second copy here; this function
    only decides WHICH schema the step is bound to and turns each gap into a ``LintError``.
    """
    config = getattr(phase, "config", None)
    if getattr(config, "phase_type", None) != "external_action":
        return []

    capability = getattr(config, "capability", None)
    tool_name = getattr(config, "tool_name", None)

    if tool_name:
        # ── the MCP shape — the schema is I/O-derived, so only a caller can supply it ──
        if tool_schemas is None:
            # The caller never looked. See the module docblock: "not asked" and "unknown" are
            # different facts, and only the ENFORCING gate is entitled to conclude the second.
            return []
        per_connection = tool_schemas.get(str(getattr(config, "connection_id", None) or ""))
        snapshot = per_connection if isinstance(per_connection, Mapping) else {}
        schema = snapshot.get(tool_name)
        body_arg = None
    elif capability:
        # ── the NATIVE shape — PURE, in-process, through the ONE accessor ──────────────
        # ⚠ Deliberately NOT ``get_adapter(capability).INPUT_SCHEMA``: the accessor derives
        # from the descriptor, which is what the EXECUTOR passes too (phase_types GATE 7), so
        # the two provenances are identical by construction. An UNREGISTERED capability
        # raises out of the accessor by design and is unreachable here — the model layer's
        # closed ``Literal`` has already refused one at parse time.
        schema = schema_for_bound_tool(
            capability=capability, tool_name=None, discovered_tools=None
        )
        body_arg = _BODY_ARGUMENT_FOR_CAPABILITY.get(capability)
    else:
        # Names NEITHER — ``available_tools`` derives to the EMPTY list, so this step
        # whitelists nothing and there is no bound action whose arguments could be checked.
        return []

    declared_input_keys = {
        str(getattr(f, "key", "") or "")
        for f in (getattr(definition, "inputs", None) or [])
    }
    step_name = getattr(phase, "name", None)
    slug = getattr(phase, "slug", None)

    return [
        LintError(
            gap.kind,
            slug,
            _gap_message(gap, step=str(step_name or ""), slug=slug),
            # ⚠ THE AUTHORED NAME, AND THE SLUG ONLY WHEN THERE IS NO NAME. Sketch 215 #1
            # asserts BOTH halves — the refusal names the step in the author's own words AND
            # the slug is absent. The one case where the two coincide is a phase with no
            # authored name at all; saying so here stops the next reader reading that
            # coincidence as the invariant being broken.
            step_name=str(step_name) if step_name else slug,
            argument=gap.argument,
            upstream=gap.upstream,
        )
        for gap in unsatisfiable_arguments(
            config=config,
            schema=schema,
            upstream_slugs=sorted(produced_slugs),
            declared_input_keys=declared_input_keys,
            body_arg=body_arg,
        )
    ]


def _check_input_contracts(
    phases,
    *,
    definition=None,
    tool_schemas: Mapping[str, Any] | None = None,
) -> list[LintError]:
    """THE ONE ORDERED WALK — D-10's input contracts AND STEP-03's argument satisfiability.

    D-10 INPUT_UNSATISFIED: a phase's input_keys must be satisfiable by an
    upstream phase output (its slug, or a declared output_key) OR a known run input.
    Mirrors the executor's resolution (accumulated_outputs key OR run_inputs key).

    ⚠ Phase 214 folds the external-action argument check into THIS walk rather than adding a
    second one, because both checks need the same fact in the same order: what has been
    produced by the time a phase is visited. Two walks would be two definitions of "upstream".
    """
    errors: list[LintError] = []
    produced: set[str] = set()
    produced_slugs: set[str] = set()
    for p in sorted(phases, key=lambda q: q.phase_index):
        input_keys = list(getattr(p.config, "input_keys", []) or [])
        for k in input_keys:
            if k not in produced and k not in _KNOWN_RUN_INPUT_KEYS:
                errors.append(LintError(
                    "input_unsatisfied", p.slug,
                    f"input_key {k!r} is never produced by an upstream phase or a run input",
                ))
        errors.extend(
            _check_external_action_arguments(p, produced_slugs, definition, tool_schemas)
        )
        produced.add(p.slug)
        produced_slugs.add(p.slug)
        produced.update(getattr(p.config, "output_keys", []) or [])
    return errors


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


def lint_workflow(
    definition: WorkflowDefinition,
    *,
    tool_schemas: Mapping[str, Any] | None = None,
) -> list[LintError]:
    """Lint a workflow definition for orphans / dangling skips / missing terminal.

    Pure: returns a list of :class:`LintError` (empty == clean). No I/O.

    ``tool_schemas`` (Phase 214 / STEP-03) is the caller-supplied
    ``{connection_id: {tool_name: inputSchema}}`` map for MCP-shaped ``external_action``
    steps — the ONE fact this pure module cannot obtain for itself. Keyword-only and
    defaulted, so every shipped call site is byte-unchanged. See the module docblock for
    why ``None`` (the caller never looked) is a different answer from ``{}`` (we looked and
    found nothing, which blocks).
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

    # ── INPUT_UNSATISFIED: a phase reading a never-produced input_key strands ─
    # the run at runtime (D-10, T-093-DOS). Pure check, mirrors the executor's
    # resolution (accumulated_outputs slug/output_key OR a known run input).
    errors.extend(
        _check_input_contracts(phases, definition=definition, tool_schemas=tool_schemas)
    )

    return errors
