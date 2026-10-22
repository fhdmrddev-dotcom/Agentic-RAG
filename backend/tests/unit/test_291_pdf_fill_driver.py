"""Phase 291 (AUTH-02, plan 291-03 Task 1) — a fillable PDF comes back FILLED (D-25, D-29).

The sealed render driver (``_RENDER_DRIVER_SRC``) gains an ``acroform`` engine: each answer is
written into the form's own field BY NAME with pypdf, validated against that field's own
states / options first (an answer that is not one of the form's choices is refused in words
and the field stays blank — the run does not fail), and every written value is READ BACK
(``/V``, and ``/AS`` for buttons) before the file may be delivered.

The driver functions are executed IN-PROCESS here (``exec`` of the driver source into a
namespace, the ``test_template_render.py`` precedent) with the backend venv's pypdf. The
calls used are the ones RESEARCH measured under the sandbox's pinned ``pypdf==5.1.0``.
Every fixture is built in the test with reportlab; no committed binaries.
"""

from __future__ import annotations

import asyncio
import io
import json
import sys

import pytest


# ── fixtures ──────────────────────────────────────────────────────────────────


def _form_pdf(*, xfa: bool = False, on_state_one: bool = False) -> bytes:
    """text ``name`` (tooltip), checkbox ``agree``, combo ``country`` (UK/US/DE), radio
    ``payment`` (card / invoice, neither selected)."""
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfgen import canvas

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    c.drawString(50, 700, "Name")
    c.acroForm.textfield(name="name", x=150, y=690, width=250, height=20, tooltip="Full name")
    c.drawString(50, 650, "Agree")
    c.acroForm.checkbox(name="agree", x=150, y=645, size=14)
    c.drawString(50, 600, "Country")
    c.acroForm.choice(
        name="country", x=150, y=595, width=100, height=20, options=["UK", "US", "DE"], value="UK"
    )
    c.drawString(50, 550, "Payment")
    c.acroForm.radio(name="payment", value="card", selected=False, x=150, y=545, size=14)
    c.acroForm.radio(name="payment", value="invoice", selected=False, x=200, y=545, size=14)
    c.showPage()
    c.save()
    raw = buf.getvalue()
    if not (xfa or on_state_one):
        return raw

    from pypdf import PdfReader, PdfWriter
    from pypdf.generic import ArrayObject, NameObject, TextStringObject

    writer = PdfWriter(clone_from=PdfReader(io.BytesIO(raw)))
    acro = writer._root_object["/AcroForm"].get_object()
    if xfa:
        acro[NameObject("/XFA")] = ArrayObject([TextStringObject("template"), TextStringObject("x")])
    if on_state_one:
        # IRS W-9 shape: the checkbox's on-state is "/1", not "/Yes".
        for ref in acro["/Fields"]:
            node = ref.get_object()
            if node.get("/T") == "agree":
                n = node["/AP"]["/N"]
                yes = n["/Yes"]
                del n["/Yes"]
                n[NameObject("/1")] = yes
                d = node["/AP"].get("/D")
                if d is not None and "/Yes" in d:
                    dy = d["/Yes"]
                    del d["/Yes"]
                    d[NameObject("/1")] = dy
                if node.get("/AS") == "/Yes":
                    node[NameObject("/AS")] = NameObject("/Off")
    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


@pytest.fixture()
def driver():
    from app.services.tools.render_template import _RENDER_DRIVER_SRC

    ns: dict = {"__name__": "render_driver_under_test"}
    exec(compile(_RENDER_DRIVER_SRC, "<render_driver>", "exec"), ns)
    return ns


def _fields_by_name(path):
    from pypdf import PdfReader

    return PdfReader(str(path)).get_fields() or {}


def _widget_states(path, name):
    """Every widget /AS for the field ``name`` (radio kids or the merged checkbox widget)."""
    from pypdf import PdfReader

    out = []
    for page in PdfReader(str(path)).pages:
        for annot in page.get("/Annots") or []:
            a = annot.get_object()
            parent = a.get("/Parent")
            t = a.get("/T") if a.get("/T") is not None else (
                parent.get_object().get("/T") if parent is not None else None
            )
            if t == name and a.get("/AS") is not None:
                out.append(str(a["/AS"]))
    return out


