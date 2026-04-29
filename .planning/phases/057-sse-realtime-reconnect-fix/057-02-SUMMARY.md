---
phase: 057-sse-realtime-reconnect-fix
plan: "02"
subsystem: ui
tags: [react, supabase, realtime, hooks, streaming, sse, pgvector]

# Dependency graph
requires:
  - phase: 057-sse-realtime-reconnect-fix
    plan: "01"
    provides: activeThreadIdRef guard and finally-block loadMessages for Symptom E (tab-switch fix)
  - phase: 056-agent-real-time-feedback
    provides: isStreamingRef guard pattern and channelRef Realtime subscription in useMessages

provides:
  - threadChannelRef always-on Realtime subscription per viewed thread
  - subscribeToThread(threadId) callback exposed from useMessages hook
  - unsubscribeFromThread() callback exposed from useMessages hook
  - ChatArea useEffect([thread?.id]) wired with subscribe/unsubscribe lifecycle

affects:
  - Manual human-verify checkpoint (Test E, F, G, H) for Symptom E/F confirmation

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Always-on Realtime subscription pattern: threadChannelRef created on thread selection, torn down on thread change/unmount, with isStreamingRef guard to skip live SSE updates"
    - "Dual-channel coexistence: channelRef (per-stream, torn down in finally) + threadChannelRef (per-thread, torn down on navigation) serve different lifecycles without conflict"
    - "loadMessages-on-INSERT for recovery: INSERT events trigger a full DB reload rather than trusting Realtime payload data directly"

key-files:
  created: []
  modified:
    - frontend/src/hooks/useMessages.ts
    - frontend/src/components/chat/ChatArea.tsx

key-decisions:
  - "Use separate threadChannelRef (not channelRef) for always-on subscription so the two lifecycles (per-stream vs per-thread) remain independent and non-conflicting"
  - "Call loadMessages inside setMessages callback on INSERT event so deduplication check runs synchronously before triggering a reload"
  - "subscribeToThread placed after loadMessages in ChatArea useEffect — order is functionally independent but cleaner sequentially"
  - "!thread branch calls unsubscribeFromThread() explicitly so the channel is torn down when the user has no thread selected (e.g., last thread deleted)"

patterns-established:
  - "D-STREAM-FIX-F: Always-on Realtime subscription in ChatArea useEffect([thread?.id]) catches asyncio.shield-persisted messages after page refresh"

requirements-completed:
  - STREAM-02

# Metrics
duration: 8min
completed: 2026-04-29
---

# Phase 057 Plan 02: SSE Realtime Reconnect Fix — Always-on Realtime Subscription per Thread

**Always-on Supabase Realtime INSERT subscription per viewed thread, exposed via subscribeToThread/unsubscribeFromThread in useMessages and wired into ChatArea's thread-selection useEffect, fixing Symptom F (complete assistant message appears after F5 mid-stream)**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-29T20:10:00Z
- **Completed:** 2026-04-29T20:18:00Z
- **Tasks:** 2 auto + 1 checkpoint
- **Files modified:** 2

## Accomplishments

- Added `threadChannelRef` (second Realtime channel ref, independent from `channelRef` used by `sendMessage`) to `useMessages`
- Added `subscribeToThread(threadId)` callback: creates `thread-always-on-{threadId}` Realtime channel, listens for INSERT events, guards with `isStreamingRef.current`, deduplicates, and calls `loadMessages` on fresh inserts
- Added `unsubscribeFromThread()` callback: tears down `threadChannelRef` with `supabase.removeChannel`
- Updated `UseMessages` interface with two new typed fields
- Wired both callbacks into `ChatArea`'s `useEffect([thread?.id])`: subscribe after `loadMessages`, unsubscribe in `!thread` branch and in cleanup return function
- TypeScript compiles with 0 errors across both files

## Task Commits

Each task was committed atomically:

1. **Task 1: Add subscribeToThread/unsubscribeFromThread to useMessages** - `bc17aa9` (feat)
2. **Task 2: Wire subscribeToThread into ChatArea useEffect([thread?.id])** - `c88fbe3` (feat)
3. **Task 3: Checkpoint — human verify** - (awaiting human verification)

## Files Created/Modified

- `frontend/src/hooks/useMessages.ts` — Added `threadChannelRef` ref, `subscribeToThread` and `unsubscribeFromThread` useCallback functions, updated `UseMessages` interface, updated return statement
- `frontend/src/components/chat/ChatArea.tsx` — Updated destructuring to include new functions, updated thread-selection useEffect with subscribe/unsubscribe lifecycle

## Decisions Made

- Separate `threadChannelRef` from `channelRef` so the per-stream SSE recovery subscription (torn down in `finally`) and the always-on thread subscription (torn down on navigation) have fully independent lifecycles
- On INSERT: call `loadMessages` inside `setMessages` callback for atomic deduplication check before triggering reload — avoids stale closure issues
- `subscribeToThread` placed after `loadMessages` in effect body for clarity; subscription setup is non-blocking and independent
- The `justCreatedThreadRef` early-return path intentionally does NOT subscribe — `sendMessage`'s `channelRef` already handles that thread during the initial stream

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None — TypeScript compiled clean on first pass, all invariant checks passed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Tasks 1 and 2 are complete and committed. The checkpoint task (Task 3) requires human browser verification.
- Tests to verify: E (tab switch during stream), F (F5 mid-stream), G (Stop does not trigger extra reload), H (thread navigation guard)
- Once checkpoint passes, Phase 057 is complete and STREAM-02 is fully validated

---

## Self-Check

**Files exist:**
- `frontend/src/hooks/useMessages.ts` — FOUND (modified)
- `frontend/src/components/chat/ChatArea.tsx` — FOUND (modified)

**Commits exist:**
- `bc17aa9` — feat(057-02): add subscribeToThread/unsubscribeFromThread to useMessages
- `c88fbe3` — feat(057-02): wire subscribeToThread into ChatArea useEffect([thread?.id])

**Invariants verified:**
- `grep -c "Phase56-Realtime" useMessages.ts` → 0 (PASS)
- `threadChannelRef` declared and used in both subscribe/unsubscribe callbacks (PASS)
- `isStreamingRef.current` guard present in `subscribeToThread` callback (PASS)
- `subscribeToThread` in ChatArea useEffect dependency array (PASS)
- `unsubscribeFromThread` returned from useEffect cleanup (PASS)
- `npx tsc --noEmit` → 0 TypeScript errors (PASS)

## Self-Check: PASSED

---
*Phase: 057-sse-realtime-reconnect-fix*
*Completed: 2026-04-29*
