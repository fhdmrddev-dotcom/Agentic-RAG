---
phase: 063-frontend-stream-decoupling
reviewed: 2026-05-03T00:00:00Z
depth: standard
files_reviewed: 23
files_reviewed_list:
  - backend/app/api/test_fixtures.py
  - backend/app/api/threads.py
  - backend/app/main.py
  - backend/tests/integration/test_058_concurrency.py
  - backend/tests/integration/test_059_disconnect.py
  - backend/tests/integration/test_061_runs_table.py
  - backend/tests/integration/test_061_ttl.py
  - backend/tests/integration/test_062_delete_happy.py
  - backend/tests/integration/test_062_multi_consumer_fanout.py
  - backend/tests/integration/test_062_stream_replay.py
  - backend/tests/integration/test_063_legacy_path_deleted.py
  - backend/tests/integration/test_063_post_contract.py
  - backend/tests/integration/test_063_post_then_subscribe.py
  - e2e/.gitignore
  - e2e/tests/060-thread-race.spec.ts
  - e2e/tests/063-refresh-mid-stream.spec.ts
  - e2e/tests/063-resume-failed.spec.ts
  - frontend/src/components/chat/ChatArea.tsx
  - frontend/src/components/chat/MessageItem.tsx
  - frontend/src/components/chat/MessageList.tsx
  - frontend/src/hooks/useMessages.ts
  - frontend/src/lib/api.ts
  - frontend/src/types/index.ts
findings:
  blocker: 6
  warning: 9
  total: 15
status: issues_found
---

# Phase 063: Code Review Report

**Reviewed:** 2026-05-03
**Depth:** standard
**Files Reviewed:** 23
**Status:** issues_found

## Summary

Phase 063 ("Frontend Stream Decoupling") cuts over the POST contract on
`/threads/{tid}/messages` from SSE to JSON, deletes the legacy
`event_consumer` generator, splits frontend `streamMessage` into
`postMessage`/`subscribeToRun`/`getActiveRuns`/`cancelRun`, adds a
`reconcile()` hook that re-attaches via `active-runs` on
mount/focus/visibilitychange/pageshow, and ships an env-gated test
fixture endpoint. The cutover itself reads cleanly and is well-defended
against several known pitfalls (Pitfall 4 timing, idempotent reconcile,
TTL-expired buffer fallback, cross-thread `setViewingThread` writer).

However, the implementation contains several **correctness bugs** that
will manifest under realistic conditions:

1. The new POST handler performs **blocking I/O directly inside the
   async route handler** in two places (`supabase.table("threads").insert(...).execute()`,
   `supabase.table("messages").insert(...)` *without* `aexec`), violating
   D-v2.5-01 / Phase 058's invariant — re-introducing the cross-tab GET
   blocking bug 058 was specifically designed to fix.
2. `_user_msg_id` resolution in `send_message` will **always be `None`**
   in the production PostgREST path because `.insert(...).select("id").single()`
   is not the correct PostgREST builder chain and the `data` shape branch
   guard does not match real-PostgREST responses; the route then
   raises HTTP 500 on every send.
3. The frontend `useMessages.subscriptionsRef` is **never updated** when
   `sendMessage`'s controller is replaced with a new run (the controller
   stored under `run_id` is *not* the same controller live-bound to the
   reader after `subscribeToRun` returns), and the hook-unmount cleanup
   in the effect aborts only the LAST stored controller — opening one
   long-running stream per `reconcile` tick when visibility flaps.
4. The `test_fixtures.inject_failed_run` endpoint is **routed under the
   user-input `thread_id` path segment without any UUID validation**;
   any string the client sends (e.g. `'../runs/{rid}'`) reaches the
   PostgREST WHERE clause unsanitized — limited blast radius (PostgREST
   serializes via JSON), but still a sloppy contract for an auth-gated
   endpoint that *also* writes a `runs` row.
5. `MessageList.tsx` triggers smooth scrolling on every token delta
   when the user is near the bottom (it queues `behavior: "instant"`
   on every render), with no debounce — but the `behavior: "smooth"`
   branch is fired any time `messages.length` increments which on the
   `reconcile` path happens *every visibility/focus tick* (placeholder
   re-insert is idempotent, but reconcile completes a full
   `loadMessages(threadId)` on every terminal that may grow the array).

