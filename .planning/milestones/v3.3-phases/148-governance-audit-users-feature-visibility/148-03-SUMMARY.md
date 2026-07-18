---
phase: 148-governance-audit-users-feature-visibility
plan: 03
subsystem: database
tags: [supabase, migration, jsonb, app_settings, feature-visibility, full-schema, cloud-parity]

# Dependency graph
requires:
  - phase: 148-02
    provides: "migration 098_feature_visibility.sql (app_settings.feature_visibility jsonb column + D-05 day-one audience seed)"
provides:
  - "app_settings.feature_visibility jsonb column made REAL on the live local DB (operator-applied via SQL editor)"
  - "supabase/full-schema.sql regenerated (no reset) to include the feature_visibility column — the bootstrap deploy artifact now matches live"
  - "cloud-parity record: migration 098 + its D-05 seed must be pasted into the CLOUD Supabase SQL editor at the next production promotion"
affects: [148-05, 148-06, 148-07, 148-09, cloud-promotion, verify-work]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Project schema-apply flow: operator pastes numbered migration into the Supabase SQL editor (never db push/reset), then regenerate-full-schema.sh dumps the live DB (no --reset) to rebuild the single-file bootstrap artifact"

key-files:
  created: []
  modified:
    - "supabase/full-schema.sql — regenerated live-DB schema dump; now carries feature_visibility jsonb column at line 468"

key-decisions:
  - "Applied migration 098 via the SQL editor + live-DB dump (no reset) — preserves dev data per CLAUDE.md; never db push/reset"
  - "Skipped requirements.mark-complete for VIS-01 — multi-plan feature (148-06/07/08/09 still open); marked at phase verify-work (same posture as 148-02/04/05)"
  - "Recorded a cloud-parity step: mig 098 (column + D-05 seed) must run in BOTH local and cloud Supabase — each carries its own app_settings.global row"

patterns-established:
  - "After a migration is applied via the SQL editor, regenerate full-schema.sql from the live DB (no --reset) and commit it alongside — the artifact is a live-DB delta, never a hand-edit"

requirements-completed: []  # VIS-01 spans 148-01..09; marked at phase verify-work, not this migration-apply plan

# Metrics
duration: ~6min
completed: 2026-07-11
---

# Phase 148 Plan 03: Apply Migration 098 + Regenerate full-schema Summary

**Made the `app_settings.feature_visibility` jsonb column real on the live local DB (operator-applied via SQL editor) and regenerated `supabase/full-schema.sql` (no reset) so the bootstrap artifact carries the column.**

## Performance

- **Duration:** ~6 min (Task 2 auto-execution; Task 1 was an operator human-action resolved before this session)
- **Started:** 2026-07-11T17:46:00Z
- **Completed:** 2026-07-11T17:52:00Z
- **Tasks:** 2 (Task 1 operator human-action — pre-resolved; Task 2 auto)
- **Files modified:** 1 (`supabase/full-schema.sql`)

## Accomplishments

- **Task 1 (operator, pre-resolved):** The operator applied migration `098_feature_visibility.sql` to the live LOCAL Supabase DB via the SQL editor (never `db push`/`db reset`) and confirmed `SELECT id, feature_visibility FROM app_settings WHERE id='global'` returns the four-key audience map — `skill_studio`/`model_management` = `{"audience":"operators"}`, `workflow_authoring`/`governance_health` = `{"audience":"everyone"}`.
- **Task 2 (this session):** Ran `bash scripts/regenerate-full-schema.sh` (default = live-DB dump, NO `--reset`). The regen rebuilt `supabase/full-schema.sql` from the live DB, capturing the new `feature_visibility jsonb DEFAULT '{}'::jsonb NOT NULL` column inside the `app_settings` table definition (line 468). Latest migration on disk detected: `098_feature_visibility.sql`.
- **Cloud parity recorded** (see dedicated section below) so the promotion checklist re-applies migration 098 + its D-05 seed to the cloud DB.

## Task Commits

1. **Task 1: Operator applies migration 098 to the live local DB** — human-action, no code commit (applied via SQL editor; operator-confirmed the four-key map)
2. **Task 2: Regenerate full-schema.sql (no reset) + cloud-parity note** — `edfcc1a0` (chore)

