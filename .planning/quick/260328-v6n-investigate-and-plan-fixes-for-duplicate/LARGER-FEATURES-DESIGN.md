# Larger Features Design Document
**Issues 7, 8, 9 — Folder enhancements and folder-scoped chat**
**Created:** 2026-03-28
**Status:** Ready for planning phase

---

## Overview

Issues 7, 8, and 9 form a coherent cluster of folder-system enhancements that build on each other. They are interconnected: the global folder visibility decision (Issue 7) affects both the document RLS model and the scoping behavior of folder-scoped chat (Issue 9). Folder appearance (Issue 8) is best done after the behavioral model is settled.

Recommended sequencing: Issue 7 → Issue 9 → Issue 8.

---

## Issue 7: Global Folder Toggle

### Architectural Decision Required

**Question:** Does marking a folder `is_global = true` expose the *documents inside* to all users, or only the folder structure?

**Current state:** RLS on the `documents` table filters `user_id = auth.uid()`. Global folders are visible to all users in `GET /folders`, but documents inside a global folder are still owned by the creator and invisible to other users.

**Option A — Structure-only global folders** (simpler, current implicit behavior)
- Global folders appear in all users' folder trees
- Each user uploads their own documents into the global folder
- Other users do not see each other's documents
- Pro: No RLS change, no data isolation risk
- Con: Confusing — why is a folder "global" if its contents are private?

**Option B — Content-sharing global folders** (requires RLS change)
- Global folders expose both the folder tree AND the documents inside to all users
- Documents in a global folder bypass the `user_id` filter in RLS
- Pro: Clear semantic — global folder = shared knowledge base
- Con: Requires new RLS policy; documents become visible to all authenticated users regardless of uploader
- Implementation: Add RLS policy: `EXISTS (SELECT 1 FROM folders WHERE folders.id = documents.folder_id AND folders.is_global = true)`

**Recommendation:** Option B is more coherent. A global folder should mean "shared knowledge" — this is the primary use case (e.g., a company knowledge base everyone can query). Option A is semantically confusing.

### Implementation Plan (Option B selected)

**Backend:**
1. New endpoint: `PATCH /folders/{id}/toggle-global` — flips `is_global` boolean, returns updated folder. Only folder owner can toggle.
2. Update documents RLS policy to allow read access to documents in global folders:
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
3. Document upload: if uploading to a global folder, the document's `user_id` remains the uploader's — ownership is preserved, but visibility is extended via RLS.

**Frontend:**
1. Add "Make global" checkbox to `FolderCreateInput` component (already wires `isGlobal` param to `useFolders.createFolder`)
2. Add "Toggle global" option to `FolderTree` context menu (rename/delete already exist)
3. Visual distinction for global folders: Globe icon already exists in FolderTree; confirm it shows for `is_global=true` folders
4. Show a tooltip/badge explaining global folder semantics on hover

**Estimated complexity:** Medium (1 migration, 1 new endpoint, 2 frontend components)

---

## Issue 9: Folder-Scoped Chat

### Architecture

This is the most complex feature. It requires changes at every layer.

### Layer 1: Database

**`threads` table — add `folder_id`:**
```sql
ALTER TABLE threads
ADD COLUMN folder_id UUID REFERENCES folders(id) ON DELETE SET NULL;
```
When a folder is deleted, the thread reverts to unscoped (all documents) rather than becoming broken.

**`match_document_chunks` RPC — add optional `folder_id` filter:**
```sql
CREATE OR REPLACE FUNCTION match_document_chunks(
  query_embedding vector(1536),
  match_count int,
  p_user_id uuid,
  p_folder_id uuid DEFAULT NULL
)
RETURNS TABLE (...)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT dc.*, d.filename, d.folder_id
  FROM document_chunks dc
  JOIN documents d ON d.id = dc.document_id
  WHERE dc.user_id = p_user_id
    AND (p_folder_id IS NULL OR d.folder_id = p_folder_id)
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

### Layer 2: Backend

**`retrieval_service.py` — `search_documents` accepts `folder_id`:**
```python
async def search_documents(
    query: str,
    user_id: str,
    supabase: Client,
    match_count: int = 5,
    folder_id: str | None = None,
) -> list[dict]:
    ...
    result = supabase.rpc("match_document_chunks", {
        "query_embedding": embedding,
        "match_count": match_count,
        "p_user_id": user_id,
        "p_folder_id": folder_id,
    }).execute()
