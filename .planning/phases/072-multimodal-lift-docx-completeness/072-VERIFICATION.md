---
phase: 072-multimodal-lift-docx-completeness
verified: 2026-05-17T01:30:00Z
status: gaps_found
score: 5/7 must-haves verified
verifier: orchestrator + operator live UAT (no automated verifier agent — see "Verification approach" below)
---

# Phase 072: Multimodal Lift + DOCX Completeness — Verification Report

**Phase Goal:** Close the multimodal-extraction operational gaps: lift the hardcoded vision-call cap (`_MAX_VISION_CALLS=20`) into operator-controllable `app_settings.multimodal_max_*` keys; persist empty vision-description rows so a cheap retry path exists; close DOCX completeness by adding content-hash dedup and location-prefix labels; ship a `/reextract?retry_empty_descriptions_only=true` endpoint for cheap recovery from vision-LLM outages.

**Verified:** 2026-05-17T01:30:00Z
**Status:** gaps_found

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | The hardcoded `_MAX_VISION_CALLS=20` cap is gone; operators control it via `app_settings.multimodal_max_vision_calls` (default 100). | ✓ VERIFIED | Live UAT — operator's PDF stored 67 images and DOCX stored 58, both well past the old cap of 20. `app_settings.multimodal_max_vision_calls=100` confirmed via SQL. Plan 01 commit `a164002`. |
| 2 | The hardcoded `_MAX_B64_BYTES=512KB` is gone; operators control it via `app_settings.multimodal_max_b64_bytes_kb` (default 4096). | ✓ VERIFIED | Same Plan 01 commit. Confirmed via SQL on `app_settings` row. |
| 3 | A shared `_downscale_b64_for_vision` module-scope helper exists, callable from both the main extraction path and the retry path. | ✓ VERIFIED | `backend/app/services/multimodal_service.py:37` — referenced by both `extract_and_store_images` and Plan 03's `_reextract_refill_empty_descriptions`. |
| 4 | Empty vision-LLM returns persist `description=''` rows instead of dropping the image. | ✓ VERIFIED | Live UAT — under simulated LLM disconnect (override `openai_api_key=''`), `/reextract` on the DOCX produced 58 rows with `description=''` instead of 0 rows. Without this contract Plan 03's retry endpoint would have no rows to refill. |
| 5 | Content-hash dedup applies to BOTH PDF and DOCX image paths. | ✓ VERIFIED | Plan 02 commit `583ef3a` — `_dedup_images_by_hash` helper at `multimodal_service.py:84+`, invoked from `pymupdf_full_images_pdf` and `zip_xpath_docx`. Unit test `test_dedup_images_by_hash_drops_duplicates` covers the collapse. |
| 6 | DOCX images carry `bbox = {"location": header/inline/floating/footer}` annotation + matching `[Image {location}]:` chunk-content prefix. | ✓ VERIFIED | Live UAT — all 58 DOCX rows have `bbox = {"location": "inline"}` in production data. Mixed-location coverage exercised via Plan 02 unit test `test_docx_image_label_prefix_in_chunk_content`. |
| 7 | `POST /reextract?retry_empty_descriptions_only=true` refills empty-description rows without nuking text/tables/non-empty images. | ✗ PARTIAL | Endpoint contract VERIFIED (returns 202, chunks unchanged, no delete-cascade). Refill effectiveness BLOCKED (0/58 on operator's DOCX due to engine mismatch — see Gap 2). |

**Score:** 5/7 truths verified, 1 partial, 0 failed.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/services/multimodal_service.py` | `_downscale_b64_for_vision`, `_dedup_images_by_hash`, app_settings reads | ✓ EXISTS + SUBSTANTIVE | Plans 01 + 02, ~150 LOC |
| `backend/app/services/extractors/aspects/images_pdf.py` | `_dedup_images_by_hash` invocation | ✓ EXISTS + SUBSTANTIVE | Plan 02 |
| `backend/app/services/extractors/aspects/images_docx.py` | `_derive_docx_image_location` + `_dedup_images_by_hash` | ✓ EXISTS + SUBSTANTIVE | Plan 02, ~80 LOC |
| `backend/app/api/documents.py` | `retry_empty_descriptions_only` Query + `_reextract_refill_empty_descriptions` helper | ✓ EXISTS but PARTIAL | Plan 03 + Gap-1 hotfix. Helper present but uses wrong extractors for dispatcher era (Gap 2). |
| `backend/tests/unit/test_multimodal_extraction.py` | Tests for Plans 01 + 02 | ✓ EXISTS + SUBSTANTIVE | 13 tests passing |
| `backend/tests/integration/test_documents.py::TestReextractDocument::test_reextract_retry_empty_descriptions_only_branch` | Plan 03 integration test | ✓ EXISTS but INSUFFICIENT | Test passes, but mocks supabase-py so it never exercised the live PostgREST layer that caught Gap 1, nor the live dispatcher path that exposes Gap 2. |
| `.planning/phases/072-multimodal-lift-docx-completeness/072-HUMAN-UAT.md` | Operator-driven UAT scoreboard | ✓ EXISTS + SUBSTANTIVE | Filled in via orchestrator-driven UAT. |
| `072-01-SUMMARY.md`, `072-02-SUMMARY.md`, `072-03-SUMMARY.md` | One per plan | ✓ ALL THREE EXIST | Plan 03's SUMMARY explicitly marks status=partial. |

**Artifacts:** 8/8 present (Plan 03 helper marked PARTIAL — present but effectiveness blocked).

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `describe_image` | `app_settings.llm_api_key` | direct attribute read | ✓ WIRED | `multimodal_service.py:339`. |
| `extract_and_store_images` | `app_settings.multimodal_max_vision_calls` | direct read in cap-check loop | ✓ WIRED | Plan 01 |
| `pymupdf_full_images_pdf` return | `_dedup_images_by_hash` | lazy import + call | ✓ WIRED | Plan 02 |
| `zip_xpath_docx` return | `_dedup_images_by_hash` + `_derive_docx_image_location` | dataclasses.replace + dedup call | ✓ WIRED | Plan 02 |
| chunk-embedding loop | `bbox.location` → `[Image {location}]:` prefix | `row.get('bbox', {}).get('location')` | ✓ WIRED | Plan 02 |
| `/reextract` route | `_reextract_refill_empty_descriptions` | route-level fork on query param | ✓ WIRED | Plan 03 |
| `_reextract_refill_empty_descriptions` | dispatcher-engine image extractor | **NOT WIRED — uses legacy `extract_pdf_images` / `extract_docx_images`** | ✗ GAP 2 | Helper imports the LEGACY pre-dispatcher functions, not the per-aspect dispatcher. On real documents extracted by `zip_xpath_docx` / `pymupdf_full`, the composite-key match fails because indices don't align across engines. |

**Wiring:** 6/7 connections verified, 1 wrong-target wired.

## Requirements Coverage

| Requirement | Status | Blocking Issue |
|-------------|--------|----------------|
| **RAG-MM-LIFT-01** — PDF figure coverage with operational cap controls + cheap retry | ◐ PARTIAL | Cap-control half VERIFIED (67/67 PDF figures stored, exceeded the old 20 cap). Cheap-retry effectiveness blocked by Gap 2 (endpoint exists but refills 0). |
| **RAG-MM-LIFT-02** — DOCX completeness (floating + header + footer + dedup + location labels) | ✓ SATISFIED | Plan 02 + the pre-existing zip_xpath_docx engine (Phase 071.2 Plan 05). Operator's DOCX stored 58 figures vs the old `inline_shapes`-only path that would have stored 0 (operator's DOCX has NO inline shapes — all 58 are floating/header/footer). |

**Coverage:** 1/2 requirements satisfied, 1 partial.

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `backend/app/api/documents.py` | 778+ (`_reextract_refill_empty_descriptions`) | Hardcoded legacy extractors (`extract_pdf_images`/`extract_docx_images`) instead of dispatcher | 🛑 Blocker | Gap 2 — refill is 0% effective on dispatcher-era documents (i.e., all current production documents). |
| `backend/tests/integration/test_documents.py::test_reextract_retry_empty_descriptions_only_branch` | full test | Mocked supabase-py + mocked extractors — exercises zero real code paths beyond the route's branch-dispatch | ⚠ Warning | Let Gap 1 (PostgREST syntax) AND Gap 2 (engine mismatch) both slip into production. Plan 072.1 must add a non-mocked integration test as part of the Gap 2 fix. |

**Anti-patterns:** 2 found (1 blocker, 1 warning).

## Human Verification Required

None outstanding — the live UAT covered the human-verifiable items:
- Live `/reextract` cycle confirmed (chunks unchanged, delete-cascade skipped)
- Plan 02 bbox.location labels confirmed in production data
- Plan 01 persist-empty contract confirmed under simulated LLM outage

## Gaps Summary

### Critical Gaps (Block Goal Achievement)

1. **Gap 2 — Retry-helper engine dispatch**
   - Missing: `_reextract_refill_empty_descriptions` doesn't use the per-aspect dispatcher. Hardcoded legacy extractors mismatch the configured `extraction_image_engine_*` engines.
   - Impact: 0% refill effectiveness on production documents. The cheap-retry endpoint exists but doesn't actually do its job. RAG-MM-LIFT-01's cheap-retry half is unsatisfied.
   - Fix: read `app_settings.extraction_image_engine_pdf` / `extraction_image_engine_docx`; dispatch to the matching aspect engine via `extract_composable(raw, mime_type, engines={"images": configured})`; convert `ImageData` → dict for the composite-key matcher. Add a live-PostgREST integration test that asserts UPDATE side-effects (no mocks).

### Non-Critical Gaps (Can Defer or Investigate Separately)

2. **Gap 3 — Orphan chunks from `/reextract` → subsequent `/reingest`**
   - Reported in: `.planning/reported-bugs/reextract-orphan-chunks-survive-reingest.md`
   - Issue: After a `/reextract` operation, a subsequent `/reingest` doesn't cascade-delete the prior `/reextract`'s chunks. Operator's DOCX has 864 actual rows vs `documents.chunk_count=402` (462 orphans).
   - Impact: search retrieval returns duplicates. UI shows wrong count. May be a regression of BUG-260516-04 (closed in Phase 071.4 for `/reingest` accumulation) on a new code path, or a new bug entirely.
   - Recommendation: fix in Phase 072.1 alongside Gap 2 — both touch the `/reextract` surface area and benefit from shared integration test infrastructure.

3. **Mixed-location synthetic DOCX UAT** (covered by unit tests instead of live data) — not a gap per se, fine for closure.

## Recommended Fix Plans

### 072.1-01-PLAN.md: Retry-helper dispatcher rewrite + live integration test

**Objective:** Make `_reextract_refill_empty_descriptions` actually refill empty rows by routing through the per-aspect dispatcher.

**Tasks:**
1. Refactor the helper to read `app_settings.extraction_image_engine_pdf` / `extraction_image_engine_docx` and call `extract_composable(raw, mime_type, engines={"images": configured})`. Convert returned `ImageData` to the dict shape expected by the composite-key matcher (or update the matcher to accept `ImageData` directly).
2. Add a non-mocked integration test that: (a) inserts real `document_images` rows with `description=''`, (b) calls the `/reextract?retry_empty_descriptions_only=true` endpoint via the real route, (c) asserts the rows are UPDATEed with non-empty descriptions, (d) asserts `document_chunks` count is unchanged. This is the test Plan 03 should have shipped — exercises live PostgREST + live dispatcher + real UPDATE side-effects.
3. Re-run operator's UAT (DOCX + PDF retry-empty smoke) to confirm refill effectiveness ≥ 90% on dispatcher-era documents.

**Estimated scope:** Small (~50-80 LOC + 1 integration test, ~150 LOC test).

---

### 072.1-02-PLAN.md: Orphan-chunks cleanup on `/reextract` → `/reingest`

**Objective:** Eliminate the 462-orphan-chunk pattern observed during Phase 072 UAT.

**Tasks:**
1. Trace the cascade-delete in `/reingest` to confirm whether it catches chunks created by a prior `/reextract`. If it doesn't, widen the WHERE clause. If it does but a race exists, document the race + add a serialization guard.
2. Audit `documents.chunk_count` to determine whether it should be total-chunk count or text-only count. Either way, make it consistent across `/upload`, `/reingest`, `/reextract`, and Phase 072's image-chunk additions.
3. Add an integration test that exercises the `/reextract → /reingest` sequence on a real document and asserts no orphan chunks remain after the second operation.

**Estimated scope:** Small (~30-50 LOC + 1 integration test).

---

## Verification Metadata

**Verification approach:** Live UAT (operator-driven, orchestrator-recorded) — bypassed the standard verifier agent because Plan 03's checkpoint required hands-on dev-DB work that the verifier agent cannot perform. The standard verifier checks must-haves against codebase patterns; the live UAT additionally caught two runtime bugs (Gap 1, Gap 2) that codebase grep would have missed.

**Must-haves source:** Phase 072 ROADMAP entry + per-plan PLAN.md frontmatter
**Automated checks:** 29 pytests passed (Plan 03 hotfix d29f068 verified)
**Live UAT checks:** 4 sections (PREP, Default-engine, DOCX micro-UAT, Retry-empty smoke), 5 of 7 must-haves cleanly verified
**Bugs caught in-band:** 1 (Gap 1 — fixed live, commit d29f068)
**Bugs deferred to gap closure:** 2 (Gap 2 — Plan 03 effectiveness blocker; Gap 3 — separate orphan-chunks bug surfaced incidentally)

---
*Verified: 2026-05-17T01:30:00Z*
*Verifier: orchestrator (live UAT collaboration with operator fhdmrd@gmail.com)*
