"""Equation-aspect adapters for the per-aspect extraction dispatcher
(Phase 071.2 Plan 05, D-071.2-04).

After the Phase 071.3 Plan 04 Docling rip (D-071.3-09), `none_equations` is
the only registered equation engine. The dispatcher contract is preserved —
the composer still routes through EQUATION_ENGINES — but no engine currently
produces structured equation rows. Future engines plug in via the same
registry seam.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass

log = logging.getLogger(__name__)


@dataclass(frozen=True)
class EquationData:
    """Normalized equation extracted from a layout-aware engine.

    page:           1-based page number when available (None for DOCX).
    equation_index: 0-based index within the document.
    latex:          Optional LaTeX form.
    text:           Plain-text equation when LaTeX unavailable.
    bbox:           Optional spatial coordinates dict.
    """
    page: int | None
    equation_index: int
    latex: str | None
    text: str | None
    bbox: dict | None = None


def none_equations(raw: bytes, mime: str) -> list[EquationData]:
    """No-op adapter — always returns []. Default for engines that don't
    do formula enrichment."""
    return []
