---
phase: 102-reusable-validation-gate-library-output-quality-gate
plan: 01
subsystem: database
tags: [harness, pydantic, validators, audit, migration, postgres, workflow]

# Dependency graph
requires:
  - phase: 101.1-guaranteed-emission-layer
    provides: "the forced_emit seam (the judge verdict rides it), the emit-kind audit lockstep pattern (069), check_coverage/assert_integrity primitives"
  - phase: 091-harness-engine
    provides: "the closed VALIDATOR_REGISTRY + run_gates + bounded-retry loop the 5 new kinds plug into"
  - phase: 098-project-folder-binding
    provides: "the additive-optional WorkflowDefinition JSONB block business_requirement appends to"
provides:
  - "ValidatorSpec.kind extended to 9 kinds (4 existing + 5 library kinds) + the timing: pre|post seam (D-10)"
  - "ValidatorSpec.on_failure accepts ask_user as a 4th value (D-11, stays a str)"
  - "LlmEmitPhaseConfig.citation_policy (strict|flag|partial|draft) + integrity_policy (strict|documented_limit), both default strict (D-01)"
  - "WorkflowDefinition.business_requirement: str | None = None (D-13, additive-optional, zero-migration)"
  - "Settings.harness_judge_model: str | None = None (D-03)"
  - "migration 070 (authored, NOT applied): harness_audit CHECK +6 kinds + workflow_runs.is_golden_run column (D-05)"
  - "_AUDIT_EVENT_TYPES extended 16 -> 22 in lockstep with the 070 CHECK"
  - "8 Wave-0 cross-plan TDD test stubs (xfail RED, suite exits 0) downstream plans un-mark"
affects: [102-02 migration apply, 102-03 validator kinds, 102-04 timing/ask_user/citation_policy engine seams, 102-05 publish service]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Additive-optional Pydantic on JSONB content (zero-migration for schema fields; old rows model_validate() unchanged)"
    - "code <-> Postgres CHECK lockstep frozenset (_AUDIT_EVENT_TYPES mirrors the migration CHECK; fail-fast ValueError before any DB call)"
    - "Wave-0 xfail RED stubs with imports inside the test body (collection never breaks on an unbuilt symbol); downstream plans un-mark on landing"

key-files:
  created:
    - "supabase/migrations/070_harness_validation_gate_library.sql"
    - "backend/tests/unit/test_validator_kinds.py"
    - "backend/tests/unit/test_freshness.py"
    - "backend/tests/unit/test_pre_post_timing.py"
    - "backend/tests/unit/test_ask_user_disposition.py"
    - "backend/tests/unit/test_citation_policy.py"
    - "backend/tests/unit/test_publish_service.py"
    - "backend/tests/unit/test_harness_audit_102.py"
    - "backend/tests/unit/test_publish_flip.py"
  modified:
    - "backend/app/models/harness.py"
    - "backend/app/config.py"
    - "backend/app/db/workflows.py"
    - "backend/tests/unit/test_harness_audit_emit.py"

key-decisions:
  - "ValidatorSpec.kind is the closed 9-kind Literal (T-102-01-01 — an injected kind raises ValidationError before the engine runs)"
  - "timing defaults to post so every existing gate is byte-unchanged; on_failure stays a str so ask_user is one more recognized value, not a new type"
  - "citation_policy + integrity_policy default strict everywhere — the strict path is byte-identical; policy only changes what happens AFTER the verdict"
  - "business_requirement is OPTIONAL on the schema; the publish endpoint (Plan 05), NOT this model, enforces required-at-publish (D-13)"
  - "migration 070 is authored here but NOT applied — Plan 02 is the BLOCKING operator apply + full-schema regen"

patterns-established:
  - "lockstep frozenset == migration CHECK: extend BOTH in one plan or a receipt INSERT 23514s mid-run (the 069/070 discipline)"
  - "Wave-0 un-mark-on-landing: test_harness_audit_102 is GREEN at end of this plan (Task 3); the 7 others stay xfail until Plans 03/04/05"

requirements-completed: []  # GATE-01 + QUAL-01 are MULTI-PLAN — they mark complete at phase verification (the 099/WFSKILL-01 convention), NOT at this foundation plan

# Metrics
duration: 11min
completed: 2026-06-12
---

# Phase 102 Plan 01: Validation-Gate Library Foundation Substrate Summary

**Additive-optional schema substrate for GATE-01/QUAL-01: the 9-kind ValidatorSpec + timing pre|post seam, the strict-default citation/integrity policy enums, WorkflowDefinition.business_requirement, the harness_judge_model setting, migration 070 (CHECK +6 kinds + is_golden_run), the _AUDIT_EVENT_TYPES 16->22 lockstep, and the 8 Wave-0 cross-plan TDD test scaffold.**

