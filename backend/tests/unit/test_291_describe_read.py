"""Phase 291 (AUTH-02, plan 291-01 Task 1) — the authoring-time file READ.

``app.services.describe_files`` is the one pure leaf that answers *"what is in this file?"*
before a draft exists: the exact AcroForm fields of a fillable PDF (D-01a, D-11), today's
``{{ }}`` read of a Word template, AI-proposed fields for a flat or scanned PDF (D-01c,
D-08), the honest "no fields" arm (D-02), and the text of a reference file capped per
provider and never cut silently.

Every fixture is BUILT IN THE TEST (reportlab AcroForm, a reportlab text PDF, python-docx,
a PyMuPDF image-only page) — no committed binaries. The vision call and the AI proposal
are injected fakes: no network, no database.
"""

from __future__ import annotations

import io
from types import SimpleNamespace

import pytest

LONG_TEXT = (
    "This vendor onboarding agreement sets out the terms under which the supplier "
    "provides services to the client. The supplier must provide a company name, a "
    "registered address, a contact email and the date the agreement starts. "
)


# ── Byte builders ─────────────────────────────────────────────────────────────
def _acro_pdf() -> bytes:
    """Five AcroForm fields: text (tooltip), text (label on the same line), checkbox,
    combo box, listbox, and a two-button radio group. Plus one label-less text field."""
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfgen import canvas

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    c.drawString(50, 700, "Full name:")
    c.acroForm.textfield(
        name="full_name", x=150, y=690, width=200, height=20, tooltip="Your full legal name"
    )
    c.drawString(50, 650, "Company")
    c.acroForm.textfield(name="company", x=150, y=640, width=200, height=20)
    c.drawString(50, 600, "Agree to terms")
    c.acroForm.checkbox(name="agree", x=150, y=595, size=14)
    c.drawString(50, 555, "Country")
    c.acroForm.choice(
        name="country", x=150, y=550, width=100, height=20, options=["UK", "US", "DE"], value="UK"
    )
    c.drawString(50, 500, "Colour")
    c.acroForm.listbox(
        name="colour", x=150, y=480, width=100, height=50, options=["Red", "Green"], value="Red"
    )
    c.drawString(50, 445, "Payment")
    c.acroForm.radio(name="payment", value="card", selected=True, x=150, y=440, size=14)
    c.acroForm.radio(name="payment", value="invoice", selected=False, x=200, y=440, size=14)
    # No text anywhere near this one: its label must come from the proposer.
    c.acroForm.textfield(name="ref_code", x=400, y=200, width=100, height=20)
    c.showPage()
    c.save()
    return buf.getvalue()


def _hierarchical_pdf() -> bytes:
    """A real-vendor-shaped name: parent ``topmostSubform[0]`` with kid ``f1_01[0]``."""
    from pypdf import PdfReader, PdfWriter
    from pypdf.generic import ArrayObject, DictionaryObject, NameObject, TextStringObject
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfgen import canvas

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    c.drawString(50, 700, "1 Name of entity")
    c.acroForm.textfield(name="f1_01[0]", x=200, y=690, width=200, height=20)
    c.showPage()
    c.save()

    writer = PdfWriter(clone_from=PdfReader(io.BytesIO(buf.getvalue())))
    acro = writer._root_object["/AcroForm"]
    fields = acro["/Fields"]
    kid_ref = fields[0]
    parent = DictionaryObject(
        {
            NameObject("/T"): TextStringObject("topmostSubform[0]"),
            NameObject("/Kids"): ArrayObject([kid_ref]),
        }
    )
    parent_ref = writer._add_object(parent)
    kid_ref.get_object()[NameObject("/Parent")] = parent_ref
    acro[NameObject("/Fields")] = ArrayObject([parent_ref])
    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


def _text_pdf(body: str = LONG_TEXT) -> bytes:
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfgen import canvas

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    y = 740
    for i in range(0, len(body), 80):
        c.drawString(40, y, body[i : i + 80])
        y -= 14
    c.showPage()
    c.save()
    return buf.getvalue()


