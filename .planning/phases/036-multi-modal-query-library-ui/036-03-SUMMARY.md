---
phase: 036-multi-modal-query-library-ui
plan: "03"
subsystem: api, ui
tags: [fastapi, pydantic, react, counter, document-list, badges]

# Dependency graph
requires:
  - phase: 036-01
    provides: image chunks stored in document_chunks via extract_and_store_images
  - phase: 036-02
    provides: query_tables tool and handle_query_tables service
provides:
  - GET /documents returns table_count and image_count per document
  - DocumentResponse Pydantic model includes table_count/image_count fields
  - Document TypeScript interface includes table_count?/image_count? optional fields
  - DocumentList.tsx renders inline chips showing table/image counts
affects: [document-list, ingestion-ui, frontend-document-display]

# Tech tracking
tech-stack:
  added: []
  patterns: [Python Counter for batch aggregation from join tables, optional badge chips in table cells]

key-files:
  created: []
  modified:
    - backend/app/models/document.py
    - backend/app/api/documents.py
    - backend/tests/integration/test_documents.py
    - backend/tests/unit/test_document_versioning.py
    - frontend/src/types/index.ts
    - frontend/src/components/ingestion/DocumentList.tsx

key-decisions:
  - "Python Counter aggregation via .in_(doc_ids) fetch from document_tables/document_images — no JOIN query, no N+1"
  - "Chips use exact class: rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs per UI-SPEC"
  - "table_count/image_count default to 0 in DocumentResponse — no null handling needed in frontend"
  - "flex-wrap added to filename cell wrapper to prevent chip overflow"

patterns-established:
  - "Batch aggregation pattern: fetch all related rows via .in_(ids), build Counter, merge into response list"
  - "Optional badge chips: render only when count > 0 or !== undefined"

requirements-completed:
  - MODAL-03

# Metrics
duration: ~7min
completed: 2026-04-18
---

# Phase 36-03: Badge Counts Summary

**GET /documents extended with Python Counter aggregation — table_count/image_count surfaced as inline chips in DocumentList filename cell**

## Performance

- **Duration:** ~7 min
- **Completed:** 2026-04-18
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- `DocumentResponse` Pydantic model extended with `table_count: int = 0` and `image_count: int = 0`
- `list_documents` endpoint extended — batch fetches counts from `document_tables`/`document_images` via `Counter` after `.in_(doc_ids)`, merged into response list
- `Document` TypeScript interface updated with `table_count?: number` and `image_count?: number`
- `DocumentList.tsx` renders `'{N} tables'` and `'{N} imgs'` chips in filename cell using exact chip class from UI-SPEC; chips hidden when count is 0 or undefined

## Task Commits

1. **Task 1: Backend model + endpoint** — `b6d6d68` (feat)
2. **Task 2: Frontend interface + chips** — `f13a203` (feat)

## Files Created/Modified
- `backend/app/models/document.py` — `table_count: int = 0` and `image_count: int = 0` on DocumentResponse
- `backend/app/api/documents.py` — Counter-based aggregation of table_count/image_count in list_documents
- `backend/tests/integration/test_documents.py` — Added `test_list_documents_includes_modal_counts`; fixed side_effect mock chain for 4-call sequence
- `backend/tests/unit/test_document_versioning.py` — Fixed `test_list_documents_filters_is_latest` mock chain (side_effect)
- `frontend/src/types/index.ts` — `table_count?: number` and `image_count?: number` on Document interface
- `frontend/src/components/ingestion/DocumentList.tsx` — flex-wrap on filename cell + conditional chips

## Decisions Made
- Used Python `Counter` over a JOIN query — cleaner, testable, avoids complex Supabase query builder gymnastics
- `table_count`/`image_count` default to `0` in Pydantic model — simplifies frontend (no null check needed)
- `flex-wrap` on filename cell wrapper ensures chips don't overflow when document names are long

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Blocking] Fixed 4-call mock chain in existing tests**
- **Found during:** Task 1 (backend extension)
- **Issue:** Adding two new `.in_()` supabase calls to `list_documents` broke existing tests that expected a 2-call mock chain
- **Fix:** Updated `test_returns_200_with_auth`, `test_returns_list`, and `test_list_documents_filters_is_latest` to use `side_effect` lists covering all 4 calls
- **Files modified:** `backend/tests/integration/test_documents.py`, `backend/tests/unit/test_document_versioning.py`
- **Committed in:** b6d6d68 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Required for test correctness after expanding list_documents call count. No scope creep.

## Issues Encountered
- Agent timed out before creating SUMMARY.md — summary written by orchestrator from commit data. All code changes were committed successfully.

## Next Phase Readiness
- Phase 36 all 3 plans complete
- Image search results will now include image descriptions via `document_chunks`
- `query_tables` tool live in General Mode for agent use
- Document list shows table/image counts at a glance

---
*Phase: 036-multi-modal-query-library-ui*
*Completed: 2026-04-18*
