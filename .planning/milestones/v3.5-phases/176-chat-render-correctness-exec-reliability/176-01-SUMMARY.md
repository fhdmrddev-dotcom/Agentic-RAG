---
phase: 176-chat-render-correctness-exec-reliability
plan: 01
subsystem: ui
tags: [react, zustand, streaming, sse, reconcile, chat-render, StreamsProvider]

# Dependency graph
requires:
  - phase: 175-cross-provider-streaming-fidelity
    provides: a stabilized adapter/sanitizer streaming surface for the chat render layer to reconcile on
  - phase: 075.7
    provides: the widened reconcile preserve-guard (untyped-temp branch) that RENDER-01 extends
provides:
  - "RENDER-01: content-supersede drop in the reconcile preserve-guard — a single send renders exactly ONE user bubble"
  - "RENDER-02: mount/reconcile-path onTerminal content-reconcile keyed on run.run_id — a backgrounded run un-folds its final answer live on switch-back with no reload"
affects: [174-run-state-lifecycle-honesty, 178-chat-ui-ux-polish, chat-render, StreamsProvider, MessageItem]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dedup-against-the-snapshot for untyped user temps (content match, never runId) inside the preserve-guard — never stop preserving temps"
    - "Mirror the applied send-path onTerminal content-reconcile onto the mount/reconcile path, keyed on the path's own runId (run.run_id vs registeredRunId)"

key-files:
  created: []
  modified:
    - frontend/src/providers/StreamsProvider.tsx
    - frontend/src/__tests__/providers/streamsProvider_075_7_reconcile_race.test.tsx
    - frontend/src/__tests__/providers/streamsProvider_bug_260707_03_final_answer_resolve.test.tsx

key-decisions:
  - "RENDER-01 via D-05 option (b): the dup user bubble is born in the reconcile merge (the WR-04 id re-key already exists at :1858), so the fix belongs in the merge — drop the untyped temp only once its identical-content persisted twin is in the snapshot"
  - "RENDER-01 honors D-06: with no twin in the snapshot the temp is still preserved (the 075.7 pre-stamp race guard is NOT weakened)"
  - "RENDER-02 via D-07: mirror the send-path content-reconcile onto the mount-path onTerminal keyed on run.run_id (registeredRunId is undefined on that path — Pitfall 2), content-only swap"
  - "SEED-094 backend stray-last-line stays OUT (D-09) — the reconcile faithfully renders whatever the backend persisted"
  - "Deep byte-identical (D-14): both fixes are additive reconcile-logic at existing seams; the send-path reconcile, assistant-side dedup, and dedupMessagesByRunId are untouched"

patterns-established:
  - "Isolate a reconcile-path unit test from the subscribeToRun().finally() loadMessages floor by returning a never-resolving subscribe promise — asserts the in-place content-only swap (temp id preserved) rather than the full-replace reload"

requirements-completed: [RENDER-01, RENDER-02]

# Metrics
duration: 13min
completed: 2026-07-22
---

# Phase 176 Plan 01: Chat Render Correctness (RENDER-01 + RENDER-02) Summary

**Two additive StreamsProvider reconcile fixes: a content-supersede drop so a single send renders exactly one user bubble (RENDER-01), and a mount-path onTerminal content-reconcile keyed on run.run_id so a backgrounded parallel-thread run un-folds its final answer live with no reload (RENDER-02).**

## Performance

- **Duration:** 13 min
- **Started:** 2026-07-22T19:55:24Z
- **Completed:** 2026-07-22T20:08:45Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 3

## Accomplishments
- **RENDER-01** — the 075.7-widened preserve-guard's untyped-temp branch now computes `supersededByPersisted` against `snapshot.messages` (role user, equal content, non-temp id, `created_at >= temp`) and returns `sendInFlightOnThisThread && !supersededByPersisted`. The optimistic user temp is dropped the moment its identical-content persisted twin lands in the snapshot (one user bubble), but is still preserved while that twin is absent (D-06 — the fresh-thread pre-stamp race guard holds). Closes BUG-260712-02.
- **RENDER-02** — the mount/reconcile-path `onTerminal` now mirrors the applied send-path content-reconcile (`:2004-2027`), keyed on `run.run_id`: on a clean `done`/`reader_done` terminal it fire-and-forgets `getMessages(threadId)` and swaps ONLY the matching run's assistant `content` to the persisted answer. A backgrounded parallel-thread run un-folds its final answer on switch-back with no reload (the SC#10 parallel-thread residual of BUG-260707-03).
- Both fixes are additive at existing seams: the send-path reconcile (`:2004-2027`, still keyed on `registeredRunId`), the assistant-side `!dbRunIds.has(runId)` dedup branch, the `:1440` `sendInFlightOnThisThread` derivation, and `dedupMessagesByRunId` are all untouched (D-14 Deep byte-identical).

