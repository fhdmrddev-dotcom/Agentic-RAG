"""Unit tests for backend/app/services/extractors/aspects/equations.py.

Phase 071.3 Plan 04 (D-071.3-09): docling_formula_equations removed.
`none_equations` is the only remaining equation engine.
"""
from __future__ import annotations

from app.services.extraction_service import PDF_MIME


def test_none_equations_returns_empty():
    """The no-op adapter returns [] for any input."""
    from app.services.extractors.aspects.equations import none_equations

    out = none_equations(b"%PDF", PDF_MIME)
    assert out == []
