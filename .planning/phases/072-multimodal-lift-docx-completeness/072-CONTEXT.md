# Phase 072: Multimodal Lift + DOCX Completeness - Context

**Gathered:** 2026-05-15
**Status:** Ready for planning (BLOCKED on Phase 071.2 Plan 04 — Layer 2 wiring fix)

<domain>
## Phase Boundary

Lift the multimodal extraction ceiling so a 4 MB academic PDF stores ≥80% of its visible figures (closing the SEED-006 evidence: today's pipeline stores ~2 of 60+ visible figures), make the DOCX walk reach floating shapes + headers/footers (replaces today's `inline_shapes`-only path), and wire the already-shipped `app_settings.multimodal_max_*` columns (migration 044, applied 2026-05-12) into the actual extraction code path. The dead-code state between `UserEffectiveSettings` (which exposes the settings) and `multimodal_service.py` (which hardcodes `_MAX_VISION_CALLS=20` / `_MAX_B64_BYTES=512*1024`) gets closed.

**Already shipped (do NOT re-do):**

1. **Migration 044** (`supabase/migrations/044_app_settings_multimodal_limits.sql`) added `multimodal_max_vision_calls` + `multimodal_max_b64_bytes_kb` columns to `app_settings` — Phase 071 contract; defaults 100 / 4096.
2. **`UserEffectiveSettings` fields** at `backend/app/models/user_settings.py:91-92` (Phase 071 wiring contract — Phase 072 USES these in the service).
3. **`load_app_settings()` reads them** at `backend/app/models/user_settings.py:290-291` with the right defaults.
4. **PyMuPDF subprocess fence** shipped Phase 071 Plan 03 (`backend/app/services/extractors/pymupdf.py` parent wrapper + `backend/extractors/pymupdf_isolated.py` child). Phase 072 consumes this for D-072-01 without modifying the fence.
5. **`.env` → `os.environ` hot-fix** committed 2026-05-15 (commit `33860a7`) — `load_dotenv()` in `main.py` so the legacy revert + the three Docling env knobs from 071.1 actually take effect.

**Phase 072 owns:**

- Swap `multimodal_service.py` module constants (`_MAX_VISION_CALLS=20` / `_MAX_B64_BYTES=512KB`) for `app_settings` reads via `UserEffectiveSettings` (D-072-09).
- Swap `LegacyExtractor`'s PDF image extraction to use the AGPL-fenced PyMuPDF subprocess under the hood (D-072-01). Tables stay on pdfplumber (unchanged).
- Downscale-before-vision: PIL.thumbnail(1024px max edge) on every image before vision API call (D-072-02). `_MAX_B64_BYTES` becomes a safety-net constant.
- Persist `description=''` rows instead of dropping them (D-072-03). Lazy retry via `/reextract` only — no background worker (D-072-04).
- DOCX completeness: walk `doc.part.related_parts` + `wp:anchor` floating shapes via lxml on `doc.element` (D-072-07). Page numbers stay null (D-072-05). De-duplicate by image-bytes content hash (D-072-06).

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

- **D-072-01:** **Swap `LegacyExtractor._extract_images` (PDF path only) to use the AGPL-fenced PyMuPDF subprocess** shipped by Phase 071 Plan 03. The DOCX image path stays on python-docx (D-072-07 governs the walk). Tables stay on pdfplumber. Rationale: SEED-006 evidence (2026-05-02) shows pdfplumber drops 59 of 61 candidate images at the decode step (silent `try/except continue` on CMYK/JPEG2000/JBIG2 encodings); PyMuPDF's `doc.extract_image(xref)` returns properly-decoded bytes. EXTRACTOR_PRIMARY=legacy is the user's stated default until Docling earns its keep — swapping the image-engine within Legacy means the lift works for the user's actual deployment without changing the primary extractor decision.
  - **Code site:** `backend/app/services/extraction_service.py:192-206` (`LegacyExtractor._extract_images`) plus a new `multimodal_service.extract_pdf_images_pymupdf` helper, OR delegate directly through the existing `PyMuPDFExtractor` parent wrapper at `backend/app/services/extractors/pymupdf.py`. Planner picks the cleanest shape.
  - **Performance trade-off:** Each PDF extract now spawns the PyMuPDF subprocess in addition to running pypdf for text + pdfplumber for tables. Subprocess startup ~50ms; total legacy-extract time grows ~10-30%. Acceptable per D-v2.5-02 single-worker context — the gain (59 images recovered) dwarfs the overhead. Phase 077 multi-worker can revisit if perf shows up as a bottleneck.
  - **AGPL fence invariant:** `import fitz` must remain only in `backend/extractors/pymupdf_isolated.py` (Phase 071 Plan 03 test `test_fitz_not_imported_by_parent` enforces). This decision adds NO new fitz imports anywhere — the legacy path subprocess-invokes the existing child entrypoint.

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

