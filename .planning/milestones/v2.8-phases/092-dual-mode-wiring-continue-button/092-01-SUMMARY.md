---
phase: 092-dual-mode-wiring-continue-button
plan: 01
subsystem: database
tags: [postgres, supabase, migration, pytest, workflow-runs, harness, dual-mode, continue]

# Dependency graph
requires:
  - phase: 090-harness-schema-rls-config
    provides: workflow_runs / workflow_phases / runs tables + threads.active_workflow_run_id anchor + RLS
  - phase: 091-harness-engine-5-phase-types-gates-whitelist
    provides: harness engine, resume sweep, 2-phase write, ask_user re-subscribe, conftest fixtures (mock_asyncpg_pool, fake_redis, make_run_context, build_workflow_definition)
provides:
  - "Migration 063: workflow_runs.inputs/model/continues_used + runs.continues_used columns"
  - "cap_paused non-terminal status on both runs and workflow_runs status CHECK constraints"
  - "Regenerated full-schema.sql reflecting the live-applied migration 063"
  - "3 Wave-0 pytest contract scaffolds (test_dual_mode_wiring, test_continue, test_thread_workflow_endpoint) — skipped contracts owned by downstream plans 02/03"
  - "verify_092.sql live-DB gate asserting the new columns + cap_paused"
affects: [092-02, 092-03, 092-04, 096-eval-verify, SEED-047]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Idempotent migration (ADD COLUMN IF NOT EXISTS + DROP CONSTRAINT IF EXISTS / recreate full value set) applied by operator via SQL editor — never db push/reset"
    - "Wave-0 RED contract scaffolds via @pytest.mark.skip(reason='contract — owned by plan NN'); each downstream plan removes its own skip to flip the contract live"
    - "Status CHECK widening preserves the full existing value set (never drops a valid status) — T-092-01 mitigation"

key-files:
  created:
    - supabase/migrations/063_dual_mode_continue.sql
    - backend/tests/test_dual_mode_wiring.py
    - backend/tests/test_continue.py
    - backend/tests/test_thread_workflow_endpoint.py
    - supabase/verify_092.sql
  modified:
    - supabase/full-schema.sql

key-decisions:
  - "cap_paused is a NEW non-terminal status distinct from paused — workflow_runs keeps both ('active','paused','cap_paused','completed','failed','cancelled'); runs gains cap_paused alongside its existing terminal set ('streaming','cap_paused','completed','failed','cancelled','timed_out')"
  - "workflow_runs.inputs jsonb NOT NULL DEFAULT '{}' + model text (nullable) persist kickoff context at creation to close SEED-047 (resume rehydration of programmatic inputs + llm model)"
  - "continues_used integer NOT NULL DEFAULT 0 on BOTH runs and workflow_runs — D-06 Continue cap counter, max 3/run"
  - "NOT NULL columns carry DEFAULTs so the ALTER cannot fail on existing rows (T-092-02); model stays nullable for older rows"

patterns-established:
  - "Migration-then-operator-checkpoint: schema DDL is authored + committed, applied LIVE by the operator (SQL editor), verified via verify_NNN.sql, then full-schema.sql regenerated from the live DB (no reset) and committed separately"
  - "Wave-0 scaffold contracts: each downstream plan owns and un-skips its own contract test names"

requirements-completed: [MODE-01, MODE-02, CONT-01]

# Metrics
duration: ~25min (incl. operator checkpoint)
completed: 2026-05-31
---

# Phase 092 Plan 01: Dual-Mode + Continue Schema Foundation Summary

**Migration 063 adds workflow_runs.inputs/model/continues_used + runs.continues_used and the cap_paused non-terminal status on both status CHECKs (SEED-047 + D-06), applied live and reflected in full-schema.sql, plus 3 Wave-0 pytest contract scaffolds and verify_092.sql.**

## Performance

- **Duration:** ~25 min (including the operator SQL-editor apply checkpoint)
- **Completed:** 2026-05-31
- **Tasks:** 3 (2 autonomous + 1 operator checkpoint)
- **Files created:** 5
- **Files modified:** 1

## Accomplishments
- **Migration 063** adds the four columns the rest of Phase 092 reads: `workflow_runs.inputs` (jsonb, SEED-047 kickoff persistence), `workflow_runs.model` (text, SEED-047 llm-phase rehydration), `workflow_runs.continues_used` + `runs.continues_used` (D-06 Continue cap counters).
- **cap_paused** added as a non-terminal status on BOTH `runs_status_check` and `workflow_runs_status_check`, preserving every pre-existing valid status (T-092-01 mitigation) — `paused` and `cap_paused` are kept distinct on workflow_runs.
- **Applied LIVE** to the local Supabase DB by the operator via SQL-editor paste (never `db push`/`db reset`); `verify_092.sql` confirmed the 4 columns + `cap_paused` on both CHECKs; `full-schema.sql` regenerated from the live DB (no reset).
- **3 Wave-0 contract scaffolds** lay the RED anchors downstream plans flip to live tests; suite collects cleanly (skipped contracts, none erroring on collection).

