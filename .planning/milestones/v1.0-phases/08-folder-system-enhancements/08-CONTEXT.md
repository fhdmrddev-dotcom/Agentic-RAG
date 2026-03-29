# Phase 8: Folder System Enhancements - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning
**Source:** Design doc (260328-v6n LARGER-FEATURES-DESIGN.md) + user decisions

<domain>
## Phase Boundary

Three folder-system enhancements that build on each other and must be delivered together as a coherent phase:

1. **Global folder UI toggle + document RLS** — Folder owners can toggle `is_global` from the UI. When a folder is global, its documents become readable by all authenticated users via an updated RLS policy.
2. **Folder-scoped chat** — Users can create chat threads scoped to a specific folder. RAG retrieval in those threads is restricted to documents in that folder and all its subfolders (recursive). Scope is fixed at thread creation.
3. **Folder detail info bar** — Selecting a folder in the ingestion UI shows a compact stats bar (doc count, total size, global badge, creation date) between the breadcrumb and document list.

</domain>

<decisions>
## Implementation Decisions

### Global Folder Semantics (Issue 7)
- **Option B confirmed**: Marking a folder `is_global = true` exposes the folder structure AND its documents to all authenticated users
- Documents in global folders bypass the `user_id` RLS filter — ownership is preserved (uploader remains owner) but visibility is extended
- New RLS policy required on `documents` table:
  ```sql
  CREATE POLICY "Users can read documents in global folders"
  ON documents FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM folders
      WHERE folders.id = documents.folder_id
      AND folders.is_global = true
    )
  );
  ```
- New backend endpoint: `PATCH /folders/{id}/toggle-global` — flips `is_global`, returns updated folder; only folder owner can toggle
- Frontend: Add "Make global" checkbox in `FolderCreateInput`; add "Toggle global" option in `FolderTree` context menu; confirm Globe icon shows for `is_global=true` folders; add tooltip explaining semantics

### Folder-Scoped Chat Scope (Issue 9)
- **Recursive scope confirmed**: When a thread is scoped to a folder, retrieval includes that folder AND all its subfolders recursively
- **Fixed at creation confirmed**: Folder scope cannot be changed after thread creation; user creates a new thread to change scope
- DB: Add `folder_id UUID REFERENCES folders(id) ON DELETE SET NULL` to `threads` table (ON DELETE SET NULL so thread survives folder deletion, reverts to unscoped)
- DB: Update `match_document_chunks` RPC to accept `p_folder_id uuid DEFAULT NULL` and join-filter on `documents.folder_id` using the recursive folder subtree
- Backend: `POST /threads` accepts optional `folder_id`; thread record stores it; `GET /threads` and `GET /threads/{id}` return it
- Backend: Retrieval service `search_documents()` accepts `folder_id` and passes it through to the RPC
- Backend: Tool dispatch in `threads.py` passes thread's `folder_id` to all tool calls (search, ls, tree, grep, glob auto-scope to folder subtree)
- Frontend: New thread creation dialog shows optional folder picker (uses existing `useFolders` hook)
- Frontend: Scoped threads show folder badge in sidebar thread list and `Scoped to: [folder name]` badge in chat header
- Frontend: Add `folder_id: string | null` to `Thread` interface in `types/index.ts`

### Folder Appearance (Issue 8)
- **Option C confirmed**: Folder detail info bar (non-disruptive, no layout change)
- New component `FolderDetail.tsx` renders between `FolderBreadcrumb` and `DocumentUpload` in `IngestionPage`
- Props: `folder: Folder`, `documents: Document[]` (already loaded), `subfolderCount: number` (derived from folders list)
- Shows: folder name (as heading), doc count, total size, global badge, subfolder count, creation date
- No new backend endpoints needed — data derives from already-loaded lists

### Claude's Discretion
- Exact UI styling for scope badge and global toggle (must follow existing shadcn/Tailwind patterns)
- Whether to show the folder picker as a dropdown in the new-thread form or as a separate modal step
- Error handling for toggle-global when user is not the folder owner (403 → toast)
- Recursive subfolder resolution strategy for RPC (use adjacency list recursion via `WITH RECURSIVE` CTE or resolve folder subtree in Python before querying)

</decisions>

<specifics>
## Specific Ideas

### RPC update for recursive folder scope
Option A — Resolve subtree in Python, pass array of folder IDs to RPC:
```python
# backend: get all descendant folder IDs
def get_folder_subtree(folder_id, all_folders):
    result = [folder_id]
    for f in all_folders:
        if f["parent_id"] == folder_id:
            result.extend(get_folder_subtree(f["id"], all_folders))
    return result
```
Then pass `p_folder_ids uuid[]` to RPC and use `d.folder_id = ANY(p_folder_ids)`.

Option B — SQL recursive CTE inside RPC (no Python change):
```sql
WITH RECURSIVE subtree AS (
  SELECT id FROM folders WHERE id = p_folder_id
  UNION ALL
  SELECT f.id FROM folders f JOIN subtree s ON f.parent_id = s.id
)
SELECT ... WHERE d.folder_id IN (SELECT id FROM subtree)
```

Both work. Option A (Python subtree resolution) is simpler to test and avoids RPC signature complexity.

### Thread creation UI
The folder picker should default to "No folder (all documents)" and list all user's folders + global folders using the existing `useFolders` hook data. A simple `<Select>` dropdown (shadcn) is sufficient — no modal needed.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing folder system
- `backend/app/api/folders.py` — Current folder CRUD; toggle-global endpoint goes here
- `backend/app/api/documents.py` — Current RLS-aware document queries; duplicate check pattern
- `backend/app/services/retrieval_service.py` — `search_documents()` signature to extend with `folder_id`
- `backend/app/api/threads.py` — Agentic loop and tool dispatch; `folder_id` threading goes here
- `frontend/src/hooks/useFolders.ts` — Folder state hook; `createFolder` already accepts `isGlobal`
- `frontend/src/components/ingestion/FolderTree.tsx` — Context menu (rename/delete) to extend with toggle-global
- `frontend/src/components/ingestion/FolderCreateInput.tsx` — Folder creation form to add global checkbox
- `frontend/src/components/ingestion/FolderBreadcrumb.tsx` — New breadcrumb from Phase 7 quick task; FolderDetail renders after this
- `frontend/src/pages/IngestionPage.tsx` — Mount point for FolderDetail
- `frontend/src/types/index.ts` — Thread and Folder type definitions

### Thread and chat system
- `frontend/src/hooks/useThreads.ts` — Thread creation; needs folder_id param
- `frontend/src/components/chat/` — Chat UI components; scope badge goes in header

### Design reference
- `.planning/quick/260328-v6n-investigate-and-plan-fixes-for-duplicate/LARGER-FEATURES-DESIGN.md` — Full architectural analysis, SQL snippets, and option rationale

</canonical_refs>

<deferred>
## Deferred Ideas

- Option B folder card grid view (root-level grid of folder cards) — deferred to Phase 9 or future quick task; Option C info bar is Phase 8 scope
- Scope badge click → modal to "change scope" — fixed at creation is Phase 8; changeability is explicitly deferred
- Folder-level search within tree sidebar — v2 requirement UI-05, not Phase 8
- Team-based folder sharing / granular permissions — explicitly out of scope per REQUIREMENTS.md

</deferred>

---
*Phase: 08-folder-system-enhancements*
*Context gathered: 2026-03-28 from design doc + user decisions*
