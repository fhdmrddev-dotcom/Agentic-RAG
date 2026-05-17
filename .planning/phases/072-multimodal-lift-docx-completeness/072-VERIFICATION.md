---
phase: 072-multimodal-lift-docx-completeness
verified: 2026-05-17T03:30:00Z
status: human_needed
score: 7/7 must-haves verified (structural); 1 of 2 operator UAT items still pending
verifier: gsd-verifier (re-verification after Plans 04 + 05 merged)
re_verification:
  previous_status: gaps_found
  previous_score: 5/7
  gaps_closed:
    - "Truth 7 PARTIAL — retry helper now dispatches via `extract_composable` with the configured engine (Plan 04 commits 79e8a70 / 4b08de0 / 706497d)"
    - "Gap 2 — `_reextract_refill_empty_descriptions` rewritten to use the per-aspect dispatcher; legacy `extract_pdf_images` / `extract_docx_images` imports removed"
    - "Gap 3 — `/reingest` now cascade-deletes `document_chunks` + `document_tables` + `document_images` before queueing the BackgroundTask (Plan 05 commits 825adde / e5a41bd / 1b39d45 / aee4649); BUG-260517-01 marked status: closed with folded_into: 072.1"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Re-run Phase 072 retry-empty smoke on operator's thesis DOCX (3bf355d6-d4e1-416b-b067-9a63dd821945)"
    expected: "After /reextract under simulated LLM disconnect (`openai_api_key=''` override) produces 58 rows with `description=''`, restoring the key and POSTing /reextract?retry_empty_descriptions_only=true refills ≥90% of the 58 empties (target: 52+ of 58 non-empty post-retry). Chunks count is unchanged across the retry call. This is the production-data evidence that the Plan 04 dispatcher rewrite actually works on the same DOCX that exposed Gap 2."
    why_human: "Requires the live thesis DOCX in operator's dev DB + manual settings_override.json toggling + before/after SQL snapshots. Cannot be automated programmatically. The structural fix is proved by the new non-mocked integration test on the floating_shapes.docx fixture; this UAT confirms the same fix works on the operator's real data that originally exposed the gap."
  - test: "Re-run /reextract → /reingest sequence on operator's thesis DOCX to confirm orphan-free invariant"
    expected: "After a fresh /reextract followed by a /reingest, `SELECT count(*) FROM document_chunks WHERE document_id='3bf355d6-...'` equals `documents.chunk_count` (text-only) plus the image-description chunk count for that document. No multi-batch orphan accumulation (the 462-orphan pattern from the 2026-05-16 UAT must not recur). Operator's existing DOCX still has the prior orphans — fix is forward-only — so cleanup or a fresh /reingest after this verification is expected. Note: per Plan 05 SUMMARY, the operator's existing thesis DOCX (with 462 orphans from 2026-05-16) is NOT auto-cleaned — a /reingest on the post-fix code will correctly delete + re-insert."
    why_human: "Same constraints — needs the operator's live thesis DOCX + post-call SQL snapshots. The non-mocked integration test on the floating_shapes.docx fixture proves the cascade fires structurally; this UAT confirms it on the document that originally exhibited BUG-260517-01."
---

# Phase 072: Multimodal Lift + DOCX Completeness — Verification Report (Re-verification)

**Phase Goal:** Close the multimodal-extraction operational gaps: lift the hardcoded `_MAX_VISION_CALLS=20` cap into operator-controllable `app_settings.multimodal_max_*` keys; persist empty vision-description rows so a cheap retry path exists; close DOCX completeness via content-hash dedup + location-prefix labels; ship `/reextract?retry_empty_descriptions_only=true` for cheap recovery. **Post-gap-closure (Plans 04 + 05):** retry helper now routes through the per-aspect dispatcher; `/reingest` cascade-deletes chunks alongside tables + images.

**Verified:** 2026-05-17T03:30:00Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure (Plans 04 + 05 merged 9760744 + 621dcbc)

## Re-verification Delta

