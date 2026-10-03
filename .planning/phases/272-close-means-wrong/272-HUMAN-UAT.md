---
status: partial
phase: 272-close-means-wrong
source: [272-VERIFICATION.md]
started: 2026-10-03T00:00:00Z
updated: 2026-10-03T00:00:00Z
---

## Current Test

[awaiting human testing — operator backend restart first]

## Tests

### 1. Live re-drive of the review-fix rules (after a backend restart)
expected: CR-01 — a `topics eq <value>` filter returns the matching document; CR-02 — `within_next` on a custom date field is refused as kind 3 (not run on `date`); WR-02 — after a zero-match date filter, a wide same-field retry (open-ended `after`) is refused while a disjoint or different-value retry is allowed. Each with a `search.query` audit row showing filters + result_kind.
result: [pending]

### 2. Operator confirms the three logic rules the fixer flagged
expected: CR-01 element-match rule, WR-02 widening rule and WR-06 re-create rule accepted as the wanted rules (272-REVIEW-FIX.md).
result: [pending]

### 3. Production parity before any deploy
expected: migration 200 STEP 1 (CREATE INDEX CONCURRENTLY) alone, then STEP 2, then 201; both VERIFY blocks 19/19 PASS; get_advisors(security) shows no new findings. Every write operator-approved per action.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
