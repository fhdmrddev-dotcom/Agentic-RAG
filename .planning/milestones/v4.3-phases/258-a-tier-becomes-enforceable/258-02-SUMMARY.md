---
phase: 258-a-tier-becomes-enforceable
plan: 02
subsystem: services
tags: [entitlements, tiers, fast_api, ast_fence, red_drive, fail_closed]

# Dependency graph
requires: [258-01]
provides:
  - "Canonical commercial entitlement service in backend/app/services/entitlement_service.py (check_entitlement, require_capability)"
  - "Structured refusal exception EntitlementDeniedException (HTTP 403 Forbidden naming required tier and upgrade hint)"
  - "Unit test suite in backend/tests/unit/test_258_entitlement_service.py (9/9 passed)"
  - "AST single-home fence in backend/tests/unit/test_258_single_entitlement_home.py driven RED against planted check"
affects: [258-03, workflows, pack_service]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single commercial entitlement evaluation home (TIER-01)"
    - "Structured 403 refusal with actionable upgrade hint, never bare 403 (TIER-03)"
    - "AST single-home fence banning direct subscription_tier access outside entitlement_service (TIER-04)"
    - "Strict fail-closed security boundary (TIER-05)"

key-files:
  created:
    - "backend/app/services/entitlement_service.py"
    - "backend/tests/unit/test_258_entitlement_service.py"
    - "backend/tests/unit/test_258_single_entitlement_home.py"
  modified: []

key-decisions:
  - "backend/app/services/entitlement_service.py is the canonical boundary for capability and tier evaluation (TIER-01, D-258-03)."
  - "EntitlementDeniedException returns HTTP 403 with structured dict: detail, error='entitlement_required', capability, required_tier, current_tier, upgrade_hint (TIER-03, D-258-05)."
  - "require_capability returns a FastAPI async dependency resolving active_org_id via get_active_org_id and asyncpg pool via get_pg_pool."
  - "AST single-home fence bans any direct read of subscription_tier or ad-hoc tier check functions outside entitlement_service and db/entitlements (TIER-04, D-258-04)."
  - "AST fence proven non-vacuous by driving RED against a planted check (_scratch_planted_tier_check.py) with 2 caught violations, returning to GREEN upon removal."

requirements-completed: [TIER-01, TIER-03, TIER-04, TIER-05]

# Metrics
duration: 15min
completed: 2026-09-19
---

# Phase 258 Plan 02 Summary: Canonical Entitlement Service & AST Single-Home Fence

**Delivered the canonical commercial entitlement service (`backend/app/services/entitlement_service.py`), structured 403 refusal exception (`EntitlementDeniedException`), and AST single-home fence (`test_258_single_entitlement_home.py`) driven RED against a planted violation.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-09-19T22:11:00Z
- **Completed:** 2026-09-19T22:14:00Z
- **Tasks:** 4 completed
- **Files created:** 3

## Accomplishments

1. **Implemented Canonical Entitlement Service (`backend/app/services/entitlement_service.py`)**:
   - `EntitlementResult`: Frozen dataclass carrying `allowed`, `capability`, `current_tier`, `required_tier`, `reason`, `upgrade_hint`.
   - `EntitlementDeniedException(HTTPException)`: Emits status 403 with structured JSON detail naming required tier, current tier, capability, and actionable upgrade hint (e.g., `"Upgrade to Enterprise to use audit_export."`). Never a bare 403.
   - `check_entitlement(pool, org_id, capability)`: Canonical asynchronous capability checker delegating to `resolve_org_entitlement`, strictly failing closed on missing orgs or database errors (`D-258-06`).
   - `require_capability(capability)`: Reusable FastAPI dependency factory injecting `get_active_org_id` and `get_pg_pool`.

2. **Authored Unit Tests in `backend/tests/unit/test_258_entitlement_service.py`**:
   - 9/9 unit tests passing in 0.27s covering allowed checks, standard-to-pro upgrade hints, pro-to-enterprise upgrade hints, fail-closed database handling, structured refusal payloads, FastAPI dependency injection, and full HTTP roundtrip through FastAPI `TestClient`.

3. **Authored AST Single-Home Fence in `backend/tests/unit/test_258_single_entitlement_home.py`**:
   - Traverses all Python files across `backend/app/`.
   - Allowlist strictly restricted to `services/entitlement_service.py` and `db/entitlements.py`.
   - Bans attribute accesses (`*.subscription_tier`), subscript accesses (`*['subscription_tier']`), SQL string literals querying `subscription_tier`, and ad-hoc tier check functions (`check_tier`, `is_tier_`, `require_tier`, etc.).

4. **RED-Driven AST Single-Home Fence Verification (TIER-04)**:
   - **Planted Violation**: Added `backend/app/services/_scratch_planted_tier_check.py`:
     ```python
     def _is_tier_pro_or_higher(org):
         return org.subscription_tier in ("pro", "enterprise")
     ```
   - **Executed Test**: `pytest backend/tests/unit/test_258_single_entitlement_home.py -v` → **FAILED (RED)**:
     - Violation 1: `services\_scratch_planted_tier_check.py:3 defines forbidden tier check function '_is_tier_pro_or_higher'`
     - Violation 2: `services\_scratch_planted_tier_check.py:4 directly accesses attribute 'subscription_tier': 'org.subscription_tier'`
   - **Plant Removed**: `rm backend/app/services/_scratch_planted_tier_check.py`.
   - **Re-executed Test**: `pytest backend/tests/unit/test_258_single_entitlement_home.py -v` → **PASSED (GREEN)** in 0.91s.

## Verification

- `pytest backend/tests/unit/test_258_tier_capabilities_db.py backend/tests/unit/test_258_entitlement_service.py backend/tests/unit/test_258_single_entitlement_home.py -v` → 20/20 passed in 1.13s.
- `node scripts/check-hot-file-ledger.cjs 258` → OK (304 rows, 9 subject, 3 watched).
- `node scripts/check-claude-md-size.cjs` → OK (107,865 chars, 42,135 headroom).
- `node scripts/check-seeds-register.cjs` → OK (309/309 parsed, 0 duplicate ids).
