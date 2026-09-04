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

    mock_supabase.table.assert_any_call("document_tables")
    insert_call_args = mock_builder.insert.call_args_list[0][0][0]
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

    mock_supabase.table.assert_any_call("document_tables")
    insert_call_args = mock_builder.insert.call_args_list[0][0][0]
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
    # Phase 072 D-072-08: production code now reads cap + size from app_settings.
    # Set the attrs explicitly so MagicMock doesn't auto-magic them into
    # un-comparable Mock objects.
    mock_settings.multimodal_max_vision_calls = 100
    mock_settings.multimodal_max_b64_bytes_kb = 4096

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
    """Vision API failure → describe_image raises → ingestion continues, and the
    row persists with description='' (Phase 072 D-072-03 — INVERTS the
    pre-072 contract that dropped the row on failure). A future /reextract
    can refill the empty description cheaply (Plan 03 lazy retry).
    """
    from app.services.multimodal_service import extract_and_store_images

    mock_supabase = MagicMock()
    mock_builder = MagicMock()
    mock_supabase.table.return_value = mock_builder
    mock_builder.insert.return_value = mock_builder
    mock_builder.execute.return_value = MagicMock(data=[{"chunk_index": 0}])

    mock_settings = MagicMock()
    mock_settings.llm_model = "openai/gpt-4o"
    mock_settings.llm_api_key = "test-key"
    mock_settings.llm_base_url = ""
    mock_settings.multimodal_max_vision_calls = 100
    mock_settings.multimodal_max_b64_bytes_kb = 4096

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

    # D-072-03 inversion: row persists with description=''. The pre-072 code
    # dropped the row (asserted insert.assert_not_called); Phase 072 inverts.
    assert mock_builder.insert.called, "Expected document_images INSERT for empty-description row"


# ---------------------------------------------------------------------------
# Phase 072 Plan 01 — D-072-02 / D-072-03 / D-072-08
# Tests for: app_settings cap read + shared downscale helper + persist empty rows.
# ---------------------------------------------------------------------------

def test_app_settings_max_vision_calls_read():
    """Phase 072 D-072-08: extract_and_store_images reads the cap from
    app_settings.multimodal_max_vision_calls (NOT the deleted _MAX_VISION_CALLS
    module constant; NOT the default 100). Setting cap=3 with 10 stubbed images
    results in exactly 3 describe_image calls.
    """
    from app.services.multimodal_service import extract_and_store_images

    mock_supabase = MagicMock()
    mock_builder = MagicMock()
    mock_supabase.table.return_value = mock_builder
    mock_builder.insert.return_value = mock_builder
    mock_builder.execute.return_value = MagicMock(data=[{"chunk_index": 0}])

    mock_settings = MagicMock()
    mock_settings.llm_model = "openai/gpt-4o"
    mock_settings.llm_api_key = "test-key"
    mock_settings.llm_base_url = ""
    mock_settings.multimodal_max_vision_calls = 3
    mock_settings.multimodal_max_b64_bytes_kb = 4096  # 4 MB — won't trip
    mock_settings.embedding_model = "openai/text-embedding-3-small"

    ten_images = [
        {"page": 1, "image_index": i, "b64_png": "a" * 16, "width": 100, "height": 100}
        for i in range(10)
    ]

    with patch("app.services.multimodal_service.extract_pdf_images") as mock_imgs, \
         patch("app.services.multimodal_service.describe_image") as mock_desc:
        mock_imgs.return_value = ten_images
        mock_desc.return_value = "fake description"
        extract_and_store_images(
            raw=b"%PDF",
            mime_type="application/pdf",
            document_id="doc-072-01-t1",
            user_id="user-072-01-t1",
            supabase=mock_supabase,
            app_settings=mock_settings,
        )

    # CAP HONORED: exactly 3 describe_image calls (NOT 10, NOT 20, NOT 100).
    assert mock_desc.call_count == 3, (
        f"Expected 3 describe_image calls (cap from app_settings); got {mock_desc.call_count}"
    )


