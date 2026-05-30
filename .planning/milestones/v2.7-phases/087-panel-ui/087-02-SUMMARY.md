---
phase: 087-panel-ui
plan: 02
subsystem: ui
tags: [react, typescript, vitest, panel, workspace, shell, grid-state-machine, accordion, mobile-sheet, a11y, seam-wiring]

# Dependency graph
requires:
  - phase: 087-panel-ui (Plan 01 / Wave 0)
    provides: "Sheet bottom-sheet primitive; --warning/--muted-foreground-dim tokens; WorkspacePanel.test.tsx + TodosSection.test.tsx it.todo skeletons; fixtures.ts (mockTodos/mockWorkspaceFiles/mockPendingAskWithRunId + hook-return factories)"
  - phase: 087-panel-ui (Plan 03)
    provides: "FilesSection (file list + drill-in preview)"
  - phase: 087-panel-ui (Plan 04)
    provides: "VersionDiff (Versions section body)"
  - phase: 087-panel-ui (Plan 05)
    provides: "PendingAskStack (pinned amber answer surface); SeamPointer/SeamCard with optional onSeePanel/onOpenPanel left unwired"
  - phase: 086-streamsprovider-extension-panel-hooks
    provides: "useViewingThread + useTodos/useWorkspaceFiles/useAskUserPrompt reactive hooks ({data,isLoading,error,reconcile}; data never undefined)"
provides:
  - "WorkspacePanel — the panel shell: open/rail/hidden grid-state machine, ⌘./Ctrl+. toggle, empty short-circuit, fixed-order accordion composition (Todos·Files·Versions) with PendingAskStack pinned top, <768px bottom-sheet"
  - "PanelSection — collapsible accordion primitive (real <button aria-expanded>, rotating decorative chevron, mono font-semibold count badge, .warn amber, role=region body)"
  - "PanelEmpty — centered calm empty short-circuit (UI-SPEC copy)"
  - "PanelRail — 52px collapsed icon strip with count-bearing aria-labels + decorative badges + amber pending warn"
  - "TodosSection — live todo list with non-color-only status indicators (PANEL-02)"
  - "panelOpenSignal — module-level bus wiring chat-side seam onSeePanel/onOpenPanel to the panel-open action (additive, PANEL-06 safe)"
  - "FilesSection.onSelectFile — additive callback lifting the opened file to the shell so Versions is never orphaned"
affects: [088-a11y-e2e, future panel-section additions]

# Tech tracking
tech-stack:
  added: []  # zero new dependencies — pure React + existing tokens/hooks/Sheet
  patterns:
    - "Push/split grid lives INSIDE WorkspacePanel's own aside (Pitfall 3 — the live ChatLayout is flex, not grid); only the panel column is owned here"
    - "State machine open→rail→hidden: header button CYCLES (open→rail→hidden→open), ⌘./Ctrl+. TOGGLES open↔hidden; rail icon / seam pointer EXPANDS to open"
    - "Mobile detection via window.innerWidth + resize listener (no matchMedia — jsdom-safe); <768px renders the body inside the Radix-Dialog Sheet"
    - "Additive seam wiring via a module-level event bus (subscribeOpenPanel/requestOpenPanel) instead of re-plumbing onSeePanel/onOpenPanel through MessageList→ChatArea (keeps the G-5 MessageItem change to 6 ins / 0 del, PANEL-06 safe)"
    - "Lifted selectedFile state: FilesSection.onSelectFile sets it, the Versions section consumes it (VersionDiff file=selectedFile); null → 'Select a file to compare versions' guard so Versions is never orphaned"
    - "Non-color-only status (TodosSection): icon (circle/dotBounce/checkPop check) + visible text label in the accessible tree, never color alone"

key-files:
  created:
    - frontend/src/components/panel/WorkspacePanel.tsx
    - frontend/src/components/panel/PanelSection.tsx
    - frontend/src/components/panel/PanelEmpty.tsx
    - frontend/src/components/panel/PanelRail.tsx
    - frontend/src/components/panel/TodosSection.tsx
    - frontend/src/components/panel/panelOpenSignal.ts
  modified:
    - frontend/src/components/panel/FilesSection.tsx
    - frontend/src/components/chat/MessageItem.tsx
    - frontend/src/components/layout/ChatLayout.tsx
    - frontend/src/components/panel/__tests__/WorkspacePanel.test.tsx
    - frontend/src/components/panel/__tests__/TodosSection.test.tsx

