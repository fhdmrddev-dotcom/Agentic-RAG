"""Phase 296-06 (BUG-261024-01) — tool schemas Moonshot will read: local ``$ref``s inlined.

Moonshot refused the workflow-drafting tool with:

    400 — "tools.function.parameters is not a valid moonshot flavored json schema … At path
    'properties.phases.items': detected infinite recursion without termination condition"

``WF_SCHEMA`` is ``WorkflowDefinition.model_json_schema()``: it carries ``$defs`` and puts
``{"$ref": "#/$defs/PhaseSpec"}`` under ``phases.items``. A scan finds no true cycle, so Moonshot's
validator objects to the reference itself.

⚠ PROVIDER DOCS ARE SILENT. Moonshot/Kimi's own tool-calls guide
(platform.kimi.ai/docs/guide/use-kimi-api-to-complete-tool-calls) says only that tool definitions
are JSON Schema with ``type: object``; it documents no ``$ref`` / ``$defs`` / recursion rule. The
live error above is the only primary evidence (RESEARCH F11, assumption A1). Third-party rules
(``type`` on every ``anyOf`` child, no ``null`` type) are NOT applied here (assumption A2, LOW):
each would need its own evidence and its own test.

Pure and provider-local. The ONE caller is ``openai_compat.open_openai_compat_stream``, keyed on
the ENDPOINT provider (282-REVIEW CR-01), so no other provider's request bytes can change. A schema
with no ``$ref`` and no defs comes back as the SAME object, which is what keeps every ref-free chat
tool byte-identical even on a Moonshot endpoint.

~~A true cycle cannot be inlined, so ``inline_refs`` raises ``ValueError`` naming it.~~
CORRECTED at 302-02 (BE-IN-04 / D-25): Moonshot itself 400s on recursion, so a pass-through would
still fail the request and dropping the tool would hide a connector tool the person asked for;
bounded unrolling keeps it usable. A re-entered definition, or one reached at ``_MAX_DEPTH``,
becomes a typed leaf, and ``moonshot_tools`` warns naming only the tool and the definition.
Provider docs remain silent (RESEARCH A2). 302-REVIEW CR-01: the depth cap bounds each path but
not the number of paths, so a global ``_MAX_EXPANSIONS`` budget also applies; once it is spent,
every further reference is cut to a leaf by the same rule.
"""
from __future__ import annotations

import copy
import logging
from typing import Any

logger = logging.getLogger(__name__)

_DEF_KEYS = ("$defs", "definitions")
#: 302-02 (T-302-05): no external schema expands past this many nested definitions.
_MAX_DEPTH = 8
#: 302-REVIEW CR-01: no schema inlines more than this many definitions in TOTAL. The depth cap
#: alone bounds each path, not the number of paths: n mutually-referencing definitions expand once
#: per simple path (~n!/(n-8)!), measured 4,438,883 B for n=8, on the request path, from a
#: connector-supplied schema. With this budget the output is at most _MAX_EXPANSIONS copies of
#: one definition body, so it is linear in the input. WF_SCHEMA needs 16 (measured), so 64 leaves
#: 4x headroom for a large but acyclic connector schema before anything is cut.
_MAX_EXPANSIONS = 64


def _has_ref(node: Any) -> bool:
    if isinstance(node, dict):
        return "$ref" in node or any(_has_ref(v) for v in node.values())
    if isinstance(node, list):
        return any(_has_ref(v) for v in node)
    return False


def _leaf(target: dict, name: str) -> dict:
    """The leaf a cut definition becomes (302-REVIEW WR-02).

    It keeps the definition's own ``type``, ``enum`` and ``const`` (scalars and scalar lists, so
    they cannot re-introduce a reference) and its ``description`` (else its name). When the
    definition has no ``type`` — a pure ``anyOf`` / ``oneOf``, an alias, or an ``enum`` — NO type
    is invented: the leaf is untyped. That is the smallest faithful choice. Inventing ``"object"``
    told the model to send an object where the connector expected, say, a string; keeping a
    combinator would mean walking its branches, which is the expansion being cut. Moonshot's docs
    state only that the parameters are JSON Schema with a top-level ``type: object`` (RESEARCH F11),
    which a leaf never is, and the third-party "type on every node" rule is deliberately not
    applied (assumption A2), so an untyped leaf carries no new evidence-free assumption.
    """
    leaf: dict = {}
    for key in ("type", "enum", "const"):
        if key in target:
            leaf[key] = copy.deepcopy(target[key])
    leaf["description"] = target.get("description") or name
    return leaf