The unused `event_consumer` references are gone (good — Plan 01 test
guards this) but `EventSourceResponse` and `AsyncGenerator` are now
**dead imports** at the top of `threads.py`.

---

## Blocker Issues

### BL-01: POST handler does blocking `.execute()` calls inside async route — re-introduces 058 cross-tab blocking

**File:** `backend/app/api/threads.py:411-422` (create_thread), `backend/app/api/threads.py:426-437` (rename_thread), `backend/app/api/threads.py:441-484` (delete_thread), `backend/app/api/threads.py:560-579` (get_messages)

**Issue:** Several async route handlers invoke `supabase.table(...).execute()` (sync supabase-py) directly without wrapping in `aexec()`. Per CLAUDE.md ("Do not run blocking I/O — wrap with `run_in_threadpool`") and D-v2.5-01 / Phase 058 D-058-09, these calls hold the event loop and break the cross-tab unblocking invariant that `test_058_concurrency.py` explicitly guards.

While these specific routes existed pre-063, the 063 patch *adds* a NEW blocking call inside the new POST contract path:

- Line 414: `supabase.table("threads").insert(insert_data).execute()` — sync, in async route
- Line 433: `supabase.table("threads").update(...).execute()` — sync, in async route
- Line 434: `supabase.table("threads").select("*")...single().execute()` — sync, in async route
- Line 477: `supabase.table("threads").delete()...execute()` — sync, in async route

Worst, the assistant-message INSERT inside the producer's `_persist_assistant_message` (line 970) IS wrapped via `aexec`, but the user-message INSERT is structurally inconsistent with the rest of the producer body which uniformly uses `aexec`.

A cross-tab GET while a `create_thread` or `delete_thread` is in flight will wait for the entire `supabase.table(...).execute()` round-trip — exactly the Phase 058 regression.

**Fix:** Wrap every sync `.execute()` call inside async handlers with `await aexec(builder)`:
```python
response = await aexec(supabase.table("threads").insert(insert_data))
new_thread = response.data[0]
```
Apply consistently to all four routes above. This is the same pattern already used inside `agent_runner` and `list_active_runs`.

---

### BL-02: `send_message` user-message INSERT will return `None` in production — POST always 500s

**File:** `backend/app/api/threads.py:662-691`

**Issue:** The new code shape:
```python
_user_msg_resp = await aexec(
    supabase.table("messages").insert({...}).select("id").single()
)
```
is incorrect against real PostgREST/supabase-py:

1. supabase-py's `.insert()` builder does not chain `.select("id").single()` to scope the returned row — the chain is `.insert(...).execute()` and the returned representation is controlled by the `Prefer: return=representation` header (the default in supabase-py). On supabase-py 2.x, `.insert(...).single()` is not a valid pattern; `.single()` is for query (select) builders.
2. Even if PostgREST tolerates the syntax, the response `.data` shape is **always** a list for INSERT operations (PostgREST always returns an array on writes); the defensive `isinstance(_user_msg_data, list)` branch then unwraps to a dict — but the comment claims "Real-PostgREST path takes the dict branch", which is the inverse of how supabase-py actually returns insert payloads.
3. If `.data` is in fact `None` (because `.single()` raised on the request and the patched `_safe` only handles HTTP 204), the code raises HTTP 500 with "Failed to persist user message" — every single POST.

This is contradicted by the defensive code itself: line 686 says "PostgREST should always return the inserted row when `.select("id").single()` is chained" but that is precisely what is questionable.

The downstream effect is severe — POST 500s, `message_id` is never returned, frontend dedup logic in `useMessages.sendMessage` (which currently does NOT use `message_id` at all — see WR-04 below) silently masks this in unit tests but the route fails for real users. None of the integration tests catch this because `_build_mock_supabase` fakes the insert response.

**Fix:** Use the standard supabase-py insert pattern and read the inserted id from `.data[0]`:
```python
_user_msg_resp = await aexec(
    supabase.table("messages").insert({
        "thread_id": thread_id,
        "user_id": current_user["id"],
        "role": "user",
        "content": body.content,
    })
)
_user_msg_data = _user_msg_resp.data
if isinstance(_user_msg_data, list) and _user_msg_data:
    _user_msg_id = _user_msg_data[0].get("id")
elif isinstance(_user_msg_data, dict):
    _user_msg_id = _user_msg_data.get("id")
else:
    _user_msg_id = None
if not _user_msg_id:
    logger.error(...)
    raise HTTPException(status_code=500, detail="Failed to persist user message")
```
Verify against a real Supabase instance before shipping — none of the new tests exercise the real PostgREST path for this code shape.

