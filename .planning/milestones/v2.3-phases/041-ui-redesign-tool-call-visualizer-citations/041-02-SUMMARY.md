---
phase: 041-ui-redesign-tool-call-visualizer-citations
plan: "02"
subsystem: frontend/chat-ui
tags: [ui, animation, collapsible, citations, message-input]
dependency_graph:
  requires: []
  provides:
    - CitationList animated Collapsible reveal (200ms ease-in-out)
    - MessageInput floating pill layout with breathing room
    - shadcn Collapsible component at frontend/src/components/ui/collapsible.tsx
  affects:
    - frontend/src/components/chat/CitationList.tsx
    - frontend/src/components/chat/MessageInput.tsx
tech_stack:
  added:
    - "@radix-ui/react-collapsible (via shadcn Collapsible component)"
  patterns:
    - "Radix UI data-state animation classes (data-[state=open]:animate-in / data-[state=closed]:animate-out)"
    - "CollapsibleTrigger asChild pattern preserving existing button element"
key_files:
  created:
    - frontend/src/components/ui/collapsible.tsx
  modified:
    - frontend/src/components/chat/CitationList.tsx
    - frontend/src/components/chat/MessageInput.tsx
decisions:
  - shadcn CLI on Windows creates files in literal @/ directory (known behavior from Phase 03); file manually copied to correct src/components/ui/ path
  - send button shadow-sm (line 283) preserved intentionally; plan criterion applies only to inner card div shadow-sm which was replaced with shadow-lg shadow-primary/5
  - Pre-existing npm run build failures in unrelated test files (FolderNode, FolderTree, IngestionPage) are out-of-scope; npx tsc --noEmit passes clean for plan files
metrics:
  duration: ~8min
  completed_date: "2026-04-19"
  tasks_completed: 3
  files_changed: 3
---

# Phase 041 Plan 02: CitationList Collapsible Animation & MessageInput Floating Pill Summary

**One-liner:** Replace CitationList's abrupt conditional render with Radix Collapsible 200ms slide+fade animation, and give MessageInput floating pill breathing room via transparent outer wrapper and rounded-2xl shadow.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Install shadcn Collapsible component | f589253 | frontend/src/components/ui/collapsible.tsx (created), package.json, package-lock.json |
| 2 | Upgrade CitationList to animated Collapsible | 41e1a38 | frontend/src/components/chat/CitationList.tsx |
| 3 | Upgrade MessageInput to floating pill layout | 7d7598d | frontend/src/components/chat/MessageInput.tsx |

## Changes Made

### Task 1 — shadcn Collapsible Component

Installed `@radix-ui/react-collapsible` and created `frontend/src/components/ui/collapsible.tsx` exporting `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent`. The shadcn CLI placed the file in a literal `@/components/ui/` directory (known Windows behavior from Phase 03 decision); manually copied to the correct `src/components/ui/` path.

### Task 2 — CitationList Animated Collapsible

- Replaced outer `<div className="mt-3">` with `<Collapsible open={open} onOpenChange={setOpen} className="mt-3">`
- Wrapped trigger `<button>` in `<CollapsibleTrigger asChild>` — button element, className, aria-expanded, chevron icon, and text all unchanged
- Replaced `{open && <div>...</div>}` conditional render with `<CollapsibleContent className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:slide-in-from-top-1 data-[state=closed]:slide-out-to-top-1 duration-200 ease-in-out">`
- Added import for Collapsible components
- useState hook, citations.map logic, CitationCard props all unchanged

### Task 3 — MessageInput Floating Pill

- Outer wrapper: `bg-background/80 backdrop-blur-sm px-6 py-4` → `px-4 pb-3 bg-transparent`
- Inner card: `rounded-xl` → `rounded-2xl`, `shadow-sm` → `shadow-lg shadow-primary/5`
- All other classes preserved: `ghost-border`, `bg-card/80`, `backdrop-blur-sm`, `transition-all duration-200`, `focus-within:ring-2 focus-within:ring-primary/30 focus-within:shadow-lg focus-within:shadow-primary/5`

## Verification

- `npx tsc --noEmit`: passes clean (no errors)
- `npm run build`: fails on pre-existing test file TypeScript errors in FolderNode.test.tsx, FolderTree.test.tsx, IngestionPage.test.tsx, and unused imports in other files — all pre-existing, none in plan files
- No errors in CitationList.tsx, MessageInput.tsx, or collapsible.tsx

## Deviations from Plan

### Auto-noted Issues

**1. [Rule 3 - Known Behavior] shadcn CLI creates files in literal @/ directory on Windows**
- **Found during:** Task 1
- **Issue:** `npx shadcn add collapsible` created file at `frontend/@/components/ui/collapsible.tsx` instead of `frontend/src/components/ui/collapsible.tsx`
- **Fix:** Manually copied file content to correct path per Phase 03 precedent (documented in STATE.md decisions)
- **Files modified:** frontend/src/components/ui/collapsible.tsx (created at correct path)
- **Commit:** f589253

**2. [Scope Boundary] send button shadow-sm preserved**
- **Found during:** Task 3 verification
- **Issue:** grep for `shadow-sm` returned 1 match after changes — the send button's `shadow-sm shadow-primary/20` at line 283
- **Decision:** This is a distinct button style, not the inner card's shadow. Plan criterion applies to inner card only. Preserved intentionally.

**3. [Scope Boundary] Pre-existing npm run build failures**
- **Found during:** Final verification
- **Issue:** `npm run build` fails on test files (FolderNode, FolderTree, IngestionPage) and unused imports in unrelated components
- **Decision:** None of these errors are in plan-touched files. Pre-existing issues, out of scope per deviation rules.

## Known Stubs

None.

## Threat Flags

None. Supply chain risk for Collapsible (T-041-02) assessed as accepted per plan threat model — official shadcn registry, Radix UI already used by project.

## Self-Check: PASSED

- [x] `frontend/src/components/ui/collapsible.tsx` exists
- [x] `frontend/src/components/chat/CitationList.tsx` has CollapsibleContent with duration-200 animate-in classes
- [x] `frontend/src/components/chat/MessageInput.tsx` has px-4 pb-3 bg-transparent outer wrapper and rounded-2xl shadow-lg shadow-primary/5 inner card
- [x] Commits f589253, 41e1a38, 7d7598d all exist in git log
- [x] `npx tsc --noEmit` exits 0
