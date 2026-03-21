# Phase 3: Ingestion UI - Research

**Researched:** 2026-03-21
**Domain:** React + TypeScript frontend, folder-tree UI, Supabase Realtime
**Confidence:** HIGH

---

## Summary

Phase 3 is entirely a frontend phase. The backend folder CRUD API (GET /folders, POST /folders, PATCH /folders/:id, DELETE /folders/:id) and the `folder_id` Form field on POST /documents/upload are already implemented and tested as of Phase 2. No backend work is required.

The frontend currently has zero awareness of folders. The `Document` type in `src/types/index.ts` is missing the `folder_id` field that the backend now returns. The `IngestionPage` uses a centered single-column layout; this phase converts it to a two-panel layout (260px fixed folder tree + flex-1 document panel). Three new components are needed (`FolderTree`, `FolderNode`, `FolderCreateInput`), two shadcn components must be added (`dialog`, `tooltip`), a new `useFolders` hook must be written, and three existing components must be modified (`IngestionPage`, `DocumentUpload`, `DocumentList`).

A `useFolders` hook must subscribe to Supabase Realtime `postgres_changes` on the `folders` table — mirroring the existing `useDocuments` pattern exactly — to satisfy the "real-time sync without page reload" success criterion. The folder tree is built client-side by transforming the flat `GET /folders` response into a nested tree using `parent_id` adjacency.

**Primary recommendation:** Follow the `useDocuments` + Supabase Realtime pattern precisely. Build the tree from the flat API response client-side. Use the inline-edit pattern from `Sidebar.tsx` for rename. Add the two missing shadcn components before writing any component code.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UI-01 | Ingestion interface displays folder tree with navigable hierarchy | `GET /folders` returns flat list with `parent_id`; client builds tree. New `FolderTree` + `FolderNode` components. |
| UI-02 | Folder tree visually distinguishes global folders from per-user folders | `FolderResponse.is_global` field available. UI-SPEC: Globe icon (16px) for global, Folder icon for private. No color change — icon is sole differentiator. |
| UI-03 | User can create, rename, and delete folders via UI | Backend has POST /folders, PATCH /folders/:id, DELETE /folders/:id. Inline-edit pattern from Sidebar.tsx. Inline confirmation for delete. |
| UI-04 | File upload targets the currently selected folder | Backend accepts `folder_id` as Form field on POST /documents/upload. DocumentUpload needs `folderId` prop; api.uploadDocument needs folder_id param. |
</phase_requirements>

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18.x (already installed) | Component rendering | Project stack |
| TypeScript | 5.x (already installed) | Type safety | Project stack |
| Tailwind CSS | 3.x (already installed) | Styling | Project stack |
| shadcn/ui | installed (slate/CSS vars) | Component primitives | Project design system |
| lucide-react | installed | Icons | Project icon library |
| @supabase/supabase-js | installed | Realtime subscription | Already used in useDocuments |

### Components to Add via shadcn

| Component | Install Command | Use in This Phase |
|-----------|----------------|-------------------|
| `dialog` | `npx shadcn add dialog` | Folder delete confirmation (fallback if inline rejected) |
| `tooltip` | `npx shadcn add tooltip` | Rename/delete icon button labels on hover |

**Note:** The UI-SPEC confirms these are the only two components to add. All others (button, input, scroll-area, etc.) are already installed.

---

## Architecture Patterns

### Recommended Project Structure (additions only)

```
frontend/src/
├── components/
│   └── ingestion/
│       ├── DocumentList.tsx       (modify — add folderId filter prop)
│       ├── DocumentUpload.tsx     (modify — add folderId prop + dynamic label)
│       ├── FolderTree.tsx         (new)
│       ├── FolderNode.tsx         (new)
│       └── FolderCreateInput.tsx  (new)
├── hooks/
│   ├── useDocuments.ts            (unchanged)
│   └── useFolders.ts              (new)
├── lib/
│   └── api.ts                     (add folder API functions)
└── types/
    └── index.ts                   (add Folder type, add folder_id to Document)
```

