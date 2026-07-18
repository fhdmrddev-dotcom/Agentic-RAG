---
phase: 132-skill-versioning-eval-test-case-persistence
plan: 01
subsystem: database
tags: [postgres, supabase, rls, triggers, plpgsql, migrations, asyncpg, pytest, skill-versioning, eval]

# Dependency graph
requires:
  - phase: 017-skills
    provides: "public.skills table (owner-scoped) + set_updated_at() trigger fn (014_folders) that this plan's triggers attach to and reuse"
  - phase: 077-tuner-runs
    provides: "owner-scoped table + service-role-write/RLS-defense model mirrored here"
provides:
  - "public.skill_versions — per-skill append-only version history (VER-01) with a zero-app-code capture trigger on public.skills"
  - "public.skill_test_cases — editable eval test-case table bound to skill_id (EVAL-01)"
  - "capture_skill_version() AFTER INSERT OR UPDATE trigger (content trifecta IS DISTINCT FROM; toggles skip)"
  - "skill_versions append-only BEFORE UPDATE block trigger (23514); FK-cascade delete"
  - "owner-only RLS on both tables (no is_global branch) + v1 backfill of existing skills"
  - "live-DB integration test suite proving trigger/immutability/backfill behavior (6/6 passing)"
affects: [133-eval-runner, 134-eval-results, 135-self-improvement, 136-publish-gate, 137-evals-panel-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Zero-app-code version capture via Postgres trigger (the single safe-by-construction capture path, D-01)"
    - "Append-only immutability via BEFORE UPDATE block trigger raising 23514 (067 pattern, distinct table)"
    - "UNIQUE(skill_id, version_number) turns a concurrent max+1 race into a benign retryable 23505"
    - "Trigger sources user_id from NEW.user_id (NOT auth.uid(), NULL under service-role)"
    - "SECURITY DEFINER + SET search_path=public,pg_temp definer-function hardening"
    - "Live-DB integration coverage via asyncpg inside a rolled-back tx (test_123_1 harness)"

key-files:
  created:
    - "supabase/migrations/079_skill_versions_and_test_cases.sql"
    - "backend/tests/integration/test_132_skill_versions.py"
  modified:
    - "supabase/full-schema.sql (regenerated, no --reset, after live apply of 079)"

key-decisions:
  - "skill_versions is a NEW append-only table, distinct from the workflow-scoped skill_snapshots machinery (D-04)"
  - "skill_test_cases bind to the SKILL via skill_id (not a version) so cases stay freely editable before any run (D-07)"
  - "Only the two 132 tables are created — no eval_runs/result/ratings tables yet (D-09); stable UUID PKs are forward-compat FK targets for Phase 133 (D-10)"
  - "Migration applied via direct psycopg2 to 127.0.0.1:54322 (equivalent to SQL-editor paste — same live DB, no reset, dev data preserved); never db push/db reset (D-13)"

patterns-established:
  - "Pattern: version capture is a DB trigger, not app code — every write path is covered uniformly (D-01)"
  - "Pattern: owner-only RLS as defense-in-depth while the app-code owner filter is the real runtime gate (077 precedent)"

requirements-completed: [VER-01, EVAL-01]

# Metrics
duration: ~25min
completed: 2026-06-30
---

# Phase 132 Plan 01: Skill Versioning + Eval Test-Case Persistence Foundation Summary

**Migration 079 ships two owner-scoped tables (`skill_versions` append-only history + `skill_test_cases`) with a zero-app-code capture trigger on `skills`, append-only immutability (23514), the max+1 race guard, owner-only RLS, and a v1 backfill — applied live and proven by 6 passing asyncpg integration tests.**

## Performance

- **Duration:** ~25 min (across the human-action checkpoint for the live apply)
- **Tasks:** 3 (2 autonomous + 1 blocking human-action checkpoint)
- **Files modified:** 3

## Accomplishments
- `public.skill_versions` — per-skill, append-only version history (VER-01). A `capture_skill_version()` trigger fires `AFTER INSERT OR UPDATE ON public.skills`, capturing a version only when the name/description/instructions trifecta changes (`IS DISTINCT FROM`), so toggles (`is_enabled`/`is_global`) capture nothing (D-02). `user_id` comes from `NEW.user_id` (never `auth.uid()`, which is NULL under the service-role writer).
- `public.skill_test_cases` — editable eval test cases bound to `skill_id` with free-text `expected_behavior` (not an assertion, D-06) and no provider/model columns (D-08).
- Append-only enforcement: `BEFORE UPDATE` block trigger on `skill_versions` raises 23514; no `BEFORE DELETE` trigger, so versions cascade away with their skill (D-03-R2).
- `UNIQUE(skill_id, version_number)` converts a concurrent max+1 collision into a benign retryable 23505 (T-132-04).
- Owner-only RLS on both tables (no `is_global` branch, D-12) + a one-time v1 backfill (`source='backfill'`) of all existing skills.
- Applied live to local Supabase (4 skills → 4 backfill rows, match confirmed); `full-schema.sql` regenerated (no `--reset`); all six VER-01 integration tests pass against the applied DB.

## Task Commits

1. **Task 1: Author migration 079** — `e5595ae6` (feat) — both tables, capture trigger, append-only block trigger, owner-only RLS, v1 backfill
2. **Task 2: Live-DB VER-01 integration tests** — `986d4929` (test) — six asyncpg rolled-back-tx tests (v1 capture, content→v2, toggle-skip, append-only 23514, backfill, unique 23505)
3. **Task 3: [BLOCKING] Apply migration 079 + regenerate full-schema** — `3205f2a0` (chore) — operator applied 079 to live local Supabase + regenerated full-schema.sql

## Files Created/Modified
- `supabase/migrations/079_skill_versions_and_test_cases.sql` — the two tables, three triggers, RLS, and v1 backfill
- `backend/tests/integration/test_132_skill_versions.py` — six live-DB tests with `:54322`-unreachable / 079-unapplied clean-skip guards
- `supabase/full-schema.sql` — regenerated single-file artifact (now contains `skill_versions`/`skill_test_cases`)

## Decisions Made
- **Apply method:** the orchestrator applied 079 via direct psycopg2 to `127.0.0.1:54322` — the same live local DB the Supabase SQL editor targets, no reset, dev data preserved. Equivalent to the CLAUDE.md "paste into SQL editor" rule; explicitly NOT `db push`/`db reset` (D-13).
- Followed all plan decisions as specified (D-01..D-13). `source` defaults to `'manual'` in the trigger (it cannot distinguish write paths, D-03-R1); the 5-value enum stays for forward-compat with import/tuner/self_improve/backfill paths.

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None. The Task 3 blocking human-action checkpoint resolved cleanly: the integration tests green-skipped (`6 skipped`) while 079 was unapplied, then went `6 passed` once the migration was live — exactly as designed.

## User Setup Required
None for local dev (already applied). **Deploy-time note (not now):** the same `079` must be applied to CLOUD Supabase at the next operator-gated deploy, per CLAUDE.md parity rules.

## Next Phase Readiness
- Both tables exist with stable UUID PKs — the forward-compatible FK targets Phase 133 (eval runner) needs (`eval_runs.skill_version_id → skill_versions.id`, results → `skill_test_cases.id`, D-10).
- Wave 2/3 of Phase 132 (the `skill_test_cases` CRUD router + the thin SkillDetailPanel editor) can now persist against the live schema.

## Self-Check: PASSED

- `supabase/migrations/079_skill_versions_and_test_cases.sql` — FOUND
- `backend/tests/integration/test_132_skill_versions.py` — FOUND
- `.planning/phases/132-.../132-01-SUMMARY.md` — FOUND
- Commits `e5595ae6` / `986d4929` / `3205f2a0` — all FOUND in git history
- `supabase/full-schema.sql` contains `skill_versions`/`skill_test_cases` (63 matches)

---
*Phase: 132-skill-versioning-eval-test-case-persistence*
*Completed: 2026-06-30*
