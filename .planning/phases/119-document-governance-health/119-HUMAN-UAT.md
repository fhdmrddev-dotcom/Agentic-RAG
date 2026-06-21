---
status: partial
phase: 119-document-governance-health
source: [119-VERIFICATION.md]
started: 2026-06-21T00:00:00Z
updated: 2026-06-21T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Governance surface reachable (desktop + mobile)
expected: Navigating to Governance in the sidebar renders GovernancePage (NOT KnowledgeHealthPage). Three stacked cards (Broken relationships / Unclassified documents / Low-confidence metadata) with a "Document Governance" h1, each showing a positive all-clear empty state or populated rows; sidebar shows the ShieldCheck glyph labelled "Governance". At <768px the cards stack single-column.
result: [pending]

### 2. Each signal row links to its fix (DGOV-02 link-out)
expected: Clicking a row in each of the three cards (seed at least one doc per signal) opens the DocumentDetailPanel on the right showing the clicked document's metadata. No delete/reingest/move controls appear on the governance row itself. Closing the panel (X) returns to the full-width governance view. The broken card opens the resolved-latest document (WR-02 fix), not a dead click.
result: [pending]

### 3. Mobile-responsive layout + panel collapse (<768px)
expected: At <768px width the 3 cards stack in a single column and the detail panel opens as a bottom-sheet or full/near-full-width overlay (not a side-split that overflows the viewport).
result: [pending]

### 4. Keyboard operability (WCAG 2.1 AA SC 2.1.1, 2.4.7)
expected: Every GovernanceRow is reachable by Tab, activatable by Enter/Space (opens the panel), and shows a visible focus-visible ring.
result: [pending]

### 5. Screen-reader pass (WCAG 2.1 AA SC 4.1.3)
expected: Loading state announced via role=status; error states via role=alert; each row button has a meaningful aria-label ("Open <filename>"). Announcement order/verbosity is sensible under VoiceOver/NVDA.
result: [pending]

## Summary

total: 5
passed: 0
issues: 1
pending: 5
skipped: 0
blocked: 0

## Gaps

### BUG-260620 — Low-confidence card surfaced docs whose detail panel showed every field ≥ 0.90 — RESOLVED
found: 2026-06-21 (operator manual UAT)
status: resolved
fix: commit 573dfd50
The Low-confidence metadata card surfaced docs that, when opened, showed all metadata
confidences high. Root cause: `_fetch_low_confidence` counted EVERY numeric `_confidence`
key `< 0.5`, including fields the extractor left BLANK (`date`/`author` = `None` carried a
0.1/0.2 score). The detail panel correctly hides empty fields (`resolveFieldState.empty`), so
the governance signal was dishonest. Fixed by aligning the backend scan with the panel's
`isLow` predicate: skip `_`-prefixed keys, skip fields whose value is empty (missing metadata
≠ low-confidence metadata), and skip user-confirmed fields (`_source[field] == "user"`).
Verified live: the previously-flagged doc set dropped 4 → 0; full 119 backend suite 27 passed
(incl. new empty-field / user-confirmed exclusion regressions + the non-vacuous leak proof).
