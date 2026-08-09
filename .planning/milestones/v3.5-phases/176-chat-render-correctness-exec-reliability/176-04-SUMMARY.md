---
phase: 176-chat-render-correctness-exec-reliability
plan: 04
subsystem: ui
tags: [react, zustand, streaming, chat, send-drop, optimistic-render]

# Dependency graph
requires:
  - phase: 176-01
    provides: "StreamsProvider preserve-guard (sendInFlightOnThisThread) + the 176-01 untyped-temp supersededByPersisted drop branch (shared StreamsProvider.tsx)"
provides:
  - "RENDER-03 honesty guarantee: sendMessage's duplicate-guard non-dispatch early-return stashes the dropped draft (failedSendDrafts) + a quiet reconcileErrors hint instead of silently returning — the user never loses a message"
  - "Fresh-thread ordering tighten: a sibling pendingSendThreadsRef + markThreadPendingSend action honored by the preserve-guard, WITHOUT tripping the duplicate-guard (the real send still dispatches)"
affects: [chat-render, StreamsProvider, ChatArea, send-path, 178-chat-ui-polish]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Non-dispatch honesty: route a dropped send through the EXISTING failedSendDrafts + reconcileErrors recovery seam (099-08 / D-11) — no new toast/error channel"
    - "Pre-dispatch intent marker: a sibling ref (pendingSendThreadsRef) the preserve-guard honors but the duplicate-guard ignores, so send-ordering can be tightened without dropping the real send"

key-files:
  created: []
  modified:
    - "frontend/src/providers/StreamsProvider.tsx - non-dispatch stash + pendingSendThreadsRef + widened preserve-guard + markThreadPendingSend action + lockstep clears"
    - "frontend/src/stores/streamsStore.ts - markThreadPendingSend action type + no-op stub"
    - "frontend/src/components/chat/ChatArea.tsx - pre-mark the fresh thread pending-send BEFORE setViewingThread"
    - "frontend/src/__tests__/providers/streamsProvider_075_7_reconcile_race.test.tsx - non-dispatch honesty + pending-ordering cases"
    - "frontend/src/components/chat/__tests__/ChatAreaBanner.test.tsx - non-dispatch hint banner + prefill restore case"
    - "frontend/src/components/chat/__tests__/MessageInputDrafts.test.tsx - prefill restores a stashed draft after a synchronous clear"

key-decisions:
  - "Carry the non-dispatch hint as ApiError(400), not a plain Error, so the existing 099-08 banner renders the honest 'Couldn't send — tap to retry' copy (a plain Error would render the misleading 'Couldn't load latest messages' copy) and hides the misleading reload-Retry (400 ∈ NON_RETRYABLE) — the composer prefill is the real recovery affordance"
  - "markThreadPendingSend adds ONLY to pendingSendThreadsRef, never sendingThreadsRef — the duplicate-guard (:1807) checks only sendingThreadsRef, so the pre-mark does not false-early-return the real send"
  - "Pre-mark only on the fresh-thread path (inside the onCreateThread branch, before setViewingThread) — that is the only place the nav reconcile races the pre-sendingThreadsRef window"

patterns-established:
  - "Honest non-dispatch: any client-side send refusal stashes the draft + a quiet hint on the shared recovery seam, never a silent return"
  - "Preserve-guard widening composes with (never weakens) the 176-01 supersededByPersisted drop"

requirements-completed: [RENDER-03]

# Metrics
duration: ~35 min
completed: 2026-07-23
---

# Phase 176 Plan 04: RENDER-03 No-Silent-Send-Drop Summary

**A submitted general-chat message now always sends or surfaces an honest, recoverable failure: the sendMessage duplicate-guard's non-dispatch early-return stashes the dropped draft + a quiet retry hint through the existing recovery seam, and a sibling pending-send ref tightens fresh-thread ordering without dropping the real send.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-07-23T00:50Z (approx)
- **Completed:** 2026-07-23T01:05Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 6

## Accomplishments
- **Honesty guarantee (durable property):** `sendMessage`'s duplicate-guard early-return (`if (sendingThreadsRef.current.has(threadId))`) no longer returns silently — it stashes `failedSendDrafts[threadId] = content` + a quiet `reconcileErrors` hint through the SAME 099-08 seam the ApiError rollback uses, so ChatArea's `prefillMessage={failedDraft ?? …}` restores the composer text and the per-thread banner surfaces "Couldn't send — tap to retry". Closes the general-chat intermittent silent send-drop (BUG-260603-01) at the honesty layer.
- **Race-tighten (reduces frequency):** added a sibling `pendingSendThreadsRef` + a `markThreadPendingSend` action honored by the preserve-guard's `sendInFlightOnThisThread`. ChatArea pre-marks the just-created thread BEFORE `setViewingThread` fires its reconcile, so the optimistic temp is preserved across the nav reconcile — WITHOUT adding to `sendingThreadsRef` (the duplicate-guard is untripped, the real send still dispatches).
- **Reused the existing seam (D-11):** no new toast/error channel invented; the 176-01 RENDER-01 `supersededByPersisted` drop is preserved (composed with, never weakened); Deep Mode byte-identical (additive edits at the existing send seams — D-14).