### Pattern 1: Flat-to-Tree Transformation

The `GET /folders` API returns a flat array of `FolderResponse` objects with `parent_id` adjacency. The client builds the nested tree at render time.

**What:** Transform flat list into `FolderNode[]` tree before rendering.
**When to use:** Any time the folder list changes (on load or Realtime event).

```typescript
// Source: standard adjacency-list tree-building algorithm
interface FolderNode {
  id: string
  name: string
  parent_id: string | null
  is_global: boolean
  user_id: string
  children: FolderNode[]
}

function buildTree(folders: Folder[]): FolderNode[] {
  const map = new Map<string, FolderNode>()
  folders.forEach(f => map.set(f.id, { ...f, children: [] }))
  const roots: FolderNode[] = []
  map.forEach(node => {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id)!.children.push(node)
    } else {
      roots.push(node)
    }
  })
  return roots
}
```

**Confidence:** HIGH — standard algorithm, no external dependency.

### Pattern 2: useFolders Hook — Mirror of useDocuments

**What:** Custom hook that loads folders, exposes CRUD, and subscribes to Realtime.
**When to use:** Instantiated once in `IngestionPage`, passed down as props.

The existing `useDocuments` hook is the exact blueprint. Key points:
- Initial load: call `listFolders()` from `api.ts`
- Realtime channel: `supabase.channel("folders-changes").on("postgres_changes", { event: "*", schema: "public", table: "folders" }, handler).subscribe()`
- RLS note from `useDocuments`: no column filter on UPDATE events needed (RLS ensures users only receive their own rows + global rows); omit column filter to avoid requiring `REPLICA IDENTITY FULL`
- State shape: `folders: Folder[]` (flat list), expose `createFolder`, `renameFolder`, `deleteFolder` functions
- Optimistic updates: on local mutations, update state immediately; Realtime events will reconcile

```typescript
// Pattern: channel subscription (mirrors useDocuments exactly)
const channel = supabase
  .channel("folders-changes")
  .on("postgres_changes", {
    event: "*",
    schema: "public",
    table: "folders",
  }, (payload) => {
    if (payload.eventType === "INSERT") { ... }
    if (payload.eventType === "UPDATE") { ... }
    if (payload.eventType === "DELETE") { ... }
  })
  .subscribe()
```

**Confidence:** HIGH — verified from existing `useDocuments.ts` source.

### Pattern 3: Inline Rename — Mirror of Sidebar.tsx

**What:** Click pencil → folder name becomes `<input>`, commit on Enter/blur, cancel on Escape.
**When to use:** Folder rename in `FolderNode`.

The complete inline-edit pattern is already implemented in `Sidebar.tsx` (lines 115–126, `isEditing` state, `editInputRef`, `commitRename` on Enter/blur, `setEditingId(null)` on Escape). `FolderNode` should replicate this pattern directly.

```typescript
// Source: Sidebar.tsx lines 115-126
{isEditing ? (
  <input
    ref={editInputRef}
    value={editValue}
    onChange={(e) => setEditValue(e.target.value)}
    onBlur={() => commitRename(folder.id)}
    onKeyDown={(e) => {
      if (e.key === "Enter") commitRename(folder.id)
      if (e.key === "Escape") setEditingId(null)
    }}
    className="w-full px-3 py-1.5 text-sm bg-background border rounded outline-none"
  />
) : (
  /* normal row */
)}
```

**Confidence:** HIGH — source exists in codebase.

### Pattern 4: Inline Delete Confirmation (UI-SPEC)

**What:** Clicking trash on a folder node shows an inline confirmation row below the node (not a modal). Two buttons: "Delete" (destructive) and "Cancel".
**When to use:** Folder delete only. Document delete uses no confirmation (existing pattern).

State: `deletingId: string | null` in `FolderTree` or `FolderNode`. When set, render a confirmation bar below the matching node.

