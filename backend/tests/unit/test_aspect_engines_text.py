"""Unit tests for backend/app/services/extractors/aspects/text.py.

Test 5 (per plan): legacy_text returns (str, None).
"""
from __future__ import annotations

from pathlib import Path

import pytest

from app.services.extraction_service import PDF_MIME, DOCX_MIME

FIXTURES = Path(__file__).parent.parent / "fixtures" / "extraction"
REFERENCE_PDF = FIXTURES / "reference.pdf"
REFERENCE_DOCX = FIXTURES / "reference.docx"


def test_legacy_text_returns_str_and_none_for_pdf():
    """legacy_text on a tiny PDF returns (str, None) — None markdown signals legacy."""
    from app.services.extractors.aspects.text import legacy_text

    if not REFERENCE_PDF.exists():
        pytest.skip(f"Reference PDF fixture not present at {REFERENCE_PDF}")

    raw = REFERENCE_PDF.read_bytes()
    out = legacy_text(raw, PDF_MIME)
    assert isinstance(out, tuple) and len(out) == 2
    text, md = out
    assert isinstance(text, str)
    assert md is None  # legacy never produces full_markdown


def test_legacy_text_returns_str_and_none_for_docx():
    from app.services.extractors.aspects.text import legacy_text

    if not REFERENCE_DOCX.exists():
        pytest.skip(f"Reference DOCX fixture not present at {REFERENCE_DOCX}")

    raw = REFERENCE_DOCX.read_bytes()
    out = legacy_text(raw, DOCX_MIME)
    assert isinstance(out, tuple) and len(out) == 2
    text, md = out
    assert isinstance(text, str)
    assert md is None
