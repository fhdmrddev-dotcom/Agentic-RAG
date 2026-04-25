---
phase: 46-document-version-deletion
reviewed: 2026-04-25T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - backend/app/api/documents.py
  - frontend/src/lib/api.ts
  - frontend/src/hooks/useDocuments.ts
  - frontend/src/components/ingestion/DocumentList.tsx
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: issues_found
---

# Phase 46: Code Review Report

**Reviewed:** 2026-04-25
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Phase 46 adds a `scope` query param (`version` | `all`) to `DELETE /documents/{id}`, threads it through `api.ts` and `useDocuments.ts`, and replaces the plain delete dialog in `DocumentList.tsx` with a version-aware three-button variant. The overall architecture is sound and follows established patterns from `restore_document_version`. Security posture is good: `user_id` is enforced in all sibling queries, the `scope` param is validated with a FastAPI regex pattern, and storage file paths come entirely from DB rows.

Four warnings require attention before this ships:

1. The `scope=version` branch never re-reads siblings after the row delete, so it uses a stale list to promote `is_latest` — this is a race-safe design but has an IDOR gap if two users share a filename across folders (see WR-02).
2. The `scope=all` sibling delete fires an unbounded `.in_("id", sibling_ids)` with no `user_id` guard on the DELETE statement itself (only on the preceding SELECT), which is a defense-in-depth miss.
3. The optimistic `scope=all` removal in `useDocuments.ts` filters by `filename` globally, crossing folder boundaries when the same filename exists in multiple folders.
4. The delete dialog description hard-codes `version_number - 1` as the target promoted version, but that is incorrect when `version_number > 1` and lower versions have already been deleted.

---

## Warnings

### WR-01: `scope=all` bulk delete lacks `user_id` guard on the DELETE statement itself

**File:** `backend/app/api/documents.py:521-523`

**Issue:** The `scope=all` path selects siblings with `.eq("user_id", current_user["id"])` (correct), collects their IDs into `sibling_ids`, then deletes via `.in_("id", sibling_ids)` with no `user_id` filter on the DELETE itself. Supabase RLS should prevent cross-user deletes, but if RLS is ever misconfigured or bypassed (e.g., a service-role key leaks), the raw list of IDs becomes an unconstrained delete. The `scope=version` path correctly includes `.eq("user_id", current_user["id"])` on its DELETE (line 533) — the `scope=all` path should match.

**Fix:**
```python
# Replace (line 523):
supabase.table("documents").delete().in_("id", sibling_ids).execute()

# With:
supabase.table("documents").delete() \
    .in_("id", sibling_ids) \
    .eq("user_id", current_user["id"]) \
    .execute()
```

---

### WR-02: `scope=all` sibling query not folder-scoped — can delete versions across folders

**File:** `backend/app/api/documents.py:500-510`

