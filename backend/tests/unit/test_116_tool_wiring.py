"""Phase 116 Wave-0 — SC#2 tool dual-registration RED scaffold (Plan 03 target).

The inverse-Phase-101 dual-registration (the 115 precedent): the new agent tool
`get_related_documents` must be wired into BOTH

  1. `tool_dispatcher._TOOL_REGISTRY` (so `dispatch_tool` can route a call), AND
  2. `openai_service.get_tools(...)` output (so the model can SEE the schema).

Phase 101's render_template bug was that the handler+registry landed but the SCHEMA
never reached `get_tools` → the model never emitted the call. This test guards
against the same gap in reverse, exactly as Phase 115 did.

Imports are inside the test bodies so collection never errors on the not-yet-built
handler / schema while RED. These become GREEN in Plan 03.
"""

import pytest


def test_tool_registered_in_dispatcher():
    """`get_related_documents` is a key in `tool_dispatcher._TOOL_REGISTRY`."""
    import app.services.tool_dispatcher as td

    assert "get_related_documents" in td._TOOL_REGISTRY
    assert callable(td._TOOL_REGISTRY["get_related_documents"])


def test_tool_schema_present_in_get_tools():
    """The `get_related_documents` schema is emitted by `openai_service.get_tools()`.

    The dual-registration's second leg: a registry entry the model can never SEE is
    dead. The schema MUST appear in the tools list the agent loop hands the provider.
    """
    from app.services.openai_service import get_tools

    tools = get_tools()
    names = {
        t.get("function", {}).get("name")
        for t in tools
        if isinstance(t, dict)
    }
    assert "get_related_documents" in names, (
        "get_related_documents schema missing from get_tools() — "
        "the model would never emit the call (the inverse-101 bug)"
    )


def test_registry_and_schema_agree():
    """The Phase-116 registry entry has a matching get_tools schema (no orphan)."""
    import app.services.tool_dispatcher as td
    from app.services.openai_service import get_tools

    schema_names = {
        t.get("function", {}).get("name")
        for t in get_tools()
        if isinstance(t, dict)
    }
    assert "get_related_documents" in td._TOOL_REGISTRY
    assert "get_related_documents" in schema_names
