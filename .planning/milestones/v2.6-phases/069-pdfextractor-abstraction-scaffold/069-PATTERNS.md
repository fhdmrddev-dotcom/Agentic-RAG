# Phase 069: `PdfExtractor` Abstraction Scaffold - Pattern Map

**Mapped:** 2026-05-13
**Files analyzed:** 5 new + 1 modified
**Analogs found:** 5 / 6

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/app/services/extraction_service.py` | service (extraction pipeline) | transform (bytes → ExtractedDocument) | `backend/app/services/multimodal_service.py` | exact (same domain, same I/O pattern) |
| `backend/app/api/documents.py` (modify L45-127, L231, L454, L623-718) | api/controller orchestrator | request-response + background-task transform | (self-edit; analog = current code pre-refactor) | n/a |
| `backend/tests/unit/test_extraction_service.py` | test (unit + golden) | transform-assertion | `backend/tests/unit/test_multimodal_extraction.py` | exact (same patching pattern, same extractor domain) |
| `backend/tests/fixtures/extraction/reference.pdf` | test fixture (binary) | static | none in repo (no existing `backend/tests/fixtures/`) | no analog — synthesize |
| `backend/tests/fixtures/extraction/reference.docx` | test fixture (binary) | static | none in repo | no analog — synthesize |
| `backend/tests/fixtures/extraction/reference_pdf_golden.json` + `reference_docx_golden.json` | test fixture (canonical output) | static JSON | none in repo | no analog — generate via one-time capture |

**Key absence:** No existing ABC usage in `backend/app/` (only one `dataclass` consumer: `tool_parser.py`). The Phase 069 ABC is the first abstract-base-class in the codebase. Pattern must be self-derived from Python stdlib `abc` conventions plus existing `@dataclass` style.

## Pattern Assignments

### `backend/app/services/extraction_service.py` (service, transform)

**Analog:** `backend/app/services/multimodal_service.py`

This is the dominant analog — the new module wraps the same engines (`pypdf`, `pdfplumber`, `python-docx`) and must preserve byte-equivalent behavior of the helpers it ports/calls.

**Module-header / lazy-import pattern** (`multimodal_service.py` lines 1-26):
```python
"""
Multi-modal extraction service for Phase 35-36.

Extracts tables (MODAL-01) and images with vision descriptions (MODAL-02)
from PDF and DOCX files during ingestion. All extractions are wrapped in
try/except — any failure silently continues ingestion.
"""
from __future__ import annotations

import base64
import io
import logging
from typing import TYPE_CHECKING

from supabase import Client

from app.services.embedding_service import embed_texts
from app.utils.db import aexec

if TYPE_CHECKING:
    from app.models.user_settings import UserEffectiveSettings

log = logging.getLogger(__name__)

PDF_MIME = "application/pdf"
DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
```

**Copy verbatim into `extraction_service.py`:**
- `from __future__ import annotations` (line 8) — required so dataclass forward-refs and `list[TableData]` postponed-evaluation work cleanly on 3.10
- `import io`, `import logging` (lines 11-12)
- `log = logging.getLogger(__name__)` (line 23) — keep the alias `log` (not `logger`) to match `multimodal_service.py`. Note: `embedding_service.py` uses `logger` — go with `multimodal_service.py`'s `log` since that is the file this phase is in dialogue with.
- `PDF_MIME` / `DOCX_MIME` module constants (lines 25-26) — re-export or re-declare (either is fine; the simpler choice is to re-declare in `extraction_service.py` so the new module is self-contained for the seam).
- `TYPE_CHECKING` guard idiom (lines 13, 20-21) — apply only if a type-only import is needed; do NOT add an unused guard.

**Lazy-imported heavy deps inside functions** (`multimodal_service.py` line 42):
```python
def extract_pdf_tables(raw: bytes) -> list[dict]:
    """Return list of table dicts extracted from PDF bytes via pdfplumber."""
    import pdfplumber

    results: list[dict] = []
    with pdfplumber.open(io.BytesIO(raw)) as pdf:
        ...
