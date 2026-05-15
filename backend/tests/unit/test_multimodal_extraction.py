"""
Unit tests for multimodal extraction (Phase 35).
Tests are RED until Plans 035-02 and 035-03 implement the service module.

MODAL-01: PDF/DOCX table extraction → document_tables
MODAL-02: PDF/DOCX image extraction → document_images (via vision LLM)
"""
import pytest
from unittest.mock import MagicMock, patch


# ---------------------------------------------------------------------------
# MODAL-01: Table extraction
# ---------------------------------------------------------------------------

def test_pdf_tables_inserted():
    """PDF bytes with a table → extract_and_store_tables inserts rows to document_tables."""
    from app.services.multimodal_service import extract_and_store_tables

    # Minimal 1-cell PDF table via pdfplumber mock
    mock_supabase = MagicMock()
    mock_builder = MagicMock()
    mock_supabase.table.return_value = mock_builder
    mock_builder.insert.return_value = mock_builder
    mock_builder.execute.return_value = MagicMock(data=[])

    fake_pdf_bytes = b"%PDF-1.4"  # pdfplumber will fail on this; patch it
    with patch("app.services.multimodal_service.extract_pdf_tables") as mock_extract:
        mock_extract.return_value = [
            {"page": 1, "table_index": 0, "headers": ["Col1", "Col2"], "rows": [["a", "b"]]}
        ]
        extract_and_store_tables(
            raw=fake_pdf_bytes,
            mime_type="application/pdf",
            document_id="doc-uuid-001",
            user_id="user-uuid-001",
            supabase=mock_supabase,
        )

    mock_supabase.table.assert_called_with("document_tables")
    insert_call_args = mock_builder.insert.call_args[0][0]
    assert isinstance(insert_call_args, list)
    assert len(insert_call_args) == 1
    row = insert_call_args[0]
    assert row["document_id"] == "doc-uuid-001"
    assert row["user_id"] == "user-uuid-001"
    assert row["page"] == 1
    assert row["headers"] == ["Col1", "Col2"]
    assert row["rows"] == [["a", "b"]]


def test_docx_tables_inserted():
    """DOCX bytes with a table → extract_and_store_tables inserts rows with page=None."""
    from app.services.multimodal_service import extract_and_store_tables

    mock_supabase = MagicMock()
    mock_builder = MagicMock()
    mock_supabase.table.return_value = mock_builder
    mock_builder.insert.return_value = mock_builder
    mock_builder.execute.return_value = MagicMock(data=[])

    docx_mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    with patch("app.services.multimodal_service.extract_docx_tables") as mock_extract:
        mock_extract.return_value = [
            {"page": None, "table_index": 0, "headers": ["H1"], "rows": [["v1"]]}
        ]
        extract_and_store_tables(
            raw=b"PK...",
            mime_type=docx_mime,
            document_id="doc-uuid-002",
            user_id="user-uuid-001",
            supabase=mock_supabase,
        )

    insert_call_args = mock_builder.insert.call_args[0][0]
    assert insert_call_args[0]["page"] is None


def test_table_extraction_failure_continues():
    """If extract_pdf_tables raises, extract_and_store_tables silently returns without raising."""
    from app.services.multimodal_service import extract_and_store_tables

    mock_supabase = MagicMock()

    with patch("app.services.multimodal_service.extract_pdf_tables") as mock_extract:
        mock_extract.side_effect = RuntimeError("pdfplumber exploded")
        # Must NOT raise
        extract_and_store_tables(
            raw=b"%PDF-1.4",
            mime_type="application/pdf",
            document_id="doc-uuid-003",
            user_id="user-uuid-001",
            supabase=mock_supabase,
        )

    # No table insert should have occurred
    mock_supabase.table.assert_not_called()


# ---------------------------------------------------------------------------
# MODAL-02: Image extraction
# ---------------------------------------------------------------------------

