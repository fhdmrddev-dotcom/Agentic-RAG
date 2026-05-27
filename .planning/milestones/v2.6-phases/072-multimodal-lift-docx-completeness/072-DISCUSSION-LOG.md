# Phase 072: Multimodal Lift + DOCX Completeness - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-15
**Phase:** 072-multimodal-lift-docx-completeness
**Areas discussed:** Image extraction engine, Downscale-before-vision, Empty-description row policy + retry, DOCX related_parts walk

---

## Pre-discussion: live operational bug surfaced

Mid-discuss, the user reported uploading a PDF and seeing Docling still running despite the 2026-05-15 revert to `EXTRACTOR_PRIMARY=legacy`. Plus per-page `std::bad_alloc` errors and a 120s+ "uploading…" hang before 201 returned.

Root cause diagnosed:
1. **`.env` → `os.environ` was broken** — pydantic-settings reads `backend/.env` into the `Settings` instance but does NOT mutate `os.environ`. Every `os.getenv()` consumer (including `extraction_service._read_primary`) was returning hardcoded defaults regardless of `.env` content.
2. **`/upload` runs `extractor.extract()` synchronously in the async handler** (D-v2.5-01 violation; same bug class 071.1 closed for `/reextract`).
3. **`/upload` INSERTs the documents row AFTER extract completes** — frontend can't show status because the row doesn't exist yet.

Actions taken before resuming the 072 discuss:
- **Hot-fix #1 committed `33860a7`** — `load_dotenv()` at top of `main.py` so `os.environ` gets populated from `backend/.env`. User verified: 201 in <5s, 400+ chunks restored, no bad_alloc.
- **Phase 071.2 inserted into ROADMAP** (commit `400481d`) — 4 plans covering /upload + /reingest threadpool sweep + instant-201 BackgroundTask UX + Docling-quality diagnostics (95%-chunks-drop + 4-vs-1 table mismatch). Phase 072 stays narrowly multimodal.

The four areas below were discussed AFTER the hot-fix + roadmap update.

---

## Area 1: Image extraction engine

| Option | Description | Selected |
|--------|-------------|----------|
| Swap LegacyExtractor images to PyMuPDF subprocess | Use the AGPL-fenced PyMuPDF child process for image decoding inside LegacyExtractor._extract_images. Tables stay on pdfplumber. Direct path to SC#1. (Recommended) | ✓ |
| Keep pdfplumber, just raise the cap | Don't touch the extractor; let _MAX_VISION_CALLS rise from 20→100. Risk: pdfplumber drops images BEFORE the cap. SC#1 likely fails. | |
| Use Docling when available, fall back to PyMuPDF | Within LegacyExtractor, route to Docling if healthy, else PyMuPDF. High coupling + Docling-quality risk. | |
| Defer entirely — SC#1 becomes "raise the cap only" | Move the image-engine swap to a Phase 072.1 / SEED-006-followup. SC#1 hollow. | |

**User's choice:** Swap LegacyExtractor images to PyMuPDF subprocess (Recommended).

**Notes:** Pre-discussion architecture review surfaced the Layer 2 wiring bug (`extract_and_store_images` ignores `extracted_doc.images` and re-runs pdfplumber). The wiring fix gets folded into Phase 071.2 Plan 04 (originally tables-only, extended to also cover images). 072 inherits a clean wire and only owns the Layer 1 engine swap. Locked as **D-072-01**.

---

## Area 2: Downscale-before-vision

| Option | Description | Selected |
|--------|-------------|----------|
| Downscale aggressively: PIL.thumbnail(1024px) on every image | All images resize to 1024px max edge before vision. Matches OpenAI's `detail: low` internal projection. `_MAX_B64_BYTES` becomes a safety net. Simpler. (Recommended) | ✓ |
| Two-tier: pass-through under 4MB, downscale only oversized | Images <4MB go as-is; oversized ones downscale. More branches, no real benefit. | |
| Skip entirely if >4MB | Status quo, just bigger ceiling. SEED-006 rejects this. | |

**User's choice:** Downscale aggressively (Recommended).

**Notes:** 1024px is hardcoded as `MULTIMODAL_THUMBNAIL_MAX_EDGE` module constant — NOT a third `app_setting` (PRD scope is the two existing keys only). Locked as **D-072-02**.

---

## Area 3: Empty-description row policy + retry

### Q1: Persist empty-description rows?

