---
phase: 136
slug: skill-publish-gate-gate-01
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-03
---

# Phase 136 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (backend, venv) / vitest (frontend) |
| **Config file** | `backend/pytest.ini` / `frontend/vitest.config.ts` |
| **Quick run command** | `cd backend && venv/Scripts/python -m pytest tests/ -k "publish_gate or toggle_global or create_skill" -q` |
| **Full suite command** | `cd backend && venv/Scripts/python -m pytest tests/ -q` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick command
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

> Filled by the planner — one row per task, derived from the Validation Architecture in 136-RESEARCH.md.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| — | — | — | GATE-01 | — | — | — | — | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Backend test module for the publish gate (gate compute, toggle refusal/override, create-path hard-set) — stubs for GATE-01

*Filled by the planner from the Validation Architecture section of 136-RESEARCH.md.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| G-4 lived UAT — publish dialog both ways (gate unmet block + evidence + override; gate met satisfied status), SkillEvalSection status line, re-share gating | GATE-01 | User-visible dialog UX; lived-experience bar per G-4 | Drive live app: attempt share on never-evaled skill → blocked w/ evidence + override affordance; run passing eval → share succeeds w/ satisfied status; unshare → re-share re-gates |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
