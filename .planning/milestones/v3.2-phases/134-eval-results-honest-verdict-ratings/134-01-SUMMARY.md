---
phase: 134-eval-results-honest-verdict-ratings
plan: 01
subsystem: database
tags: [postgres, supabase, migration, rls, pgcrypto, eval, ratings, verdict]

# Dependency graph
requires:
  - phase: 133-eval-runner
    provides: eval_runs + eval_results tables (migration 080), eval_results.id PK reserved as the ratings FK target
provides:
  - "5 per-arm verdict columns on eval_results (verdict_state 3-value + verdict_passed/score/reason + judge_model)"
  - "3 run-rollup columns on eval_runs (passed_count, measured_count, verdict_summary NON-AUTHORITATIVE)"
  - "net-new owner-scoped eval_ratings table (one thumb per user+answer, re-ratable, owner-only RLS SELECT)"
  - "regenerated full-schema.sql bootstrap artifact including the 081 DDL"
affects: [134-02-verdict-engine, 134-03-ratings-endpoint, 134-04-eval-section, 135-self-improvement, 136-publish-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "3-value CHECK-constrained text discriminator (verdict_state graded/not_measured/judge_error) — honest arm outcomes (OQ1)"
    - "NON-AUTHORITATIVE derived-text rollup default (verdict_summary) — Phase 136 can override the publish threshold WITHOUT a new migration (OQ2)"
    - "owner-scoped table = owner-only RLS SELECT + NO client write policy (service-role writer, 035/079/080 precedent)"

key-files:
  created:
    - supabase/migrations/081_eval_verdict_and_ratings.sql
  modified:
    - supabase/full-schema.sql

key-decisions:
  - "verdict_state is 3-value (graded/not_measured/judge_error) so a provider-errored arm and an un-gradeable completed arm read differently (OQ1/D-04)"
  - "verdict columns are additive on eval_results, written by the same service-role task (D-06) — no client write path"
  - "eval_ratings FK -> eval_results.id (the stable PK reserved by migration 080:99-100) ON DELETE CASCADE; minimal shape so Phase 135 can join verdict<->rating (D-08/D-09)"
  - "UNIQUE (eval_result_id, user_id) enables the Plan 03 upsert-on-conflict; clear = DELETE the row"
  - "verdict_summary COMMENT marks it NON-AUTHORITATIVE so GATE-01 (136) owns the real threshold, migration-free (OQ2)"
  - "Applied live via psycopg2 :54322 (autocommit) + regen full-schema with no --reset (D-14) — never db push/db reset"

patterns-established:
  - "Reserved-PK FK handoff across migrations: 080 reserves eval_results.id, 081 references it — table comment documents the reservation"
  - "Migration header restates the D-14 apply discipline without using the literal forbidden command tokens (satisfies acceptance-criterion 6)"

requirements-completed: [EVAL-03, EVAL-04]

# Metrics
duration: 6min
completed: 2026-07-01
---

# Phase 134 Plan 01: Verdict + Ratings Schema Summary

**Migration 081 — additive 3-value verdict columns on eval_results, run-rollup columns on eval_runs, and the net-new owner-scoped eval_ratings table (owner-only RLS, service-role-only writes), applied live to :54322 and dumped into full-schema.sql.**

## Performance

- **Duration:** ~6 min
- **Completed:** 2026-07-01
- **Tasks:** 2 (1 auto + 1 blocking human-verify checkpoint)
- **Files modified:** 2 (1 created, 1 regenerated)

## Accomplishments
- Authored migration 081: 5 verdict columns on `eval_results`, 3 rollup columns on `eval_runs`, and the `eval_ratings` table.
- `verdict_state` lands as `NOT NULL DEFAULT 'not_measured'` with the exact 3-value CHECK `('graded','not_measured','judge_error')` — backfills old 133 rows honestly (never graded).
- `eval_ratings`: FK→`eval_results(id)` and FK→`auth.users(id)` both ON DELETE CASCADE, `UNIQUE(eval_result_id, user_id)`, `rating CHECK ('up','down')`, `set_updated_at` trigger reused (not redefined), RLS enabled with exactly one owner-only SELECT policy and NO write policy.
- Applied to the live `:54322` DB via psycopg2 (autocommit) and regenerated `full-schema.sql` (no `--reset`) — the successful column dump is itself proof the live apply landed.

## Task Commits

1. **Task 1: Author migration 081 (verdict + rollup columns + eval_ratings table)** — `2e45216b` (feat)
2. **Task 2: [BLOCKING] Apply 081 to live :54322 + regenerate full-schema.sql** — `9f916a0d` (chore)

## Files Created/Modified
- `supabase/migrations/081_eval_verdict_and_ratings.sql` — verdict columns on eval_results + rollup columns on eval_runs + eval_ratings table with owner-only RLS.
- `supabase/full-schema.sql` — regenerated single-file bootstrap artifact including the 081 DDL (live-DB dump, no reset).

## Decisions Made
Followed plan as specified. Honest 3-value `verdict_state` (OQ1) + NON-AUTHORITATIVE `verdict_summary` (OQ2) + minimal `eval_ratings` shape (D-08/D-09) all per the locked decisions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Internal plan contradiction] Migration header wording**
- **Found during:** Task 1 (authoring migration 081)
- **Issue:** Task 1's `<action>` said the header must restate "NEVER db push / db reset", but acceptance-criterion 6 requires that exact literal string to be ABSENT from the file.
- **Fix:** Restated the D-14 apply discipline faithfully (apply via SQL editor or psycopg2 :54322; regen with no --reset; commit both) while wording the destructive-reset prohibition WITHOUT the literal forbidden command tokens.
- **Verification:** `grep -nE "db push|db reset"` on the migration file returns nothing; acceptance-criterion 6 passes.
- **Committed in:** `2e45216b` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 internal plan contradiction)
**Impact on plan:** Cosmetic wording only; both the action intent and the acceptance criterion are satisfied. No scope creep.

## Issues Encountered
None — `:54322` was reachable; the psycopg2 apply and regen completed on the first attempt.

## Live-DB Verification (independently confirmed by the orchestrator via psycopg2)
- `eval_results`: 5/5 verdict columns present; `verdict_state` NOT NULL DEFAULT 'not_measured', 3-value CHECK confirmed.
- `eval_runs`: 3/3 rollup columns present.
- `to_regclass('public.eval_ratings')` non-null; FKs (both CASCADE), UNIQUE(eval_result_id,user_id), rating CHECK, RLS enabled with one SELECT policy and no write policy — all confirmed.
- `full-schema.sql` greps (`CREATE TABLE public.eval_ratings`, `verdict_state`, `passed_count`) all pass.

## User Setup Required
None — migration already applied to the live local DB.

## Next Phase Readiness
- The schema every downstream plan writes against now physically exists in the live DB.
- Wave 2 (134-02) can persist verdicts into the new columns; Wave 3 (134-03) can upsert into `eval_ratings` via the UNIQUE constraint.

---
*Phase: 134-eval-results-honest-verdict-ratings*
*Completed: 2026-07-01*
