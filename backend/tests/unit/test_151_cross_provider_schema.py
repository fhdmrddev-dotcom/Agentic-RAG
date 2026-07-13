"""Phase 151 — SC#10 cross-provider translation backstop for FILE-02 (Plan 151-01).

The static half of the SC#10 mandate: ``fetch_document_file``'s flat OpenAI-function
schema MUST survive BOTH the Anthropic (``input_schema`` rename) and Google
(``_sanitize_schema_for_google`` — strips anyOf/oneOf/$ref, collapses type arrays)
translators without raising, and the tool MUST still be present by name in each
translated output. No ``provider ==`` fork is introduced — both translators sit at the
service boundary and process the one source schema uniformly.

The live 4-axis cross-provider UAT (real LLM tool-calls) is authored in
151-VALIDATION.md, NOT here.
"""
from types import SimpleNamespace


def _tools_sandbox_on():
    from app.services.openai_service import get_tools

    eff = SimpleNamespace(
        web_search_enabled=True, sandbox_enabled=True, self_improve_enabled=True
    )
    return get_tools(eff)


def _google_names(google_tools):
    names = set()
    for tool in google_tools:
        for fd in (getattr(tool, "function_declarations", None) or []):
            name = getattr(fd, "name", None)
            if name is None and isinstance(fd, dict):
                name = fd.get("name")
            if name:
                names.add(name)
    return names


def test_fetch_document_file_survives_google_translation():
    from app.services.google_service import _convert_tools_to_google

    google_tools = _convert_tools_to_google(_tools_sandbox_on())  # must not raise
    assert "fetch_document_file" in _google_names(google_tools)


def test_fetch_document_file_survives_anthropic_translation():
    from app.services.anthropic_service import _convert_tools_to_anthropic

    anthropic_tools = _convert_tools_to_anthropic(_tools_sandbox_on())  # must not raise
    names = {t["name"] for t in anthropic_tools}
    assert "fetch_document_file" in names
