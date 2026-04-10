---
phase: quick
plan: 260328-wqj
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/app/api/threads.py
  - backend/app/services/sql_service.py
autonomous: true
must_haves:
  truths:
    - "Folder-scoped chat ls/tree defaults to the scoped folder path (not root)"
    - "Folder-scoped chat query_documents SQL results are limited to documents in the scoped folder subtree"
    - "Folder-scoped chat glob results are limited to the scoped folder subtree"
    - "Folder-scoped chat search_documents results are limited to the scoped folder subtree (already working)"
    - "LLM system prompt tells the model it is folder-scoped so it generates appropriately scoped queries"
  artifacts:
    - path: "backend/app/api/threads.py"
      provides: "Folder-scope-aware system prompt injection and tool dispatch"
    - path: "backend/app/services/sql_service.py"
      provides: "Folder-subtree-scoped SQL injection"
  key_links:
    - from: "threads.py tool dispatch"
      to: "query_documents"
      via: "folder_subtree_ids parameter"
      pattern: "query_documents.*folder"
    - from: "threads.py tool dispatch"
      to: "glob_path"
      via: "scoped_folder_path parameter"
      pattern: "glob_path.*folder"
---

<objective>
Fix folder-scoped chat returning results from ALL folders instead of only the selected folder's subtree.

Purpose: When a user opens a chat thread scoped to a specific folder, all tool calls (ls, tree, grep, glob, query_documents, search_documents) should restrict results to that folder and its subfolders. Currently only search_documents passes folder_subtree_ids; the other tools either default to root or query all documents.

Output: Patched threads.py and sql_service.py so folder-scoped chat correctly restricts all tool results.
</objective>

<context>
@backend/app/api/threads.py
@backend/app/services/sql_service.py
@backend/app/api/kb.py (glob_path function)

## Root Cause Analysis

The bug has THREE causes in `backend/app/api/threads.py`:

1. **System prompt is not folder-aware.** The LLM receives the generic SYSTEM_PROMPT regardless of folder scope. When a user asks "what documents do you have?", the LLM generates an unscoped SQL query like `SELECT filename FROM documents` or calls `ls` with path="/". It has no idea it should restrict to a folder.

2. **`query_documents` (SQL tool) is never folder-scoped.** Line 380: `query_documents(args["query"], current_user["id"], supabase)` — no folder_subtree_ids passed. The `_inject_user_id` function in sql_service.py only injects user_id, not folder scope.

3. **`glob_path` is never folder-scoped.** Line 359: `glob_path(args.get("pattern", ""), current_user["id"], supabase)` — no folder scope passed. glob_path fetches ALL user documents.

Tools that ARE already correctly scoped:
- `ls` / `tree` / `grep` — default path falls back to `scoped_folder_path` (correct)
- `search_documents` — passes `folder_ids=folder_subtree_ids` (correct)

Tools that are NOT scoped but are acceptable:
- `read_document` — reads by document_id, no folder concept needed
- `analyze_document` — resolves by filename, acceptable to find across folders
- `web_search` — not document-related
</context>

<tasks>

<task type="auto">
  <name>Task 1: Inject folder scope into system prompt and fix query_documents + glob dispatch</name>
  <files>backend/app/api/threads.py, backend/app/services/sql_service.py</files>
  <action>
Three changes:

**A. Augment system prompt with folder scope context (threads.py, around line 267)**

After selecting `active_system_prompt` (line 263), if `scoped_folder_path` is not None, append a folder-scope instruction to the system prompt:

```python
if scoped_folder_path:
    folder_scope_note = (
        f"\n\n**IMPORTANT: This chat is scoped to the folder '{scoped_folder_path}'. "
        f"All tool calls should be restricted to this folder and its subfolders. "
        f"When using ls, tree, or grep, default the path to '{scoped_folder_path}'. "
        f"When using query_documents, always include a folder filter (e.g., "
        f"JOIN folders or WHERE folder_id IN ...) to restrict to this folder scope. "
        f"When the user asks 'what documents do you have?' or similar, they mean within this folder scope only.**"
    )
    active_system_prompt = active_system_prompt + folder_scope_note
```

**B. Add folder_subtree_ids to query_documents call (threads.py, line 379-380)**

Change the query_documents dispatch to pass folder_subtree_ids:

```python
elif tool_name == "query_documents":
    tool_result = query_documents(args["query"], current_user["id"], supabase, folder_ids=folder_subtree_ids)
```

Update sql_service.py `query_documents` to accept and inject folder scope:

In `query_documents()`, add `folder_ids: list[str] | None = None` parameter. After the `_inject_user_id` call, if `folder_ids` is not None, call a new `_inject_folder_scope` that adds `AND documents.folder_id IN ('{id1}', '{id2}', ...)` to the scoped query. The injection logic should:
- If the query has documents table reference, inject `documents.folder_id IN (...)`
- If the query only has folders table, inject `folders.id IN (...)`
- Use the same WHERE-insertion strategy as `_inject_user_id`: find existing WHERE and append AND, or insert before ORDER BY/GROUP BY/LIMIT, or append at end.

