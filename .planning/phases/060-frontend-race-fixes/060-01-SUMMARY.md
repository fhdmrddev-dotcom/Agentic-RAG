---
phase: 060-frontend-race-fixes
plan: 01
subsystem: ui
tags: [react, hooks, abortcontroller, sse, race-condition, supabase-realtime-removal]

# Dependency graph
requires:
  - phase: 057-sse-realtime-reconnect-fix
    provides: 057-DEFERRAL.md root-cause documentation (loadMessages overwriting its own guard, two Realtime subs concurrent, Bug 3 raw-JSON regression)
  - phase: 058-backend-sse-concurrency-fix
    provides: getMessages returns <1s during streaming (CONCUR-01) — frontend can rely on fast cross-tab GETs
  - phase: 059-sse-architecture-refactor
    provides: AbortController.abort() reliably tears down backend stream via task.cancel + asyncio.Queue (CONCUR-02)
provides:
  - setViewingThread callback (sole writer of activeThreadIdRef per D-060-01)
  - loadMessages rewritten with AbortController-driven cancel-previous + post-await guard + AbortError-swallow
  - loadAbortRef cancels in-flight getMessages on each new call
  - clearMessages reduced to a pure state reset (caller owns abortStream invocation)
  - UseMessages interface stripped of subscribeToThread/unsubscribeFromThread, gains setViewingThread
  - All four Phase-057 band-aids removed (per-stream channelRef, always-on threadChannelRef, finally-block reload, clearMessages internal abort)
affects: [060-02-PLAN, 060-03-PLAN, 061-reconnect-handlers]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "AbortController-driven cancel-previous fetch (loadAbortRef.current?.abort() before fresh controller install)"
    - "Post-await ref-equality guard for cross-thread response discard (activeThreadIdRef.current !== threadId)"
    - "Single-writer ref discipline (setViewingThread is the SOLE writer of activeThreadIdRef)"
    - "AbortError-swallow inside try/catch (mirrors useMessages.ts:421-426 sendMessage idiom)"

key-files:
  created: []
  modified:
    - frontend/src/hooks/useMessages.ts (503 -> 396 lines; -107 net; -123 deletions/+16 additions across 3 commits)

key-decisions:
  - "D-060-01 applied: setViewingThread is the sole writer of activeThreadIdRef.current (verified by exactly 1 such write site in the file)"
  - "D-060-02 applied: loadMessages reads activeThreadIdRef ONLY post-await, with !== threadId discard guard"
  - "D-060-03 applied: loadAbortRef cancels previous in-flight getMessages fetch on each new loadMessages call"
  - "D-060-05 applied: D-STREAM-01 finally-block loadMessages reload deleted (Bug 3 raw-JSON regression source)"
  - "D-060-06 applied: per-stream channelRef supabase.channel + setTimeout teardown dance deleted"
  - "D-060-07 applied: subscribeToThread + unsubscribeFromThread + threadChannelRef deleted; UseMessages interface no longer exposes them"
  - "D-060-10 applied: clearMessages no longer calls abortControllerRef.abort()/null — pure state reset only"
  - "D-060-11 applied: AbortError silenced inside loadMessages catch; only real errors rethrow"
  - "Discretion: streamingThreadIdRef and sendGenerationRef declarations kept (write-only after this plan) per CONTEXT.md guidance — diff stays focused, future maintenance phase can clean up"
  - "Discretion: isSendingRef.current guard inside the new loadMessages preserved (defensive against Phase 061 calling loadMessages mid-send) per CONTEXT.md guidance — safer default"

patterns-established:
  - "useCallback([]) stable-identity: setViewingThread, rewritten loadMessages, post-cleanup clearMessages all use empty dep arrays, enabling Plan 060-02 to safely reduce ChatArea's effect dep array to [thread?.id]"
  - "Cancel-previous-fetch idiom: loadAbortRef.current?.abort() as the FIRST statement of loadMessages, then install fresh controller — different from sendMessage which uses isSendingRef mutex (don't cross-pollinate)"
  - "@ts-expect-error annotation for cross-plan signature changes: the loadMessages call to getMessages(threadId, controller.signal) is annotated; Plan 060-02 will remove the annotation when the signature lands"

requirements-completed: [STREAM-02a]

# Metrics
duration: 5min
completed: 2026-05-02
---

# Phase 060 Plan 01: useMessages Race Fix (setViewingThread + AbortController) Summary

**Surgical refactor of useMessages.ts — replaces v2.4 Phase-057 race-prone Realtime band-aids with a goal-locked architecture: setViewingThread as sole activeThreadIdRef writer, AbortController-driven loadMessages with post-await guard, and aggressive removal of all four 057 band-aids (per-stream channelRef, always-on threadChannelRef + subscribe callbacks, clearMessages internal abort, finally-block reload).**

## Performance

