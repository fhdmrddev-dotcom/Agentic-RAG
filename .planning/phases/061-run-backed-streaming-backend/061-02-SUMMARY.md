---
phase: 061-run-backed-streaming-backend
plan: 02
subsystem: database
tags: [supabase, postgres, migrations, runs-table, rls, redis-streams-companion]

# Dependency graph
requires:
  - phase: 061-run-backed-streaming-backend
    provides: "D-061-05..09 + D-v2.5-11 schema lock from CONTEXT.md"
provides:
  - "supabase/migrations/035_runs_table.sql — durable per-run lifecycle metadata table"
  - "public.runs schema (11 columns, 2 indexes, 1 SELECT-only RLS policy) ready for Plan 03 producer INSERT/UPDATE"
  - "Authoring side of the schema-push gate (file on disk; live-DB push deferred to checkpoint Step B)"
affects:
  - "061-03 (Plan 03 — producer/consumer): INSERTs row at run start, UPDATEs on terminal status"
  - "062 (Replay & Tail API): GET /threads/{id}/active-runs SELECTs from public.runs filtered by status='streaming'"
  - "Future billing/usage UI: reads input_tokens/output_tokens columns"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SELECT-only RLS for backend-write/frontend-read separation (service-role bypasses RLS for writes)"
    - "Partial index on hot-path predicate (WHERE status='streaming') keeps idx_runs_active tiny while serving the active-runs query"
    - "ON DELETE SET NULL for audit-row FK (message_id) — audit records outlive deleted business entities"

key-files:
  created:
    - "supabase/migrations/035_runs_table.sql"
  modified: []
  pending_at_checkpoint:
    - "supabase/full-schema.sql (regen step belongs to checkpoint Task 2 Step C)"

key-decisions:
  - "Adopted PATTERNS.md (line 546) recommendation: message_id ON DELETE SET NULL (D-061-06 itself only locks thread_id + user_id behavior). Documented in plan frontmatter `deviations` and inline in migration header comment."
  - "No CREATE EXTENSION pgcrypto — gen_random_uuid() is built into Postgres 13+ and verified across all 9 prior migrations (RESEARCH.md A4)."
  - "No INSERT/UPDATE/DELETE RLS policies — service-role backend bypasses RLS for writes per D-061-08."

patterns-established:
  - "SELECT-only RLS pattern: ENABLE ROW LEVEL SECURITY + single FOR SELECT policy USING (auth.uid() = user_id), no write policies. Inverts the 028_message_feedback INSERT-only pattern."
  - "Partial index for monotone-rare-state hot path: WHERE status='streaming' keeps idx_runs_active O(active-runs) not O(all-runs)."

requirements-completed: [STREAM-04]

# Metrics
duration: 1min
completed: 2026-05-02
status: PARTIAL — checkpoint blocks completion
---

# Phase 061 Plan 02: Runs Table Migration Summary

**`public.runs` Postgres table — durable lifecycle counterpart to the ephemeral Redis Stream per D-v2.5-11; implements 7 of 17 D-061 schema decisions in a single migration file.**

