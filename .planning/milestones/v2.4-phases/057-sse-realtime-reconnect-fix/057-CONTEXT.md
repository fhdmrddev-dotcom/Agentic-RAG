---
phase: 57
slug: sse-realtime-reconnect-fix
status: ready_to_plan
created: 2026-04-29
---

# Phase 57: SSE Realtime Reconnect Fix — Context

## Goal

After a stream ends or the page is refreshed mid-stream, the assistant message is always visible. No empty threads, no silent data loss.

## Requirements

- STREAM-02: Realtime recovery on navigate / refresh

## Background

This phase resolves the two remaining failures from Phase 55 (deferred after 5 fix attempts) and Phase 56 (console.log tracing added but not fixed).

## Root Cause — Confirmed 2026-04-29 via browser console trace

### Symptom E: Tab switch during stream → empty thread on return

**Trace evidence:** `clearMessages` fires twice from `ChatArea.tsx` `!thread` branch (React Strict Mode, harmless). `loadMessages` fires after thread auto-selects (outside capture window). Stream completes but message may not appear.

**Root cause:** The Realtime INSERT from the backend fires **while `isStreamingRef.current = true`** (backend runs `_persist_assistant_message()` before yielding `done`). The guard `if (isStreamingRef.current) return` blocks the INSERT. Then `finally` sets `isStreamingRef = false` — but the INSERT event is already gone (no retry mechanism). The 2s delayed `removeChannel` from Phase 56 Plan 03 only helps INSERTs that arrive *after* `isStreamingRef = false`. This INSERT arrived before.

**Fix:** In `finally`, after `isStreamingRef.current = false`, call `loadMessages(threadId)` directly. Guard with thread identity (`activeThreadIdRef.current === threadId`) and `!stoppedByUserRef.current`. One extra DB round-trip per natural stream completion — replaces the unreliable "catch INSERT via Realtime" approach entirely.

### Symptom F: Page refresh mid-stream → empty thread after reload

**Trace evidence:** Stack trace shows both `clearMessages` calls come from `ChatArea.tsx:70` (`if (!thread) { clearMessages(); return }` branch). This is the initial no-thread state. The Realtime channel does NOT exist on fresh page load — it is only created inside `sendMessage`.

**Root cause:** On fresh page load, `loadMessages` runs ~100ms after mount and hits the DB while the backend is still generating (user refreshed mid-stream). The assistant message isn't there yet. The backend persists it ~5s later via `asyncio.shield` — but no Realtime channel is listening. The channel is only created inside `sendMessage`, never on thread selection.

**Fix:** Set up a Realtime subscription for `messages INSERT` whenever a thread is selected (in `useEffect([thread?.id])` in ChatArea, or inside a new `subscribeToThread(threadId)` function in `useMessages`). Tear down on thread change. Cost: one persistent Realtime channel per viewed thread (negligible).

## Key Files

| File | Relevance |
|------|-----------|
| `frontend/src/hooks/useMessages.ts` | `finally` block (Fix E) + new subscription logic (Fix F) |
| `frontend/src/components/chat/ChatArea.tsx` | `useEffect([thread?.id])` at line 68 — where Fix F subscription should live |

## Constraints (Locked)

- **D-STREAM-01:** Do NOT add more guards to the Realtime callback — confirmed root cause is NOT in the callback. All 5 Phase 55 attempts added callback guards and failed.
- **D-STREAM-02:** The `loadMessages` call in `finally` (Fix E) MUST be guarded by thread identity. Attempt 3 in Phase 55 failed because `loadMessages(oldThreadId)` fired after user navigated to a new thread, overwriting it. The guard is: `activeThreadIdRef.current === threadId && !stoppedByUserRef.current`.
- **D-STREAM-03:** `isStreamingRef.current = false` must be set BEFORE the `loadMessages` call in `finally` (already the case — just keep order).
- **D-STREAM-04:** Phase 56 `[Phase56-Realtime]` console.log statements should be removed in this phase once the fix is confirmed working (they were diagnostic-only per T-56-14).

## Prior Fix Attempts (DO NOT REPEAT)

From 055-DEFERRAL.md — all failed:
1. `stoppedByUserRef` guard in Realtime callback
2. `navigatedAwayRef` guard in Realtime callback  
3. `loadMessages` in `finally` without thread identity guard → overwrites new thread
4. `completedNormally` flag — not browser-tested
5. `activeThreadIdRef` guard in Realtime callback — logic correct but wrong layer

## Success Criteria

1. Send a multi-tool query. While streaming, switch to another tab for 5s, switch back. The complete assistant message is visible without a manual refresh.
2. Send a multi-tool query. While streaming, press F5. After the page reloads and the thread auto-selects, the complete assistant message appears within ~5s (time for backend to finish + DB persist).
3. Clicking Stop mid-stream does NOT trigger a `loadMessages` reload — stopped messages are already persisted via Phase 55's `asyncio.shield`.
4. Navigating to a different thread during a stream does NOT overwrite the new thread's messages with the old thread's data.