def _scan_pdf(pages: int = 1) -> bytes:
    """Image-only pages: no text layer at all, so ``classify_pdf_deficit`` says scan."""
    import pymupdf

    doc = pymupdf.open()
    pix = pymupdf.Pixmap(pymupdf.csRGB, pymupdf.IRect(0, 0, 60, 60), False)
    pix.clear_with(200)
    png = pix.tobytes("png")
    for _ in range(pages):
        page = doc.new_page(width=300, height=300)
        page.insert_image(pymupdf.Rect(20, 20, 280, 280), stream=png)
    out = doc.tobytes()
    doc.close()
    return out


def _docx(paragraphs: list[str]) -> bytes:
    import docx

    d = docx.Document()
    for p in paragraphs:
        d.add_paragraph(p)
    buf = io.BytesIO()
    d.save(buf)
    return buf.getvalue()


def _pptx() -> bytes:
    import pptx

    prs = pptx.Presentation()
    prs.slides.add_slide(prs.slide_layouts[5]).shapes.title.text = "Quarterly review"
    buf = io.BytesIO()
    prs.save(buf)
    return buf.getvalue()


def _xlsx() -> bytes:
    import openpyxl

    wb = openpyxl.Workbook()
    wb.active["A1"] = "Totals"
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


# ── Fakes ─────────────────────────────────────────────────────────────────────
class _FakeProposer:
    def __init__(self, fields: list[dict] | None = None) -> None:
        self.fields = fields or []
        self.calls: list[tuple[str, list[dict]]] = []

    def __call__(self, text, candidates):
        self.calls.append((text, list(candidates)))
        return list(self.fields)


_SETTINGS = SimpleNamespace(multimodal_max_vision_calls=100, vision_max_pages=50)


def _read(raw, ext, filename, role="form", propose=None):
    from app.services import describe_files as df

    return df.read_describe_file(
        raw, ext, filename, role, app_settings=_SETTINGS, propose=propose or _FakeProposer()
    )


# ── read_acroform_fields ──────────────────────────────────────────────────────
def test_acroform_reader_returns_every_field_with_exact_names_and_types():
    from app.services.describe_files import read_acroform_fields

    fields = read_acroform_fields(_acro_pdf())
    assert fields is not None
    by = {f.name: f for f in fields}
    assert list(by) == ["full_name", "company", "agree", "country", "colour", "payment", "ref_code"]
    assert by["full_name"].field_type == "text"
    assert by["agree"].field_type == "checkbox"
    assert by["country"].field_type == "choice"
    assert by["colour"].field_type == "choice"
    assert by["payment"].field_type == "radio"
    assert "/Off" in by["agree"].states and "/Yes" in by["agree"].states
    assert by["country"].options == ["UK", "US", "DE"]
    assert by["colour"].options == ["Red", "Green"]
    assert set(by["payment"].states) == {"/card", "/invoice"}
    assert by["full_name"].tooltip == "Your full legal name"
    assert by["full_name"].page_index == 0
    assert by["full_name"].rect is not None


def test_hierarchical_name_is_fully_qualified_and_parent_is_not_a_field():
    from app.services.describe_files import read_acroform_fields

    fields = read_acroform_fields(_hierarchical_pdf())
    assert [f.name for f in fields] == ["topmostSubform[0].f1_01[0]"]


@pytest.mark.parametrize(
    "raw",
    [b"not a pdf at all", b"%PDF-1.4\n%garbage\x00\x01 trailer", None],
    ids=["not-pdf", "corrupt", "no-acroform"],
)
def test_acroform_reader_returns_none_never_raises(raw):
    from app.services.describe_files import read_acroform_fields

    data = _text_pdf() if raw is None else raw
    assert read_acroform_fields(data) is None


