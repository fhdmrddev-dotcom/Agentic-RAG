---
phase: 155-accessibility-sweep-wcag-aa
reviewed: 2026-07-16T00:00:00Z
depth: standard
files_reviewed: 69
files_reviewed_list:
  - .github/workflows/frontend-tests.yml
  - frontend/eslint.a11y.config.js
  - frontend/eslint.config.js
  - frontend/package.json
  - frontend/src/index.css
  - frontend/src/components/layout/NavPanel.tsx
  - frontend/src/components/layout/ChatLayout.tsx
  - frontend/src/components/ingestion/DocumentList.tsx
  - frontend/src/components/ingestion/FolderNode.tsx
  - frontend/src/components/ingestion/FolderTree.tsx
  - frontend/src/components/ingestion/NavRow.tsx
  - frontend/src/components/ingestion/FilterBar.tsx
  - frontend/src/components/ingestion/AutomationGroup.tsx
  - frontend/src/components/ingestion/ConditionPopover.tsx
  - frontend/src/components/ingestion/ViewsGroup.tsx
  - frontend/src/components/chat/MessageInput.tsx
  - frontend/src/components/chat/MessageFeedback.tsx
  - frontend/src/components/chat/CitationCard.tsx
  - frontend/src/components/chat/OutputFileCard.tsx
  - frontend/src/components/chat/RunCard.tsx
  - frontend/src/components/chat/ToolCallPanel.tsx
  - frontend/src/components/chat/tool-bodies/ExecuteCodeBody.tsx
  - frontend/src/components/chat/tool-bodies/SearchDocumentsBody.tsx
  - frontend/src/components/skills/SkillCard.tsx
  - frontend/src/components/skills/SkillEvalSection.tsx
  - frontend/src/components/skills/SkillFormDialog.tsx
  - frontend/src/components/skills/SkillTestCasesSection.tsx
  - frontend/src/components/skills/studio/CaseEditor.tsx
  - frontend/src/components/skills/studio/RunBar.tsx
  - frontend/src/components/skills/studio/RunCaseDetail.tsx
  - frontend/src/components/skills/studio/RunHistory.tsx
  - frontend/src/components/skills/studio/VersionsTab.tsx
  - frontend/src/components/settings/EngineHealthCard.tsx
  - frontend/src/components/settings/MemorySection.tsx
  - frontend/src/components/settings/ModelPillRow.tsx
  - frontend/src/components/settings/ProviderPicker.tsx
  - frontend/src/components/settings/ReembedConfirmModal.tsx
  - frontend/src/components/settings/ReembedStatusCard.tsx
  - frontend/src/components/classification/RuleBuilderPanel.tsx
  - frontend/src/components/health/HealthDocumentRow.tsx
  - frontend/src/components/metadata/DocumentDetailPanel.tsx
  - frontend/src/components/metadata/InlineEdit.tsx
  - frontend/src/components/panel/WorkspacePanel.tsx
  - frontend/src/components/workflows/PhaseFormPanel.tsx
  - frontend/src/components/workflows/PublishGauntlet.tsx
  - frontend/src/components/workflows/WorkflowDoorSwitch.tsx
  - frontend/src/components/workflows/WorkflowSoul.tsx
  - frontend/src/lib/PlainLabel.tsx
  - frontend/src/pages/SettingsPage.tsx
  - frontend/src/pages/SkillStudioPage.tsx
  - frontend/src/pages/WorkflowsPage.tsx
  - frontend/src/components/admin/ActiveRunsSection.tsx
  - frontend/src/components/admin/AuditTab.tsx
  - frontend/src/components/admin/CapabilityGrid.tsx
  - frontend/src/components/admin/ControlRoomPage.tsx
  - frontend/src/components/admin/FeatureVisibility.tsx
  - frontend/src/components/admin/HealthSignals.tsx
  - frontend/src/components/admin/LockedTab.tsx
  - frontend/src/components/admin/ModelRegistryTab.tsx
  - frontend/src/components/admin/RecentActionsCard.tsx
  - frontend/src/components/admin/UsersAndAccess.tsx
  - frontend/src/components/admin/__tests__/CapabilityGrid.a11y.test.tsx
  - frontend/src/components/admin/__tests__/MaintenancePanel.a11y.test.tsx
  - frontend/src/components/admin/__tests__/ModelRegistryTab.a11y.test.tsx
  - frontend/src/components/chat/__tests__/CitationUI.a11y.test.tsx
  - frontend/src/components/chat/__tests__/MessageInput.a11y.test.tsx
  - frontend/src/pages/__tests__/RunModal.a11y.test.tsx
  - frontend/src/pages/__tests__/SettingsPage.a11y.test.tsx
  - frontend/src/components/ingestion/__tests__/DocumentStatusBadge.a11y.test.tsx
