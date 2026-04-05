---
id: 260405-rgy
title: Fix folder public visibility — files and subfolders not appearing to other users
type: quick
completed: "2026-04-05"
duration: ~15min
tasks_completed: 4
files_modified: 7
commits:
  - b4d5e94
  - 358a017
  - da74e1f
  - 6742041
key_decisions:
  - Shared utility module (folder_utils.py) centralizes global subtree logic to avoid duplication across 5+ API files
  - fetch_visible_folders returns "*" fields (superset) so all callers still work without schema adjustments
  - read_path uses maybe_single() instead of single() for owner check to avoid APIError on zero-row result
  - sql_service global_folder_ids uses IN list (not is_global flag) because descendants are not global themselves
tags: [bug-fix, visibility, folders, public-access, global-subtree]
---

# Quick Task 260405-rgy: Fix Folder Public Visibility Summary

**One-liner:** Ancestry-based global subtree visibility replacing shallow `is_global.eq.true` filter across folders, documents, kb, threads, and sql_service.

## Problem

The backend uses the Supabase service role key (bypasses RLS). All visibility filtering was done in application code via `.or_("user_id.eq.X,is_global.eq.true")`. This only returned folders where `is_global = true` directly — it did NOT return children of a global folder, because children have `is_global = false` with a different `user_id`. The same root cause affected documents inside those folders, and all KB tool operations (ls, tree, glob, read, grep scoping).

## Root Cause

Flat `is_global` filter catches only the root global folder. All child folders inherit visibility by ancestry, not by their own `is_global` flag.

## Fix Approach

Load ALL folders (service role sees everything), then walk ancestry to determine if any ancestor has `is_global = true`. A shared utility module provides the core recursive logic with memoization cache.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create shared folder_utils module | b4d5e94 | backend/app/utils/__init__.py, backend/app/utils/folder_utils.py |
| 2 | Fix folders.py API | 358a017 | backend/app/api/folders.py |
| 3 | Fix documents.py and kb.py APIs | da74e1f | backend/app/api/documents.py, backend/app/api/kb.py |
| 4 | Fix threads.py and sql_service.py | 6742041 | backend/app/api/threads.py, backend/app/services/sql_service.py |

## Files Changed

**Created:**
- `backend/app/utils/__init__.py` — empty package init
- `backend/app/utils/folder_utils.py` — shared module with 4 helpers

**Modified:**
- `backend/app/api/folders.py` — list_folders, list_children, create_folder, move_folder
- `backend/app/api/documents.py` — list_documents
- `backend/app/api/kb.py` — _fetch_visible_folders, ls_path, tree_path, glob_path, read_path
- `backend/app/api/threads.py` — folder subtree resolution
- `backend/app/services/sql_service.py` — _inject_user_id, query_documents

## Key Functions (folder_utils.py)

- `fetch_all_folders(supabase, fields)` — fetch all folders via service role (no RLS)
- `is_in_global_subtree(folder_id, folder_map, cache)` — recursive ancestry check with memoization
- `fetch_visible_folders(supabase, user_id)` — owned + globally visible folders
- `get_globally_visible_folder_ids(supabase, user_id)` — non-owned folders visible via global ancestry

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- backend/app/utils/__init__.py: FOUND
- backend/app/utils/folder_utils.py: FOUND
- Commits b4d5e94, 358a017, da74e1f, 6742041: FOUND (git log confirmed)
- Import checks: all passed
