---
type: quick-summary
id: 260405-s1e
title: "Hide toggle-global from non-owners and block uploads into other users' global folders"
completed: 2026-04-05
duration: "~3 min"
tasks_completed: 4
files_changed: 4
commits:
  - df106a2
  - fb6f761
  - 9236293
  - 62f9897
---

# Quick Task 260405-s1e Summary

## One-liner

Ownership-gate for folder actions: 403 on backend upload to non-owned folder, toggle-global hidden in UI for non-owners, upload dropzone replaced with lock state for non-owned global folders.

## What Was Done

### Task 1 — Backend ownership check on upload (commit df106a2)

Replaced the `or_(user_id.eq / is_global.eq.true)` visibility filter in `upload_document` with a direct `select("id, user_id")` lookup followed by an ownership comparison. If `folder_check.data["user_id"] != current_user["id"]`, the endpoint returns `HTTP 403 Forbidden` with `"Cannot upload to a folder you do not own"`.

**File:** `backend/app/api/documents.py` (lines 67-79)

### Task 2 — FolderNode hides toggle-global for non-owners (commit fb6f761)

Added `currentUserId: string` to `FolderNodeProps`, derived `isOwner = node.user_id === currentUserId`, and wrapped the "Make private / Make global" `DropdownMenuItem` in `{isOwner && (...)}`. Prop threaded through the recursive children render.

**File:** `frontend/src/components/ingestion/FolderNode.tsx`

### Task 3 — FolderTree threads currentUserId (commit 9236293)

Added `currentUserId: string` to `FolderTreeProps` and passed it down to every `<FolderNode>` call.

**File:** `frontend/src/components/ingestion/FolderTree.tsx`

### Task 4 — IngestionPage + DocumentUpload ownership-gated upload (commit 62f9897)

- `IngestionPage` imports `useAuth`, derives `canUploadToFolder = !selectedFolderId || !selectedFolder || selectedFolder.user_id === user?.id`, passes `currentUserId={user?.id ?? ""}` to `<FolderTree>` and `disabled={!canUploadToFolder}` to `<DocumentUpload>`.
- `DocumentUpload` accepts `disabled?: boolean`; when true, renders a `<Lock>` icon with "Read-only folder" / "Only the folder owner can upload files here" text and applies `pointer-events-none opacity-60 cursor-not-allowed`. `handleFiles` also guards on `disabled` to prevent programmatic bypass.

**Files:** `frontend/src/pages/IngestionPage.tsx`, `frontend/src/components/ingestion/DocumentUpload.tsx`

## Commits

| Commit  | Message |
|---------|---------|
| df106a2 | fix(260405-s1e): enforce upload ownership — 403 when uploading to another user's folder |
| fb6f761 | fix(260405-s1e): hide toggle-global menu item for non-owners in FolderNode |
| 9236293 | fix(260405-s1e): thread currentUserId through FolderTree to FolderNode |
| 62f9897 | fix(260405-s1e): disable upload dropzone for non-owned folders in IngestionPage |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- `backend/app/api/documents.py` — modified, ownership check present
- `frontend/src/components/ingestion/FolderNode.tsx` — modified, isOwner guard present
- `frontend/src/components/ingestion/FolderTree.tsx` — modified, currentUserId threaded
- `frontend/src/pages/IngestionPage.tsx` — modified, useAuth imported, canUploadToFolder computed
- `frontend/src/components/ingestion/DocumentUpload.tsx` — modified, disabled prop + Lock state
- All 4 commits verified in git log (df106a2, fb6f761, 9236293, 62f9897)
- TypeScript compilation: 0 errors
