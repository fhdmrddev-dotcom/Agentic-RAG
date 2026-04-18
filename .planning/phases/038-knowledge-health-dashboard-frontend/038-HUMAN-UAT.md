---
status: partial
phase: 038-knowledge-health-dashboard-frontend
source: [038-VERIFICATION.md]
started: 2026-04-18T17:00:00.000Z
updated: 2026-04-18T17:00:00.000Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Sidebar nav ordering
expected: Library Health button renders between Documents and Skills in the Knowledge Base section of the sidebar
result: [pending]

### 2. Hover-reveal actions
expected: Hovering over a document row reveals Trash2, RefreshCw, FolderInput buttons via opacity-0 → group-hover:opacity-100 transition
result: [pending]

### 3. Re-ingest inline confirmation flow
expected: Clicking RefreshCw shows "Re-ingest this document?" inline text with "Yes, Re-ingest" / "Never mind" buttons; confirming fires POST /documents/{id}/reingest with a Loader2 spinner while in-flight
result: [pending]

### 4. Delete dialog and optimistic removal
expected: Clicking Trash2 opens Dialog with "Delete document?" title and "Keep Document" / "Delete" (destructive) footer; confirming calls deleteDocument and removes the row without a page reload
result: [pending]

### 5. Move to Folder dialog
expected: Clicking FolderInput opens MoveToFolderDialog; Select is populated from listFolders(); confirming calls PATCH /documents/{id}/move
result: [pending]

### 6. Error banner text
expected: When /knowledge-health/summary fails (blocked in devtools), banner shows exactly "Health metrics could not be loaded. Refresh to try again."
result: [pending]

### 7. Empty panel messages
expected: When a panel's array is empty, it shows the panel-specific HealthEmptyState with correct heading and body copy
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps
