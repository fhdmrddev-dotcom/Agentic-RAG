---
phase: 15-code-output-ui
plan: "02"
subsystem: ui
tags: [react, typescript, streaming, code-execution, terminal-output]

# Dependency graph
requires:
  - phase: 15-code-output-ui
    plan: "01"
    provides: "ToolCall type with outputLines/outputFiles/exitCode/executionDurationMs/errorMessage fields; SSE callbacks wired in useMessages"
provides:
  - "ExecuteCodeBlock component: rich code execution panel with streaming terminal output, file download cards, status states"
  - "ToolCallPanel dispatch branch: execute_code tool routes to ExecuteCodeBlock, all other tools unchanged"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Reload fallback parsing: derive exitCode/executionDurationMs/outputFiles from tc.result JSON when ephemeral fields are absent"
    - "Auto-scroll: check scrollHeight - scrollTop - clientHeight < 24 threshold before auto-scrolling to avoid fighting user scroll"
    - "Internal sub-components (OutputFileCard, TerminalOutput) not exported — encapsulation within ExecuteCodeBlock"

key-files:
  created:
    - frontend/src/components/chat/ExecuteCodeBlock.tsx
  modified:
    - frontend/src/components/chat/ToolCallPanel.tsx

key-decisions:
  - "Reload fallback parses tc.result JSON for exitCode/executionDurationMs/outputFiles when live ephemeral fields are absent — supports reloaded conversation messages"
  - "terminalOpen defaults to true — terminal expanded during execution and after, collapsible post-completion"
  - "No outer card wrapper in ExecuteCodeBlock — ToolCallPanel's existing card container is reused"
  - "execute_code dispatch uses ternary (not early return) inside map loop — keeps connecting line (i > 0 divider) shared between branches"

patterns-established:
  - "Tool dispatch pattern: tc.name === 'tool_name' ternary inside map loop with else branch preserving all existing generic rendering"

requirements-completed: [SAND-12]

# Metrics
duration: 2min 1sec
completed: 2026-04-03
---

# Phase 15 Plan 02: Code Output UI Components Summary

**ExecuteCodeBlock component with streaming terminal output and file download cards wired into ToolCallPanel dispatch for execute_code tool calls**

## Performance

- **Duration:** 2 min 1 sec
- **Started:** 2026-04-03T14:59:51Z
- **Completed:** 2026-04-03T15:01:52Z
- **Tasks completed:** 2 of 3 (Task 3 is a human checkpoint — awaiting browser verification)
- **Files created/modified:** 2

## Accomplishments

- Created `ExecuteCodeBlock.tsx` — full code execution UI with TerminalOutput (auto-scroll, green stdout, red stderr, streaming cursor), OutputFileCard (download link, filename, formatted size), Python badge, Loader2/CheckCircle2/XCircle status indicators, error message display, and reload fallback parsing from `tc.result` JSON
- Updated `ToolCallPanel.tsx` — added Terminal icon, execute_code to toolIcon/toolLabel/toolIconColor, dispatch branch routing execute_code tool calls to ExecuteCodeBlock while leaving all other tools on the existing generic path unchanged

## Task Commits

Each task was committed atomically:

1. **Task 1: Create ExecuteCodeBlock component** - `f28e863` (feat)
2. **Task 2: Wire ExecuteCodeBlock into ToolCallPanel dispatch** - `dea4a0e` (feat)

## Files Created/Modified

- `frontend/src/components/chat/ExecuteCodeBlock.tsx` — New component (182 lines): TerminalOutput, OutputFileCard, ExecuteCodeBlock with all 4 execution states
- `frontend/src/components/chat/ToolCallPanel.tsx` — Updated: Terminal import, ExecuteCodeBlock import, execute_code branches in toolIcon/toolLabel/toolIconColor, dispatch ternary in map loop

## Decisions Made

- Reload fallback parses `tc.result` JSON for `exitCode`/`executionDurationMs`/`outputFiles` when live ephemeral fields are absent — required for messages loaded from history where streaming state is gone
- `terminalOpen` state defaults to `true` — terminal always visible during execution; user can collapse post-completion
- `ExecuteCodeBlock` renders without outer card wrapper — ToolCallPanel's existing card div is the container, same as all other tool rows
- Dispatch uses ternary inside the map loop rather than an early return — ensures the connecting line `<div>` (`i > 0`) is shared by both branches

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Checkpoint Status

**Task 3 (checkpoint:human-verify)** is pending human browser verification. See checkpoint details below.

**Verification steps:**
1. Start backend: `cd backend && SANDBOX_ENABLED=true python -m uvicorn app.main:app --reload`
2. Start frontend: `cd frontend && npm run dev`
3. Open chat UI in browser
4. Send: "Write a Python script that prints numbers 1 to 5 and writes them to a file called numbers.txt"
5. Verify: Python badge, spinner while running, streaming green stdout lines, checkmark on success, download card for numbers.txt
6. Send: "Run this Python code: raise Exception('test error')" — verify red XCircle, red error message
7. Verify existing tools (search_documents, ls, etc.) still render normally

## Known Stubs

None — all data is wired from live ToolCall fields with reload fallback.

## Self-Check: PASSED

- FOUND: frontend/src/components/chat/ExecuteCodeBlock.tsx
- FOUND: frontend/src/components/chat/ToolCallPanel.tsx (modified)
- FOUND commit: f28e863 (Task 1)
- FOUND commit: dea4a0e (Task 2)

---
*Phase: 15-code-output-ui*
*Completed (partial — awaiting Task 3 human verify): 2026-04-03*