## Task Commits

1. **Task 1: Write migration 063_dual_mode_continue.sql** - `35bbfade` (feat)
2. **Task 2: Wave-0 pytest scaffolds + verify_092.sql gate** - `2e8106f0` (test)
3. **Task 3: Operator applies migration 063 + regenerate full-schema.sql** - operator checkpoint (DDL applied live; verify_092.sql passed) → schema regen committed in `e79acec7` (chore)

**Checkpoint-pause record:** `7ae1811f` (docs — Tasks 1-2 complete, paused at Task 3)
**Plan metadata:** (this commit — docs: complete plan)

## Files Created/Modified
- `supabase/migrations/063_dual_mode_continue.sql` - Created. Idempotent DDL: 4 new columns + cap_paused on both status CHECKs; 062-style header (PROBLEM/FIX narrative, "Apply via the Supabase SQL editor — never `supabase db push`") + COMMENT ON COLUMN lines.
- `supabase/full-schema.sql` - Modified. Regenerated from the live DB after migration 063 applied: `runs.continues_used` + `runs_status_check` with cap_paused; `workflow_runs.inputs/model/continues_used` + `workflow_runs_status_check` with cap_paused (6× continues_used, 2× cap_paused on disk).
- `backend/tests/test_dual_mode_wiring.py` - Created (owned by Plans 02/03). Contracts: create_workflow_run atomicity (Q5), inputs/model persistence (SEED-047), producer harness/agent branch (SC#1), cancel clears anchor same-transaction (SC#2).
- `backend/tests/test_continue.py` - Created (owned by Plan 03). Contracts: persist-then-clear buffer (SC#4), consume-not-redrop (SC#4), 3-cap refusal (D-06), re-read available_tools (D-08), Deep-run byte-identical when flag off.
- `backend/tests/test_thread_workflow_endpoint.py` - Created (owned by Plan 02). Contracts: ThreadWorkflowState shape (SC#5), lock_is_stale (SC#5), GET is pure read (SC#5).
- `supabase/verify_092.sql` - Created. Live-DB gate: information_schema.columns for the 4 new columns + pg_get_constraintdef proving cap_paused allowed on both status CHECKs; operator-run after pasting migration 063.

## Decisions Made
- **cap_paused distinct from paused** — workflow_runs retains both. `paused` is the pre-existing pause state; `cap_paused` is the new D-06 Continue-cap pause. Dropping `paused` would silently break existing terminal-status writes (T-092-01).
- **inputs/model persisted at creation** — closes SEED-047, where resume context omitted top-level programmatic inputs (empty splits) and the llm model (resumed phases ran with `model=""`). Run-creation in Plans 02/03 now writes these; Phase 096 EVAL-02 (kill-and-resume) is the proof gate.
- **NOT NULL + DEFAULT on the new columns** — `inputs` and both `continues_used` default safely so the ALTER cannot fail on existing rows (T-092-02); `model` stays nullable for older rows.

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None. The migration applied cleanly on the first paste (verify_092.sql passed: cap_paused present on both CHECKs, paused preserved on workflow_runs, all 4 columns present). full-schema.sql regenerated without a reset.

## Authentication Gates
None.

## User Setup Required
None - no external service configuration required. (The operator SQL-editor apply was the in-plan Task 3 checkpoint, not standing setup.)

## Next Phase Readiness
- **All downstream Phase 092 backend plans can now read the new columns.** Plan 02 (MODE-01 mode switch + workflow-run creation + MODE-02 server-side lock) and Plan 03 (MODE-02 cancel/terminal lock-clear + CONT-01 Continue) will flip the skipped contract tests in `test_dual_mode_wiring.py` / `test_continue.py` / `test_thread_workflow_endpoint.py` to live assertions, each un-skipping its own contracts.
- **SEED-047 substrate landed** (inputs/model columns); re-open trigger partially satisfied — Plans 02/03 wire run-creation to persist them, Phase 096 EVAL-02 is the live proof gate.
- **091 cross-provider UAT remains BLOCKED** on the workflow-start trigger (`INSERT INTO workflow_runs`) — Plan 02 owns that INSERT.

## Self-Check: PASSED

All created files exist on disk (migration 063, 3 test scaffolds, verify_092.sql, regenerated full-schema.sql, this SUMMARY). All commits verified in git log: `35bbfade` (migration), `2e8106f0` (scaffolds), `e79acec7` (schema regen).

---
*Phase: 092-dual-mode-wiring-continue-button*
*Completed: 2026-05-31*