| Item | Previous (5/7) | Current |
|------|----------------|---------|
| Truth 1 (vision-call cap from app_settings) | VERIFIED | VERIFIED (regression-check) |
| Truth 2 (b64-size cap from app_settings) | VERIFIED | VERIFIED (regression-check) |
| Truth 3 (shared `_downscale_b64_for_vision`) | VERIFIED | VERIFIED (regression-check) |
| Truth 4 (persist empty rows) | VERIFIED | VERIFIED (regression-check) |
| Truth 5 (content-hash dedup PDF + DOCX) | VERIFIED | VERIFIED (regression-check) |
| Truth 6 (DOCX bbox.location prefix) | VERIFIED | VERIFIED (regression-check) |
| **Truth 7 (retry endpoint refill effectiveness)** | **PARTIAL** | **VERIFIED (structurally) — operator UAT pending** |
| **Truth 8 NEW (orphan-free `/reextract → /reingest`)** | n/a (Gap 3 deferred) | **VERIFIED (structurally) — operator UAT pending** |

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Hardcoded `_MAX_VISION_CALLS=20` gone; operators control via `app_settings.multimodal_max_vision_calls` (default 100). | VERIFIED | `multimodal_service.py:421` reads `app_settings.multimodal_max_vision_calls`; constants `_MAX_VISION_CALLS` + `_MAX_B64_BYTES` deleted. Live UAT (072-HUMAN-UAT.md): operator's PDF stored 67/67 + DOCX stored 58/58 — both past old cap of 20. |
| 2 | Hardcoded `_MAX_B64_BYTES=512KB` gone; operators control via `app_settings.multimodal_max_b64_bytes_kb` (default 4096). | VERIFIED | `multimodal_service.py:426` reads `app_settings.multimodal_max_b64_bytes_kb * 1024`. |
| 3 | Shared `_downscale_b64_for_vision` module-scope helper exists, callable from main path + retry path. | VERIFIED | `multimodal_service.py:37` defines helper; `extract_and_store_images` invokes at line 434; retry helper invokes at `documents.py:918`. |
| 4 | Empty vision-LLM returns persist `description=''` rows instead of dropping the image. | VERIFIED | Live UAT confirmed under simulated LLM disconnect: 58 rows with `description=''` materialized for refill. |
| 5 | Content-hash dedup applies to BOTH PDF and DOCX image paths. | VERIFIED | `multimodal_service.py:88` defines `_dedup_images_by_hash`; `images_pdf.py:128` + `images_docx.py:123, 232` invoke it. Unit test `test_dedup_images_by_hash_drops_duplicates` covers the collapse. |
| 6 | DOCX images carry `bbox = {"location": ...}` annotation + matching `[Image {location}]:` chunk-content prefix. | VERIFIED | `images_docx.py:_derive_docx_image_location` + `dataclasses.replace(im, bbox={...})` at lines 203-228. Live UAT: 58 rows with `bbox = {"location": "inline"}`. Mixed-location coverage exercised via unit test `test_docx_image_label_prefix_in_chunk_content`. |
| 7 | `POST /reextract?retry_empty_descriptions_only=true` refills empty-description rows on dispatcher-era documents. | VERIFIED (structurally) | Plan 04 closure: `_reextract_refill_empty_descriptions` rewritten to call `extract_composable(raw, mime_type, engines={"images": app_settings.extraction_image_engine_*})` (`documents.py:859-864`). Legacy `extract_pdf_images` / `extract_docx_images` imports removed (only in docstring/comments now). Non-mocked integration test `test_retry_refills_floating_shapes_via_real_dispatcher` exercises live PostgREST + real `zip_xpath_docx` engine on floating-shape DOCX fixture and asserts ≥2 empties refilled. **Operator UAT on thesis DOCX still pending** — see human_verification section. |
| 8 | `/reextract → /reingest` sequence on the same document leaves no orphan chunks (BUG-260517-01 / Gap 3). | VERIFIED (structurally) | Plan 05 closure: `reingest_document` cascade widened from 2 deletes (tables + images) to 3 (chunks + tables + images) at `documents.py:699-707`, mirroring `/reextract`'s pattern at lines 1078-1084. `chunk_count = len(chunks)` site at `documents.py:1464` gained a 7-line TEXT-CHUNKS-ONLY semantics comment block. Non-mocked integration test `test_reextract_then_reingest_leaves_no_orphan_chunks` exercises live `/reextract → /reingest → /reingest` sequence asserting orphan-free + idempotency. **Operator UAT on thesis DOCX still pending** — see human_verification section. |

