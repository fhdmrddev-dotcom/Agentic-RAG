# Phase 35: Multi-Modal Ingestion — Research

**Researched:** 2026-04-17
**Domain:** PDF/DOCX table and image extraction; vision LLM integration; Supabase schema
**Confidence:** HIGH

---

## Summary

Phase 35 adds two new extraction passes to the existing `ingest_document` background function in `backend/app/api/documents.py`. After text chunking completes, the ingestion pipeline must (1) extract tables from PDF pages via `pdfplumber` and from DOCX files via `python-docx`, serialising them as JSON rows in a new `document_tables` table, and (2) extract embedded images above the 50×50 px threshold, encode them as base64, describe them via a vision-capable LLM call through the existing OpenAI-compatible client, and store descriptions in a new `document_images` table.

Both extractions must be wrapped in `try/except` so any failure silently continues ingestion. The existing Supabase Realtime pattern (which triggers on `documents` table UPDATE events) already delivers status updates to the frontend; the plan just needs to add intermediate `status` field updates with descriptive strings during extraction steps.

The primary complexity is the vision LLM call: the project uses OpenRouter (Module 2+), which supports multimodal inputs via the standard OpenAI SDK `image_url` content-part syntax with base64-encoded data URIs. There is no separate vision model configuration — the caller must use a vision-capable model from the user's configured model list or fall back to a hardcoded cheap OpenRouter multimodal model.

**Primary recommendation:** Extract tables and images in a new `extract_multimodal` function called from `ingest_document` after chunks are inserted. Use `pdfplumber` for PDF tables, `doc.tables` for DOCX tables, `pdfplumber` page images for PDF images, and `doc.part.rels` / inline shapes for DOCX images. Vision descriptions via the existing `get_llm_client` pattern. Two new migration files: `018_document_tables.sql` and `019_document_images.sql`.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MODAL-01 | Tables extracted from PDF/DOCX during ingestion and stored as structured JSON | pdfplumber.extract_tables() for PDF; doc.tables for DOCX; new document_tables table |
| MODAL-02 | Embedded images described via vision LLM and indexed for vector search | pdfplumber page rendering for PDF images; doc.inline_shapes for DOCX; base64 → vision API call; new document_images table |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pdfplumber | 0.11.9 | PDF table extraction + page-level image rendering | Explicitly named in success criteria; wraps pdfminer.six + pypdfium2; clean `.extract_tables()` API |
| python-docx | >=1.0.0 | DOCX table extraction + inline image bytes | Already in requirements.txt; `doc.tables`, `doc.inline_shapes` APIs |
| Pillow | 12.2.0 | Image size checking (width/height), format normalisation, PNG conversion | Already installed in venv |
| openai | 2.28.0 | Vision LLM call via `image_url` content-part (data URI base64) | Already in venv; used for all LLM calls |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| base64 (stdlib) | — | Encode image bytes for data URI | Always — no extra install |
| io (stdlib) | — | BytesIO for in-memory image handling | Always |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| pdfplumber (table extraction) | pypdf built-in | pypdf has no `extract_tables()`; text-only extraction already done via pypdf — pdfplumber is the right additional dependency |
| pdfplumber (image extraction) | pypdf `.images` property | pypdf 5.x exposes `.images` on page objects; however pdfplumber is being added anyway for tables, and its page rendering is cleaner for size filtering |
| Vision via user's active model | Hardcoded cheap model | User may have a non-vision model selected; safest: attempt with active model, catch error, skip image if model lacks vision capability |

**Installation (update requirements.txt):**
```bash
pdfplumber>=0.11.0
```
Add to `backend/requirements.txt` then:
```bash
cd backend && venv/Scripts/pip install pdfplumber>=0.11.0
```

**Version verification:** `pdfplumber 0.11.9` confirmed as current via `pip index versions pdfplumber` (2026-04-17). Pillow `12.2.0` already installed.

---

## Architecture Patterns

### Current Ingestion Flow (from `documents.py`)
```
upload_document() → background_tasks.add_task(ingest_document, ...)
  ingest_document():
    1. status = "processing"
    2. chunk_text(text)
    3. embed_chunks(chunks)
    4. INSERT document_chunks
    5. extract_metadata(text)
    6. UPDATE documents status="completed"
```

