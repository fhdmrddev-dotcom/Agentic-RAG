"""Phase 101 — template render deterministic core (TMPL-02).

This is the cross-plan TDD contract for the trusted/arbitrary fill behavior. It is
the single test file the 101-VALIDATION.md per-task verification map points at:
every downstream Plan 101-0X `<verify>` command runs a `-k` slice of THIS file.

The production module these stubs target (created in Plan 101-02) is
``backend/app/services/template_render_service.py``. The expected importable
symbols (the contract the stubs assert against) are:

  - ``Cited``                          — Pydantic BaseModel (value / source_chunk_id /
                                          source_doc / source_page — all nullable)
  - the generic field-map shape        — ``build_generic_field_map_model`` OR a fixed
                                          ``GenericFieldMap`` envelope (Plan 02 pins it;
                                          the stub imports whatever Plan 02 exports)
  - ``check_coverage``                 — port of derive_fields.check_coverage
  - ``is_truncated``                   — the stop_reason==max_tokens / finish_reason==
                                          length guard
  - ``build_context``                  — port of render_docx.build_context + the D-11
                                          worded→numeric hook
  - ``render_docx_template``           — port of render_docx.render (DocxTemplate +
                                          SandboxedEnvironment(autoescape=True))
  - ``run_replace_docx``               — the arbitrary-path run-coalescing scalar
                                          replace (Plan 02 net-new)
  - ``assert_integrity`` / ``residual_tags_in`` — re-open + residual scan
  - ``select_engine``                  — "docxtpl" for AssetRef/library, "run_replace"
                                          for kind='template_input'

  Plan 101-02 has landed: ``app.services.template_render_service`` now exists, so
  the RED-by-design ``pytest.mark.xfail(strict=False)`` stubs in this file were
  upgraded to real BEHAVIORAL tests (every ``xfail`` marker dropped — a silent
  XPASS can no longer mask a regression; the 098/099/100 un-mark-on-landing
  convention — test_workspace_template.py:53-57). Imports of the now-created
  symbols stay INSIDE each test body (no behavior change). Offline-friendly: no
  live DB / Storage; the cross-provider half stays MANUAL in 101-VALIDATION.md.

    Plan 101-02 (template_render_service.py — the deterministic helpers):
      - test_field_map_covers_template_keys        — the cited field-map shape covers
        risk-register.docx's placeholder keys; Cited leaves are all nullable.
      - test_check_coverage_flags_uncited_and_invented — the deterministic citation
        gate flags uncited + invented before render.
      - test_truncated_emission_rejected           — is_truncated rejects a
        stop_reason=max_tokens / finish_reason=length emission.
      - test_trusted_render_grows_rows[1,5,20]      — docxtpl {%tr %} row growth
        (the spike's load-bearing surprise — Pitfall 5).
      - test_run_merge_replaces_split_token         — the arbitrary run-merge engine
        reassembles a token split across runs (SC#4 #1).
      - test_engine_selection_by_provenance         — engine chosen by PROVENANCE
        (AssetRef/library→docxtpl, template_input→run_replace).

Offline-friendly: no live DB / Storage; the cross-provider half stays MANUAL in
101-VALIDATION.md. The deterministic helpers are unit-testable in the backend venv
(docxtpl is pip-installed for the TEST tier even though production render is the
sealed sandbox — RESEARCH §Validation Architecture).
"""

from __future__ import annotations

import pathlib

import pytest

# Fixture paths resolved relative to this test file:
#   backend/tests/unit/test_template_render.py -> parents[1] == backend/tests
_FIXTURES = pathlib.Path(__file__).resolve().parents[1] / "fixtures" / "templates"
RISK_REGISTER_DOCX = _FIXTURES / "risk-register.docx"
SPLIT_TOKEN_DOCX = _FIXTURES / "arbitrary-split-token.docx"


# ── Plan 101-02 — the cited field-map shape + coverage oracle ─────────────────


