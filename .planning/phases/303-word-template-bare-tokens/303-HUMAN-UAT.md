---
status: complete
phase: 303-word-template-bare-tokens
source: [303-VERIFICATION.md, 303-VALIDATION.md]
started: 2026-11-06T03:59:55Z
updated: 2026-11-06T10:05:00Z
---

## Current Test

[testing complete] U-1 and U-2 PASSED live 2026-11-06.

## Tests

### 1. U-1 — a bare-token library template through the app (run FIRST)
steps: build a .docx with bare `{{ name }}` in body, header and a nested table (evidence/red-base/repro.py build()); upload as a library template; bind to a fill workflow; run it; keep the run id.
expected: the produced document shows the value in body, header and nested table; a field map that prints a whole record (`{{ rows }}`) stops with reason residual_tokens, the message names raw record text, and nothing is delivered (no file left in /sandbox/output).
result: pass (after fix) — run 826d3eaf filled header, body and nested table (0 record text, 0 leftover tokens); run 6bc7da96 refused a `{{ risks }}` template with the record-text sentence and delivered 0 files. The FIRST refusal run ca440cc9 showed the generic integrity sentence instead — fixed in emit_cause (RED d024a6892). /sandbox/output delete not observable from this shell (Docker denied); covered by test. Evidence: evidence/uat/U-1-RESULT.md

### 2. U-2 — one published pm-pack template workflow, unchanged
steps: re-run the golden run of one published template workflow (compliance gap report, risk register or weekly status report) through the app.
expected: the output document's text matches the last pre-303 run.
result: pass — pre-303 runs 9854abae + 397432ff replayed through today's driver: 19/19 text lines, 8/8 XML parts identical; live run f125d3e5 same layout, 8/8 fields, clean. Evidence: evidence/uat/U-2-RESULT.md

## Summary

total: 2
passed: 2
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

- U-1 found one: the workflow path's refusal message did not name record text (generic integrity sentence). Fixed the same day; re-verified live (run 6bc7da96).
