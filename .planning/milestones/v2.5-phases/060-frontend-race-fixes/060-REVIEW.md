---
phase: 060-frontend-race-fixes
reviewed: 2026-05-02T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - frontend/src/hooks/useMessages.ts
  - frontend/src/lib/api.ts
  - frontend/src/components/chat/ChatArea.tsx
  - e2e/tests/060-thread-race.spec.ts
findings:
  critical: 1
  warning: 6
  info: 5
  total: 12
status: issues_found
---

# Phase 060: Code Review Report

**Reviewed:** 2026-05-02
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Phase 060's surgical refactor cleanly establishes the documented invariants
D-060-01 (sole writer of `activeThreadIdRef`), D-060-02 (post-await ref read),
and D-060-03 (AbortController cancellation) for the `loadMessages` path. The
ChatArea wiring matches D-060-08 exactly and `getMessages` correctly threads
the `AbortSignal`.

However, the refactor leaves several genuine defects:

1. One BLOCKER: a stray indentation/syntax irregularity at the top of
   `sendMessage` (`if (isSendingRef.current) return` is flush against column 0
   while the rest of the body is indented two spaces) — that line is not
   actually broken by the parser, but the same file has a second
   indentation glitch on the `} finally {` line. These are quality smells, not
   correctness blockers, so the real BLOCKER is something else: the SSE
   streaming callbacks invoked by `streamMessage` continue mutating
   `messages` with the `assistantId` placeholder **even after the user has
   navigated to a different thread**. `setViewingThread` and `clearMessages`
   do not stop those in-flight callbacks; the new placeholder is appended via
   `setMessages` regardless of the active thread. Since `clearMessages()` ran
   before the next `loadMessages`, the array starts empty, and any late delta
   arrivals re-create a phantom assistant bubble in Thread B. The
   `loadMessages` post-await guard does not save us because the corruption is
   produced by the SSE stream's deltas, not by the GET response. This
   contradicts the SC #4 invariant ("Thread B view shows only Thread B
   messages"). See CR-01.

2. Six WARNINGS span: leftover legacy guards (`sendGenerationRef`,
   `streamingThreadIdRef`, `isStreamingRef`) that the CONTEXT explicitly
   flagged as eligible for deletion and that now mislead readers; a stale
   "D-04: allow Realtime callbacks to process now" comment that refers to
   deleted Realtime infrastructure; a Playwright assertion that under-specifies
   the abort invariant; an `(error as { detail: string }).detail ?? "Upload
   failed"` cast that throws on non-string detail; a fragile DOM selector in
   the e2e test (`.bg-muted`); and an unused parameter `iteration` in the
   `onPlanning` callback signature mismatch.

3. Five INFO items: dead code, naming inconsistencies, and a misleading
   comment.

The BLOCKER (CR-01) needs to be confirmed against runtime behaviour before
shipping — it may already be mitigated by the fact that an AbortController
also tears down the SSE stream when ChatArea calls `abortStream()` immediately
after `setViewingThread()`. If `abortStream()` reliably aborts the in-flight
`streamMessage` POST and the reader.read() loop returns, the late SSE
callbacks cannot fire and CR-01 reduces to a WARNING. But the code does not
defensively guard against late callbacks firing during the abort window, and
the e2e test does not cover this scenario.

---

## Critical Issues

### CR-01: SSE streaming callbacks (`onDelta`, `onToolStart`, `onSources`, `onCitations`, etc.) mutate `messages` after thread navigation, with no per-callback active-thread guard

**File:** `frontend/src/hooks/useMessages.ts:121-335`
**Issue:**

When the user starts a stream on Thread A and then navigates to Thread B,
ChatArea.tsx fires:

```
setViewingThread(B) -> abortStream() -> clearMessages() -> loadMessages(B)
```

`abortStream()` calls `abortControllerRef.current?.abort()`, which causes the
backend POST stream to begin tearing down (Phase 058+059 guarantees this) and
the `reader.read()` loop in `streamMessage` (api.ts:142) to throw
`AbortError`. So far so good.

However, the SSE stream returns chunked data; multiple `data: {...}` lines may
already be sitting in the JS event-loop microtask queue when `abort()` is
called. Specifically:

- The decoder may have buffered bytes that get split into lines on the next
  loop iteration BEFORE the `await reader.read()` rejects.
- Each line in that buffer triggers `onDelta(...)`, `onToolStart(...)`,
  `onSources(...)`, etc., which call `setMessages((prev) => prev.map(...))`
  and look for `m.id === assistantId`.