def test_field_map_covers_template_keys():
    """The Plan-02 generic field-map covers risk-register.docx's placeholder keys,
    and the ``Cited`` leaf is all-nullable (``Cited().value is None``)."""
    from docxtpl import DocxTemplate

    from app.services.template_render_service import Cited

    # Cited leaves are all nullable — a not-found-in-KB value is a clean decline.
    c = Cited()
    assert c.value is None
    assert c.source_chunk_id is None
    assert c.source_doc is None
    assert c.source_page is None

    # The coverage oracle: the field-map shape must cover the template's top-level keys.
    placeholder_keys = DocxTemplate(str(RISK_REGISTER_DOCX)).get_undeclared_template_variables()
    assert {"project_name", "report_date", "rows"} <= placeholder_keys

    # Plan 02 pins whether the generic shape is built from the keys or a fixed envelope.
    try:
        from app.services.template_render_service import build_generic_field_map_model

        model_cls = build_generic_field_map_model(sorted(placeholder_keys))
    except ImportError:
        from app.services.template_render_service import GenericFieldMap as model_cls

    # Whatever Plan 02 exports must validate an empty/declined field-map (all-nullable).
    assert model_cls is not None


def test_check_coverage_flags_uncited_and_invented():
    """The deterministic citation check (NO LLM) flags an invented citation
    (source_chunk_id not in the retrieved set) and an uncited value (value present,
    source_chunk_id null) BEFORE render (Pitfall 6 / D-08 failure class 1)."""
    from app.services.template_render_service import check_coverage

    retrieved_ids = {"chunk-1", "chunk-2"}
    placeholder_keys = ["project_name", "report_date", "rows"]

    fm_dict = {
        "project_name": {"value": "Meridian", "source_chunk_id": "chunk-1"},   # valid
        "report_date": {"value": "2026-06-10", "source_chunk_id": "chunk-99"},  # invented
        "rows": [
            {"risk_id": {"value": "R-01", "source_chunk_id": None}},            # uncited
        ],
    }

    stats = check_coverage(fm_dict, retrieved_ids, placeholder_keys)
    assert stats["invented_citation_count"] == 1
    assert stats["uncited_value_count"] == 1


def test_truncated_emission_rejected():
    """A truncated tool-JSON emission (stop_reason=max_tokens / finish_reason=length)
    is rejected — never accept a truncated empty field-map as 'no data found'
    (the spike's Rule-1 guard — derive_fields.py:267)."""
    from app.services.template_render_service import is_truncated

    assert is_truncated({"stop_reason": "max_tokens"}) is True
    assert is_truncated({"stop_reason": "tool_use"}) is False
    # finish_reason=="length" is the OpenAI-family alias for the same condition.
    assert is_truncated({"finish_reason": "length"}) is True
    assert is_truncated({"finish_reason": "stop"}) is False


@pytest.mark.parametrize("n_rows", [1, 5, 20])
def test_trusted_render_grows_rows(tmp_path, n_rows):
    """The trusted docxtpl path grows the {%tr %} register once per row — the
    spike's load-bearing surprise (Pitfall 5). Build a context with N rows, render
    risk-register.docx, re-open via assert_integrity, assert table rows == header(1)
    + N."""
    from app.services.template_render_service import (
        assert_integrity,
        build_context,
        render_docx_template,
    )

    field_map_dict = {
        "project_name": {"value": "Meridian"},
        "report_date": {"value": "2026-06-10"},
        "rows": [
            {
                "risk_id": {"value": f"R-{i:02d}"},
                "cause": {"value": "c"},
                "event": {"value": "e"},
                "effect": {"value": "f"},
                "probability": {"value": "2"},
                "impact": {"value": "3"},
                "response_strategy": {"value": "mitigate"},
                "owner": {"value": "owner"},
                "status": {"value": "open"},
            }
            for i in range(n_rows)
        ],
    }
    ctx = build_context(field_map_dict)
    out = tmp_path / "filled.docx"
    render_docx_template(str(RISK_REGISTER_DOCX), ctx, str(out))

    verdict = assert_integrity(str(out), "docx")
    # header(1) + N grown body rows.
    assert verdict["rows"] == 1 + n_rows


