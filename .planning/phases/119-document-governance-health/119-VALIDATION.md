---
phase: 119
slug: document-governance-health
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-21
---

# Phase 119 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x (backend) / vitest (frontend) |
| **Config file** | `backend/pytest.ini` (backend); `frontend/vitest.config.ts` (frontend) |
| **Quick run command** | `cd backend && venv/Scripts/python -m pytest tests/test_119_*.py -q` |
| **Full suite command** | `cd backend && venv/Scripts/python -m pytest -q` |
| **Estimated runtime** | ~TBD seconds (planner to confirm) |

---

## Sampling Rate

- **After every task commit:** Run quick run command
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** TBD seconds

---

## Per-Task Verification Map

> Populated by gsd-planner from RESEARCH.md `## Validation Architecture`.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 119-01-01 | 01 | 1 | DGOV-01 | — | TBD | unit | `TBD` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

> Populated by gsd-planner.

- [ ] `backend/tests/test_119_governance.py` — stubs for DGOV-01 / DGOV-02
- [ ] shared fixtures (two-user leak harness, mirror `test_117_route_leak.py`)

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| TBD (cross-provider live UAT, mobile-responsive, WCAG AA) | UX-01 | Visual / live-UI | populated by planner |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < TBDs
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
