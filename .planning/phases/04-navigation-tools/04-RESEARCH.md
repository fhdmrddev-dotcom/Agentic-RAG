# Phase 4: Navigation Tools - Research

**Researched:** 2026-03-21
**Domain:** FastAPI backend tools — folder traversal, path resolution, tree rendering
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TOOL-01 | Agent can use `ls(path)` to list files and subfolders in a folder | Path-to-folder resolution pattern defined; direct children query already exists as `GET /folders/{id}/children` |
| TOOL-02 | Agent can use `tree(path, depth?, limit?)` to get hierarchical structure with depth limit and truncation | BFS traversal pattern already in `delete_folder`; depth-limited variant is a straightforward extension |
</phase_requirements>

---

## Summary

Phase 4 adds two backend API endpoints — `GET /kb/ls` and `GET /kb/tree` — that let the agent navigate the folder structure using human-readable path strings (e.g., `/reports/q1`). The database schema (adjacency list with `parent_id`) and RLS policies are fully in place from Phase 1. No schema migration is required for this phase.

The core new work is **path resolution**: translating a string like `/reports/q1` into a folder UUID, then querying children (for `ls`) or recursively traversing descendants (for `tree`). Neither concept exists in the current codebase as a backend utility. The `buildFolderTree` frontend utility and `delete_folder` BFS traversal in the backend provide clear, battle-tested reference patterns for the logic needed here.

`tree` output must be capped by a caller-supplied `depth` parameter (default: no limit) to protect context windows. Truncation must emit a clear `"... (N more items)"` indicator at the cut-off point. The `GET /folders` endpoint that fetches all visible folders provides a natural basis for an efficient single-query approach: fetch all visible folders once, assemble the tree in Python, then prune by path and depth.

**Primary recommendation:** Implement `ls` and `tree` as new endpoints under a `/kb` router prefix. Use a single all-folders fetch + in-process assembly (mirrors the frontend `buildFolderTree` approach) rather than per-level DB round-trips. This avoids N+1 queries on deep trees and keeps the implementation straightforward and testable.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| fastapi | 0.115.6 | API endpoints | Already in use across all API modules |
| supabase-py | 2.10.0 | DB queries (Postgres via Supabase client) | Already in use; service role key bypasses RLS for internal resolution |
| pydantic | bundled with fastapi | Response models | Already in use for all responses |
| pytest | 8.x | Test framework | Already configured in `backend/pytest.ini` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| httpx | 0.27.0 | FastAPI TestClient transport | Already in requirements.txt |

**No new dependencies are required for this phase.**

**Installation:** No `pip install` needed — all dependencies already present.

---

## Architecture Patterns

### Recommended Project Structure

New files for this phase:

```
backend/app/
├── api/
│   ├── kb.py                  # NEW: /kb router — ls and tree endpoints
├── models/
│   ├── kb.py                  # NEW: LsResponse, TreeNode, TreeResponse
tests/
├── integration/
│   ├── test_kb.py             # NEW: integration tests for /kb endpoints
```

The router is registered in `app/main.py` alongside the existing `folders`, `documents`, `threads`, and `settings` routers.

### Pattern 1: Single-Fetch Tree Assembly

**What:** Fetch all folders visible to the user in one query, build an in-memory tree, then find the target node by path.
**When to use:** Always preferred over per-level DB round-trips. The folder count per user is small enough to hold in memory.

**Example:**
```python
# Fetch all visible folders once
result = (
    supabase.table("folders")
    .select("id, user_id, name, parent_id, is_global")
    .or_(f"user_id.eq.{current_user['id']},is_global.eq.true")
    .execute()
)
folders = result.data  # flat list, deduplicate by id

# Build id → node map
nodes: dict[str, dict] = {}
for f in folders:
    if f["id"] not in nodes:
        nodes[f["id"]] = {**f, "children": [], "documents": []}

# Link parent → child
roots = []
for node in nodes.values():
    pid = node["parent_id"]
    if pid and pid in nodes:
        nodes[pid]["children"].append(node)
    else:
        roots.append(node)
```

### Pattern 2: Path Resolution

**What:** Walk a `/`-delimited path string segment by segment through the in-memory tree, starting at roots.
**When to use:** Both `ls` and `tree` accept a path string; this function is shared by both.