def test_pdf_images_stored():
    """PDF images above 50x50 → extract_and_store_images stores description rows."""
    from app.services.multimodal_service import extract_and_store_images

    mock_supabase = MagicMock()
    mock_builder = MagicMock()
    mock_supabase.table.return_value = mock_builder
    mock_builder.insert.return_value = mock_builder
    mock_builder.execute.return_value = MagicMock(data=[])

    mock_settings = MagicMock()
    mock_settings.llm_model = "openai/gpt-4o"
    mock_settings.llm_api_key = "test-key"
    mock_settings.llm_base_url = ""

    with patch("app.services.multimodal_service.extract_pdf_images") as mock_imgs, \
         patch("app.services.multimodal_service.describe_image") as mock_desc:
        mock_imgs.return_value = [
            {"page": 1, "image_index": 0, "b64_png": "abc123", "width": 200, "height": 200}
        ]
        mock_desc.return_value = "A bar chart showing quarterly revenue."
        extract_and_store_images(
            raw=b"%PDF-1.4",
            mime_type="application/pdf",
            document_id="doc-uuid-004",
            user_id="user-uuid-001",
            supabase=mock_supabase,
            app_settings=mock_settings,
        )

    mock_supabase.table.assert_any_call("document_images")
    # Find the document_images insert call (first insert; chunk insert may follow)
    all_insert_calls = mock_builder.insert.call_args_list
    img_insert_args = all_insert_calls[0][0][0]
    assert isinstance(img_insert_args, list)
    row = img_insert_args[0]
    assert row["document_id"] == "doc-uuid-004"
    assert row["description"] == "A bar chart showing quarterly revenue."
    assert row["page"] == 1
    assert "b64_png" not in row  # base64 must NOT be persisted


def test_small_images_skipped():
    """Images below 50x50 px are not passed to describe_image and not inserted."""
    from app.services.multimodal_service import extract_and_store_images

    mock_supabase = MagicMock()
    mock_settings = MagicMock()

    with patch("app.services.multimodal_service.extract_pdf_images") as mock_imgs, \
         patch("app.services.multimodal_service.describe_image") as mock_desc:
        mock_imgs.return_value = [
            {"page": 1, "image_index": 0, "b64_png": "tiny", "width": 30, "height": 30}
        ]
        extract_and_store_images(
            raw=b"%PDF-1.4",
            mime_type="application/pdf",
            document_id="doc-uuid-005",
            user_id="user-uuid-001",
            supabase=mock_supabase,
            app_settings=mock_settings,
        )

    mock_desc.assert_not_called()
    mock_supabase.table.assert_not_called()


def test_image_description_failure_continues():
    """If describe_image raises (e.g. vision model unsupported), ingestion continues with empty description."""
    from app.services.multimodal_service import extract_and_store_images

    mock_supabase = MagicMock()
    mock_builder = MagicMock()
    mock_supabase.table.return_value = mock_builder
    mock_builder.insert.return_value = mock_builder
    mock_builder.execute.return_value = MagicMock(data=[])

    mock_settings = MagicMock()

    with patch("app.services.multimodal_service.extract_pdf_images") as mock_imgs, \
         patch("app.services.multimodal_service.describe_image") as mock_desc:
        mock_imgs.return_value = [
            {"page": 2, "image_index": 0, "b64_png": "abc", "width": 100, "height": 100}
        ]
        mock_desc.side_effect = Exception("Model does not support vision")
        # Must NOT raise
        extract_and_store_images(
            raw=b"%PDF-1.4",
            mime_type="application/pdf",
            document_id="doc-uuid-006",
            user_id="user-uuid-001",
            supabase=mock_supabase,
            app_settings=mock_settings,
        )

    # When all image descriptions fail, no rows are inserted (images skipped)
    mock_builder.insert.assert_not_called()


