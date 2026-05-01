# Phase 46: Document Version Deletion - Pattern Map

**Mapped:** 2026-04-24
**Files analyzed:** 4 files to modify
**Analogs found:** 4 / 4

## File Classification

| Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------|------|-----------|----------------|---------------|
| `backend/app/api/documents.py` §477–507 | controller | request-response | `backend/app/api/documents.py` §374–415 (`restore_document_version`) | exact — same file, sibling promotion pattern |
| `frontend/src/lib/api.ts` (`deleteDocument`) | utility/API client | request-response | `frontend/src/lib/api.ts` (`restoreDocumentVersion`) | exact — same file, same fetch + throw pattern |
| `frontend/src/hooks/useDocuments.ts` (`deleteDoc`) | hook | request-response | same file — `deleteDoc` callback at §92–96 | exact — extend in place |
| `frontend/src/components/ingestion/DocumentList.tsx` (delete Dialog) | component | request-response | `DocumentList.tsx` §196–223 (restore confirmation dialog) | exact — same file, same Dialog + error-in-dialog + spinner pattern |

---

## Pattern Assignments

### `backend/app/api/documents.py` — extend `delete_document` with `scope` param

**Analog 1 — Current delete endpoint** (`documents.py` lines 477–507):
```python
@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: str,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    doc_resp = (
        supabase.table("documents")
        .select("*")
        .eq("id", document_id)
        .eq("user_id", current_user["id"])
        .single()
        .execute()
    )
    if not doc_resp.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    try:
        supabase.storage.from_("documents").remove([doc_resp.data["file_path"]])
    except Exception:
        pass  # D-10: storage failures are silently swallowed

    supabase.table("documents").delete().eq("id", document_id).eq("user_id", current_user["id"]).execute()
    background_tasks.add_task(
        write_audit_entry,
        user_id=current_user["id"],
        action_type="document.delete",
        metadata={"document_id": document_id, "filename": doc_resp.data.get("filename", "")},
        supabase=supabase,
    )
```

**Analog 2 — Sibling query + promotion pattern** (`documents.py` lines 374–415, `restore_document_version`):
```python
# Ownership check pattern (reuse verbatim, swap .single() → .maybe_single() for safety)
doc = (
    supabase.table("documents")
    .select("*")
    .eq("id", document_id)
    .eq("user_id", current_user["id"])
    .maybe_single()
    .execute()
)
if not doc.data:
    raise HTTPException(status_code=404, detail="Document not found")
target = doc.data
folder_id = target["folder_id"]

# Sibling query pattern — match on (user_id, filename, folder_id)
siblings_q = (
    supabase.table("documents")
    .select("*")                    # change .update() → .select("*") to fetch all siblings for scope=all
    .eq("user_id", current_user["id"])
    .eq("filename", target["filename"])
)
if folder_id is None:
    siblings_q = siblings_q.is_("folder_id", "null")
else:
    siblings_q = siblings_q.eq("folder_id", folder_id)
siblings = siblings_q.execute().data or []

# Promotion pattern — after deleting current version, promote the highest remaining version_number
# (restore uses .update({"is_latest": True}).eq("id", ...) — reuse for promoting the next-highest sibling)
```

**New signature to implement** (add `scope` query param, FastAPI Query):
```python
from fastapi import Query

@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: str,
    background_tasks: BackgroundTasks,
    scope: str = Query(default="version", pattern="^(version|all)$"),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
```

**Audit log pattern** — include `scope` in metadata (D-11), matching existing call at lines 501–507:
```python
background_tasks.add_task(
    write_audit_entry,
    user_id=current_user["id"],
    action_type="document.delete",
    metadata={"document_id": document_id, "filename": target.get("filename", ""), "scope": scope},
    supabase=supabase,
)
```

---

### `frontend/src/lib/api.ts` — extend `deleteDocument` with optional `scope`

