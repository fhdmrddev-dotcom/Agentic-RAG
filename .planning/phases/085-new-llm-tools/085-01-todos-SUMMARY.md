---
phase: 085-new-llm-tools
plan: 01
subsystem: backend
tags: [migration, tool-dispatcher, todos, asyncpg, rls, sse, write-todos, phase-085]

# Dependency graph
requires:
  - phase: 083-foundation-tool-dispatch-extraction-bug-fixes
    provides: ToolContext/ToolResult dataclasses + _TOOL_REGISTRY pattern
  - phase: 084-workspace-filesystem-backend
    provides: workspace_files RLS FK-chain template; _handle_workspace_write SSE-emit shape
  - phase: 073-asyncpg-pool-integration
    provides: backend/app/db/runs.py insert_run / finalize_run helpers
provides:
  - "Todos table (id, thread_id, todo_id, content, status, parent_id, order_index, created_at, updated_at) with CHECK status enum + RLS via threads FK chain (4 policies)"
  - "runs.parent_run_id uuid column (ON DELETE SET NULL) + partial index for sub-agent index reads"
  - "messages.tool_calls.kind doc-comment listing ask_user_prompt | ask_user_response (Phase 085) alongside Phase 075.4 values"
  - "backend/app/services/todos_service.replace_todos — full-state-replace single asyncpg transaction with pre-validation"
  - "backend/app/services/tool_dispatcher._handle_write_todos handler + 'write_todos' registry entry (22 total)"
  - "backend/app/db/runs.insert_run extended with parent_run_id kwarg (default None — backward compat preserved)"
  - "Unit test scaffold covering 6 replace_todos behaviors + 5 _handle_write_todos behaviors + 3 registry assertions"
affects: [phase-085-02-task-service, phase-085-03-ask-user, phase-085-04-rest-tools-uat, phase-086, phase-087]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Full-state-replace transaction (DELETE + INSERT-many) for client-driven list state — new in the codebase; workspace_service uses per-file upserts"
    - "Lazy import of service module from handler (mirrors workspace handlers' style; avoids module-level circular dependency)"
    - "Re-SELECT canonical state after write to ship the FULL list via SSE (D-085-21) instead of computing diffs — robust across providers"

key-files:
  created:
    - "supabase/migrations/055_todos_table.sql"
    - "backend/app/services/todos_service.py"
    - "backend/tests/unit/test_085_todos_service.py"
    - "backend/tests/unit/test_085_tool_registration.py"
  modified:
    - "backend/app/services/tool_dispatcher.py (added _handle_write_todos + registry entry)"
    - "backend/app/db/runs.py (insert_run +parent_run_id kwarg)"
    - "backend/tests/unit/test_tool_dispatcher.py (registry count assertion 21 -> 22)"

key-decisions:
  - "D-085-14 implemented column-style: runs.parent_run_id is a real UUID FK with ON DELETE SET NULL + partial index (not jsonb metadata) so Plan 04's GET /threads/{tid}/tasks can do a clean WHERE filter on an indexed column"
  - "D-085-05 doc-only: messages.tool_calls.kind allowed values documented via COMMENT ON COLUMN rather than a CHECK constraint — keeps existing Phase 075.4 kinds working without retro-migration; service code validates kind at write time"
  - "Single migration 055 packs all 4 sections (todos table + RLS + runs.parent_run_id + messages comment) — combining is cleaner than 3 splits per RESEARCH §C.1"
  - "Validation runs BEFORE pool.acquire() in replace_todos so a bad payload can never wipe state via DELETE-without-INSERT"

patterns-established:
  - "Full-state-replace service primitive — Plan 02 sub-agent state and any future LLM-driven list tools (e.g. plan-step tracking) can mirror this exact shape"
  - "Handler-level pre-DB validation returning friendly LLM-readable errors via ToolResult.result (no exception leakage to the loop)"
  - "Registry size assertion + EXPECTED_TOOLS list as the cross-phase tool-count gate (must update both when adding tools)"

requirements-completed:
  - TOOL-01

# Metrics
duration: ~20min
completed: 2026-05-28
---

# Phase 085 Plan 01: write_todos (Migration + Service + Handler) Summary

**Per-thread todo list via full-state-replace asyncpg transaction, SSE-emitting handler registered as the 22nd tool, plus runs.parent_run_id column ready for Plan 02's sub-agent index.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-05-28T15:40Z
- **Completed:** 2026-05-28T16:00Z (Tasks 1-3 shipped; Task 4 awaiting human-action checkpoint)
- **Tasks executed:** 3 of 4 (Task 4 = checkpoint:human-action — operator pastes migration into Supabase SQL editor)
- **Files modified:** 7

## Accomplishments

