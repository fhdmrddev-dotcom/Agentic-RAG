---
status: partial
phase: 199-the-component-map
source: [199-VERIFICATION.md]
started: 2026-08-19T08:30:00Z
updated: 2026-08-19T08:30:00Z
---

## Current Test

[awaiting human testing]

## Why every one of these is a HUMAN row

jsdom runs **no layout engine**: `clientHeight` and `getBoundingClientRect()` return `0`. A height
or spacing "measurement" there computes `0 − 0` and reads as a **pass**. Every rendered-geometry
and rendered-colour claim in Phase 199 therefore shipped as a **stated surrogate** (a class-level
or DOM-order assertion) with the real check owed here. These rows are pre-declared debt, not gaps
discovered after the fact — the plans named them while the work was being done.

⚠ **Run row 1 first.** It is the only row on the **chat** surface, and it is the one a
workflow-surface-only pass would silently miss: `WorkspacePanel` is a cross-surface shell whose
**only** mount is `ChatLayout.tsx:673`.

## Tests

### 1. The panel's empty state, on the CHAT surface
expected: Open a Deep chat thread with no workspace activity. The panel reads calm and complete
without its decorative `Inbox` glyph — finished and quiet, **not** a gap where an icon used to be.
result: [pending]

### 2. An unknown expiry reads calm, not alarmed
expected: Upload a template whose `expires_at` the wire does not carry. The file row reads
`expiry unknown` in a **muted** (non-alarm) tone beside the Template badge. No `NaN`, no amber, and
never `no expiry` — that would be a known-none nobody claimed.
result: [pending]

### 3. The file row holds its line at real widths
expected: At ~1024px and again at ≥1440px, open the workspace panel with a long-path template row.
The name truncates and the badge / caption / size group neither wraps nor overflows the 380px panel.
result: [pending]

### 4. An unreadable definition says so
expected: Open a workflow run whose definition cannot be read. The header states this honestly with
**no version chip shown** — no fabricated `v0`, no plausible-but-wrong workflow name. (This is the
defect 199-07 fixed; the row confirms the fix in the product, not just in jsdom.)
result: [pending]

### 5. The node stays legible at 50% zoom
expected: On the phase-node canvas, zoom out to 50%. The node title and supporting line are still
legible at the effective ~7px / ~5.5px rendered size — **or** sheet c2's readability claim is found
false at that zoom, which is an equally valid and reportable outcome.
result: [pending]

### 6. Create leads the library toolbar as the row wraps
expected: Open the Workflows library at a narrow viewport. The filled *Build a workflow* control
stays the first thing on the row, on the search field's baseline, and never drops out of first
position as the row wraps.
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