```python
def resolve_path(path: str, nodes: dict, roots: list) -> dict | None:
    """Return the node at the given path, or None if not found."""
    # Normalize: strip leading/trailing slashes, split on "/"
    segments = [s for s in path.strip("/").split("/") if s]
    if not segments:
        return None  # root is a special case — callers handle it directly

    current_level = roots
    current_node = None
    for segment in segments:
        match = next((n for n in current_level if n["name"].lower() == segment.lower()), None)
        if match is None:
            return None  # path not found
        current_node = match
        current_level = match["children"]
    return current_node
```

**Root path handling:** `ls(path="/")` and `tree(path="/")` operate on the collection of root-level folders (parent_id is NULL). Callers treat `"/"` as a special token rather than resolving it through the tree.

### Pattern 3: Depth-Limited Tree Serialization

**What:** Recursively serialize a node and its descendants, stopping at `max_depth`. Emit a `"..."` truncation indicator when children are cut off.
**When to use:** `tree` endpoint only.

```python
def serialize_tree(node: dict, current_depth: int, max_depth: int | None) -> dict:
    if max_depth is not None and current_depth >= max_depth:
        truncated = len(node["children"]) + len(node["documents"]) > 0
        return {
            "id": node["id"],
            "name": node["name"],
            "type": "folder",
            "is_global": node["is_global"],
            "children": [],
            "documents": [],
            "truncated": truncated,
        }
    return {
        "id": node["id"],
        "name": node["name"],
        "type": "folder",
        "is_global": node["is_global"],
        "children": [serialize_tree(c, current_depth + 1, max_depth) for c in node["children"]],
        "documents": node["documents"],
        "truncated": False,
    }
```

### Pattern 4: Fetching Documents at a Path

**What:** For `ls`, list immediate documents whose `folder_id` equals the target folder's id. For `tree`, fetch all documents in the subtree.
**When to use:** Always include documents in ls/tree output so the agent sees both files and subfolders at each level.

```python
# For ls: documents in exactly this folder
docs = (
    supabase.table("documents")
    .select("id, filename, folder_id, status, created_at")
    .eq("folder_id", folder_id)
    .eq("user_id", current_user["id"])
    .execute()
)

# For tree: documents anywhere in the subtree
# Collect all descendant folder ids first, then query in_()
all_folder_ids = collect_all_ids(target_node)  # BFS/DFS
docs = (
    supabase.table("documents")
    .select("id, filename, folder_id, status, created_at")
    .in_("folder_id", all_folder_ids)
    .eq("user_id", current_user["id"])
    .execute()
)
```

**RLS note:** Documents are owned per-user; there are no global documents (only global folders). The `.eq("user_id", current_user["id"])` filter is sufficient.

### Pattern 5: Root-Level ls and tree

`ls(path="/")` returns all root-level folders (nodes with `parent_id == None`) plus root-level documents (`folder_id == None`).

```python
root_folders = [n for n in nodes.values() if n["parent_id"] is None]
root_docs_result = (
    supabase.table("documents")
    .select("id, filename, folder_id, status, created_at")
    .is_("folder_id", "null")
    .eq("user_id", current_user["id"])
    .execute()
)
```

### Anti-Patterns to Avoid

- **Per-level DB queries (N+1):** Fetching children for each node in a separate query produces N+1 round-trips. The single-fetch + in-process assembly eliminates this.
- **Case-sensitive path matching:** Folder names are user-defined; path segment matching must be case-insensitive (`name.lower() == segment.lower()`).
- **Unlimited tree depth in response:** A deeply nested tree with many documents can produce a massive response. Always apply the `max_depth` cap; default should be `None` (unlimited) but the agent must pass `depth` when working with large knowledge bases.
- **Exposing `full_markdown` in tree output:** `full_markdown` is large; tree/ls responses should include only lightweight fields (`id`, `filename`, `status`, `created_at`).
- **Forgetting root documents:** Documents with `folder_id = NULL` exist (they are root-level). `ls("/")` must include them.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tree assembly from flat list | Custom recursive SQL CTE | Python in-process assembly | The existing `buildFolderTree` pattern is already proven; adjacency list + Python is simpler than recursive CTEs and avoids Supabase query builder limitations |
| RLS enforcement | Custom ownership checks | The existing `.or_(f"user_id.eq.{user_id},is_global.eq.true")` pattern | Already established and tested in Phase 1; replicate exactly |
| Deduplication | Custom set logic | Same deduplicate-by-id pattern from `GET /folders` | Already handles the owned-and-global overlap edge case |