def test_acroform_oracle_has_the_docx_oracle_shape():
    from app.services.describe_files import acroform_oracle

    oracle = acroform_oracle(_acro_pdf())
    assert oracle == {
        "scalars": ["full_name", "company", "agree", "country", "colour", "payment", "ref_code"],
        "collections": [],
        "columns": {},
    }
    assert acroform_oracle(_text_pdf()) is None


# ── read_describe_file: form role ─────────────────────────────────────────────
def test_fillable_pdf_reads_form_fields_with_types_carried_over():
    proposer = _FakeProposer([{"key": "ref_code", "label": "Reference code", "type": "text"}])
    res = _read(_acro_pdf(), ".pdf", "vendor-form.pdf", propose=proposer)
    assert res.role == "form"
    assert res.arm == "form_fields"
    by = {f["key"]: f for f in res.fields}
    assert all(f["origin"] == "exact" for f in res.fields)
    assert by["full_name"]["type"] == "text"
    assert by["agree"]["type"] == "enum" and by["agree"]["enum_options"] == ["yes", "no"]
    assert by["country"]["type"] == "enum" and by["country"]["enum_options"] == ["UK", "US", "DE"]
    assert by["colour"]["type"] == "enum" and by["colour"]["enum_options"] == ["Red", "Green"]
    assert by["payment"]["type"] == "enum"
    assert sorted(by["payment"]["enum_options"]) == ["card", "invoice"]


def test_label_fallback_tooltip_then_page_text_then_proposer():
    proposer = _FakeProposer([{"key": "ref_code", "label": "Reference code", "type": "text"}])
    res = _read(_acro_pdf(), ".pdf", "vendor-form.pdf", propose=proposer)
    by = {f["key"]: f for f in res.fields}
    assert by["full_name"]["label"] == "Your full legal name"  # /TU wins
    assert by["company"]["label"] == "Company"  # nearest words on the same line
    assert by["agree"]["label"] == "Agree to terms"
    assert by["ref_code"]["label"] == "Reference code"  # proposed
    assert by["ref_code"]["origin"] == "exact"  # the KEY is still exact
    # The proposer was asked only about the label-less field.
    assert len(proposer.calls) == 1
    asked = [c.get("key") for c in proposer.calls[0][1]]
    assert asked == ["ref_code"]


def test_docx_with_tokens_reads_template_fields():
    res = _read(_docx(["Dear {{ client_name }},", "Thanks."]), ".docx", "letter.docx")
    assert res.arm == "template_fields"
    assert [f["key"] for f in res.fields] == ["client_name"]


def test_docx_and_pdf_with_no_fields_are_arm_none():
    res = _read(_docx(["Just prose.", "No blanks here."]), ".docx", "prose.docx")
    assert res.arm == "none" and res.fields == []
    res = _read(_text_pdf(), ".pdf", "terms.pdf", propose=_FakeProposer([]))
    assert res.arm == "none" and res.fields == []


@pytest.mark.parametrize("ext,builder", [(".pptx", _pptx), (".xlsx", _xlsx)])
def test_pptx_xlsx_with_no_fields_are_not_word(ext, builder):
    res = _read(builder(), ext, f"deck{ext}")
    assert res.arm == "not_word"


def test_flat_pdf_reads_suggested_fields_and_drops_bad_keys():
    proposer = _FakeProposer(
        [
            {"key": "company_name", "label": "Company name", "type": "text"},
            {"key": "start_date", "label": "Start date", "type": "date"},
            {"key": "9bad", "label": "Bad", "type": "text"},
            {"key": "kickoff_prompt", "label": "Reserved", "type": "text"},
            {"key": "company_name", "label": "Duplicate", "type": "text"},
        ]
    )
    res = _read(_text_pdf(), ".pdf", "terms.pdf", propose=proposer)
    assert res.arm == "suggested_fields"
    assert res.suggested_from == "text"
    assert [f["key"] for f in res.fields] == ["company_name", "start_date"]
    assert all(f["origin"] == "ai_proposed" for f in res.fields)
    assert res.fields[0]["label"] == "Company name"
    assert "vendor onboarding agreement" in proposer.calls[0][0]


