---
phase: 11-skills-llm-integration
plan: 01
subsystem: api
tags: [openai, tools, fastapi, pytest, system-prompt, skills]

# Dependency graph
requires:
  - phase: 10-agent-skills-core
    provides: skills table and CRUD API this plan integrates into the chat loop
provides:
  - LOAD_SKILL_TOOL, SAVE_SKILL_TOOL, READ_SKILL_FILE_TOOL definitions in openai_service.py
  - get_tools() returns all 3 skill tools; get_explorer_tools() unchanged
  - Skill catalog injection into General Mode system prompt (SKIL-09)
  - Test scaffold covering all 7 Phase 11 requirements (catalog/gating GREEN, dispatch stubs)
affects:
  - 11-02 (Plan 02 fills in dispatch stub tests)
  - 11-03 (frontend skill_activated SSE handling)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Skill catalog injection: single query at top of event_stream() augments system prompt (General Mode only)"
    - "Mode-gated tool registration: skill tools in get_tools(), excluded from get_explorer_tools()"
    - "Test side_effect count includes auto-title execute call when history has exactly 1 user message"

key-files:
  created:
    - backend/tests/integration/test_threads_skills.py
  modified:
    - backend/app/services/openai_service.py
    - backend/app/api/threads.py

key-decisions:
  - "Catalog injection wrapped in if body.agent_mode != 'explorer' placed after folder scope augmentation and before messages list construction"
  - "Auto-title execute call is the 8th execute() in General Mode test side_effect list (history with 1 user message triggers it)"
  - "Test side_effect ordering confirmed from code: ownership, insert_user, folder_lookup, history, catalog, persist_assistant, touch_thread, auto-title"

patterns-established:
  - "System prompt augmentation for catalog follows folder_scope_note pattern exactly"
  - "Test mock side_effect list must account for all execute() calls including auto-title update when history has 1 message"

requirements-completed: [SKIL-09, SKIL-13]

# Metrics
duration: 15min
completed: 2026-04-01
---

# Phase 11 Plan 01: Skills LLM Integration Foundation Summary

**Three skill tool definitions registered in General Mode, catalog injected into system prompt via .or_() query, test scaffold with catalog/gating tests GREEN and 7 dispatch stubs for Plan 02**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-01T02:55:00Z
- **Completed:** 2026-04-01T03:05:32Z
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments
- Added LOAD_SKILL_TOOL, SAVE_SKILL_TOOL, READ_SKILL_FILE_TOOL to openai_service.py with full JSON Schema parameter definitions
- Updated get_tools() to include all 3 skill tools; get_explorer_tools() left unchanged (SKIL-13)
- Updated SYSTEM_PROMPT in threads.py from "nine tools" to "twelve tools" with descriptions for all 3 skill tools and key rule entries
- Injected enabled skills catalog into General Mode system prompt via .or_() filter query on skills table (SKIL-09)
- Created test scaffold: TestCatalogInjection (2 tests GREEN), TestExplorerModeNoSkills (1 test GREEN), 5 stub classes with 8 pass-tests for Plan 02

## Task Commits

Each task was committed atomically:

1. **Task 1: Test scaffold + tool definitions + catalog injection** - `32cda35` (feat)

**Plan metadata:** (pending final commit)

## Files Created/Modified
- `backend/tests/integration/test_threads_skills.py` - New test file: 3 live tests GREEN, 8 stubs for Plan 02
- `backend/app/services/openai_service.py` - Added LOAD_SKILL_TOOL, SAVE_SKILL_TOOL, READ_SKILL_FILE_TOOL; updated get_tools()
- `backend/app/api/threads.py` - Updated SYSTEM_PROMPT (nine→twelve tools); added catalog injection block

## Decisions Made
- Catalog injection placed after folder_scope_note augmentation, before `messages` list construction, wrapped in `if body.agent_mode != "explorer":` — mirrors the folder scope pattern exactly
- Test mock side_effect lists include an 8th entry for the auto-title update execute() call, which fires when message history has exactly 1 user message (the test case scenario)
- Pre-existing test failures (28 tests) confirmed as pre-existing before this plan's changes; no new regressions introduced

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected test side_effect ordering and count**
- **Found during:** Task 1 (test scaffold creation)
- **Issue:** Plan's documented side_effect order had "Insert user message" at position 5, but in threads.py it happens before event_stream() (position 2). Additionally the auto-title execute() call was not counted in the plan's 7-entry list.
- **Fix:** Reordered side_effect list to match actual code execution order (ownership, insert_user, folder_lookup, history, catalog, persist_assistant, touch_thread, auto-title = 8 entries). Verified by running tests.
- **Files modified:** backend/tests/integration/test_threads_skills.py
- **Verification:** All 11 tests pass after fix
- **Committed in:** 32cda35 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug in test ordering derived from plan comment vs actual code)
**Impact on plan:** Fix was required for test correctness. No scope creep.

## Issues Encountered
- 28 pre-existing test failures were present in the codebase before this plan. Confirmed via git stash before/after comparison. None caused by this plan's changes.

## Next Phase Readiness
- Tool definitions and catalog injection complete — Plan 02 can implement dispatch handlers for load_skill, save_skill, and read_skill_file
- Test stubs in test_threads_skills.py are ready to be fleshed out in Plan 02
- get_explorer_tools() confirmed unchanged; Explorer Mode gating verified via TestExplorerModeNoSkills

---
*Phase: 11-skills-llm-integration*
*Completed: 2026-04-01*