def test_downscale_before_vision_call():
    """Phase 072 D-072-02: every image larger than MULTIMODAL_THUMBNAIL_MAX_EDGE
    (1024px on the longest edge) is downscaled in-place via PIL.thumbnail BEFORE
    the vision-LLM call. Assert by intercepting the b64 string passed into
    describe_image and decoding it.

    Internally exercises the shared `_downscale_b64_for_vision` helper which
    Plan 03 also calls from the retry path (WARNING 3 — single-source invariant).
    """
    import base64
    import io
    from PIL import Image as PILImage
    from app.services.multimodal_service import extract_and_store_images

    # Build a 2048x2048 PNG to test downscale.
    big_buf = io.BytesIO()
    PILImage.new("RGB", (2048, 2048), color=(128, 128, 128)).save(big_buf, format="PNG")
    big_b64 = base64.b64encode(big_buf.getvalue()).decode("ascii")

    mock_supabase = MagicMock()
    mock_builder = MagicMock()
    mock_supabase.table.return_value = mock_builder
    mock_builder.insert.return_value = mock_builder
    mock_builder.execute.return_value = MagicMock(data=[{"chunk_index": 0}])

    mock_settings = MagicMock()
    mock_settings.llm_model = "openai/gpt-4o"
    mock_settings.llm_api_key = "test-key"
    mock_settings.llm_base_url = ""
    mock_settings.multimodal_max_vision_calls = 100
    mock_settings.multimodal_max_b64_bytes_kb = 999999  # don't trip size guard
    mock_settings.embedding_model = "openai/text-embedding-3-small"

    captured_b64: list[str] = []

    def fake_describe(b64_arg, settings_arg, client=None):
        captured_b64.append(b64_arg)
        return "stubbed description"

    with patch("app.services.multimodal_service.extract_pdf_images") as mock_imgs, \
         patch("app.services.multimodal_service.describe_image", side_effect=fake_describe):
        mock_imgs.return_value = [
            {"page": 1, "image_index": 0, "b64_png": big_b64, "width": 2048, "height": 2048}
        ]
        extract_and_store_images(
            raw=b"%PDF",
            mime_type="application/pdf",
            document_id="doc-072-01-t2",
            user_id="user-072-01-t2",
            supabase=mock_supabase,
            app_settings=mock_settings,
        )

    assert len(captured_b64) == 1, f"Expected 1 describe_image call, got {len(captured_b64)}"
    sent_bytes = base64.b64decode(captured_b64[0])
    sent_img = PILImage.open(io.BytesIO(sent_bytes))
    assert max(sent_img.width, sent_img.height) <= 1024, (
        f"Image not downscaled: sent {sent_img.width}x{sent_img.height}, expected <=1024 on longest edge"
    )


def test_persist_empty_description_row():
    """Phase 072 D-072-03: when describe_image returns '' (or raises), the
    document_images INSERT still fires with description=''. The pre-072 code
    used an early-continue to drop the row entirely (mock_builder.insert
    asserted NOT called). Phase 072 inverts: row persists; chunk embedding
    still skipped (no content to embed) but the image entry survives for a
    later /reextract retry.
    """
    from app.services.multimodal_service import extract_and_store_images

    mock_supabase = MagicMock()
    mock_builder = MagicMock()
    mock_supabase.table.return_value = mock_builder
    mock_builder.insert.return_value = mock_builder
    mock_builder.execute.return_value = MagicMock(data=[{"chunk_index": 0}])

    mock_settings = MagicMock()
    mock_settings.llm_model = "openai/gpt-4o"
    mock_settings.llm_api_key = "test-key"
    mock_settings.llm_base_url = ""
    mock_settings.multimodal_max_vision_calls = 100
    mock_settings.multimodal_max_b64_bytes_kb = 4096
    mock_settings.embedding_model = "openai/text-embedding-3-small"

    with patch("app.services.multimodal_service.extract_pdf_images") as mock_imgs, \
         patch("app.services.multimodal_service.describe_image") as mock_desc:
        mock_imgs.return_value = [
            {"page": 5, "image_index": 0, "b64_png": "a" * 16, "width": 200, "height": 200}
        ]
        mock_desc.return_value = ""  # vision returns empty — must NOT drop the row
        extract_and_store_images(
            raw=b"%PDF",
            mime_type="application/pdf",
            document_id="doc-072-01-t3",
            user_id="user-072-01-t3",
            supabase=mock_supabase,
            app_settings=mock_settings,
        )

    # Find the document_images INSERT (table_call sequence is table().insert().execute()).
    # The chunk-embedding pass is also bypassed (empty desc → no chunk rows), so only
    # one document_images insert call is expected.
    image_table_calls = [
        c for c in mock_supabase.table.call_args_list if c.args and c.args[0] == "document_images"
    ]
    assert len(image_table_calls) >= 1, "document_images table().insert() never invoked"

    # The insert payload must contain exactly one row with description=''.
    insert_payloads = [
        call.args[0]
        for call in mock_builder.insert.call_args_list
        if call.args and isinstance(call.args[0], list)
    ]
    # Find the payload that contains a row with our document_id (filters out chunk_rows).
    image_payload = None
    for p in insert_payloads:
        if p and isinstance(p[0], dict) and p[0].get("document_id") == "doc-072-01-t3" and "description" in p[0]:
            image_payload = p
            break
    assert image_payload is not None, f"Could not find document_images payload in inserts: {insert_payloads!r}"
    assert len(image_payload) == 1, f"Expected exactly 1 image row, got {len(image_payload)}"
    assert image_payload[0]["description"] == "", (
        f"Expected description='', got {image_payload[0].get('description')!r}"
    )


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
    mock_supabase.table.assert_any_call("document_tables")
    insert_call_args = mock_builder.insert.call_args_list[0][0][0]
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
    # Phase 072 D-072-08: production code now reads cap + size from app_settings.
    mock_settings.multimodal_max_vision_calls = 100
    mock_settings.multimodal_max_b64_bytes_kb = 4096

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


