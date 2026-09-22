---
phase: 258-a-tier-becomes-enforceable
plan: 01
subsystem: database
tags: [postgres, asyncpg, rls, tier_capabilities, entitlements, fail_closed]

# Dependency graph
requires: []
provides:
  - "public.tier_capabilities table with compound PK (tier, capability), RLS, and seed data"
  - "Database query layer in backend/app/db/entitlements.py (get_tier_capabilities, is_capability_enabled_for_tier, resolve_org_entitlement)"
  - "Additive add_ons evaluation and strict fail-closed database handling"
  - "Unit test suite in backend/tests/unit/test_258_tier_capabilities_db.py (10/10 passed)"
affects: [258-02, 258-03, entitlement_service, workflows]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Relational capability matrix as data instead of code branches (TIER-02)"
    - "Additive override rule: organizations.add_ons grants take precedence over base tier"
    - "Strict fail-closed error handling for commercial boundary DB reads (TIER-05)"

key-files:
  created:
    - "supabase/migrations/186_tier_capabilities.sql"
    - "backend/app/db/entitlements.py"
    - "backend/tests/unit/test_258_tier_capabilities_db.py"
  modified:
    - "supabase/full-schema.sql"

key-decisions:
  - "Migration 186 creates public.tier_capabilities with compound PK (tier, capability) and RLS (D-258-02, TIER-02)."
  - "Initial seed data populates standard (basic_rag, chat), pro (+ skills, code_execution, custom_models), and enterprise (+ workflows, connectors, experts, audit_export) (D-258-07)."
  - "resolve_org_entitlement strictly fails closed on missing orgs or database errors (TIER-05, D-258-06)."
  - "organizations.add_ons allows additive overrides for standard/pro orgs (D-258-08)."

patterns-established:
  - "Capability map as data: repackaging is an INSERT/UPDATE in tier_capabilities with zero code deploy."
  - "Commercial security boundaries fail closed; contrast with worker budget timeouts that fail open."

requirements-completed: [TIER-01, TIER-02, TIER-05]

# Metrics
duration: 15min
completed: 2026-09-19
---

# Phase 258 Plan 01 Summary: Foundational Capability Matrix Schema & Database Access Layer

**Delivered the relational `public.tier_capabilities` table via Migration 186 and asyncpg data access module `backend/app/db/entitlements.py`, verified with 10 unit tests.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-09-19T22:04:00Z
- **Completed:** 2026-09-19T22:07:00Z
- **Tasks:** 4 completed
- **Files created/modified:** 4

## Accomplishments

1. **Authored & Applied Migration 186 (`supabase/migrations/186_tier_capabilities.sql`)**:
   - Created `public.tier_capabilities` with compound primary key `(tier, capability)`, index `idx_tier_capabilities_lookup`, and Row Level Security.
   - Populated standard, pro, and enterprise tiers per `D-258-07`.
   - Applied to local Postgres on port 54322 (16 rows total: 2 standard, 5 pro, 9 enterprise).
   - Regenerated `supabase/full-schema.sql` (8,165 lines).
   - Verified clean deployment sync via `bash scripts/check-deploy-drift.sh` (186 migrations in repo and applied).

2. **Implemented Database Helpers in `backend/app/db/entitlements.py`**:
   - `get_tier_capabilities(pool, tier)`: Fetches active capability set for a given tier.
   - `is_capability_enabled_for_tier(pool, tier, capability)`: Fast boolean lookup.
   - `get_minimum_tier_for_capability(pool, capability)`: Resolves lowest upgrade tier (standard -> pro -> enterprise).
   - `resolve_org_entitlement(pool, org_id, capability)`: Evaluates org subscription tier and additive `add_ons`, failing closed on missing org or DB connection failure.

3. **Authored Comprehensive Unit Tests in `backend/tests/unit/test_258_tier_capabilities_db.py`**:
   - 10/10 test cases passed covering tier matches, additive dict/list `add_ons`, missing orgs, DB errors, and invalid inputs.

## Verification

- `pytest backend/tests/unit/test_258_tier_capabilities_db.py -v` → 10 passed in 0.37s.
- Live database query test verified standard, pro, and enterprise resolution against live local Postgres.
- `scripts/check-deploy-drift.sh` → PASS (0 drift).
- `node scripts/check-hot-file-ledger.cjs 258` → OK (304 rows, 9 subject, 3 watched).
- `node scripts/check-claude-md-size.cjs` → OK (107,865 chars, 42,135 headroom).
