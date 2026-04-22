---
phase: 038-knowledge-health-dashboard-frontend
reviewed: 2026-04-18T00:00:00Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - backend/app/api/documents.py
  - backend/tests/test_reingest.py
  - frontend/src/App.tsx
  - frontend/src/__tests__/lib/api.test.ts
  - frontend/src/components/health/HealthDocumentRow.tsx
  - frontend/src/components/health/HealthEmptyState.tsx
  - frontend/src/components/health/HealthPanel.tsx
  - frontend/src/components/health/MoveToFolderDialog.tsx
  - frontend/src/components/ingestion/DocumentList.tsx
  - frontend/src/components/layout/ChatLayout.tsx
  - frontend/src/components/layout/Sidebar.tsx
  - frontend/src/lib/api.ts
  - frontend/src/lib/fileIcons.tsx
  - frontend/src/pages/KnowledgeHealthPage.tsx
findings:
  critical: 1
  warning: 4
  info: 2
  total: 7
status: issues_found
---

# Phase 038: Code Review Report

**Reviewed:** 2026-04-18T00:00:00Z
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

Phase 038 delivers the Knowledge Health Dashboard frontend: four health panels (Most Retrieved, Never Retrieved, Low Confidence, Stale), per-row actions (delete, re-ingest, move-to-folder), and a new `/documents/{id}/reingest` backend endpoint. The overall structure is clean and well-organized, with good separation of concerns across `HealthPanel`, `HealthDocumentRow`, `MoveToFolderDialog`, and `KnowledgeHealthPage`.

One critical bug exists: the `reingest_document` endpoint sets status to `"pending"` but never schedules the background ingestion task, so documents will queue indefinitely without being processed. Four warnings cover an unguarded index access in `move_document`, a discarded callback argument in `HealthDocumentRow`, a silently-swallowed fetch error in `VersionHistoryPanel`, and missing user feedback after a successful re-ingest. Two info items cover the missing `epub` icon and the stub-only reingest test file.

## Critical Issues

### CR-01: `reingest_document` sets status to pending but never triggers background ingestion

**File:** `backend/app/api/documents.py:418-448`
**Issue:** The endpoint updates `status = "pending"` but never calls `background_tasks.add_task(ingest_document, ...)`. The original upload path stores the extracted text in a background closure, but the reingest endpoint has no `BackgroundTasks` parameter and no access to the original raw bytes or extracted text. Documents will be stuck in `pending` forever with no ingestion occurring.

The endpoint signature also lacks `BackgroundTasks` and does not fetch the file from storage, so there is no path by which ingestion can be re-triggered at all.

**Fix:** Add `BackgroundTasks` as a dependency, retrieve the stored file from Supabase Storage, re-extract text, and schedule the background task. Minimum viable fix:

```python
@router.post("/{document_id}/reingest", response_model=DocumentResponse)
async def reingest_document(
    document_id: str,
    background_tasks: BackgroundTasks,          # ADD
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    doc = (
        supabase.table("documents")
        .select("*")
        .eq("id", document_id)
        .eq("user_id", current_user["id"])
        .eq("is_latest", True)
        .maybe_single()
        .execute()
    )
    if not doc.data:
        raise HTTPException(status_code=404, detail="Document not found")

    target = doc.data

    # Fetch raw bytes from storage so we can re-extract text
    try:
        raw = supabase.storage.from_("documents").download(target["file_path"])
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not retrieve stored file: {e}")

    try:
        text = extract_text(raw, target["mime_type"])
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not extract text: {e}")

    result = (
        supabase.table("documents")
        .update({"status": "pending"})
        .eq("id", document_id)
        .eq("user_id", current_user["id"])
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Document not found after update")

    background_tasks.add_task(
        ingest_document,
        document_id,
        text,
        current_user["id"],
        supabase,
        raw,
        target["mime_type"],
        target["filename"],
    )
    return result.data[0]
```

## Warnings

### WR-01: `move_document` accesses `result.data[0]` without checking for empty data

**File:** `backend/app/api/documents.py:524-525`
**Issue:** After the `update()` call, `result.data[0]` is accessed directly. If the document was deleted between the ownership check and the update (race condition), `result.data` will be an empty list and this raises an unhandled `IndexError`, producing a 500 response instead of a graceful 404.

The same pattern is safe in `restore_document_version` (line 413) because it already checks `if not result.data`, but `move_document` does not.

**Fix:**
```python
    result = (
        supabase.table("documents")
        .update({"folder_id": str(body.folder_id) if body.folder_id else None})
        .eq("id", document_id)
        .eq("user_id", current_user["id"])
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Document not found")
    return result.data[0]
```

### WR-02: `HealthDocumentRow` discards the `newFolderId` returned by `MoveToFolderDialog.onMoved`

**File:** `frontend/src/components/health/HealthDocumentRow.tsx:177-183`
**Issue:** `MoveToFolderDialog` calls `onMoved(folderId)` with the new folder ID, but `HealthDocumentRow` passes `onMoved={() => setMoveOpen(false)}`, silently ignoring the updated value. The `doc.folder_id` on the row will be stale until the user navigates away and back. This causes the next "Move to folder" dialog to show the old folder pre-selected via the parent panel's state.

The `HealthPanel` and `KnowledgeHealthPage` do not need to track individual folder changes for their current use case, but the contract of `onMoved` is misleading — the callback signature says `(newFolderId: string | null) => void` but the value is never used.

**Fix:** Either update `doc.folder_id` in optimistic state, or change the callback to `onMoved={() => setMoveOpen(false)}` in the interface signature to make it clear no argument is consumed. At minimum, document the intentional discard:

```tsx
// MoveToFolderDialog.onMoved receives newFolderId but health panels
// do not track individual folder state — close is sufficient here.
onMoved={(_newFolderId) => setMoveOpen(false)}
```

### WR-03: `VersionHistoryPanel` silently swallows fetch errors — shows "No version history" on network failure

**File:** `frontend/src/components/ingestion/DocumentList.tsx:104-108`
**Issue:** The `useEffect` that loads version history uses `.finally()` to stop the spinner but no `.catch()` to capture errors. If `fetchDocumentVersions` rejects (network error, 4xx/5xx), `versions` stays `[]` and the user sees "No version history available." — indistinguishable from a document that genuinely has one version.

```typescript
useEffect(() => {
  fetchDocumentVersions(documentId)
    .then(setVersions)
    .finally(() => setLoading(false))  // errors silently dropped
}, [documentId])
```

**Fix:**
```typescript
const [fetchError, setFetchError] = useState<string | null>(null)

useEffect(() => {
  fetchDocumentVersions(documentId)
    .then(setVersions)
    .catch(() => setFetchError("Could not load version history."))
    .finally(() => setLoading(false))
}, [documentId])

// Render fetchError in the panel when set
```

### WR-04: Re-ingest action in `HealthDocumentRow` provides no success feedback

**File:** `frontend/src/components/health/HealthDocumentRow.tsx:61-71`
**Issue:** After `reingestDocument()` resolves successfully, the UI does nothing — `reingestLoading` is set back to false and the icon returns to its idle state. There is no toast, status chip update, or visual acknowledgement that the operation succeeded. Users have no way to confirm the request went through, and may click the button multiple times.

**Fix:** Show a brief inline confirmation using the existing `showRowError` mechanism (or a success variant), or update the row's chip to reflect `status: "pending"`:

```typescript
async function handleReingest() {
  setReingestConfirm(false)
  setReingestLoading(true)
  try {
    await reingestDocument(doc.document_id)
    showRowSuccess("Re-ingestion queued.")   // add a success state alongside rowError
  } catch {
    showRowError("Action failed. Please try again.")
  } finally {
    setReingestLoading(false)
  }
}
```

## Info

### IN-01: `getFileIcon` has no case for `epub` extension

**File:** `frontend/src/lib/fileIcons.tsx:1-61`
**Issue:** `epub` is a supported upload format (listed in `ALLOWED_MIME_TYPES` in `documents.py`), but `getFileIcon` has no `case "epub"` and falls through to the grey generic icon. All other supported formats have a dedicated icon.

**Fix:** Add a case for `epub` in the switch statement, either reusing an existing icon style or creating a dedicated one:

```typescript
case "epub":
  return (
    <svg className={cls} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 18V6C4 4.89543 4.89543 4 6 4H14L20 10V18C20 19.1046 19.1046 20 18 20H6C4.89543 20 4 19.1046 4 18Z" fill="#4A7C59"/>
      <path d="M14 4L20 10H14V4Z" fill="#2E5940"/>
      <text x="4.5" y="16.5" fill="white" fontSize="5.5" fontWeight="bold" fontFamily="sans-serif">EPUB</text>
    </svg>
  )
```

### IN-02: `test_reingest.py` contains only stub tests — zero coverage of the endpoint

**File:** `backend/tests/test_reingest.py:1-38`
**Issue:** All three tests are decorated with `@pytest.mark.skip`. This is noted in the file header as intentional pending test infrastructure, but it means the critical `reingest_document` endpoint (which has a significant bug per CR-01) has zero automated test coverage. The skip markers lower the urgency signal for future contributors.

**Fix:** Once CR-01 is resolved and a test Supabase instance is available, remove the `skip` markers and implement the fixtures. Consider adding a unit-level test that mocks Supabase responses to validate the endpoint logic without a live database, so the tests can run in CI without the full instance.

---

_Reviewed: 2026-04-18T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
