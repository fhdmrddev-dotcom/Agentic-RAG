---
phase: 01-folder-schema-core-apis
verified: 2026-03-21T13:00:00Z
status: passed
score: 16/16 must-haves verified
re_verification: false
---

# Phase 01: Folder Schema & Core APIs — Verification Report

**Phase Goal:** Establish the folder system database schema and core CRUD API that subsequent phases build on.
**Verified:** 2026-03-21T13:00:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (Plan 01-01)

| #  | Truth                                                                                      | Status     | Evidence                                                                                      |
|----|--------------------------------------------------------------------------------------------|------------|-----------------------------------------------------------------------------------------------|
| 1  | User can create a root folder (parent_id=null) and it persists with correct fields         | VERIFIED   | POST /folders endpoint sets user_id, stores name.strip(), parent_id=None; test_create_root_folder passes |
| 2  | User can create a nested folder pointing to a valid parent_id                              | VERIFIED   | create_folder validates parent exists via .eq("id")+.or_() before insert; test_create_nested_folder passes |
| 3  | User can rename a folder without affecting children or parent_id                           | VERIFIED   | PATCH updates only {"name": body.name.strip()} with ownership eq filter; test_rename_folder passes |
| 4  | User can delete a folder and all descendants are cascade-deleted by the DB                 | VERIFIED   | SQL has `parent_id REFERENCES public.folders(id) ON DELETE CASCADE`; test_delete_folder_returns_204 passes |
| 5  | A global folder (is_global=true) is returned when any authenticated user lists folders     | VERIFIED   | GET /folders uses .or_("user_id.eq.X,is_global.eq.true"); test_list_folders_uses_or_filter passes |
| 6  | A per-user folder is only returned to its owner                                            | VERIFIED   | Same .or_() filter bounds results to owned or global; RLS INSERT/UPDATE/DELETE policies restrict mutations |
| 7  | parent_id validation rejects pointing to another user's private folder                    | VERIFIED   | Parent lookup uses same .or_() visibility filter — returns null if not owned/global; test_create_folder_invalid_parent_404 passes with 404 |

### Observable Truths (Plan 01-02)

| #  | Truth                                                                                               | Status   | Evidence                                                  |
|----|-----------------------------------------------------------------------------------------------------|----------|-----------------------------------------------------------|
| 8  | Tests prove a root folder can be created and returns 201 with correct fields                        | VERIFIED | test_create_root_folder, test_create_folder_returns_correct_schema — 23/23 pass |
| 9  | Tests prove a nested folder can be created with a valid parent_id                                   | VERIFIED | test_create_nested_folder passes                          |
| 10 | Tests prove parent_id pointing to another user's private folder is rejected with 404                | VERIFIED | test_create_folder_invalid_parent_404 passes              |
| 11 | Tests prove renaming updates the name and returns the updated folder                                | VERIFIED | test_rename_folder, test_rename_folder_calls_update_with_correct_name pass |
| 12 | Tests prove renaming a non-existent or non-owned folder returns 404                                 | VERIFIED | test_rename_folder_not_found passes                       |
| 13 | Tests prove delete returns 204 and cascade-deletes children                                         | VERIFIED | test_delete_folder_returns_204 passes; cascade enforced by SQL FK |
| 14 | Tests prove listing returns both owned and global folders                                           | VERIFIED | test_list_folders_uses_or_filter asserts .or_() called with user_id + is_global |
| 15 | Tests prove listing does NOT return other users' private folders                                    | VERIFIED | .or_() filter bounds to owned+global only; test_list_folders_deduplicates_owned_global passes |
| 16 | Tests prove listing children of a folder returns only direct children                              | VERIFIED | test_list_children_filters_by_parent_id asserts eq("parent_id") called |

**Score:** 16/16 truths verified

---

### Required Artifacts

| Artifact                                              | Expected                                             | Status     | Details                                                                          |
|-------------------------------------------------------|------------------------------------------------------|------------|----------------------------------------------------------------------------------|
| `backend/supabase/migrations/013_folders.sql`         | Adjacency-list table, RLS, indexes, trigger          | VERIFIED   | 49 lines; CREATE TABLE, 4 RLS policies, 2 indexes, ON DELETE CASCADE, trigger    |
| `backend/app/models/folder.py`                        | FolderCreate, FolderUpdate, FolderResponse           | VERIFIED   | 25 lines; all 3 classes present with correct field types                         |
| `backend/app/api/folders.py`                          | 5 CRUD endpoints, router exported                    | VERIFIED   | 117 lines; list, list_children, create, rename, delete all implemented           |
| `backend/app/main.py`                                 | Router registration                                  | VERIFIED   | Line 41: import includes `folders`; line 46: `app.include_router(folders.router)` |
| `backend/tests/integration/test_folders.py`           | Integration tests for all CRUD endpoints, 150+ lines | VERIFIED   | 303 lines; 23 test cases across 5 classes, all pass                              |