```

**`threads.py` agentic loop — pass `folder_id` through:**
- Thread model loads `folder_id` from thread record
- All tool calls (`search_documents`, `ls`, `tree`, `grep`, `glob`, `read_document`) auto-scope to the thread's folder when `folder_id` is set
- For `ls`/`tree`: if thread has a `folder_id`, default the path to that folder's path if no path arg is given
- For `grep`/`glob`: scope to thread's folder subtree

**Thread creation endpoint (`POST /threads`):**
- Accept optional `folder_id` in request body
- Store on thread record

**Thread list/get endpoints:**
- Return `folder_id` field so frontend can display scope indicator

### Layer 3: Frontend

**Thread creation:**
- When creating a new thread (clicking "New Chat"), show an optional folder picker dropdown
- The picker uses the `useFolders` hook (already available globally)
- Default: no folder (all documents)

**Sidebar thread list:**
- Show a folder badge on scoped threads (folder name or folder icon)

**Chat header:**
- Show "Scoped to: [folder name]" badge when thread has `folder_id`
- Clicking the badge could open a modal to change scope (optional enhancement)

**Types (`types/index.ts`):**
- Add `folder_id: string | null` to `Thread` interface

**`useThreads` hook:**
- Pass `folder_id` to thread creation API call

### Scope Auto-wiring for Tools

When a thread is scoped to a folder, the explorer tools should default to that folder's root path:
- `ls` with no `path` arg → list the scoped folder
- `tree` with no `path` arg → tree the scoped folder
- `grep`/`glob` with no `path` arg → search within scoped folder subtree

This requires the system prompt or the tool dispatch in `threads.py` to inject the folder path context when `folder_id` is set.

**Estimated complexity:** Complex — 3 stories across DB, backend, frontend

---

## Issue 8: Folder Appearance Enhancement

### Design Options

**Option A: Enhanced tree panel items** (minimal change)
- Add document count and total size to each folder item in `FolderTree`
- Requires fetching aggregate data per folder (either via JOIN or a dedicated RPC)
- Pro: No layout change, consistent with current design
- Con: Limited visual information density

**Option B: Folder cards in main panel** (moderate change)
- When no folder is selected (Root view), show a grid of folder cards
- Each card shows: folder name, doc count, last modified, global badge
- Clicking a card navigates into the folder
- Pro: More visual, easier to scan many folders
- Con: Changes the layout mode, adds complexity

**Option C: Folder detail sidebar** (moderate change)
- When a folder is selected, show a detail panel with stats before the document list
- Shows: folder name, doc count, size, created date, global status, subfolder count
- Pro: Consistent layout, just adds info without redesign
- Con: Takes vertical space from document list

**Recommendation:** Option C first (non-disruptive), then Option B as a follow-up enhancement.

### Implementation Plan (Option C)

**New component `FolderDetail.tsx`:**
```tsx
interface Props {
  folder: Folder
  documents: Document[]  // already loaded in IngestionPage
  subfolderCount: number  // derived from folders list
}
```
Renders a compact info bar: name, doc count, total size, global badge, created date.

**Backend:** No new endpoints needed — data is derivable from existing `documents` and `folders` lists already fetched in the frontend.

**Frontend placement:** Between `FolderBreadcrumb` and `DocumentUpload` in `IngestionPage`, visible only when a non-root folder is selected.

**Estimated complexity:** Simple-Medium (new component, no backend changes)

---

## Recommended Phase Structure

### Phase 08: Folder System Enhancements

**Plan 1: Global folder toggle + document RLS (Issue 7)**
- DB: New RLS policy for global folder document visibility
- Backend: `PATCH /folders/{id}/toggle-global` endpoint
- Frontend: "Make global" toggle in folder create; "Toggle global" in folder context menu
- Frontend: Tooltip explaining global folder semantics

**Plan 2: Folder-scoped chat (Issue 9)**
- DB: `folder_id` column on `threads` table; update `match_document_chunks` RPC
- Backend: Thread creation/retrieval with `folder_id`; tool dispatch auto-scoping
- Frontend: Folder picker on new thread creation; scope badge in sidebar and chat header

**Plan 3: Folder appearance (Issue 8)**
- Frontend: `FolderDetail` info bar component (Option C)
- Frontend: Folder card grid for root view (Option B) — follow-up

---

## Open Questions for User Decision

1. **Issue 7 — Global folder document visibility:** Confirm Option B (docs in global folders are visible to all users). If Option A is preferred, the implementation is simpler (no RLS change, just UI toggle).

2. **Issue 9 — Folder scope inheritance:** When a thread is scoped to a folder, should subfolder documents also be included in retrieval? (Recursive scope) or only the exact folder? Recommendation: recursive (more useful).

3. **Issue 9 — Scope changeability:** After creating a thread with a folder scope, can the user change the scope? Or is it fixed at creation? Recommendation: fixed at creation for simplicity (creating a new thread is easy).

4. **Issue 8 — Design option:** Confirm Option C (detail panel) vs Option B (grid view) as primary implementation target.
