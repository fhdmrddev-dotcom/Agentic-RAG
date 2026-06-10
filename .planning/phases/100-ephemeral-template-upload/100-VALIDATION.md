---
phase: 100
slug: ephemeral-template-upload
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-10
---

# Phase 100 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (backend, venv) / vitest (frontend) |
| **Config file** | `backend/pytest.ini` / `frontend/vitest.config.ts` |
| **Quick run command** | `cd backend && venv/Scripts/python -m pytest tests/ -x -q -k workspace` |
| **Full suite command** | `cd backend && venv/Scripts/python -m pytest tests/ -q` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run the quick run command
- **After every plan wave:** Run the full suite command
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

*(Filled by planner — one row per task with automated verification.)*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | — | — | TMPL-01 | — | — | — | — | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Backend test stubs for upload validation + expiry filtering (planner specifies exact files)

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

*(From CONTEXT.md G-4 lived-experience UAT rows — all 7 are MANDATORY, authored in this file per the UAT scoreboard recipe; live verification at phase verify.)*

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Upload→visible→readable (real docx → card + badge + countdown → agent reads in-thread) | TMPL-01 SC#1 | Lived-experience UI + live agent run | G-4 row 1 in 100-CONTEXT.md |
| Never-in-search proof (distinctive template text absent from KB search) | TMPL-01 SC#2 | Live KB + agent `search_documents` | G-4 row 2 |
| Expiry end-to-end (short TTL → vanishes → tool error → row AND Storage bytes gone) | TMPL-01 SC#3 | Wall-clock TTL + Storage inspection | G-4 row 3 |
| Bad-file rejection (renamed .exe / PDF → clean visible error, nothing persisted) | TMPL-01 / D-12 | UI error surface | G-4 row 4 |
| Run-straddles-expiry (run-pin extends file, run completes) | D-09 | Live workflow run timing | G-4 row 5 |
| Cross-user isolation (second user cannot list/download) | SC#1 RLS | Two live sessions | G-4 row 6 |
| No-template regression (NULL-expiry files byte-identical; templateless workflow unchanged) | D-11 RED LINE | Live regression sweep | G-4 row 7 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
