---
phase: 036-multi-modal-query-library-ui
status: issues_found
files_reviewed: 13
findings:
  critical: 1
  warning: 6
  info: 3
  total: 10
---

# Code Review — Phase 36: multi-modal-query-library-ui

**Depth:** standard
**Files reviewed:** 13
**Findings:** 1 critical, 6 warning, 3 info

## Summary

Phase 36 introduced the `query_tables` tool (MODAL-03) and wired multimodal image/table extraction into the ingestion pipeline. The implementation is largely solid: error paths are wrapped, the row-cap and column-filter logic are correct, and the frontend `DocumentList` component correctly shows `table_count`/`image_count` badges. One critical security issue exists in `threads.py` where the `describe_image` function creates an OpenAI client without error handling for missing/invalid credentials and sends an uncapped base64 payload. The remaining findings are warnings covering potential runtime errors, a data-loss edge case, and a silent test gap.

---

## Findings

### CR-01: Base64 image payload is uncapped — potential DoS and cost overrun

**File:** `backend/app/services/multimodal_service.py` (line 217–238)
**Severity:** Critical
**Category:** Security / Performance

**Issue:** `describe_image` passes the raw `b64_png` string directly into the vision API message without any size check. A legitimate document with very large embedded images (or maliciously crafted PDF) could send hundreds of kilobytes of base64 per call to the external API. With `_MAX_VISION_CALLS = 20`, this means up to 20 uncapped vision API calls per document. There is no guard on the size of `b64_png` before the API call, and the `detail="low"` hint only affects how the provider internally processes the image — it does not prevent the full payload from being transmitted or billed.

Additionally, `describe_image` instantiates a new `OpenAI` client on every call instead of receiving one from the caller. This means a fresh TCP connection + TLS handshake per image, with no connection pooling.

**Fix:**
```python
# At top of extract_and_store_images, skip images whose b64 is too large
_MAX_B64_BYTES = 512 * 1024  # 512 KB — enough for any low-detail vision call

# In the per-image loop:
b64 = img["b64_png"]
if len(b64) > _MAX_B64_BYTES:
    log.debug("Skipping oversized image in %s (%d bytes b64)", document_id, len(b64))
    continue
```
For the client reuse concern, pass the client in or create it once at the top of `extract_and_store_images`.

---

### WR-01: `column_filter` can produce incorrect multi-column AND vs OR semantics

**File:** `backend/app/services/multimodal_service.py` (lines 406–415)
**Severity:** Warning
**Category:** Bug

**Issue:** When `column_filter` contains multiple keys, the current loop appends a row to `matched` for each key that matches, rather than requiring ALL keys to match. This means a row passes the filter if any one column matches (OR semantics), not all columns (AND semantics). The tool description says "filter rows where a specific column matches a value", implying single-key use — but the schema accepts `additionalProperties`, making multi-key filters possible. A user sending `{"Region": "APAC", "Year": "2024"}` would get rows matching either condition.

**Fix:**
```python
if column_filter:
    matched = []
    for row in rows:
        match = True
        for col_name, col_val in column_filter.items():
            try:
                col_idx = headers.index(col_name)
                if not (len(row) > col_idx and str(row[col_idx]) == str(col_val)):
                    match = False
                    break
            except ValueError:
                match = False
                break
        if match:
            matched.append(row)
    rows = matched
```

---

### WR-02: `delete_document` does not delete user-scoped row — RLS bypass risk

**File:** `backend/app/api/documents.py` (line 439)
**Severity:** Warning
**Category:** Security

**Issue:** The `delete_document` endpoint performs the ownership check correctly (`.eq("user_id", ...)`) but the subsequent delete call does NOT include the `user_id` filter:

```python
supabase.table("documents").delete().eq("id", document_id).execute()
```

If Supabase RLS is misconfigured or the service-role key is used, any document with that `document_id` can be deleted regardless of ownership. The pattern used everywhere else (e.g., `rename_thread`, `delete_thread`) always chains `.eq("user_id", current_user["id"])` on mutations.

**Fix:**
```python
supabase.table("documents").delete().eq("id", document_id).eq("user_id", current_user["id"]).execute()
```

---

### WR-03: `restore_document_version` response assumes `result.data[0]` exists without guard

**File:** `backend/app/api/documents.py` (line 413)
**Severity:** Warning
**Category:** Bug / Error Handling

**Issue:** After the `update({"is_latest": True})` call on line 409-412, `result.data[0]` is accessed unconditionally. If the Supabase update returns an empty data list (e.g., row was deleted between check and update, or Supabase returns no `data` on update calls with certain configs), this raises an `IndexError` which will surface as a 500.

**Fix:**
```python
if not result.data:
    raise HTTPException(status_code=404, detail="Document not found after restore")
return result.data[0]
```

---

### WR-04: `describe_image` swallows exception silently but error is also caught by outer try/except

**File:** `backend/app/services/multimodal_service.py` (lines 272–276)
**Severity:** Warning
**Category:** Error Handling

**Issue:** The inner `try/except` on `describe_image` (lines 272–276) correctly catches errors and sets `description = ""`. However, because all rows — including those with `description = ""` — are appended to `rows` and then inserted into `document_images`, a document with a failed vision call will still have an image row stored (with empty description). This row is then excluded from chunk embedding (correct), but the image row in `document_images` persists with no useful data. Over time, documents can accumulate empty-description image rows that waste storage and inflate `image_count` on the library page.

