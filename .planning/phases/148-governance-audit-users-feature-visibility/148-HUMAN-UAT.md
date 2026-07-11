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
result: PASS (core) — 2026-07-12: disabling B blocks B immediately with the exact "This account is disabled — contact your administrator" message (JWT window closed). Re-enable observation: after re-enable, B's model picker/selectors did not repopulate in the already-open tab (no push to a live session) — awaiting hard-refresh confirmation that a reload restores them (expected UX, not enforcement).

### 2. The visibility map is honest and the API is the wall
expected: As a non-operator, nav hides Skill Studio + Settings and shows Workflows + Governance. Hand-hitting a governed endpoint directly (e.g. POST /skills/{id}/evals/runs, PUT /settings) returns 403 (not 404). An operator flipping workflow_authoring → Operators-only mid-session causes the Builder's next fetch to 403 → plain refusal → routed to Chat; Run/chat keeps working throughout. The client hide always matches the server truth; a mid-session tighten never shows a blank/broken page.
result: PASS — 2026-07-12: (nav) non-operator B sees Workflows + Governance, not Skill Studio + Settings. (API wall) live console fetch as B: GOVERNED /skills/.../tuner/runs/latest → 403, CARVE-OUT /settings/providers → 200 — the API discriminates by feature, not just the UI. (bounce) operator flip workflow_authoring → operators-only made Workflows vanish for B end-to-end; DB corroboration: a visibility.set receipt landed in operator_audit_log (2026-07-11 20:59:10) and the feature_visibility column changed. WR-02 confirmed live + non-blocking (panel display seeds from day-one default; enforcement correct).

### 3. The export is exactly the filter
expected: Filter platform activity to one action type + a 7-day window, note the live match count, export CSV → the downloaded row count matches the shown count, and a "✎ Exported N audit entries" receipt (naming the exact same count) appears in the operator ledger on the Audit tab's next read.
result: [pending]

## Summary

total: 3
passed: 2
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
