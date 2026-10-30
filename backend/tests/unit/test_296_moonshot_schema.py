"""Phase 296-06 (BUG-261024-01) — Moonshot reads our tool schemas once their ``$ref``s are inlined.

Moonshot answered the workflow-drafting tool with ``400 tools.function.parameters is not a valid
moonshot flavored json schema … At path 'properties.phases.items': detected infinite recursion
without termination condition``. ``WF_SCHEMA`` (``WorkflowDefinition.model_json_schema()``) carries
``$defs`` and ``{"$ref": "#/$defs/PhaseSpec"}`` under ``phases.items``; no true cycle exists, so the
validator objects to the reference itself. Moonshot's own tool-calls guide documents no ``$ref``
rule (RESEARCH F11, assumption A1), and the live Moonshot row is blocked (account suspended,
D-21), so these unit tests are the proof:

1. ``inline_refs`` leaves no ``$ref`` / ``$defs`` / ``definitions`` anywhere;
2. ``jsonschema`` gives the SAME verdicts on valid and invalid definitions before and after;
3. ~~a true self-reference is refused with ``ValueError`` naming the definition;~~
   CORRECTED at 302-02 (BE-IN-04 / D-25): a true cycle (self or mutual) and a chain deeper than
   ``_MAX_DEPTH`` are unrolled to a bounded depth ending in a typed leaf, and ``moonshot_tools``
   warns naming the tool and the definition only;
4. every chat tool from ``get_tools()`` (all ref-free) comes back as the SAME object, so no other
   provider's bytes and no Moonshot chat bytes change;
5. the adapter transforms ONLY when the ENDPOINT provider is ``moonshot`` (282-REVIEW CR-01:
   keyed on the endpoint, never the registry vendor); openai / deepseek / zhipu endpoints get
   ``request.tools`` itself.
"""
from __future__ import annotations

import copy
import json
from types import SimpleNamespace
from unittest.mock import patch

import jsonschema
import pytest


def _has_key(node, names) -> bool:
    if isinstance(node, dict):
        return any(k in names for k in node) or any(_has_key(v, names) for v in node.values())
    if isinstance(node, list):
        return any(_has_key(v, names) for v in node)
    return False


def _wf_schema():
    from app.services.workflow_authoring import WF_SCHEMA

    return copy.deepcopy(WF_SCHEMA)


def test_the_workflow_schema_really_carries_refs():
    """Guard the fixture: a vacuous pass would prove nothing."""
    schema = _wf_schema()
    assert _has_key(schema, {"$ref"}) and _has_key(schema, {"$defs"})


def test_inline_refs_leaves_no_ref_or_defs():
    from app.services.provider_gateway.schema_moonshot import inline_refs

    out = inline_refs(_wf_schema())
    assert not _has_key(out, {"$ref", "$defs", "definitions"})
    assert out["properties"]["phases"]["items"].get("type") == "object"


def _definitions():
    from app.models.harness import WorkflowDefinition

    base = {
        "slug": "brief", "version": 1, "name": "Brief",
        "phases": [{"slug": "write", "phase_index": 0,
                    "config": {"phase_type": "llm_single", "prompt": "Write."}}],
    }
    two = dict(base, phases=base["phases"] + [
        {"slug": "check", "phase_index": 1,
         "config": {"phase_type": "llm_agent", "prompt": "Check.", "available_tools": []}},
    ])
    inputs = dict(base, inputs=[{"key": "topic", "label": "Topic", "type": "text"}])
    valid = [WorkflowDefinition.model_validate(d).model_dump(mode="json") for d in (base, two, inputs)]
    invalid = [
        dict(valid[0], phases="not a list"),
        dict(valid[0], version="one"),
        dict(valid[0], phases=[{"phase_index": 0}]),
    ]
    return valid, invalid


def _verdict(schema, instance) -> bool:
    try:
        jsonschema.validate(instance, schema)
        return True
    except jsonschema.ValidationError:
        return False