key-decisions:
  - "panelOpenSignal module-level bus (5th file beyond the plan's named set): MessageItem is rendered deep inside ChatArea→MessageList and receives no panel props; re-plumbing onSeePanel/onOpenPanel through those layers would touch G-5 hot-file internals beyond 'pass the already-declared optional props'. The bus keeps the wiring additive (MessageItem diff = 6 ins / 0 del) and carries no thread data, so it cannot trigger chat re-renders (T-087-17 / PANEL-06)."
  - "Header button CYCLES open→rail→hidden; ⌘./Ctrl+. TOGGLES open↔hidden — matches the Wave 0 test contract (single header click → rail; keyboard → hidden) and the panel-shell.md three-state model."
  - "Mobile breakpoint via window.innerWidth + resize (not matchMedia) — jsdom has no matchMedia; innerWidth is settable in tests and the resize listener keeps it live."
  - "The 'Pending question' fixed-order slot is satisfied by the PendingAskStack PINNED at the very top (087-05 contract) rather than an additional empty accordion section — avoids an always-present empty 'Pending' header (the empty-tax the short-circuit philosophy forbids)."
  - "TodosSection status label rendered ONCE in the accessible tree (not duplicated sr-only + aria-hidden) — keeps getByText unambiguous AND conveys status non-color-only."

requirements-completed: [PANEL-01, PANEL-02]

# Metrics
duration: ~8min
completed: 2026-05-29
---

# Phase 087 Plan 02: Panel Shell + Composition Capstone Summary

**The PANEL-01 panel shell + PANEL-02 todos: `WorkspacePanel` hosts an open/rail/hidden grid-state machine (⌘./Ctrl+. toggle, <768px bottom-sheet, laptop-squeeze-aware), short-circuits to ONE calm `PanelEmpty` when idle, and composes the live Wave-1/2 sections (Todos · Files · Versions) into a fixed-order accordion with the `PendingAskStack` pinned at the very top — mounted as one additive sibling in `ChatLayout` (chat-view only) with the chat↔panel seam open-handlers wired via a module-level signal. The new `TodosSection` renders the reactive todo list with non-color-only status indicators. All 7 panel test files GREEN (67 live, 0 todo); full suite at the documented 17-failure baseline, no new failures.**

## Performance
- **Duration:** ~8 min
- **Completed:** 2026-05-29
- **Tasks:** 3 (Task 2 TDD)
- **Files:** 11 (6 created, 5 modified)

## Accomplishments
- **Task 1 — primitives:** `PanelSection` (real `<button aria-expanded>` accordion head, decorative rotating chevron, right-aligned mono `font-semibold` count badge — the only non-400 weight — `.warn` amber, `role=region` body labelled by the head), `PanelEmpty` (centered calm short-circuit, copy verbatim from UI-SPEC), `PanelRail` (52px strip, real `<button>` per icon with count-bearing `aria-label`, decorative `aria-hidden` badge, amber pending-warn badge).
- **Task 2 — TodosSection (PANEL-02, TDD):** consumes `useTodos(threadId)` (reactive, full-state-replace, no refresh), renders one row per todo in `order_index` order keyed by `id`; status conveyed non-color-only via icon (`Circle`/`CircleDot` dotBounce/`CheckCircle2` checkPop, reduced-motion guarded) + a visible text label (Pending/In progress/Completed); empty list collapses cleanly. RED confirmed (import failure) → GREEN 6/6.
- **Task 3 — WorkspacePanel shell + mount + seam wiring:** open/rail/hidden grid-state machine (`grid-template-columns: clamp(300px,30%,420px)|52px|0`, `motion-safe` 300ms transition); header button cycles, `⌘.`/`Ctrl+.` toggles open↔hidden; empty short-circuit; fixed-order accordion (Todos·Files·Versions) with the Versions section bound to the lifted `selectedFile` (+ "Select a file to compare versions" guard); `PendingAskStack` pinned at the very top regardless of order; `<768px` bottom-sheet via the Plan-01 `Sheet`. Wired `requestOpenPanel` into `SeamPointer.onSeePanel` + `SeamCard.onOpenPanel` (the optional props Plan 05 left unwired) via the new `panelOpenSignal` bus. Mounted as one additive `ChatLayout` sibling gated on `activeView==="chat"`. 9/9 live tests.

