---
phase: 072-multimodal-lift-docx-completeness
plan: 04
subsystem: backend-api
tags: [phase-072, gap-closure, reextract, retry-empty, dispatcher, d-072-04, rag-mm-lift-01, non-mocked-integration]
status: complete

# Dependency graph
requires:
  - phase: 072 Plan 03 (Cheap Retry Endpoint — PARTIAL)
    provides: |
      `POST /documents/{id}/reextract?retry_empty_descriptions_only=true` route + `_reextract_refill_empty_descriptions` helper.
      Plan 03 shipped the endpoint contract (202, no delete-cascade, chunks untouched) but the refill logic was wired to the
      LEGACY pre-dispatcher extractors (`extract_pdf_images` / `extract_docx_images` from `multimodal_service.py`), which
      mismatched the per-aspect dispatcher engines (`pymupdf_full_images_pdf` / `zip_xpath_docx`) that actually populated
      `document_images` rows. On operator's thesis DOCX (58 floating-shape images, 0 inline_shapes), the helper refilled 0/58.
  - phase: 072 Plan 01 (Multimodal Lift — App-Settings Reads + Shared Downscale Helper)
    provides: |
      `_downscale_b64_for_vision` shared helper + persist-empty-rows contract (`description=''` rows materialize on vision
      failure instead of being dropped). Plan 04 reuses both byte-identical.
  - phase: 071.2 Plan 05 (Per-Aspect Dispatcher Composer)
    provides: |
      `extract_composable(raw, mime, engines={"images": ...})` composer — the same dispatcher path the original ingest uses.
      Plan 04 routes the retry helper through this composer so engine choice stays consistent end-to-end.
provides:
  - "Helper `_reextract_refill_empty_descriptions` rewritten to use `extract_composable` with the configured image engine from `app_settings.extraction_image_engine_pdf` / `extraction_image_engine_docx`."
  - "Composite-key matcher updated to consume `ImageData` attribute access (frozen dataclass) instead of dict access."
  - "Existing mocked integration test `test_reextract_retry_empty_descriptions_only_branch` updated to mock `extract_composable` (returns `ExtractedDocument` with `images=(ImageData(...),)`) instead of the legacy `extract_pdf_images`. All 6 Plan 03 contract assertions preserved + 1 new assertion locks the `engines={'images': ...}` hint shape."
  - "NON-mocked integration test `test_retry_refills_floating_shapes_via_real_dispatcher` at `backend/tests/integration/test_reextract_dispatcher.py` — exercises live PostgREST + real supabase-py + real `extract_composable` + real `zip_xpath_docx` engine on a floating-shape DOCX fixture. Mocks ONLY `describe_image` (no vision API in CI)."
  - "Reproducible fixture-build script + 37 KB DOCX fixture with 2 wp:anchor (floating) images — exercises the exact failure mode from operator's UAT (thesis DOCX with floating shapes, 0 inline_shapes)."
affects:
  - "**RAG-MM-LIFT-01** — cheap-retry half now SATISFIED end-to-end. Helper refills empty `document_images` rows produced by the per-aspect dispatcher engines (verified live against local Supabase). PARTIAL → can flip to SATISFIED after gap-closure verifier re-runs against operator's thesis DOCX."
  - "**Phase 072 VERIFICATION.md Gap 2** — closed. Anti-pattern of hardcoded legacy extractors removed; helper now routes through `extract_composable` like the rest of the dispatcher era."
  - "**Test infrastructure quality** — adds the first non-mocked integration test in `backend/tests/integration/`. Pattern (dependency-override swap + skip-on-stub-URL + dynamic test user resolution) can be reused for future tests that need to exercise live PostgREST."

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-aspect dispatcher in the retry path — `extract_composable(raw, mime, engines={'images': configured})` runs ONLY the configured image engine through; text/tables/equations get default routing but their results are discarded. Cheap because the image aspect is the meaningful cost; legacy text/table calls are fast on dispatcher-era engines."
    - "Non-mocked integration test pattern — `app.dependency_overrides[get_supabase] = lambda: real_client` swap with `try/finally` restore. Tested user resolved dynamically from `auth.admin.list_users()` (FK constraints require a real auth.users row). Skip-on-stub-URL guard ensures the test is safe to run in CI without a live Supabase."

