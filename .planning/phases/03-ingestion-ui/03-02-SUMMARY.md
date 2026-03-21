---
phase: 03-ingestion-ui
plan: "02"
subsystem: frontend-components
tags: [components, folder-tree, tdd, shadcn, tooltip, dialog, lucide]
dependency_graph:
  requires:
    - "Folder interface in types/index.ts (Plan 01)"
    - "buildFolderTree utility in lib/folderTree.ts (Plan 01)"
  provides:
    - "FolderNode component in components/ingestion/FolderNode.tsx"
    - "FolderCreateInput component in components/ingestion/FolderCreateInput.tsx"
    - "FolderTree component in components/ingestion/FolderTree.tsx"
    - "shadcn dialog and tooltip components"
    - "TooltipProvider in App root"
  affects:
    - "Plan 03 which wires FolderTree into IngestionPage two-panel layout"
tech_stack:
  added:
    - "@radix-ui/react-dialog (shadcn dialog)"
    - "@radix-ui/react-tooltip (shadcn tooltip)"
  patterns:
    - "TDD (RED-GREEN) for all new components"
    - "data-testid='globe-icon' for testable global folder distinction"
    - "TooltipProvider wrapped in test renders to satisfy Radix context requirement"
    - "Inline delete confirmation below node row (not modal dialog)"
    - "group/group-hover pattern for show-on-hover action buttons"
key_files:
  created:
    - frontend/src/components/ui/dialog.tsx
    - frontend/src/components/ui/tooltip.tsx
    - frontend/src/components/ingestion/FolderNode.tsx
    - frontend/src/components/ingestion/FolderCreateInput.tsx
    - frontend/src/components/ingestion/FolderTree.tsx
    - frontend/src/__tests__/components/FolderNode.test.tsx
    - frontend/src/__tests__/components/FolderTree.test.tsx
  modified:
    - frontend/src/App.tsx (added TooltipProvider wrapper)
    - frontend/.gitignore (excluded stray @ directory from shadcn CLI)
decisions:
  - "Tests wrap renders in TooltipProvider — Radix tooltip requires provider context even in test environments"
  - "data-testid='globe-icon' on Globe svg — enables deterministic test querying without brittle aria-label assumptions"
  - "shadcn CLI on Windows creates files in literal @/ directory — files manually copied to src/components/ui/, @/ added to .gitignore"
  - "FolderCreateInput uses local state for input value — no lifting needed, commits via callback"
  - "FolderNode inline rename input initialized from node.name via autoFocus — editValue state local to component"
metrics:
  duration: "6min 7sec"
  completed_date: "2026-03-21"
  tasks_completed: 2
  files_changed: 9
---

# Phase 03 Plan 02: Folder Tree UI Components Summary

**One-liner:** Three folder tree components (FolderNode with Globe/Folder icons + inline rename/delete, FolderCreateInput with keyboard handling, FolderTree with Root node + empty state + buildFolderTree integration) built TDD with 19 passing tests and shadcn dialog/tooltip installed.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Install shadcn dialog and tooltip, add TooltipProvider to App | ebad5c0 | ui/dialog.tsx, ui/tooltip.tsx, App.tsx |
| 2 | Create FolderNode, FolderCreateInput, FolderTree components with tests (TDD) | 9f2e451 | FolderNode.tsx, FolderCreateInput.tsx, FolderTree.tsx, FolderNode.test.tsx, FolderTree.test.tsx |

## Verification

All task-specific tests pass:
- `FolderNode.test.tsx`: 11 tests — name rendering, chevron presence/absence, Folder icon always, Globe icon conditionally (is_global), inline rename input/Enter/Escape, delete confirmation text, bg-accent selection highlight
- `FolderTree.test.tsx`: 8 tests — Root node, flat list rendering, empty state, Root bg-accent highlight, folder select callback, Root select null callback, Globe icon for global, no Globe for private-only tree
- TypeScript: `npx tsc --noEmit` exits 0

Pre-existing failures (3 tests in MessageItem and useDocuments — confirmed pre-existing from Plan 01) are out of scope.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] shadcn CLI creates files in wrong directory on Windows**
- **Found during:** Task 1
- **Issue:** `npx shadcn@latest add dialog --yes` on Windows created files at `frontend/@/components/ui/dialog.tsx` (literal `@` directory) instead of `frontend/src/components/ui/dialog.tsx`
- **Fix:** Read the shadcn-generated files and wrote them to the correct target path manually; added `@/` to `frontend/.gitignore` to exclude the stray directory from git tracking
- **Files modified:** frontend/src/components/ui/dialog.tsx (created), frontend/src/components/ui/tooltip.tsx (created), frontend/.gitignore (updated)
- **Commit:** ebad5c0

**2. [Rule 2 - Missing critical functionality] TooltipProvider required in test renders**
- **Found during:** Task 2 (GREEN phase — tests failing despite correct component implementation)
- **Issue:** Radix UI's `@radix-ui/react-tooltip` throws `Error: 'Tooltip' must be used within 'TooltipProvider'` in test environment because `App.tsx`'s `TooltipProvider` wrapper is not present in isolated component renders
- **Fix:** Added `renderWithTooltip()` helper wrapping renders in `<TooltipProvider>` in both test files; updated all test `render()` calls to use `renderWithTooltip()`
- **Files modified:** FolderNode.test.tsx, FolderTree.test.tsx
- **Commit:** 9f2e451 (included with component files)

## Known Stubs

None — all three components receive their data via props, have no hardcoded empty values flowing to UI rendering. Error handling uses `console.error` as specified by the plan (error toasts are out of scope for this phase per UI-SPEC).

## Self-Check: PASSED

- frontend/src/components/ui/dialog.tsx: FOUND
- frontend/src/components/ui/tooltip.tsx: FOUND
- frontend/src/components/ingestion/FolderNode.tsx: FOUND
- frontend/src/components/ingestion/FolderCreateInput.tsx: FOUND
- frontend/src/components/ingestion/FolderTree.tsx: FOUND
- frontend/src/__tests__/components/FolderNode.test.tsx: FOUND
- frontend/src/__tests__/components/FolderTree.test.tsx: FOUND
- commit ebad5c0: FOUND
- commit 7950197: FOUND (RED phase — failing tests)
- commit 9f2e451: FOUND (GREEN phase — components + passing tests)