```

**Apply to `LegacyExtractor` methods:** `pypdf`, `pdfplumber`, `docx.Document`, `PIL.Image` all imported inside their method body, NOT at module top. Keeps `extraction_service.py` cheap to import (the import is paid only when extraction actually runs).

**Core dataclass pattern** (analog `backend/app/services/tool_parser.py` lines 6-26):
```python
from __future__ import annotations

import json
import re
import uuid
from dataclasses import dataclass


@dataclass
class FunctionCall:
    """Function call details within a ToolCall."""
    name: str
    arguments: str  # JSON-encoded string


@dataclass
class ToolCall:
    """OpenAI-compatible tool call representation."""
    id: str
    type: str
    function: FunctionCall
```

**Apply to `ExtractedDocument` / `TableData` / `ImageData` in `extraction_service.py`:** same `@dataclass` decorator (with `frozen=True` per D-069-01), one-line docstrings, simple typed attributes. Use `from dataclasses import dataclass` exactly as `tool_parser.py` does. D-069-01 specifies `frozen=True`, which `tool_parser.py` does not use — the upgrade is intentional (immutable contract). Concrete shape per D-069-01:

```python
@dataclass(frozen=True)
class TableData:
    page: int | None
    table_index: int
    headers: list[str]
    rows: list[list[str]]

@dataclass(frozen=True)
class ImageData:
    page: int | None
    image_index: int
    b64_png: str
    width: int
    height: int

@dataclass(frozen=True)
class ExtractedDocument:
    text: str
    tables: list[TableData]
    images: list[ImageData]
    table_extraction_error: str | None = None
    image_extraction_error: str | None = None
```

**ABC pattern (no codebase analog — derive from stdlib `abc`):**
No existing ABCs in `backend/app/`. Adopt the minimal stdlib `abc` style:

```python
from abc import ABC, abstractmethod


class PdfExtractor(ABC):
    """Engine-agnostic seam over PDF + DOCX extraction (D-069-03).

    Concrete implementations wrap a specific library stack
    (Legacy = pypdf + pdfplumber + python-docx; future = Docling, PyMuPDF,
    pypdfium2). The dispatcher (`get_extractor`) picks one per request.
    """

    @abstractmethod
    def supports(self, mime: str) -> bool: ...

    @abstractmethod
    def extract(self, raw: bytes, mime: str) -> ExtractedDocument: ...
```

**Silent-swallow per-modality pattern** (`multimodal_service.py` lines 88-126, especially L99-125):
```python
def extract_and_store_tables(
    raw: bytes, mime_type: str, document_id: str, user_id: str, supabase: Client,
) -> None:
    try:
        if mime_type == PDF_MIME:
            table_dicts = extract_pdf_tables(raw)
        elif mime_type == DOCX_MIME:
            table_dicts = extract_docx_tables(raw)
        else:
            return  # Unsupported mime type — nothing to extract

        if not table_dicts:
            return
        ...
        supabase.table("document_tables").insert(rows).execute()
        log.info("Stored %d table(s) for document %s", len(rows), document_id)

    except Exception as exc:
        log.warning("Table extraction failed for document %s: %s", document_id, exc)
```

**Apply (TRANSLATED, not verbatim) to `LegacyExtractor.extract()`:**
- Text errors **still raise** (per D-069-04) — wrap pypdf/python-docx text extraction in NO try/except; let exceptions propagate to caller's outer `except Exception` (matches today: `extract_text()` raises → `ingest_document()` catches at L713).
- Tables errors **caught + populated into `table_extraction_error`** — instead of `log.warning(...)` + silent return, capture `str(exc)` into the field and return empty `tables=[]`. Caller logs.
- Images errors **same pattern** for `image_extraction_error`.

Translated structure (excerpt for `LegacyExtractor.extract`):
```python
def extract(self, raw: bytes, mime: str) -> ExtractedDocument:
    if mime not in (PDF_MIME, DOCX_MIME):
        raise ValueError(f"LegacyExtractor does not support {mime!r}")

    # Text — raises on failure (matches today's extract_text() semantics)
    text = self._extract_text(raw, mime)

    # Tables — silent-swallow translated to error field
    tables: list[TableData] = []
    table_error: str | None = None
    try:
        tables = self._extract_tables(raw, mime)
    except Exception as exc:
        table_error = str(exc)
        log.warning("Table extraction failed: %s", exc)

    # Images — silent-swallow translated to error field
    images: list[ImageData] = []
    image_error: str | None = None
    try:
        images = self._extract_images(raw, mime)
    except Exception as exc:
        image_error = str(exc)
        log.warning("Image extraction failed: %s", exc)

    return ExtractedDocument(
        text=text, tables=tables, images=images,
        table_extraction_error=table_error,
        image_extraction_error=image_error,
    )
