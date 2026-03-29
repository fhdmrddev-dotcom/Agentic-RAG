---
phase: 09-persistent-tool-memory
plan: 01
subsystem: api
tags: [openai, tool-calls, history, python, fastapi]

# Dependency graph
requires:
  - phase: 07-explorer-sub-agent
    provides: multi-tool dispatch loop with tool_calls_buffer in threads.py
  - phase: 08-folder-system-enhancements
    provides: message history loading in threads.py
provides:
  - tool_call_id persisted in tool_calls JSONB alongside name, args, result, status
  - _reconstruct_history() helper for OpenAI multi-turn message reconstruction
  - History loading fetches tool_calls column and reconstructs full turn sequences
  - Backward-compatible fallback for old messages without tool_call_id
affects: [10-agent-skills, 11-skill-building-blocks]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TDD with module-level helper extraction for testability (_reconstruct_history)"
    - "Persist structured metadata (tool_call_id) in JSONB alongside existing fields"
    - "Backward-compatible history reconstruction via presence-check on new field"

key-files:
  created:
    - backend/tests/unit/test_tool_memory.py
  modified:
    - backend/app/api/threads.py

key-decisions:
  - "_reconstruct_history extracted as module-level function so tests can import it directly without HTTP setup"
  - "all(tc.get('tool_call_id') for tc in tool_calls_data) guard ensures backward compat — any entry missing the field falls back to plain assistant message"
  - "Empty/None assistant content after tool use produces only 2 parts (no assistant text message) to avoid empty messages in OpenAI API call"
  - "tool_call_id stored as first key in persisted_tool_calls dict for visual clarity; order does not affect JSONB behavior"

patterns-established:
  - "History reconstruction pattern: 3-part sequence (assistant+tool_calls, tool result(s), assistant text) for each stored assistant-with-tool-calls message"
  - "Module-level helper extraction from nested async generator for unit testability"

requirements-completed: [TMEM-01, TMEM-02, TMEM-03, TMEM-04]

# Metrics
duration: 4min
completed: 2026-03-29
---

# Phase 09 Plan 01: Persistent Tool Memory Summary

**tool_call_id persisted in JSONB and history reconstructed as OpenAI multi-turn sequences so the LLM can reference prior tool results across conversation turns**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-29T14:07:29Z
- **Completed:** 2026-03-29T14:11:31Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Persisted `tool_call_id` (from LLM response) in the `tool_calls` JSONB column alongside name, args, result, status (TMEM-01)
- Added `_reconstruct_history()` module-level helper that converts stored DB rows into OpenAI-compatible multi-turn message sequences (TMEM-02, TMEM-03)
- History loading now fetches `tool_calls` column and uses `_reconstruct_history` — each assistant-with-tools turn reconstructs as: (1) assistant+tool_calls, (2) tool result per call, (3) assistant text if non-empty (TMEM-02)
- Backward compatible: old messages without `tool_call_id` emit as plain assistant messages with no API breakage
- 15 unit tests cover all reconstruction paths and edge cases; 2000-char result cap preserved (TMEM-04)

## Task Commits

Each task was committed atomically:

1. **TDD RED — Failing tests** - `a25992d` (test)
2. **Task 1: Persist tool_call_id in tool_calls JSONB** - `fd626ab` (feat)
3. **Task 2: Reconstruct multi-turn tool call history** - `285a7d9` (feat)

_Note: TDD tasks have RED commit (test) then GREEN commit (feat)_

## Files Created/Modified
- `backend/tests/unit/test_tool_memory.py` - 15 unit tests: 7 for persistence, 8 for history reconstruction
- `backend/app/api/threads.py` - Added tool_call_id to persisted_tool_calls.append, added _reconstruct_history() helper, updated select to fetch tool_calls column, replaced simple loop with messages.extend(_reconstruct_history(...))

## Decisions Made
- `_reconstruct_history` extracted as a module-level function (not inline in `event_stream`) so unit tests can import and call it directly without standing up a FastAPI test client
- The backward-compat guard uses `all(tc.get("tool_call_id") for tc in tool_calls_data)` — if any entry lacks the field (old data), the whole message falls back to plain emission
- Empty assistant content after tool use suppresses the 3rd message part to avoid sending `{"role": "assistant", "content": ""}` to the OpenAI API

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

None - no external service configuration required. The `tool_calls` column already exists in the messages table (JSONB, nullable) so no migration is needed. Existing messages without `tool_call_id` in their JSONB entries are handled by the backward-compat fallback.

## Next Phase Readiness
- Persistent tool memory is complete — LLM will receive full tool call history on subsequent conversation turns
- Ready for Phase 10 (Agent Skills) which builds on the tool dispatch framework in threads.py
- No blockers

---
*Phase: 09-persistent-tool-memory*
*Completed: 2026-03-29*

## Self-Check: PASSED

- backend/tests/unit/test_tool_memory.py: FOUND
- .planning/phases/09-persistent-tool-memory/09-01-SUMMARY.md: FOUND
- Commit a25992d (TDD RED tests): FOUND
- Commit fd626ab (Task 1 feat): FOUND
- Commit 285a7d9 (Task 2 feat): FOUND
