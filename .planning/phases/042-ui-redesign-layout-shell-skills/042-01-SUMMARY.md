---
phase: 042-ui-redesign-layout-shell-skills
plan: "01"
subsystem: frontend-layout
tags: [ui, layout, navigation, appdock, sidebar, react, tailwind]
dependency_graph:
  requires: []
  provides:
    - AppDock component (vertical icon rail)
    - Three-column layout shell (AppDock | Sidebar | Main)
  affects:
    - frontend/src/components/layout/ChatLayout.tsx
    - frontend/src/components/layout/Sidebar.tsx
tech_stack:
  added: []
  patterns:
    - gradient-primary pill for active nav icon
    - shadcn Tooltip with side=right for icon-only rail
    - aria-current="page" for active nav accessibility
key_files:
  created:
    - frontend/src/components/layout/AppDock.tsx
  modified:
    - frontend/src/components/layout/ChatLayout.tsx
    - frontend/src/components/layout/Sidebar.tsx
decisions:
  - AppDock uses w-14 (56px) rail width — balanced with w-64 Sidebar, gives 20px padding each side of 16px icon
  - Active state: entire button content replaced with gradient-primary pill div; button itself has no background to avoid double-background
  - cn import retained in Sidebar — still used for thread row conditional className (isSelected logic)
  - New Chat button onNavigate("chat") call removed — navigation is now entirely in AppDock; Sidebar only manages thread state
metrics:
  duration: "~15 minutes"
  completed: "2026-04-19"
  tasks_completed: 2
  tasks_total: 3
  files_changed: 3
---

# Phase 42 Plan 01: AppDock Layout Shell Summary

AppDock vertical icon rail extracted from Sidebar into a standalone component, wired as the new leftmost column of the three-column layout shell (AppDock w-14 | Sidebar w-64 | Main flex-1).

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create AppDock.tsx vertical icon rail | 46a868e | frontend/src/components/layout/AppDock.tsx (created) |
| 2 | Wire AppDock into ChatLayout + Sidebar surgery | 2ad2dff | ChatLayout.tsx, Sidebar.tsx (modified) |

## What Was Built

**AppDock.tsx** — New standalone component. Renders a `w-14 bg-sidebar` vertical rail with:
- Five nav items (Chat, Documents, Library Health, Skills, Settings) in a top flex cluster
- Sign Out pinned at the bottom
- Active icon: `gradient-primary` pill div (w-10 h-10 rounded-xl) wrapping a white icon
- Inactive icons: `text-muted-foreground` with `hover:text-sidebar-foreground hover:bg-accent/40`
- shadcn `<Tooltip side="right">` on every button
- `aria-label` on all buttons, `aria-current="page"` on the active button

**ChatLayout.tsx** — Added `import { AppDock }` and rendered `<AppDock activeView onNavigate onSignOut />` as the first child of the root flex container, before `<Sidebar>`. Removed `onSignOut`, `activeView`, and `onNavigate` from the `<Sidebar>` JSX call.

**Sidebar.tsx** — Surgical nav removal:
- Props interface: removed `onSignOut`, `activeView`, `onNavigate`
- Destructure: removed those three params
- Removed the entire "Fixed Area — Knowledge Base + Footer" block (Documents, Library Health, Skills, Settings nav buttons + Sign Out button)
- Retained theme toggle in a minimal `border-t` footer div
- Fixed `isSelected` to use `selectedThread?.id === thread.id` (removed `activeView === "chat"` guard — navigation concern now belongs to AppDock)
- Removed `onNavigate("chat")` calls from New Chat button and thread click handler
- Cleaned unused imports: `LogOut`, `FileText`, `Settings`, `Zap`, `Activity`, `ActiveView`

## Verification Results

- `npx tsc --noEmit` exits 0 (no TypeScript errors)
- `grep onNavigate frontend/src/components/layout/Sidebar.tsx` returns no matches
- `grep AppDock frontend/src/components/layout/ChatLayout.tsx` returns matches on import and JSX lines
- `grep gradient-primary frontend/src/components/layout/AppDock.tsx` returns match on active pill div
- `grep "Knowledge Base" frontend/src/components/layout/Sidebar.tsx` returns no matches

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. All six nav targets are wired to real `onNavigate` / `onSignOut` callbacks passed from `App.tsx` via `ChatLayout`.

## Threat Flags

None. No new network endpoints, auth paths, or trust boundaries introduced. AppDock Sign Out delegates to the existing `onSignOut` prop (T-042-01 accepted in plan threat model).

## Checkpoint Status

Task 3 is a `checkpoint:human-verify` gate — execution paused awaiting visual verification at http://localhost:5173.

## Self-Check: PASSED

- frontend/src/components/layout/AppDock.tsx: FOUND
- frontend/src/components/layout/ChatLayout.tsx: modified (AppDock import + JSX confirmed)
- frontend/src/components/layout/Sidebar.tsx: modified (nav section removed confirmed)
- Commit 46a868e: FOUND
- Commit 2ad2dff: FOUND
