---
status: complete
phase: 47-document-list-upload-polish
source:
  - 47-01-SUMMARY.md
  - 47-02-SUMMARY.md
started: 2026-04-25T00:00:00Z
updated: 2026-04-25T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Root document count badge
expected: The "Root" entry in the folder tree shows a small subdued count badge matching the number of documents with no folder assignment.
result: pass

### 2. Root section header
expected: Clicking "Root" in the folder tree causes the right panel to display a "Root" heading with subtitle "Documents not assigned to a folder" above the document list.
result: pass

### 3. Root empty state copy
expected: With no root-level documents, clicking Root shows "No root documents yet." and below it "Upload files above to add them here." (hint now shows for root, not just folders).
result: pass

### 4. 50 MB upload size limit error
expected: Attempting to upload a file larger than 50 MB fails with the message "File too large. Maximum size is 50 MB." displayed in red in the upload area. Files ≤50 MB upload normally.
result: pass

## Summary

total: 4
passed: 4
issues: 0
pending: 0
skipped: 0

## Gaps

[none]