- Migration 055 authored: todos table (9 columns) with CHECK constraint on status enum (`pending | in_progress | completed`), composite UNIQUE on `(thread_id, todo_id)`, and 4 RLS policies via the threads FK chain — mitigates T-085-T2 (cross-user disclosure).
- runs.parent_run_id column added (ON DELETE SET NULL) + partial index `WHERE parent_run_id IS NOT NULL` — Plan 02's sub-agent runs slot in cleanly without their own migration.
- messages.tool_calls.kind doc-comment extended with `ask_user_prompt | ask_user_response (Phase 085)` so Plans 03/04 can persist control-channel rows under the documented schema.
- `replace_todos(pool, thread_id, todos)` ships as a single asyncpg transaction — DELETE + executemany INSERT — and pre-validates payload BEFORE pool acquire so a malformed list can never wipe state (defense-in-depth for T-085-T1).
- `_handle_write_todos` dispatcher handler registered as tool #22: validates, calls service, re-SELECTs canonical list, emits `todo_updated{todos: [...]}` SSE on `run:{run_id}` Stream (D-085-21), returns `{accepted, version}` JSON to the LLM.
- `insert_run` carries new `parent_run_id` kwarg (defaults None) — 16+ existing top-level call sites untouched, sub-agent callers (Plan 02) pass the parent's run_id straight in.

## Task Commits

Each task was committed atomically with --no-verify (parallel worktree mode):

1. **Task 1: Migration 055 SQL + Wave 0 test scaffolds** — `c291f13` (feat)
2. **Task 2: todos_service.replace_todos + db.runs.insert_run parent_run_id kwarg + 7 unit tests** — `8c06023` (feat)
3. **Task 3: _handle_write_todos handler + registry entry + 8 unit tests + Rule 1 fix to existing registry count assertion** — `fff6243` (feat)
4. **Task 4: Apply migration 055 via Supabase SQL editor + regenerate full-schema.sql** — PENDING (checkpoint:human-action; orchestrator surfaces to operator)

Total commits this plan: 3. The fourth (final metadata commit including this SUMMARY) is the orchestrator's, post-merge.

## Files Created/Modified

- `supabase/migrations/055_todos_table.sql` — todos table DDL + 4 RLS policies + runs.parent_run_id column + idx_runs_parent partial index + messages.tool_calls.kind COMMENT extension
- `backend/app/services/todos_service.py` — NEW. `replace_todos()` full-state-replace transaction + `TodosValidationError` class + `_ALLOWED_STATUS` constant
- `backend/app/services/tool_dispatcher.py` — Added `_handle_write_todos` handler (validates, lazy-imports service, re-SELECTs, emits `todo_updated`, returns `{accepted, version}` JSON) + registry entry `"write_todos": _handle_write_todos`
- `backend/app/db/runs.py` — `insert_run` signature extended with `parent_run_id: UUID | None = None` kwarg; SQL now references column 8 (`$8`). Backward compatible.
- `backend/tests/unit/test_085_todos_service.py` — 7 tests (empty list, happy path, full-replace ordering, invalid-status reject, missing-id reject, parent_run_id pass-through, parent_run_id default None)
- `backend/tests/unit/test_085_tool_registration.py` — 8 tests (registry presence, exact reference, lower-bound size, invalid-status reject, missing-id reject, missing-content reject, happy-path orchestration order, JSON result shape)
- `backend/tests/unit/test_tool_dispatcher.py` — Rule 1 directly-caused fix: updated `EXPECTED_TOOLS` and renamed `test_registry_has_exactly_21_entries` to `test_registry_has_exactly_22_entries` after the new registry entry. No behavior change — just the count assertion.

## Decisions Made

- **runs.parent_run_id stored as column, not jsonb** — chose the schema discretion option to support Plan 04's `GET /threads/{tid}/tasks` clean `WHERE parent_run_id = $1` filter on an indexed column. The "stuff into runs.metadata jsonb" alternative isn't free because `runs` doesn't currently have a metadata jsonb column either.
- **Wave 0 scaffold test (Task 1) became real after Task 2** — the smoke import test `test_module_imports` was rewritten in Task 2 to cover all 6 behaviors; rather than ship an intentionally-RED stub through Tasks 1-2, we replaced it with the full battery once `todos_service.py` existed. Both versions of the file are recorded by their respective commits.
- **Pre-DB validation in BOTH service and handler layers** (defense-in-depth) — `replace_todos` raises `TodosValidationError`, `_handle_write_todos` returns a friendly `ToolResult` error string. The handler-layer check is what the LLM sees; the service-layer check protects any non-dispatcher caller (Plan 04's REST endpoint, future panel UI writes).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Directly caused bug] Updated test_tool_dispatcher.py registry count assertion**
- **Found during:** Task 3 (after committing the new registry entry)
- **Issue:** Pre-existing `test_registry_has_exactly_21_entries` failed with `assert 22 == 21` because Task 3's new registry entry added the 22nd tool. This is directly caused by the current task's intended change.
- **Fix:** Renamed test to `test_registry_has_exactly_22_entries`, updated `EXPECTED_TOOLS` list to include `write_todos`, and refreshed the docstring to call out the trajectory toward 24 after Plans 02/03.
- **Files modified:** `backend/tests/unit/test_tool_dispatcher.py`
- **Verification:** All 15 pre-existing tool_dispatcher tests + all 8 new registration tests + all 7 todos service tests pass — 30/30 green.
- **Committed in:** `fff6243` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 directly-caused bug fix that paired with the intended registry change).
**Impact on plan:** No scope creep. The test update is the count assertion's natural follow-up — the prior plan (Phase 084) made the same update when it expanded the registry from 16 to 21.