## Task Commits

Each task was committed atomically (TDD — test authored + implementation in one commit per task, RED verified before GREEN):

1. **Task 1: RENDER-01 content-supersede drop** - `327264b5` (fix) — reconcile-race test extended with drop-when-twin-present + preserve-when-different-content cases; RED confirmed (2 user rows) then source fix → GREEN (5/5).
2. **Task 2: RENDER-02 mount-path content-reconcile** - `3e001c5e` (fix) — BUG-260707-03 test extended with a floor-suppressed mount-path case; RED confirmed (content stayed BLOB) then source fix → GREEN (2/2).

**Plan metadata:** _(this docs commit)_

## Files Created/Modified
- `frontend/src/providers/StreamsProvider.tsx` — RENDER-01 `supersededByPersisted` drop in the untyped-temp preserve branch; RENDER-02 mount-path `onTerminal` content-reconcile keyed on `run.run_id`.
- `frontend/src/__tests__/providers/streamsProvider_075_7_reconcile_race.test.tsx` — new RENDER-01 describe block: drops the temp when the snapshot holds its identical-content twin; preserves it for a different-content persisted row (content-scoped, not blanket).
- `frontend/src/__tests__/providers/streamsProvider_bug_260707_03_final_answer_resolve.test.tsx` — new RENDER-02 mount-path case: suppresses the `subscribeToRun().finally()` loadMessages floor to isolate the onTerminal content-reconcile and assert the content-only in-place swap.

## Decisions Made
- **RENDER-01 = D-05 option (b), in the merge.** The dup user bubble is created by the reconcile merge, not a missing id re-key (the WR-04 re-key already exists at `:1858`), so the fix is a content-supersede drop inside the preserve-guard — dedup against the snapshot by content (user temps carry no runId), guarded by `created_at >=` so an older same-content row from a prior identical turn can't drop the fresh temp.
- **RENDER-02 = D-07, keyed on `run.run_id`.** `registeredRunId` is undefined on the mount/reconcile path (Pitfall 2), so the mirrored block keys on the loop's `run.run_id`. Content-only swap preserves tool_calls / suggestions / output-files / runStatus; the existing `.finally()` loadMessages remains the reload-time backstop.
- **SEED-094 stays OUT (D-09)** — the reconcile renders whatever the backend persisted; no backend change.

## Deviations from Plan

None — plan executed exactly as written (both source edits landed at the specified seams with the specified predicates/keys). One in-plan TDD test-methodology adjustment is documented under Issues Encountered (not a source deviation).

## Issues Encountered
- **RENDER-02 RED test initially passed before the fix (TDD fail-fast trip).** The first version of the mount-path test asserted only that the assistant content became `CLEAN_ANSWER`. It passed WITHOUT the source fix because the reconcile-path `subscribeToRun().finally()` (StreamsProvider.tsx:1711-1714) already calls `loadMessages` → `getMessages` and does a full-replace merge that swaps in the persisted answer. Per the fail-fast rule I stopped and investigated rather than proceeding. Root cause: the naive assertion could not distinguish the `.finally()` loadMessages floor from the onTerminal content-reconcile under test. **Resolution:** the mock now returns a never-resolving promise after firing `onDelta`/`onTerminal`, suppressing the `.finally()` floor so the onTerminal content-reconcile is the ONLY thing that can un-fold; the test additionally asserts the swapped message keeps its `temp-` placeholder id (a content-only in-place swap) rather than being replaced by the persisted row (which a reload would produce). RED then correctly failed (content stayed BLOB) before the fix and passed after.

## User Setup Required
None — no external service configuration required. Frontend-only, no migration, no new dependency.

## Next Phase Readiness
- **Automated verification:** both extended files green (7/7). Providers-directory differential: 13 pre-existing failures at the phase-start baseline of `StreamsProvider.tsx` == 13 at HEAD (SEED-056 vitest rot, in `streamsProvider.test.tsx` / `StreamsProvider.dedup.test.ts` / `streamsProvider_075_9_clientkey.test.tsx`) — **zero net-new failures** (D-14 differential).
- **Live verification tracked in 176-VALIDATION Manual-Only (D-08):** one Deep run resolving un-folded at run-end with no reload on BOTH the send path and a nav-watched backgrounded run; one send rendering a single user bubble. (Un-fold-without-reload cannot be fully proven by unit test alone.)
- Ready for the remaining Plan 176 items (RENDER-03, RENDER-04, EXEC-01) on the same stabilized render surface.

---
*Phase: 176-chat-render-correctness-exec-reliability*
*Completed: 2026-07-22*

## Self-Check: PASSED

- Created file verified present: `176-01-SUMMARY.md`.
- Modified files verified present: `StreamsProvider.tsx` + both extended test files.
- Task commits verified in git log: `327264b5` (RENDER-01), `3e001c5e` (RENDER-02).
