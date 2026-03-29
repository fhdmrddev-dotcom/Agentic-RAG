---
phase: 08-folder-system-enhancements
plan: 01
subsystem: database, api, ui
tags: [rls, postgres, supabase, fastapi, react, folders, global-folders]

# Dependency graph
requires:
  - phase: 03-ingestion-ui
    provides: FolderTree, FolderNode, FolderCreateInput, useFolders hook, folder CRUD APIs
  - phase: 01-folder-schema-core-apis
    provides: folders table with is_global column, folder RLS policies

provides:
  - Migration 015 replacing documents SELECT RLS to include global folder visibility
  - PATCH /folders/{id}/toggle-global endpoint (owner-only, 403 for non-owners)
  - Globe toggle button in FolderNode hover actions with context-aware tooltip
  - isGlobal checkbox in FolderCreateInput
  - toggleFolderGlobal API function and toggleGlobal hook method

affects: [09-explorer-sub-agent, future-chat-context]

# Tech tracking
tech-stack:
  added: []
  patterns: [owner-only PATCH endpoint returning 403 (not 404) for non-owners, optimistic state update in hook after API call]

key-files:
  created:
    - supabase/migrations/015_global_folder_document_rls.sql
  modified:
    - backend/app/api/folders.py
    - frontend/src/lib/api.ts
    - frontend/src/hooks/useFolders.ts
    - frontend/src/components/ingestion/FolderNode.tsx
    - frontend/src/components/ingestion/FolderCreateInput.tsx
    - frontend/src/components/ingestion/FolderTree.tsx
    - frontend/src/pages/IngestionPage.tsx

key-decisions:
  - "Use 403 (not 404) when toggle-global is called by non-owner — distinguishes permission denial from missing resource"
  - "Documents RLS uses EXISTS subquery joining folders.is_global rather than a join — keeps policy self-contained"
  - "document_chunks RLS not updated — match_document_chunks RPC is SECURITY DEFINER so RAG queries already bypass RLS; direct chunk access remains owner-only"

patterns-established:
  - "Owner-only toggle endpoints: fetch row with both .eq(id).eq(user_id), return 403 if not found"
  - "Optimistic is_global update in useFolders: update local state from API response rather than toggling locally"

requirements-completed: [FOLDER-08, FOLDER-09]

# Metrics
duration: 2min 24sec
completed: 2026-03-28
---

# Phase 08 Plan 01: Global Folder Toggle Summary

**RLS migration + PATCH toggle-global endpoint + Globe button in folder tree hover actions + isGlobal checkbox in create input**

## Performance

- **Duration:** 2min 24sec
- **Started:** 2026-03-28T19:02:42Z
- **Completed:** 2026-03-28T19:05:06Z
- **Tasks:** 2
- **Files modified:** 7 (+ 1 created)

## Accomplishments
- Documents RLS updated: docs in global folders are now readable by all authenticated users via EXISTS join on folders.is_global
- Backend PATCH /folders/{id}/toggle-global endpoint flips is_global and enforces owner-only access with 403
- Globe icon button in FolderNode hover actions highlights when folder is global and has context-aware tooltip ("Make private" / "Make global (visible to all users)")
- FolderCreateInput extended with isGlobal checkbox so new folders can be created as global from the start

## Task Commits

Each task was committed atomically:

1. **Task 1: Migration SQL + backend toggle-global endpoint** - `6208193` (feat)
2. **Task 2: Frontend toggle-global in folder tree + create input checkbox** - `ee9ef1a` (feat)

**Plan metadata:** (docs commit — pending)

## Files Created/Modified
- `supabase/migrations/015_global_folder_document_rls.sql` - Drops old documents SELECT policy, adds new one allowing access for global-folder docs
- `backend/app/api/folders.py` - Added toggle_global endpoint (PATCH /{folder_id}/toggle-global)
- `frontend/src/lib/api.ts` - Added toggleFolderGlobal function
- `frontend/src/hooks/useFolders.ts` - Added toggleGlobal method to hook with optimistic update
- `frontend/src/components/ingestion/FolderNode.tsx` - Added onToggleGlobal prop and Globe toggle button in hover actions
- `frontend/src/components/ingestion/FolderCreateInput.tsx` - Added isGlobal state + checkbox; onCommit signature now includes isGlobal param
- `frontend/src/components/ingestion/FolderTree.tsx` - Added onToggleGlobal prop, updated handleCreateCommit to accept isGlobal
- `frontend/src/pages/IngestionPage.tsx` - Destructured toggleGlobal from useFolders, passed to FolderTree

## Decisions Made
- 403 (not 404) returned by toggle-global for non-owners — distinguishes permission denial from missing resource
- document_chunks RLS not updated — match_document_chunks RPC is SECURITY DEFINER so RAG queries already bypass RLS; direct chunk access remains owner-only (consistent with prior phases)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

The migration `supabase/migrations/015_global_folder_document_rls.sql` must be applied to the Supabase instance:

```bash
supabase db push
# or for local:
supabase migration up
```

## Next Phase Readiness
- Toggle-global feature fully wired: UI, API, and DB policy are all in place
- Phase 08-02 (folder-scoped chat) can proceed — global folder structure is now semantically complete
- No blockers

## Self-Check: PASSED

- `supabase/migrations/015_global_folder_document_rls.sql` — FOUND
- `.planning/phases/08-folder-system-enhancements/08-01-SUMMARY.md` — FOUND
- Commit `6208193` — FOUND
- Commit `ee9ef1a` — FOUND

---
*Phase: 08-folder-system-enhancements*
*Completed: 2026-03-28*
