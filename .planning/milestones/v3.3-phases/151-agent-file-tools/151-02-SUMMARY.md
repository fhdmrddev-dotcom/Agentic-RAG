---
phase: 151-agent-file-tools
plan: 02
subsystem: database
tags: [supabase, migration, unique-index, upsert, skill-files, race-immunity, cloud-parity]

# Dependency graph
requires:
  - phase: 151-agent-file-tools
    provides: "Plan 04 (FILE-01 attach_skill_file) consumes this index for its race-immune on_conflict upsert"
provides:
  - "UNIQUE index skill_files_skill_filename_uniq on skill_files(skill_id, filename) — live in the local DB"
  - "Enables FILE-01's D-07 overwrite-in-place as an atomic PostgREST .upsert(on_conflict=skill_id,filename) correct under WORKER_COUNT=2"
  - "supabase/full-schema.sql regenerated (live-DB dump) reflecting the new index"
affects: [151-04-attach-skill-file]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Additive unique index migration (IF NOT EXISTS, idempotent) authored → operator-applied via SQL editor → full-schema regenerated (no --reset) → git-tracked cloud-parity"

key-files:
  created:
    - supabase/migrations/101_skill_files_unique_index.sql
  modified:
    - supabase/full-schema.sql

key-decisions:
  - "Unique index is the ENABLING mitigation for T-151-02M-01 — collapses the read-check-then-write TOCTOU race to one winner under two uvicorn workers"
  - "IF NOT EXISTS keeps the migration idempotent (safe re-apply); no data rewrite, no column, no RLS change"
  - "Cloud parity is git-tracked automatically — scripts/pending-cloud-migrations.sh diffs HEAD vs origin/production, so mig 101 surfaces alongside 099/100 with no manual tracker edit"
  - "FILE-01 requirement NOT marked complete — this plan only ENABLES it; the tool ships in Plan 04, closes at verify-work/secure-phase (148/149/150 false-green-avoidance convention)"

patterns-established:
  - "Migration cloud-parity obligation is recorded in the migration header CLOUD PARITY block AND auto-surfaced by the git-based pending-cloud-migrations watermark — no separate tracker to hand-edit"

requirements-completed: []  # FILE-01 stays Pending — only ENABLED here; delivered in Plan 04, closed at verify-work

# Metrics
duration: ~10min (continuation, post-apply)
completed: 2026-07-14
---

# Phase 151 Plan 02: skill_files(skill_id, filename) Unique Index Summary

**Migration 101 adds an ADDITIVE `UNIQUE INDEX skill_files_skill_filename_uniq ON skill_files(skill_id, filename)` — live in the local DB and captured in the regenerated bootstrap artifact — so FILE-01's D-07 overwrite-in-place becomes an atomic, race-immune PostgREST `.upsert(on_conflict=skill_id,filename)` correct under `WORKER_COUNT=2`.**

## Performance

- **Duration:** ~10 min (continuation — post-apply regen + docs; Task 1 authored + Task 2 operator-applied in the prior session)
- **Started:** 2026-07-14T03:00:00Z (approx, continuation)
- **Completed:** 2026-07-14T03:05:00Z
- **Tasks:** 2 (Task 1 author migration; Task 2 BLOCKING operator apply + regenerate)
- **Files modified:** 1 created (migration) + 1 modified (full-schema.sql)

## Accomplishments
- Authored `supabase/migrations/101_skill_files_unique_index.sql` — additive `CREATE UNIQUE INDEX IF NOT EXISTS`, full APPLY / regenerate / CLOUD-PARITY header mirroring migration 075.
- Operator applied the migration to the live LOCAL Supabase DB (SQL editor / psycopg2, never `db push`/`db reset`) — `pg_indexes` confirms `skill_files_skill_filename_uniq` on `skill_files`; no duplicate `(skill_id, filename)` tuples blocked the build.
- Regenerated `supabase/full-schema.sql` via `scripts/regenerate-full-schema.sh` (no `--reset` — live-DB dump preserving dev data); the artifact grew 4412 → 4419 lines with a clean 7-line diff that is ONLY the new index block (no schema drift).
- Recorded migration 101 as a PENDING CLOUD APPLY — auto-tracked by the git-based `scripts/pending-cloud-migrations.sh` (it lists 095–101 vs `origin/production`), so 101 joins 099/100 with no manual tracker edit; also stated explicitly in the migration's CLOUD PARITY header.
- FILE-01's hard dependency (Plan 04 upsert) is satisfied — the upsert path can now function; a build/type check alone would have false-passed without this index.

## Task Commits

Each task was committed atomically:

