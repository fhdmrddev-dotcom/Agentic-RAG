---
phase: 259-an-expert-is-a-bundle-not-a-runtime
plan: 01
subsystem: database
tags: [postgres, asyncpg, rls, expert_bundles, seed, financial_analyzer]

# Dependency graph
requires: []
provides:
  - "public.expert_bundles table with partial unique indexes, RLS, and Financial Analyzer seed"
  - "Pydantic domain schemas in backend/app/models/expert.py (ExpertBundle, ExpertBundleCreate, ExpertBundleUpdate, PromptSuggestion)"
  - "Database access layer in backend/app/db/experts.py (create, read by id/slug, list, update, delete with tenant segregation)"
  - "Unit and live Postgres test suite in backend/tests/unit/test_259_expert_bundles_db.py (11/11 passed)"
affects: [259-02, 259-03, expert_service, chat]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Expert as pure data manifest over skills, connections, folders, and prompts (PACK-01, EXT-01 Red Line)"
    - "Partial unique indexes for global system slugs vs tenant-scoped custom slugs (D-259-03)"
    - "System template immutability in database access helpers (D-259-08)"

key-files:
  created:
    - "supabase/migrations/187_expert_bundles.sql"
    - "backend/app/models/expert.py"
    - "backend/app/db/experts.py"
    - "backend/tests/unit/test_259_expert_bundles_db.py"
  modified:
    - "supabase/full-schema.sql"

key-decisions:
  - "Migration 187 creates public.expert_bundles with structured member columns, scope_mode ('restricted' | 'biased'), and prompt_suggestions jsonb (D-259-01, D-259-03, PACK-01)."
  - "First-party Financial Analyzer template seeded with UUID 00000000-0000-0000-0000-000000000259, is_system=true, and 3 starter prompts (D-259-07, PACK-05)."
  - "Database access module backend/app/db/experts.py enforces caller tenant org isolation and refuses mutating system templates (D-259-03, D-259-08)."

patterns-established:
  - "Experts are rows, not runtimes: no table or column encodes an executor or dispatch hook."
  - "Tenancy isolation at storage: custom bundles belong to org_id; system templates have org_id=NULL and is_system=true."

requirements-completed: [PACK-01]

# Metrics
duration: 12min
completed: 2026-09-19
---

# Phase 259 Plan 01 Summary: Foundational Expert Bundles Schema & Database Access Layer

**Delivered the relational `public.expert_bundles` table via Migration 187, Pydantic domain models in `backend/app/models/expert.py`, and asyncpg data access module `backend/app/db/experts.py`, verified with 11 unit and live database tests.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-09-19T23:44:00Z
- **Completed:** 2026-09-19T23:47:00Z
- **Tasks:** 4 completed
- **Files created/modified:** 5

## Accomplishments

1. **Migration 187 (`supabase/migrations/187_expert_bundles.sql`)**:
   - Created `public.expert_bundles` table storing name, slug, description, `scope_mode`, `member_skills`, `required_connections`, `knowledge_folder_ids`, `prompt_suggestions`, `visibility`, `is_system`, `is_enabled`, and timestamps.
   - Partial unique indexes for system bundle slugs (`idx_expert_bundles_system_slug`) and tenant bundle slugs (`idx_expert_bundles_org_slug`).
   - Row-level security policies (`expert_bundles_read_policy` and `expert_bundles_write_policy`) ensuring tenant data segregation.
   - Seeded the first-party Financial Analyzer expert (`00000000-0000-0000-0000-000000000259`) with 3 structured prompt suggestions.
   - Applied to local Postgres on port 54322 and regenerated `supabase/full-schema.sql` (8,367 lines).

2. **Domain Models (`backend/app/models/expert.py`)**:
   - Authored `PromptSuggestion`, `ExpertBundleBase`, `ExpertBundleCreate`, `ExpertBundleUpdate`, and `ExpertBundle` Pydantic models with strict validation on `scope_mode` (`restricted` | `biased`) and `visibility` (`private` | `org` | `public`).

3. **Database Access Layer (`backend/app/db/experts.py`)**:
   - Authored asyncpg helpers: `create_expert_bundle`, `get_expert_bundle_by_id`, `get_expert_bundle_by_slug`, `list_expert_bundles`, `update_expert_bundle`, and `delete_expert_bundle`.
   - Enforces tenant boundary isolation and system bundle immutability.

4. **Verification Suite (`backend/tests/unit/test_259_expert_bundles_db.py`)**:
   - 11 unit and live database integration tests passing 100% in 1.81s.

## Verification

```bash
pytest backend/tests/unit/test_259_expert_bundles_db.py
# 11 passed, 13 warnings in 1.81s
node scripts/check-hot-file-ledger.cjs 259
# ledger gate OK — every watched file has a row.
```
