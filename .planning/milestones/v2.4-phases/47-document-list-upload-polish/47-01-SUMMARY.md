---
phase: 47
plan: 01
subsystem: frontend
---

# Phase 47 Plan 01: Root Document Visibility Polish Summary

**Objective:** Make root-folder documents clearly visible and recognizable as root-level items through a document count badge, contextual right-panel header, and improved empty state copy.

**Duration:** ~5 minutes
**Completed:** 2026-04-25

## What Was Built

1. **Root document count badge in FolderTree** — Added `rootDocumentCount?: number` prop to `FolderTreeProps`; the Root node now displays a subdued count badge (`text-xs text-muted-foreground ml-auto`) showing the number of root-level documents.

2. **Root section header in IngestionPage** — Added `rootDocumentCount` computation via `useMemo` (filters documents where `folder_id == null`); passed to `<FolderTree />`; added a conditional header block for `selectedFolderId === null` displaying "Root" title + "Documents not assigned to a folder" subtitle.

3. **Root empty state copy update in DocumentList** — Changed root empty message from "No documents uploaded yet." to "No root documents yet."; removed the `folderId != null` guard so the upload hint "Upload files above to add them here." now appears for both root and folder empty states.

## Files Modified

| File | Change |
|------|--------|
| `frontend/src/components/ingestion/FolderTree.tsx` | Added `rootDocumentCount` prop + badge on Root node |
| `frontend/src/pages/IngestionPage.tsx` | Computed `rootDocumentCount`, passed to FolderTree, added Root header block |
| `frontend/src/components/ingestion/DocumentList.tsx` | Updated root empty state copy + always show upload hint |

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- `npm run build` passes with no TypeScript errors
- Root node shows badge count matching documents with `folder_id == null`
- Root header renders when Root is clicked
- Empty state shows correct copy

## Self-Check: PASSED
