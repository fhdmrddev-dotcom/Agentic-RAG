---
phase: 32-suggested-follow-up-questions
plan: 01
subsystem: api
tags: [fastapi, sse, openai, suggestions, follow-up-questions]

# Dependency graph
requires:
  - phase: 25-sub-agent-intelligence
    provides: _SUB_AGENT_MODEL_DEFAULTS and model resolution pattern (cheapest model per provider)
provides:
  - suggestion_service.py with generate_suggestions function using cheapest-model-per-provider resolution
  - threads.py SSE stream emits JSON done -> optional suggestions -> stream_end (replaces literal [DONE])
  - 6 unit tests for generate_suggestions covering all model resolution paths and error isolation
affects:
  - 32-02 (frontend plan consuming suggestions SSE event)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Non-blocking post-response generation: inline try/except with bare pass after main stream done"
    - "Lazy service import inside try block (suggestion_service imported only at suggestion time)"
    - "JSON SSE event sequence: done -> suggestions (optional) -> stream_end"

key-files:
  created:
    - backend/app/services/suggestion_service.py
    - backend/tests/unit/test_suggestions.py
  modified:
    - backend/app/api/threads.py

key-decisions:
  - "Inline import of suggestion_service inside try block — no module-level dependency, consistent with Phase 14 lazy import pattern"
  - "body.content used as user_message parameter in generate_suggestions — accessible in event_stream closure"
  - "stream_end replaces [DONE] as the true end-of-stream sentinel — done now marks main response complete only"

patterns-established:
  - "Post-response non-blocking generation: wrap in try/except Exception: pass after done event, before stream_end"

requirements-completed: [SUG-03, SUG-04]

# Metrics
duration: 8min
completed: 2026-04-15
---

# Phase 32 Plan 01: Suggestion Service — Backend Summary

**SSE stream timeline upgraded from literal [DONE] to JSON done -> suggestions (cheap model) -> stream_end, with suggestion failures isolated behind try/except**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-15T17:36:18Z
- **Completed:** 2026-04-15T17:44:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created `suggestion_service.py` with `generate_suggestions` using the same 4-level model resolution chain as `sub_agent_service` (env override > provider default > user model > server default)
- Replaced `yield "data: [DONE]\n\n"` with a three-phase JSON sequence: `done` (main response complete), optional `suggestions` event, then `stream_end`
- Suggestion failures are fully isolated — any exception is swallowed and stream_end always emits
- 6 unit tests cover all model resolution paths, output parsing edge cases (clamping to 3, blank line filtering), and exception propagation

## Task Commits

Each task was committed atomically:

1. **Task 1: Create suggestion_service.py and unit tests** - `8bc7b0d` (feat)
2. **Task 2: Update threads.py SSE stream timeline** - `92c36d3` (feat)

**Plan metadata:** (docs commit to follow)

## Files Created/Modified
- `backend/app/services/suggestion_service.py` - generate_suggestions function with cheapest-model resolution, 200-token non-streaming call, line-split parsing clamped to 3
- `backend/tests/unit/test_suggestions.py` - 6 unit tests for suggestion generation and failure isolation
- `backend/app/api/threads.py` - SSE stream end sequence replaced: [DONE] -> done -> suggestions (optional) -> stream_end

## Decisions Made
- Inline import of `suggestion_service` inside the try block — no module-level dependency, consistent with Phase 14 lazy import pattern for optional features
- `body.content` used as `user_message` parameter — accessible in event_stream closure without additional variable
- `stream_end` replaces `[DONE]` as the true end-of-stream sentinel — `done` now only marks when main response text is complete (frontend can hide streaming cursor earlier)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Self-Check: PASSED

All files exist, all commits verified.

## Next Phase Readiness

- Backend SSE stream now emits `suggestions` event with `questions: string[]` after each response
- Frontend (Plan 32-02) can listen for `suggestions` event type and render clickable pill buttons
- No database changes required
- Suggestion generation failure does not affect main response (SUG-04 isolation confirmed)

---
*Phase: 32-suggested-follow-up-questions*
*Completed: 2026-04-15*