**Issue:** The `scope=all` sibling query correctly matches `(user_id, filename, folder_id)` when `folder_id` is not `None` (line 509). However, the existing versioning system (`upload_document`, lines 206-219) marks `is_latest=False` on siblings by `(user_id, filename)` only, ignoring `folder_id`. This means a user who uploads the same filename into two different folders gets version siblings that span both folders. When `scope=all` is called on a doc in folder A, it is correctly folder-scoped (only deletes folder A's siblings). This is the right behavior and the code is correct.

However, the `scope=version` promotion block (lines 536-554) is correctly folder-scoped. This is internally consistent. **No code change needed here** — recording as a warning because the cross-folder `is_latest` management in `upload_document` (line 213-219) does NOT filter by `folder_id`, which means uploading the same filename in folder B will mark folder A's `is_latest` record as `False`. This is a pre-existing inconsistency that phase 46 did not introduce, but the deletion paths now expose it to users in the UI (promote dialog description says "promotes v{N-1}" but the actual promoted version may differ). **Recommend tracking this as a known issue rather than fixing here.**

---

### WR-03: Optimistic `scope=all` removal in `useDocuments.ts` is not folder-scoped

**File:** `frontend/src/hooks/useDocuments.ts:94-99`

**Issue:** When `scope === "all"`, the optimistic update filters out all documents whose `filename` matches the deleted document, across all folders:

```typescript
setDocuments((prev) => prev.filter((d) => d.filename !== target.filename))
```

The `documents` array in the hook contains all documents from all folders (the backend `list_documents` endpoint returns a merged flat list). If the user has a file named `report.pdf` in folder A and an unrelated `report.pdf` in folder B, deleting all versions in folder A will also optimistically remove folder B's `report.pdf` from the UI. Realtime events will eventually correct this, but the visual glitch (momentary disappearance of an unrelated document) is confusing.

**Fix:**
```typescript
const deleteDoc = useCallback(async (id: string, scope?: "version" | "all") => {
  await deleteDocument(id, scope)
  if (scope === "all") {
    const target = documents.find((d) => d.id === id)
    if (target) {
      // Scope by both filename AND folder_id to avoid removing same-named docs in other folders
      setDocuments((prev) =>
        prev.filter(
          (d) => !(d.filename === target.filename && d.folder_id === target.folder_id)
        )
      )
    }
  } else {
    setDocuments((prev) => prev.filter((d) => d.id !== id))
  }
}, [documents])
```

---

### WR-04: Delete dialog description's "promotes v{N-1}" is misleading when intermediate versions were already deleted

**File:** `frontend/src/components/ingestion/DocumentList.tsx:408-409`

**Issue:** The dialog description reads:

```tsx
to promote v{(deleteTarget.version_number ?? 1) - 1} as current
```

This assumes the next version after deleting `vN` will be `vN-1`. But if the user previously deleted `vN-1` (via `scope=version`), the backend correctly promotes the next-highest sibling (e.g., `vN-2`). The UI label will show "promotes v2 as current" when the actual outcome will be "promotes v1 as current". This is cosmetic but technically incorrect and could confuse users.

**Fix:** Change the description to avoid stating a specific version number for the promoted target, since the frontend does not know which sibling will be promoted without an extra fetch:

```tsx
<span className="font-medium text-foreground">Delete v{deleteTarget.version_number}</span>{" "}
to promote the previous version as current, or delete all versions permanently.
```

---

## Info

### IN-01: `hasVersions` helper uses `version_number > 1` but `version_number` is optional

**File:** `frontend/src/components/ingestion/DocumentList.tsx:291`

**Issue:** `hasVersions` is defined as:
```typescript
const hasVersions = (doc: Document) => (doc.version_number ?? 1) > 1
```
The `?? 1` fallback correctly handles the case where `version_number` is undefined (pre-versioning documents). This is fine. However, the dialog description later uses `deleteTarget.version_number` directly (without the nullish fallback) in the template literal:

```tsx
This document has {deleteTarget.version_number} versions.
```

If `version_number` is somehow `undefined` despite `hasVersions` gating (e.g., a race on state), this renders "This document has undefined versions." The risk is very low but the fix is trivial.

**Fix:**
```tsx
This document has {deleteTarget.version_number ?? 1} versions.
```

---

### IN-02: `deleteDoc` adds `documents` to `useCallback` dependency array, causing stale-callback risk on rapid sequential deletes

**File:** `frontend/src/hooks/useDocuments.ts:92-103`

**Issue:** Adding `documents` to the `useCallback` dep array is correct for the `scope=all` branch (which needs to look up the filename). However, it means `deleteDoc` is recreated on every document list update, which will cause `DocumentList`'s `onDelete` prop reference to change after each upload/Realtime update. This is not a bug — it's the standard React pattern when a callback reads from state — but callers that `useCallback`/`useMemo` on `onDelete` would need to update their own dep arrays. Currently `IngestionPage` passes `deleteDoc` directly without memoizing, so no issue exists today.

**Suggestion:** Document this with a brief comment:
```typescript
// documents in deps is required: scope=all branch reads documents to find filename
}, [documents])
```

---

### IN-03: `scope=version` storage delete uses `target["file_path"]` without null guard

**File:** `backend/app/api/documents.py:529`

**Issue:** In the `scope=all` path the code defensively checks `if sibling.get("file_path"):` before calling `storage.remove()` (line 514). The `scope=version` path does not have this guard:

```python
supabase.storage.from_("documents").remove([target["file_path"]])
```

If `file_path` is `None` (possible for documents inserted before the storage upload pattern was established), this passes `[None]` to `remove()`. The surrounding `try/except Exception: pass` will swallow any resulting error, so this does not cause a crash, but it is an inconsistency with the `scope=all` path.

**Fix:**
```python
if target.get("file_path"):
    try:
        supabase.storage.from_("documents").remove([target["file_path"]])
    except Exception:
        pass
```

---

_Reviewed: 2026-04-25_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