> **Status: PARTIAL.** Plan 02 has `autonomous: false` because Task 2 is a `checkpoint:human-verify` gate. Task 1 (author migration file) is complete and committed. Task 2 (run `supabase db push` against the user's live local Postgres + regenerate `supabase/full-schema.sql` + sanity-check via the backend Supabase client) requires user action and was returned to the orchestrator as a checkpoint per the worktree-mode brief. Once the user (or the orchestrator post-merge) runs the checkpoint commands, this SUMMARY should be amended with the `supabase db push` log line for migration 035 and the `grep -c 'public.runs' supabase/full-schema.sql` count.

## Performance

- **Duration so far:** 1 min (Task 1 only; Task 2 checkpoint pending)
- **Started:** 2026-05-02T16:22:57Z
- **Author phase completed:** 2026-05-02T16:24:12Z
- **Tasks complete:** 1 of 2 (Task 2 is a blocking human-verify checkpoint — see "Checkpoint State" below)
- **Files created:** 1

## Accomplishments

- Authored `supabase/migrations/035_runs_table.sql` with all 11 columns from D-061-09 (run_id, thread_id, user_id, message_id, status, model, provider, started_at, completed_at, input_tokens, output_tokens, error)
- UUID PK with `gen_random_uuid()` server-side default (D-061-05) — no pgcrypto extension needed
- FK CASCADE on `thread_id` → `public.threads(id)` and `user_id` → `auth.users(id)` (D-061-06)
- FK SET NULL on `message_id` → `public.messages(id)` (PATTERNS.md line 546 recommendation, called out in migration comment as a planner deviation against D-061-06's literal scope)
- Two indexes (D-061-07): partial `idx_runs_active` on `(user_id, thread_id, status) WHERE status='streaming'` + composite `idx_runs_history` on `(user_id, thread_id, started_at DESC)`
- RLS enabled with single SELECT-only policy `runs_select_own` using `auth.uid() = user_id` (D-061-08)
- CHECK constraint enforces status enum: `streaming` / `completed` / `failed` / `cancelled` — verbatim strings that flow into Plan 03's UPDATE statements (D-061-09)

All 14 acceptance gates from `<acceptance_criteria>` pass exactly (CREATE TABLE count=1, PK form match=1, status CHECK=1, both FK CASCADEs=1, message_id SET NULL=1, both indexes=1, partial-index predicate=1, ENABLE RLS=1, runs_select_own policy=1, NO write policies=0, NO pgcrypto extension=0).

## Task Commits

Each task was committed atomically:

1. **Task 1: Author migration 035_runs_table.sql** — `82df4ce` (feat)
2. **Task 2: [BLOCKING] Push migration to local Supabase + regenerate full-schema.sql** — *PENDING (checkpoint:human-verify)*

**Plan metadata commit:** to be added by `git_commit_metadata` step in execute-plan.md when this SUMMARY is committed (worktree-mode commits SUMMARY.md only — no STATE.md/ROADMAP.md per orchestrator brief).

## Files Created/Modified

- `supabase/migrations/035_runs_table.sql` — Phase 061 per-run lifecycle metadata table (D-v2.5-11)

**NOT modified yet (Task 2 owns these):**
- `supabase/full-schema.sql` — must be regenerated via `bash scripts/regenerate-full-schema.sh` after `supabase db push` lands the migration

## Decisions Made

- **`message_id ON DELETE SET NULL`** — D-061-06 only locks `thread_id` + `user_id` CASCADE behavior; PATTERNS.md (line 546) recommends SET NULL for `message_id` so the audit row outlives a deleted message. Adopted explicitly with a migration-header comment calling it out. Logged in plan frontmatter `deviations`.
- **No `CREATE EXTENSION pgcrypto`** — verified gen_random_uuid is Postgres 13+ built-in (RESEARCH.md A4); all 9 prior migrations confirm this. Avoids unnecessary extension creep.
- **No INSERT/UPDATE/DELETE RLS policies** — D-061-08 explicit: service-role backend bypasses RLS for writes by design. Inverts the 028_message_feedback INSERT-only pattern (which is correct for client-write/audit-immutable data).

## Deviations from Plan

None during Task 1 — the migration was authored verbatim from the plan's `<action>` block which itself is the locked output of CONTEXT.md D-061-05..09 + RESEARCH.md Code Examples + PATTERNS.md adaptation notes.

The frontmatter-declared deviation (`message_id ON DELETE SET NULL`) is the planner's pre-execution adoption of PATTERNS.md guidance, not an executor-introduced deviation. It was already in the locked DDL given by the plan, and is documented in both the migration header comment and the plan frontmatter `deviations` field.

---

**Total deviations:** 0 (Rule 1/2/3) auto-fixed during execution.
**Impact on plan:** Task 1 executed exactly as written; Task 2 is a checkpoint gate that blocks autonomous completion by design.

## Issues Encountered

None during Task 1.

## Checkpoint State (Task 2 — pending)

**Type:** checkpoint:human-verify (BLOCKING gate)

**What needs to happen** (the orchestrator should surface these to the user):

1. `supabase db push` — applies migration 035 to the live local Supabase Postgres
2. `bash scripts/regenerate-full-schema.sh` — regenerates `supabase/full-schema.sql` (CLAUDE.md mandatory after every migration)
3. Sanity check via the backend Supabase client:
   ```bash
   cd backend && venv/Scripts/python -c "from app.dependencies import get_supabase; r = get_supabase().table('runs').select('run_id').limit(1).execute(); print('runs queryable:', r.data is not None)"
   ```
   Expected: `runs queryable: True`.

**Why the executor agent did not run these:**
- The orchestrator brief (`<parallel_execution>`) explicitly directs: *"For the human-action checkpoint task: stop work, write a checkpoint marker, and return checkpoint state. Do not commit the migration SQL beforehand only as a partial — commit the SQL file as its own task (since it can be authored without the manual reset), then surface the checkpoint when the next task asks the human to run the reset."* That sequence was followed: SQL committed (`82df4ce`), then checkpoint surfaced.
- Plan 02 has `autonomous: false` precisely because of this gate.
- `supabase db push` requires Docker Desktop + Supabase CLI on the user's local machine and would mutate the user's live local dev DB. Not something a parallel-worktree executor can run without user consent.

**Detailed verification steps:** see `<how-to-verify>` in `.planning/phases/061-run-backed-streaming-backend/061-02-PLAN.md` (Steps A–E, including troubleshooting for stale shadow DB / missing CLI / regen script not found).

**After the user runs Steps A–E successfully:** amend this SUMMARY with the `supabase db push` "Applying migration 035_runs_table.sql..." log line and the regen output `grep -c 'CREATE TABLE IF NOT EXISTS public.runs' supabase/full-schema.sql` (expected: 1).

## User Setup Required

None for Task 1 (file authoring is offline). Task 2 is itself a "user setup" gate — see "Checkpoint State" above for the exact commands the user must run.

## Next Phase Readiness

- **Plan 03 (producer/consumer) is BLOCKED** until the Task 2 checkpoint completes — Plan 03's `INSERT into public.runs` and `UPDATE public.runs SET status=...` statements will fail with `relation public.runs does not exist` until the migration is pushed to the live local Postgres.
- Once the checkpoint is approved: Plan 03 (Wave 2) can proceed without further DB-schema dependencies; the table is queryable via `get_supabase().table('runs')`.
- Plan 02 is independent of Plan 01 (parallel-able in Wave 1) — both must complete before Wave 2.

## Self-Check: PASSED

- [x] `supabase/migrations/035_runs_table.sql` exists (verified via `test -f`)
- [x] All 14 acceptance gates from plan `<acceptance_criteria>` pass exactly (verified via the gate suite earlier in this run)
- [x] Commit `82df4ce` exists in `git log --oneline` for branch `worktree-agent-a6b04ecc84331ae02`
- [x] No unintended file deletions (post-commit `git diff --diff-filter=D` returned empty)
- [x] No INSERT/UPDATE/DELETE policies on `public.runs` (grep count = 0)
- [x] No `CREATE EXTENSION pgcrypto` in the migration (grep count = 0)
- [x] Filename matches `<digits>_name.sql` rule with no letter suffix (`035_runs_table.sql`)

## Threat Flags

None — the migration introduces the exact `public.runs` table already enumerated in the plan's `<threat_model>` (T-061-01 mitigated by `runs_select_own` RLS, T-061-02 accepted via free-text `error` discriminator convention to be enforced in Plan 03, T-061-04 accepted with deferred row-cap revisit). No surface beyond the threat register.

---
*Phase: 061-run-backed-streaming-backend*
*Plan: 02*
*Status: PARTIAL — Task 1 complete and committed; Task 2 is a checkpoint:human-verify gate returned to orchestrator*
*Authored: 2026-05-02*
