---
phase: 083-foundation-tool-dispatch-extraction-bug-fixes
plan: 02
subsystem: frontend
tags: [bug-fix, output-files, react-key, timer, reload]
dependency_graph:
  requires: []
  provides: [finalOutputFiles-db-reconstruction, stable-react-key-run-id]
  affects: [MessageItem, RunCard, ToolCallPanel]
tech_stack:
  added: []
  patterns: [JSON.parse-defensive, conditional-react-key]
key_files:
  created: []
  modified:
    - frontend/src/lib/api.ts
    - frontend/src/components/chat/MessageList.tsx
decisions:
  - "D-05: Reconstruct finalOutputFiles from tool_calls JSONB client-side, zero schema change"
  - "D-07: Use run_id as stable React key for assistant messages with runs"
metrics:
  duration: 211s
  completed: 2026-05-28
---

# Phase 083 Plan 02: Frontend Bug Fixes (Output Files + Timer) Summary

**One-liner:** Reconstruct sandbox output files from persisted tool_calls on DB load + stabilize React key with run_id to prevent timer unmount mid-cycle.

## What Was Done

### Task 1: Reconstruct finalOutputFiles from tool_calls JSONB (BUG-260526-03 / D-05)
- Added output file reconstruction logic in `_mapMessageResponse` in `frontend/src/lib/api.ts`
- Scans persisted `tool_calls` array for `execute_code` results containing `output_files`
- Defensive `JSON.parse` with try/catch -- malformed results silently skipped
- Only processes `execute_code` tool calls (other tools lack `output_files`)
- Guards on `f.filename` being truthy to skip malformed entries
- Sets `mapped.finalOutputFiles` only when files exist (preserves empty-state guard in MessageItem)
- **Commit:** `cb02bb1`

### Task 2: Use run_id as stable React key for streaming assistant messages (BUG-260526-04 / D-07)
- Changed `key={msg.id}` to `key={msg.role === "assistant" && msg.runId ? \`run-${msg.runId}\` : msg.id}` in `frontend/src/components/chat/MessageList.tsx`
- Prevents React unmount/remount of MessageItem (and child RunCard) when temp-id swaps to DB UUID mid-run
- Timer, expanded state, and thinking block state preserved across the id transition
- Falls back to `msg.id` for user messages and pre-run-backed assistant messages
- **Commit:** `890efa5`

## Verification Results

| Check | Result |
|-------|--------|
| `MessageItem.finalOutputs.test.tsx` (5 tests) | PASS |
| `grep "finalOutputFiles" frontend/src/lib/api.ts` | Shows reconstruction logic |
| `grep "run-.*runId" frontend/src/components/chat/MessageList.tsx` | Shows stable key pattern |
| No standalone `key={msg.id}` on MessageItem | Confirmed |
| Full frontend test suite | 306 pass / 17 fail (all pre-existing) |

Pre-existing test failures (17) are all in `streamsProvider.test.tsx`, `streamsProvider_075_9_clientkey.test.tsx`, `model-info.test.ts`, `MessageItem.test.tsx` (streaming indicator), `Plan04.frontend.test.tsx`, `useMessages.test.ts`, `StreamsProvider.dedup.test.ts` -- none related to the changes in this plan.

## Deviations from Plan

None -- plan executed exactly as written.

## Known Stubs

None.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | cb02bb1 | fix(083-02): reconstruct finalOutputFiles from tool_calls JSONB on DB load |
| 2 | 890efa5 | fix(083-02): use run_id as stable React key for streaming assistant messages |

## Self-Check: PASSED

- [x] frontend/src/lib/api.ts exists
- [x] frontend/src/components/chat/MessageList.tsx exists
- [x] 083-02-SUMMARY.md exists
- [x] Commit cb02bb1 found
- [x] Commit 890efa5 found
