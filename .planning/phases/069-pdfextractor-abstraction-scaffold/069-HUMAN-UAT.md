---
status: partial
phase: 069-pdfextractor-abstraction-scaffold
source: [069-VERIFICATION.md]
started: "2026-05-13"
updated: "2026-05-13"
---

## Current Test

[awaiting human testing]

## Tests

### 1. Real-PDF end-to-end ingest smoke test
expected: Upload a real-world PDF via http://localhost:5173/ (test login `fhdmrd@gmail.com / 123456`) and verify that `documents.full_markdown`, `document_tables` count, and `document_images` count match expected values for the document. This is the SC#2 binding promise (zero observable behavior change) for real-world traffic that the synthetic 2-page golden-fixture gate cannot substitute for.

  Concretely: pick a previously-ingested PDF where you know the historical extraction outputs (chunk count, table count, image count). Upload it again post-Phase 069. The new ingest should produce byte-identical (or trivially-equivalent) downstream artifacts. Any divergence is a regression and must be reported as a gap.
result: [pending]

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
