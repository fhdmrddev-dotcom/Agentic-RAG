---
id: 036-02
phase: 36
plan: 2
title: "QUERY_TABLES_TOOL constant, handle_query_tables service, tool dispatch + system prompt"
subsystem: backend
tags: [multimodal, query-tables, tool-dispatch, tdd]
completed: "2026-04-18"
duration: 282s

dependency_graph:
  requires:
    - "036-01: test_multimodal_query.py exists with 4 RED query_tables tests"
    - "033: REMEMBER_TOOL/RECALL_TOOL patterns in openai_service.py"
    - "035: document_tables table exists, resolve_document_id available"
  provides:
    - "MODAL-03: query_tables tool fully wired end-to-end"
    - "QUERY_TABLES_TOOL constant in openai_service.py (General Mode only)"
    - "handle_query_tables() + _fetch_document_tables() in multimodal_service.py"
    - "query_tables dispatch branch in threads.py"
    - "query_tables bullet in SYSTEM_PROMPT tool catalog"
  affects:
    - "get_tools(): now returns 14 base tools (was 13)"
    - "SYSTEM_PROMPT: extended with query_tables tool description"

tech_stack:
  patterns:
    - "Local import pattern for resolve_document_id inside handle_query_tables (avoids circular import)"
    - "_fetch_document_tables extracted as module-level function for test patchability"
    - "Server-side column_filter via Python list comprehension (not SQL filter)"
    - "50-row cap with truncated:true flag — mirrors read_document 3k char cap pattern"

key_files:
  created: []
  modified:
    - backend/app/services/openai_service.py
    - backend/app/services/multimodal_service.py
    - backend/app/api/threads.py
    - backend/tests/unit/test_openai_service.py
    - backend/tests/unit/test_multimodal_query.py
    - backend/tests/unit/test_module7_tools.py

decisions:
  - "D-04/D-05/D-06/D-07/D-08 all implemented per plan"
  - "resolve_document_id called via lazy local import inside handle_query_tables — avoids circular dependency"
  - "_fetch_document_tables extracted as module-level function — clean patchability in unit tests"
  - "column_filter applied Python-side after fetching all table rows — simpler than SQL, sufficient for typical table sizes"

metrics:
  duration: 282s
  tasks_completed: 2
  files_changed: 6
  commits: 2
---

# Phase 36 Plan 02: QUERY_TABLES_TOOL constant, handle_query_tables service, tool dispatch + system prompt Summary

`query_tables` tool fully wired end-to-end: QUERY_TABLES_TOOL constant in General Mode tools, `handle_query_tables` + `_fetch_document_tables` in `multimodal_service.py`, `elif` dispatch in `threads.py`, and system prompt bullet — turning 4 RED tests GREEN.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add QUERY_TABLES_TOOL constant to openai_service.py and get_tools(), plus TestQueryTablesTool tests | b0e9172 | openai_service.py (+38 lines), test_openai_service.py (+22 lines) |
| 2 | Implement handle_query_tables() + _fetch_document_tables() in multimodal_service.py, dispatch + SYSTEM_PROMPT in threads.py | bc0cc3d | multimodal_service.py (+82 lines), threads.py (+8 lines), test_multimodal_query.py (fix), test_module7_tools.py (count fix) |

## What Was Built

**Task 1 — QUERY_TABLES_TOOL constant:**
- `QUERY_TABLES_TOOL` dict inserted after `RECALL_TOOL` in `openai_service.py` with `document_name` (required), `column_filter` (optional object), `page` (optional int) parameters
- Added to `get_tools()` list — General Mode now returns 14 base tools
- NOT added to `get_explorer_tools()` (D-07)
- `TestQueryTablesTool` with 2 tests: `test_query_tables_in_general_tools` and `test_query_tables_not_in_explorer_tools`

**Task 2 — Service + dispatch:**
- `_fetch_document_tables(doc_id, user_id, page_filter, supabase)` — module-level function querying `document_tables` with optional page filter, ordered by `table_index`
- `handle_query_tables(args, user_id, supabase)` — resolves `document_name` via `resolve_document_id`, calls `_fetch_document_tables`, applies `column_filter` server-side (Python exact match), caps at 50 rows, returns JSON string
- Error cases: document not found → `{"error": "Document '...' not found."}`, no tables → `{"error": "No tables found..."}`, filter matches nothing → `{"error": "No matching rows found..."}`
- `elif tool_name == "query_tables":` dispatch branch added in `threads.py` after recall handler
- `query_tables` bullet added to `SYSTEM_PROMPT` tool catalog between `save_skill/read_skill_file` and the Tiebreaker paragraph

## Verification Results

```
# Wave 1 full verification:
tests/unit/test_multimodal_query.py: 6 passed (all GREEN — 4 were RED in Plan 01)
tests/unit/test_openai_service.py: 9 passed (including 2 new TestQueryTablesTool tests)
Total: 15 passed, 0 failed
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed broken mock setup in test_query_tables_returns_data**
- **Found during:** Task 2 verification (test failed immediately)
- **Issue:** `test_query_tables_returns_data` was written as a RED test with `mock_supabase = MagicMock()` (plain mock, no chain wiring) but did NOT patch `_fetch_document_tables`. When `_fetch_document_tables` ran against the plain mock, `result.data` returned a truthy MagicMock rather than the `tables_data` list. The result was the "No matching rows found" error path being hit instead of the happy path.
- **Fix:** Added `patch("app.services.multimodal_service._fetch_document_tables", return_value=tables_data)` to the test's context manager — consistent with the pattern used by `test_query_tables_column_filter` and `test_query_tables_row_cap`.
- **Files modified:** `backend/tests/unit/test_multimodal_query.py`
- **Commit:** bc0cc3d

**2. [Rule 1 - Bug] Updated tool count assertions in test_module7_tools.py**
- **Found during:** Task 2 full suite run
- **Issue:** `TestGetTools` had hardcoded assertions `len(tools) == 13` (base) and `len(tools) == 14` (with web_search). Adding QUERY_TABLES_TOOL incremented the base count by 1, breaking both assertions.
- **Fix:** Updated assertions to `len(tools) == 14` (base) and `len(tools) == 15` (with web_search). Updated docstrings to match.
- **Files modified:** `backend/tests/unit/test_module7_tools.py`
- **Commit:** bc0cc3d

### Out-of-scope pre-existing failures (not touched)

The following test failures were confirmed pre-existing (identical failure before our commits via `git stash` verification):
- `tests/integration/test_documents.py::TestUploadDocument::test_upload_with_valid_folder_id_returns_201` — KeyError: 'user_id' in folder ownership check mock setup
- `tests/unit/test_infrastructure.py` (3 tests) — TTL cache and chunking tests
- `tests/unit/test_citations_confidence.py` (2 tests) — confidence threshold tests
- `tests/integration/test_threads_skills.py` (5 tests) — skill integration tests
- `tests/unit/test_explorer_agent.py`, `tests/unit/test_sql_service.py` — listed in PROJECT.md pre-existing failures

These are logged to deferred-items but not fixed per scope boundary rules.

## Known Stubs

None. All deliverables are fully wired: tool constant registered, service logic complete, dispatch active, system prompt updated.

## Self-Check: PASSED
