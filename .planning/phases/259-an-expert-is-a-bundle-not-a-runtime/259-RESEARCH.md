# Phase 259: An Expert Is a Bundle, Not a Runtime — Research

**Researched:** 2026-09-19  
**Domain:** Domain Bundles / Manifest Schema / Relational Data Model / Multi-Tenancy Isolation / Entitlement Gating / Closed Core Invariants  
**Confidence:** HIGH on schema design, asyncpg DB layer, tenant member boundary checks (SEED-125 defense), AST inventory verification, and entitlement wiring.  
**Measured at:** `git HEAD = f7f9ea50c` on `develop`.

---

<user_constraints>
## User Constraints (from 259-CONTEXT.md)

### Locked Decisions — D-259-01 … D-259-08

- **D-259-01 (Scope Semantics / Operator Decision #3)**: Declared posture per Expert (`scope_mode: 'restricted' | 'biased'`). Defaults to `'restricted'` for high-governance domains (e.g. Financial Analyzer where out-of-scope tools and docs are refused under Phase 185 graded governance), while permitting `'biased'` for general assistant personas that prioritize member assets while retaining baseline agent capabilities.
- **D-259-02 (Thread Concurrency / Operator Decision #4)**: Strict single active expert per thread (`threads.expert_id uuid REFERENCES expert_bundles(id)`). Multiple concurrent active experts on a single thread are refused, preventing prompt bloat, tool collision, and ambiguous audit attribution.
- **D-259-03 (Relational Core Table with Structured Arrays/JSONB)**: Migration 187 creates `public.expert_bundles` with `name`, `slug`, `description`, `scope_mode`, `member_skills text[]`, `required_connections text[]`, `knowledge_folder_ids uuid[]`, `prompt_suggestions jsonb`, `visibility`, `is_system`, `org_id`, and `created_by` with RLS.
- **D-259-04 (Two-Phase Member Boundary Check / PACK-04)**: Resolving an Expert verifies the bundle row under RLS, then independently evaluates each referenced skill, connection, and folder against caller's active `org_id` (or `is_system=true`). Foreign member references are stripped and audited (`EXPERT_MEMBER_CROSS_ORG_STRIPPED`), never returned to runtime. Driven RED against a planted foreign member reference.
- **D-259-05 (Single-Home Entitlement Gating / PACK-06)**: All Expert endpoints (`POST /experts`, `GET /experts`, `GET /experts/{id}`, `PATCH /experts/{id}`, `DELETE /experts/{id}`) are guarded with `Depends(require_capability('experts'))`. Standard orgs receive structured HTTP 403 naming required tier (`enterprise`) and upgrade hint.
- **D-259-06 (Closed-Core Invariant Test / PACK-01 & EXT-01 Red Line)**: AST test `test_259_closed_core_inventory.py` verifies that executor, emitter, dispatcher, and agent-loop inventories remain closed and byte-for-byte unchanged from the base commit.
- **D-259-07 (First-Party Builtin Seeding)**: Migration 187 seeds "Financial Analyzer" (`is_system = true`, `slug = 'financial-analyzer'`, `scope_mode = 'restricted'`) with domain starter prompt suggestions ready for the Phase 260 proof slice.
- **D-259-08 (Dual Support for Authoring and Installation / Operator Decision #5)**: System experts (`is_system = true`, `visibility = 'public'`) are shared read-only across tenants; custom experts are authored per-org (`is_system = false`, `org_id = caller_org_id`).

### Out of Scope
- Thread selection and chat execution runtime (`PACK-02`, `PACK-03`, `PACK-05` — Phase 260).
- Frontend chat UI, picker modal, and onboarding chips (Phase 260).
- New agent runtimes, secondary loops, or custom dispatchers (strictly forbidden by `EXT-01` and Red Line `v3.6 D-14`).
- Third-party persona library import / crawler (`SEED-244` / agency-agents — deferred).

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description (REQUIREMENTS.md) | Research Support |
|---|---|---|
| **PACK-01** | An Expert is a bundle row — name, description, member skills, required connections, knowledge scope, prompt suggestions, visibility — and **nothing executes it**. The existing agent loop executes; the Expert only decides what is in scope. | §1 Schema & Migration 187, §2 Model & DB Access Layer, §6 AST Inventory Fence (`test_259_closed_core_inventory.py`). |
| **PACK-04** | RLS applies to the **bundle AND to every member**, and the member check is **not** skipped because the bundle passed. `SEED-125` was a **real** cross-org skill leak, and a bundle can leak a *folder reference* even when every skill in it is clean. | §4 Two-Phase Member Boundary Check, §5 Security Audit & Multi-Org Isolation Tests (`test_259_expert_member_isolation.py`). |
| **PACK-06** | An Expert is gated by `TIER-01`. This is what makes a pack a SKU rather than a folder anyone can copy, and it is why `TIER-*` sequences before `PACK-*`. | §3 Entitlement Gating via Phase 258 `entitlement_service.py` (`require_capability('experts')`). |

</phase_requirements>

---

## Technical Investigations & Architectural Seams

### 1. Database Schema & Migration 187 (`supabase/migrations/187_expert_bundles.sql`)

- **Table**: `public.expert_bundles`
  ```sql
  CREATE TABLE public.expert_bundles (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
      created_by uuid NOT NULL,
      name text NOT NULL,
      slug text NOT NULL,
      description text NOT NULL DEFAULT '',
      scope_mode text NOT NULL DEFAULT 'restricted' CHECK (scope_mode IN ('restricted', 'biased')),
      member_skills text[] NOT NULL DEFAULT '{}',
      required_connections text[] NOT NULL DEFAULT '{}',
      knowledge_folder_ids uuid[] NOT NULL DEFAULT '{}',
      prompt_suggestions jsonb NOT NULL DEFAULT '[]'::jsonb,
      visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'org', 'public')),
      is_system boolean NOT NULL DEFAULT false,
      is_enabled boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT check_org_or_system CHECK (is_system = true OR org_id IS NOT NULL)
  );
  ```
- **Indexes**:
  - `idx_expert_bundles_system_slug`: `CREATE UNIQUE INDEX idx_expert_bundles_system_slug ON public.expert_bundles (slug) WHERE is_system = true;`
  - `idx_expert_bundles_org_slug`: `CREATE UNIQUE INDEX idx_expert_bundles_org_slug ON public.expert_bundles (org_id, slug) WHERE is_system = false;`
  - `idx_expert_bundles_org_enabled`: `CREATE INDEX idx_expert_bundles_org_enabled ON public.expert_bundles (org_id, is_enabled);`
- **Row-Level Security (RLS)**:
  - `ALTER TABLE public.expert_bundles ENABLE ROW LEVEL SECURITY;`
  - `SELECT`:
    ```sql
    CREATE POLICY expert_bundles_read_policy ON public.expert_bundles
    FOR SELECT
    USING (
        is_system = true
        OR (
            org_id IN (SELECT om.org_id FROM public.org_members om WHERE om.user_id = auth.uid())
            AND (
                visibility = 'org'
                OR visibility = 'public'
                OR created_by = auth.uid()
            )
        )
    );
    ```
  - `INSERT / UPDATE / DELETE`:
    ```sql
    CREATE POLICY expert_bundles_write_policy ON public.expert_bundles
    FOR ALL
    USING (
        is_system = false
        AND org_id IN (SELECT om.org_id FROM public.org_members om WHERE om.user_id = auth.uid())
    );
    ```
- **Seed Row (First-Party Financial Analyzer)**:
  ```sql
  INSERT INTO public.expert_bundles (
      id,
      org_id,
      created_by,
      name,
      slug,
      description,
      scope_mode,
      member_skills,
      required_connections,
      knowledge_folder_ids,
      prompt_suggestions,
      visibility,
      is_system,
      is_enabled
  ) VALUES (
      '00000000-0000-0000-0000-000000000259'::uuid,
      NULL,
      '00000000-0000-0000-0000-000000000001'::uuid,
      'Financial Analyzer',
      'financial-analyzer',
      'Analyzes balance sheets, cash flow statements, revenue performance, and financial disclosures with strict document grounding.',
      'restricted',
      ARRAY[]::text[],
      ARRAY[]::text[],
      ARRAY[]::uuid[],
      '[{"title": "Quarterly Cash Flow", "prompt": "Summarize quarterly operating cash flows and capital expenditures from the financial reports."}, {"title": "Variance Analysis", "prompt": "Identify and explain material budget vs actual variances across key expense categories."}, {"title": "Revenue & Margin Trends", "prompt": "Analyze year-over-year revenue growth trends, gross margins, and EBITDA performance."}]'::jsonb,
      'public',
      true,
      true
  ) ON CONFLICT (slug) WHERE is_system = true DO NOTHING;
  ```

### 2. Database Access Layer (`backend/app/db/experts.py`)

Asyncpg helpers using SQL parameterized queries:
- `create_expert_bundle(pool, ...)`: Inserts new expert bundle with slug validation.
- `get_expert_bundle_by_id(pool, bundle_id, caller_org_id)`: Fetches bundle row verifying org accessibility (`is_system = true OR org_id = caller_org_id`).
- `get_expert_bundle_by_slug(pool, slug, caller_org_id)`: Fetches bundle by slug.
- `list_expert_bundles(pool, caller_org_id, include_system=True)`: Lists all accessible bundles for an org (system templates + org-owned bundles).
- `update_expert_bundle(pool, bundle_id, caller_org_id, **updates)`: Updates non-system bundle owned by `caller_org_id`.
- `delete_expert_bundle(pool, bundle_id, caller_org_id)`: Deletes non-system bundle owned by `caller_org_id`.

### 3. Entitlement Integration (`PACK-06`)

In Phase 258, `tier_capabilities` was seeded with `experts` under `enterprise` tier.
In `backend/app/api/experts.py`:
```python
from app.services.entitlement_service import require_capability

router = APIRouter(
    prefix="/experts",
    tags=["experts"],
    dependencies=[Depends(require_capability("experts"))],
)
```
- A Standard or Pro org requesting `/experts` routes receives:
  ```json
  {
    "detail": "Capability 'experts' requires 'enterprise' tier (current tier: 'standard')",
    "error": "entitlement_required",
    "capability": "experts",
    "required_tier": "enterprise",
    "current_tier": "standard",
    "upgrade_hint": "Upgrade to Enterprise to create and utilize domain expert bundles."
  }
  ```
- Complies strictly with `TIER-04`: zero ad-hoc reads of `subscription_tier`, zero duplicate checks.

### 4. Tenancy Defense: Two-Phase Member Boundary Check (`PACK-04` / `SEED-125`)

`SEED-125` demonstrated that resolving resources via service-role / bypass-RLS connections without an explicit tenant org check can leak foreign org data.
Even if an Expert bundle itself is accessible (e.g. `is_system = true` or org-shared), its member references must be scrubbed:
In `backend/app/services/expert_service.py::resolve_expert_bundle(pool, bundle_id, caller_org_id, user_id)`:
1. Fetch bundle row via `get_expert_bundle_by_id(pool, bundle_id, caller_org_id)`. If None -> 404.
2. Evaluate `member_skills`:
   - Query DB for each skill in `member_skills`.
   - Keep only skills where `is_system = true` OR `(org_id == caller_org_id AND (user_id == caller OR is_org_shared == true))`.
   - If any skill belongs to another org, omit it from `effective_skills` and log security audit event:
     `logger.warning("EXPERT_MEMBER_CROSS_ORG_STRIPPED: skill '%s' foreign to org '%s'", skill, caller_org_id)`
3. Evaluate `knowledge_folder_ids`:
   - Query DB for each folder ID in `knowledge_folder_ids`.
   - Keep only folders where `org_id == caller_org_id`.
   - If a folder ID belongs to another org, omit it and log audit warning.
4. Evaluate `required_connections`:
   - Query DB for connector connections in `caller_org_id`.
   - Ensure the caller org has the required connections configured and active.
5. Return resolved payload with `effective_skills`, `effective_folder_ids`, `effective_connections`, and `stripped_members_count`.

### 5. Mechanical Inventory Invariant Test (`PACK-01` / `EXT-01` Red Line)

In `backend/tests/unit/test_259_closed_core_inventory.py`:
- Uses Python `ast.parse` to inspect:
  - `backend/app/services/harness/phase_types.py`: Assert `PHASE_TYPE_REGISTRY_ENTRIES` contains exactly the known 7 harness phase types.
  - `backend/app/services/harness/emitters.py`: Assert `EMITTER_REGISTRY` contains exactly the known 4 emitters.
  - `backend/app/services/tool_dispatcher.py`: Assert `_TOOL_REGISTRY` contains exactly the known set of tool handlers; no `expert_tool` or dynamic expert dispatch.
  - Scan `backend/app/services/` for any file matching `*expert*agent*` or `*expert*loop*`: Assert 0 matches.
- Driven RED against a planted mock executor before finalizing.

---

## Hot-File Ledger Dispositions (G-5)

1. `backend/app/main.py`:
   - Current triple: `82 commits / 59 phases / 950 lines`.
   - Phase 259 edits: Exactly 2 lines (1 import + 1 `app.include_router(experts_router)`).
   - Honoured by construction.
2. New source files added AT CREATION:
   - `backend/app/db/experts.py` (0/0/0)
   - `backend/app/models/expert.py` (0/0/0)
   - `backend/app/services/expert_service.py` (0/0/0)
   - `backend/app/api/experts.py` (0/0/0)
