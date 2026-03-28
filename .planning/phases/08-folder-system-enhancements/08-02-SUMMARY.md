---
phase: 08-folder-system-enhancements
plan: 02
subsystem: database, api, ui
tags: [postgres, supabase, fastapi, react, folders, thread-scoping, rag]

# Dependency graph
requires:
  - phase: 08-folder-system-enhancements
    plan: 01
    provides: Global folder toggle + folders table with is_global column

provides:
  - Migration 016 adding folder_id column on threads with ON DELETE SET NULL
  - Updated match_document_chunks RPC accepting p_folder_ids uuid[] for scoped vector search
  - Backend thread creation with optional folder_id scope
  - event_stream folder subtree resolution and tool dispatch scoping (ls, tree, grep, search_documents)
  - Frontend Thread type with folder_id field
  - createThread API function with optional folderId parameter
  - Folder picker dropdown in ChatArea no-thread welcome state
  - Scope badge (folder icon + name) in chat header for scoped threads
  - Folder icon indicator in Sidebar thread list for scoped threads

affects: [future-chat-context, 09-explorer-sub-agent]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Python-side subtree resolution via recursive _get_subtree helper avoids complex SQL CTE
    - Scoped folder path built by walking folder_map to construct path string for tool defaults
    - ON DELETE SET NULL on threads.folder_id preserves thread history when folder is deleted

key-files:
  created:
    - supabase/migrations/016_thread_folder_scope.sql
  modified:
    - backend/app/models/thread.py
    - backend/app/api/threads.py
    - backend/app/services/retrieval_service.py
    - frontend/src/types/index.ts
    - frontend/src/lib/api.ts
    - frontend/src/hooks/useThreads.ts
    - frontend/src/components/chat/ChatArea.tsx
    - frontend/src/components/layout/ChatLayout.tsx
    - frontend/src/components/layout/Sidebar.tsx

key-decisions:
  - "Python-side subtree resolution (_get_subtree recursive helper) preferred over SQL CTE per CONTEXT.md — simpler and avoids PostgreSQL recursive CTE complexity"
  - "ON DELETE SET NULL on threads.folder_id — thread history preserved when folder is deleted; thread reverts to unscoped"
  - "Folder picker only shown when folders.length > 0 — avoids empty select confusion for users with no folders"
  - "Scope is fixed at thread creation (folder_id not editable) — simplifies mental model; no mid-conversation context switch"
  - "Keyword search not folder-filtered (no p_folder_ids on keyword_search_chunks RPC) — vector search handles folder scoping; RRF fusion produces net-scoped results"

# Metrics
duration: 3min 18sec
completed: 2026-03-28
---

# Phase 08 Plan 02: Folder-Scoped Chat Threads Summary

**Migration + backend subtree resolution + frontend folder picker and scope badges — scoped threads auto-restrict RAG retrieval and KB tools to the selected folder subtree**

## Performance

- **Duration:** 3min 18sec
- **Started:** 2026-03-28T19:07:19Z
- **Completed:** 2026-03-28T19:10:37Z
- **Tasks:** 2
- **Files modified:** 8 (+ 1 created)

## Accomplishments

- Migration 016 adds `folder_id` column to `threads` with `ON DELETE SET NULL` and index; updates `match_document_chunks` RPC with `p_folder_ids uuid[] DEFAULT NULL` parameter and `d.folder_id = ANY(p_folder_ids)` WHERE clause
- ThreadCreate and ThreadResponse models gain `folder_id: UUID | None = None`
- `create_thread` inserts `folder_id` when provided
- `send_message` event_stream loads the thread's `folder_id`, resolves the full subtree recursively via `_get_subtree`, and builds `scoped_folder_path` for tool dispatch defaults
- Tool dispatch: `ls` and `tree` default path to `scoped_folder_path` when no explicit path arg; `grep` scopes path similarly; `search_documents` passes `folder_ids=folder_subtree_ids`
- `search_documents` and `_vector_search` accept `folder_ids` parameter; `_vector_search` passes `p_folder_ids` to the RPC
- Frontend `Thread` type adds `folder_id: string | null`
- `createThread` API function accepts optional `folderId` and sends `folder_id` in POST body
- `useThreads.newThread` accepts optional `folderId` and forwards to `createThread`
- `ChatArea` shows folder picker `<select>` in no-thread welcome state (only when folders exist), resets on thread change
- `ChatArea` shows scope badge (FolderIcon + folder name) in thread header when `thread.folder_id` is set
- `ChatLayout` imports `useFolders` and passes `folders` array to both `ChatArea` and `Sidebar`
- `Sidebar` shows a small FolderIcon on thread list items with `folder_id` set