- **D-072-06:** **De-duplicate DOCX images by content hash** (SHA1 or MD5 of image bytes). Branded Word templates commonly embed the same logo in header + inline body + footer — storing 3 copies wastes 3× vision API calls and creates duplicate `document_chunks` for the same image. Implementation: build a `seen_hashes: set[str]` during the related_parts walk; skip on collision. Note the location in the description prefix (`[Image header]: ...` vs `[Image inline]: ...`) so the user can still trace where it appeared.

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

### Layer 2 wiring (cross-phase coupling — folded into 071.2)

- **D-072-09:** **The `extract_and_store_images` ignoring-`extracted_doc.images` wiring bug is folded into Phase 071.2 Plan 04** (originally scoped for tables only; extended to also cover images). By the time Phase 072 starts, Plan 04 has fixed Layer 2 so `extract_and_store_images` reads from `extracted_doc.images` instead of re-running `extract_pdf_images(raw)`. This means D-072-01's swap takes effect at Layer 1 only — `LegacyExtractor._extract_images` now returns PyMuPDF output, which `extracted_doc.images` carries through to the storage layer cleanly.
  - **Why split across phases:** the wiring bug is the same bug class as the tables 4-vs-1 mismatch (071.1-CARRY-FORWARDS item #2). Fixing both in 071.2 Plan 04 keeps related changes atomic; 072 inherits a clean wire and focuses on the multimodal lift itself.
  - **Risk if 071.2 Plan 04 slips:** Phase 072 either (a) waits for 071.2, OR (b) does its own Layer 2 fix inline in 072 plan. Planner picks at 072 plan time based on 071.2 status.

### Plan-budget split (advisory; gsd-planner finalizes)

ROADMAP allocates 3 plans. Suggested split:

1. **Plan 01 — `app_settings` wiring + image-engine swap (PDF).** Replace module constants with `app_settings` reads (D-072-08). Swap `LegacyExtractor._extract_images` to PyMuPDF subprocess (D-072-01). Add 1024px PIL.thumbnail downscale before every vision call (D-072-02). Persist `description=''` rows (D-072-03). Binding test: ingest a thesis-class PDF, assert `document_images` count ≥ 30 + ≥90% non-empty descriptions on a 4 MB academic fixture. Autonomous: true.

2. **Plan 02 — DOCX completeness (related_parts walk + lxml floating shapes + dedup).** Implement D-072-05/06/07. Replace `extract_docx_images` body with the new walk. Binding test: hand-craft a DOCX with (a) inline image, (b) header logo, (c) floating shape, (d) duplicate logo in footer — assert exactly 3 `document_images` rows (the duplicate dropped via hash dedup), each with the right `description` prefix. Autonomous: true.

3. **Plan 03 — Lazy retry path + live UAT.** Implement `/reextract?retry_empty_descriptions_only=true` (or accept Shape A and document it) per D-072-04. Live UAT on the thesis PDF + a branded DOCX fixture. Re-fill an SC#1 verification table showing ≥80% of visible figures stored (vs SEED-006's documented 2 of 60+). Autonomous: false (live UAT).

Planner can collapse Plan 03 into Plan 02 if the retry path is sufficiently small AND the lazy-retry shape ends up being Shape A (incidental via full /reextract). Recommend keeping the live UAT split out — same lesson from Phase 071 (mixed autonomous + non-autonomous tasks slow the verifier).

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
