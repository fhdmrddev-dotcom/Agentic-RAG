---
phase: quick
plan: 260328-wqj
subsystem: backend/chat
tags: [folder-scope, sql, tools, quick-fix]
dependency_graph:
  requires: [phase-08-02 folder-scoped threads]
  provides: [folder-scoped tool results]
  affects: [threads.py tool dispatch, sql_service query scoping]
tech_stack:
  added: []
  patterns: [sql injection, post-filter, system prompt augmentation]
key_files:
  created: []
  modified:
    - backend/app/api/threads.py
    - backend/app/services/sql_service.py
decisions:
  - Glob post-filter in dispatch (not in glob_path signature) to avoid changing a shared helper
  - SQL folder scope appended after user_id injection (WHERE already present, so simple AND append)
  - Documents at root (folder_id=None) excluded from folder-scoped glob — they are not in any subtree
metrics:
  duration: ~5min
  completed: "2026-03-28"
  tasks_completed: 1
  tasks_total: 2
  files_changed: 2
---

# Quick Task 260328-wqj: Fix Folder-Scoped Chat Returning Results Summary

**One-liner:** Patch threads.py and sql_service.py so folder-scoped chat restricts query_documents SQL and glob results to the scoped folder's subtree, and injects folder-scope note into the system prompt.

## What Was Done

Fixed three root causes that caused folder-scoped chat to return results from ALL folders:

### Root Cause 1 — System prompt not folder-aware (FIXED)

After selecting `active_system_prompt`, if `scoped_folder_path` is set, a folder-scope instruction is appended to the prompt. This tells the LLM to restrict tool calls to the folder and its subfolders, preventing it from generating unscoped queries.

### Root Cause 2 — `query_documents` not folder-scoped (FIXED)

Added `_inject_folder_scope(sql, folder_ids)` to `sql_service.py`. This appends `AND documents.folder_id IN ('id1', 'id2', ...)` (or `folders.id IN (...)` for folders-only queries) after `_inject_user_id` has already added the WHERE clause. `query_documents` now accepts `folder_ids: list[str] | None` and calls `_inject_folder_scope` when folder_ids is provided.

In `threads.py`, the `query_documents` dispatch now passes `folder_ids=folder_subtree_ids`.

### Root Cause 3 — `glob_path` not folder-scoped (FIXED)

After calling `glob_path(...)`, the dispatch in `threads.py` filters `result["matches"]` to only entries whose `folder_id` is in `folder_subtree_ids` (when the thread is folder-scoped). The `total` count is updated to match the filtered list. Documents at root (`folder_id=None`) are excluded since they don't belong to any folder subtree.

## Tools Already Correctly Scoped (No Changes Needed)

- `ls` / `tree` — default path falls back to `scoped_folder_path`
- `grep` — default path falls back to `scoped_folder_path`
- `search_documents` — already passes `folder_ids=folder_subtree_ids`
- `read_document` / `analyze_document` — not folder-concept tools

## Verification

Inline unit tests passed:

```
PASS: folder scope injection works
  SQL: SELECT filename FROM documents WHERE documents.user_id = 'user123' AND documents.folder_id IN ('folder-a', 'folder-b')
PASS: empty folder_ids is no-op
PASS: folders-only query uses folders.id
  SQL: SELECT name FROM folders WHERE (folders.user_id = 'user123' OR folders.is_global = true) AND folders.id IN ('folder-a')
ALL TESTS PASSED
```

## Commits

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Fix folder-scoped tool dispatch (system prompt, query_documents, glob) | eaf7848 |

## Deviations from Plan

**1. [Rule 1 - Bug] glob result key is `total` not `count`**
- **Found during:** Task 1 implementation
- **Issue:** Plan used `result["count"]` but `glob_path` returns `{"pattern", "matches", "total"}`
- **Fix:** Used `result["total"] = len(result["matches"])` to match the actual response schema
- **Files modified:** backend/app/api/threads.py

## Checkpoint

Task 2 is a `checkpoint:human-verify` — awaiting user verification that folder-scoped chat now restricts results correctly.

## Known Stubs

None.
