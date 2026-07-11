---
status: partial
phase: 146-operator-foundation
source: [146-VERIFICATION.md]
started: 2026-07-11T10:00:00Z
updated: 2026-07-11T10:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. D-09 scenario 1 — the invisible door (fresh normal user)
expected: App is byte-identical to today for a signed-in non-operator (no shield, no admin hint anywhere in the nav/rail/drawer); a direct GET to any /admin route (e.g. /admin/backpressure) with a normal user's JWT returns a plain {"detail":"Not Found"} 404, indistinguishable from a nonexistent route. Failure = any visible trace, a 403, or a differently-shaped error.
result: [pending]

### 2. D-09 scenario 2 — the control room feels like a zone (seeded operator)
expected: With OPERATOR_EMAILS set to a signed-up user's email in backend/.env and the backend restarted, that user sees an amber Shield at the rail bottom; opening it shows the OperatorBand (Shield + "Control Room" + OPERATOR chip + identity + recording marker), the four plain-labeled health signals, the four locked tabs saying "Not built yet — coming soon" with NO phase numbers, and the ⌥ Technical names toggle revealing raw field names.
result: [pending]

### 3. D-09 scenario 3 — the ledger is the receipt
expected: Clicking ↻ Refresh in the Control Room visibly slides a new "Viewed system health" row into the top of Recent operator actions, with the band's recording marker flashing; reloading the page afterward shows the same row still present (it lives in operator_audit_log, not client state). Failure = no row, a toast instead, code-like labels, or the row vanishing on reload.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
