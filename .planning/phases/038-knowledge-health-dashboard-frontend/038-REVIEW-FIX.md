---
phase: 038-knowledge-health-dashboard-frontend
fixed_at: 2026-04-18T00:00:00Z
fix_scope: critical_warning
findings_in_scope: 5
fixed: 5
skipped: 0
iteration: 1
status: all_fixed
---

# Phase 038: Code Review Fix Report

**Fixed:** 2026-04-18T00:00:00Z
**Scope:** critical + warning (5 findings)
**Status:** all_fixed

## Fixes Applied

### CR-01 — `reingest_document` never triggered background ingestion
**File:** `backend/app/api/documents.py`
**Fix:** Added `BackgroundTasks` dependency, fetched raw file bytes from Supabase Storage, re-extracted text via `extract_text()`, and scheduled `ingest_document` as a background task. Documents now actually get re-ingested instead of being stuck at `pending` indefinitely.

### WR-01 — `move_document` unguarded `result.data[0]` access
**File:** `backend/app/api/documents.py`
**Fix:** Added `if not result.data: raise HTTPException(status_code=404, ...)` guard before accessing `result.data[0]`, matching the pattern already used in `restore_document_version`.

### WR-02 — `HealthDocumentRow` discards `newFolderId` from `onMoved` silently
**File:** `frontend/src/components/health/HealthDocumentRow.tsx`
**Fix:** Renamed callback parameter from `()` to `(_newFolderId)` to document the intentional discard and satisfy the `onMoved(folderId: string | null) => void` interface contract.

### WR-03 — `VersionHistoryPanel` silently swallows fetch errors
**File:** `frontend/src/components/ingestion/DocumentList.tsx`
**Fix:** Added `fetchError` state, `.catch(() => setFetchError(...))` on the version fetch promise, and a dedicated error render path that shows the error message in destructive text instead of the misleading "No version history available" empty state.

### WR-04 — Re-ingest action provides no success feedback
**File:** `frontend/src/components/health/HealthDocumentRow.tsx`
**Fix:** Added `rowSuccess` state with `showRowSuccess()` helper (mirrors existing `showRowError` pattern with 4-second auto-dismiss). `handleReingest` now calls `showRowSuccess("Re-ingestion queued.")` on success, rendered as primary-colored text below the row.

## Skipped

None.

## Info Findings (out of scope)

- **IN-01:** Missing `epub` icon in `getFileIcon` — not fixed (info only)
- **IN-02:** Stub-only tests in `test_reingest.py` — not fixed (info only, depends on test infrastructure)

---

_Fixed: 2026-04-18T00:00:00Z_
_Commit: fix(038) — 027da18_
