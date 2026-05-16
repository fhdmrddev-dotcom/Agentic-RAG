# Phase 072: Multimodal Lift + DOCX Completeness — Pattern Map

**Mapped:** 2026-05-16
**Files analyzed:** 9 (4 source edits / 1 new engine fn / 1 registry edit / 1 new migration / 2 test files / 1 fixture reuse)
**Analogs found:** 9 / 9 (every file has a strong in-repo analog — no greenfield)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/app/services/multimodal_service.py` (edit) | service / orchestrator | batch-transform (raw bytes → vision-LLM → DB rows) | self — Phase 35 baseline + Phase 071.2 D-071.2-08 patch | exact (in-place edit) |
| `backend/app/services/extractors/aspects/images_pdf.py` — new `vision_sweep_images_pdf` | aspect adapter / engine implementation | batch-transform (raw bytes → list[ImageData]) | `pymupdf_full_images_pdf` (same file, lines 35-84) | exact |
| `backend/app/services/extractors/aspects/__init__.py` (edit) | registry | dict-lookup config | self — existing `IMAGE_ENGINES_PDF` dict (lines 64-67) | exact |
| `backend/app/services/extraction_service.py` (edit `LegacyExtractor._extract_images`) | dispatcher | request-response (mime → list[ImageData]) | self — current body at lines 196-210 | exact |
| `backend/app/api/documents.py` — `/reextract` route query-param edit | route / controller | request-response + BackgroundTask | self — `reextract_document` at line 732, especially the existing `engines: str \| None = Query(...)` param at lines 737-745 | exact |
| `supabase/migrations/048_app_settings_image_engine_pdf_vision_sweep.sql` (new) | schema migration | DDL | `supabase/migrations/047_app_settings_table_engine_default.sql` | exact (same CHECK-widening shape) |
| `backend/tests/unit/test_multimodal_extraction.py` (new tests appended) | unit test | mock-and-assert | self — existing tests at lines 16-372 (esp. `test_pdf_images_stored` line 104, `test_extract_and_store_images_uses_extracted_doc` line 302) | exact |
| `backend/tests/integration/test_documents.py` (new `/reextract?retry_empty_descriptions_only=true` test if Shape B) | integration test | HTTP request-response | `test_reextract_happy_path_returns_202` (same file, line 573) | exact |
| `backend/tests/fixtures/extraction/friendly_real.pdf` | fixture | binary input | reuse from Phase 071.1 — already present | exact (no commit needed) |

---

## Pattern Assignments

### 1. `backend/app/services/extractors/aspects/images_pdf.py` — ADD `vision_sweep_images_pdf`

**Analog:** existing `pymupdf_full_images_pdf` in same file (lines 35-84).

**Module header / import pattern** (`images_pdf.py:1-19`):
```python
"""PDF image-aspect adapters for the per-aspect extraction dispatcher
(Phase 071.2 Plan 05, D-071.2-02).

Phase 071.3 Plan 04 Phase G (D-071.3-11): the PyMuPDF subprocess fence was
retired after the in-process smoke test verified `import fitz` works
post-httpx-unpin. PyMuPDF AGPL-3.0 in-process imports are permitted per
D-PRD-07; AGPL disclosure remains in `backend/requirements.txt`.
"""
from __future__ import annotations

import base64
import io
import logging

from PIL import Image as PILImage

from app.services.extraction_service import ImageData

log = logging.getLogger(__name__)
```

**Engine function signature + return type** (`images_pdf.py:35-50`):
```python
def pymupdf_full_images_pdf(raw: bytes) -> list[ImageData]:
    """Full PyMuPDF image extraction via in-process `import fitz`.
    ...
    AGPL: PyMuPDF is AGPL-3.0; in-process import is permitted per D-PRD-07 +
    D-071.3-11 (in-process smoke test verified compatibility with unpinned
    httpx). The subprocess fence shipped in Phase 071 has been retired.
    """
    import fitz  # noqa: PLC0415 — AGPL in-process per D-PRD-07
