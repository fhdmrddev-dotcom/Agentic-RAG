# Phase 072: Multimodal Lift + DOCX Completeness - Context

**Gathered:** 2026-05-15
**Revised:** 2026-05-16 (post-Phase 071.4 — Docling fully retired, in-process PyMuPDF, vision_sweep engine added to scope)
**Status:** Ready for planning

## 2026-05-16 Update — what changed and why

Phase 071.3 (Docling demotion) + Phase 071.4 (polish bundle) shipped between 2026-05-15 and 2026-05-16. They invalidated parts of the original CONTEXT.md:

- **PyMuPDF subprocess fence retired** (Phase 071.4-04 Plan G PASS). The original D-072-01 — "swap to AGPL-fenced PyMuPDF subprocess" — is moot. PyMuPDF runs in-process and is already wired into the per-aspect dispatcher at `aspects/images_pdf.py::pymupdf_full_images_pdf`.
- **EXTRACTOR_PRIMARY env var deleted** (Phase 071.4-04 Phase E). All extractor selection now goes through `app_settings.extraction_*_engine_*` per the per-aspect dispatcher.
- **Docling adapters fully deleted** (Phase 071.4-04 Phase A/B). The per-aspect registries now contain: `TABLE_ENGINES = {camelot, pdfplumber}`, `IMAGE_ENGINES_PDF = {pymupdf_full}`, etc.
- **Live image baseline measured** (Phase 071.4 verification): the user's thesis PDF (3.9 MB, ~59 visible figures) stores **20 of 59 = 34% recall** post-rip. This is the actual starting point for Phase 072 — not the original CONTEXT.md's "~2 of 60+ visible figures" estimate.
- **Strategic realization:** Raising `_MAX_VISION_CALLS` from 20 → 100 alone CANNOT lift PDF recall, because `pymupdf_full` only **finds** 20 embedded raster images on this thesis. The bottleneck is extraction, not description.

**Outcome of the 2026-05-16 update discussion:**

- **G1 LOCKED:** Phase 072 **widens scope** to include a new opt-in `vision_sweep` engine (per-page rasterize + vision-LLM "list figures + bboxes" prompt). Preserves engine optionality per `[[feedback-preserve-engine-optionality]]`. Cost is bounded — user opts in via `app_settings.extraction_image_engine_pdf`.
- **D-072-01 REVISED** to reflect the post-rip architecture + new vision_sweep engine.
- **D-072-06 EXTENDED** to cover PDF image dedup (was DOCX-only) — important once vision_sweep can over-detect across rasterized pages.
- **D-072-09 DELETED** (Layer 2 wiring was folded into 071.2 Plan 04 — long shipped, no live coupling).
- **D-072-10 NEW** — Ship migration 048 widening `app_settings.extraction_image_engine_pdf` CHECK to include `'vision_sweep'`.
- **D-072-11 NEW** — Vision_sweep cost guardrails (per-extraction page cap + caption pre-filter heuristic; planner picks final shape).
- **Plan budget grew 3 → 4 plans** (vision_sweep engine + migration 048 = new Plan 03; UAT becomes new Plan 04).
- **SC#1 dual-target:** Default (`pymupdf_full`) target is "≥35% (DOCX walk + downscale clarity baseline)"; opt-in (`vision_sweep`) target is the original "≥80% of visible figures". Binding gate keys off the operator's chosen engine.

<domain>
## Phase Boundary

Lift the multimodal extraction ceiling so a 4 MB academic PDF stores ≥80% of its visible figures (closing the SEED-006 evidence: today's pipeline stores ~2 of 60+ visible figures), make the DOCX walk reach floating shapes + headers/footers (replaces today's `inline_shapes`-only path), and wire the already-shipped `app_settings.multimodal_max_*` columns (migration 044, applied 2026-05-12) into the actual extraction code path. The dead-code state between `UserEffectiveSettings` (which exposes the settings) and `multimodal_service.py` (which hardcodes `_MAX_VISION_CALLS=20` / `_MAX_B64_BYTES=512*1024`) gets closed.

**Already shipped (do NOT re-do):**

1. **Migration 044** (`supabase/migrations/044_app_settings_multimodal_limits.sql`) added `multimodal_max_vision_calls` + `multimodal_max_b64_bytes_kb` columns to `app_settings` — defaults 100 / 4096.
2. **`UserEffectiveSettings` fields** at `backend/app/models/user_settings.py` — Phase 072 USES these.
3. **`load_app_settings()` reads them** at `backend/app/models/user_settings.py` with the right defaults.
4. **In-process PyMuPDF + per-aspect dispatcher** (Phase 071.2 Plan 05 + Phase 071.4 Plan 04 Phase G). `aspects/images_pdf.py::pymupdf_full_images_pdf` is the current PDF image engine. **Subprocess fence + parent wrapper retired** — Phase 072 does NOT reintroduce the fence.
5. **Camelot table engine + precision floor** (Phase 071.3 + 071.4 Plan 01). NOT in Phase 072 scope; mentioned as adjacent context — Phase 072 doesn't touch `aspects/tables.py`.
6. **`/reingest` delete cascade fix** (Phase 071.4 Plan 04). Phase 072's binding tests can rely on `/reingest` correctly clearing prior tables + images.

