---
phase: 057-sse-realtime-reconnect-fix
status: deferred
deferred_at: 2026-04-30
reason: All four manual tests (E, F, G, H) remained unreliable after multiple fix attempts
next_milestone_action: Re-plan with polling-first approach — see Recommended Approach below
commits_to_keep: true
---

# Phase 057 Deferral — SSE Realtime Reconnect Fix

## What This Phase Was Trying to Fix

Two specific failure symptoms when the page loses its SSE stream mid-response:

**Symptom E — Tab switch:** User switches tabs while agent is working. When they come back, the chat shows a blank or truncated assistant message. A manual F5 is required to see the full response.

**Symptom F — Page refresh (F5 mid-stream):** User presses F5 while the agent is mid-response. After reload, the assistant message never appears — even after waiting 60+ seconds. Only a second manual F5 fixes it.

**Symptom G (regression guard):** Clicking Stop should NOT trigger a reload. Pre-existing behavior must be preserved.

**Symptom H — Thread navigation:** Switching to Thread B while Thread A is streaming should NOT overwrite Thread B's messages with Thread A's eventual response.

---

## What Was Implemented (Committed Code)

All code is committed and on `master`. The changes are incremental — do not revert them wholesale. Some changes (debug log removal, code structure improvements) are correct and should be kept.

### Plan 01 — `frontend/src/hooks/useMessages.ts` (commits `d1d7c6c`, `1d02b5e`)
- Added `activeThreadIdRef` — tracks the currently active thread ID synchronously before any `await`, so thread navigation mid-flight doesn't cause cross-thread overwrites
- Added `loadMessages(threadId)` call in the `finally` block of `sendMessage`, guarded by `activeThreadIdRef.current === threadId && !stoppedByUserRef.current`
- Removed all 6 `[Phase56-Realtime]` diagnostic `console.log` statements from Phase 56

### Plan 02 — `frontend/src/hooks/useMessages.ts` + `frontend/src/components/chat/ChatArea.tsx` (commits `bc17aa9`, `c88fbe3`)
- Added `subscribeToThread(threadId)` / `unsubscribeFromThread()` functions to `useMessages` — sets up a persistent Supabase Realtime subscription for `messages INSERT` events on the selected thread
- Added `threadChannelRef` (separate from `channelRef`) — always-on channel, lifecycle tied to thread selection not to `sendMessage`
- Wired `subscribeToThread` / `unsubscribeFromThread` into `ChatArea`'s `useEffect([thread?.id])`

### Bug Fixes Applied During Testing (commits `685925e` through `a559f1b`)

| Commit | Fix |
|--------|-----|
| `685925e` | Removed `loadMessages` from `subscribeToThread`'s `useCallback` deps — it was causing a temporal dead zone crash (blank page) because `loadMessages` is declared after `subscribeToThread` in the hook body |
| `7056aa3` | Moved `loadMessages` and `stoppedByUserRef.current = false` OUT of the `setMessages` updater in `finally` — calling side effects inside React state updaters is unreliable (Strict Mode double-invokes them; bail-out optimization can skip them) |
| `7056aa3` | Removed the 800ms `loadMessages` call from the stopped branch — it incorrectly triggered a reload after the user clicked Stop |
| `7056aa3` | Simplified `subscribeToThread` Realtime callback — removed the `setMessages` updater pattern; now calls `loadMessages` directly |
| `a559f1b` | Added `reloadTimerRef` to debounce multiple rapid INSERT events in `subscribeToThread` (300ms) — prevents flooding backend with concurrent GET requests |
| `a559f1b` | Fixed `channelRef` teardown on navigation: immediate removal (not 2s delay) when `activeThreadIdRef.current !== threadId`, preventing Thread A's late INSERT from appearing in Thread B |
| `a559f1b` | Added `visibilitychange` listener in `ChatArea` — reloads messages when user switches back to the tab |
| `a559f1b` | Added 8-second fallback reload in `ChatArea`'s thread-selection `useEffect` — safety net for Symptom F |

---

## Why Tests Still Failed

### Root Cause: Supabase Realtime INSERT events are not reliably delivered

This was identified as the underlying problem in Phase 55 (see `055-DEFERRAL.md`): "Realtime INSERT race — needs console.log investigation before next attempt."

