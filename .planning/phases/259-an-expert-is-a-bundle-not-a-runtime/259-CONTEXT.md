# Phase 259: An Expert Is a Bundle, Not a Runtime - Context

**Gathered:** 2026-09-19
**Status:** Ready for planning

<domain>
## Phase Boundary

An Expert exists as **data** — name, description, member skills, required connections, knowledge scope, prompt suggestions, visibility — tier-gated and safe under RLS, with **no execution path of its own**. An Expert is a manifest over four subsystems that already ship, not a new agent type.

### In Scope
- **Migration 187**: Table `public.expert_bundles` storing bundle manifests (`name`, `slug`, `description`, `scope_mode`, `member_skills`, `required_connections`, `knowledge_folder_ids`, `prompt_suggestions`, `visibility`, `is_system`, `org_id`, `created_by`, `created_at`, `updated_at`) with compound indexes and PostgreSQL Row-Level Security (RLS).
- **PACK-01**: Expert bundle CRUD and listing as data rows. Closed-core inventory verification test (`test_259_closed_core_inventory.py`) proving that executor, emitter, dispatcher, and agent-loop inventories are measurably unchanged from the phase base commit.
- **PACK-04**: Tenancy isolation and independent member boundary checks (`backend/app/services/expert_service.py`). Resolving an Expert verifies the bundle row under RLS, then independently evaluates each referenced skill, connection, and folder against the caller's active `org_id` (and `is_system` builtins). Foreign member references are stripped and audited. Verified by multi-org integration tests in `backend/tests/unit/test_259_expert_member_isolation.py`.
- **PACK-06**: Entitlement gating via Phase 258 `backend/app/services/entitlement_service.py::require_capability('experts')` on all Expert API routes (`backend/app/api/experts.py`). Standard orgs receive structured HTTP 403 naming required tier (`enterprise`) and upgrade hint.
- **Builtin Seeding (PACK-05 Prep)**: Migration 187 seeds first-party "Financial Analyzer" (`is_system = true`, `slug = 'financial-analyzer'`, `scope_mode = 'restricted'`) with domain starter prompt suggestions.

### Out of Scope
- Thread selection and chat execution runtime (`PACK-02`, `PACK-03`, `PACK-05` — Phase 260).
- Frontend chat UI, picker modal, and onboarding chips (Phase 260).
- New agent runtimes, secondary loops, or custom dispatchers (strictly forbidden by `EXT-01` and Red Line `v3.6 D-14`).
- Third-party persona library import / crawler (`SEED-244` / agency-agents — deferred).

</domain>

<decisions>
## Implementation Decisions

### Scope Semantics & Thread Concurrency (Operator Decisions #3 & #4)

- **D-259-01: Scope Semantics Declared per Expert (`scope_mode: 'restricted' | 'biased'`).**
  An Expert declares its execution posture:
  - `'restricted'`: High-governance domains (e.g. Financial Analyzer). When active in Phase 260, the agent is confined strictly to member skills, required connections, and specified folders; out-of-scope tools and general ungrounded retrieval are refused under Phase 185 graded governance.
  - `'biased'`: General assistant personas. Prioritizes member skills and knowledge folder retrieval in context and prompt priming, but preserves standard agent tools.
  - Default: `'restricted'`.

- **D-259-02: Single Active Expert per Thread (Strict 1:1 Concurrency).**
  A thread binds at most one active expert (`threads.expert_id uuid REFERENCES expert_bundles(id)`). Multiple concurrent active experts on a single thread are refused. This avoids contradictory system prompts, tool collision explosion, and ambiguous spend/audit attribution.

### Schema & Data Storage (PACK-01 / Migration 187)

- **D-259-03: Relational Core with Structured Member Arrays/JSONB.**
  Migration 187 creates `public.expert_bundles` with:
  ```sql
  CREATE TABLE public.expert_bundles (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
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
      CONSTRAINT expert_bundles_org_slug_key UNIQUE (org_id, slug)
  );
  ```
  Fast O(1) single-row reads without multi-table join overhead.

- **D-259-07: First-Party Builtin Seeding in Migration 187.**
  Migration 187 seeds "Financial Analyzer" (`is_system = true`, `slug = 'financial-analyzer'`, `visibility = 'public'`, `scope_mode = 'restricted'`) with structured prompt suggestions:
  - "Summarize quarterly cash flows and operating margins"
  - "Identify material budget vs actual variances across periods"
  - "Audit revenue recognition and working capital changes"