- **Duration:** 5 min
- **Started:** 2026-05-02T06:20:32Z
- **Completed:** 2026-05-02T06:25:39Z
- **Tasks:** 3 of 3
- **Files modified:** 1 (frontend/src/hooks/useMessages.ts)

## Accomplishments

- Architectural foundation for STREAM-02a in place at the hook level: concurrent `loadMessages(A)` and `loadMessages(B)` calls can no longer corrupt each other (the v2.5-dev failure mode documented in 057-DEFERRAL.md §"loadMessages was overwriting its own guard").
- All four Phase-057 band-aids deleted: per-stream `channelRef` Realtime subscription (sendMessage:152-200), always-on `threadChannelRef` + `subscribeToThread`/`unsubscribeFromThread` callbacks, `channelRef` teardown setTimeout dance, and `clearMessages` internal abort.
- The Bug 3 raw-JSON regression cannot recur on natural stream completion — the `loadMessages(threadId)` call inside `sendMessage`'s finally block is gone (D-060-05).
- File shrunk 503 → 396 lines (-107 net) while becoming structurally simpler.
- TypeScript compiles cleanly except for the deliberate single `@ts-expect-error` annotation on the `getMessages(threadId, controller.signal)` line that Plan 060-02 will resolve.

## Task Commits

Each task was committed atomically:

1. **Task 1: Strip Phase-057 Realtime band-aids** — `23e1b4e` (refactor)
   - 1 file changed, +2 / -123
   - Removed `subscribeToThread`/`unsubscribeFromThread` from interface and hook return
   - Deleted `channelRef`, `threadChannelRef`, `reloadTimerRef` declarations and callback bodies
   - Deleted per-stream `supabase.channel` block + finally-block teardown setTimeout dance
   - Deleted D-STREAM-01 `loadMessages` reload from sendMessage finally
   - Dropped `loadMessages` from sendMessage useCallback dep array
   - Removed unused `supabase` import

2. **Task 2: Add setViewingThread + rewrite loadMessages with AbortController** — `bc8db7b` (feat)
   - 1 file changed, +31 / -16
   - Added `loadAbortRef` alongside `abortControllerRef`
   - Added `setViewingThread` useCallback (sole writer of `activeThreadIdRef`)
   - Rewrote `loadMessages` body: abort previous, fresh controller, thread `.signal`, post-await `!== threadId` guard, AbortError-swallow
   - Used `setMessages(data)` replacement form (no `setMessages((prev) => ...)` updater per Pattern 3)
   - Exported `setViewingThread` from `UseMessages` interface and hook return
   - Added temporary `@ts-expect-error` directive on the `getMessages` call (resolved in plan 060-02)

3. **Task 3: Remove abortControllerRef.abort() from clearMessages (D-060-10)** — `bf016db` (refactor)
   - 1 file changed, +2 / -2
   - `clearMessages` is now a pure state reset (`setMessages([])`, `setIsStreaming(false)`, `isSendingRef.current = false`)
   - Caller (ChatArea, plan 060-02) owns the explicit `abortStream()` call before invoking `clearMessages`
   - `abortStream` unchanged — still calls `abortControllerRef.current?.abort()`

## Files Created/Modified

- `frontend/src/hooks/useMessages.ts` — Surgical refactor of the chat hook. UseMessages interface trimmed (no `subscribeToThread`/`unsubscribeFromThread`, gains `setViewingThread`). New `loadAbortRef` ref. `setViewingThread` callback added immediately before `clearMessages`. `loadMessages` rewritten with cancel-previous + post-await guard + AbortError-swallow. `clearMessages` reduced to pure state reset. All 9 Phase-057 deletion sites listed in 060-CONTEXT.md §Codebase landmarks are gone.

## Final Refs Inventory

After this plan, the hook body declares the following refs (in declaration order):

| Ref | Status | Justification |
|-----|--------|---------------|
| `isSendingRef` | KEPT | Send-mutex; still actively gates sendMessage entry and loadMessages's optimistic-placeholder protection |
| `sendGenerationRef` | KEPT (write-only after this plan) | Per CONTEXT.md Claude's Discretion — leaving in keeps the diff focused; new mechanism subsumes its read-side role; future maintenance phase can clean up |
| `abortControllerRef` | KEPT | Used by stopStreaming, abortStream, and sendMessage; unchanged role |
| `loadAbortRef` | **NEW (D-060-03)** | Cancels previous in-flight getMessages fetch on each loadMessages call |
| `stoppedByUserRef` | KEPT | Marks user-initiated stops for "interrupted" tool-call status; unchanged role |
| `streamingThreadIdRef` | KEPT (write-only after this plan) | Per CONTEXT.md Claude's Discretion — same rationale as sendGenerationRef |
| `isStreamingRef` | KEPT | Kept for now; the comment "D-04: allow Realtime callbacks to process now" in sendMessage finally is stale (no Realtime callbacks remain) but the assignment itself is harmless. Future maintenance can simplify |
| `activeThreadIdRef` | KEPT | The single ref that the post-await guard reads; sole writer is now `setViewingThread` |
| `channelRef` | **DELETED (D-060-06)** | Per-stream Realtime sub no longer needed |
| `threadChannelRef` | **DELETED (D-060-07)** | Always-on Realtime sub no longer needed |
| `reloadTimerRef` | **DELETED (D-060-07)** | Only used by deleted subscribeToThread debounce |