---

### BL-03: `subscriptionsRef` controller mismatch leaks subscriptions across reconcile + sendMessage

**File:** `frontend/src/hooks/useMessages.ts:421-475` (sendMessage), `frontend/src/hooks/useMessages.ts:591-630` (reconcile), `frontend/src/hooks/useMessages.ts:652-657` (unmount cleanup)

**Issue:** Two related leaks combine to produce duplicated open SSE subscriptions:

1. **sendMessage stores the WRONG controller.** Line 421-422 creates `controller` and assigns to `abortControllerRef.current`. Line 439 stores the same controller into `subscriptionsRef.current.set(run_id, controller)`. Then line 475 calls `subscribeToRun(run_id, "0", callbacks, controller.signal)`. This is fine on the happy path — but the `finally` block at line 488 sets `abortControllerRef.current = null` and at line 494 *deletes* the run_id from `subscriptionsRef`. So in steady state both refs are emptied even though `subscribeToRun`'s reader is still consuming data until terminal.

2. **reconcile cannot see sendMessage's run.** When `sendMessage` triggers a new run, the user navigates away briefly (visibility hidden), then returns: the visibilitychange listener fires `reconcile(threadId)`. `reconcile` checks `subscriptionsRef.current.has(run.run_id)` — but `sendMessage`'s `finally` already deleted that key (line 494), and the still-open SSE reader from `sendMessage` is no longer tracked. `reconcile` then **opens a SECOND `subscribeToRun(run.run_id, ...)`** for the same run, both consumers live until terminal. Net effect: every visibility flap during a streaming send leaks an extra HTTP/2 stream. With multiple flaps, N concurrent SSE consumers per run.

