"""Phase 291 (AUTH-02, plan 291-03) — ONE AcroForm reader, pinned against its sandbox copy.

``describe_files.read_acroform_fields`` is the one reader the describe door, the run-time
oracle and the bind re-read use. The sealed render driver cannot import ``app.*``, so it
necessarily INLINES its own copy (``_read_acroform`` inside ``_RENDER_DRIVER_SRC``). Two copies
of a reader drift; this test is what stops them: on three fixtures (flat names, a
hierarchical vendor-shaped name, a radio group) both must return the same
``(name, field_type, states, options)`` list, in the same order.
"""

from __future__ import annotations

import io

import pytest


def _flat_pdf() -> bytes:
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfgen import canvas

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    c.acroForm.textfield(name="full_name", x=150, y=690, width=200, height=20, tooltip="Name")
    c.acroForm.checkbox(name="agree", x=150, y=595, size=14)
    c.acroForm.choice(
        name="country", x=150, y=550, width=100, height=20, options=["UK", "US", "DE"], value="UK"
    )
    c.acroForm.listbox(
        name="colour", x=150, y=480, width=100, height=50, options=["Red", "Green"], value="Red"
    )
    c.showPage()
    c.save()
    return buf.getvalue()


def _hierarchical_pdf() -> bytes:
    from pypdf import PdfReader, PdfWriter
    from pypdf.generic import ArrayObject, DictionaryObject, NameObject, TextStringObject
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfgen import canvas

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    c.acroForm.textfield(name="f1_01[0]", x=200, y=690, width=200, height=20)
    c.acroForm.checkbox(name="c1_1[0]", x=200, y=640, size=14)
    c.showPage()
    c.save()

    writer = PdfWriter(clone_from=PdfReader(io.BytesIO(buf.getvalue())))
    acro = writer._root_object["/AcroForm"]
    kids = list(acro["/Fields"])
    parent = DictionaryObject(
        {
            NameObject("/T"): TextStringObject("topmostSubform[0]"),
            NameObject("/Kids"): ArrayObject(kids),
        }
    )
    parent_ref = writer._add_object(parent)
    for k in kids:
        k.get_object()[NameObject("/Parent")] = parent_ref
    acro[NameObject("/Fields")] = ArrayObject([parent_ref])
    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


def _radio_pdf() -> bytes:
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfgen import canvas

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    c.acroForm.radio(name="payment", value="card", selected=True, x=150, y=440, size=14)
    c.acroForm.radio(name="payment", value="invoice", selected=False, x=200, y=440, size=14)
    c.acroForm.radio(name="size", value="s", selected=False, x=150, y=400, size=14)
    c.acroForm.radio(name="size", value="m", selected=False, x=200, y=400, size=14)
    c.acroForm.radio(name="size", value="l", selected=False, x=250, y=400, size=14)
    c.showPage()
    c.save()
    return buf.getvalue()


@pytest.fixture()
def driver_reader():
    from app.services.tools.render_template import _RENDER_DRIVER_SRC

    ns: dict = {"__name__": "render_driver_under_test"}
    exec(compile(_RENDER_DRIVER_SRC, "<render_driver>", "exec"), ns)
    return ns["_read_acroform"]


@pytest.mark.parametrize(
    "build", [_flat_pdf, _hierarchical_pdf, _radio_pdf], ids=["flat", "hierarchical", "radio"]
)
def test_driver_reader_matches_describe_files(build, driver_reader, tmp_path):
    from app.services.describe_files import read_acroform_fields

    data = build()
    path = tmp_path / "form.pdf"
    path.write_bytes(data)

    ours = read_acroform_fields(data)
    assert ours, "fixture carries no fields — the comparison would be vacuous"
    expected = [(f.name, f.field_type, list(f.states), list(f.options)) for f in ours]
    got = [
        (f["name"], f["field_type"], list(f["states"]), list(f["options"]))
        for f in driver_reader(str(path))
    ]
    assert got == expected


def test_hierarchical_names_are_fully_qualified(driver_reader, tmp_path):
    path = tmp_path / "h.pdf"
    path.write_bytes(_hierarchical_pdf())
    names = [f["name"] for f in driver_reader(str(path))]
    assert names == ["topmostSubform[0].f1_01[0]", "topmostSubform[0].c1_1[0]"]


def test_no_acroform_reads_as_empty(driver_reader, tmp_path):
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfgen import canvas

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    c.drawString(50, 700, "no fields here")
    c.showPage()
    c.save()
    path = tmp_path / "flat.pdf"
    path.write_bytes(buf.getvalue())
    assert driver_reader(str(path)) == []
