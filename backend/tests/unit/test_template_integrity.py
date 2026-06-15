"""Phase 101 — template integrity gate + SSTI containment (TMPL-03).

The TMPL-03 half of the cross-plan TDD contract (see test_template_render.py for
the TMPL-02 half + the full symbol contract). Plan 101-02 has landed:
``app.services.template_render_service`` now exists, so the RED-by-design
``pytest.mark.xfail(strict=False)`` stubs were upgraded to real BEHAVIORAL tests
(every ``xfail`` marker dropped — the 098/099/100 un-mark-on-landing convention,
test_workspace_template.py:53-57). The ``app.services.template_render_service``
imports stay INSIDE each test body (no behavior change).

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

# backend/tests/unit/test_template_integrity.py -> parents[1] == backend/tests
_FIXTURES = pathlib.Path(__file__).resolve().parents[1] / "fixtures" / "templates"
RISK_REGISTER_DOCX = _FIXTURES / "risk-register.docx"


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


def test_template_input_routes_to_non_jinja_engine():
    """An ephemeral upload (kind='template_input') resolves to the run_replace
    engine and NEVER to docxtpl/Jinja — the SSTI-structurally-impossible guard
    (D-02). A static/structural assertion is sufficient."""
    from app.services.template_render_service import select_engine

    engine = select_engine("template_input")
    assert engine == "run_replace"
    assert engine != "docxtpl"


# ── Plan 101.1-04 — flat EmitFieldMap integrity + truncation parity (D-09 / WR-04) ──


def test_is_truncated_rejects_flat_shape():
    """The truncation guard (Pitfall 3) is shape-agnostic: a truncated forced-emit shot
    is rejected by stop_reason/finish_reason REGARDLESS of whether the (would-be) tool
    JSON encodes a flat EmitFieldMap or a nested GenericFieldMap. is_truncated reads only
    the stop/finish reason, so it covers the flat path identically — assert both call
    forms the flat-path forced_emit caller uses."""
    from app.services.template_render_service import is_truncated

    # The forced_emit caller passes the two reasons directly in hand (kwargs form).
    assert is_truncated(stop_reason="max_tokens") is True
    assert is_truncated(finish_reason="length") is True
    # A clean terminal of a flat forced shot is NOT truncated.
    assert is_truncated(stop_reason="tool_use", finish_reason="tool_calls") is False
    # Legacy positional-dict form stays equivalent (no flat-vs-nested divergence).
    assert is_truncated({"finish_reason": "length"}) is True


def test_flat_emit_field_map_renders_openable_file(tmp_path):
    """Integrity parity (D-09): a flat EmitFieldMap, normalized + built into the render
    context, renders a docx that re-opens cleanly (assert_integrity opened=True) — the
    flat shape inherits the SAME integrity guarantee as the nested path because the
    driver is unchanged downstream of build_context."""
    from app.services.template_render_service import (
        EmitFieldMap,
        assert_integrity,
        build_context,
        emit_field_map_to_legacy,
        render_docx_template,
    )

    _cols = ("risk_id", "cause", "event", "effect", "probability",
             "impact", "response_strategy", "owner", "status")
    flat = {
        "scalars": [
            {"key": "project_name", "value": "Meridian", "source_chunk_id": "c1",
             "source_doc": None, "source_page": None},
            {"key": "report_date", "value": "2026-06-10", "source_chunk_id": "c1",
             "source_doc": None, "source_page": None},
        ],
        "rows": [
            {"collection": "rows", "cells": [
                {"key": c, "value": f"{c}-v", "source_chunk_id": "c1",
                 "source_doc": None, "source_page": None}
                for c in _cols
            ]},
        ],
    }
    legacy = emit_field_map_to_legacy(EmitFieldMap.model_validate(flat))
    ctx = build_context(legacy)
    out = tmp_path / "flat-filled.docx"
    render_docx_template(str(RISK_REGISTER_DOCX), ctx, str(out))

    verdict = assert_integrity(str(out), "docx")
    assert verdict["opened"] is True
    # header(1) + 1 grown body row.
    assert verdict["rows"] == 1 + 1