**Confidence:** HIGH — fully specified in UI-SPEC copywriting contract.

### Pattern 5: Two-Panel Layout

**What:** Replace the `max-w-3xl mx-auto space-y-8` column in `IngestionPage` with `flex flex-row gap-6`.

```tsx
// Before (current IngestionPage inner div):
<div className="max-w-3xl w-full mx-auto space-y-8">

// After:
<div className="flex flex-row gap-6 h-full">
  <div className="w-64 shrink-0 flex flex-col overflow-y-auto">
    {/* FolderTree — 260px fixed */}
  </div>
  <div className="flex-1 flex flex-col overflow-y-auto space-y-8">
    {/* DocumentUpload + DocumentList */}
  </div>
</div>
```

**Confidence:** HIGH — UI-SPEC layout table is explicit.

### Pattern 6: Folder API Functions in api.ts

Following the same `fetch` + `getAuthHeaders` / `getAuthToken` pattern used for all existing API calls:

```typescript
// New functions to add to api.ts
export async function listFolders(): Promise<Folder[]>
export async function createFolder(name: string, parentId: string | null, isGlobal?: boolean): Promise<Folder>
export async function renameFolder(id: string, name: string): Promise<Folder>
export async function deleteFolder(id: string): Promise<void>
```

`uploadDocument` also needs a `folderId` parameter:

```typescript
// Modified signature:
export async function uploadDocument(
  file: File,
  folderId?: string | null
): Promise<{ doc: Document; isDuplicate: boolean }>

// Inside: append folder_id to FormData if provided
if (folderId) formData.append("folder_id", folderId)
```

**Confidence:** HIGH — backend endpoint already accepts `folder_id: str | None = Form(None)`.

### Anti-Patterns to Avoid

- **Fetching tree recursively per node:** The backend has `GET /folders/:id/children` but fetching it recursively creates N+1 requests. Use `GET /folders` (returns all accessible folders flat) and build the tree client-side.
- **Storing tree shape in state:** Store the flat `Folder[]` in state; derive the tree with `buildTree()` at render time. Storing nested structures makes Realtime reconciliation complex.
- **Column filter on Realtime UPDATE:** Adding `.filter("user_id=eq.{uid}")` to Realtime UPDATE events requires `REPLICA IDENTITY FULL` on the table. The `useDocuments` hook deliberately omits this. Follow the same approach for `useFolders`.
- **Using a third-party tree library:** The folder tree has simple requirements (expand/collapse, select, CRUD). A hand-rolled recursive component is 50–80 lines and avoids a dependency. The UI-SPEC does not specify any tree library.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Realtime folder sync | Custom polling or WebSocket | Supabase Realtime (`postgres_changes`) | Already wired in project; `useDocuments` is the pattern |
| Icon set | SVG sprites or inline SVGs | lucide-react | Already installed; `Globe`, `Folder`, `ChevronRight`, `ChevronDown`, `Pencil`, `Trash2`, `Plus` are the needed icons |
| Tooltip primitives | Custom hover popover div | shadcn `tooltip` (Radix) | Handles accessibility, keyboard, and positioning |
| Modal primitives | Custom overlay div | shadcn `dialog` (Radix) | If inline confirmation is rejected, dialog is the fallback per UI-SPEC |
| Form state for rename/create | Complex form library | Single `useState` string + `useRef` for focus | Sidebar.tsx pattern is sufficient; no react-hook-form needed |

---

## Type Changes Required

The `Document` interface in `src/types/index.ts` is missing `folder_id`. The backend `DocumentResponse` model already includes it. This must be added before writing any components that filter by folder:

```typescript
// Current (src/types/index.ts line 46-60):
export interface Document {
  id: string
  // ... no folder_id
}

// Required addition:
export interface Document {
  id: string
  folder_id: string | null   // ADD THIS
  // ... rest unchanged
}
```

A new `Folder` type must also be added:

```typescript
export interface Folder {
  id: string
  user_id: string
  name: string
  parent_id: string | null
  is_global: boolean
  created_at: string
  updated_at: string
}
```