def test_scan_with_empty_transcription_is_scan_unreadable(monkeypatch):
    from app.services.extractors.aspects import vision_text

    monkeypatch.setattr(vision_text, "transcribe_pages", lambda pages, kind, s, client=None: "")
    res = _read(_scan_pdf(), ".pdf", "scan.pdf")
    assert res.arm == "scan_unreadable"
    assert res.text == ""


def test_scan_with_text_is_suggested_from_scan(monkeypatch):
    from app.services.extractors.aspects import vision_text

    monkeypatch.setattr(
        vision_text, "transcribe_pages", lambda pages, kind, s, client=None: "Name: ____"
    )
    proposer = _FakeProposer([{"key": "name", "label": "Name", "type": "text"}])
    res = _read(_scan_pdf(), ".pdf", "scan.pdf", propose=proposer)
    assert res.arm == "suggested_fields"
    assert res.suggested_from == "scan"
    assert [f["key"] for f in res.fields] == ["name"]
    assert res.cut_short is None


def test_nine_page_scan_transcribes_three_and_says_so(monkeypatch):
    from app.services.extractors.aspects import vision_text

    seen: list[int] = []

    def _fake(pages, kind, s, client=None):
        seen.append(len(pages))
        return "Some text"

    monkeypatch.setattr(vision_text, "transcribe_pages", _fake)
    res = _read(_scan_pdf(9), ".pdf", "scan.pdf", propose=_FakeProposer([]))
    assert seen == [3]
    assert res.cut_short == "Only the first 3 of 9 pages of this scan were read."


# ── read_describe_file: reference role ────────────────────────────────────────
def test_reference_text_is_capped_and_says_so(monkeypatch):
    from app.services import describe_files as df

    monkeypatch.setattr(df, "_reference_cap", lambda: 20_000)
    raw = ("x" * 48_500).encode()
    res = _read(raw, ".txt", "notes.txt", role="reference")
    assert res.role == "reference"
    assert res.arm == "reference"
    assert len(res.text) == 20_000
    assert res.cut_short == "Only the first 20,000 of 48,500 characters were read."

    short = _read(b"# Notes\nshort", ".md", "notes.md", role="reference")
    assert short.cut_short is None
    assert short.text == "# Notes\nshort"


def test_reference_docx_and_pdf_carry_their_text(monkeypatch):
    from app.services import describe_files as df

    monkeypatch.setattr(df, "_reference_cap", lambda: 20_000)
    res = _read(_docx(["Pricing is fixed.", "Payment in 30 days."]), ".docx", "t.docx", role="reference")
    assert res.arm == "reference" and "Payment in 30 days." in res.text
    res = _read(_text_pdf(), ".pdf", "t.pdf", role="reference")
    assert res.arm == "reference" and "vendor onboarding" in res.text


def test_reference_char_cap_bounds():
    from app.services.describe_files import reference_char_cap

    assert reference_char_cap(None, None) == 20_000
    cap = reference_char_cap("anthropic", "claude-sonnet-5")
    assert 8_000 <= cap <= 60_000


def test_cut_short_sentences_exact():
    from app.services.describe_files import cut_short_sentence

    assert cut_short_sentence("pages", 5, 12) == "Only the first 5 of 12 pages were read."
    assert cut_short_sentence("scan_pages", 3, 9) == "Only the first 3 of 9 pages of this scan were read."
    assert cut_short_sentence("chars", 20000, 48500) == "Only the first 20,000 of 48,500 characters were read."


def test_unopenable_file_raises_never_arm_none():
    from app.services import describe_files as df

    with pytest.raises(df.DescribeFileUnreadable):
        _read(b"%PDF-1.4 truncated", ".pdf", "broken.pdf")
    with pytest.raises(df.DescribeFileUnreadable):
        _read(b"PK\x03\x04 not really", ".docx", "broken.docx")
