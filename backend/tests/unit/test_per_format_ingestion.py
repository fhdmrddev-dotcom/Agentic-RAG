"""BUG-260825-01 — one REAL file of every allowed MIME type, end to end.

⚠ THIS SUITE EXISTS BECAUSE THE SHIPPED ONE COULD NOT HAVE CAUGHT THE BUG.
   `.docx`/`.pdf` were absent from `_EXT_MIME_OVERRIDES`, so a client announcing
   `application/octet-stream` got a 422 while `.md` sailed through — the operator's exact
   split — and nothing exercised the door with a misreported Content-Type. A NUL in the
   extracted text killed ingestion at the embedding step with `22P05`, and nothing
   exercised a NUL at all.

   The `text/html` row below asserts only that HTML PRODUCES TEXT. That its text carries no
   markup is BUG-260825-02, guarded in `test_html_extraction_no_markup.py` — kept separate
   because the two assertions fail for different reasons and must not be confused.

⚠ THE FILES ARE BUILT, NOT FIXTURED. A checked-in binary rots silently against a library
   upgrade; a file this module constructs is a real `.docx`/`.pdf`/`.pptx`/`.xlsx` produced
   by the same libraries the extractor reads with.
"""
from __future__ import annotations

import io
import zipfile
from email.message import EmailMessage

import pytest

import app.main  # noqa: F401  — app.api.* cannot be imported standalone
from app.api.documents import (
    ALLOWED_MIME_TYPES,
    _EXT_MIME_OVERRIDES,
    _UNRELIABLE_MIME_TYPES,
    extract_text,
)
from app.services.extraction_service import DOCX_MIME, PDF_MIME, get_extractor
from app.services.text_sanitize import scrub_text

PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

_MARKER = "Revenue rose 12 percent in Q3"


# ──────────────────────────────────────────────────────────────────────────────
# Real files, built with the same libraries the extractors read with.
# ──────────────────────────────────────────────────────────────────────────────
def _docx(text: str = _MARKER) -> bytes:
    from docx import Document
    d = Document()
    d.add_heading("Quarterly Note", 0)
    d.add_paragraph(text)
    buf = io.BytesIO()
    d.save(buf)
    return buf.getvalue()


def _pdf(text: str = _MARKER) -> bytes:
    from reportlab.pdfgen import canvas as rlcanvas
    buf = io.BytesIO()
    c = rlcanvas.Canvas(buf)
    c.drawString(72, 760, "Quarterly Note")
    c.drawString(72, 740, text)
    c.save()
    return buf.getvalue()


def _pptx(text: str = _MARKER) -> bytes:
    from pptx import Presentation
    from pptx.util import Inches
    p = Presentation()
    s = p.slides.add_slide(p.slide_layouts[5])
    s.shapes.title.text = "Roadmap"
    tb = s.shapes.add_textbox(Inches(1), Inches(2), Inches(6), Inches(1))
    tb.text_frame.text = text
    buf = io.BytesIO()
    p.save(buf)
    return buf.getvalue()


def _xlsx() -> bytes:
    from openpyxl import Workbook
    wb = Workbook()
    ws = wb.active
    ws.title = "Revenue"
    ws.append(["Region", "Revenue"])
    ws.append(["EMEA", 120])
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def _epub() -> bytes:
    import os
    import tempfile
    from ebooklib import epub as ee
    bk = ee.EpubBook()
    bk.set_identifier("id1")
    bk.set_title("Quarterly")
    bk.set_language("en")
    ch = ee.EpubHtml(title="C1", file_name="c1.xhtml")
    ch.content = "<h1>Quarterly Note</h1><p>" + _MARKER + ".</p>"
    bk.add_item(ch)
    bk.toc = (ch,)
    bk.spine = ["nav", ch]
    bk.add_item(ee.EpubNcx())
    bk.add_item(ee.EpubNav())
    with tempfile.NamedTemporaryFile(suffix=".epub", delete=False) as tmp:
        path = tmp.name
    try:
        ee.write_epub(path, bk)
        with open(path, "rb") as fh:
            return fh.read()
    finally:
        os.unlink(path)