**Confidence:** HIGH — verified from `backend/app/models/folder.py` and `document.py`.

---

## Common Pitfalls

### Pitfall 1: Forgetting folder_id on Document type causes invisible filtering bugs
**What goes wrong:** `DocumentList` filters by `doc.folder_id === selectedFolderId` but `folder_id` is absent from the TypeScript type, so TypeScript doesn't error — it's just `undefined` — and no documents appear under any folder.
**Why it happens:** Backend added `folder_id` in Phase 2 but the frontend type was never updated.
**How to avoid:** Add `folder_id: string | null` to the `Document` interface as Step 1 before writing any new components. Verify with `tsc --noEmit`.
**Warning signs:** Document list always shows empty when a folder is selected.

### Pitfall 2: Realtime REPLICA IDENTITY requirement
**What goes wrong:** Adding `.filter("user_id=eq.X")` to the Realtime channel's UPDATE subscription causes silent failures — events don't arrive unless `REPLICA IDENTITY FULL` is set on the table.
**Why it happens:** Supabase Realtime column filters on UPDATE events require the old row values to be replicated, which requires REPLICA IDENTITY FULL.
**How to avoid:** Omit column filter entirely. RLS ensures users only receive their own rows + global rows. This is documented in `useDocuments.ts` comment lines 34–36.
**Warning signs:** Folder creates/renames appear locally but don't sync in a second browser tab.

### Pitfall 3: Global folder created by current user appears twice
**What goes wrong:** `GET /folders` returns `user_id.eq.{uid} OR is_global.eq.true`. A user-owned global folder matches both conditions, creating a duplicate in the raw response.
**Why it happens:** Server-side OR query behavior. The backend deduplicates in Python but the frontend must also guard against this if it ever caches raw responses.
**How to avoid:** `buildTree` uses a `Map` keyed by `id` — Map insertion is idempotent on duplicate IDs. Alternatively, deduplicate before `buildTree` with `Array.from(new Map(folders.map(f => [f.id, f])).values())`.
**Warning signs:** Folder appears twice in the tree with identical name.

### Pitfall 4: Expand/collapse state lost on Realtime INSERT
**What goes wrong:** When Realtime fires an INSERT event, the component re-renders from the updated flat list, and any expanded nodes collapse back to default.
**Why it happens:** Expand state stored in React state that's not keyed to folder IDs — a full re-render resets it.
**How to avoid:** Store expand state as `expandedIds: Set<string>` (keyed by folder ID) and preserve it across folder list updates. Only add new IDs to the set; never reset the whole set on Realtime events.
**Warning signs:** User expands a folder, a different folder is created elsewhere, the expanded folder collapses.

### Pitfall 5: Upload FormData folder_id field type mismatch
**What goes wrong:** Passing `folder_id: null` or `folder_id: "null"` as a Form string to the backend causes a 422 validation error when the backend tries to parse it as a UUID.
**Why it happens:** `FormData` only accepts strings; passing `"null"` is a non-empty string that fails UUID parsing. The backend expects the field to be absent (not sent) when targeting root.
**How to avoid:** Only append `folder_id` to FormData when it is a non-null UUID string. If `folderId` is null/undefined, do not append the field at all.
**Warning signs:** Uploads to root fail with 422 Unprocessable Entity.

---

## Code Examples

### Tree-building utility

```typescript
// Source: standard adjacency-list algorithm, verified against backend FolderResponse shape
export interface FolderNode extends Folder {
  children: FolderNode[]
}

export function buildFolderTree(folders: Folder[]): FolderNode[] {
  const map = new Map<string, FolderNode>()
  // Deduplicate (guard against server-side global+owned duplicates)
  const unique = Array.from(new Map(folders.map(f => [f.id, f])).values())
  unique.forEach(f => map.set(f.id, { ...f, children: [] }))

  const roots: FolderNode[] = []
  map.forEach(node => {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id)!.children.push(node)
    } else {
      roots.push(node)
    }
  })
  // Sort alphabetically at each level
  function sortChildren(nodes: FolderNode[]): void {
    nodes.sort((a, b) => a.name.localeCompare(b.name))
    nodes.forEach(n => sortChildren(n.children))
  }
  sortChildren(roots)
  return roots
}
```