## Task Commits
1. **Task 1: panel primitives — PanelSection, PanelEmpty, PanelRail** — `b590c1df` (feat)
2. **Task 2: TodosSection — live todo list with status indicators (PANEL-02)** — `852cb304` (feat)
3. **Task 3: WorkspacePanel shell + grid-state machine + ⌘. + ChatLayout mount** — `f351102e` (feat)

## Decisions Made
- **panelOpenSignal bus (additive seam wiring):** MessageItem (G-5 hot file) is rendered deep inside ChatArea→MessageList and receives no panel props. Re-plumbing `onSeePanel`/`onOpenPanel` through those layers would touch G-5 internals beyond "pass the already-declared optional props." A tiny module-level event bus (`requestOpenPanel`/`subscribeOpenPanel`) keeps the MessageItem change to 6 insertions / 0 deletions and carries no thread data, so it cannot trigger chat re-renders (T-087-17 / PANEL-06).
- **Toggle semantics:** header button CYCLES open→rail→hidden→open; `⌘.`/`Ctrl+.` TOGGLES open↔hidden — matches both the panel-shell.md three-state model and the Wave 0 test contract (single header click → rail; keyboard → hidden).
- **Mobile via innerWidth + resize** (not `matchMedia`) — jsdom has no `matchMedia`; `innerWidth` is settable in tests and the resize listener keeps the breakpoint live in the browser.
- **Pending slot = pinned stack, not an empty accordion section** — the fixed-order "Pending question" slot is satisfied by `PendingAskStack` pinned at the top (087-05 contract); rendering an always-present empty "Pending" header would re-introduce the empty-tax the short-circuit forbids.

## Deviations from Plan

### Auto-fixed / additive (within plan latitude)

