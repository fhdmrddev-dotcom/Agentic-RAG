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
  modified:
    - "supabase/full-schema.sql (regenerated post-SQL-editor application via scripts/regenerate-full-schema.sh)"

key-decisions:
  - "Adopted PATTERNS.md (line 546) recommendation: message_id ON DELETE SET NULL (D-061-06 itself only locks thread_id + user_id behavior). Documented in plan frontmatter `deviations` and inline in migration header comment."
  - "No CREATE EXTENSION pgcrypto — gen_random_uuid() is built into Postgres 13+ and verified across all 9 prior migrations (RESEARCH.md A4)."
  - "No INSERT/UPDATE/DELETE RLS policies — service-role backend bypasses RLS for writes per D-061-08."

patterns-established:
  - "SELECT-only RLS pattern: ENABLE ROW LEVEL SECURITY + single FOR SELECT policy USING (auth.uid() = user_id), no write policies. Inverts the 028_message_feedback INSERT-only pattern."
  - "Partial index for monotone-rare-state hot path: WHERE status='streaming' keeps idx_runs_active O(active-runs) not O(all-runs)."

requirements-completed: [STREAM-04]

# Metrics
duration: 1min author + manual SQL editor application
completed: 2026-05-02
status: COMPLETE — migration applied via Supabase SQL editor; full-schema.sql regenerated
---

# Phase 061 Plan 02: Runs Table Migration Summary

**`public.runs` Postgres table — durable lifecycle counterpart to the ephemeral Redis Stream per D-v2.5-11; implements 7 of 17 D-061 schema decisions in a single migration file.**

> **Status: COMPLETE.** Plan 02 has `autonomous: false` because Task 2 is a `checkpoint:human-verify` gate. Task 1 (author migration file) was committed in `82df4ce`. Task 2 was resolved by the user applying the migration through the **Supabase SQL editor** (the project's standing rule for schema changes — see user feedback memory `feedback_apply_migrations_via_sql_editor`). After the SQL editor application, `scripts/regenerate-full-schema.sh` was run from the repo root to refresh `supabase/full-schema.sql`.

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
2. **Task 2: Apply migration via Supabase SQL editor + regenerate full-schema.sql** — applied manually by user; regen + SUMMARY amend committed in the post-checkpoint orchestrator commit (this commit).

## Files Created/Modified

- `supabase/migrations/035_runs_table.sql` — Phase 061 per-run lifecycle metadata table (D-v2.5-11)
- `supabase/full-schema.sql` — regenerated via `bash scripts/regenerate-full-schema.sh` after SQL editor application of 035; latest migration included confirmed as `035_runs_table.sql`

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

## Checkpoint Resolution (Task 2 — resolved 2026-05-02)

**Type:** checkpoint:human-verify (BLOCKING gate) — RESOLVED.

**Application path used:** Supabase SQL editor (per `feedback_apply_migrations_via_sql_editor` user-memory rule). The user opened the local Supabase Studio SQL editor, pasted the contents of `supabase/migrations/035_runs_table.sql`, and ran the statement.

**Verification query run by user (Step B):**
```sql
SELECT to_regclass('public.runs') AS exists,
       (SELECT count(*) FROM pg_indexes  WHERE schemaname='public' AND tablename='runs') AS idx_count,
       (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='runs') AS policy_count;
```
**Result:** `exists = "runs"`, `idx_count = 3` (PK + idx_runs_active + idx_runs_history), `policy_count = 1` — all gates pass.

**Post-application steps (run by orchestrator):**
- `bash scripts/regenerate-full-schema.sh` → 1571-line snapshot, latest migration included confirmed as `035_runs_table.sql`
- Sanity-check `supabase/full-schema.sql` after regen:
  - `grep -c "CREATE TABLE IF NOT EXISTS public.runs" supabase/full-schema.sql` = 1 ✓
  - `grep -c "runs_select_own" supabase/full-schema.sql` = 2 ✓ (CREATE POLICY + ALTER POLICY OWNER)
  - `grep -c "idx_runs_active" supabase/full-schema.sql` = 2 ✓
  - `grep -c "idx_runs_history" supabase/full-schema.sql` = 2 ✓
- Backend client smoke test: `runs table queryable: True` ✓ via `get_supabase().table('runs').select('run_id').limit(1).execute()`

**Migration is live in the local Postgres and Plan 03 (producer/consumer) can now INSERT/UPDATE `public.runs` rows.**

## User Setup Required

None for Task 1 (file authoring is offline). Task 2 is itself a "user setup" gate — see "Checkpoint State" above for the exact commands the user must run.

## Next Phase Readiness

- **Plan 03 (producer/consumer) is unblocked** — the `public.runs` table is live in local Postgres (verified via backend client smoke test). Plan 03's `INSERT into public.runs` and `UPDATE public.runs SET status=...` statements can now execute without `relation does not exist` errors.
- Plan 02 is independent of Plan 01 (parallel-able in Wave 1); both Wave 1 plans are now complete.

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
*Status: COMPLETE — Task 1 committed in 82df4ce; Task 2 resolved via Supabase SQL editor application + regen on 2026-05-02*
*Authored: 2026-05-02*