## Task Commits

Each task was committed atomically (TDD RED → GREEN):

1. **Task 1: Honesty guarantee — non-dispatch stashes failedSendDrafts + reconcileErrors**
   - `b9be05a2` (test) — failing non-dispatch send-drop honesty tests
   - `78c74f9b` (feat) — non-dispatch early-return stashes recoverable draft + honest hint
2. **Task 2: Fresh-thread ordering tighten — pending-send flag honored by the preserve-guard**
   - `f5352d0a` (test) — failing fresh-thread pending-send ordering tests
   - `b491ad1b` (feat) — pendingSendThreadsRef sibling + widened guard + markThreadPendingSend + ChatArea pre-mark

**Plan metadata:** (this commit) `docs(176-04): complete …`

## Files Created/Modified
- `frontend/src/providers/StreamsProvider.tsx` — non-dispatch early-return now stashes `failedSendDrafts` + `reconcileErrors` (ApiError hint); added `pendingSendThreadsRef` sibling; widened `sendInFlightOnThisThread` to honor both refs; added `markThreadPendingSend` action; clears the pending flag in the send finally + on the non-dispatch early-return
- `frontend/src/stores/streamsStore.ts` — declared `markThreadPendingSend` in the actions type + seeded its no-op stub
- `frontend/src/components/chat/ChatArea.tsx` — `handleSend` pre-marks the fresh thread via `streamActions.markThreadPendingSend(activeThread.id)` BEFORE `setViewingThread`, with `streamActions` added to the useCallback deps
- `frontend/src/__tests__/providers/streamsProvider_075_7_reconcile_race.test.tsx` — RENDER-03 non-dispatch honesty (stash on early-return; successful send stashes nothing) + fresh-thread pending-ordering (preserve while only pending set; duplicate-guard untripped; pending cleared on resolve); added an ApiError stub to the api mock + `failedSendDrafts` to the beforeEach reset
- `frontend/src/components/chat/__tests__/ChatAreaBanner.test.tsx` — case "e": a non-dispatch hint renders the honest retry copy (reconcile-error-banner, no Retry) + the prefill restores the draft
- `frontend/src/components/chat/__tests__/MessageInputDrafts.test.tsx` — the prefill seam restores a stashed draft even after `handleSend` cleared the box synchronously

## Decisions Made
- **ApiError(400) carrier for the hint** (not a plain Error): the existing banner renders a custom message ONLY for `ApiError`; a plain Error would render the misleading generic "Couldn't load latest messages. Showing cached version." copy, making the honesty hint false. ApiError is the seam's established custom-message mechanism (D-11 reuse, not a new channel); status 400 (∈ NON_RETRYABLE) hides the misleading reload-Retry so the composer prefill is the sole, correct recovery affordance.
- **Pre-mark only on the fresh-thread path**: the nav-reconcile-vs-send race is specific to the onCreateThread → setViewingThread → sendMessage sequence; existing-thread sends don't fire an interleaved setViewingThread reconcile.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Hint carried as ApiError(400) instead of the plan's literal plain `Error("Couldn't send — tap to retry")`**
- **Found during:** Task 1
- **Issue:** The plan text specifies `reconcileErrors[threadId] = Error("Couldn't send — tap to retry")`, but the existing ChatArea banner (ChatArea.tsx:518-520) renders a custom message ONLY when the value is an `ApiError`; for a plain `Error` it renders the fixed "Couldn't load latest messages. Showing cached version." copy. A plain-Error hint would therefore surface a MISLEADING banner ("couldn't load messages" when the SEND dropped) — the honesty guarantee would be false.
- **Fix:** Carried the hint as `new ApiError("Couldn't send — tap to retry", 400)` — the SAME custom-message carrier the 099-08 seam already uses (D-11: reuse the seam, no new channel). Status 400 (∈ NON_RETRYABLE) yields the generic `reconcile-error-banner` testid and hides the misleading reload-Retry; the composer prefill is the real recovery.
- **Files modified:** frontend/src/providers/StreamsProvider.tsx
- **Verification:** ChatAreaBanner case "e" asserts the banner shows the hint (not the cached-version copy) with no Retry; the provider test asserts the exact `.message`.
- **Committed in:** `78c74f9b`