**Current function** (lines 241–248):
```typescript
export async function deleteDocument(id: string): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/documents/${id}`, {
    method: "DELETE",
    headers,
  })
  if (!res.ok) throw new Error("Failed to delete document")
}
```

**Analog for query-param fetch pattern** — `fetchDocumentVersions` (lines 250–255):
```typescript
export async function fetchDocumentVersions(documentId: string): Promise<Document[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/documents/${documentId}/versions`, { headers })
  if (!res.ok) throw new Error("Failed to fetch document versions")
  return res.json() as Promise<Document[]>
}
```

**Target signature** (add optional `scope` param, append query string when provided):
```typescript
export async function deleteDocument(id: string, scope?: "version" | "all"): Promise<void> {
  const headers = await getAuthHeaders()
  const url = scope
    ? `${API_BASE}/documents/${id}?scope=${scope}`
    : `${API_BASE}/documents/${id}`
  const res = await fetch(url, { method: "DELETE", headers })
  if (!res.ok) throw new Error("Failed to delete document")
}
```

---

### `frontend/src/hooks/useDocuments.ts` — extend `deleteDoc` callback

**Current callback** (lines 92–96):
```typescript
const deleteDoc = useCallback(async (id: string) => {
  await deleteDocument(id)
  // Realtime DELETE event will update state; optimistically remove too
  setDocuments((prev) => prev.filter((d) => d.id !== id))
}, [])
```

**Target signature** (thread `scope` through; for `scope=all` optimistically remove all siblings by filename):
```typescript
const deleteDoc = useCallback(async (id: string, scope?: "version" | "all") => {
  await deleteDocument(id, scope)
  if (scope === "all") {
    // Remove all documents with the same filename (all versions gone)
    const target = documents.find((d) => d.id === id)
    if (target) {
      setDocuments((prev) => prev.filter((d) => d.filename !== target.filename))
    }
  } else {
    setDocuments((prev) => prev.filter((d) => d.id !== id))
  }
}, [documents])
```

**Hook interface update** — `UseDocuments` interface at lines 6–13; update `deleteDoc` signature:
```typescript
deleteDoc: (id: string, scope?: "version" | "all") => Promise<void>
```

---

### `frontend/src/components/ingestion/DocumentList.tsx` — upgrade delete Dialog

**Current `Props` interface** (lines 17–23) — `onDelete` signature must match hook:
```typescript
interface Props {
  documents: Document[]
  onDelete: (id: string) => void        // → change to (id: string, scope?: "version" | "all") => void
  onRefresh: () => void
  folderId?: string | null
  currentUserId: string
}
```

**Current `deleteTarget` state + dialog trigger** (lines 229–231, 334–341):
```typescript
const [deleteTarget, setDeleteTarget] = useState<Document | null>(null)

// In table row actions cell:
<Button
  variant="ghost"
  size="sm"
  onClick={() => setDeleteTarget(doc)}
  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
>
  <Trash2 className="h-3.5 w-3.5" />
</Button>
```

**`hasVersions` helper** (line 270) — gate the two-action footer:
```typescript
const hasVersions = (doc: Document) => (doc.version_number ?? 1) > 1
```

**Restore dialog — exact error-in-dialog + loading spinner pattern to copy** (lines 196–223):
```tsx
{/* State to add alongside deleteTarget: */}
const [deleting, setDeleting] = useState(false)
const [deleteError, setDeleteError] = useState<string | null>(null)

{/* Dialog open/close with error clear on close: */}
<Dialog
  open={deleteTarget !== null}
  onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setDeleteError(null) } }}
>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>...</DialogTitle>
      <DialogDescription>...</DialogDescription>
    </DialogHeader>
    {deleteError && (
      <p className="text-sm text-destructive px-1">{deleteError}</p>
    )}
    <DialogFooter>
      <Button
        variant="outline"
        onClick={() => { setDeleteTarget(null); setDeleteError(null) }}
        disabled={deleting}
      >
        Cancel
      </Button>
      <Button
        variant="destructive"
        onClick={handleDelete}
        disabled={deleting}
      >
        {deleting ? (
          <>
            <span className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent mr-2" />
            Deleting...
          </>
        ) : (
          "Delete"
        )}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**Multi-version footer pattern** (D-01/D-02/D-04 — three buttons):
```tsx
{/* When hasVersions(deleteTarget): render three footer buttons */}
<DialogFooter>
  <Button variant="outline" onClick={() => { setDeleteTarget(null); setDeleteError(null) }} disabled={deleting}>
    Cancel
  </Button>
  <Button variant="outline" onClick={() => handleDelete("version")} disabled={deleting}>
    {deleting && activeScope === "version" ? (
      <><span className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent mr-2" />Deleting...</>
    ) : (
      `Delete v${deleteTarget?.version_number}`
    )}
  </Button>
  <Button variant="destructive" onClick={() => handleDelete("all")} disabled={deleting}>
    {deleting && activeScope === "all" ? (
      <><span className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent mr-2" />Deleting...</>
    ) : (
      "Delete All Versions"
    )}
  </Button>
</DialogFooter>
```

**handleDelete async function** (error-in-dialog, no close on error — mirrors `handleRestore` at lines 112–127):
```typescript
const handleDelete = async (scope?: "version" | "all") => {
  if (!deleteTarget) return
  setDeleting(true)
  setActiveScope(scope ?? null)
  setDeleteError(null)
  try {
    await onDelete(deleteTarget.id, scope)
    setDeleteTarget(null)
    setDeleteError(null)
  } catch {
    setDeleteError("Delete failed. Please try again.")
    // Do NOT close dialog — let user retry or cancel
  } finally {
    setDeleting(false)
    setActiveScope(null)
  }
}
```

**Additional state needed** alongside existing `deleteTarget`:
```typescript
const [deleting, setDeleting] = useState(false)
const [deleteError, setDeleteError] = useState<string | null>(null)
const [activeScope, setActiveScope] = useState<"version" | "all" | null>(null)
```

---

### `frontend/src/pages/IngestionPage.tsx` — thread `scope` through `onDelete` prop

**Current wiring** (lines 14, 96):
```typescript
const { documents, uploading, uploadingCount, upload, deleteDoc, loadDocuments } = useDocuments()

<DocumentList
  documents={documents}
  onDelete={deleteDoc}   // deleteDoc now accepts (id, scope?) — no change needed here
  onRefresh={loadDocuments}
  folderId={selectedFolderId}
  currentUserId={user?.id ?? ""}
/>
```

No change required in IngestionPage itself — `deleteDoc`'s new optional `scope` param is backward-compatible. The `onDelete` prop signature change in `DocumentList` Props will require updating the call from `onDelete(deleteTarget.id)` (line 388) to `onDelete(deleteTarget.id, scope)` inside the component — which is internal to `DocumentList`.

---

## Shared Patterns

### Error-in-dialog (don't close on failure)
**Source:** `DocumentList.tsx` lines 112–126 (`handleRestore`)
**Apply to:** `handleDelete` function in the upgraded delete dialog
```typescript
} catch {
  setRestoreError("Restore failed. Please try again.")
  // Do NOT close dialog — let user retry or cancel
} finally {
  setRestoring(false)
}
```

### Loading spinner in button
**Source:** `DocumentList.tsx` lines 212–219
**Apply to:** Both "Delete vN" and "Delete All Versions" buttons while in-flight
```tsx
{restoring ? (
  <>
    <span className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent mr-2" />
    Restoring...
  </>
) : (
  "Restore"
)}
```

### Storage delete — silent failure swallow
**Source:** `documents.py` lines 495–498
**Apply to:** All storage.remove() calls in the new `scope=all` branch
```python
try:
    supabase.storage.from_("documents").remove([file_path])
except Exception:
    pass
```

### Audit log via BackgroundTasks
**Source:** `documents.py` lines 501–507
**Apply to:** Both `scope=version` and `scope=all` paths; add `"scope": scope` to metadata
```python
background_tasks.add_task(
    write_audit_entry,
    user_id=current_user["id"],
    action_type="document.delete",
    metadata={"document_id": document_id, "filename": doc_resp.data.get("filename", ""), "scope": scope},
    supabase=supabase,
)
```

### Dialog open/close with error clear
**Source:** `DocumentList.tsx` line 196
**Apply to:** The upgraded delete Dialog `onOpenChange`
```tsx
onOpenChange={(open) => { if (!open) { setRestoreTarget(null); setRestoreError(null) } }}
```

---

## No Analog Found

None. All four files have close analogs in the same codebase. The sibling-query pattern (`restore_document_version`), the error-in-dialog pattern (restore dialog), and the fetch+query-param pattern (`fetchDocumentVersions`) all exist and are directly reusable.

---

## Metadata

**Analog search scope:** `backend/app/api/documents.py`, `frontend/src/lib/api.ts`, `frontend/src/hooks/useDocuments.ts`, `frontend/src/components/ingestion/DocumentList.tsx`, `frontend/src/pages/IngestionPage.tsx`
**Files scanned:** 5 source files read directly
**Pattern extraction date:** 2026-04-24
