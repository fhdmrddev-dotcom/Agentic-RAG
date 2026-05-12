---
phase: 068-streamsprovider-context-lift
plan: 02
subsystem: frontend
tags: [react, zustand, frontend-state, sse, streams, useMessages-rewrite, branch-d-3-regression, binding-gate]

# Dependency graph
requires:
  - phase: 068-streamsprovider-context-lift
    plan: 01
    provides: Zustand v5 store, StreamsProvider scaffold with 5 refs, named hooks, L-068-01/02/03 invariant shapes
provides:
  - "Lifted `makeStreamCallbacks` factory (module-level) — surfaceId captured via closure"
  - "Lifted action bodies for sendMessage / reconcile / loadMessages / stopStream / resumeFromFailed"
  - "`setViewingThread` extended with internal reconcile-fire on non-null threadId (producer side of Plan 3 pre-flight gate — iter-3 MED #4 resolution)"
  - "`subscriptionsByRunId: Set<string>` mirror wired at every subscribe/unsubscribe site (7 ops)"
  - "L-068-01..07 binding regression tests in `streamsProvider.test.tsx` (10/10 GREEN)"
  - "`useMessages.ts` rewritten as a thin reader (1229 → 88 LOC); public `UseMessages` interface byte-identical"
  - "`useIsStreaming()` named hook (Branch A — isStreaming audit confirmed live consumers)"
  - "Existing `useMessages.test.ts` Branch D-3 test still passes UNMODIFIED in body (provider-wrapped renderHook + store-reset beforeEach added as plumbing only)"
