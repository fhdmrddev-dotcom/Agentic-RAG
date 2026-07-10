---
phase: 120-collision-fix-context-isolation
plan: 03
subsystem: database
tags: [postgres, migration, supabase, asyncpg, messages, origin, context-isolation, ctx-01]

# Dependency graph
requires:
  - phase: 120-02
    provides: "migration 076_messages_origin.sql (authored, NOT applied) + the asymmetric origin history filter that reads messages.origin"
provides:
  - "Migration 076 APPLIED to the live local DB (:54322) — messages.origin exists NOT NULL DEFAULT 'deep' + CHECK (origin IN ('deep','harness'))"
  - "658 legacy messages rows backfilled to origin='deep' (zero NULL — the load-bearing NULL-trap guard closed)"
  - "supabase/full-schema.sql regenerated from the live DB (single-file greenfield deploy artifact reflecting origin)"
  - "backend/tests/integration/test_120_migration.py — green live-DB SC#3 migration-semantics gate (zero NULL, NOT NULL DEFAULT 'deep', CHECK accept/reject)"
affects: [121, 122, 123, verify-work, secure-phase, validate-phase, SC#10-live-UAT]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Live-DB APPLY GATE test: an absent column is a HARD FAIL (not a skip) because this plan applies the migration; only an unreachable :54322 skips."
    - "CHECK-constraint probe must satisfy ALL not-null sibling columns (user_id) or the INSERT fails before the target CHECK is reached (vacuous probe)."

key-files:
  created: []
  modified:
    - "supabase/full-schema.sql — regenerated (origin column + messages_origin_check) via scripts/regenerate-full-schema.sh (no --reset) [committed Task 2, d0edbdf1]"
    - "backend/tests/integration/test_120_migration.py — Rule 1 fix: supply NOT NULL user_id in the CHECK probe inserts"

key-decisions:
  - "Rule 1 fix: the origin CHECK probe INSERTs omitted the NOT NULL user_id column, so the INSERT failed on user_id BEFORE the origin CHECK was evaluated (a vacuous probe that masqueraded as passing). Reuse the throwaway auth.users id for FK + NOT NULL so the CHECK is genuinely exercised."

patterns-established:
  - "Live-DB constraint probes: enumerate every NOT NULL sibling column before asserting on a single target CHECK, or the probe is vacuous."

requirements-completed: [CTX-01]

# Metrics
duration: ~10min
completed: 2026-06-22
---

# Phase 120 Plan 03: Apply Migration 076 + Live-DB Verification Summary

**Migration 076 applied to the live local DB (messages.origin NOT NULL DEFAULT 'deep' + CHECK), 658 legacy rows backfilled with zero NULL, full-schema.sql regenerated, and the full Phase 120 test set is green (21/21) with the two prior PGRST204 test_093 failures resolved.**

## Performance

- **Duration:** ~10 min
- **Completed:** 2026-06-22
- **Tasks:** 3 (Task 1 + Task 2 done by prior agent/orchestrator; Task 3 this session)
- **Files modified:** 2 (`supabase/full-schema.sql` regenerated in Task 2; `test_120_migration.py` Rule 1 fix in Task 3)

## Accomplishments

- **Migration 076 is live on :54322** — `messages.origin` exists with `is_nullable=NO`, `column_default='deep'::text`, and `messages_origin_check CHECK (origin IN ('deep','harness'))`. Applied via psycopg2-direct (NOT `db push`/`db reset`) per CLAUDE.md.
- **The load-bearing NULL-trap guard is closed** — live DB shows `total=658, null_origin=0, deep=658, harness=0`. Every legacy row backfilled to `'deep'`, so the Deep-side `neq('origin','harness')` replay filter never silently drops a row under three-valued logic (Pitfall 1).
- **`supabase/full-schema.sql` regenerated** from the live DB (committed `d0edbdf1`, Task 2) — contains `origin text DEFAULT 'deep'::text NOT NULL` + `CONSTRAINT messages_origin_check` at lines 615-616. Not hand-edited.
- **Full Phase 120 test set green (21/21).** The live-DB SC#3 migration-semantics gate now passes (the CHECK genuinely accepts deep/harness and rejects 'other').
- **The two prior PGRST204 `test_093` failures are RESOLVED** by this apply — `test_deep_runs_id_path_still_200` and `test_ask_user_answer_resolves_via_workflow_run_fallback` both pass now (the whole `093` selection: 60 passed, 1 skipped, 0 failed).

## Task 3 Test Results

| Suite | Command | Result |
|---|---|---|
| Live-DB integration | `pytest tests/integration/test_120_migration.py -x` | **3 passed** (after Rule 1 fix) |
| Combined Phase 120 set | `pytest test_120_migration.py test_120_collision_regression.py test_120_origin_filter.py -x` | **21 passed** (3 + 4 + 14), exit 0 |
| Shared dedup machinery | `pytest tests/unit/test_075_4_dedup_supersedes.py -q` | green (within the 17 passed below) |
| Sandbox service regression | `pytest tests/unit/test_sandbox_service.py -q` | **17 passed, 3 failed** — the 3 are PRE-EXISTING (see classification) |
| test_093 PGRST204 re-check | `pytest tests/ -q -k "093"` | **60 passed, 1 skipped, 0 failed** — the two prior PGRST204 failures RESOLVED |

### Net-new vs pre-existing failure classification

- **Net-new failures: 0.** No failure was introduced by Phase 120.
- **Pre-existing failures (NOT blockers, documented in `deferred-items.md` lines 7-29):** the 3 `TestHarvestOutputFiles` tests in `test_sandbox_service.py` (`test_harvest_files_uploads_and_inserts`, `test_harvest_files_empty_output`, `test_harvest_files_storage_path_format`). They assert the OLD bare-filename `current_files_set == {"output.csv"}` contract, broken since the Phase 075.4 D-075.4-D1 hash-keyed signature pivot. The live failure signature confirms it verbatim: `{'999a997749c.../output.csv'} == {'output.csv'}` (SHA-256-prefixed storage-path key vs bare filename). Phase 120 Plan 01 touched `tool_dispatcher.py`'s lazy baseline seed — NOT `harvest_output_files` — so these are out-of-scope test debt, candidate for a follow-up hygiene fix.

## Files Created/Modified

- `supabase/full-schema.sql` — regenerated from the live DB (origin column + `messages_origin_check`), committed `d0edbdf1` (Task 2).
- `backend/tests/integration/test_120_migration.py` — Rule 1 fix: the CHECK probe INSERTs now supply the NOT NULL `user_id` (reusing the throwaway `auth.users` id) so the origin CHECK is actually exercised.

## Decisions Made

- **Rule 1 deviation (test bug fix):** See below. No other decisions — the plan executed as specified.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Vacuous origin-CHECK probe — missing NOT NULL user_id**
- **Found during:** Task 3 (running the live-DB integration test for the first time after the migration was applied)
- **Issue:** `test_check_accepts_valid_rejects_other` (authored in Task 1) INSERTed into `public.messages` WITHOUT `user_id`. Since `messages.user_id` is `NOT NULL`, the INSERT failed with `NotNullViolationError` on `user_id` **before** the `messages_origin_check` CHECK was ever evaluated. The 'deep'/'harness' accept-path inserts would have failed identically, and the `pytest.raises(CheckViolationError)` block would have failed for the wrong reason — the CHECK was never genuinely tested.
- **Fix:** Added `user_id` to all three probe INSERTs, reusing the throwaway `auth.users` id already created inside the rolled-back transaction (satisfies both the FK and the NOT NULL). The CHECK now genuinely accepts 'deep'/'harness' and rejects 'other'.
- **Files modified:** `backend/tests/integration/test_120_migration.py`
- **Verification:** Re-ran `pytest tests/integration/test_120_migration.py -x` → 3 passed. The CHECK reject path now raises `CheckViolationError` (not `NotNullViolationError`).
- **Committed in:** `035295a1` (`fix(120-03): supply NOT NULL user_id in origin CHECK probe inserts`)

---

**Total deviations:** 1 auto-fixed (1 bug — Rule 1).
**Impact on plan:** The fix was load-bearing — without it the SC#3 CHECK gate was vacuous (it never reached the origin constraint). No scope creep; the fix is confined to the test's probe inserts.

## Issues Encountered

None beyond the Rule 1 fix above. Migration apply (Task 2) and full-schema regeneration were completed by the orchestrator before this session; verification confirmed both live (zero NULL origin, full-schema.sql contains the column).

## User Setup Required

None - no external service configuration required. (Task 2's migration apply was the only manual step and is complete.)

## Next Phase Readiness

- **CTX-01 SC#3 is satisfied** — the column exists on the live DB with the load-bearing semantics, the full Phase 120 test set is green, and `full-schema.sql` reflects the new column.
- **Phase 120 plans (01, 02, 03) are all complete.** The phase is ready for `/gsd:verify-work 120` and the SC#10 4-axis cross-provider live UAT (VALIDATION.md).
- **No blockers.** The 3 pre-existing `test_sandbox_service` failures are documented test debt unrelated to Phase 120 (candidate for a follow-up hygiene fix).

## Self-Check: PASSED

- FOUND: `.planning/phases/120-collision-fix-context-isolation/120-03-SUMMARY.md`
- FOUND: `backend/tests/integration/test_120_migration.py`
- FOUND commit `035295a1` (Task 3 Rule 1 fix)
- FOUND commit `d0edbdf1` (Task 2 migration apply + full-schema regen)
- FOUND commit `fb50bce8` (Task 1 integration test)

---
*Phase: 120-collision-fix-context-isolation*
*Completed: 2026-06-22*