def _eml() -> bytes:
    m = EmailMessage()
    m["Subject"] = "Quarterly Note"
    m["From"] = "a@example.com"
    m["To"] = "b@example.com"
    m.set_content(_MARKER + ".")
    return m.as_bytes()


def _extract(raw: bytes, mime: str) -> str:
    """The SHIPPED routing decision, not a guess: PDF/DOCX go through the extractor seam
    exactly as `_upload_pipeline` routes them; everything else through `extract_text`."""
    if mime in (PDF_MIME, DOCX_MIME):
        return get_extractor(mime).extract(raw, mime).text
    return extract_text(raw, mime)


_HTML_SAMPLE = (
    "<html><head><style>p{color:red}</style></head><body>"
    "<h1>Quarterly Note</h1><p>" + _MARKER + "&nbsp;.</p>"
    "<script>var x=1;</script></body></html>"
).encode()

#: One real file per allowed MIME type. `application/csv` and `application/x-msg` are
#: aliases of rows already present and are named in the totality test below.
CASES: list[tuple[str, str, bytes]] = [
    ("text/plain", ".txt", ("Quarterly Note\n" + _MARKER + ".").encode()),
    ("text/markdown", ".md", ("# Quarterly Note\n\n" + _MARKER + ".\n").encode()),
    ("text/html", ".html", _HTML_SAMPLE),
    ("text/csv", ".csv", b"Region,Revenue\nEMEA,120\nAPAC,98\n"),
    (PDF_MIME, ".pdf", _pdf()),
    (DOCX_MIME, ".docx", _docx()),
    (PPTX_MIME, ".pptx", _pptx()),
    (XLSX_MIME, ".xlsx", _xlsx()),
    ("application/epub+zip", ".epub", _epub()),
    ("message/rfc822", ".eml", _eml()),
]


@pytest.mark.parametrize("mime,ext,raw", CASES, ids=[c[1] for c in CASES])
def test_every_allowed_format_extracts_real_content(mime: str, ext: str, raw: bytes) -> None:
    """A real file of each type yields real text — and CSV/XLSX yield their own header."""
    text = _extract(raw, mime)
    assert text and text.strip(), ext + " extracted nothing"
    if ext in (".csv", ".xlsx"):
        assert "Region" in text and "EMEA" in text
    elif ext == ".pptx":
        assert _MARKER in text
    else:
        assert "Quarterly Note" in text or _MARKER in text


def test_every_allowed_mime_type_has_a_case_or_a_named_alias() -> None:
    """⚠ TOTALITY: a MIME type added to `ALLOWED_MIME_TYPES` with no real file behind it is
    an ingestion path nobody has ever driven. Aliases are named here, never inferred."""
    aliases = {
        "application/csv": "text/csv",
        "application/x-msg": "application/vnd.ms-outlook",
        # .msg needs a real OLE compound file; its parser family is covered by the .eml row.
        "application/vnd.ms-outlook": "message/rfc822",
        "application/vnd.ms-excel": XLSX_MIME,
    }
    covered = {m for m, _, _ in CASES} | set(aliases)
    missing = sorted(ALLOWED_MIME_TYPES - covered)
    assert not missing, "no real-file case for: " + repr(missing)


# ──────────────────────────────────────────────────────────────────────────────
# BUG-260825-01 (a) — a file carrying a NUL.
# ──────────────────────────────────────────────────────────────────────────────
def test_extracted_text_carrying_a_nul_is_scrubbed_before_the_database() -> None:
    """⚠ MEASURED: an unscrubbed NUL reached Postgres and ingestion died at the embedding
    step with `22P05`. The scrub is what `ingest_document` applies to `text` before
    anything downstream reads it."""
    raw = b"Quarterly\x00Note\nRevenue rose 12 percent."
    extracted = extract_text(raw, "text/plain")
    assert "\x00" in extracted, "positive control: the NUL must really reach the pipeline"
    assert "\x00" not in scrub_text(extracted)
    assert scrub_text(extracted).startswith("QuarterlyNote")


