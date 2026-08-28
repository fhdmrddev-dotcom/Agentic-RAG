"""Phase 214 Wave 1 Unit Tests — the argument leaf (`app.services.connectors.args`).

Two parts, the shape `test_213_gate55_execution.py`'s docstring names:

1. The LEAF INVARIANT as an AST assertion — `args.py` imports nothing from `harness/`.
2. Pure unit cases over `renderable_property`, `resolve_arguments`, `unsatisfiable_arguments`
   and `schema_for_bound_tool`, driven from the REAL adapter `INPUT_SCHEMA`s rather than a
   hand-typed fixture, with one case per `ArgumentGapKind`.

Part 3 (added by Task 3) drives the EXECUTOR's own schema provenance and pins legacy
`_adapter_args` behaviour against the post-cut source — the D-214-12 no-retroaction proof.
"""
from __future__ import annotations

import ast
from types import SimpleNamespace

import pytest

from app.services.connectors import args as args_mod
from app.services.connectors.args import (
    ArgumentGap,
    renderable_property,
    resolve_arguments,
    schema_for_bound_tool,
    unsatisfiable_arguments,
)
from app.services.connectors.descriptors import _plain_json, descriptor_for
from app.services.connectors.registry import get_adapter

# The REAL declarations, read once. A hand-typed fixture would pass while the shipped schema
# drifted — which is the class of defect this module exists to make impossible.
SMTP_SCHEMA = _plain_json(get_adapter("send_email").INPUT_SCHEMA)
JIRA_SCHEMA = _plain_json(get_adapter("create_ticket").INPUT_SCHEMA)
SLACK_SCHEMA = _plain_json(get_adapter("post_message").INPUT_SCHEMA)


def _config(*, tool_args=None, arg_sources=None):
    """A config-shaped object. `args.py` reads `Any` through dual-shape helpers on purpose,
    so a namespace here proves the same path the Pydantic model takes."""
    return SimpleNamespace(tool_args=tool_args or {}, arg_sources=arg_sources or {})


# ═══════════════════════════════════════════════════════════════════════════════
# 1. The leaf invariant — asserted by AST, never by comment
# ═══════════════════════════════════════════════════════════════════════════════

def test_leaf_module_invariant_does_not_import_harness():
    """D-214-00: args.py is a strict leaf and must never import phase_types or harness_engine.

    Stated at its FULL strength (this module CAN be a true leaf, as grants.py is): nothing
    under `app.services.harness` at all, not just the two executors.
    """
    with open(args_mod.__file__, "r", encoding="utf-8") as f:
        tree = ast.parse(f.read())

    imported_modules = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                imported_modules.add(alias.name)
        elif isinstance(node, ast.ImportFrom) and node.module:
            imported_modules.add(node.module)

    for mod in imported_modules:
        assert "phase_types" not in mod, f"args.py imported phase_types: {mod}"
        assert "harness_engine" not in mod, f"args.py imported harness_engine: {mod}"
        assert "app.services.harness" not in mod, f"args.py imported a harness module: {mod}"


def test_the_module_exports_exactly_seven_names_including_the_schema_accessor():
    """⭐ The SEVENTH export is what makes gate and executor provenance identical.

    Downstream plans 05, 06 and 07 are written against this list; a name added or removed
    here without their knowledge is the drift D-214-00 exists to prevent.
    """
    assert args_mod.__all__ == [
        "ArgumentSourceKind",
        "ArgumentGapKind",
        "ArgumentGap",
        "renderable_property",
        "resolve_arguments",
        "unsatisfiable_arguments",
        "schema_for_bound_tool",
    ]
    assert len(args_mod.__all__) == 7
    for name in args_mod.__all__:
        assert hasattr(args_mod, name), f"__all__ names {name!r} but the module has no such attribute"


