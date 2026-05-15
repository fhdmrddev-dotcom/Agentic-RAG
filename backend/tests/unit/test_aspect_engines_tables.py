"""Unit tests for backend/app/services/extractors/aspects/tables.py.

Test 6: docling_tf_tables returns list[TableData] with bbox populated.
"""
from __future__ import annotations

from unittest.mock import MagicMock, patch

from app.services.extraction_service import PDF_MIME, TableData


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