**Key insight:** The existing delete_folder BFS traversal and the frontend buildFolderTree are near-complete references for the Python tree logic. Do not invent a different approach.

---

## Common Pitfalls

### Pitfall 1: Path Not Found vs. Empty Folder
**What goes wrong:** Returning a 404 when a path resolves to a folder that exists but has no children or documents (empty folder). The agent gets an error instead of an empty list.
**Why it happens:** Conflating "path segment not found" with "folder is empty."
**How to avoid:** Resolve path first; only raise 404 if a path segment yields no matching folder. An empty folder returns `{"folders": [], "documents": []}` with 200.
**Warning signs:** Tests fail with 404 on valid empty folder paths.

### Pitfall 2: Root-Level Documents Excluded from ls("/")
**What goes wrong:** `ls("/")` returns only root folders but omits documents whose `folder_id IS NULL`.
**Why it happens:** Documents with `folder_id = NULL` are logically "at the root" but a naive query filters by `folder_id = NULL` using `.eq()`, which works, but `.is_("folder_id", "null")` is the correct Supabase client syntax for IS NULL.
**How to avoid:** Use `.is_("folder_id", "null")` for the root documents query. Verify with a test that uploads a document with no folder and checks it appears in `ls("/")`.
**Warning signs:** Root document count is always 0 in ls output.

### Pitfall 3: or_() Breaks Mock Chain
**What goes wrong:** Integration tests fail because `.or_()` on the mock builder returns a new MagicMock rather than `_builder`, so `.execute()` gets called on the new mock and returns a MagicMock (truthy) instead of the configured result.
**Why it happens:** Established in Phase 1 (documented in STATE.md). Default MagicMock chaining creates new mocks per attribute access.
**How to avoid:** In any test that exercises a code path using `.or_()`, add `mock_builder.or_.return_value = mock_builder` before the request.
**Warning signs:** Tests that should return empty lists return 200 with unexpected data, or tests that should get 404 get 200.

### Pitfall 4: `in_()` with Empty List
**What goes wrong:** `supabase.table(...).in_("folder_id", []).execute()` may return all rows or raise an error depending on Supabase client version, rather than returning an empty set.
**Why it happens:** An empty `IN ()` clause is invalid SQL. The supabase-py client may or may not guard against this.
**How to avoid:** Guard every `in_()` call: `if not id_list: return []` before issuing the query. Add a test covering the zero-subfolder case.
**Warning signs:** `tree` on a leaf folder returns unexpected document rows.

### Pitfall 5: Depth Parameter Off-By-One
**What goes wrong:** `tree(path="/reports", depth=1)` returns no children when it should return immediate children (depth 1 = one level below the named folder).
**Why it happens:** Ambiguity between "depth from root" vs. "depth from target folder." The convention should be: depth=1 means include direct children of the target; depth=2 includes grandchildren.
**How to avoid:** Define depth as "levels below the target" (not absolute depth from root). Document this convention in the Pydantic model docstring and test it explicitly.
**Warning signs:** Planner-level ambiguity; test for `depth=1` returns only the folder itself with no children.

### Pitfall 6: Supabase `.is_()` Syntax for NULL Check
**What goes wrong:** `.eq("folder_id", None)` does not generate `IS NULL`; it generates `folder_id = NULL` which matches nothing in SQL.
**Why it happens:** SQL distinguishes `= NULL` (always false) from `IS NULL`. The Supabase Python client has a dedicated `.is_()` method for this.
**How to avoid:** Always use `.is_("folder_id", "null")` (string `"null"`, not Python `None`) for IS NULL checks.
**Warning signs:** Root document queries always return empty.

---

## Code Examples