### Target Flow After Phase 35
```
ingest_document():
    1. status = "processing"
    2. chunk_text(text)
    3. embed_chunks(chunks)
    4. INSERT document_chunks
    5. extract_metadata(text)
    6. UPDATE documents status="extracting_tables"     ← new Realtime event
    7. extract_and_store_tables(raw, mime_type, document_id, supabase)  ← try/except
    8. UPDATE documents status="extracting_images"     ← new Realtime event
    9. extract_and_store_images(raw, mime_type, document_id, supabase, app_settings)  ← try/except
    10. UPDATE documents status="completed"
```

The `raw` bytes are already available in `upload_document()` but NOT passed to `ingest_document`. The current signature is `ingest_document(document_id, text, user_id, supabase)`. **The raw bytes must be passed as an additional parameter**, or re-fetched from Supabase Storage inside `ingest_document`. Re-fetching from storage is cleaner (avoids holding large bytes in memory across background task queue) but adds a storage API call. Passing raw is simpler but requires signature change.

**Recommendation:** Pass `raw: bytes` as an additional parameter to `ingest_document`. The function is only called in one place (`background_tasks.add_task`), so the signature change is safe.

### Pattern 1: pdfplumber Table Extraction
**What:** Open PDF bytes with pdfplumber, iterate pages, call `page.extract_tables()`, normalise headers/rows.
**When to use:** mime_type == "application/pdf"
```python
# Source: pdfplumber official docs (https://github.com/jsvine/pdfplumber)
import pdfplumber
import io

def extract_pdf_tables(raw: bytes) -> list[dict]:
    results = []
    with pdfplumber.open(io.BytesIO(raw)) as pdf:
        for page_num, page in enumerate(pdf.pages, start=1):
            tables = page.extract_tables()
            for table_idx, table in enumerate(tables):
                if not table or not table[0]:
                    continue
                headers = [str(h or "") for h in table[0]]
                rows = [[str(cell or "") for cell in row] for row in table[1:]]
                results.append({
                    "page": page_num,
                    "table_index": table_idx,
                    "headers": headers,
                    "rows": rows,
                })
    return results
```

### Pattern 2: python-docx Table Extraction
**What:** Iterate `doc.tables`, read cell text by row.
**When to use:** mime_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
```python
# Source: python-docx docs (https://python-docx.readthedocs.io/en/latest/user/tables.html)
from docx import Document as DocxDocument
import io

def extract_docx_tables(raw: bytes) -> list[dict]:
    doc = DocxDocument(io.BytesIO(raw))
    results = []
    for table_idx, table in enumerate(doc.tables):
        rows_data = []
        for row in table.rows:
            rows_data.append([cell.text.strip() for cell in row.cells])
        if not rows_data:
            continue
        headers = rows_data[0]
        rows = rows_data[1:]
        results.append({
            "page": None,   # DOCX tables have no page number in python-docx
            "table_index": table_idx,
            "headers": headers,
            "rows": rows,
        })
    return results
```
Note: DOCX page numbers are not reliably extractable via python-docx. The `page` column must be `NULL` for DOCX tables — the DB schema must allow `page INTEGER` to be nullable.

### Pattern 3: PDF Image Extraction via pdfplumber
**What:** Use `pdfplumber` page's `.images` property to get image metadata (x0, y0, x1, y1 bounding box, stream data). Filter by size. Convert to PIL Image for size verification and PNG encoding.
**When to use:** mime_type == "application/pdf"
```python
# Source: pdfplumber docs + PIL docs
import pdfplumber, io, base64
from PIL import Image as PILImage

def extract_pdf_images(raw: bytes, min_px: int = 50) -> list[dict]:
    results = []
    with pdfplumber.open(io.BytesIO(raw)) as pdf:
        for page_num, page in enumerate(pdf.pages, start=1):
            for img_idx, img_obj in enumerate(page.images):
                # img_obj has keys: 'width', 'height', 'stream' (raw bytes)
                w = img_obj.get("width", 0)
                h = img_obj.get("height", 0)
                if w < min_px or h < min_px:
                    continue
                img_bytes = img_obj.get("stream", b"")
                if not img_bytes:
                    continue
                # Re-encode as PNG for consistent base64
                try:
                    pil_img = PILImage.open(io.BytesIO(img_bytes))
                    buf = io.BytesIO()
                    pil_img.save(buf, format="PNG")
                    b64 = base64.b64encode(buf.getvalue()).decode()
                except Exception:
                    continue
                results.append({
                    "page": page_num,
                    "image_index": img_idx,
                    "b64_png": b64,
                    "width": w,
                    "height": h,
                })
    return results
```