def _fill(driver, tmp_path, values, *, pdf=None):
    src = tmp_path / "form.pdf"
    src.write_bytes(pdf if pdf is not None else _form_pdf())
    out = tmp_path / "filled.pdf"
    res = driver["fill_acroform"](str(src), values, str(out))
    return res, out


# ── the fill ──────────────────────────────────────────────────────────────────


def test_all_four_kinds_written_and_read_back(driver, tmp_path):
    res, out = _fill(
        driver,
        tmp_path,
        {"name": "Acme & Söhne Ltd", "agree": "yes", "country": "DE", "payment": "invoice"},
    )
    assert res["rendered"] is True, res
    assert res["refused"] == []
    assert res["readback_mismatch"] == []
    assert res["non_latin"] is False
    f = _fields_by_name(out)
    assert f["name"].get("/V") == "Acme & Söhne Ltd"
    assert f["agree"].get("/V") == "/Yes"
    assert _widget_states(out, "agree") == ["/Yes"]
    assert f["country"].get("/V") == "DE"
    assert "/invoice" in _widget_states(out, "payment")
    assert [s for s in _widget_states(out, "payment") if s != "/Off"] == ["/invoice"]

    from pypdf import PdfReader

    acro = PdfReader(str(out)).trailer["/Root"]["/AcroForm"]
    assert bool(acro.get("/NeedAppearances")) is True


def test_values_are_matched_trimmed_case_insensitively_and_the_fields_own_spelling_is_written(
    driver, tmp_path
):
    res, out = _fill(driver, tmp_path, {"country": " de ", "payment": "Invoice"})
    assert res["refused"] == []
    f = _fields_by_name(out)
    assert f["country"].get("/V") == "DE"
    assert f["payment"].get("/V") == "/invoice"


@pytest.mark.parametrize("word", ["yes", "Y", " true ", "x", "Checked", "on", "1"])
def test_checkbox_truthy_words_check_the_box(driver, tmp_path, word):
    res, out = _fill(driver, tmp_path, {"agree": word})
    assert res["refused"] == [] and res["readback_mismatch"] == []
    assert _widget_states(out, "agree") == ["/Yes"]


@pytest.mark.parametrize("word", ["no", "N", "false", "unchecked", "OFF", "0", ""])
def test_checkbox_falsy_words_leave_it_off(driver, tmp_path, word):
    res, out = _fill(driver, tmp_path, {"agree": word})
    assert res["refused"] == [] and res["readback_mismatch"] == []
    assert _widget_states(out, "agree") == ["/Off"]


def test_checkbox_whose_on_state_is_one_like_the_w9(driver, tmp_path):
    pdf = _form_pdf(on_state_one=True)
    res, out = _fill(driver, tmp_path, {"agree": "yes"}, pdf=pdf)
    assert res["refused"] == [] and res["readback_mismatch"] == []
    assert _fields_by_name(out)["agree"].get("/V") == "/1"
    assert _widget_states(out, "agree") == ["/1"]


def test_checkbox_value_equal_to_its_on_state_name_checks_it(driver, tmp_path):
    res, out = _fill(driver, tmp_path, {"agree": "YES"})
    assert _widget_states(out, "agree") == ["/Yes"]
    res, out = _fill(driver, tmp_path, {"agree": "/Yes"})
    assert _widget_states(out, "agree") == ["/Yes"]


def test_checkbox_other_value_is_refused_and_left_unchecked(driver, tmp_path):
    res, out = _fill(driver, tmp_path, {"agree": "golden run placeholder for agree", "name": "Ann"})
    assert res["rendered"] is True
    assert [r["field"] for r in res["refused"]] == ["agree"]
    assert _widget_states(out, "agree") == ["/Off"]
    assert _fields_by_name(out)["name"].get("/V") == "Ann"


