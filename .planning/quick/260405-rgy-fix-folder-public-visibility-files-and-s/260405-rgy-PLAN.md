---
type: quick
id: 260405-rgy
title: Fix folder public visibility - files and subfolders not appearing to other users
complexity: medium
autonomous: true
files_modified:
  - backend/app/utils/__init__.py
  - backend/app/utils/folder_utils.py
  - backend/app/api/folders.py
  - backend/app/api/documents.py
  - backend/app/api/kb.py
  - backend/app/api/threads.py
  - backend/app/services/sql_service.py
---

# Fix: Folder Public Visibility — Files and Subfolders Not Appearing to Other Users

## Problem

The backend uses the service role key (bypasses RLS). All visibility filtering is done in application code via `.or_("user_id.eq.X,is_global.eq.true")`. This only returns folders where `is_global = true` directly — it does NOT return children of a global folder, because children have `is_global = false` with a different `user_id`.

The fix: load ALL folders (service role sees everything), then walk ancestry to determine if any ancestor has `is_global = true`.

---

## Task 1: Create `backend/app/utils/folder_utils.py` (shared helper module)

**Files:**
- `backend/app/utils/__init__.py` (create empty)
- `backend/app/utils/folder_utils.py` (create new)

**Action:**

Create `backend/app/utils/__init__.py` as an empty file.

Create `backend/app/utils/folder_utils.py` with these four functions exactly:

```python
from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from supabase import Client


def fetch_all_folders(supabase: "Client", fields: str = "id, user_id, name, parent_id, is_global") -> list[dict]:
    """Fetch ALL folders using service role key (no RLS). Returns everything."""
    return supabase.table("folders").select(fields).execute().data or []


def is_in_global_subtree(folder_id: str, folder_map: dict, cache: dict | None = None) -> bool:
    """True if folder_id or any ancestor has is_global=True (recursive, with optional cache)."""
    if cache is None:
        cache = {}
    if folder_id in cache:
        return cache[folder_id]
    f = folder_map.get(folder_id)
    if not f:
        cache[folder_id] = False
        return False
    if f["is_global"]:
        cache[folder_id] = True
        return True
    parent_id = f.get("parent_id")
    result = is_in_global_subtree(parent_id, folder_map, cache) if parent_id else False
    cache[folder_id] = result
    return result


def fetch_visible_folders(supabase: "Client", user_id: str) -> list[dict]:
    """Fetch all folders visible to user: owned by user OR in any global folder's subtree."""
    all_folders = fetch_all_folders(supabase, fields="*")
    folder_map = {f["id"]: f for f in all_folders}
    cache: dict = {}
    return [
        f for f in all_folders
        if f["user_id"] == user_id or is_in_global_subtree(f["id"], folder_map, cache)
    ]


def get_globally_visible_folder_ids(supabase: "Client", user_id: str) -> list[str]:
    """Return IDs of folders NOT owned by user but visible due to global subtree ancestry."""
    all_folders = fetch_all_folders(supabase, fields="id, user_id, parent_id, is_global")
    folder_map = {f["id"]: f for f in all_folders}
    cache: dict = {}
    return [
        f["id"] for f in all_folders
        if f["user_id"] != user_id and is_in_global_subtree(f["id"], folder_map, cache)
    ]
```

**Verify:** `python -c "from app.utils.folder_utils import fetch_visible_folders, get_globally_visible_folder_ids; print('OK')"` runs without error from `backend/` with venv active.

**Done:** Both files exist, all four functions importable.

---

## Task 2: Fix `backend/app/api/folders.py`

**Files:**
- `backend/app/api/folders.py`

**Action:**

Add import at top (after existing imports):
```python
from app.utils.folder_utils import fetch_visible_folders
```

Replace `list_folders` (lines 16-30): remove the supabase query chain and dedup logic. Replace with:
```python
    folders = fetch_visible_folders(supabase, current_user["id"])
    folders.sort(key=lambda f: f["name"])
    return folders
```