Implementation for `_inject_folder_scope`:
```python
def _inject_folder_scope(sql: str, folder_ids: list[str]) -> str:
    """Inject folder_id IN (...) filter to restrict to a folder subtree."""
    if not folder_ids:
        return sql
    ids_list = ", ".join(f"'{fid}'" for fid in folder_ids)
    has_documents = bool(re.search(r"\bdocuments\b", sql, re.IGNORECASE))
    has_folders = bool(re.search(r"\bfolders\b", sql, re.IGNORECASE))
    if has_folders and not has_documents:
        condition = f"folders.id IN ({ids_list})"
    else:
        condition = f"documents.folder_id IN ({ids_list})"
    # Already has WHERE (from _inject_user_id) — append AND
    if re.search(r"\bwhere\b", sql, re.IGNORECASE):
        # Find last WHERE (user_id injection puts it first) and append
        return sql.rstrip() + f" AND {condition}"
    return sql + f" WHERE {condition}"
```

Note: Since `_inject_user_id` always adds a WHERE clause, by the time `_inject_folder_scope` runs, there will always be a WHERE clause already. So the simple "append AND" path will be the one taken.

**C. Scope glob_path call (threads.py, line 358-360)**

The `glob_path` function in kb.py currently fetches all documents. Rather than modifying `glob_path`'s signature (which would be a larger change), filter results by folder_subtree_ids in the dispatch:

```python
elif tool_name == "glob":
    result = glob_path(args.get("pattern", ""), current_user["id"], supabase)
    # Scope glob results to folder subtree if thread is folder-scoped
    if folder_subtree_ids is not None and "matches" in result:
        result["matches"] = [
            m for m in result["matches"]
            if m.get("folder_id") in folder_subtree_ids or (m.get("folder_id") is None and False)
        ]
        result["count"] = len(result["matches"])
    tool_result = json.dumps(result)
```

Wait -- let me check what glob_path returns. Looking at kb.py line 323, each match has `folder_id`. So filter matches where `folder_id` is in `folder_subtree_ids`. Documents at root (folder_id=None) should be EXCLUDED when folder-scoped since they're not in any folder subtree.
  </action>
  <verify>
    <automated>cd "C:/Vibe Apps/Agentic RAG/backend" && python -c "
from app.services.sql_service import _inject_folder_scope, _inject_user_id
# Test 1: folder scope on documents query
sql = 'SELECT filename FROM documents'
scoped = _inject_user_id(sql, 'user123')
scoped = _inject_folder_scope(scoped, ['folder-a', 'folder-b'])
assert 'folder_id IN' in scoped, f'Missing folder filter: {scoped}'
assert 'user_id' in scoped, f'Missing user filter: {scoped}'
print('PASS: folder scope injection works')

# Test 2: no folder_ids = no change
sql2 = _inject_folder_scope(scoped, [])
assert sql2 == scoped, 'Empty list should not change query'
print('PASS: empty folder_ids is no-op')

# Test 3: folders-only query
sql3 = 'SELECT name FROM folders'
scoped3 = _inject_user_id(sql3, 'user123')
scoped3 = _inject_folder_scope(scoped3, ['folder-a'])
assert 'folders.id IN' in scoped3, f'Should use folders.id: {scoped3}'
print('PASS: folders-only query uses folders.id')
print('ALL TESTS PASSED')
"</automated>
  </verify>
  <done>
    - Folder-scoped chat system prompt includes folder scope instruction so LLM generates appropriately scoped queries
    - query_documents injects folder_id IN (...) filter when folder_subtree_ids is provided
    - glob results are filtered to folder subtree when thread is folder-scoped
    - All three root causes addressed: LLM awareness, SQL scoping, glob scoping
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Fixed folder-scoped chat to restrict all tool results to the scoped folder's subtree</what-built>
  <how-to-verify>
    1. Start the backend: `cd backend && python -m uvicorn app.main:app --reload`
    2. Open the app in browser
    3. Create or select a folder with a known number of documents (e.g., "Folder 1" with 1 document)
    4. Open/create a chat thread scoped to that folder
    5. Ask: "what documents do you have?"
    6. Expected: Only documents in that folder are listed (e.g., 1 document), NOT all documents across all folders
    7. Ask: "list my files" or use ls — should show only the scoped folder contents
    8. Try a glob query like "find all PDFs" — should only return PDFs within the scoped folder
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>

</tasks>

<verification>
- `_inject_folder_scope` unit test passes (inline verification command)
- Folder-scoped chat thread restricts ls/tree/grep/glob/query_documents/search_documents to folder subtree
- Non-folder-scoped chat threads continue to work normally (folder_subtree_ids is None, no filtering applied)
</verification>

<success_criteria>
When a user opens a folder-scoped chat and asks "what documents do you have?", only documents within that folder (and its subfolders) are returned — not documents from other folders or root.
</success_criteria>
