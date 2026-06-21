---
status: passed
phase: 114-virtual-folders-range-date-filters-view-builder-sidebar
source: [114-06-PLAN.md Task 3 (G-4 checkpoint:human-verify)]
driver: orchestrator (Claude) via Chrome DevTools MCP
started: 2026-06-19
updated: 2026-06-19
environment: live local stack — Vite :5173, FastAPI :8000, Supabase :54321/:54322, Redis :6379; real ~33-doc corpus; migration 074 typed columns live
---

## Current Test

[complete — all core scenarios passed]

## Tests

### 1. Build a filter → live count + amber-at-zero + type-aware operators (SC#2/UX-01)
expected: condition popover is type-aware; live "N documents match" count updates as you compose and turns amber at zero.
result: PASS — text field (title) offered is / is one of / contains / is empty; switching to `date` swapped to within next… / older than… / before / after / is between / is empty. "date within next 30 days" resolved to "0 documents match" rendered in **amber**; the document list re-resolved to empty. Count is debounced ("counting…" → result).

### 2. Relative-date control — resolved-window readout + overdue note + server-derived (D-114-16 / D-114-5)
expected: legible resolved window; "updates automatically" note; overdue-excluded note; window from server clock.
result: PASS — `[30][days]` stepper showed "Jun 19, 2026 – Jul 19, 2026" (today 2026-06-19 + 30d), "Updates automatically — the dates shift forward as time passes", and "Shows items coming due in this window. Already-overdue items are not included."

### 3. Non-zero count accuracy + Save as view → Views group (VIEW-03)
expected: count matches DB; save adds a view to the Views group reading as a saved filter with a count badge.
result: PASS — `document_type is report` → "11 documents match" (== DB count 11); list re-resolved to the 11 report docs across multiple folders (confirms whole-corpus own+global resolve, not Root-scoped). Saved as "Reports" → appeared in the VIEWS group with an "11" count badge + Actions menu; main view read "Reports · Documents matching this saved filter".

### 4. Select view + Edit → filter loads back → save PATCHes the same view (D-114-3, UAT step 4)
expected: Edit loads the filter pre-filled; saving updates the SAME view (not a clone).
result: PASS (after the checkpoint edit-on-save fix `2b3ebe0e`) — Edit filter loaded the chip back and the save button read "**Update view**"; changed `report`→`meeting notes` (live count → "3 documents match", list → 3 meeting-notes docs); Update view → name pre-filled "Reports" → Save. DB verified: exactly **1** view named "Reports" with filter `document_type eq "meeting notes"` (PATCH, not POST). Delete → inline confirm ("documents are not affected") → view removed, list restored.

### 5. Open document → detail panel + sidebar→rail collapse + FilterBar→chip + column-shed (D-114-17)
expected: Phase-112 detail panel opens; sidebar collapses to ~50px rail; FilterBar becomes a summary chip; document table sheds columns; reverses on close.
result: PASS — clicking a row opened the DocumentDetailPanel (metadata + ConfidenceChips: TITLE/AUTHOR/TYPE/TOPICS/LANGUAGE/SUMMARY "EXTRACTED", DATE "Not extracted — add"); sidebar collapsed to a rail ("Expand sidebar"); FilterBar collapsed to "1 filter"; table shed Type/Size/Chunks (showed Filename/Status/Actions). Closing restored sidebar + columns.

### 6. State matrix — dark theme + mobile (Aether / Deep Midnight; WCAG)
expected: new components render on-brand in both themes; mobile is usable, no <768px invisible-docs regression.
result: PASS (core) — Deep Midnight dark theme rendered the rail, chip, table, and detail panel cleanly with legible contrast. At 390px the detail panel became a full-width bottom-sheet (drag handle) with all metadata legible — no recurrence of the Phase-112 <768px invisible-docs bug. WCAG measured 2026-06-20 via Lighthouse (snapshot, desktop) on the live Documents page (builder open + view selected): **accessibility 87/100, best-practices 100**. The 2 failing audits — color-contrast (19 nodes, predominantly the shared app-wide `text-muted-foreground/60` token) + button-name (46 nodes, predominantly pre-existing DocumentList/nav icon buttons) — are cross-cutting design-system issues, NOT 114-introduced (114's own controls carry accessible names). Operator elected to complete 114 and log the app-wide WCAG AA remediation as **SEED-092**.

## Summary

total: 6
passed: 6
issues: 0 (2 minor/pre-existing notes below)
pending: 0
skipped: 0
blocked: 0

## Notes / Not-separately-exercised
- P3 (non-blocking): Views count badge refresh lags one render after an in-place Update (self-corrected on next re-render; DB/list always correct).
- Pre-existing (out of scope): radix `DialogContent` missing `DialogTitle` a11y warning — not from any 114 component.
- Not exercised (no global view seeded / lower value): G-pill on a GLOBAL view; pin-persist-across-reload of the rail; ~10k-corpus UI perf (DB-level SC#3 index-use already proven by EXPLAIN in 114-03).

## Gaps
(none blocking)
