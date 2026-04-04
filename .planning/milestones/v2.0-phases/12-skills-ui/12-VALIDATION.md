---
phase: 12
slug: skills-ui
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-01
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x + Testing Library React 16.x |
| **Config file** | `frontend/vitest.config.ts` |
| **Quick run command** | `cd "C:/Vibe Apps/Agentic RAG/frontend" && npm test` |
| **Full suite command** | `cd "C:/Vibe Apps/Agentic RAG/frontend" && npm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd "C:/Vibe Apps/Agentic RAG/frontend" && npm test`
- **After every plan wave:** Run `cd "C:/Vibe Apps/Agentic RAG/frontend" && npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 12-01-01 | 01 | 0 | SKIL-07 | unit | `npm test -- --reporter=verbose` | ❌ W0 | ⬜ pending |
| 12-01-02 | 01 | 0 | SKIL-07 | unit | `npm test -- --reporter=verbose` | ❌ W0 | ⬜ pending |
| 12-01-03 | 01 | 0 | SKIL-07 | unit | `npm test -- --reporter=verbose` | ❌ W0 | ⬜ pending |
| 12-02-01 | 02 | 1 | SKIL-07 | unit | `npm test -- --reporter=verbose` | ❌ W0 | ⬜ pending |
| 12-02-02 | 02 | 1 | SKIL-07 | unit | `npm test -- --reporter=verbose` | ❌ W0 | ⬜ pending |
| 12-02-03 | 02 | 1 | SKIL-07 | unit | `npm test -- --reporter=verbose` | ❌ W0 | ⬜ pending |
| 12-03-01 | 03 | 2 | SKIL-08 | manual | — | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `frontend/src/__tests__/components/SkillsPage.test.tsx` — stubs for SKIL-07 (render, badges, dimming)
- [ ] `frontend/src/__tests__/hooks/useSkills.test.ts` — stubs for SKIL-07 (optimistic updates, API calls)
- [ ] `frontend/src/__tests__/lib/api.test.ts` — extend existing file with skill API function tests

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| skill-creator global skill is seeded and visible in skills list to all users | SKIL-08 | Requires Supabase migration run + authenticated session to verify seed data | 1. Run migration; 2. Log in as any user; 3. Open Skills tab; 4. Confirm "skill-creator" skill appears with Global badge |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
