---
phase: 297-every-view-has-an-address
plan: 03
subsystem: ui
tags: [frontend, router, useBlocker, unsaved-edits]

requires:
  - phase: 297-02
    provides: "react-router 8.5 data mode, useAppNavigation as the one router-hook caller, bounceHome as a REPLACE, every raw History writer removed (POP blocking needs the router's idx)"
provides:
  - "frontend/src/lib/leaveGuard.ts: LeaveGuardContext (no-op default), createLeaveGuardRegistry, useLeaveGuard(predicate), useLeaveGuardRegistry()"
  - "The ONE app-level useBlocker in useAppNavigation, returned registry as nav.leaveGuards"
  - "WorkflowsPage as the only tenant (forwards canLeaveBuilderRef), with the one-shot latch at its three outbound sites"
affects: [297-04 (shares scripts/vitest-count-gate.cjs, append-only), 297-VALIDATION G-4 row 3 (D-28), any future editor that wants a leave guard (joins as a tenant)]

tech-stack:
  added: []
  patterns:
    - "Wiring (A): the tenant's predicate shows the confirm; blocked means Cancel, so the blocker only ever calls reset(), never proceed()"
    - "One-shot latch: armed immediately before a pathname-changing navigation, consumed by the first evaluation, cleared on every committed location key and in Test Run's finally"
    - "Context with a no-op default so tenants and their suites need no provider and no router"

key-files:
  created:
    - frontend/src/lib/leaveGuard.ts
    - frontend/src/hooks/__tests__/useAppNavigation.leaveGuard.test.tsx
    - frontend/src/pages/__tests__/WorkflowsPage.leaveGuard.test.tsx
  modified:
    - frontend/src/hooks/useAppNavigation.ts
    - frontend/src/App.tsx
    - frontend/src/pages/WorkflowsPage.tsx
    - scripts/vitest-count-gate.cjs
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md

key-decisions:
  - "D-31 wiring (A) kept: the Builder's own prompting predicate is forwarded; WorkflowBuilderPage.tsx is not edited (git diff empty)"
  - "The 403 bounce passes through the one-shot latch (D-42), not through navigation state: bounceHome arms it only when the home pathname differs from the current one"
  - "A cancelled push re-syncs the navigator's last-address ref, so the same rail click asks again instead of being swallowed as a same-address no-op"
  - "The registry is held in a lazy useState (one identity), not a ref read during render"

patterns-established:
  - "A new editor joins the leave guard as a tenant (useLeaveGuard), never as a second useBlocker"

requirements-completed: [LINK-07]

duration: ~1h
completed: 2026-10-28
---

# Phase 297 Plan 03: Unsaved-edit leave guard Summary

**One app-level `useBlocker` in `useAppNavigation` over a leave-guard registry. The Workflow Builder is its only tenant: Back, Forward, a rail click, the connect control and the golden-run link each ask exactly once when the Builder has unsaved edits. A clean Builder, Test Run and the forced 403 bounce are never asked.**

## Performance

- **Tasks:** 2/2
- **Files:** 3 created, 6 modified
- **Plan base:** `34b51fcce`

## Accomplishments

- `frontend/src/lib/leaveGuard.ts` (97 lines, imports only from `react`, no component). It holds the registry (a Set of entries plus one boolean latch), a frozen no-op default context, a `useLeaveGuardRegistry()` that never throws, and `useLeaveGuard(predicate)`.
- `useAppNavigation.ts` now has the ONE `useBlocker` in product code. It blocks only when the pathname changes, a tenant is registered, and `!canLeaveAll()`. On Cancel an effect calls `reset()` and re-syncs the navigator's `here` ref. A second effect, keyed on `location.key`, clears the latch after every committed navigation. `bounceHome` arms the latch only when the home pathname differs from the current one.
- `App.tsx` adds one `<LeaveGuardContext.Provider value={nav.leaveGuards}>` around `CitationNavProvider`, with no key. The value keeps one identity (a lazy `useState`).
- `WorkflowsPage.tsx`:
  - one `useLeaveGuard(useCallback(() => canLeaveBuilderRef.current?.() ?? true, []))`
  - `approveNextLeave()` at the connect control, the golden-run link and Test Run
  - `clearLeaveApproval()` in Test Run's `finally`
  - a dated correction beside the 184-11 "THERE IS NO ROUTER HERE" docblock, with the original sentence kept

  Acceptance counts: 1 / 3 / 1.

## Confirm-call-count evidence (every assertion is exact, `toHaveBeenCalledTimes(N)`, under `<StrictMode>`)

| Case | Calls |
|---|---|
| dirty Back, Cancel (address stays, blocker reset to unblocked) | 1 |
| dirty Back, OK | 1 |
| dirty Forward, Cancel then OK | 1, then 2 |
| dirty rail click, Cancel / OK | 1 / 1 |
| rail click cancelled, then the same rail click again | 1, then 2 (not swallowed) |
| reverted POP: Cancel, Cancel, OK | 1, 2, 3 |
| clean Back + Forward + rail click | 0 |
| no provider (no-op default), dirty | 0 |
| no tenant, dirty | 0 |
| search-only change, dirty | 0 |
| bounceHome while dirty on /app/workflows (lands on /app by REPLACE) | 0 |
| bounceHome while at /app, then a dirty rail click | 1 (no latch left armed) |
| approveNextLeave, then a leave, then another leave | 0, then 1 |
| latch armed before a search-only navigation, then a dirty leave | 1 (cleared on commit) |
| WorkflowsPage connect control, OK / Cancel | 1 / 1 |
| WorkflowsPage golden-run link, OK / Cancel | 1 / 1 |
| WorkflowsPage Test Run while dirty (navigation completes) | 0 |
| Test Run whose launch does not navigate, then a dirty Back | 0, then 1 |
| WorkflowsPage dirty Back Cancel (Builder stays mounted) / OK | 1 / 1 |
| WorkflowsPage dirty rail click Cancel | 1 |
| WorkflowsPage clean Builder rail click / Back; no Builder mounted | 0 / 0 / 0 |

