---
phase: 297-every-view-has-an-address
fixed_at: 2026-10-28T00:05:00Z
review_path: .planning/phases/297-every-view-has-an-address/297-REVIEW.md
iteration: 1
findings_in_scope: 9
fixed: 9
skipped: 0
status: all_fixed
---

# Phase 297: Code Review Fix Report

**Fixed at:** 2026-10-28
**Source review:** .planning/phases/297-every-view-has-an-address/297-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 9. That is WR-01..04, IN-01..05. IN-01 was optional and is included. IN-06 is out of scope: it is SEED-392 and stays deferred.
- Fixed: 9
- Skipped: 0

Every fix ran on the main working tree, on branch `develop`, as directed, with no worktree. Each commit was made by path.

## Fixed Issues

### WR-01: The leave prompt is shown, Cancel is pressed, and the edit is discarded anyway

**Files modified:** `frontend/src/hooks/useAppNavigation.ts`, `frontend/src/hooks/__tests__/useAppNavigation.leaveGuard.test.tsx`, `frontend/src/__tests__/routing/noRawHistoryWrites.test.ts`, `scripts/vitest-count-gate.cjs`
**Commit:** a75cef7a7
**Status:** fixed: requires human verification (this is a logic fix, and the G-4 row 3 browser drive is still owed)

**Applied fix:** This is fixed on the router side. PKCE was not adopted, so the auth flow is unchanged.
- Just before the router writes from a History entry that has no router `idx` (in `go()` and in the normalising replace), `ensureEntryIdx()` stamps that entry in place.
- The stamp is `{...state, idx: lastIdx + 1}` at the same URL. `lastIdx` is the last idx the router wrote.
- The router's push from that entry then gets `idx + 1`, so a later Back has delta -1 and the blocker can revert it.
- The router's own `replace()` cannot do this repair, because it re-reads the null idx.
- The stamp only happens when `window.location.pathname` matches the router's pathname, so a memory router is never touched.

This is the one raw History write in product code. `noRawHistoryWrites.test.ts` allows it by exact text, in that one file only:
- the text must occur exactly once;
- a non-vacuity check confirms the sweep would flag the file without the exemption;
- the same text anywhere else stays red.

**Proof:**
- The reviewer's probe, unchanged, still prints `asked 1 | router pathname / | blocker (none)`. It drives the router directly, without the hook, so it shows the defect mechanism.
- A copy with the stamp applied before the push prints `stamped state: {"idx":1}` and `at /app/workflows … "idx":2`, then `after Back + Cancel: asked 1 | router pathname /app/workflows | blocker blocked`. The copy is in the scratchpad (`nullidx/probe-fixed.mjs`).
- A new vitest case runs the real `createBrowserRouter` over jsdom History with the two raw hash writes planted, then calls the real hook. Before the fix it was red: `expected '/' to be '/app/workflows'`, with confirm called once. After the fix it is green.

### WR-02: Test Run arms the one-shot latch across a person-paced await

**Files modified:** `frontend/src/pages/WorkflowsPage.tsx`, `frontend/src/components/layout/ChatLayout.tsx`, `frontend/src/pages/__tests__/WorkflowsPage.leaveGuard.test.tsx`, `scripts/vitest-count-gate.cjs`
**Commit:** 935aa2871
**Status:** fixed: requires human verification

**Applied fix:**
- `doRun` takes an optional `beforeNavigate`. It is called after every await, immediately before `openRun?.(…)` and before `onNavigate("chat")`. Test Run arms the latch only through it, and the `finally` clear is kept.
- A Builder that is still dirty when Test Run reaches the page means its save was refused. `WorkflowBuilderPage.tsx` is off-limits, so `saveNow()`'s boolean cannot be read there. Instead, Test Run now passes the same guard the connect control and `backToLibrary` pass first. That guard's refusal is total: Cancel launches nothing.
- A clean Builder's guard answers true without asking, so D-32 still holds for every Test Run whose save went through.

The old pin "Test Run while dirty: 0 confirm calls" encoded the defect. It was corrected in a comment beside the original, not deleted.

### WR-03: After sign-in, a cold admin or run address paints the refusal or the fallback for one frame

**Files modified:** `frontend/src/hooks/useOperatorProbe.ts`, `frontend/src/hooks/useEffectiveFeatures.ts`, `frontend/src/components/layout/__tests__/AppViewSwitch.addressStates.test.tsx`, `scripts/vitest-count-gate.cjs`
**Commit:** dfa78855c

**Applied fix:** Both probes now record which user their answer belongs to (`answeredFor`). They return `loading: loading || answeredFor !== userId`, so the sign-in render itself holds. A refetch for the same user behaves as before.

