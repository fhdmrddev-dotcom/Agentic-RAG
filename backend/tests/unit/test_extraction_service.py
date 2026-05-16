"""
Unit tests for backend/app/services/extraction_service.py (Phase 069).

Three layers per D-069-06:
  1. Golden-output fixtures (binding gate — proves byte-equivalent refactor).
  2. ABC contract tests (supports / extract / dispatcher / unsupported MIME).
  3. Error-field semantics (text raises; tables/images failures populate fields).
"""
from __future__ import annotations

import json
from dataclasses import asdict
from pathlib import Path
from unittest.mock import patch

import pytest

from app.services.extraction_service import (
    DOCX_MIME,
    ExtractedDocument,
    ImageData,
    LegacyExtractor,
    PDF_MIME,
    TableData,
    get_extractor,
)

FIXTURES = Path(__file__).parent.parent / "fixtures" / "extraction"
REFERENCE_PDF = FIXTURES / "reference.pdf"
REFERENCE_DOCX = FIXTURES / "reference.docx"
GOLDEN_PDF = FIXTURES / "reference_pdf_golden.json"
GOLDEN_DOCX = FIXTURES / "reference_docx_golden.json"


def _normalize(obj):
    """Round floats to 4 decimals + sort dict keys for deterministic compare (D-069-06).

    Tuples and lists are normalized to the same list shape so the
    `asdict(ExtractedDocument)` output (which preserves tuple-typed fields
    as tuples) compares equal to the JSON golden (which round-trips as list).
    """
    if isinstance(obj, float):
        return round(obj, 4)
    if isinstance(obj, dict):
        return {k: _normalize(obj[k]) for k in sorted(obj)}
    if isinstance(obj, (list, tuple)):
        return [_normalize(x) for x in obj]
    return obj


# ---------------------------------------------------------------------------
# Layer 2 — ABC contract tests
# ---------------------------------------------------------------------------

def test_legacy_supports_returns_true_for_pdf_and_docx():
    e = LegacyExtractor()
    assert e.supports(PDF_MIME) is True
    assert e.supports(DOCX_MIME) is True


def test_legacy_supports_returns_false_for_other_mimes():
    e = LegacyExtractor()
    assert e.supports("text/plain") is False
    assert e.supports("application/json") is False
    assert e.supports("") is False
    assert e.supports("text/html") is False


def test_extract_unsupported_mime_raises_valueerror():
    with pytest.raises(ValueError):
        LegacyExtractor().extract(b"x", "text/plain")


def test_get_extractor_returns_legacy_when_overridden(monkeypatch):
    """Phase 071.3 Plan 04 (D-071.3-09, Option A): EXTRACTOR_PRIMARY removed;
    get_extractor defaults to LegacyExtractor when engine_override is None or
    explicitly 'legacy'.
    """
    e_pdf = get_extractor(PDF_MIME, engine_override="legacy")
    e_docx = get_extractor(DOCX_MIME, engine_override="legacy")
    assert isinstance(e_pdf, LegacyExtractor)
    assert isinstance(e_docx, LegacyExtractor)


def test_get_extractor_returns_none_for_unsupported_mime():
    """Phase 071.3 Plan 04 (D-071.3-09): with the default 'legacy' engine,
    unsupported mimes fall through (Legacy doesn't support them) -> None.
    """
    assert get_extractor("text/plain") is None
    assert get_extractor("application/json") is None
    # Explicit engine_override also returns None for unsupported mimes
    assert get_extractor("text/plain", engine_override="legacy") is None


# ---------------------------------------------------------------------------
# Layer 3 — Error-field semantics
# ---------------------------------------------------------------------------

def test_legacy_extractor_text_failure_raises():
    """Text-extraction failure MUST propagate (D-069-04). It is NOT swallowed."""
    with patch.object(LegacyExtractor, "_extract_text", side_effect=RuntimeError("pypdf boom")):
        with pytest.raises(RuntimeError, match="pypdf boom"):
            LegacyExtractor().extract(b"%PDF-1.4 fake", PDF_MIME)