**HARD GATE held without a cache.** The router calls the `shouldBlock` callback once per attempt. Its own revert popstate is swallowed by `unblockBlockerHistoryUpdate` (read from `react-router/dist/development/lib/router/router.js`), and StrictMode does not invoke the callback during render. So the per-`nextLocation.key` cache in the plan's fallback was not needed, and no count was relaxed.

**Each latch line was proven by mutation, then restored and re-checked by grep.**
- In the hook: removing the `here` re-sync and the latch clear makes 3 cases fail.
- In WorkflowsPage: removing the two in-page `approveNextLeave()` calls and the `finally` clear makes 3 cases fail (2 confirms instead of 1, and a stale latch skipping a later Back).

## Task Commits

1. Task 1 RED: `49c727c17` test(297-03): app-level leave guard contract
2. Task 1 GREEN: `525dd7ac3` feat(297-03): one app-level blocker over a leave-guard registry (D-21, D-24, D-42)
3. Task 2 RED: `006738dcd` test(297-03): WorkflowsPage tenant asks once per leave (4 of 12 failed: no tenant yet)
4. Task 2 GREEN: `e570d821b` feat(297-03): Workflow Builder is the leave-guard tenant (D-23, D-30, D-31, D-32)

## Gates

- **Count gate (full, once):** `count gate OK — 530/530 pinned files present, no per-file decrease, 0 failing.` total 12441, failed 0, pinned total 11268. `useAppNavigation.leaveGuard.test.tsx` 23/23, `WorkflowsPage.leaveGuard.test.tsx` 12/12, `WorkflowBuilderPage.session.test.tsx` 23/23, `navigationKeepsStreams.test.tsx` 3/3.
- **Targeted:** `WorkflowsPage.navGuard.test.tsx` (unmodified) passes. It is not in the count gate's TARGETS, so it was run explicitly. `WorkflowsPage.test.tsx`, `libraryFilter.test.ts`, `librarySubtree.fences.test.ts`, `SetupWizard.test.tsx`, `src/components/layout`, `useAppNavigation.test.tsx`, `noRawHistoryWrites`, `activeViewReachability`, `docsCoverageGate`, `renameFence` and both LibraryPage source fences: all green.
- **tsc** (`npx tsc -p tsconfig.app.json --noEmit`): 62 error lines at base, 62 after; the set diff is empty.
- **eslint** on the 4 product files and 2 new suites: clean.
- **Ledger:** `check-hot-file-ledger.cjs 297` reports ledger gate OK. **Size:** `check-claude-md-size.cjs` OK (102,274 chars).
- **Product `useBlocker(` sites:** exactly 1 (`frontend/src/hooks/useAppNavigation.ts`).
- **Unchanged since `34b51fcce` (`git diff` empty):** `WorkflowBuilderPage.tsx`, `WorkflowsPage.navGuard.test.tsx`, `WorkflowBuilderPage.session.test.tsx`, `StreamsProvider.tsx`, `NavPanel.tsx`.

## Decisions Made

- **D-31 wiring (A), as planned.** OK means "not blocked", so `proceed()` is never called. Cancel means "blocked", and the effect then calls `reset()`. This is D-22's user-visible contract.
- **D-42 uses the latch, not `state: { forced: true }`.** The 297-02 hand-off suggested navigation state; the plan specifies the latch. The latch is armed only when the pathname changes, and the location-key clear backs it up.
- **The registry is a lazy `useState`, not a `useRef` read during render.** It has the same single identity and avoids reading a ref while rendering.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A cancelled rail click wedged the navigator**
- **Found during:** Task 1 (a case I added to the RED suite)
- **Issue:** `go()` writes its target into `here` before navigating. When the blocker cancels a push, the location never changes, so `here` kept naming the refused address. The next click to the same destination was then swallowed as a same-address no-op.
- **Fix:** the reset effect re-syncs `here` to the address on screen before calling `reset()`.
- **Commit:** `525dd7ac3`

**2. [Rule 3 - Lint] The new suites assigned the hook value during render**
- **Issue:** this trips `react-hooks/immutability` and `react-hooks/globals`. The existing `useAppNavigation.test.tsx` has the same pre-existing error; it is out of scope and was not touched.
- **Fix:** the new suites park the value in an effect.
- **Commit:** `e570d821b`

**3. [Scope note] Ledger subsections for `useAppNavigation.ts` and `App.tsx` were written in Task 2's commit, as the plan's Task 2 action specifies.**

## Owed (not a task here)

- **G-4 row 3 (D-28) in 297-VALIDATION.md, seeded by 297-04 Task 3.** Chrome MCP drives a dirty Builder with `window.confirm` stubbed and counted, covering Back, Forward and a rail click (expect 1 each), and a clean Builder (expect 0). The operator may run the native dialog by hand.

## Known Stubs

None.

## Threat Flags

None. All new surface is covered by T-297-12..15:
- T-297-12: one blocker, POP revert relies on the router's idx.
- T-297-13: the latch is one-shot and cleared on commit and in a `finally`, with a stale-latch case.
- T-297-14: the forced bounce makes 0 calls.
- T-297-15: accepted.

## Self-Check: PASSED

Every file under key-files exists. Commits 49c727c17, 525dd7ac3, 006738dcd and e570d821b are present in `git log`.