**Phase 072 owns:**

- Swap `multimodal_service.py` module constants (`_MAX_VISION_CALLS=20` / `_MAX_B64_BYTES=512KB`) for `app_settings` reads via `UserEffectiveSettings` (D-072-08).
- Add a new `vision_sweep` engine to `IMAGE_ENGINES_PDF` registry in `aspects/images_pdf.py` (D-072-01 REVISED). Per-page rasterize via in-process PyMuPDF → vision-LLM call per page with "list figures + bboxes" prompt → produce ImageData records. Opt-in via `app_settings.extraction_image_engine_pdf = 'vision_sweep'`. Default stays `pymupdf_full`. Tables stay on camelot (unchanged).
- Ship **migration 048** widening `app_settings.extraction_image_engine_pdf` CHECK constraint to include `'vision_sweep'` (D-072-10).
- Vision_sweep cost guardrails: per-extraction page cap + caption pre-filter heuristic (D-072-11). Planner picks final shape.
- Downscale-before-vision: PIL.thumbnail(1024px max edge) on every image before vision API call (D-072-02). `_MAX_B64_BYTES` becomes a safety-net constant.
- Persist `description=''` rows instead of dropping them (D-072-03). Lazy retry via `/reextract` only — no background worker (D-072-04).
- DOCX completeness: walk `doc.part.related_parts` + `wp:anchor` floating shapes via lxml on `doc.element` (D-072-07). Page numbers stay null (D-072-05). De-duplicate by image-bytes content hash (D-072-06 — now applies to BOTH PDF and DOCX paths).

**What this phase does NOT do:**

- Modify the `/upload`, `/reingest`, or `/reextract` async-handler-with-sync-IO patterns — Phase 071.2 owns those.
- Modify `multimodal_service.extract_and_store_tables` or `extract_and_store_images` to read from `extracted_doc.tables` / `.images` — that wiring fix is folded into Phase 071.2 Plan 04 (extended from tables-only to also cover images).
- Add a third `app_setting` for the 1024px downscale dimension — hardcoded constant for v2.6 (D-072-02 note).
- Add a vision API spend cap / per-user-per-day budget — deferred to v3.4 spend caps (SEED-006 explicitly flagged this scope split).
- Swap PDF table extraction to PyMuPDF / Docling — Phase 071 SC#3 lives at 89.7% / 100% delta but is OUT OF 072 scope (RAG-DOCLING-01 owner is Phase 071, not 072).
- Build any background worker process for retry — D-072-04 expressly rejects this for v2.6.
- Add a UI toggle for `multimodal_max_*` settings — admin shell is v3.1 (D-PRD-09); 072 ships the backend setting; UI follows.
- Touch the `do_ocr` user-tunable flag — deferred per 071.1 carry-forward (Skill Studio milestone).

</domain>

<decisions>
## Implementation Decisions

### Image extraction engine (the SC#1 anchor)