## Performance

- **Duration:** ~11 min
- **Started:** 2026-06-12T06:38:38Z
- **Completed:** 2026-06-12T06:49:32Z
- **Tasks:** 3
- **Files modified:** 13 (9 created, 4 modified)

## Accomplishments
- Extended `ValidatorSpec.kind` to the full 9-kind set (4 existing + `citations_required`, `freshness`, `structure_check`, `output_file_valid`, `llm_judge_rubric`) + added the generic `timing: pre | post` field (D-10) — the seam Plan 03's freshness validator and Plan 105's budget preflights reuse.
- Added the SEED-082 policy vocabulary engine-side: `citation_policy` (strict|flag|partial|draft) + `integrity_policy` (strict|documented_limit) on `LlmEmitPhaseConfig`, both defaulting to `strict` so every existing emit row stays byte-identical (D-01).
- Added `WorkflowDefinition.business_requirement` (D-13) + `Settings.harness_judge_model` (D-03) — both optional/None defaults; pre-102 JSONB rows `model_validate()` unchanged (zero migration for the schema fields).
- Authored migration 070 (the ONLY DB migration this phase ships): `harness_audit` CHECK ALTER (+6 judge/publish/policy/ask_user-approval kinds) + `workflow_runs.is_golden_run` column (D-05) — NOT applied (Plan 02's BLOCKING operator step).
- Extended `_AUDIT_EVENT_TYPES` 16 -> 22 in lockstep with the 070 CHECK; the offline audit-kind test (`test_harness_audit_102.py`) is GREEN at the end of this plan.
- Scaffolded the 8 Wave-0 cross-plan TDD test files (xfail RED, suite exits 0) the downstream plans un-mark as they land.

## Task Commits

Each task was committed atomically:

1. **Task 1: Wave 0 TDD scaffold (8 cross-plan test files)** - `d8354dd6` (test)
2. **Task 2: Additive-optional model fields + harness_judge_model setting** - `ee8ae7af` (feat)
3. **Task 3: Migration 070 + _AUDIT_EVENT_TYPES lockstep + un-mark audit test** - `c293fd49` (feat)

**Plan metadata:** (final docs commit) — SUMMARY + STATE + ROADMAP

_Note: this plan's TDD tasks use single commits per the Wave-0 scaffold convention (the test files ARE the RED deliverable; the GREEN un-marks are folded into Task 2/3's feat commits per the 098/099/101.1 un-mark-on-landing convention)._

## Files Created/Modified
- `supabase/migrations/070_harness_validation_gate_library.sql` - harness_audit CHECK +6 102 kinds + workflow_runs.is_golden_run column (authored, applied by Plan 02)
- `backend/app/models/harness.py` - ValidatorSpec.kind (9 kinds) + timing; LlmEmitPhaseConfig.citation_policy + integrity_policy; WorkflowDefinition.business_requirement
- `backend/app/config.py` - Settings.harness_judge_model (D-03/QUAL-01)
- `backend/app/db/workflows.py` - _AUDIT_EVENT_TYPES 16 -> 22 lockstep + write_audit ValueError/docstring 16 -> 22
- `backend/tests/unit/test_validator_kinds.py` - the 5 new kinds (Plan 03 targets, 7 xfail)
- `backend/tests/unit/test_freshness.py` - freshness deterministic checks + ask_user finding (Plan 03)
- `backend/tests/unit/test_pre_post_timing.py` - the D-10 run_gates timing filter (Plan 04)
- `backend/tests/unit/test_ask_user_disposition.py` - the D-11 4th on_failure disposition (Plan 04)
- `backend/tests/unit/test_citation_policy.py` - the D-01 enum dispositions (Plan 04)
- `backend/tests/unit/test_publish_service.py` - the publish pipeline order + hard blocker (Plan 05)
- `backend/tests/unit/test_harness_audit_102.py` - the 22-kind lockstep (GREEN this plan)
- `backend/tests/unit/test_publish_flip.py` - live-DB draft->published trigger (psycopg2 :54322, xfail + skip-guarded; Plan 05 + live apply)
- `backend/tests/unit/test_harness_audit_emit.py` - [Rule 1] bumped the count assertion 16 -> 22