(Locked implicitly from SC#2 wording — no AskUserQuestion presented.) **D-072-03**: persist `description=''` rows immediately. Drop the early-continue at `multimodal_service.py:300-302`.

### Q2: Retry shape

| Option | Description | Selected |
|--------|-------------|----------|
| Persist + lazy retry on document re-access | Store `description=''` immediately. Helper called from `/reextract` etc. checks for empties + queues re-vision. No background workers. (Recommended) | ✓ |
| Persist + manual /reextract retries all empty rows | Store `description=''`. No auto-retry. User explicitly hits /reextract for a fresh pass. | |
| Persist + dedicated background retry worker | Celery-like worker polls WHERE description='' every N minutes. New infra surface, conflicts with no-background-worker philosophy. | |

**User's choice:** Persist + lazy retry on document re-access (Recommended).

**Notes:** SEED-006 D-04 ("Don't write `b64_png` to `document_images`") means the lazy-retry helper needs to re-extract images from the source PDF in Supabase Storage. Whether `/reextract` gets an incremental flag (`?retry_empty_descriptions_only=true`) vs full reset/rebuild is a planner decision (Shape A vs Shape B in D-072-04). Locked as **D-072-04**.

---

## Area 4: DOCX related_parts walk

### Q1: Page-number inference

| Option | Description | Selected |
|--------|-------------|----------|
| Accept page=null for all DOCX images | python-docx has no rendered-layout concept; inferring from section/paragraph is heuristic + brittle. Matches existing DOCX table behavior. (Recommended) | ✓ |
| Best-effort page inference via section/paragraph context | Walk doc.sections, count paragraphs, estimate page breaks. ~30 LOC heuristic. | |

**User's choice:** Accept page=null (Recommended). Locked as **D-072-05**.

### Q2: De-duplication when image appears in BOTH header AND inline

| Option | Description | Selected |
|--------|-------------|----------|
| De-duplicate by content hash | Compute SHA1/MD5 of image bytes; collapse duplicates. Avoids 2× vision API cost per branded doc. (Recommended) | ✓ |
| Store all occurrences separately | Each related_parts entry becomes its own row. Branded templates double their image vision cost. | |
| Skip header/footer images entirely | Inline + floating only. Misses occasional legitimate header diagrams. Doesn't match SC#3 wording. | |

**User's choice:** De-duplicate by content hash (Recommended). Locked as **D-072-06**.

### Q3: How to read floating shapes (wp:anchor)

| Option | Description | Selected |
|--------|-------------|----------|
| Direct XML walk via lxml on doc.element | Use python-docx's underlying lxml tree to iterate over `<wp:anchor>` elements. ~20 LOC, no new deps. Standard pattern. (Recommended) | ✓ |
| Use python-docx-ng or docx2python | Alternate library with native floating-shape support. New dep, changes test surface. | |

**User's choice:** Direct XML walk via lxml (Recommended). Locked as **D-072-07**.

---

## Claude's Discretion

- Exact lxml XPath / namespace handling for floating-shape walk
- Whether to extract a thin `_extract_pdf_images_pymupdf` helper vs delegate to `PyMuPDFExtractor().extract().images`
- Description prefix wording for de-duplicated images
- `/reextract?retry_empty_descriptions_only=true` as query param vs JSON body
- Whether to commit a new 4MB binding fixture or reuse `friendly_real.pdf` from 071.1 (recommend reuse)
- Whether to also de-duplicate PDF images by content hash (opportunistic)
- Order of downscale vs empty-description check in `extract_and_store_images`

## Deferred Ideas

- PDF table extraction swap to PyMuPDF/Docling — out of 072 scope; Phase 071 SC#3 owner
- Background retry worker — defer to Phase 077 multi-worker
- Third app_setting for downscale dimension — v3.1 admin shell
- Vision API spend cap — v3.4 spend caps
- `do_ocr` user-tunable flag — Skill Studio milestone
- Subprocess pool / reuse for PyMuPDF — Phase 077 multi-worker
- PDF image de-duplication (D-072-06 is DOCX-only) — opportunistic Claude discretion
- Vector-figure clustering — out of 072 scope
- OCR for scanned PDFs — out of 072 scope; needs RapidOCR re-enablement strategy
- Frontend admin UI for `multimodal_max_*` — v3.1
- Per-document "X figures stored, Y attempted" badge — v3.1 admin shell polish

---

## 2026-05-16 Update Discussion

**Trigger:** Phase 071.3 + 071.4 shipped between 2026-05-15 and 2026-05-16. Architectural assumptions in the original CONTEXT.md (D-072-01 references retired subprocess fence + deleted `LegacyExtractor._extract_images`; D-072-09 references long-shipped 071.2 Plan 04) became stale.

**Areas re-discussed:**

### G1 — Phase 072 scope direction for image recall (STRATEGIC)

**Realization:** Current PDF image baseline is 20 of ~59 = 34% recall via `pymupdf_full_images_pdf`. Phase 072 as originally scoped (raise `_MAX_VISION_CALLS` 20 → 100 + DOCX walk extension) CANNOT meet SC#1 (≥80%) because extraction finds 20 images on the thesis — vision-LLM cap is not the bottleneck.

**Options weighed:**

| Path | What it ships | Recall estimate | Cost | New deps |
|---|---|---|---|---|
| A — Narrow + rewrite SC#1 | Original scope, target rewritten to ~35% | ~25-35 | $0 | none |
| B — Widen with caption-based figure detection | Original + per-page rasterize + "Figure N" regex + snap bbox | ~35-45 | $0 ingest | PyMuPDF rasterize (already in deps) |
| **C — Widen with vision-LLM page sweep as opt-in engine** | Original + new `vision_sweep` engine in per-aspect dispatcher; opt-in via `app_settings.extraction_image_engine_pdf` | **~45-50** | ~$3-5 per thesis (capped) | none |
| D — Pilot Marker / GPU-backed figure detector | Original + GPU-required figure detector | ~50-55 | GPU infra | Marker / TATR-figures |

**Decision: C (locked).**

**Rationale:** Preserves engine optionality per `feedback_preserve_engine_optionality`. Cost is bounded (operator opts in). No GPU. No new heavy deps. Hits the goal IF user enables. SEED-021 stays planted for v3.x (Path D when GPU becomes available).

### G2 — D-072-01 architecture revision

Old D-072-01 ("swap LegacyExtractor._extract_images to AGPL-fenced PyMuPDF subprocess") was wholesale revised to reflect post-071.4 architecture: PyMuPDF is in-process, the per-aspect dispatcher is the path. D-072-01 now describes the new `vision_sweep` engine (rasterize + LLM page sweep) and how it slots into `IMAGE_ENGINES_PDF` alongside `pymupdf_full`.

### G2 sub-decision — Migration for vision_sweep engine slot

Options weighed:
- (a) Ship migration 048 in Phase 072 widening the CHECK constraint — operator can enable from running app.
- (b) Defer migration; register in Python only — operator cannot enable from running app.
- (c) Boolean `enable_experimental_vision_sweep` flag bypassing the engine slot system.

**Decision: (a) — Ship migration 048 in Phase 072 (locked as D-072-10).** Cleanest; the engine is shipped + enableable in one phase.

### G3 — D-072-09 status (moot)

Original D-072-09 ("fold Layer 2 wiring fix into Phase 071.2 Plan 04") references work that shipped long ago. **Decision: delete D-072-09**, replace with a one-line note in canonical refs that 071.2 Plan 04 closed the wiring concern. Avoids archaeological noise in CONTEXT.md.

### G4 — PDF image dedup scope

Options weighed:
- (a) Extend D-072-06 to apply content-hash dedup to BOTH PDF and DOCX paths.
- (b) Keep DOCX-only; defer PDF dedup.

**Decision: (a) — Extend to both paths (D-072-06 extended).** Especially important once `vision_sweep` can over-detect figures across page-spanning rasterizations. Shared `_dedup_images_by_hash` helper.

### New decisions locked

- **D-072-10:** Ship migration 048 widening `app_settings.extraction_image_engine_pdf` CHECK to include `'vision_sweep'`. Default unchanged (`'pymupdf_full'`).
- **D-072-11:** Vision_sweep cost guardrails — required page cap + caption pre-filter heuristic; planner picks final shape.

### Plan budget revision

Originally 3 plans; new vision_sweep engine + migration 048 + dual-mode UAT brings to **4 plans**. ROADMAP entry should be updated to reflect.

### SC#1 target dual-keyed

Default-engine target: **≥35%** (DOCX walk + downscale clarity baseline).
Opt-in-engine (`vision_sweep`) target: **≥80%** of visible figures.
Binding gate keys off the operator's chosen engine.