def test_dedup_images_by_hash_drops_duplicates():
    """Phase 072 D-072-06 EXTENDED: _dedup_images_by_hash drops duplicates
    by SHA1 of b64. First-occurrence wins (preserves image_index ordering).
    Works for both dict and ImageData shape.
    """
    from app.services.multimodal_service import _dedup_images_by_hash

    # Dict shape (legacy).
    items = [
        {"b64_png": "PAYLOAD-A", "image_index": 0},
        {"b64_png": "PAYLOAD-B", "image_index": 1},
        {"b64_png": "PAYLOAD-A", "image_index": 2},  # duplicate of item 0
        {"b64_png": "PAYLOAD-C", "image_index": 3},
    ]
    out = _dedup_images_by_hash(items)
    assert len(out) == 3, f"Expected 3 unique, got {len(out)}"
    # First-occurrence wins — item 0 stays, item 2 (dup) drops.
    indexes = [r["image_index"] for r in out]
    assert indexes == [0, 1, 3], f"Expected ordering [0,1,3], got {indexes}"

    # ImageData (frozen dataclass) shape.
    from app.services.extraction_service import ImageData
    img_items = [
        ImageData(page=1, image_index=0, b64_png="X", width=10, height=10, bbox=None),
        ImageData(page=2, image_index=1, b64_png="Y", width=10, height=10, bbox=None),
        ImageData(page=3, image_index=2, b64_png="X", width=10, height=10, bbox=None),  # dup
    ]
    out2 = _dedup_images_by_hash(img_items)
    assert len(out2) == 2, f"Expected 2 unique, got {len(out2)}"
    assert [im.image_index for im in out2] == [0, 1]


