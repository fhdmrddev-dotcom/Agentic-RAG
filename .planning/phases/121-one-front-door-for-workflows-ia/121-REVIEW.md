---
phase: 121-one-front-door-for-workflows-ia
reviewed: 2026-06-22T23:30:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - frontend/src/components/chat/ChatArea.tsx
  - frontend/src/components/chat/MessageInput.tsx
  - frontend/src/components/chat/__tests__/ChatAreaBanner.test.tsx
  - frontend/src/components/chat/__tests__/ChatAreaMode.test.tsx
  - frontend/src/components/layout/__tests__/ChatLayoutLaunch.test.tsx
findings:
  critical: 0
  warning: 0
  info: 3
  total: 3
status: clean
---

# Phase 121: Code Review Report

**Reviewed:** 2026-06-22T23:30:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** clean

## Summary

Phase 121 is a pure REMOVAL + test-rebind phase (req IA-01). The review focused on
removal correctness per the phase intent: dangling references to deleted symbols,
dead code left behind, a removed import still used elsewhere, and accidental damage
to the PRESERVE LIST.

I examined the diff against the base (`131584b6^`), not just the final files, and
verified every removed symbol. The removal is **clean and correct**:

- **No dangling references.** All six deleted symbols (`workflowMode`,
  `onWorkflowModeChange`, `displayedMode`, `publishedWorkflows`,
  `selectedWorkflowId`/`onWorkflowSelect`, `WorkflowOption`, `labelMode`) have zero
  remaining references in source outside the test files' intentional negative
  assertions. Confirmed by grep across `frontend/src` and a full `tsc --noEmit`
  pass (0 errors).
- **No orphaned imports / no orphaned exports.** `ChatArea.tsx` dropped the
  `listPublishedWorkflows`, `PublishedWorkflow`, and `requestOpenPanel` imports.
  `requestOpenPanel` is still legitimately used in `MessageItem.tsx`;
  `listPublishedWorkflows`/`PublishedWorkflow` are still consumed by
  `WorkflowsPage.tsx` + `ChatLayout.tsx` — so neither the removed imports break
  anything nor do the removals orphan the exported API surface. `MessageInput.tsx`
  correctly dropped the now-unused `Sparkles` and `Workflow` lucide icons; the
  surviving `Layers`, `Cpu`, `Compass`, `Square`, etc. all remain in use.
- **No dead code left behind.** The `setWorkflowMode`/`setSelectedWorkflowId` reset
  branch in the thread-switch effect, the `listPublishedWorkflows` feed effect, and
  the `kickoffWorkflowId` staging branch inside `handleSend` (including the
  `requestOpenPanel()` auto-open and the post-send `setSelectedWorkflowId(null)`
  clear) were all removed as a unit. The `handleSend` `useCallback` dependency array
  was correctly trimmed (`workflowMode`, `selectedWorkflowId` dropped).

- **PRESERVE LIST intact (verified individually):**
  - Per-thread `workflowLocked` gating — preserved. `useWorkflowLockForThread(thread?.id)`
    (owner-scoped, never global) still drives `workflowLocked`, passed to MessageInput
    where it disables the textarea, swaps the placeholder, gates Send, and
    disabled-with-tooltips the surviving `agent-mode-selector`.
  - Mount reconcile via `getThreadWorkflow` — preserved byte-for-byte. The effect at
    `ChatArea.tsx:157-183` still reads `state.locked && !state.lock_is_stale &&
    state.active_workflow_run_id` and sets/clears the per-thread lock. All fields read
    exist on `ThreadWorkflowState`.
  - 409 lock banner — preserved. The `reconcileError instanceof ApiError &&
    status === 409` branch still routes to the `workflow-lock-error-banner` testid with
    no Retry (409 ∈ NON_RETRYABLE).
  - `composer-stop` / `onStop` — preserved. The streaming-state Stop button is
    untouched and is the surviving Cancel affordance.
  - `doRun` → `postMessage({ workflowDefinitionId })` launch route — preserved.
    `ChatLayout.doRun` (`createThread(def.name)` → `postMessage(thread.id, kickoff,
    { workflowDefinitionId: def.id })` → `onNavigate("chat")`) is unchanged and is the
    surviving launch path.