def test_the_body_argument_map_did_not_move_here():
    """The capability→body-field map STAYS in phase_types.py — its three-way module-scope
    assert closes over two harness-side names, so moving it breaks either the assert or the
    leaf. Proved by the ABSENCE of its identifier in this file, which is why args.py's own
    header describes the map without spelling its name."""
    with open(args_mod.__file__, "r", encoding="utf-8") as f:
        source = f.read()
    assert "_BODY_ARG" + "_FOR_CAPABILITY" not in source

    # positive control: the identifier IS where it belongs, so the fence above is measuring
    # an absence rather than a spelling that no longer exists anywhere.
    from app.services.harness import phase_types
    with open(phase_types.__file__, "r", encoding="utf-8") as f:
        assert "_BODY_ARG" + "_FOR_CAPABILITY" in f.read()


# ═══════════════════════════════════════════════════════════════════════════════
# 2. `renderable_property` — D-214-06, the ONE place the answer lives
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.mark.parametrize("schema", [SMTP_SCHEMA, JIRA_SCHEMA, SLACK_SCHEMA])
def test_every_shipped_adapter_property_is_renderable(schema):
    """The three shipped capabilities declare flat scalars only (the "thin three"/"thin two"),
    so the form can draw every one of them. A future adapter property that cannot be drawn is
    NAMED by the predicate rather than routed to a JSON escape hatch."""
    for name, prop in schema["properties"].items():
        assert renderable_property(prop) is True, f"{name!r} was judged unrenderable: {prop!r}"


@pytest.mark.parametrize("prop,expected", [
    ({"type": "string"}, True),
    ({"type": "number"}, True),
    ({"type": "integer"}, True),
    ({"type": "boolean"}, True),
    ({"enum": ["a", "b"]}, True),
    ({"enum": [1, 2, 3]}, True),
    ({"type": "object"}, False),
    ({"type": "array", "items": {"type": "string"}}, False),
    ({"oneOf": [{"type": "string"}]}, False),
    ({"anyOf": [{"type": "string"}]}, False),
    ({"allOf": [{"type": "string"}]}, False),
    ({"$ref": "#/definitions/Thing"}, False),
    ({}, False),
    ({"type": "null"}, False),
    ({"description": "no type at all"}, False),
    ({"enum": [{"nested": 1}]}, False),
    ("not a mapping", False),
    (None, False),
])
def test_renderable_property_arms(prop, expected):
    assert renderable_property(prop) is expected


# ═══════════════════════════════════════════════════════════════════════════════
# 3. `resolve_arguments` — the three arms, the fallback, and the projection
# ═══════════════════════════════════════════════════════════════════════════════

def test_fixed_source_reads_tool_args_and_drops_the_empty_one():
    config = _config(
        tool_args={"to": "sarah@example.com", "subject": "  ", "body": "hello"},
        arg_sources={
            "to": {"source": "fixed"},
            "subject": {"source": "fixed"},
            "body": {"source": "fixed"},
        },
    )
    out = resolve_arguments(
        config=config, schema=SMTP_SCHEMA, upstream_outputs={}, run_inputs={},
    )
    assert out == {"to": "sarah@example.com", "body": "hello"}


def test_ask_source_reads_the_run_inputs_under_its_declared_key():
    config = _config(arg_sources={
        "to": {"source": "ask", "ask_key": "recipient"},
        "subject": {"source": "ask"},
    })
    out = resolve_arguments(
        config=config,
        schema=SMTP_SCHEMA,
        upstream_outputs={},
        run_inputs={"recipient": "ops@example.com", "subject": "Renewal"},
    )
    assert out == {"to": "ops@example.com", "subject": "Renewal"}


def test_upstream_source_reads_the_named_slug_and_omits_an_absent_one():
    config = _config(arg_sources={
        "body": {"source": "upstream", "upstream_slug": "draft"},
        "subject": {"source": "upstream", "upstream_slug": "missing"},
    })
    out = resolve_arguments(
        config=config,
        schema=SMTP_SCHEMA,
        upstream_outputs={"draft": "the drafted text"},
        run_inputs={},
    )
    assert out == {"body": "the drafted text"}


