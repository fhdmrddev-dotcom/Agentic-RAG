---
id: SEED-006
status: dormant
planted: 2026-05-02
planted_during: v2.5 (Phase 061 in progress — Run-Backed Streaming Backend)
trigger_when: planning any milestone scoped to "RAG quality" / "ingestion" / "multimodal" / "knowledge base" / v2.6 / v3.0 — or any milestone that touches `backend/app/services/multimodal_service.py`, the document ingestion pipeline, or RAG retrieval quality
scope: Medium
---

# SEED-006: Multimodal Extraction Quality (Phase 35/36 Follow-up)

## Why This Matters

The current multimodal extraction pipeline (Phases 35–36, shipped v2.3) extracts a tiny fraction of the tables and images present in real-world documents. On a 4 MB academic thesis PDF (`Fahed Mrad Chapters 1 to 4.pdf`, doc id `551f03f9-b27c-4458-b4be-2cb193e7ab9b`) with **50+ visible tables and images**, production stored only **6 rows total**: 1 real table + 3 false-positive `1×1` tables + 2 image descriptions.

This blocks the project's positioning as a top-tier RAG application. Competing tools (NotebookLM, ChatPDF, Claude/GPT file Q&A) extract substantially more of what's visible to the human reader, and answer questions grounded in figures/tables this pipeline never saw.

This is **not a regression** — extraction has been this lossy since Phase 35 shipped. Memory of "tens of tables before" was either a different document or `document_chunks` count (image descriptions are inserted there too).

## Diagnostic Findings (2026-05-02)

A throwaway diagnostic script (`backend/scripts/probe_multimodal.py`) compared three extractors on the same doc:

```
  pdfplumber    tables=4  real_tables=1  images=61
  PyMuPDF       tables=3  real_tables=3  images=69  vector_figures=2
  Docling       (not run — see "Docling Evaluation" below)
```

Key insight: **the bottleneck is NOT detection — it's the post-detection pipeline.** pdfplumber finds 61 candidate images; production stores 2. The 59-image gap comes from cascading silent drops in `multimodal_service.extract_and_store_images`:

1. `stream_obj.get_data()` fails for many encodings (JPEG2000, JBIG2, CMYK colorspaces) — `try/except continue` → silent drop.
2. `PILImage.open()` fails on raw streams that need PDF filters applied first → silent drop.
3. `_MAX_VISION_CALLS = 20` cap (only first 20 reach vision).
4. `_MAX_B64_BYTES = 512 KB` cap (large scanned images dropped, no downscale).
5. Empty descriptions from vision → row dropped, not stored as empty.

PyMuPDF's `doc.extract_image(xref)` returns properly-decoded bytes with correct colorspace conversion, eliminating most of #1/#2.

For **tables**, pdfplumber emitted 3 false positives (single-cell artifacts mistaken for tables) and missed most borderless tables; PyMuPDF's `find_tables()` produced 3 valid tables and 0 noise. Layout-aware detection beats ruling-line detection.

**Vector figures: only 2** — this doc is mostly raster (scanned thesis pages). Other docs (architecture diagrams, BPM models, flowcharts) will have many more vector figures.

## Recommended Approach

### Primary: switch image + table extraction to PyMuPDF

The single biggest quality lift. Roughly:

- Replace `extract_pdf_images` (pdfplumber `page.images`) with PyMuPDF `page.get_images(full=True)` + `doc.extract_image(xref)`. Properly-decoded bytes survive to vision.
- Replace `extract_pdf_tables` (pdfplumber default) with PyMuPDF `page.find_tables()`. Eliminates the `1×1` noise; catches borderless tables.
- Add vector-figure clustering via `page.get_drawings()` + bbox merging — render clusters via `page.get_pixmap(clip=bbox)` for vision.
- Remove `_MAX_VISION_CALLS = 20` hard cap; make it a tunable in `app_settings` (default 100).
- Raise `_MAX_B64_BYTES` to 4 MB; **downscale before vision** (PIL `thumbnail()` to 1024px max edge) instead of skipping.
- Store rows even when vision returns empty — `description=''` row stored, queue retry asynchronously. Stops permanent data loss on transient vision failures.

