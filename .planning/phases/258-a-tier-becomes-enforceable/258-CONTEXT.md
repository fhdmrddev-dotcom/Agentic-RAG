# Phase 258: A Tier Becomes Enforceable - Context

**Gathered:** 2026-09-19
**Status:** Ready for planning

<domain>
## Phase Boundary

What an org has paid for decides what it can do, from **one** place, and a refusal names the tier that would allow it — so re-packaging is a row change and a refusal is something a buyer can act on rather than a support ticket.

### In Scope
- **Migration 186**: Table `tier_capabilities` storing the tier-to-capability map as data (`tier`, `capability`, `enabled`, `metadata`, `created_at`).
- **TIER-01**: ONE reusable entitlement check service in `backend/app/services/entitlement_service.py` reading `organizations.subscription_tier` and `organizations.add_ons`.
- **TIER-02**: Capability map as data; changing a capability's tier is an `INSERT`/`UPDATE` row change with no code edit and no deploy.
- **TIER-03**: Structured refusal naming the required tier (`{"detail": "...", "capability": "...", "required_tier": "...", "current_tier": "...", "upgrade_hint": "..."}`), never a bare 403.
- **TIER-04**: AST single-home fence (`test_258_single_entitlement_home.py`) failing on any second ad-hoc tier check across the backend, driven RED against a planted check before trusted.
- **TIER-05**: Entitlement check fails closed when tier is unreadable or database blips, with the contrast to `load_run_budget`'s fail-open design recorded as a conscious architectural choice.
- **Consumer Wiring (Proof Slice)**: Wire `require_capability('workflows')` on `POST /workflows` and `POST /workflow-runs`.

### Out of Scope
- Billing integration / payment processing (Stripe, invoicing, credit card handling).
- Per-seat license seat count / user license assignment (org-level entitlement only for this phase).
- Dynamic payment checkout / automated self-serve upgrade flows.
- Pricing dollar amounts for tiers (`D-PRD-10` defers published prices until buyer signal).

</domain>

<decisions>
## Implementation Decisions

### Commercial Metric & Packaging (Operator Decision #1 / TIER-02)

- **D-258-01: Ascending Capability Bundles as the Primary Pricing Metric.**
  The primary commercial pricing axis is ascending capability tiers (`standard` -> `pro` -> `enterprise`), where higher tiers unlock distinct functional capabilities. Modular or à-la-carte extensions are managed via `organizations.add_ons`. This resolves Operator Decision #1 (the milestone's one-way door).

- **D-258-02: Capability Map as Relational Data (`tier_capabilities` table in Migration 186).**
  Migration 186 creates `public.tier_capabilities` with columns `(tier text NOT NULL, capability text NOT NULL, enabled boolean NOT NULL DEFAULT true, metadata jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (tier, capability))`. Repackaging capabilities across tiers is a SQL row operation with zero code edits and zero deploys.

- **D-258-07: Initial Seed Roster in Migration 186.**
  The initial migration seeds:
  - `standard`: `basic_rag`, `chat`
  - `pro`: `basic_rag`, `chat`, `skills`, `code_execution`, `custom_models`
  - `enterprise`: all above + `workflows`, `connectors`, `experts`, `audit_export`

### Entitlement Service & Architecture (TIER-01 / TIER-04)

- **D-258-03: Single Home in `backend/app/services/entitlement_service.py`.**
  Canonical home for entitlement checks. Exposes:
  - `check_entitlement(pool: asyncpg.Pool, org_id: str | UUID, capability: str) -> EntitlementResult`
  - FastAPI dependency helper `require_capability(capability: str)` returning the active org ID or raising `HTTPException(403)`.
  - Helper `get_org_capabilities(pool: asyncpg.Pool, org_id: str | UUID) -> set[str]` for UI capability introspection.

- **D-258-04: AST Single-Home Fence (`test_258_single_entitlement_home.py`).**
  An AST test scans all backend python files to ensure no other file performs ad-hoc reads of `organizations.subscription_tier` or implements custom tier checking. Driven RED against a planted duplicate before trusted.

- **D-258-08: Additive `organizations.add_ons` Evaluation.**
  If an organization's base tier does not grant a capability, but `organizations.add_ons` explicitly enables it (e.g. `{"workflows": true}` or `["workflows"]`), `check_entitlement` grants access.

### Refusal & Failure Behavior (TIER-03 / TIER-05)

- **D-258-05: Structured Refusals Naming the Required Tier.**
  Refusals return `HTTP 403 Forbidden` with structured JSON body:
  ```json
  {
    "detail": "Capability 'workflows' requires 'enterprise' tier (current tier: 'standard')",
    "error": "entitlement_required",
    "capability": "workflows",
    "required_tier": "enterprise",
    "current_tier": "standard",
    "upgrade_hint": "Upgrade to Enterprise to author and execute multi-phase workflows."
  }
  ```
  A bare 403 is never produced for entitlement rejections.

- **D-258-06: Strict Fail-Closed Semantics.**
  If an organization's tier is NULL, unresolvable, or the database connection blips during entitlement evaluation, access to gated capabilities is refused immediately with `EntitlementResult(allowed=False, reason="Entitlement check unavailable (fail-closed)")` and `HTTP 403/503`.
  *Architectural Contrast:* `load_run_budget` in `scheduler_service.py` deliberately fails open so transient database blips do not abort already-scheduled customer runs. In contrast, entitlement gates revenue and commercial boundaries; failing open would allow unauthorized usage during outages.

### Consumer Wiring (Proof Slice)

- **D-258-09: Workflows API as First Gated Consumer.**
  `POST /workflows` and `POST /workflow-runs` in `backend/app/api/workflows.py` and `workflow_runs.py` are guarded with `require_capability('workflows')`, proving that a Standard org receives the structured 403 refusal and an Enterprise/Pro org proceeds normally.

### Folded Seeds
- **SEED-080**: Entitlement / feature-gating primitive — FULLY FOLDED (implemented by TIER-01, TIER-03, TIER-04, TIER-05).
- **SEED-083**: Capability-tier packaging + feature-independence discipline — FULLY FOLDED (implemented by TIER-02 / Migration 186).
- **SEED-294**: Go-to-market commercial packaging — Operator Decision #1 resolved.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Contract & Rules
- `AGENTS.md` — Multi-agent roles and coordination bus.
- `CLAUDE.md` — Hot-file ledger and migration rules.
- `docs/EXTENSION-CONTRACT.md` — Binding rules on plugins and data vs engine execution.

### Database & Migrations
- `supabase/migrations/104_org_dept_role_schema.sql` — `organizations.subscription_tier` and `organizations.add_ons` definitions.
- `supabase/full-schema.sql` — Schema reference for `organizations` and `org_members`.
- `supabase/migrations/185_model_rates_db_roster.sql` — Most recent migration (Phase 258 creates 186).

### Backend Services & Auth
- `backend/app/dependencies.py` — `get_active_org_id`, `get_user_pg_connection`, and permission helpers.
- `backend/app/api/org.py` — Org administration and membership endpoints.
- `backend/app/api/workflows.py` — First live gated workflow authoring endpoint.
- `backend/app/api/workflow_runs.py` — First live gated workflow execution endpoint.
- `backend/app/db/workflows.py` — Reference for `load_run_budget` (fail-open contrast).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/app/dependencies.py::get_active_org_id`: Validates and resolves the active org from JWT and `X-Org-Id`.
- `backend/app/dependencies.py::get_user_pg_connection`: Provides pool connection for async database queries.

### Established Patterns
- **Single-Home Enforcement**: Mirroring Phase 257's METER-02 token conversion fence (`test_257_single_token_conversion_home.py`), `TIER-04` enforces a single home for entitlement checks via an AST fence.
- **Fail-Closed vs Fail-Open**: Commercial security boundaries fail closed; background worker budgets fail open. Both decisions are explicitly documented and tested.

### Integration Points
- `backend/app/services/entitlement_service.py` -> new service module.
- `backend/app/api/workflows.py` -> `POST /workflows` endpoint.
- `backend/app/api/workflow_runs.py` -> `POST /workflow-runs` endpoint.

</code_context>

<specifics>
## Specific Ideas

- **One-Way Door Named & Resolved**: The commercial pricing metric is locked as Ascending Capability Bundles before any code is written, honoring `SEED-294`.
- **Database-Driven Repackaging**: Shifting a capability between tiers (e.g. making `skills` available to `standard`) requires only `UPDATE tier_capabilities SET tier = 'standard' WHERE capability = 'skills';`, with no deployment needed.

</specifics>

<deferred>
## Deferred Ideas

- **Billing / Stripe Webhooks**: Gating is built first; payment processing and subscription checkout deferred to future monetization milestone.
- **User Seat Licensing**: Per-user seat quotas deferred to future multi-tenancy extension.

</deferred>

---

*Phase: 258-a-tier-becomes-enforceable*
*Context gathered: 2026-09-19*