### ls Response Model
```python
# backend/app/models/kb.py
from pydantic import BaseModel
from uuid import UUID
from datetime import datetime

class DocumentEntry(BaseModel):
    id: UUID
    filename: str
    status: str
    created_at: datetime

class FolderEntry(BaseModel):
    id: UUID
    name: str
    is_global: bool

class LsResponse(BaseModel):
    path: str
    folders: list[FolderEntry]
    documents: list[DocumentEntry]

class TreeNode(BaseModel):
    id: UUID
    name: str
    type: str  # "folder"
    is_global: bool
    truncated: bool
    children: list["TreeNode"]
    documents: list[DocumentEntry]

TreeNode.model_rebuild()  # Required for self-referential Pydantic model

class TreeResponse(BaseModel):
    path: str
    depth: int | None
    tree: list[TreeNode]  # list to handle root ("/") returning multiple nodes
```

### Endpoint Signatures
```python
# backend/app/api/kb.py
from fastapi import APIRouter, Depends, HTTPException, Query
from app.dependencies import get_current_user, get_supabase

router = APIRouter(prefix="/kb", tags=["kb"])

@router.get("/ls", response_model=LsResponse)
async def ls(
    path: str = Query(default="/", description="Folder path, e.g. /reports/q1"),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    ...

@router.get("/tree", response_model=TreeResponse)
async def tree(
    path: str = Query(default="/", description="Folder path, e.g. /reports"),
    depth: int | None = Query(default=None, ge=1, description="Max depth; omit for unlimited"),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    ...
```

### Self-Referential Pydantic Model (Python 3.10+)
```python
# Pydantic v2 requires model_rebuild() after defining self-referential models
class TreeNode(BaseModel):
    ...
    children: list["TreeNode"]

TreeNode.model_rebuild()
```
**Source:** Pydantic v2 documentation on recursive models.

### Test: or_() Mock Pattern (from STATE.md Phase 01 decisions)
```python
def test_ls_returns_folders(client, auth_headers, mock_builder, mock_execute_result):
    mock_builder.or_.return_value = mock_builder  # Required for or_() chains
    mock_execute_result.data = [...]
    response = client.get("/kb/ls?path=/", headers=auth_headers)
    assert response.status_code == 200
```