key-files:
  created:
    - "`backend/tests/integration/test_reextract_dispatcher.py` — 385-line non-mocked integration test. Asserts retry refills >=2 empty rows, leaves chunks/control-row/chunk_count untouched, inserts no new rows."
    - "`backend/scripts/build_floating_shape_docx_fixture.py` — reproducible fixture builder. Creates DOCX with 2 wp:anchor (floating) images via python-docx + lxml XML surgery."
    - "`backend/tests/fixtures/extraction/floating_shapes.docx` — 37 KB committed fixture (under 50 KB ceiling)."
  modified:
    - "`backend/app/api/documents.py` — `_reextract_refill_empty_descriptions` helper body rewritten: imports `extract_composable` + `ImageData` + `PDF_MIME` + `DOCX_MIME` from `app.services.extraction_service`; reads engine name from `app_settings.extraction_image_engine_pdf/docx`; calls `extract_composable(raw, mime_type, engines={'images': engine})` instead of legacy `extract_pdf_images` / `extract_docx_images`; matcher uses `img.image_index` / `img.page` / `fresh.b64_png` attribute access. Helper signature byte-identical. Cutoff_iso PostgREST filter (Gap 1 hotfix d29f068), threadpool wrapping (D-v2.5-01), shared `_downscale_b64_for_vision` helper (D-072-02), and app_settings injection (BLOCKER 3) all preserved byte-identical."
    - "`backend/tests/integration/test_documents.py` — `test_reextract_retry_empty_descriptions_only_branch` updated. Dropped `extract_pdf_images` mock; reused `mock_compose` (was previously asserted call_count==0, now call_count==1). `return_value` swapped from `list[dict]` to `ExtractedDocument(images=(ImageData(...),)*3)`. New sub-assertion locks the `'images'` key in the engines hint. All 6 Plan 03 contract assertions preserved (composite-key match, downscale call count, describe_image call count, sentinel injection, load_app_settings single-call, ingest NOT scheduled)."

key-decisions:
  - "Engines hint scoped to images-only (`{'images': configured}`) — not a full composer call. Keeps the retry path's purpose explicit (only the image aspect needs re-extraction; text/tables already exist) and avoids wasting cycles re-extracting text/tables that the helper doesn't consume."
  - "Match by `ImageData` attribute access (not dict). The composer returns frozen dataclasses; converting to dicts adds zero value and would lose the type-checker safety net."
  - "Non-mocked integration test resolves the test user_id dynamically from `auth.admin.list_users()` instead of hardcoding. The conftest mock UUID `00000000-0000-0000-0000-000000000001` is NOT seeded into local Supabase's auth.users; the FK constraint on `documents.user_id` would fail. Dynamic resolution is portable across local dev DBs and CI environments."
  - "Skip rules over hard failure — the integration test skips cleanly when `SUPABASE_URL` is the conftest test stub or the real Supabase is unreachable. Local Supabase verified GREEN by running the suite with `.env` loaded; CI / no-DB envs still pass with the test cleanly skipped."

patterns-established:
  - "Retry path dispatcher routing — any helper that re-runs an aspect of extraction MUST use the same engine that originally populated the rows. Direct calls to legacy `extract_pdf_images` / `extract_docx_images` are now an anti-pattern in any dispatcher-era code path."
  - "Non-mocked integration test convention — `pytestmark = pytest.mark.integration` + skip-on-stub-URL + dependency_overrides swap with try/finally restore. Tests register cleanly in the default pytest selection but skip when the prerequisites aren't met."

requirements-completed: [RAG-MM-LIFT-01]

# Metrics
duration: ~30min
completed: 2026-05-17
---

# Phase 072 Plan 04: Retry-Helper Dispatcher Rewrite Summary

**`_reextract_refill_empty_descriptions` now routes image re-extraction through `extract_composable` with the configured engine from `app_settings` — closes Phase 072 VERIFICATION.md Gap 2; ships the missing non-mocked integration test that would have caught both Gap 1 and Gap 2 had it existed before Plan 03 shipped.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-05-17T (Phase 072 Plan 04 wave execution start)
- **Completed:** 2026-05-17
- **Tasks:** 4 (3 with commits + 1 verification-only gate)
- **Files modified/created:** 5 (2 modified + 3 created)

## Accomplishments

- **Gap 2 closed:** Retry helper now dispatches image re-extraction through the per-aspect composer using the configured engine from `app_settings.extraction_image_engine_pdf` / `extraction_image_engine_docx`. Legacy `extract_pdf_images` / `extract_docx_images` imports removed from the helper body.
- **Test infrastructure debt repaid:** Added the first non-mocked integration test in `backend/tests/integration/`. The new test exercises the real route end-to-end (real supabase-py, real PostgREST, real `extract_composable`, real `zip_xpath_docx`) — would have caught both Gap 1 (PostgREST syntax) AND Gap 2 (engine mismatch) had it existed before Plan 03 shipped.
- **Fixture reproducibility:** Reproducible build script + committed 37 KB DOCX fixture with 2 wp:anchor (floating) images. Exercises the exact failure mode from operator's UAT (thesis DOCX with floating shapes that python-docx's `inline_shapes` collection silently skips).
- **Zero regression:** 29 baseline Phase 072 pytests still pass; the existing mocked integration test (`test_reextract_retry_empty_descriptions_only_branch`) updated and still asserts all 6 Plan 03 contracts + 1 new assertion locking the `'images'`-scoped engines hint.

