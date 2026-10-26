"""Phase 296-03 (W3a) — the template fill's button values and its field count.

* 291-WR-04 — a checkbox or radio answer is written as a PDF NAME (``/V /invoice``), never a
  text string, and the read-back checks the TYPE, so a button whose ``/V`` came back as text
  is a read-back mismatch rather than a silent pass.
* 291-S7-F1 — the run page's "N fields" is the number of fields the fill wrote. Base counted
  ``len(legacy_map)``, which is the two envelope buckets (``scalars`` + ``collections``), so a
  fill of four fields read "2 fields".

Both RED at base 7f2636c4b.
"""
from __future__ import annotations

import io

import pytest


def _form_pdf() -> bytes:
    """text ``name``, checkbox ``agree``, combo ``country``, radio ``payment`` (card/invoice)."""
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
    return buf.getvalue()


@pytest.fixture()
def driver():
    from app.services.tools.render_template import _RENDER_DRIVER_SRC

    ns: dict = {"__name__": "render_driver_under_test"}
    exec(compile(_RENDER_DRIVER_SRC, "<render_driver>", "exec"), ns)
    return ns


def _fill(driver, tmp_path, values):
    src = tmp_path / "form.pdf"
    src.write_bytes(_form_pdf())
    out = tmp_path / "filled.pdf"
    res = driver["fill_acroform"](str(src), values, str(out))
    return res, out


def _field_v(path, name):
    """The raw ``/V`` object on the FIELD node (the one carrying ``/T``)."""
    from pypdf import PdfReader

    acro = PdfReader(str(path)).trailer["/Root"]["/AcroForm"]
    for ref in acro["/Fields"]:
        node = ref.get_object()
        if node.get("/T") == name:
            return node.get("/V")
    raise AssertionError(f"no field {name}")


# ── 291-WR-04 ─────────────────────────────────────────────────────────────────


def test_button_values_are_written_as_pdf_names(driver, tmp_path):
    from pypdf.generic import NameObject

    res, out = _fill(driver, tmp_path, {"agree": "yes", "payment": "invoice"})
    assert res["rendered"] is True and res["readback_mismatch"] == [], res
    agree = _field_v(out, "agree")
    payment = _field_v(out, "payment")
    assert isinstance(agree, NameObject) and agree == "/Yes"
    assert isinstance(payment, NameObject) and payment == "/invoice"


def test_unchecked_box_is_written_as_the_off_name(driver, tmp_path):
    from pypdf.generic import NameObject

    res, out = _fill(driver, tmp_path, {"agree": "no"})
    assert res["readback_mismatch"] == [], res
    v = _field_v(out, "agree")
    assert isinstance(v, NameObject) and v == "/Off"


def test_the_read_back_reports_a_button_value_typed(driver, tmp_path):
    _, out = _fill(driver, tmp_path, {"payment": "invoice", "name": "Ada"})
    back = {f["name"]: f for f in driver["_read_acroform"](str(out))}
    assert back["payment"]["value_is_name"] is True
    assert back["name"]["value_is_name"] is False


def test_a_button_whose_value_came_back_as_text_is_a_read_back_mismatch(driver, tmp_path):
    """Write the button the way pypdf alone does (the parent ``/V`` as a TEXT string) and the
    typed read-back must catch it rather than compare ``str()`` and pass."""

    def _text_only_write(writer, values):
        writer.update_page_form_field_values(None, values, auto_regenerate=False)

    driver["_write_values"] = _text_only_write
    res, _ = _fill(driver, tmp_path, {"payment": "invoice"})
    assert "payment" in res["readback_mismatch"]


# ── 291-S7-F1 ─────────────────────────────────────────────────────────────────


def _cited(v):
    return {"value": v, "source_chunk_id": None, "source_doc": None, "source_page": None}


def test_the_field_count_is_the_fields_written_not_the_envelope_buckets():
    from app.services.harness.phase_types import filled_field_count

    four = {
        "scalars": {
            "company": _cited("Example Ltd"),
            "email": _cited("a@example.com"),
            "agree": _cited("yes"),  # a button answer is a filled field
            "payment": _cited("invoice"),
        },
        "collections": {},
    }
    assert filled_field_count(four) == 4

    mixed = {
        "scalars": {"a": _cited("x"), "blanked": _cited(None), "empty": _cited("")},
        "collections": {"rows": [{"col": _cited("1")}], "none": []},
    }
    # a + the one collection that has rows; a blanked or empty field was not filled.
    assert filled_field_count(mixed) == 2
    assert filled_field_count({}) == 0
