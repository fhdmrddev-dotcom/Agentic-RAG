---
phase: 057-sse-realtime-reconnect-fix
plan: "01"
subsystem: ui
tags: [react, sse, realtime, supabase, hooks, streaming]

# Dependency graph
requires:
  - phase: 056-agent-real-time-feedback
    provides: Realtime subscription with isStreamingRef guard and 2s delayed removeChannel
  - phase: 055-streaming-reliability-connection-resilience
    provides: asyncio.shield for partial response persistence on Stop

provides:
  - activeThreadIdRef tracking in useMessages hook for thread-identity guard
  - loadMessages call in finally block after natural stream completion
  - Guaranteed DB reload replacing unreliable "catch INSERT via Realtime" approach
  - Removal of Phase 56 diagnostic console.log statements

affects:
  - 057-02 (human-verify checkpoint for Symptom E manual verification)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "finally-block DB reload pattern: call loadMessages after isStreamingRef=false to catch missed Realtime INSERTs"
    - "activeThreadIdRef guard: synchronously track active threadId before await to prevent cross-thread overwrites"

key-files:
  created: []
  modified:
    - frontend/src/hooks/useMessages.ts

key-decisions:
  - "Replace unreliable Realtime INSERT catch with guaranteed DB reload in finally block — Realtime INSERT fires while isStreamingRef=true so guard blocks it; event is gone by the time isStreamingRef=false"
  - "activeThreadIdRef set synchronously before await in loadMessages so thread navigation mid-flight is immediately visible to the guard"
  - "Guard !stoppedByUserRef.current in non-stopped branch is belt-and-suspenders — wasStoppedByUser is already false in that branch"

patterns-established:
  - "D-STREAM-01/D-STREAM-02: After natural stream completion, reload from DB rather than relying on Realtime events that may have arrived while streaming guard was active"

requirements-completed:
  - STREAM-02

# Metrics
duration: 2min
completed: 2026-04-29
---

# Phase 057 Plan 01: SSE Realtime Reconnect Fix — activeThreadIdRef + finally-block loadMessages

**Replaced unreliable Realtime-INSERT catch with a guaranteed DB reload in the finally block of sendMessage, guarded by activeThreadIdRef thread-identity check, fixing Symptom E (blank screen after tab-switch during stream)**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-29T20:05:22Z
- **Completed:** 2026-04-29T20:07:07Z
- **Tasks:** 2 (1 implementation + 1 verification)
- **Files modified:** 1

## Accomplishments

- Added `activeThreadIdRef` ref to `useMessages` hook, set synchronously before the `await getMessages()` call in `loadMessages` so thread navigation mid-flight is captured correctly
- Added `loadMessages(threadId)` call in the non-stopped `finally` branch of `sendMessage`, guarded by `activeThreadIdRef.current === threadId && !stoppedByUserRef.current` (prevents overwriting a newly-navigated thread, skips the stop path handled by asyncio.shield)
- Removed all 6 `[Phase56-Realtime]` diagnostic console.log statements per D-STREAM-04
- TypeScript compiles clean (0 errors)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add activeThreadIdRef and wire loadMessages into finally** - `d1d7c6c` (feat)
2. **Task 2: Verify TypeScript compiles and grep-check invariants** - (verification only, no new files changed)

## Files Created/Modified

- `frontend/src/hooks/useMessages.ts` — Added `activeThreadIdRef` ref declaration, synchronous `activeThreadIdRef.current = threadId` at top of `loadMessages`, `loadMessages(threadId)` call in non-stopped finally branch with thread-identity guard, removed all [Phase56-Realtime] console.log statements

## Decisions Made

- Guard uses `activeThreadIdRef.current === threadId` (not `streamingThreadIdRef`) because `streamingThreadIdRef` is already cleared to `null` by the time the `setMessages` callback fires in `finally` — `activeThreadIdRef` persists until `loadMessages` itself sets it to a new thread
- `!stoppedByUserRef.current` guard in non-stopped branch is defensive (wasStoppedByUser is already false there) but provides explicit intent documentation
- The `loadMessages` call is placed inside the `setMessages` callback's `if (!wasStoppedByUser)` branch, after `isStreamingRef.current = false` — preserves D-STREAM-03 ordering requirement

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None — TypeScript compiled clean on first pass, all invariant checks passed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 02 (human-verify checkpoint) is ready — the UI changes required for Symptom E verification are in place
- `activeThreadIdRef` guard and DB reload path are wired; Plan 02 will confirm the fix works end-to-end via manual browser testing

---

## Self-Check

**Files exist:**
- `frontend/src/hooks/useMessages.ts` — FOUND (modified)

**Commits exist:**
- `d1d7c6c` — FOUND (feat(057-01): add activeThreadIdRef guard and finally-block loadMessages for Symptom E fix)

**Invariants verified:**
- `grep -c "Phase56-Realtime"` → 0 (PASS)
- `activeThreadIdRef.current === threadId` guard present at line 448 (PASS)
- `isStreamingRef.current = false` at line 384 < `loadMessages(threadId)` at line 449 (PASS)
- `npx tsc --noEmit` → 0 TypeScript errors (PASS)

## Self-Check: PASSED

---
*Phase: 057-sse-realtime-reconnect-fix*
*Completed: 2026-04-29*
