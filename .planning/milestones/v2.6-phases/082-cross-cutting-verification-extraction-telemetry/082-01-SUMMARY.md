---
phase: 082-cross-cutting-verification-extraction-telemetry
plan: 01
subsystem: testing
tags: [extraction, telemetry, concurrency, verification, pytest, supabase]

# Dependency graph
requires:
  - phase: 071.3-docling-demotion-table-engine-full-rip
    provides: "Per-aspect extraction dispatcher (camelot/pymupdf_full/zip_xpath)"
  - phase: 072-multimodal-lift-docx-completeness
    provides: "Multimodal lift with vision-LLM refill + DOCX floating images"
  - phase: 073-asyncpg-pool-integration
    provides: "asyncpg hot-path + token forward-fill"
  - phase: 075.4-cross-provider-cleanup
    provides: "CONCUR-01 binding gate preservation through multi-worker lift"
provides:
  - "082-VERIFICATION.md with SC#1, SC#2, SC#4 evidence"
  - "Fresh extraction baseline confirmation (PDF 48t/67i/508c, DOCX 39t/58i/460c)"
  - "Telemetry population proof (pdf_extraction_runs rows)"
affects: [082-02-PLAN, milestone-close]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Supabase REST API with service_role key for telemetry verification"]

key-files:
  created:
    - ".planning/phases/082-cross-cutting-verification-extraction-telemetry/082-VERIFICATION.md"
  modified: []

key-decisions:
  - "PDF document ID updated from stale 551f03f9 to current 517a2827 (document was re-uploaded at some point)"
  - "Used /documents/ route (no /api/ prefix) matching actual FastAPI router mount"
  - "Used Supabase REST API with service_role key for count queries (bypasses RLS for verification accuracy)"

patterns-established:
  - "Content-Range header counting via Supabase REST for row counts without fetching full data"

requirements-completed: [RAG-DOCLING-01, WORKER-LIFT-02, TOKEN-COL-01]

# Metrics
duration: 8min
completed: 2026-05-27
---

# Phase 082 Plan 01: Cross-cutting Verification Summary

**SC#1/SC#2/SC#4 all GREEN: fresh re-extract produces exact baseline counts (48t/67i for PDF, 39t/58i for DOCX), CONCUR-01 pytest passes in 0.32s, pdf_extraction_runs telemetry populated for both documents**

## Performance

- **Duration:** 8 min
- **Started:** 2026-05-27T11:54:57Z
- **Completed:** 2026-05-27T12:03:12Z
- **Tasks:** 1
- **Files modified:** 1 (created)

## Accomplishments

- Fresh re-extraction of thesis PDF and DOCX via /reextract endpoint under full v2.6 stack (multi-worker, DB-backed settings from 081.1) -- both completed successfully
- Extraction counts exactly match D-03 baselines for tables/images (PDF: 48/67, DOCX: 39/58); chunk counts within band at +15.2% (PDF) and +13.9% (DOCX)
- CONCUR-01 binding gate (test_cross_tab_unblocked_during_sse) passes green in 0.32s, confirming run_in_threadpool architecture
- pdf_extraction_runs telemetry rows populated with composable engine descriptors and duration_ms for both documents

## Task Commits

Each task was committed atomically:

1. **Task 1: Run extraction re-extract and CONCUR-01 pytest, collect evidence** - `f4ca82d` (test)

## Files Created/Modified

- `.planning/phases/082-cross-cutting-verification-extraction-telemetry/082-VERIFICATION.md` - Verification report with SC#1, SC#2, SC#4 evidence and pending SC#3/SC#5 placeholders

## Decisions Made

- **PDF document ID correction:** The plan referenced stale ID `551f03f9-b27c-4458-b4be-2cb193e7ab9b` which no longer exists in the database. Discovered the current PDF ID is `517a2827-90be-4d19-b6f9-aa6be36a32b6` via Supabase REST API query filtering by filename. This is expected -- documents get new IDs when re-uploaded.
- **Route path correction:** Plan referenced `/api/documents/...` but the actual FastAPI route is mounted at `/documents/...` (no `/api/` prefix). Corrected during execution.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed stale PDF document ID**
- **Found during:** Task 1 (Step A -- Identify document IDs)
- **Issue:** Plan referenced `551f03f9-b27c-4458-b4be-2cb193e7ab9b` which returns empty from the database. Document was re-uploaded since the ID was recorded.
- **Fix:** Queried `documents` table by filename pattern and discovered current PDF ID `517a2827-90be-4d19-b6f9-aa6be36a32b6`
- **Files modified:** None (verification artifact only)
- **Verification:** Re-extract returned 202 with correct document metadata
- **Committed in:** f4ca82d

**2. [Rule 3 - Blocking] Fixed API route path**
- **Found during:** Task 1 (Step B -- Re-extract documents)
- **Issue:** Plan used `/api/documents/{id}/reextract` but route is mounted at `/documents/{id}/reextract`
- **Fix:** Removed `/api/` prefix from curl calls
- **Files modified:** None (verification artifact only)
- **Verification:** 202 response received for both documents
- **Committed in:** f4ca82d

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes were necessary to execute the verification. No scope creep.

## Issues Encountered

- `completed_at` column in `pdf_extraction_runs` is NULL for all rows (code doesn't populate it). Not a blocker -- telemetry is still valid via `started_at` + `duration_ms`. Documented in VERIFICATION.md.
- DOCX `table_count` in telemetry is 0 despite 39 tables in `document_tables` -- the per-aspect engine telemetry records image-engine output only; table counts come from the camelot aspect which writes directly to `document_tables`. Documented in VERIFICATION.md.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- SC#1, SC#2, SC#4 all GREEN -- automated verification gates passed
- Plan 02 can proceed with SC#3 (user-driven thread-switch stress test via Chrome MCP) and SC#5 (milestone-close audit)

---
*Phase: 082-cross-cutting-verification-extraction-telemetry*
*Completed: 2026-05-27*
