---
phase: 05-search-tools
plan: 01
subsystem: api
tags: [fastapi, postgres, regex, pydantic, pgvector, supabase-rpc]

# Dependency graph
requires:
  - phase: 04-navigation-tools
    provides: _fetch_visible_folders, _build_tree_map, _resolve_path, _collect_folder_ids shared helpers for path resolution and folder scoping
provides:
  - GET /kb/grep endpoint — regex search over document full_markdown content, optionally scoped to a folder subtree
  - grep_path helper — callable from agent tool loop (threads.py) without HTTP round-trip
  - GrepMatch and GrepResponse Pydantic models
  - _inject_user_id_for_grep — user-scoped SQL injection for grep queries via query_user_documents RPC
affects: [06-search-tools-glob, 07-read-tool, 08-explorer-subagent, threads.py agent tool loop]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - grep_path helper pattern — pure Python callable for agent tool loop, mirrors ls_path/tree_path from Phase 4
    - _inject_user_id_for_grep — inline user scoping for grep SQL rather than importing private sql_service function
    - Postgres regex operator ~ for full-text pattern matching against full_markdown column

key-files:
  created: []
  modified:
    - backend/app/models/kb.py
    - backend/app/api/kb.py
    - backend/tests/integration/test_kb.py

key-decisions:
  - "grep_path reuses Phase 4 shared helpers (_fetch_visible_folders, _resolve_path, _collect_folder_ids) for path scoping — no duplication"
  - "grep targets full_markdown column via Postgres regex operator ~ through query_user_documents RPC — consistent with existing tool pattern"
  - "_inject_user_id_for_grep implemented inline in kb.py (not imported from sql_service) since grep always targets the documents table specifically"
  - "grep returns document names only (document_id, filename, folder_id) — not content — per PROJECT.md decision"

patterns-established:
  - "grep_path: pure helper callable from agent loop, returns dict with 'error' key on failure — same contract as ls_path/tree_path"
  - "User scoping via _inject_user_id_for_grep injects documents.user_id = '{user_id}' into WHERE clause before RPC call"

requirements-completed: [TOOL-03]

# Metrics
duration: 2min
completed: 2026-03-22
---

# Phase 5 Plan 01: Search Tools — Grep Summary

**GET /kb/grep endpoint with grep_path helper: regex search over document full_markdown via Postgres ~ operator, optional folder subtree scoping using Phase 4 path resolution helpers**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-22T02:02:36Z
- **Completed:** 2026-03-22T02:04:38Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- GET /kb/grep endpoint searches document full_markdown content by regex pattern using Postgres ~ operator via query_user_documents RPC
- grep_path helper callable from agent tool loop (threads.py) without HTTP round-trip — follows ls_path/tree_path pattern from Phase 4
- Optional path parameter scopes search to a folder subtree using Phase 4 helpers (_resolve_path, _collect_folder_ids)
- 14 integration tests pass (5 new TestGrep + 9 existing TestLs/TestTree)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add GrepMatch/GrepResponse models and grep endpoint** - `2fc2a27` (feat)
2. **Task 2: Integration tests for grep endpoint** - `7034d0d` (test)

## Files Created/Modified
- `backend/app/models/kb.py` - Added GrepMatch and GrepResponse Pydantic models
- `backend/app/api/kb.py` - Added grep_path helper, _inject_user_id_for_grep, and GET /kb/grep endpoint
- `backend/tests/integration/test_kb.py` - Added TestGrep class with 5 integration tests; fixed pre-existing broken assertion in TestLs.test_ls_not_found

## Decisions Made
- grep_path reuses Phase 4 shared helpers for path scoping — no duplication of tree-walk logic
- _inject_user_id_for_grep implemented inline in kb.py rather than importing private sql_service function — grep always targets documents table, logic is straightforward
- grep returns document_id, filename, folder_id only — not content — per PROJECT.md decision that grep returns document names only

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed broken assertion in TestLs.test_ls_not_found**
- **Found during:** Task 2 (integration tests)
- **Issue:** Test asserted `"Path not found" in detail` but actual error message is `"Path '/nonexistent' not found"` — the literal string "Path not found" is not a substring because path value is inserted between "Path" and "not found"
- **Fix:** Changed assertion to `"not found" in response.json()["detail"]` which matches the actual message format
- **Files modified:** backend/tests/integration/test_kb.py
- **Verification:** Test passes; all 14 tests in test_kb.py pass
- **Committed in:** 7034d0d (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - pre-existing broken test assertion)
**Impact on plan:** Correcting broken test assertion that predated this plan. No scope creep.

## Issues Encountered
None — plan executed cleanly; only deviation was a pre-existing broken test assertion.

## Known Stubs
None — grep endpoint is fully wired to query_user_documents RPC.

## Self-Check: PASSED

All created/modified files confirmed on disk. All task commits verified in git log.

## Next Phase Readiness
- grep_path helper is ready for import in threads.py agent tool loop (Plan 02 will wire GREP_TOOL)
- GET /kb/grep endpoint is live and tested
- Phase 5 Plan 02 (glob tool) can proceed

---
*Phase: 05-search-tools*
*Completed: 2026-03-22*
