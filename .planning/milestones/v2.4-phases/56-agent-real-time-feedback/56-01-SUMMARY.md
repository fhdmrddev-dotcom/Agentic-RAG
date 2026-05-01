---
phase: 56-agent-real-time-feedback
plan: 01
subsystem: api
tags: [sse, realtime, supabase, postgres, pytest, tdd, migration]

# Dependency graph
requires:
  - phase: 55-streaming-reliability-connection-resilience
    provides: Realtime messages subscription infrastructure in useMessages.ts; asyncio.shield persist-in-finally pattern
  - phase: 35-multimodal-extraction
    provides: ingest_document() background task with multi-stage processing (extracting_tables, extracting_images)
  - phase: 54-reliable-agentic-generation
    provides: event_stream() agentic loop structure with for-iteration range and planning event

provides:
  - iteration_start SSE event emitted at top of each agentic loop iteration (0-indexed)
  - ingestion_step column on documents table (nullable text, no CHECK constraint)
  - Four ingestion_step stage updates in ingest_document() — extracting, chunking, embedding, metadata
  - messages table added to supabase_realtime publication with REPLICA IDENTITY FULL
  - migration 032_phase56_realtime.sql idempotent and applied to live database
  - TDD scaffold: 6 unit tests covering iteration_start and ingestion_step behaviors

affects:
  - 56-02-PLAN (Plan 02): frontend ToolCallPanel — consumes iteration_start via onIterationStart callback in api.ts
  - 56-03-PLAN (Plan 03): ingestion badge UI — reads ingestion_step from Realtime UPDATE payload in useDocuments.ts
  - Any future backend plan modifying event_stream() or ingest_document()

# Tech tracking
tech-stack:
  added: []
  patterns:
    - SSE event emission at agentic loop boundary — yield f"data: {json.dumps(...)}\n\n" pattern before planning event
    - Hardcoded string literals for DB columns that carry labels — no user input, no f-strings (security)
    - Idempotent migration using DO/EXCEPTION WHEN duplicate_object for publication ADD TABLE
    - TDD source-inspection pattern using inspect.getsource() to verify production code structure

key-files:
  created:
    - supabase/migrations/032_phase56_realtime.sql
    - backend/tests/unit/test_phase56_iteration_start.py
    - backend/tests/unit/test_phase56_ingestion_step.py
  modified:
    - backend/app/api/threads.py (4 lines added — iteration_start yield + comment)
    - backend/app/api/documents.py (6 lines added — 4 ingestion_step updates + comments)

key-decisions:
  - "iteration_start is a new SSE event type (not a field on existing planning event) — fires at iteration 0 too, which planning does not"
  - "ingestion_step is separate from status column — status gates UI visibility, ingestion_step provides granular label text within status=processing"
  - "No CHECK constraint on ingestion_step — nullable text allows future stages without migration changes"
  - "No index on ingestion_step — column is only read via Realtime payload, never queried directly"
  - "tool_parser.py copied to worktree as Rule 3 fix — file is untracked in main repo but required by conftest.py import chain"

patterns-established:
  - "iteration_start at loop top: stop check FIRST, new event SECOND, planning event THIRD — stop guard always precedes new events"
  - "ingestion_step labels are hardcoded string literals — never derived from user input, enforced by test_phase56_ingestion_step.py::test_ingestion_step_never_uses_user_input"

requirements-completed: [D-04, D-10, D-11, D-14]

# Metrics
duration: 13min
completed: 2026-04-28
---

# Phase 56 Plan 01: Backend Backend Real-Time Feedback Summary

**iteration_start SSE event at agentic loop top, four ingestion_step stage updates in ingest_document(), migration 032 with ingestion_step column + messages Realtime publication, all backed by 6 GREEN TDD tests**

## Performance

- **Duration:** 13 min
- **Started:** 2026-04-28T21:05:19Z
- **Completed:** 2026-04-28T21:18:25Z
- **Tasks:** 5 (Tasks 1-4 committed; Task 5 applied migration to live DB, no code commit)
- **Files modified:** 5

## Accomplishments

- Backend now emits `iteration_start` SSE event with 0-indexed `iteration` field at the top of every `for iteration in range(max_iterations)` pass in `event_stream()`, after the stop_event guard and before the existing `planning` event
- `ingest_document()` updates `documents.ingestion_step` at four stage boundaries — `"extracting"`, `"chunking"`, `"embedding"`, `"metadata"` — using hardcoded string literals (no user input ever flows into this column)
- Migration 032 adds `ingestion_step text` column (idempotent, no CHECK constraint), adds `messages` to `supabase_realtime` publication (idempotent DO block), and sets `REPLICA IDENTITY FULL` on `messages` — all applied to live local Supabase instance
- 6 TDD unit tests all GREEN: 3 for iteration_start (mock event ordering, zero-indexed first emission, source inspection), 3 for ingestion_step (hardcoded values present, 4+ writes in ingest_document, no user input)

## Task Commits

Each task was committed atomically:

1. **Task 1: TDD RED scaffold** - `2b8a7da` (test)
2. **Task 2: Migration 032** - `b1af033` (feat)
3. **Task 3: iteration_start SSE event** - `7cd8320` (feat)
4. **Task 4: ingestion_step stage updates** - `b2ada03` (feat)
5. **Task 5: supabase db push** - no code commit (applied to live DB via psycopg2 direct connection)

_Note: TDD tasks have RED commit (Task 1) then GREEN commits (Tasks 3+4)_

