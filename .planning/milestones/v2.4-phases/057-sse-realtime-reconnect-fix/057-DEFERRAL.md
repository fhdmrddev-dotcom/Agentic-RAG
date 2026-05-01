---
phase: 057-sse-realtime-reconnect-fix
status: deferred
deferred_at: 2026-04-30
second_attempt: 2026-05-01 (v2.5-dev branch — fully reverted)
reason: Symptoms E/F unreliable. Backend FastAPI worker concurrency identified as dominant blocker.
next_milestone_action: Backend worker fix FIRST, then frontend race fix + visibilitychange + polling — each tested in isolation with browser MCP
commits_to_keep: v2.4 baseline (Phase 057 commits stay on master); v2.5-dev 058-* branch reverted but preserved in git history for reference
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

## Second Attempt — v2.5-dev branch (2026-05-01)

A second attempt was made on the `v2.5-dev` branch using a fresh root-cause analysis (`058-ANALYSIS.md` from the user). All commits were reverted to v2.4 state at the end. Key findings preserved here for the next attempt.

### Approach: Five-Fix Plan Based on Race-Condition Analysis

The user supplied a detailed analysis identifying the blank-page-on-thread-switch as a different bug from Symptoms E/F — a **frontend crash from a thread-switch race**. The plan applied 5 targeted fixes:

| Fix | Target | Description |
|-----|--------|-------------|
| FIX 1 | `loadMessages` | Post-`await` guard: `if (activeThreadIdRef.current !== threadId) return` — discards cross-thread responses |
| FIX 2 | `clearMessages` | Remove `abortControllerRef.abort()` — caller (ChatArea) aborts explicitly via `abortStream()` first |
| FIX 3 | `finally` block | Always remove per-stream channel immediately (drop the 2s grace period that allowed double subscription) |
| FIX 4 | ChatArea `useEffect` | Reduce deps to `[thread?.id]` only; reorder to `abortStream() → clearMessages() → loadMessages()` |
| FIX 5 | ChatArea `useEffect` | Replace 8s fallback timer with adaptive polling: if last msg is `role: "user"`, poll every 2s for 30s |

Commits: `47ca06f`, `e7ce305`, `19d91a0`, `856ee27`, `70e949c`. All reverted in `d1fc6fa`.

### What Was Discovered During Browser Testing (chrome-in-browser MCP)

Browser-side debugging via `window.fetch` interceptor revealed three **new** root causes not visible from static analysis:

#### 1. `loadMessages` was overwriting its own guard (REAL BUG, FIXED IN v2.5-DEV)

**Symptom:** Thread B's data discarded; Thread A's data displayed in Thread B view.

**Root cause:** `loadMessages` wrote `activeThreadIdRef.current = threadId` as its first action. When two concurrent calls ran (Thread A from `finally`, Thread B from `useEffect`), the LATER call overwrote the ref. When Thread B's fetch returned, the post-await guard saw `activeThreadIdRef = ThreadA ≠ ThreadB` and discarded Thread B's data. Thread A's fetch then passed its own guard and wrote wrong-thread data.

**Fix applied (commit `856ee27`):** Separated "viewing thread ref" from "loading thread ref":
- Added `setViewingThread(threadId)` callback as the **only** writer of `activeThreadIdRef`
- Called from ChatArea's `useEffect` as the very first action — before `abortStream`, `clearMessages`, or `loadMessages`
- `loadMessages` no longer writes the ref — only reads it post-await

**Why it matters:** Even when the next attempt succeeds at fixing E/F, this race fix is required. Otherwise concurrent `loadMessages` calls will still corrupt each other.

#### 2. Backend FastAPI worker is single-threaded against SSE (UNFIXED — backend issue)

**Symptom:** When Thread A is streaming, switching to Thread B leaves Thread B blank for 30+ seconds. Even navigating to a different page hangs.

**Network evidence (browser DevTools while testing):**
```
messages    200    fetch    api.ts:127    3.90 s   ← Thread A SSE active
messages    200    fetch    VM916:8     30.26 s   ← Thread B GET stuck behind it
messages    200    fetch    VM916:8     25.39 s
messages    200    preflight  21.77 s
messages    200    fetch    VM916:8      297 ms   ← Only completes after SSE ends
```

**Root cause:** FastAPI workers in dev mode (`uvicorn` single worker) process requests serially. Thread A's SSE stream occupies a worker slot for the full duration of the agent loop. Thread B's `getMessages` GET is queued behind it.