```

**Per-image try/except / b64 encode pattern** (`images_pdf.py:56-82`):
```python
for page_num, page in enumerate(doc, start=1):
    for (xref, *_) in page.get_images(full=True):
        try:
            info = doc.extract_image(xref)
            raw_img = info["image"]
            img = PILImage.open(io.BytesIO(raw_img)).convert("RGB")
            buf = io.BytesIO()
            img.save(buf, format="PNG")
            b64 = base64.b64encode(buf.getvalue()).decode("ascii")
            images.append(
                ImageData(
                    page=page_num,
                    image_index=global_idx,
                    b64_png=b64,
                    width=info.get("width") or img.width,
                    height=info.get("height") or img.height,
                    bbox=None,
                )
            )
            global_idx += 1
        except Exception as e:  # noqa: BLE001
            log.warning(
                "pymupdf_full_images_pdf: image extraction failed "
                "(xref=%s, page=%s): %s",
                xref, page_num, e,
            )
```

**What `vision_sweep_images_pdf` should copy:**
- Same module-level `from PIL import Image as PILImage` + lazy `import fitz` inside the function (AGPL in-process is fine).
- Same `try: ... finally: doc.close()` outer scope.
- Same per-image broad-catch + `log.warning` (silent-per-image-failure invariant, D-069-04).
- Same `ImageData(page, image_index, b64_png, width, height, bbox)` construction. **`bbox` can be populated** from the LLM-returned page-relative bbox (figure crop coords) since `ImageData.bbox: dict | None = None` accepts arbitrary JSON.
- Same `global_idx` counter pattern across pages.

**What's NEW for `vision_sweep_images_pdf` (no direct analog — pull from CONTEXT.md D-072-01/11):**
```python
def vision_sweep_images_pdf(
    raw: bytes,
    mime: str,
    *,
    vision_client,
    app_settings,
    # planner-shaped: max_pages, caption_filter, ...
) -> list[ImageData]:
    """Per-page raster + vision-LLM "list figures + bboxes" sweep (D-072-01).
    Opt-in via app_settings.extraction_image_engine_pdf='vision_sweep'.
    """
    import fitz  # noqa: PLC0415
    doc = fitz.Document(stream=raw, filetype="pdf")
    try:
        # 1. Page cap via app_settings.vision_sweep_max_pages (D-072-11).
        # 2. Optional caption-regex pre-filter (D-072-11 recommended heuristic).
        # 3. page.get_pixmap(dpi=150) → PNG bytes → b64 → vision LLM call.
        # 4. Parse Pydantic response (see Shared Patterns §Pydantic structured output).
        # 5. PIL.Image.crop(bbox) per detected figure → ImageData(..., bbox=...).
        ...
    finally:
        doc.close()
```

**Signature deviation note:** the existing `pymupdf_full_images_pdf(raw)` takes only `raw`. The composer at `extraction_service.py:322` calls `image_fn(raw)`. **Vision_sweep needs `vision_client` + `app_settings`** — planner must either (a) extend the image adapter calling convention (touches `extract_composable`), or (b) bind the deps via partial / closure when registering. Recommend (a) with a backward-compatible `*, vision_client=None, app_settings=None` kwarg-only addition; `pymupdf_full` will just ignore them.

---

### 2. `backend/app/services/extractors/aspects/__init__.py` — REGISTER `vision_sweep`

**Analog:** existing registry edit pattern (same file, lines 38-67).

**Import + registry pattern** (`__init__.py:38-67`):
```python
from app.services.extractors.aspects.images_pdf import (
    pdfplumber_images_pdf,
    pymupdf_full_images_pdf,
)
# ...
# PDF image adapters return list[ImageData]; called with (raw_bytes,)
IMAGE_ENGINES_PDF: dict = {
    "pdfplumber": pdfplumber_images_pdf,
    "pymupdf_full": pymupdf_full_images_pdf,
}
```

**Edit shape:** add `vision_sweep_images_pdf` to the import block and `"vision_sweep": vision_sweep_images_pdf,` to `IMAGE_ENGINES_PDF`. Also update the module docstring's "images_pdf:" allowed-values list (lines 24).

---

### 3. `backend/app/services/multimodal_service.py` — primary edit zone

**Analog:** self (the file ALREADY has the structural shape Phase 072 needs; only the constants + small bodies change).

**Module-constant pattern to PRESERVE** (`multimodal_service.py:26-34`):
```python
PDF_MIME = "application/pdf"
DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