Replace `list_children` (lines 41-54): remove the supabase query chain and dedup logic. Replace with:
```python
    visible = fetch_visible_folders(supabase, current_user["id"])
    children = [f for f in visible if f["parent_id"] == folder_id]
    children.sort(key=lambda f: f["name"])
    return children
```

Fix parent validation in `create_folder` (lines 64-74): replace the `.or_(...)` query block with:
```python
    if body.parent_id:
        visible = fetch_visible_folders(supabase, current_user["id"])
        visible_ids = {f["id"] for f in visible}
        if str(body.parent_id) not in visible_ids:
            raise HTTPException(status_code=404, detail="Parent folder not found")
```

Fix parent validation in `move_folder` (lines 243-253): replace the `.or_(...)` query block with:
```python
    if body.parent_id:
        visible = fetch_visible_folders(supabase, current_user["id"])
        visible_ids = {f["id"] for f in visible}
        if str(body.parent_id) not in visible_ids:
            raise HTTPException(status_code=404, detail="Parent folder not found")
```

**Verify:** `python -m pytest tests/test_folders.py -x -q` passes (or if no test file exists, import check: `python -c "from app.api.folders import router; print('OK')"` from backend/ with venv).

**Done:** `list_folders` and `list_children` return folders in global subtrees for non-owner users. Parent validation no longer uses `is_global.eq.true` filter.

---

## Task 3: Fix `backend/app/api/documents.py` and `backend/app/api/kb.py`

**Files:**
- `backend/app/api/documents.py`
- `backend/app/api/kb.py`

**Action for `documents.py`:**

Add import:
```python
from app.utils.folder_utils import get_globally_visible_folder_ids
```

Replace `list_documents` function body:
```python
    # Own documents
    own_result = (
        supabase.table("documents")
        .select("*")
        .eq("user_id", current_user["id"])
        .execute()
    )
    own_docs = own_result.data or []

    # Documents in globally visible folders (not owned by current user)
    global_folder_ids = get_globally_visible_folder_ids(supabase, current_user["id"])
    global_docs = []
    if global_folder_ids:
        global_result = (
            supabase.table("documents")
            .select("*")
            .in_("folder_id", global_folder_ids)
            .execute()
        )
        global_docs = global_result.data or []

    # Merge, deduplicate by id, sort by created_at desc
    seen: set[str] = set()
    merged: list[dict] = []
    for doc in own_docs + global_docs:
        if doc["id"] not in seen:
            seen.add(doc["id"])
            merged.append(doc)
    merged.sort(key=lambda d: d["created_at"], reverse=True)
    return merged
```

**Action for `kb.py`:**

Add import at top of file (after existing imports):
```python
from app.utils.folder_utils import fetch_visible_folders as _fetch_all_visible_folders, get_globally_visible_folder_ids
```

Replace the body of `_fetch_visible_folders` function (lines 13-26) — keep the function signature, replace the implementation:
```python
def _fetch_visible_folders(supabase: Client, user_id: str) -> list[dict]:
    """Fetch all folders visible to user (owned + in global subtree), deduplicated."""
    return _fetch_all_visible_folders(supabase, user_id)
```

Note: `_fetch_all_visible_folders` returns `"*"` fields already. The existing function selected `"id, user_id, name, parent_id, is_global"` — the utility selects `"*"` which is a superset, so all callers still work.

Fix `ls_path` document query (lines 71-77, root case) — replace `.eq("user_id", user_id)` with visibility-aware query:
```python
        # Root-level docs: own docs with no folder + globally visible folder docs at root
        own_root_docs = (
            supabase.table("documents")
            .select("id, filename, status, created_at")
            .is_("folder_id", "null")
            .eq("user_id", user_id)
            .execute()
        ).data or []
        global_folder_ids = get_globally_visible_folder_ids(supabase, user_id)
        global_root_docs = []
        if global_folder_ids:
            # Root-level means folder_id IS NULL — nothing to add here for global folders
            # Global folder docs appear under their respective folder paths, not root
            pass
        doc_result_data = own_root_docs
        return {"path": "/", "folders": folder_entries, "documents": doc_result_data}
```