The test drives the real hooks across `userId: null → "u-297"`. It reads the DOM in a layout effect, so every commit is checked. Before the fix it saw `["S1@u-297"]` for admin and spend, and `["fallback@u-297"]` for the run.

### WR-04: A cancelled navigation leaves the Library Health hand-off behind

**Files modified:** `frontend/src/hooks/useAppNavigation.ts`, `frontend/src/hooks/__tests__/useAppNavigation.leaveGuard.test.tsx`, `scripts/vitest-count-gate.cjs`
**Commit:** edd1ea699
**Status:** fixed: requires human verification

**Applied fix:** The render-time spend now also fires on the render where the blocker turns `blocked`, using the same `libraryTabAfterNavigate` rule. The change is folded into the existing writer, so `setLibraryTab(` still has exactly two writers. No third writer was added, so the `LibraryPage.tabAttention` pin is unchanged.

Before the fix, the new test was red: `expected 'health' to be undefined`. A positive control with OK still lands on Health.

The review also named `studioTab` and NavPanel's thread pick (WR-04's secondary mentions). Neither is changed: NavPanel is off-limits, and the fix scope named the Library hand-off.

### IN-01: `formatAppRoute` does not validate ids

**Files modified:** `frontend/src/hooks/useAppNavigation.ts`, `frontend/src/hooks/__tests__/useAppNavigation.test.tsx`, `scripts/vitest-count-gate.cjs`
**Commit:** 86d2ffebf

**Applied fix:** `go()` refuses a `workflow-run` or `skill-studio` route whose id is not a strict UUID, using `isStrictUuid` from runDeepLink. Before the fix the new test was red: a new location key appeared.

### IN-02: Clicking Chat at bare `/` pushes a duplicate entry

**Files modified:** `frontend/src/hooks/useAppNavigation.ts`, `frontend/src/hooks/__tests__/useAppNavigation.test.tsx`, `scripts/vitest-count-gate.cjs`
**Commit:** 7d5852afc

**Applied fix:** `go()` now also skips when the address on screen parses to the target route (`isOnScreen`).
- `bounceHome` uses the same check, so at `/` it neither rewrites the root nor arms the latch. Without that check, the latch would have stayed armed.
- Before the fix, 3 cases were red: new keys at `/` and at `/app?code=x`, and the bounce landed on `/app`.

### IN-03: The single flush has no positive control

**Files modified:** `frontend/src/hooks/__tests__/useAppNavigation.test.tsx`, `scripts/vitest-count-gate.cjs`
**Commit:** fd6f07da5

**Applied fix:** A control case checks that `/workflows` is replaced within the same single `await act(async () => {})`. To prove it, I disabled the normalising replace: the control failed. The file was then restored, and `git status` was clean.

### IN-04: The no-key fence omits the new provider

**Files modified:** `frontend/src/__tests__/routing/navigationKeepsStreams.test.tsx`
**Commit:** b25b2675c

**Applied fix:** `LeaveGuardContext\.Provider` was added to the alternation, with a non-vacuity contain check and a planted keyed tag that the regex must match. With the alternation entry removed, the planted-tag assertion goes red. The test count is unchanged (3).

### IN-05: The react-router range is a caret

**Files modified:** `frontend/package.json`, `frontend/package-lock.json`
**Commit:** 71237ea8e

**Applied fix:** `"react-router": "8.5.0"` is now set in package.json and in the lock's root `packages[""]` entry. This was a text edit; npm was not run. The locked `node_modules/react-router` was already 8.5.0.

## Not in scope

### IN-06: "Try in Chat" is a visible menu item that does nothing

**Reason:** This is deferred as SEED-392, per the fix instructions.

## Gates

- Count-gate pins were raised, never lowered:
  - `useAppNavigation.leaveGuard.test.tsx`: 23 → 26
  - `noRawHistoryWrites.test.ts`: 3 → 4
  - `WorkflowsPage.leaveGuard.test.tsx`: 12 → 15
  - `AppViewSwitch.addressStates.test.tsx`: 16 → 19
  - `useAppNavigation.test.tsx`: 30 → 35
- `tsc -p tsconfig.app.json`: 62 error lines before and 62 after. The set diff is empty.
- `check-hot-file-ledger.cjs 297`: OK. `check-claude-md-size.cjs`: OK, at 102,274 characters.
- `ChatHistoryColumn.test.tsx` date-grouping cases are red when run at about 00:50–01:05 local time. `const NOW = Date.now()` puts a "1 hour ago" thread across midnight. The suite and its component are byte-unchanged since `bcf3bb49b`.

---

_Fixed: 2026-10-28_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
