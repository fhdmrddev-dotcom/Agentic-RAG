---
phase: 083-foundation-tool-dispatch-extraction-bug-fixes
plan: 01
subsystem: api
tags: [refactor, tool-dispatch, registry-pattern, dataclass, G-5]

# Dependency graph
requires: []
provides:
  - "tool_dispatcher.py with ToolContext, ToolResult, dispatch_tool() entry point"
  - "Registry-pattern dispatch for all 16 tools -- new tools register without modifying threads.py"
  - "threads.py reduced by ~775 LOC (3843 -> 3068 lines)"
affects: [083-02, 083-03, 084, 085]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Registry-pattern tool dispatch via _TOOL_REGISTRY dict + dispatch_tool()"
    - "ToolContext dataclass carries all agent_runner closure variables to handlers"
    - "ToolResult dataclass provides structured return with side-effect channels"

key-files:
  created:
    - backend/app/services/tool_dispatcher.py
    - backend/tests/unit/test_tool_dispatcher.py
  modified:
    - backend/app/api/threads.py
    - backend/tests/unit/test_075_1_observability.py

key-decisions:
  - "ToolContext uses @dataclass (matching tool_parser.py pattern) with all closure variables as explicit fields"
  - "ToolResult channels source_refs, citations, similarity_score, and sub_agent_record back to the caller"
  - "tool_index and iteration added to ToolContext for execute_code heartbeat and harvest_output_files"
  - "drain_step imported from threads.py by tool_dispatcher (circular import avoided via deferred import)"

patterns-established:
  - "Adding new tool: create _handle_<name>(args, ctx) -> ToolResult + register in _TOOL_REGISTRY"
  - "ToolContext.emit and ToolContext.spawn callbacks carry SSE and fire-and-forget patterns to handlers"

requirements-completed: [FOUND-01]

# Metrics
duration: 21min
completed: 2026-05-28
---

# Phase 083 Plan 01: Tool Dispatch Extraction Summary

**Registry-pattern tool dispatcher extracted from threads.py -- 16 handlers, ToolContext/ToolResult dataclasses, ~775 LOC removed from god file (G-5 resolution)**

## Performance

- **Duration:** 21 min
- **Started:** 2026-05-27T20:44:17Z
- **Completed:** 2026-05-27T21:05:28Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Created `backend/app/services/tool_dispatcher.py` (848 lines) with ToolContext dataclass, ToolResult dataclass, all 16 tool handler functions, _TOOL_REGISTRY dict, and dispatch_tool() entry point
- Replaced the ~780 LOC `elif tool_name ==` chain in threads.py with a single `await dispatch_tool(tool_name, args, tool_ctx)` call
- Reduced threads.py from 3843 to 3068 lines -- the G-5 mandated refactor that makes threads.py structurally ready for Phase 084/085 new tool additions
- All 50 pre-existing test failures unchanged, 8 new tool_dispatcher smoke tests all pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Create tool_dispatcher.py with ToolContext, ToolResult, and all 16 tool handlers** - `eb948b6` (feat)
2. **Task 2: Wire dispatch_tool into threads.py agent_runner -- replace elif chain** - `70cd80b` (refactor)

## Files Created/Modified

- `backend/app/services/tool_dispatcher.py` - New: registry-pattern dispatcher with 16 tool handlers, ToolContext/ToolResult dataclasses, dispatch_tool() entry point (848 lines)
- `backend/tests/unit/test_tool_dispatcher.py` - New: 8 smoke tests validating registry wiring and dataclass defaults (152 lines)
- `backend/app/api/threads.py` - Modified: removed ~780 LOC elif chain, added dispatch_tool() call, removed 6 now-unused imports
- `backend/tests/unit/test_075_1_observability.py` - Modified: updated source-scanning test to find sub_agent_record in tool_dispatcher.py instead of threads.py

## Decisions Made

- **ToolContext fields:** Added `tool_index` and `iteration` beyond the plan's spec because execute_code handler needs both for heartbeat events and harvest_output_files iteration tracking
- **drain_step import:** Used deferred import (`from app.api.threads import drain_step`) inside _handle_execute_code to avoid circular import -- drain_step is a pure function already at module scope in threads.py
- **Import cleanup:** Removed `base64`, `io`, `ls_path`, `tree_path`, `grep_path`, `glob_path`, `read_path`, `web_search`, `query_documents`, `run_sub_agent`, `search_documents`, `resolve_document_id`, `fetch_full_document`, `harvest_output_files` from threads.py; kept `sandbox_manager` (used for close_session at line 927) and `_SUB_AGENT_MODEL_DEFAULTS` (used in generate_thread_title)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated source-scanning test for moved code**
- **Found during:** Task 2 (wiring dispatch_tool into threads.py)
- **Issue:** `test_persisted_tool_calls_carry_sub_agent_model_when_sub_agent_record_present` in `test_075_1_observability.py` scans threads.py source text for `sub_agent_record = {..."effective_model":` -- which moved to tool_dispatcher.py
- **Fix:** Updated test to scan `tool_dispatcher.py` for the construction site and `threads.py` for the persisted_tool_calls.append spread
- **Files modified:** `backend/tests/unit/test_075_1_observability.py`
- **Verification:** Test passes after update
- **Committed in:** `70cd80b` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug fix)
**Impact on plan:** Necessary correction for a source-scanning test that checked the wrong file after extraction. No scope creep.

## Issues Encountered

None -- plan executed cleanly.

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness

- tool_dispatcher.py provides the extension point for Phases 084-085 new tools (workspace_write, workspace_read, write_todos, task, ask_user)
- Adding a new tool requires only: (1) write `_handle_<name>(args, ctx) -> ToolResult`, (2) register in `_TOOL_REGISTRY`
- threads.py is no longer on the G-5 hot-file ledger for tool additions

## Self-Check: PASSED

All files verified present, all commits verified in git log.

---
*Phase: 083-foundation-tool-dispatch-extraction-bug-fixes*
*Completed: 2026-05-28*