def test_docx_image_label_prefix_in_chunk_content():
    """Phase 072 D-072-06: when document_images.bbox has a 'location' key
    (DOCX path; page=None), the chunk-embedding loop uses that for the
    description prefix instead of the bare '[Image]:'.
    """
    from app.services.multimodal_service import extract_and_store_images
    from app.services.extraction_service import ExtractedDocument, ImageData

    mock_supabase = MagicMock()
    mock_builder = MagicMock()
    mock_supabase.table.return_value = mock_builder
    mock_builder.insert.return_value = mock_builder
    mock_builder.execute.return_value = MagicMock(data=[{"chunk_index": 0}])

    mock_settings = MagicMock()
    mock_settings.llm_model = "openai/gpt-4o"
    mock_settings.llm_api_key = "test-key"
    mock_settings.llm_base_url = ""
    mock_settings.multimodal_max_vision_calls = 100
    mock_settings.multimodal_max_b64_bytes_kb = 4096
    mock_settings.embedding_model = "openai/text-embedding-3-small"

    # ExtractedDocument with two DOCX ImageData entries (page=None, bbox has location).
    # ImageData is frozen — must construct with all fields at instantiation time.
    ed = ExtractedDocument(
        text="",
        tables=(),
        images=(
            ImageData(page=None, image_index=0, b64_png="HEADERBYTES",
                      width=200, height=200, bbox={"location": "header"}),
            ImageData(page=None, image_index=1, b64_png="FLOATBYTES",
                      width=200, height=200, bbox={"location": "floating"}),
        ),
        table_extraction_error=None,
        image_extraction_error=None,
        full_markdown=None,
        extractor_name="composable[legacy/camelot/zip_xpath/none]",
    )

    with patch("app.services.multimodal_service.describe_image") as mock_desc, \
         patch("app.services.multimodal_service.embed_texts") as mock_embed:
        mock_desc.side_effect = ["The company logo.", "A flowchart figure."]
        mock_embed.return_value = [[0.1] * 1536, [0.2] * 1536]
        extract_and_store_images(
            raw=b"PK",
            mime_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            document_id="doc-072-02-t2",
            user_id="user-072-02-t2",
            supabase=mock_supabase,
            app_settings=mock_settings,
            extracted_doc=ed,
        )

    # Collect document_chunks INSERT payload (look for content field on rows).
    chunk_inserts = []
    for call in mock_builder.insert.call_args_list:
        if call.args and isinstance(call.args[0], list) and call.args[0]:
            first = call.args[0][0]
            if isinstance(first, dict) and "content" in first and "embedding" in first:
                chunk_inserts.extend(call.args[0])
    assert len(chunk_inserts) == 2, (
        f"Expected 2 chunk rows; got {len(chunk_inserts)}: {chunk_inserts!r}"
    )
    contents = sorted(r["content"] for r in chunk_inserts)
    assert contents[0].startswith("[Image floating]:"), (
        f"Expected '[Image floating]:' prefix; got {contents[0]!r}"
    )
    assert contents[1].startswith("[Image header]:"), (
        f"Expected '[Image header]:' prefix; got {contents[1]!r}"
    )


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
    mock_supabase.table.assert_any_call("document_tables")


# ---------------------------------------------------------------------------
# Phase 201 TAB-01: CSV and Excel table extraction
# ---------------------------------------------------------------------------

def test_extract_csv_tables_basic():
    """CSV bytes with headers + data rows → single table dict with correct headers/rows."""
    from app.services.multimodal_service import extract_csv_tables
    result = extract_csv_tables(b"Name,Age,Role\nAlice,30,Engineer\nBob,25,Designer")
    assert len(result) == 1
    tbl = result[0]
    assert tbl["headers"] == ["Name", "Age", "Role"]
    assert tbl["rows"] == [["Alice", "30", "Engineer"], ["Bob", "25", "Designer"]]
    assert tbl["page"] == 1
    assert tbl["table_index"] == 0


def test_extract_csv_tables_semicolon_delimiter():
    """CSV with semicolon delimiter is auto-detected via Sniffer."""
    from app.services.multimodal_service import extract_csv_tables
    result = extract_csv_tables(b"Name;Age\nAlice;30")
    assert len(result) == 1
    assert result[0]["headers"] == ["Name", "Age"]
    assert result[0]["rows"] == [["Alice", "30"]]


def test_extract_csv_tables_tab_delimiter():
    """TSV (tab-delimited) is auto-detected via Sniffer."""
    from app.services.multimodal_service import extract_csv_tables
    result = extract_csv_tables(b"Name\tAge\nAlice\t30")
    assert len(result) == 1
    assert result[0]["headers"] == ["Name", "Age"]


def test_extract_csv_tables_header_normalization():
    """Empty or purely-numeric header cells are replaced with 'Column N'."""
    from app.services.multimodal_service import extract_csv_tables
    # First header is empty, second is numeric
    result = extract_csv_tables(b",42,Role\nAlice,30,Engineer")
    assert len(result) == 1
    assert result[0]["headers"] == ["Column 1", "Column 2", "Role"]