```

**Text-extraction port** (verbatim from `documents.py:extract_text` lines 45-52):
```python
if mime_type == "application/pdf":
    reader = PdfReader(io.BytesIO(raw))
    return "\n\n".join(page.extract_text() or "" for page in reader.pages)

if mime_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    doc = DocxDocument(io.BytesIO(raw))
    return "\n\n".join(p.text for p in doc.paragraphs if p.text.strip())
```

**Apply to `LegacyExtractor._extract_text`:** byte-equivalent port. Same `"\n\n".join(...)` joining; same `page.extract_text() or ""` fallback; same paragraph-filter `if p.text.strip()`. Imports `pypdf.PdfReader` and `docx.Document` lazily inside the method.

**Tables/images delegation** (per CONTEXT.md "Claude's Discretion" — recommend smaller diff):
Keep `extract_pdf_tables`, `extract_docx_tables`, `extract_pdf_images`, `extract_docx_images` where they are in `multimodal_service.py` and have `LegacyExtractor` import + call them. Reasons:
- `multimodal_service.py:88-126` still calls these directly for table-storage flow. Moving them breaks that path.
- Module-level patchability survives unchanged (existing tests still `patch("app.services.multimodal_service.extract_pdf_tables")`).
- New tests for `LegacyExtractor` can patch the same module symbols.

Inside `LegacyExtractor._extract_tables`:
```python
from app.services.multimodal_service import extract_pdf_tables, extract_docx_tables

if mime == PDF_MIME:
    dicts = extract_pdf_tables(raw)
elif mime == DOCX_MIME:
    dicts = extract_docx_tables(raw)
else:
    return []
return [TableData(**d) for d in dicts]
```

Same delegation shape for `_extract_images` with `ImageData(**d)`.

**Dispatcher pattern (no analog — minimal new code):**
```python
_LEGACY = LegacyExtractor()  # module-level singleton — stateless

def get_extractor(mime: str) -> PdfExtractor | None:
    """Return an extractor that supports `mime`, or None.

    Phase 069 always returns LegacyExtractor for PDF/DOCX, None otherwise.
    Phase 071 will consult app_settings/env to pick between engines.
    """
    if _LEGACY.supports(mime):
        return _LEGACY
    return None
```

**`supports()` body** (LegacyExtractor):
```python
def supports(self, mime: str) -> bool:
    return mime in (PDF_MIME, DOCX_MIME)
```

---

### `backend/app/api/documents.py` (modify L45-127, L231, L454, L623-718)

**Analog:** self-edit. The pre-refactor code IS the spec. Excerpts below are what to preserve byte-equivalently and what to delegate.

**L45-127 `extract_text()` — split point:**
- PDF branch (L46-48) and DOCX branch (L50-52) move into `LegacyExtractor._extract_text` (the text-only portion).
- The other 7 branches (PPTX L54-69, XLSX L71-86, CSV L88-91, EPUB L93-124, default text/markdown/HTML L127) stay in `extract_text()` unchanged per D-069-02.
- `extract_text()` now contains only the 7 remaining MIME branches. The PDF + DOCX branches are removed because callers route those MIMEs through `get_extractor()` first.

**L231 `extract_text(raw, mime_type)` upload caller** (current code):
```python
try:
    text = extract_text(raw, mime_type)
except Exception as e:
    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail=f"Could not extract text from file: {e}",
    )
