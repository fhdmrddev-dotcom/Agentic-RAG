---
phase: 11-skills-llm-integration
plan: 02
subsystem: api
tags: [openai, tools, fastapi, pytest, skills, sse, storage]

# Dependency graph
requires:
  - phase: 11-01
    provides: tool definitions in openai_service.py; catalog injection in threads.py; test stubs
provides:
  - load_skill dispatch handler in threads.py (SKIL-10, SKIL-12, FILE-04)
  - save_skill dispatch handler in threads.py (SKIL-11)
  - read_skill_file dispatch handler in threads.py (FILE-05)
  - Full integration test coverage for all 3 dispatch handlers
affects:
  - 11-03 (frontend SSE handling for skill_activated event)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Skill dispatch: 3 elif branches added before else-unknown-tool in tool execution loop"
    - "load_skill emits skill_activated SSE event before DB query for immediate frontend feedback"
    - "save_skill: maybe_single() list guard (isinstance check) for mock compatibility"
    - "read_skill_file: uses skill row's user_id (owner) for storage path, not current_user['id']"
    - "Dispatch tests: _make_tool_call_chunk + _make_tool_calls_done_chunk helpers for tool-calling SSE simulation"
    - "execute() side_effect list for tool dispatch tests: 10 entries (ownership, insert_user, folder_lookup, history, catalog, tool-queries..., persist, touch, auto-title)"

key-files:
  created: []
  modified:
    - backend/app/api/threads.py
    - backend/tests/integration/test_threads_skills.py

key-decisions:
  - "load_skill uses .order('is_global') ascending so user-owned skills sort before global when names conflict — takes [0] for preferred match"
  - "skill_activated SSE event emitted BEFORE Supabase query in load_skill dispatch (immediate feedback, even if skill not found)"
  - "read_skill_file storage path uses row['user_id'] not current_user['id'] — critical for global skills where reader != owner (Pitfall 3)"
  - "Test _collect_sse_events helper parses all SSE data lines — enables order assertions for skill_activated before tool_end"
  - "TestReadSkillFile imports _supabase from conftest directly to wire storage_bucket.download mock"

requirements-completed: [SKIL-10, SKIL-11, SKIL-12, FILE-04, FILE-05]

# Metrics
duration: ~3min
completed: 2026-04-01
---

# Phase 11 Plan 02: Skill Tool Dispatch Handlers Summary

**Three skill tool dispatch handlers (load_skill, save_skill, read_skill_file) implemented in threads.py with skill_activated SSE event; all 8 test stubs fleshed out and GREEN**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-01T03:08:20Z
- **Completed:** 2026-04-01T03:11:38Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Implemented `load_skill` dispatch: emits `skill_activated` SSE event, queries skills table (user+global with `is_global` ordering for conflict resolution), fetches attached filenames from skill_files table
- Implemented `save_skill` dispatch: maybe_single() check for existing skill, creates or updates with isinstance guard for mock compatibility
- Implemented `read_skill_file` dispatch: resolves skill owner's user_id for storage path, downloads from `skill-files` bucket, decodes UTF-8
- Replaced 8 stub tests with full implementations covering: instructions+files returned, not-found handling, create-new, update-existing, storage download path verification, skill_activated ordering assertion, filenames in tool result
- All 11 tests in test_threads_skills.py GREEN; 28 pre-existing failures unchanged

## Task Commits

1. **Task 1: Dispatch handlers** - `82fd7da` (feat)
2. **Task 2: Flesh out dispatch test stubs** - `bbe7d98` (feat)

## Files Created/Modified

- `backend/app/api/threads.py` - Added 3 elif dispatch branches (load_skill, save_skill, read_skill_file) before else-unknown-tool
- `backend/tests/integration/test_threads_skills.py` - Replaced 8 stub tests with full implementations; added _make_tool_call_chunk, _make_tool_calls_done_chunk, _collect_sse_events helpers

## Decisions Made

- `load_skill` uses `.order("is_global")` ascending so user-owned skills (is_global=false) sort before global (is_global=true) — takes `[0]` to get preferred match when names conflict
- `skill_activated` SSE event emitted before the Supabase DB query, so the event fires immediately even if the skill is not found
- `read_skill_file` uses `row['user_id']` (the skill owner's ID) for the storage path — critical for global skills where `current_user['id'] != owner_user_id`
- Test `_collect_sse_events` helper enables order-sensitive assertions (skill_activated must precede tool_end)
- `TestReadSkillFile` imports `_supabase` from conftest directly to configure `storage_bucket.download` mock

## Deviations from Plan

None — plan executed exactly as written. The PLAN.md specified exact code patterns and these were implemented verbatim with no surprises.

## Known Stubs

None — all dispatch handlers are fully wired to Supabase queries and storage.

## Self-Check: PASSED
