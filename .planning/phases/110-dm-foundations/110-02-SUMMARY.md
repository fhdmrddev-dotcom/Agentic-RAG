---
phase: 110-dm-foundations
plan: 02
subsystem: database
tags: [postgres, rls, supabase, migration, full-schema, audit-log, asyncpg, document-management, live-verification]

# Dependency graph
requires:
  - phase: 110-01
    provides: "migration 071_dm_foundations.sql (authored, un-applied), the audit-enum lockstep + boot/CI drift guard, the default-ON flag chain, and the 6 Wave-0 test files this plan turns GREEN"
  - phase: 102
    provides: "the 'static would false-green' discipline — the live INSERT+SELECT round-trip + RLS-engaged (not bypassed) assertions are the phase gate, applied here"
provides:
  - "migration 071 APPLIED to the live local DB (:54322) — 4 RLS tables, audit CHECK 11->19, app_settings.document_management_enabled flag, all verified live"
  - "supabase/full-schema.sql regenerated from the live DB (no --reset) — the single-file deploy artifact now reflects migration 071 (4 CREATE TABLE blocks + 19-type CHECK + flag column + corrected user-scoped document_relationships policies)"
  - "corrected document_relationships RLS: USER-SCOPED ONLY (no is_global column by design) — fixes the Plan-01 uniform-template defect that referenced a non-existent column"
  - "27 live integration tests GREEN against the migrated DB (8-type audit round-trip, subset/exactly-19 drift guard, 4-table schema shape + 2-user RLS isolation + global visibility, live flag read chain)"