Wait — root-level documents with no folder_id are always user-owned (documents in global folders have a folder_id). The root `.eq("user_id", user_id)` for root-level docs (no folder) is actually correct — only own docs can be at root. Keep the root doc query unchanged.

Fix `ls_path` document query for non-root case (lines 88-94): replace `.eq("user_id", user_id)` with:
```python
    # Docs in the target folder visible to this user
    own_docs_in_folder = (
        supabase.table("documents")
        .select("id, filename, status, created_at")
        .eq("folder_id", target["id"])
        .eq("user_id", user_id)
        .execute()
    ).data or []
    global_folder_ids = get_globally_visible_folder_ids(supabase, user_id)
    global_docs_in_folder = []
    if target["id"] in global_folder_ids:
        global_docs_in_folder = (
            supabase.table("documents")
            .select("id, filename, status, created_at")
            .eq("folder_id", target["id"])
            .execute()
        ).data or []
    # Merge, dedup
    seen_ids: set[str] = set()
    doc_data: list[dict] = []
    for d in own_docs_in_folder + global_docs_in_folder:
        if d["id"] not in seen_ids:
            seen_ids.add(d["id"])
            doc_data.append(d)
    return {"path": path, "folders": folder_entries, "documents": doc_data}
```

Fix `tree_path` document query (lines 116-121): replace `.eq("user_id", user_id)` with:
```python
        global_folder_ids_set = set(get_globally_visible_folder_ids(supabase, user_id))
        # Fetch own docs in subtree
        own_docs = (
            supabase.table("documents")
            .select("id, filename, folder_id, status, created_at")
            .in_("folder_id", all_ids)
            .eq("user_id", user_id)
            .execute()
        ).data or []
        # Fetch docs in globally visible folders within subtree
        global_ids_in_subtree = [fid for fid in all_ids if fid in global_folder_ids_set]
        global_docs: list[dict] = []
        if global_ids_in_subtree:
            global_docs = (
                supabase.table("documents")
                .select("id, filename, folder_id, status, created_at")
                .in_("folder_id", global_ids_in_subtree)
                .execute()
            ).data or []
        # Merge, dedup
        seen_ids: set[str] = set()
        all_docs: list[dict] = []
        for d in own_docs + global_docs:
            if d["id"] not in seen_ids:
                seen_ids.add(d["id"])
                all_docs.append(d)
        doc_result_data = all_docs
```
Then replace the `for doc in doc_result.data:` loop to use `doc_result_data` instead of `doc_result.data`.

Fix `glob_path` document query (lines 297-302): replace `.eq("user_id", user_id)` with:
```python
    own_docs = (
        supabase.table("documents")
        .select("id, filename, folder_id")
        .eq("user_id", user_id)
        .execute()
    ).data or []
    global_folder_ids_set = set(get_globally_visible_folder_ids(supabase, user_id))
    global_docs: list[dict] = []
    if global_folder_ids_set:
        global_docs = (
            supabase.table("documents")
            .select("id, filename, folder_id")
            .in_("folder_id", list(global_folder_ids_set))
            .execute()
        ).data or []
    seen_ids: set[str] = set()
    docs: list[dict] = []
    for d in own_docs + global_docs:
        if d["id"] not in seen_ids:
            seen_ids.add(d["id"])
            docs.append(d)
```
Replace `docs = result.data or []` with the above block (remove the old `result = supabase.table...` query).

Fix `read_path` (lines 347-357): replace the query so it also allows reading docs in globally visible folders. Replace the try block:
```python
    try:
        # Try fetching as owner first
        result = (
            supabase.table("documents")
            .select("id, filename, full_markdown")
            .eq("id", document_id)
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
        if not result.data:
            # Check if document is in a globally visible folder
            global_folder_ids = get_globally_visible_folder_ids(supabase, user_id)
            if global_folder_ids:
                result = (
                    supabase.table("documents")
                    .select("id, filename, full_markdown")
                    .eq("id", document_id)
                    .in_("folder_id", global_folder_ids)
                    .maybe_single()
                    .execute()
                )
        if not result.data:
            return {"error": f"Document '{document_id}' not found or access denied."}
    except Exception:
        return {"error": f"Document '{document_id}' not found or access denied."}
```
Remove the old `if not result.data:` guard immediately after (the one that returns error) since it's now inside the try block above.