def test_invalid_choice_and_radio_are_refused_in_words_and_left_blank(driver, tmp_path):
    before = _fields_by_name_bytes(_form_pdf())
    res, out = _fill(driver, tmp_path, {"country": "FR", "payment": "bitcoin", "name": "Ann"})
    assert res["rendered"] is True
    assert res["readback_mismatch"] == []
    refused = {r["field"]: r["sentence"] for r in res["refused"]}
    assert set(refused) == {"country", "payment"}
    for key, sentence in refused.items():
        assert key in sentence
        assert "isn't one of this form's choices, so it was left blank" in sentence
    f = _fields_by_name(out)
    assert f["country"].get("/V") == before["country"].get("/V")  # untouched (UK default)
    assert f["country"].get("/V") != "FR"
    assert f["payment"].get("/V") in (None, "/Off")
    assert all(s == "/Off" for s in _widget_states(out, "payment"))
    assert f["name"].get("/V") == "Ann"


def test_refusal_names_the_label_when_the_field_has_a_tooltip(driver, tmp_path):
    # ``name`` is a text field (never refused); prove the label path on the tooltip reader.
    fields = driver["_read_acroform"](str(_write(tmp_path, _form_pdf())))
    by = {f["name"]: f for f in fields}
    assert by["name"]["tooltip"] == "Full name"


def _write(tmp_path, data, name="x.pdf"):
    p = tmp_path / name
    p.write_bytes(data)
    return p


def _fields_by_name_bytes(data):
    from pypdf import PdfReader

    return PdfReader(io.BytesIO(data)).get_fields() or {}


def test_xfa_is_dropped_from_the_output(driver, tmp_path):
    from pypdf import PdfReader

    pdf = _form_pdf(xfa=True)
    assert "/XFA" in PdfReader(io.BytesIO(pdf)).trailer["/Root"]["/AcroForm"]
    res, out = _fill(driver, tmp_path, {"name": "Ann"}, pdf=pdf)
    assert res["rendered"] is True
    assert "/XFA" not in PdfReader(str(out)).trailer["/Root"]["/AcroForm"]


@pytest.mark.parametrize("value", ["Zhang Wei 张伟", "مرحبا"])
def test_non_latin_value_is_a_documented_limit_not_a_failure(driver, tmp_path, value):
    res, out = _fill(driver, tmp_path, {"name": value})
    assert res["rendered"] is True
    assert res["non_latin"] is True
    assert res["readback_mismatch"] == []
    assert _fields_by_name(out)["name"].get("/V") == value


def _run_main(driver, tmp_path, monkeypatch, capsys, values, *, pdf=None):
    src = _write(tmp_path, pdf if pdf is not None else _form_pdf(), "template.pdf")
    fm = tmp_path / "fm.json"
    fm.write_text(
        json.dumps({"scalars": {k: {"value": v, "source_chunk_id": "c"} for k, v in values.items()}}),
        encoding="utf-8",
    )
    out = tmp_path / "deliverable.pdf"
    monkeypatch.setattr(sys, "argv", ["driver", "acroform", str(src), str(fm), str(out)])
    driver["main"]()
    lines = [ln for ln in capsys.readouterr().out.splitlines() if ln.strip()]
    return json.loads(lines[-1]), out


def test_main_acroform_arm_delivers_with_refusals_documented(driver, tmp_path, monkeypatch, capsys):
    verdict, out = _run_main(
        driver, tmp_path, monkeypatch, capsys,
        {"name": "Ann", "agree": "golden run placeholder for agree", "country": "DE"},
    )
    assert verdict["rendered"] is True
    assert verdict["opened"] is True
    assert verdict["residual_clean"] is True  # a refused field is a documented blank
    assert verdict["residual_tags"] == ["agree"]
    assert verdict["error"] is None
    assert "1 answer wasn't one of the form's choices and was left blank" in verdict["documented_limit"]
    assert out.is_file()


def test_main_non_latin_documented_limit(driver, tmp_path, monkeypatch, capsys):
    verdict, _ = _run_main(driver, tmp_path, monkeypatch, capsys, {"name": "张伟"})
    assert verdict["opened"] is True
    assert (
        "Some answers use characters this form's font cannot show; viewers that redraw fields "
        "will show them."
    ) in verdict["documented_limit"]


