---
phase: 165-is-global-retirement-cleanup
plan: 05
subsystem: testing
tags: [rls, isolation, is_org_shared, is_system_global, multi-tenancy, pytest, migration-111]

# Dependency graph
requires:
  - phase: 163-rls-rewrite-user-jwt-client-swap
    provides: "the membership-RLS policies + mig-109 platform-universal branches these tests assert against"
  - phase: 164-secdef-audit-cross-org-isolation-suite
    provides: "_null_foreign_global_owner owner-nulling precedent (D-164-05) exercised by test_seed091"
  - phase: 165-is-global-retirement-cleanup (plan 02)
    provides: "the folder_utils.py owner-null broadening that already renamed the folders section of test_seed091 to is_org_shared"
provides:
  - "The RLS / cross-org-isolation / leak / owner-nulling test set aligned to migration-111 per-table split column names"
  - "MIG-02 rename-regression coverage for the highest-risk raw-SQL, multi-table security tests"
affects: [165-10 (migration 111 apply), 165-11 (exit-gate green run — the assertion-level arbiter)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-occurrence owning-table read before renaming a same-token is_global literal (T-165-17 mitigation) — never grep-and-infer in a raw-SQL security test"
    - "Semantic-split rename: folders/skills -> is_org_shared; workflow_definitions/document_views/classification_rules/metadata_field_definitions -> is_system_global; skills.is_system KEPT"

key-files:
  created: []
  modified:
    - backend/tests/integration/test_163_rls_documents.py
    - backend/tests/integration/test_163_rls_platform_universal.py
    - backend/tests/integration/test_163_rls_skills.py
    - backend/tests/integration/test_163_rls_workflow_eval.py
    - backend/tests/integration/test_163_rls_dm.py
    - backend/tests/test_seed091_owner_nulling.py
    - backend/tests/integration/test_113_view_global_leak.py
    - backend/tests/integration/test_114_count_only.py
    - backend/tests/integration/test_115_tool_global_leak.py
    - backend/tests/integration/test_116_tool_leak.py
    - backend/tests/integration/test_117_route_leak.py
    - backend/tests/integration/test_119_leak.py
    - backend/tests/integration/test_119_broken.py
    - backend/tests/integration/test_seed_pm_pack.py
    - backend/tests/test_099_skill_composition.py

key-decisions:
  - "D-165-01 split applied per owning table per the plan's explicit per-file mapping (not inference)"
  - "D-165-02: every skills.is_system literal preserved (platform-universal escape + T-163-11 badge-spoof guards); genuine is_system word-count unchanged vs HEAD (28->28 platform_universal, 0->0 skills, 8->8 seed091)"
  - "D-165-06: folder_is_globally_visible -> folder_is_org_shared everywhere it appears (DEFINER fn rename)"

patterns-established:
  - "Rename-order safety: replace folder_is_globally_visible FIRST (it embeds the substring is_global via is_globally), then rename remaining is_global — prevents corruption"
  - "is_system_global does NOT contain the substring is_global, so the 0-bare-is_global grep stays honest after the split rename"

requirements-completed: [MIG-02]

# Metrics
duration: 8min
completed: 2026-07-20
---

# Phase 165 Plan 05: RLS / Isolation / Leak Test Rename Summary

**Renamed `is_global` in the 15 highest-risk raw-SQL, multi-table security tests to their correct migration-111 split target per owning table (folders/skills -> `is_org_shared`; workflow/view/rule/metadata -> `is_system_global`) + `folder_is_globally_visible` -> `folder_is_org_shared`, preserving every `skills.is_system` marker.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-20T21:38:06Z
- **Completed:** 2026-07-20T21:46:09Z
- **Tasks:** 2
- **Files modified:** 15

## Accomplishments
- The `test_163_rls_*` cluster + platform-universal guard (5 files) renamed with per-table targeting — the mig-109 Test-7 regression-class guard now asserts against the correct split columns.
- The leak / owner-nulling / mixed-seed tests (10 files) renamed; the 4 genuinely mixed files (`test_seed091_owner_nulling`, `test_seed_pm_pack`, `test_115_tool_global_leak`, `test_099_skill_composition`) apply BOTH targets correctly per the explicit map.
- All 15 plan files: 0 bare `is_global`, 0 `folder_is_globally_visible`; genuine `is_system` preserved (word-count unchanged vs HEAD); `--collect-only` clean (103 tests collected across all 15, exit 0).

## Task Commits

Each task was committed atomically:

1. **Task 1: Rename the test_163_rls_*.py cluster + platform-universal guard (5 files)** - `e6f4fd7d` (test)
2. **Task 2: Rename the leak / owner-nulling / mixed-seed tests (10 files)** - `63d2abbd` (test)

## Files Created/Modified

Task 1 (RLS-cluster — 5 files):
- `test_163_rls_documents.py` - folders is_global -> is_org_shared; folder_is_globally_visible -> folder_is_org_shared (incl. the structural policy-text asserts).
- `test_163_rls_platform_universal.py` - folders/skills -> is_org_shared; workflow_definitions -> is_system_global; folder_is_globally_visible -> folder_is_org_shared; KEPT all 28 `is_system` (universal-escape + badge-spoof guards). Contains `is_system_global` per the plan artifact requirement.
- `test_163_rls_skills.py` - skills + skill_files/tuner_runs EXISTS-on-skills -> is_org_shared; test fn renamed `test_is_org_shared_branch_preserved`.
- `test_163_rls_workflow_eval.py` - workflow_definitions -> is_system_global (incl. `_seed_workflow_def` param + call sites + policy-text asserts); tuner_runs EXISTS-on-skills branch -> is_org_shared.
- `test_163_rls_dm.py` - classification_rules + metadata_field_definitions + document_views -> is_system_global (incl. `_seed_rule` param + call sites + fn rename).

Task 2 (leak / owner-nulling / mixed — 10 files):
- `test_seed091_owner_nulling.py` - skills keys -> is_org_shared (KEPT is_system); document_views keys -> is_system_global; stale is_global token cleared from the plan-02 folders comment.
- `test_seed_pm_pack.py` - MIXED: workflow_definitions SELECT/unpack/asserts -> is_system_global; folders SELECT/unpack/asserts -> is_org_shared.
- `test_099_skill_composition.py` - workflow_definitions authored-cols set (`_AUTHORED_COLS`) -> is_system_global.
- `test_113_view_global_leak.py`, `test_115_tool_global_leak.py` - document_views service-role seeds -> is_system_global.
- `test_114_count_only.py`, `test_116_tool_leak.py`, `test_117_route_leak.py`, `test_119_leak.py`, `test_119_broken.py` - folders global-folder seeds -> is_org_shared.

## Decisions Made
- Applied the plan's explicit per-file table->target mapping verbatim; for every raw-SQL literal, read the surrounding INSERT/SELECT/policy-text context to confirm the owning table before renaming (the T-165-17 mitigation — never grep-and-infer).
- Renamed a small number of test/helper identifiers that literally embed `is_global` (e.g. `test_user_is_org_shared_skill_stays_org_scoped`, `_seed_workflow_def`/`_seed_rule` params) so the 0-bare-is_global grep holds; verified these names are only self-referenced within their own module (no cross-file imports).
- Reworded (not blindly token-swapped) two historical comments where a literal `is_global`->target swap would have read circularly (seed091 folders comment; kept the migration-history meaning intact).

## Deviations from Plan

None - plan executed exactly as written. The two STRIDE mitigations in the plan's threat register were honored as correctness requirements: T-165-17 (per-occurrence owning-table read + explicit map, not inference) and T-165-18 (`is_system` excluded — genuine word-boundary `is_system` count unchanged vs HEAD in both universal-guard files and seed091). No packages installed (T-165-SC accept).

## Issues Encountered
- Substring hazard: `folder_is_globally_visible` embeds `is_global` (via `is_globally`), and the new `is_system_global` token would false-match a naive `is_global` grep only if it contained the substring — it does not. Handled by renaming `folder_is_globally_visible` first, then targeting `is_global`; verified with a word-boundary grep that genuine `is_system` counts are unchanged (`is_system\b` does not match inside `is_system_global`).
- The backend `venv` was not on PATH for the ad-hoc pytest invocation; used `./venv/Scripts/python.exe` directly per the project's venv rule.

## User Setup Required
None - no external service configuration required. (DB migration 111 is applied by the operator in plan 165-10; assertion-level green run of these tests is plan 165-11, post-apply.)

## Next Phase Readiness
- These test files now reference the migration-111 split column names + `folder_is_org_shared`; they run green only AFTER plan 165-10 applies migration 111 and regenerates full-schema. This plan's gate was grep + `--collect-only` (both pass).
- The milestone exit gate `test_v3_4_org_isolation.py` was correctly EXCLUDED (owned by plan 165-11). `test_163_factories.py` had no `is_global` (no edit) as expected.

---
*Phase: 165-is-global-retirement-cleanup*
*Completed: 2026-07-20*

## Self-Check: PASSED
- All 15 modified test files verified (0 bare is_global, 0 folder_is_globally_visible; genuine is_system preserved).
- Commits verified in history: e6f4fd7d (Task 1), 63d2abbd (Task 2), 1abbfba4 (SUMMARY).
- SUMMARY.md present at .planning/phases/165-is-global-retirement-cleanup/165-05-SUMMARY.md.