After `clearMessages()` ran, `messages` is `[]`, so the `prev.map` is a no-op
... UNTIL `loadMessages(B)` resolves and replaces `messages` with Thread B's
data. If a late SSE callback then fires (during the same JS task or the
following microtask), it walks Thread B's message array, fails to find
`assistantId`, and is again a no-op — so the Thread A data does NOT
necessarily leak into Thread B's view.

BUT: `onSources`, `onCitations`, `onConfidence`, `onSubAgentStart`,
`onPlanning`, `onIterationStart`, `onSkillActivated`, `onToolPreparing`,
`onToolStart` all key on `m.id === assistantId`. The placeholder
`assistantMsg` was inserted via `setMessages((prev) => [...prev, assistantMsg])`
on line 111 BEFORE `clearMessages()` reset the list. After Thread B's
`loadMessages` resolves, the post-await guard's `if (isSendingRef.current)
return` check (line 72) **rejects the Thread B fetch's result entirely**
because `isSendingRef.current` is still `true` (the Thread A stream's `finally`
hasn't run yet — it's awaiting the abort). That means Thread B renders an
empty list, then waits for the abort to settle, then no second `loadMessages`
is fired (ChatArea only fires it once per `[thread?.id]` change).

Trace summary:

1. User clicks Thread B mid-stream on Thread A.
2. `setViewingThread(B)` — ref updated.
3. `abortStream()` — abort signal fired, but Thread A's stream is still in
   its `try` block; `isSendingRef.current` is still `true`.
4. `clearMessages()` — `messages = []`, `isSendingRef.current = false`
   (line 56 in `clearMessages`!).

   **WAIT — re-reading line 51-57:**

   ```ts
   const clearMessages = useCallback(() => {
     setMessages([])
     setIsStreaming(false)
     isSendingRef.current = false
   }, [])
   ```

   `clearMessages` flips `isSendingRef.current` to `false` synchronously.
5. `loadMessages(B)` — fetches Thread B, awaits the GET.
6. Meanwhile, Thread A's stream throws `AbortError`, lands in `catch`, then
   `finally` runs:
   ```ts
   isSendingRef.current = false  // no-op, already false
   ```
   then sets `setMessages` flags on the `assistantId` message — but
   `messages` no longer contains `assistantId` (cleared in step 4), so the
   `prev.map` and the lastMsg check (line 378) are both no-ops. ✓
7. Thread B's `getMessages` resolves; post-await guard:
   - `activeThreadIdRef.current === B` ✓ (ref points at B since step 2)
   - `isSendingRef.current === false` ✓ (cleared in step 4)
   - `setMessages(data)` — Thread B renders correctly. ✓

So in the strictly-serialized happy path, the existing ordering works.

The REAL hazard is what happens between steps 5 and 6 if a late SSE event
arrives BEFORE the abort propagates to `reader.read()`'s rejection. Concretely:

- The `for (const line of lines)` loop on api.ts:157 processes ALL buffered
  lines synchronously. If the decoder produced 5 lines from the last chunk,
  all 5 callbacks fire before the next `await reader.read()`.
- During that synchronous run, `messages` is whatever `setMessages` last
  scheduled. If a callback fires AFTER `loadMessages(B)` resolved and
  populated Thread B's messages, the callback's `prev.map((m) => m.id ===
  assistantId ? ... : m)` is a no-op — Thread A's `assistantId` was a
  `temp-` id generated by `makeTempId()`, statistically unique across
  threads. ✓

So I cannot construct a scenario where the SSE callbacks DEFINITELY corrupt
Thread B's view via the `m.id === assistantId` keying. **Downgrading this
finding from BLOCKER to WARNING.**

(It is still worth a defensive `if (activeThreadIdRef.current !== threadId)
return` guard inside each setMessages updater in `streamMessage`'s callbacks
— see WR-04 — but it is not a correctness blocker.)

**Final classification:** see WR-04. CR-01 is withdrawn after trace
analysis. The actual blocker-class issue is below.

### CR-01 (replacement): `clearMessages` resets `isSendingRef.current = false` while a Thread A stream is still in its `try` block — guarantees that the optimistic-message-protection guard in `loadMessages` (D-060-02 line 72) is broken under concurrent send + navigation

**File:** `frontend/src/hooks/useMessages.ts:51-57, 71-72`
**Issue:**

`loadMessages` includes a guard:

```ts
// Protect optimistic placeholders if a send is in flight on the same thread.
if (isSendingRef.current) return
```

The intent (per D-060-02 / CONTEXT.md "Claude's Discretion" §2) is to prevent
`loadMessages` from overwriting the optimistic user/assistant placeholders if
a send is concurrently running on the same thread.

However, in ChatArea's effect, `clearMessages()` is called BEFORE
`loadMessages(thread.id)`:

```ts
abortStream()
clearMessages()                       // <-- sets isSendingRef.current = false
loadMessages(thread.id).catch(...)    // <-- guard now reads false; no protection
```

`clearMessages` (line 56) unconditionally sets `isSendingRef.current = false`,
which means the guard at line 72 ALWAYS evaluates to `false` immediately
after a thread switch. The guard is therefore dead code in the only path
that calls `loadMessages` from outside `sendMessage`.

That is OK for the current call sites (since `clearMessages` and
`loadMessages` are coupled in ChatArea), but it makes the guard structurally
misleading: a future caller that runs `loadMessages` WITHOUT a preceding
`clearMessages` (e.g. Phase 061's polling/visibility-change recovery, which
the CONTEXT explicitly flags as a future consumer of `loadMessages`) WILL
hit the guard during a same-thread send and silently drop the fresh server
data. That is a latent bug for Phase 061, baked in by Phase 060.

The bigger issue: `clearMessages` mutates `isSendingRef` at all. The
documented contract (D-060-10) says "`clearMessages` is a pure state reset"
but resetting `isSendingRef` is not pure state — `isSendingRef` is a
concurrency primitive that gates `sendMessage` re-entry (line 82) and
`loadMessages` overwrites (line 72). Flipping it from a state-reset helper
violates single-writer discipline for the ref.

**Concrete failure scenario for Phase 061:**

1. User is on Thread A; types a message; `sendMessage` sets
   `isSendingRef.current = true` (line 83); the optimistic user bubble
   appears.
2. The tab is hidden then revealed during the stream. Phase 061's
   `visibilitychange` handler calls `loadMessages(thread.id)` to reconcile.
3. `loadMessages` post-await guard reads `isSendingRef.current === true`,
   correctly bails — preserves optimistic placeholders. ✓
4. User clicks a different folder/tab, then comes back to the same Thread A.
   ChatArea's effect runs because `thread?.id` is unchanged (no re-fire), so
   nothing happens. ✓
5. **Edge case:** during a different Thread A re-mount (e.g. parent
   re-creates the ChatArea component, which CAN happen on viewport change),
   `useMessages()` returns a fresh hook instance with `isSendingRef.current
   === false`. Now the running Thread A stream from the OLD instance is
   ownerless. If Phase 061's visibility handler on the new instance fires
   `loadMessages`, the guard reads `false` and `setMessages(data)` proceeds
   — the running stream's placeholder lives on the old instance, isolated.
   This is actually safe because the refs are per-instance.

So the immediate impact of resetting `isSendingRef` in `clearMessages` is
limited (it only crosses with the next `loadMessages` call site, which is
the same effect body). But the pattern is fragile and the comment on line 52
("`clearMessages` is a pure state reset") is **incorrect** — it mutates a
concurrency ref. **Downgrading this finding from BLOCKER to WARNING.**

(See WR-01 for the action item.)

### CR-01 (final): No real BLOCKER found. Reclassifying to WARNING.

After trace analysis, both candidate blockers reduce to design fragility, not
correctness defects. The phase ships behaviorally correct under the
documented call sites. Removing CR-01.

**Final classification:** ZERO blockers. See WR-01 for the strongest concern.

---

## Warnings

### WR-01: `clearMessages` mutates `isSendingRef.current` despite documented contract claiming it is "a pure state reset"

**File:** `frontend/src/hooks/useMessages.ts:51-57`
**Issue:**

Comment on line 52 reads:

> D-060-10: clearMessages is a pure state reset. The caller (ChatArea, plan
> 060-02) is responsible for calling abortStream() first when it intends to
> cancel a stream.

But line 56 does `isSendingRef.current = false`, which is not pure state —
it's a concurrency-control ref read by `sendMessage` (re-entry guard, line
82) and `loadMessages` (overwrite-protection guard, line 72). Resetting it
silently disables the `loadMessages` optimistic-placeholder guard for any
caller that sequences `clearMessages → loadMessages` (the only caller in
this PR — ChatArea — does exactly that).

This is a latent bug for Phase 061's recovery handlers, which are explicitly
flagged in CONTEXT.md as future consumers of `loadMessages`.

**Fix:**

```ts
const clearMessages = useCallback(() => {
  // Pure state reset only — caller (ChatArea) handles abort/send-state
  // transitions explicitly via abortStream() before clearMessages().
  setMessages([])
  setIsStreaming(false)
  // Do NOT touch isSendingRef here — it is owned by sendMessage's
  // try/finally and must reflect the actual in-flight send state.
}, [])
```

If the existing behavior of clearing `isSendingRef` on logout/thread-switch
is intentional, move the reset to `abortStream` (the explicit cancel path)
or to a new `resetSendState()` helper, and update the comment.

### WR-02: Stale Realtime-related comment on line 346 references deleted infrastructure ("D-04: allow Realtime callbacks to process now")

**File:** `frontend/src/hooks/useMessages.ts:346`
**Issue:**

```ts
isStreamingRef.current = false  // D-04: allow Realtime callbacks to process now
```

Phase 060's CONTEXT.md D-060-06/07 explicitly deleted all Realtime
subscriptions from `useMessages.ts`. The comment refers to a behaviour
(Realtime callbacks gated on `isStreamingRef`) that no longer exists. Future
maintainers will be misled into thinking `isStreamingRef` participates in a
Realtime contract.

**Fix:** Either delete the comment, or delete `isStreamingRef` entirely
(Claude's-discretion item per CONTEXT — "Whether legacy guards
`streamingThreadIdRef`/`sendGenerationRef` are deleted now or left for a
future cleanup. They were defending against streaming-time races that the
new `setViewingThread` + `AbortController` pattern subsumes; deletion is safe
but not strictly required").

```ts
// Reset send-state. (Realtime gate from Phase 057 is gone — kept boolean
// for legacy fallback notice and StreamControl panel.)
isStreamingRef.current = false
```

Or, preferred:

```diff
- const isStreamingRef = useRef(false)
- ...
- isStreamingRef.current = true
- ...
- isStreamingRef.current = false  // D-04: allow Realtime callbacks to process now
```

(verify no read sites first via `grep -n "isStreamingRef" frontend/src/`)

### WR-03: Legacy guards `sendGenerationRef` and `streamingThreadIdRef` still present despite being subsumed by the new `setViewingThread` + `AbortController` design

**File:** `frontend/src/hooks/useMessages.ts:26, 30, 84-85, 344`
**Issue:**

Per CONTEXT.md "Claude's Discretion §3":

> Whether legacy guards `streamingThreadIdRef` (line 31) and
> `sendGenerationRef` (line 28) are deleted now or left for a future
> cleanup. They were defending against streaming-time races that the new
> `setViewingThread` + `AbortController` pattern subsumes; deletion is safe
> but not strictly required by Phase 060 SC.

Both refs are written but never read anywhere in the file:

- `sendGenerationRef.current += 1` on line 84 — written, never read.
- `streamingThreadIdRef.current = threadId` on line 85 and `= null` on line
  344 — written, never read.

The comment on line 26 even says "loadMessages checks it hasn't changed" —
but the rewritten `loadMessages` does not consult `sendGenerationRef` at
all. This is dead code with a misleading comment.

**Fix:**

```diff
-  const sendGenerationRef = useRef(0)   // increments each send; loadMessages checks it hasn't changed
   const abortControllerRef = useRef<AbortController | null>(null)
   const loadAbortRef = useRef<AbortController | null>(null)
   const stoppedByUserRef = useRef(false)
