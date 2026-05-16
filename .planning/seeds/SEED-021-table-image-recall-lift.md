---
seed_id: SEED-021
title: Table + Image Recall Lift — GPU-fenced or alternative engines
status: partially-resolved
planted: 2026-05-16
image_axis_resolved: 2026-05-16 (via .planning/spikes/001-005 — storage cap, not extraction)
table_axis_status: open (trigger #1 — user-observed missed tables — still active)
phase_origin: 071.3-docling-demotion-table-engine-full-rip
related_seeds: [SEED-006, SEED-018, SEED-019, SEED-020, SEED-022]
related_spikes: [001-pymupdf-full-baseline, 002-get-drawings-vector-cluster, 003-pdfplumber-figures, 004-marker-cpu-smoke, 005-retrieval-value-smoke]
re_open_trigger: |
  Either fires (whichever first):
  1. Next academic-PDF upload misses tables/figures observed by user
     (concrete query: user uploads a new academic PDF + reports specific
     tables/figures that didn't surface in retrieval or in the table/image
     viewer panes).
  2. **Spike trigger (added 2026-05-16):** before any future phase commits
     to lifting image recall above the `pymupdf_full` baseline, run a
     throwaway spike via `/gsd:spike` to measure (a) which OSS figure
     extractor performs best at $0 cost on the thesis (`pdfplumber.figures`,
     Marker, PDFFigures2, `page.get_drawings()` + bbox merging), and (b)
     whether the marginal lift from 34% → 80% image recall actually moves
     retrieval quality on a representative query set against the existing
     hybrid search + reranker + 15+ tool pipeline. If (a) finds a good
     non-vision option AND (b) shows real retrieval gain, fold the winner
     into a v3.x phase. If either fails, leave the baseline at 34% and
     close this seed. **Do NOT re-open with the `vision_sweep` shape that
     was scoped out of Phase 072 (2026-05-16) — its $3-5-per-extraction
     cost was rejected as not justified without the (b) measurement.**
suggested_phase: post-v2.6 spike via `/gsd:spike` first; ship phase
  contingent on spike-positive evidence (likely v3.x — depends on whether
  the OSS landscape closes enough of the gap without vision-LLM-per-page
  costs; see SEED-018 for GPU candidates if a GPU path is needed)
---

## 2026-05-16 update — image-axis RESOLVED via spike series

The spike-first re-open trigger fired and resolved the image-axis question in a single afternoon. See `.planning/spikes/MANIFEST.md` for the full series, but the headline:

- **The "20 figures = 34% recall" baseline was a STORAGE-LAYER ARTIFACT**, not an extraction problem. Spike 001 ran `pymupdf_full` on the operator's thesis and found 67 unique figures. The DB confirmed: `app_settings.multimodal_max_vision_calls = 100` is already correct (per migration 044), but `backend/app/services/multimodal_service.py:_MAX_VISION_CALLS = 20` hardcodes the consumer side, dropping 47 of 67 figures before any vision-LLM call.
- **Vector clustering (`page.get_drawings()`) is invalidated on this thesis** — only 68 vector primitives across 200 pages. Would still help on architecture-diagram-heavy docs but not academic prose+raster theses.
- **pdfplumber.images (61 figures) is comparable to pymupdf_full (67)** — both walk the same xref graph. No drop-in advantage.
- **Marker SKIPPED** — the conditional gate ("union <40") never triggered. Avoided the GPL/CPU-slow install entirely.
- **Phase 072 Plan 01** (replace the hardcode with the `app_settings` read) is the SOLE load-bearing change for the recall lift. The deferred `vision_sweep` engine was solving a non-existent problem.
- **Retrieval-value (b)-leg** intentionally skipped — operator closed on (a) alone given how mechanically conclusive the finding was. The DB physically demonstrates the diagnosis. The (b) observation can be made post-Plan-01 in real use without a blocking gate.

The image-axis re-open trigger is **RESOLVED**. No engine swap needed; no GPU budget needed; no vision-LLM cost needed. Phase 072 Plan 01 alone is the fix.

The table-axis trigger (#1 in the original frontmatter — "next academic-PDF upload misses tables observed by user") **stays open** as a separate concern. This spike series did NOT measure table recall.

## Why this seed exists

Phase 071.3 shipped winner=**camelot** as the default PDF table engine.
Post-rip UAT on the user's thesis (ground truth: 35 tables / 59 figures):

| Aspect | Stored Count | Ground Truth | Recall | Gate (D-071.3-16) | Triggered |
|---|---|---|---|---|---|
| Tables | **214** | 35 | 611% (raw — includes false positives) | tables < 25 → plant | NO |
| Images | **20** | 59 | 34% | images < 45 → plant | **YES** |

**Table axis cleared** — camelot's raw output of 214 includes false positives
(figure captions, multi-column text blocks, narrow text columns detected as
tables by `Stream` mode). User accepted shipping best-available per
D-071.3-03; downstream `query_tables` ranking will surface high-quality
matches. If post-ship reports surface *missing* tables (not just noise),
this seed re-opens on trigger #1.

**Image axis tripped** — 20 stored images vs 59 ground-truth figures means
~39 figures are not making it from PDF → `document_images`. The
`pymupdf_full_images_pdf` adapter calls `page.get_images(full=True)` +
`doc.extract_image` walking — this catches embedded raster images but
misses:

- **Form XObject deep-walk** — multi-page reusable graphics objects
  referenced via `fitz.Document.xref_object`
- **Vector figures** — architecture diagrams, flowcharts, plots rendered
  as vector drawings (paths, shapes, text annotations grouped together).
  `page.get_drawings()` returns the path-level primitives; bbox merging
  required to reassemble into a single "figure" record
- **Embedded chart-tile reassembly** — multi-tile chart renderings where
  each tile is technically a separate `Pixmap`, but visually one figure
- **OCR'd figures in scanned pages** — out of scope for non-OCR engines

This is the **same image gap from SEED-006** — Phase 071.3 didn't address
images (per D-071.3-04 — table-focused phase); it measured the gap and
plants this seed.

## Investigation candidates (do NOT enable before re-open trigger)

### 1. Table-recall lift (if trigger #1 fires AND noise filtering proves insufficient)

- **Marker GPU** (SEED-018) — best-of-class on FinTabNet with `--use_llm`;
  GPL-3.0 license, multi-GB models, requires GPU. SEED-018 stays planted
  for the trigger.
- **MinerU** (AGPL) — strong on OmniDocBench (CN academic benchmark);
  similar GPU + licensing fence profile to Marker.
- **PaddleOCR PP-StructureV3** — borderless-table strength per arXiv
  2410.09871; Apache-2.0, CPU-OK but GPU-preferred.
- **Tabula-py** (JVM) — strong on bordered academic tables per arXiv
  2410.09871; adds Java/JVM runtime dependency.
- **gmft retry** — IF transformers strict-dataclass fix lands upstream
  (see Plan 01 WINNER.md "Install Notes" — currently `dilation=None`
  rejected by transformers 5.x dataclass validation). Worth re-bench.

### 2. Image-recall lift (the actual trigger for this seed's plant)

**OSS-first spike candidates (2026-05-16 addition — all $0 cost):**

- **`pdfplumber.figures`** — pdfplumber's native figure detection. Cheap to
  bench: already a transitive dep via `pdfplumber_images_pdf`. Returns
  bounding boxes per page; we render each box as a Pixmap. Closest to
  drop-in; verify it actually finds more than the 20 `pymupdf_full` hits.
- **Marker (`marker-pdf`)** — community benchmarks ~70-80% figure recall.
  CPU-OK on small docs (a few minutes), GPU recommended for large. CPU
  install ~500MB; GPU adds heavier weights. Test on thesis at CPU first.
- **PDFFigures2 (CMU)** — academic-paper specialist; JVM dependency
  (Scala). Designed for thesis-style docs — exactly the operator's use
  case. Higher install friction but proven on academic PDFs.
- **PyMuPDF `page.get_drawings()` + bbox clustering** — returns vector
  primitives; merge bboxes by spatial proximity (DBSCAN on centroids?),
  render each cluster as a synthetic figure. Best for architecture
  diagrams + flowcharts that `get_images()` misses entirely. No new
  install; just code.
- **Form XObject deep-walk** — `fitz.Document.xref_object(xref)` walks the
  PDF object graph; resolve `/XObject` entries of type `/Form` and recurse
  into nested resource dictionaries. Each Form XObject can contain a
  full sub-page graphics state that `page.get_images()` skips. No new
  install; just code.

**Vision-LLM candidates (rejected 2026-05-16 for v2.6; revisit only if all
OSS options above fail in the spike):**

- **`vision_sweep` (per-page rasterize + LLM "list figures with bboxes")**
  — was the Phase 072 Plan 03 design (now deferred). ~$3-5 per re-extract
  on the thesis at OpenAI gpt-5.x vision rates. **Do not re-open without
  spike-positive evidence on the OSS candidates above** — the user
  explicitly rejected this path at the cost/value gate.

**Heavyweight engines (still parked from the original planting):**

- **Embedded chart-tile reassembly** — for figures rendered as multiple
  tiles (`page.get_images()` returns each tile separately), merge tiles
  whose bboxes form a contiguous grid into a single composite image.
- **PDFLib PageGraphics structure walk** — if PyMuPDF's introspection
  proves insufficient, PDFLib's commercial library has a stronger
  graphics-state walk API (license cost: not currently in budget).

### 3. Quality-vs-cost tradeoff (per D-071.3-03)

Any engine swap inherits the per-aspect dispatcher pattern
(`feedback_preserve_engine_optionality`):

- New engine registered in `IMAGE_ENGINES_PDF` registry at
  `backend/app/services/extractors/aspects/__init__.py`
- Lazy import (Pattern SP-4) inside the adapter function body — zero
  startup cost
- Default flip via a new migration if the new engine wins a bench

## Future-phase success criteria template

- [ ] **Table lift** (only if trigger #1 fires): >= 50% reduction in
      user-observed missed tables on the trigger fixture; bench delta vs
      camelot baseline recorded in `.planning/research/<phase>-bench-results.md`
- [ ] **Image lift** (always — primary driver of this seed): >= 50%
      stored-image count on the user's thesis (target: >= 30 vs the
      current 20, a tangible step toward the 59 ground truth)
- [ ] No regression on `friendly_real.pdf` (the arXiv generalization fixture)
- [ ] CPU-OK if no GPU available; else GPU subprocess fence per D-PRD-07
- [ ] Quality vs cost recorded — wall-clock per page, peak RSS, install
      footprint, license posture

## Related work

- **Phase 071.3** (this phase): replaced Docling with camelot — table
  baseline established at 214 raw / image baseline confirmed at 20/59
- **Phase 072** (planning 2026-05-16): originally widened to include a
  `vision_sweep` engine + migration 048 + ≥80% recall target, then
  narrowed back 2026-05-16 per user cost concern. The deferred scope
  rolled INTO this seed (see "Investigation candidates" §2 + the rejected
  vision-LLM section). Phase 072 still ships the cheap fixes: `app_settings`
  wiring + downscale + persist-empty rows + DOCX completeness + lazy retry.
- **SEED-006**: multimodal extraction quality umbrella — original
  storage-layer gap signal (~5% of visible figures stored)
- **SEED-018**: Marker GPL-fenced GPU tables — candidate engine for the
  table side of this lift; re-open trigger is shared
- **SEED-019**: PyMuPDF subprocess OOM + non-Docling eval — closed by
  Phase 071.3; this seed inherits the image-recall residue
- **SEED-020**: retrieval-quality audit — downstream of this seed; even
  if images get extracted, retrieval needs to surface them — the (b) leg
  of the SEED-021 spike trigger is essentially a SEED-020-style query
  audit on figure-grounded queries before paying for higher recall

## Vibe-coder plain summary

The thesis has 59 figures. The new default engines find 20 of them.
That's the same image gap from before Phase 071.3 — the phase deliberately
focused on tables, not images. This seed is the reminder: next time you
upload a paper and ask about a figure that's clearly in the document but
the system can't find it, the fix lives in `aspects/images_pdf.py`
(deeper PyMuPDF walking) or a new GPU-friendly image extractor. Not
retrieval, not embedding model — that's SEED-020. Extraction.
