"""Phase 272 (FIND-07) — the `filters` argument on search_documents (D-03 / D-02 / D-05 / D-04).

The model is offered Find's condition list as a TOOL ARGUMENT, in a shape every one of
the eight providers accepts:

  * the `op` enum EQUALS ``ViewCondition.op`` — Find's vocabulary, never a second dialect
    (D-03; the same parity idiom as ``test_115_tool_schema.py``);
  * the ``filters`` subtree carries no anyOf / oneOf / allOf / additionalProperties / $ref /
    not and no multi-type ``type`` array, so Google's sanitizer keeps it whole and the
    google-genai ``types.Tool`` constructs (the Phase 115 incident: one rejected Tool took
    down EVERY Gemini Deep run);
  * the old "call WITHOUT metadata_filter first / never guess values" guidance is gone (D-02),
    the date rule is stated (D-05) and an unknown field/value is answered with a list (D-04);
  * ``metadata_filter`` stays, optional (``test_module7_tools`` pins it).

The field names the description must mention are DERIVED from the code sets
(``document_view_resolver._METADATA_BUILTINS``), never a retyped list.
"""

from __future__ import annotations

import json
import typing


_FORBIDDEN_KEYS = {"anyOf", "oneOf", "allOf", "additionalProperties", "$ref", "not"}
_DATE_WORDS = ("added", "source_created", "source_modified")


def _tool() -> dict:
    from app.services.openai_service import SEARCH_DOCUMENTS_TOOL

    return SEARCH_DOCUMENTS_TOOL


def _params() -> dict:
    return _tool()["function"]["parameters"]


def _filters() -> dict:
    return _params()["properties"]["filters"]


def _walk(node, path="filters"):
    """Yield (path, dict) for every dict in the subtree."""
    if isinstance(node, dict):
        yield path, node
        for k, v in node.items():
            yield from _walk(v, f"{path}.{k}")
    elif isinstance(node, list):
        for i, v in enumerate(node):
            yield from _walk(v, f"{path}[{i}]")


# ── D-03: op parity with Find ────────────────────────────────────────────────


def test_filters_op_enum_equals_viewcondition_op():
    from app.models.document_view import ViewCondition

    op_enum = _filters()["items"]["properties"]["op"]["enum"]
    literal = typing.get_args(ViewCondition.model_fields["op"].annotation)
    assert set(op_enum) == set(literal), (
        f"filters op enum {sorted(op_enum)} drifted from ViewCondition.op {sorted(literal)}"
    )
    assert len(op_enum) == len(set(op_enum)), "duplicate op in the enum"


# ── D-03: the provider-safe shape ────────────────────────────────────────────


def test_filters_subtree_uses_only_provider_safe_constructs():
    f = _filters()
    bad_keys = [
        f"{p}.{k}" for p, d in _walk(f) for k in d if k in _FORBIDDEN_KEYS
    ]
    assert bad_keys == [], f"provider-unsafe keys in filters: {bad_keys}"
    list_types = [f"{p}.type={d['type']}" for p, d in _walk(f) if isinstance(d.get("type"), list)]
    assert list_types == [], f"multi-type `type` arrays in filters (Gemini rejects): {list_types}"


def test_filters_item_shape_matches_the_args_contract():
    f = _filters()
    assert f["type"] == "array"
    items = f["items"]
    assert items["type"] == "object"
    props = items["properties"]
    assert set(props) == {"field", "op", "value", "value2", "values", "unit"}
    assert items["required"] == ["field", "op"]
    assert props["field"]["type"] == "string"
    assert props["op"]["type"] == "string"
    assert props["value"]["type"] == "string"
    assert props["value2"]["type"] == "string"
    assert {k: v for k, v in props["values"].items() if k != "description"} == {
        "type": "array",
        "items": {"type": "string"},
    }
    assert props["unit"]["type"] == "string"
    assert props["unit"]["enum"] == ["days", "weeks", "months"]


def test_google_sanitizer_keeps_filters_and_the_tool_constructs():
    from app.services.google_service import (
        _convert_tools_to_google,
        _sanitize_schema_for_google,
    )

    tool = _tool()
    san = _sanitize_schema_for_google(tool["function"]["parameters"])
    kept = san["properties"]["filters"]["items"]["properties"]
    assert set(kept) == {"field", "op", "value", "value2", "values", "unit"}, (
        f"Google's sanitizer dropped part of filters.items.properties: {sorted(kept)}"
    )
    gtools = _convert_tools_to_google([tool])
    assert gtools and len(gtools[0].function_declarations) == 1
    assert gtools[0].function_declarations[0].name == "search_documents"


# ── D-02 / D-05 / D-04: the guidance the model reads ─────────────────────────


def test_filters_description_names_every_builtin_and_date_word():
    from app.services.document_view_resolver import _METADATA_BUILTINS

    desc = _filters()["description"]
    missing = [n for n in sorted(_METADATA_BUILTINS) if f"`{n}`" not in desc]
    missing += [w for w in _DATE_WORDS if f"`{w}`" not in desc]
    assert missing == [], f"filters description omits field names: {missing}"


def test_filters_description_states_the_date_rule_and_the_unknown_rule():
    desc = _filters()["description"]
    low = desc.lower()
    # D-05 — the document's own date is the default.
    assert "`date`" in desc and "default" in low
    # ...and the upload / in-file dates only when the person says so.
    for word in ("uploaded", "created", "modified"):
        assert word in low, f"date rule does not mention '{word}'"
    assert "only when" in low
    # The between example the model can copy.
    assert '"op":"between"' in desc and '"value2":"2025-10-31"' in desc
    # A dimension example.
    assert '"field":"legal_entity"' in desc
    # D-04 — an unknown field or value comes back with the valid list.
    assert "unknown field or value" in low and "valid" in low
    assert "close means wrong" in low


def test_old_unfiltered_first_guidance_is_gone():
    blob = json.dumps(_tool())
    for sentence in (
        "WITHOUT metadata_filter first",
        "Only add metadata_filter when",
        "never guess filter values",
        "Do NOT guess",
        "Supported filter keys",
        "OMIT this parameter unless",
    ):
        assert sentence not in blob, f"D-02 guidance still present: {sentence!r}"


# ── unchanged contracts ──────────────────────────────────────────────────────


def test_metadata_filter_stays_optional_and_required_is_query_only():
    params = _params()
    assert "metadata_filter" in params["properties"]
    assert params["required"] == ["query"]
    assert "filters" not in params["required"]
    assert "prefer `filters`" in params["properties"]["metadata_filter"]["description"]