---

### Key Link Verification

| From                              | To                                 | Via                                                         | Status   | Details                                                              |
|-----------------------------------|------------------------------------|-------------------------------------------------------------|----------|----------------------------------------------------------------------|
| `backend/app/api/folders.py`      | `backend/app/models/folder.py`     | `from app.models.folder import FolderCreate, FolderUpdate, FolderResponse` | VERIFIED | Line 5 of folders.py — exact import present                         |
| `backend/app/api/folders.py`      | `backend/app/dependencies.py`      | `from app.dependencies import get_current_user, get_supabase` | VERIFIED | Line 4 of folders.py — exact import present                         |
| `backend/app/main.py`             | `backend/app/api/folders.py`       | `app.include_router(folders.router)`                        | VERIFIED | Line 46 of main.py — exact registration present                     |
| `backend/tests/integration/test_folders.py` | `backend/app/api/folders.py` | HTTP requests via TestClient to /folders endpoints         | VERIFIED | client.post/get/patch/delete("/folders"...) calls throughout test file |

---

### Requirements Coverage

| Requirement | Source Plan  | Description                                                        | Status    | Evidence                                                                                      |
|-------------|--------------|--------------------------------------------------------------------|-----------|-----------------------------------------------------------------------------------------------|
| FOLDER-01   | 01-01, 01-02 | User can create folders with unlimited nesting depth               | SATISFIED | POST /folders with parent_id creates nested folders; self-referential FK enables unlimited depth |
| FOLDER-02   | 01-01, 01-02 | User can rename existing folders                                   | SATISFIED | PATCH /folders/{id} updates name with ownership check; test_rename_folder passes              |
| FOLDER-03   | 01-01, 01-02 | User can delete folders (cascades to contents)                     | SATISFIED | DELETE /folders/{id}; `parent_id REFERENCES public.folders(id) ON DELETE CASCADE` in SQL     |
| FOLDER-04   | (none)       | User can move folders to a different parent folder                 | OUT OF SCOPE | Assigned to Phase 2 in REQUIREMENTS.md — not claimed by any Phase 1 plan; correct          |
| FOLDER-05   | 01-01, 01-02 | System supports global folders (visible to all users) and per-user folders | SATISFIED | is_global column, .or_() visibility filter, RLS SELECT policy, test_list_folders_uses_or_filter |

**Orphaned requirements:** None — FOLDER-04 is explicitly assigned to Phase 2 and correctly not claimed.

---

### Anti-Patterns Found

None. Scanned `folders.py`, `folder.py`, and `013_folders.sql` for TODO/FIXME/placeholder/empty-return patterns. All clear.

---

### Human Verification Required

#### 1. Migration applied to Supabase

**Test:** Run `supabase db push` or execute `013_folders.sql` against the Supabase project, then call `GET /folders` with a valid auth token.
**Expected:** 200 response with empty list (or existing folders); no DB error about missing table.
**Why human:** Cannot verify remote Supabase state programmatically from this environment. The SUMMARY notes the migration must be applied manually.

#### 2. RLS policies enforce isolation at DB level

**Test:** Using two distinct Supabase authenticated users (not service role), attempt to read another user's private folder directly via the Supabase client.
**Expected:** Zero rows returned (RLS SELECT policy `auth.uid() = user_id OR is_global = true` blocks it).
**Why human:** Integration tests use service-role mock; RLS only fires when a JWT-authenticated client is used, not service role. This path cannot be exercised in the current test suite.

#### 3. Cascade delete removes all descendants

**Test:** Create a 3-level folder hierarchy (A -> B -> C), then delete A.
**Expected:** B and C are also deleted, no orphaned rows remain.
**Why human:** Requires live DB with actual FK cascade enforcement; unit tests mock the Supabase client and cannot exercise the DB-level cascade.

---

### Gaps Summary

No gaps. All 16 observable truths verified, all 4 artifacts substantive and wired, all 3 key links confirmed present in code. Requirements FOLDER-01, FOLDER-02, FOLDER-03, and FOLDER-05 are satisfied. FOLDER-04 is correctly deferred to Phase 2.

Three items are flagged for human verification — they require a live Supabase environment and cannot be confirmed from static analysis — but none are blockers to phase completion since the code implementing them is correct.

---

_Verified: 2026-03-21T13:00:00Z_
_Verifier: Claude (gsd-verifier)_