findings:
  critical: 1
  warning: 3
  info: 0
  total: 4
status: issues_found
---

# Phase 155: Code Review Report

**Reviewed:** 2026-07-16T00:00:00Z
**Depth:** standard
**Files Reviewed:** 69
**Status:** issues_found

## Summary

Reviewed the Phase 155 WCAG AA accessibility sweep: the jsx-a11y CI gate (`eslint.a11y.config.js` + `lint:a11y` + the `frontend-tests.yml` CI step), the `--muted-foreground-dim` token lift + opacity-class removals across ~30 components, the `autoFocus`→managed-ref refactors, the `<nav role="tablist">`→`<div role="tablist">` fixes, and 8 sampled `*.a11y.test.tsx` suites (of the 15 shipped).

**The gate mechanism is real, not a no-op.** I verified this empirically rather than by reading config alone:
- Dumped `jsxA11y.flatConfigs.recommended.rules` from the installed package — nearly all rules are at `"error"` severity (a small number are `"off"` by jsx-a11y's own upstream default, e.g. `control-has-associated-label`, `label-has-for` — not disabled by this phase).
- Injected a deliberate violation (`<img src="x.png" />`, missing `alt`) into `src/` and ran `npm run lint:a11y` — it reported the violation and exited **1**. Removed the probe file and re-ran — exited **0** (clean tree). This confirms the CI step (`.github/workflows/frontend-tests.yml` "Lint (jsx-a11y as errors)") will genuinely fail a PR that introduces an a11y regression.
- Verified the `<nav role="tablist">` → `<div role="tablist">` fixes (SkillStudioPage.tsx, ControlRoomPage.tsx) are not defensive theater: injected the pre-fix pattern and confirmed `jsx-a11y/no-noninteractive-element-to-interactive-role` fires on it even though `nav` is not explicitly listed in that rule's per-element option map (the rule's default WAI-ARIA landmark mapping covers it).

**The opacity-class / `--muted-foreground-dim` mechanical sweep is clean.** Spot-checked diffs across RunCard.tsx, ToolCallPanel.tsx, SettingsPage.tsx, and 8 admin components — every hunk is a straight `/NN` opacity-suffix removal with no logic touched, confirming the "low-risk" framing in the task brief.