1. **Task 1: Author migration 101_skill_files_unique_index.sql** - `209a546f` (feat)
2. **Task 2: [BLOCKING checkpoint] Operator applied migration to live local DB + regenerate full-schema.sql** - full-schema.sql regeneration committed with this plan's metadata commit

**Plan metadata:** (this SUMMARY + full-schema.sql + STATE/ROADMAP) — final docs commit

_Task 2 was a `checkpoint:human-action` (BLOCKING) — the operator pasted the SQL into the local Supabase editor because the project rule forbids `supabase db push`/`db reset`. Resume signal "applied" received; index verified live in `pg_indexes`._

## Files Created/Modified
- `supabase/migrations/101_skill_files_unique_index.sql` - ADDITIVE unique index enabling FILE-01's D-07 race-immune upsert (committed in `209a546f`)
- `supabase/full-schema.sql` - regenerated single-file bootstrap artifact now including `skill_files_skill_filename_uniq` (line 2458)

## Decisions Made
- **Unique index = the enabling mitigation for T-151-02M-01.** Without it, two concurrent same-filename attaches under `WORKER_COUNT=2` would race a read-check-then-write to a duplicate `skill_files` row (last-writer-wins / orphaned Storage object). The index makes `.upsert(on_conflict=skill_id,filename)` atomic (one winner + one update).
- **`IF NOT EXISTS` for idempotency** — a re-apply is a no-op; `skill_files` had no pre-existing duplicate `(skill_id, filename)` tuples in dev (the pre-D-07 per-file insert path never created same-name-same-skill rows), so the index built without conflict (T-151-02M-02 accepted risk did not materialize).
- **Cloud parity is git-native, not a hand-edited list.** `scripts/pending-cloud-migrations.sh` derives the pending set from the `origin/production` watermark, so committing the migration is what records the obligation; migration 101 verified present in that output (with 099/100).
- **FILE-01 NOT marked complete.** This plan only ENABLES the requirement (the DB precondition); the `attach_skill_file` tool itself ships in Plan 04. Marking it now would be a false green (148/149/150 convention). It closes at verify-work/secure-phase.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. Task 2 was a planned BLOCKING human-action checkpoint (operator applies DDL — no CLI equivalent under the never-`db push`/`db reset` rule), resolved with resume signal "applied" and the index verified live.

## Known Stubs
None — the index is live in the local DB and reflected in the bootstrap artifact. No placeholder or deferred wiring.

## Threat Flags
None beyond the plan's `<threat_model>`. The migration is additive-only (no column, no RLS policy, no data rewrite, no new endpoint) — it introduces no new trust boundary. T-151-02M-01 is the mitigation this migration DELIVERS (enabling FILE-01's atomic upsert); T-151-02M-02 (build fails on duplicate tuples) did not materialize (`IF NOT EXISTS`, no dev duplicates).

## Cloud Parity (standing production-push obligation)
**Migration 101 is a PENDING CLOUD APPLY.** It MUST be pasted into the CLOUD Supabase SQL editor (in numeric order, once) BEFORE Phase 151 ships live — it joins the pending-on-cloud set with migrations 099 (model registry deprecated) and 100 (secret key columns). This is auto-tracked by `scripts/pending-cloud-migrations.sh` (HEAD vs `origin/production`) and stated in the migration's CLOUD PARITY header. **Do NOT touch cloud now** — deferred to the standing production-push parity checklist (CLAUDE.md / `docs/DEPLOYMENT-WORKFLOW.md` §5).

## User Setup Required
None for local dev — the index is live and idempotent. Cloud: apply migration 101 at the next production promotion (see Cloud Parity above).

## Next Phase Readiness
- **Plan 151-04 (Wave 2, FILE-01 `attach_skill_file`)** is unblocked — its race-immune `.upsert(on_conflict="skill_id,filename")` now has the enforcing unique index live in the local DB. Wave 1 is complete (151-01 ✓, 151-02 ✓, 151-03 ✓).
- FILE-01 closes (with FILE-02) at phase verify-work/secure-phase after Plan 04 lands and live SC#10 4-axis UAT (authored in `151-VALIDATION.md`) is exercised.

## Self-Check: PASSED

- `supabase/migrations/101_skill_files_unique_index.sql` present on disk; `supabase/full-schema.sql` regenerated and contains `skill_files_skill_filename_uniq` (line 2458).
- Task 1 commit `209a546f` present in git history.
- `scripts/pending-cloud-migrations.sh` lists `101_skill_files_unique_index.sql` (with 099/100) as pending vs `origin/production`.

---
*Phase: 151-agent-file-tools*
*Completed: 2026-07-14*
