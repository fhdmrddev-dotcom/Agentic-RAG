"""Phase 151 — FILE-02 dual-wiring + sandbox-gate registration tests (Plan 151-01).

Proves the G-5 dual-wiring contract for ``fetch_document_file``:
  * it is a ``_TOOL_REGISTRY`` handler (so ``dispatch_tool`` can route it), AND
  * it appears in ``get_tools()`` ONLY when ``sandbox_enabled=True`` and is ABSENT when
    the sandbox is off (D-11 HIDE layer), AND
  * it is registered in ``_CAPABILITY_FLAG_TOOLS`` under ``sandbox_enabled`` (the
    fail-closed in-flight REFUSE layer).

Total tool-COUNT assertions are intentionally NOT hard-coded here — the three stale
exact-count assertions (test_085_tool_registration.py:272/280, test_tool_dispatcher.py:68)
are finalized in Plan 151-04 once BOTH FILE-02 and FILE-01 exist. This file asserts
presence/absence by NAME, not totals.

--- FILE-01 EXTENSION POINT (Plan 151-04) ---------------------------------------
Plan 04 adds ``attach_skill_file`` (self_improve_enabled-gated). Extend THIS file with:
  * ``"attach_skill_file" in _TOOL_REGISTRY``
  * present in get_tools() when self_improve_enabled=True, absent when False
  * ``_CAPABILITY_FLAG_TOOLS["attach_skill_file"] == ("self_improve_enabled", ...)``
and update the exact-count assertions in test_085 + test_tool_dispatcher for +2 tools.
---------------------------------------------------------------------------------
"""
from types import SimpleNamespace


def _get_tools(**flags):
    from app.services.openai_service import get_tools

    eff = SimpleNamespace(
        web_search_enabled=flags.get("web_search_enabled", False),
        sandbox_enabled=flags.get("sandbox_enabled", False),
        self_improve_enabled=flags.get("self_improve_enabled", True),
    )
    return {t["function"]["name"] for t in get_tools(eff)}


def test_fetch_document_file_in_registry():
    from app.services.tool_dispatcher import _TOOL_REGISTRY, _handle_fetch_document_file

    assert "fetch_document_file" in _TOOL_REGISTRY
    assert _TOOL_REGISTRY["fetch_document_file"] is _handle_fetch_document_file


def test_fetch_document_file_capability_flag_sandbox_gated():
    from app.services.tool_dispatcher import _CAPABILITY_FLAG_TOOLS

    gate = _CAPABILITY_FLAG_TOOLS.get("fetch_document_file")
    assert gate is not None, "fetch_document_file must be a capability-gated tool"
    flag_attr, _label = gate
    assert flag_attr == "sandbox_enabled"


def test_fetch_document_file_present_when_sandbox_on():
    names = _get_tools(sandbox_enabled=True)
    assert "fetch_document_file" in names


def test_fetch_document_file_absent_when_sandbox_off():
    names = _get_tools(sandbox_enabled=False)
    assert "fetch_document_file" not in names


def test_reusable_resolver_symbol_exported_for_file01():
    """Plan 04 (FILE-01 source #4) imports this resolver — lock the symbol name now."""
    from app.services.tool_dispatcher import _fetch_owned_document_bytes  # noqa: F401

    assert callable(_fetch_owned_document_bytes)


# --- FILE-01 (Plan 151-04) — attach_skill_file dual-wiring + self_improve gate --------
def test_attach_skill_file_in_registry():
    from app.services.tool_dispatcher import _TOOL_REGISTRY, _handle_attach_skill_file

    assert "attach_skill_file" in _TOOL_REGISTRY
    assert _TOOL_REGISTRY["attach_skill_file"] is _handle_attach_skill_file


def test_attach_skill_file_capability_flag_self_improve_gated():
    from app.services.tool_dispatcher import _CAPABILITY_FLAG_TOOLS

    gate = _CAPABILITY_FLAG_TOOLS.get("attach_skill_file")
    assert gate is not None, "attach_skill_file must be a capability-gated tool"
    flag_attr, _label = gate
    assert flag_attr == "self_improve_enabled"


def test_attach_skill_file_present_when_self_improve_on():
    names = _get_tools(self_improve_enabled=True)
    assert "attach_skill_file" in names


def test_attach_skill_file_absent_when_self_improve_off():
    names = _get_tools(self_improve_enabled=False)
    assert "attach_skill_file" not in names


def test_attach_skill_file_not_sandbox_gated():
    """attach_skill_file rides the self-improve gate, NOT the sandbox gate — it is present
    with the sandbox OFF as long as self-improve is ON (its workspace/inline/kb sources
    need no sandbox)."""
    names = _get_tools(sandbox_enabled=False, self_improve_enabled=True)
    assert "attach_skill_file" in names
