---
status: passed
phase: 148-governance-audit-users-feature-visibility
source: [148-VERIFICATION.md]
started: 2026-07-12
updated: 2026-07-12
---

## Current Test

[complete — all 3 G-4 lived-experience items passed 2026-07-12]

## Tests

### 1. The disabled user is really out
expected: Operator disables user B (kept logged in in a 2nd browser). B's next action (send a chat, open Documents) shows "This account is disabled — contact your administrator" within one request — NOT only after token expiry. B's in-flight run shows Stopped (cancelled by the disable action).
result: PASS — 2026-07-12: disabling B blocks B immediately with the exact "This account is disabled — contact your administrator" message (JWT window closed). Re-enable: a hard-refresh of B's tab restores the model picker/selectors (confirmed) — the disabled state simply doesn't auto-clear in an already-open live tab, which is expected (no server push to a live session); enforcement is correct.

### 2. The visibility map is honest and the API is the wall
expected: As a non-operator, nav hides Skill Studio + Settings and shows Workflows + Governance. Hand-hitting a governed endpoint directly (e.g. POST /skills/{id}/evals/runs, PUT /settings) returns 403 (not 404). An operator flipping workflow_authoring → Operators-only mid-session causes the Builder's next fetch to 403 → plain refusal → routed to Chat; Run/chat keeps working throughout. The client hide always matches the server truth; a mid-session tighten never shows a blank/broken page.
result: PASS — 2026-07-12: (nav) non-operator B sees Workflows + Governance, not Skill Studio + Settings. (API wall) live console fetch as B: GOVERNED /skills/.../tuner/runs/latest → 403, CARVE-OUT /settings/providers → 200 — the API discriminates by feature, not just the UI. (bounce) operator flip workflow_authoring → operators-only made Workflows vanish for B end-to-end; DB corroboration: a visibility.set receipt landed in operator_audit_log (2026-07-11 20:59:10) and the feature_visibility column changed. WR-02 confirmed live + non-blocking (panel display seeds from day-one default; enforcement correct).

### 3. The export is exactly the filter
expected: Filter platform activity to one action type + a 7-day window, note the live match count, export CSV → the downloaded row count matches the shown count, and a "✎ Exported N audit entries" receipt (naming the exact same count) appears in the operator ledger on the Audit tab's next read.
result: PASS — 2026-07-12: exported CSV row count == the receipt's named count == the filtered set (the triple-equals honesty invariant). Server-side anchor: live audit_log held code.execute=123 / 315 total in the 7-day window, and 0 prior audit.export receipts before the test (a fresh receipt appeared after). Service is COUNT-first, same WHERE for count+data, over-50k refuse (code-verified).

## Summary

total: 3
passed: 3
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
