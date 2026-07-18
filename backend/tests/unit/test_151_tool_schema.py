"""Phase 151 Wave-0 — FILE-02 schema-shape RED scaffold (Plan 151-01).

The ``fetch_document_file`` tool schema MUST be flat: NO ``anyOf`` / ``oneOf``
anywhere (Gemini rejects them — the cross-provider lock, SC#10 / D-115-13), with a
single required ``document_id`` string param (mirrors ``read_document``, D-04-faithful).

Imports live inside a helper so collection never errors while the schema is not yet
built (RED) — the assertion body raises ``ImportError`` at run time instead.
"""

import json


def _schema():
    """Return the FETCH_DOCUMENT_FILE_TOOL schema dict (ImportError while RED)."""
    from app.services.openai_service import FETCH_DOCUMENT_FILE_TOOL  # noqa: F401

    return FETCH_DOCUMENT_FILE_TOOL


def test_fetch_document_file_name_and_required_param():
    """name == 'fetch_document_file'; params carry 'document_id'; it is required."""
    schema = _schema()
    assert schema["type"] == "function"
    fn = schema["function"]
    assert fn["name"] == "fetch_document_file"
    params = fn["parameters"]
    assert "document_id" in params["properties"], "schema must expose document_id"
    assert "document_id" in params.get("required", []), "document_id must be required"


def test_fetch_schema_has_no_anyof_or_oneof():
    """No `anyOf` / `oneOf` anywhere in the schema (Gemini 400 guard — SC#10)."""
    schema = _schema()
    blob = json.dumps(schema)
    assert "anyOf" not in blob, "schema must NOT use anyOf (Gemini 400)"
    assert "oneOf" not in blob, "schema must NOT use oneOf (Gemini 400)"


def test_fetch_description_leads_with_when_and_when_not():
    """Description leads with when/when-not so weak models route correctly (SC#10)."""
    schema = _schema()
    desc = schema["function"]["description"]
    assert "Use when" in desc, "description must lead with a 'Use when' phrase"
    assert "Do not use for" in desc, "description must include a 'Do not use for' phrase"