More importantly, the tests `test_image_description_failure_continues` in `test_multimodal_extraction.py` asserts that an empty description row IS inserted — meaning this behavior is tested and intentional by design. Flag for product decision: should zero-description images be stored at all?

**Fix (optional, product decision):**
```python
if not description:
    log.debug("Skipping image with no description in %s", document_id)
    continue  # Don't append to rows
```

---

### WR-05: `test_image_chunk_insertion` does not assert chunk insert was called

**File:** `backend/tests/unit/test_multimodal_query.py` (lines 109–112)
**Severity:** Warning
**Category:** Test Quality

**Issue:** The test comment says "Verify via embed was called — chunk insert happens if embed succeeds" and only asserts `mock_embed.called`. It does NOT assert that `supabase.table("document_chunks").insert(...)` was actually called, nor does it assert the content or shape of the inserted rows. This test would pass even if the chunk insert code was deleted, as long as `embed_texts` was called.

**Fix:**
```python
# After the with block, capture the document_chunks table mock and assert insert was called
# Reconstruct by using side_effect tracking or inspect call_args on the mock
# At minimum, verify embed was called with the right text AND chunks_insert_exec.data is truthy path was hit
```

---

### WR-06: `DocumentList` — restore error silently swallowed with no user feedback

**File:** `frontend/src/components/ingestion/DocumentList.tsx` (lines 177–179)
**Severity:** Warning
**Category:** Error Handling

**Issue:** In `handleRestore`, the `catch` block sets `restoreTarget(null)` (closing the dialog) but provides no user feedback. If the restore API call fails (network error, 404, 500), the user sees the dialog close with no indication of what happened. The document list will not have been refreshed, so the UI will silently remain in the pre-restore state with no error visible.

**Fix:**
```tsx
const [restoreError, setRestoreError] = useState<string | null>(null)

// In catch block:
} catch (err) {
  setRestoreError("Restore failed. Please try again.")
  // Do NOT close dialog or clear restoreTarget — let user retry or cancel
} finally {
  setRestoring(false)
}
```

---

### IN-01: `get_tools()` count test is fragile to new tools

**File:** `backend/tests/unit/test_module7_tools.py` (lines 103–108)
**Severity:** Info
**Category:** Style / Maintainability

**Issue:** `test_returns_base_tools_without_tavily_or_sandbox` hardcodes the expected tool count as `14`. Every time a new tool is added to `get_tools()`, this test breaks. Since Phase 36 added `QUERY_TABLES_TOOL`, this count was presumably updated from 13 to 14 — confirming the fragility of this approach.

**Fix:** Replace the hardcoded count assertion with a set membership test, or at minimum add a comment explaining which 14 tools are expected.

---

### IN-02: `multimodal_service.py` header comment says "Phase 35" but file now contains Phase 36 code

**File:** `backend/app/services/multimodal_service.py` (line 3)
**Severity:** Info
**Category:** Style

**Issue:** The module docstring reads "Multi-modal extraction service for Phase 35" but now contains the `handle_query_tables` and `_fetch_document_tables` functions introduced in Phase 36.

**Fix:** Update docstring to "Phase 35–36" or remove phase reference entirely.

---

### IN-03: `VersionHistoryPanel` — missing `fetchDocumentVersions` error handling

**File:** `frontend/src/components/ingestion/DocumentList.tsx` (lines 165–169)
**Severity:** Info
**Category:** Error Handling

**Issue:** The `useEffect` calling `fetchDocumentVersions` has no `.catch()` handler. If the API call fails, the promise rejection is unhandled: `loading` will be set to `false` (via `.finally`), `versions` will remain `[]`, and the panel will display "No version history available." without indicating a network or server error to the user.

**Fix:**
```tsx
useEffect(() => {
  fetchDocumentVersions(documentId)
    .then(setVersions)
    .catch(() => {
      // versions stays [] — could set an error state here
    })
    .finally(() => setLoading(false))
}, [documentId])
```

---

## Files Reviewed

| File | Status | Findings |
|------|--------|----------|
| `backend/app/services/multimodal_service.py` | Issues | CR-01, WR-01, WR-04, IN-02 |
| `backend/app/api/documents.py` | Issues | WR-02, WR-03 |
| `backend/app/api/threads.py` | Clean | — |
| `backend/app/services/openai_service.py` | Clean | — |
| `backend/app/models/document.py` | Clean | — |
| `backend/tests/unit/test_multimodal_query.py` | Issues | WR-05 |
| `backend/tests/unit/test_multimodal_extraction.py` | Clean | — |
| `backend/tests/unit/test_openai_service.py` | Clean | — |
| `backend/tests/unit/test_module7_tools.py` | Issues | IN-01 |
| `backend/tests/integration/test_documents.py` | Clean | — |
| `backend/tests/unit/test_document_versioning.py` | Clean | — |
| `frontend/src/types/index.ts` | Clean | — |
| `frontend/src/components/ingestion/DocumentList.tsx` | Issues | WR-06, IN-03 |
