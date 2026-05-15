"""Equation-aspect adapters for the per-aspect extraction dispatcher
(Phase 071.2 Plan 05, D-071.2-04).

Docling 2.93's formula-enrichment output lives on `DoclingDocument.texts`,
where each formula item is a `FormulaItem` (subclass of `TextItem`) with
`label == DocItemLabel.FORMULA`. See:
  backend/venv/Lib/site-packages/docling_core/types/doc/document.py
  - line 2617: `class DoclingDocument(BaseModel):`
  - line 2638: `texts: list[... FormulaItem ...]`
  - line 1897: `class FormulaItem(TextItem): label = DocItemLabel.FORMULA`

If the attribute structure changes in a future Docling version, the adapter
falls back to returning an empty list with a warning (see fallback handling
inside `docling_formula_equations`).
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
    latex:          Optional LaTeX form (Docling's formula enrichment populates).
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


def docling_formula_equations(raw: bytes, mime: str) -> list[EquationData]:
    """Docling formula-enrichment adapter (requires do_formula_enrichment=True
    on the pipeline options — set unconditionally by Phase 071.2 D-071.2-14
    in `app/services/extractors/docling.py`).

    Reuses the existing `_get_converter` singleton (Pattern SP-6).

    Walks `doc.texts` for items whose `label == DocItemLabel.FORMULA` and
    constructs EquationData per item. LaTeX is the `text` field of the
    FormulaItem when Docling's formula enrichment runs successfully; the
    raw text is the same field (Docling does not produce a separate
    plain-text representation distinct from LaTeX).
    """
    import tempfile  # noqa: PLC0415
    import os  # noqa: PLC0415
    from app.services.extractors.docling import _get_converter  # noqa: PLC0415

    from app.services.extraction_service import PDF_MIME  # noqa: PLC0415
    suffix = ".pdf" if mime == PDF_MIME else ".docx"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tf:
        tf.write(raw)
        tmp_path = tf.name
    try:
        converter = _get_converter()
        result = converter.convert(tmp_path)
        doc = result.document
        results: list[EquationData] = []

        # Walk `doc.texts` filtering by FORMULA label.
        try:
            from docling_core.types.doc import DocItemLabel  # noqa: PLC0415
            formula_label = DocItemLabel.FORMULA
        except Exception as exc:  # noqa: BLE001
            log.warning(
                "docling_formula_equations: cannot import DocItemLabel "
                "(%s); phase 071.2 needs a Docling 2.93+ retest",
                exc,
            )
            return []

        texts = getattr(doc, "texts", None)
        if texts is None:
            log.warning(
                "docling_formula_equations: DoclingDocument.texts attribute "
                "not found; phase 071.2 needs a Docling 2.93+ retest"
            )
            return []

        formula_idx = 0
        for item in texts:
            label = getattr(item, "label", None)
            if label != formula_label:
                continue
            # Page number from prov (if available)
            page: int | None = None
            bbox: dict | None = None
            prov = getattr(item, "prov", None) or []
            if prov:
                first = prov[0]
                page = getattr(first, "page_no", None)
                bbox_obj = getattr(first, "bbox", None)
                if bbox_obj is not None and hasattr(bbox_obj, "model_dump"):
                    bbox = bbox_obj.model_dump()
                    bbox["page"] = page
                    if "coord_origin" in bbox and hasattr(
                        bbox["coord_origin"], "value"
                    ):
                        bbox["coord_origin"] = bbox["coord_origin"].value
            latex_text = getattr(item, "text", None)
            results.append(
                EquationData(
                    page=page,
                    equation_index=formula_idx,
                    latex=latex_text,
                    text=latex_text,
                    bbox=bbox,
                )
            )
            formula_idx += 1
        return results
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass
