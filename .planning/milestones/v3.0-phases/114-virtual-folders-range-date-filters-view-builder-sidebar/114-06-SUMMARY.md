---
phase: 114-virtual-folders-range-date-filters-view-builder-sidebar
plan: 06
subsystem: frontend / saved-Views sidebar + Documents-page composition
tags: [VIEW-03, UX-01, views-sidebar, NavRow, filter-bar-mount, panel-rail-collapse, column-shedding, edit-on-save, G-4-UAT]

# Dependency graph
requires:
  - phase: 114-04
    provides: "The shared NavRow primitive — ViewsGroup renders saved views through it (funnel icon + count badge + actions)"
  - phase: 114-05
    provides: "FilterBar (value/onChange/onActiveFilter/onViewSaved) + ConditionPopover + RelativeDateControl + api.ts view CRUD/count"
  - phase: 112
    provides: "DocumentDetailPanel right-side push/split shell — the shared shell whose open-state drives the sidebar→rail collapse (D-114-17)"
provides:
  - "frontend/src/components/ingestion/ViewsGroup.tsx — the distinct 'Views' sidebar group built from the shared NavRow (funnel icon + lazy/cached count badge + Edit filter/Rename/Delete)"
  - "frontend/src/pages/IngestionPage.tsx — FilterBar mounted on the Documents page; view-selection loads filter_expr back into the bar; Views group refreshes on save; sidebar collapses to a ~50px icon rail + FilterBar→summary-chip + DocumentList column-shedding when the Phase-112 detail panel opens (D-114-17)"
  - "frontend/src/lib/api.ts — updateView(id, body) → PATCH /document-views/{id} (the edit-on-save PATCH path, D-114-3)"
  - "edit-on-save: ViewsGroup Edit → filter loads back → FilterBar shows 'Update view' → save PATCHes the same view (one row, not a clone)"
affects:
  - "Phase 117 (relationships) + Phase 118 (classification) — inherit the same DocumentDetailPanel push/split shell + sidebar-rail collapse contract proven here"

# Tech tracking
tech-stack:
  added: []  # zero new packages
  patterns:
    - "Saved views render through the SAME shared NavRow as folders (D-114-13) — a view reads as a saved filter (funnel icon, 'Documents matching this saved filter'), never a droppable folder"
    - "Detail-panel-open drives a coordinated collapse: left sidebar → ~50px rail (sessionStorage-pinnable), FilterBar → '1 filter' summary chip, DocumentList sheds Type/Size/Chunks columns — the shared shell 117/118 inherit (D-114-17)"
    - "Edit-on-save is mode-aware: editingView set → updateView PATCH; unset → createView POST (D-114-3)"

key-files:
  created:
    - "frontend/src/components/ingestion/ViewsGroup.tsx"
    - "frontend/src/components/ingestion/ViewsGroup.test.tsx"
  modified:
    - "frontend/src/pages/IngestionPage.tsx"
    - "frontend/src/lib/api.ts (updateView added — edit-on-save fix)"
    - "frontend/src/components/ingestion/FilterBar.tsx (editingView prop — edit-on-save fix)"
    - "frontend/src/components/ingestion/FilterBar.test.tsx (edit→PATCH test — edit-on-save fix)"

key-decisions:
  - "D-114-17 honored: detail-panel-open collapses the left sidebar to a rail + FilterBar to a summary chip + sheds DocumentList columns; reverses cleanly on close"
  - "Edit-on-save gap (D-114-3) closed at the checkpoint via a small additive fix touching FilterBar.tsx + api.ts (files outside the 3-file plan scope) — operator-authorized"
  - "Delete uses an inline confirm ('Your documents are not affected — only this saved filter is removed') — honest, no data-loss ambiguity"

patterns-established:
  - "ViewsGroup is a thin NavRow consumer — no row-shape divergence from FolderTree (the D-114-13 build-from-the-fixed-row mandate)"

requirements-completed: [VIEW-03]

# Metrics
duration: ~50min (Tasks 1-2 build + edit-on-save fix + orchestrator-driven G-4 UAT)
completed: 2026-06-19
---

# Phase 114 / Plan 06: Views Sidebar Group + Documents-Page Composition Summary

**Saved views render in a distinct NavRow-built "Views" group with a count badge + Edit/Rename/Delete; the FilterBar is mounted on the Documents page with view↔filter round-tripping; opening the Phase-112 detail panel collapses the sidebar to a ~50px rail + FilterBar to a summary chip + sheds the document table's Type/Size/Chunks columns (D-114-17). The edit-on-save gap (D-114-3) was closed and the G-4 lived-experience UAT was driven live and PASSED.**

## Performance
- **Tasks:** 3/3 (Tasks 1-2 build; Task 3 = the G-4 lived-experience UAT, driven via Chrome MCP by the orchestrator and PASSED)
- **Completed:** 2026-06-19
- **Files modified:** 6 (2 created, 4 modified incl. the edit-on-save fix)

