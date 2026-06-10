"""Phase 101 — template integrity gate + SSTI containment (TMPL-03).

The TMPL-03 half of the cross-plan TDD contract (see test_template_render.py for
the TMPL-02 half + the full symbol contract). Same conventions:
``pytest.mark.xfail(strict=False)`` RED-by-design stubs (the 098/099/100
convention) with the not-yet-created ``app.services.template_render_service``
imports INSIDE each test body so an ImportError surfaces as an xfail, not a
collection error.

  Plan 101-02 (template_render_service.py — the integrity + autoescape helpers):
    - test_corrupt_file_never_delivered          — assert_integrity on truncated /
      garbage bytes RAISES (or returns opened=False) so the caller never delivers
      a corrupt file (SC#4 #3 / Pitfall 3).
    - test_autoescape_contains_xml_special_chars — SandboxedEnvironment(autoescape=
      True) renders ``Acme & <Corp>`` so the literal text survives re-open with no
      repair (SC#4 #2 / Pitfall 2).
    - test_template_input_routes_to_non_jinja_engine — an ephemeral upload
      (kind='template_input') resolves to the run_replace engine and NEVER to
      docxtpl/Jinja (the SSTI-structurally-impossible guard — D-02).

Offline-friendly: no live DB / Storage; the sandbox-isolation half stays MANUAL in
101-VALIDATION.md (a fresh chat against the new SANDBOX_IMAGE).
"""

from __future__ import annotations

import pathlib

import pytest

# backend/tests/unit/test_template_integrity.py -> parents[1] == backend/tests
_FIXTURES = pathlib.Path(__file__).resolve().parents[1] / "fixtures" / "templates"
RISK_REGISTER_DOCX = _FIXTURES / "risk-register.docx"


@pytest.mark.xfail(strict=False, reason="Plan 101-02: assert_integrity not yet implemented")
def test_corrupt_file_never_delivered(tmp_path):
    """The integrity re-open gate catches a corrupt file before delivery: feeding
    truncated / garbage bytes written to a .docx path makes assert_integrity RAISE
    (or return opened=False) so the caller never delivers it (SC#4 #3)."""
    from app.services.template_render_service import assert_integrity

    bad = tmp_path / "corrupt.docx"
    bad.write_bytes(b"PK\x03\x04 not a real ooxml zip \x00\x00 garbage")

    opened_false = False
    raised = False
    try:
        verdict = assert_integrity(str(bad), "docx")
        opened_false = verdict.get("opened") is False
    except Exception:
        raised = True

    assert raised or opened_false, (
        "a corrupt file must either RAISE or report opened=False so it is never delivered"
    )


@pytest.mark.xfail(strict=False, reason="Plan 101-02: render_docx_template autoescape not yet implemented")
def test_autoescape_contains_xml_special_chars(tmp_path):
    """SandboxedEnvironment(autoescape=True) escapes XML-special chars so a value
    like ``Acme & <Corp>`` survives as literal text on re-open with no repair
    banner (SC#4 #2 / Pitfall 2)."""
    from app.services.template_render_service import (
        assert_integrity,
        build_context,
        render_docx_template,
    )

    field_map_dict = {
        "project_name": {"value": "Acme & <Corp>"},
        "report_date": {"value": "2026-06-10"},
        "rows": [],
    }
    ctx = build_context(field_map_dict)
    out = tmp_path / "escaped.docx"
    render_docx_template(str(RISK_REGISTER_DOCX), ctx, str(out))

    # Re-open must succeed (no corruption from the raw & < >) ...
    assert_integrity(str(out), "docx")

    # ... and the literal special chars must survive in the body text.
    from docx import Document

    text = "\n".join(p.text for p in Document(str(out)).paragraphs)
    assert "Acme & <Corp>" in text


@pytest.mark.xfail(strict=False, reason="Plan 101-02: select_engine SSTI guard not yet implemented")
def test_template_input_routes_to_non_jinja_engine():
    """An ephemeral upload (kind='template_input') resolves to the run_replace
    engine and NEVER to docxtpl/Jinja — the SSTI-structurally-impossible guard
    (D-02). A static/structural assertion is sufficient."""
    from app.services.template_render_service import select_engine

    engine = select_engine("template_input")
    assert engine == "run_replace"
    assert engine != "docxtpl"
