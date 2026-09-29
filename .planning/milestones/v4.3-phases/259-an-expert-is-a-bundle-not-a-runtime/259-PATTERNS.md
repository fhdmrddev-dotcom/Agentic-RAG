# Phase 259: An Expert Is a Bundle, Not a Runtime — Patterns

**Established:** 2026-09-19  
**Domain:** Architectural Patterns for Domain Bundles, Multi-Tenant Boundary Checks, Closed Core Invariants, and Entitlement Integration

---

## Pattern 1: Manifest as Data, Not Execution Runtime (PACK-01 / EXT-01 Red Line)

### Problem
Domain-specific assistants ("Financial Analyzer", "Legal Specialist") are frequently architected as bespoke runtime loops with customized executors, dispatcher branches, or agent engines. This violates `EXT-01` (a plugin is data, external process, or sandbox, never engine code) and recreates the `v3.6 D-14` failure mode ("canvas became a second runtime").

### Solution
- An Expert is purely a **data manifest** stored in PostgreSQL (`public.expert_bundles`).
- It defines what resources are in scope (member skills, required connections, knowledge folders, prompt suggestions, and `scope_mode`).
- The existing unified agent loop executes all operations; the Expert merely scopes what is visible or permitted.
- Enforced by an AST inventory fence (`test_259_closed_core_inventory.py`) verifying that the core registries (`PHASE_TYPE_REGISTRY_ENTRIES`, `EMITTER_REGISTRY`, `_TOOL_REGISTRY`) remain closed and unexpanded.

---

## Pattern 2: Two-Phase Member Boundary Check (PACK-04 / SEED-125 Defense)

### Problem
In multi-tenant applications, a shared or system-level bundle can easily leak foreign-org resources. If a system bundle or org-shared bundle contains references to skills or folders created by another organization, naive resolution queries running on elevated or service-role DB clients will expose instructions or data across tenant boundaries (`SEED-125` precedent).

### Solution
- Bundle resolution is decoupled into two distinct validation phases:
  1. **Bundle-Level Check**: Verify that the caller has access to the bundle row itself (`is_system = true` OR `org_id == caller_org_id`).
  2. **Independent Member Evaluation**: Individually inspect every referenced member (`member_skills`, `knowledge_folder_ids`, `required_connections`).
     - A skill must be `is_system = true` or belong to `caller_org_id`.
     - A folder must belong to `caller_org_id`.
     - A connection must belong to `caller_org_id`.
  3. Any foreign reference is stripped from the returned payload and logged with an audit event (`EXPERT_MEMBER_CROSS_ORG_STRIPPED`), never returned to the client or runtime.

---

## Pattern 3: Single-Home Entitlement Gating on Extension SKUs (PACK-06 / TIER-01)

### Problem
Gating new commercial extensions often introduces ad-hoc checks or re-implements subscription tier lookups in new routers, violating the single-home invariant (`TIER-04`).

### Solution
- Expert endpoints reuse the Phase 258 canonical dependency:
  ```python
  from app.services.entitlement_service import require_capability

  router = APIRouter(
      prefix="/experts",
      tags=["experts"],
      dependencies=[Depends(require_capability("experts"))],
  )
  ```
- Any unauthorized tenant immediately receives the structured 403 naming the `enterprise` tier and upgrade hint.
- AST test `test_258_single_entitlement_home.py` continues to pass cleanly because zero ad-hoc tier reads are introduced.

---

## Pattern 4: Declarative Execution Posture (D-259-01)

### Problem
Different domains require different guardrail postures. High-governance domains (e.g. Finance) require strict grounding where the model refuses to answer unless citations exist in member folders, while creative or general assistants benefit from biasing/priming without disabling generic tools.

### Solution
- Store `scope_mode text NOT NULL DEFAULT 'restricted' CHECK (scope_mode IN ('restricted', 'biased'))` on the bundle.
- In Phase 260 execution, `'restricted'` enforces strict folder grounding and excludes non-member skills, while `'biased'` primes the prompt without excluding baseline capabilities.