def test_extract_pdf_images_reads_stream_bytes(tmp_path):
    """extract_pdf_images must call stream.get_data() when stream is a PDFStream-like object."""
    import io, base64
    from unittest.mock import MagicMock, patch
    from PIL import Image as PILImage

    # Build a 60x60 white PNG as fake stream data
    buf = io.BytesIO()
    PILImage.new("RGB", (60, 60), color=(255, 255, 255)).save(buf, format="PNG")
    png_bytes = buf.getvalue()

    mock_stream = MagicMock()
    mock_stream.get_data.return_value = png_bytes

    mock_img = {"width": 60, "height": 60, "stream": mock_stream}
    mock_page = MagicMock()
    mock_page.images = [mock_img]

    mock_pdf = MagicMock()
    mock_pdf.__enter__ = lambda s: s
    mock_pdf.__exit__ = MagicMock(return_value=False)
    mock_pdf.pages = [mock_page]

    with patch("pdfplumber.open", return_value=mock_pdf):
        from app.services.multimodal_service import extract_pdf_images
        results = extract_pdf_images(b"fake-pdf-bytes")

    assert len(results) == 1
    assert results[0]["width"] == 60
    assert results[0]["height"] == 60
    assert results[0]["b64_png"]  # non-empty base64
    mock_stream.get_data.assert_called_once()


# ---------------------------------------------------------------------------
# Phase 071.2 Plan 04 — D-071.2-08: multimodal_service consumes pre-extracted
# Docling tables/images via the optional `extracted_doc` kwarg, propagating bbox.
# ---------------------------------------------------------------------------

def test_extract_and_store_tables_uses_extracted_doc():
    """When extracted_doc is provided with tables, the legacy pdfplumber pass
    MUST NOT run; the inserted row MUST flow bbox through to document_tables
    (D-071.2-08 — closes the 4-vs-1 telemetry/storage mismatch + populates
    document_tables.bbox from migration 042).
    """
    from app.services.multimodal_service import extract_and_store_tables
    from app.services.extraction_service import ExtractedDocument, TableData

    mock_supabase = MagicMock()
    mock_builder = MagicMock()
    mock_supabase.table.return_value = mock_builder
    mock_builder.insert.return_value = mock_builder
    mock_builder.execute.return_value = MagicMock(data=[])

    ed = ExtractedDocument(
        text="",
        tables=(TableData(
            page=1, table_index=0,
            headers=["A", "B"], rows=[["1", "2"]],
            bbox={"x0": 0, "y0": 1, "x1": 2, "y1": 3},
        ),),
        images=(),
        table_extraction_error=None,
        image_extraction_error=None,
        full_markdown=None,
        extractor_name="docling",
    )

    # Patch extract_pdf_tables to AssertionError side_effect — if the precedence
    # rule is broken, the test will fail loudly rather than silently fall back.
    with patch(
        "app.services.multimodal_service.extract_pdf_tables",
        side_effect=AssertionError("pdfplumber must NOT run when extracted_doc is provided"),
    ):
        extract_and_store_tables(
            raw=b"%PDF",
            mime_type="application/pdf",
            document_id="d-1",
            user_id="u-1",
            supabase=mock_supabase,
            extracted_doc=ed,
        )

    # Verify document_tables INSERT was called with the Docling-supplied row.
    mock_supabase.table.assert_called_with("document_tables")
    insert_call_args = mock_builder.insert.call_args[0][0]
    assert isinstance(insert_call_args, list)
    assert len(insert_call_args) == 1
    row = insert_call_args[0]
    assert row["document_id"] == "d-1"
    assert row["user_id"] == "u-1"
    assert row["page"] == 1
    assert row["table_index"] == 0
    assert row["headers"] == ["A", "B"]
    assert row["rows"] == [["1", "2"]]
    # bbox flowed through to document_tables.bbox (D-071.2-08)
    assert row["bbox"] == {"x0": 0, "y0": 1, "x1": 2, "y1": 3}