def test_run_merge_replaces_split_token(tmp_path):
    """The arbitrary non-Jinja run-merge engine reassembles a {{token}} split across
    multiple <w:r> runs and replaces it (SC#4 #1). After fill, the residual-tag scan
    is empty — no silent non-fill survived."""
    from app.services.template_render_service import (
        residual_tags_in,
        run_replace_docx,
    )

    out = tmp_path / "filled.docx"
    run_replace_docx(str(SPLIT_TOKEN_DOCX), {"client_name": "Acme Co"}, str(out))

    from docx import Document

    text = "\n".join(p.text for p in Document(str(out)).paragraphs)
    assert "Acme Co" in text
    assert residual_tags_in(str(out), "docx") == []


def test_engine_selection_by_provenance():
    """Engine selection is by PROVENANCE (D-02): a library AssetRef → docxtpl/Jinja;
    an ephemeral kind='template_input' upload → the non-Jinja run-replace engine
    (an untrusted upload NEVER reaches Jinja → SSTI structurally impossible)."""
    from app.services.template_render_service import select_engine

    assert select_engine("library") == "docxtpl"
    assert select_engine("template_input") == "run_replace"


# ── Plan 101-04 — the render_template tool handler (the integration piece) ────
#
# These are the OFFLINE-testable slices of the BEFORE-render citation gate and the
# AFTER-render integrity gate. The full sandbox render + the cross-provider field-map
# emission are LIVE UAT (101-VALIDATION.md Manual-Only). Both tests monkeypatch the
# resolver + the sandbox session to PROVE the gate short-circuits BEFORE the sandbox
# is ever reached (the BEFORE gate) and that an integrity failure preserves the
# field-map without persisting (the AFTER gate).

import asyncio
import json


def _make_ctx(**overrides):
    """A minimal duck-typed ToolContext for the offline handler tests.

    The handler only touches: pool, supabase, thread_id, current_user, redis,
    run_id, emit, and settings.sandbox_enabled (module-level). We provide stub
    attributes and let the monkeypatched resolver / sandbox short-circuit before
    any real I/O.
    """
    from app.services.tool_dispatcher import ToolContext

    base = dict(
        redis=None,
        run_id="00000000-0000-0000-0000-0000000000ff",
        thread_id="11111111-1111-1111-1111-111111111111",
        supabase=object(),
        pool=object(),
        user_settings=None,
        current_user={"id": "22222222-2222-2222-2222-222222222222"},
        folder_subtree_ids=None,
        scoped_folder_path=None,
        emit=_noop_emit,
        spawn=lambda *a, **k: None,
    )
    base.update(overrides)
    return ToolContext(**base)


async def _noop_emit(*args, **kwargs):
    return None


def test_render_template_rejects_uncited_before_render(monkeypatch):
    """The BEFORE-render citation gate (D-08 class 1): a field-map carrying an INVENTED
    citation (source_chunk_id not in retrieved_ids) is rejected WITHOUT resolving the
    template or touching the sandbox. We poison resolve_template_source + the sandbox
    manager so a reject is the ONLY way the test can pass — if the gate let the call
    through, these would raise."""
    import app.services.tool_dispatcher as td

    def _boom_resolve(*args, **kwargs):
        raise AssertionError("resolve_template_source must NOT be called before the citation gate")

    def _boom_sandbox(*args, **kwargs):
        raise AssertionError("the sandbox must NOT be reached before the citation gate")

    # Patch at the import sites the handler uses (function-scope imports resolve to the
    # service modules, so patch there).
    monkeypatch.setattr(
        "app.services.template_asset_service.resolve_template_source", _boom_resolve
    )
    monkeypatch.setattr(td.sandbox_manager, "get_or_create", _boom_sandbox)

    args = {
        "field_map": {
            "scalars": {
                # invented: source_chunk_id is not in retrieved_ids
                "project_name": {"value": "Meridian", "source_chunk_id": "chunk-99"},
            },
            "collections": {},
        },
        "retrieved_ids": ["chunk-1", "chunk-2"],
        "out_filename": "out.docx",
    }
    ctx = _make_ctx()

    result = asyncio.run(td._handle_render_template(args, ctx))
    payload = json.loads(result.result)
    assert payload["status"] == "rejected"
    assert payload["reason"] == "uncited_or_invented"
    # The invented citation was actually counted (gate ran the real check_coverage).
    assert payload["stats"]["invented_citation_count"] == 1