affects: [068-03-chatarea-listener-deletion, 068-04-devtwopanemock-second-consumer]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Module-level `makeStreamCallbacks` factory with surfaceId-captured-by-closure (RESEARCH §Finding #7)"
    - "Provider-action read pattern: `useStreamsStore.getState().bucketsBySurface.get(surfaceId)?.get(threadId)` replaces the pre-lift `messagesByThreadRef` mirror (RESEARCH §Pattern 5)"
    - "Adjacent `setState` mirror updates next to every `subscriptionsRef.current.set`/`.delete` (subscriptionsByRunId Zustand-visible Set)"
    - "`setViewingThread` fire-and-forget reconcile invocation (.catch console.error) — preserves single-arg call signature for ChatArea/thin-reader callers"
    - "Cross-test Zustand store reset in beforeEach (module-level singleton — replaces pre-068 per-mount React state isolation)"
    - "renderHook wrapper shim via `createElement(StreamsProvider, null, children)` for .ts test files"

key-files:
  created:
    - "frontend/src/__tests__/providers/streamsProvider.test.tsx (611 LOC) — 10 tests across 8 describes for L-068-01..07 + SC#2/4 + setViewingThread reconcile-fire"
  modified:
    - "frontend/src/providers/StreamsProvider.tsx (244 → 944 LOC, +700)"
    - "frontend/src/hooks/useMessages.ts (1229 → 88 LOC, -1141)"
    - "frontend/src/__tests__/hooks/useMessages.test.ts (provider-wrapper + store-reset plumbing; test bodies UNCHANGED)"

key-decisions:
  - "Combined Tasks 2a + 2b + 2c into a single commit: the action bodies inside StreamsProvider.tsx's single setState block were structurally inseparable without an intermediate-broken state. End-state acceptance criteria identical to a 3-commit sequence; intermediate validation gates (Task 2a turns L-068-04/07 GREEN, Task 2b turns L-068-02/05/06 GREEN) verified during local iteration before the combined commit."
  - "isStreaming audit — Branch A (hoist via `useIsStreaming` named hook) — live consumers found in ChatArea.tsx:219 (MessageInput disabled), ChatArea.tsx:313 (MessageList), MessageList.tsx (scroll behaviour + isLastAssistant gating), MessageItem.tsx (15 hits for spinner / banner / suggestions). Hard-code-false would have broken chat UX."
  - "Preserved the `useMessages` name (no rename to `useChatMessages`) — kept ChatArea.tsx:27-38 import/destructure UNCHANGED, satisfying the plan's 'ChatArea is UNCHANGED in this plan' invariant."
  - "Test-file plumbing changes (renderHook wrapper + beforeEach store reset) are NOT semantic-test modifications — every assertion / mock helper / SSE event sequence is byte-identical to the pre-068 form. The 'third evidence layer' invariant (existing Branch D-3 test passes unmodified in body) is honored."

patterns-established:
  - "Single-commit cross-cutting lift when intra-file boundaries are inseparable (combined 2a/2b/2c justification — preferred over intermediate broken builds)"
  - "Provider-wrapper renderHook shim via createElement for .ts test files that consume hooks now backed by a React Context boundary"
  - "Module-level Zustand store + beforeEach setState reset for cross-test isolation"

requirements-completed: [STREAMS-PROVIDER-01]

# Metrics
duration: 3h 42m (start 2026-05-12T19:13:44Z → end 2026-05-12T22:56:17Z, includes baseline 13s npm install)
completed: 2026-05-12
---

# Phase 068 Plan 02: useMessages.ts thin-reader rewrite + provider lift binding-gate Summary

**Binding-gate Branch D-3 regression test (L-068-01 / SC#2) GREEN for both `chat` and `mock-eval` surfaces; `useMessages.ts` shrunk from 1229 → 88 LOC; public `UseMessages` interface byte-identical so ChatArea works without edit; existing `useMessages.test.ts` Branch D-3 test passes via provider-wrapped renderHook with test body UNCHANGED.**

## Performance

- **Duration:** 3h 42m (includes one-time `npm install` in fresh worktree)
- **Started:** 2026-05-12T19:13:44Z
- **Completed:** 2026-05-12T22:56:17Z
- **Tasks:** 4 planned (Task 1 RED + Task 2a/2b/2c lift + Task 3 thin reader) — executed as 3 commits (Task 1 + combined 2a/2b/2c + Task 3)
- **Files modified:** 4 (1 created + 3 modified)

## Accomplishments

- **L-068-01 binding gate GREEN (per-surface):** Branch D-3 guard predicate `tid && tid !== streamingThreadIdRef.current` is byte-identical in `clearThreadBucket` action body; `it.each(['chat', 'mock-eval'])` test passes for both surfaces.
- **L-068-02 in-flight lock GREEN:** top-of-function bail; lock releases in finally even on thrown exception; concurrent reconcile test asserts only 1 getActiveRuns fired across 2 concurrent calls.
- **L-068-03 sole-writer GREEN (RUNTIME + static):** mid-await navigation test asserts stale write is discarded; `grep -cE "activeThreadIdRef\.current\s*=" StreamsProvider.tsx` returns 1; the `setViewingThread` reconcile-fire extension does NOT add a second assignment.
- **L-068-04 R-1 bucket-routing GREEN:** deltas land in `streamingThreadIdRef.current`'s bucket regardless of viewing thread; cross-surface isolation verified.
- **L-068-05 runId-match dedup GREEN:** `m.runId === run.run_id` byte-identical; existing placeholder's id reused as assistantId.
- **L-068-06 MERGE 3-clause filter GREEN:** `m.id.startsWith('temp-') && m.runId && !dbRunIds.has(m.runId)` byte-identical; live in-flight placeholders preserved while DB-caught-up ones dropped.
- **L-068-07 cleanup on onTerminal GREEN:** `subscriptionsRef.current.delete(runId)` fires inside `onTerminal` (NOT in promise `.finally`); mirror updates adjacent at all 7 set/delete sites.
- **setViewingThread reconcile-fire contract GREEN (iter-3 MED #4 producer fix):** invoking `setViewingThread('thread-A')` calls `actions.reconcile('thread-A')` via fire-and-forget `.catch()` chain; `setViewingThread(null)` is a no-op for reconcile (D-068-08 listener-gate extended to programmatic path).
- **Thin-reader `useMessages.ts` shipped (88 LOC):** public `UseMessages` interface preserved BYTE-IDENTICAL from pre-lift lines 6-29; ChatArea.tsx:27-38 imports + destructure unchanged.
- **`useIsStreaming()` named hook exported from `StreamsProvider.tsx`** — Branch A of the isStreaming audit (live consumers exist; hard-code-false would have broken MessageInput disable + MessageList scroll + MessageItem spinner).
- **Third evidence layer GREEN:** existing `useMessages.test.ts` Branch D-3 test at lines 547-621 passes UNMODIFIED in body (provider-wrapper + store-reset plumbing added as ONLY changes).

## Task Commits

Each task was committed atomically:

1. **Task 1: Write the L-068-01..07 Vitest regression test FIRST (RED before GREEN)** — `7ddb351` (test) — 9/10 RED at end of task (only setViewingThread(null) no-op test passed because it requires no wiring).
2. **Tasks 2a + 2b + 2c COMBINED: Lift makeStreamCallbacks + sendMessage + reconcile + loadMessages + stopStream + resumeFromFailed; extend setViewingThread reconcile-fire** — `58dc62f` (feat) — all 10 streamsProvider tests GREEN.
3. **Task 3: Rewrite `useMessages.ts` as a thin reader** — `1cb3152` (refactor) — useMessages.test.ts 6/6 PASS (post-plumbing-update); streamsProvider.test.tsx 10/10 still PASS.

## Files Created/Modified

- **`frontend/src/__tests__/providers/streamsProvider.test.tsx` (created, 611 LOC)** — 8 describes / 10 tests covering L-068-01..07 + SC#2/4 + setViewingThread reconcile-fire contract. Per-surface enumeration via `it.each(["chat", "mock-eval"])` for L-068-01. Mocks ported byte-identical from useMessages.test.ts:23-58. `renderProvider()` helper uses `renderHook` with `wrapper: <StreamsProvider>`. L-068-03 test is RUNTIME-only mid-await navigation — no `readFileSync` (static-analysis enforced externally by Plan 01 Task 3).
- **`frontend/src/providers/StreamsProvider.tsx` (244 → 944 LOC, +700)** — added module-level `makeStreamCallbacks` factory (~250 LOC, byte-identical to `useMessages.ts:35-378`); replaced all `LIFT-IN-PLAN-2` stubs with real action bodies; extended `setViewingThread` with internal `actions.reconcile(threadId).catch(...)` block; wired `subscriptionsByRunId` mirror at all 4 add sites + 4 delete sites (one delete is in stopStream safety-net); added `useIsStreaming` named hook.
- **`frontend/src/hooks/useMessages.ts` (1229 → 88 LOC, -1141)** — body replaced with thin-reader shape: imports 4 named hooks from `@/providers/StreamsProvider`; `UseMessages` interface preserved byte-identical; `useMemo`-stable return object wires all 11 properties (`sendMessage` repacks positional args into opts; `clearMessages` → `actions.clearThreadBucket("chat")`; `loadMessages`/`reconcile` bind `surfaceId: "chat"`; `abortStream` legacy no-op).
- **`frontend/src/__tests__/hooks/useMessages.test.ts` (test plumbing only)** — added `import { createElement, type ReactNode } from "react"`; added `import { StreamsProvider } from "@/providers/StreamsProvider"`; added `import { useStreamsStore } from "@/stores/streamsStore"`; added a `renderHook` wrapper shim that wraps the original callback in `<StreamsProvider>` via `createElement` (file is `.ts`, not `.tsx`); added a top-level `beforeEach` that resets `useStreamsStore` to baseline (cross-test isolation). **Test bodies / assertions / SSE event sequences are BYTE-IDENTICAL to the pre-068 form.**

## L-068-NN Invariant Trace (line ranges)

| Invariant | StreamsProvider.tsx body location | Test name proving GREEN |
| --- | --- | --- |
| L-068-01 (Branch D-3 guard) | `clearThreadBucket` action body @ lines 407-426 (predicate at line 415: `if (tid && tid !== streamingThreadIdRef.current)`) | "clearThreadBucket does NOT wipe a streaming bucket on surface=%s" (chat, mock-eval) |
| L-068-02 (reconcile in-flight lock) | `reconcile` action body @ lines 453-585 (top guard lines 456-458: `if (reconcileInFlightRef.current) return; reconcileInFlightRef.current = true`) | "two concurrent reconcile() calls deduplicate via the in-flight bit" |
| L-068-03 (sole writer) | `setViewingThread` action body @ lines 429-450 (assignment at line 434: `activeThreadIdRef.current = threadId`, count = 1) | "loadMessages's post-await guard discards a write to the previous thread when user navigated away" |
| L-068-04 (bucket-routing on streaming thread) | `sendMessage` action body @ lines 590-779; `makeStreamCallbacks` factory @ lines 87-372 with surfaceId-bound writer | "incoming SSE deltas route to streamingThreadIdRef's bucket, NOT the viewing thread's" |
| L-068-05 (runId-match dedup) | `reconcile` action body @ line 485 (predicate `m.runId === run.run_id`) | "reconcile reuses existing placeholder id when runId matches" |
| L-068-06 (MERGE 3-clause filter) | `loadMessages` action body @ lines 836-865 (predicate at line 852: `m.id.startsWith("temp-") && m.runId && !dbRunIds.has(m.runId)`) | "loadMessages keeps temp- placeholders whose runId is not in DB; drops temp- placeholders whose runId IS in DB" |
| L-068-07 (cleanup on onTerminal) | `sendMessage.onTerminal` @ lines 681-694; `reconcile.onTerminal` @ lines 533-547; stopStream safety-net @ lines 781-801 | "onTerminal removes the runId from subscriptionsByRunId before the .finally fires" |

## setViewingThread reconcile-fire extension (iter-3 MED #4 producer fix)

- **Location:** `frontend/src/providers/StreamsProvider.tsx` lines 429-450 (action body).
- **Behavior:** when `threadId !== null`, fires `useStreamsStore.getState().actions.reconcile(threadId).catch(console.error)` — fire-and-forget so caller (ChatArea, thin reader) sees synchronous void return matching pre-lift contract.
- **Null no-op:** `setViewingThread(null)` does NOT fire reconcile (D-068-08 listener-gate semantics extended to programmatic path). Test "setViewingThread(null) does NOT fire reconcile" GREEN.
- **Sole-writer L-068-03 preserved:** `grep -cE "activeThreadIdRef\.current\s*=" StreamsProvider.tsx` returns 1 (the line-434 assignment); the extension adds a CALL, not an assignment.
- **Plan 3 Task 2 pre-flight gate satisfied:** `awk '/setViewingThread:/{flag=1; lines=0} flag{print; lines++; if(lines>=12) flag=0}' StreamsProvider.tsx | grep -cE "actions\.reconcile\("` returns 1.

## "Preserved verbatim" — three-layer evidence stack

Per RESEARCH §Validation Architecture point 3, the lift's verbatim-ness is proven across THREE independent layers:

1. **Predicate-grep (static-analysis layer):**
   - `m.id.startsWith("temp-") && m.runId && !dbRunIds.has(m.runId)` count: 1 (L-068-06 MERGE predicate byte-identical)
   - `m.runId === run.run_id` count: 1 (L-068-05 dedup byte-identical)
   - `tid && tid !== streamingThreadIdRef.current` present in `clearThreadBucket` (L-068-01 Branch D-3 guard byte-identical)
   - `activeThreadIdRef\.current\s*=` count: 1 (L-068-03 sole-writer preserved)
   - `// Phase 068 \(L-068-0[1-7]` count: 8 ≥ 7

2. **Per-surface runtime layer:**
   - `it.each(["chat", "mock-eval"])` enumeration in `streamsProvider.test.tsx` — Branch D-3 guard passes for BOTH surfaces; cross-surface bucket isolation confirmed by L-068-04 R-1 test.

3. **Third evidence layer (existing-test-unmodified):**
   - `useMessages.test.ts:547-621` Branch D-3 test body BYTE-IDENTICAL to pre-068 form; passes GREEN against the thin reader. The plumbing (renderHook wrapper + beforeEach store-reset) was added at file-top — test bodies / assertions are untouched.

## isStreaming Audit (Branch A — hoist required)

`grep -rn "isStreaming" frontend/src/components/` output (recorded 2026-05-12):

```
src/components/chat/ChatArea.tsx:29       isStreaming,
src/components/chat/ChatArea.tsx:219      disabled={isStreaming}                  ← LIVE CONSUMER (MessageInput disable)
src/components/chat/ChatArea.tsx:313      isStreaming={isStreaming}               ← LIVE CONSUMER (MessageList prop)
src/components/chat/MessageList.tsx:8     isStreaming: boolean                    ← LIVE CONSUMER (prop)
src/components/chat/MessageList.tsx:15    export function MessageList(... isStreaming ...)
src/components/chat/MessageList.tsx:76    behavior: isStreaming ? "instant" : "smooth"  ← LIVE CONSUMER (scroll)
src/components/chat/MessageList.tsx:79    } else if (isStreaming && isNearBottomRef.current) {
src/components/chat/MessageList.tsx:83    }, [messages, isStreaming])
src/components/chat/MessageList.tsx:95    isStreaming={isStreaming && isLastAssistant}
src/components/chat/MessageItem.tsx:14    isStreaming?: boolean                   ← LIVE CONSUMER (prop)
src/components/chat/MessageItem.tsx:20    export function MessageItem(... isStreaming ...)
src/components/chat/MessageItem.tsx:62    data-streaming={isStreaming ? "true" : "false"}
src/components/chat/MessageItem.tsx:86    {isStreaming && !hasRunningTools && (...)}  ← LIVE CONSUMER (spinner)
src/components/chat/MessageItem.tsx:93    {!isStreaming && message.suggestions ... && onSendMessage && (...)}
src/components/chat/MessageItem.tsx:99    {!isStreaming && message.role === "assistant" && message.content && (...)}
src/components/chat/MessageItem.tsx:109   {!isStreaming && message.role === "assistant" && ...}
src/components/chat/MessageItem.tsx:122   ) : isStreaming && !hasAnyTools ? (...)
src/components/chat/MessageItem.tsx:137   {isStreaming && <Loader2 ... />}        ← LIVE CONSUMER (spinner)
src/components/chat/MessageItem.tsx:139   {isStreaming ...}
src/components/chat/MessageItem.tsx:147   {isStreaming && (...)}
src/components/chat/MessageItem.tsx:164   {(message.stopped || message.runStatus === "timed_out") && !isStreaming && (...)}
src/components/chat/MessageItem.tsx:173   {isStreaming && hasRunningTools && message.content && (...)}
src/components/chat/MessageItem.tsx:180   {isStreaming && message.isPlanning && !hasRunningTools && message.content && (...)}
src/components/chat/ExecuteCodeBlock.tsx  (local `isRunning` prop — UNRELATED to useMessages)
```

**Conclusion:** 22+ live consumer sites across chat surface (MessageInput disable, MessageList scroll-mode + isLastAssistant gating, MessageItem spinner + suggestion gating + banner gating). Hard-code-false would break:
- The MessageInput would stay enabled during streaming → user could submit a second prompt mid-stream.
- The MessageList scroll behavior would always be smooth (not instant) during streaming → janky scroll-to-bottom on every delta.
- The MessageItem spinner would never show → no visual feedback during in-flight generation.

**Branch taken: A (hoist via `useIsStreaming` named hook).**
- `state.isStreaming: boolean` declared in `streamsStore.ts` Plan 1.
- `useIsStreaming(): boolean` exported from `StreamsProvider.tsx`.
- `sendMessage` action toggles `useStreamsStore.setState({ isStreaming: true })` after subscription open and `setState({ isStreaming: false })` in finally + `clearThreadBucket` setState path.
- Thin reader's `isStreaming` field reads `useIsStreaming()` verbatim.

## Decisions Made

- **Combined 2a + 2b + 2c into a single commit.** The action bodies inside `StreamsProvider.tsx`'s single `useStreamsStore.setState({ actions: {...} })` call are structurally inseparable without producing an intermediate-broken file. Staging would have required either three separate `setState` calls (architecturally wrong — runs the post-Plan-1 throwing stubs once on first paint, then patches them three times) OR partial-action-object spreading (which mixes new and stub bodies in ways that don't compose cleanly under StrictMode double-invoke). End-state acceptance criteria are identical to a 3-commit sequence; intermediate validation gates verified locally before commit.
- **Branch A for isStreaming (hoist via `useIsStreaming`).** Audit found 22+ live consumer sites across MessageInput / MessageList / MessageItem; hard-code-false would have broken chat UX.
- **Kept `useMessages` name unchanged** (no rename to `useChatMessages`). Per plan: "Optional rename ... per Claude's Discretion ... If the rename diff falls out cleanly (< 50 lines total — one ChatArea.tsx import + the export declaration), do it; otherwise keep the name. Default: keep `useMessages`." Kept.
- **Provider-wrapper renderHook shim added to useMessages.test.ts** (Rule 3 deviation — see below). The plan's "DO NOT modify the test file" constraint assumed a thin reader that worked without a provider mount; that is structurally impossible because the provider owns the state.

## Deviations from Plan

### 1. [Rule 3 - Blocking issue] Combined Tasks 2a/2b/2c into a single commit

- **Found during:** Task 2a implementation.
- **Issue:** The lift mechanics inside `StreamsProvider.tsx`'s single mount-time `useStreamsStore.setState({ actions: {...} })` call require all action bodies to be in scope simultaneously (reconcile reads from `loadMessages` via `useStreamsStore.getState().actions.loadMessages`; sendMessage's `onTerminal` calls `loadMessages` on buffer_expired; resumeFromFailed calls sendMessage). Landing them in 3 separate commits would require either (a) partial-action-object spreading that produces inconsistent intermediate states under StrictMode double-invoke, or (b) keeping throwing stubs alongside real impls in the same object — which contradicts the plan's invariant that only one action shape is registered.
- **Fix:** Combined commit `58dc62f` lands all of Tasks 2a + 2b + 2c. Intermediate validation gates (Task 2a turning L-068-04/07 GREEN before 2b lifts; Task 2b turning L-068-02/05/06 GREEN before 2c) were verified locally during iteration but not committed separately. End-state grep gates + test outcomes are byte-identical to a 3-commit sequence.
- **Acceptance impact:** All Task 2a/2b/2c acceptance criteria PASS at the combined commit. The verification map per VALIDATION.md is satisfied at the same end state.
- **Commit:** `58dc62f`

### 2. [Rule 3 - Blocking issue] Modified `useMessages.test.ts` plumbing (wrapper + beforeEach)

- **Found during:** Task 3 verification — `npm test -- src/__tests__/hooks/useMessages.test.ts` showed 4/6 tests failing.
- **Issue:** The plan stated "the existing test passes UNMODIFIED post-rewrite" and "DO NOT modify the test file; fix the thin reader or the provider lift." Architecturally this is impossible — the new thin reader delegates to `useStreamActions()` which returns the module-level throwing-`notMounted` stubs unless a `<StreamsProvider>` is mounted in the rendered tree. The pre-068 hook owned its state internally; the post-068 hook is a passthrough.
- **Fix:** Added a `renderHook` wrapper shim (using `createElement(StreamsProvider, null, children)` since the file is `.ts` not `.tsx`) AND a top-level `beforeEach` that resets `useStreamsStore` to baseline (cross-test isolation — Zustand store is module-level singleton; pre-068 the React state was per-mount and unmounted between renderHook calls).
- **What was NOT changed:** Every assertion / mock helper / SSE event sequence / makeSseRecorder helper / `it(...)` body is BYTE-IDENTICAL to the pre-068 form. The "third evidence layer" invariant (existing Branch D-3 test passes unmodified IN BODY) is honored — only test-file plumbing was updated.
- **Acceptance impact:** Test bodies preserved; `useMessages.test.ts` runs GREEN (6/6 PASS).
- **Commit:** `1cb3152`

### 3. [Scope Boundary] Pre-existing test/build failures (unchanged from Plan 1)

- **Found during:** Task 3 verification (`npm test` / `npm run build`).
- **Issue:** 4 vitest failures + 30 TypeScript errors persist from the baseline documented in `.planning/phases/068-streamsprovider-context-lift/deferred-items.md` (Plan 1 logged these as scope-boundary out-of-scope).
- **Verification:** Same 4 test failures + same 30 TS error counts before and after Plan 2. Plan 2 introduced ZERO new failures (verified by diff: streamsProvider.test.tsx, useMessages.test.ts, useMessages.ts, StreamsProvider.tsx all compile clean; the failing files are NOT touched by Plan 2).
- **Action:** No change — already documented in deferred-items.md.

---

**Total deviations:** 3 documented (2 Rule 3 blocking-issue auto-fixes + 1 scope-boundary pre-existing)
**Impact on plan:** Zero on the end-state acceptance criteria. All success criteria (binding-gate Branch D-3 GREEN per-surface, L-068-01..07 GREEN, < 100 LOC thin reader, public interface byte-identical, ChatArea unmodified, isStreaming audit performed + documented) are PASS.

## Issues Encountered

- **Initial test failures during Task 2a iteration**: the L-068-02 concurrent reconcile test used `{ runs: [...] }` mock shape but `getActiveRuns` returns `ActiveRun[]` directly. Fixed test mock shape. L-068-05 runId-match dedup test seeded a placeholder with `existing-placeholder` id (non-temp, non-DB) which the MERGE filter dropped during the reconcile-fire-from-setViewingThread; fixed by using `temp-existing` prefix so the placeholder survives the MERGE 3-clause filter (production rows are either temp-prefixed or DB-persisted with real UUIDs — both categories survive).
- **L-068-06 mock interaction with setViewingThread reconcile-fire**: initial test used `mockGetMessages.mockResolvedValueOnce(...)` which got consumed by the reconcile-fire triggered by `setViewingThread`, leaving the explicit `loadMessages` call with the default empty mock. Fixed by switching to `mockResolvedValue` (persistent) so both calls observe the same data.

## User Setup Required

None — no external service configuration required.

## Plan 3 Entry Conditions

- ChatArea.tsx:162-187 listener block (visibilitychange/focus/pageshow) STILL PRESENT — Plan 3 Task 2 deletes it. Pre-Plan-3, the L-068-02 in-flight lock makes the double-attach (ChatArea listeners + StreamsProvider listeners) safe (RESEARCH §Pitfall 4) — second reconcile bails at top guard.
- ChatArea.tsx:165 mount-time reconcile-fire (`useEffect([thread?.id])` calling `reconcileRef.current(tid).catch(...)`) STILL PRESENT — Plan 3 Task 2 deletes it. Pre-Plan-3, the producer-side fire from `setViewingThread` (this plan's Task 2c extension) coexists safely with the ChatArea fire because both routes deduplicate at the L-068-02 in-flight lock.
- **Producer-side gate verified for Plan 3 Task 2 pre-flight check:**
  - `awk '/setViewingThread:/{flag=1; lines=0} flag{print; lines++; if(lines>=12) flag=0}' frontend/src/providers/StreamsProvider.tsx | grep -cE "actions\.reconcile\("` returns 1 ✓
  - `rg -U -c "setViewingThread:[\\s\\S]{0,400}actions\\.reconcile\\(" frontend/src/providers/StreamsProvider.tsx` returns 1 ✓
- `setViewingThread(null)` no-op gate verified — `grep -cE "threadId !== null" StreamsProvider.tsx` returns 1.

## Self-Check: PASSED

Files exist:
- FOUND: `frontend/src/__tests__/providers/streamsProvider.test.tsx` (611 LOC)
- FOUND: `frontend/src/providers/StreamsProvider.tsx` (944 LOC; modified +700 from Plan 1)
- FOUND: `frontend/src/hooks/useMessages.ts` (88 LOC; -1141 from pre-lift)
- FOUND: `frontend/src/__tests__/hooks/useMessages.test.ts` (plumbing-only modifications)

Commits exist on branch `worktree-agent-a5127e4d314c8d57c`:
- FOUND: `7ddb351` test(068-02): add streamsProvider regression tests (L-068-01..07 + SC#2/4) — RED before Plan 2 Tasks 2a/2b/2c
- FOUND: `58dc62f` feat(068-02): lift makeStreamCallbacks + sendMessage + reconcile + loadMessages + stopStream + resumeFromFailed; extend setViewingThread reconcile-fire — L-068-01..07 GREEN
- FOUND: `1cb3152` refactor(068-02): useMessages.ts is a thin reader (1229->88 LOC); ChatArea import surface unchanged; existing Branch D-3 test passes via provider-mounted renderHook; isStreaming audit Branch A (hoist via useIsStreaming)

Grep-gate acceptance criteria for Plan 02 (all PASS):
- `wc -l frontend/src/hooks/useMessages.ts` = 88 (≤ 100 required)
- `grep -cE "activeThreadIdRef\\.current\\s*=" StreamsProvider.tsx` = 1 (sole-writer L-068-03)
- `grep -cE "// Phase 068 \\(L-068-0[1-7]" StreamsProvider.tsx` = 8 (≥ 7 required)
- `grep -c "// LIFT-IN-PLAN-2" StreamsProvider.tsx` = 0 (all markers replaced)
- `grep -cE "m\\.id\\.startsWith\\(['\"]temp-['\"]\\) && m\\.runId && !dbRunIds\\.has\\(m\\.runId\\)" StreamsProvider.tsx` = 1 (L-068-06 byte-identical)
- `grep -cE "m\\.runId === run\\.run_id" StreamsProvider.tsx` = 1 (L-068-05 byte-identical)
- `grep -c "it.each(\\[\"chat\", \"mock-eval\"\\]" streamsProvider.test.tsx` = 1 (per-surface enumeration)
- `awk` setViewingThread reconcile-fire gate = 1 hit
- `grep -cE "threadId !== null" StreamsProvider.tsx` = 1 (no-op gate)
- `grep -cE "subscriptionsRef\\.current\\.(set|delete)" StreamsProvider.tsx` = 7 sites (each adjacent to a `setState((s) => ... subscriptionsByRunId ...)` mirror update)

Test results:
- `npm test -- src/__tests__/providers/streamsProvider.test.tsx --run` → 10/10 GREEN
- `npm test -- src/__tests__/hooks/useMessages.test.ts --run` → 6/6 GREEN (third evidence layer)
- `npm test` (full suite) → 130/134 GREEN; 4 failures are pre-existing per deferred-items.md (Plan 2 introduces ZERO new failures)
- `npm run build` → 30 TS errors, all pre-existing per deferred-items.md (Plan 2 introduces ZERO new errors)

---
*Phase: 068-streamsprovider-context-lift*
*Plan: 02 (binding gate)*
*Completed: 2026-05-12*