### Upload with folder_id

```typescript
// Modified uploadDocument in api.ts
export async function uploadDocument(
  file: File,
  folderId?: string | null,
): Promise<{ doc: Document; isDuplicate: boolean }> {
  const token = await getAuthToken()
  const formData = new FormData()
  formData.append("file", file)
  // Only append folder_id when it is a valid UUID string (not null/undefined)
  if (folderId) formData.append("folder_id", folderId)
  const res = await fetch(`${API_BASE}/documents/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Upload failed" }))
    throw new Error((err as { detail: string }).detail ?? "Upload failed")
  }
  const doc = await res.json() as Document
  return { doc, isDuplicate: res.status === 200 }
}
```

### Global vs per-user icon (UI-02)

```tsx
// Source: UI-SPEC color section, icon library: lucide-react
import { Folder, Globe } from "lucide-react"

// Inside FolderNode render:
<div className="flex items-center gap-1.5">
  <Folder className="h-4 w-4 shrink-0" />
  {folder.is_global && (
    <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
  )}
  <span className="text-sm truncate">{folder.name}</span>
</div>
```

### Dynamic upload CTA label (UI-SPEC copywriting)

```tsx
// DocumentUpload.tsx — button label
const ctaLabel = selectedFolderName
  ? `Upload to ${selectedFolderName}`
  : "Upload to Root"