**Partial mitigation attempted (commit `70e949c`):** Added `AbortSignal` parameter to `getMessages()` and a `loadAbortRef` so each new `loadMessages` call cancels the previous in-flight fetch. This unblocks the **frontend** waiting state — the user can still navigate freely. The fetch itself still hangs on the backend until the SSE finishes, but cancelling it lets new fetches queue without piling up.

**Real fix needed:** Backend changes — either (a) `uvicorn --workers N` in dev (multiple workers, but harder to debug), or (b) make the SSE handler properly async so it doesn't hold the worker while awaiting LLM tokens, or (c) move agent execution to a background task with the SSE handler just consuming a queue.

#### 3. `loadMessages` in `finally` block caused raw tool-result JSON to appear in chat (REAL REGRESSION)

**Symptom:** After a tool-using response completed, the chat showed the raw JSON tool result text inline before the assistant's final answer, e.g. `[{"content": "FAHED MRAD\n\nPMO Leader...", "similarity": 0.444, ...}]`. This was a v2.4 already-shipped bug masked by Phase 057's later changes.

**Root cause:** The `finally` block called `loadMessages(threadId)` after stream completion. The DB version of the assistant message stores tool execution context inside the `content` field (a backend persistence detail). Fetching it overwrote the clean streaming-format messages (where tool calls are tracked separately in `tool_calls`) with the raw stored format.

**Fix applied (commit `70e949c`):** Removed the `loadMessages` call from the `finally` block entirely. The streaming messages built up by SSE deltas are correct as-is. The DB version only loads when the user navigates away and returns — at which point any persisted edits are picked up naturally.

**Why it matters:** Any future implementation of "reload from DB after stream" must either (a) project the DB row back into the streaming format before applying, or (b) only do it when the streaming state is empty (genuine reconnect cases, not natural completion).

### Why The v2.5-dev Attempt Was Reverted

Despite fixing 3 real bugs, the attempt was reverted because:

1. **Symptoms E and F were not reliably fixed** — the original goals
2. **The polling approach (FIX 5) was implemented but not proven** in browser testing
3. **The backend worker issue (#2 above)** is the dominant blocker for navigation responsiveness, not a frontend race fix
4. **Iterating on a complex hook with no browser feedback loop was too risky** — better to wait until proper test infrastructure is in place

The user requested full revert to `v2.4` state to keep a stable baseline. All findings documented here for the third attempt.

---

## Updated Recommended Approach (Post-v2.5-dev Findings)

### Step 0: Backend First (NEW — addresses navigation-blocked symptom)

Before any frontend work, fix the FastAPI worker concurrency issue. Options in order of complexity:

**Option A (simplest — recommended for dev):** Run uvicorn with multiple workers:
```bash
uvicorn app.main:app --workers 4
```
Caveats: each worker has its own process state — anything in module-level globals (rare) becomes per-worker. Realtime channel subscriptions are unaffected (Supabase-side).

**Option B (proper fix):** Move SSE response generation off the request worker:
- Convert `event_stream` to a background task that writes to an `asyncio.Queue`
- Request handler just consumes the queue and yields
- The agent loop's `await` points already release the worker, but tool execution may not — audit and convert any sync calls inside tools to `asyncio.to_thread`

**Verification:** Open Thread A streaming. In another browser tab navigate to `localhost:8000/threads/B/messages`. Should return < 1s, not 30s.

### Step 1: Apply Race Fix (REQUIRED — independently of E/F)

Apply the `setViewingThread` separation pattern from commit `856ee27`. This is a real bug that exists today regardless of E/F. Without it, concurrent `loadMessages` calls will keep corrupting each other.

```typescript
// useMessages.ts
const setViewingThread = useCallback((threadId: string | null) => {
  activeThreadIdRef.current = threadId
}, [])

const loadMessages = useCallback(async (threadId: string) => {
  // Do NOT write activeThreadIdRef here — only setViewingThread does
  const data = await getMessages(threadId, controller.signal)
  if (activeThreadIdRef.current !== threadId) return  // discard if user navigated away
  setMessages(data)
}, [])
```

```typescript
// ChatArea.tsx — at the top of the thread-selection useEffect
setViewingThread(thread?.id ?? null)  // FIRST action, before abortStream/clearMessages
```

### Step 2: Remove `loadMessages` from `finally` block (REQUIRED — fixes raw JSON regression)

The streaming messages are the source of truth during a stream. Don't overwrite them from DB on natural completion. Only reload from DB when:
- User navigates away and back (existing behavior, fine)
- F5 mid-stream recovery (Step 4 below)

### Step 3: Symptom E (Tab Switch) — visibilitychange Alone

Use the Page Visibility API only. Test this fix in isolation before combining with anything else.

```typescript
const handleVisibilityChange = () => {
  if (document.visibilityState === "visible" && thread?.id && !isStreamingRef.current) {
    loadMessages(thread.id).catch(console.error)
  }
}
```

**Verification:** Start a multi-tool chat. Switch tabs. Wait for completion (visible in network tab). Switch back. Message should appear immediately.

### Step 4: Symptom F (F5 Mid-Stream) — Polling

After initial `loadMessages` completes, check if last message is `role: "user"`. If yes, poll every 2s for up to 30s.

```typescript
const startPollForPendingResponse = (threadId: string) => {
  let attempts = 0
  const poll = async () => {
    if (attempts++ >= 15) return
    const msgs = await getMessages(threadId, controller.signal)
    if (msgs[msgs.length - 1]?.role === "assistant") {
      setMessages(msgs)
      return
    }
    setTimeout(poll, 2000)
  }
  // Only poll if first load returned a user-last state
  setTimeout(async () => {
    const msgs = await getMessages(threadId, controller.signal)
    if (msgs[msgs.length - 1]?.role === "user") poll()
  }, 1000)
}
```

**Verification:** Start a multi-tool chat. Press F5 within first 5 seconds. Wait. Message should appear within ~30s of the backend finishing.

### Step 5: Cancel-on-Navigate (PARTIAL FIX, KEEP)

Add `AbortSignal` to `getMessages()` and a `loadAbortRef` that cancels previous in-flight fetches when a new `loadMessages` is called. This unblocks the frontend even if the backend is slow.

```typescript
export async function getMessages(threadId: string, signal?: AbortSignal): Promise<Message[]> {
  const res = await fetch(url, { headers, signal })
  // ...
}
```

```typescript
const loadAbortRef = useRef<AbortController | null>(null)

const loadMessages = useCallback(async (threadId: string) => {
  loadAbortRef.current?.abort()
  const controller = new AbortController()
  loadAbortRef.current = controller
  // ...
  try {
    const data = await getMessages(threadId, controller.signal)
    // ...
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') return
  }
}, [])
```

### Step 6: Realtime Investigation (DEFERRED)

Before any new Realtime work, verify at the DB level:

```sql
-- In Supabase SQL editor, confirm messages table has REPLICA IDENTITY FULL
SELECT relname, relreplident
FROM pg_class
WHERE relname = 'messages';
-- Expected: relreplident = 'f' (FULL)
```

Open Supabase Studio → Realtime debugger → subscribe to `public:messages` and verify INSERT events fire when the backend persists after stream completion. If they don't fire there, no client code can save the Realtime approach.

### Validation Strategy (NEW — addresses why iterating failed)

The v2.5-dev attempt failed partly because we iterated on a complex hook without browser feedback. Next attempt requires:

1. **chrome-in-browser MCP server registered before starting** — so the agent can drive the browser, screenshot, and read console/network directly
2. **Per-step manual verification** — each fix tested in isolation, not bundled, and not advanced until confirmed
3. **Fetch interceptor as standard test harness** — paste the fetch logger into DevTools at session start to track guards firing
4. **Test matrix** — automate (or scripted-manual) the four scenarios E/F/G/H plus the new "navigate during stream" scenario

---

## State of the Codebase After Revert

All v2.5-dev commits reverted in `d1fc6fa`. Three frontend files are at v2.4 milestone state:
- `frontend/src/hooks/useMessages.ts`
- `frontend/src/components/chat/ChatArea.tsx`
- `frontend/src/lib/api.ts`

The original v2.4 commits (Phase 057 work) are preserved in `master`. The v2.5-dev `058-*` commits remain in branch history for reference but are not reapplied.

---

*Deferred: 2026-04-30 (v2.4 close)*
*Second attempt: 2026-05-01 (v2.5-dev branch — reverted)*
*Root cause: Supabase Realtime INSERT delivery + FastAPI single-worker concurrency + loadMessages ref-write race*
*Next action (in v2.5):*
*  1. Backend: multi-worker uvicorn or async background task for SSE generation*
*  2. Frontend: setViewingThread separation + remove finally-block reload + visibilitychange + polling — test each in isolation*
