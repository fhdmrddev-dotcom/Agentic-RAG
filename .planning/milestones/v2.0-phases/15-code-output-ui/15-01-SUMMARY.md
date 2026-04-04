---
phase: 15-code-output-ui
plan: "01"
subsystem: ui
tags: [react, typescript, sse, streaming, code-execution]

# Dependency graph
requires:
  - phase: 14-code-execution-sandbox
    provides: "SSE events code_execution_start/stdout/stderr/complete emitted by backend execute_code handler"
provides:
  - "OutputLine and OutputFile interfaces in types/index.ts"
  - "Extended ToolCall type with outputLines, outputFiles, exitCode, executionDurationMs, errorMessage fields"
  - "Four new SSE callback params in streamMessage(): onCodeExecutionStart, onCodeStdout, onCodeStderr, onCodeExecutionComplete"
  - "Four SSE parse branches in api.ts for code execution events"
  - "Live stdout/stderr accumulation in useMessages.ts via functional setMessages updater"
affects: [15-02-code-output-ui-components]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single outputLines array with {kind, content} entries preserves interleaved stdout/stderr arrival order"
    - "onCodeExecutionComplete sets metadata fields only; tool_end fires after and sets status=done via existing onToolEnd"

key-files:
  created: []
  modified:
    - frontend/src/types/index.ts
    - frontend/src/lib/api.ts
    - frontend/src/hooks/useMessages.ts

key-decisions:
  - "Single outputLines array (not separate stdout/stderr arrays) to preserve interleaved arrival order — key research finding from 15-RESEARCH.md"
  - "onCodeExecutionComplete does NOT set status=done — tool_end event handles that via existing onToolEnd callback"
  - "onCodeExecutionStart is a no-op (undefined) in useMessages — tool_start already creates the ToolCall entry"

patterns-established:
  - "SSE callback extension pattern: add optional param to streamMessage, add else-if branch in parse loop, wire callback in useMessages"

requirements-completed: [SAND-12]

# Metrics
duration: 2min
completed: 2026-04-03
---

# Phase 15 Plan 01: Code Output UI Data Layer Summary

**Four code execution SSE events (start/stdout/stderr/complete) wired through streamMessage() into interleaved outputLines accumulation on the running execute_code ToolCall in React state**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-03T14:55:19Z
- **Completed:** 2026-04-03T14:57:05Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Extended ToolCall type with OutputLine/OutputFile interfaces and five optional code execution fields (outputLines, outputFiles, exitCode, executionDurationMs, errorMessage)
- Added four new SSE callback parameters to streamMessage() and corresponding parse branches for code_execution_start/stdout/stderr/complete events
- Wired all four callbacks in useMessages.ts using functional setMessages updaters, accumulating stdout/stderr as interleaved outputLines on the running execute_code ToolCall

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend ToolCall type with code execution fields** - `f2c7a08` (feat)
2. **Task 2: Add SSE parsing and useMessages wiring for code execution events** - `db92060` (feat)

**Plan metadata:** (see final commit)

## Files Created/Modified
- `frontend/src/types/index.ts` - Added OutputLine, OutputFile interfaces; extended ToolCall with 5 code execution fields
- `frontend/src/lib/api.ts` - Imported OutputFile; added 4 new callback params and 4 SSE parse branches
- `frontend/src/hooks/useMessages.ts` - Imported OutputLine/OutputFile; wired 4 new callbacks with functional setMessages accumulation

## Decisions Made
- Used single `outputLines` array with `{kind, content}` entries (not separate arrays) to preserve interleaved stdout/stderr arrival order — the key research finding from 15-RESEARCH.md "Common Pitfalls" section
- `onCodeExecutionComplete` does NOT set `status: "done"` — that remains the responsibility of the existing `onToolEnd` callback when `tool_end` fires after completion
- `onCodeExecutionStart` is passed as `undefined` to streamMessage — `tool_start` already creates the ToolCall entry so no duplicate action is needed

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Data layer complete: ToolCall objects in React state will carry live streaming outputLines and completion metadata
- Plan 02 (ExecuteCodeBlock component) can now consume outputLines, exitCode, executionDurationMs, outputFiles, and errorMessage from ToolCall to render the code execution UI
- No blockers for Plan 02

## Self-Check: PASSED

- FOUND: .planning/phases/15-code-output-ui/15-01-SUMMARY.md
- FOUND: frontend/src/types/index.ts
- FOUND: frontend/src/lib/api.ts
- FOUND: frontend/src/hooks/useMessages.ts
- FOUND commit: f2c7a08 (Task 1)
- FOUND commit: db92060 (Task 2)

---
*Phase: 15-code-output-ui*
*Completed: 2026-04-03*
