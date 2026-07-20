---
phase: 165-is-global-retirement-cleanup
plan: 07
subsystem: testing
tags: [pytest, multi-tenancy, is_system_global, is_org_shared, rls, workflow_definitions, metadata_field_definitions, document_views, classification_rules]

# Dependency graph
requires:
  - phase: 165 (plan 03)
    provides: backend model/API rename (metadata_field/document_view/classification_rule models -> is_system_global)
  - phase: 165 (plan 04)
    provides: service/db rename (app/db/workflows.py, publish/metadata/view/rule services -> is_system_global)
provides:
  - Platform-table backend test surface renamed is_global -> is_system_global (workflow_definitions / document_views / classification_rules / metadata_field_definitions)
  - The two test_118_ingest_* folders-literal exceptions correctly split to is_org_shared while their rules literals go is_system_global
  - The 15-workflow universal seed assertions preserved at is_system_global=true (D-165-03 / T-165-31)
affects: [165 (plan 10 migration 111 apply), 165 (plan 11 exit-gate re-green)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Semantic-split token rename: per-file target chosen by the OWNING table (4 platform tables -> is_system_global; folders -> is_org_shared), never a blanket rename"
    - "Mixed-file two-pass edit: rename the folders literal to is_org_shared FIRST, then replace_all remaining is_global -> is_system_global so the folders row is not swept into the platform target"

key-files:
  created: []
  modified:
    - backend/tests/integration/test_110_dm_schema.py
    - backend/tests/integration/test_111_field_def_scoping.py
    - backend/tests/integration/test_111_metadata_fields_crud.py
    - backend/tests/integration/test_112_custom_field_patch.py
    - backend/tests/integration/test_113_view_crud.py
    - backend/tests/integration/test_114_resolve_adhoc.py
    - backend/tests/integration/test_115_saved_view_run.py
    - backend/tests/integration/test_118_rule_crud.py
    - backend/tests/integration/test_118_rule_leak.py
    - backend/tests/integration/test_118_ingest_real_splice.py
    - backend/tests/integration/test_118_ingest_suggest.py
    - backend/tests/integration/test_workflows_routes.py
    - backend/tests/test_152_delete_cascade.py
    - backend/tests/test_dual_mode_wiring.py
    - backend/tests/test_harness_templates.py
    - backend/tests/test_thread_workflow_endpoint.py
    - backend/tests/unit/test_103_draft_crud.py
    - backend/tests/unit/test_103_published_409.py
    - backend/tests/unit/test_111_metadata_field_model.py
    - backend/tests/unit/test_113_view_service_guards.py
    - backend/tests/unit/test_118_rule_validation.py
    - backend/tests/unit/test_publish_service.py
    - backend/tests/unit/test_starter_workflows.py
    - backend/tests/fixtures/seed_library_asset.py
    - backend/tests/fixtures/seed_llm_emit_fixture.py

key-decisions:
  - "Dominant target is_system_global for all 25 files; the ONLY is_org_shared exceptions are the folders INSERT literals in the two test_118_ingest_* files (per-occurrence table read, not blanket rename)"
  - "Left the uppercase Python identifier _IS_GLOBAL_TABLES in test_110_dm_schema.py unchanged — it is a test-internal set name, not a column literal, and does not match the case-sensitive is_global gate"

patterns-established:
  - "Substring-trap guard: verified no is_globally / folder_is_globally_visible token exists in the 25 target files before bulk replace_all on the bare is_global token"

requirements-completed: [MIG-02]

# Metrics
duration: ~18min
completed: 2026-07-21
---

# Phase 165 Plan 07: Platform-Table Test Rename (is_global -> is_system_global) Summary

**Renamed `is_global` to `is_system_global` across the 25 platform-table backend tests (workflow_definitions / document_views / classification_rules / metadata_field_definitions), splitting the two `test_118_ingest_*` folders literals to `is_org_shared`, keeping the 15-workflow universal seed at `is_system_global=true`; all three sampled `--collect-only` gates clean.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-07-21
- **Completed:** 2026-07-21
- **Tasks:** 3
- **Files modified:** 25 (23 test files + 2 fixtures)

## Accomplishments
- Task 1: 9 DM metadata + views tests renamed to `is_system_global` (metadata_field_definitions / document_views).
- Task 2: 5 classification-rule tests renamed; the two `test_118_ingest_*` files correctly split — folders INSERT literal -> `is_org_shared`, classification_rules literal -> `is_system_global` (T-165-32 mitigated by per-occurrence table read).
- Task 3: 11 workflow/eval/harness tests + fixtures renamed to `is_system_global`; the `test_starter_workflows.py` seed values stayed `is_system_global=True` (D-165-03 / T-165-31 — the 15 platform workflows stay cross-org by construction, no value movement).
- Final grep: 0 bare `is_global` across all 25 plan files (remaining matches live only in `test_v3_4_org_isolation.py`, the Plan 11 exit gate, out of this plan's scope).
- Full `--collect-only` across all plan files: 194 tests collected, exit 0.

## Task Commits

Each task was committed atomically:

1. **Task 1: Rename the DM metadata + views tests** - `304e267a` (test)
2. **Task 2: Rename the classification-rule tests (folders exceptions flagged)** - `67a66982` (test)
3. **Task 3: Rename the workflow/eval/harness tests + fixtures** - `c0159d6d` (test)

## Files Created/Modified

**Task 1 (metadata_field_definitions / document_views -> is_system_global):**
- `backend/tests/integration/test_110_dm_schema.py` - RLS SELECT-policy shape assertions (3 library tables) + global-field visibility live test
- `backend/tests/integration/test_111_field_def_scoping.py` - 2-user scoped-read predicate `(user_id = $1 OR is_system_global = true)`
- `backend/tests/integration/test_111_metadata_fields_crud.py` - CRUD force-owner / force-not-global create path
- `backend/tests/integration/test_112_custom_field_patch.py` - metadata field def seed
- `backend/tests/integration/test_113_view_crud.py` - view create hard-sets is_system_global=false
- `backend/tests/integration/test_114_resolve_adhoc.py` - enabled custom field def seed
- `backend/tests/integration/test_115_saved_view_run.py` - document_views seed
- `backend/tests/unit/test_111_metadata_field_model.py` - MetadataFieldResponse default assertion
- `backend/tests/unit/test_113_view_service_guards.py` - `.or_()` grammar-breakout guard string

**Task 2 (classification_rules -> is_system_global; folders -> is_org_shared):**
- `backend/tests/integration/test_118_rule_crud.py` - create hard-sets is_system_global=false (test fn renamed too)
- `backend/tests/integration/test_118_rule_leak.py` - own+global leak-safe read predicate + ordering
- `backend/tests/integration/test_118_ingest_real_splice.py` - MIXED: 2 folders literals -> is_org_shared, 2 rules literals -> is_system_global
- `backend/tests/integration/test_118_ingest_suggest.py` - MIXED: folders literal -> is_org_shared, rules INSERT + `.or_`/`.order` -> is_system_global
- `backend/tests/unit/test_118_rule_validation.py` - RuleResponse shape/default assertions

**Task 3 (workflow_definitions -> is_system_global):**
- `backend/tests/integration/test_workflows_routes.py` - published-insert helper
- `backend/tests/test_152_delete_cascade.py` - `_seed_definition` + WR-01 global cascade test
- `backend/tests/test_dual_mode_wiring.py` - picker-feed SQL assertion `is_system_global = true OR created_by = $1` + row dicts
- `backend/tests/test_harness_templates.py` - mig-061 seed comments (assertion counts `true` flags, unaffected by column name)
- `backend/tests/test_thread_workflow_endpoint.py` - JSONB-scope SQL predicate assertion
- `backend/tests/unit/test_103_draft_crud.py` - create-draft docstring
- `backend/tests/unit/test_103_published_409.py` - published-freeze INSERT
- `backend/tests/unit/test_publish_service.py` - owner-only-for-drafts SQL predicate assertions
- `backend/tests/unit/test_starter_workflows.py` - starter seed INSERT + True/False seeds (True preserved)
- `backend/tests/fixtures/seed_library_asset.py` - library-asset workflow seed
- `backend/tests/fixtures/seed_llm_emit_fixture.py` - llm-emit workflow seed

## Decisions Made
- **Per-occurrence table read on the two mixed ingest files.** The folders `INSERT` literal was renamed to `is_org_shared` in a dedicated first-pass edit, THEN the remaining `is_global` (all classification_rules) swept to `is_system_global` — guaranteeing the folders row is never mis-targeted (T-165-32).
- **Left `_IS_GLOBAL_TABLES` (uppercase) untouched** in `test_110_dm_schema.py`: it is a Python set identifier naming the tables that carry the flag, not a column literal, and the case-sensitive `grep -c "is_global"` gate reads 0 with it in place. Column literals inside the file are all renamed.
- **Value-preserving rename only.** No seed value was changed; `test_starter_workflows.py` retains `is_system_global=True` at both seed sites (D-165-03).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. The bare-token substring trap (`is_global` as a prefix of `is_globally` / `folder_is_globally_visible`) was checked upfront — no such token exists in any of the 25 target files (the only "globally" occurrence is the standalone word in a comment in `test_118_ingest_real_splice.py`), so `replace_all` on `is_global` was safe for the 23 uniform files.

## User Setup Required
None - no external service configuration required. NOTE: migration 111 (the live `RENAME COLUMN`) is applied by Plan 10 (operator SQL-editor apply). These tests reference the renamed columns; assertion-level green is Plan 11 post-apply. This plan's gate is grep + `--collect-only` only.

## Next Phase Readiness
- Platform-table test surface is rename-consistent with the plan-03/04 backend renames.
- Plan 10 must apply migration 111 (RENAME COLUMN x6 + policy/DEFINER-fn rewrite) and regenerate full-schema before these tests can run assertion-green.
- Plan 11 re-greens `test_v3_4_org_isolation.py` (the last file still holding live `is_global` literals — intentionally out of scope here).

---
*Phase: 165-is-global-retirement-cleanup*
*Completed: 2026-07-21*
