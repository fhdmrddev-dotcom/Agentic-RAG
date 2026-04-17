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

    mock_supabase.table.assert_called_with("document_images")
    insert_call_args = mock_builder.insert.call_args[0][0]
    assert isinstance(insert_call_args, list)
    row = insert_call_args[0]
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

    # Row should still be inserted with empty description
    insert_call_args = mock_builder.insert.call_args[0][0]
    assert insert_call_args[0]["description"] == ""