def test_legacy_extractor_table_failure_populates_error_field():
    """Tables failure → empty tuple + table_extraction_error str; no raise.

    Patches `LegacyExtractor._extract_tables` directly (not the underlying
    multimodal_service helper) so the test is load-order independent and
    semantically precise about what's being validated: the error-field
    translation in `LegacyExtractor.extract`, not the helper's behavior.
    """
    with patch.object(LegacyExtractor, "_extract_tables",
                      side_effect=RuntimeError("pdfplumber exploded")):
        with patch.object(LegacyExtractor, "_extract_text", return_value="hello"):
            with patch.object(LegacyExtractor, "_extract_images", return_value=[]):
                result = LegacyExtractor().extract(b"%PDF-1.4 fake", PDF_MIME)
    assert isinstance(result, ExtractedDocument)
    assert result.text == "hello"
    assert result.tables == ()
    assert result.table_extraction_error is not None
    assert "pdfplumber exploded" in result.table_extraction_error
    assert result.image_extraction_error is None


def test_legacy_extractor_image_failure_populates_error_field():
    """Images failure → empty tuple + image_extraction_error str; no raise.

    Patches `LegacyExtractor._extract_images` directly — see rationale on
    `test_legacy_extractor_table_failure_populates_error_field`.
    """
    with patch.object(LegacyExtractor, "_extract_images",
                      side_effect=RuntimeError("pdfplumber image exploded")):
        with patch.object(LegacyExtractor, "_extract_text", return_value="hello"):
            with patch.object(LegacyExtractor, "_extract_tables", return_value=[]):
                result = LegacyExtractor().extract(b"%PDF-1.4 fake", PDF_MIME)
    assert isinstance(result, ExtractedDocument)
    assert result.text == "hello"
    assert result.images == ()
    assert result.image_extraction_error is not None
    assert "pdfplumber image exploded" in result.image_extraction_error
    assert result.table_extraction_error is None


def test_legacy_extractor_empty_pdf_returns_empty_extracted_document():
    """A synthesized empty-pages-only PDF yields empty text/tables/images, no errors."""
    # Build a real, valid, zero-content PDF on the fly via pypdf so the test
    # exercises the actual pipeline rather than a stub.
    from pypdf import PdfWriter

    import io as _io
    writer = PdfWriter()
    writer.add_blank_page(width=72, height=72)
    buf = _io.BytesIO()
    writer.write(buf)
    raw = buf.getvalue()

    result = LegacyExtractor().extract(raw, PDF_MIME)
    assert isinstance(result, ExtractedDocument)
    # A blank page's extract_text() yields "" → joined with "\n\n" the result is "".
    assert result.text == ""
    assert result.tables == ()
    assert result.images == ()
    assert result.table_extraction_error is None
    assert result.image_extraction_error is None


# ---------------------------------------------------------------------------
# Layer 1 — Golden-output fixtures (BINDING GATE)
# ---------------------------------------------------------------------------

def test_legacy_extractor_pdf_matches_golden():
    """Refactor MUST produce byte-equivalent (post-normalization) output for the reference PDF."""
    raw = REFERENCE_PDF.read_bytes()
    extracted = LegacyExtractor().extract(raw, PDF_MIME)
    actual = _normalize(asdict(extracted))
    expected = _normalize(json.loads(GOLDEN_PDF.read_text()))
    assert actual == expected, (
        "Refactor diverged from golden — refactor wrong; do NOT edit fixture "
        "without documented normalization issue."
    )


def test_legacy_extractor_docx_matches_golden():
    """Refactor MUST produce byte-equivalent (post-normalization) output for the reference DOCX."""
    raw = REFERENCE_DOCX.read_bytes()
    extracted = LegacyExtractor().extract(raw, DOCX_MIME)
    actual = _normalize(asdict(extracted))
    expected = _normalize(json.loads(GOLDEN_DOCX.read_text()))
    assert actual == expected, (
        "Refactor diverged from golden — refactor wrong; do NOT edit fixture "
        "without documented normalization issue."
    )
