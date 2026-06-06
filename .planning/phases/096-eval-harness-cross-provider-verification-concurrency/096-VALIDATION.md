---
phase: 096
slug: eval-harness-cross-provider-verification-concurrency
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-07
---

# Phase 096 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (backend) / vitest (frontend) |
| **Config file** | `backend/pytest.ini` / `frontend/vitest.config.ts` |
| **Quick run command** | `cd backend && venv/Scripts/python -m pytest tests/ -x -q` (scoped to touched test files per task) |
| **Full suite command** | backend: `venv/Scripts/python -m pytest tests/ -q` · frontend: `npm run test -- --run` |
| **Estimated runtime** | ~60-120 seconds |

> Frontend vitest has a documented ~16-failure pre-existing baseline cluster (SEED-056) — prove net-new=0 via baseline checkout comparison, never raw counts.

---

## Sampling Rate

- **After every task commit:** Run the scoped quick command for the touched module
- **After every plan wave:** Run the full suite command
- **Before `/gsd-verify-work`:** Full suite must be green (modulo documented vitest baseline)
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| (filled by planner) | — | — | EVAL-01 / EVAL-02 / CONC-01 | — | — | — | — | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] CI mock-provider structural test scaffolding (fake gateway adapter at `provider_gateway.open_stream` seam — see RESEARCH.md Wave 0 gap list)
- [ ] `eval_coverage` seed workflow migration (no workflow-authoring API exists; D-02 max-coverage workflow needs a numbered migration)
- [ ] Restart-smoke helper script skeleton (D-08)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live cross-provider eval (native-7) | EVAL-01 | Provider keys are localhost-only by design (D-01); operator-run | Run `scripts/eval_cross_provider.py` workflow mode; greppable scoreboard diff |
| uvicorn-restart-mid-workflow smoke ×3 kill points | EVAL-02 / SC#2,4 | Operator IS the restart mechanism (D-08); backend runs in visible terminal | Helper script seeds workflow, signals kill moment, asserts DB truth post-restart |
| 4-axis UAT scoreboard | EVAL-02 / SC#10 recipe | Lived-experience UAT — cross-provider × multi-tool × parallel-thread × long-message | Rows authored here per CLAUDE.md recipe; Chrome-MCP or operator-driven |
| Thread-switch <1s with ≥6 concurrent runs | CONC-01 / SC#5 | Real browser connection-pool behavior can't be unit-tested | ≥6 active runs streaming, switch threads, measure reconcile; assert D-11a capped-thread behavior (no live tokens until visited — designed) |
| Cross-tab GET <50ms during N=10 fan-out | CONC-01 / SC#3 | Live latency under real fan-out load | Poll `GET /admin/backpressure` + timed cross-tab GET during batch phase |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
