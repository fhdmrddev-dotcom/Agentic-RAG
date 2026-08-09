---
phase: 181
slug: revert-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-24
---

# Phase 181 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `181-RESEARCH.md` → `## Validation Architecture`. The whole phase IS a tested
> acceptance gate (`test_revert_byte_identical`), so validation is first-class here.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (backend)** | pytest (Python 3.12) — `backend/tests/` |
| **Framework (frontend)** | vitest — `frontend/src/**/*.test.tsx` |
| **Config file** | `backend/tests/conftest.py` (existing); vitest config (existing) — no install |
| **Quick run command (backend)** | `cd backend && source venv/bin/activate && pytest tests/test_revert_byte_identical.py tests/test_181_*.py -q` |
| **Quick run command (frontend)** | `cd frontend && npm test -- revertByteIdentical` |
| **Full suite command** | `cd backend && pytest tests -q` + `cd frontend && npm test` (rides existing `backend-tests.yml` + `frontend-tests.yml` — no new CI job) |
| **Estimated runtime** | ~30s quick / full suite as today |

---

## Sampling Rate

- **After every task commit:** Run the quick backend + frontend commands above (< 30s).
- **After every plan wave:** Run the full `pytest tests -q` + `npm test`.
- **Before `/gsd:verify-work`:** Full suites green AND the scope-freeze diff check passes.
- **Max feedback latency:** ~30 seconds (quick), CI on push.
- **At live milestone-close:** re-run the same pytest + vitest against live/prod config
  (flag off) + an operator UAT row confirming nav + both doors + run surface match today.

---

## Per-Task Verification Map

| Task ID | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 181-*-off-map | 1 | REVERT-01 | T-181-fail-open | Flag off → `GET /features` returns `visual_workflow_canvas: false` for operator AND end-user | unit (pytest, monkeypatch) | `pytest backend/tests/test_revert_byte_identical.py::test_features_map_hides_canvas_from_everyone_when_off -x` | ❌ W0 | ⬜ pending |
| 181-*-404 | 1 | REVERT-01 | T-181-403-leak | Canvas-gated (canary) route returns **404** (never 403) for all callers when off | integration (pytest + TestClient) | `pytest backend/tests/test_revert_byte_identical.py::test_require_canvas_404s_when_off -x` | ❌ W0 | ⬜ pending |
| 181-*-flip-on | 1 | REVERT-01 | — | Operator flip on (`set_feature_visibility(...,"everyone")`) → map True + gate no-op | integration (pytest) | `pytest backend/tests/test_181_flip_on.py -x` | ❌ W0 | ⬜ pending |
| 181-*-nav | 2 | REVERT-01 | — | `visibleNavItems({...,visual_workflow_canvas:false})` has no canvas entry; `=true` reveals it | unit (vitest) | `npm test -- revertByteIdentical` | ❌ W0 | ⬜ pending |
| 181-*-no-regress | 1 | REVERT-02 | — | The 4 shipped governed features resolve unchanged (no Phase-148 regression) | unit (pytest) | `pytest backend/tests/test_revert_byte_identical.py::test_existing_governed_features_unchanged -x` | ❌ W0 | ⬜ pending |
| 181-*-render-guard | 2 | REVERT-02 | — | ChatLayout render guard returns the fallback (never the canvas) for a canvas `activeView` when off | component (vitest) | `npm test -- revertByteIdentical` | ❌ W0 | ⬜ pending |
| 181-*-scope-freeze | 3 | REVERT-02 | — | Two doors + run surface untouched — scope-freeze on the phase diff | manual/CI check | `git show --stat` MUST NOT include `WorkflowDoorSwitch.tsx` / `WorkflowBuilderPage.tsx` / `WorkflowsPage.tsx` / `PhaseTimeline.tsx` / `PhaseCard.tsx` | ❌ W0 | ⬜ pending |
| 181-*-live-close | — | REVERT-02 | — | Live milestone-close: same tests green vs live config + operator UAT | manual UAT | milestone-close checklist row | ❌ (documented at plan) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/test_revert_byte_identical.py` — the map/404/regression asserts (REVERT-01/02).
      Model after `backend/tests/test_148_visibility_cold_default.py` (monkeypatch the settings read).
- [ ] `backend/tests/test_181_*.py` — the `"off"` audience resolution + `require_canvas` 404 + flip-on.
- [ ] `frontend/src/.../revertByteIdentical.test.tsx` — nav-set parity + ChatLayout render-guard.
- [ ] A canary/test seam (D-181-04) so `require_canvas`'s 404 is testable in 181 before real canvas routes exist.
- Framework install: **none** — pytest + vitest already present.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Scope-freeze of doors + run surface | REVERT-02 | Proves ABSENCE from the diff — a diff-scope property, not a runtime assertion (a lightweight CI/script check is acceptable) | `git show --stat <phase-range>` and confirm none of the FROZEN files (D-181-08) appear |
| Live milestone-close byte-identity | REVERT-02 | Requires the live/prod config with the flag off + a human confirming nav/doors/run surface match today | Re-run the pytest + vitest against live config; operator walks nav + both doors + run surface |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (the 4 test files/seams above)
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