### Main App Registration
```python
# backend/app/main.py — add after existing routers
from app.api import kb
app.include_router(kb.router)
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-level recursive SQL CTE for tree | Application-level assembly from flat fetch | Standard practice for adjacency lists in Python ORMs | Simpler code, no recursive SQL complexity |
| Pydantic v1 `update_forward_refs()` | Pydantic v2 `model_rebuild()` | Pydantic v2 (bundled with FastAPI 0.100+) | Must use `model_rebuild()` for self-referential models |

**Deprecated/outdated:**
- `update_forward_refs()`: Pydantic v1 method for self-referential models. Use `model_rebuild()` in Pydantic v2.

---

## Open Questions

1. **`limit` parameter from REQUIREMENTS.md TOOL-02 signature**
   - What we know: REQUIREMENTS.md lists `tree(path, depth?, limit?)`. The roadmap success criteria only test `depth`. The success criteria do not describe what `limit` limits (total nodes? nodes per level? total documents?).
   - What's unclear: Whether `limit` should be implemented in Phase 4 or deferred.
   - Recommendation: Implement `depth` only in Phase 4 (maps directly to success criteria 3). Add `limit` as a query parameter stub that is accepted but ignored, or defer to Phase 5+. The planner should decide and note the decision.

2. **Case sensitivity for path segment matching**
   - What we know: Folder names are user-defined strings. The DB stores them as-is with no normalization.
   - What's unclear: Whether `/reports` and `/Reports` should resolve to the same folder.
   - Recommendation: Use case-insensitive matching for path resolution (`.lower()` comparison in Python). This is more user-friendly for agent usage and avoids hard-to-debug 404s from mixed-case paths.

3. **Documents in `tree` output for intermediate nodes**
   - What we know: The success criteria describe `tree` as showing "hierarchical structure showing all descendants." This could mean folders only or folders + documents at every level.
   - What's unclear: Whether documents should appear in the tree at every node or only at leaf nodes.
   - Recommendation: Include documents at every node level (same as how a filesystem `tree` shows files alongside subdirectories). This gives the agent full picture per node without a separate ls call.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest 8.x + pytest-asyncio 0.24.0 |
| Config file | `backend/pytest.ini` |
| Quick run command | `cd backend && python -m pytest tests/integration/test_kb.py -x -q` |
| Full suite command | `cd backend && python -m pytest tests/ -q` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TOOL-01 | `GET /kb/ls?path=/` returns root folders and root documents | integration | `pytest tests/integration/test_kb.py::TestLs::test_ls_root -x` | ❌ Wave 0 |
| TOOL-01 | `GET /kb/ls?path=/reports` returns immediate children only | integration | `pytest tests/integration/test_kb.py::TestLs::test_ls_subfolder -x` | ❌ Wave 0 |
| TOOL-01 | `GET /kb/ls?path=/nonexistent` returns 404 | integration | `pytest tests/integration/test_kb.py::TestLs::test_ls_not_found -x` | ❌ Wave 0 |
| TOOL-01 | `GET /kb/ls` on empty folder returns 200 with empty lists | integration | `pytest tests/integration/test_kb.py::TestLs::test_ls_empty_folder -x` | ❌ Wave 0 |
| TOOL-01 | RLS: ls does not return folders not visible to user | integration | `pytest tests/integration/test_kb.py::TestLs::test_ls_rls -x` | ❌ Wave 0 |
| TOOL-02 | `GET /kb/tree?path=/` returns full hierarchy | integration | `pytest tests/integration/test_kb.py::TestTree::test_tree_root -x` | ❌ Wave 0 |
| TOOL-02 | `GET /kb/tree?path=/reports&depth=2` truncates at depth 2 with truncated=true indicator | integration | `pytest tests/integration/test_kb.py::TestTree::test_tree_depth_truncation -x` | ❌ Wave 0 |
| TOOL-02 | `GET /kb/tree?path=/nonexistent` returns 404 | integration | `pytest tests/integration/test_kb.py::TestTree::test_tree_not_found -x` | ❌ Wave 0 |
| TOOL-02 | RLS: tree does not expose private folders of other users | integration | `pytest tests/integration/test_kb.py::TestTree::test_tree_rls -x` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd backend && python -m pytest tests/integration/test_kb.py -x -q`
- **Per wave merge:** `cd backend && python -m pytest tests/ -q`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `backend/tests/integration/test_kb.py` — covers all TOOL-01 and TOOL-02 tests (9 test cases above)
- [ ] `backend/app/api/kb.py` — the implementation file
- [ ] `backend/app/models/kb.py` — LsResponse, TreeNode, TreeResponse Pydantic models

*(No new pytest fixtures needed — existing `conftest.py` with `client`, `auth_headers`, `mock_builder`, `mock_execute_result` covers all patterns needed. The `or_()` mock fix pattern is already documented in conftest and STATE.md.)*

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: `backend/app/api/folders.py` — existing RLS patterns, BFS traversal, or_() usage
- Direct codebase inspection: `backend/app/api/documents.py` — document query patterns, is_() vs eq() for NULL
- Direct codebase inspection: `frontend/src/lib/folderTree.ts` — flat-list to tree assembly reference
- Direct codebase inspection: `backend/tests/conftest.py` — mock patterns for new tests
- Direct codebase inspection: `backend/supabase/migrations/013_folders.sql` and `014_document_folder_integration.sql` — confirmed schema
- Direct codebase inspection: `backend/requirements.txt` and `pytest.ini` — confirmed stack versions
- STATE.md `## Accumulated Context` — confirmed `or_()` mock pitfall and tree truncation design decision

### Secondary (MEDIUM confidence)
- Pydantic v2 self-referential models: `model_rebuild()` required — verified by knowledge of pydantic v2 API (fastapi 0.115.6 bundles pydantic v2)

### Tertiary (LOW confidence)
- Supabase Python client `.is_("folder_id", "null")` syntax for IS NULL — based on training knowledge of supabase-py; verify against supabase-py 2.10.0 docs if behavior is unexpected in testing

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies verified directly in requirements.txt
- Architecture: HIGH — patterns derived directly from existing codebase code that already works
- Pitfalls: HIGH — most derived from STATE.md documented Phase 1–3 lessons; one (Pitfall 6 `.is_()`) is MEDIUM pending live test confirmation

**Research date:** 2026-03-21
**Valid until:** 2026-06-21 (stable stack; no external dependencies changing)
