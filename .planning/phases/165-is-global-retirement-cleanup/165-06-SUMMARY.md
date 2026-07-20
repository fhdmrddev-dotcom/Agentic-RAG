---
phase: 165-is-global-retirement-cleanup
plan: 06
subsystem: testing
tags: [is_org_shared, is_system, skills, folders, rename, mig-111, pytest]

# Dependency graph
requires:
  - phase: 165 (plans 02/03)
    provides: renamed is_org_shared column/field on folders + skills (mig 111 + model/API)
provides:
  - "Skills/folders backend test surface referencing is_org_shared (formerly is_global)"
  - "MIG-02 rename-regression coverage for the skills/folders test domain"
  - "Proof-by-construction that no is_system_global crept into skills/folders tests (single-target)"
affects: [165-10 (migration apply), 165-11 (post-migration assertion-green gate)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Domain-grouped single-target rename: grouping tests by owning table (folders/skills) eliminates the is_org_shared-vs-is_system_global cross-target misclassification risk"

key-files:
  created:
    - .planning/phases/165-is-global-retirement-cleanup/165-06-SUMMARY.md
  modified:
    - backend/tests/integration/test_123_1_tuner_runs_timestamp.py
    - backend/tests/integration/test_132_skill_versions.py
    - backend/tests/integration/test_132_test_cases.py
    - backend/tests/integration/test_137_2_skill_creator_seed_content.py
    - backend/tests/integration/test_140_escape_hatch.py
    - backend/tests/integration/test_skill_tuner_routes.py
    - backend/tests/integration/test_skills.py
    - backend/tests/integration/test_skills_import_export.py
    - backend/tests/integration/test_skills_lint.py
    - backend/tests/test_139_migration_090.py
    - backend/tests/test_load_skill_collision.py
    - backend/tests/test_publish_gate.py
    - backend/tests/unit/test_142_load_skill_flag.py
    - backend/tests/unit/test_151_attach_handler.py
    - backend/tests/unit/test_skill_tuner_service.py
    - backend/tests/integration/test_folders.py
    - backend/tests/integration/test_kb.py
    - backend/tests/integration/test_118_accept.py
    - backend/tests/integration/test_118_dismiss_undo.py

key-decisions:
  - "D-165-01: every is_global literal in these skills/folders-domain tests renamed to is_org_shared (single target — no is_system_global here)"
  - "D-165-02: skills.is_system literals preserved verbatim (skill-creator seed, load-skill collision tie-break, attach-handler owner check, load-skill flag)"
  - "Reworded the test_load_skill_collision.py line-9 annotation instead of blind token-replacing it (a blind replace produced the nonsensical 'is_org_shared RENAMED -> is_org_shared')"

patterns-established:
  - "Pattern: verified-safe bulk token substitution — Grep-confirm every occurrence's owning-table context + confirm no substring collisions (is_globally / is_system_global) BEFORE applying a global rename, then Grep-verify the result"

requirements-completed: [MIG-02]

# Metrics
duration: 6min
completed: 2026-07-20
---

# Phase 165 Plan 06: Skills/Folders Test `is_global` -> `is_org_shared` Rename Summary

**Renamed the `is_global` share-flag literal to `is_org_shared` across all 19 skills/folders-domain backend tests (raw SQL, model kwargs, dict-key assertions, PostgREST `.or_()` filters), preserving `skills.is_system` and introducing zero `is_system_global` — the MIG-02 rename-regression coverage for the skills/folders test surface.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-07-20T21:48:11Z
- **Completed:** 2026-07-20T21:53:58Z
- **Tasks:** 2
- **Files modified:** 19

## Accomplishments
- Zero bare `is_global` remaining across all 19 plan files (final sweep = 0).
- `skills.is_system` preserved exactly — counts unchanged vs HEAD in the four `is_system` tests (collision=8, 137_2=6, 142_load_skill_flag=1, 151_attach_handler=7).
- Zero `is_system_global` introduced anywhere — single-target proof that no cross-target (workflow/view/rule/metadata) literal was mis-renamed.
- `--collect-only` clean on both sampled gates: skills subset 31 tests (exit 0), folders subset 50 tests (exit 0).

## Task Commits

Each task was committed atomically:

1. **Task 1: Rename the skills-domain tests (integration + root + unit)** — `5686db61` (test) — 15 files
2. **Task 2: Rename the folders-domain tests** — `105daf77` (test) — 4 files

**Plan metadata:** (this SUMMARY commit)

## Files Created/Modified
- 15 skills-domain tests (`test_skills.py`, `test_publish_gate.py`, `test_skill_tuner_routes.py`, `test_skill_tuner_service.py`, `test_132_skill_versions.py`, `test_132_test_cases.py`, `test_137_2_skill_creator_seed_content.py`, `test_140_escape_hatch.py`, `test_123_1_tuner_runs_timestamp.py`, `test_skills_import_export.py`, `test_skills_lint.py`, `test_139_migration_090.py`, `test_load_skill_collision.py`, `test_142_load_skill_flag.py`, `test_151_attach_handler.py`) — `is_global` -> `is_org_shared`; `is_system` untouched.
- 4 folders-domain tests (`test_folders.py`, `test_kb.py`, `test_118_accept.py`, `test_118_dismiss_undo.py`) — `is_global` -> `is_org_shared` on the `public.folders` literals + folder dict keys + move-target assertions.
- `165-06-SUMMARY.md` — this summary.

## Decisions Made
- Reworded the `test_load_skill_collision.py` line-9 annotation ("skills.is_global RENAMED -> is_org_shared") to "the skills share-flag column is now is_org_shared" rather than blind-replacing the token, which would have produced the meaningless "is_org_shared RENAMED -> is_org_shared". The file's code paths were already on `is_org_shared`; only this explanatory comment held the stale token.

## Deviations from Plan

None - plan executed exactly as written.

The guard (STOP if any file contained a workflow/view/rule/metadata `is_global` literal) did NOT trip: Grep confirmed all 105 original occurrences were `public.folders` / `public.skills` literals, and `folder_is_globally_visible` appears only in `test_v3_4_org_isolation.py` (not one of this plan's 19 files), so there were no substring-collision risks for the global token rename.

## Issues Encountered
None. The `--collect-only` gates surfaced only a benign pre-existing `RequestsDependencyWarning` (urllib3/chardet version mismatch in the venv), unrelated to this rename; both gates still exited 0.

## Platform-table cross-check (per critical_project_rules)
No file in this plan references `workflow_definitions`, `document_views`, `classification_rules`, or `metadata_field_definitions`. The single-target assumption held: every rename mapped `is_global` -> `is_org_shared`; no `is_system_global` was introduced. Nothing to flag for plan 07.

## Note on assertion-level green (dev_server_note)
This plan's gate is grep + `--collect-only` only. Migration 111 is NOT yet applied (lands in plan 165-10); assertion-level green against the renamed columns is plan 165-11 (post-apply). The DB was not touched.

## Next Phase Readiness
- The skills/folders test surface now references `is_org_shared`, aligned with mig-111's renamed columns — ready for the post-migration assertion-green sweep in plan 165-11.
- No blockers. No migration/DB action taken by this plan.

## Self-Check: PASSED

- `165-06-SUMMARY.md` exists on disk. ✓
- Commits verified present in `git log`: `5686db61` (Task 1), `105daf77` (Task 2), `603d3e4c` (SUMMARY). ✓
- Committed state: 0 bare `is_global` across all 19 plan files; `is_system` preserved; 0 `is_system_global`. ✓

---
*Phase: 165-is-global-retirement-cleanup*
*Completed: 2026-07-20*