```

**Rewire pattern:** call dispatcher first; if it returns an extractor, run it eagerly here to get the text-failure-raises semantics. If `None`, fall back to `extract_text()`. Either way, push the resulting `text` (and, when present, the full `ExtractedDocument`) onto `background_tasks.add_task(ingest_document, ...)`.

Two viable shapes — recommend the simpler one (smaller diff):

**Option A (recommended for diff-min):** Run extraction eagerly at L231 just like today's `extract_text()` call. Caller of `ingest_document` gets back `text + ExtractedDocument | None`. The `ExtractedDocument` is passed through as a new kwarg; if it's not None, `ingest_document` uses its `tables` / `images` instead of re-extracting.

```python
try:
    extractor = get_extractor(mime_type)
    if extractor is not None:
        extracted = extractor.extract(raw, mime_type)
        text = extracted.text
    else:
        extracted = None
        text = extract_text(raw, mime_type)
except Exception as e:
    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail=f"Could not extract text from file: {e}",
    )
```

**Option B (defer extraction to background task):** Only call `extract_text()` / dispatcher inside `ingest_document`. Cleaner but changes when the 422 fires (today: at upload; with B: never — error surfaces in `documents.status='failed'`). Option B changes user-visible error-surfacing behavior → **reject**. Keep eager extraction at L231.

**L454 re-ingest caller** — same translation as L231 (eager `get_extractor()` + fallback).

**L623-718 `ingest_document` body — preserve EXACTLY:**
- `ingestion_step` updates: `extracting` → `chunking` → `embedding` → `extracting_tables` → `extracting_images` → `metadata` (L638, L651, L678, L699, L702, L705). Byte-equivalent ordering.
- Chunking + embedding (L651-691). Unchanged.
- Multimodal section L693-703:
```python
if raw and mime_type:
    from app.services.multimodal_service import (  # noqa: PLC0415
        extract_and_store_tables,
        extract_and_store_images,
    )
    supabase.table("documents").update({"ingestion_step": "extracting_tables"}).eq("id", document_id).execute()
    extract_and_store_tables(raw, mime_type, document_id, user_id, supabase)

    supabase.table("documents").update({"ingestion_step": "extracting_images"}).eq("id", document_id).execute()
    extract_and_store_images(raw, mime_type, document_id, user_id, supabase, app_settings)
```

**Per CONTEXT.md §code_context "Integration Points option (a)" (recommend):** keep this section EXACTLY as-is. `extract_and_store_*` continue to re-extract internally from `raw`. The `ExtractedDocument` already produced upstream is discarded here in Phase 069. Wasteful (one duplicate extraction) but byte-equivalent and minimal diff. Phase 071 refactors `extract_and_store_*` to consume `ExtractedDocument` directly.

If golden fixtures pass and integration tests pass, the duplicate extraction is acceptable for one phase.

**Outer except L713-718:** unchanged. Same `status='failed'` + `error_message` truncation.

---

### `backend/tests/unit/test_extraction_service.py` (test, transform-assertion)

**Analog:** `backend/tests/unit/test_multimodal_extraction.py`

**Imports + patching pattern** (lines 1-9):
```python
"""
Unit tests for multimodal extraction (Phase 35).
...
"""
import pytest
from unittest.mock import MagicMock, patch
```

**Apply:** same imports. Add `json` for golden-fixture diff, `pathlib.Path` for fixture loading.

**Module-level patch pattern** (line 28):
```python
with patch("app.services.multimodal_service.extract_pdf_tables") as mock_extract:
    mock_extract.return_value = [
        {"page": 1, "table_index": 0, "headers": ["Col1", "Col2"], "rows": [["a", "b"]]}
    ]
    extract_and_store_tables(
        raw=fake_pdf_bytes,
        mime_type="application/pdf",
        ...
    )
```

**Apply to LegacyExtractor tests** for error-field semantics:
```python
def test_legacy_extractor_table_failure_populates_error_field():
    from app.services.extraction_service import LegacyExtractor, PDF_MIME

    with patch("app.services.multimodal_service.extract_pdf_tables") as m:
        m.side_effect = RuntimeError("pdfplumber exploded")
        # Stub text + images extraction so only tables fails
        with patch.object(LegacyExtractor, "_extract_text", return_value="hello"):
            with patch.object(LegacyExtractor, "_extract_images", return_value=[]):
                result = LegacyExtractor().extract(b"%PDF-1.4", PDF_MIME)

    assert result.text == "hello"
    assert result.tables == []
    assert result.table_extraction_error is not None
    assert "pdfplumber exploded" in result.table_extraction_error
