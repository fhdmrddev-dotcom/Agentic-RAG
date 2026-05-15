"""Unit tests for `extract_composable` — the per-aspect dispatcher composer
(Phase 071.2 Plan 05, D-071.2-01..04).

Tests prove:
  1. Composer dispatches each aspect through its independent registry.
  2. When engines=None, defaults come from app_settings.extraction_*_engine_*.
  3. Unknown engine names raise KeyError (defensive — fail fast at composer entry).
  4. ExtractedDocument.equations field exists + is populated by EQUATION_ENGINES.
"""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from app.services.extraction_service import (
    PDF_MIME,
    extract_composable,
)


# ---------------------------------------------------------------------------
# Test 1 — composer dispatches to text engine
# ---------------------------------------------------------------------------


def test_extract_composable_dispatches_to_text_engine(monkeypatch):
    """When engines={text: legacy, ...} is passed, the text adapter receives the
    raw bytes + mime exactly once."""
    from app.services.extractors import aspects

    calls: list[tuple] = []

    def fake_text(raw, mime):
        calls.append((raw, mime))
        return ("FAKE TEXT", None)

    def fake_tables(raw, mime):
        return []

    def fake_images_pdf(raw):
        return []

    def fake_equations(raw, mime):
        return []

    monkeypatch.setitem(aspects.TEXT_ENGINES, "legacy", fake_text)
    monkeypatch.setitem(aspects.TABLE_ENGINES, "docling_tf", fake_tables)
    monkeypatch.setitem(aspects.IMAGE_ENGINES_PDF, "pymupdf_full", fake_images_pdf)
    monkeypatch.setitem(aspects.EQUATION_ENGINES, "none", fake_equations)

    out = extract_composable(
        b"%PDF",
        PDF_MIME,
        engines={
            "text": "legacy",
            "tables": "docling_tf",
            "images": "pymupdf_full",
            "equations": "none",
        },
    )

    assert len(calls) == 1
    assert calls[0] == (b"%PDF", PDF_MIME)
    assert out.text == "FAKE TEXT"


# ---------------------------------------------------------------------------
# Test 2 — composer falls back to app_settings defaults when engines=None
# ---------------------------------------------------------------------------


def test_extract_composable_falls_back_to_app_settings(monkeypatch):
    """With engines=None, the composer reads defaults from load_app_settings()."""
    from app.services.extractors import aspects

    fake_text_called: list = []

    def fake_text(raw, mime):
        fake_text_called.append((raw, mime))
        return ("FROM DEFAULT", None)

    monkeypatch.setitem(aspects.TEXT_ENGINES, "legacy", fake_text)
    monkeypatch.setitem(aspects.TABLE_ENGINES, "docling_tf", lambda r, m: [])
    monkeypatch.setitem(aspects.IMAGE_ENGINES_PDF, "pymupdf_full", lambda r: [])
    monkeypatch.setitem(aspects.EQUATION_ENGINES, "none", lambda r, m: [])

    # Patch load_app_settings to return controlled defaults
    fake_settings = MagicMock()
    fake_settings.extraction_text_engine_pdf = "legacy"
    fake_settings.extraction_text_engine_docx = "legacy"
    fake_settings.extraction_table_engine_pdf = "docling_tf"
    fake_settings.extraction_image_engine_pdf = "pymupdf_full"
    fake_settings.extraction_image_engine_docx = "zip_xpath"
    fake_settings.extraction_equation_engine = "none"

    with patch(
        "app.services.extraction_service.load_app_settings",
        return_value=fake_settings,
    ):
        out = extract_composable(b"%PDF", PDF_MIME, engines=None)

    assert len(fake_text_called) == 1
    assert out.text == "FROM DEFAULT"


# ---------------------------------------------------------------------------
# Test 3 — unknown engine name raises KeyError (fail-fast)
# ---------------------------------------------------------------------------


def test_extract_composable_unknown_engine_raises_keyerror():
    """Passing engines={text: 'bogus'} raises KeyError at registry lookup."""
    with pytest.raises(KeyError):
        extract_composable(
            b"%PDF",
            PDF_MIME,
            engines={
                "text": "bogus_engine_name_that_does_not_exist",
                "tables": "docling_tf",
                "images": "pymupdf_full",
                "equations": "none",
            },
        )


# ---------------------------------------------------------------------------
# Test 4 — equations field exists + populated by EQUATION_ENGINES
# ---------------------------------------------------------------------------


def test_extract_composable_populates_equations_field(monkeypatch):
    """The returned ExtractedDocument has an .equations field, populated from
    EQUATION_ENGINES[engines['equations']]."""
    from app.services.extractors import aspects
    from app.services.extractors.aspects.equations import EquationData

    monkeypatch.setitem(aspects.TEXT_ENGINES, "legacy", lambda r, m: ("", None))
    monkeypatch.setitem(aspects.TABLE_ENGINES, "docling_tf", lambda r, m: [])
    monkeypatch.setitem(aspects.IMAGE_ENGINES_PDF, "pymupdf_full", lambda r: [])

    # Case A: equations=none → empty tuple
    monkeypatch.setitem(aspects.EQUATION_ENGINES, "none", lambda r, m: [])
    out_a = extract_composable(
        b"%PDF",
        PDF_MIME,
        engines={
            "text": "legacy",
            "tables": "docling_tf",
            "images": "pymupdf_full",
            "equations": "none",
        },
    )
    assert hasattr(out_a, "equations")
    assert out_a.equations == ()

    # Case B: equations engine returns 2 EquationData → tuple length 2
    fake_eqs = [
        EquationData(page=1, equation_index=0, latex="a^2", text="a^2", bbox=None),
        EquationData(page=1, equation_index=1, latex="b^2", text="b^2", bbox=None),
    ]
    monkeypatch.setitem(
        aspects.EQUATION_ENGINES, "docling_formula", lambda r, m: list(fake_eqs)
    )
    out_b = extract_composable(
        b"%PDF",
        PDF_MIME,
        engines={
            "text": "legacy",
            "tables": "docling_tf",
            "images": "pymupdf_full",
            "equations": "docling_formula",
        },
    )
    assert len(out_b.equations) == 2
    assert out_b.equations[0].latex == "a^2"
