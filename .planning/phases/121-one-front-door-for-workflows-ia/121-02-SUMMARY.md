---
phase: 121-one-front-door-for-workflows-ia
plan: 02
subsystem: testing
tags: [vitest, react-testing-library, composer, workflows, ia, frontend, regression-oracle]

# Dependency graph
requires:
  - phase: 121-01
    provides: "the 2-pill composer (removed Deep/Harness toggle + in-chat workflow picker; narrowed MessageInput Props; preserved workflowLocked/reconcile/409 banner; postMessage+doRun launch route intact)"
provides:
  - "Automated Vitest oracles binding every Phase 121 SC to a machine-checkable assertion (SC#1 2-pill, Cancel-reachability D-01, SC#3 reconcile + 409 preserve, SC#2 launch)"
  - "Rewritten ChatAreaMode.test.tsx (RED post-Plan-01 → GREEN): asserts the removed pills are GONE + the surviving Cancel + the locked-preserve"
  - "Extended ChatAreaBanner.test.tsx with a server-truth reconcile-lock case (getThreadWorkflow locked:true → composer disabled on mount); the 409 test b stays byte-unchanged"
  - "New ChatLayoutLaunch.test.tsx proving the Workflows-page Run → doRun launch wiring survived the removal"
affects: [122, 124, verify-work-121, secure-phase-121, validate-phase-121]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server-truth reconcile assertion: drive getThreadWorkflow → assert the per-thread composer disable (no pill to read)"
    - "Integration-test the launch wiring by rendering the real ChatLayout + WorkflowsPage and stubbing only the StreamsProvider-coupled chrome (NavPanel/WorkspacePanel)"

key-files:
  created:
    - frontend/src/components/layout/__tests__/ChatLayoutLaunch.test.tsx
  modified:
    - frontend/src/components/chat/__tests__/ChatAreaMode.test.tsx
    - frontend/src/components/chat/__tests__/ChatAreaBanner.test.tsx

key-decisions:
  - "Single-provider/single-model render surfaces the Model pill as a static label (the selector dropdown needs >1 option) — assert the label text, not the dropdown"
  - "ChatAreaBanner reconcile-lock cases use mockResolvedValue (not …Once) because the mount reconcile effect can re-fire; a single Once value would let a follow-up undefined resolve clear the lock"
  - "ChatLayoutLaunch stubs NavPanel + WorkspacePanel (they pull StreamsProvider seams) so the assertion stays scoped to the doRun createThread/postMessage/onNavigate calls"

patterns-established:
  - "Reset workflowLockByThread in beforeEach so a locked reconcile from one test never bleeds into the next (the lock map is not mock-cleared)"

requirements-completed: [IA-01]

# Metrics
duration: ~12min
completed: 2026-06-22
---

# Phase 121 Plan 02: Test Oracles for the One-Front-Door Composer Summary

**Bound every Phase 121 success criterion to an automated Vitest oracle — rewrote ChatAreaMode (RED→GREEN) for the 2-pill composer + Cancel-reachability + locked-preserve, extended ChatAreaBanner with a server-truth reconcile-lock case, and added a ChatLayoutLaunch integration test proving the surviving Workflows-page launch path.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-06-22T23:07Z (local)
- **Completed:** 2026-06-22T23:19Z (local)
- **Tasks:** 2 (both TDD)
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- **SC#1 (2-pill) oracle:** `ChatAreaMode.test.tsx` asserts `workflow-mode-selector` and `workflow-picker` are GONE, `agent-mode-selector` + the Model pill remain.
- **Cancel-reachability (D-01) oracle:** with `disabled`/streaming, `composer-stop` renders and clicking it calls `onStop` — proving the post-removal Cancel is the existing Stop button, no new chrome.
- **SC#3 preserve oracle:** with `workflowLocked` the textarea is disabled, shows the exact "Workflow running — Cancel to switch back" placeholder, and Send is gated.
- **SC#3 reconcile oracle:** `ChatAreaBanner.test.tsx` now asserts `getThreadWorkflow` `locked:true` → composer disabled on mount (server truth, not a pill); `locked:false` → enabled. The 409 lock-banner test (b) is byte-unchanged.
- **SC#2 launch oracle:** new `ChatLayoutLaunch.test.tsx` drives the Workflows-page Run flow and asserts `createThread(def.name)` + `postMessage(threadId, kickoff, { workflowDefinitionId })` + `onNavigate("chat")`.
- **No-regression evidence:** `RunCard.timer.test.tsx` and `RunCard.test.tsx` confirmed UNTOUCHED and GREEN.
- `ChatAreaMode.test.tsx` flipped from RED (post-Plan-01 — the obsolete tests queried the removed testid) to GREEN.

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite ChatAreaMode.test.tsx + extend ChatAreaBanner.test.tsx** — `652e0e22` (test)
2. **Task 2: Add SC#2 launch integration test (ChatLayoutLaunch.test.tsx)** — `8545a70d` (test)

**Plan metadata:** (this SUMMARY + STATE/ROADMAP/REQUIREMENTS) — see final docs commit.

_Note: both tasks are `tdd="true"`. Task 1's RED was the pre-existing post-Plan-01 failure (the file referenced removed props/testids); the rewrite is the GREEN. Task 2's RED was the absent file; the new test is the GREEN. Per the test-only nature, each task is a single `test(...)` commit rather than a split RED/GREEN pair._

