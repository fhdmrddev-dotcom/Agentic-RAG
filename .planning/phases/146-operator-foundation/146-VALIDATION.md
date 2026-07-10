---
phase: 146
slug: operator-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-10
---

# Phase 146 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (backend, in venv) |
| **Config file** | backend/pytest.ini (existing) |
| **Quick run command** | `cd backend && venv/Scripts/python -m pytest tests/test_admin_gate.py -q` |
| **Full suite command** | `cd backend && venv/Scripts/python -m pytest -q` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run the quick run command
- **After every plan wave:** Run the full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

*To be filled by the planner from RESEARCH.md `## Validation Architecture`.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Wave-0 assertion test pinning the 404 byte-shape (gated `/admin` 404 == genuine unknown-route 404) per RESEARCH Assumption A1

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| D-09 scenario 1 — the invisible door | ADMIN-01 | Lived-experience UAT (G-4) | Fresh normal user: app byte-identical to today; direct `/admin` API hits return plain 404 |
| D-09 scenario 2 — the control room feels like a zone | ADMIN-01 | Lived-experience UAT (G-4) | Seeded operator: shield, amber band, OPERATOR chip, 4 plain-labeled signals, locked tabs without phase numbers, ⌥ toggle |
| D-09 scenario 3 — the ledger is the receipt | ADMIN-01 | Lived-experience UAT (G-4) | ↻ Refresh slides "Viewed system health" into the feed + marker flash; row persists across reload |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
