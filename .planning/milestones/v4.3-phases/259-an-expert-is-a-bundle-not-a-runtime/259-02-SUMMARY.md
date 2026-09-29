---
phase: 259-an-expert-is-a-bundle-not-a-runtime
plan: 02
subsystem: services
tags: [expert_service, tenancy, isolation, member_boundary, seed_125, red_drive]

# Dependency graph
requires: [259-01]
provides:
  - "Canonical expert service layer in backend/app/services/expert_service.py"
  - "Two-phase member boundary evaluation (resolve_expert_bundle) enforcing PACK-04 and SEED-125 tenancy isolation"
  - "Audit warning logging (EXPERT_MEMBER_CROSS_ORG_STRIPPED) on foreign or unconfigured member references"
  - "Unit test suite in backend/tests/unit/test_259_expert_member_isolation.py (6/6 passed)"
  - "Non-vacuous test failure verified against planted bypass and restored md5-identical (5b0de3ddfed5516de94ab8a996faaa36)"
affects: [259-03, api/experts, chat]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-phase member resolution: RLS on bundle row is necessary but NOT sufficient; members evaluated on their own merits"
    - "Silent stripping with audit warning: foreign members are omitted from runtime scope rather than crashing the turn"

key-files:
  created:
    - "backend/app/services/expert_service.py"
    - "backend/tests/unit/test_259_expert_member_isolation.py"
  modified: []

key-decisions:
  - "resolve_expert_bundle independently checks member skills, knowledge folders, and connections against caller_org_id (D-259-04, PACK-04)."
  - "A cross-org skill or folder reference is stripped and logged with EXPERT_MEMBER_CROSS_ORG_STRIPPED, preventing SEED-125 data leakage (D-259-04)."
  - "Non-vacuity proven by planting an effective_skills = list(raw_skills) bypass, driving test_resolve_strips_foreign_skill_seed_125 RED, then restoring md5-clean."

patterns-established:
  - "Bundle member boundary scrubbing: referencing an asset from another tenant never grants access to it."
  - "RED-driven tenancy tests: non-vacuous assertion that foreign assets are purged from the returned payload."

requirements-completed: [PACK-04]

# Metrics
duration: 10min
completed: 2026-09-19
---

# Phase 259 Plan 02 Summary: Tenancy Defense & Member Boundary Scrubbing

**Delivered the business logic and tenancy defense layer (`backend/app/services/expert_service.py`) with two-phase member boundary evaluation (`resolve_expert_bundle`), verified with 6 unit tests driven RED against a planted bypass and restored md5-identical.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-09-19T23:47:00Z
- **Completed:** 2026-09-19T23:50:00Z
- **Tasks:** 2 completed
- **Files created/modified:** 2

## Accomplishments

1. **Expert Service Layer (`backend/app/services/expert_service.py`)**:
   - Implemented `ResolvedExpertBundle` Pydantic model with fields for effective skills, folders, connections, and stripped member telemetry.
   - Implemented CRUD service wrappers (`create_expert_service`, `get_expert_service`, `list_experts_service`, `update_expert_service`, `delete_expert_service`).
   - Implemented two-phase resolution (`resolve_expert_bundle`):
     - Phase 1: Verifies bundle exists and is accessible under tenant boundaries (is_system or org_id match).
     - Phase 2: Evaluates every member independently against caller org tenancy:
       - Skills must be system or belonging to caller's org/user.
       - Knowledge folders must belong to caller's org.
       - Connections must be active in caller's org.
     - Stripped members are purged and logged with `EXPERT_MEMBER_CROSS_ORG_STRIPPED`.

2. **Isolation Test Suite (`backend/tests/unit/test_259_expert_member_isolation.py`)**:
   - 6 test cases verifying legitimate bundle resolution, cross-org skill scrubbing (SEED-125), cross-org folder scrubbing, unconfigured connection stripping, inaccessible bundle refusal, and CRUD operations.
   - Non-vacuous test failure verified by planting an unconstrained bypass in `expert_service.py` (`effective_skills = list(raw_skills)`), driving `test_resolve_strips_foreign_skill_seed_125` RED with an explicit `AssertionError`, then restoring the clean code and verifying md5 hash integrity (`5b0de3ddfed5516de94ab8a996faaa36`).

## Verification

```bash
pytest backend/tests/unit/test_259_expert_member_isolation.py
# 6 passed, 13 warnings in 0.49s
node scripts/check-hot-file-ledger.cjs 259
# ledger gate OK — every watched file has a row.
```
