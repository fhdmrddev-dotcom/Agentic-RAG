---
phase: 05-search-tools
plan: 02
subsystem: api
tags: [fastapi, fnmatch, regex, pydantic, glob, agent-tools]

# Dependency graph
requires:
  - phase: 05-search-tools/05-01
    provides: grep_path helper, GrepMatch/GrepResponse models, _fetch_visible_folders/_build_tree_map shared helpers
  - phase: 04-navigation-tools
    provides: _fetch_visible_folders, _build_tree_map, _resolve_path, _collect_folder_ids shared helpers
provides:
  - GET /kb/glob endpoint — filename glob pattern matching against user's documents with ** recursive support
  - glob_path helper — callable from agent tool loop (threads.py) without HTTP round-trip
  - GlobMatch and GlobResponse Pydantic models
  - _build_folder_path_map — folder_id -> full_path mapping for path-aware glob matching
  - GREP_TOOL and GLOB_TOOL agent tool definitions in openai_service.py
  - grep and glob dispatch cases in threads.py agent tool loop
  - Updated system prompt listing 8 tools with grep/glob guidance
affects: [06-read-tool, 07-explorer-subagent, threads.py agent tool loop]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - _glob_pattern_to_regex — converts glob pattern with ** to compiled regex; ** maps to .*, * maps to [^/]*, ? maps to [^/] — required because fnmatch does not handle ** recursive directory matching
    - _build_folder_path_map — recursive tree walk building folder_id -> full_path dict, enabling path-aware glob matching against full document paths
    - glob_path helper pattern — pure Python callable for agent tool loop, mirrors grep_path/ls_path/tree_path

key-files:
  created: []
  modified:
    - backend/app/models/kb.py
    - backend/app/api/kb.py
    - backend/app/services/openai_service.py
    - backend/app/api/threads.py
    - backend/tests/integration/test_kb.py

key-decisions:
  - "glob_path uses _glob_pattern_to_regex() with regex for ** matching rather than fnmatch alone — fnmatch does not support ** recursive path segments"
  - "glob_path matches against both full path (matchable) and filename alone to support simple patterns like *.pdf regardless of folder depth"
  - "GREP_TOOL and GLOB_TOOL inserted before ANALYZE_DOCUMENT_TOOL in get_tools() list"
  - "System prompt updated from six to eight tools; grep and glob added at positions 3 and 4"

patterns-established:
  - "glob_path: pure helper callable from agent loop, returns dict with 'matches', 'pattern', 'total' — same contract as grep_path/ls_path/tree_path"
  - "_glob_pattern_to_regex: ** replacement must happen before re.escape() to preserve placeholder; use \x00 sentinel to avoid conflicts"

requirements-completed: [TOOL-04]

# Metrics
duration: 4min
completed: 2026-03-22
---

# Phase 5 Plan 02: Search Tools — Glob Summary

**GET /kb/glob endpoint with glob_path helper: filename pattern matching using ** -aware regex conversion, path-aware full-path matching, and both grep+glob wired into agent tool loop with updated system prompt**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-21T21:06:43Z
- **Completed:** 2026-03-21T21:10:47Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- GET /kb/glob endpoint matches documents by filename pattern (*.pdf, reports/**/*.pdf, meeting-notes-*) using regex-based matching with proper ** recursive directory support
- glob_path helper callable from agent tool loop — follows same pattern as grep_path/ls_path/tree_path from earlier phases
- GREP_TOOL + GLOB_TOOL agent definitions added to openai_service.py and wired in threads.py dispatch loop
- System prompt updated from 6 to 8 tools with grep and glob usage guidance
- 19 integration tests pass (5 new TestGlob + 5 TestGrep + 9 TestLs/TestTree)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add GlobMatch/GlobResponse models, glob endpoint, GREP_TOOL+GLOB_TOOL, agent dispatch** - `80e083a` (feat)
2. **Task 2: Integration tests for glob endpoint** - `adf0ba0` (test)

## Files Created/Modified
- `backend/app/models/kb.py` - Added GlobMatch and GlobResponse Pydantic models
- `backend/app/api/kb.py` - Added _build_folder_path_map, _glob_pattern_to_regex, glob_path helper, and GET /kb/glob endpoint
- `backend/app/services/openai_service.py` - Added GREP_TOOL and GLOB_TOOL; updated get_tools() to include both
- `backend/app/api/threads.py` - Updated import, system prompt (6→8 tools), added grep/glob dispatch cases
- `backend/tests/integration/test_kb.py` - Added TestGlob class with 5 integration tests

## Decisions Made
- glob_path uses `_glob_pattern_to_regex()` converting `**` to `.*` in regex rather than relying on fnmatch — fnmatch does not natively support `**` as a recursive directory segment
- Dual matching: glob against both `matchable` (full path without leading slash) and `doc["filename"]` alone — ensures `*.pdf` matches PDFs at any depth without requiring path prefix in pattern
- Endpoint function named `glob_search` (not `glob`) to avoid shadowing Python's built-in `glob` module

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed fnmatch not supporting ** recursive glob matching**
- **Found during:** Task 2 (integration tests)
- **Issue:** `fnmatch.fnmatch("reports/report.pdf", "reports/**/*.pdf")` returns False — fnmatch treats `**` like `*` (matches within a single segment) rather than recursively across path separators
- **Fix:** Added `_glob_pattern_to_regex()` helper that converts glob pattern to compiled regex: `**` maps to `.*`, `*` maps to `[^/]*`, `?` maps to `[^/]`. Replaced fnmatch call with `compiled.match(matchable)` for path matching; kept `fnmatch.fnmatch(filename, pattern)` for simple filename-only fallback
- **Files modified:** backend/app/api/kb.py
- **Verification:** `test_glob_path_scoped` now passes; all 5 TestGlob tests pass
- **Committed in:** adf0ba0 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug in fnmatch ** handling)
**Impact on plan:** Fix required for correctness of path-scoped patterns. No scope creep.

## Issues Encountered
None beyond the auto-fixed ** matching bug.

## Known Stubs
None — glob endpoint is fully wired to user's documents table with RLS scoping via .eq("user_id").

## Self-Check: PASSED

All files confirmed on disk. Both task commits (80e083a, adf0ba0) verified in git log.

## Next Phase Readiness
- glob_path helper is ready for import in additional tool contexts
- GET /kb/glob endpoint is live and tested
- Both grep and glob are active agent tools with dispatch in threads.py
- Phase 5 Plan 02 complete — Phase 5 (search-tools) fully done
- Phase 6 (read tool) can proceed

---
*Phase: 05-search-tools*
*Completed: 2026-03-22*