3. **Unmount cleanup races sendMessage's finally.** The `useEffect(() => () => {...})` at line 652-657 aborts every controller in `subscriptionsRef`. Because `sendMessage`'s `finally` deletes its entry pre-terminal (line 494 runs before the SSE actually closes if `subscribeToRun` itself returned but the reader's `try` body is unwinding — see code path at api.ts:340), an unmount during this window leaks the open reader entirely.

The order is worth tracing: `subscribeToRun` returns naturally after seeing `stream_end`, then `useMessages.sendMessage`'s `finally` fires (line 488+) and deletes from `subscriptionsRef`. Until that natural return, the `subscriptionsRef.has(run_id)` check inside `reconcile` correctly short-circuits. But: if the `reconcile` event fires *after* `subscribeToRun` returns but *before* sendMessage's await chain's `finally` block actually executes, the entry is still present. The reverse race — `reconcile` firing after the entry is removed but the reader still draining — happens because the `finally` at line 487 runs after `await subscribeToRun(...)` returns, NOT after the response body is fully consumed (`subscribeToRun` itself is the awaiter; the issue is more subtle, it's the **assertion comment** on line 494 that is wrong: deletion happens at the right moment in *some* paths but reconcile's "already subscribed" guard relies on the controller staying registered). The cleaner invariant is to keep the controller registered until `onTerminal` fires.

**Fix:**
1. In `sendMessage`'s `finally`, do NOT delete from `subscriptionsRef` — let the `onTerminal` wrapper handle removal:
```typescript
callbacks.onTerminal = (kind, errorPayload) => {
  // ... existing setMessages code ...
  if (registeredRunId) subscriptionsRef.current.delete(registeredRunId)
  if (errorPayload === "buffer_expired") loadMessages(threadId).catch(console.error)
  originalOnTerminal(kind, errorPayload)
}
```
2. In `reconcile`, do the same — call `delete` from `onTerminal`, NOT in the `.finally(...)` chain on line 623-630 (which fires before `onTerminal` may have completed its setMessages updates in StrictMode double-invoke scenarios).

3. Add a test: simulate a visibilitychange tick during an in-flight `sendMessage` and assert `subscriptionsRef.size === 1`, not 2.

---

### BL-04: `test_fixtures.inject_failed_run` accepts arbitrary string as `thread_id` — no UUID validation

**File:** `backend/app/api/test_fixtures.py:42-47`

**Issue:** The path parameter is typed as `thread_id: str`, not `thread_id: UUID`. The function then interpolates this directly into PostgREST calls and into the `messages.thread_id` and `runs.thread_id` columns. While PostgREST/Supabase will reject a non-UUID string at the database layer (the column is `uuid`), the failure mode is a generic 500 (not a clean 400), and the lack of validation invites future bugs if a developer copies this endpoint as a template.

More worryingly, the `inject_failed_run` endpoint is documented as a "test fixture" but is gated by env var only at mount-time in `app/main.py:155`. If a developer ever flips `ENABLE_TEST_FIXTURES=1` in a production-like staging environment for debugging and forgets to flip it back, the endpoint becomes live with this loose typing. Since the endpoint **inserts both a `messages` row AND a `runs` row** scoped to the caller's user, an authenticated user could spam `/__test__/inject-failed-run/<any-uuid-they-own>` to flood their own messages table with `[test-injected failed run]` placeholders — degraded UX, not a security incident.

The bigger concern is the threat model docstring's claim "Insert is scoped to the current user's id — no cross-user privilege escalation". The ownership SELECT on lines 79-89 correctly scopes by `user_id`, but if the user passes a `thread_id` that doesn't exist for them, the function correctly returns 404. That part is fine. The issue is that the endpoint allows *any authenticated user* to pollute their own data — there's no rate limit, no per-user cap. This deserves at least a comment noting this decision is conscious, or an explicit per-user-per-day cap.

**Fix:**
1. Type the path param as `UUID`:
```python
from uuid import UUID
async def inject_failed_run(
    thread_id: UUID,
    ...
):
```
FastAPI will then return 422 on non-UUID input automatically.

2. Add a startup-time **production-environment guard** in `main.py` next to the mount block — refuse to mount if any production-indicating env var is set:
```python
if os.getenv("ENABLE_TEST_FIXTURES", "0") == "1":
    if os.getenv("ENVIRONMENT", "").lower() in ("production", "prod"):
        raise RuntimeError("ENABLE_TEST_FIXTURES=1 in production environment — refusing to start")
    # ...existing mount...
```
This makes it impossible to accidentally enable in prod even with the env var set.

---

### BL-05: `MessageList.tsx` smooth-scroll fires on every token delta — fights user scroll, breaks layout

**File:** `frontend/src/components/chat/MessageList.tsx:36-46`

**Issue:** The `useEffect` runs on every change to `messages` or `isStreaming`. Inside, every render where `messages.length > prevCountRef.current` calls `bottomRef.current?.scrollIntoView({ behavior: "smooth" })`. This fires when:
- Reconcile inserts a new placeholder for an in-flight run (Phase 063 — once per `visibilitychange`/`focus`/`pageshow` tick when there's an in-flight run).
- A new user message is sent.
- `loadMessages` resolves and replaces the message list (here `messages.length` may transition from N to M where M > N, also triggering smooth scroll).

The `else if (isStreaming && isNearBottomRef.current)` branch at line 42 then fires `behavior: "instant"` on EVERY token delta — but `messages` reference identity changes on every `setMessages` map update (every delta is a fresh array), so this effect runs on every single token. This is intentional, but combined with the smooth-scroll on length increment, the visual effect is: smooth scroll → instant snap → smooth scroll → instant snap during reconcile + send.

There's also a real bug: `isNearBottomRef.current` is set by a `scroll` listener attached only on mount via `useEffect`. The listener uses `containerRef.current?.closest('[data-radix-scroll-area-viewport]')` to find the scroll viewport. If the ScrollArea hasn't yet rendered its viewport child when this effect runs, `el` is `null`, the listener never attaches, and `isNearBottomRef.current` stays at its initial `true` forever — meaning user-scroll-up is ignored and the auto-follow keeps fighting them.

**Fix:**
1. Add a `requestAnimationFrame` guard or simple debounce — don't smooth-scroll on every length increment from reconcile:
```typescript
useEffect(() => {
  const newCount = messages.length
  if (newCount > prevCountRef.current) {
    prevCountRef.current = newCount
    if (isNearBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: isStreaming ? "instant" : "smooth" })
    }
  } else if (isStreaming && isNearBottomRef.current) {
    bottomRef.current?.scrollIntoView({ behavior: "instant" })
  }
}, [messages, isStreaming])
```
Only auto-scroll when `isNearBottomRef.current` is true regardless of branch.

2. Move the `closest()` lookup into a `useLayoutEffect` (or use a `MutationObserver`) that retries until the viewport is actually mounted, OR use the Radix ref directly via `forwardRef` — currently the listener may never attach.

---

### BL-06: `resumeFromFailed` reads stale `messages` from closure — duplicates user message on rapid resume

**File:** `frontend/src/hooks/useMessages.ts:638-645`

**Issue:** `resumeFromFailed` is wrapped in `useCallback([messages, sendMessage])`. Each render that mutates `messages` (every token delta, every tool event) recreates the callback. The Resume button in `MessageItem.tsx:105` is wired to `() => onResume?.(message)` — `message` here is the props snapshot for that render of `MessageList`, threaded from `messages.map(...)`. So clicking Resume passes the version of `failedMessage` that was current at the LAST render before the click.

Inside `resumeFromFailed`, `messages.findIndex((m) => m.id === failedMessage.id)` reads the closure's `messages` snapshot. If a user clicks Resume during a re-render storm (very brief window), the snapshot may not yet reflect the latest message ordering. More importantly, if the user clicks Resume *while a different stream is in flight* (rare but possible after `reconcile`), `idx <= 0` returns silently with no user feedback.

But the worse bug is: `await sendMessage(failedMessage.thread_id, userMsg.content)` doesn't check `isSendingRef.current` itself — it relies on `sendMessage`'s own `if (isSendingRef.current) return` guard. That guard returns SILENTLY (no error). If the user double-clicks Resume, the first click flips `isSendingRef`; the second click silently no-ops. UX is fine but the missing feedback violates the D-v2.5-05 "Explicit user intent only" principle weakly — the user has no way to know their second click was eaten. This combined with the `useCallback` dep recomputation churn makes the timing fragile.

The deeper bug: there's no guard against resuming from a `failedMessage` whose preceding message is a different conversation turn. The check `if (userMsg.role !== "user") return` is correct, but if there's a tool message or system note between, the wrong message is re-sent. In current message ordering this may not happen, but the assumption is unstated.

**Fix:**
1. Find the preceding user message by walking backward, not by direct `idx - 1`:
```typescript
const resumeFromFailed = useCallback(async (failedMessage: Message) => {
  const idx = messages.findIndex((m) => m.id === failedMessage.id)
  if (idx < 0) return
  // Walk backward to find the most recent user message
  let userMsg: Message | undefined
  for (let i = idx - 1; i >= 0; i--) {
    if (messages[i].role === "user") {
      userMsg = messages[i]
      break
    }
  }
  if (!userMsg) {
    console.warn("resumeFromFailed: no preceding user message for", failedMessage.id)
    return
  }
  await sendMessage(failedMessage.thread_id, userMsg.content)
}, [messages, sendMessage])
```
2. Disable the Resume button visually while `isSendingRef.current` is true (or thread the `disabled` prop through from `useMessages` — equivalent to `isStreaming`).

---

## Warnings

### WR-01: Dead imports in `threads.py` — `EventSourceResponse` and `AsyncGenerator` no longer used

**File:** `backend/app/api/threads.py:9, 13`

**Issue:** The legacy SSE-on-POST path was deleted (D-063-01) but the module still imports:
- `from typing import AsyncGenerator` (line 9) — no `AsyncGenerator` typing used anywhere in the file post-cutover
- `from sse_starlette import EventSourceResponse` (line 13) — `event_consumer` is gone; nothing returns `EventSourceResponse` here anymore

Plan 01's `test_063_legacy_path_deleted.py` correctly checks that `send_message` does not reference `EventSourceResponse` in its source, but it doesn't check the module-level imports.

**Fix:** Delete both imports. Verify `ruff check` or `pyflakes` is clean on `app/api/threads.py`.

---

### WR-02: `subscribeToRun` parses SSE without checking `event:` line — payloads with embedded newlines truncated

**File:** `frontend/src/lib/api.ts:240-336`

**Issue:** The parser treats every line starting with `data: ` as a complete payload. Real SSE protocol allows multi-line `data:` continuations (server emits `data: {first}\ndata: {second}\n\n` to mean "concatenate"). The backend `_emit` always emits single-line `data:` payloads (good), but `json.dumps` on a payload containing a literal newline in `content` (e.g., a code stdout line) writes that newline as `\n` (escaped), so this is mostly safe.

However, the parser's `buffer.split("\n")` strategy is brittle — if a chunk's last byte is exactly the `\n` after a complete line, the next chunk begins with `data: ...` and parsing works. If a chunk arrives mid-payload (very common with HTTP/2), `lines.pop()` correctly returns the incomplete line as the new buffer. So far so good.

But: `if (!line.startsWith("data: ")) continue` silently drops `event:` lines (sse-starlette can emit `event: <name>\ndata: <payload>` framing; the backend doesn't currently use this, but if any future code path adds `event=...` to `_emit`, those events vanish). It also silently drops `:` heartbeat comments — which is fine, but worth noting.

The bigger issue: line 333 `} catch { /* ignore */ }` swallows ALL parse errors, including ones that may indicate a stream-format regression. There's no logging, no metric. A subtle backend wire-format break is invisible to the user.

**Fix:** Add a `console.warn` (or counter increment) on parse failure:
```typescript
} catch (parseErr) {
  console.warn("subscribeToRun: malformed SSE line", { raw, parseErr })
}
```

---

### WR-03: `cancelRun` does not check `signal` parameter — UI cannot abort the DELETE itself

**File:** `frontend/src/lib/api.ts:366-375`

**Issue:** `cancelRun(runId)` has no `signal` parameter. If the user clicks Stop and immediately navigates away, the in-flight DELETE cannot be cancelled and may write to a `runs` row that's already been cleaned up. Low-impact (DELETE is idempotent server-side per the route docstring) but inconsistent with other API helpers (`getMessages`, `getActiveRuns`, `subscribeToRun` all accept `signal`).

More important: `useMessages.stopStreaming` does not pass any signal even if the API supported it. If the user's click happens during a render storm that re-creates `stopStreaming` (it depends on `messages` — see line 330, every token delta recreates this callback), the click handler in MessageInput may have a stale `stopStreaming` closure. Probably benign because the closure still reads `messages` at click-time via React's batching, but the `useCallback([messages])` dep is structurally wrong — it should depend on a ref of the latest run_id, not on the entire messages array.

**Fix:**
1. Add `signal?: AbortSignal` to `cancelRun` signature.
2. Refactor `stopStreaming`'s dep array — replace `messages` with a ref:
```typescript
const messagesRef = useRef(messages)
useEffect(() => { messagesRef.current = messages }, [messages])
const stopStreaming = useCallback(async () => {
  const streamingMsg = [...messagesRef.current]
    .reverse()
    .find((m) => m.role === "assistant" && m.runStatus === "streaming")
  // ...
}, [])
```

---

### WR-04: `message_id` returned from POST is never used by frontend — dedup invariant unenforceable

**File:** `frontend/src/hooks/useMessages.ts:428-438`, `frontend/src/lib/api.ts:119-122, 174-196`

**Issue:** `postMessage` returns `{message_id, run_id}` per D-063-01 contract. The frontend destructures **only** `run_id` (line 428: `const { run_id } = await postMessage(...)`). The `message_id` (the persisted user-message UUID) is dropped on the floor.

The optimistic user-message placeholder (`userMsg.id = makeTempId()`, line 388-396) is never reconciled against the persisted id. When `loadMessages` later refetches after `onTerminal`, the refetched user message has a UUID id; the optimistic temp-id message stays in the array unless `loadMessages` blindly overwrites the entire array (which it does — line 366: `setMessages(data)`).

Net effect on the happy path: `setMessages(data)` from `loadMessages(threadId)` (called in `reconcile` and the `onTerminal` wrappers) replaces the whole array, dropping the temp-id placeholder. So the bug is *masked* — the user message appears correct after the refetch lands. But during the gap between sending and the refetch:
- The placeholder shows a temp id (`temp-1714...`)
- If the user sends another message immediately, the second send's optimistic insert appends to a list that still contains the temp-id user message AND the temp-id assistant placeholder — fine, but the count grows unboundedly per Phase 060 invariant.
- If a Realtime upsert arrives for the persisted user message before `loadMessages` resolves, it inserts a duplicate (now you have temp-id user + persisted user side by side until the next reconcile).

The fix is what the backend was clearly designed for — use `message_id` from the POST response to swap the placeholder's id:
```typescript
const { message_id, run_id } = await postMessage(...)
setMessages(prev => prev.map(m => m.id === userMsg.id ? { ...m, id: message_id } : m))
```

**Fix:** As shown above. Without this, the entire `message_id` field in the contract is dead weight.

---

### WR-05: `reconcile` cross-thread guard fires too late — placeholder may still be inserted

**File:** `frontend/src/hooks/useMessages.ts:551-590`

**Issue:** The `for (const run of activeRuns)` loop checks `if (activeThreadIdRef.current !== threadId) return` at line 568, but this check happens INSIDE the loop, AFTER the `Promise.all` has resolved. If `activeRuns` is empty, the for loop never runs and the cross-thread guard is never evaluated. Benign in this case.

But if `activeRuns` has one run and `setViewingThread(other)` fires between `Promise.all` resolution and the `for` loop entering — the guard at line 568 catches it correctly. **However**, the guard runs BEFORE the placeholder insert at line 585-589 — good. After the insert, on line 591-592 `subscribeToRun` is fired. There is NO post-fire check that `activeThreadIdRef.current` is still `threadId`; if the user navigates away during the `await ac.fetch` inside `subscribeToRun`, the consumer keeps writing to setMessages for messages on a thread the user is no longer viewing. The setMessages calls inside `makeStreamCallbacks` operate on the global `messages` state, not on a thread-scoped state — the assistant message will appear when the user navigates back.

This is mostly the desired behavior post-063 (the run survives the navigation per D-v2.5-08), so the placeholder content shows up on return. But the cross-thread placeholder INSERT (line 585-589) writes to the messages array NOW even though the user is on another thread — visible if they navigate back before terminal.

**Fix:** Add a per-tick guard before each `setMessages` inside `makeStreamCallbacks`, OR have the callbacks check `activeThreadIdRef.current === threadId` and no-op otherwise. The latter is cleaner — the placeholder gets inserted, but live updates only flow when the thread is currently visible. (Phase 060 D-060-01 invariant.)

---

### WR-06: `reconcile` opens GET stream WITHOUT awaiting (line 617) — double-fire on rapid visibility flap

**File:** `frontend/src/hooks/useMessages.ts:617-630`

**Issue:** Line 617 fires `subscribeToRun(...)` without `await`, then `.catch().finally()`. The `subscriptionsRef.current.set(run.run_id, controller)` at line 592 happens BEFORE the fire — so the next visibility tick will short-circuit on `subscriptionsRef.has(run.run_id)`. Good.

**However**: In React StrictMode, `useEffect` fires twice on mount. The first invocation calls `reconcile(threadId)`; before that promise resolves, the cleanup runs (in StrictMode) and the second invocation calls `reconcile(threadId)` again. Both `reconcile` calls await `Promise.all([getActiveRuns, loadMessages])`. The second one's `getActiveRuns` may resolve before the first one's `subscribeToRun` has executed the `set()` at line 592 — so both calls insert into `subscriptionsRef` and both fire `subscribeToRun`. The `subscriptionsRef.has(run.run_id)` guard at line 564 only protects against subsequent reconciles AFTER the first set has happened.

The race window is narrow but real on slow networks. The placeholder insert at line 585-589 IS idempotent (`if (prev.some((m) => m.id === placeholderId)) return prev`), but the duplicate `subscribeToRun` is not gated.

**Fix:** Move the `subscriptionsRef.current.set(run.run_id, controller)` to BEFORE the placeholder insert AND check `has` in a single atomic-feeling block:
```typescript
for (const run of activeRuns) {
  if (subscriptionsRef.current.has(run.run_id)) continue
  if (activeThreadIdRef.current !== threadId) return
  // Reserve the slot synchronously — second StrictMode invocation will short-circuit above.
  const controller = new AbortController()
  subscriptionsRef.current.set(run.run_id, controller)
  // ... placeholder insert ...
  // ... subscribeToRun(...).catch().finally(...) ...
}
```
This is essentially what the code does, but the comment and structure suggest the order matters more than the reader realizes — make it explicit.

---

### WR-07: ChatArea `useEffect` dependency on `reconcile` causes re-attach storm

**File:** `frontend/src/components/chat/ChatArea.tsx:110-133`

**Issue:** The effect's dep array `[thread?.id, reconcile]` includes `reconcile`. `reconcile` is wrapped in `useCallback([loadMessages])` (line 632), and `loadMessages` is wrapped in `useCallback([])` (line 372 — empty deps, stable). So `reconcile` should be stable.

**However**: `useMessages()` is called in `ChatArea` on every render. If `useMessages()` ever returns a new `loadMessages` reference — and it does NOT in current code, but the contract is brittle — this effect re-runs, removing and re-adding the visibility/focus/pageshow listeners. Each re-add creates fresh closures over `thread.id`. Over time, if any callback in `useMessages` gets recreated mid-stream, every listener add/remove cycle leaks the previous reconcile() call's still-pending fetches.

More directly: the effect's cleanup at line 128-132 removes the listeners but does NOT abort the in-flight `reconcile(thread.id)` call from line 112. If the effect re-runs (say, because `useMessages` regenerates `reconcile`), a new `reconcile` fires immediately, while the previous one is still resolving. The `subscriptionsRef` short-circuit at line 564 prevents duplicate consumers, but the pending `Promise.all` work duplicates.

**Fix:**
1. Stabilize `reconcile` more explicitly — wrap in a ref and call `reconcileRef.current(thread.id)` inside the effect.
2. Drop `reconcile` from the dep array (the eslint-disable-next-line comment elsewhere in this file already accepts this pattern).

---

### WR-08: `MessageItem.tsx:131-136` — JSX indentation reads as a parser/linter trap

**File:** `frontend/src/components/chat/MessageItem.tsx:131-145`

**Issue:** The block:
```tsx
            <span className="italic">
{isStreaming
                ? (allToolsDone ? "Synthesizing answer" : "Working")
                : message.stopped
                  ? "Response stopped"
                  : "Saving response…"}
            </span>
```
Note line 131 has zero indentation (the `{isStreaming` line) followed by 16-space indented branches. Line 145 closes a `</span>` then continues with `) : null}` outside expected JSX flow. This IS valid JSX/JS but trips up `eslint-plugin-jsx-a11y` or `prettier --check` because the closing tag appears mid-condition.

The actual logic is correct (a ternary inside `<span>`), but the indentation breaks readability — a reviewer cannot easily verify the branches at a glance, and `prettier` will rewrite this on save, producing a noisy diff in the next unrelated PR.

**Fix:** Run `prettier --write frontend/src/components/chat/MessageItem.tsx`, OR manually re-indent:
```tsx
            <span className="italic">
              {isStreaming
                ? (allToolsDone ? "Synthesizing answer" : "Working")
                : message.stopped
                  ? "Response stopped"
                  : "Saving response…"}
            </span>
```

---

### WR-09: Tests bypass the runs ownership check by mocking `runs.execute` to return any row — false positive risk

**File:** `backend/tests/integration/test_062_delete_happy.py:166-173`, `backend/tests/integration/test_062_multi_consumer_fanout.py:151-155`, `backend/tests/integration/test_062_stream_replay.py:108-113`, `backend/tests/integration/test_063_post_then_subscribe.py:135-140`

**Issue:** Each test wires the runs SELECT mock to return a row regardless of the WHERE clause:
```python
runs_builder.execute.side_effect = lambda *a, **k: type("R", (), {
    "data": {"run_id": run_id_str, "status": "streaming", ...},
    "count": None,
})()
```
This means the test cannot detect a regression where `stream_run` or `cancel_run` accidentally drops the `.eq("user_id", current_user["id"])` ownership filter — the mock always returns a row, the route always proceeds. The D-062-12 invariant ("404 NOT 403 to avoid leaking thread existence") is not verified by any of these tests.

This is not a bug introduced by Phase 063, but Phase 063's changes touch the same code path (POST → run_id → GET stream) and the new tests inherit the same blindspot. A real-Supabase RLS test (one that flips the `user_id` and asserts 404) would catch a future regression.

**Fix:** Add at least one test that:
1. Uses `_build_mock_supabase` with a runs SELECT that returns `[]` (no row) for the wrong user.
2. Asserts the GET stream returns 404.
3. Asserts the response body does NOT contain the run_id (to verify no leakage).

Also: track this as a SEED for the next milestone — full RLS-aware tests against a real Supabase instance.

---

_Reviewed: 2026-05-03_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
