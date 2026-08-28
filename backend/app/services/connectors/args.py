"""Phase 214 (STEP-01 / STEP-02 / STEP-03 / D-214-00 / D-214-01 / D-214-03 / D-214-05 /
D-214-06) — argument RESOLUTION and argument SATISFIABILITY, in one home.

── WHY THIS MODULE EXISTS, MECHANICALLY ──────────────────────────────────────────────
The publish gate refuses at save time exactly what the executor resolves at run time. Two
copies of that logic in two files is a guaranteed drift, and the drift's symptom is a
workflow that PUBLISHES AND THEN FAILS AT THE SEND — which is ``BUG-260826-02`` restated.
D-214-00 therefore puts both halves here: ``resolve_arguments`` (the executor's answer) and
``unsatisfiable_arguments`` (the gate's answer) read the same config, the same schema and
the same three source arms, so they cannot disagree about what an argument object contains.

⭐ ── AND WHY THERE IS A SEVENTH EXPORT, WHICH IS NOT TIDINESS ────────────────────────
``resolve_arguments`` and ``unsatisfiable_arguments`` both take ``schema`` as a REQUIRED
argument and both walk the schema's DECLARED ``properties`` — never ``config.tool_args``'
keys. So a **wrong or absent schema yields an empty argument object on the outbound path,
silently.** A paired test handing ONE schema object to both functions proves ``f(s) ==
g(s)``; it can say nothing at all about ``s_gate != s_executor``. ``schema_for_bound_tool``
is therefore the ONE place a bound step's ``inputSchema`` is obtained, for BOTH shapes and
for all three callers (the executor, the publish gate's ``tool_schemas`` builder, and the
approval pause). ⛔ No caller may read ``discovered_tools`` or ``INPUT_SCHEMA`` for itself.

── THE HONEST LEAF INVARIANT, AT ITS FULL STRENGTH ───────────────────────────────────
This module is a STRICT LEAF, exactly as ``grants.py`` is, and the rule is the strong one
rather than the narrow one: it MUST NEVER import anything under ``app.services.harness`` —
not ``phase_types``, not ``harness_engine``, not ``grounding``, not ``publish_service``. It
MAY import ``connectors/`` siblings (``descriptors``, ``protocol``, ``registry``), and the
one such import is DEFERRED inside the function that needs it, the shape ``descriptors.py``
already uses. ``tests/unit/test_214_args_leaf.py`` asserts the invariant by AST rather than
trusting this paragraph.

⚠ Keep this module IMPORT-LIGHT — no I/O, no engine import, no network — for the same
stated reason ``reachability.py`` gives for itself: ``/workflows/validate`` imports
``lint_workflow`` import-light, and the publish gate puts this module on that path.

── ⚠ WHAT DELIBERATELY DID **NOT** MOVE HERE ─────────────────────────────────────────
The capability→body-field map in ``phase_types.py`` (the closed two-column lookup that says
where an upstream phase's text goes) and its three-way module-scope ``assert`` STAY THERE.
That assert closes over ``_PRE_CREDENTIAL_DESTINATION`` and ``EXTERNAL_ACTION_CAPABILITIES``,
both harness-side, so moving the map would either break this module's leaf invariant or break
the assert. The body argument arrives here as the ``body_arg`` parameter, per call.
**Do not "tidy" the map in.**

⚠ The map's IDENTIFIER is deliberately not spelled anywhere in this file, and a fence in
``test_214_args_leaf.py`` asserts that absence — a grep for the name is how a reviewer proves
in one step that the map did not move, and a fence that greps for a literal cannot be
described using that literal (the same choice ``phase_types.py``'s Gate-2 block records for
the credential-check column). The sentence above is what stops it being tidied in; the fence
is what stops the sentence rotting.

── D-214-02 · NO EXPRESSION LANGUAGE, AND NO SECOND ONE ──────────────────────────────
``arg_sources`` is the declared mechanism for saying where an argument comes from. Nothing
in this module interpolates, templates or evaluates a string, and nothing here may call
``_interpolate_prior_run_variables`` (the PROMPT-TEXT resolver in ``phase_types.py``, which
the ROADMAP's Phase 214 flag warns carries an ``llm_emit`` gap). A ``{{ }}`` resolver on the
argument path would create the second, undeclared mechanism D-214-02 refused.

── D-214-12 · NOTHING RETROACTIVE ────────────────────────────────────────────────────
A config with an EMPTY ``arg_sources`` resolves exactly as ``_adapter_args`` resolved before
this module existed. That property is pinned by characterization cases, not asserted here.
"""
from __future__ import annotations