**The 8 sampled `*.a11y.test.tsx` suites are real, not false gates.** I ran all 8 files directly (`npx vitest run`) — 84/84 tests pass. Every `axe()` call is `await`ed against a populated container (never an empty render). The two documented per-rule exclusions I found (`empty-table-header` in `ModelRegistryTab.a11y.test.tsx`, `nested-interactive` in `CitationUI.a11y.test.tsx`) are narrowly scoped (single named rule, not a blanket disable), backed by a code comment naming the exact CSS selector/pattern excluded and *why* it's a documented false-positive, and each is immediately followed by a positive assertion proving the excluded barrier doesn't actually exist (e.g. the "excluded" table header's `aria-label` is asserted present; the "excluded" nested button is asserted independently reachable by role+name). This is the correct way to take a narrow axe exclusion — not the "silences real WCAG-A/AA rules" failure mode the task asked me to watch for.

**One real regression-shaped gap survived the sweep despite the phase directly touching the file for this exact purpose:** `NavPanel.tsx`'s per-thread "Stop run" and "Thread options" controls are conditionally *rendered* (not merely dimmed) based only on `isHovered` (mouseenter/mouseleave) or `isMenuOpen` — there is no `onFocus`/`focus-within` path that mounts them. A keyboard-only user tabbing through the thread list can never reach Stop / Rename / Delete for any thread. The phase's own added comment on this exact block claims "every control is independently keyboard-operable" — that claim is false for this hover-gated action row. The same phase fixed the *identical* anti-pattern in `NavRow.tsx` (its own comment: "Never opacity-0 hover-only ... revealed on hover OR focus-within") — proving the team knew the correct fix and simply didn't apply it here. See CR-01.

Three further pre-existing (not introduced by this diff) gaps were left un-remediated in files this phase specifically touched for a11y purposes — see WR-01..WR-03.

## Critical Issues

### CR-01: NavPanel thread-row Stop/options controls are unreachable by keyboard

**File:** `frontend/src/components/layout/NavPanel.tsx:137,197-236`
**Issue:** The per-thread "Stop run" button and "Thread options" (rename/delete) button are wrapped in `{showActions && (...)}`, where `showActions = isHovered || isMenuOpen` (line 137) and `isHovered` is driven only by `onMouseEnter`/`onMouseLeave` (lines 145-146). There is no `onFocus` handler and no `focus-within` CSS on the row that would mount these controls when a keyboard user tabs onto the row's title button. Since the controls do not exist in the DOM until hovered (or until the options menu is already open — itself unreachable without the hover-gated button), a keyboard-only user can never Stop a running thread, rename it, or delete it from the nav panel. This directly contradicts the comment this same phase added immediately above the block: *"the Stop + options controls are SIBLINGS ... so every control is independently keyboard-operable"* — that claim is false as shipped. The identical hover-only-reveal anti-pattern was explicitly identified and fixed elsewhere in this same phase: `frontend/src/components/ingestion/NavRow.tsx:225-237` mounts its action controls unconditionally and reveals them via `"opacity-25 group-hover:opacity-100 focus-within:opacity-100"`, with a comment stating "Never opacity-0 hover-only (which was invisible on touch)." NavPanel's thread row needed the same treatment and didn't get it. This is a genuine WCAG 2.1 SC 2.1.1 (Keyboard) Level A failure on core functionality (stopping a live agent run, renaming, deleting a thread) — jsx-a11y's static rules cannot catch this because it's a runtime conditional-render/mouse-state issue, not a JSX attribute defect, so the CI gate will not block it.
**Fix:** Mount the actions row unconditionally (mirroring NavRow's pattern) and gate visibility via CSS only, adding `focus-within` alongside `group-hover`:
```tsx
// Always render; the row itself already needs `group` on its wrapping <div>.
<div
  className={cn(
    "absolute inset-y-0 right-0 flex items-center gap-1 pl-10 pr-1.5",
    "bg-gradient-to-l from-sidebar via-sidebar to-transparent rounded-r-lg",
    "opacity-0 transition-opacity",
    "group-hover:opacity-100 group-focus-within:opacity-100",
    isMenuOpen && "opacity-100",
  )}
>
  {/* Stop + options buttons, unchanged */}
</div>
```
Also add `group` to the row wrapper `<div>` at line 165 (it currently reads `className={cn("relative rounded-lg transition-all duration-150", ...)}`) so `group-focus-within` resolves. Verify with a live Tab-through of a thread list that has an active run — Stop must be reachable and activatable via Tab + Enter without any mouse interaction.

## Warnings

### WR-01: Hover-only action reveal lacks a keyboard-focus path (3 files)

**File:** `frontend/src/components/chat/MessageFeedback.tsx:72-75`, `frontend/src/components/settings/MemorySection.tsx:217`, `frontend/src/components/health/HealthDocumentRow.tsx:90`
**Issue:** All three use `"opacity-0 group-hover:opacity-100 transition-opacity"` (or equivalent) to reveal action controls (thumbs up/down, edit/delete memory, delete/re-ingest/move document) with no `group-focus-within:opacity-100` companion class. Unlike CR-01, these buttons *are* present in the DOM and reachable via Tab, so they are operable — but while focused via keyboard, the control (and the page's global `:focus-visible` outline living on it) is rendered at `opacity: 0`, i.e. **invisible**. A sighted keyboard-only user can Tab onto "Good response" / "Edit memory-key" / "Delete document" and get no visible indication where focus is, failing WCAG 2.1 SC 2.4.7 (Focus Visible, Level AA) even though the global focus ring exists in `index.css`. None of these three files' diffs for this phase touched this specific class list (confirmed via `git diff`) — this is a pre-existing gap the sweep did not close, in files the phase otherwise edited for accessibility (aria-labels, ref-based focus, etc.).
**Fix:** Add `group-focus-within:opacity-100` next to `group-hover:opacity-100` in all three locations, e.g. (`MessageFeedback.tsx:72-75`):
```tsx
const containerClass = cn(
  "flex items-center gap-1 mt-2",
  isRated ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity"
)
```
Confirm the ancestor row still carries the Tailwind `group` class (it does in all three cases via the existing hover-target row).

### WR-02: `aria-pressed` misapplied to a non-toggle "open document detail" button

**File:** `frontend/src/components/ingestion/DocumentList.tsx:385-407`
**Issue:** The filename-open button carries `aria-pressed={selectedDocId === doc.id}` (line 388). `aria-pressed` is the ARIA state for a two-state toggle button, and screen readers announce "pressed" / "not pressed" with the implication that activating the control again will toggle it off. But the `onClick` handler (`onClick={() => onSelect?.(doc.id)}`) always calls `onSelect`, which in every call site (`IngestionPage.tsx: onSelect={setSelectedDocId}`) unconditionally sets the selection — clicking an already-selected row's filename does not close the detail panel or clear the selection. A screen-reader user who activates an already-"pressed" button expecting it to un-press (per the ARIA authoring practices for toggle buttons) will find nothing changes, which misrepresents the control's actual behavior.
**Fix:** Either make the click handler a true toggle (close the panel when re-clicking the already-selected row) so `aria-pressed` is accurate, or drop `aria-pressed` in favor of a state indicator that doesn't imply toggle semantics, e.g. `aria-current="true"` (the same convention used elsewhere in this codebase for "the currently open/selected item in a list", such as `NavPanel.tsx`'s `aria-current={isControlRoom ? "page" : undefined}`):
```tsx
<button
  type="button"
  onClick={() => onSelect?.(doc.id)}
  aria-current={selectedDocId === doc.id ? "true" : undefined}
  className="..."
>
```

### WR-03: `InfoHint`'s "revealed on hover or keyboard focus" claim overstates native `title` behavior

**File:** `frontend/src/lib/PlainLabel.tsx:21-38`, `frontend/src/components/workflows/PhaseFormPanel.tsx:88-106`
**Issue:** Both files ship an identical `InfoHint` component: a `role="button" tabIndex={0}` span with only a native `title` attribute and an `aria-label` (no `onClick`, no popover). The code comment claims the guidance is "revealed on hover/focus via the native title." In the mainstream evergreen browsers (Chrome, Firefox, Edge) a bare `title` attribute's tooltip is triggered by mouse hover only — it is not shown when an element merely receives keyboard focus. Screen-reader users are unaffected (the `aria-label` supplies the accessible name and is announced on focus regardless of the visual tooltip), but a **sighted keyboard-only user** tabbing onto the ⓘ glyph gets no visible reveal of the helper text at all, despite the comment's claim and despite `role="button"`/`tabIndex={0}` signaling that the element is meant to do something on activation. This is a minor but real progressive-enhancement gap adjacent to WCAG SC 1.4.13 (Content on Hover or Focus) — content that appears on hover should also be dismissably/persistently available on focus.
**Fix:** Either drop the misleading half of the comment (the aria-label-only path is fine and intentional — say so honestly), or make the visual reveal actually work on focus, e.g. wrap with a small CSS-only popover keyed off `:focus-visible`/`:hover` instead of relying on the native tooltip:
```tsx
<span
  tabIndex={0}
  role="button"
  aria-label={text}
  className="group relative ml-1 inline-grid h-3.5 w-3.5 cursor-help place-items-center rounded-full border border-border text-[8px] text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
>
  ⓘ
  <span
    role="tooltip"
    className="pointer-events-none absolute bottom-full left-1/2 z-20 hidden -translate-x-1/2 whitespace-nowrap rounded bg-popover px-2 py-1 text-[10px] text-foreground shadow-md group-hover:block group-focus-visible:block"
  >
    {text}
  </span>
</span>
```
Low priority relative to CR-01/WR-01 since this only affects a single-glyph informational hint, not a primary action.

---

_Reviewed: 2026-07-16T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