def test_a_property_with_no_entry_falls_back_to_tool_args_then_run_inputs():
    """D-214-08 + D-214-12 in one branch. Every workflow published before this phase carries
    an EMPTY `tool_args`, and the value `_adapter_args` projected came from the RUN-INPUT bag
    — so a fallback reading only `tool_args` would silently stop those workflows sending."""
    out = resolve_arguments(
        config=_config(tool_args={"subject": "from the step"}),
        schema=SMTP_SCHEMA,
        upstream_outputs={},
        run_inputs={"to": "legacy@example.com", "subject": "from the run"},
    )
    assert out == {"to": "legacy@example.com", "subject": "from the step"}


def test_an_undeclared_tool_args_key_is_dropped_and_never_reaches_the_wire():
    """The walk is over the SCHEMA's declared properties, never over `tool_args`' keys —
    which is what keeps run scaffolding, and worse a credential-shaped key, off the wire."""
    out = resolve_arguments(
        config=_config(tool_args={
            "to": "a@b.co", "subject": "s", "body": "b",
            "cc": "leaked@example.com", "smtp_password": "hunter2",
        }),
        schema=SMTP_SCHEMA,
        upstream_outputs={},
        run_inputs={},
    )
    assert set(out) == {"to", "subject", "body"}


def test_the_body_argument_fills_from_content_exactly_as_the_shipped_projection_does():
    out = resolve_arguments(
        config=_config(tool_args={"to": "a@b.co", "subject": "s"}),
        schema=SMTP_SCHEMA,
        upstream_outputs={},
        run_inputs={"content": "the upstream text"},
        body_arg="body",
    )
    assert out["body"] == "the upstream text"


def test_the_body_argument_does_not_overwrite_an_explicit_source():
    out = resolve_arguments(
        config=_config(
            tool_args={"body": "authored"},
            arg_sources={"body": {"source": "fixed"}},
        ),
        schema=SMTP_SCHEMA,
        upstream_outputs={"content": "upstream"},
        run_inputs={},
        body_arg="body",
    )
    assert out["body"] == "authored"


def test_an_unknown_schema_resolves_to_an_empty_object_which_the_gate_calls_shape_unknown():
    """The two functions AGREE on this input: the resolver sends nothing, the gate refuses."""
    assert resolve_arguments(
        config=_config(tool_args={"to": "a@b.co"}),
        schema=None, upstream_outputs={}, run_inputs={},
    ) == {}
    assert unsatisfiable_arguments(
        config=_config(tool_args={"to": "a@b.co"}),
        schema=None, upstream_slugs=[], declared_input_keys=set(),
    ) == [ArgumentGap("shape_unknown", None, None)]


# ═══════════════════════════════════════════════════════════════════════════════
# 4. `unsatisfiable_arguments` — one case per ArgumentGapKind
# ═══════════════════════════════════════════════════════════════════════════════

def test_gap_kind_no_source_when_nothing_supplies_a_required_property():
    gaps = unsatisfiable_arguments(
        config=_config(), schema=JIRA_SCHEMA, upstream_slugs=[], declared_input_keys=set(),
        body_arg="description",
    )
    # `description` is the body arg and is auto-filled; `summary` has nothing at all.
    assert gaps == [ArgumentGap("no_source", "summary", None)]
    assert [g.kind for g in gaps] == ["no_source"]


def test_gap_kind_no_source_when_a_fixed_source_holds_only_whitespace():
    gaps = unsatisfiable_arguments(
        config=_config(tool_args={"text": "   "}, arg_sources={"text": {"source": "fixed"}}),
        schema=SLACK_SCHEMA, upstream_slugs=[], declared_input_keys=set(),
    )
    assert gaps == [ArgumentGap("no_source", "text", None)]


def test_gap_kind_ask_undeclared_when_the_workflow_declares_no_such_input():
    gaps = unsatisfiable_arguments(
        config=_config(arg_sources={"text": {"source": "ask", "ask_key": "message"}}),
        schema=SLACK_SCHEMA, upstream_slugs=[], declared_input_keys={"topic"},
    )
    assert gaps == [ArgumentGap("ask_undeclared", "text", None)]

    satisfied = unsatisfiable_arguments(
        config=_config(arg_sources={"text": {"source": "ask", "ask_key": "message"}}),
        schema=SLACK_SCHEMA, upstream_slugs=[], declared_input_keys={"message"},
    )
    assert satisfied == []