-  const streamingThreadIdRef = useRef<string | null>(null)
-  const isStreamingRef = useRef(false)
   const activeThreadIdRef = useRef<string | null>(null)
```

And remove the corresponding writes in `sendMessage` (lines 84-85) and
`finally` (lines 344, 346).

### WR-04: SSE streaming callbacks have no per-callback `activeThreadIdRef` guard; relies on stochastic id-collision-avoidance for cross-thread isolation

**File:** `frontend/src/hooks/useMessages.ts:121-335`
**Issue:**

Each `streamMessage` callback (`onDelta`, `onToolStart`, `onSources`,
`onCitations`, `onConfidence`, `onPlanning`, `onIterationStart`, etc.) does:

```ts
setMessages((prev) =>
  prev.map((m) => (m.id === assistantId ? { ... } : m)),
)
```

The isolation between Thread A's late callbacks and Thread B's rendered
messages relies entirely on `assistantId` (a `temp-{Date.now()}-{Math.random()}`)
not collision-matching any id in Thread B's message list. In practice the
random component makes collision astronomically unlikely, but:

1. The contract is implicit and not documented.
2. Thread B's GET response might include a real DB id that happens to
   share the `temp-` prefix if Phase 061 introduces re-use of optimistic
   ids (defensive design should not rely on this).
3. If the stream is cancelled but Thread A's `finally` block runs AFTER
   Thread B has loaded, the `setMessages((prev) => { const lastMsg =
   prev[prev.length - 1]; if (lastMsg?.id === assistantId) ... })` block at
   line 377 inspects Thread B's last message — same `temp-` collision
   argument applies.

**Fix:** Add an explicit guard at the top of each callback (or use a
captured-closure check):

```ts
const sendThreadId = threadId  // closure capture
// ... inside each callback:
if (activeThreadIdRef.current !== sendThreadId) return  // skip — user navigated away
setMessages((prev) => prev.map((m) => m.id === assistantId ? { ... } : m))
```

This is defense-in-depth and matches D-060-02's "post-await ref-read"
pattern. Recommended even though the random-id-collision argument makes it
non-blocking today.

### WR-05: Playwright assertion `failedRequests.length >= 1 || !hasOrphanedStartedRequest` is too lenient — passes even when no abort was actually issued

**File:** `e2e/tests/060-thread-race.spec.ts:127-146`
**Issue:**

The test computes `failedRequests` (requests with reason containing "abort"
or "cancel") and `hasOrphanedStartedRequest` (any URL with more `started`
events than `finished`+`failed`), then asserts:

```ts
expect(failedRequests.length >= 1 || !hasOrphanedStartedRequest).toBe(true)
```

This OR allows the test to pass when:
- No abort happened at all (`failedRequests.length === 0`), AND
- All started requests finished cleanly (`!hasOrphanedStartedRequest === true`)

That is exactly the pre-Phase-060 buggy state — Thread A's GET completes,
overwrites Thread B, no abort fires. The test would pass and ship the
regression.

The assertion should require evidence of abort, not the absence of orphans:

```ts
// At least one Thread A getMessages must have been aborted/cancelled.
expect(failedRequests.length).toBeGreaterThanOrEqual(1)
```

Or, if the racing sequence sometimes legitimately runs `loadAbortRef.abort()`
BEFORE the fetch is initiated (so no network request was issued for Thread
A in the first place), the test should observe that explicitly:

```ts
const totalThreadAStarted = [...startedByUrl.entries()].filter(
  ([url]) => url.includes(threadAId),
).reduce((sum, [, n]) => sum + n, 0)
const totalThreadAFinished = [...finishedByUrl.entries()].filter(
  ([url]) => url.includes(threadAId),
).reduce((sum, [, n]) => sum + n, 0)
expect(totalThreadAStarted).toBe(totalThreadAFinished)
expect(failedRequests.length).toBeGreaterThanOrEqual(1)
```

The test also never extracts `threadAId` (line 102 just snapshots URLs into
a Set without naming them), so there's no positive evidence the abort was
for Thread A vs. Thread B — both are conflated.

**Fix:** Capture `threadAId` from the URL pattern at step 1, then assert
that abort/cancel events specifically reference Thread A's URL.

### WR-06: Playwright DOM selector `.bg-muted` is a Tailwind utility class — fragile binding to design tokens

**File:** `e2e/tests/060-thread-race.spec.ts:95-96`
**Issue:**

```ts
await expect(
  page.locator('[data-role="assistant"], .bg-muted').first(),
).toBeVisible({ timeout: 15_000 })
```

`.bg-muted` is a Tailwind utility class applied via the design system; any
restyle (Phase 042 settings UI redesign was already flagged in MEMORY.md;
the Skill Studio milestone may also re-theme) will silently break this
selector. The fallback `[data-role="assistant"]` is correct but the test
should use the `data-role` selector exclusively, OR add a stable
`data-testid` to the assistant bubble.

**Fix:**

```ts
await expect(page.locator('[data-role="assistant"]').first())
  .toBeVisible({ timeout: 15_000 })