def test_extract_csv_tables_blank_rows_filtered():
    """Blank trailing rows in a CSV are excluded from the result rows."""
    from app.services.multimodal_service import extract_csv_tables
    result = extract_csv_tables(b"Name,Age\nAlice,30\n\n\nBob,25\n")
    assert len(result) == 1
    assert result[0]["rows"] == [["Alice", "30"], ["Bob", "25"]]


def test_extract_csv_tables_empty_file_returns_empty():
    """An empty or all-blank CSV returns []."""
    from app.services.multimodal_service import extract_csv_tables
    assert extract_csv_tables(b"") == []
    assert extract_csv_tables(b"\n\n\n") == []


def test_extract_csv_tables_header_only_returns_empty():
    """A CSV with only a header row (no data) returns []."""
    from app.services.multimodal_service import extract_csv_tables
    assert extract_csv_tables(b"Name,Age,Role") == []


def test_extract_excel_tables_single_sheet():
    """Excel workbook with one sheet → 1 table dict, page=1."""
    import io
    import openpyxl
    from app.services.multimodal_service import extract_excel_tables

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Data"
    ws.append(["Product", "Price"])
    ws.append(["Widget", "9.99"])
    ws.append(["Gadget", "24.99"])
    buf = io.BytesIO()
    wb.save(buf)

    result = extract_excel_tables(buf.getvalue())
    assert len(result) == 1
    assert result[0]["headers"] == ["Product", "Price"]
    assert result[0]["page"] == 1
    assert len(result[0]["rows"]) == 2


def test_extract_excel_tables_multi_sheet():
    """Excel workbook with 2 sheets → 2 table dicts, page=1 and page=2."""
    import io
    import openpyxl
    from app.services.multimodal_service import extract_excel_tables

    wb = openpyxl.Workbook()
    ws1 = wb.active
    ws1.title = "Sheet1"
    ws1.append(["A", "B"])
    ws1.append(["1", "2"])
    ws2 = wb.create_sheet("Sheet2")
    ws2.append(["X", "Y"])
    ws2.append(["3", "4"])
    buf = io.BytesIO()
    wb.save(buf)

    result = extract_excel_tables(buf.getvalue())
    assert len(result) == 2
    assert result[0]["page"] == 1
    assert result[1]["page"] == 2


def test_extract_excel_tables_header_normalization():
    """None or empty Excel header cells are replaced with 'Column N'."""
    import io
    import openpyxl
    from app.services.multimodal_service import extract_excel_tables

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append([None, "Price", ""])
    ws.append(["Widget", "9.99", "blue"])
    buf = io.BytesIO()
    wb.save(buf)

    result = extract_excel_tables(buf.getvalue())
    assert result[0]["headers"] == ["Column 1", "Price", "Column 3"]


def test_extract_excel_tables_empty_sheet_skipped():
    """A workbook with one empty sheet and one populated sheet → only 1 table."""
    import io
    import openpyxl
    from app.services.multimodal_service import extract_excel_tables

    wb = openpyxl.Workbook()
    ws_empty = wb.active
    ws_empty.title = "Empty"
    ws_data = wb.create_sheet("Data")
    ws_data.append(["Col"])
    ws_data.append(["val"])
    buf = io.BytesIO()
    wb.save(buf)

    result = extract_excel_tables(buf.getvalue())
    assert len(result) == 1
    assert result[0]["headers"] == ["Col"]


def test_extract_and_store_tables_csv():
    """extract_and_store_tables routes 'text/csv' → csv-reader extractor tag in insert."""
    from unittest.mock import MagicMock, patch
    from app.services.multimodal_service import extract_and_store_tables

    mock_supabase = MagicMock()
    mock_builder = MagicMock()
    mock_supabase.table.return_value = mock_builder
    mock_builder.insert.return_value = mock_builder
    mock_builder.execute.return_value = MagicMock(data=[])

    with patch("app.services.multimodal_service.extract_csv_tables") as mock_extract:
        mock_extract.return_value = [
            {"page": 1, "table_index": 0, "headers": ["A", "B"], "rows": [["1", "2"]]}
        ]
        extract_and_store_tables(
            raw=b"A,B\n1,2",
            mime_type="text/csv",
            document_id="doc-csv-01",
            user_id="user-01",
            supabase=mock_supabase,
        )

    mock_extract.assert_called_once()
    mock_supabase.table.assert_any_call("document_tables")
    insert_call = mock_builder.insert.call_args_list[0][0][0]
    assert insert_call[0]["extractor"] == "csv-reader"