**Verify:**
- `python -c "from app.api.documents import router; from app.api.kb import router as kr; print('OK')"` from backend/ with venv active.
- `python -m pytest tests/test_kb.py tests/test_documents.py -x -q` if test files exist.

**Done:** Documents in global folder subtrees are returned by `list_documents`, `ls_path`, `tree_path`, `glob_path`, and `read_path` for non-owner users.

---

## Task 4: Fix `backend/app/api/threads.py` and `backend/app/services/sql_service.py`

**Files:**
- `backend/app/api/threads.py`
- `backend/app/services/sql_service.py`

**Action for `threads.py`:**

Add import at top:
```python
from app.utils.folder_utils import fetch_visible_folders
```

Replace the folder subtree resolution block around line 308-313 — find:
```python
            all_folders = (
                supabase.table("folders")
                .select("id, parent_id, name")
                .or_(f"user_id.eq.{current_user['id']},is_global.eq.true")
                .execute()
            ).data or []
```
Replace with:
```python
            all_folders = fetch_visible_folders(supabase, current_user["id"])
```

Note: `fetch_visible_folders` returns `"*"` fields which is a superset of `"id, parent_id, name"`. The downstream `_get_subtree` function and `folder_map` usage only access `id`, `parent_id`, and `name` — all present.

**Action for `sql_service.py`:**

The `_inject_user_id` function has this branch for folders-only queries:
```python
    if has_folders and not has_documents:
        condition = f"(folders.user_id = '{user_id}' OR folders.is_global = true)"
```

This is only reached if someone queries the `folders` table directly via `query_documents`. Update to accept an optional `global_folder_ids` parameter and use it if provided.

Change `_inject_user_id` signature:
```python
def _inject_user_id(sql: str, user_id: str, global_folder_ids: list[str] | None = None) -> str:
```

Change the folders-only branch:
```python
    if has_folders and not has_documents:
        if global_folder_ids:
            ids_list = ", ".join(f"'{fid}'" for fid in global_folder_ids)
            condition = f"(folders.user_id = '{user_id}' OR folders.id IN ({ids_list}))"
        else:
            condition = f"folders.user_id = '{user_id}'"
```

Update `query_documents` to compute and pass `global_folder_ids`:

Add import at top of `sql_service.py` (inside TYPE_CHECKING block or direct import):
```python
from app.utils.folder_utils import get_globally_visible_folder_ids
```

In `query_documents`, before `scoped = _inject_user_id(clean, user_id)`, add:
```python
    global_folder_ids = get_globally_visible_folder_ids(supabase, user_id)
    scoped = _inject_user_id(clean, user_id, global_folder_ids)
```
Remove the old `scoped = _inject_user_id(clean, user_id)` line.

**Verify:**
- `python -c "from app.services.sql_service import query_documents; from app.api.threads import router; print('OK')"` from backend/ with venv active.
- `python -m pytest tests/test_sql_service.py tests/test_threads.py -x -q` if test files exist.

**Done:** `threads.py` folder subtree resolution includes global sub-folders. `sql_service.py` folder-only queries include globally visible folder IDs.

---

## Validation

After all tasks complete, perform end-to-end smoke test:

1. Start backend: `cd backend && source venv/bin/activate && uvicorn app.main:app --reload`
2. As User A: create a folder, mark it global, upload a document inside it, create a subfolder inside it.
3. As User B: call `GET /folders` — should see User A's global folder AND its subfolder.
4. As User B: call `GET /documents` — should see the document in User A's global folder.
5. As User B: call `GET /kb/ls?path=/` — should show User A's global folder at root.
6. As User B: call `GET /kb/ls?path=/{folder_name}` — should show the subfolder and document.
7. As User B: call `GET /kb/tree?path=/` — should include User A's global folder, subfolder, and document.
8. As User B: call `GET /kb/read?document_id={id}` — should return document content.

All steps should succeed without 404 or empty results.
