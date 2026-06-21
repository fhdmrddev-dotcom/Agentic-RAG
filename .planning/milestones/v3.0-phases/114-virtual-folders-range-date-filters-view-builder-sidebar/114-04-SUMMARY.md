---
phase: 114-virtual-folders-range-date-filters-view-builder-sidebar
plan: 04
subsystem: frontend-documents-sidebar
tags: [virtual-folders, navrow, folder-tree, sidebar, move-to-folder, ui-refactor]
dependency_graph:
  requires:
    - "Phase 112 MoveToFolderDialog + PATCH /documents/{id}/move (Health page, owner-scoped)"
    - "FolderNode/FolderTree existing folder CRUD + selection contract"
  provides:
    - "frontend/src/components/ingestion/NavRow.tsx — shared sidebar-row primitive (Plan 06 builds the Views group from it)"
    - "Per-folder document count badges in the Folders tree"
    - "Move-to-folder document-row action on the Documents page"
  affects:
    - "frontend/src/components/ingestion/FolderNode.tsx"
    - "frontend/src/components/ingestion/FolderTree.tsx"
    - "frontend/src/components/ingestion/DocumentList.tsx"
    - "frontend/src/pages/IngestionPage.tsx"
tech_stack:
  added: []
  patterns:
    - "Pure presentational row primitive with prop slots (icon/name/count/G-pill/actions/leading)"
    - "Reachable hover menu: opacity-25 at rest + group-hover/focus-within reveal (never opacity-0-only)"
    - "Single soft indent guide + ~3-level indent cap (replaces dense hand-drawn branch lines)"
    - "Dialog-reuse row action keyed to the active row (MoveToFolderDialog, zero net-new backend)"
key_files:
  created:
    - "frontend/src/components/ingestion/NavRow.tsx"
    - "frontend/src/__tests__/components/NavRow.test.tsx"
    - "frontend/src/__tests__/components/DocumentList.test.tsx"
  modified:
    - "frontend/src/components/ingestion/FolderNode.tsx"
    - "frontend/src/components/ingestion/FolderTree.tsx"
    - "frontend/src/components/ingestion/DocumentList.tsx"
    - "frontend/src/pages/IngestionPage.tsx"
    - "frontend/src/__tests__/components/FolderNode.test.tsx"
    - "frontend/src/__tests__/components/FolderTree.test.tsx"
decisions:
  - "D-114-13: extract ONE NavRow, build Folders (and later Views) from it; fix the verified tree debt while extracting"
  - "D-114-14: strike drag-drop (none exists); add a Move-to-folder row action reusing MoveToFolderDialog"
  - "Per-folder counts sourced from the documents the page already holds (no per-folder resolve call) — graceful 0 when absent"
metrics:
  duration: "~25 min"
  completed: "2026-06-19"
  tasks: 3
  files_created: 3
  files_modified: 6
requirements: [VIEW-03, UX-01]
---

# Phase 114 Plan 04: Shared NavRow + Folder-tree Debt Fix + Move-to-folder Summary

Extracted one shared `NavRow` sidebar-row primitive from the flawed `FolderNode`, refactored Folders onto it (fixing the verified tree debt: per-row counts, a tooltip-labeled `G` pill, keyboard/touch-reachable actions, a single soft indent guide + ~3-level cap), and added a Move-to-folder document-row action reusing the existing `MoveToFolderDialog` — so Plan 06 can build the Views group from the FIXED row, never a clone of the flawed one (D-114-13/14).

## What Was Built

### Task 1 — `NavRow` shared primitive (commit `8a388653`)
- `frontend/src/components/ingestion/NavRow.tsx` (190 lines): a pure presentational row with prop slots — `icon` (+ `iconClassName`, amber folder by default; Views will pass a funnel), `name` (with inline-rename: Enter saves / Esc cancels / blur commits), `count` (rendered on **every** row), `isSelected` styling (`bg-primary/10` vs `hover:bg-accent/60`), an optional tooltip-labeled `isGlobal` G pill ("Global — shared with everyone"), a `leading` slot (chevron for folders), and an `actions` slot.
- Debt fixed while extracting: the action wrapper is `opacity-25` at rest + revealed on `group-hover`/`focus-within` (keyboard/touch-reachable — never `opacity-0`-only); a single soft indent guide replaces the dense hand-drawn branch lines; `NAVROW_INDENT_CAP = 3` caps meaningful indent (deeper nesting leans on `FolderBreadcrumb`).
- No recursion, no folder/view CRUD in the primitive (pure row).
- `NavRow.test.tsx`: 12 vitest cases — icon/name/count render, count=0 renders, selected styling, onSelect, inline-rename Enter/Esc, G-pill tooltip (data-state + cursor-help + hover-reveals-label), no-G-pill, reachable action trigger (present + focusable + not `opacity-0`), leading slot.

