---
phase: 104
slug: pm-flagship-content-pack
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-14
---

# Phase 104 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: see `## Validation Architecture` in 104-RESEARCH.md.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x (backend) |
| **Config file** | backend/pytest.ini (existing) |
| **Quick run command** | `cd backend && venv/Scripts/python -m pytest tests/unit -q` |
| **Full suite command** | `cd backend && venv/Scripts/python -m pytest -q` |
| **Estimated runtime** | ~TBD seconds (planner to confirm) |

---

## Sampling Rate

- **After every task commit:** Run `{quick run command}`
- **After every plan wave:** Run `{full suite command}`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** {N} seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| {N}-01-01 | 01 | 1 | PM-01 | T-104-01 / — | {expected secure behavior or "N/A"} | unit | `{command}` | ✅ / ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Planner: populate this map against the failure modes in 104-RESEARCH.md `## Validation Architecture` — citation-gate false-green, integrity-gate false-green, RLS pollution (if seeded global), immutability-trigger UPDATE failure, GLM/MiniMax case-miss silent coerce, reasoning-truncation half-emit.*

---

## Wave 0 Requirements

- [ ] Test stubs for PM-01 (seed-script + seeded-def validation)
- [ ] Shared fixtures (mirror `backend/tests/fixtures/seed_library_asset.py` recipe)

*Planner to finalize; if existing infrastructure covers all phase requirements, state so explicitly.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SC#10 cross-provider 4-axis scoreboard (incl. long-message rows) | PM-01 | Live cross-provider runs; long-message stays manual per the UAT scoreboard recipe | See 104-RESEARCH.md `## Validation Architecture` — run the headline status-report fill across the pinned tier representatives + the DeepSeek/Moonshot truncation row |
| Charter author-driven proof (describe→draft→refine→publish through Workflows page) | PM-01 | Live UI authoring flow | See SC#1/SC#3 proof in 104-RESEARCH.md |
| Tweak → v(N+1) re-author proof on a seeded def | PM-01 | Live publish/fork flow | Fork published def → edit → re-publish; immutability trigger keeps v1 frozen |

*If any of the above become automatable during planning, move to the per-task map.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < {N}s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