def test_validation_verdicts_are_the_same_before_and_after_inlining():
    from app.services.provider_gateway.schema_moonshot import inline_refs

    schema = _wf_schema()
    inlined = inline_refs(copy.deepcopy(schema))
    valid, invalid = _definitions()
    before = [_verdict(schema, d) for d in valid + invalid]
    after = [_verdict(inlined, d) for d in valid + invalid]
    assert before == after
    assert before[: len(valid)] == [True] * len(valid)
    assert before[len(valid):] == [False] * len(invalid)


def _refs_anywhere(node) -> bool:
    if isinstance(node, dict):
        return any(k in node for k in ("$ref", "$defs", "definitions")) or any(
            _refs_anywhere(v) for v in node.values())
    if isinstance(node, list):
        return any(_refs_anywhere(v) for v in node)
    return False


# 302-02 (BE-IN-04 / D-25): this case used to be ``pytest.raises(ValueError, match="Node")``.
# Moonshot itself 400s on recursion, so refusing still failed the whole request; a true cycle is
# now unrolled to a bounded depth ending in a typed leaf.
NODE = {
    "type": "object",
    "properties": {"root": {"$ref": "#/$defs/Node"}},
    "$defs": {"Node": {"type": "object", "description": "A tree node.",
                       "properties": {"children": {"type": "array",
                                                   "items": {"$ref": "#/$defs/Node"}}}}},
}


def test_a_true_cycle_is_unrolled_to_a_typed_leaf():
    from app.services.provider_gateway.schema_moonshot import inline_refs

    cut: list[str] = []
    out = inline_refs(NODE, cut=cut)
    assert not _refs_anywhere(out)
    leaf = out["properties"]["root"]["properties"]["children"]["items"]
    assert leaf == {"type": "object", "description": "A tree node."}
    assert cut == ["Node"]


def test_a_mutual_cycle_terminates_with_a_typed_leaf():
    from app.services.provider_gateway.schema_moonshot import inline_refs

    mutual = {
        "type": "object",
        "properties": {"a": {"$ref": "#/$defs/A"}},
        "$defs": {"A": {"type": "object", "properties": {"b": {"$ref": "#/$defs/B"}}},
                  "B": {"type": "object", "properties": {"a": {"$ref": "#/$defs/A"}}}},
    }
    out = inline_refs(mutual)
    assert not _refs_anywhere(out)
    assert out["properties"]["a"]["properties"]["b"]["properties"]["a"] == {
        "type": "object", "description": "A"}


def test_a_deep_chain_beyond_the_cap_ends_in_a_typed_leaf():
    from app.services.provider_gateway import schema_moonshot

    n = schema_moonshot._MAX_DEPTH + 4
    defs = {f"D{i}": {"type": "object", "properties": {"next": {"$ref": f"#/$defs/D{i + 1}"}}}
            for i in range(n)}
    defs[f"D{n}"] = {"type": "string"}
    out = schema_moonshot.inline_refs(
        {"type": "object", "properties": {"x": {"$ref": "#/$defs/D0"}}, "$defs": defs})
    assert not _refs_anywhere(out)
    node, depth = out["properties"]["x"], 0
    while "properties" in node:
        node, depth = node["properties"]["next"], depth + 1
    assert depth <= schema_moonshot._MAX_DEPTH
    assert node.get("type") == "object" and "description" in node


def _fan_out(n: int) -> dict:
    """``n`` definitions, each referencing every other one — the AST/GraphQL shape."""
    defs = {
        f"N{i}": {"type": "object",
                  "properties": {f"p{j}": {"$ref": f"#/$defs/N{j}"} for j in range(n) if j != i}}
        for i in range(n)
    }
    return {"type": "object", "properties": {"root": {"$ref": "#/$defs/N0"}}, "$defs": defs}


# 302-REVIEW CR-01: the depth cap alone let output grow ~n!/(n-8)! (8 mutual defs measured
# 4,438,883 B). A global expansion budget keeps every schema's output bounded.
@pytest.mark.parametrize("n", [8, 12])
def test_a_wide_mutual_fan_out_stays_bounded(n):
    import time

    from app.services.provider_gateway.schema_moonshot import inline_refs

    from app.services.provider_gateway.schema_moonshot import _MAX_EXPANSIONS

    schema = _fan_out(n)
    cut: list[str] = []
    started = time.perf_counter()
    out = inline_refs(schema, cut=cut)
    elapsed = time.perf_counter() - started
    assert not _refs_anywhere(out)
    size = len(json.dumps(out))
    assert size < 64 * 1024
    # Linear in the input: at most one definition body per expansion, never a path product.
    assert size <= (_MAX_EXPANSIONS + 1) * len(json.dumps(schema))
    assert elapsed < 1.0
    assert cut, "a cut must be recorded so moonshot_tools warns"