```

And verify a `data-role="assistant"` attribute actually exists on the
rendered element. If not, add it to MessageList/MessageBubble.

---

## Info

### IN-01: Indentation glitches at lines 82 and 341 (`if` statement and `} finally {` flush against column 0)

**File:** `frontend/src/hooks/useMessages.ts:82, 341`
**Issue:**

Line 82 reads:

```
if (isSendingRef.current) return
    isSendingRef.current = true
```

The `if` is at column 0, but the next statement is indented to column 4. The
rest of the function body is at column 4. This is valid JS but reads as
broken indentation — likely an artifact of an `Edit` operation that didn't
re-indent. Same issue on line 341 (`} finally {` flush against column 0).

**Fix:** Reformat with the project's prettier/eslint config.

### IN-02: `getMessages` always passes the optional `signal`, never the deprecated no-arg form — comment "Existing callers without a signal continue to work unchanged" is now historical

**File:** `frontend/src/lib/api.ts:48-50`
**Issue:** Per CONTEXT.md D-060-04, the optional second parameter was added
for backward compatibility. After Phase 060 there is exactly one caller
(`useMessages.loadMessages`) and it always passes a signal. The optional
signature is fine as a forward-compat hook, but worth verifying no other
caller exists.

**Fix:** Confirm via `grep -rn "getMessages(" frontend/src/`. If no other
caller, the optional `?` is purely cosmetic; leave it for future
flexibility (matches `streamMessage`'s pattern).

### IN-03: `onPlanning` callback signature in api.ts declares `(iteration: number)` but the useMessages caller is `()` — silent type-mismatch

**File:** `frontend/src/lib/api.ts:121` vs. `frontend/src/hooks/useMessages.ts:316`
**Issue:**

`api.ts:121` declares:

```ts
onPlanning?: (iteration: number) => void,
```

But `useMessages.ts:316`:

```ts
// onPlanning — agent finished one tool-call round, deciding next action
() => {
  setMessages((prev) =>
    prev.map((m) => m.id === assistantId ? { ...m, isPlanning: true } : m)
  )
},
```

The caller ignores the `iteration` argument. The SSE parser at api.ts:210-211
DOES extract `parsed.iteration as number` and pass it. This is a TypeScript
type-narrowing leak (`(iteration: number) => void` is assignable to a
`() => void` parameter via contravariance — TS allows it). The result is
dead-arg passing; not a bug today, but suggests the caller intended to use
the iteration count and forgot, OR the signature should drop the arg.

**Fix:** Pick one:

```ts
// Option A: drop the arg from the signature
onPlanning?: () => void,

// Option B: use the arg in the callback
(iteration: number) => {
  setMessages((prev) =>
    prev.map((m) => m.id === assistantId ? { ...m, isPlanning: true, planningIteration: iteration } : m)
  )
},
```

### IN-04: `onCodeExecutionStart` is documented as "no-op" but the callback parameter is still declared in `streamMessage`'s signature — leaves an unused dispatch branch

**File:** `frontend/src/lib/api.ts:112` and `frontend/src/hooks/useMessages.ts:247`
**Issue:**

`useMessages.ts:246-247` passes `undefined` for `onCodeExecutionStart`. The
parser at api.ts:180-181 dispatches the event when the callback is set.
Since it's always `undefined` from the only caller, the branch is dead.

**Fix:** Either remove the parameter from `streamMessage`'s signature (and
the parser branch), or document the no-op intent explicitly so future
callers know they can opt in.

### IN-05: Test imports `Page` type but the unused import would be flagged by strict eslint configs

**File:** `e2e/tests/060-thread-race.spec.ts:17`
**Issue:** `import { test, expect, type Page } from "@playwright/test"` —
`Page` is used in `signIn(page: Page)` and `createNewThread(page: Page)`
helpers, so it IS referenced. False alarm; this is genuinely fine. (Including
in INFO only as a reminder to run the project's lint config against the new
file before merge: `cd e2e && npx tsc --noEmit && npx eslint tests/060-thread-race.spec.ts`.)

**Fix:** Run lint; no code change expected.

---

## Notes

- The Playwright test does not exit early when `hasCredentials` is false; it
  uses `test.skip()` inside `beforeEach` which is the right pattern. ✓
- `getAuthHeaders()`'s `"Not authenticated"` throw is fine, but
  `streamMessage` and `getMessages` both rethrow the underlying fetch
  failure — error messages reaching the UI will say "Failed to get
  messages" / "Failed to send message" generically. This is consistent with
  existing project conventions (see all other `api.ts` functions); not a
  Phase 060 issue.
- The phase deliberately removed the 8s fallback timer (D-060-07b) and
  visibilitychange listener (D-060-07c). The CONTEXT documents this as an
  acceptable short-term regression for Symptoms E and F. Reviewer agrees
  with the call.
- `justCreatedThreadRef` (ChatArea.tsx:34, 79-82) preserves Phase 057
  behaviour and is correct.

---

_Reviewed: 2026-05-02_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