def test_extract_and_store_images_uses_extracted_doc():
    """When extracted_doc is provided with images, the legacy pdfplumber pass
    MUST NOT run; the vision-LLM describe_image MUST still be invoked on the
    b64_png; the inserted row MUST flow bbox through to document_images.
    """
    from app.services.multimodal_service import extract_and_store_images
    from app.services.extraction_service import ExtractedDocument, ImageData

    mock_supabase = MagicMock()
    mock_builder = MagicMock()
    mock_supabase.table.return_value = mock_builder
    mock_builder.insert.return_value = mock_builder
    mock_builder.execute.return_value = MagicMock(data=[])

    mock_settings = MagicMock()
    mock_settings.llm_model = "openai/gpt-4o"
    mock_settings.llm_api_key = "test-key"
    mock_settings.llm_base_url = ""

    ed = ExtractedDocument(
        text="",
        tables=(),
        images=(ImageData(
            page=3, image_index=0,
            b64_png="ZmFrZQ==", width=200, height=200,
            bbox={"x0": 10, "y0": 20, "x1": 30, "y1": 40},
        ),),
        table_extraction_error=None,
        image_extraction_error=None,
        full_markdown=None,
        extractor_name="docling",
    )

    # Patch extract_pdf_images to AssertionError + describe_image to a stub.
    with patch(
        "app.services.multimodal_service.extract_pdf_images",
        side_effect=AssertionError("pdfplumber must NOT run when extracted_doc is provided"),
    ), patch(
        "app.services.multimodal_service.describe_image",
        return_value="stub desc",
    ) as mock_desc:
        extract_and_store_images(
            raw=b"%PDF",
            mime_type="application/pdf",
            document_id="d-2",
            user_id="u-1",
            supabase=mock_supabase,
            app_settings=mock_settings,
            extracted_doc=ed,
        )

    # Vision-LLM describe_image WAS invoked (image description loop preserved).
    mock_desc.assert_called_once()

    # document_images INSERT was called with the Docling-supplied image row.
    mock_supabase.table.assert_any_call("document_images")
    all_insert_calls = mock_builder.insert.call_args_list
    img_insert_args = all_insert_calls[0][0][0]
    assert isinstance(img_insert_args, list)
    assert len(img_insert_args) == 1
    row = img_insert_args[0]
    assert row["document_id"] == "d-2"
    assert row["page"] == 3
    assert row["description"] == "stub desc"
    # bbox flowed through to document_images.bbox (D-071.2-08)
    assert row["bbox"] == {"x0": 10, "y0": 20, "x1": 30, "y1": 40}
    # b64_png MUST NOT be persisted (D-069-04 storage contract preserved)
    assert "b64_png" not in row


def test_extract_and_store_tables_fallback_when_extracted_doc_none():
    """When extracted_doc is None (or omitted), the legacy pdfplumber pass
    MUST run — backward-compat for tests + call sites that don't supply
    the new kwarg (Pitfall 2 — default kwarg None preserves existing tests).
    """
    from app.services.multimodal_service import extract_and_store_tables

    mock_supabase = MagicMock()
    mock_builder = MagicMock()
    mock_supabase.table.return_value = mock_builder
    mock_builder.insert.return_value = mock_builder
    mock_builder.execute.return_value = MagicMock(data=[])

    with patch("app.services.multimodal_service.extract_pdf_tables") as mock_extract:
        mock_extract.return_value = [
            {"page": 1, "table_index": 0, "headers": ["Col1"], "rows": [["v1"]]}
        ]
        extract_and_store_tables(
            raw=b"%PDF",
            mime_type="application/pdf",
            document_id="d-3",
            user_id="u-1",
            supabase=mock_supabase,
            extracted_doc=None,
        )

    # Legacy pdfplumber pass ran exactly once (proves fallback path).
    mock_extract.assert_called_once()
    mock_supabase.table.assert_called_with("document_tables")
