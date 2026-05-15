"""Unit tests for backend/app/services/extractors/aspects/equations.py.

Test 10: none_equations is the no-op adapter — always returns [].
Test 11: docling_formula_equations dispatches through _get_converter (don't
         assert on output shape — depends on Docling 2.93+ formula-enrichment).
"""
from __future__ import annotations

from unittest.mock import MagicMock, patch

from app.services.extraction_service import PDF_MIME


def test_none_equations_returns_empty():
    """The no-op adapter returns [] for any input."""
    from app.services.extractors.aspects.equations import none_equations

    out = none_equations(b"%PDF", PDF_MIME)
    assert out == []


def test_docling_formula_routes_through_get_converter():
    """The adapter calls _get_converter() once with a temp file path.
    Output shape is implementation-dependent; we only assert dispatch."""
    from app.services.extractors.aspects import equations as aspect_equations

    fake_doc = MagicMock()
    fake_doc.texts = []  # No formula items in this fake
    fake_result = MagicMock()
    fake_result.document = fake_doc
    fake_converter = MagicMock()
    fake_converter.convert.return_value = fake_result

    with patch(
        "app.services.extractors.docling._get_converter",
        return_value=fake_converter,
    ) as mock_get_conv:
        out = aspect_equations.docling_formula_equations(b"%PDF", PDF_MIME)

    # Dispatch invariant: _get_converter was called
    mock_get_conv.assert_called_once()
    fake_converter.convert.assert_called_once()
    # Empty input → empty output (no formulas in fake_doc.texts)
    assert out == []
