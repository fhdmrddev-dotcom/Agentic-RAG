---
status: partial
phase: 148-governance-audit-users-feature-visibility
source: [148-VERIFICATION.md]
started: 2026-07-12
updated: 2026-07-12
---

## Current Test

[awaiting human testing]

## Tests

### 1. The disabled user is really out
expected: Operator disables user B (kept logged in in a 2nd browser). B's next action (send a chat, open Documents) shows "This account is disabled — contact your administrator" within one request — NOT only after token expiry. B's in-flight run shows Stopped (cancelled by the disable action).
result: [pending]

### 2. The visibility map is honest and the API is the wall
expected: As a non-operator, nav hides Skill Studio + Settings and shows Workflows + Governance. Hand-hitting a governed endpoint directly (e.g. POST /skills/{id}/evals/runs, PUT /settings) returns 403 (not 404). An operator flipping workflow_authoring → Operators-only mid-session causes the Builder's next fetch to 403 → plain refusal → routed to Chat; Run/chat keeps working throughout. The client hide always matches the server truth; a mid-session tighten never shows a blank/broken page.
result: [pending]

### 3. The export is exactly the filter
expected: Filter platform activity to one action type + a 7-day window, note the live match count, export CSV → the downloaded row count matches the shown count, and a "✎ Exported N audit entries" receipt (naming the exact same count) appears in the operator ledger on the Audit tab's next read.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
