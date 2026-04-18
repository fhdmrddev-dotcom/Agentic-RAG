---
phase: 036-multi-modal-query-library-ui
status: all_fixed
findings_in_scope: 7
fixed: 7
skipped: 0
iteration: 1
---

# Code Review Fix Report — Phase 36

## Summary

All 7 critical and warning findings fixed across 3 backend files and 1 frontend component. The CR-01 security fix (base64 size cap + client reuse) required companion test updates to patch the newly introduced module-level `OpenAI` client instantiation. WR-04 (skip empty-description images) was bundled with CR-01 since it touched the same loop. All 6 unit tests in `test_multimodal_query.py` pass after fixes.

## Fixes Applied

### CR-01: Base64 image payload uncapped + per-call client instantiation
**Status:** Fixed
**Commit:** `a57e9e5`
**Change:**
- Added `_MAX_B64_BYTES = 512 * 1024` module constant
- In `extract_and_store_images`, skip images where `len(b64) > _MAX_B64_BYTES` with `log.debug`
- Create one `OpenAI` client at the top of `extract_and_store_images` and pass it to `describe_image` via new optional `client` parameter
- `describe_image` falls back to creating its own client if `client=None` (backward compatible)

---

### WR-01: `column_filter` OR vs AND semantics
**Status:** Fixed
**Commit:** `a57e9e5`
**Change:** Replaced the inner `for col_name` append loop with an outer `match = True` flag pattern. Each row now requires ALL filter keys to match (AND semantics). First non-matching column breaks early and excludes the row.

---

### WR-02: `delete_document` missing `user_id` filter
**Status:** Fixed
**Commit:** `7eb983a`
**Change:** Chained `.eq("user_id", current_user["id"])` onto the delete call, matching the ownership filter pattern used in `rename_thread`, `delete_thread`, and the ownership pre-check above.

---

### WR-03: `restore_document_version` missing `result.data` guard
**Status:** Fixed
**Commit:** `7eb983a`
**Change:** Added `if not result.data: raise HTTPException(status_code=404, detail="Document not found after restore")` before `return result.data[0]`, preventing an `IndexError` 500 if Supabase returns no data rows.

---

### WR-04: Empty-description images inflate `image_count`
**Status:** Fixed
**Commit:** `a57e9e5`
**Change:** After the `describe_image` try/except, added `if not description: log.debug(...); continue` so rows with empty description are never appended to `rows` and never inserted into `document_images`. This prevents empty rows from inflating `image_count` on the library page.

Note: `test_image_chunk_skips_empty_description` remains valid — it asserts `embed_texts` is not called, which is still true (rows list is empty so neither `document_images.insert` nor `embed_texts` is called).

---

### WR-05: `test_image_chunk_insertion` missing chunk insert assertion
**Status:** Fixed
**Commit:** `2dffec5`
**Change:**
- Refactored mock wiring to expose `chunks_tbl_mock` outside the `_table` closure
- Added `chunks_tbl_mock.insert.assert_called_once()` to verify insert was actually called
- Asserted full row shape: `document_id`, `user_id`, `content` (`"[Image p.2]: A bar chart showing Q3 revenue."`), `chunk_index` (`5` = base_idx 4+1), `embedding` (1536-dim vector)
- Added `patch("openai.OpenAI")` to both image tests to prevent real `OpenAI` client instantiation triggered by the CR-01 fix

---

### WR-06: `DocumentList` restore error silently swallowed
**Status:** Fixed
**Commit:** `783fd67`
**Change:**
- Added `restoreError` state (`useState<string | null>(null)`) to `VersionHistoryPanel`
- `handleRestore` catch block sets `"Restore failed. Please try again."` instead of closing dialog
- Dialog stays open on error — user can retry or cancel
- Error is cleared on: new attempt start, successful restore, Cancel button click, dialog dismiss
- Error text rendered in `text-destructive` above footer buttons

---

## Skipped Findings

None — all 7 critical and warning findings were applied.
