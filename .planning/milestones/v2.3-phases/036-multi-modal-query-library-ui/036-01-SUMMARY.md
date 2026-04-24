---
id: 036-01
phase: 36
plan: 1
title: "Wave 0 tests + image chunk insertion in extract_and_store_images"
subsystem: backend
tags: [multimodal, tdd, embedding, document-chunks]
completed: "2026-04-18"
duration: "166s"

dependency_graph:
  requires:
    - "035-03: extract_and_store_images exists in multimodal_service.py"
    - "035-03: document_images table written by Phase 35 ingestion"
    - "embedding_service.embed_texts: module-level import available"
  provides:
    - "MODAL-03 partial: image descriptions embedded into document_chunks"
    - "test_multimodal_query.py: 6 unit tests (2 GREEN, 4 RED for Plan 02)"
  affects:
    - "search_documents: image chunks now surface automatically via match_document_chunks"

tech_stack:
  patterns:
    - "Module-level embed_texts import for patch-ability in unit tests"
    - "Inner try/except inside outer try/except — embedding failure never breaks image insert"
    - "MAX(chunk_index) query to compute base offset before inserting image chunks"
    - "assert_any_call + call_args_list[0] pattern for multi-table mock assertions"

key_files:
  created:
    - backend/tests/unit/test_multimodal_query.py
  modified:
    - backend/app/services/multimodal_service.py
    - backend/tests/unit/test_multimodal_extraction.py

decisions:
  - "D-01/D-02/D-03 implemented: image chunks inserted after document_images insert using embed_texts with [Image p.N]: / [Image]: prefix format"
  - "Module-level embed_texts import chosen over local function import — required for patch('app.services.multimodal_service.embed_texts') in tests"
  - "Inner try/except ensures embedding failures are logged but do not rollback the already-committed document_images rows"

metrics:
  duration: 166s
  tasks_completed: 2
  files_changed: 3
  commits: 2
---

# Phase 36 Plan 01: Wave 0 tests + image chunk insertion Summary

Image descriptions are now embedded into `document_chunks` during ingestion so `match_document_chunks` surfaces them automatically in `search_documents` — no new RPC or migration required.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Write Wave 0 test scaffold (RED) | 15417b3 | backend/tests/unit/test_multimodal_query.py (+267 lines) |
| 2 | Implement image chunk insertion in extract_and_store_images | aaa5f70 | multimodal_service.py (+65), test_multimodal_extraction.py (fix) |

## What Was Built

**Task 1 — Test scaffold (TDD RED):**
`backend/tests/unit/test_multimodal_query.py` with 6 unit tests:
- `test_image_chunk_insertion` — verifies embed_texts called with `[Image p.2]: <desc>` format and document_chunks insert fires
- `test_image_chunk_skips_empty_description` — verifies embed_texts NOT called when description is empty string
- `test_query_tables_returns_data` — RED, awaits Plan 02 `handle_query_tables`
- `test_query_tables_document_not_found` — RED, awaits Plan 02
- `test_query_tables_column_filter` — RED, awaits Plan 02
- `test_query_tables_row_cap` — RED, awaits Plan 02

**Task 2 — Implementation:**
`extract_and_store_images` extended with a new inner try/except block after the `document_images` insert:
1. Query `MAX(chunk_index)` for the document to compute a collision-free base offset
2. Skip rows where `description.strip()` is falsy (Pitfall 2)
3. Build content strings: `[Image p.N]: <desc>` (PDF) or `[Image]: <desc>` (DOCX, page=None)
4. Call `embed_texts(texts, user_settings=app_settings)` for batch embedding
5. Insert chunk rows into `document_chunks` with `chunk_index = base_idx + i`

Added module-level import: `from app.services.embedding_service import embed_texts`

## Verification Results

```
# Tests 1-2 GREEN:
2 passed (test_image_chunk_insertion, test_image_chunk_skips_empty_description)

# Phase 35 regression tests:
7 passed (test_multimodal_extraction.py — no regressions)
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed test_pdf_images_stored regression in Phase 35 test suite**
- **Found during:** Task 2 verification
- **Issue:** `mock_supabase.table.assert_called_with("document_images")` failed because the new chunk insertion code makes a subsequent `table("document_chunks")` call, making `"document_chunks"` the last call. The insert assertion `mock_builder.insert.call_args[0][0]` also needed updating since the Phase 35 test's single shared builder mock doesn't distinguish tables.
- **Fix:** Changed `assert_called_with` → `assert_any_call`; changed `insert.call_args[0][0]` → `insert.call_args_list[0][0][0]` to target the first (document_images) insert.
- **Files modified:** `backend/tests/unit/test_multimodal_extraction.py`
- **Commit:** aaa5f70

**2. [Rule 2 - Missing] Module-level embed_texts import instead of local import**
- **Found during:** Task 2 implementation
- **Issue:** The plan specified `from app.services.openai_service import embed_texts` as a local import inside the function. However, `embed_texts` is defined in `embedding_service.py` (not `openai_service.py`), and a local import is not patchable via `patch("app.services.multimodal_service.embed_texts", ...)` — which is what the tests require.
- **Fix:** Added `from app.services.embedding_service import embed_texts` as a module-level import. Used it directly without local re-import.
- **Files modified:** `backend/app/services/multimodal_service.py`
- **Commit:** aaa5f70

## Known Stubs

None. Tests 3-6 in `test_multimodal_query.py` are intentionally RED (import `handle_query_tables` which does not yet exist) — this is by design per the plan; they will go GREEN in Plan 02.

## Self-Check: PASSED
