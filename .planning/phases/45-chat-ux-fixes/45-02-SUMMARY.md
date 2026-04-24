---
phase: 45-chat-ux-fixes
plan: 02
subsystem: frontend
tags: [chat, ux, folder-selector, new-chat, sidebar, mobile]
dependency_graph:
  requires: ["45-chat-ux-fixes-01"]
  provides: ["CHAT-03"]
  affects: ["NavPanel", "ChatLayout"]
tech_stack:
  added: []
  patterns: ["Folder-scoped thread creation from sidebar", "Conditional folder picker toggle in NavPanel"]
key_files:
  created: []
  modified:
    - frontend/src/components/layout/NavPanel.tsx
    - frontend/src/components/layout/ChatLayout.tsx
decisions:
  - NavPanel folder picker uses a toggle button (FolderIcon) rather than always-visible dropdown — keeps sidebar clean when no folders exist or picker not needed
  - Mobile drawer uses inline select below New Chat button rather than toggle pattern — simpler UX on mobile with fewer interactions needed
  - selectedFolderId persists across thread creations until user explicitly changes it or reset on mobile after creation
  - Collapsed sidebar: folder picker inaccessible via existing opacity-0 pointer-events-none pattern — no special handling needed
metrics:
  duration: 290s
  completed: "2026-04-23"
---

# Phase 45 Plan 02: Folder Selector on New Chat Summary

Folder-scoped thread creation from sidebar and mobile drawer, enabling CHAT-03 requirement.

## What Changed

### Task 1: Add folder selector to NavPanel new chat creation

**NavPanel.tsx:**
- Updated Props interface: `onNewThread` signature changed from `() => void` to `(folderId?: string | null) => void`
- Added `folders: Folder[]` prop and `Folder` type import
- Added `showFolderPicker` and `selectedFolderId` state variables
- Replaced single "New Chat" Plus button with a two-part UI: Plus button (creates thread) + Folder icon toggle button (opens folder picker)
- Added conditional folder picker dropdown: `<select>` element with folder list, shown when `showFolderPicker` is true and `folders.length > 0`
- New Chat button calls `onNewThread(selectedFolderId)` and closes folder picker
- Folder icon button uses `cn()` for conditional active styling (bg-accent when picker is open)
- Styled with `ghost-border`, `bg-card`, `text-xs`, `rounded-lg` matching existing Deep Midnight design system

**ChatLayout.tsx:**
- Added `folders={folders}` prop to NavPanel component (folders already available from `useFolders()` hook)
- Added `mobileFolderId` state and `setMobileFolderId` setter for mobile drawer folder selection
- Mobile "New Chat" button now calls `newThread(mobileFolderId)` and resets `mobileFolderId` to null after creation
- Added conditional `<select>` below mobile "New Chat" button for folder scoping, shown when `folders.length > 0`
- Mobile folder selector uses same styling as sidebar: `ghost-border`, `bg-card`, `text-xs`, `rounded-lg`

**useThreads.ts:** No changes needed — `newThread(folderId?: string | null)` already accepts the folderId parameter and passes it to `createThread("New Chat", folderId)`.

**ChatArea.tsx:** No changes — existing welcome-state folder selector continues to work unchanged with `scopeFolderId` and `onCreateThread(folderId)`.

## Requirements Validated

| Requirement | Status | Evidence |
|------------|--------|---------|
| CHAT-03 | ✅ | NavPanel and mobile drawer both present folder selector; selecting a folder scopes thread creation via `onNewThread(folderId)` → `createThread("New Chat", folderId)` → backend `POST /threads` with `folder_id` |

## Deviations from Plan

None — plan executed exactly as written.

## Threat Flags

No new threat surface introduced. NavPanel folder list respects RLS (via useFolders which queries user-owned + global folders). Backend POST /threads already validates folder_id belongs to user via RLS (T-45-04 accepted). Folder listing in NavPanel shows same folders as existing welcome-state selector (T-45-05 accepted).

## Known Stubs

None.

## Commits

| Commit | Message |
|--------|---------|
| `9f220b3` | feat(45-02): add folder selector to new chat creation in sidebar and mobile drawer |

## Self-Check

- [x] `frontend/src/components/layout/NavPanel.tsx` contains `showFolderPicker`, `selectedFolderId`, `folders` prop, and `FolderIcon` folder toggle button
- [x] `frontend/src/components/layout/ChatLayout.tsx` contains `mobileFolderId` state, `folders={folders}` prop on NavPanel, and mobile folder `<select>`
- [x] `frontend/src/hooks/useThreads.ts` unchanged (already accepts folderId)
- [x] TypeScript compilation passes (`npx tsc --noEmit` — no errors)
- [x] Commit `9f220b3` exists
- [x] No files accidentally deleted in commit

## Self-Check: PASSED