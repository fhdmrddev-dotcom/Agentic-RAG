---
phase: 261-an-expert-you-can-author
plan: 01
subsystem: backend / database
tags: [postgres, asyncpg, rls, expert_bundles, expert_grants, role_permissions, authoring]

# Dependency graph
requires: [PACK-01, PACK-06, PACK-08, PACK-10]
provides:
  - "public.expert_bundles presentation columns (icon, category, when_to_use, example_output, tool_floor_enabled) with widened visibility ('restricted')"
  - "public.expert_grants table with grantee_type IN ('user', 'role'), grantee_id, unique index, and RLS"
  - "public.role_permissions seeded with ('super-admin', 'experts:manage') and ('org-admin', 'experts:manage')"
  - "backend/app/models/expert.py updated with ExpertGrant, ExpertGrantCreate, and widened ExpertBundle"
  - "backend/app/db/experts.py grant CRUD and grant-aware listing functions"
  - "backend/app/api/experts.py require_expert_manage permission gate and grant endpoints"
  - "backend/tests/unit/test_261_expert_grants_db.py passing 9/9 tests covering models, CRUD, visibility, and live DB verification"
affects: [261-02, 261-03, 261-04, 261-05, experts, org-admin]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Granular access grants table (PACK-10): expert_grants targeting users and roles with compound uniqueness and RLS"
    - "Data-driven authoring permission (PACK-08): role_permissions(role, 'experts:manage') checked via require_expert_manage"
    - "Grant-aware visibility filtering: private (creator-only), org/public (org-wide), restricted (creator or granted user/role)"

key-files:
  created:
    - "supabase/migrations/189_expert_presentation_and_grants.sql"
    - "backend/tests/unit/test_261_expert_grants_db.py"
  modified:
    - "supabase/full-schema.sql"
    - "scripts/full-schema-supplement.sql"
    - "backend/app/models/expert.py"
    - "backend/app/db/experts.py"
    - "backend/app/api/experts.py"
    - "backend/app/services/expert_service.py"

key-decisions:
  - "Migration 189 extends public.expert_bundles with presentation fields (icon, category, when_to_use, example_output, tool_floor_enabled) and widens visibility to include 'restricted' (D-261-07)."
  - "Migration 189 creates public.expert_grants with RLS and table grants for authenticated and service_role (PACK-10)."
  - "Migration 189 seeds 'experts:manage' into public.role_permissions for 'super-admin' and 'org-admin' (PACK-08, D-261-03)."
  - "scripts/full-schema-supplement.sql mirrors table privileges for tier_capabilities, expert_bundles, and expert_grants (155/155 tuples mirrored, check-schema-acl-parity gate green)."
  - "backend/app/api/experts.py gates mutating actions (POST, PATCH, DELETE) and grant management via require_expert_manage."

patterns-established:
  - "Granular Access Model: Visibility 'restricted' requires a row in expert_grants for user UUID or caller role; creator always retains access."
  - "Permission Gating: All expert authoring mutations route through data-driven role_permissions checks."

requirements-completed: [PACK-07, PACK-08, PACK-10]

# Metrics
duration: 15min
completed: 2026-09-20
---

# Phase 261 Plan 01 Summary: Database Foundation & Granular Access Grants

**Delivered the database schema and models for Expert authoring and granular access grants: Migration 189 (presentation columns, expert_grants table with RLS, role_permissions seed), full-schema regeneration, models/db/api updates, and 9/9 passing tests in `test_261_expert_grants_db.py`.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-09-20T07:23:00Z
- **Completed:** 2026-09-20T07:28:00Z
- **Tasks:** 4 completed
- **Files created/modified:** 7

## Accomplishments

1. **Migration 189 Applied Locally & Seeded (PACK-08, PACK-10, D-261-07)**:
   - Added presentation columns to `public.expert_bundles`: `icon`, `category`, `when_to_use`, `example_output`, `tool_floor_enabled`.
   - Widened `visibility` check constraint to include `'restricted'`.
   - Created `public.expert_grants` table with unique constraint `(expert_id, grantee_type, grantee_id)`, lookup indices, RLS enabled, and permissions granted to `authenticated` and `service_role`.
   - Seeded `experts:manage` into `public.role_permissions` for `super-admin` and `org-admin`.
   - Backfilled first-party `financial-analyzer` with presentation fields.
   - Applied migration to local Postgres (`127.0.0.1:54322`).
   - Regenerated `supabase/full-schema.sql` and mirrored table ACLs in `scripts/full-schema-supplement.sql` (155/155 tuples mirrored).

2. **Models & DB Layer Updates (PACK-10)**:
   - Updated `backend/app/models/expert.py` with `ExpertGrant`, `ExpertGrantCreate`, presentation fields on `ExpertBundleBase`/`ExpertBundleCreate`/`ExpertBundleUpdate`, and `'restricted'` visibility.
   - Updated `backend/app/db/experts.py`:
     - Added `get_expert_grants`, `add_expert_grant`, `remove_expert_grant`, `bulk_set_expert_grants`.
     - Added `check_expert_grant_access` and grant-aware `list_expert_bundles_for_caller`.
   - Updated `backend/app/services/expert_service.py` with grant services and presentation field propagation.

3. **API Authorization & Endpoints (PACK-08, PACK-10)**:
   - Added `require_expert_manage` dependency evaluating `role_permissions(role, 'experts:manage')` via `_has_org_permission`.
   - Gated `POST /experts`, `PATCH /experts/{bundle_id}`, and `DELETE /experts/{bundle_id}` with `require_expert_manage`.
   - Added `GET /experts/{bundle_id}/grants`, `POST /experts/{bundle_id}/grants`, and `DELETE /experts/{bundle_id}/grants/{grant_id}` endpoints.

4. **Testing & Verification**:
   - Authored `backend/tests/unit/test_261_expert_grants_db.py`: 9/9 tests passed covering Pydantic validation, mock DB operations, live Postgres presentation fields, grants CRUD/uniqueness, and role permission query.
   - Regression suites (`test_259_expert_bundles_db.py`, `test_259_closed_core_inventory.py`, `test_260_financial_analyzer_conversation.py`): 24/24 passed.
   - Schema ACL parity gate: `node scripts/check-schema-acl-parity.cjs` passed (155/155 mirrored).
   - Hot-file ledger gate: OK (316 rows).
   - Seeds register gate: OK (310/310 parsed).
   - Size gate: OK (108,921 chars).

## Self-Check & Verification

- `pytest backend/tests/unit/test_261_expert_grants_db.py`: 9 passed
- `node scripts/check-schema-acl-parity.cjs`: OK (155/155 mirrored)
- `node scripts/check-hot-file-ledger.cjs 261`: ledger gate OK
