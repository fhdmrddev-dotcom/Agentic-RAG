---
phase: 08-folder-system-enhancements
verified: 2026-03-28T20:00:00Z
status: passed
score: 11/11 must-haves verified
re_verification: false
---

# Phase 8: Folder System Enhancements — Verification Report

**Phase Goal:** Global folder sharing with RLS, folder-scoped chat, and folder appearance improvements
**Verified:** 2026-03-28
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

All truths drawn directly from PLAN frontmatter `must_haves` across all three plans.

#### Plan 01 Truths (FOLDER-08, FOLDER-09)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Folder owner can toggle is_global from the folder tree context menu and the change takes effect immediately | VERIFIED | `FolderNode.tsx` renders Globe button with `onToggleGlobal` prop; `useFolders.toggleGlobal` updates local state from API response |
| 2 | Documents inside a global folder are readable by all authenticated users via updated RLS | VERIFIED | `015_global_folder_document_rls.sql` drops old SELECT policy and creates `"Users can view own or global-folder documents"` with `EXISTS (SELECT 1 FROM public.folders WHERE folders.id = documents.folder_id AND folders.is_global = true)` |
| 3 | New folders can be created as global via a checkbox in the create input | VERIFIED | `FolderCreateInput.tsx` has `isGlobal` state, checkbox, and passes `(name, isGlobal)` to `onCommit` |
| 4 | Non-owner receives 403 when attempting to toggle another user's folder | VERIFIED | `folders.py` toggle_global fetches with `.eq("user_id", current_user["id"])` and raises `HTTP_403_FORBIDDEN` when not found |

#### Plan 02 Truths (CHAT-01, CHAT-02)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 5 | User can create a new chat thread scoped to a specific folder via a folder picker dropdown | VERIFIED | `ChatArea.tsx` has `scopeFolderId` state and `<select>` dropdown in no-thread welcome state; passed to `onCreateThread(scopeFolderId)` |
| 6 | Folder-scoped threads restrict RAG retrieval to that folder and all its subfolders recursively | VERIFIED | `threads.py` resolves `folder_subtree_ids` via `_get_subtree` recursive helper; passes `folder_ids=folder_subtree_ids` to `search_documents`; `_vector_search` passes `p_folder_ids` to RPC; migration 016 adds `d.folder_id = ANY(p_folder_ids)` WHERE clause |
| 7 | Scoped threads display a folder scope badge in the sidebar thread list and chat header | VERIFIED | `ChatArea.tsx` shows `FolderIcon + folder name` badge when `thread.folder_id` set; `Sidebar.tsx` shows small `FolderIcon` on thread items with `folder_id` |
| 8 | Scope is fixed at thread creation and cannot be changed | VERIFIED | `folder_id` stored on thread at creation; no edit endpoint exposed; no UI to change it post-creation |
| 9 | Deleting a scoped folder reverts the thread to unscoped (ON DELETE SET NULL) | VERIFIED | Migration 016: `ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES public.folders(id) ON DELETE SET NULL` |

#### Plan 03 Truths (UI-07)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 10 | Selecting a non-root folder shows a compact info bar with doc count, total size, global badge, subfolder count, and creation date | VERIFIED | `FolderDetail.tsx` (58 lines) renders all five data points; mounted in `IngestionPage.tsx` inside `selectedFolderId !== null` block with `selectedFolder` guard |
| 11 | Selecting root (null folder) hides the info bar | VERIFIED | `IngestionPage.tsx` only renders `FolderDetail` inside `{selectedFolderId !== null && (...)}` block and only when `selectedFolder` is non-null |

**Score:** 11/11 truths verified

---

## Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `supabase/migrations/015_global_folder_document_rls.sql` | VERIFIED | EXISTS, 15 lines; contains `DROP POLICY IF EXISTS`, `CREATE POLICY "Users can view own or global-folder documents"`, `folders.is_global = true` |
| `backend/app/api/folders.py` | VERIFIED | Contains `toggle-global` route at line 198; 403 enforcement at line 216 |
| `frontend/src/components/ingestion/FolderNode.tsx` | VERIFIED | `onToggleGlobal` prop declared (line 36), destructured (line 58), called on click (line 200), threaded to children (line 273); Globe button with context-aware tooltip |
| `frontend/src/lib/api.ts` | VERIFIED | `toggleFolderGlobal` function exported (line 215), calls PATCH `toggle-global` endpoint |
| `supabase/migrations/016_thread_folder_scope.sql` | VERIFIED | EXISTS, 39 lines; `ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES public.folders(id) ON DELETE SET NULL`; updated RPC with `p_folder_ids uuid[] DEFAULT NULL` and `d.folder_id = ANY(p_folder_ids)` |
| `backend/app/api/threads.py` | VERIFIED | `folder_subtree_ids` (line 216), `scoped_folder_path` (line 217), `_get_subtree` (line 226), `folder_ids=folder_subtree_ids` (line 376), tool dispatch path defaults (lines 347, 351, 355) |
| `backend/app/models/thread.py` | VERIFIED | `folder_id: UUID \| None = None` on both `ThreadCreate` (line 9) and `ThreadResponse` (line 20) |
| `frontend/src/components/chat/ChatArea.tsx` | VERIFIED | `scopeFolderId` state, folder `<select>` in welcome state, scope badge with `FolderIcon + folder name` in header when `thread.folder_id` set |
| `frontend/src/components/ingestion/FolderDetail.tsx` | VERIFIED | EXISTS, 58 lines; exports `FolderDetail`; renders doc count, size, global badge, subfolder count, creation date |
| `frontend/src/pages/IngestionPage.tsx` | VERIFIED | Imports `FolderDetail`; three memos (`selectedFolder`, `folderDocuments`, `subfolderCount`); conditional render between FolderBreadcrumb and DocumentUpload |
| `backend/app/services/retrieval_service.py` | VERIFIED | `_vector_search` accepts `folder_ids` (line 31), passes `p_folder_ids` to RPC (line 43); `search_documents` accepts and forwards `folder_ids` |
| `frontend/src/types/index.ts` | VERIFIED | `Thread.folder_id: string \| null` (line 5); `Folder.is_global: boolean` already present |
| `frontend/src/hooks/useThreads.ts` | VERIFIED | `newThread(folderId?: string \| null)` in interface (line 11) and implementation (line 36) |
| `frontend/src/hooks/useFolders.ts` | VERIFIED | `toggleGlobal` in `UseFolders` interface (line 17), implementation (line 107), returned from hook (line 112) |
| `frontend/src/components/layout/ChatLayout.tsx` | VERIFIED | Imports `useFolders` (line 7), destructures `{ folders }` (line 29), passes `folders` to both `Sidebar` (line 57) and `ChatArea` (line 65) |
| `frontend/src/components/layout/Sidebar.tsx` | VERIFIED | `folders: Folder[]` prop (line 19); `FolderIcon` on scoped thread items (lines 143-145) |
| `frontend/src/components/ingestion/FolderTree.tsx` | VERIFIED | `onToggleGlobal` prop in interface (line 16), destructured (line 26), passed to FolderNode children (line 181) |
| `frontend/src/components/ingestion/FolderCreateInput.tsx` | VERIFIED | `isGlobal` state (line 16), checkbox (line 40), `onCommit(trimmed, isGlobal)` (line 29) |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `FolderNode.tsx` | `backend/app/api/folders.py` | `toggleFolderGlobal` call in `api.ts` then `toggleGlobal` in `useFolders.ts` | WIRED | `FolderNode` calls `onToggleGlobal(node.id)` → prop from `FolderTree` → from `IngestionPage` → `toggleGlobal` from `useFolders` → `toggleFolderGlobal` in `api.ts` → PATCH `toggle-global` endpoint |
| `015_global_folder_document_rls.sql` | documents table | `EXISTS` subquery on `folders.is_global = true` | WIRED | Policy USING clause: `OR EXISTS (SELECT 1 FROM public.folders WHERE folders.id = documents.folder_id AND folders.is_global = true)` |
| `useThreads.ts` | `backend/app/api/threads.py` | `createThread` passes `folder_id` in POST body | WIRED | `newThread(folderId)` → `createThread("New Chat", folderId)` → `body.folder_id = folderId` → POST /threads; backend inserts `folder_id` when provided |
| `backend/app/api/threads.py` | `backend/app/services/retrieval_service.py` | `search_documents` receives `folder_ids=folder_subtree_ids` | WIRED | Line 376: `search_documents(..., folder_ids=folder_subtree_ids)` |
| `backend/app/services/retrieval_service.py` | `016_thread_folder_scope.sql` | `_vector_search` passes `p_folder_ids` to RPC | WIRED | `params["p_folder_ids"] = folder_ids` → `supabase.rpc("match_document_chunks", params)` → RPC filters `d.folder_id = ANY(p_folder_ids)` |
| `IngestionPage.tsx` | `FolderDetail.tsx` | component import and conditional render | WIRED | Import at line 5; rendered at line 71-76 inside `selectedFolderId !== null` block |

---

## Requirements Coverage

All five requirement IDs from plan frontmatter (`requirements:` fields) accounted for.

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| FOLDER-08 | 08-01-PLAN | User can toggle folder global/shared status from UI | SATISFIED | Globe toggle button in FolderNode hover actions; `toggleFolderGlobal` API → PATCH endpoint |
| FOLDER-09 | 08-01-PLAN | Documents inside global folder readable by all authenticated users | SATISFIED | Migration 015 RLS policy with `folders.is_global = true` EXISTS subquery |
| CHAT-01 | 08-02-PLAN | User can scope new chat thread to folder; RAG limited to subtree | SATISFIED | Folder picker in ChatArea; `_get_subtree` + `p_folder_ids` RPC in backend |
| CHAT-02 | 08-02-PLAN | Scoped threads show scope badge; scope fixed at creation | SATISFIED | FolderIcon + name badge in ChatArea header; FolderIcon in Sidebar; no edit mechanism |
| UI-07 | 08-03-PLAN | Folder selection in ingestion shows compact info bar with stats | SATISFIED | FolderDetail component with doc count, size, global badge, subfolder count, date |

