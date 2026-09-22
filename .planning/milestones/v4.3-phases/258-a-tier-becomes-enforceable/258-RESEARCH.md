# Phase 258: A Tier Becomes Enforceable — Research

**Researched:** 2026-09-19  
**Domain:** Commercial Tiering / Entitlement Gating / Relational Capability Matrix / Single-Home AST Fence / Fail-Closed Access Control  
**Confidence:** HIGH on schema, entitlement service contracts, AST fence design, FastAPI dependency mechanics, and fail-closed vs fail-open semantics.  
**Measured at:** `git HEAD = 837a4cc03` on `develop`.

---

<user_constraints>
## User Constraints (from 258-CONTEXT.md)

### Locked Decisions — D-258-01 … D-258-09

- **D-258-01 (Commercial Metric / Operator Decision #1)**: Ascending Capability Bundles (`standard` -> `pro` -> `enterprise`) is the locked pricing metric. Higher tiers unlock functional capability rungs; modular or à-la-carte extensions are managed via `organizations.add_ons`. Fulfills `SEED-294` requirement to name and resolve the one-way door before encoding.
- **D-258-02 (Capability Map as Relational Data)**: Migration 186 creates `public.tier_capabilities` table with columns `(tier text NOT NULL, capability text NOT NULL, enabled boolean NOT NULL DEFAULT true, metadata jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (tier, capability))`. Repackaging capabilities across tiers is a SQL row operation (`INSERT`/`UPDATE`) with zero code edits and zero deploys (`TIER-02`).
- **D-258-03 (Single Home Entitlement Check)**: Dedicated module `backend/app/services/entitlement_service.py` is the single home reading `organizations.subscription_tier` and `organizations.add_ons`. Exposes async `check_entitlement(pool, org_id, capability)` and FastAPI dependency `require_capability(capability: str)` (`TIER-01`).
- **D-258-04 (AST Single-Home Fence)**: AST test `backend/tests/unit/test_258_single_entitlement_home.py` scans all backend python files and forbids reading `organizations.subscription_tier` or writing ad-hoc tier checks anywhere outside `entitlement_service.py` (and `db/entitlements.py`), driven RED against a planted duplicate before trusted (`TIER-04`).
- **D-258-05 (Honest Structured Refusal)**: Refusals emit `HTTP 403 Forbidden` with structured JSON body naming the required tier, current tier, capability, and upgrade hint (`TIER-03`):
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
- **D-258-06 (Strict Fail-Closed Semantics)**: If an organization's tier is NULL, unresolvable, or the database connection blips during evaluation, access to gated capabilities is refused immediately with `EntitlementResult(allowed=False, reason="Entitlement check unavailable (fail-closed)")` and `HTTP 403/503` (`TIER-05`). Contrast with `load_run_budget` (which deliberately fails open so transient DB blips do not abort customer runs); commercial access boundaries must fail closed.
- **D-258-07 (Initial Seed Roster in Migration 186)**:
  - `standard`: `basic_rag`, `chat`
  - `pro`: `basic_rag`, `chat`, `skills`, `code_execution`, `custom_models`
  - `enterprise`: all above + `workflows`, `connectors`, `experts`, `audit_export`
- **D-258-08 (Additive `organizations.add_ons` Evaluation)**:
  If a capability is not granted by the base tier, but is explicitly enabled in `organizations.add_ons` (as boolean flag `{"workflows": true}` or membership in list `["workflows"]`), `check_entitlement` GRANTS access.
- **D-258-09 (First Gated Consumer — Proof Slice)**:
  The Workflows API (`POST /workflows`, `POST /workflow-runs`) in `backend/app/api/workflows.py` and `workflow_runs.py` is wired with `require_capability('workflows')`, proving that Standard orgs receive the structured 403 refusal and Enterprise/Pro orgs proceed normally.

### Out of Scope
- Customer billing checkout, payment gateway integration (Stripe, LemonSqueezy).
- Per-seat user license tracking.
- Self-serve upgrade UI checkout modal.
- Published prices list (`D-PRD-10`).

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description (REQUIREMENTS.md) | Research Support |
|---|---|---|
| **TIER-01** | ONE reusable entitlement check exists, in one home, reading `organizations.subscription_tier` + `add_ons`. Greenfield — there is no stub to replace. | §2 Entitlement Service (`backend/app/services/entitlement_service.py`), §3 DB access helpers. |
| **TIER-02** | A capability map declares what each tier contains, **as data, not as branches** — so re-packaging is a row change and not a deploy. | §1 Migration 186 (`tier_capabilities` table, primary key `(tier, capability)`, index, seed data). |
| **TIER-03** | An entitlement refusal **names the tier that would allow it**. Never a bare 403; a refusal a buyer cannot act on is a support ticket. | §4 Refusal Exception & Payload Schema (`EntitlementDeniedException`). |
| **TIER-04** | A guard fails on a **second ad-hoc tier check** anywhere in the backend — the one-home rule enforced rather than asked for, before two implementations exist. | §5 AST Single-Home Fence (`test_258_single_entitlement_home.py`), driven RED against a planted second check. |
| **TIER-05** | The entitlement check **fails closed on an unreadable tier**, and that arm is driven. Contrast `load_run_budget`, which fails open deliberately; these are opposite choices for opposite reasons and the difference is recorded, not inherited. | §6 Fail-Closed vs Fail-Open Architectural Seam, §7 Error recovery tests. |

</phase_requirements>

---

## Technical Investigations & Architectural Seams

### 1. Schema & Migration 186 (`supabase/migrations/186_tier_capabilities.sql`)

- **Table**: `public.tier_capabilities`
  - `tier text NOT NULL` (e.g. `'standard'`, `'pro'`, `'enterprise'`)
  - `capability text NOT NULL` (e.g. `'basic_rag'`, `'chat'`, `'skills'`, `'code_execution'`, `'custom_models'`, `'workflows'`, `'connectors'`, `'experts'`, `'audit_export'`)
  - `enabled boolean NOT NULL DEFAULT true`
  - `metadata jsonb NOT NULL DEFAULT '{}'::jsonb`
  - `created_at timestamptz NOT NULL DEFAULT now()`
  - `PRIMARY KEY (tier, capability)`
- **Indexes**:
  - `idx_tier_capabilities_lookup`: `ON public.tier_capabilities (tier, capability) WHERE enabled = true`
- **Row Level Security (RLS)**:
  - `ENABLE ROW LEVEL SECURITY`
  - `SELECT`: Allowed for `authenticated`, `anon`, and `service_role`.
  - `INSERT / UPDATE / DELETE`: Restricted to `service_role` (operator only).
- **Initial Seed Rows**:
  ```sql
  INSERT INTO public.tier_capabilities (tier, capability, enabled) VALUES
    ('standard', 'basic_rag', true),
    ('standard', 'chat', true),
    ('pro', 'basic_rag', true),
    ('pro', 'chat', true),
    ('pro', 'skills', true),
    ('pro', 'code_execution', true),
    ('pro', 'custom_models', true),
    ('enterprise', 'basic_rag', true),
    ('enterprise', 'chat', true),
    ('enterprise', 'skills', true),
    ('enterprise', 'code_execution', true),
    ('enterprise', 'custom_models', true),
    ('enterprise', 'workflows', true),
    ('enterprise', 'connectors', true),
    ('enterprise', 'experts', true),
    ('enterprise', 'audit_export', true)
  ON CONFLICT (tier, capability) DO NOTHING;
  ```

### 2. Entitlement Service Architecture (`backend/app/services/entitlement_service.py`)

- **Data Models**:
  ```python
  @dataclass(frozen=True)
  class EntitlementResult:
      allowed: bool
      capability: str
      current_tier: str | None = None
      required_tier: str | None = None
      reason: str | None = None
      upgrade_hint: str | None = None
  ```
- **Evaluation Logic**:
  1. Receive `(pool, org_id, capability)`.
  2. Query `organizations` table for `subscription_tier` and `add_ons`.
     - If org row is missing, connection fails, or query raises: return `EntitlementResult(allowed=False, reason="Entitlement check unavailable (fail-closed)")`.
  3. Resolve tier: `tier = row["subscription_tier"] or "standard"` (if NULL in DB, default to lowest tier `standard`, or fail-closed if completely absent).
  4. Check `add_ons jsonb`:
     - If `add_ons` is a dict and `add_ons.get(capability) is True`: return `EntitlementResult(allowed=True, capability=capability, current_tier=tier, reason="Granted via add_on override")`.
     - If `add_ons` is a list and `capability in add_ons`: return `EntitlementResult(allowed=True, capability=capability, current_tier=tier, reason="Granted via add_on override")`.
  5. Check `tier_capabilities`:
     - Query `SELECT enabled FROM public.tier_capabilities WHERE tier = $1 AND capability = $2`.
     - If found and `enabled is True`: return `EntitlementResult(allowed=True, capability=capability, current_tier=tier)`.
  6. If not granted:
     - Find lowest tier that DOES offer this capability:
       `SELECT tier FROM public.tier_capabilities WHERE capability = $1 AND enabled = true ORDER BY ... LIMIT 1`.
     - Return `EntitlementResult(allowed=False, capability=capability, current_tier=tier, required_tier=min_tier, reason="Capability requires higher subscription tier", upgrade_hint=f"Upgrade to {min_tier.title()} to use {capability}.")`.

### 3. FastAPI Dependency & Refusal Handler (`require_capability`)

- **FastAPI Dependency**:
  ```python
  def require_capability(capability: str):
      async def _dependency(
          request: Request,
          active_org_id: str = Depends(get_active_org_id),
          pool: asyncpg.Pool = Depends(deps.get_pg_pool),
      ) -> str:
          result = await check_entitlement(pool, active_org_id, capability)
          if not result.allowed:
              raise EntitlementDeniedException(result)
          return active_org_id
      return _dependency
  ```
- **HTTP Exception / Response Payload**:
  `EntitlementDeniedException` inherits from `HTTPException` with `status_code=403` and structured JSON dictionary:
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

### 4. AST Single-Home Fence (`test_258_single_entitlement_home.py`)

- **Fence Target**:
  Every Python file under `backend/app/` EXCEPT:
  - `backend/app/services/entitlement_service.py`
  - `backend/app/db/entitlements.py`
- **Fenced Constructs**:
  - Direct SQL queries matching `subscription_tier` or `FROM.*organizations.*subscription_tier`.
  - Python attribute accesses or dictionary lookups for `subscription_tier`.
  - Functions named `*check_tier*`, `*require_tier*`, `*is_tier_*`.
- **RED-Drive Invariant**:
  - Test must be executed against a planted violation in a test file to verify it actively FAILS.
  - Violation removed, MD5 verified identical to pre-plant state.

### 5. Architectural Contrast: Fail-Closed (Entitlement) vs Fail-Open (Budget)

- In `backend/app/db/workflows.py` (`load_run_budget`):
  - Fails **OPEN**: If a DB query times out during an in-flight run boundary check, `load_run_budget` returns `None` for caps, allowing the active workflow execution to finish rather than abruptly killing it.
- In `backend/app/services/entitlement_service.py` (`check_entitlement`):
  - Fails **CLOSED**: If the database blips or an organization's subscription tier cannot be read, access to gated features is denied. Permitting access during failure creates an open billing vulnerability where unentitled or suspended orgs could access premium features by inducing transient DB latency.

### 6. First Gated Consumer Slice (Workflows API)

- Consumer: `POST /workflows` in `backend/app/api/workflows.py`.
- Adding `dependencies=[Depends(require_capability("workflows"))]` to `create_draft` and `publish_workflow`.
- Standard org requests are rejected with the structured 403 payload naming `enterprise` (or `pro`).
- Moving `'workflows'` to `'standard'` in `tier_capabilities` instantly admits the request with zero code modifications.

### 7. G-5 Guardrail Analysis & Dispositions

#### `backend/app/api/workflows.py`
- **Re-derived Triple**: `42 commits / 22 phases / 2255 lines` (21 phases excluding quick task `260814`).
- **G-5 Status**: **FIRES** (threshold is 3 phases).
- **Ledger Verdict**: `⚠ extraction still OWED` (declined at BUG-260828-09).
- **Analysis**:
  - `workflows.py` is one of the hottest backend route modules. It hosts definition CRUD, validate/lint, grounding palette, publish gauntlet, run launcher, and template door. A five-way extraction has been owed since Phase 192.2 / Phase 214.
  - Phase 258's modification in `258-03` is strictly compositional: adding `Depends(require_capability("workflows"))` to `create_draft` and `publish_workflow`.
  - **Zero** new route endpoints are introduced.
  - **Zero** branching or business logic is added inside the handlers.
  - **Zero** new state or database queries are introduced into `workflows.py` (all capability evaluation is encapsulated in `entitlement_service`).
  - Total file delta is minimal (~4 lines: 1 import + 2 decorator dependency parameters).
- **Disposition**: **Honoured by construction**.
  - Smuggling an architectural decomposition of `workflows.py` into a commercial security gating phase would introduce uncontrolled blast radius and risk.
  - The change honours G-5 by adding only pure dependency injection while leaving the owed extraction seam completely intact and unobstructed.

#### New Files Added to Ledger AT CREATION
- `backend/app/db/entitlements.py` (0/0/0) — Row added AT CREATION.
- `backend/app/services/entitlement_service.py` (0/0/0) — Row added AT CREATION.
- **Rule & Precedent**: `CLAUDE.md` mandates rows added at creation (`LibraryCloudImport.tsx` / `settingsSearchPayload.ts` precedent) because an absent file is invisible to G-5 at any commit count. `entitlement_service.py` is the single home for every commercial boundary in the product; keeping it tracked from commit 0 ensures its growth and invariants are permanently visible.

