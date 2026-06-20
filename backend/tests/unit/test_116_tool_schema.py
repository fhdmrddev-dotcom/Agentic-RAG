"""Phase 116 Wave-0 — SC#2 schema-shape RED scaffold (Plan 03 target).

The `get_related_documents` tool schema MUST be Gemini-safe and SIMPLER than 115's
polymorphic `value`/`value2`:

  * NO `anyOf`, NO `oneOf` anywhere (Gemini rejects them — D-116; the 115 lock).
  * NO property whose `type` is a LIST (a multi-type array like `["string","null"]`).
    This is the a5b0b917 trap: avoiding anyOf/oneOf is NECESSARY-NOT-SUFFICIENT for
    Gemini — a multi-type `type:[...]` array ALSO breaks Gemini function calling (it
    400'd google-genai → broke ALL Gemini Deep tool use in Phase 115 live UAT). The
    two args are therefore flat single-type strings; "either/or" lives in PROSE, not
    in the schema shape.
  * Exactly two scalar-string subject fields — `document_id` and `filename` — each
    with `type == "string"` (NOT a list). The model fills ONE; the handler resolves
    via the shared `_resolve_readable_latest`.

Imports are inside the test bodies so collection never errors on the not-yet-built
schema while RED. These assertions become GREEN in Plan 03 (the schema ships there).
"""

import json

import pytest


def _find_schema():
    """Return the GET_RELATED_DOCUMENTS_TOOL schema dict, or skip if not built yet (RED)."""
    try:
        from app.services.openai_service import GET_RELATED_DOCUMENTS_TOOL  # noqa: F401
    except (ImportError, AttributeError):
        pytest.skip("GET_RELATED_DOCUMENTS_TOOL not built yet (Plan 03 target)")
    return GET_RELATED_DOCUMENTS_TOOL


def _iter_type_values(node):
    """Recursively yield every `type` value found anywhere under a schema node."""
    if isinstance(node, dict):
        for k, v in node.items():
            if k == "type":
                yield v
            else:
                yield from _iter_type_values(v)
    elif isinstance(node, list):
        for item in node:
            yield from _iter_type_values(item)


@pytest.mark.xfail(strict=False, reason="Plan 03 ships GET_RELATED_DOCUMENTS_TOOL")
def test_schema_has_no_anyof_or_oneof():
    """No `anyOf` / `oneOf` anywhere in the schema (Gemini rejects them)."""
    schema = _find_schema()
    blob = json.dumps(schema)
    assert "anyOf" not in blob, "schema must NOT use anyOf (Gemini 400)"
    assert "oneOf" not in blob, "schema must NOT use oneOf (Gemini 400)"


@pytest.mark.xfail(strict=False, reason="Plan 03 ships GET_RELATED_DOCUMENTS_TOOL")
def test_schema_has_no_multi_type_array():
    """NO property `type` is a LIST anywhere (the a5b0b917 Gemini multi-type-array trap).

    Recurse the WHOLE schema: every `type` value must be a bare string, never a list
    like `["string", "null"]`. A multi-type array 400'd google-genai in Phase 115 live
    UAT even with no anyOf/oneOf present — this is the necessary-not-sufficient lesson.
    """
    schema = _find_schema()
    params = schema["function"]["parameters"]
    list_typed = [t for t in _iter_type_values(params) if isinstance(t, list)]
    assert not list_typed, (
        f"no schema `type` may be a multi-type array (breaks Gemini); found {list_typed}"
    )


@pytest.mark.xfail(strict=False, reason="Plan 03 ships GET_RELATED_DOCUMENTS_TOOL")
def test_both_subject_fields_are_scalar_strings():
    """`document_id` and `filename` each have `type == "string"` (flat scalar, not a list)."""
    schema = _find_schema()
    props = schema["function"]["parameters"]["properties"]
    assert props["document_id"]["type"] == "string", "document_id must be a scalar string"
    assert props["filename"]["type"] == "string", "filename must be a scalar string"


@pytest.mark.xfail(strict=False, reason="Plan 03 ships GET_RELATED_DOCUMENTS_TOOL")
def test_subject_fields_are_optional_either_or_in_prose():
    """Neither subject field is hard-`required` (either/or is expressed in prose, not shape).

    The model fills EXACTLY ONE of `document_id` / `filename`. Forcing both into
    `required` would push a Gemini-unsafe XOR into the schema; the description carries
    the "provide exactly one" instruction instead.
    """
    schema = _find_schema()
    required = schema["function"]["parameters"].get("required", [])
    assert "document_id" not in required or "filename" not in required, (
        "the two subject fields must not BOTH be required (either/or lives in prose)"
    )
