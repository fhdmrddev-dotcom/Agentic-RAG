"""
PDF + DOCX extraction service.

Defines the `PdfExtractor` ABC seam (D-069-03) over today's pypdf +
pdfplumber + python-docx pipeline. `LegacyExtractor` is the only shipped
engine after the Phase 071.3 Plan 04 Docling rip (D-071.3-09); PyMuPDF
lives on as in-process aspect adapters (`pymupdf_text`,
`pymupdf_full_images_pdf`) rather than a separate top-level extractor.

Per D-069-04: text failures raise; table/image failures populate
`*_extraction_error` fields and return empty lists.
"""
from __future__ import annotations

import io
import logging
import os
from abc import ABC, abstractmethod
from dataclasses import dataclass

log = logging.getLogger(__name__)


class ExtractionError(Exception):
    """Raised when an extractor pipeline fails in a way callers need to surface
    (e.g. subprocess timeout, child non-zero exit, malformed payload).

    Distinct from per-feature silent-swallow errors (D-069-04) which are stored
    in ExtractedDocument.table_extraction_error / .image_extraction_error.
    """


PDF_MIME = "application/pdf"
DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


@dataclass(frozen=True)
class TableData:
    """Normalized table from a single document page (D-069-01).

    Phase 071 D-071-08: `bbox` adds optional spatial coordinates populated by
    layout-aware engines (Docling/PyMuPDF). LegacyExtractor leaves it None.
    """
    page: int | None
    table_index: int
    headers: list[str]
    rows: list[list[str]]
    # NEW per D-071-08:
    bbox: dict | None = None


@dataclass(frozen=True)
class ImageData:
    """Normalized image from a single document page (D-069-01).

    Phase 071 D-071-08: `bbox` adds optional spatial coordinates.
    """
    page: int | None
    image_index: int
    b64_png: str
    width: int
    height: int
    # NEW per D-071-08:
    bbox: dict | None = None