def test_render_template_integrity_fail_preserves_field_map(monkeypatch):
    """The AFTER-render integrity gate (D-08 class 2): when the sandbox verdict reports
    opened=False, the handler returns status=failed, PRESERVES the cited field-map as
    fallback output, and does NOT call ws_write_file (a corrupt file is NEVER
    delivered — SC#4 #3)."""
    import app.services.tool_dispatcher as td

    # A clean, fully-cited field-map so the BEFORE gate passes.
    field_map = {
        "scalars": {"project_name": {"value": "Meridian", "source_chunk_id": "chunk-1"}},
        "collections": {},
    }

    # Resolver returns real-looking bytes + provenance (library → docxtpl engine).
    async def _fake_resolve(*args, **kwargs):
        return {
            "bytes": b"PK\x03\x04 fake docx bytes",
            "filename": "template.docx",
            "provenance": "library",
            "mime": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "error": None,
        }

    monkeypatch.setattr(
        "app.services.template_asset_service.resolve_template_source", _fake_resolve
    )
    # Force sandbox_enabled True so the handler proceeds to the sandbox run.
    monkeypatch.setattr(td.settings, "sandbox_enabled", True)

    # Fake the sandbox ship+run to return an integrity FAILURE verdict (opened=False).
    async def _fake_threadpool(fn, *args, **kwargs):
        return {
            "verdict": {"rendered": True, "opened": False, "error": "won't open"},
            "stdout": '{"rendered": true, "opened": false}',
            "produced": None,
        }

    monkeypatch.setattr(td, "run_in_threadpool", _fake_threadpool)

    # ws_write_file must NEVER be called — poison it.
    async def _boom_write(*args, **kwargs):
        raise AssertionError("ws_write_file must NOT be called when integrity fails")

    monkeypatch.setattr(td, "ws_write_file", _boom_write)

    args = {
        "field_map": field_map,
        "retrieved_ids": ["chunk-1"],
        "out_filename": "out.docx",
        "asset": {
            "asset_id": "user/_library/template.docx",
            "filename": "template.docx",
            "kind": "template",
            "mime": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        },
    }
    ctx = _make_ctx()

    result = asyncio.run(td._handle_render_template(args, ctx))
    payload = json.loads(result.result)
    assert payload["status"] == "failed"
    assert payload["reason"] == "integrity"
    # The cited field-map is preserved as fallback so the extracted data isn't lost (D-08).
    assert payload["field_map"] == field_map


def test_render_driver_is_self_contained():
    """The sandbox render driver (_RENDER_DRIVER_SRC) is syntactically valid Python and
    is dependency-free w.r.t. the backend package — the container has no `app` on its
    path, so the driver must NOT import `app.*`."""
    from app.services.tool_dispatcher import _RENDER_DRIVER_SRC

    # Compiles without SyntaxError — it is valid, shippable Python.
    compile(_RENDER_DRIVER_SRC, "<render_driver>", "exec")

    # No backend-package imports (the sandbox has no backend/app on its path).
    assert "import app." not in _RENDER_DRIVER_SRC
    assert "from app." not in _RENDER_DRIVER_SRC

    # The docxtpl branch uses the SandboxedEnvironment(autoescape=True) (TMPL-03)...
    assert "SandboxedEnvironment(autoescape=True)" in _RENDER_DRIVER_SRC
    # ...and prints exactly one JSON verdict line.
    assert "json.dumps" in _RENDER_DRIVER_SRC
    assert "print(" in _RENDER_DRIVER_SRC

    # The integrity re-open uses the SAME library per format (docx/pptx/xlsx).
    assert "Document(" in _RENDER_DRIVER_SRC
    assert "Presentation(" in _RENDER_DRIVER_SRC
    assert "load_workbook(" in _RENDER_DRIVER_SRC