```

**Silent-swallow assertion pattern (mirror)** (lines 79-97):
```python
def test_table_extraction_failure_continues():
    from app.services.multimodal_service import extract_and_store_tables

    mock_supabase = MagicMock()

    with patch("app.services.multimodal_service.extract_pdf_tables") as mock_extract:
        mock_extract.side_effect = RuntimeError("pdfplumber exploded")
        # Must NOT raise
        extract_and_store_tables(...)

    mock_supabase.table.assert_not_called()
```

**Apply to:** `test_legacy_extractor_text_failure_raises` (text errors raise per D-069-04) and `test_legacy_extractor_table_failure_does_not_raise`.

**Golden-fixture pattern (no analog — derive):**
```python
from pathlib import Path
import json
from dataclasses import asdict

FIXTURES = Path(__file__).parent.parent / "fixtures" / "extraction"

def _normalize(obj):
    """Round floats to 4 decimals + sort dict keys for deterministic compare."""
    if isinstance(obj, float):
        return round(obj, 4)
    if isinstance(obj, dict):
        return {k: _normalize(obj[k]) for k in sorted(obj)}
    if isinstance(obj, list):
        return [_normalize(x) for x in obj]
    return obj

def test_legacy_extractor_pdf_matches_golden():
    from app.services.extraction_service import LegacyExtractor, PDF_MIME
    raw = (FIXTURES / "reference.pdf").read_bytes()
    extracted = LegacyExtractor().extract(raw, PDF_MIME)
    actual = _normalize(asdict(extracted))
    expected = _normalize(json.loads((FIXTURES / "reference_pdf_golden.json").read_text()))
    assert actual == expected