### Task 2 — Folders refactored onto NavRow + per-folder counts (commit `9766eac7`)
- `FolderNode.tsx`: the row body now delegates to `NavRow` (chevron → `leading`, New-subfolder + Rename/Make-global/Delete → `actions`, per-folder count → `count`). Recursion (children map), inline delete-confirm, and the subfolder-create input all stay in `FolderNode`. The old dense branch-line divs are removed.
- `FolderTree.tsx`: the Root node renders through `NavRow` too (one shared row). New optional `folderDocumentCounts?: Record<string, number>` prop threaded to every `FolderNode`.
- `IngestionPage.tsx`: a `folderDocumentCounts` memo built from the `documents` the page already holds (no per-folder resolve — would degrade at ~10k docs), passed to `FolderTree`.
- Existing folder tests green post-refactor (no regression); added per-folder count + recursion coverage; `defaultProps` made type-complete (`currentUserId`/`onToggleGlobal`).

### Task 3 — Move-to-folder document-row action (commit `5e9707ba`)
- `DocumentList.tsx`: a `moveTarget` state keyed to the active row's document, a `FolderInput` trigger (tooltip "Move to folder") in the existing action cluster, and a single `MoveToFolderDialog` mounted with the row's `id`/`filename`. `onMoved` closes the dialog and calls `onRefresh()` so the moved doc drops out of the current folder view. Reuses `PATCH /documents/{id}/move` — zero net-new backend. No drag-drop built (D-114-14).
- Existing row-click → detail-panel (`onSelect`) behavior preserved.
- `DocumentList.test.tsx` (new): trigger renders with the labeled tooltip, click opens the dialog, `onSelect` still fires, no `draggable` handlers introduced.

## Verification

- `cd frontend && npx vitest run NavRow FolderNode FolderTree DocumentList` → **5 files / 47 tests GREEN** (NavRow 12, FolderNode 14, FolderTree 10, DocumentList 4, IngestionPage 7 of the matched IngestionPage substring set; the IngestionPage pre-existing failure is documented below).
- `cd frontend && npx tsc --noEmit` → **no type errors in any plan-touched file** (NavRow/FolderNode/FolderTree/DocumentList/IngestionPage).
- `cd frontend && npx vite build` → **bundler build succeeds** (`✓ built` — all modules compile + bundle).
- Acceptance greps: `grep -c NavRow FolderNode.tsx` = 3 (delegates); old branch-line divs = 0; `grep -c MoveToFolderDialog DocumentList.tsx` = 3 (reused); `grep -c 'onDrop|onDragStart' DocumentList.tsx` = 0 (no drag-drop).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test contract] G-pill / tooltip label assertions adjusted for Radix lazy rendering**
- **Found during:** Task 1 (NavRow test) and Task 3 (DocumentList test).
- **Issue:** Radix `TooltipContent` is NOT rendered into the DOM at rest (only on hover/focus). Initial assertions used `getByText("<label>")` eagerly, which failed.
- **Fix:** Assert the labeled affordance via the trigger's `data-state` + `cursor-help` (G pill) and find the move trigger by its `svg.lucide-folder-input` icon; assert the label text appears on hover via `findAllByText`. This tests the real "no longer opaque / reachable" contract correctly.
- **Files modified:** `NavRow.test.tsx`, `DocumentList.test.tsx` (test-only; component behavior unchanged).
- **Commits:** `8a388653`, `5e9707ba`.

**2. [Rule 3 - Type completeness] Existing folder-test defaultProps made type-complete**
- **Found during:** Task 2.
- **Issue:** The pre-existing `FolderNode.test.tsx` / `FolderTree.test.tsx` `defaultProps` omitted `currentUserId` and `onToggleGlobal` (runtime-tolerated but type-incomplete).
- **Fix:** Added the missing props so the test files type-check cleanly and exercise the refactored component contract.
- **Files modified:** `FolderNode.test.tsx`, `FolderTree.test.tsx`.
- **Commit:** `9766eac7`.

## Deferred Issues (out of scope — pre-existing, NOT introduced by this plan)

Logged to `deferred-items.md` in this phase directory:
- `npm run build`'s `tsc -b` step fails on PRE-EXISTING type errors in unrelated files (`SkillFormDialog.tsx`, `api.test.ts`, `SettingsPage.tsx`, `StreamsProvider.tsx`, `streamsStore.ts`). Verified present at base commit `1c0caf55` (parent of this plan's first commit). The `vite build` bundler step succeeds; plan verification relies on `npx tsc --noEmit` (clean for touched files) + `vitest`.
- Full-suite `vitest run` shows 8 pre-existing failing files in the streaming/chat/model domain (StreamsProvider*, useMessages, MessageItem, Plan04.frontend [075.1], model-info) + the `IngestionPage > renders two-panel layout` test (`getByText("Folders")` matches multiple — the FolderTree header renders in both the desktop sidebar AND the mobile Sheet). The IngestionPage failure was reproduced against BASE source (1 failed / 3 passed identically), confirming it is pre-existing and NOT a Plan-04 regression. None of these touch this plan's domain.

## Known Stubs

None. The Views group itself is intentionally NOT built here — it is Plan 06's scope, and will be built from the `NavRow` primitive this plan ships (D-114-13). `NavRow` is fully functional and consumed by the Folders tree today.

## Self-Check: PASSED

- Files: all 3 created + all modified files present (FOUND).
- Commits: `8a388653`, `9766eac7`, `5e9707ba` all present in git log (FOUND).