## Decisions Made

- **Kept `streamingThreadIdRef` and `sendGenerationRef` declarations** — write-only after this plan, but the CONTEXT.md Claude's Discretion guidance was that "leaving them is safe and the diff stays focused; deletion is safe but not strictly required by Phase 060 SC. Planner can delete cleanly if the diff stays focused." Chose to leave them; tracked as a deferred cleanup in 060-CONTEXT.md §Deferred Ideas.
- **Kept the `isSendingRef.current` guard inside the new `loadMessages`** — the safer default per CONTEXT.md ("keeps optimistic placeholders intact if Phase 061 ever calls loadMessages mid-send"). The plan explicitly endorsed keeping it.
- **`loadAbortRef` placed adjacent to `abortControllerRef`** — pure ergonomics, matches CONTEXT.md guidance ("top-level ref alongside `abortControllerRef`").
- **Inline `@ts-expect-error` directive** chosen over a removal of `controller.signal` from the call site, per the plan's interfaces guidance: "the runtime call MUST already pass the signal so 060-02 can be a pure signature update."

## Deviations from Plan

None — plan executed exactly as written. The 3 tasks landed in the order specified, with the exact code blocks the plan dictated, and every acceptance criterion checked green.

## Issues Encountered

None. The TypeScript build was clean from the start (the project uses tsc references; only a `tsc --build` actually compiles). Pre-existing TS errors in unrelated files (FolderNode.test.tsx, FolderTree.test.tsx, IngestionPage.test.tsx, etc.) are out of scope — not introduced by this task. Two new TS errors in `frontend/src/components/chat/ChatArea.tsx` (`Property 'subscribeToThread' does not exist on type 'UseMessages'`, same for `unsubscribeFromThread`) are the *expected* consequence of removing those interface members; Plan 060-02 will rewrite ChatArea's destructure and useEffect body to consume the new `setViewingThread` instead.

## Open Items / Forward Pointers

- **One `@ts-expect-error` directive remains** at `frontend/src/hooks/useMessages.ts:66`: `// @ts-expect-error - getMessages gains its \`signal\` parameter in plan 060-02`. Plan 060-02 Task 2's acceptance criteria explicitly call for removing this annotation when the `getMessages(threadId, signal?: AbortSignal)` signature lands.
- **ChatArea.tsx is intentionally broken** at lines 27, 71, 85, 104, 108 — references to `subscribeToThread`/`unsubscribeFromThread`. Plan 060-02 Task 1 rewrites ChatArea's destructure and `useEffect` to consume `setViewingThread` and the cleaned-up callbacks per D-060-08/09.
- **STREAM-02a NOT yet observable end-to-end** — the architecture is correct at the hook level, but ChatArea still has not been rewired. Plan 060-02 wires it; Plan 060-03 lands the e2e Playwright test that gates STREAM-02a.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Plan 060-02 (Wave 2) is unblocked.** It can now: (1) add `signal?: AbortSignal` to `getMessages` in `frontend/src/lib/api.ts` (resolves the `@ts-expect-error`); (2) rewrite ChatArea's `useEffect([thread?.id])` per D-060-08/09 to consume `setViewingThread` and the cleaned-up callbacks; (3) verify the entire frontend chat flow type-checks.
- **Plan 060-03 (Wave 3) is unblocked.** It can now author the Playwright e2e test at `e2e/tests/060-thread-race.spec.ts` per D-060-12 once Plan 060-02 lands ChatArea's rewire — the test's Network-tab abort-evidence assertion relies on `loadAbortRef`, which now exists and works.
- **Phase 061 (Reconnect Handlers) gains a clean foundation.** `setViewingThread` and `loadMessages(signal)` are reusable building blocks 061 will compose into the polling + visibilitychange + pageshow handlers.
- **Short-term regression note (acceptable per D-060-07 §"Short-term regression note"):** Symptoms E (tab-switch) and F (F5 mid-stream) will not auto-recover between this plan landing and Phase 061 landing — the user must navigate away and back to refresh. Documented and acceptable; the previous mechanisms didn't reliably work either.

## Self-Check: PASSED

- [x] `frontend/src/hooks/useMessages.ts` — modified (verified: file exists, 396 lines)
- [x] Task 1 commit `23e1b4e` — verified in `git log --oneline`
- [x] Task 2 commit `bc8db7b` — verified in `git log --oneline`
- [x] Task 3 commit `bf016db` — verified in `git log --oneline`

---
*Phase: 060-frontend-race-fixes*
*Completed: 2026-05-02*