```

**ABC contract tests (mirror D-069-06 layer 2):**
- `test_legacy_supports_returns_true_for_pdf_and_docx`
- `test_legacy_supports_returns_false_for_other_mimes`
- `test_extract_unsupported_mime_raises_valueerror`
- `test_get_extractor_returns_none_for_unsupported_mime`
- `test_get_extractor_returns_legacy_for_pdf` / `..._for_docx`

---

### `backend/tests/fixtures/extraction/*.pdf` + `*.docx` (test fixture, static)

**No analog in codebase** — `backend/tests/fixtures/` does not exist yet (Glob returned no results).

**Approach (per CONTEXT.md "Claude's Discretion"):**
- Synthesize small reference docs at fixture-prep time using `reportlab` (PDF) + `python-docx` (DOCX). Both are already transitive deps; `reportlab` may need a `requirements-dev.txt` line if not present — check during execution.
- License-clean: synthetic content like "Reference PDF for extraction tests. Page 1.\n\n## Section A\nBody text..." with one simple table and one small PNG image embedded.
- Target ~1–2 MB max per D-069-06.
- Generation script committed alongside fixtures (one-time, but checked in for reproducibility).

---

### `backend/tests/fixtures/extraction/reference_pdf_golden.json` + `reference_docx_golden.json`

**No analog** — derive from D-069-06 layer 1.

**Generation flow (one-time, then committed):**
1. With Phase 069's `LegacyExtractor` complete, run `LegacyExtractor().extract(reference.pdf_bytes, PDF_MIME)`.
2. `dataclasses.asdict(extracted)` → dict.
3. Pass through `_normalize` (4-decimal float rounding, key-sort).
4. Write JSON with `indent=2, sort_keys=True` for stable diffs.
5. Commit the JSON. **From then on, every test run re-runs extraction and asserts equal to this canonical output.**

If a future refactor must change extraction output, the diff is visible in the JSON file's git history and requires a deliberate update.

---

### `.planning/prd-reset/DECISIONS.md` (Plan 2 — D-PRD-07 appendix)

**Analog:** existing D-PRD-NN entries in `.planning/prd-reset/DECISIONS.md` (D-PRD-07 itself at lines 502-580 — referenced by CONTEXT.md §canonical_refs).

**Pattern (per D-069-05):** Append an "Appendix" subsection under D-PRD-07 (do not create a new D-PRD-NN). Match the existing style:
- ~30-50 lines (per "Claude's Discretion")
- Bulleted facts: AGPL-3.0 license, D-PRD-03 closed-core constraint, subprocess fence mechanism, dev/personal-use posture, commercial-redistribution requirements (subprocess fence OR PyMuPDF Pro).
- No code, no dependency edits — pure documentation per D-069-05 + CONTEXT.md §specifics.

---

## Shared Patterns

### `from __future__ import annotations` + lazy heavy imports
**Source:** `backend/app/services/multimodal_service.py` line 8, line 42
**Apply to:** `extraction_service.py` (module top + every method that imports `pypdf` / `pdfplumber` / `python-docx` / `PIL`).
```python
from __future__ import annotations  # module top

def _extract_text(self, raw: bytes, mime: str) -> str:
    if mime == PDF_MIME:
        from pypdf import PdfReader  # inside function — lazy
        reader = PdfReader(io.BytesIO(raw))
        ...
```

### Module-level patchable helpers
**Source:** `backend/app/services/multimodal_service.py` lines 40, 62, 132, 175
**Apply to:** `LegacyExtractor` methods delegate to `multimodal_service.extract_pdf_tables` etc. by reference, NOT inline reimplementation. Tests can continue to `patch("app.services.multimodal_service.extract_pdf_tables")` — that single patch covers BOTH the legacy `extract_and_store_tables` path AND the new `LegacyExtractor._extract_tables` path.

### Silent-swallow on tables/images errors (translated to error fields)
**Source:** `backend/app/services/multimodal_service.py` lines 99-125 (and the parallel image block L267-376)
**Apply to:** `LegacyExtractor.extract` per-modality try/except → populate `table_extraction_error` / `image_extraction_error` fields, return empty list. Caller (`ingest_document`) inspects fields and `log.warning(...)` — matches today's net behavior.

### `log = logging.getLogger(__name__)` (NOT `logger`)
**Source:** `backend/app/services/multimodal_service.py` line 23
**Apply to:** `extraction_service.py` for consistency within the extraction/multimodal cluster. (Project mixes `log` vs `logger` — `embedding_service.py` uses `logger`; match the closer neighbor.)

### Dataclass with `@dataclass(frozen=True)`
**Source:** `backend/app/services/tool_parser.py` lines 11, 14, 21 (style); D-069-01 (adds `frozen=True`)
**Apply to:** `TableData`, `ImageData`, `ExtractedDocument` — all immutable per D-069-01.

### `noqa: PLC0415` on in-function imports
**Source:** `backend/app/api/documents.py` line 695 (`from app.services.multimodal_service import (...)  # noqa: PLC0415`), `multimodal_service.py` line 278
**Apply to:** any in-function imports inside `LegacyExtractor` methods that the linter flags. Inline import inside `extract_pdf_tables` (`multimodal_service.py:42`) does NOT have `# noqa` — so the linter rule isn't always enforced. Use only when ruff complains.

---

## No Analog Found

Files with no close match in the codebase:

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `backend/tests/fixtures/extraction/reference.pdf` | binary test fixture | static | No `backend/tests/fixtures/` directory exists. Synthesize via `reportlab`. |
| `backend/tests/fixtures/extraction/reference.docx` | binary test fixture | static | Same — synthesize via `python-docx`. |
| `backend/tests/fixtures/extraction/*_golden.json` | canonical JSON fixture | static | First golden-fixture pattern in repo. Derive shape from `dataclasses.asdict` + normalization helper. |
| `PdfExtractor` ABC | abstract base class | n/a | No existing ABC in `backend/app/` (verified via grep `from abc import|abc.ABC|abc.abstractmethod`). Phase 069 introduces the first. Use stdlib `abc.ABC` + `@abstractmethod` minimal style. |

## Metadata

**Analog search scope:** `backend/app/services/`, `backend/app/api/`, `backend/tests/unit/`, `backend/tests/fixtures/`, repo-wide grep for `abc.ABC` / `@dataclass`.
**Files scanned:** ~12 (multimodal_service.py, documents.py, embedding_service.py, tool_parser.py, test_multimodal_extraction.py, plus globs for fixtures/ABC).
**Pattern extraction date:** 2026-05-13