### Schema additions (additive only)

```sql
ALTER TABLE document_images ADD COLUMN bbox jsonb;
ALTER TABLE document_images ADD COLUMN extractor text DEFAULT 'pdfplumber';
ALTER TABLE document_tables ADD COLUMN extractor text DEFAULT 'pdfplumber';
ALTER TABLE document_tables ADD COLUMN bbox jsonb;
```

No row migration needed. `query_tables` tool (Phase 36) keeps working unchanged.

### Backwards safety

- Feature flag in `app_settings`: `multimodal_extraction_v2` (default OFF until validated).
- Keep all v1 functions (`extract_pdf_images`, `extract_docx_images`, `extract_pdf_tables`, `extract_docx_tables`) untouched. Add v2 functions and route via the flag.
- All existing tests in `backend/tests/unit/test_multimodal_extraction.py` keep passing because the v1 path is unchanged.
- New tests for v2 path before flipping the flag.

### DOCX completeness

Replace `doc.inline_shapes`-only walk with a full XML walk over `doc.part.related_parts` plus floating-shape detection in `wp:anchor` elements. Catches headers/footers/floating images that python-docx silently ignores.

## Docling Evaluation (deferred to this phase)

Docling (IBM, MIT-licensed, Python-native) is layout-aware and would likely push table-extraction quality higher than PyMuPDF — particularly for complex multi-column layouts and merged-cell tables. **Not included in primary scope** because of two practical constraints discovered 2026-05-02:

1. **httpx version conflict.** Docling 2.92 forces `httpx>=0.28`, which conflicts with the entire supabase 2.10 stack (`postgrest 0.18`, `storage3 0.9`, `supabase 2.10.0`, `supafunc 0.7` all pin `httpx<0.28`). Resolving requires upgrading the supabase stack to ≥2.29 (which supports `httpx<0.29`) — a 2.10 → 2.29 jump including package renames (`gotrue`→`supabase-auth`, `supafunc`→`supabase-functions`). That's a regression-risk-bearing change that should be its own milestone (or at minimum its own phase) — **not folded into a multimodal phase**.

2. **First-run model download.** Docling downloads ~600 MB of layout/table models on first use. Manageable but real ops/CI consideration.

**Evaluation pathway when this seed is picked up:**

- Decide whether to upgrade supabase stack first (separate phase) or install Docling in an isolated venv for benchmarking only.
- Run `python backend/scripts/probe_multimodal.py <doc_id> --with-docling` against 3-5 representative docs and compare `real_tables` / `images` numbers vs the PyMuPDF baseline.
- If Docling adds ≥30% more real_tables vs PyMuPDF on the benchmark set, fold it in as a fallback (PyMuPDF first; Docling when PyMuPDF returns 0 tables on a page that has high drawing density).
- If the lift is <15%, skip Docling — PyMuPDF is sufficient and avoids the dep weight.

## When to Surface

**Trigger:** planning a milestone scoped to RAG quality, ingestion, multimodal, or knowledge base improvements — or any milestone that touches the document ingestion pipeline.

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches any of these conditions:
- Milestone name or description contains "RAG", "ingestion", "multimodal", "extraction", "knowledge base", or "document quality"
- Milestone version is v2.6, v2.7, or v3.0 (whichever is the next non-streaming milestone)
- Milestone touches `backend/app/services/multimodal_service.py`, `backend/app/api/documents.py` ingestion path, or `document_tables`/`document_images` schema
- A user-facing complaint surfaces about "missing tables/images in answers" or "RAG doesn't find what's in the figure"

## Scope Estimate

**Medium** — 4-5 plans, ~1 week of focused work:

1. **Plan 1**: PyMuPDF-based `extract_pdf_images_v2` + decode-success metric + unit tests + backward compat helpers.
2. **Plan 2**: PyMuPDF-based `extract_pdf_tables_v2` + 1×1 noise filter + unit tests.
3. **Plan 3**: Vector-figure clustering (`page.get_drawings()` + bbox merging) + per-cluster rasterization for vision.
4. **Plan 4**: Cap removal + downscale-before-vision + store-row-on-empty-description + `multimodal_extraction_v2` feature flag in `app_settings`.
5. **Plan 5**: Schema migration (`extractor`, `bbox` columns) + DOCX floating-image walk + integration tests + benchmark verification on 3-5 representative docs.

**Out of scope** (unless lifted into the milestone explicitly):
- Docling integration (see "Docling Evaluation" — depends on supabase upgrade decision).
- OCR for scanned/image-only PDFs (separate concern; needs Tesseract or cloud OCR).
- Page-level vision pass for orphan figures (good Phase 2 if v2 still misses things).
- Layout-aware text segmentation (the markdown extractor in `metadata_service` is unrelated and out of scope).

## Falsifiable Success Criteria (when this becomes a phase)

These should be formalized in a `/gsd:spec-phase` invocation, but draft-quality bar:

1. On the benchmark doc (`551f03f9-...`), `real_tables` ≥ 8 and `images` ≥ 30 stored in production tables (vs current 1 and 2). At least 90% of `images` rows have non-empty `description`.
2. Zero rows in `document_tables` with `ncols < 2 OR nrows < 1` (no more 1×1 noise).
3. The benchmark probe `python scripts/probe_multimodal.py <doc_id>` shows v2 path produces ≥80% of what PyMuPDF detects (closes the post-detection drop gap).
4. Existing `test_multimodal_extraction.py` and `test_multimodal_query.py` continue to pass when feature flag is OFF.
5. New v2-path tests verify CMYK/JPEG2000/JBIG2 image decoding succeeds via PyMuPDF (the encodings that pdfplumber silently dropped).

## Pitfalls and Constraints

- **Don't break the `query_tables` tool** (Phase 36). It reads `document_tables.headers/rows`. The schema add is additive — don't change column names or types.
- **Don't write `b64_png` to `document_images`** (D-04 from Phase 36). Decision was: store description only, never raw image bytes. Re-extracting on demand uses PyMuPDF on the original PDF in storage.
- **Vision API cost.** Removing the 20-cap means a 100-image PDF becomes 100 vision calls during ingest. Fine for local/single-user dev but needs a per-user-per-day budget mechanism in production. Add to scope or defer to a separate billing-aware phase.
- **PyMuPDF licensing.** AGPL-3.0 by default; commercial license available. Confirm posture before relying on it for a commercial deployment. (Free for personal/internal use.)
- **`extractor` column** lets you run shadow extractions: store both v1 and v2 outputs side-by-side in the same table, compare, then delete v1 rows. Useful for the validation phase.
- **Settings page coupling.** New `multimodal_extraction_v2` flag will need a Settings UI toggle. Already known design constraint: Settings page redesign deferred to Skill Studio milestone (per project memory). Land this flag as a backend-only setting first; UI can come with the redesign.

## Probe Script

The diagnostic that produced the findings above is at `backend/scripts/probe_multimodal.py`. It's standalone, read-only, and can be re-run anytime against any document_id (Supabase) or local file (`--file`). When picking up this seed, re-run on multiple representative docs first to validate that the gap pattern holds beyond the original benchmark.

## Cross-References

- Source phases: `.planning/milestones/v2.3-ROADMAP.md` Phase 35–36
- Probe script: `backend/scripts/probe_multimodal.py` (May 2026)
- Current extraction: `backend/app/services/multimodal_service.py`
- Schema baseline: `supabase/migrations/030_missing_tables.sql` (`document_tables`, `document_images`)
- Decision context: D-04 (don't store b64_png), `_MAX_VISION_CALLS = 20`, `_MAX_B64_BYTES = 512KB` (all in Phase 35 history)
