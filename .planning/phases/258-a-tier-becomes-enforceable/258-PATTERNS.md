# Phase 258: A Tier Becomes Enforceable — Patterns

**Established:** 2026-09-19  
**Domain:** Architectural Patterns for Commercial Entitlement & Feature Gating

---

## Pattern 1: Single-Home Service with AST Mechanical Fence (TIER-01 / TIER-04)

### Problem
When feature gating is needed across various routes, developers often write ad-hoc checks (e.g. `if org.tier == 'pro': ...` or inline SQL `SELECT subscription_tier FROM organizations`). This causes:
1. Fragmented refusal formats across endpoints.
2. Inconsistent handling of overrides and edge cases.
3. Inability to audit what capabilities each tier unlocks.

### Solution
- Exactly ONE module (`backend/app/services/entitlement_service.py`) and its database helper (`backend/app/db/entitlements.py`) are permitted to read `organizations.subscription_tier`.
- An AST fence test (`backend/tests/unit/test_258_single_entitlement_home.py`) uses `ast.parse` to traverse every backend module. If any other module references `subscription_tier`, the test fails.
- Fenced tests must be proven non-vacuous by planting a violation, observing test failure (RED), removing the violation, and verifying git/md5 integrity.

---

## Pattern 2: Relational Capability Map as Data (TIER-02)

### Problem
Hardcoding feature sets in Python enums or dictionary constants (e.g. `PRO_FEATURES = {'skills', 'code'}`) requires a code deploy every time product marketing or sales repackages a tier.

### Solution
- Store the matrix in PostgreSQL: `public.tier_capabilities (tier, capability, enabled, metadata, created_at)`.
- Re-packaging is an SQL row change:
  ```sql
  UPDATE public.tier_capabilities SET enabled = true WHERE tier = 'standard' AND capability = 'skills';
  ```
- Instant effect across all backend instances without server restart or redeployment.

---

## Pattern 3: Honest Structured Refusal (TIER-03)

### Problem
A generic `403 Forbidden` (`{"detail": "Forbidden"}`) or `{"detail": "Access denied"}` confuses customers and floods support channels. Users do not know *why* they were blocked or *how* to upgrade.

### Solution
- Standardize all entitlement exceptions on `EntitlementDeniedException`:
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
- Contains machine-readable fields (`error`, `capability`, `required_tier`, `current_tier`) and human-readable guidance (`upgrade_hint`).

---

## Pattern 4: Strict Fail-Closed Security Boundary (TIER-05)

### Problem
Different parts of an application fail differently during infrastructure blips. A background task might fail open to prevent dropped jobs, but an access control check must never fail open.

### Solution
- **Access / Revenue Gate (`entitlement_service`)**: Fails **CLOSED**. If the database blips or an organization's subscription tier cannot be read, access is denied (`allowed=False`, HTTP 403/503).
- **In-flight Task Budget (`load_run_budget`)**: Fails **OPEN**. If the database blips while evaluating circuit breaker caps during an active workflow execution, the execution continues.
- Both behaviors are intentional, documented, and tested with unit tests mocking pool connection dropouts.
