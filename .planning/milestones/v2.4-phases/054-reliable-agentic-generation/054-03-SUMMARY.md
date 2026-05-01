---
phase: 054-reliable-agentic-generation
plan: 03
subsystem: api
tags: [anthropic, streaming, sdk, tool-calling, prompt-caching]

# Dependency graph
requires:
  - phase: 054-01
    provides: test_anthropic_service.py with 14 RED tests that this plan turns GREEN
provides:
  - Native Anthropic SDK streaming adapter with message conversion, tool conversion, and prompt caching
affects: [054-04-dispatch, threads.py-agent-loop]

# Tech tracking
tech-stack:
  added: [anthropic>=0.97.0]
  patterns: [normalized-event-dict adapter, tool-arg buffering at content_block_stop, consecutive-tool-result grouping]

key-files:
  created:
    - backend/app/services/anthropic_service.py
  modified: []

key-decisions:
  - "D-02: anthropic_service.py is a new file — openai_service.py already 849 lines; clean SDK separation"
  - "D-03: Adapter yields normalized event dicts — agent loop unchanged; all translation inside anthropic_service.py"
  - "D-05: Cache system prompt + last tool only — high-value constant prefix; message history caching deferred"
  - "Tool args buffered until content_block_stop to avoid partial-JSON yield"
  - "stop_reason read from message_delta events only (not content_block events)"

patterns-established:
  - "Normalized event dict: {type:delta}, {type:tool_start}, {type:finish} — same schema as OpenAI path"
  - "Multiple consecutive tool results grouped into ONE user message (Anthropic 400 prevention)"
  - "System messages stripped from messages array; passed via top-level system param with cache_control"

requirements-completed: [GEN-02]

# Metrics
duration: 15min
completed: 2026-04-26
---

# Phase 054-03: Create anthropic_service.py Summary

**Native Anthropic SDK streaming adapter with message format conversion, tool arg buffering, and prompt caching — all 14 unit tests GREEN**

## Performance

- **Duration:** 15 min
- **Started:** 2026-04-26T18:05:00Z
- **Completed:** 2026-04-26T18:13:00Z
- **Tasks:** 1
- **Files modified:** 1 (created)

## Accomplishments
- Created `backend/app/services/anthropic_service.py` with `stream_anthropic`, `_convert_messages_to_anthropic`, `_convert_tools_to_anthropic`
- All 14 `test_anthropic_service.py` tests transition from SKIP to GREEN
- Tool arguments buffered until `content_block_stop` — no partial JSON yielded
- Multiple consecutive `role:"tool"` messages correctly bundled into ONE user message (prevents Anthropic 400)
- Prompt caching applied to system prompt and last tool via `cache_control: {type: ephemeral}`

## Task Commits

1. **Task 1: Create anthropic_service.py** - `538987b` (feat)

## Files Created/Modified
- `backend/app/services/anthropic_service.py` — Native SDK adapter: stream_anthropic, _convert_messages_to_anthropic, _convert_tools_to_anthropic

## Decisions Made
- Executed inline (orchestrator) after agent failed due to missing Bash access in worktree
- Used the plan's exact implementation blueprint from 054-PATTERNS.md

## Deviations from Plan
None — plan executed exactly as written. File content matches 054-03-PLAN.md action block verbatim.

## Issues Encountered
- Agent spawned for this plan failed immediately (no Bash access in worktree environment); executed inline instead
- anthropic SDK not yet installed when tests ran; installed it directly before verification

## Next Phase Readiness
- `anthropic_service.py` is ready to be imported by `threads.py` dispatch (054-04)
- 14 GEN-02 unit tests are GREEN
- `stream_anthropic` yields the exact normalized event schema that threads.py already consumes

---
*Phase: 054-reliable-agentic-generation*
*Completed: 2026-04-26*