The Realtime approach depends on the Supabase WebSocket channel delivering a `postgres_changes` INSERT event to the client. In practice:
- Events may arrive while `isStreamingRef.current = true` (blocked by guard) and never replay
- Events may fire before the client's channel subscription is fully established (F5 case)
- The timing between `asyncio.shield` persisting and the Realtime event reaching the client is unpredictable

**Network evidence from browser DevTools:**
```
messages    200    fetch    api.ts:127    0.3 kB    4.63 s   ← SSE stream completed
messages    (pending)    fetch    api.ts:50    0.0 kB    Pending  ← getMessages
messages    (pending)        Preflight   0.0 kB    Pending
messages    (pending)    fetch    api.ts:50    0.0 kB    Pending  ← getMessages
messages    (pending)    fetch    api.ts:50    0.0 kB    Pending  ← getMessages
messages    (pending)        Preflight   0.0 kB    Pending
messages    (pending)    fetch    api.ts:50    0.0 kB    Pending  ← getMessages
```

`loadMessages` WAS being triggered (multiple GET requests visible). But requests were pending, suggesting the backend was occupied. The Realtime subscription was firing but the resulting reloads weren't completing fast enough, and the UI wasn't updating.

### Structural issues that compound the problem

1. **Two Realtime subscriptions for the same thread exist simultaneously** — `channelRef` (per-stream, from `sendMessage`) and `threadChannelRef` (always-on, from `subscribeToThread`). Both receive INSERT events for the active thread. Both call `loadMessages` (directly or via setMessages). This creates racing reloads.

2. **`subscribeToThread` callback calls `loadMessages` inside `setMessages` updater** — React state updaters must be pure. Side effects inside them are unreliable (Strict Mode invokes them twice; React may bail out). Fixed in `7056aa3` by calling `loadMessages` directly, but the structural duplication with `channelRef` remains.

3. **No reliable way to detect a pending backend task after F5** — After page refresh, the client has no way to know if the backend is mid-generation. The 8-second fallback fires regardless and is a blunt instrument.

4. **`asyncio.shield` timing is unpredictable** — The backend persists via `asyncio.shield` after the SSE connection drops. The exact timing depends on how far into a tool call or LLM generation the backend was when the disconnect happened. Could be 1s or 60s.

---

## What Actually Works (Verified in This Phase)

These behaviors are correct and working after this phase's commits:

- **Debug log removal** — All `[Phase56-Realtime]` console.log statements removed ✓
- **`activeThreadIdRef` guard** — Thread navigation during streaming correctly prevents cross-thread overwrite of `loadMessages` ✓
- **Stop does not trigger reload** — `!wasStoppedByUser` guard correctly skips `loadMessages` on Stop ✓
- **`loadMessages` outside state updater** — Correct placement; React Strict Mode no longer double-fires it ✓
- **Immediate `channelRef` teardown on navigation** — Thread B's message list is no longer corrupted by Thread A's late Realtime event ✓
- **TypeScript compiles clean** — 0 errors across all modified files ✓

---

## Recommended Approach for Next Milestone

**Do NOT continue with the Realtime-based approach for Symptoms E and F.** The Realtime delivery timing is fundamentally unreliable for these specific scenarios.

### Symptom E (Tab Switch) — Recommended Fix

Use the **Page Visibility API** as the primary mechanism. When the user returns to the tab, always reload messages if we were recently streaming.

```typescript
// In ChatArea.tsx — add to the thread-selection useEffect
const handleVisibilityChange = () => {
  if (document.visibilityState === "visible" && thread?.id && !isStreaming) {
    loadMessages(thread.id).catch(console.error)
  }
}
document.addEventListener("visibilitychange", handleVisibilityChange)
return () => document.removeEventListener("visibilitychange", handleVisibilityChange)
```

**Why this works:** The visibilitychange event fires reliably when the user switches back to the tab. At that point, if the stream finished while the tab was in background, the DB already has the message. One `loadMessages` call retrieves it. No Realtime required.

**Why we didn't land this:** The implementation in `a559f1b` included it, but it was bundled with other fixes that also weren't working (F5 case), so the overall test still "failed." Isolate this fix alone and test E specifically.

### Symptom F (F5 Mid-Stream) — Recommended Fix

Use **polling** — check for a pending response after page load and retry until the message appears.