```

---

## Existing Backend API Reference (Verified)

| Method | Path | Body / Params | Returns | Notes |
|--------|------|---------------|---------|-------|
| GET | `/folders` | — | `Folder[]` | Returns owned + global, deduplicated |
| POST | `/folders` | `{ name, parent_id?, is_global? }` | `Folder` | 201 on create |
| PATCH | `/folders/:id` | `{ name }` | `Folder` | Only owner can rename |
| DELETE | `/folders/:id` | — | 204 | Cascade deletes children |
| PATCH | `/folders/:id/move` | `{ parent_id }` | `Folder` | parent_id=null → root |
| POST | `/documents/upload` | FormData: `file`, `folder_id?` | `Document` | folder_id absent = root |

All endpoints require `Authorization: Bearer <token>`.

**Confidence:** HIGH — verified from `backend/app/api/folders.py` and `backend/app/api/documents.py` source.

---

## Validation Architecture

**Config:** `workflow.nyquist_validation` key absent in `.planning/config.json` — treated as enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 + @testing-library/react 16.x |
| Config file | `frontend/vitest.config.ts` |
| Quick run command | `cd frontend && npm test` |
| Full suite command | `cd frontend && npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UI-01 | FolderTree renders nested hierarchy from flat folder list | unit | `cd frontend && npm test -- FolderTree` | ❌ Wave 0 |
| UI-01 | buildFolderTree utility correctly nests parent-child | unit | `cd frontend && npm test -- buildFolderTree` | ❌ Wave 0 |
| UI-02 | Global folder shows Globe icon; per-user shows Folder only | unit | `cd frontend && npm test -- FolderNode` | ❌ Wave 0 |
| UI-03 | useFolders: create/rename/delete update state correctly | unit | `cd frontend && npm test -- useFolders` | ❌ Wave 0 |
| UI-03 | Inline rename: Enter commits, Escape cancels | unit | `cd frontend && npm test -- FolderNode` | ❌ Wave 0 |
| UI-04 | uploadDocument sends folder_id in FormData when provided | unit | `cd frontend && npm test -- api` | ❌ Wave 0 |
| UI-04 | uploadDocument does NOT send folder_id when null | unit | `cd frontend && npm test -- api` | ❌ Wave 0 |
| UI-04 | DocumentUpload label shows "Upload to [Folder]" when folder selected | unit | `cd frontend && npm test -- DocumentUpload` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `cd frontend && npm test`
- **Per wave merge:** `cd frontend && npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `frontend/src/__tests__/components/FolderTree.test.tsx` — covers UI-01, UI-02
- [ ] `frontend/src/__tests__/components/FolderNode.test.tsx` — covers UI-02, UI-03 inline rename
- [ ] `frontend/src/__tests__/hooks/useFolders.test.ts` — covers UI-03 CRUD state
- [ ] `frontend/src/__tests__/lib/api.test.ts` — extend existing file to cover folder_id FormData behavior (UI-04)
- [ ] `frontend/src/__tests__/lib/buildFolderTree.test.ts` — covers tree-building utility (UI-01)

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No folder awareness in frontend | Phase 3 introduces folder tree | This phase | New `useFolders`, `FolderTree`, `FolderNode` |
| All documents shown in one flat list | Documents filtered by selected folder | This phase | `DocumentList` gains `folderId` filter prop |
| Upload always targets root (null folder_id) | Upload targets selected folder | This phase | `uploadDocument` gains optional `folderId` param |

---

## Open Questions

1. **Should DocumentList show only selected-folder documents or all documents when no folder is selected?**
   - What we know: UI-SPEC says "shows all documents" when Root node is selected
   - What's unclear: Whether the existing flat list (all docs regardless of folder) or folder=null filter is the "root" view
   - Recommendation: Root node selected → show `folder_id === null` documents (true root), not all documents. This is cleaner as the folder tree grows. The planner should decide and document this explicitly.

2. **Realtime subscription for `folders` table — is it enabled in Supabase?**
   - What we know: Realtime is enabled for the `documents` table (useDocuments works)
   - What's unclear: Whether Realtime publication includes the `folders` table
   - Recommendation: Plan should include a step to verify `folders` table is added to Supabase Realtime publication. If it isn't, the tree will not update in real time even though the hook subscribes.

3. **Expand/collapse default depth**
   - What we know: UI-SPEC says "Starts collapsed for depth > 1"
   - What's unclear: Whether depth is measured from absolute root or from the visible root in the tree
   - Recommendation: Treat depth > 1 as: only top-level folders expanded by default, all nested folders collapsed. This matches the UI-SPEC literal text.

---

## Sources

### Primary (HIGH confidence)

- `backend/app/api/folders.py` — Complete folder API endpoints and response shapes
- `backend/app/api/documents.py` — Upload endpoint with `folder_id: str | None = Form(None)`
- `backend/app/models/folder.py` — `FolderResponse` Pydantic model
- `backend/app/models/document.py` — `DocumentResponse` with `folder_id: UUID | None`
- `frontend/src/hooks/useDocuments.ts` — Realtime subscription pattern to mirror
- `frontend/src/components/layout/Sidebar.tsx` — Inline rename pattern to mirror
- `frontend/src/components/ingestion/DocumentUpload.tsx` — Component to modify
- `frontend/src/components/ingestion/DocumentList.tsx` — Component to modify
- `frontend/src/pages/IngestionPage.tsx` — Layout to refactor
- `frontend/src/lib/api.ts` — API function patterns to follow
- `frontend/src/types/index.ts` — Types to extend
- `.planning/phases/03-ingestion-ui/03-UI-SPEC.md` — Visual/interaction contract (authoritative)

### Secondary (MEDIUM confidence)

- Supabase Realtime `postgres_changes` documented behavior — inferred from `useDocuments.ts` comments about REPLICA IDENTITY FULL (not independently verified against Supabase docs, but consistent with known behavior)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified in package.json and node_modules
- Architecture: HIGH — patterns derived from existing codebase source
- Pitfalls: HIGH — most derived from existing code comments and known Supabase behavior
- Type changes: HIGH — verified against backend Pydantic models directly

**Research date:** 2026-03-21
**Valid until:** 2026-04-21 (stable stack)