**Important caveat:** `pdfplumber`'s `.images` gives raw stream bytes; some PDFs store images as JBIG2 or JPEG2000 which PIL cannot open. The outer `try/except` on the PIL step handles this gracefully.

### Pattern 4: DOCX Image Extraction via python-docx inline shapes
**What:** Iterate `doc.inline_shapes`, access the image part bytes, check dimensions.
**When to use:** mime_type == DOCX
```python
# Source: python-docx source (docx/oxml/ns.py, docx/parts/image.py)
from docx import Document as DocxDocument
from docx.enum.shape import WD_INLINE_SHAPE
import io, base64
from PIL import Image as PILImage

def extract_docx_images(raw: bytes, min_px: int = 50) -> list[dict]:
    doc = DocxDocument(io.BytesIO(raw))
    results = []
    for img_idx, shape in enumerate(doc.inline_shapes):
        try:
            # Width/height stored in EMU (English Metric Units); 914400 EMU = 1 inch = 96px
            w_px = shape.width // 9525   # 914400/96 = 9525 EMU per pixel
            h_px = shape.height // 9525
            if w_px < min_px or h_px < min_px:
                continue
            img_bytes = shape._inline.graphic.graphicData.pic.blipFill.blip.part.blob
            pil_img = PILImage.open(io.BytesIO(img_bytes))
            buf = io.BytesIO()
            pil_img.save(buf, format="PNG")
            b64 = base64.b64encode(buf.getvalue()).decode()
            results.append({
                "page": None,
                "image_index": img_idx,
                "b64_png": b64,
                "width": w_px,
                "height": h_px,
            })
        except Exception:
            continue
    return results
```

**Warning:** The `shape._inline.graphic.graphicData.pic.blipFill.blip.part.blob` chain accesses internal python-docx XML internals. This is the standard pattern used across the community but involves private APIs. The try/except wrapper makes it safe.

### Pattern 5: Vision LLM Description Call
**What:** Call the chat completions API with a multimodal message containing the base64 PNG.
**When to use:** After image extraction, once per image.
```python
# Source: OpenAI API docs (image_url content part with base64 data URI)
# Compatible with OpenRouter's vision-capable models
from app.services.openai_service import get_llm_client

def describe_image(b64_png: str, app_settings) -> str:
    client = get_llm_client(app_settings)
    resp = client.chat.completions.create(
        model=app_settings.llm_model,
        messages=[{
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": "Describe this image concisely in 1-2 sentences. Focus on the content, not style.",
                },
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:image/png;base64,{b64_png}",
                        "detail": "low",  # cheaper; sufficient for description
                    },
                },
            ],
        }],
        max_tokens=150,
        stream=False,
    )
    return resp.choices[0].message.content or ""
```

**Critical:** Not all OpenRouter models support vision. If the active model is text-only, the API call will return a 400/422 error. The image extraction function must catch this error and store an empty description (or skip the row). The description is not critical-path.

### Pattern 6: Realtime Status Update
The existing Supabase Realtime subscription in `useDocuments.ts` listens for `UPDATE` events on the `documents` table and merges `payload.new` into state. The frontend `DocumentStatusBadge.tsx` reads the `status` field. Two new intermediate status values work transparently without any frontend changes because the badge already handles unknown statuses (showing them as-is or as "Processing"). **No frontend changes are needed** — the Realtime events fire automatically when the backend sets `status = "extracting_tables"` and `status = "extracting_images"` via UPDATE.