## Task Commits

Each task committed atomically:

1. **Task 1: DB migration + backend folder-scoped thread support** — `d155f6b` (feat)
2. **Task 2: Frontend folder picker, scope badge, and type updates** — `514709a` (feat)

## Files Created/Modified

- `supabase/migrations/016_thread_folder_scope.sql` — threads.folder_id column, index, updated match_document_chunks RPC
- `backend/app/models/thread.py` — folder_id on ThreadCreate and ThreadResponse
- `backend/app/api/threads.py` — create_thread inserts folder_id; event_stream resolves subtree + scopes tool dispatch
- `backend/app/services/retrieval_service.py` — folder_ids parameter on search_documents and _vector_search
- `frontend/src/types/index.ts` — Thread.folder_id field
- `frontend/src/lib/api.ts` — createThread accepts folderId
- `frontend/src/hooks/useThreads.ts` — newThread accepts folderId
- `frontend/src/components/chat/ChatArea.tsx` — folder picker + scope badge + updated Props
- `frontend/src/components/layout/ChatLayout.tsx` — imports useFolders, passes folders to children
- `frontend/src/components/layout/Sidebar.tsx` — FolderIcon on scoped threads

## Decisions Made

- Python-side subtree resolution preferred over SQL recursive CTE — simpler, avoids PostgREST CTE complexity
- ON DELETE SET NULL preserves thread history; thread reverts to unscoped scope when folder deleted
- Keyword search not folder-filtered at RPC level (keyword_search_chunks RPC unchanged); vector search handles scoping and RRF fusion produces net-scoped results
- Folder picker hidden when no folders exist (avoids empty dropdown confusion)

## Deviations from Plan

None — plan executed exactly as written.

## User Setup Required

Migration `supabase/migrations/016_thread_folder_scope.sql` must be applied:

```bash
supabase db push
# or for local:
supabase migration up
```

## Next Phase Readiness

- Phase 08-03 (folder appearance enhancements) can proceed — folder scoping fully wired
- Scoped thread creation, retrieval restriction, and UI indicators all in place
- No blockers

## Known Stubs

None — folder picker uses live `folders` data from `useFolders` hook. Scope badge uses `Thread.folder_id` from API. All data paths are wired.

## Self-Check: PASSED

- `supabase/migrations/016_thread_folder_scope.sql` — FOUND
- `backend/app/models/thread.py` — FOUND (folder_id on both models)
- `backend/app/api/threads.py` — FOUND (folder_subtree_ids, scoped_folder_path, folder_ids=folder_subtree_ids)
- `backend/app/services/retrieval_service.py` — FOUND (folder_ids param, p_folder_ids in RPC)
- `frontend/src/types/index.ts` — FOUND (folder_id: string | null)
- `frontend/src/components/chat/ChatArea.tsx` — FOUND (scopeFolderId, FolderIcon scope badge)
- `frontend/src/components/layout/ChatLayout.tsx` — FOUND (useFolders, folders prop passed)
- `frontend/src/components/layout/Sidebar.tsx` — FOUND (FolderIcon on scoped threads)
- Commit `d155f6b` — FOUND
- Commit `514709a` — FOUND

---
*Phase: 08-folder-system-enhancements*
*Completed: 2026-03-28*