**Plan metadata:** (this SUMMARY + STATE.md + ROADMAP.md) — final docs commit

## Files Created/Modified

- `supabase/full-schema.sql` — regenerated from the live DB (schema-only pg_dump inside the Supabase Postgres container, post-processed for a clean one-paste bootstrap); now carries `feature_visibility jsonb DEFAULT '{}'::jsonb NOT NULL` at line 468. Diff = 1 insertion (a dump delta, not a targeted hand-edit).

## Cloud Parity (REQUIRED at next production promotion)

**Migration 098 (`supabase/migrations/098_feature_visibility.sql`) — the `app_settings.feature_visibility` column AND the D-05 day-one seed `UPDATE` — MUST be pasted into the CLOUD Supabase SQL editor at the next production promotion** (per `docs/DEPLOYMENT-WORKFLOW.md` §5 local↔cloud parity checklist + the standing v3.3 cloud-migrations rule). Local and cloud each carry their OWN `app_settings.global` row, so the seed must run in BOTH environments — a `pg_dump --schema-only` (what `full-schema.sql` is) skips the seed data, so a fresh cloud DB bootstrapped from `full-schema.sql` would get the column but NOT the audience seed. Apply via the SQL editor only (never `db push`/`db reset`); the migration is idempotent (`ADD COLUMN IF NOT EXISTS` + `INSERT ... ON CONFLICT DO NOTHING` + a scoped `UPDATE`), safe to re-run. This mirrors migration 097 (`097_operator_flags.sql`) already noted as a pending cloud step, and aligns with the "migrations 079+ pending on cloud; order matters" standing rule.

## Decisions Made

- **Live-DB dump, no reset (CLAUDE.md):** Used `regenerate-full-schema.sh` in its default mode so the artifact reflects the applied migration without wiping dev data. Never `--reset` here.
- **Skipped `requirements.mark-complete` for VIS-01:** VIS-01 spans the whole phase (148-01..09) — the frontend hide/bounce half (148-07/09) and operator endpoints (148-06) are still open. Marking it now would be false-green. It is marked at phase verify-work, matching the 148-02/148-04/148-05 substrate posture.

## Deviations from Plan

None - plan executed exactly as written. Task 1 was pre-resolved by the operator; Task 2 (the regen) ran clean on the first attempt and both acceptance checks passed.

## Issues Encountered

None. Supabase was running (`supabase status` OK; container `supabase_db_Agentic_RAG` located), the regen script completed all 4 stages, and the verification greps passed.

## Verification

- `grep -c "feature_visibility" supabase/full-schema.sql` → `1` (≥ 1 required) ✓
- Column line: `468:    feature_visibility jsonb DEFAULT '{}'::jsonb NOT NULL,` (inside `app_settings`) ✓
- `git diff --stat supabase/full-schema.sql` → `1 file changed, 1 insertion(+)` — a dump delta, not a hand-edit ✓
- No `supabase db push` / `db reset` was run (regen used `docker exec ... pg_dump`, no reset) ✓

## User Setup Required

None for local dev (the operator already applied migration 098 locally). **At the next production promotion, the operator must paste migration 098 into the cloud Supabase SQL editor** — see the Cloud Parity section above.

## Next Phase Readiness

- The `feature_visibility` column is now REAL on the live local DB, so the final G-4 live UAT can exercise true audience resolution + the visibility-set write path against real DB state (no longer a config-only false-positive).
- Ready for 148-06 (operator admin endpoints, incl. the `visibility.set` write path) and the frontend enforcement plans (148-07/08/09).
- Outstanding cross-environment step: cloud parity for migration 098 at promotion (tracked above and in STATE.md decisions).

---
*Phase: 148-governance-audit-users-feature-visibility*
*Completed: 2026-07-11*

## Self-Check: PASSED

- `supabase/full-schema.sql` exists and contains `feature_visibility` (grep count = 1, line 468) — FOUND
- Task 2 commit `edfcc1a0` exists in git log — FOUND
- No fabricated claims: the column presence and diff-stat were verified with real commands before this SUMMARY was written