import logging
from collections.abc import Mapping, Sequence
from typing import AbstractSet, Any, Literal, NamedTuple

logger = logging.getLogger(__name__)

#: D-214-01 — a step's per-argument source is a STORED, VALIDATED enum with three arms,
#: never an inferred one. ``ArgumentSourceSpec`` in ``models/harness.py`` carries it.
ArgumentSourceKind = Literal["fixed", "ask", "upstream"]

#: ⚠ THESE FIVE STRINGS HAVE THREE CONSUMERS AND ONE SPELLING: this predicate, the sketch-215
#: refusal kinds, and plan ``214-05``'s ``LINT_CODES`` additions. Renaming one here without
#: the other two is the drift D-214-00 exists to prevent, one level down.
ArgumentGapKind = Literal[
    "no_source",
    "ask_undeclared",
    "upstream_unreachable",
    "shape_unknown",
    "unrenderable",
]

_LEGAL_SOURCE_KINDS: frozenset[str] = frozenset({"fixed", "ask", "upstream"})

#: D-214-06 — a flat scalar JSON-Schema property is renderable by the argument form. An
#: argument the form cannot render is NAMED by the predicate, never routed to a JSON escape
#: hatch, so this set stays small on purpose: widening it is a UI commitment, not a typo fix.
_SCALAR_TYPES: frozenset[str] = frozenset({"string", "number", "integer", "boolean"})

#: A property carrying any of these is a COMPOSITE the flat form cannot draw. Named
#: explicitly rather than derived from "not a scalar": a schema keyword nobody listed here
#: still has to pass the positive ``type`` test below, so the pair is fail-CLOSED.
_COMPOSITE_KEYS: tuple[str, ...] = ("oneOf", "anyOf", "allOf", "not", "$ref")

__all__ = [
    "ArgumentSourceKind",
    "ArgumentGapKind",
    "ArgumentGap",
    "renderable_property",
    "resolve_arguments",
    "unsatisfiable_arguments",
    "schema_for_bound_tool",
]


class ArgumentGap(NamedTuple):
    """One required argument the step cannot supply, and why.

    ``argument`` is the schema property name, and is ``None`` for exactly ONE kind —
    ``shape_unknown`` — because a step whose tool schema is not knowable has no argument to
    name (sketch 215 invariant #2). ``upstream`` carries the named slug on
    ``upstream_unreachable`` and is ``None`` otherwise.
    """

    kind: ArgumentGapKind
    argument: str | None
    upstream: str | None


# ── dual-shape reads · the ``grants.py:55-62`` idiom ──────────────────────────────────
# ⚠ LOAD-BEARING, NOT LAZINESS. The two callers hold different objects: the executor holds
# a Pydantic ``ExternalActionPhaseConfig``, the publish lint holds phases parsed out of a
# ``WorkflowDefinition``, and a raw JSONB dict reaches both on the legacy path. Typing the
# parameter as ``Any`` and reading it through these helpers is what lets ONE predicate serve
# both — and it is the same reason ``grants.resolve_effective_posture`` takes ``connection:
# Any``.

def _field(obj: Any, name: str) -> Any:
    """Read ``name`` off a Mapping or an object, returning ``None`` when it is absent."""
    if obj is None:
        return None
    if isinstance(obj, Mapping):
        return obj.get(name)
    return getattr(obj, name, None)


def _mapping_field(obj: Any, name: str) -> Mapping[str, Any]:
    """Read ``name`` as a Mapping, or the empty Mapping. Never ``None``, never a list."""
    value = _field(obj, name)
    return value if isinstance(value, Mapping) else {}


def _is_present(value: Any) -> bool:
    """A value that can actually be SENT.

    ``None`` is absent, and a string that is empty or whitespace is absent too — an author
    who cleared a field has not supplied it, and treating ``""`` as supplied is how a step
    passes the gate and then sends an empty subject line.
    """
    if value is None:
        return False
    if isinstance(value, str) and not value.strip():
        return False
    return True