def test_forced_readback_mismatch_fails_the_run_in_words(driver, tmp_path, monkeypatch, capsys):
    real = driver["_write_values"]

    def _drop_name(writer, values):
        return real(writer, {k: v for k, v in values.items() if k != "name"})

    driver["_write_values"] = _drop_name
    res, _ = _fill(driver, tmp_path, {"name": "Ann", "country": "DE"})
    assert res["readback_mismatch"] == ["name"]

    verdict, _ = _run_main(driver, tmp_path, monkeypatch, capsys, {"name": "Ann", "country": "DE"})
    assert verdict["opened"] is False
    assert verdict["error"] and "name" in verdict["error"]
    assert "read back" in verdict["error"]


def test_docx_arms_still_fail_on_leftover_tokens(driver, tmp_path):
    from docx import Document

    p = tmp_path / "t.docx"
    d = Document()
    d.add_paragraph("Hello {{ stray }}")
    d.save(str(p))
    assert driver["residual_tags_in"](str(p), "docx") == ["Hello {{ stray }}"]
    integ = driver["assert_integrity"](str(p), "docx")
    assert integ["residual_clean"] is False


# ── the handler's allow-lists and engine pick ────────────────────────────────


def test_safe_out_filename_accepts_pdf():
    from app.services.tools.render_template import (
        _VALID_RENDER_ENGINES,
        _safe_out_filename,
    )

    assert _safe_out_filename("x.pdf", "pdf") == "x.pdf"
    assert _safe_out_filename("../x.pdf", "pdf") == "deliverable.pdf"
    assert _safe_out_filename("x.pdf; rm -rf /", "pdf") == "deliverable.pdf"
    assert "acroform" in _VALID_RENDER_ENGINES
    # unchanged for the OOXML kinds
    assert _safe_out_filename("r.xlsx", "xlsx") == "r.xlsx"
    assert _safe_out_filename(None, "docx") == "deliverable.docx"
    assert _safe_out_filename("../a.pptx", "pptx") == "deliverable.pptx"


async def _noop_emit(*a, **k):
    return None


def _ctx():
    from app.services.tool_dispatcher import ToolContext

    return ToolContext(
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
        spawn=None,
    )


def _drive_handler(monkeypatch, filename, out_filename, provenance="library"):
    import app.services.tools.render_template as td

    async def _fake_resolve(*a, **k):
        return {"bytes": b"%PDF-1.4 x", "filename": filename, "provenance": provenance, "error": None}

    monkeypatch.setattr("app.services.template_asset_service.resolve_template_source", _fake_resolve)
    monkeypatch.setattr(td.settings, "sandbox_enabled", True)
    commands: list[str] = []

    class _S:
        def execute_command(self, cmd):
            commands.append(cmd)

            class _R:
                stdout = '{"rendered": true, "opened": true, "residual_clean": true, "residual_tags": []}'

            return _R()

        def copy_to_runtime(self, a, b):
            return None

        def copy_from_runtime(self, a, b):
            return None

    monkeypatch.setattr(td.sandbox_manager, "get_or_create", lambda *a, **k: _S())

    async def _pt(fn, *a, **k):
        return fn()

    monkeypatch.setattr(td, "run_in_threadpool", _pt)
    args = {
        "field_map": {"scalars": {"name": {"value": "Ann", "source_chunk_id": "c1"}}},
        "retrieved_ids": ["c1"],
        "out_filename": out_filename,
        "asset": None,
    }
    asyncio.run(td._handle_render_template(args, _ctx()))
    return commands[-1]


def test_handler_picks_acroform_for_a_pdf_template(monkeypatch):
    cmd = _drive_handler(monkeypatch, "w9.pdf", "filled.pdf")
    assert " acroform " in cmd
    assert "/sandbox/output/filled.pdf" in cmd


def test_handler_pdf_template_output_is_always_a_pdf(monkeypatch):
    cmd = _drive_handler(monkeypatch, "w9.pdf", "filled.docx")
    assert " acroform " in cmd
    assert "/sandbox/output/filled.pdf" in cmd


def test_handler_keeps_select_engine_for_docx(monkeypatch):
    cmd = _drive_handler(monkeypatch, "template.docx", "out.docx")
    assert " docxtpl " in cmd
    cmd = _drive_handler(monkeypatch, "template.docx", "out.docx", provenance="template_input")
    assert " run_replace " in cmd