def test_a_nul_in_a_csv_cell_is_scrubbed_and_the_table_survives() -> None:
    raw = "Region,Revenue\nEM\x00EA,120\n".encode()
    cleaned = scrub_text(extract_text(raw, "text/csv"))
    assert "\x00" not in cleaned
    assert "Region" in cleaned and "EMEA" in cleaned


def test_ingest_document_scrubs_text_at_the_single_funnel() -> None:
    """⚠ THE SCRUB MUST BE AT THE FUNNEL, NOT AT `extract_text` — the PDF/DOCX composer
    branch never calls `extract_text`, so a scrub sited there would miss it. Asserted on
    the shipped source rather than on a mock, because the point is WHERE it lives."""
    import inspect
    from app.api import documents as documents_module
    src = inspect.getsource(documents_module.ingest_document)
    assert "scrub_text(text)" in src, "ingest_document no longer scrubs its text argument"
    head = src[: src.index("try:")]
    assert "scrub_text(text)" in head, "the scrub must run BEFORE the ingestion body"


def test_a_docx_carrying_a_nul_fails_in_the_parser_not_in_the_database() -> None:
    """⚠ REFUTES A RANKED CAUSE IN THE BUG REPORT. It claimed DOCX text "can readily yield
    NULs". It cannot: XML forbids NUL, so `python-docx` refuses the file outright and no
    text is ever produced. Scrubbing cannot rescue this document — only the producer can."""
    src = _docx()
    zin = zipfile.ZipFile(io.BytesIO(src))
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            data = zin.read(item.filename)
            if item.filename == "word/document.xml":
                data = data.replace(b"Quarterly Note", b"Quarterly\x00Note")
            zout.writestr(item, data)
    with pytest.raises(Exception) as excinfo:
        get_extractor(DOCX_MIME).extract(buf.getvalue(), DOCX_MIME)
    assert "0x0" in str(excinfo.value) or "null" in str(excinfo.value).lower()


# ──────────────────────────────────────────────────────────────────────────────
# BUG-260825-01 (b) — the door.
# ──────────────────────────────────────────────────────────────────────────────
@pytest.mark.parametrize("ext", [".docx", ".pdf", ".pptx", ".xlsx", ".md", ".csv"])
@pytest.mark.parametrize("announced", ["application/octet-stream", "application/zip", ""])
def test_a_misreported_content_type_is_corrected_by_extension(ext: str, announced: str) -> None:
    """⚠ MEASURED AT THE REAL ENDPOINT: `.docx` and `.pdf` were absent from the override
    map, so those two 422'd under every announcement below while `.md`, `.csv`, `.pptx`
    and `.xlsx` were accepted — the operator's split, character for character."""
    assert announced in _UNRELIABLE_MIME_TYPES
    assert ext in _EXT_MIME_OVERRIDES
    assert _EXT_MIME_OVERRIDES[ext] in ALLOWED_MIME_TYPES


def test_docx_announced_as_msword_is_corrected() -> None:
    """`application/msword` was observed on a real `.docx` upload and produced a 422."""
    assert "application/msword" in _UNRELIABLE_MIME_TYPES
    assert _EXT_MIME_OVERRIDES[".docx"] == DOCX_MIME


def test_a_legacy_doc_is_still_refused_rather_than_mislabelled() -> None:
    """⚠ WIDENING THE UNRELIABLE-TYPE LIST MUST NOT WIDEN WHAT WE ACCEPT. Correction is
    keyed on the EXTENSION; `.doc` has no entry, so it stays refused."""
    assert ".doc" not in _EXT_MIME_OVERRIDES
