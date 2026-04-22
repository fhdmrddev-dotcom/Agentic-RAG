---
status: complete
phase: 038-knowledge-health-dashboard-frontend
source: [038-01-SUMMARY.md, 038-02-SUMMARY.md]
started: 2026-04-18T17:00:00.000Z
updated: 2026-04-18T18:00:00.000Z
---

## Current Test

[testing complete]

## Tests

### 1. Sidebar nav — Library Health button
expected: Library Health button appears in the sidebar between Documents and Skills. Clicking it loads the Library Health page (not a 404 or blank screen).
result: pass

### 2. KPI stat bar
expected: Four stat cards appear at the top of the Library Health page — Library Size, Active This Month, Needs Attention, Never Used — each showing a number. Numbers are non-negative integers. Coloured icons match card type (blue for active, amber for needs attention, orange for never used).
result: pass

### 3. Retrieval chart
expected: If any documents have been retrieved in the last 30 days, a full-width "Document Usage — Last 30 Days" horizontal bar chart appears below the stat cards. Bars are sorted descending by retrieval count. Hovering a bar shows a tooltip with the full filename and count. If no documents retrieved, chart does not render.
result: pass

### 4. Hover-reveal actions on document rows
expected: Hovering over a document row in any panel reveals Trash2, RefreshCw, and FolderInput icon buttons via opacity transition. Buttons are not visible before hover.
result: pass

### 5. Re-ingest inline confirmation
expected: Clicking RefreshCw shows "Re-ingest this document?" inline prompt with "Yes, Re-ingest" / "Never mind" buttons. Clicking "Yes, Re-ingest" fires the request with a loading spinner and shows "Re-ingestion queued." success text below the row. Clicking "Never mind" dismisses without action.
result: pass

### 6. Delete dialog and optimistic removal
expected: Clicking Trash2 opens a dialog with "Delete document?" title. Confirming removes the row from the panel immediately without page reload. Cancelling does nothing.
result: pass

### 7. Move to Folder dialog
expected: Clicking FolderInput opens a dialog. The folder select is populated from the user's folders. Selecting a folder and confirming calls the move endpoint and closes the dialog.
result: pass

### 8. Panel pagination
expected: Each panel shows at most 5 document rows by default. If a panel has more than 5 documents, a "Show X more" button appears below the list. Clicking it expands to show all documents. Clicking "Show less" collapses back to 5.
result: pass
note: page scroll was broken (overflow-hidden in layout shell) — fixed inline, now scrolls correctly

### 9. Low Confidence — mini progress bar chip
expected: Each document row in the Low Confidence panel shows a small progress bar (not a plain text chip) alongside the percentage. The bar visually reflects the similarity score (e.g. 35% fills roughly 1/3 of the bar width). Colour is amber.
result: pass

### 10. Stale — colour-coded chip
expected: Stale document chips change colour by age: amber for 90–180 days, orange for 180–365 days, red for 365+ days. The number of days is shown in the chip.
result: pass

### 11. Refresh button
expected: A "Refresh" button with a RefreshCw icon appears in the top-right of the page header. Clicking it re-fetches all health metrics without a full page reload. The icon spins while fetching.
result: pass

### 12. Error banner
expected: When the /knowledge-health/summary endpoint fails (block it in devtools), the page shows a red error banner: "Health metrics could not be loaded. Refresh to try again."
result: skipped
reason: user skipped DevTools network blocking test

### 13. Empty panel messages
expected: When a panel's data array is empty, it shows a centred empty state with an icon, heading, and body message specific to that panel (e.g. "Great coverage" for Never Retrieved when all docs have been used).
result: pass

### 14. Loading skeleton
expected: While health data is loading, the page shows animated skeleton placeholders for the stat bar, chart area, and the four panel cards — not a blank screen or spinner.
result: pass

## Summary

total: 14
passed: 13
issues: 0
pending: 0
skipped: 1
blocked: 0

## Gaps

