---
phase: 03-ingestion-ui
plan: "01"
subsystem: frontend-data-layer
tags: [types, api, hooks, realtime, tdd, folder-tree]
dependency_graph:
  requires: []
  provides:
    - "Folder interface in types/index.ts"
    - "Document.folder_id field"
    - "listFolders, createFolder, renameFolder, deleteFolder in api.ts"
    - "uploadDocument with optional folderId"
    - "buildFolderTree utility in lib/folderTree.ts"
    - "useFolders hook with Realtime subscription"
  affects:
    - "frontend/src/hooks/useDocuments.ts (uploadDocument call signature expanded)"
    - "Plans 02 and 03 which depend on these types and hooks"
tech_stack:
  added: []
  patterns:
    - "TDD (RED-GREEN) for all new code"
    - "useFolders mirrors useDocuments Realtime subscription pattern"
    - "buildFolderTree uses Map deduplication + adjacency list tree building"
    - "Optimistic updates on createFolder/renameFolder/deleteFolder"
key_files:
  created:
    - frontend/src/lib/folderTree.ts
    - frontend/src/hooks/useFolders.ts
    - frontend/src/__tests__/lib/buildFolderTree.test.ts
    - frontend/src/__tests__/hooks/useFolders.test.ts
  modified:
    - frontend/src/types/index.ts
    - frontend/src/lib/api.ts
    - frontend/src/__tests__/lib/api.test.ts
decisions:
  - "uploadDocument: append folder_id only when folderId is truthy string (avoids sending 'null' string to backend)"
  - "useFolders: no user_id filter on Realtime channel — RLS handles row isolation"
  - "Realtime publication prerequisite documented in hook comment (cannot verify via CLI)"
  - "Pre-existing test failures in useDocuments and MessageItem are out of scope (confirmed pre-existing via git stash)"
metrics:
  duration: "4min 24sec"
  completed_date: "2026-03-21"
  tasks_completed: 2
  files_changed: 7
---

# Phase 03 Plan 01: Data Foundation (Types, API, FolderTree, useFolders Hook) Summary

**One-liner:** Folder type + Document.folder_id extension, four folder CRUD API functions, buildFolderTree utility with deduplication and alphabetical sort, and useFolders hook with Supabase Realtime subscription — all TDD-built with 39 passing tests.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Add Folder type, update Document type, folder API functions, buildFolderTree | 9bc47ef | types/index.ts, lib/api.ts, lib/folderTree.ts, __tests__/lib/buildFolderTree.test.ts, __tests__/lib/api.test.ts |
| 2 | Create useFolders hook with Realtime subscription | d551ec2 | hooks/useFolders.ts, __tests__/hooks/useFolders.test.ts |

## Verification

All task-specific tests pass:
- `buildFolderTree.test.ts`: 7 tests — empty array, flat list sorted alphabetically, nested tree, deduplication, orphan nodes treated as roots
- `api.test.ts`: 22 tests — all folder CRUD functions, uploadDocument folder_id appending behavior
- `useFolders.test.ts`: 10 tests — mount load, Realtime subscribe, INSERT/UPDATE/DELETE events, CRUD operations, cleanup on unmount
- TypeScript: `npx tsc --noEmit` exits 0

## Deviations from Plan

None — plan executed exactly as written.

Note: 3 pre-existing test failures exist in the suite (2 in MessageItem.test.tsx CSS assertion tests, 1 in useDocuments upload mock shape mismatch). These were confirmed pre-existing via git stash and are out of scope.

## Realtime Publication Prerequisite

The `useFolders` hook subscribes to the `folders` table via Supabase Realtime. The hook includes a code comment noting the prerequisite:

```
-- Verify with:
SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
-- Add with:
ALTER PUBLICATION supabase_realtime ADD TABLE folders;
```

This cannot be automated without direct DB access. The folders table was added in Phase 1 migrations — if those migrations ran correctly this should already be configured. A future validation step should confirm this.

## Known Stubs

None — all API functions make real HTTP calls, all state management is wired. No hardcoded empty values that flow to UI rendering.

## Self-Check: PASSED

- frontend/src/lib/folderTree.ts: FOUND
- frontend/src/hooks/useFolders.ts: FOUND
- frontend/src/__tests__/lib/buildFolderTree.test.ts: FOUND
- frontend/src/__tests__/hooks/useFolders.test.ts: FOUND
- commit 9bc47ef: FOUND
- commit d551ec2: FOUND
