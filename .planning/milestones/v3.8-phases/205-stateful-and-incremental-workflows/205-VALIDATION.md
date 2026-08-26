---
phase: 205
slug: stateful-and-incremental-workflows
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-24
---

# Phase 205 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (Backend) / vitest (Frontend) |
| **Config file** | `backend/pytest.ini` / `frontend/vite.config.ts` |
| **Quick run command** | `pytest backend/tests/unit/test_stateful_workflows.py` |
| **Full suite command** | `pytest backend/tests/unit/test_stateful_workflows.py && npm test -- src/components/workflows/builder/WorkflowSettings.test.tsx` |
| **Estimated runtime** | ~6 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pytest backend/tests/unit/test_stateful_workflows.py`
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 205-01-01 | 01 | 1 | STATE-01 | T-205-01 | Query resolves latest completed run with strict owner scoping | unit | `pytest backend/tests/unit/test_stateful_workflows.py -k test_get_latest_completed_workflow_run` | ❌ W0 | ⬜ pending |
| 205-01-02 | 01 | 1 | STATE-01 | T-205-02 | Defensive JSONB deserialization prevents string-scalar crash | unit | `pytest backend/tests/unit/test_stateful_workflows.py -k test_safe_jsonb_output_hydration` | ❌ W0 | ⬜ pending |
| 205-01-03 | 01 | 1 | STATE-01 | — | `{{prior_run.output}}` interpolated into phase prompt execution | unit | `pytest backend/tests/unit/test_stateful_workflows.py -k test_prior_run_template_interpolation` | ❌ W0 | ⬜ pending |
| 205-01-04 | 01 | 1 | STATE-02 | — | Output carries markdown delta badges + structured `deltas` payload | unit | `pytest backend/tests/unit/test_stateful_workflows.py -k test_state_delta_emission` | ❌ W0 | ⬜ pending |
| 205-01-05 | 01 | 1 | STATE-01 | — | Frontend Studio toggle persists `is_stateful` and renders chips | unit | `npm test -- src/components/workflows/builder/WorkflowSettings.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/unit/test_stateful_workflows.py` — unit test suite for stateful resolution, JSONB safety, and template injection
- [ ] `frontend/src/components/workflows/builder/WorkflowSettings.test.tsx` — unit tests for stateful setting and chips

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-08-24
