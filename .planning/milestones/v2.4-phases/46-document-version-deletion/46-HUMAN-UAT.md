---
status: partial
phase: 46-document-version-deletion
source: [46-VERIFICATION.md]
started: 2026-04-25T00:00:00.000Z
updated: 2026-04-25T00:00:00.000Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. ON DELETE CASCADE cleanup
expected: When a document row is deleted (either scope), the corresponding rows in document_chunks, document_tables, and document_images are automatically removed. No orphaned chunk/table/image rows remain after deletion.

result: [pending]

### 2. Multi-version dialog rendering
expected: For a document with version_number > 1, the delete dialog shows three footer buttons: Cancel | Delete vN (with actual version number) | Delete All Versions. The active delete button shows a spinner while the request is in-flight. If the request fails, an error message appears inside the dialog without closing it.

result: [pending]

### 3. Non-contiguous version promotion
expected: After uploading v1, v2, v3 of a document — then deleting v2 — then deleting v3 (which was is_latest), the backend promotes v1 as is_latest. Confirms the sort-descending promotion handles gaps in version numbers correctly.

result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