def inline_refs(schema: dict, *, cut: list[str] | None = None) -> dict:
    """``schema`` with every local ``#/$defs/X`` / ``#/definitions/X`` reference replaced by the
    definition it names, and the defs blocks dropped. Returns ``schema`` itself (same object) when
    it holds no reference and no defs. ~~A true cycle cannot be inlined: ``ValueError`` names it.~~
    CORRECTED at 302-02 (D-25): a re-entered definition, one reached at ``_MAX_DEPTH`` nested
    definitions, or (302-REVIEW CR-01) any reference met after ``_MAX_EXPANSIONS`` definitions have
    been inlined in total, becomes ~~the typed leaf ``{"type": <its type or "object">,
    "description": <its description or its name>}``~~ (302-REVIEW WR-02) the leaf ``_leaf`` builds:
    its own ``type`` / ``enum`` / ``const`` only, never an invented ``"object"``, plus its
    description or name, with the keys beside the ``$ref`` merged in; each such name is appended to
    ``cut`` when one is passed.

    Keys beside a ``$ref`` (a ``description``, a ``default``) are kept on the inlined node.
    Never mutates its argument.
    """
    if not isinstance(schema, dict):
        return schema
    defs: dict = {}
    for key in _DEF_KEYS:
        block = schema.get(key)
        if isinstance(block, dict):
            defs.update(block)
    if not defs and not _has_ref(schema):
        return schema

    budget = [_MAX_EXPANSIONS]

    def walk(node: Any, stack: frozenset) -> Any:
        if isinstance(node, dict):
            ref = node.get("$ref")
            if isinstance(ref, str) and ref.startswith("#/"):
                name = ref.rsplit("/", 1)[-1]
                if name in defs:
                    rest = {k: v for k, v in node.items() if k != "$ref"}
                    if name in stack or len(stack) >= _MAX_DEPTH or budget[0] <= 0:
                        target = defs[name] if isinstance(defs[name], dict) else {}
                        if cut is not None and name not in cut:
                            cut.append(name)
                        # Keys beside the ``$ref`` are merged in, as the expanded arm does.
                        return {**_leaf(target, name), **walk(rest, stack)}
                    budget[0] -= 1
                    return {**walk(defs[name], stack | {name}), **walk(rest, stack)}
            return {k: walk(v, stack) for k, v in node.items() if k not in _DEF_KEYS}
        if isinstance(node, list):
            return [walk(v, stack) for v in node]
        return node

    return walk(schema, frozenset())


def moonshot_tools(tools: list[dict] | None) -> list[dict] | None:
    """OpenAI-format ``tools`` with each ``function.parameters`` run through ``inline_refs``.

    A tool that needs nothing is returned as the same object, and when no tool changes the SAME
    list comes back, so a ref-free request is byte-identical. ``None`` (no override) stays
    ``None``.
    """
    if not tools:
        return tools
    out: list[dict] = []
    changed = False
    for tool in tools:
        fn = tool.get("function") if isinstance(tool, dict) else None
        params = fn.get("parameters") if isinstance(fn, dict) else None
        cut: list[str] = []
        inlined = inline_refs(params, cut=cut) if isinstance(params, dict) else params
        if cut:
            # T-302-06: the tool's name and the cut definition names only, never the schema.
            logger.warning(
                "moonshot_tools: tool %r has a recursive or too-deep schema; unrolled to a "
                "bounded depth at %s",
                fn.get("name"), ", ".join(sorted(cut)),
            )
        if inlined is params:
            out.append(tool)
            continue
        changed = True
        out.append({**tool, "function": {**fn, "parameters": inlined}})
    return out if changed else tools