@dataclass(frozen=True)
class ExtractedDocument:
    """Output of `PdfExtractor.extract` (D-069-01).

    text:                        Extracted plain text (joined pages/paragraphs).
    tables:                      Tables (empty tuple on failure — see table_extraction_error).
    images:                      Images (empty tuple on failure — see image_extraction_error).
    table_extraction_error:      str message if tables failed; None on success.
    image_extraction_error:      str message if images failed; None on success.
    full_markdown:               Layout-preserving markdown (Phase 071 D-071-08).
                                 Docling populates; Legacy/PyMuPDF leave None.
    extractor_name:              Engine lineage tag (Phase 071 D-071-08) —
                                 'docling' | 'pymupdf' | 'pypdf-legacy'.

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
    # NEW per D-071-08:
    full_markdown: str | None = None
    extractor_name: str | None = None
    # NEW per D-071.2-04 (Phase 071.2 Plan 05):
    # tuple[EquationData, ...]; bare `tuple` annotation avoids a forward-ref
    # cycle between extraction_service.py and aspects.equations. The composer
    # constructs EquationData instances locally and stores them here.
    equations: tuple = ()


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
            # Phase 071 D-071-08: explicit lineage tag for telemetry clarity
            # (per CONTEXT.md Discretion: "recommend explicit for clarity").
            extractor_name="pypdf-legacy",
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


def get_extractor(mime: str, engine_override: str | None = None) -> PdfExtractor | None:
    """Resolve a PdfExtractor for `mime`, honoring engine_override.

    Phase 071.3 Plan 04 (D-071.3-09, Option A — PATTERNS.md): EXTRACTOR_PRIMARY
    deleted entirely. The per-aspect composer (`extract_composable`) is the
    primary extraction path for PDF + DOCX mimes. `get_extractor` survives as a
    thin seam for non-composer paths (legacy-engine lineage tag for non-PDF/
    non-DOCX mimes that don't have per-aspect adapters).

    Post-Phase-G (D-071.3-11) — the PyMuPDF subprocess fence was retired; the
    `pymupdf` engine name is now consumed by the per-aspect composer's
    `pymupdf` text adapter and `pymupdf_full` image adapter, both of which
    `import fitz` in-process. `get_extractor` returns LegacyExtractor for any
    supported mime regardless of engine_override.
    """
    if _LEGACY.supports(mime):
        return _LEGACY
    return None


# ---------------------------------------------------------------------------
# Phase 071.2 Plan 05 — per-aspect dispatcher composer (D-071.2-01..04)
# ---------------------------------------------------------------------------

def load_app_settings():
    """Indirection point so tests can monkey-patch this module's view of
    `load_app_settings` without touching `app.models.user_settings` callers
    that may have already bound the original symbol.
    """
    from app.models.user_settings import load_app_settings as _real  # noqa: PLC0415
    return _real()


def extract_composable(
    raw: bytes,
    mime: str,
    engines: dict[str, str] | None = None,
) -> ExtractedDocument:
    """Per-aspect extraction composer (Phase 071.2 D-071.2-01..04).

    Dispatches each aspect (text / tables / images / equations) through its
    own independent registry in `app.services.extractors.aspects`. When
    `engines` is None, defaults come from `app_settings.extraction_*_engine_*`
    (migration 045).

    Per-aspect try/except: a failure in one aspect populates the
    corresponding `*_extraction_error` field on the result and leaves the
    other aspects intact. Text failures still surface as exceptions (matches
    D-069-04 semantics).

    KeyError on unknown engine name (fail-fast). The route handler can
    wrap this in HTTPException(400) if it wants client-visible 400 instead
    of 500 — see Plan 05 Task 3 documents.py wiring.

    extractor_name is set to `composable[{text}/{tables}/{images}/{equations}]`.
    """
    from app.services.extractors import aspects  # noqa: PLC0415

    # Resolve engine names. Per-aspect override > app_settings default.
    if engines is None:
        engines = {}

    settings = load_app_settings()

    # Choose images registry based on mime — DOCX has its own engine list.
    if mime == DOCX_MIME:
        images_registry = aspects.IMAGE_ENGINES_DOCX
        text_default = settings.extraction_text_engine_docx
        images_default = settings.extraction_image_engine_docx
    else:
        images_registry = aspects.IMAGE_ENGINES_PDF
        text_default = settings.extraction_text_engine_pdf
        images_default = settings.extraction_image_engine_pdf

    eng = {
        "text": engines.get("text") or text_default,
        "tables": engines.get("tables") or settings.extraction_table_engine_pdf,
        "images": engines.get("images") or images_default,
        "equations": engines.get("equations") or settings.extraction_equation_engine,
    }

    # Registry lookups — KeyError on unknown engine name (fail-fast).
    text_fn = aspects.TEXT_ENGINES[eng["text"]]
    table_fn = aspects.TABLE_ENGINES[eng["tables"]]
    image_fn = images_registry[eng["images"]]
    equation_fn = aspects.EQUATION_ENGINES[eng["equations"]]

    # ── Text — the configured engine, then any OTHER registered engine ────────────────────
    #
    # D-069-04 says a text failure is fatal where a table/image failure is swallowed, and that
    # is still true: if EVERY engine fails, this raises exactly as it always did. What changed
    # is that one engine's bug no longer condemns a document a sibling engine can read fine.
    #
    # ⚠ BUG-260905-05, and it was MEASURED rather than guessed. Three real PDFs failed ingest
    #   with `IndexError: list index out of range`, thrown from inside pypdf itself:
    #
    #     pypdf/_cmap.py:427  in build_font_width_map
    #       second = w[1].get_object()
    #     IndexError: list index out of range
    #
    #   — a malformed `/W` font-width array in the file, not anything wrong with our call. The
    #   same three bytes through the other registered engine:
    #
    #     FMrad_Similarity_report.pdf     legacy=FAIL(IndexError) | pymupdf=OK(50775 chars)
    #     FMrad_AI_writing_report.pdf     legacy=FAIL(IndexError) | pymupdf=OK(49128 chars)
    #     Paperpal Plagiarism Check.pdf   legacy=FAIL(IndexError) | pymupdf=OK(48308 chars)
    #
    #   So the document was never unreadable. It was readable by the engine we did not try.
    #
    # ⚠ THE FALLBACK IS ORDERED AND THE CONFIGURED ENGINE ALWAYS GOES FIRST — this must never
    #   become "pick whichever works", because the operator's choice of extractor is a setting
    #   with quality consequences, not a hint. A fallback that silently reorders would make the
    #   setting unobservable.
    #
    # ⚠ `extractor_name` below reports the engine that ACTUALLY produced the text, so a
    #   document read by the fallback is distinguishable from one read by the default. A
    #   fallback nobody can see in the lineage column is a fallback nobody can audit.
    _text_order = [eng["text"]] + [n for n in aspects.TEXT_ENGINES if n != eng["text"]]
    text = full_markdown = None
    _text_errors: list[str] = []
    for _engine_name in _text_order:
        try:
            text, full_markdown = aspects.TEXT_ENGINES[_engine_name](raw, mime)
            if _engine_name != eng["text"]:
                log.warning(
                    "extract_composable: text engine %r failed (%s); recovered with %r",
                    eng["text"],
                    _text_errors[0] if _text_errors else "?",
                    _engine_name,
                )
                eng["text"] = _engine_name  # lineage reports what actually read the bytes
            break
        except Exception as exc:  # noqa: BLE001
            _text_errors.append(f"{_engine_name}: {type(exc).__name__}: {exc}")
    else:
        # Every engine failed. Fatal, exactly as before — but the message now names each one,
        # so "this PDF cannot be read" is a claim with evidence behind it.
        raise RuntimeError(
            "No text engine could read this file — " + " · ".join(_text_errors)
        )

    # Tables — silent-swallow + error field (D-069-04).
    tables: list = []
    table_error: str | None = None
    try:
        tables = list(table_fn(raw, mime))
    except Exception as exc:  # noqa: BLE001
        table_error = str(exc)
        log.warning(
            "extract_composable: tables engine %r failed: %s", eng["tables"], exc
        )

    # Images — silent-swallow + error field. PDF image adapters take (raw,);
    # DOCX image adapters also take (raw,). Both signatures match.
    images: list = []
    image_error: str | None = None
    try:
        images = list(image_fn(raw))
    except Exception as exc:  # noqa: BLE001
        image_error = str(exc)
        log.warning(
            "extract_composable: images engine %r failed: %s", eng["images"], exc
        )

    # Equations — silent-swallow (no dedicated error field; equations are
    # nice-to-have, not gate-blocking per D-071.2-12).
    equations: list = []
    try:
        equations = list(equation_fn(raw, mime))
    except Exception as exc:  # noqa: BLE001
        log.warning(
            "extract_composable: equations engine %r failed: %s",
            eng["equations"],
            exc,
        )

    extractor_name = (
        f"composable[{eng['text']}/{eng['tables']}/{eng['images']}/{eng['equations']}]"
    )

    return ExtractedDocument(
        text=text,
        tables=tuple(tables),
        images=tuple(images),
        table_extraction_error=table_error,
        image_extraction_error=image_error,
        full_markdown=full_markdown,
        extractor_name=extractor_name,
        equations=tuple(equations),
    )