## Task Commits

Each task was committed atomically (worktree mode, `--no-verify`):

1. **Task 1: Replace legacy extractors with `extract_composable` in retry helper** — `79e8a70` (feat)
2. **Task 2: Update existing mocked integration test to mock the dispatcher** — `4b08de0` (test)
3. **Task 3: Add NON-mocked integration test + DOCX fixture** — `706497d` (test)
4. **Task 4: Pre-merge pytest gate (verification-only)** — no commit (30 passed against real local Supabase: `tests/integration/test_documents.py::TestReextractDocument` + `tests/unit/test_multimodal_extraction.py` + `tests/unit/test_aspect_engines_images_pdf.py` + `tests/unit/test_aspect_engines_images_docx.py` + `tests/unit/test_extract_composable.py` + `tests/integration/test_reextract_dispatcher.py`).

## Files Created/Modified

### Created
- `backend/tests/integration/test_reextract_dispatcher.py` (385 lines) — non-mocked integration test. Asserts retry refills >=2 empty rows, leaves chunks + control row + `documents.chunk_count` untouched, no new image rows INSERTed.
- `backend/scripts/build_floating_shape_docx_fixture.py` (76 lines) — reproducible fixture builder.
- `backend/tests/fixtures/extraction/floating_shapes.docx` (37 KB) — committed fixture.

### Modified
- `backend/app/api/documents.py` — helper `_reextract_refill_empty_descriptions` body rewritten (+34 / -22 lines). Signature byte-identical.
- `backend/tests/integration/test_documents.py` — `test_reextract_retry_empty_descriptions_only_branch` updated (+18 / -10 lines).

## Decisions Made

- **Engines-hint scope = images-only:** `extract_composable(raw, mime, engines={"images": configured})` — the composer runs default text/table/equation engines too, but the helper discards those results. The cost is small (default text/table engines are fast on dispatcher-era) and the alternative (introducing a new `extract_images_only` composer entry point) would have widened the patch surface unnecessarily.
- **`ImageData` attribute access throughout:** Composer returns frozen dataclasses; converting back to dicts inside the helper would lose the type-checker safety net for no benefit. The matcher (`fresh_by_loc = {(img.image_index, img.page): img for img in fresh_images}`) and the b64 read (`fresh.b64_png`) both use attribute access cleanly.
- **Dynamic test user resolution:** The conftest mock UUID `00000000-0000-0000-0000-000000000001` is NOT seeded into the local Supabase's `auth.users` table. Inserting a `documents` row with that user_id fails the FK constraint. The test resolves a real user_id at runtime via `supabase.auth.admin.list_users()` and swaps both `get_supabase` AND `get_current_user` dependency overrides so the route's auth dep + the helper's owner SELECT both see the same id. Portable across local dev DBs and CI environments.
- **Skip-on-stub-URL convention:** `SUPABASE_URL == "https://test.supabase.co"` is the conftest test stub. The integration test detects this and skips cleanly rather than failing. CI without a live Supabase still passes with the test in skipped state.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Schema mismatch] `document_images` rows lack `width` / `height` columns**
- **Found during:** Task 3 (first run of the new integration test against real local Supabase)
- **Issue:** The plan's example test code inserted `document_images` rows with `width=200, height=200`. The actual live schema (`supabase/migrations/030_missing_tables.sql:108-116` + `041_document_images_bbox.sql`) has columns `id, document_id, user_id, page, image_index, description, created_at, bbox` — no `width`/`height` fields. Insert failed with `PGRST204 Could not find the 'height' column of 'document_images' in the schema cache`.
- **Fix:** Dropped the `width` / `height` fields from the test's insert payload. Schema is unchanged; the columns were never required for the retry path (the helper matches on `(image_index, page)` composite key only).
- **Files modified:** `backend/tests/integration/test_reextract_dispatcher.py`
- **Verification:** Test passes 1/1 against real local Supabase post-fix.
- **Committed in:** `706497d` (Task 3 commit)

