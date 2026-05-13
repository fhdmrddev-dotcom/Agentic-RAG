"""
PDF + DOCX extraction service for Phase 069.

Defines the `PdfExtractor` ABC seam (D-069-03) over today's pypdf +
pdfplumber + python-docx pipeline. `LegacyExtractor` is the only engine
in Phase 069; Phase 071 will add DoclingExtractor / PyMuPDFExtractor /
Pypdfium2Extractor behind the same dispatcher.

Zero observable behavior change vs the pre-069 inline extraction in
`app.api.documents.extract_text` + `app.services.multimodal_service`
table/image helpers. Per D-069-04: text failures raise; table/image
failures populate `*_extraction_error` fields and return empty lists.
"""
from __future__ import annotations

import io
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass

log = logging.getLogger(__name__)

PDF_MIME = "application/pdf"
DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


@dataclass(frozen=True)
class TableData:
    """Normalized table from a single document page (D-069-01)."""
    page: int | None
    table_index: int
    headers: list[str]
    rows: list[list[str]]


@dataclass(frozen=True)
class ImageData:
    """Normalized image from a single document page (D-069-01)."""
    page: int | None
    image_index: int
    b64_png: str
    width: int
    height: int


@dataclass(frozen=True)
class ExtractedDocument:
    """Output of `PdfExtractor.extract` (D-069-01).

    text:                        Extracted plain text (joined pages/paragraphs).
    tables:                      Tables (empty tuple on failure — see table_extraction_error).
    images:                      Images (empty tuple on failure — see image_extraction_error).
    table_extraction_error:      str message if tables failed; None on success.
    image_extraction_error:      str message if images failed; None on success.

    `tables` and `images` are tuples so that `frozen=True` actually prevents
    container-level mutation. Inner `TableData.headers` / `TableData.rows` remain
    lists — second-order mutation guarantee is intentionally not enforced; Phase
    071 engine authors should treat the returned object as immutable.
    """
    text: str
    tables: tuple[TableData, ...]
    images: tuple[ImageData, ...]
    table_extraction_error: str | None = None
    image_extraction_error: str | None = None


class PdfExtractor(ABC):
    """Engine-agnostic seam over PDF + DOCX extraction (D-069-03).

    Concrete implementations wrap a specific library stack
    (Legacy = pypdf + pdfplumber + python-docx; future = Docling, PyMuPDF,
    pypdfium2). The dispatcher (`get_extractor`) picks one per request.
    """

    @abstractmethod
    def supports(self, mime: str) -> bool:
        """Return True if this extractor handles `mime`, False otherwise."""

    @abstractmethod
    def extract(self, raw: bytes, mime: str) -> ExtractedDocument:
        """Extract text + tables + images from `raw` bytes.

        Text-extraction failures MUST raise (caller handles). Table/image
        failures MUST be caught and reported via the error fields on
        ExtractedDocument; tables/images list MUST be empty on failure.
        """


class LegacyExtractor(PdfExtractor):
    """Today's pipeline: pypdf for PDF text, pdfplumber for PDF tables/images,
    python-docx for DOCX. Wrapped under the new ABC seam for Phase 071 swap.
    """

    def supports(self, mime: str) -> bool:
        return mime in (PDF_MIME, DOCX_MIME)

    def extract(self, raw: bytes, mime: str) -> ExtractedDocument:
        if not self.supports(mime):
            raise ValueError(f"LegacyExtractor does not support {mime!r}")

        # Text — raises on failure (matches today's extract_text() semantics, D-069-04)
        text = self._extract_text(raw, mime)

        # Tables — silent-swallow translated to error field (D-069-04)
        tables: list[TableData] = []
        table_error: str | None = None
        try:
            tables = self._extract_tables(raw, mime)
        except Exception as exc:  # noqa: BLE001 — intentional broad-catch per D-069-04
            table_error = str(exc)
            log.warning("LegacyExtractor table extraction failed: %s", exc)

        # Images — silent-swallow translated to error field (D-069-04)
        images: list[ImageData] = []
        image_error: str | None = None
        try:
            images = self._extract_images(raw, mime)
        except Exception as exc:  # noqa: BLE001 — intentional broad-catch per D-069-04
            image_error = str(exc)
            log.warning("LegacyExtractor image extraction failed: %s", exc)

        return ExtractedDocument(
            text=text,
            tables=tuple(tables),
            images=tuple(images),
            table_extraction_error=table_error,
            image_extraction_error=image_error,
        )

    def _extract_text(self, raw: bytes, mime: str) -> str:
        """Port of `documents.extract_text` PDF + DOCX branches (lines 45-52)."""
        if mime == PDF_MIME:
            from pypdf import PdfReader  # noqa: PLC0415 — lazy heavy import
            reader = PdfReader(io.BytesIO(raw))
            return "\n\n".join(page.extract_text() or "" for page in reader.pages)
        if mime == DOCX_MIME:
            from docx import Document as DocxDocument  # noqa: PLC0415 — lazy heavy import
            doc = DocxDocument(io.BytesIO(raw))
            return "\n\n".join(p.text for p in doc.paragraphs if p.text.strip())
        raise ValueError(f"_extract_text: unsupported mime {mime!r}")

    def _extract_tables(self, raw: bytes, mime: str) -> list[TableData]:
        """Delegate to module-level helpers in multimodal_service per PATTERNS.md
        §Tables/images delegation (option (a) — diff-min, keeps existing
        patch surface for tests).
        """
        from app.services.multimodal_service import (  # noqa: PLC0415
            extract_pdf_tables,
            extract_docx_tables,
        )
        if mime == PDF_MIME:
            dicts = extract_pdf_tables(raw)
        elif mime == DOCX_MIME:
            dicts = extract_docx_tables(raw)
        else:
            return []
        return [TableData(**d) for d in dicts]

    def _extract_images(self, raw: bytes, mime: str) -> list[ImageData]:
        """Delegate to module-level helpers in multimodal_service per PATTERNS.md
        §Tables/images delegation.
        """
        from app.services.multimodal_service import (  # noqa: PLC0415
            extract_pdf_images,
            extract_docx_images,
        )
        if mime == PDF_MIME:
            dicts = extract_pdf_images(raw)
        elif mime == DOCX_MIME:
            dicts = extract_docx_images(raw)
        else:
            return []
        return [ImageData(**d) for d in dicts]


_LEGACY = LegacyExtractor()  # stateless — safe to share


def get_extractor(mime: str) -> PdfExtractor | None:
    """Return an extractor that supports `mime`, or None.

    Phase 069: always returns LegacyExtractor for PDF/DOCX, None otherwise.
    Phase 071: will consult app_settings/env to pick between engines.
    """
    if _LEGACY.supports(mime):
        return _LEGACY
    return None