affects: [111-metadata-enrichment, 112-metadata-update, 113-virtual-folders, 114-views, 116-relationships, 118-auto-classification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-table RLS shape (not a uniform template): the 3 library/config tables carry user_id + is_global; document_relationships is user-scoped only (an inherently user-owned link, never a global/admin-seeded shareable object)"
    - "Live-DB verification as the phase gate — raw asyncpg INSERT+SELECT round-trip + SET LOCAL ROLE authenticated RLS engagement; a mock or superuser bypass would false-green and is caught here"
    - "SEED-056 net-new proof via stash-and-rerun: stash THIS plan's working-tree diff, re-run the full suite at base, diff failure sets — proves net-new=0 without trusting a raw count"

key-files:
  created: []
  modified:
    - supabase/migrations/071_dm_foundations.sql
    - supabase/full-schema.sql
    - backend/tests/integration/test_110_dm_schema.py

key-decisions:
  - "document_relationships RLS is USER-SCOPED ONLY (no is_global) — the authoritative per-table DDL (RESEARCH §3.2 / PATTERNS §3.2, citing ARCHITECTURE.md §2) deliberately omits is_global from this table; the Plan-01 uniform 4-policy template was a defect"
  - "test_dm_table_select_policy_shape now asserts per-table shape (is_global only for the 3 library tables) — spec-conformance, NOT a weakened test; the cross-user RLS isolation tests stay strict and GREEN"
  - "Migration applied via psycopg2-direct (operator-authorized CLI path, no data wipe) — the 100/102 precedent; NEVER supabase db push/db reset"

patterns-established:
  - "Per-table RLS shape: a relationship table is user-scoped (no is_global); library/config tables are user + is_global"
  - "Net-new=0 proof by stash-and-rerun base comparison, not raw failure count (SEED-056)"

requirements-completed: [DMF-01, DMF-02, DMF-03]

# Metrics
duration: ~22min
completed: 2026-06-15
---

# Phase 110 Plan 02: DM Foundations Live-Verified Summary

**Migration 071 applied to the live :54322 DB and verified live — 4 RLS tables, audit CHECK 11→19, and the document_management_enabled flag — with the document_relationships RLS corrected to user-scoped-only (fixing a Plan-01 non-existent-column defect), full-schema.sql regenerated, and 27 live integration tests GREEN.**

## Performance

- **Duration:** ~22 min
- **Started:** 2026-06-15T13:50Z (approx — first init query)
- **Completed:** 2026-06-15T14:11Z
- **Tasks:** 2 (Task 1 = operator/orchestrator migration apply [already satisfied on entry]; Task 2 = regen + live-verify + commit)
- **Files modified:** 3 (migration RLS fix, regenerated full-schema.sql, schema test adjustment) — +450 / −12 lines

## Accomplishments

- **Migration 071 applied + verified LIVE on :54322** (operator-authorized CLI psycopg2-direct apply, the 100/102 precedent — NOT `db push`/`db reset`). Read-back confirmed: 4 tables (`document_views`, `document_relationships`, `classification_rules`, `metadata_field_definitions`), the 19-type `audit_log_action_type_check` (incl. `metadata.field.create`), and `app_settings.document_management_enabled = true` on the `id='global'` row. **Dev data preserved: 19 documents / 221 threads** (identical before/after — no wipe).
- **document_relationships RLS corrected to USER-SCOPED ONLY.** The Plan-01 Task-1 RLS template applied the `is_global`-referencing 4-policy set uniformly to all 4 tables, but `document_relationships` has no `is_global` column by design → `UndefinedColumn` at apply time (exactly the defect the live-apply gate exists to catch). The corrected policies (already applied live + now committed): SELECT/DELETE `USING (auth.uid() = user_id)`, INSERT/UPDATE `WITH CHECK (auth.uid() = user_id)`. The 3 library tables keep their `user_id + is_global` policies unchanged.
- **`supabase/full-schema.sql` regenerated from the live DB** (`bash scripts/regenerate-full-schema.sh`, NO `--reset` — F9 trap avoided, dev data preserved). 2931 lines. Verified it now contains all 4 `CREATE TABLE` blocks, the 19-type CHECK (`metadata.field.create` present), `document_management_enabled boolean`, and the corrected user-scoped `document_relationships` policies (all 4 user-scoped, no `is_global`).
- **`test_dm_table_select_policy_shape` fixed to the correct per-table shape** (spec-conformance, not a weakening): `user_id` asserted for all 4 tables, `is_global` asserted ONLY for the 3 library tables, and `is_global` asserted ABSENT for `document_relationships`. The strict cross-user RLS isolation tests were left untouched and stay GREEN.
- **27 live integration tests GREEN (not skipped)** against the migrated DB — the phase acceptance gate.

## Task Commits

This plan produced one logical commit (CLAUDE.md migration-discipline rule: migration + regenerated artifact + the test fix ship together). Task 1's apply was performed out-of-band (operator-authorized) before this executor ran.

1. **Task 2: regen full-schema + fix document_relationships RLS + adjust schema test (one commit)** — `25844c67` (feat)

**Plan metadata:** _(final docs commit — see git log)_

## Files Created/Modified

- `supabase/migrations/071_dm_foundations.sql` — RLS fix: `document_relationships` policies now user-scoped (no `is_global`); matches the authoritative per-table DDL. (Plan-01 authored the rest; this is the corrective delta that was applied live.)
- `supabase/full-schema.sql` — regenerated from the live DB (no `--reset`); reflects all of migration 071.
- `backend/tests/integration/test_110_dm_schema.py` — `test_dm_table_select_policy_shape` rewritten to per-table shape (`_IS_GLOBAL_TABLES` set) + module docstring updated.

## Decisions Made

- **document_relationships is user-scoped (no is_global)** — followed the authoritative per-table DDL over the uniform RLS template. A relationship is an inherently user-owned link between a user's own documents, never a global/admin-seeded shareable object. (Confirmed against the migration file, the regenerated full-schema.sql, and the live DB.)
- **Test fix is spec-conformance, not a weakened assertion** — the old test embedded the same wrong uniform-is_global assumption and failed correctly once the policy was corrected. The fix asserts the real per-table contract; the security-gate cross-user isolation tests were not touched.

## Deviations from Plan

The plan's Task 2 anticipated exactly this contingency ("If any live test reveals a migration or code defect (e.g. a missing policy)... fix the migration FILE... Do NOT weaken a test to make it pass — the live test IS the gate"). The work performed is squarely inside that anticipated path, so it is documented rather than treated as scope creep.

### Auto-fixed Issues

**1. [Rule 1 - Bug] document_relationships RLS referenced a non-existent is_global column**
- **Found during:** Task 1 (migration apply, performed out-of-band by the orchestrator) — `UndefinedColumn: column "is_global" does not exist`.
- **Issue:** Plan-01's uniform 4-policy RLS template applied `is_global`-referencing policies to all 4 tables, but `document_relationships` has no `is_global` column (deliberate per RESEARCH §3.2 / ARCHITECTURE.md §2).
- **Fix:** Corrected the 4 `document_relationships` policies to user-scoped-only (`auth.uid() = user_id`); the 3 library tables unchanged. The corrected migration was applied live; the fix is now committed.
- **Files modified:** `supabase/migrations/071_dm_foundations.sql`
- **Verification:** Live DB read-back shows `document_relationships` SELECT qual = `(auth.uid() = user_id)` and the table has no `is_global` column; the regenerated full-schema.sql matches; the schema/RLS tests pass.
- **Committed in:** `25844c67`

**2. [Rule 1 - Bug] test_dm_table_select_policy_shape embedded the wrong uniform-is_global assumption**
- **Found during:** Task 2 (the 4-live-test run).
- **Issue:** The parametrized test asserted every table's SELECT policy contains both `user_id` AND `is_global` — false for the now-correctly-user-scoped `document_relationships`.
- **Fix:** Rewrote to per-table shape: `user_id` for all 4, `is_global` only for the 3 library tables, `is_global` ABSENT for `document_relationships`. Cross-user RLS isolation tests left strict + GREEN.
- **Files modified:** `backend/tests/integration/test_110_dm_schema.py`
- **Verification:** `test_dm_table_select_policy_shape` 4/4 PASS; this test FAILED at base (old assertion) — proof it was the wrong assumption, not a weakened test.
- **Committed in:** `25844c67`

---

**Total deviations:** 2 auto-fixed (2 bugs — Rule 1). Both were the anticipated live-apply-gate catches (the phase's entire purpose). No scope creep; no test weakened.
**Impact on plan:** The substrate is now correct AND verified live. The defect would have shipped a wrong (non-applying) migration into the deploy artifact had the live gate not run.

## Issues Encountered

**Full-suite failures are pre-existing rot, net-new = 0 (SEED-056 proof).** The full backend suite (`pytest -q`, 1582 collected) showed **119 failures** with this plan's changes. To prove these are not net-new, I stashed ONLY this plan's 3 working-tree files (migration, full-schema, test) — restoring base state while the live DB stayed migrated (the migration was applied independently of git) — and re-ran the full suite at base: **120 failures**.

Diffing the two failure sets:
- **Net-new failures my changes introduced: 0** (`comm -13` base→with-plan is empty).
- **Failures my changes FIXED: 1** — `test_110_dm_schema.py::test_dm_table_select_policy_shape[document_relationships]` (failed at base with the old uniform-is_global assertion; passes now with the corrected per-table assertion).

So the suite went from 120 → 119 failures purely because this plan FIXED one test; every other failure is identical at base and is unrelated pre-existing rot (e.g. `test_retrieval_service`, `test_sql_service`, `test_multimodal_query`, `test_lifespan`, the `test_059/061/062/063/066` integration families — MagicMock-not-JSON-serializable, missing-directory, and similar mock/infra rot present at HEAD `818023e8`).

**Note on the Plan-01 prediction:** Plan-01's SUMMARY predicted ~61 `client`-fixture tests would RECOVER once migration 071 was applied (they were erroring at startup because the boot drift-guard hard-failed against the un-applied migration). On this run the migration was already applied before the executor started, so the boot guard already passes and those tests were no longer erroring at startup — they are absent from both failure sets. The remaining 119 are a separate, pre-existing rot population.

## User Setup Required

None this plan. The migration apply (normally an operator SQL-editor paste) was performed out-of-band via operator-authorized psycopg2-direct CLI apply (no data wipe), and is now committed alongside the regenerated full-schema.sql.

## Next Phase Readiness

- **Phase 110 substrate is REAL and verified LIVE.** The 8-type audit vocabulary is enforced live (round-trips for all 8); the 4 RLS tables exist with correct per-table policies (user-scoped relationships, user+global library tables); `document_management_enabled` reads True end-to-end.
- **Ready for phases 111–119:** metadata-fields / views / relationships / classification all have their tables + RLS + audit types in place. The `document_management_enabled` master gate is readable via the default-ON helper.
- **Deploy artifact consistency:** `supabase/full-schema.sql` reflects migration 071 for greenfield envs.
- **No blockers.** Pre-verify-work backstop ran; net-new failures = 0.

## Self-Check: PASSED

(see appended Self-Check section)

---
*Phase: 110-dm-foundations*
*Completed: 2026-06-15*
