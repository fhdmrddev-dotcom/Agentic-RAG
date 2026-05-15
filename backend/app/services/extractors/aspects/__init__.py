"""Per-aspect extraction dispatcher registries (Phase 071.2 D-071.2-01..04).

Each aspect (text / tables / images-PDF / images-DOCX / equations) has its
own independent registry of engine adapters. The `extract_composable`
composer in `extraction_service.py` looks up an adapter per aspect and
dispatches each call independently — engines are swappable per aspect at
runtime via `app_settings.extraction.*` (migration 045) or per-call via
the `/upload` and `/reextract` `?engines=` query hint.

Registry shape:  dict[engine_name, callable]
Callable signatures live in the sibling adapter modules.

Adding a new engine:
  1. Define the adapter function in the appropriate sibling module.
  2. Add a `{name: fn}` entry to the corresponding registry below.
  3. (Optional) extend the migration 045 column's allowed values for
     the new name to be settable via app_settings.

Engines listed here MUST match the column defaults shipped by
`supabase/migrations/045_app_settings_extraction_aspects.sql` and the
Phase 071.3 winner registration:
  - text:         legacy (default), docling, pymupdf
  - tables:       pdfplumber, docling_tf (default for PDF), camelot
                  (Phase 071.3 D-071.3-05 winner — migration 047 in Plan 03
                  flips the default; Plan 04 deletes docling_tf)
  - images_pdf:   pdfplumber, pymupdf_full (default), docling_pictures
  - images_docx:  inline_shapes, zip_xpath (default)
  - equations:    none, docling_formula (default)
"""
from __future__ import annotations

from app.services.extractors.aspects.text import (
    docling_text,
    legacy_text,
    pymupdf_text,
)
from app.services.extractors.aspects.tables import (
    camelot_tables,
    docling_tf_tables,
    pdfplumber_tables,
)
from app.services.extractors.aspects.images_pdf import (
    docling_pictures_pdf,
    pdfplumber_images_pdf,
    pymupdf_full_images_pdf,
)
from app.services.extractors.aspects.images_docx import (
    inline_shapes_docx,
    zip_xpath_docx,
)
from app.services.extractors.aspects.equations import (
    docling_formula_equations,
    none_equations,
)


# Text adapters return (text: str, full_markdown: str | None)
TEXT_ENGINES: dict = {
    "legacy": legacy_text,
    "docling": docling_text,
    "pymupdf": pymupdf_text,
}

# Table adapters return list[TableData]
TABLE_ENGINES: dict = {
    "pdfplumber": pdfplumber_tables,
    "docling_tf": docling_tf_tables,
    # Phase 071.3 D-071.3-05 winner; migration 047 (Plan 03) flips default
    # to "camelot" and Plan 04 deletes docling_tf entirely.
    "camelot": camelot_tables,
}

# PDF image adapters return list[ImageData]; called with (raw_bytes,)
IMAGE_ENGINES_PDF: dict = {
    "pdfplumber": pdfplumber_images_pdf,
    "pymupdf_full": pymupdf_full_images_pdf,
    "docling_pictures": docling_pictures_pdf,
}

# DOCX image adapters return list[ImageData]; called with (raw_bytes,)
IMAGE_ENGINES_DOCX: dict = {
    "inline_shapes": inline_shapes_docx,
    "zip_xpath": zip_xpath_docx,
}

# Equation adapters return list[EquationData]
EQUATION_ENGINES: dict = {
    "none": none_equations,
    "docling_formula": docling_formula_equations,
}


__all__ = [
    "TEXT_ENGINES",
    "TABLE_ENGINES",
    "IMAGE_ENGINES_PDF",
    "IMAGE_ENGINES_DOCX",
    "EQUATION_ENGINES",
]