**1. [Rule 3 — Blocking issue] Created panelOpenSignal.ts (6th file, not in files_modified)**
- **Found during:** Task 3 (wiring obligation #2).
- **Issue:** The plan requires wiring `onSeePanel`/`onOpenPanel` "from the panel-open path into MessageItem's seam renderers" while keeping the MessageItem change additive. MessageItem receives no panel props and is several layers below ChatLayout; threading props through MessageList/ChatArea would touch G-5 internals.
- **Fix:** Added a module-level event bus so the panel subscribes and the seam handlers fire it via the already-declared optional props. MessageItem diff stays 6 ins / 0 del.
- **Files modified:** `frontend/src/components/panel/panelOpenSignal.ts` (new).
- **Commit:** `f351102e`.

**2. [Additive] FilesSection.onSelectFile callback**
- **Found during:** Task 3.
- **Issue:** The Versions section must bind to the currently-previewed file (plan: "lift selectedFile into WorkspacePanel so FilesSection sets it"). FilesSection (Plan 03) had no file-selection callback.
- **Fix:** Added an optional `onSelectFile` prop fired on drill-in open. FilesSection still works standalone (default `{}`). 11 ins / 1 del (signature line).
- **Files modified:** `frontend/src/components/panel/FilesSection.tsx`.
- **Commit:** `f351102e`.

**Total deviations:** 2 (1 Rule-3 additive bus to keep the G-5 file additive, 1 additive callback). **Impact:** none negative — both additive, zero new dependency, no existing behavior changed.

## Issues Encountered
None blocking. The Wave 0 `WorkspacePanel.test.tsx` placed all PANEL-01 contracts in one file; flipping the 8 `it.todo` strings produced 9 live tests (one split into a separate landmark assertion). Section bodies are mocked to thin sentinels (their behavior is covered by their own test files) so this file asserts composition + state-machine only.

## TDD Gate Compliance
Task 2 was `tdd="true"`. The Wave 0 `it.todo` skeleton served as the RED contract; the live test was written and confirmed RED (import-resolution failure — component absent) before TodosSection landed, then GREEN 6/6. Component + live tests shipped in one commit (`852cb304`), the standard "flip the Wave 0 skeleton" pattern. Tasks 1 and 3 are `type="auto"` (no per-task RED gate required).

## Threat Surface
No new threat surface beyond the plan's `<threat_model>`:
- **T-087-15 (cross-thread bleed):** WorkspacePanel keys all section data by `useViewingThread()` and consumes the Phase-086 hooks as-is (isolated per-thread Maps + usePanelReconcile abort). No new fetch logic. Mitigated.
- **T-087-16 (G-5 regression in ChatLayout):** one additive sibling render gated on `activeView==="chat"`; NavPanel/drawer/`<main>` preserved (diff = 6 ins / 0 del). Mitigated.
- **T-087-17 (panel re-renders chat — PANEL-06):** the hooks use isolated Maps + stable EMPTY refs; the panelOpenSignal bus carries no thread data (a pure "reveal" pulse) and shares no Zustand selector with chat. MessageItem diff additive (6 ins / 0 del). Mitigated.

## Known Stubs
None. WorkspacePanel composes live components (TodosSection/FilesSection/VersionDiff/PendingAskStack) wired to the real Phase-086 hooks. The Versions "Select a file to compare versions" placeholder is an intentional no-selection guard (the plan's required affordance so Versions is never orphaned), not a stub. No panel test files retain `it.todo` placeholders — all 67 panel tests are live.

## User Setup Required
None — frontend-only, zero new dependencies, no env/config.

## Verification
- `node node_modules/typescript/bin/tsc --noEmit` — clean (full project, exit 0) after every task.
- `npx vitest run src/components/panel/` — **67 passed, 0 todo, 0 fail** across all 8 panel-dir files (7 component test files + fixtures): WorkspacePanel 9, TodosSection 6, FilesSection 5, FilePreview 10, CsvTablePreview 6, PendingAskCard 10, Seam 7, VersionDiff 14.
- `npx vitest run` (full suite) — **386 passed / 17 failed** = exactly the documented 17-failure baseline; all 17 are pre-existing (StreamsProvider/useMessages/MessageItem-thinking-indicator/model-info/Plan04), none in the panel dir, none introduced by this plan. MessageItem.test re-run in isolation: 17 passed / 1 failed (the documented thinking-indicator baseline), unchanged by the additive seam-handler wiring.
- ChatLayout diff additive: `git diff --stat` = 6 insertions / 0 deletions (NavPanel/drawer/`<main>` intact). MessageItem diff: 6 insertions / 0 deletions.
- Acceptance greps: `useViewingThread`, `role="complementary"`, `metaKey|ctrlKey`, `PanelEmpty`, all four section imports, `selectedFile`/`compare versions`, `Sheet` all present in WorkspacePanel; `WorkspacePanel` + `activeView === "chat"` gate present in ChatLayout.

## Next Phase Readiness
- **088 (a11y/E2E):** the panel landmark (`role=complementary`), accordion (`<button aria-expanded>` + `role=region`), rail count-bearing `aria-label`s, and non-color-only todo status are baked in for the A11Y gate. The live grid-state machine + bottom-sheet are ready for Chrome MCP lived-experience UAT (087-VALIDATION.md), including the carry-forward 086 rapid-thread-switch reconcile-abort item now that a real consumer (WorkspacePanel) is mounted.
- **Carry-forward UAT:** exercise the panel open/rail/hidden + ⌘. toggle, the empty short-circuit on a plain Q&A thread, the pinned ask_user, and the seam pointer→panel-open across the breakpoints (375/768/1024/1440) and all 6 native providers.
- No blockers. Phase 087 is now fully composed (Plans 01·03·04·05 + this capstone).

## Self-Check: PASSED

All 6 created files verified present on disk; all 3 task commit hashes verified in git log (`b590c1df`, `852cb304`, `f351102e`). Panel suite 67/67 GREEN; full suite at the 17-failure baseline (unchanged); tsc --noEmit exit 0.

---
*Phase: 087-panel-ui*
*Completed: 2026-05-29*
