---
phase: 16
slug: skill-file-management-ui
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-04
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `frontend/vitest.config.ts` |
| **Quick run command** | `cd frontend && npx vitest run src/` |
| **Full suite command** | `cd frontend && npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd frontend && npx vitest run src/`
- **After every plan wave:** Run `cd frontend && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 16-01-01 | 01 | 1 | FILE-01 | unit | `cd frontend && npx vitest run src/lib/api.test.ts` | ❌ W0 | ⬜ pending |
| 16-01-02 | 01 | 1 | FILE-01 | unit | `cd frontend && npx vitest run src/lib/api.test.ts` | ❌ W0 | ⬜ pending |
| 16-02-01 | 02 | 2 | FILE-01 | unit | `cd frontend && npx vitest run src/lib/api.test.ts` | ❌ W0 | ⬜ pending |
| 16-02-02 | 02 | 2 | FILE-02 | manual | See Manual-Only Verifications | N/A | ⬜ pending |
| 16-02-03 | 02 | 2 | FILE-02 | manual | See Manual-Only Verifications | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `frontend/src/lib/api.test.ts` — stubs for uploadSkillFile, listSkillFiles, deleteSkillFile (FILE-01)
- [ ] `frontend/src/types/index.ts` — SkillFile interface added

*Existing vitest infrastructure covers the framework; only test stubs and type additions needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| File upload via SkillFormDialog UI renders and submits correctly | FILE-01 | Requires browser interaction with file picker | Open skill edit dialog → click Attach File → select a file → verify it appears in list |
| Delete file button removes entry from UI list | FILE-02 | Requires browser interaction | Open skill edit dialog → click delete on attached file → verify it disappears from list |
| Full E2E: upload → load_skill returns files[] → read_skill_file works | FILE-01, FILE-02 | Requires running LLM agent with backend | Upload file → send chat message that triggers load_skill → verify files[] in response |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
