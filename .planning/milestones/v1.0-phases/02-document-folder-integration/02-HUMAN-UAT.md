---
status: partial
phase: 02-document-folder-integration
source: [02-VERIFICATION.md]
started: 2026-03-21T00:00:00Z
updated: 2026-03-21T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Apply migration 014 to live Supabase
expected: `folder_id` FK column and `full_markdown` text column exist on `documents` table; index created successfully

result: [pending]

### 2. End-to-end smoke test against running server
expected: Upload with folder_id, move document, move folder, and ingest full_markdown all work correctly with RLS and FK constraints enforced

result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