def test_gap_kind_upstream_unreachable_names_the_slug_it_could_not_reach():
    gaps = unsatisfiable_arguments(
        config=_config(arg_sources={"text": {"source": "upstream", "upstream_slug": "draft"}}),
        schema=SLACK_SCHEMA, upstream_slugs=["gather"], declared_input_keys=set(),
    )
    assert gaps == [ArgumentGap("upstream_unreachable", "text", "draft")]
    assert gaps[0].upstream == "draft"

    reachable = unsatisfiable_arguments(
        config=_config(arg_sources={"text": {"source": "upstream", "upstream_slug": "draft"}}),
        schema=SLACK_SCHEMA, upstream_slugs=["gather", "draft"], declared_input_keys=set(),
    )
    assert reachable == []


def test_gap_kind_shape_unknown_is_the_one_refusal_that_names_no_argument():
    """Sketch 215 invariant #2. Both an absent schema and one with no `properties`."""
    for schema in (None, {}, {"type": "object"}, {"properties": "not a mapping"}):
        gaps = unsatisfiable_arguments(
            config=_config(), schema=schema, upstream_slugs=[], declared_input_keys=set(),
        )
        assert gaps == [ArgumentGap("shape_unknown", None, None)]
        assert gaps[0].argument is None


def test_gap_kind_unrenderable_names_the_argument_the_form_cannot_draw():
    """Derived from the REAL smtp schema by widening one property's type — no shipped adapter
    declares a composite, by design, so the case has to be produced rather than found."""
    schema = {
        "type": "object",
        "required": ["to", "subject", "body"],
        "properties": {
            **SMTP_SCHEMA["properties"],
            "subject": {"type": "object", "properties": {"line": {"type": "string"}}},
        },
    }
    gaps = unsatisfiable_arguments(
        config=_config(tool_args={"to": "a@b.co", "body": "b"}),
        schema=schema, upstream_slugs=[], declared_input_keys=set(),
    )
    assert gaps == [ArgumentGap("unrenderable", "subject", None)]


def test_an_optional_unrenderable_property_yields_no_gap():
    """An OPTIONAL property never produces a gap, however unsourced or undrawable — refusing
    a publish over a field the tool does not require would refuse workflows that work."""
    schema = {
        "type": "object",
        "required": ["text"],
        "properties": {
            **SLACK_SCHEMA["properties"],
            "blocks": {"type": "array", "items": {"type": "object"}},
            "thread_ts": {"type": "string"},
        },
    }
    gaps = unsatisfiable_arguments(
        config=_config(tool_args={"text": "hello"}),
        schema=schema, upstream_slugs=[], declared_input_keys=set(),
    )
    assert gaps == []


def test_an_undeclared_key_is_a_leftover_not_a_gap():
    """`cc` is not in `smtp_adapter.INPUT_SCHEMA` (D-32 — the thin three, deliberately). It is
    surfaced to the AUTHOR as a leftover by the editor (D-214-08); the predicate never invents
    a gap for it, and the resolver drops it before the wire."""
    config = _config(
        tool_args={"to": "a@b.co", "subject": "s", "body": "b", "cc": "nope@example.com"},
        arg_sources={"cc": {"source": "fixed"}},
    )
    gaps = unsatisfiable_arguments(
        config=config, schema=SMTP_SCHEMA, upstream_slugs=[], declared_input_keys=set(),
    )
    assert gaps == []
    assert not any(g.argument == "cc" for g in gaps)
    assert "cc" not in resolve_arguments(
        config=config, schema=SMTP_SCHEMA, upstream_outputs={}, run_inputs={},
    )


