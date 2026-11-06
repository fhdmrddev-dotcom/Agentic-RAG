---
status: partial
phase: 303-word-template-bare-tokens
source: [303-VERIFICATION.md, 303-VALIDATION.md]
started: 2026-11-06T03:59:55Z
updated: 2026-11-06T03:59:55Z
---

## Current Test

[awaiting human testing — backend was not running and Docker is not reachable from Claude's shell on 2026-11-06]

## Tests

### 1. U-1 — a bare-token library template through the app (run FIRST)
steps: build a .docx with bare `{{ name }}` in body, header and a nested table (evidence/red-base/repro.py build()); upload as a library template; bind to a fill workflow; run it; keep the run id.
expected: the produced document shows the value in body, header and nested table; a field map that prints a whole record (`{{ rows }}`) stops with reason residual_tokens, the message names raw record text, and nothing is delivered (no file left in /sandbox/output).
result: [pending]

### 2. U-2 — one published pm-pack template workflow, unchanged
steps: re-run the golden run of one published template workflow (compliance gap report, risk register or weekly status report) through the app.
expected: the output document's text matches the last pre-303 run.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
