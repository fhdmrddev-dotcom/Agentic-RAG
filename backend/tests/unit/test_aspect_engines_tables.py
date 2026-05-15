"""Unit tests for backend/app/services/extractors/aspects/tables.py.

Test 6: docling_tf_tables returns list[TableData] with bbox populated.
Phase 071.3 Plan 02: camelot_tables (winner adapter) — happy path + invalid mime
+ no-table-PDF smoke.
"""
from __future__ import annotations

import io
from pathlib import Path
from unittest.mock import MagicMock, patch

from app.services.extraction_service import PDF_MIME, TableData


FIXTURES = Path(__file__).parent.parent / "fixtures" / "extraction"
FRIENDLY_PDF = FIXTURES / "friendly_real.pdf"


def test_docling_tf_tables_returns_table_data_with_bbox():
    """With a mocked _get_converter, docling_tf_tables returns list[TableData]
    and each item has bbox populated."""
    from app.services.extractors.aspects import tables as aspect_tables

    # Build a fake Docling result.document.tables iterable
    fake_table = MagicMock()
    fake_prov = MagicMock()
    fake_prov.page_no = 1
    fake_bbox = MagicMock()
    fake_bbox.model_dump.return_value = {"l": 0.0, "t": 0.0, "r": 100.0, "b": 50.0}
    fake_prov.bbox = fake_bbox
    fake_table.prov = [fake_prov]
    fake_table.data = MagicMock()
    fake_table.data.grid = [
        [MagicMock(text="ColA"), MagicMock(text="ColB")],
        [MagicMock(text="a1"), MagicMock(text="b1")],
    ]

    fake_doc = MagicMock()
    fake_doc.tables = [fake_table]
    fake_result = MagicMock()
    fake_result.document = fake_doc

    fake_converter = MagicMock()
    fake_converter.convert.return_value = fake_result

    with patch(
        "app.services.extractors.docling._get_converter",
        return_value=fake_converter,
    ):
        out = aspect_tables.docling_tf_tables(b"%PDF-fake", PDF_MIME)

    assert isinstance(out, list)
    assert len(out) == 1
    assert isinstance(out[0], TableData)
    assert out[0].bbox is not None
    assert out[0].headers == ["ColA", "ColB"]


def test_pdfplumber_tables_wraps_multimodal_helper():
    """pdfplumber_tables delegates to multimodal_service.extract_pdf_tables."""
    from app.services.extractors.aspects import tables as aspect_tables

    with patch(
        "app.services.multimodal_service.extract_pdf_tables",
        return_value=[
            {"page": 1, "table_index": 0, "headers": ["x"], "rows": [["1"]]}
        ],
    ):
        out = aspect_tables.pdfplumber_tables(b"%PDF-fake", PDF_MIME)

    assert isinstance(out, list)
    assert len(out) == 1
    assert isinstance(out[0], TableData)
    assert out[0].page == 1


# ---------------------------------------------------------------------------
# Phase 071.3 Plan 02 — camelot_tables (winner per WINNER.md, D-071.3-05)
# ---------------------------------------------------------------------------


def test_camelot_tables_happy_path():
    """camelot_tables on the committed friendly_real.pdf fixture returns
    list[TableData] with the expected shape: each item has list[str] headers,
    list[list[str]] rows, and bbox (dict | None).

    Recall variance acceptable per D-071.3-17 — we assert SHAPE, not minimum
    count. The bench (Plan 01) found 15 tables on friendly_real with
    flavor=stream; this test only asserts the contract holds.
    """
    from app.services.extractors.aspects.tables import camelot_tables

    assert FRIENDLY_PDF.exists(), f"Missing fixture: {FRIENDLY_PDF}"
    raw = FRIENDLY_PDF.read_bytes()
    out = camelot_tables(raw, PDF_MIME)

    assert isinstance(out, list)
    # Camelot flavor=stream always returns >=1 table on any text PDF; assert
    # contract shape rather than a magic count.
    for t in out:
        assert isinstance(t, TableData)
        assert isinstance(t.headers, list)
        assert all(isinstance(h, str) for h in t.headers)
        assert isinstance(t.rows, list)
        for row in t.rows:
            assert isinstance(row, list)
            assert all(isinstance(c, str) for c in row)
        # bbox may be None or dict with l/t/r/b/page keys
        assert t.bbox is None or (
            isinstance(t.bbox, dict)
            and {"l", "t", "r", "b", "page"}.issubset(t.bbox.keys())
        )
        assert t.page is None or isinstance(t.page, int)
        assert isinstance(t.table_index, int)


def test_camelot_tables_invalid_mime_returns_empty():
    """Non-PDF mime short-circuits to [] without touching camelot."""
    from app.services.extractors.aspects.tables import camelot_tables

    assert camelot_tables(b"plain text", "text/plain") == []
    assert (
        camelot_tables(
            b"PK\x03\x04",  # zip header — DOCX would start like this
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )
        == []
    )


def test_camelot_tables_empty_pdf_returns_empty():
    """A valid PDF with no tabular content does not crash camelot_tables.

    Per D-071.3-06, the adapter does not swallow internal failures — but a
    legitimately structured PDF with only a line of text must complete
    successfully and return a list (camelot's stream-mode treats stray text
    as a 1x1 'table'; we assert the call doesn't raise and returns a list).
    """
    from app.services.extractors.aspects.tables import camelot_tables

    # Synthesize a minimal valid PDF (header + catalog + page) via reportlab
    # — already a project dep (Phase 069 test fixtures).
    from reportlab.pdfgen import canvas  # noqa: PLC0415

    buf = io.BytesIO()
    c = canvas.Canvas(buf)
    c.drawString(100, 750, "No tables here.")
    c.showPage()
    c.save()

    out = camelot_tables(buf.getvalue(), PDF_MIME)
    assert isinstance(out, list)
    # Either empty OR a degenerate single-cell 'table' — both shapes acceptable.
    for t in out:
        assert isinstance(t, TableData)
