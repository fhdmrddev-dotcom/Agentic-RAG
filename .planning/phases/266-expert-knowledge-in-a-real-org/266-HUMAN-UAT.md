---
status: complete
phase: 266-expert-knowledge-in-a-real-org
source: [266-VERIFICATION.md]
started: 2026-09-24T22:39:19Z
updated: 2026-09-24T22:43:57Z
---

## Current Test

[all tests complete]

## Tests

### 1. UI-4 (not-installed branch) — a regular member of an org that has NOT installed the Financial Analyzer
expected: the Expert's window shows "An org admin needs to install…" and no Install button; the composer invite shows an "install first" reason and does not activate
result: pass — operator "both passed" (2026-09-25); test org reset to not-installed first (1 install / 1 folder / 1 doc / 3 chunks deleted, local only)

### 2. UI-2 — invite is blocked while the install is running
expected: right after an admin presses Install, the composer invite for the Financial Analyzer shows a "still installing" reason and does not activate
result: pass — operator "both passed" (2026-09-25); test org reset to not-installed first (1 install / 1 folder / 1 doc / 3 chunks deleted, local only)

## Summary

total: 2
passed: 2
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