def _source_of(arg_sources: Mapping[str, Any], name: str) -> tuple[str | None, str | None, str | None]:
    """``(source, ask_key, upstream_slug)`` for one property, or ``(None, None, None)``.

    An UNRECOGNISED ``source`` string reads as no entry at all rather than as a fourth arm:
    the model layer refuses one at parse time (``ArgumentSourceSpec``), so a value arriving
    here outside the closed set came from a hand-edited row, and falling back to the stored
    ``tool_args`` is the same fail-closed direction ``grants.py`` takes on an unknown posture.
    """
    spec = arg_sources.get(name) if isinstance(arg_sources, Mapping) else None
    if spec is None:
        return None, None, None
    source = _field(spec, "source")
    if not isinstance(source, str) or source not in _LEGAL_SOURCE_KINDS:
        if source is not None:
            logger.warning(
                "214 D-214-01: unrecognised argument source %r for property %r — reading it "
                "as no source at all",
                source, name,
            )
        return None, None, None
    ask_key = _field(spec, "ask_key")
    upstream_slug = _field(spec, "upstream_slug")
    return (
        source,
        str(ask_key) if isinstance(ask_key, str) and ask_key else None,
        str(upstream_slug) if isinstance(upstream_slug, str) and upstream_slug else None,
    )


def _properties(schema: Any) -> dict[str, Any]:
    """The schema's declared ``properties``, or ``{}`` when the shape is not knowable.

    ⚠ ``{}`` and "not knowable" are the SAME answer on purpose: both mean this module cannot
    say what the tool accepts, and both must produce ``shape_unknown`` at the gate rather
    than a pass. ``resolve_arguments`` returns an empty object for the same input, so the two
    agree — the executor sends nothing where the gate refuses.
    """
    if not isinstance(schema, Mapping):
        return {}
    props = schema.get("properties")
    if not isinstance(props, Mapping):
        return {}
    return {str(key): value for key, value in props.items()}


def renderable_property(prop: Any) -> bool:
    """D-214-06 — can the argument form draw a field for this schema property?

    True for a FLAT SCALAR: ``type`` of ``string`` / ``number`` / ``integer`` / ``boolean``,
    or an ``enum`` whose members are scalars. False for ``object``, ``array``, a ``$ref``,
    any of ``oneOf`` / ``anyOf`` / ``allOf`` / ``not``, and for an absent or unrecognised
    ``type``.

    ⚠ This is the ONE place the answer lives, and the reason it is one place is D-214-06: an
    argument the form cannot render is NAMED by the predicate — the author is told which
    argument and why — never quietly routed to a raw-JSON escape hatch that re-opens every
    surface the adapters' ``additionalProperties: False`` closes.

    ⚠ D-214-05 — NOTHING HERE BRANCHES ON capability-vs-MCP. One predicate over one
    ``inputSchema``; a native adapter's declaration and a discovered tool's declaration are
    the same JSON Schema by the time they reach this function (``descriptors._plain_json``
    emits the native one in the MCP sanitizer's own key order, precisely so).
    """
    if not isinstance(prop, Mapping):
        return False
    for key in _COMPOSITE_KEYS:
        if key in prop:
            return False
    enum = prop.get("enum")
    if enum is not None:
        if not isinstance(enum, (list, tuple)) or not enum:
            return False
        return all(v is None or isinstance(v, (str, int, float, bool)) for v in enum)
    declared_type = prop.get("type")
    return isinstance(declared_type, str) and declared_type in _SCALAR_TYPES