**Score:** 7/7 truths structurally verified (was 5/7); 2 operator UAT items pending on the operator's thesis DOCX.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/services/multimodal_service.py` | `_downscale_b64_for_vision`, `_dedup_images_by_hash`, app_settings reads | VERIFIED | Plans 01 + 02 work intact post-merge. |
| `backend/app/services/extractors/aspects/images_pdf.py` | `_dedup_images_by_hash` invocation | VERIFIED | Plan 02. |
| `backend/app/services/extractors/aspects/images_docx.py` | `_derive_docx_image_location` + `_dedup_images_by_hash` | VERIFIED | Plan 02. |
| `backend/app/api/documents.py` (retry helper) | `retry_empty_descriptions_only` Query + `_reextract_refill_empty_descriptions` helper using `extract_composable` | VERIFIED | Plan 03 endpoint + Plan 04 dispatcher rewrite. Helper now reads `app_settings.extraction_image_engine_pdf/docx`, calls `extract_composable(raw, mime, {"images": engine})`. Cutoff_iso (Gap 1 hotfix d29f068), threadpool wrapping, downscale helper, app_settings injection all preserved byte-identical. |
| `backend/app/api/documents.py` (/reingest cascade) | 3-table cascade: chunks + tables + images delete before BackgroundTask | VERIFIED | Plan 05. 3 `delete().eq("document_id", ...)` calls at lines 700, 703, 706 in `reingest_document` mirror the `/reextract` cascade at lines 1078, 1081, 1084. |
| `backend/tests/unit/test_multimodal_extraction.py` | Tests for Plans 01 + 02 | VERIFIED | 13 unit tests pass. |
| `backend/tests/integration/test_documents.py::TestReextractDocument::test_reextract_retry_empty_descriptions_only_branch` | Plan 03 integration test | VERIFIED (updated) | Plan 04 swapped mock from `extract_pdf_images` to `extract_composable` returning `ExtractedDocument(images=(ImageData(...),)*3)`. All 6 Plan 03 contract assertions preserved + new assertion locking `{'images': ...}` engines hint. |
| `backend/tests/integration/test_reextract_dispatcher.py` | NON-mocked integration test for retry helper | NEW (Plan 04) | 385 lines. Mocks ONLY `describe_image`. Skips cleanly on offline Supabase. Per executor's worktree, passes 1/1 in 8.54s against local Supabase. |
| `backend/tests/integration/test_reingest_reextract_orphans.py` | NON-mocked integration test for orphan-free invariant | NEW (Plan 05) | 428 lines. Mocks `embed_chunks` + `embed_texts` + `describe_image`. Skips cleanly on offline Supabase. Per executor's worktree, passes 1/1. |
| `backend/tests/fixtures/extraction/floating_shapes.docx` | DOCX fixture with floating shapes | NEW (Plan 04) | 37 KB committed. Verified live: `zip_xpath_docx(raw)` returns 2 ImageData with `bbox={'location': 'floating'}`. |
| `backend/scripts/build_floating_shape_docx_fixture.py` | Reproducible fixture builder | NEW (Plan 04) | 76 lines. |
| `.planning/phases/072-multimodal-lift-docx-completeness/072-HUMAN-UAT.md` | Operator-driven UAT scoreboard | VERIFIED | Filled in via orchestrator-driven UAT for Plans 01-03; Plans 04-05 add structural confidence via non-mocked tests but operator re-run on thesis DOCX is the production-data closure. |
| `072-01-SUMMARY.md` through `072-05-SUMMARY.md` | One per plan | VERIFIED | All 5 present. |
| `.planning/reported-bugs/reextract-orphan-chunks-survive-reingest.md` | BUG-260517-01 closure | VERIFIED | Frontmatter: `status: closed`, `folded_into: 072.1`, non-null `re_open_trigger`. Resolution section appended. |

**Artifacts:** 13/13 present and substantive (was 8/8; +5 from gap closure).

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `describe_image` | `app_settings.llm_api_key` | direct attribute read | WIRED | Plan 01 / `multimodal_service.py`. |
| `extract_and_store_images` | `app_settings.multimodal_max_vision_calls` | direct read in cap-check loop | WIRED | Plan 01 / `multimodal_service.py:421`. |
| `pymupdf_full_images_pdf` return | `_dedup_images_by_hash` | lazy import + call | WIRED | Plan 02 / `images_pdf.py:128`. |
| `zip_xpath_docx` return | `_dedup_images_by_hash` + `_derive_docx_image_location` | dataclasses.replace + dedup call | WIRED | Plan 02 / `images_docx.py:123, 232`. |
| chunk-embedding loop | `bbox.location` → `[Image {location}]:` prefix | `row.get('bbox', {}).get('location')` | WIRED | Plan 02. |
| `/reextract` route | `_reextract_refill_empty_descriptions` | route-level fork on query param | WIRED | Plan 03. |
| `_reextract_refill_empty_descriptions` | per-aspect dispatcher engine | `extract_composable(raw, mime, engines={"images": app_settings.extraction_image_engine_*})` | WIRED (PREVIOUSLY NOT WIRED) | **Plan 04 closes Gap 2.** `documents.py:859-864`. Legacy `extract_pdf_images` / `extract_docx_images` imports removed from helper. |
| `reingest_document` | `document_chunks` cascade-delete | `await run_in_threadpool(lambda: supabase.table("document_chunks").delete().eq("document_id", document_id).execute())` | WIRED (PREVIOUSLY NOT WIRED) | **Plan 05 closes Gap 3.** `documents.py:700`. Cascade order: chunks → tables → images (children-before-parent per D-071-10), mirrors `/reextract`'s pattern at lines 1078-1084. |
| `ingest_document.chunk_count` write site | TEXT-CHUNKS-ONLY semantics doc | inline 7-line comment block | WIRED | Plan 05 / `documents.py:1456-1463`. |