def test_the_workflow_schema_fits_inside_the_expansion_budget():
    """The budget must never cut the schema we ship ourselves (16 expansions measured)."""
    from app.services.provider_gateway.schema_moonshot import inline_refs

    cut: list[str] = []
    inline_refs(_wf_schema(), cut=cut)
    assert cut == []


def test_moonshot_tools_keeps_a_recursive_tool_and_warns_without_the_schema(caplog):
    import logging

    from app.services.provider_gateway.schema_moonshot import moonshot_tools

    rec = {"type": "function", "function": {"name": "tree_tool", "parameters": NODE}}
    plain = {"type": "function", "function": {"name": "plain", "parameters": {
        "type": "object", "properties": {"q": {"type": "string"}}}}}
    with caplog.at_level(logging.WARNING):
        out = moonshot_tools([rec, plain])
    assert out[1] is plain
    assert not _refs_anywhere(out[0]["function"]["parameters"])
    warned = [r.getMessage() for r in caplog.records if r.levelno == logging.WARNING]
    assert len(warned) == 1
    assert "tree_tool" in warned[0] and "Node" in warned[0]
    assert "A tree node." not in warned[0] and "children" not in warned[0]


def test_a_ref_free_schema_is_returned_as_the_same_object():
    from app.services.provider_gateway.schema_moonshot import inline_refs

    plain = {"type": "object", "properties": {"q": {"type": "string"}}, "required": ["q"]}
    assert inline_refs(plain) is plain


def test_every_chat_tool_comes_back_unchanged():
    from app.services.openai_service import get_tools
    from app.services.provider_gateway.schema_moonshot import moonshot_tools

    tools = get_tools()
    assert len(tools) >= 10
    before = json.dumps(tools, sort_keys=True)
    out = moonshot_tools(tools)
    assert out is tools
    assert all(a is b for a, b in zip(out, tools))
    assert json.dumps(out, sort_keys=True) == before


def test_moonshot_tools_inlines_only_the_tool_that_needs_it():
    from app.services.openai_service import get_tools
    from app.services.provider_gateway.schema_moonshot import moonshot_tools
    from app.services.workflow_authoring import EMIT_TOOL

    tools = get_tools()[:2] + [EMIT_TOOL]
    out = moonshot_tools(tools)
    assert out[0] is tools[0] and out[1] is tools[1]
    assert not _has_key(out[2], {"$ref", "$defs", "definitions"})
    assert _has_key(EMIT_TOOL, {"$ref"}), "the shared EMIT_TOOL must never be mutated"
    assert moonshot_tools(None) is None


@pytest.mark.parametrize("endpoint, transformed", [
    ("moonshot", True), ("openai", False), ("deepseek", False), ("zhipu", False),
])
def test_the_adapter_transforms_only_on_a_moonshot_endpoint(endpoint, transformed):
    from app.services.provider_gateway import openai_compat
    from app.services.provider_gateway.dispatcher import GatewayRequest
    from app.services.workflow_authoring import EMIT_TOOL

    tools = [EMIT_TOOL]
    req = GatewayRequest(
        messages=[{"role": "user", "content": "x"}], model="kimi-k2.6",
        # The REGISTRY vendor stays "moonshot" on every row: only the ENDPOINT may decide.
        active_provider_name="moonshot", tools=tools,
        user_settings=SimpleNamespace(active_provider=endpoint),
    )
    seen = {}

    def _fake_create(**kwargs):
        seen.update(kwargs)
        return iter(()), "native"

    with patch.object(openai_compat, "create_adaptive_streaming_chat", _fake_create):
        openai_compat.open_openai_compat_stream(req)
    if transformed:
        assert seen["tools_override"] is not tools
        assert not _has_key(seen["tools_override"], {"$ref", "$defs", "definitions"})
    else:
        assert seen["tools_override"] is tools
