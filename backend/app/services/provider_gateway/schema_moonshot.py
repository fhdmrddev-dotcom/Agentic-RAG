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
Provider docs remain silent (RESEARCH A2).
"""
from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)

_DEF_KEYS = ("$defs", "definitions")
#: 302-02 (T-302-05): no external schema expands past this many nested definitions.
_MAX_DEPTH = 8


def _has_ref(node: Any) -> bool:
    if isinstance(node, dict):
        return "$ref" in node or any(_has_ref(v) for v in node.values())
    if isinstance(node, list):
        return any(_has_ref(v) for v in node)
    return False


def inline_refs(schema: dict, *, cut: list[str] | None = None) -> dict:
    """``schema`` with every local ``#/$defs/X`` / ``#/definitions/X`` reference replaced by the
    definition it names, and the defs blocks dropped. Returns ``schema`` itself (same object) when
    it holds no reference and no defs. ~~A true cycle cannot be inlined: ``ValueError`` names it.~~
    CORRECTED at 302-02 (D-25): a re-entered definition, or one reached at ``_MAX_DEPTH`` nested
    definitions, becomes the typed leaf ``{"type": <its type or "object">, "description": <its
    description or its name>}``; each such name is appended to ``cut`` when one is passed.

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

    def walk(node: Any, stack: frozenset) -> Any:
        if isinstance(node, dict):
            ref = node.get("$ref")
            if isinstance(ref, str) and ref.startswith("#/"):
                name = ref.rsplit("/", 1)[-1]
                if name in defs:
                    if name in stack or len(stack) >= _MAX_DEPTH:
                        target = defs[name] if isinstance(defs[name], dict) else {}
                        if cut is not None and name not in cut:
                            cut.append(name)
                        return {"type": target.get("type", "object"),
                                "description": target.get("description") or name}
                    rest = {k: v for k, v in node.items() if k != "$ref"}
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
