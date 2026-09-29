---
phase: 259-an-expert-is-a-bundle-not-a-runtime
plan: 03
subsystem: api
tags: [api, experts, router, entitlement, closed_core, inventory, ast, fence]

# Dependency graph
requires: [259-02]
provides:
  - "FastAPI REST router in backend/app/api/experts.py guarded by require_capability('experts')"
  - "Router mounted in backend/app/main.py with G-5 compositional compliance"
  - "Entitlement gate test suite in backend/tests/unit/test_259_expert_entitlement_gate.py (5/5 passed)"
  - "AST closed-core inventory fence in backend/tests/unit/test_259_closed_core_inventory.py (5/5 passed)"
  - "Non-vacuous inventory assertion verified against planted 8th executor, restored md5-identical (cad3130276f7b60202ae1b8c08c00a47)"
affects: [chat, frontend, api]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single-home entitlement: all expert endpoints guarded at router level via Depends(require_capability('experts')), returning structured 403 on refusal"
    - "Closed-core inventory fence: AST asserts exactly 7 execution phase types, 4 emitters, closed tool registry, and 0 expert runtimes"

key-files:
  created:
    - "backend/app/api/experts.py"
    - "backend/tests/unit/test_259_expert_entitlement_gate.py"
    - "backend/tests/unit/test_259_closed_core_inventory.py"
  modified:
    - "backend/app/main.py"
    - "docs/HOT-FILE-LEDGER.md"
    - "CLAUDE.md"

key-decisions:
  - "Mounted /experts with router-level Depends(require_capability('experts')), ensuring all current and future endpoints enforce Enterprise entitlement without repetitive per-route decorators (D-259-05, PACK-06)."
  - "Refusal returns HTTP 403 with structured payload {'error': 'entitlement_required', 'capability': 'experts', 'required_tier': 'enterprise', ...} (TIER-03)."
  - "Zero new executors, emitters, or tools created: AST mechanically verifies that PHASE_TYPE_REGISTRY_ENTRIES has strictly 7 items and no expert runtime exists (D-259-06, PACK-01, EXT-01 Red Line)."
  - "Non-vacuity verified by planting an 8th mock executor in phase_types.py, driving test_phase_type_registry_contains_zero_expert_executors RED (assert 8 == 7), then restoring md5-clean (cad3130276f7b60202ae1b8c08c00a47)."

patterns-established:
  - "Router-level capability gating with structured refusal payload."
  - "AST mechanical closed-core inventory fence preventing runtime drift."

requirements-completed: [PACK-01, PACK-06]

# Metrics
duration: 15min
completed: 2026-09-19
---

# Phase 259 Plan 03 Summary: Expert API Router, Entitlement Gate & Closed-Core Fence

**Delivered the REST API router (`backend/app/api/experts.py`) mounted in `backend/app/main.py`, enforced Phase 258 enterprise capability gating (`require_capability('experts')`), and established an AST closed-core inventory fence (`test_259_closed_core_inventory.py`) driven RED against a planted executor and restored md5-identical.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-09-19T23:50:00Z
- **Completed:** 2026-09-19T23:56:00Z
- **Tasks:** 3 completed
- **Files created/modified:** 6

## Accomplishments

1. **REST API Router (`backend/app/api/experts.py`) & Mount (`backend/app/main.py`)**:
   - Implemented endpoints:
     - `POST /experts`: Create tenant-owned bundle.
     - `GET /experts`: List accessible bundles (system + org).
     - `GET /experts/{bundle_id}`: Retrieve bundle by ID.
     - `GET /experts/{bundle_id}/resolve`: Retrieve resolved bundle with two-phase member boundary evaluation.
     - `PATCH /experts/{bundle_id}`: Update tenant-owned bundle.
     - `DELETE /experts/{bundle_id}`: Delete tenant-owned bundle.
   - Guarded router-wide with `Depends(require_capability('experts'))`.
   - Mounted in `backend/app/main.py` strictly honouring G-5 (2 lines added, 0 logic branching).
   - Tracked in `docs/HOT-FILE-LEDGER.md` and `CLAUDE.md` with updated triple `83 / 60 / 952` for `backend/app/main.py` and `0 / 0 / 0` for `backend/app/api/experts.py`.

2. **Entitlement Gate Testing (`backend/tests/unit/test_259_expert_entitlement_gate.py`)**:
   - Verified HTTP 403 refusal on Standard/Pro orgs with structured upgrade hint JSON (`{"error": "entitlement_required", "capability": "experts", "required_tier": "enterprise", ...}`).
   - Verified HTTP 200/201 admission on Enterprise orgs.
   - Verified additive override admission via `organizations.add_ons = {"experts": true}`.
   - Verified AST single-home compliance: 0 direct tier checks in `api/experts.py`.

3. **Closed-Core Inventory Fence (`backend/tests/unit/test_259_closed_core_inventory.py`)**:
   - AST mechanically asserts:
     - `PHASE_TYPE_REGISTRY_ENTRIES` has strictly 7 executors, zero named `expert*`.
     - `EMITTER_REGISTRY` has strictly 4 emitters.
     - `_TOOL_REGISTRY` has zero expert tools or runtime dispatchers.
     - Zero expert agent loop or runtime modules exist in `backend/app/services/`.
     - `expert_service.py` is pure data transformation without runtime execution.
   - Non-vacuity verified by planting an 8th mock executor in `phase_types.py`, driving test RED (`assert 8 == 7`), and restoring clean code verified via md5 (`cad3130276f7b60202ae1b8c08c00a47`).

## Verification

```bash
python -m pytest backend/tests/unit/test_259_expert_bundles_db.py backend/tests/unit/test_259_expert_member_isolation.py backend/tests/unit/test_259_expert_entitlement_gate.py backend/tests/unit/test_259_closed_core_inventory.py -v
# 27 passed, 13 warnings in 2.17s

node scripts/check-hot-file-ledger.cjs 259
# ledger gate OK — every watched file has a row.

node scripts/check-claude-md-size.cjs
# claude-md size gate OK — every CLAUDE.md loads, all under 120000 chars.
```