### Anti-Patterns to Avoid
- **Blocking the ingest on image description failures:** Vision API call MUST be in try/except; failure stores empty description, ingestion continues.
- **Storing base64 in the database:** Only store the LLM description text in `document_images.description`. Discard the base64 bytes after the API call.
- **Calling vision API for every tiny image:** The 50x50px filter prevents wasted API calls on decorative icons, bullets, and borders.
- **Merging extract_multimodal into extract_text:** Keep extraction of tables/images separate from text extraction. The current `extract_text()` function in `documents.py` is called synchronously before the document row is created; multimodal extraction runs in the background after the row exists.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF table detection | Custom geometry/regex parser | pdfplumber.page.extract_tables() | pdfplumber handles merged cells, multi-line cells, and ruling-line detection |
| PDF image extraction | Raw PDF object parser | pdfplumber.page.images | pdfplumber handles xref resolution, colorspace conversion |
| DOCX table iteration | XML parsing of word/document.xml | doc.tables (python-docx) | Already a dependency; table API handles merged cells (tc span) |
| DOCX image size | EMU arithmetic from scratch | shape.width // 9525 | Standard EMU-to-pixel conversion |
| Image encoding | Custom binary format | PIL + base64 stdlib | PIL handles JPEG, PNG, BMP, TIFF normalisation to PNG |

---

## Common Pitfalls

### Pitfall 1: pdfplumber Not Installed
**What goes wrong:** `ModuleNotFoundError: No module named 'pdfplumber'` at runtime.
**Why it happens:** `pdfplumber` is not in `requirements.txt` and not installed in the venv.
**How to avoid:** Add `pdfplumber>=0.11.0` to `requirements.txt` AND run `pip install` in the plan. Verify with `python -c "import pdfplumber"` before proceeding.
**Warning signs:** ImportError on first ingestion of a PDF.

### Pitfall 2: raw bytes not available in ingest_document
**What goes wrong:** `ingest_document` currently receives `text: str` but not the original `raw: bytes`. Tables and images require raw bytes.
**Why it happens:** The function signature was designed for text-only ingestion. The `raw` variable exists in `upload_document()` scope but is not passed through.
**How to avoid:** Add `raw: bytes` parameter to `ingest_document`. Update the single `background_tasks.add_task(ingest_document, ...)` call to pass `raw`.

### Pitfall 3: Vision model not supporting images
**What goes wrong:** OpenRouter returns `400 Bad Request` or `422` when the active model does not support the `image_url` content part.
**Why it happens:** Models like `mistral/mistral-7b` are text-only. The user may have any model configured.
**How to avoid:** Wrap the vision API call in `try/except Exception`. On failure, store `description=""` and continue. Log the failure at DEBUG level.
**Warning signs:** All images stored with empty descriptions.

### Pitfall 4: DOCX page numbers are unavailable
**What goes wrong:** Attempting to determine which page a DOCX table/image appears on.
**Why it happens:** python-docx does not expose page boundaries — DOCX pagination is computed by word processors at render time.
**How to avoid:** Store `page = NULL` for all DOCX tables and images. The DB schema column `page` must be `INTEGER` (nullable), not `INTEGER NOT NULL`.

### Pitfall 5: pdfplumber image stream format incompatible with PIL
**What goes wrong:** `PIL.UnidentifiedImageError` for images with JBIG2, CCITT, or JPEG2000 compression.
**Why it happens:** pdfplumber returns the raw compressed stream bytes, not a decoded image. PIL cannot decode all PDF image compression types.
**How to avoid:** Wrap each `PILImage.open()` call in try/except; skip the image on failure (the outer per-image try/except handles this).

### Pitfall 6: Large PDFs with many images cause very long ingestion
**What goes wrong:** A 200-page PDF with 50 images each needing a vision API call takes minutes, blocking the background task.
**Why it happens:** Sequential synchronous API calls; no batching.
**How to avoid:** Cap vision API calls per document (e.g. max 20 images). Store the remainder with empty descriptions. Log the cap.

### Pitfall 7: ingest_document runs in a thread pool (not async)
**What goes wrong:** Using `asyncio.create_task()` inside `ingest_document` fails because the function runs in a synchronous thread (BackgroundTasks uses a thread pool executor).
**Why it happens:** FastAPI BackgroundTasks spawns sync functions in threads, not in the async event loop. The existing `ingest_document` is a plain `def`, not `async def`.
**How to avoid:** Keep all extraction code synchronous. Use the synchronous OpenAI client (not `AsyncOpenAI`). The existing `get_llm_client()` returns a synchronous `OpenAI` client — this is correct.