**2. [Rule 3 - Blocking] Added `frontend/src/stores/streamsStore.ts` (not in the plan's declared files_modified)**
- **Found during:** Task 2
- **Issue:** `markThreadPendingSend` must be declared in the store's `actions` TYPE and seeded with an initial stub for `useStreamActions()` to expose it and for TypeScript to compile; the plan listed only StreamsProvider/ChatArea/tests.
- **Fix:** Added the one-line action type (next to `setViewingThread`) + a synchronous no-op stub (mirroring `setViewingThread`'s stub). Minimal/additive.
- **Files modified:** frontend/src/stores/streamsStore.ts
- **Verification:** `tsc -b` shows no new error referencing the addition; the pending-ordering tests exercise the real action.
- **Committed in:** `b491ad1b`

**3. [Test placement] Task 1's true-RED source test lives in the provider test file, not ChatAreaBanner/MessageInputDrafts**
- **Found during:** Task 1
- **Issue:** ChatAreaBanner and MessageInputDrafts mock `useMessages` / test the composer in isolation, so neither can drive the REAL provider `sendMessage` duplicate-guard early-return (the source behavior). The plan assigned Task 1's tests to those two files.
- **Fix:** Put the non-dispatch SOURCE behavior test (the genuine RED that fails before the source change) in `streamsProvider_075_7_reconcile_race.test.tsx` (the natural home for provider-action behavior, where `postMessage` is gated). ChatAreaBanner + MessageInputDrafts still received the banner-hint + prefill-restore seam coverage the plan intended. The provider test file is in the plan's frontmatter `files_modified`.
- **Files modified:** frontend/src/__tests__/providers/streamsProvider_075_7_reconcile_race.test.tsx
- **Verification:** Confirmed RED (early-return didn't stash) → GREEN after the source change.
- **Committed in:** `b9be05a2` / `78c74f9b`

**4. [Test fix] Corrected the Task 2 pending-dispatch test to mirror ChatArea's real ordering**
- **Found during:** Task 2 (GREEN)
- **Issue:** The first draft of the "duplicate-guard not tripped" test called `sendMessage` without a prior `setViewingThread`, so the thread was never in the stream pool; `subscribeToRun` is gated on pool membership (`if (sendThreadInPool)`), so the `subscribeToRun called` assertion timed out.
- **Fix:** Restructured the test to mirror ChatArea: `markThreadPendingSend` → `setViewingThread` (pools the thread + fires the nav reconcile) → `sendMessage`. Included in the Task 2 GREEN commit.
- **Files modified:** frontend/src/__tests__/providers/streamsProvider_075_7_reconcile_race.test.tsx
- **Verification:** All 9 tests in the file green.
- **Committed in:** `b491ad1b`

---

**Total deviations:** 4 (1 bug-avoidance, 1 blocking, 2 test-mechanics)
**Impact on plan:** All necessary for correctness (the honesty hint must render honestly) and to expose/exercise the action. No scope creep — the recovery routes entirely through the existing 099-08 seam; no new channel, no backend, no migration.

## Issues Encountered
- **Full-suite vitest differential:** 25 failures at HEAD across 11 files. Verified via a source-revert differential (checked out the 3 source files at pre-176-04 baseline `6f0bf297`) that the only plausibly-affected files (streamsProvider.test.tsx ×10, StreamsProvider.dedup ×2, streamsProvider_075_9_clientkey ×1, useMessages ×1, MessageItem ×1 = 15) fail IDENTICALLY at baseline — **zero net-new failures**. The other 10 (model-info, PublishGauntlet, soulData, IngestionPage, Plan04, ChatHistoryColumn) are in untouched subsystems. This matches the known frontend rot baseline (SEED-056).
- **Pre-existing tsc rot:** `tsc -b` reports errors (SettingsPage, SkillFormDialog, OrgProvider, the Zustand `create()` `viewedThreadId` inference at streamsStore:295, the pre-existing unused `getActiveRuns` import) — none reference the new code; the `markThreadPendingSend` type addition compiles cleanly.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- RENDER-03 complete at the code + unit-test layer; the fresh-thread ordering tighten + the honesty guarantee are both in place and cross-provider-agnostic (client-side send-ordering + local draft recovery over the user's own text).
- Live verification (176-VALIDATION Manual-Only, D-15 long-message axis): a fresh-thread immediate send lands or, if it ever fails to dispatch, restores the text + shows the quiet retry hint — never a silent vanish.

## Self-Check: PASSED
- All 6 modified files present on disk.
- All 4 task commits present in git history (`b9be05a2`, `78c74f9b`, `f5352d0a`, `b491ad1b`).

---
*Phase: 176-chat-render-correctness-exec-reliability*
*Completed: 2026-07-23*