## Issues Encountered

- **Worktree base mismatch on agent startup:** This worktree was created from `66a3854` (Phase 078 closeout) instead of the expected Phase 085 plan-phase base `d5de915`. Following the orchestrator's `<worktree_branch_check>` instructions, did `git reset --hard d5de915bcb856fea8181e95f39eb6b70a8cfde52` to align — this is safe in a fresh worktree because there were no user changes to lose (#2015). After reset, migration 054 was correctly present and Phase 085 plan files existed.
- **Test runner needs main-repo venv:** The worktree has no `backend/venv/`; pytest was invoked via `"C:/Vibe Apps/Agentic RAG/backend/venv/Scripts/python.exe"` (the main repo's venv). asyncio_mode=auto and the dependency set picked up the worktree's source files transparently.

## User Setup Required

**Migration 055 must be applied to the local Supabase DB before any code path exercising `write_todos` will succeed.**

Per CLAUDE.md project rule, NEVER `supabase db push` or `supabase db reset`. Apply via SQL editor:

1. Open Supabase Studio SQL editor (URL from `supabase status` — typically `http://127.0.0.1:54323`).
2. Copy the entire contents of `supabase/migrations/055_todos_table.sql` and paste into the SQL editor.
3. Click Run. Verify no errors.
4. Run the validation query inside the SQL editor:
   ```sql
   SELECT
     (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='todos') AS todos_table,
     (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='runs' AND column_name='parent_run_id') AS parent_run_id_col,
     (SELECT COUNT(*) FROM pg_policies WHERE schemaname='public' AND tablename='todos') AS rls_policies;
   ```
   Expected: `todos_table=1, parent_run_id_col=1, rls_policies=4`.
5. From repo root, run `bash scripts/regenerate-full-schema.sh` (defaults to live-DB dump, NO `--reset` flag).
6. Commit BOTH `supabase/migrations/055_todos_table.sql` (already committed in `c291f13`) AND the regenerated `supabase/full-schema.sql`.

The continuation agent (spawned after operator confirms "migration applied") will run step 5 and commit step 6.

## Next Phase Readiness

- **Plan 02 (task-service) is unblocked** for Wave 1 — the `runs.parent_run_id` column is in the migration file (will be live after Task 4 lands), and `insert_run`'s new `parent_run_id` kwarg is ready for sub-agent run creation.
- **Plans 03 (ask-user) and 04 (REST + tool schemas + UAT)** can read the `messages.tool_calls.kind` doc-comment extension and rely on the `ask_user_prompt | ask_user_response` kind contract being documented in DB metadata.
- **Phase 086 (StreamsProvider extension)** can subscribe to `todo_updated` events once Phase 085 ships in full — the wire format (`{todos: [{id, content, status, parent_id, order_index}, ...]}`) is stable per D-085-21 from this plan.
- **One pending block:** Task 4 (migration apply) — surfaced to operator as a checkpoint:human-action. Once "migration applied" is confirmed, the continuation agent regenerates `supabase/full-schema.sql` and the plan closes.

## TDD Gate Compliance

Plan 01's frontmatter is `type: execute`, not `type: tdd`, so the plan-level RED/GREEN/REFACTOR gate is not mandatory. However, Tasks 2 and 3 are marked `tdd="true"` in PLAN.md; both task commits are `feat()` commits that include passing tests at green — the RED state for Task 2 was the smoke import test scaffolded in Task 1 (committed at `c291f13`, intentionally failing until Task 2 created `todos_service.py`), and the RED state for Task 3 was the registry size assertion lower-bound test that would fail until the registry entry was added. RED → GREEN trajectory is preserved in the commit chain `c291f13 → 8c06023 → fff6243`.

## Self-Check

Verified before returning:

- `supabase/migrations/055_todos_table.sql` — FOUND (commit c291f13)
- `backend/app/services/todos_service.py` — FOUND (commit 8c06023)
- `backend/tests/unit/test_085_todos_service.py` — FOUND (commit 8c06023; 7 tests pass)
- `backend/tests/unit/test_085_tool_registration.py` — FOUND (commit fff6243; 8 tests pass)
- `backend/app/services/tool_dispatcher.py` — registry entry verified via Grep tool at line 1056; SSE emit at line 1052; handler at line 1009
- `backend/app/db/runs.py` — `parent_run_id` kwarg verified via Grep tool
- Commit `c291f13` — present in worktree HEAD log
- Commit `8c06023` — present in worktree HEAD log
- Commit `fff6243` — present in worktree HEAD log

## Self-Check: PASSED

---
*Phase: 085-new-llm-tools*
*Plan: 01*
*Completed (Tasks 1-3): 2026-05-28*
*Task 4 (Migration apply via Supabase SQL editor): PENDING — checkpoint:human-action surfaced to operator*