**Validation performed:** `tsc --noEmit` passes (0 errors — proves no dangling
typed references). All 11 tests across the 3 rebound test files pass. The
`ChatLayoutLaunch` SC#2 test is a genuine integration test driving the real
WorkflowsPage Run flow → real `ChatLayout.doRun` (not a stubbed `doRun`), so it is
non-vacuous coverage of the surviving launch route.

No Critical or Warning findings. Three Info-level notes follow.

## Info

### IN-01: Pre-existing eslint errors surface in the touched files (not introduced by Phase 121)

**File:** `frontend/src/components/chat/MessageInput.tsx:64,95`, `frontend/src/components/chat/ChatArea.tsx:559`
**Issue:** `eslint` reports 3 errors in the two touched files:
- `MessageInput.tsx:64` — `react-refresh/only-export-components` on the
  `_resetComposerDraftsForTest` non-component export.
- `MessageInput.tsx:95` — `react-hooks/refs` "Cannot update ref during render"
  (`valueRef.current = value`).
- `ChatArea.tsx:559` — `react-hooks/purity` "Cannot call impure function during
  render" (`useRef(Date.now())` inside `StickyTimerBar`).

`git blame` against the base confirms all three predate Phase 121 (April/May 2026
commits); the removal only shifted their line numbers. They are out of scope for
this removal phase and the project evidently tolerates them under the current
React-19-era plugin ruleset.
**Fix:** Out of scope for Phase 121 — no action required for this phase. If desired
later: move `_resetComposerDraftsForTest` to a sibling test-util module; replace the
render-time ref writes with an effect-driven mirror. Do not bundle into this removal.

### IN-02: SC#1 negative assertions cannot distinguish "removed" from "never existed"

**File:** `frontend/src/components/chat/__tests__/ChatAreaMode.test.tsx:49-50`
**Issue:** `expect(screen.queryByTestId("workflow-mode-selector")).toBeNull()` and the
`workflow-picker` equivalent pass trivially because those testids no longer exist
anywhere — the assertion would also pass against a MessageInput that rendered nothing.
The test is not vacuous overall (it also positively asserts `agent-mode-selector`
presence and the `gpt-test` Model label), so the "2-pill" shape is meaningfully pinned;
this is purely a note that the GONE assertions are weak on their own. This is inherent
to removal tests and acceptable.
**Fix:** None required. If extra rigor is wanted, the positive 2-pill count assertion
(agent-mode + Model present, exactly) is the load-bearing guard and is already present.

### IN-03: ChatAreaBanner mock `getThreadWorkflow` returns a partial `ThreadWorkflowState`

**File:** `frontend/src/components/chat/__tests__/ChatAreaBanner.test.tsx:46-49`
**Issue:** The default `vi.mock` factory resolves `getThreadWorkflow` to
`{ mode: "deep", active_workflow_run_id: null }`, omitting `locked` / `lock_is_stale`.
The production reconcile reads `state.locked && !state.lock_is_stale && ...`; with
`locked` undefined the guard is falsy and falls to the clear-lock else branch — so the
behavior under test is correct and the default-unlocked cases pass for the right reason.
This is a test-fixture shape gap (an untyped object literal feeding a mocked promise),
not a production bug. The two `121 reconcile-lock` cases correctly override with fuller
shapes cast via `as Awaited<ReturnType<typeof getThreadWorkflow>>`.
**Fix:** None required. Optionally type the default factory return the same way for
consistency so a future field-rename in `ThreadWorkflowState` is caught by the fixture.

---

_Reviewed: 2026-06-22T23:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
