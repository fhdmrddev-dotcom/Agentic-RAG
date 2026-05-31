---
phase: 092
slug: dual-mode-wiring-continue-button
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-31
---

# Phase 092 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Detailed per-task map is populated by the planner from RESEARCH.md `## Validation Architecture`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x (backend) + manual Chrome MCP UAT (frontend/cross-provider) |
| **Config file** | backend/pytest.ini (or pyproject) — confirm at Wave 0 |
| **Quick run command** | `cd backend && venv/Scripts/python -m pytest tests/ -q` |
| **Full suite command** | `cd backend && venv/Scripts/python -m pytest tests/ -v` |
| **Estimated runtime** | ~TBD seconds (planner confirms) |

---

## Sampling Rate

- **After every task commit:** Run quick run command
- **After every plan wave:** Run full suite command
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** TBD seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| _populated by planner_ | | | | | | | | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- _populated by planner from RESEARCH.md Validation Architecture_

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SC#3 per-thread lock NOT a global boolean | MODE-02 | Parallel-thread lived-experience gate (BUG-260523-01 pattern) — needs two live threads streaming | Thread A starts a workflow (locked + streaming); confirm Thread B's Deep/Harness toggle + composer + General/Explorer selector stay free |
| SC#10 4-axis cross-provider UAT | MODE-01/02, CONT-01 | Native-7 live workflow runs across providers; also unblocks 091's persisted cross-provider workflow UAT | Seed a workflow run per native provider × multi-tool × parallel-thread × long-message; verify no regressions |

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