def resolve_arguments(
    *,
    config: Any,
    schema: Any,
    upstream_outputs: Mapping[str, Any],
    run_inputs: Mapping[str, Any],
    body_arg: str | None = None,
) -> dict[str, Any]:
    """Build the argument object to hand an adapter or an MCP tool — STEP-02's half of D-214-00.

    The walk is over the SCHEMA'S DECLARED ``properties``, never over ``config.tool_args``'
    keys. That ordering is the projection rule ``_adapter_args`` has always had and it is
    what keeps run scaffolding — and, worse, a stray credential-shaped key — out of a vendor
    request: an undeclared ``tool_args`` key is DROPPED here, silently as far as the wire is
    concerned, and surfaced to the AUTHOR as a leftover by the editor (D-214-08). It is not
    this function's business to report, and ``unsatisfiable_arguments`` never invents a gap
    for an optional leftover.

    Per declared property, the source is read from ``config.arg_sources[name]``:

      * ``fixed``    → ``config.tool_args[name]``; omitted when absent or empty.
      * ``ask``      → ``run_inputs[spec.ask_key or name]``; omitted when absent.
      * ``upstream`` → ``upstream_outputs[spec.upstream_slug]``; omitted when absent.

    ⚠ **THE NO-ENTRY ARM IS D-214-12 IN ONE BRANCH, AND ITS SECOND HALF IS NOT DECORATIVE.**
    A property with NO ``arg_sources`` entry falls back to ``config.tool_args[name]`` when
    present (the D-214-08 read of pre-existing objects) **and then to ``run_inputs[name]``**.
    That second fallback is what makes the no-retroaction guarantee TRUE rather than merely
    claimed: every workflow published before this phase carries an EMPTY ``tool_args`` on its
    native steps, and the value ``_adapter_args`` projected came from the run-input bag
    (``_external_action_inputs``' merge of ``ctx.inputs`` + the upstream text). A fallback
    that read only ``tool_args`` would return ``{}`` for every one of them — a published
    workflow that silently stops sending, which is exactly the failure D-214-12 forbids. It
    is unfiltered on purpose, so the projection stays byte-identical to the old one.

    ``body_arg`` — the capability's body field, passed in per call because the map that
    holds it stays harness-side (see the header) — fills from a ``content`` value when the
    field is declared and still unfilled, exactly as ``_adapter_args`` does today. Both bags
    are consulted (upstream first) because ``_external_action_inputs`` merges the upstream
    text INTO the run-input bag under that key before the executor ever calls this.
    """
    props = _properties(schema)
    if not props:
        # The gate answers ``shape_unknown`` for this same input. An empty object is the
        # only honest answer here, and the executor must RECORD rather than send it.
        return {}

    arg_sources = _mapping_field(config, "arg_sources")
    tool_args = _mapping_field(config, "tool_args")
    run_inputs = run_inputs if isinstance(run_inputs, Mapping) else {}
    upstream_outputs = upstream_outputs if isinstance(upstream_outputs, Mapping) else {}

    args: dict[str, Any] = {}
    for name in props:
        source, ask_key, upstream_slug = _source_of(arg_sources, name)

        if source == "fixed":
            value = tool_args.get(name)
            if _is_present(value):
                args[name] = value
            continue

        if source == "ask":
            key = ask_key or name
            if key in run_inputs:
                args[name] = run_inputs[key]
            continue

        if source == "upstream":
            if upstream_slug and upstream_slug in upstream_outputs:
                args[name] = upstream_outputs[upstream_slug]
            continue

        # No entry — D-214-08 / D-214-12, both halves. See the docstring.
        if _is_present(tool_args.get(name)):
            args[name] = tool_args[name]
        elif name in run_inputs:
            args[name] = run_inputs[name]

    if body_arg and body_arg in props and body_arg not in args:
        content = upstream_outputs.get("content")
        if not _is_present(content):
            content = run_inputs.get("content")
        if _is_present(content):
            args[body_arg] = content

    return args


def unsatisfiable_arguments(
    *,
    config: Any,
    schema: Any,
    upstream_slugs: Sequence[str],
    declared_input_keys: AbstractSet[str],
    body_arg: str | None = None,
) -> list[ArgumentGap]:
    """Every REQUIRED argument this step cannot supply — STEP-03's half of D-214-00.

    One gap per unsatisfiable required property, in ``schema["required"]`` order so the
    author reads them in the order the vendor declares them. An OPTIONAL property NEVER
    produces a gap, however unsourced or unrenderable it is: refusing a publish over a field
    the tool does not require would refuse workflows that work.

    The five kinds, and the exact condition for each:

      * ``shape_unknown``        — the schema is ``None`` or declares no ``properties``. ONE
        gap, with ``argument=None``: there is no argument to name (sketch 215 invariant #2).
      * ``unrenderable``         — ``renderable_property`` is False. The author is told WHICH
        argument, rather than being handed a JSON box (D-214-06).
      * ``ask_undeclared``       — source ``ask`` naming a key the workflow's ``inputs`` do
        not declare. Nothing would ever populate it.
      * ``upstream_unreachable`` — source ``upstream`` naming a slug that is not upstream of
        this step (or naming none at all). ``gap.upstream`` carries the named slug.
      * ``no_source``            — source ``fixed`` with an absent/empty ``tool_args`` value,
        or no entry at all and no non-empty ``tool_args`` value.

    ⚠ ``body_arg`` EXEMPTS THE CAPABILITY'S BODY FIELD FROM ``no_source``, AND ONLY FROM
    THAT. The executor auto-fills that one field from the upstream text when nothing else
    named it (D-214-03 makes the rule visible rather than removing it), so reporting it as
    unsourced would refuse at publish a step the executor can in fact send — the drift of
    D-214-00 pointing the OTHER way, which is the direction that costs an author a working
    workflow. It is exempted from ``no_source`` only: an unrenderable or explicitly
    mis-sourced body field is still a gap.

    ⚠ This function walks the SAME ``properties`` ``resolve_arguments`` walks and reads the
    SAME ``arg_sources``. It must be handed the SAME schema object too — which is what
    ``schema_for_bound_tool`` is for, and why a paired test over one schema is necessary but
    NOT sufficient.
    """
    props = _properties(schema)
    if not props:
        return [ArgumentGap("shape_unknown", None, None)]

    required_raw = schema.get("required") if isinstance(schema, Mapping) else None
    required = [
        str(name) for name in required_raw if str(name) in props
    ] if isinstance(required_raw, (list, tuple)) else []

    arg_sources = _mapping_field(config, "arg_sources")
    tool_args = _mapping_field(config, "tool_args")
    reachable = {str(slug) for slug in (upstream_slugs or ())}
    declared = {str(key) for key in (declared_input_keys or ())}

    gaps: list[ArgumentGap] = []
    for name in required:
        if not renderable_property(props[name]):
            gaps.append(ArgumentGap("unrenderable", name, None))
            continue

        source, ask_key, upstream_slug = _source_of(arg_sources, name)

        if source == "ask":
            key = ask_key or name
            if key not in declared:
                gaps.append(ArgumentGap("ask_undeclared", name, None))
            continue

        if source == "upstream":
            if not upstream_slug or upstream_slug not in reachable:
                gaps.append(ArgumentGap("upstream_unreachable", name, upstream_slug))
            continue

        if source == "fixed":
            if not _is_present(tool_args.get(name)):
                gaps.append(ArgumentGap("no_source", name, None))
            continue

        # No entry at all.
        if body_arg and name == body_arg:
            continue
        if not _is_present(tool_args.get(name)):
            gaps.append(ArgumentGap("no_source", name, None))

    return gaps


