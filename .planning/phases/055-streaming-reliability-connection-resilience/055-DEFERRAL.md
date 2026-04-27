---
phase: 055-streaming-reliability-connection-resilience
status: deferred
deferred: 2026-04-27
reason: Verification session exposed two interlocked problems that require deeper investigation before re-attempting.
---

# Phase 055 Deferral Notes

## What Was Built (Committed)

### Plan 055-01 — DB Prerequisite ✅
- Messages table added to `supabase_realtime` publication.
- Commit: `5a2e237`

### Plan 055-02 — TDD Test Scaffold ✅
- `backend/tests/unit/test_streaming_reliability.py` — 8 failing unit tests for STREAM-01 and STREAM-03.
- Commit: `8826bd0`

### Plan 055-03 — Backend: stop_event threading + asyncio.shield ✅
- `backend/app/api/threads.py` — `stop_event` passed into `event_stream()`, checked at every iteration boundary and between LLM chunks.
- `backend/app/api/threads.py` — `_persist_assistant_message()` wrapped with `asyncio.shield()` in `finally` block.
- Commit: `9d17707`

### Plan 055-04 — Frontend: Realtime subscription + sseDrop removal ✅
- `frontend/src/hooks/useMessages.ts` — Supabase Realtime Postgres-changes subscription added inside `sendMessage`, scoped to active thread, torn down in `finally`.
- `frontend/src/hooks/useMessages.ts` — 1.5s `sseDrop` setTimeout fallback removed.
- Commit: `afb2328`

---

## What Was NOT Completed

### Plan 055-05 — Verification ❌
Browser verification revealed two problems (see below). Phase gated here without a VERIFICATION.md.

---

## Problems Found During Verification

### Problem 1: `socket.send() raised exception.` in backend logs (FIXED — keep this fix)

**Root cause:** CPython's `asyncio/selector_events.py` transport layer logs `WARNING: socket.send() raised exception.` when a client disconnects mid-write. This fires BELOW uvicorn and BELOW our `SSEStreamingResponse._safe_send` wrapper — it cannot be caught at the ASGI layer.

**Fix applied (uncommitted):** `backend/app/main.py` — suppress the `asyncio` logger to ERROR level on startup:
```python
logging.getLogger("asyncio").setLevel(logging.ERROR)
```
**Status:** Fix works. Should be committed regardless of Phase 055 completion.

---

### Problem 2: Realtime subscription causes navigation/stop regressions (ROOT CAUSE OF DEFERRAL)

The Supabase Realtime subscription added in Plan 055-04 introduced a race condition that was not resolved during this session.

**Observed symptoms:**
- After clicking Stop: the full response still appeared in the UI (Realtime INSERT delivered the persisted message, overwriting the stopped partial)
- After navigating away mid-stream: the new thread showed no messages until the old stream completed on the backend
- After refresh: messages did not load

**Root cause analysis:**

The Realtime subscription fires an INSERT event when the backend persists the assistant message (which happens regardless of whether the user stopped or navigated away — protected by `asyncio.shield`). The INSERT lands in the Realtime callback AFTER `isStreamingRef.current = false` is set in `finally`, but BEFORE or racing with `supabase.removeChannel()`. This means:

1. **Stop case:** INSERT fires → replaces stopped partial with full DB message → user sees full response despite clicking Stop
2. **Navigation case:** INSERT fires for old thread → `setMessages` sets messages to OLD thread content → user is on new thread, sees wrong data
3. **Reload case:** Multiple `setMessages` calls from `finally` + `loadMessages` race unpredictably

**Approaches attempted (all failed or introduced new regressions):**

| Attempt | What it tried | What broke |
|---|---|---|
| Guard 1: `stoppedByUserRef` in Realtime callback | Skip INSERT when user stopped | Navigation still broken |
| Guard 2: `navigatedAwayRef` in Realtime callback | Skip INSERT after navigation | Messages stopped loading on any thread switch |
| Guard 3: Remove Realtime, restore `loadMessages` from `finally` | Revert to pre-055-04 | `loadMessages(oldThreadId)` from `finally` overwrites new thread on navigation |
| Guard 4: `completedNormally` flag | Only call `loadMessages` on true normal completion | Not tested in time |