def test_extract_and_store_tables_excel():
    """extract_and_store_tables routes xlsx MIME → openpyxl extractor tag in insert."""
    from unittest.mock import MagicMock, patch
    from app.services.multimodal_service import extract_and_store_tables

    mock_supabase = MagicMock()
    mock_builder = MagicMock()
    mock_supabase.table.return_value = mock_builder
    mock_builder.insert.return_value = mock_builder
    mock_builder.execute.return_value = MagicMock(data=[])

    xlsx_mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    with patch("app.services.multimodal_service.extract_excel_tables") as mock_extract:
        mock_extract.return_value = [
            {"page": 1, "table_index": 0, "headers": ["X"], "rows": [["y"]]}
        ]
        extract_and_store_tables(
            raw=b"fake_xlsx",
            mime_type=xlsx_mime,
            document_id="doc-xlsx-01",
            user_id="user-01",
            supabase=mock_supabase,
        )

    mock_extract.assert_called_once()
    mock_supabase.table.assert_any_call("document_tables")
    insert_call = mock_builder.insert.call_args_list[0][0][0]
    assert insert_call[0]["extractor"] == "openpyxl"


def test_extract_and_store_tables_unsupported_mime_noop():
    """extract_and_store_tables with text/plain is a no-op — no insert."""
    from unittest.mock import MagicMock
    from app.services.multimodal_service import extract_and_store_tables

    mock_supabase = MagicMock()
    extract_and_store_tables(
        raw=b"hello world",
        mime_type="text/plain",
        document_id="doc-txt-01",
        user_id="user-01",
        supabase=mock_supabase,
    )
    mock_supabase.table.assert_not_called()


# ---------------------------------------------------------------------------
# SEED-227: the cap TRUNCATES, and it must say so.
#
# The cap itself has been tested since Phase 072 (test_app_settings_max_vision_calls_read
# above proves 3 of 10 images are described). What NOTHING tested is that the other 7
# vanish without a word — the document reports a clean ingestion and no surface carries
# the fact. These tests pin the telling, not the capping.
# ---------------------------------------------------------------------------

def _chained_supabase():
    """A supabase mock whose builder returns itself for every chained call.

    The module's default fixture only wires `.insert`, so `.select`/`.eq`/`.limit`/
    `.update` would each hand back a FRESH auto-MagicMock and the read-merge-write
    would silently assert nothing.
    """
    mock_supabase = MagicMock()
    b = MagicMock()
    mock_supabase.table.return_value = b
    for method in ("insert", "select", "eq", "limit", "update", "order"):
        getattr(b, method).return_value = b
    b.execute.return_value = MagicMock(data=[{"chunk_index": 0}])
    return mock_supabase, b


def _vision_settings(cap: int):
    s = MagicMock()
    s.llm_model = "openai/gpt-4o"
    s.llm_api_key = "test-key"
    s.llm_base_url = ""
    s.multimodal_max_vision_calls = cap
    s.multimodal_max_b64_bytes_kb = 4096
    s.embedding_model = "openai/text-embedding-3-small"
    return s


def _metadata_updates(builder):
    """Every `update()` payload that carried a metadata key."""
    return [
        call[0][0]["metadata"]
        for call in builder.update.call_args_list
        if call[0] and isinstance(call[0][0], dict) and "metadata" in call[0][0]
    ]


def test_truncation_is_recorded_on_the_document():
    """10 images with a cap of 3 → the document records total=10, read=3.

    Without this the other 7 are unreachable AND unmentioned, which is the exact
    shape of a silent failure: every gate green, the answer quietly incomplete.
    """
    from app.services.multimodal_service import extract_and_store_images

    mock_supabase, builder = _chained_supabase()
    ten = [
        {"page": 1, "image_index": i, "b64_png": "a" * 16, "width": 100, "height": 100}
        for i in range(10)
    ]

    with patch("app.services.multimodal_service.extract_pdf_images") as mock_imgs, \
         patch("app.services.multimodal_service.describe_image") as mock_desc:
        mock_imgs.return_value = ten
        mock_desc.return_value = "fake description"
        extract_and_store_images(
            raw=b"%PDF",
            mime_type="application/pdf",
            document_id="doc-seed227-t1",
            user_id="user-seed227-t1",
            supabase=mock_supabase,
            app_settings=_vision_settings(3),
        )

    stamped = _metadata_updates(builder)
    assert stamped, "truncation happened and NOTHING was written to documents.metadata"
    assert stamped[-1]["_images"] == {"total": 10, "read": 3}