## Accomplishments
- **ViewsGroup** — the "Views" sidebar group built from the shared Plan-04 NavRow: funnel icon, lazy/cached count badge, and an Actions menu (Edit filter / Rename / Delete). A view reads as a saved filter, not a folder.
- **IngestionPage wiring** — FilterBar mounted on the Documents page; selecting a view loads its `filter_expr` back into the bar and resolves its contents; the Views group refreshes on save; the sidebar collapses to a ~50px rail (with FilterBar → "1 filter" summary chip and DocumentList column-shedding) when the Phase-112 detail panel opens, and reverses on close (D-114-17 shared shell).
- **Edit-on-save PATCH (D-114-3)** — `updateView` added to api.ts; FilterBar is now edit-aware ("Update view" PATCHes the same view instead of POSTing a clone). Verified live: editing "Reports" from `document_type=report` (11) → `meeting notes` (3) left exactly ONE view in the DB with the updated filter.

## Task Commits
1. **Task 1: ViewsGroup from the shared NavRow** — `ebc3e6a9` (feat)
2. **Task 2: Wire IngestionPage (FilterBar mount + Views group + sidebar→rail + column-shed)** — `76a62a2c` (feat)
3. **Edit-on-save gap fix (D-114-3, checkpoint-authorized)** — `2b3ebe0e` (fix)
4. **Task 3: G-4 lived-experience Chrome-MCP UAT** — driven by the orchestrator, PASSED (see `114-HUMAN-UAT.md`)

## Files Created/Modified
- `frontend/src/components/ingestion/ViewsGroup.tsx` - Views sidebar group (NavRow consumer)
- `frontend/src/components/ingestion/ViewsGroup.test.tsx` - 10 vitest cases
- `frontend/src/pages/IngestionPage.tsx` - FilterBar mount, view↔filter round-trip, sidebar-rail collapse, column-shedding, editingView state
- `frontend/src/lib/api.ts` - `updateView` PATCH (edit-on-save)
- `frontend/src/components/ingestion/FilterBar.tsx` - `editingView` prop → PATCH-aware save
- `frontend/src/components/ingestion/FilterBar.test.tsx` - edit→PATCH test

## Decisions Made
- Closed the D-114-3 edit-on-save gap at the checkpoint rather than deferring (operator-authorized) — the locked decision with a clean ~2-file additive fix.
- Left the inline `renameViewRequest` PATCH as-is (already works); did not over-consolidate it into api.ts.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking, scope-bounded] Inline rename PATCH in IngestionPage instead of an api.ts helper (Task 2)**
- **Issue:** `PATCH /document-views/{id}` exists but no client helper, and api.ts was outside the 3-file plan scope.
- **Fix:** Minimal authed PATCH (`renameViewRequest`) inside IngestionPage reusing the shared session.
- **Committed in:** `76a62a2c`

**2. [Checkpoint gap, operator-authorized] Edit-on-save PATCH wiring (D-114-3)**
- **Issue:** The plans' file-scoping left edit-on-save half-wired — Edit loaded the filter back but FilterBar.handleSave always POSTed, so a save after Edit created a new view (UAT step 4 would surface this).
- **Fix:** Added `updateView` to api.ts + an `editingView` prop on FilterBar; save PATCHes the same view in edit mode. Verified live (one view, updated filter).
- **Committed in:** `2b3ebe0e`

**3. [Cosmetic edge] Column-shedding via Tailwind arbitrary descendant variant**
- DocumentList is out of scope, so column-shedding is applied from IngestionPage via a scoped nth-child variant; rare combined-state caveat (expanded VersionHistoryPanel + open detail panel). Cosmetic only.

---

**Total deviations:** 3 (1 in-scope auto-fix, 1 operator-authorized checkpoint gap fix, 1 cosmetic edge)
**Impact on plan:** All necessary; the edit-on-save fix closed a locked-decision (D-114-3) gap. No scope creep beyond the authorized fix.

## Issues Encountered
- **Minor (P3, non-blocking): Views count badge refresh lags one render after an in-place Update.** After editing a view's filter via "Update view", the sidebar count badge briefly showed the pre-edit cached value, then refreshed to the correct value on the next re-render (verified: badge corrected to "3" after the panel closed). The list and DB were always correct. Suggested follow-up: invalidate the cached badge in the onViewSaved refresh path so it updates immediately.
- **Pre-existing (out of scope): radix `DialogContent` missing a `DialogTitle` a11y warning (×2)** — NOT from any Phase-114 component (FilterBar/ConditionPopover/RelativeDateControl/ViewsGroup/NavRow use no radix Dialog; DocumentList's two dialogs and the reused health/MoveToFolderDialog all have DialogTitles). App-wide pre-existing; logged for a separate a11y sweep.

## G-4 Lived-Experience UAT (Task 3) — driven via Chrome MCP, PASSED
See `114-HUMAN-UAT.md` for the full scenario-by-scenario record. All core scenarios (1-6) verified live against the running app on the real ~33-doc corpus + live migration-074 typed columns; no console errors from 114 components.

## Next Phase Readiness
- VIEW-03 surfaces complete and live-verified. The DocumentDetailPanel push/split shell + sidebar-rail collapse contract is proven and ready for Phase 117 (relationships) / 118 (classification) to inhabit.
- Open follow-ups (non-blocking): the P3 badge-refresh lag; the pre-existing DialogTitle a11y warning; optional G-pill-on-global-view + pin-persist-across-reload visual confirmation (not separately exercised this pass — no global view seeded).

---
*Phase: 114-virtual-folders-range-date-filters-view-builder-sidebar*
*Completed: 2026-06-19*