## Decisions Made
- None beyond the plan's locked decisions (D-01/D-03/D-05/D-10/D-11/D-12/D-13 implemented as specified). `claude-opus-4-8` and `gpt-5.5` confirmed `forced_emission: True` in MODEL_CAPABILITIES (config.py:225,222) — the `harness_judge_model` None-default resolves to a forceable model.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Bumped a stale count assertion in test_harness_audit_emit.py (16 -> 22)**
- **Found during:** Task 3 (migration 070 + _AUDIT_EVENT_TYPES lockstep)
- **Issue:** Extending `_AUDIT_EVENT_TYPES` 16 -> 22 broke the Phase-101.1 sibling test `test_harness_audit_emit.py::test_write_audit_accepts_emit_kinds`, which hard-asserted `len(_AUDIT_EVENT_TYPES) == 16`. This failure was DIRECTLY caused by this task's additive frozenset extension (the ALTER is additive — all 16 prior kinds remain present, only the hardcoded total drifted).
- **Fix:** Updated the assertion to `== 22` with a lockstep comment. The test's substantive membership assertions (all 7 emit kinds + 9 prior kinds present) are unchanged and still pass.
- **Files modified:** backend/tests/unit/test_harness_audit_emit.py
- **Verification:** `pytest tests/unit/test_harness_audit_emit.py tests/unit/test_harness_audit_102.py -q` -> 3 passed.
- **Committed in:** c293fd49 (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — a stale lockstep count assertion directly caused by this task's additive frozenset extension).
**Impact on plan:** Necessary for correctness (the lockstep total IS the contract). No scope creep — within the same lockstep mechanic the task already owned.

## Issues Encountered
None. All three tasks executed as planned; the single deviation was a same-task lockstep ripple, handled inline.

## SEED-056 Net-New-Failure Proof
- Wave-0 target suite (8 files): `1 passed, 17 xfailed, 5 xpassed` — exits 0, no collection errors. `test_harness_audit_102.py` GREEN (the only Plan-01-GREEN test).
- Wider unit slice at HEAD: **56 failed / 716 passed**. Reverting the 3 touched source files (`harness.py`, `config.py`, `workflows.py`) to the wave base (`1d81d1f8`) yields **58 failed** — MORE failures, because the 2 extra are MY un-marked tests (`test_harness_audit_102` + `test_harness_audit_emit`) failing against the reverted 16-kind source, which PROVES the source changes are load-bearing and correct. Source restored to HEAD clean.
- **Net-new failures introduced by this plan = 0** (the 56 are documented pre-existing rot — `test_sql_service`, `test_streaming_reliability`, `test_075_4_final_output_files_payload`, `test_phase56_iteration_start`, none of which import this plan's changed modules; proven identical at base).

## Threat Surface
All changes fall inside the plan's `<threat_model>` (T-102-01-01..04): `_StrictBase` extra='forbid' + the closed `kind` Literal reject an injected validator kind; the `_AUDIT_EVENT_TYPES`/CHECK lockstep prevents a mid-run 23514; `is_golden_run` is an additive boolean (no RLS surface); every new schema field is optional-with-default (pre-102 rows validate). No new network endpoint, auth path, or trust-boundary surface introduced — no threat flags.

## Known Stubs
The 8 Wave-0 test files are INTENTIONAL xfail RED stubs (the project's documented Wave-0 un-mark-on-landing convention, not harmful stubs — they flow no empty data to any UI). `test_harness_audit_102.py` is un-marked to GREEN by this plan's Task 3; the 7 others are un-marked by their owning downstream plans (Plan 03: validator_kinds + freshness; Plan 04: pre_post_timing + ask_user_disposition + citation_policy; Plan 05: publish_service + publish_flip). No source stubs (the model/config/db changes are complete contracts; behavior implementation is the downstream plans' scope per the multi-plan phase design).

## Next Phase Readiness
- **Plan 02 (BLOCKING, operator):** apply migration 070 via the Supabase SQL editor or psycopg2 :54322 (NEVER db push/db reset), then `bash scripts/regenerate-full-schema.sh` (no reset) and commit both — un-marks `test_publish_flip.py`'s live half once the trigger behavior is wired in Plan 05.
- **Plans 03/04/05:** the contracts they extend now exist — the 5 validator kinds register into `VALIDATOR_REGISTRY`, the `timing` filter threads into `run_gates`, `ask_user` parses in `_parse_on_failure`, the policy enums are consumed in `_exec_llm_emit`, and the 6 receipt kinds + `is_golden_run` are available to the publish path.

## Self-Check: PASSED

- All 9 created files + the SUMMARY verified present on disk.
- All 3 task commits (`d8354dd6`, `ee8ae7af`, `c293fd49`) verified in git history.

---
*Phase: 102-reusable-validation-gate-library-output-quality-gate*
*Completed: 2026-06-12*