# Maximum vision API calls per document (Pitfall 6: large PDFs)
_MAX_VISION_CALLS = 20

# Maximum base64 payload size per image — prevents uncapped vision API calls
# 512 KB is sufficient for any low-detail vision call
_MAX_B64_BYTES = 512 * 1024
```

**Edit per D-072-08:** delete `_MAX_VISION_CALLS` + `_MAX_B64_BYTES`. **Replace with one new constant** for D-072-02:
```python
# Max edge length (px) for PIL.thumbnail() before vision-LLM call (D-072-02).
# OpenAI detail=low downsamples to 512px internally → no quality gain >1024px.
MULTIMODAL_THUMBNAIL_MAX_EDGE = 1024
```

**`extract_and_store_images` settings-read pattern** (`multimodal_service.py:276-326`):
```python
def extract_and_store_images(
    raw: bytes,
    mime_type: str,
    document_id: str,
    user_id: str,
    supabase: Client,
    app_settings: "UserEffectiveSettings",
    extracted_doc: "ExtractedDocument | None" = None,   # Phase 071.2 D-071.2-08
) -> None:
    """...Capped at _MAX_VISION_CALLS per document...."""
    try:
        if extracted_doc is not None and extracted_doc.images:
            image_dicts = [
                {
                    "page": im.page,
                    "image_index": im.image_index,
                    "b64_png": im.b64_png,
                    ...
```

**Edit per D-072-08:** replace `_MAX_VISION_CALLS` references (line 328 — `image_dicts[:_MAX_VISION_CALLS]`) with `image_dicts[:app_settings.multimodal_max_vision_calls]`. Replace `_MAX_B64_BYTES` (line 333) with `app_settings.multimodal_max_b64_bytes_kb * 1024`. The `app_settings` parameter is **already plumbed** (line 282) — no signature change.

**Empty-description early-continue to REMOVE (D-072-03)** (`multimodal_service.py:343-345`):
```python
if not description:
    log.debug("Skipping image with no description in %s", document_id)
    continue
```
**Edit:** delete these three lines. The row append at line 346 then runs unconditionally with `description: ""` when vision failed.

**Vision-call-with-downscale pattern (D-072-02) — insert before line 339:**
```python
# D-072-02: downscale before vision call (PIL.thumbnail in-place, ~10ms).
from PIL import Image as PILImage  # noqa: PLC0415 (already lazy-imported elsewhere)
# decode b64 → thumbnail → re-encode b64 (only if larger than max edge).
# Planner picks: do this before or after the size-filter check.
```

**`extract_docx_images` replacement (D-072-07) — recommendation:**
The existing `zip_xpath_docx` in `aspects/images_docx.py` ALREADY implements the `wp:anchor` + headers/footers walk (see `images_docx.py:123-215`) and is the registered default via `app_settings.extraction_image_engine_docx = 'zip_xpath'` (`user_settings.py:99`). **Plan 02 may simply delegate `extract_docx_images` to call into the existing path** OR keep the inline_shapes-only `extract_docx_images` and rely on the per-aspect dispatcher routing through `zip_xpath_docx`. Recommend the latter (zero new code; dispatcher already handles it). The remaining 072 work on `extract_docx_images` becomes: **add `_dedup_images_by_hash` invocation + description-prefix `[Image header]: ...` per D-072-06**.

**Silent-swallow outer wrapper to PRESERVE** (`multimodal_service.py:298, 421-422`):
```python
try:
    ...
except Exception as exc:
    log.warning("Image extraction failed for document %s: %s", document_id, exc)
```
D-069-04 invariant — never raises. Phase 072 keeps this verbatim.

---

### 4. `backend/app/services/extraction_service.py` — `LegacyExtractor._extract_images` (lines 196-210)

**Analog:** sibling `_extract_tables` method (same file, lines 179-194).

**Current body** (`extraction_service.py:196-210`):
```python
def _extract_images(self, raw: bytes, mime: str) -> list[ImageData]:
    """Delegate to module-level helpers in multimodal_service ...
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
```

**Phase 072 edit per D-072-01:** the primary path is now `extract_composable` (which routes via `IMAGE_ENGINES_PDF`); `LegacyExtractor._extract_images` is a fallback for callers that bypass the composer. Planner picks one of:
- (a) Leave `_extract_images` unchanged — vision_sweep is composer-only. Simpler. Recommend.
- (b) Route through the composer's registry inside `_extract_images` — couples LegacyExtractor to `aspects.IMAGE_ENGINES_PDF`. Avoid.

**Recommendation:** (a). The CONTEXT.md note about `LegacyExtractor._extract_images` (lines 192-206) being "rerouted" is stale pre-2026-05-16 wording — post the per-aspect dispatcher landing, the legacy method is a vestigial fallback.

---

### 5. `backend/app/api/documents.py` — `/reextract` retry-empty-only flag (D-072-04 Shape B)

**Analog:** existing `engines` Query param on the same route (`documents.py:737-745`).

**Existing Query-param pattern** (`documents.py:732-748`):
```python
@router.post("/{document_id}/reextract", response_model=DocumentResponse, status_code=202)
async def reextract_document(
    document_id: str,
    body: ReextractRequest,
    background_tasks: BackgroundTasks,
    engines: str | None = Query(
        default=None,
        description=(
            "Phase 071.2 D-071.2-03 — per-call extraction engine override hint. "
            "Format: 'text:docling,tables:docling_tf,images:zip_xpath,equations:docling_formula'. "
            "When set, overrides body.engine (which becomes the text-engine alias). "
            "Subject to app_settings.extraction_per_call_hints_enabled flag."
        ),
    ),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
```

**Edit per D-072-04 Shape B — add a sibling Query param:**
```python
retry_empty_descriptions_only: bool = Query(
    default=False,
    description=(
        "Phase 072 D-072-04 — when true, ONLY refill rows in document_images "
        "where description='' AND extracted_at < now() - 5min. Skips the "
        "delete-cascade + re-extract entirely. Leaves text/tables and non-empty "
        "image rows untouched."
    ),
),
```

**Branch shape inside handler** — gate the existing delete-cascade (`documents.py:813-823`) on `not retry_empty_descriptions_only`. When the flag is set, skip steps 3 + 5 (delete + text re-extract); jump directly to a new helper that loops over empty-description rows and calls `describe_image` for each.

**Cascade-delete pattern to PRESERVE (Shape A fallback)** (`documents.py:815-823`):
```python
await run_in_threadpool(
    lambda: supabase.table("document_chunks").delete().eq("document_id", document_id).execute()
)
await run_in_threadpool(
    lambda: supabase.table("document_tables").delete().eq("document_id", document_id).execute()
)
await run_in_threadpool(
    lambda: supabase.table("document_images").delete().eq("document_id", document_id).execute()
)
```

**`run_in_threadpool` wrapping invariant** (CLAUDE.md / D-v2.5-01): every supabase-py `.execute()` in async handlers MUST be wrapped. Phase 072's new empty-row loop follows the same pattern verbatim.

---

### 6. `supabase/migrations/048_app_settings_image_engine_pdf_vision_sweep.sql` (new)

**Analog:** `supabase/migrations/047_app_settings_table_engine_default.sql` (closest in shape — same column family `extraction_*_engine_*`, same CHECK widening). Migration 045 added the column with no constraint; 048 is the first to add one for `extraction_image_engine_pdf`, so 047's DROP-IF-EXISTS-then-ADD shape is the safe analog.

**Migration 047 shape (the analog) — `migrations/047_app_settings_table_engine_default.sql:21-40`:**
```sql
ALTER TABLE public.app_settings
  DROP CONSTRAINT IF EXISTS app_settings_extraction_table_engine_pdf_check;

UPDATE public.app_settings
SET extraction_table_engine_pdf = 'pdfplumber'
WHERE extraction_table_engine_pdf = 'docling_tf';

ALTER TABLE public.app_settings
  ALTER COLUMN extraction_table_engine_pdf DROP DEFAULT;

ALTER TABLE public.app_settings
  ADD CONSTRAINT app_settings_extraction_table_engine_pdf_check
  CHECK (extraction_table_engine_pdf IN ('camelot', 'pdfplumber'));

ALTER TABLE public.app_settings
  ALTER COLUMN extraction_table_engine_pdf SET DEFAULT 'camelot';

UPDATE public.app_settings
SET extraction_table_engine_pdf = 'camelot'
WHERE id = 'global';
```

**Migration 048 shape (mirror, simplified — no pre-existing rows to migrate, default stays the same):**
```sql
-- Migration 048: widen app_settings.extraction_image_engine_pdf CHECK to
-- include 'vision_sweep' (Phase 072 D-072-10).
--
-- Why: Phase 072 D-072-01 adds a new opt-in PDF image engine `vision_sweep`
-- (per-page rasterize + vision-LLM "list figures + bboxes"). The column was
-- added by migration 045 without a CHECK constraint, but adding one now
-- bounds the legal values to the IMAGE_ENGINES_PDF registry keys, matching
-- migration 047's invariant on extraction_table_engine_pdf.
--
-- Default stays 'pymupdf_full' — vision_sweep is opt-in per operator action.
-- Idempotency: DROP CONSTRAINT IF EXISTS protects against re-application.
-- No pre-migration UPDATE needed (no rows currently store an out-of-set value).

ALTER TABLE public.app_settings
  DROP CONSTRAINT IF EXISTS app_settings_extraction_image_engine_pdf_check;

ALTER TABLE public.app_settings
  ADD CONSTRAINT app_settings_extraction_image_engine_pdf_check
  CHECK (extraction_image_engine_pdf IN ('pdfplumber', 'pymupdf_full', 'vision_sweep'));
```

**Optional guardrail columns from D-072-11 — fold in OR ship as 049** (planner picks). If folded:
```sql
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS vision_sweep_max_pages integer DEFAULT 20,
  ADD COLUMN IF NOT EXISTS vision_sweep_estimated_cost_warn_usd numeric DEFAULT 5.0;
```
(Pattern: `ADD COLUMN IF NOT EXISTS` matches migration 044 line 9-10 and migration 045 lines 12-18.)

**CLAUDE.md migration discipline (MANDATORY checkpoint in Plan 03):**
1. Paste file contents into Supabase SQL editor (NOT `supabase db push`, NOT `supabase db reset`).
2. Run `bash scripts/regenerate-full-schema.sh` (no `--reset`) to refresh `supabase/full-schema.sql`.
3. Commit migration `048_*.sql` AND regenerated `full-schema.sql` together.

---

### 7. `backend/tests/unit/test_multimodal_extraction.py` — new tests

**Analog:** existing tests in same file. Several distinct patterns to copy:

**(a) Mock supabase chain pattern** (`test_multimodal_extraction.py:21-26`):
```python
mock_supabase = MagicMock()
mock_builder = MagicMock()
mock_supabase.table.return_value = mock_builder
mock_builder.insert.return_value = mock_builder
mock_builder.execute.return_value = MagicMock(data=[])
```

**(b) Patch-the-module-level-helper pattern** (`test_multimodal_extraction.py:119-124`):
```python
with patch("app.services.multimodal_service.extract_pdf_images") as mock_imgs, \
     patch("app.services.multimodal_service.describe_image") as mock_desc:
    mock_imgs.return_value = [
        {"page": 1, "image_index": 0, "b64_png": "abc123", "width": 200, "height": 200}
    ]
    mock_desc.return_value = "A bar chart showing quarterly revenue."
```
**Phase 072 reuse:** for `vision_sweep` tests, patch `app.services.extractors.aspects.images_pdf.vision_sweep_images_pdf`'s `vision_client.chat.completions.create` (or whatever the LLM call shape becomes) to return a canned Pydantic-parseable JSON of figures. For app_settings tests (D-072-08), patch `app_settings.multimodal_max_vision_calls` on a `MagicMock()`.

**(c) Mock `app_settings`** (`test_multimodal_extraction.py:114-117`):
```python
mock_settings = MagicMock()
mock_settings.llm_model = "openai/gpt-4o"
mock_settings.llm_api_key = "test-key"
mock_settings.llm_base_url = ""
```
**Phase 072 extension:** add `mock_settings.multimodal_max_vision_calls = 100` (D-072-08) + `mock_settings.multimodal_max_b64_bytes_kb = 4096` to settings-aware tests.

**(d) "Must NOT raise" pattern** (`test_multimodal_extraction.py:188-197`):
```python
mock_desc.side_effect = Exception("Model does not support vision")
# Must NOT raise
extract_and_store_images(...)
```
**Phase 072 reuse for D-072-03:** when `describe_image` fails, assert that `insert.call_args` shows ONE row with `description == ""` (not zero rows — that's the regression). Replaces today's `mock_builder.insert.assert_not_called()` on line 200.

**(e) Fixture-bytes PIL pattern** (`test_multimodal_extraction.py:209-212`):
```python
import io, base64
from PIL import Image as PILImage
buf = io.BytesIO()
PILImage.new("RGB", (60, 60), color=(255, 255, 255)).save(buf, format="PNG")
png_bytes = buf.getvalue()
```
**Phase 072 reuse for D-072-06 (dedup):** craft two distinct PNGs with identical bytes (or compute the SHA1 of one and assert the second is skipped via the shared `_dedup_images_by_hash` helper).

**(f) `ExtractedDocument` dataclass construction** (`test_multimodal_extraction.py:257-269`):
```python
from app.services.extraction_service import ExtractedDocument, ImageData

ed = ExtractedDocument(
    text="",
    tables=(),
    images=(ImageData(page=1, image_index=0, b64_png="...", width=100, height=100, bbox=None),),
    ...
)
```
**Phase 072 reuse:** Plan 03 binding test for `vision_sweep` constructs an `ExtractedDocument` whose `images` tuple is populated by a stubbed `vision_sweep_images_pdf` (no real LLM call), then asserts `extract_and_store_images(..., extracted_doc=ed)` inserts the right rows.

---

### 8. `backend/tests/integration/test_documents.py` — `/reextract?retry_empty_descriptions_only=true`

**Analog:** existing `test_reextract_happy_path_returns_202` at line 573.

**Mock-side-effect sequence pattern** (`test_documents.py:589-595`):
```python
mock_builder.execute.side_effect = [
    _make_result(pdf_doc),                                       # owner SELECT
    _make_result([]),                                            # delete chunks
    _make_result([]),                                            # delete tables
    _make_result([]),                                            # delete images
    _make_result([{**pdf_doc, "status": "pending"}]),            # UPDATE documents
]
```

**Phase 072 retry-empty-only test side_effect sequence** (delete cascade SKIPPED per D-072-04 Shape B):
```python
mock_builder.execute.side_effect = [
    _make_result(pdf_doc),                                       # owner SELECT
    _make_result([{"image_index": 0, "page": 1, "b64_png": "..."} ]),  # SELECT empty-description rows
    _make_result([]),                                            # UPDATE document_images SET description=...
]
```

**Patch composer + ingest pattern** (`test_documents.py:604-625`):
```python
with patch("app.api.documents.ingest_document") as mock_ingest, \
     patch("app.services.extraction_service.extract_composable") as mock_compose:
    mock_extracted = MagicMock()
    mock_extracted.text = "extracted text"
    mock_extracted.extractor_name = "composable[legacy/camelot/pymupdf_full/none]"
    mock_compose.return_value = mock_extracted

    response = client.post(
        f"/documents/{DOC_ID}/reextract",
        headers=auth_headers,
        json={"engine": "pymupdf"},
    )
```
**Phase 072 reuse:** for the retry-only branch, patch `app.services.multimodal_service.describe_image` instead (since composer is skipped) and assert: (a) `extract_composable` is NOT called, (b) `ingest_document` is NOT scheduled, (c) `describe_image` IS called once per empty row, (d) response is still 202.

**Owner-only + 404-not-403 pattern** (`test_documents.py:654-668`) — Phase 072 inherits unchanged; the retry-empty flag does not loosen the RLS check.

---

### 9. `backend/tests/fixtures/extraction/friendly_real.pdf`

**No change needed.** Already committed by Phase 071.1; referenced as the binding fixture in Plan 04 UAT per CONTEXT.md. DOCX hand-crafted fixture is Plan 02's call — if needed, build it programmatically in the test (via `python-docx` + an inline image + a header image + a `wp:anchor` floating shape) rather than committing a binary.

---

## Shared Patterns

### Lazy-import heavy deps inside function body
**Source:** every module-level adapter (`multimodal_service.py:43, 162-163`, `images_pdf.py:50`, `images_docx.py:57, 117, 144, 231`).
**Apply to:** `vision_sweep_images_pdf` (lazy `import fitz`, `from PIL import Image`, `import hashlib`).
```python
import fitz  # noqa: PLC0415 — AGPL in-process per D-PRD-07
from PIL import Image as PILImage  # noqa: PLC0415
import hashlib  # noqa: PLC0415
```

### Silent-swallow outer try/except (D-069-04 invariant)
**Source:** `multimodal_service.py:298, 421-422` and `extraction_service.py:148-154`.
**Apply to:** every new Phase 072 helper that touches IO or vision LLM. Outer `try: ... except Exception as exc: log.warning(...)` — never re-raise, never block ingestion.

### Per-image broad-catch (skip-one-image-keep-going)
**Source:** `images_pdf.py:58-81` and `multimodal_service.py:174-188`.
**Apply to:** `vision_sweep_images_pdf` page loop, `_dedup_images_by_hash`, downscale step.
```python
for page in pages:
    try:
        ...
    except Exception as e:  # noqa: BLE001
        log.warning("vision_sweep: page %s failed: %s", page_num, e)
        continue
```

### `app_settings` read pattern (replaces module constants per D-072-08)
**Source:** `multimodal_service.py:282` (the parameter is already plumbed).
**Apply to:** every Phase 072 read of `multimodal_max_*` and `vision_sweep_*`.
```python
def extract_and_store_images(
    ...,
    app_settings: "UserEffectiveSettings",
    ...
) -> None:
    ...
    for img in image_dicts[:app_settings.multimodal_max_vision_calls]:
        if len(b64) > app_settings.multimodal_max_b64_bytes_kb * 1024:
            log.debug("Skipping oversized image: %d bytes b64", len(b64))
            continue
```
**Defaults already correct** (`user_settings.py:91-92`): `multimodal_max_vision_calls: int = 100`, `multimodal_max_b64_bytes_kb: int = 4096`. No model edits needed.

### Pydantic structured-LLM-output pattern (D-072-01 vision_sweep response parse)
**Source:** `embedding_service.py:111-137`.
**Apply to:** vision_sweep's per-page LLM call.
```python
from pydantic import BaseModel  # noqa: PLC0415

class FigureDetection(BaseModel):
    bbox: list[float]    # [x1, y1, x2, y2] page-relative 0–1
    kind: str            # 'figure' | 'chart' | 'table' | 'diagram'
    caption: str

class PageFigures(BaseModel):
    figures: list[FigureDetection]

# Inside vision_sweep_images_pdf per-page loop:
response = vision_client.chat.completions.create(
    model=vision_model,
    messages=[...],
    response_format={"type": "json_object"},  # mirrors embedding_service.py:130
    stream=False,
)
try:
    parsed = PageFigures.model_validate_json(response.choices[0].message.content)
except Exception as e:  # noqa: BLE001
    log.warning("vision_sweep: page %s response unparseable: %s", page_num, e)
    parsed = PageFigures(figures=[])
```

### Vision-LLM client construction + reuse
**Source:** `multimodal_service.py:321-325`, `multimodal_service.py:234-249`.
**Apply to:** vision_sweep — pass the **same** pre-constructed client through; do NOT create a new one per page.
```python
from openai import OpenAI  # noqa: PLC0415
openai_client = OpenAI(
    api_key=app_settings.llm_api_key,
    base_url=app_settings.llm_base_url or None,
)
```

### Content-hash dedup (D-072-06 extended) — shared helper
**No existing analog for the helper itself; pattern lives implicitly in `images_docx.py:163, 186-190`:**
```python
seen_media: set[str] = set()
...
if media_path in seen_media:
    continue  # dedup
seen_media.add(media_path)
```
**Phase 072 NEW helper shape** (planner picks home — `multimodal_service.py` recommended; `aspects/__init__.py` accepted):
```python
def _dedup_images_by_hash(images: list[ImageData]) -> list[ImageData]:
    """Drop duplicates by SHA1 of b64-decoded image bytes (D-072-06).

    Word templates embed the same logo in header + body + footer; vision_sweep
    can over-detect a figure across pages. Preserve first occurrence.
    """
    import hashlib  # noqa: PLC0415
    seen: set[str] = set()
    out: list[ImageData] = []
    for im in images:
        h = hashlib.sha1(im.b64_png.encode("ascii")).hexdigest()
        if h in seen:
            continue
        seen.add(h)
        out.append(im)
    return out
```
Note: hashing the b64 string directly is equivalent to hashing the underlying bytes (b64 is a deterministic encoding) and saves a decode step.

### `run_in_threadpool` wrapping for supabase-py in async handlers
**Source:** `documents.py:783-822` (every `supabase.table(...).execute()` is wrapped).
**Apply to:** Phase 072's new `/reextract?retry_empty_descriptions_only=true` branch.
```python
empties = await run_in_threadpool(
    lambda: supabase.table("document_images")
    .select("id, image_index, page")
    .eq("document_id", document_id)
    .eq("user_id", current_user["id"])
    .eq("description", "")
    .execute()
)
```

### `noqa: PLC0415` comment on every lazy import
**Source:** Every lazy import in `multimodal_service.py`, `images_pdf.py`, `images_docx.py`, `extraction_service.py`.
**Apply to:** all of Phase 072's new lazy imports. Ruff convention — non-negotiable in this codebase.

### `description` chunk-embedding loop (preserve D-01/D-02/D-03 from Phase 36)
**Source:** `multimodal_service.py:367-419`.
**Apply to:** unchanged by Phase 072; but the empty-description-row policy change (D-072-03) means the existing "skip empty descriptions" filter at line 386-388 STAYS (we just don't skip the `document_images` INSERT — we still skip the chunk embedding for empty strings, since there's nothing to embed).
```python
desc = (row.get("description") or "").strip()
if not desc:
    continue   # KEEP — empty descriptions still skip chunk embedding
```

---

## No Analog Found

| File / pattern | Reason | Planner action |
|----------------|--------|----------------|
| Per-page rasterize via `fitz.Page.get_pixmap(dpi=150)` + LLM crop loop | No prior code in repo rasterizes individual PDF pages for downstream vision processing | Pull from D-072-01 spec; use PIL.Image.crop on the rasterized page bytes |
| Caption-regex pre-filter (D-072-11) | New heuristic — not in repo | Compile `r"(Figure|Fig\.|Table|Chart)\s+\d+"` once at module scope; apply to `page.get_text()` per page |
| Cost-observability log line (D-072-11 MUST-HAVE invariant) | No existing "estimated cost" telemetry | One INFO-level `log.info("vision_sweep: doc=%s pages_called=%d est_cost=$%.2f", ...)` per extraction |

---

## Metadata

**Analog search scope:**
- `backend/app/services/multimodal_service.py`
- `backend/app/services/extractors/aspects/{images_pdf,images_docx,__init__}.py`
- `backend/app/services/extraction_service.py`
- `backend/app/api/documents.py` (reextract handler)
- `backend/app/models/user_settings.py`
- `backend/app/services/embedding_service.py` (Pydantic + response_format pattern)
- `backend/tests/unit/test_multimodal_extraction.py`
- `backend/tests/integration/test_documents.py`
- `supabase/migrations/{044,045,046,047}_*.sql`

**Files scanned:** 12
**Pattern extraction date:** 2026-05-16
**Project-specific invariants surfaced:**
- AGPL in-process `import fitz` is permitted (D-PRD-07 / D-071.3-11); no subprocess fence needed.
- `b64_png` NOT stored in `document_images` (D-04 Phase 36) — preserve.
- All supabase-py calls in async handlers wrapped in `run_in_threadpool` (D-v2.5-01).
- Migration discipline: paste in SQL editor + regen full-schema (CLAUDE.md).
- Pydantic for structured LLM outputs (CLAUDE.md). `response_format={"type": "json_object"}` is the established shape (`embedding_service.py:130`).
- Single uvicorn worker — no background worker process for retry (D-072-04, D-v2.5-02).
