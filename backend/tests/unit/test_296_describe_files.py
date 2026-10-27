"""Phase 296-03 (W3a) — the describe door's untrusted file read.

Rows pinned here (each RED at base 7f2636c4b):

* 291-WR-07 — an untrusted PDF's text is extracted ONCE per read, within a page cap
  (``DESCRIBE_PDF_MAX_PAGES``) and a byte cap; a read past the page cap says so.
* 291-IN-04 — ``_has_template_marks`` sees a Jinja comment mark ``{#``.
* 291-S1-labels — a text field's page label skips junk tokens (``3.``, ``f1_01[0]``, a lone
  dash or replacement character) and keeps only the words next to the field.

Every fixture is built in the test (reportlab), as the 291 suites do.
"""
from __future__ import annotations

import io
from types import SimpleNamespace

import pytest

_SETTINGS = SimpleNamespace(multimodal_max_vision_calls=100, vision_max_pages=50)


def _text_pdf(pages: int, line: str = "This page carries plain readable text for the reader. ") -> bytes:
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfgen import canvas

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    for i in range(pages):
        y = 740
        for _ in range(4):
            c.drawString(40, y, f"Page {i + 1}. {line}")
            y -= 14
        c.showPage()
    c.save()
    return buf.getvalue()


def _docx(paragraphs: list[str]) -> bytes:
    import docx

    d = docx.Document()
    for p in paragraphs:
        d.add_paragraph(p)
    buf = io.BytesIO()
    d.save(buf)
    return buf.getvalue()


class _Counter:
    def __init__(self) -> None:
        self.n = 0


@pytest.fixture()
def extraction_spy(monkeypatch):
    """Counts every page-text extraction by EITHER engine (pdfplumber and pymupdf)."""
    import pdfplumber.page
    import pymupdf

    counter = _Counter()
    real_plumber = pdfplumber.page.Page.extract_text
    real_mupdf = pymupdf.Page.get_text

    def _plumber(self, *a, **k):
        counter.n += 1
        return real_plumber(self, *a, **k)

    def _mupdf(self, *a, **k):
        # Only the plain-text read counts; "words" is the label reader, a different job.
        kind = a[0] if a else k.get("option", "text")
        if kind == "text":
            counter.n += 1
        return real_mupdf(self, *a, **k)

    monkeypatch.setattr(pdfplumber.page.Page, "extract_text", _plumber)
    monkeypatch.setattr(pymupdf.Page, "get_text", _mupdf)
    return counter


# ── 291-WR-07 ─────────────────────────────────────────────────────────────────


def test_pdf_text_is_extracted_once_per_page_by_one_engine(extraction_spy):
    from app.services import describe_files as df

    out = df._pdf_text_and_pages(_text_pdf(3))
    assert "plain readable text" in out[0]
    assert out[1] == 3
    # Base extracted every page twice (pymupdf for a fallback AND pdfplumber): 6 reads.
    assert extraction_spy.n == 3


def test_page_cap_constant_is_declared():
    from app.services import describe_files as df

    assert df.DESCRIBE_PDF_MAX_PAGES == 50


def test_a_pdf_over_the_page_cap_is_read_to_the_cap_and_says_so(monkeypatch, extraction_spy):
    from app.services import describe_files as df

    monkeypatch.setattr(df, "DESCRIBE_PDF_MAX_PAGES", 4)
    monkeypatch.setattr(df, "_reference_cap", lambda: 60_000)
    # The scan classifier is not this test's subject (it lives in vision_text).
    monkeypatch.setattr(df, "_pdf_scan_deficit", lambda raw, text: None)
    res = df.read_describe_file(
        _text_pdf(7), ".pdf", "long.pdf", "reference", app_settings=_SETTINGS, propose=None
    )
    assert res.arm == "reference"
    assert "Page 4." in res.text
    assert "Page 5." not in res.text
    assert res.cut_short == "Only the first 4 of 7 pages were read."
    assert extraction_spy.n == 4


def test_a_pdf_over_the_byte_cap_is_refused(monkeypatch):
    from app.services import describe_files as df

    monkeypatch.setattr(df, "DESCRIBE_PDF_MAX_BYTES", 100)
    with pytest.raises(df.DescribeFileUnreadable):
        df.read_describe_file(
            _text_pdf(1), ".pdf", "big.pdf", "reference", app_settings=_SETTINGS, propose=None
        )
    with pytest.raises(df.DescribeFileUnreadable):
        df.read_describe_file(
            _text_pdf(1), ".pdf", "big.pdf", "form", app_settings=_SETTINGS, propose=lambda t, c: []
        )


def test_the_byte_cap_is_the_doors_upload_cap():
    """One number in two homes: the leaf may not import the door's constant (it would pull a
    database module into a leaf that must reach none), so the two are pinned equal here."""
    from app.services import describe_files as df
    from app.services.workspace_service import MAX_FILE_SIZE

    assert df.DESCRIBE_PDF_MAX_BYTES == MAX_FILE_SIZE


# ── 291-IN-04 ─────────────────────────────────────────────────────────────────


def test_a_jinja_comment_mark_is_a_template_mark():
    from app.services.describe_files import _has_template_marks

    assert _has_template_marks(_docx(["Notes {# reviewer only #} end."])) is True
    assert _has_template_marks(_docx(["Plain prose, no marks."])) is False


# ── 291-S1-labels ─────────────────────────────────────────────────────────────


def _junk_label_pdf() -> bytes:
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfgen import canvas

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    # A numbered line that also prints the field's own id (the IRS W-9 shape).
    c.drawString(20, 700, "3. Legal name f1_01[0]")
    c.acroForm.textfield(name="f1_01[0]", x=200, y=692, width=200, height=20)
    # A lone dash after the words (it extracts as a replacement character).
    c.drawString(20, 650, "Phone number   –")
    c.acroForm.textfield(name="phone", x=200, y=642, width=200, height=20)
    # The label sits ABOVE the field, numbered, with stray punctuation.
    c.drawString(200, 612, "4. Mailing address .")
    c.acroForm.textfield(name="addr", x=200, y=585, width=200, height=20)
    # An instruction on the far left of the line; the field's own label sits next to it.
    c.drawString(20, 550, "See instructions.")
    c.drawString(150, 550, "Email")
    c.acroForm.textfield(name="email", x=200, y=542, width=200, height=20)
    c.showPage()
    c.save()
    return buf.getvalue()


def test_text_field_labels_skip_junk_and_keep_the_adjacent_words():
    from app.services import describe_files as df

    raw = _junk_label_pdf()
    labels = df._page_labels(raw, df.read_acroform_fields(raw))
    assert labels["f1_01[0]"] == "Legal name"
    assert labels["phone"] == "Phone number"
    assert labels["addr"] == "Mailing address"
    assert labels["email"] == "Email"
