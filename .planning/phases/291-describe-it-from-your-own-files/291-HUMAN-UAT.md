---
status: partial
phase: 291-describe-it-from-your-own-files
source: [291-VERIFICATION.md]
started: 2026-10-23T00:00:00Z
updated: 2026-10-23T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. G-4 Chrome UAT rows S1-S7 (291-VALIDATION.md). Run S1 first
expected: The lived-experience scenarios pass: template, form and reference upload; the arrival card; launch; the fillable-PDF fill and the Word fill. A large fillable PDF (state or country dropdown, 200+ fields) drafts with every field. A form that can't be sent shows the stated refusal, not a silent drop.
result: [pending]

### 2. SC#4: authoring roster run (`RUN_291_AUTHORING_ROSTER=1 backend/tests/integration/test_291_authoring_roster.py`)
expected: Every native provider row plus OpenRouter passes, or is recorded as blocked with a reason and an issue id. Include a "calculate the totals" description that does NOT grant execute_code.
result: [pending]

### 3. SC#5 live: run a workflow on an author's fillable PDF and on a confirmed Word copy
expected: The author's own form comes back filled, with no placeholders the author added.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