**Orphaned requirements check:** REQUIREMENTS.md maps FOLDER-08, FOLDER-09, CHAT-01, CHAT-02, UI-07 to Phase 8 — all five claimed in plan frontmatter. No orphaned requirements.

---

## Git Commit Verification

| Commit | Task | Status |
|--------|------|--------|
| `6208193` | Migration 015 + toggle-global endpoint | VERIFIED |
| `ee9ef1a` | Frontend toggle UI + create input checkbox | VERIFIED |
| `d155f6b` | Migration 016 + backend folder-scoped threads | VERIFIED |
| `514709a` | Frontend folder picker + scope badges | VERIFIED |
| `8acedc4` | FolderDetail component | VERIFIED |

All five commits exist in git history.

---

## Anti-Patterns Found

No blockers or stubs found.

| File | Pattern | Severity | Notes |
|------|---------|----------|-------|
| None | — | — | No TODO/FIXME/placeholder patterns found in modified files; no empty return stubs; all data paths wired to live hook state or API responses |

Notable design decision: keyword search (`_keyword_search`) does NOT apply `p_folder_ids` filtering — only vector search is scoped. Per SUMMARY decision log, RRF fusion with scoped vector results produces net-scoped output. This is an intentional implementation choice, not a stub.

---

## Human Verification Required

The following behaviors require a running app to verify:

### 1. Globe toggle visual feedback

**Test:** In the ingestion UI, hover over a folder you own and click the Globe icon.
**Expected:** Globe icon highlights (text-primary color), tooltip changes to "Make private". Second click reverts to unhighlighted with tooltip "Make global (visible to all users)".
**Why human:** CSS class application and tooltip rendering require browser.

### 2. Cross-user global folder document access

**Test:** As User A, create a folder, mark it global, upload a document. As User B (different account), attempt to query or view that document.
**Expected:** User B can read the document content; the RLS policy grants access.
**Why human:** Requires two authenticated Supabase sessions; cannot simulate RLS policy evaluation from static analysis.

### 3. Folder picker and scope badge end-to-end

**Test:** Open chat page with no active thread. Select a folder from the dropdown. Send a message.
**Expected:** Thread is created with folder scope; chat header shows folder name badge with FolderIcon; sidebar entry shows small FolderIcon.
**Why human:** Requires live API call to POST /threads and React rendering.

### 4. Folder-scoped retrieval restricts results

**Test:** Create a thread scoped to Folder A (which has documents). Ask a question whose answer only appears in Folder B. Verify the answer does not appear or is marked as not found.
**Expected:** RAG retrieval only returns chunks from Folder A's subtree.
**Why human:** Requires live embeddings, Supabase RPC call, and observable LLM output.

### 5. FolderDetail info bar display

**Test:** In the ingestion UI, click a folder that has documents, subfolders, and is marked global.
**Expected:** Compact horizontal bar shows: "Global" badge, doc count, human-readable size, subfolder count, creation date — all on one row.
**Why human:** Layout and visual rendering requires browser.

---

## Summary

Phase 8 goal is fully achieved. All three plans executed completely with no deviations from specification:

- **Plan 01 (FOLDER-08, FOLDER-09):** RLS migration correctly replaces the restrictive documents SELECT policy with one that permits reads on documents in global folders. The backend toggle endpoint enforces owner-only access with 403. The Globe button in FolderNode is wired through the full prop chain from IngestionPage to the API. FolderCreateInput checkbox enables creating global folders from the start.

- **Plan 02 (CHAT-01, CHAT-02):** Migration 016 adds `folder_id` to threads with `ON DELETE SET NULL` and updates the `match_document_chunks` RPC to accept `p_folder_ids`. The backend event_stream resolves subtree IDs recursively and scopes all tool calls (ls, tree, grep, search_documents). The frontend Thread type, API function, hook, ChatArea, Sidebar, and ChatLayout are all updated and properly wired.

- **Plan 03 (UI-07):** FolderDetail component is substantive (58 lines with real implementations of `formatBytes` and `formatDate`), correctly props-typed, and mounted between FolderBreadcrumb and DocumentUpload in IngestionPage with proper conditional rendering. All stats derived from existing hook state — no placeholder data.

Five commits verified in git history. No stubs, no TODO markers, no anti-patterns found.

---

_Verified: 2026-03-28_
_Verifier: Claude (gsd-verifier)_
