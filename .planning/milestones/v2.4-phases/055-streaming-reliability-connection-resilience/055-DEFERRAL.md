---
phase: 055-streaming-reliability-connection-resilience
status: deferred
deferred: 2026-04-27
reason: Multiple fix attempts failed browser verification. Root cause not fully understood — deeper investigation required before re-attempting.
---
# Phase 055 Deferral Notes

## What Was Built (Committed — DO NOT REVERT)

### Plan 055-01 — DB Prerequisite ✅

- Messages table added to `supabase_realtime` publication.
- Commit: `5a2e237`

### Plan 055-02 — TDD Test Scaffold ✅

- `backend/tests/unit/test_streaming_reliability.py` — 8 unit tests, all passing.
- Commit: `8826bd0`

### Plan 055-03 — Backend: stop_event threading + asyncio.shield ✅

- `backend/app/api/threads.py` — `stop_event` checked at every iteration boundary and between LLM chunks.
- `backend/app/api/threads.py` — `_persist_assistant_message()` wrapped with `asyncio.shield()`.
- Commit: `9d17707`

### Plan 055-04 — Frontend: Realtime subscription + sseDrop removal ✅

- `frontend/src/hooks/useMessages.ts` — Supabase Realtime Postgres-changes subscription, scoped to active thread, torn down in `finally`.
- 1.5s `sseDrop` setTimeout fallback removed.
- Commit: `afb2328`

### Fix: asyncio log suppression ✅

- `backend/app/main.py` — `logging.getLogger("asyncio").setLevel(logging.ERROR)` suppresses `socket.send() raised exception.` transport warnings.
- Commit: `154c1ea`

---

## What Was NOT Completed

### Plan 055-05 — Verification ❌

All browser verification attempts failed. Phase remains open without a VERIFICATION.md.

**Current HEAD of `useMessages.ts`:** commit `e8cf7d4` — `activeThreadIdRef` fix attempt (failed, see below).

---

## Observed Symptoms (All Sessions)

1. **Stop:** Full response still appeared in UI after clicking Stop (backend completes, Realtime INSERT delivers it).
2. **Navigate away mid-stream:** New thread showed empty messages until the old stream completed on backend.
3. **Refresh:** Messages did not load, or loaded then disappeared.
4. **Backend logs:** `socket.send() raised exception.` — FIXED by asyncio logger suppression in `main.py`.

---

## All Fix Attempts (Chronological)

### Attempt 1 — `stoppedByUserRef` guard in Realtime callback

**What:** Added `if (stoppedByUserRef.current) return` to Realtime callback.
**Result:** Stop case improved, but navigation still broken (new thread empty until old stream completed).

### Attempt 2 — `navigatedAwayRef` guard in Realtime callback

**What:** Added `navigatedAwayRef = useRef(false)`, set `true` in `clearMessages`, checked in Realtime callback.
**Result:** Broke ALL navigation — any thread switch blocked Realtime events, messages never loaded. Root cause: `navigatedAwayRef` stays `true` until next `sendMessage`, so idle browsing was permanently blocked.

### Attempt 3 — Remove Realtime entirely, restore `loadMessages` from `finally`

**What:** Removed Realtime subscription and `supabase` import. Restored `loadMessages(oldThreadId)` call in `finally` when not stopped.
**Result:** `loadMessages(oldThreadId)` in `finally` fires AFTER the old stream completes, by which time user has navigated to a new thread — overwrites new thread's messages with old thread's data.

### Attempt 4 — `completedNormally` flag

**What:** Added `let completedNormally = false` in `sendMessage`, set `true` only when `await streamMessage` resolved without throwing. Only called `loadMessages` when `completedNormally = true`.
**Result:** Not browser-tested (session deferred first time). Implemented in the Realtime-removed state.

### Attempt 5 — `activeThreadIdRef` (commit `e8cf7d4`)

**What:** Added `activeThreadIdRef = useRef<string | null>(null)`. Set synchronously at the top of `loadMessages` (before `await`) and in `sendMessage`. Added guard in Realtime callback: `if ((payload.new as Message).thread_id !== activeThreadIdRef.current) return`. Removed `loadMessages` from stopped branch in `finally`.
**Rationale:** Thread-identity check is timing-independent — even if INSERT fires after `removeChannel()` queued but not yet completed, it's rejected because the ref already points to the new thread.
**Result:** Browser tests still failed — same symptoms. The fix did not change observable behavior.

---

## Current State of `useMessages.ts`

HEAD is commit `e8cf7d4` (Attempt 5 — `activeThreadIdRef`). This is the Realtime subscription version with all three guards:

```
1. if (isStreamingRef.current) return
2. if (stoppedByUserRef.current) return  
3. if (payload.new.thread_id !== activeThreadIdRef.current) return
```

The fact that Attempt 5 failed despite correct logic suggests the problem may not be in the Realtime callback guards at all — it may be in `clearMessages`, `loadMessages`, or the `finally` block's `setMessages` ordering.

---

## Hypothesis for Next Investigation

The `activeThreadIdRef` analysis was sound and should have worked. The fact that it didn't means the problem is **upstream of the Realtime callback** — i.e., the messages are being cleared or not loaded for a different reason.

**Candidate root cause A — `clearMessages` resets `isSendingRef = false` but `finally` runs AFTER `loadMessages`:**

Sequence on navigation:

1. `clearMessages()` → `messages = []`, `isSendingRef = false`
2. `loadMessages(newThread)` starts fetch
3. Abort fires → `finally` runs multiple `setMessages` callbacks
4. One of the `finally` `setMessages` callbacks returns `prev` (empty `[]`) at a point when React hasn't yet processed `loadMessages`'s result
5. React batches: empty `[]` wins over `data`

This is a React state update ordering issue, not a Realtime issue. The multiple `setMessages` calls in `finally` (isPlanning fix, tool interrupt, stopped flag) may be creating an ordering problem with concurrent React updates.

**Candidate root cause B — `streamingThreadIdRef` not null when `loadMessages` resolves:**

If `finally` hasn't run yet when `loadMessages(newThread)` resolves, `streamingThreadIdRef.current` is still the OLD thread ID. The `loadMessages` guard:

```js
if (streamingThreadIdRef.current && streamingThreadIdRef.current !== threadId) {
  return data  // ← this branch returns data, which is CORRECT
}
```

This should work. But if `streamingThreadIdRef` is set to `null` (finally ran) AND `isSendingRef` is somehow `true`, `loadMessages` returns `prev` (empty). Unlikely but worth checking.

**Candidate root cause C — The problem is not `useMessages.ts` at all:**

The ChatArea `useEffect` re-fires if any of its dependencies (`loadMessages`, `abortStream`, `clearMessages`) change identity. These are all `useCallback(fn, [])` so they should be stable — but confirm with React DevTools profiler.

---

## Recommended Approach for Next Attempt

**Before writing any code:**

1. Add `console.log` tracing to `loadMessages`, `clearMessages`, and the `setMessages` callbacks in `finally` to observe actual execution order in the browser console.
2. Check: does `loadMessages` actually set messages to the new thread data? (Log the `data` array length before `setMessages`.)
3. Check: does any `setMessages` in `finally` return `[]` or the wrong data?

This will pinpoint whether the problem is in the Realtime callback, the `loadMessages` guard, or the `finally` ordering.

**Do NOT add more guards to the Realtime callback without first confirming via logging that the callback is the actual source of the problem.**

---

## STREAM Requirements Status at Final Deferral

| Requirement                              | Status      | Notes                                                                                                                   |
| ---------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------- |
| STREAM-01: stop_event threading          | Partial     | Backend stops yielding on disconnect; LLM call runs to completion (KI-001). Frontend shows stopped indicator correctly. |
| STREAM-02: Realtime recovery on navigate | Not working | 5 fix attempts failed. Root cause unclear — needs console.log investigation.                                           |
| STREAM-03: asyncio.shield on persist     | Complete    | `asyncio.shield` confirmed in `finally` block.                                                                      |



**All 5 fix attempts targeted the Realtime callback — but the Realtime callback is probably not the root cause.** The deferral document's own hypothesis A (line 96) is the right lead.

The key findings:

1. **"Stop shows full response"** — This is STREAM-01 (backend can't cancel LLM). The backend finishes the generation, persists the message, and the Realtime INSERT arrives *after* `isStreamingRef = false` is set. The `activeThreadIdRef` fix *should* have caught this — needs console.log tracing to confirm why it didn't.
2. **"Navigate away shows empty"** — The `finally` block's `setMessages` updaters look for `assistantId` (from the old thread), won't find it in new thread data, and return `prev` harmlessly. So the code should work on paper. **We need console.log tracing to find the actual ordering.**
3. **"Refresh shows empty"** — Likely React Strict Mode double-firing effects in dev.

**The recommended next step (matching the deferral's own recommendation):** Add `console.log` tracing to `loadMessages`, `clearMessages`, the `finally` block, and the Realtime callback, then reproduce each symptom to observe the actual execution order.


---

## Revert Command

To restore `useMessages.ts` to Plan 055-04 committed state (before any fix attempts):

```bash
git checkout afb2328 -- frontend/src/hooks/useMessages.ts
```