def test_the_gate_and_the_resolver_agree_on_the_same_config_and_schema():
    """CONTEXT failure mode #3, first half: no gap must mean every required key resolves.

    ⚠ NECESSARY BUT NOT SUFFICIENT — both functions take `schema` as an argument, so this
    proves `f(s) == g(s)` and says NOTHING about `s_gate != s_executor`. That second half is
    what `schema_for_bound_tool` closes, and it is asserted separately below.
    """
    config = _config(
        tool_args={"to": "a@b.co", "subject": "s"},
        arg_sources={
            "to": {"source": "fixed"},
            "subject": {"source": "fixed"},
            "body": {"source": "upstream", "upstream_slug": "draft"},
        },
    )
    gaps = unsatisfiable_arguments(
        config=config, schema=SMTP_SCHEMA, upstream_slugs=["draft"], declared_input_keys=set(),
    )
    assert gaps == []
    resolved = resolve_arguments(
        config=config, schema=SMTP_SCHEMA,
        upstream_outputs={"draft": "the text"}, run_inputs={},
    )
    for name in SMTP_SCHEMA["required"]:
        assert name in resolved, (
            f"the gate reported no gap yet the resolver omitted required {name!r} — a "
            "workflow that publishes and then fails at the send"
        )


# ═══════════════════════════════════════════════════════════════════════════════
# 5. ⭐ `schema_for_bound_tool` — ONE accessor, two shapes, three callers
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.mark.parametrize("capability", ["send_email", "create_ticket", "post_message"])
def test_the_native_arm_provenance_is_pinned_on_both_spellings(capability):
    """The native schema IS `descriptor_for(cap)["inputSchema"]` AND `_plain_json(
    adapter.INPUT_SCHEMA)`. Pinned on both so a transform on either side is visible here
    rather than as an empty argument object at a vendor."""
    obtained = schema_for_bound_tool(
        capability=capability, tool_name=None, discovered_tools=None,
    )
    assert obtained == descriptor_for(capability)["inputSchema"]
    assert obtained == _plain_json(get_adapter(capability).INPUT_SCHEMA)
    assert isinstance(obtained, dict)


def test_an_unregistered_capability_propagates_keyerror_rather_than_returning_none():
    """The closed set fails CLOSED at a named site. An empty argument object is not an
    acceptable answer to an unknown action, so the KeyError is NOT swallowed here."""
    with pytest.raises(KeyError):
        schema_for_bound_tool(capability="send_carrier_pigeon", tool_name=None, discovered_tools=None)


def test_the_mcp_arm_reads_the_snapshot_and_returns_none_where_it_cannot():
    snapshot = [
        {"name": "other_tool", "inputSchema": {"type": "object", "properties": {"a": {"type": "string"}}}},
        {"name": "create_page", "inputSchema": {"type": "object", "properties": {"title": {"type": "string"}}}},
        {"name": "no_schema_tool"},
    ]
    # a matching entry
    assert schema_for_bound_tool(
        capability=None, tool_name="create_page", discovered_tools=snapshot,
    ) == {"type": "object", "properties": {"title": {"type": "string"}}}
    # an ABSENT snapshot
    assert schema_for_bound_tool(capability=None, tool_name="create_page", discovered_tools=None) is None
    # a snapshot with no matching `name`
    assert schema_for_bound_tool(capability=None, tool_name="nope", discovered_tools=snapshot) is None
    # a matching entry carrying no `inputSchema`
    assert schema_for_bound_tool(capability=None, tool_name="no_schema_tool", discovered_tools=snapshot) is None
    # no tool name at all
    assert schema_for_bound_tool(capability=None, tool_name=None, discovered_tools=snapshot) is None


def test_the_accessor_performs_no_io():
    """⛔ The MCP arm is HANDED the snapshot; it never fetches a connection. Asserted over the
    module source rather than by mocking a client that is not imported."""
    with open(args_mod.__file__, "r", encoding="utf-8") as f:
        source = f.read()
    for forbidden in ("resolve_connection", "httpx", "mcp_client", "get_pg_pool", "supabase"):
        assert forbidden not in source, f"args.py reaches for {forbidden!r} — it must stay pure"
