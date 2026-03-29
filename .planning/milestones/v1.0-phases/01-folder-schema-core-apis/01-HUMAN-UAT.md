---
status: partial
phase: 01-folder-schema-core-apis
source: [01-VERIFICATION.md]
started: 2026-03-21T13:00:00Z
updated: 2026-03-21T13:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Migration applied to Supabase
expected: Run `supabase db push` or execute `013_folders.sql` against the Supabase project, then call `GET /folders` with a valid auth token — returns 200 with empty list (no DB error about missing table)
result: [pending]

### 2. RLS policies enforce isolation at DB level
expected: Using two distinct Supabase authenticated users (not service role), attempt to read another user's private folder — zero rows returned (RLS SELECT policy `auth.uid() = user_id OR is_global = true` blocks it)
result: [pending]

### 3. Cascade delete removes all descendants
expected: Create a 3-level folder hierarchy (A -> B -> C), then delete A — B and C are also deleted, no orphaned rows remain
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