### Pitfall 8: Migration numbering gap
**What goes wrong:** Using migration number 018 when a higher-numbered migration already exists (e.g., from memory phases 33/34).
**Why it happens:** Migrations 025/026 were created for user_memory (Phase 33) but live outside `backend/supabase/migrations/`.
**How to avoid:** Check existing migration files and in-database applied migrations before picking numbers. The last migration in `backend/supabase/migrations/` is `017_audit_log.sql`. Migrations 018 and 019 are available. However, user_memory migrations (Phases 33-34) may have been applied directly to Supabase without file artifacts in this directory — the plan should use 020+ or check STATE.md.

**Verified:** Looking at `backend/supabase/migrations/`, the highest file is `017`. Phases 33-34 had no SQL migration files listed in their plan records in STATE.md. Use `018_document_tables.sql` and `019_document_images.sql`.

---

## Code Examples

### Migration 018: document_tables
```sql
-- Source: mirrors audit_log RLS pattern from 017_audit_log.sql
CREATE TABLE IF NOT EXISTS document_tables (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page          INTEGER,           -- NULL for DOCX (page boundaries unavailable)
  table_index   INTEGER NOT NULL,
  headers       JSONB NOT NULL DEFAULT '[]',
  rows          JSONB NOT NULL DEFAULT '[]',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE document_tables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own document tables"
  ON document_tables FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS document_tables_document_idx
  ON document_tables (document_id);
```

### Migration 019: document_images
```sql
CREATE TABLE IF NOT EXISTS document_images (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page          INTEGER,           -- NULL for DOCX
  image_index   INTEGER NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE document_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own document images"
  ON document_images FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS document_images_document_idx
  ON document_images (document_id);
```

### Updated ingest_document signature
```python
# Source: existing documents.py pattern
def ingest_document(
    document_id: str,
    text: str,
    user_id: str,
    supabase: Client,
    raw: bytes = b"",         # NEW: original file bytes for multimodal extraction
    mime_type: str = "",      # NEW: needed to branch PDF vs DOCX extraction
) -> None:
    ...
```