- **D-259-08: Dual Support for Authoring and Installation (Operator Decision #5).**
  First-party templates have `is_system = true` and `visibility = 'public'`. Custom org experts have `is_system = false`, `org_id = caller_org_id`, and `created_by = user_id`. Orgs can use system experts directly or clone them into customized org-specific bundles.

### Cross-Org Tenancy Defense & Member Security (PACK-04 / SEED-125)

- **D-259-04: Two-Phase Member Boundary Check.**
  Resolving an Expert bundle verifies the bundle row under RLS, then independently evaluates each referenced member against the caller's active `org_id`:
  - `member_skills`: Each skill must have `is_system = true` or `(org_id == caller_org_id AND (user_id == caller OR is_org_shared == true))`.
  - `knowledge_folder_ids`: Each folder must have `org_id == caller_org_id` (or caller org shared).
  - `required_connections`: Each connection must belong to `caller_org_id`.
  Any foreign org member reference is stripped from the resolved bundle payload and logged with an audit warning (`EXPERT_MEMBER_CROSS_ORG_STRIPPED`), never returned to the caller or passed to execution.
  Driven RED against a planted cross-org member reference in `test_259_expert_member_isolation.py`.

### Entitlement Enforcement (PACK-06)

- **D-259-05: Single-Home Entitlement Gating via Phase 258.**
  All Expert endpoints (`POST /experts`, `GET /experts`, `GET /experts/{id}`, `PATCH /experts/{id}`, `DELETE /experts/{id}`) are guarded with `Depends(require_capability('experts'))`. Standard orgs receive structured HTTP 403 naming required tier (`enterprise`) and upgrade hint. Zero ad-hoc tier checks.

### Closed-Core Inventory (PACK-01 / EXT-01 Red Line)

- **D-259-06: Mechanical Inventory Invariant Test.**
  AST test `test_259_closed_core_inventory.py` verifies that:
  - `PHASE_TYPE_REGISTRY_ENTRIES` in `phase_types.py` is unchanged.
  - `EMITTER_REGISTRY` in `emitters.py` is unchanged.
  - `_TOOL_REGISTRY` in `tool_dispatcher.py` is unchanged.
  - No `expert_runner`, `expert_loop`, or secondary execution runtime exists.

### Folded Seeds
- **SEED-198**: Experts — domain bundles over skills + connections + knowledge scope. FULLY FOLDED (manifest schema, RLS, member isolation, and entitlement in 259; thread selection and chat proof slice in 260).
- **SEED-125**: Tenancy defense constraint applied to Expert member resolution.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Contract & Architectural Law
- `AGENTS.md` — Multi-agent roles and durable mailbox.
- `CLAUDE.md` — Hot-file ledger and migration rules.
- `docs/EXTENSION-CONTRACT.md` — Invariant: a plugin is DATA, EXTERNAL PROCESS, or SANDBOXED CODE, never engine code.
- `.planning/seeds/SEED-198-experts-domain-bundles-over-skills-connections-knowledge.md` — Original operator vision and domain bundle definition.
- `.planning/seeds/SEED-125-skill-tools-service-role-cross-org-leak.md` — Tenancy isolation precedent.

### Database & Migrations
- `supabase/migrations/104_org_dept_role_schema.sql` — Org tenancy foundation.
- `supabase/migrations/186_tier_capabilities.sql` — Entitlement packaging map (seeds `experts` under `enterprise`).
- `supabase/full-schema.sql` — Core tables (`skills`, `folders`, `connector_connections`, `threads`).

### Entitlement & Tenant Services
- `backend/app/services/entitlement_service.py` — Canonical home for `require_capability('experts')` and `check_entitlement`.
- `backend/app/dependencies.py` — `get_active_org_id`, `get_current_user`, `get_user_pg_connection`.
- `backend/app/services/folder_utils.py` — Precedent for caller org resolution and folder tenancy isolation.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/app/services/entitlement_service.py::require_capability`: FastAPI dependency helper enforcing tier capability.
- `backend/app/dependencies.py::get_active_org_id`: Resolves authenticated user's active tenant org.
- `backend/app/services/folder_utils.py::_resolve_caller_org_ids`: Validates user org membership.

### Established Patterns
- **Closed Core Registries**: Defined in `phase_types.py`, `tool_dispatcher.py`, `emitters.py`. Extension contract mechanically guarantees no dynamic registration.
- **Fail-Closed Tenancy**: Every resource lookup checks `org_id == caller_org_id` or `is_system == true`. Cross-org access is stripped/refused.
- **Single-Home Gating**: Commercial tier checks go exclusively through `entitlement_service.py`.

### Integration Points
- `supabase/migrations/187_expert_bundles.sql` -> Database schema and seed data.
- `backend/app/db/experts.py` -> Asyncpg database queries with RLS.
- `backend/app/services/expert_service.py` -> Bundle CRUD, two-phase member validation, and cross-org scrubbing.
- `backend/app/api/experts.py` -> REST API router mounted in `backend/app/main.py`.

</code_context>

<guardrails>
## Hot-File Ledger & Guardrail Dispositions (G-5)

### 1. `backend/app/main.py` — G-5 FIRES (Honoured by Construction)
- **Measured Triple**: `82 commits / 59 phases / 950 lines`.
- **Phase 259 Disposition**: Honoured by construction.
  - Adding exactly 2 lines: 1 router import (`from app.api.experts import router as experts_router`) + 1 route inclusion (`app.include_router(experts_router, prefix="/experts", tags=["experts"])`).
  - Zero logic changes, zero conditional branches.

### 2. New Source Files Added to Ledger AT CREATION
- `backend/app/db/experts.py` (0/0/0) — Added to `docs/HOT-FILE-LEDGER.md` and `CLAUDE.md`.
- `backend/app/services/expert_service.py` (0/0/0) — Added to `docs/HOT-FILE-LEDGER.md` and `CLAUDE.md`.
- `backend/app/api/experts.py` (0/0/0) — Added to `docs/HOT-FILE-LEDGER.md` and `CLAUDE.md`.
- Precedent from Phase 258: An absent row is permanently invisible to G-5 at any commit count; rows are created in the commit that introduces the files.

</guardrails>

<specifics>
## Specific Ideas

- **Financial Analyzer First-Party Seed**: Ships ready for immediate trial in Phase 260 with high-value starter questions.
- **Declarative Posture**: `scope_mode` ('restricted' vs 'biased') makes strict grounding explicit in the schema.

</specifics>

<deferred>
## Deferred Ideas

- **Chat Thread Selection & Prompt Injection (`PACK-02`, `PACK-03`, `PACK-05`)**: Belongs to Phase 260.
- **Persona Library Importer (`SEED-244`)**: Curating and importing 200+ agency-agents personas deferred to post-milestone catalog expansion.
- **Workflow Node Binding for Experts**: Binding an Expert as a workflow canvas node deferred to future workflow enhancement.

</deferred>

---

*Phase: 259-an-expert-is-a-bundle-not-a-runtime*
*Context gathered: 2026-09-19*