**Wiring:** 9/9 connections verified (was 6/7 + 1 wrong-target; +2 new gap-closure links, both correctly wired).

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `_reextract_refill_empty_descriptions` and `reingest_document` import cleanly | `python -c "from app.api.documents import _reextract_refill_empty_descriptions, reingest_document"` | imports-ok | PASS |
| Fixture exercises `zip_xpath_docx` floating-shape path | `python -c "from app.services.extractors.aspects.images_docx import zip_xpath_docx; raw=open('tests/fixtures/extraction/floating_shapes.docx','rb').read(); print(len(zip_xpath_docx(raw)))"` | `Found 2 images via zip_xpath_docx` + both `bbox={'location': 'floating'}` | PASS |
| Combined gap-closure pytest gate (Phase 072 baseline + Plans 04 + 05) | `pytest tests/integration/test_documents.py::TestReextractDocument tests/integration/test_documents.py::TestReingestDocument tests/unit/test_multimodal_extraction.py tests/unit/test_aspect_engines_images_pdf.py tests/unit/test_aspect_engines_images_docx.py tests/unit/test_extract_composable.py tests/integration/test_reextract_dispatcher.py tests/integration/test_reingest_reextract_orphans.py -q` | **31 passed, 2 skipped** (live-Supabase tests skip cleanly when SUPABASE_URL is the conftest stub; per context, both passed in executor's worktree with `.env` loaded) | PASS |
| Legacy extractor imports removed from retry helper | grep `extract_pdf_images\|extract_docx_images` in `backend/app/api/documents.py` | Only present in docstring/comments — no live import in helper | PASS |
| 3-table cascade in `/reingest` matches `/reextract` | grep `delete().eq("document_id"` in `backend/app/api/documents.py` | 6 matches (3 in `/reingest` lines 700/703/706; 3 in `/reextract` lines 1078/1081/1084) | PASS |
| TEXT-CHUNKS-ONLY semantics documented at `chunk_count` write site | grep `TEXT-chunks-only` in `backend/app/api/documents.py` | 1 match at line 1456, immediately above `"chunk_count": len(chunks)` | PASS |
| BUG-260517-01 frontmatter closed + folded_into 072.1 | read `.planning/reported-bugs/reextract-orphan-chunks-survive-reingest.md` frontmatter | `status: closed`, `folded_into: 072.1`, non-null `re_open_trigger` | PASS |

## Requirements Coverage

| Requirement | Source Plans | Status | Evidence |
|-------------|------------|--------|----------|
| **RAG-MM-LIFT-01** — PDF figure coverage with operational cap controls + cheap retry | 072-01, 072-03, 072-04, 072-05 | SATISFIED (structurally) — operator UAT confirmation pending | Cap-control half: VERIFIED (67/67 PDF figures stored, 58/58 DOCX past the old 20 cap — live UAT). Persist-empty half: VERIFIED (live UAT under simulated LLM disconnect produced 58 empty rows). Cheap-retry half: VERIFIED structurally (Plan 04 dispatcher rewrite + non-mocked integration test). Orphan-free pathway: VERIFIED structurally (Plan 05 cascade widening + non-mocked integration test). The two pending operator UAT items confirm the structural fix on the operator's real thesis DOCX (the same data that originally exposed Gap 2 + BUG-260517-01). |
| **RAG-MM-LIFT-02** — DOCX completeness (floating + header + footer + dedup + location labels) | 072-02 | SATISFIED | Plan 02 + pre-existing `zip_xpath_docx` (Phase 071.2 Plan 05). Operator's DOCX stored 58 figures (vs old inline_shapes-only path that would have stored 0). |

**Coverage:** 1/2 SATISFIED outright (RAG-MM-LIFT-02); 1/2 SATISFIED structurally with operator UAT pending (RAG-MM-LIFT-01). REQUIREMENTS.md currently shows RAG-MM-LIFT-01 as `Pending` — this can flip to `Complete` after operator UAT confirms refill effectiveness and orphan-free behavior on the thesis DOCX.

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `backend/tests/integration/test_reingest_reextract_orphans.py` | 316-318 | Patches `app.services.openai_service.embed_texts` but `multimodal_service` imports from `app.services.embedding_service` (which re-exports from `openai_service`) — the patch is ineffective on the import path actually used | Warning | Per 072-REVIEW WR-01: the patch does not replace the binding `multimodal_service.embed_texts` actually called at `multimodal_service.py:496`. When the orphan test runs `/reingest → _upload_pipeline → ingest_document → extract_and_store_images`, the image-description embedding call hits the real OpenAI API. Test still proves the orphan-free invariant (chunk count is orthogonal to embeddings) but is fragile/expensive. Fix: add `patch("app.services.multimodal_service.embed_texts", ...)` and/or `patch("app.services.embedding_service.embed_texts", ...)`. **This is a test-fragility issue, not a production-code correctness gap** — Plan 05 cascade fix is unaffected. Not blocking phase closure. |
| `backend/tests/integration/test_reingest_reextract_orphans.py` | 58 | Status-poll timeout (90s) below production wall-clock fail-safe (130s) | Info | Per 072-REVIEW WR-02. On slow CI box or larger fixtures, test can fail before BackgroundTask legitimately finishes. Bump to 150s when adding a follow-up tightening commit. |
| `backend/tests/integration/test_reingest_reextract_orphans.py` | 394-400 | "No-accumulation" assertion has +10 slack — on the tiny floating_shapes.docx fixture (1-3 text chunks) this could swallow up to ~11 orphan chunks | Info | Per 072-REVIEW WR-03. The primary `chunk_count == text_chunks` assertion is much stronger and would catch the bug; this softer guard mostly adds noise. Defense-in-depth only. |

**Anti-patterns:** 1 warning (test fragility — WR-01 — recommended follow-up tightening), 2 info (WR-02 + WR-03 polish items). Zero critical; zero blockers; zero anti-patterns in production code from Plans 04 + 05.

## Human Verification Required

Two operator UAT items needed before flipping REQUIREMENTS.md RAG-MM-LIFT-01 from `Pending` to `Complete`. Both target the operator's thesis DOCX (`3bf355d6-d4e1-416b-b067-9a63dd821945`) — the same data that originally exposed Gap 2 + BUG-260517-01.

### 1. Re-run retry-empty smoke on operator's thesis DOCX

**Test:**
1. Snapshot pre-test (DOCX `3bf355d6-d4e1-416b-b067-9a63dd821945`): `SELECT count(*) FROM document_images WHERE document_id='3bf355d6-...' GROUP BY (description='')` → expect current state has some `description != ''` rows.
2. Inject `"openai_api_key": ""` into `backend/settings_override.json`, wait 6s for cache TTL.
3. `POST /documents/{id}/reextract` body `{"engine":"pymupdf"}` → expect 202 + status pending→completed.
4. Snapshot post-disconnect: expect `total=58, empty=58, with_desc=0`.
5. Pop `openai_api_key` from override, wait 6s.
6. `POST /documents/{id}/reextract?retry_empty_descriptions_only=true` body `{"engine":"pymupdf"}` → expect 202.
7. Snapshot post-retry.

**Expected:** Post-retry, `with_desc ≥ 52` (≥90% of 58 refilled). Chunks count unchanged across step 6. **This is the production-data confirmation that Plan 04's dispatcher rewrite works on the same DOCX that exhibited 0/58 refill before the fix.**

**Why human:** Requires live operator dev DB + manual `settings_override.json` toggling + before/after SQL snapshots. The non-mocked integration test (`test_retry_refills_floating_shapes_via_real_dispatcher`) proves the dispatcher path works on a synthetic floating-shape fixture; this UAT confirms it on the real thesis DOCX.

### 2. Re-run `/reextract → /reingest` sequence on operator's thesis DOCX to confirm orphan-free invariant

**Test:**
1. (Optional pre-cleanup if operator wants a clean baseline) Run the manual SQL from BUG-260517-01's "Workarounds" section to delete the 462 known orphans; OR skip this step and just observe that a fresh `/reingest` post-fix correctly delete+re-inserts.
2. Snapshot: `SELECT count(*) FROM document_chunks WHERE document_id='3bf355d6-...'` and `SELECT chunk_count FROM documents WHERE id='3bf355d6-...'`.
3. `POST /documents/{id}/reextract` body `{"engine":"pymupdf"}` → wait for completed.
4. Snapshot A: count chunks + read `chunk_count`.
5. `POST /documents/{id}/reingest` → wait for completed.
6. Snapshot B: count chunks + read `chunk_count`.

**Expected:**
- Snapshot B `count(*)` equals (text chunks from step 5) + (image-description chunks from step 5). No batch accumulation from step 3.
- `documents.chunk_count` (Snapshot B) equals count of rows in `document_chunks` whose `content` does NOT start with `[Image` (text-only semantics confirmed).
- Per Plan 05 SUMMARY note: the operator's existing orphans from 2026-05-16 are NOT auto-cleaned by the fix (forward-only) — a `/reingest` on the post-fix code is the production-data path to clean them.

**Why human:** Same constraints — needs live thesis DOCX + post-call SQL snapshots. The non-mocked integration test (`test_reextract_then_reingest_leaves_no_orphan_chunks`) proves the cascade fires structurally on a synthetic fixture; this UAT confirms BUG-260517-01 is killed on the document that originally exhibited it.

## Gaps Summary

**No structural gaps remaining.** Both Gap 2 (retry-helper dispatcher) and Gap 3 (orphan chunks / BUG-260517-01) from the prior `gaps_found` verification are now closed at the code level and locked behind non-mocked integration tests.

**One follow-up tightening candidate (non-blocking):**
- WR-01 from 072-REVIEW.md — `test_reingest_reextract_orphans.py` patches `embed_texts` at the wrong import path; the orphan-free assertion still holds (chunk count is orthogonal to embeddings) but the test likely hits the real OpenAI API during its live run. Recommendation: add `patch("app.services.multimodal_service.embed_texts", ...)` in a follow-up commit. Does NOT block phase closure.

**Two operator UAT items still pending** (see human_verification section above) — these are the production-data confirmations on the operator's thesis DOCX. The structural fix is locked behind non-mocked integration tests; UAT is the production-evidence layer.

## Verification Metadata

**Verification approach:** Re-verification after gap-closure plans 04 + 05 merged. Confirmed all 7 previously-verified truths still hold (regression check). Verified the 2 new structural truths (Plan 04 dispatcher rewrite, Plan 05 cascade widening) via code reading + non-mocked integration test fixture exercise + combined pytest gate. Surfaced 2 operator UAT items to confirm structural fixes on the operator's real thesis DOCX (the data that originally exposed both gaps).

**Must-haves source:** PLAN frontmatter from 072-01 through 072-05 + ROADMAP Phase 072 Success Criteria.

**Automated checks:**
- 31 pytests passed, 2 skipped in 2.11s (scoped gap-closure gate: TestReextractDocument + TestReingestDocument + unit multimodal/aspect/composable + new dispatcher + new orphan tests). The 2 skips are the live-Supabase integration tests — they skip cleanly when SUPABASE_URL is the conftest stub; per context, both passed in the executor's worktree with `.env` loaded.
- Helper imports import cleanly.
- Fixture `floating_shapes.docx` triggers the floating-shape path (2 images with `bbox={'location':'floating'}`).
- Grep checks confirm legacy extractors removed from helper, 3-table cascade present in both `/reingest` and `/reextract`, TEXT-CHUNKS-ONLY semantics comment present, BUG-260517-01 closed.

**Bugs caught in this re-verification:** 0. Prior `gaps_found` verification surfaced Gap 1 (in-band hotfix), Gap 2, Gap 3 — all three are now closed by Plans 04 + 05 + the earlier d29f068 hotfix.

**Broader regression suite:** Per context, 6 pre-existing failures unrelated to Phase 072 surface area (test_threads.py SSE refactor leftovers, test_059/061 streaming SSE, test_documents.py::TestFullMarkdown::test_ingest_stores_full_markdown, upload+folder mock pair predating Phase 071.2 user_id ownership check). None touch the documents.py upload/reextract/reingest paths Phase 072 modified.

**Schema drift:** clean (0 issues, 5 checked, per context).

---

*Verified: 2026-05-17T03:30:00Z*
*Verifier: gsd-verifier (re-verification after Plans 04 + 05 — Gap 2 + Gap 3 closure)*