def test_no_truncation_note_when_everything_was_read():
    """2 images under a cap of 100 → absolutely nothing is stamped.

    Absence is the signal the panel keys on, so a note written on the quiet path
    would put a warning on every document in the library.
    """
    from app.services.multimodal_service import extract_and_store_images

    mock_supabase, builder = _chained_supabase()
    two = [
        {"page": 1, "image_index": i, "b64_png": "a" * 16, "width": 100, "height": 100}
        for i in range(2)
    ]

    with patch("app.services.multimodal_service.extract_pdf_images") as mock_imgs, \
         patch("app.services.multimodal_service.describe_image") as mock_desc:
        mock_imgs.return_value = two
        mock_desc.return_value = "fake description"
        extract_and_store_images(
            raw=b"%PDF",
            mime_type="application/pdf",
            document_id="doc-seed227-t2",
            user_id="user-seed227-t2",
            supabase=mock_supabase,
            app_settings=_vision_settings(100),
        )

    assert _metadata_updates(builder) == []


def test_truncation_note_preserves_existing_metadata():
    """⚠ The regression this guards is DATA LOSS, not a missing label.

    `documents.metadata` is one jsonb column and TWO GENERATED COLUMNS read from it
    (`document_type_norm`, `date_typed`). A bare overwrite would blank a document's
    classification and date, and the generated columns would follow — silently.
    """
    from app.services.multimodal_service import extract_and_store_images

    mock_supabase, builder = _chained_supabase()
    builder.execute.return_value = MagicMock(
        data=[{
            "chunk_index": 0,
            "metadata": {"document_type": "invoice", "date": "2026-01-01"},
        }]
    )
    five = [
        {"page": 1, "image_index": i, "b64_png": "a" * 16, "width": 100, "height": 100}
        for i in range(5)
    ]

    with patch("app.services.multimodal_service.extract_pdf_images") as mock_imgs, \
         patch("app.services.multimodal_service.describe_image") as mock_desc:
        mock_imgs.return_value = five
        mock_desc.return_value = "fake description"
        extract_and_store_images(
            raw=b"%PDF",
            mime_type="application/pdf",
            document_id="doc-seed227-t3",
            user_id="user-seed227-t3",
            supabase=mock_supabase,
            app_settings=_vision_settings(2),
        )

    stamped = _metadata_updates(builder)
    assert stamped, "expected a truncation stamp"
    written = stamped[-1]
    assert written["document_type"] == "invoice", "classification was clobbered"
    assert written["date"] == "2026-01-01", "date was clobbered"
    assert written["_images"] == {"total": 5, "read": 2}


def test_a_failing_metadata_write_never_costs_the_image_rows():
    """The note is best-effort. If recording it raises, the images still land.

    A document losing its image descriptions because a *note about truncation*
    failed would be strictly worse than the silence this seed set out to fix.
    """
    from app.services.multimodal_service import extract_and_store_images

    mock_supabase, builder = _chained_supabase()
    builder.select.side_effect = RuntimeError("metadata read exploded")
    four = [
        {"page": 1, "image_index": i, "b64_png": "a" * 16, "width": 100, "height": 100}
        for i in range(4)
    ]

    with patch("app.services.multimodal_service.extract_pdf_images") as mock_imgs, \
         patch("app.services.multimodal_service.describe_image") as mock_desc:
        mock_imgs.return_value = four
        mock_desc.return_value = "fake description"
        extract_and_store_images(
            raw=b"%PDF",
            mime_type="application/pdf",
            document_id="doc-seed227-t4",
            user_id="user-seed227-t4",
            supabase=mock_supabase,
            app_settings=_vision_settings(2),
        )

    assert mock_desc.call_count == 2, "the cap still applied"
    mock_supabase.table.assert_any_call("document_images")
