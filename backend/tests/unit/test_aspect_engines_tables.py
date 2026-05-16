"""Unit tests for backend/app/services/extractors/aspects/tables.py.

Phase 071.3 Plan 04 (D-071.3-09): docling_tf_tables removed entirely.
Plan 02 winner adapter — camelot_tables — covered here alongside the
pdfplumber adapter (the only two engines remaining in TABLE_ENGINES).
"""
from __future__ import annotations

import io
from pathlib import Path
from unittest.mock import patch

from app.services.extraction_service import PDF_MIME, TableData


FIXTURES = Path(__file__).parent.parent / "fixtures" / "extraction"
FRIENDLY_PDF = FIXTURES / "friendly_real.pdf"


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

    Per D-071.3-06, the adapter does not swallow internal failures. With the
    071.4-01 precision floor (SEED-022 mitigation), any 1x1 degenerate "table"
    that camelot synthesizes from a stray line of text is now rejected at the
    floor — so this PDF must return an EMPTY list.
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
    # After 071.4-01 precision floor: degenerate 1x1 "tables" are rejected.
    assert out == [], (
        f"Expected empty list after precision floor; got {len(out)} tables: {out}"
    )


# ---------------------------------------------------------------------------
# Phase 071.4 Plan 01 — camelot precision floor (SEED-022 partial mitigation)
# ---------------------------------------------------------------------------


def _fake_camelot_table(df_rows: int, df_cols: int, page: int = 1):
    """Build a Mock that quacks like a camelot Table for floor-rejection tests.

    Only needs the attributes camelot_tables actually reads: .df (with .index,
    .columns, .iloc), ._bbox, .page.
    """
    import pandas as pd  # noqa: PLC0415

    data = [["c"] * df_cols for _ in range(df_rows)]
    df = pd.DataFrame(data)

    class _FakeTable:
        pass

    t = _FakeTable()
    t.df = df
    t._bbox = (10.0, 20.0, 100.0, 200.0)
    t.page = page
    return t


def test_camelot_tables_precision_floor_rejects_single_row():
    """A camelot region with only 1 row (header alone, no data) is not a real
    table — reject at the floor per SEED-022 / 071.4-01.
    """
    from app.services.extractors.aspects import tables as aspect_tables

    fakes = [_fake_camelot_table(df_rows=1, df_cols=3)]

    with patch(
        "camelot.read_pdf", return_value=fakes
    ):
        # Reuse the same minimal PDF — content doesn't matter, camelot is mocked.
        from reportlab.pdfgen import canvas  # noqa: PLC0415

        buf = io.BytesIO()
        c = canvas.Canvas(buf)
        c.drawString(100, 750, "x")
        c.showPage()
        c.save()
        out = aspect_tables.camelot_tables(buf.getvalue(), PDF_MIME)

    assert out == [], (
        f"Single-row region must be rejected by the floor; got {len(out)} tables"
    )


def test_camelot_tables_precision_floor_rejects_single_col():
    """A camelot region with only 1 column (a list, not a table) is rejected."""
    from app.services.extractors.aspects import tables as aspect_tables

    fakes = [_fake_camelot_table(df_rows=8, df_cols=1)]

    with patch(
        "camelot.read_pdf", return_value=fakes
    ):
        from reportlab.pdfgen import canvas  # noqa: PLC0415

        buf = io.BytesIO()
        c = canvas.Canvas(buf)
        c.drawString(100, 750, "x")
        c.showPage()
        c.save()
        out = aspect_tables.camelot_tables(buf.getvalue(), PDF_MIME)

    assert out == [], (
        f"Single-column region must be rejected by the floor; got {len(out)} tables"
    )


def test_camelot_tables_precision_floor_accepts_2x2_minimum():
    """A 2x2 region (smallest real table) is NOT rejected — the floor is a
    strict minimum, not a recommendation. 2 rows + 2 cols passes.
    """
    from app.services.extractors.aspects import tables as aspect_tables

    fakes = [_fake_camelot_table(df_rows=2, df_cols=2)]

    with patch(
        "camelot.read_pdf", return_value=fakes
    ):
        from reportlab.pdfgen import canvas  # noqa: PLC0415

        buf = io.BytesIO()
        c = canvas.Canvas(buf)
        c.drawString(100, 750, "x")
        c.showPage()
        c.save()
        out = aspect_tables.camelot_tables(buf.getvalue(), PDF_MIME)

    assert len(out) == 1, f"2x2 must pass the floor; got {len(out)} tables"
    assert isinstance(out[0], TableData)
    # First row becomes header, remaining rows become data.
    assert len(out[0].headers) == 2
    assert len(out[0].rows) == 1  # 2 df rows - 1 header = 1 data row
