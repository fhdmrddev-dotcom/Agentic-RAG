---
phase: 120
slug: collision-fix-context-isolation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-22
---

# Phase 120 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Populated from RESEARCH.md `## Validation Architecture` (SC#1–4 map, headline
> live-repro regression test, SC#10 4-axis matrix). The planner fills the
> Per-Task Verification Map below from the plan tasks.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x (backend) |
| **Config file** | `backend/pytest.ini` / `backend/pyproject.toml` (existing) |
| **Quick run command** | `cd backend && venv/Scripts/python -m pytest <phase test files> -q` |
| **Full suite command** | `cd backend && venv/Scripts/python -m pytest -q` |
| **Estimated runtime** | ~TBD (planner to confirm against existing suite) |

---

## Sampling Rate

- **After every task commit:** Run quick command on the phase test files
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** TBD seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| {N}-01-01 | 01 | 1 | COLL-01 / CTX-01 | T-{N}-NN / — | {expected secure behavior or "N/A"} | unit | `{command}` | ✅ / ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Headline live-repro regression test (D-120-08) — FAILS before fix, PASSES after (per RESEARCH.md Validation Architecture)
- [ ] Shared fixtures for the COLL-01 sandbox-harvest repro + CTX-01 origin-filter cases

*Planner to finalize against existing `test_075_4_dedup_supersedes.py` / `test_sandbox_service.py` scaffolds.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SC#10 4-axis live UAT (cross-provider native-7 × multi-tool × parallel-thread × ≥50-msg) | COLL-01 / CTX-01 | Live cross-provider streaming + real sandbox; re-run of live thread 99af24d5 | Per RESEARCH.md SC#10 matrix; authored under VALIDATION.md rows, not PLAN tasks (UAT scoreboard recipe) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < TBDs
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
