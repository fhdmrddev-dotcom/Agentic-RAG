---
phase: 33-cross-thread-memory-backend
plan: "01"
subsystem: backend
tags: [memory, supabase, migration, tools, audit, tdd]
dependency_graph:
  requires: []
  provides:
    - user_memory Supabase table with RLS and upsert semantics
    - REMEMBER_TOOL and RECALL_TOOL registered in General Mode
    - memory.remember and memory.recall audit action types
    - test_memory_tools.py scaffold (8 RED tests) for Plan 02
  affects:
    - backend/app/services/openai_service.py (get_tools adds 2 memory tools)
    - backend/app/services/audit_service.py (VALID_ACTION_TYPES extended)
tech_stack:
  added: []
  patterns:
    - Supabase migration with BEFORE UPDATE trigger for updated_at auto-refresh
    - OpenAI function-calling JSON schema for tool constants
    - TDD Wave 0 scaffold (RED tests define contract before implementation)
key_files:
  created:
    - supabase/migrations/026_user_memory.sql
    - backend/tests/unit/test_memory_tools.py
  modified:
    - backend/app/services/audit_service.py
    - backend/app/services/openai_service.py
decisions:
  - REMEMBER_TOOL and RECALL_TOOL added to get_tools() (General Mode) only — get_explorer_tools() unchanged per D-05 scope
  - user_memory UNIQUE(user_id, key) enables ON CONFLICT upsert-by-key (D-01)
  - set_updated_at() BEFORE UPDATE trigger ensures ORDER BY updated_at DESC reflects most recent writes (Pitfall 2)
  - Test scaffold uses pytest.fail() stubs — Wave 0 RED state is intentional; Plan 02 turns GREEN
metrics:
  duration: "108s"
  completed: "2026-04-16"
  tasks_completed: 3
  files_modified: 4
---

# Phase 33 Plan 01: Cross-Thread Memory Backend Foundation Summary

**One-liner:** Supabase user_memory table with owner-only RLS, upsert-by-key UNIQUE constraint, and updated_at trigger; REMEMBER_TOOL/RECALL_TOOL registered in General Mode; audit action types extended; 8-test RED scaffold ready for Plan 02.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create user_memory migration + extend audit action types | 1f1e9b8 | supabase/migrations/026_user_memory.sql, backend/app/services/audit_service.py |
| 2 | Define REMEMBER_TOOL and RECALL_TOOL; register in get_tools() | 7816930 | backend/app/services/openai_service.py |
| 3 | Create test_memory_tools.py scaffold with 8 RED tests | 1e280fb | backend/tests/unit/test_memory_tools.py |

## What Was Built

### Migration: supabase/migrations/026_user_memory.sql

- `public.user_memory` table: `id` (uuid PK), `user_id` (FK to auth.users ON DELETE CASCADE), `key` (text), `value` (text), `created_at` (timestamptz), `updated_at` (timestamptz)
- `CONSTRAINT user_memory_user_key_unique UNIQUE (user_id, key)` — enables `ON CONFLICT` upsert-by-key (D-01)
- `CREATE INDEX user_memory_user_updated_idx ON (user_id, updated_at DESC)` — fast top-10 lookups
- 4 RLS policies: SELECT / INSERT / UPDATE / DELETE all using `auth.uid() = user_id`
- `public.set_updated_at()` BEFORE UPDATE trigger — ensures `updated_at` refreshes on every upsert conflict (Pitfall 2)

### audit_service.py Extension

- `VALID_ACTION_TYPES` frozenset extended from 8 to 10 entries
- Added: `"memory.remember"` and `"memory.recall"` (Phase 33 comment)

### openai_service.py Tool Constants

- `REMEMBER_TOOL`: `function.name="remember"`, parameters `key` + `value` both required, description covers upsert-by-key and case-insensitivity
- `RECALL_TOOL`: `function.name="recall"`, `key` parameter optional (`required=[]`), description covers list-all and specific-key behaviors
- Both inserted after `READ_SKILL_FILE_TOOL`, before `EXECUTE_CODE_TOOL`
- `get_tools()` updated: `REMEMBER_TOOL, RECALL_TOOL` appended to base list
- `get_explorer_tools()` unchanged — memory tools excluded from Explorer Mode

### test_memory_tools.py Scaffold

8 test functions defined (all RED — `pytest.fail("Not yet implemented — Plan 33-02")`):

1. `test_remember_upsert` — D-01: upsert behavior + audit task scheduling
2. `test_remember_key_normalization` — D-02: key "Language" → stored as "language"
3. `test_remember_empty_key` — Pitfall 3: empty/whitespace key returns error, no DB write
4. `test_recall_specific_key` — D-10, D-11: specific key lookup + graceful not-found
5. `test_recall_all` — D-09, D-12: list-all format + empty state message
6. `test_memory_injection_general_mode` — D-05, D-06: "## User Memory" block in General Mode
7. `test_memory_injection_explorer_mode` — D-05 scope: no memory block in Explorer Mode
8. `test_memory_injection_empty` — D-07: no block when memory_rows is empty

## Verification Results

```
Plan 01 foundation OK
8 tests collected in 0.01s
4 CREATE POLICY entries in migration
UNIQUE (user_id, key) constraint present
```

## Deviations from Plan

None — plan executed exactly as written. All SQL, tool constants, and test stubs match the plan's exact specifications.

## Hand-off Note to Plan 02

**Ready for tool dispatch + system prompt injection; 8 RED tests waiting to go GREEN.**

Plan 02 should:
1. Implement `handle_remember(args, user_id, supabase)` and `handle_recall(args, user_id, supabase)` tool dispatch functions in threads.py (or a new memory_service.py)
2. Wire tool dispatch into the LLM chat loop (`tool_name == "remember"` / `"recall"` branches)
3. Add memory fetch + injection block in General Mode branch of threads.py (after skill catalog, before messages composition) — follows D-05/D-06 format
4. Replace all `pytest.fail(...)` stubs in test_memory_tools.py with real assertions against the above implementations
5. Migration 026 must be applied to the local Supabase instance before Plan 02 tests can run against DB

## Known Stubs

None — all stubs in test_memory_tools.py are intentional Wave 0 RED tests, not UI/data stubs. They are tracked for Plan 02 to resolve.

## Self-Check: PASSED

- supabase/migrations/026_user_memory.sql: FOUND
- backend/app/services/audit_service.py: memory.remember and memory.recall present
- backend/app/services/openai_service.py: REMEMBER_TOOL, RECALL_TOOL defined and registered
- backend/tests/unit/test_memory_tools.py: 8 tests collected, all RED
- Commits 1f1e9b8, 7816930, 1e280fb: all present in git log