**2. [Rule 3 — Blocking] Auth FK constraint on `documents.user_id`**
- **Found during:** Task 3 (test design phase)
- **Issue:** The plan's skeleton used the conftest mock UUID `00000000-0000-0000-0000-000000000001` for the test user_id. The `documents.user_id` column has a FK constraint `REFERENCES auth.users(id) ON DELETE CASCADE`. Local Supabase's `auth.users` table does NOT contain that UUID; insert would fail with FK violation.
- **Fix:** Added a `_resolve_test_user_id` helper that queries `supabase.auth.admin.list_users()`, prefers the conftest mock UUID if present, falls back to the first real user, and skips cleanly if no users exist. Also override `get_current_user` for the test so the route's auth dep returns the same resolved id (otherwise the route's `eq("user_id", current_user["id"])` would mismatch).
- **Files modified:** `backend/tests/integration/test_reextract_dispatcher.py`
- **Verification:** Test passes 1/1 against real local Supabase post-fix; cleanly skips when no users exist.
- **Committed in:** `706497d` (Task 3 commit)

**3. [Rule 1 — Plan-stated import path mismatch] Plan referenced `app.services.extractors.extraction_service` but the actual module path is `app.services.extraction_service`**
- **Found during:** Task 1 (planning the import rewrite)
- **Issue:** The plan's `<context>` block referenced `backend/app/services/extractors/extraction_service.py`. The actual location is `backend/app/services/extraction_service.py` (the `extractors/` subdirectory contains `aspects/` only). The plan's `<interfaces>` block uses the correct import path `app.services.extraction_service` — only the file-path reference was off.
- **Fix:** Used the correct import path `app.services.extraction_service` per the plan's `<interfaces>` block (and verified by reading the actual source). No code change needed beyond what the plan already specified.
- **Files modified:** none beyond planned
- **Verification:** Import `from app.api.documents import _reextract_refill_empty_descriptions` succeeds (Task 1 verify gate).
- **Committed in:** `79e8a70` (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (1 Rule 1 schema, 1 Rule 3 blocking, 1 Rule 1 plan-doc inconsistency).
**Impact on plan:** All three were minor and required to get the non-mocked integration test working against the real live schema; none changed the helper's behavior or the test's contract. No scope creep.

## Issues Encountered

- **Worktree base reset required at startup:** The worktree was created from commit `9ee96ad` (pre-Plan-03), but the prompt context expected commit `9aa4f71` (post-Plan-03 + post-gap-closure-planning). Hard-resetted to the expected base per the `worktree_branch_check` block. No work lost (fresh worktree, no user changes).
- **Read tool cache divergence after hard reset:** The `Read` tool's cached file state did NOT refresh after the `git reset --hard` of the worktree, causing the `Edit` tool to "succeed" silently against a stale snapshot while the actual disk file remained unchanged. Worked around by switching to one-shot Python patch scripts (`pathlib.Path.read_text` / `.write_text`) for all subsequent edits, with `bash sed` verification that the disk content matched expectations. This affected execution mechanics only; the final commits are correct.

## User Setup Required

None — no external service configuration required. The non-mocked integration test runs against the existing local Supabase (when `.env` is loaded) and cleanly skips otherwise.

## Next Phase Readiness

- **RAG-MM-LIFT-01 verifier re-run is unblocked.** Phase 072 VERIFICATION.md can flip the requirement from PARTIAL → SATISFIED once the gap-closure verifier (orchestrator) re-runs operator's UAT scenario (`/reextract?retry_empty_descriptions_only=true` on the thesis DOCX with all-empty descriptions) and observes >=90% refill. The fix is structurally proved end-to-end by the new non-mocked integration test; operator UAT is the production-evidence layer.
- **Phase 072.1 Gap 3 (orphan chunks) untouched — covered by Plan 05** in the same gap-closure wave. No dependency between Plans 04 and 05 (different code paths inside `/reextract`).

---
*Phase: 072-multimodal-lift-docx-completeness*
*Plan: 04*
*Completed: 2026-05-17*

## Self-Check: PASSED

All claimed files exist on disk and all claimed commits are present in `git log`:

- `backend/tests/integration/test_reextract_dispatcher.py` — FOUND
- `backend/scripts/build_floating_shape_docx_fixture.py` — FOUND
- `backend/tests/fixtures/extraction/floating_shapes.docx` — FOUND
- `.planning/phases/072-multimodal-lift-docx-completeness/072-04-SUMMARY.md` — FOUND
- `backend/app/api/documents.py` — FOUND (modified, helper rewritten)
- `backend/tests/integration/test_documents.py` — FOUND (modified, mock swap)
- Commit `79e8a70` (feat Task 1) — FOUND
- Commit `4b08de0` (test Task 2) — FOUND
- Commit `706497d` (test Task 3 + fixture) — FOUND