## Files Created/Modified

- `frontend/src/components/chat/__tests__/ChatAreaMode.test.tsx` — rewritten: deleted the `modePill()` helper + the 3 finding-#5 tests; added the 2-pill (SC#1), Cancel-reachability (D-01), and workflowLocked-preserve (SC#3) assertions; rewrote the header doc-comment to describe the 2-pill removal.
- `frontend/src/components/chat/__tests__/ChatAreaBanner.test.tsx` — extended: imported `getThreadWorkflow`, added the reconcile-lock describe block (locked:true → disabled; deep/locked:false → enabled), and added `workflowLockByThread: new Map()` to the `beforeEach` store reset. The 409 test b is byte-unchanged.
- `frontend/src/components/layout/__tests__/ChatLayoutLaunch.test.tsx` — new: renders `ChatLayout activeView="workflows"`, mocks the api + thread/folder/theme hooks, stubs NavPanel/WorkspacePanel, and asserts the doRun launch wiring.

## Decisions Made

- **Model pill assertion via static label:** a single-provider/single-model render shows the Model pill as a static `gpt-test` label (the dropdown only appears with >1 option), so the SC#1 test asserts the label text. Either shape satisfies "Model pill present."
- **`mockResolvedValue` (not `…Once`) for the locked reconcile:** the mount reconcile effect can re-fire; a single `Once` value would let a subsequent `undefined` resolve re-clear the lock. Persistent-per-test (reset by `vi.clearAllMocks`) is the robust shape.
- **Stub NavPanel + WorkspacePanel in the launch test:** they pull StreamsProvider hooks irrelevant to the launch wiring; stubbing keeps the assertion scoped to the doRun api/navigate calls (the plan explicitly sanctioned this).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Per-test workflow-lock bleed in ChatAreaBanner.test.tsx**
- **Found during:** Task 1 (extending ChatAreaBanner with the reconcile-lock cases)
- **Issue:** the `locked:true` reconcile test writes to the store's `workflowLockByThread` map, which the existing `beforeEach` reset did NOT clear (and `vi.clearAllMocks` does not touch the store). The lock from the locked test bled into the following `locked:false` test, leaving its composer disabled.
- **Fix:** added `workflowLockByThread: new Map()` to the `beforeEach` `useStreamsStore.setState({...})` block, and set an explicit deep `getThreadWorkflow` mock in the unlocked test so the reconcile actively clears any residual lock.
- **Files modified:** frontend/src/components/chat/__tests__/ChatAreaBanner.test.tsx
- **Verification:** both reconcile-lock cases pass in sequence and in isolation; the existing tests a/b/c/d remain GREEN; the 409 test b is byte-unchanged.
- **Committed in:** `652e0e22` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 test-isolation bug)
**Impact on plan:** the fix is test-only hygiene confined to the new cases' setup. No production code touched, no scope creep. The mandated PRESERVE boundaries (409 test b byte-unchanged, RunCard untouched) held.

## Issues Encountered

- **Full-suite pre-existing failures (out of scope):** `cd frontend && npm run test` reports 27 failures across 14 files (`streamsProvider.test.tsx`, `IngestionPage.test.tsx`, `MessageItem.test.tsx`, `useMessages.test.ts`, `PhaseTimeline.test.tsx` axe-concurrency flake, `PublishGauntlet.test.tsx`, `model-info.test.ts`, `Plan04.frontend.test.tsx`). These were confirmed PRE-EXISTING by restoring the `HEAD~2` (pre-plan) versions of this plan's files and re-running the sample (`model-info` + `streamsProvider` still failed — 11 failed). None are files this plan touched; per the scope boundary they are not fixed here. Logged to `.planning/phases/121-one-front-door-for-workflows-ia/deferred-items.md`.

## User Setup Required

None - no external service configuration required. Test-only plan: no production/backend/migration change.

## Next Phase Readiness

- All three target test files GREEN; the rewritten `ChatAreaMode.test.tsx` flips RED→GREEN. RunCard tests untouched + GREEN.
- Every Phase 121 SC now has a machine-checkable oracle — verify-work has automated evidence. The SC#10 4-axis cross-provider UAT remains MANUAL per `121-VALIDATION.md`.
- Pre-existing full-suite failures are unrelated to IA-01 and do not block verify-work for this phase's oracles; they are logged for the broader test-health backlog.

## Self-Check: PASSED

- Created/modified files all present: ChatAreaMode.test.tsx, ChatAreaBanner.test.tsx, ChatLayoutLaunch.test.tsx, 121-02-SUMMARY.md, deferred-items.md.
- Task commits present in git: `652e0e22` (Task 1), `8545a70d` (Task 2).
- All 3 target test files GREEN (11 tests); RunCard.timer.test.tsx + RunCard.test.tsx untouched (`git diff --quiet`) and GREEN.
- `git diff --stat HEAD~2 HEAD` shows ONLY the 3 `__tests__/` files — zero production-source, zero backend, zero migration (D-06/G-5).

---
*Phase: 121-one-front-door-for-workflows-ia*
*Completed: 2026-06-22*
