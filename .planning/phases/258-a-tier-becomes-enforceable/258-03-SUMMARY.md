---
phase: 258-a-tier-becomes-enforceable
plan: 03
subsystem: workflows
tags: [entitlements, tiers, workflows_api, g5_honoured, fail_closed, integration_test]

# Dependency graph
requires: [258-01, 258-02]
provides:
  - "Workflows API authoring and publishing endpoints wired with Depends(require_capability('workflows'))"
  - "Integration test suite in backend/tests/unit/test_258_workflow_entitlement_gate.py (6/6 passed)"
  - "G-5 disposition honoured by construction on backend/app/api/workflows.py (42/22/2255 L)"
affects: [workflows, pack_service]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "First live consumer wired to canonical entitlement service (TIER-01)"
    - "Dynamic relational repackaging proven live via tier_capabilities (TIER-02)"
    - "Refusal payload verification through real FastAPI router (TIER-03)"
    - "Strict fail-closed enforcement at endpoint entry (TIER-05)"

key-files:
  created:
    - "backend/tests/unit/test_258_workflow_entitlement_gate.py"
  modified:
    - "backend/app/api/workflows.py"
    - "backend/tests/unit/test_256_finish_run_unchanged.py"

key-decisions:
  - "Workflows creation (create_draft) and publish (publish_workflow) endpoints gated by Depends(require_capability('workflows')) (D-258-09)."
  - "G-5 on backend/app/api/workflows.py strictly honoured by construction: only import and dependency declarations added; zero new route handlers, zero branching, zero new state."
  - "test_256_finish_run_unchanged.py line pin updated from 1802 to 1809 (+7 lines attributable to require_capability import and decorator wiring) with counts preserved."

requirements-completed: [TIER-01, TIER-02, TIER-03, TIER-05]

# Metrics
duration: 20min
completed: 2026-09-19
---

# Phase 258 Plan 03 Summary: First Gated Consumer Wiring (Workflows API)

**Wired `Depends(require_capability('workflows'))` into the Workflows API (`backend/app/api/workflows.py`), honouring G-5 by construction with zero new branching or route handlers, verified with 6 end-to-end scenario tests.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-09-19T22:15:00Z
- **Completed:** 2026-09-19T22:33:00Z
- **Tasks:** 3 completed
- **Files created/modified:** 3

## Accomplishments

1. **Wired `require_capability('workflows')` into `backend/app/api/workflows.py`**:
   - Gated `create_draft` (`POST /workflows`) with `Depends(require_capability("workflows"))`.
   - Gated `publish_workflow` (`POST /workflows/{definition_id}/publish`) with `Depends(require_capability("workflows"))`.
   - Strictly honoured G-5 by construction on `workflows.py` (`42 commits / 22 phases / 2255 lines`, extraction still OWED): added only 1 import and 2 dependency decorator parameters, introducing zero branches, zero new handlers, and zero new state.

2. **Authored Integration Test Suite in `backend/tests/unit/test_258_workflow_entitlement_gate.py`**:
   - 6/6 test cases passing:
     - Standard org hitting `POST /workflows` refused with structured HTTP 403 naming `'enterprise'` tier and upgrade hint (`TIER-03`).
     - Standard org with `add_ons: {"workflows": true}` admitted via additive override rule (`D-258-08`).
     - Enterprise org admitted without restriction (`TIER-01`).
     - Dynamic re-packaging: changing capability mapping in `tier_capabilities` immediately admits Standard tier without code changes or server redeployment (`TIER-02`).
     - Fail-closed semantics: database errors or unresolvable orgs refuse access with 403 rather than failing open (`TIER-05`).
     - Multi-endpoint coverage: `publish_workflow` verified under the entitlement gate.

3. **Re-derived Line Pin in `test_256_finish_run_unchanged.py`**:
   - Call site line for `await finish_run(` in `api/workflows.py` shifted from 1802 to 1809 (+7 lines from import + decorators). Per-file counts remained unchanged (1/3/1). Pin updated and verified green.

## Verification

- `pytest backend/tests/unit/test_258_tier_capabilities_db.py backend/tests/unit/test_258_entitlement_service.py backend/tests/unit/test_258_single_entitlement_home.py backend/tests/unit/test_258_workflow_entitlement_gate.py -v` → 26/26 passed.
- `node scripts/check-backend-unit-baseline.cjs` → PASSED (`71 failed, 5126 passed, 2 xfailed, 2 xpassed, 43 warnings in 214.09s`, ceiling <= 71 satisfied).
- `node scripts/check-hot-file-ledger.cjs 258` → OK (304 rows, 9 subject, 3 watched).
- `node scripts/check-claude-md-size.cjs` → OK (107,865 chars, 42,135 headroom).
- `node scripts/check-seeds-register.cjs --phase 258` → OK (309/309 parsed, 0 duplicate ids).
- `bash scripts/check-deploy-drift.sh` → PASS (0 drift).