The single call site in `upload_document` becomes:
```python
background_tasks.add_task(
    ingest_document,
    document_id,
    text,
    current_user["id"],
    supabase,
    raw,        # pass raw bytes
    mime_type,  # pass MIME type
)
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| PDF text extraction only | PDF text + tables + images | Phase 35 | More structured knowledge; enables Phase 36 query_tables tool |
| DOCX paragraph text only | DOCX text + tables + images | Phase 35 | Tables in DOCX now searchable |
| No vision-grounded content | Image descriptions via vision LLM | Phase 35 | Images become searchable via text embeddings in Phase 36 |

---

## Open Questions

1. **Vision model selection strategy**
   - What we know: OpenRouter is the provider; user may have any model configured
   - What's unclear: Should there be a separate `vision_model` config field, or always use the active model?
   - Recommendation: Use the active model (`app_settings.llm_model`). If it fails, silently skip with empty description. Phase 36 can add a dedicated vision model setting if needed. Document this behaviour in the plan.

2. **user_memory migration numbers**
   - What we know: Phases 33-34 (user_memory table) are marked complete in STATE.md but no SQL files appear in `backend/supabase/migrations/`
   - What's unclear: Were those migrations applied to Supabase directly? Are 018/019 truly safe to use?
   - Recommendation: Plan executor should verify by checking Supabase dashboard or running `SELECT * FROM information_schema.tables WHERE table_name='user_memory'` before applying migrations. Use 018/019 unless evidence of conflict.

3. **Image description embedding (Phase 36 dependency)**
   - What we know: Phase 36 requires image descriptions to be embedded for vector search
   - What's unclear: Should Phase 35 also embed descriptions and store them in `document_chunks`, or just store raw text in `document_images.description`?
   - Recommendation: Phase 35 stores raw description text only. Phase 36 handles embedding and chunk insertion. This keeps phases cleanly separated.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| pdfplumber | PDF table + image extraction | NOT installed | — (0.11.9 available on PyPI) | None — must install |
| python-docx | DOCX table + image extraction | Installed | >=1.0.0 | — |
| Pillow | Image size checking + PNG re-encode | Installed | 12.2.0 | — |
| openai SDK | Vision LLM call | Installed | 2.28.0 | — |
| pypdfium2 | pdfplumber dependency | NOT installed | — (auto-installed with pdfplumber) | Installed transitively |

**Missing dependencies with no fallback:**
- `pdfplumber` — must be added to `requirements.txt` and installed in venv as Wave 0 step

**Missing dependencies with fallback:**
- None (pypdfium2 installs automatically as pdfplumber dependency)

---

## Validation Architecture

> `workflow.nyquist_validation` key is absent from `.planning/config.json` — treat as enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest 8.x |
| Config file | `backend/pytest.ini` |
| Quick run command | `cd backend && venv/Scripts/pytest tests/unit/test_multimodal_extraction.py -x` |
| Full suite command | `cd backend && venv/Scripts/pytest tests/unit/ -x` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MODAL-01 | PDF tables extracted to document_tables | unit | `pytest tests/unit/test_multimodal_extraction.py::test_pdf_tables_inserted -x` | Wave 0 |
| MODAL-01 | DOCX tables extracted to document_tables | unit | `pytest tests/unit/test_multimodal_extraction.py::test_docx_tables_inserted -x` | Wave 0 |
| MODAL-01 | Table extraction failure does not fail ingestion | unit | `pytest tests/unit/test_multimodal_extraction.py::test_table_extraction_failure_continues -x` | Wave 0 |
| MODAL-02 | PDF images above 50x50 described and stored | unit | `pytest tests/unit/test_multimodal_extraction.py::test_pdf_images_stored -x` | Wave 0 |
| MODAL-02 | Images below 50x50 skipped | unit | `pytest tests/unit/test_multimodal_extraction.py::test_small_images_skipped -x` | Wave 0 |
| MODAL-02 | Vision API failure does not fail ingestion | unit | `pytest tests/unit/test_multimodal_extraction.py::test_image_description_failure_continues -x` | Wave 0 |
| MODAL-01/02 | Realtime status updates fire during extraction steps | manual | — | manual only |

### Sampling Rate
- **Per task commit:** `cd backend && venv/Scripts/pytest tests/unit/test_multimodal_extraction.py -x`
- **Per wave merge:** `cd backend && venv/Scripts/pytest tests/unit/ -x`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/unit/test_multimodal_extraction.py` — covers MODAL-01, MODAL-02
- [ ] pdfplumber install: `cd backend && venv/Scripts/pip install pdfplumber>=0.11.0` — required before tests can even import

---

## Sources

### Primary (HIGH confidence)
- `backend/app/api/documents.py` — current ingestion pipeline code (read directly)
- `backend/app/services/openai_service.py` — LLM client pattern, existing tool constants (read directly)
- `backend/app/services/suggestion_service.py` — pattern for non-agent synchronous LLM calls (read directly)
- `backend/requirements.txt` — confirmed pdfplumber absent, Pillow present (read directly)
- `backend/supabase/migrations/` — migration numbering, RLS pattern (read directly)
- `backend/tests/conftest.py` — mock builder pattern for new tests (read directly)

### Secondary (MEDIUM confidence)
- pdfplumber PyPI — version 0.11.9 confirmed current, dry-run install showed dependencies (verified via pip)
- python-docx docs — `doc.tables`, `doc.inline_shapes` APIs exist (verified via runtime introspection)
- Pillow 12.2.0 — confirmed installed, `PILImage.open` / `.save` API stable

### Tertiary (LOW confidence)
- pdfplumber `.images` page property internal structure (keys: width, height, stream) — documented in pdfplumber GitHub README and community examples; not verified against 0.11.9 changelog in this session
- python-docx `shape._inline.graphic...part.blob` chain — widely used community pattern; accesses internal XML path not in official docs

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — pdfplumber version confirmed via pip, all other deps verified in venv
- Architecture: HIGH — ingest flow read directly from source, single call site for signature change
- Pitfalls: HIGH for known issues (raw bytes gap, no async, DOCX page nums); MEDIUM for vision model compatibility (depends on user config)
- Migration schema: HIGH — mirrors existing RLS patterns exactly

**Research date:** 2026-04-17
**Valid until:** 2026-05-17 (stable domain; pdfplumber/python-docx APIs rarely change)
