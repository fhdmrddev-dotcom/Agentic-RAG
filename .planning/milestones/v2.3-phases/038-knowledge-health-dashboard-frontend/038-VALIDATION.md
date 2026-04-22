---
phase: 38
slug: knowledge-health-dashboard-frontend
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-18
---

# Phase 38 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.0 |
| **Config file** | `frontend/vite.config.ts` |
| **Quick run command** | `cd frontend && npm test -- api` |
| **Full suite command** | `cd frontend && npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd frontend && npm test -- api`
- **After every plan wave:** Run `cd frontend && npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 38-01-01 | 01 | 1 | HLTH-05 | — | N/A (backend reingest endpoint) | unit (pytest) | `cd backend && source venv/Scripts/activate && pytest tests/ -k reingest -v` | ❌ W0 | ⬜ pending |
| 38-02-01 | 02 | 2 | HLTH-05 | — | `getKnowledgeHealthSummary` builds correct URL with stale_days | unit (api.ts) | `cd frontend && npm test -- api` | ❌ W0 | ⬜ pending |
| 38-02-02 | 02 | 2 | HLTH-05 | — | `moveDocument` sends PATCH with correct body `{ folder_id }` | unit (api.ts) | `cd frontend && npm test -- api` | ❌ W0 | ⬜ pending |
| 38-02-03 | 02 | 2 | HLTH-05 | — | `reingestDocument` sends POST to correct URL `/documents/{id}/reingest` | unit (api.ts) | `cd frontend && npm test -- api` | ❌ W0 | ⬜ pending |
| 38-02-04 | 02 | 2 | HLTH-05 | — | `deleteDocument` already covered by existing api.test.ts | unit (api.ts) | `cd frontend && npm test -- api` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `frontend/src/__tests__/lib/api.test.ts` — add test cases for `getKnowledgeHealthSummary`, `moveDocument`, `reingestDocument` (covers HLTH-05 API layer)
- [ ] `backend/tests/test_reingest.py` (or add to existing document tests) — stubs for reingest endpoint unit tests

*Existing Vitest infrastructure covers all frontend phase requirements — no new framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Library Health view renders correctly in browser | HLTH-05 | UI rendering not testable via Vitest unit tests | Start dev server; navigate to Library Health via sidebar; verify 4 panels render, actions show on hover, empty states display for empty panels |
| Delete flow end-to-end | HLTH-05 | Dialog interaction and optimistic removal require browser | Click Trash2 on a row; confirm in dialog; verify row disappears immediately |
| Re-ingest flow end-to-end | HLTH-05 | Inline tooltip + loader animation require browser | Click RefreshCw; confirm inline; verify spinner shows then disappears |
| Move to Folder flow end-to-end | HLTH-05 | Folder Select and dialog require browser | Click FolderInput; verify dialog opens with folder list; select a folder; confirm; verify row updates |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