def schema_for_bound_tool(
    *,
    capability: str | None,
    tool_name: str | None,
    discovered_tools: Any,
) -> dict[str, Any] | None:
    """⭐ The ONE place a bound step's ``inputSchema`` is obtained, for BOTH shapes.

    ⚠ **THE MECHANICAL REASON THIS EXISTS.** ``resolve_arguments`` walks the schema's
    declared ``properties``; hand it the WRONG schema, or ``None``, and it returns an
    **empty argument object on the outbound path, silently** — a workflow that publishes and
    then sends nothing, with no error anywhere. Two functions agreeing on one schema object
    prove ``f(s) == g(s)`` and can never detect ``s_gate != s_executor``. One accessor makes
    the gate's and the executor's provenance IDENTICAL BY CONSTRUCTION rather than by
    assertion (plan ``214-14``'s S-2b asserts it anyway, across the module boundary).

    Its two arms, stated so neither can drift:

      * **native capability** — ``descriptors.descriptor_for(capability)["inputSchema"]``,
        which is ``_plain_json(get_adapter(capability).INPUT_SCHEMA)``. Pure, in-process, no
        I/O. ⚠ An UNREGISTERED capability raises ``KeyError`` there and it is allowed to
        PROPAGATE: the closed set fails CLOSED at a named site, and swallowing it into a
        ``None`` would turn an unimplemented action into an empty argument object — the
        exact silent-empty failure this function exists to make impossible.
      * **MCP** — the entry in ``discovered_tools`` whose ``name`` equals ``tool_name``, read
        from the connection's snapshot. ``None`` when the snapshot is absent, carries no
        matching entry, or the entry carries no ``inputSchema``. The gate turns a ``None``
        into ``shape_unknown``; ⛔ the executor must RECORD, never fall back to sending
        ``tool_args`` raw.

    ⛔ **NO I/O.** The MCP arm is HANDED the ``discovered_tools`` value; it never fetches or
    re-resolves a connection. Callers pass the snapshot GATE 5 already resolved.
    """
    if capability:
        # ⚠ DEFERRED IMPORT — keeps this module import-light for ``/workflows/validate``,
        # and it is the shape ``descriptors.py`` itself uses for ``get_adapter``.
        from app.services.connectors import descriptors

        # DERIVED from the adapter's own declaration via the descriptor — never retyped, and
        # deliberately NOT ``adapter.INPUT_SCHEMA`` even where an adapter is in scope. The
        # two are equal today; reading the attribute directly would silently stop being equal
        # the moment either side gains a transform, which is the whole reason
        # ``descriptors.py`` calls its own derivation "never retyped".
        schema = descriptors.descriptor_for(capability).get("inputSchema")
        return schema if isinstance(schema, dict) else None

    if not tool_name or not isinstance(discovered_tools, (list, tuple)):
        return None

    wanted = str(tool_name)
    for entry in discovered_tools:
        if not isinstance(entry, Mapping):
            continue
        if str(entry.get("name") or "") != wanted:
            continue
        schema = entry.get("inputSchema")
        return dict(schema) if isinstance(schema, Mapping) else None
    return None
