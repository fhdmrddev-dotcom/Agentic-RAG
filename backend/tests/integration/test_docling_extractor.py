"""Phase 071 Plan 02 — DoclingExtractor synthetic-fixture regression net (D-071-16).

This test is the REGRESSION NET, not the binding SC#1 gate. SC#1's binding gate
is the live UAT on `551f03f9-...` (D-071-15) which cannot live in CI (copyrighted).
This test guarantees:
- DoclingExtractor imports cleanly + produces non-empty output on the synthetic
  academic_synth.{pdf,docx} fixtures.
- The extended ExtractedDocument fields (extractor_name, full_markdown, bbox)
  are populated by the Docling path.
"""
from pathlib import Path

import pytest

# Module-top imports — fail loudly at collection if anything's broken
# (matches Phase 070 spike posture per test_pdf_extractor_docling_compat.py).
from app.services.extractors.docling import DoclingExtractor

FIXTURES = Path(__file__).parent.parent / "fixtures" / "extraction"
PDF_PATH = FIXTURES / "academic_synth.pdf"
DOCX_PATH = FIXTURES / "academic_synth.docx"

PDF_MIME = "application/pdf"
DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


@pytest.fixture(scope="module")
def pdf_bytes() -> bytes:
    assert PDF_PATH.exists(), f"Missing synthetic fixture: {PDF_PATH}"
    return PDF_PATH.read_bytes()


@pytest.fixture(scope="module")
def docx_bytes() -> bytes:
    assert DOCX_PATH.exists(), f"Missing synthetic fixture: {DOCX_PATH}"
    return DOCX_PATH.read_bytes()


@pytest.fixture(scope="module")
def extractor() -> DoclingExtractor:
    return DoclingExtractor()


@pytest.fixture(scope="module")
def pdf_result(extractor, pdf_bytes):
    """Run Docling once on the PDF (expensive) and share across tests in this module."""
    return extractor.extract(pdf_bytes, PDF_MIME)


@pytest.fixture(scope="module")
def docx_result(extractor, docx_bytes):
    """Run Docling once on the DOCX (expensive) and share across tests in this module."""
    return extractor.extract(docx_bytes, DOCX_MIME)


class TestDoclingPdf:
    def test_extract_returns_non_empty_text(self, pdf_result):
        assert len(pdf_result.text) > 0, "Docling PDF text extraction empty"

    def test_extract_returns_at_least_five_tables(self, pdf_result):
        assert len(pdf_result.tables) >= 5, (
            f"Expected >=5 tables, got {len(pdf_result.tables)}"
        )

    def test_extract_returns_at_least_five_images(self, pdf_result):
        assert len(pdf_result.images) >= 5, (
            f"Expected >=5 images, got {len(pdf_result.images)}"
        )

    def test_extractor_name_is_docling(self, pdf_result):
        assert pdf_result.extractor_name == "docling"

    def test_full_markdown_populated(self, pdf_result):
        assert pdf_result.full_markdown is not None
        assert len(pdf_result.full_markdown) > 0

    def test_table_bbox_populated(self, pdf_result):
        # At least one table should have bbox populated (Docling layout-analyzer output)
        any_with_bbox = any(t.bbox is not None for t in pdf_result.tables)
        assert any_with_bbox, "Expected >=1 table with bbox from Docling output"
        for t in pdf_result.tables:
            if t.bbox is not None:
                # bbox shape: {l, t, r, b, coord_origin, page}
                assert set(t.bbox.keys()) >= {"l", "t", "r", "b", "page"}, (
                    f"bbox missing expected keys: {t.bbox.keys()}"
                )

    def test_image_bbox_populated(self, pdf_result):
        any_with_bbox = any(im.bbox is not None for im in pdf_result.images)
        assert any_with_bbox, "Expected >=1 image with bbox from Docling output"


class TestDoclingDocx:
    def test_extract_returns_non_empty_text(self, docx_result):
        assert len(docx_result.text) > 0, "Docling DOCX text extraction empty"

    def test_extract_returns_at_least_five_tables(self, docx_result):
        assert len(docx_result.tables) >= 5, (
            f"Expected >=5 tables, got {len(docx_result.tables)}"
        )

    def test_extract_returns_at_least_five_images(self, docx_result):
        assert len(docx_result.images) >= 5, (
            f"Expected >=5 images, got {len(docx_result.images)}"
        )

    def test_extractor_name_is_docling(self, docx_result):
        assert docx_result.extractor_name == "docling"


class TestDoclingDispatch:
    def test_supports_pdf_and_docx(self, extractor):
        assert extractor.supports(PDF_MIME)
        assert extractor.supports(DOCX_MIME)

    def test_does_not_support_random_mime(self, extractor):
        assert not extractor.supports("text/plain")

    def test_extract_unsupported_mime_raises(self, extractor, pdf_bytes):
        with pytest.raises(ValueError, match="does not support"):
            extractor.extract(pdf_bytes, "text/plain")


# ── Phase 071.1 D-071.1-03 — env-tunable Docling knobs ────────────────────────

from docling.datamodel.base_models import InputFormat  # noqa: E402


def _pdf_opts(converter):
    """Helper: navigate Docling 2.93's format options to the PdfPipelineOptions instance.

    If `converter.format_to_options[InputFormat.PDF].pipeline_options` doesn't resolve
    in the installed Docling version, adjust this single helper rather than every test.
    """
    return converter.format_to_options[InputFormat.PDF].pipeline_options


class TestEnvKnobs:
    """Phase 071.1 D-071.1-03 — env-tunable Docling knobs.

    Verifies the three new env vars are read inside _get_converter() and applied
    to PdfPipelineOptions. Singleton is reset between tests via the
    reset_docling_singleton fixture (conftest.py).
    """

    def test_disable_table_structure_honored(
        self, monkeypatch, reset_docling_singleton,
    ):
        from app.services.extractors import docling as docling_module
        monkeypatch.setenv("EXTRACTOR_DOCLING_DISABLE_TABLE_STRUCTURE", "1")
        converter = docling_module._get_converter()
        pdf_opts = _pdf_opts(converter)
        assert pdf_opts.do_table_structure is False

    def test_images_scale_honored(self, monkeypatch, reset_docling_singleton):
        from app.services.extractors import docling as docling_module
        monkeypatch.setenv("EXTRACTOR_DOCLING_IMAGES_SCALE", "1.0")
        converter = docling_module._get_converter()
        pdf_opts = _pdf_opts(converter)
        assert pdf_opts.images_scale == 1.0

    def test_timeout_s_honored(self, monkeypatch, reset_docling_singleton):
        from app.services.extractors import docling as docling_module
        monkeypatch.setenv("EXTRACTOR_DOCLING_TIMEOUT_S", "60")
        converter = docling_module._get_converter()
        pdf_opts = _pdf_opts(converter)
        assert pdf_opts.document_timeout == 60.0

    def test_invalid_timeout_falls_back_to_default(
        self, monkeypatch, reset_docling_singleton, caplog,
    ):
        """RESEARCH.md Pitfall 4 — garbage value doesn't crash the worker."""
        from app.services.extractors import docling as docling_module
        monkeypatch.setenv("EXTRACTOR_DOCLING_TIMEOUT_S", "120s")
        with caplog.at_level("WARNING"):
            converter = docling_module._get_converter()
        pdf_opts = _pdf_opts(converter)
        assert pdf_opts.document_timeout == 120.0
        assert "Invalid EXTRACTOR_DOCLING_TIMEOUT_S" in caplog.text
