---
phase: 102-reusable-validation-gate-library-output-quality-gate
plan: 02
subsystem: database
tags: [migration, postgres, harness, audit, workflow, supabase, full-schema]

# Dependency graph
requires:
  - phase: 102-reusable-validation-gate-library-output-quality-gate
    provides: "Plan 01 authored migration 070 (harness_audit CHECK +6 kinds + workflow_runs.is_golden_run) + _AUDIT_EVENT_TYPES 16->22 lockstep — this plan APPLIES that migration to the live DB"
  - phase: 101.1-guaranteed-emission-layer
    provides: "the migration-069 psycopg2-direct apply + no-reset full-schema regen precedent this plan mirrors"
provides:
  - "migration 070 APPLIED to the live local DB (:54322): harness_audit_event_type_check accepts all 22 kinds incl. the 6 new Phase-102 receipts (judge_verdict, publish_attempted, publish_blocked, publish_succeeded, policy_applied, validator_ask_user_approved)"
  - "workflow_runs.is_golden_run boolean DEFAULT false present on the live DB (D-05)"
  - "supabase/full-schema.sql regenerated (no-reset live dump) reflecting both schema changes"
  - "code _AUDIT_EVENT_TYPES (Plan 01) and the live Postgres CHECK proven in lockstep on :54322"
affects: [102-03 validator kinds, 102-04 engine seams, 102-05 publish service + golden-run flip, 102-publish-path test_publish_flip live half]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "psycopg2-direct migration apply against localhost:54322 + no-reset full-schema regen (the 100/101.1 discipline — NEVER db push/db reset, preserves dev data)"
    - "read-back assertion gate: constraint def (all 6 new kinds present) + information_schema column check BEFORE declaring the migration live"
    - "idempotent ALTER (DROP/ADD CONSTRAINT re-runnable + ADD COLUMN IF NOT EXISTS) so a second apply is a safe no-op"

key-files:
  created: []
  modified:
    - "supabase/full-schema.sql"

key-decisions:
  - "Migration 070 applied via psycopg2-direct (autonomous, no operator paste) per the 100/101.1 precedent — the local Supabase stack was up so no SQL-editor fallback was needed"
  - "full-schema.sql regenerated with the DEFAULT no-reset live dump (NOT --reset) — preserves dev data, the CLAUDE.md hard rule"
  - "The migration file itself was NOT edited (authored in Plan 01); this plan only crossed the SQL into the live :54322 schema and regenerated the bootstrap artifact"

patterns-established:
  - "lockstep apply: code _AUDIT_EVENT_TYPES extension (Plan 01) + live CHECK apply (this plan) land in the same phase so a receipt INSERT never 23514s mid-run (the 069/070 discipline carried to the live DB)"

requirements-completed: []  # QUAL-01 is MULTI-PLAN — it marks complete at phase verification (the 099/WFSKILL-01 convention), NOT at this BLOCKING apply plan

# Metrics
duration: ~3min (Task 1 apply) + checkpoint approval
completed: 2026-06-12
---

# Phase 102 Plan 02: Migration 070 Live-Apply Summary

**Migration 070 applied to the live local DB (:54322) via psycopg2-direct (no reset) — the harness_audit CHECK now accepts all 22 kinds incl. the 6 new Phase-102 receipts, workflow_runs.is_golden_run is live, and supabase/full-schema.sql is regenerated; the BLOCKING gate between the Plan-01 migration author and the Plans 03/04/05 consumers is now open.**

## Performance

- **Duration:** ~3 min (Task 1 apply + read-back) + checkpoint approval (orchestrator-verified, unattended session)
- **Tasks:** 2 (1 auto-apply, 1 checkpoint:human-verify)
- **Files modified:** 1 (supabase/full-schema.sql regenerated)

## Accomplishments
- Applied migration `070_harness_validation_gate_library.sql` to the live local Supabase DB (:54322) via psycopg2-direct in one transaction — NEVER `db push` / `db reset` (the CLAUDE.md hard rule + the Phase 100/101.1 precedent).
- The live `harness_audit_event_type_check` constraint def now contains all 6 new Phase-102 receipt kinds (`judge_verdict`, `publish_attempted`, `publish_blocked`, `publish_succeeded`, `policy_applied`, `validator_ask_user_approved`) — 22 kinds total, in lockstep with the Plan-01 `_AUDIT_EVENT_TYPES` frozenset.
- `workflow_runs.is_golden_run boolean DEFAULT false` (D-05) is present on the live DB — the column Plan 05's golden-run publish path will set.
- Regenerated `supabase/full-schema.sql` with the DEFAULT no-reset live dump (NOT `--reset`) — the single-file bootstrap artifact now reflects both changes (`is_golden_run` present, 3 occurrences).
- Idempotency proven: a second apply succeeds without error (DROP/ADD CONSTRAINT re-runnable, ADD COLUMN IF NOT EXISTS no-ops).

