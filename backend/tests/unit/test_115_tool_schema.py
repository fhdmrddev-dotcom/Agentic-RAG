"""Phase 115 Wave-0 — SC#1 schema-shape RED scaffold (Plan 03 target).

The polymorphic `view`-XOR-`filter` tool schema MUST be flat: NO `anyOf` / `oneOf`
(Gemini rejects them — the KEY research lock, D-115-13), and BOTH `view` and
`filter` are genuinely OPTIONAL (absent from `parameters.required`) so the catalog
mode is reachable by an arg-less call. The nested filter `op` enum must match the
`ViewCondition.op` Literal values EXACTLY (no drift between the tool schema the
model sees and the AST the compiler validates).

Imports are inside the test bodies so collection never errors on the not-yet-built
schema while RED.
"""

import json

import pytest


def _find_schema():
    """Return the QUERY_DOCUMENTS_BY_VIEW_TOOL schema dict, or skip if not built yet."""
    from app.services.openai_service import QUERY_DOCUMENTS_BY_VIEW_TOOL  # noqa: F401

    return QUERY_DOCUMENTS_BY_VIEW_TOOL


@pytest.mark.xfail(strict=False, reason="Plan 03 defines QUERY_DOCUMENTS_BY_VIEW_TOOL")
def test_schema_has_no_anyof_or_oneof():
    """No `anyOf` / `oneOf` anywhere in the schema (Gemini rejects them — D-115-13)."""
    schema = _find_schema()
    blob = json.dumps(schema)
    assert "anyOf" not in blob, "schema must NOT use anyOf (Gemini 400)"
    assert "oneOf" not in blob, "schema must NOT use oneOf (Gemini 400)"


@pytest.mark.xfail(strict=False, reason="Plan 03 defines the optional view/filter args")
def test_view_and_filter_are_optional():
    """`view` and `filter` are NOT in `parameters.required` (catalog mode reachable)."""
    schema = _find_schema()
    params = schema["function"]["parameters"]
    required = params.get("required", [])
    assert "view" not in required, "view must be optional (an arg-less call → catalog)"
    assert "filter" not in required, "filter must be optional (an arg-less call → catalog)"


@pytest.mark.xfail(strict=False, reason="Plan 03 defines the nested filter op enum")
def test_filter_op_enum_matches_viewcondition_literal_exactly():
    """The nested `filter.properties.conditions.items.properties.op.enum` ≡ ViewCondition.op."""
    import typing

    from app.models.document_view import ViewCondition

    schema = _find_schema()
    params = schema["function"]["parameters"]
    filter_props = params["properties"]["filter"]["properties"]
    op_enum = filter_props["conditions"]["items"]["properties"]["op"]["enum"]

    # Extract the Literal members of ViewCondition.op.
    op_field = ViewCondition.model_fields["op"]
    literal_values = list(typing.get_args(op_field.annotation))

    assert set(op_enum) == set(literal_values), (
        f"tool schema op enum {sorted(op_enum)} drifted from "
        f"ViewCondition.op {sorted(literal_values)}"
    )
