---
phase: 26-citations-confidence-backend
plan: "01"
subsystem: backend-retrieval
tags: [retrieval, citations, confidence, sql-migration, tdd]
dependency_graph:
  requires: []
  provides: [chunk_index in enriched results, avg_vector_similarity return value, migration 016]
  affects: [backend/app/services/retrieval_service.py, backend/supabase/migrations/016_citations_chunk_index.sql]
tech_stack:
  added: []
  patterns: [tuple return from search function, _avg_cosine helper, chunk_index passthrough]
key_files:
  created:
    - backend/supabase/migrations/016_citations_chunk_index.sql
  modified:
    - backend/app/services/retrieval_service.py
    - backend/tests/unit/test_retrieval_service.py
decisions:
  - search_documents returns tuple[list[dict], float] — (enriched_results, avg_vector_similarity)
  - _avg_cosine uses only vector_rows in hybrid path — keyword rows have no real cosine similarity
  - chunk_index passed through via row.get("chunk_index") — returns None if RPC does not supply it (backward compat)
  - VECTOR_ONLY_SETTINGS mock in tests patches user_settings to avoid hybrid path in vector-only tests
  - side_effect list on rpc_builder.execute enables two-rpc-call support for hybrid path tests
metrics:
  duration: "2m 12s"
  completed_date: "2026-04-12"
  tasks_completed: 2
  files_modified: 3
---

# Phase 26 Plan 01: SQL Migration + Retrieval Service Changes Summary

**One-liner:** Added chunk_index passthrough and avg_cosine similarity return to search_documents, enabling citation and confidence features in Plan 02.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | SQL migration + retrieval_service changes | 14f103b | 016_citations_chunk_index.sql, retrieval_service.py |
| 2 | Fix pre-existing test failures and add new retrieval tests | 0abff7a | test_retrieval_service.py |

## What Was Built

### Task 1: SQL Migration + Service Changes

Created `backend/supabase/migrations/016_citations_chunk_index.sql` which replaces the `match_document_chunks` RPC, adding `chunk_index integer` to its `RETURNS TABLE`. The full parameter list (including `metadata_filter jsonb` and `p_folder_ids uuid[]` from later migrations) is preserved with `CREATE OR REPLACE FUNCTION`.

Modified `backend/app/services/retrieval_service.py`:
- Added `_avg_cosine(rows: list[dict]) -> float` helper after `_enrich_with_filenames`
- Added `"chunk_index": row.get("chunk_index")` to the entry dict in `_enrich_with_filenames` (between filename and similarity)
- Changed `search_documents` return annotation from `-> list[dict]` to `-> tuple[list[dict], float]`
- Vector-only path: computes `avg_sim = _avg_cosine(rows)` and returns `(_enrich_with_filenames(rows, supabase), avg_sim)`
- Hybrid path empty-result early return changed from `return []` to `return [], 0.0`
- Hybrid path: computes `avg_sim = _avg_cosine(vector_rows)` (vector rows only, not keyword rows) and returns `(_enrich_with_filenames(candidates, supabase), avg_sim)`

### Task 2: Tests (TDD — RED then GREEN)

Rewrote `backend/tests/unit/test_retrieval_service.py` to fix all pre-existing failures and add 5 new Phase 26 tests:

**Pre-existing fixes:**
- `_make_supabase` now uses `side_effect` list on `rpc_builder.execute` to support two rpc calls in hybrid path
- Added `VECTOR_ONLY_SETTINGS` and `HYBRID_SETTINGS` mock objects to control which code path is exercised
- All existing tests updated to unpack `(result, avg_sim)` from `search_documents` return
- Fixed `test_calls_embed_texts_with_query` to pass `user_settings=VECTOR_ONLY_SETTINGS` kwarg
- Added `"id"` field to all `rpc_data` entries (required by `_rrf_fuse` which does `row["id"]`)

**New `TestSearchDocumentsPhase26` tests (5):**
- `test_returns_chunk_index_in_enriched_results` — verifies chunk_index=3 flows through to result[0]
- `test_returns_avg_similarity_as_second_value` — verifies avg of 0.9 and 0.7 is approx 0.8
- `test_returns_zero_avg_sim_when_no_results` — verifies 0.0 returned when vector search is empty
- `test_hybrid_empty_returns_tuple` — verifies hybrid path with no results returns `([], 0.0)`
- `test_chunk_index_none_when_missing` — verifies None returned for rows lacking chunk_index field

**Final result: 13 passed, 0 failures**

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all data flows are real. chunk_index is sourced from the RPC row. The SQL migration is ready to apply to the database; it is not a stub.

## Self-Check: PASSED

- [x] `backend/supabase/migrations/016_citations_chunk_index.sql` exists with `chunk_index integer` in RETURNS TABLE
- [x] `backend/app/services/retrieval_service.py` contains `def _avg_cosine`, `chunk_index` entry, `tuple[list[dict], float]` annotation, correct returns
- [x] `backend/tests/unit/test_retrieval_service.py` contains all 5 new tests, tuple unpacking in all existing tests
- [x] Commit `14f103b` exists (Task 1)
- [x] Commit `0abff7a` exists (Task 2)
- [x] `python -m pytest tests/unit/test_retrieval_service.py` → 13 passed