- **D-072-01 (REVISED 2026-05-16):** **Add a new `vision_sweep` engine to the `IMAGE_ENGINES_PDF` registry in `backend/app/services/extractors/aspects/images_pdf.py`.** The default `pymupdf_full_images_pdf` engine stays — it's the cheap-fast in-process path. `vision_sweep` is an opt-in alternative for documents where pymupdf_full's embedded-raster ceiling is too low (operator's thesis: 20 of ~59 figures).

  **vision_sweep behavior:**
  - Rasterize each page of the PDF via in-process PyMuPDF (`fitz.Page.get_pixmap()` at ~150 DPI). Subprocess fence retired in Phase 071.4 Plan 04 Phase G; `import fitz` is now permitted in-process per D-PRD-07.
  - For each page (subject to guardrails in D-072-11), send the rasterized image to the project's vision-LLM client (`describe_image` helper at `multimodal_service.py:210` already wraps the OpenAI/Anthropic SDKs) with a structured prompt:
    > "List every figure, chart, table, or distinct visual element in this page. For each, return a JSON object with `bbox` (x1, y1, x2, y2 in page-relative 0–1 coords), `kind` (figure/chart/table/diagram), and a one-line caption. Return `[]` if no visual elements."
  - Parse the LLM response (Pydantic per CLAUDE.md), crop the page raster to each bbox (`PIL.Image.crop`), encode as PNG, and produce one `ImageData` record per detected figure.
  - Apply D-072-02 (downscale-before-vision) to each cropped figure before the description-fill pass (which happens at the existing `extract_and_store_images` layer downstream).

  **Why this shape (and not a simpler one):**
  - Preserves the per-aspect dispatcher pattern per `[[feedback-preserve-engine-optionality]]` — the engine slots in `IMAGE_ENGINES_PDF` stay swappable. Users can fall back to `pymupdf_full` if cost is a concern.
  - No new heavy deps. Uses the existing PyMuPDF + PIL + vision-LLM stack. No GPU required.
  - SEED-021 stays planted — full layout-aware ML detection (Marker, TATR-figures, LayoutLMv3) is still v3.x scope, but vision_sweep bridges to ~75–80% recall today.

  **Code site:**
  - New function in `aspects/images_pdf.py`: `def vision_sweep_images_pdf(raw: bytes, mime: str, *, vision_client, app_settings, ...) -> list[ImageData]`. Mirrors the existing `pymupdf_full_images_pdf` signature but takes the vision client as an injected dep.
  - Register in `IMAGE_ENGINES_PDF` dict in `aspects/__init__.py`.
  - The route layer (`/upload` / `/reingest` BackgroundTask in `documents.py`) reads `app_settings.extraction_image_engine_pdf` and dispatches accordingly via the existing `extract_composable` plumbing. No new function signatures at the route layer.

  **AGPL invariant (relaxed but not removed):** PyMuPDF is now AGPL-in-process per D-PRD-07. The `requirements.txt` AGPL comment block stays. Phase 077 (multi-worker) may revisit if commercial-license concerns surface for distributed deploys, but for v2.6 (single-worker, self-hosted) the in-process posture is correct.

  **Performance trade-off:**
  - vision_sweep at default settings (page cap = 20 per D-072-11) on the operator's 75-page thesis: ~$3-5 per re-extract at OpenAI gpt-5.4 vision rates, ~30-60s wall time (vision-LLM bound; rasterization is fast).
  - vs `pymupdf_full` (default): ~$0, ~2-5s wall time.
  - User pays the cost only when they opt in via `app_settings.extraction_image_engine_pdf = 'vision_sweep'`. Default deployment cost-profile is unchanged.

### Downscale-before-vision strategy

- **D-072-02:** **PIL.thumbnail(1024px max edge) on every image before vision API call**, regardless of original size. `_MAX_B64_BYTES` becomes a safety-net constant (still 4 MB per migration 044 default — degenerate inputs caught, but won't normally fire because thumbnail() brings everything under ~200 KB).
  - **Rationale:** OpenAI's vision API with `detail="low"` projects all input images to a 512×512 internal representation — there is zero perceived-quality benefit from sending images larger than ~1024px. Anthropic caps base64 images at 5 MB; sending raw 4 MB images risks rejection on some providers. Downscaling produces uniformly small payloads (~50-200 KB) for predictable bandwidth + cost.
  - **No performance harm:** PIL.thumbnail() is in-place + ~10ms per image. Plus the post-thumbnail PNG encode is faster than encoding a raw 4 MB original.
  - **Constant hardcoded for v2.6:** 1024px lives as a module constant `MULTIMODAL_THUMBNAIL_MAX_EDGE = 1024` in `multimodal_service.py`. NOT a third `app_setting` — PRD scope is the two existing keys only. Future flexibility comes through the v3.1 admin shell.

### Empty-description row policy + retry shape

- **D-072-03:** **Persist `description=''` rows immediately.** Today (`multimodal_service.py:300-302`) empty descriptions skip the INSERT entirely — once a vision API call fails or returns empty, the image is permanently absent from `document_images`. Fix: drop the early-continue, always INSERT.
  - **Counter-rationale to skip-on-empty:** the image existed in the source PDF; losing the row loses the evidence. RAG retrieval might still match the bbox / page reference even with empty description. Manual re-trigger requires knowing what to re-trigger.

- **D-072-04:** **Lazy retry via `/reextract` only — no background worker for v2.6.** The natural retry surface is `/reextract`: it already does a reset cascade (delete chunks/tables/images, re-extract everything) per Phase 071 Plan 04. Phase 072's lazy retry can either:
  - **Shape A:** Full /reextract incidentally fills empties (since it wipes + re-extracts everything). Simplest; no API surface change. Cost: re-extracts everything even if only empties needed filling.
  - **Shape B:** Add an optional `/reextract?retry_empty_descriptions_only=true` flag that runs the PyMuPDF image extraction + vision-describe pass on rows where `description=''` AND `extracted_at < now() - 5min`, leaving text/tables/non-empty-image rows untouched. Cost: small new conditional branch in `/reextract`.
  - Planner picks A or B based on test surface complexity. Recommend B (cheaper to re-fill empties without nuking everything) but A acceptable if it keeps the diff tight.
  - **No background worker. No cron-style polling.** SEED-006 mentioned async retry as a stretch; D-072-04 explicitly downscopes — v2.6 single-worker context doesn't sustain a background process well, and `/reextract`-driven retry is sufficient for the empty-row class of failures (mostly transient vision API hiccups, fixed by the next user-initiated re-extract).

### DOCX completeness (SC#3 anchor)

- **D-072-05:** **DOCX images keep `page=null`.** python-docx genuinely cannot determine page boundaries — it has no rendered-layout concept. Heuristic page inference via section/paragraph index is noise-prone and brittle. Matches existing DOCX table behavior (`extract_docx_tables` sets `page=None`). The `query_tables` tool already handles `page=null` correctly.

- **D-072-06 (EXTENDED 2026-05-16):** **De-duplicate images by content hash (SHA1 of image bytes) — applies to BOTH DOCX and PDF paths.**
  - **DOCX:** Branded Word templates commonly embed the same logo in header + inline body + footer — storing 3 copies wastes 3× vision API calls. Build a `seen_hashes: set[str]` during the `related_parts` + `wp:anchor` walk; skip on collision. Note the location in description prefix (`[Image header]: ...` vs `[Image inline]: ...`).
  - **PDF (new):** With `vision_sweep` engine in play (D-072-01), a figure that spans a page break can be detected on TWO rasterized pages as separate visual elements. Content-hash on the cropped PNG bytes deduplicates these. Also catches the common case of a logo in every page header/footer rendering to the same crop. Implementation: same `seen_hashes` pattern in `vision_sweep_images_pdf` AND in `pymupdf_full_images_pdf` (for symmetry — the cost is trivial and matches the DOCX path's invariant).
  - **Shared helper:** Move the dedup-by-hash logic into a small helper at `multimodal_service.py` or `aspects/__init__.py` so both PDF + DOCX engines call the same code (one `_dedup_images_by_hash(images)` function).

- **D-072-07:** **Walk floating shapes via lxml on `doc.element`.** python-docx exposes `inline_shapes` natively but not floating ones (`<wp:anchor>` lives in a different XML namespace). Use python-docx's underlying lxml tree:
  ```python
  ns = {'wp': 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing'}
  for anchor in doc.element.body.iter(f"{{{ns['wp']}}}anchor"):
      embed_rid = anchor.find('.//{...}blip').get('{...}embed')
      part = doc.part.related_parts[embed_rid]
      img_bytes = part.blob
      ...
  ```
  ~20 LOC, no new dependencies. Standard community pattern. Combined with `doc.part.related_parts` walk for headers/footers (which iterate over `doc.part.header_parts` + `doc.part.footer_parts` via lxml similarly), this catches every image python-docx silently skips today.

### app_settings wiring (the dead-code closure)

- **D-072-08:** **`multimodal_service.py` reads `app_settings.multimodal_max_*` via the existing `app_settings: UserEffectiveSettings` parameter** already passed to `extract_and_store_images` (line 258). Replace module constants `_MAX_VISION_CALLS=20` (line 29) and `_MAX_B64_BYTES=512*1024` (line 33) with `app_settings.multimodal_max_vision_calls` and `app_settings.multimodal_max_b64_bytes_kb * 1024` (note: stored as KB; multiply by 1024 to get bytes). Defaults already correct per Phase 071 wiring (100 / 4096).
  - **No new function signatures:** `extract_and_store_images` already receives `app_settings`. The constants migrate to attribute reads inline. ~10 LOC diff.
  - **Closes CONCERNS.md:520-524 (per PRD SC#4)** — the `app_settings` dead-code state for these two specific keys gets closed.

### Vision_sweep migration + cost guardrails (new 2026-05-16)

- **D-072-10:** **Ship migration 048** at `supabase/migrations/048_app_settings_image_engine_pdf_vision_sweep.sql`. Widen the `app_settings.extraction_image_engine_pdf` CHECK constraint to include `'vision_sweep'` (currently allows `'pymupdf_full'` and other slots from migration 045). Default stays `'pymupdf_full'` — vision_sweep is opt-in by operator action. Follow CLAUDE.md migration discipline: paste in Supabase SQL editor (NOT `supabase db push`), then regen `supabase/full-schema.sql`. Commit migration + regenerated full-schema together.
  - **Idempotency guards:** Use `DROP CONSTRAINT IF EXISTS` + `ADD CONSTRAINT` pattern matching migration 047. Pre-migration UPDATE not required (no rows currently use `'vision_sweep'`).

- **D-072-11:** **Vision_sweep cost guardrails — planner-discretion shape but mandatory guardrails exist.** The naive shape (vision-LLM call per page) would cost ~$3-5 per thesis re-extract; without bounds it's open-ended. Required guardrails:
  - **Per-extraction page cap:** new `app_settings.vision_sweep_max_pages` integer (default 20). vision_sweep stops after this many vision-LLM calls per extraction. Surplus pages fall through to `pymupdf_full` baseline for the remaining pages (so the result is the union of LLM-detected figures on the first N pages + embedded rasters from all pages).
  - **Caption pre-filter heuristic (recommended):** before calling the LLM on a page, do a cheap text scan for figure/table caption regex patterns (`Figure \d+`, `Fig\. \d+`, `Table \d+`, `Chart \d+`). If NO caption-pattern matches on a page, skip the LLM call for that page (assume no figures). Skip-the-LLM-call reduces cost on text-heavy pages without losing precision.
  - **Cost-cap UI surface:** a new `app_settings.vision_sweep_estimated_cost_warn_usd` threshold (default 5.0 USD) → log a warning per extraction when projected cost exceeds. NOT a hard cap (operator decides). Planner discretion on the exact migration shape — could fold into migration 048 or split.
  - **Planner picks the final shape** at plan-phase time. The MUST-HAVE invariants: (a) a page-cap setting reads from `app_settings`, (b) a per-extraction cost is observable in logs at INFO level for forensics. Everything else (caption filter, warn threshold, env var fallback) is planner-shaped.

### Plan-budget split (advisory; gsd-planner finalizes) — REVISED 2026-05-16 (3 → 4 plans)

ROADMAP originally allocated 3 plans; the G1 widening to include vision_sweep adds one more. Suggested split:

1. **Plan 01 — `app_settings` wiring + downscale + persist empty rows.** Replace module constants with `app_settings` reads (D-072-08). Add 1024px PIL.thumbnail downscale before every vision call (D-072-02). Persist `description=''` rows (D-072-03). Binding test: assert vision_max_calls reads from `app_settings`; assert downscale fires before vision API call; assert empty-description rows persist. Autonomous: true. ~150 LOC.

2. **Plan 02 — DOCX completeness (related_parts walk + lxml floating shapes + dedup).** Implement D-072-05/06/07. Replace `extract_docx_images` body with the new walk. Add the shared `_dedup_images_by_hash` helper (D-072-06 extended to PDF + DOCX). Binding test: hand-craft a DOCX with (a) inline image, (b) header logo, (c) floating shape, (d) duplicate logo in footer — assert exactly 3 `document_images` rows (the duplicate dropped via hash dedup). Autonomous: true. ~200 LOC.

3. **Plan 03 — Vision_sweep engine + migration 048 + cost guardrails.** Implement `vision_sweep_images_pdf` in `aspects/images_pdf.py` (D-072-01). Register in `IMAGE_ENGINES_PDF`. Ship migration 048 (D-072-10) — paste-in-SQL-editor checkpoint per CLAUDE.md migration discipline. Implement the page-cap + caption pre-filter guardrails per D-072-11 (planner shapes final knobs). Wire `app_settings.extraction_image_engine_pdf = 'vision_sweep'` dispatch. Binding test: mock the vision-LLM client; ingest a hand-crafted multi-page PDF with synthetic captions; assert vision_sweep returns the expected ImageData records; assert the page-cap respects `app_settings.vision_sweep_max_pages`. Autonomous: false (migration paste checkpoint).

4. **Plan 04 — Lazy retry path + live UAT (both engines).** Implement `/reextract?retry_empty_descriptions_only=true` (or accept Shape A and document it) per D-072-04. Live UAT on the thesis PDF in BOTH engine modes:
   - Default mode (`pymupdf_full`): document_images ≥ 20 (current baseline preserved), DOCX walk extension adds ~5-10 images.
   - Opt-in mode (`vision_sweep`, with `vision_sweep_max_pages = 75` for the thesis): document_images ≥ 47 (= 80% of 59 visible figures). Operator confirms cost is within the projected ~$3-5 range.
   - Both modes record in `072-HUMAN-UAT.md` with separate sections + status.
   - **Dual-target SC#1 keying:** UAT status = green iff (a) default mode hits ≥35% (≥21 of 59 figures), AND (b) opt-in mode hits ≥80% (≥47 of 59). Either failing = UAT red.
   Autonomous: false (live UAT + operator-driven cost confirmation).

Planner can collapse Plan 04 into Plan 03 if the retry path is sufficiently small AND lazy-retry shape ends up being Shape A. Recommend keeping live UAT split out — same lesson from Phase 071/071.3 (mixed autonomous + non-autonomous tasks slow the verifier; and the operator gate on cost is real).

### Claude's Discretion

- Exact lxml XPath / namespace handling for the floating-shape walk — match the standard `python-docx`-internals pattern from community examples. Planner can pick `iter()` vs `xpath()` based on readability.
- Whether to extract the PyMuPDF image-extraction call into a thin helper at `multimodal_service.py` (e.g., `_extract_pdf_images_pymupdf(raw)`) or just delegate to `PyMuPDFExtractor().extract(raw, mime).images` — recommend the latter (zero new helpers, reuses Phase 071 Plan 03 path) but planner picks at code-layout time.
- Exact wording of the description prefix for de-duplicated images (`[Image header]:` vs `[Image template]:` vs `[Image (logo)]:`) — match the existing `[Image p.N]:` convention from `extract_and_store_images:344`. Planner picks.
- Whether `/reextract?retry_empty_descriptions_only=true` should also accept a JSON body shape like `{"only_empty_descriptions": true}` for consistency with the existing `{"engine": "..."}` body — recommend query param for read-only intent + body for write-intent. Planner picks.
- Whether to commit the 4 MB academic PDF binding fixture (already referenced as `friendly_real.pdf` from Phase 071.1 — arXiv 2605.15184v1 CC-BY 4.0) OR craft a smaller fixture for CI speed — Phase 071.1 evidence shows the existing fixture is sufficient. Reuse, don't recommit.
- Whether to also de-duplicate PDF images by content hash (D-072-06 is DOCX-only) — recommend YES as an opportunistic catch (low LOC), but if it shows test-surface friction, defer. Planner discretion.
- Whether the 1024px downscale should fire BEFORE or AFTER the empty-description check — recommend AFTER (skip describe altogether on under-50px, downscale only what reaches vision). Trivial ordering; planner picks.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 072's direct upstream artifacts

- `.planning/seeds/SEED-006-multimodal-extraction-quality.md` — **PRIMARY SOURCE** for the multimodal lift scope. Lines 44-93 (Recommended Approach), lines 120-128 (Falsifiable Success Criteria), lines 130-138 (Pitfalls). Includes the 2026-05-15 retest update confirming the persistence-layer bottleneck.
- `.planning/phases/071-docling-primary-path/071-CONTEXT.md` — Phase 071 decisions D-071-01..16 (carried forward verbatim). Specifically D-071-03 (PyMuPDF subprocess fence, AGPL invariant) governs D-072-01's reuse.
- `.planning/phases/071.1-docling-sc-1-retry-threadpool-timeouts-pymupdf-fallback/071.1-CARRY-FORWARDS.md` — items #1 (95%-chunks-drop) + #2 (4-vs-1 table-count mismatch) folded into Phase 071.2 Plan 04, NOT 072. Item #4 (SEED-006 promotion) is what this phase delivers.
- `.planning/reported-bugs/` — cross-checked 2026-05-15. NONE of the four open `surface: Agentic-RAG` bugs overlap Phase 072's domain (multimodal extraction / DOCX). Routing decision: NONE folded.

### Roadmap + requirements (REQ-ID anchor)

- `.planning/ROADMAP.md` §Phase 072 (lines 308-313 pre-071.2-insert; renumber after) — phase entry; depends on Phase 069 (PdfExtractor ABC, already shipped); plans: 3.
- `.planning/REQUIREMENTS.md` RAG-MM-LIFT-01 (line 19) + RAG-MM-LIFT-02 (line 20) — owning REQ-IDs.
- `.planning/PRDs/v2.6.md` §3 Theme A (RAG quality lift) + §4 RAG-MM-LIFT-01/02 rows + §5 multimodal section + §10 deferred Q-list.

### Locked decisions inherited from prior phases (do NOT re-litigate)

- `.planning/PROJECT.md` Key Decisions table — **D-v2.6-01** (supabase 2.29.0, httpx 0.28.x, docling 2.93.0 pins) + **D-v2.5-01** (no blocking I/O in async handlers; 072 inherits the threadpool sweep from 071.2, doesn't re-add it).
- `.planning/prd-reset/DECISIONS.md` **D-PRD-07** + **D-PRD-07 Appendix** (PyMuPDF AGPL subprocess fence — already implemented by Phase 071 Plan 03; 072 consumes via the existing parent wrapper, no fence changes).
- `.planning/phases/071-docling-primary-path/071-CONTEXT.md` D-071-03 (PyMuPDF subprocess timeout = 60s — 072's image-extraction calls inherit this).
- `CLAUDE.md` — venv mandatory; no LangChain; D-04 from Phase 36 (don't write `b64_png` to `document_images`); Migrations applied via SQL editor + regen full schema afterward (072 migration 044 already shipped per Phase 071, no new migration in 072); Reported Bugs cross-check rule.

### Code surfaces touched by this phase

- `backend/app/services/multimodal_service.py` — **PRIMARY EDIT ZONE.**
  - Lines 28-33: remove `_MAX_VISION_CALLS` + `_MAX_B64_BYTES` module constants (D-072-08).
  - Lines 132-172: `extract_pdf_images` — either replace with PyMuPDF-subprocess call OR leave as a fallback and call `PyMuPDFExtractor` from `extract_and_store_images` directly (D-072-01).
  - Lines 175-207: `extract_docx_images` — replace with `related_parts` + `wp:anchor` walk (D-072-07), apply hash dedup (D-072-06).
  - Lines 252-376: `extract_and_store_images` — read settings via `app_settings.multimodal_max_*` (D-072-08), add PIL.thumbnail(1024px) before vision call (D-072-02), remove the empty-description early-continue (D-072-03).
  - Add a new module constant: `MULTIMODAL_THUMBNAIL_MAX_EDGE = 1024` (D-072-02).
- `backend/app/services/extraction_service.py` — `LegacyExtractor._extract_images` (lines 192-206) reroutes PDF path to PyMuPDF subprocess (D-072-01).
- `backend/app/api/documents.py` — `/reextract` route gains optional `?retry_empty_descriptions_only=true` query param (D-072-04 Shape B), OR documentation note (D-072-04 Shape A). Planner picks.
- `backend/tests/unit/test_multimodal_extraction.py` — existing tests stay green (D-072-08 doesn't change function signatures). New tests for D-072-01/02/03/05/06/07 image+DOCX changes.
- `backend/tests/integration/test_documents.py` — new test for `/reextract?retry_empty_descriptions_only=true` (if Shape B).
- `backend/tests/fixtures/extraction/` — reuse `friendly_real.pdf` (arXiv 2605.15184v1 CC-BY 4.0) from 071.1 as the multimodal-lift binding fixture. NO new fixtures unless DOCX hand-crafted test requires one.

### Phase 072 does NOT touch

- `backend/app/api/documents.py` `ingest_document` background task — only the `/reextract` route surface for the retry flag.
- `backend/app/services/extractors/docling.py` / `pymupdf.py` — these are stable Phase 071 surfaces. 072 consumes via the existing dispatcher.
- `backend/app/models/user_settings.py` — already correctly wired by Phase 071. 072 just reads from `UserEffectiveSettings.multimodal_max_*`.
- `supabase/migrations/` — no new migrations. Migration 044 already shipped.
- `frontend/src/` — no frontend changes. Admin UI for these settings is v3.1.

### Phase 071 invariants to preserve

- **AGPL fence invariant** (Phase 071 Plan 03): no `import fitz` in `backend/app/`. D-072-01 routes through the existing parent wrapper which subprocess-invokes the child entrypoint.
- **D-v2.6-01 pin invariants**: `backend/requirements.txt` lines for `supabase==2.29.0`, `httpx>=0.28.0,<0.29.0`, `docling>=2.93.0,<3.0.0`, `pymupdf>=1.24` stay byte-identical. 072 does NOT touch `requirements.txt`.
- **Migration 044 schema invariant**: columns are nullable INT with defaults 100/4096. 072 reads them; doesn't ALTER.
- **`b64_png` not stored in `document_images`** (D-04 from Phase 36): 072 preserves this. Description fill + retry uses re-extract from source PDF in Supabase Storage, not stored bytes.

### Reported bugs cross-check (CLAUDE.md MANDATORY rule)

Four open `surface: Agentic-RAG` bugs as of 2026-05-15:

- `anthropic-end-of-cycle-shows-actions-not-summary.md` — backend/agent-loop. **Does NOT touch ingestion/multimodal.** Leave open.
- `streaming-indicator-top-bottom-desync.md` — frontend/streaming. **Does NOT touch ingestion.** Leave open.
- `tool-output-download-bloat-intermediate-artifacts.md` — frontend/tool-card. **Does NOT touch ingestion.** Leave open.
- `thread-switch-blank-state-load-latency.md` — frontend/chat-surface. **Already folded into Phase 068.5** (folded_into: 068.5). Not 072 scope.

**Routing decision: NONE folded into Phase 072.** Phase 072 scope is narrowly multimodal extraction backend; the four bugs are agent-loop + frontend + already-folded.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`PyMuPDFExtractor` parent wrapper** at `backend/app/services/extractors/pymupdf.py` — shipped Phase 071 Plan 03. D-072-01 consumes as-is.
- **`backend/extractors/pymupdf_isolated.py`** — AGPL child entrypoint. NOT touched by 072.
- **`PdfExtractor` ABC + `ExtractedDocument` dataclass** at `backend/app/services/extraction_service.py` — Phase 069 contract. 072 modifies `LegacyExtractor._extract_images` body, doesn't change the ABC.
- **`UserEffectiveSettings.multimodal_max_*` fields** at `backend/app/models/user_settings.py:91-92` — already populated, just need to be read.
- **`load_app_settings()` integration** at `backend/app/models/user_settings.py:290-291` — already wired, defaults correct.
- **`describe_image(b64_png, app_settings, client)` vision helper** at `backend/app/services/multimodal_service.py:210` — used as-is, just called more often after the cap rises.
- **`hashlib`** (stdlib) — for SHA1 content hashing per D-072-06.
- **`lxml.etree`** — already a python-docx transitive dep. For floating-shape walk per D-072-07.

### Established Patterns

- **Silent-swallow on extraction failure** (D-069-04) — `extract_and_store_*` wraps everything in `try/except Exception`. 072 preserves this; empty-description rows are stored, not raised.
- **Lazy-import heavy deps** (`from pypdf import PdfReader`, `import pdfplumber`) — 072 follows: PIL import already lazy at line 139; PyMuPDF subprocess invoked via the existing wrapper.
- **`app_settings: UserEffectiveSettings` plumbed everywhere** — `documents.py:992` already loads via `load_app_settings()`; passes through `extract_and_store_images`. Pattern preserves.
- **Test patching via module-level helpers** (`extract_pdf_tables`, `extract_pdf_images`) — keep these helpers patchable; tests in `test_multimodal_extraction.py` rely on this surface.

### Integration Points

- **`extract_and_store_images` call site** at `backend/app/api/documents.py:1032` — already receives `app_settings`. No call-site changes needed for D-072-08.
- **`/reextract` route at `backend/app/api/documents.py:reextract_document`** — D-072-04 Shape B adds an optional query param; doesn't restructure the handler.
- **Layer 2 wiring fix (D-072-09)** depends on Phase 071.2 Plan 04 landing first. Phase 072 plan-phase should verify 071.2 Plan 04 status before starting Plan 01.

### Phase 072 risk surfaces

- **PyMuPDF subprocess startup overhead** on every PDF ingest (D-072-01). Mitigation: subprocess reuse / pooling is a Phase 077 multi-worker concern, not 072.
- **DOCX lxml namespace correctness** (D-072-07). Mitigation: hand-crafted DOCX test fixture catches namespace typos.
- **Vision API failures cascade to "all empty" on bad provider config**. Mitigation: D-072-03 ensures rows still persist with `description=''`; D-072-04 lazy retry catches them later. SEED-006 already validates this approach.
- **De-duplication false-positives** (D-072-06) — two distinct images that happen to hash-collide on SHA1 are astronomically unlikely but technically possible. SHA1 is cryptographically broken but for collision-resistance on legitimate image bytes, sufficient. Recommend SHA256 if planner has cycles.

</code_context>

<specifics>
## Specific Ideas

- **The SC#1 anchor is concrete and falsifiable.** On the user's 4 MB academic PDF, ≥30 `document_images` rows persisted, ≥90% with non-empty descriptions. SEED-006 documents the current baseline: 2 of 60+ visible figures. The Plan 01 binding test asserts the lift in concrete numbers, not "more figures."
- **The user's stated preference is `EXTRACTOR_PRIMARY=legacy` until Docling earns its keep.** D-072-01 is intentionally scoped to LegacyExtractor only — swapping the image engine inside legacy means the user's deployment immediately benefits without re-litigating the engine-default decision.
- **DOCX completeness is the under-loved half.** SEED-006 focuses on PDFs but the user's thesis evidence shows DOCX stores 39 tables and 0 images — the DOCX walk has BOTH a working table path AND a completely-broken image path. D-072-05/06/07 addresses the image gap; tables-on-DOCX stays unchanged.
- **Migration 044 + settings wiring already shipped — the dead-code state is the embarrassment.** Phase 071 laid the contract; not consuming it in 072 would leave a clearly-broken seam visible to the next maintainer. PRD SC#4 explicitly names this closure.
- **Lazy retry > background worker for v2.6.** D-072-04 deliberately rejects the SEED-006 "queue async retries" suggestion. v2.6 single-worker context doesn't sustain a background process well; `/reextract`-driven retry covers the empty-row class without new infra. Phase 077 multi-worker is the right re-open trigger if needed.
- **Vibe-coder-friendly summary** (per memory `feedback_vibe_coder_communication.md`): Phase 072 fixes three related problems with how documents get analyzed for images. (1) Today the system only looks at 20 images per document and gives up after 512KB — we raise this to 100 images and 4MB, AND we use a better tool (PyMuPDF) to read images out of PDFs so the ones that exist actually get found instead of silently failing. (2) Word documents with logos in the header / floating shapes / chart figures — today we miss most of these because we only look at "inline" shapes; we fix the walk to catch all of them. (3) When the AI fails to describe an image (network hiccup, weird image), today we throw the whole image away; we fix that to keep the image entry around so a retry can fill in the description later without re-uploading the document.

</specifics>

<deferred>
## Deferred Ideas

- **PDF table extraction swap to PyMuPDF / Docling** — SEED-006 evidence shows pdfplumber emits false-positive 1×1 tables on the thesis. Out of 072 scope (072 is multimodal lift + DOCX completeness; tables-on-PDF is Phase 071 SC#3 which lives at 89.7%/100%). **Re-open trigger:** if Phase 071.2 Plan 04 wiring fix surfaces that `extract_and_store_tables` reading `extracted_doc.tables` STILL produces noisy 1×1 results under Legacy, fold the table-engine swap into a follow-on.

- **Background retry worker for empty descriptions** — D-072-04 explicitly defers. **Re-open trigger:** Phase 077 multi-worker, OR observed accumulation of empty-description rows in production telemetry that user-initiated /reextract isn't catching.

- **Third `app_setting` for downscale dimension** — D-072-02 hardcodes 1024px. **Re-open trigger:** v3.1 admin shell milestone (D-PRD-09) is the natural home for tunable knobs; until then env-only or hardcoded.

- **Vision API spend cap / per-user-per-day budget** — SEED-006 flags this as needed for production. **Re-open trigger:** v3.4 spend caps (per REQUIREMENTS.md Theme F roadmap).

- **`do_ocr` user-tunable flag** — Phase 072 / Skill Studio milestone (deferred from 071.1 carry-forward). **Re-open trigger:** user request for scanned-PDF support.

- **Subprocess pool / reuse for PyMuPDF** — every PDF ingest spawns a subprocess under D-072-01. **Re-open trigger:** Phase 077 multi-worker, OR perf telemetry shows PyMuPDF subprocess startup as a noticeable share of ingest time.

- **PDF image de-duplication via content hash** (D-072-06 is DOCX-only) — Claude's discretion. **Re-open trigger:** if PDF re-extracts show duplicate-figure storage waste, opportunistically extend.

- **Vector-figure clustering** (SEED-006 mentions `page.get_drawings()` + bbox merging for vector figures, e.g., architecture diagrams) — out of 072 scope. **Re-open trigger:** user reports of missing vector figures on technical docs.

- **OCR for scanned/image-only PDFs** — out of 072 scope. **Re-open trigger:** user request for OCR support; needs RapidOCR re-enablement strategy (currently disabled per 071.1 due to std::bad_alloc on Windows).

- **Frontend admin UI for `multimodal_max_*` settings** — 072 ships backend setting; UI follows. **Re-open trigger:** v3.1 admin shell milestone.

- **Vibe-coder-flow: per-document "X figures stored, Y attempted" badge in the documents list** — could be derived from `pdf_extraction_runs.image_count` (extractor's count) vs `document_images` count for the same `document_id`. Useful for the "did my upload work?" question. **Re-open trigger:** v3.1 admin shell / documents-list polish phase.

- **Reviewed Todos (not folded)** — None; no relevant todos surfaced for Phase 072 scope.

- **Reported bugs reviewed (not folded — none touch multimodal/extraction)** —
  - `anthropic-end-of-cycle-shows-actions-not-summary.md` (backend agent-loop) — leave open.
  - `streaming-indicator-top-bottom-desync.md` (frontend streaming) — leave open.
  - `tool-output-download-bloat-intermediate-artifacts.md` (frontend tool cards) — leave open.
  - `thread-switch-blank-state-load-latency.md` (frontend chat-surface) — already folded into Phase 068.5.

</deferred>

---

*Phase: 072-multimodal-lift-docx-completeness*
*Context gathered: 2026-05-15*