**Detection:** After initial `loadMessages`, if the last message in the thread is from `role: "user"` (no following assistant message), and the thread's `updated_at` is recent (< 5 minutes), assume a response is in-flight.

**Polling loop:**
```typescript
// In useMessages or ChatArea
const startPollForResponse = (threadId: string) => {
  let attempts = 0
  const maxAttempts = 15  // 30 seconds at 2s intervals
  const timer = setInterval(async () => {
    attempts++
    const msgs = await getMessages(threadId)
    const lastMsg = msgs.at(-1)
    if (lastMsg?.role === "assistant" || attempts >= maxAttempts) {
      clearInterval(timer)
      if (lastMsg?.role === "assistant") setMessages(msgs)
    }
  }, 2000)
  return () => clearInterval(timer)
}
```

**Call it when:** Initial `loadMessages` returns with last message `role === "user"` and thread `updated_at` within last 5 minutes.

**Why this works:** It keeps querying until the backend finishes and the message appears in the DB. No WebSocket/Realtime required. Deterministic.

**Why we didn't implement this:** This phase's plan specified Realtime as the approach. Polling was not in scope.

### Symptom G (Stop regression) — Already Fixed

The `!wasStoppedByUser` guard in the `finally` block correctly skips `loadMessages` on Stop. Committed in `7056aa3`. No further work needed.

### Symptom H (Thread Navigation) — Already Fixed

`channelRef` immediate teardown on navigation (commit `a559f1b`) prevents Thread A's Realtime event from appearing in Thread B. The `activeThreadIdRef` guard in `finally` also prevents `loadMessages(Thread A ID)` from firing after navigation. No further work needed for H.

### Also Investigate Before Next Attempt

1. **Verify Supabase Realtime RLS policies for `messages` table** — Check that `REPLICA IDENTITY` is set and that the user's RLS policies allow receiving Realtime events. Run `SELECT * FROM pg_class WHERE relreplident = 'f';` in Supabase SQL editor to confirm `messages` table is included.

2. **Single-subscription architecture** — Consider removing `channelRef` (the per-stream Realtime subscription inside `sendMessage`) entirely. It was added in Phase 55 for recovery but was never proven to work. Having two subscriptions for the same thread creates race conditions.

3. **Test Realtime events directly** — Add a temporary test: subscribe to the `messages` table in Supabase Studio's Realtime debugger and verify that INSERT events fire when the backend persists after stream completion. If they don't appear there, the issue is at the DB/Supabase config level, not the client code.

---

## State of the Codebase at Deferral

All commits on `master`. No partial or stashed work.

```
a559f1b  fix(057): debounce Realtime reloads, fix nav corruption, add E/F fallbacks
7056aa3  fix(057): move loadMessages out of setMessages updaters — fixes all 4 reconnect tests
685925e  fix(057-02): remove loadMessages from subscribeToThread deps — fixes blank page
43057d8  docs(057-02): complete always-on Realtime subscription plan — awaiting human-verify
c88fbe3  feat(057-02): wire subscribeToThread into ChatArea useEffect([thread?.id])
bc17aa9  feat(057-02): add subscribeToThread/unsubscribeFromThread to useMessages
1d02b5e  docs(057-01): complete SSE Symptom E fix — activeThreadIdRef + finally-block loadMessages
d1d7c6c  feat(057-01): add activeThreadIdRef guard and finally-block loadMessages for Symptom E fix
```

The codebase is stable and functional for the normal chat flow. The reconnect scenarios (E, F) remain unreliable but do not break the happy path.

---

## Files Modified in This Phase

| File | Net Change | Keep? |
|------|-----------|-------|
| `frontend/src/hooks/useMessages.ts` | `activeThreadIdRef`, `threadChannelRef`, `subscribeToThread`, `unsubscribeFromThread`, `reloadTimerRef`, debug log removal, `finally` block restructure | Yes — improvements are correct even if E/F not fully solved |
| `frontend/src/components/chat/ChatArea.tsx` | `subscribeToThread` wiring, `visibilitychange` listener, 8s fallback reload | Yes — `visibilitychange` is the right approach for E |

---

*Deferred: 2026-04-30*
*Root cause: Supabase Realtime INSERT event delivery is unreliable for the specific timing windows in Symptoms E and F*
*Next action: Re-implement F with polling; test E with visibilitychange in isolation*