## Files Created/Modified

- `supabase/migrations/032_phase56_realtime.sql` — Migration: ingestion_step column, messages Realtime publication, REPLICA IDENTITY FULL on messages
- `backend/app/api/threads.py` — 4 lines added: iteration_start yield with D-04 comment, inside for-iteration loop
- `backend/app/api/documents.py` — 6 lines added: 4 ingestion_step update calls at stage boundaries
- `backend/tests/unit/test_phase56_iteration_start.py` — TDD scaffold: 3 tests for iteration_start SSE event
- `backend/tests/unit/test_phase56_ingestion_step.py` — TDD scaffold: 3 tests for ingestion_step security + presence

## Decisions Made

- **New SSE event type vs. field on planning:** Used a new `iteration_start` event type (not a field added to `planning`) because `planning` fires only at `iteration > 0`, while `iteration_start` must fire at every iteration including iteration 0. They serve different UX purposes (planning = "still thinking between tools", iteration_start = "loop pass N has started").
- **No CHECK constraint on ingestion_step:** Nullable text per D-10 Claude's discretion — allows future stages (e.g., "validating", "storing") without further migrations.
- **Stage 4 placement:** `ingestion_step="metadata"` fires AFTER the multimodal extraction block (`if raw and mime_type:`) and BEFORE the final `status="completed"` update. The multimodal extraction calls `extract_and_store_tables` and `extract_and_store_images` which are part of ingestion, not metadata write-back. The metadata write-back is the final `supabase.table("documents").update({"status": "completed", "metadata": ..., "full_markdown": ...})` call.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Copied untracked tool_parser.py to worktree**
- **Found during:** Task 1 (running tests in worktree)
- **Issue:** `tool_parser.py` is an untracked file in the main repo (not in any git commit). The worktree reset to `a936604` excluded it. The worktree's `conftest.py` imports `app.main` which imports `tool_parser` via `app.api.threads` — causing `ModuleNotFoundError` and preventing any tests from running.
- **Fix:** Copied `backend/app/services/tool_parser.py` from main repo to worktree. Committed as part of Task 1.
- **Files modified:** `backend/app/services/tool_parser.py` (new in worktree)
- **Verification:** `pytest --collect-only` collects all 6 tests after copy
- **Committed in:** `2b8a7da` (Task 1 commit)

**2. [Rule 3 - Blocking] Applied migration via psycopg2 instead of supabase db push**
- **Found during:** Task 5 (applying migration)
- **Issue:** `supabase db push --include-all` failed with "Connection terminated due to connection timeout" — the CLI attempted to connect to a remote Supabase project but this is a local development instance (URL: `http://127.0.0.1:54321`). No `SUPABASE_DB_PASSWORD` env var set for remote. `psql` is not in PATH.
- **Fix:** Applied migration directly to local Postgres via psycopg2 using `127.0.0.1:54322` (local DB port from `.env`). Migration applied successfully.
- **Verification:** `SCHEMA_OK` confirmed by Supabase client query; `messages` table confirmed in `supabase_realtime` publication via psycopg2 query.
- **No code commit required** (database state change, not a file change)

---

**Total deviations:** 2 auto-fixed (both Rule 3 — blocking)
**Impact on plan:** Both fixes necessary for test execution and database application. No scope creep.

## Issues Encountered

- **test_explorer_agent.py failures in worktree (6 tests):** These tests fail in the worktree because `settings_override.json` is untracked in the main repo and absent from the worktree. This causes different settings to load, producing a different system prompt that includes a "Disabled Tools" section — mismatching the test assertions. These are pre-existing test/environment issues, NOT caused by Phase 56 changes. The main repo's unit tests (305 tests) all pass. Logged as deferred item — not fixing as it's out of scope for Phase 56.

## User Setup Required

None — migration applied to local Supabase instance automatically. For fresh cloud Supabase instances, run: `supabase db push --include-all` from the project root.

## Next Phase Readiness

- **Plan 02 (frontend ToolCallPanel):** Ready to consume `iteration_start` event. Backend emits `{"type": "iteration_start", "iteration": N}` where N is 0-indexed. Frontend should add +1 for "Step N" display per Pitfall 1.
- **Plan 03 (ingestion badge UI):** Ready to display `ingestion_step` values. Realtime UPDATE payloads now include `ingestion_step` field. `documents` table already has `REPLICA IDENTITY FULL` (migration 000). Four stage values: `extracting`, `chunking`, `embedding`, `metadata`.
- **D-14/D-16 cross-device continuity:** `messages` now in `supabase_realtime` publication with `REPLICA IDENTITY FULL`. Plan 03 can implement the delayed `removeChannel()` pattern per 056-RESEARCH.md Pattern 7.

## Known Stubs

None — all four ingestion_step stage updates write actual hardcoded string values; iteration_start event emits actual iteration counter.

## Threat Flags

No new threat surface introduced. All changes are within existing trust boundaries:
- `iteration_start` event is delivered only to authenticated SSE subscribers (existing JWT guard on the route)
- `ingestion_step` column values are hardcoded string literals (enforced by test_phase56_ingestion_step.py::test_ingestion_step_never_uses_user_input)
- `messages` Realtime publication uses existing RLS policies (auth.uid() = user_id)

See `<threat_model>` in PLAN.md for full STRIDE analysis (T-56-01 through T-56-05, all mitigated or accepted).

---
*Phase: 56-agent-real-time-feedback*
*Completed: 2026-04-28*
