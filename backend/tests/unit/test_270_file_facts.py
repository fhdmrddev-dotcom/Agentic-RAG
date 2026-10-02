"""Phase 270 (FIND-05) — read_file_facts: pure, never raises, None never 0.

Fixtures are built in memory with pypdf / python-docx; no file on disk.
"""

from __future__ import annotations

import io
import zipfile
from datetime import datetime, timezone

from pypdf import PdfWriter

from app.services.extraction_service import DOCX_MIME, PDF_MIME
from app.services.file_facts import FileFacts, read_file_facts


def _pdf(pages: int = 3, metadata: dict | None = None, password: str | None = None) -> bytes:
    w = PdfWriter()
    for _ in range(pages):
        w.add_blank_page(width=200, height=200)
    if metadata:
        w.add_metadata(metadata)
    if password:
        w.encrypt(password)
    buf = io.BytesIO()
    w.write(buf)
    return buf.getvalue()


def _docx(author: str | None = "Bea", created: datetime | None = None, pages_xml: str | None = None) -> bytes:
    import docx

    d = docx.Document()
    d.add_paragraph("hello")
    if author is not None:
        d.core_properties.author = author
    if created is not None:
        d.core_properties.created = created
    buf = io.BytesIO()
    d.save(buf)
    raw = buf.getvalue()
    if pages_xml is None:
        return raw
    # Rewrite docProps/app.xml with a known Pages element.
    out = io.BytesIO()
    with zipfile.ZipFile(io.BytesIO(raw)) as zin, zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            if item.filename == "docProps/app.xml":
                continue
            zout.writestr(item, zin.read(item.filename))
        zout.writestr("docProps/app.xml", pages_xml)
    return out.getvalue()


def _app_xml(pages: int) -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">'
        f"<Pages>{pages}</Pages></Properties>"
    )


def test_pdf_with_metadata_yields_all_four_facts():
    raw = _pdf(3, {
        "/CreationDate": "D:20190312140300Z",
        "/ModDate": "D:20200101090000+02'00'",
        "/Author": "Ada Contract",
    })
    f = read_file_facts(raw, PDF_MIME)
    assert f.page_count == 3
    assert f.source_created_at == datetime(2019, 3, 12, 14, 3, 0, tzinfo=timezone.utc)
    assert f.source_modified_at == datetime(2020, 1, 1, 7, 0, 0, tzinfo=timezone.utc)
    assert f.source_author == "Ada Contract"


def test_malformed_date_is_none_but_other_facts_still_read():
    raw = _pdf(2, {"/CreationDate": "D:garbage", "/Author": "Ada"})
    f = read_file_facts(raw, PDF_MIME)
    assert f.source_created_at is None
    assert f.page_count == 2
    assert f.source_author == "Ada"


def test_naive_pdf_date_is_treated_as_utc():
    raw = _pdf(1, {"/CreationDate": "D:20190312140300"})
    f = read_file_facts(raw, PDF_MIME)
    assert f.source_created_at is not None
    assert f.source_created_at.tzinfo == timezone.utc
    assert f.source_created_at.hour == 14


def test_encrypted_pdf_yields_nothing_and_does_not_raise():
    raw = _pdf(2, {"/Author": "Ada"}, password="pw")
    assert read_file_facts(raw, PDF_MIME) == FileFacts()


def test_not_a_pdf_under_pdf_mime_yields_nothing():
    assert read_file_facts(b"not a pdf", PDF_MIME) == FileFacts()


def test_docx_core_properties_and_page_count():
    raw = _docx("Bea", datetime(2018, 5, 1), _app_xml(7))
    f = read_file_facts(raw, DOCX_MIME)
    assert f.source_author == "Bea"
    assert f.source_created_at == datetime(2018, 5, 1, tzinfo=timezone.utc)
    assert f.page_count == 7


def test_docx_zero_pages_or_no_app_xml_is_none_never_zero():
    assert read_file_facts(_docx("Bea", None, _app_xml(0)), DOCX_MIME).page_count is None
    # python-docx's default template ships an app.xml with no <Pages>; also strip it entirely.
    raw = _docx("Bea")
    out = io.BytesIO()
    with zipfile.ZipFile(io.BytesIO(raw)) as zin, zipfile.ZipFile(out, "w") as zout:
        for item in zin.infolist():
            if item.filename != "docProps/app.xml":
                zout.writestr(item, zin.read(item.filename))
    assert read_file_facts(out.getvalue(), DOCX_MIME).page_count is None


def test_other_mimes_yield_nothing():
    for mime in ("text/csv", "message/rfc822", "image/png"):
        assert read_file_facts(b"whatever", mime) == FileFacts()


def test_author_is_truncated_stripped_and_blank_becomes_none():
    long_author = "A" * 600
    f = read_file_facts(_pdf(1, {"/Author": long_author}), PDF_MIME)
    assert f.source_author is not None and len(f.source_author) == 512
    assert read_file_facts(_pdf(1, {"/Author": "   "}), PDF_MIME).source_author is None
    # A DOCX cannot carry a NUL (lxml refuses it), but a PDF string can; the cleaner is the one home.
    from app.services.file_facts import _clean_author

    assert _clean_author("Bea\x00X") == "BeaX"
    assert read_file_facts(_docx("Bea"), DOCX_MIME).source_author == "Bea"


def test_as_row_has_exactly_the_four_keys_with_iso_strings():
    f = FileFacts(
        page_count=3,
        source_created_at=datetime(2019, 3, 12, 14, 3, tzinfo=timezone.utc),
        source_modified_at=None,
        source_author="Ada",
    )
    row = f.as_row()
    assert set(row) == {"page_count", "source_created_at", "source_modified_at", "source_author"}
    assert row["page_count"] == 3
    assert row["source_created_at"] == "2019-03-12T14:03:00+00:00"
    assert row["source_modified_at"] is None
    assert FileFacts().as_row() == {
        "page_count": None,
        "source_created_at": None,
        "source_modified_at": None,
        "source_author": None,
    }