## Task Commits

Each task was committed atomically:

1. **Task 1: Apply migration 070 to :54322 (psycopg2-direct) + regenerate full-schema** - `990a3bcc` (feat)
2. **Task 2: Operator confirms migration 070 is live on :54322 (checkpoint:human-verify)** - APPROVED (no commit — verification only)

**Plan metadata:** (this final docs commit) — SUMMARY + STATE + ROADMAP

## Files Created/Modified
- `supabase/full-schema.sql` - regenerated (no-reset live dump) reflecting migration 070: the `harness_audit_event_type_check` CHECK now carries all 22 kinds + `workflow_runs.is_golden_run boolean DEFAULT false`.
- `supabase/migrations/070_harness_validation_gate_library.sql` - APPLIED to :54322 (not edited — authored by Plan 01).

## Decisions Made
None beyond the plan's locked decisions. The local Supabase stack was up during the apply, so the autonomous psycopg2-direct path was used and the SQL-editor paste fallback was not needed.

## Deviations from Plan

None - plan executed exactly as written. The migration was applied, the read-back assertions passed (`OK migration 070 live`), and the full-schema artifact was regenerated with no reset, all per the plan's Task 1 action.

## Checkpoint Approval Evidence

**Task 2 (`checkpoint:human-verify`, gate=blocking) — APPROVED.**

The checkpoint was approved on hard DB evidence (orchestrator-verified via independent psycopg2 read-back on :54322, unattended session, recorded in the orchestrator log):

- `harness_audit_event_type_check` accepts all 22 kinds including the 6 new Phase-102 receipts (`judge_verdict`, `publish_attempted`, `publish_blocked`, `publish_succeeded`, `policy_applied`, `validator_ask_user_approved`).
- `workflow_runs.is_golden_run` present with `DEFAULT false`.
- `supabase/full-schema.sql` regenerated (commit `990a3bcc`, contains `is_golden_run` + the new CHECK kinds).

Approval granted on the read-back, not a visual check — the migration is provably live on :54322.

## Threat Surface

All changes fall inside the plan's `<threat_model>` (T-102-02-01..02):
- **T-102-02-01 (Tampering — partial/failed apply leaving the CHECK inconsistent):** mitigated — applied in one transaction; read-back assertions (constraint def + column) passed BEFORE declaring done; the ALTER is re-runnable (idempotent).
- **T-102-02-02 (DoS — `db reset` wiping dev data):** mitigated — the project rule was honored (psycopg2-direct apply + no-reset regen only; NO `db push` / `db reset`).

No new network endpoint, auth path, or trust-boundary surface introduced — this plan only crosses the authored migration SQL into the live schema. No threat flags.

## Known Stubs
None. This is a DB-apply + artifact-regen plan — no source code touched, no UI data flow. The live half of `test_publish_flip.py` (the draft->published trigger) stays xfail/skip-guarded until Plan 05 wires the publish-flip behavior — that is the documented Wave-0 un-mark-on-landing convention owned by Plan 05, not a stub introduced here.

## Next Phase Readiness
- **Plans 03/04/05 unblocked:** both the CHECK kinds and the `is_golden_run` column exist on the live DB, so any test or live run that writes the 6 new receipt kinds or sets `is_golden_run=True` (Plan 05's publish path) will not 23514 / fail on a missing column.
- **Plan 05 (publish path):** `workflow_runs.is_golden_run` is the column its golden-run flip sets; the `publish_attempted/blocked/succeeded` + `judge_verdict` receipt kinds are now accepted by the live CHECK. The live half of `test_publish_flip.py` un-marks once Plan 05 wires the draft->published trigger behavior.

## Self-Check: PASSED

- `supabase/full-schema.sql` verified present and contains `is_golden_run` (3 occurrences).
- Commit `990a3bcc` verified in git history (`feat(102-02): apply migration 070 to live DB + regen full-schema`).
- Checkpoint Task 2 approval recorded with DB read-back evidence.

---
*Phase: 102-reusable-validation-gate-library-output-quality-gate*
*Completed: 2026-06-12*
