---
status: partial
phase: 280-in-once-out-clean
source: [280-VERIFICATION.md]
started: 2026-10-14T20:30:00+04:00
updated: 2026-10-14T20:30:00+04:00
---

## Current Test

[awaiting operator rulings]

## Tests

### 1. SC#2 OneDrive live re-drive: 104/105 (team-note-058 TLS download failure, never retried)
expected: Operator rules the shortfall belongs to BUG-261014-02 (then BUG-260910-04 closes), OR a re-drive imports all 105.
result: [pending]

### 2. WR-01 ruling: re-upload whose only match is a retired same-name version restores it (4ed20aee4)
expected: Operator confirms auto-restore, or asks for a 409 pointing to Restore instead.
result: [pending]

### 3. WR-02 ruling: concurrent same-name new versions settle to one latest row, "later upload wins" (8aeab2e0b)
expected: Operator confirms.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