**Current state of `useMessages.ts` (uncommitted):**
- Realtime subscription removed
- `completedNormally` flag added — `loadMessages(threadId)` only called when stream completed without abort
- Stop path: shows stopped indicator, no DB reload
- Navigation path: no action from `finally`, ChatArea's `loadMessages(newThread)` handles it

**This approach was not verified** — the session was deferred before browser testing could confirm it fixed things.

---

## Current File State (Uncommitted Changes)

Two files have uncommitted changes:

### `backend/app/main.py`
```python
# Added at top — safe to commit now:
import logging
logging.getLogger("asyncio").setLevel(logging.ERROR)
```

### `frontend/src/hooks/useMessages.ts`
- Realtime subscription removed (reverts 055-04 feat commit `afb2328`)
- `supabase` import removed
- `channelRef`, `isStreamingRef`, `navigatedAwayRef` refs removed
- `completedNormally` flag in `sendMessage`
- `finally` block: 3-way branch (stopped / completedNormally / navigation-abort)

**Recommendation:** Commit `main.py` fix now (safe, unrelated to 055). Revert `useMessages.ts` to the committed Phase 055-04 state (`afb2328`) until Phase 055 is re-attempted.

---

## Revert Command (Frontend)

To restore `useMessages.ts` to the last committed state (end of Plan 055-04):
```bash
git checkout afb2328 -- frontend/src/hooks/useMessages.ts
```

To restore to pre-Phase-055 state (remove Realtime entirely):
```bash
git log --oneline -- frontend/src/hooks/useMessages.ts
# find commit before afb2328, then:
git checkout <that-commit> -- frontend/src/hooks/useMessages.ts
```

---

## What the Next Attempt Needs to Solve

### STREAM-02 (navigate away + come back) — Realtime approach is the right idea but needs careful sequencing

The Realtime subscription fires after `asyncio.shield` persists the message. The sequence that must be guaranteed:

1. User navigates → `clearMessages()` → `abort()` fires
2. `finally` tears down the channel — **this must complete BEFORE any INSERT can be processed**
3. `supabase.removeChannel()` is async-ish (queues the unsubscribe) — there is a lag window
4. INSERT fires in that lag window → processes against wrong thread state

**Recommended approach for next attempt:**
- Use a `activeThreadIdRef` that tracks which thread is currently displayed
- In the Realtime callback, check `payload.new.thread_id === activeThreadIdRef.current` before processing
- `activeThreadIdRef` is set by ChatArea (or `loadMessages`) to the current thread
- This is thread-safe regardless of timing — always checks current thread, not stream state

### STREAM-01 (stop) — KI-001 still not resolved

The `stop_event` checks at iteration boundaries (055-03) reduce waste but do NOT interrupt an in-flight LLM streaming call. The LLM call runs to completion. This is documented as KI-001.

**What the user sees:** Click Stop → frontend shows stopped indicator → backend continues generating → persists full response to DB → Realtime INSERT delivers it → full response replaces stopped partial.

**True fix:** Convert LLM clients to async (`AsyncOpenAI`, `AsyncAnthropic`). Then `asyncio.CancelledError` propagates into the streaming call and cancels it. This was explicitly deferred in Phase 055 context (D-01, D-02) as a larger refactor.

---

## Recommended Next Steps

1. **Commit `main.py` fix** — the asyncio log suppression is clean, tested, unrelated to the regressions.
2. **Revert `useMessages.ts`** to committed state (055-04, `afb2328`).
3. **Defer Phase 055** by moving it past the current milestone completion.
4. **When re-attempting**, address the two root causes separately:
   - **STREAM-02:** Use `activeThreadIdRef` pattern in Realtime callback instead of `isStreamingRef` + `navigatedAwayRef` guards
   - **STREAM-01:** Full async LLM client conversion (AsyncOpenAI / AsyncAnthropic) — separate phase

---

## STREAM requirements status at deferral

| Requirement | Status | Evidence |
|---|---|---|
| STREAM-01: stop_event threading | Partial — backend checks at boundaries, but LLM call can't be cancelled mid-generation (KI-001) | `9d17707` |
| STREAM-02: Realtime recovery on navigate | Broken — regression introduced, not resolved | See above |
| STREAM-03: asyncio.shield on persist | Complete — `asyncio.shield` in `finally` | `9d17707` |
