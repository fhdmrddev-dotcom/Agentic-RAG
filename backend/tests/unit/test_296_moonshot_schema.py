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
3. a true self-reference is refused with ``ValueError`` naming the definition;
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


def test_a_true_cycle_is_refused_naming_the_definition():
    from app.services.provider_gateway.schema_moonshot import inline_refs

    cyclic = {
        "type": "object",
        "properties": {"root": {"$ref": "#/$defs/Node"}},
        "$defs": {"Node": {"type": "object",
                           "properties": {"child": {"$ref": "#/$defs/Node"}}}},
    }
    with pytest.raises(ValueError, match="Node"):
        inline_refs(cyclic)


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
