---
status: complete
phase: 289-the-run-page-and-its-evidence
source: [289-VERIFICATION.md, 289-VALIDATION.md]
started: 2026-10-20T00:00:00Z
updated: 2026-10-20T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. G-4 operator sign-off: the finished-run evidence report against sketch 289-run-evidence-page winner B
expected: Open a finished run (`/app?run=<uuid>`). It should show one read-only column: title block with the "Read-only record" mark, Download JSON and Print / save as PDF; the facts strip; the "edited since this run" banner when applicable; sections 1-4; the KB step's evidence line ("Answered from … · ● Medium · 0.47") and no line on non-KB steps. Print preview is the page itself. You'd recognise failure as: the live spine instead of the report, a write control, or a missing section.
result: pass (operator approved 2026-10-20)

### 2. G-4 operator sign-off: print and JSON export
expected: Print / save as PDF renders the report cleanly with no app chrome. The downloaded JSON's four sections match the page (S3 was machine-checked; this is the eyeball check).
result: pass (operator approved 2026-10-20)

### 3. Anthropic roster row (D-17)
expected: Re-run the S1 roster row on Anthropic once billing is restored. It is blocked on 2026-10-19 and 2026-10-20: "credit balance is too low".
result: [blocked: billing]

## Summary

total: 3
passed: 2
issues: 0
pending: 0
skipped: 0
blocked: 1

## Gaps

- BUG-261020-01 (major, inherited from 091/092): a human step's answer never reaches the next step. Found live; open.
- BUG-261020-02 (major, CR-01 residual): a later non-citing step can restate withheld-document substance to a colleague. Open.
