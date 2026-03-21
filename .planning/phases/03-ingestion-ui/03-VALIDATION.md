---
phase: 3
slug: ingestion-ui
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-21
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.0 |
| **Config file** | frontend/vite.config.ts |
| **Quick run command** | `cd frontend && npm run test -- --run` |
| **Full suite command** | `cd frontend && npm run test -- --run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd frontend && npm run test -- --run`
- **After every plan wave:** Run `cd frontend && npm run test -- --run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 3-01-01 | 01 | 0 | UI-01 | unit | `cd frontend && npm run test -- --run src/__tests__/hooks/useFolders.test.ts` | yes (Plan 01 Task 2) | ⬜ pending |
| 3-01-02 | 01 | 1 | UI-01 | unit | `cd frontend && npm run test -- --run src/__tests__/hooks/useFolders.test.ts` | yes (Plan 01 Task 2) | ⬜ pending |
| 3-01-03 | 01 | 1 | UI-01 | unit | `cd frontend && npm run test -- --run src/__tests__/lib/buildFolderTree.test.ts` | yes (Plan 01 Task 1) | ⬜ pending |
| 3-02-01 | 02 | 1 | UI-02 | unit | `cd frontend && npm run test -- --run src/__tests__/components/FolderNode.test.tsx` | yes (Plan 02 Task 2) | ⬜ pending |
| 3-02-02 | 02 | 1 | UI-02 | unit | `cd frontend && npm run test -- --run src/__tests__/components/FolderTree.test.tsx` | yes (Plan 02 Task 2) | ⬜ pending |
| 3-03-01 | 03 | 1 | UI-03 | unit | `cd frontend && npm run test -- --run src/__tests__/components/FolderNode.test.tsx` | yes (Plan 02 Task 2) | ⬜ pending |
| 3-03-02 | 03 | 1 | UI-03 | unit | `cd frontend && npm run test -- --run src/__tests__/components/FolderNode.test.tsx` | yes (Plan 02 Task 2) | ⬜ pending |
| 3-04-01 | 04 | 2 | UI-04 | unit | `cd frontend && npm run test -- --run src/__tests__/components/IngestionPage.test.tsx` | yes (Plan 03 Task 1) | ⬜ pending |
| 3-04-02 | 04 | 2 | UI-04 | manual | N/A — realtime subscription | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `frontend/src/__tests__/hooks/useFolders.test.ts` — created by Plan 01 Task 2 (useFolders hook TDD)
- [x] `frontend/src/__tests__/lib/buildFolderTree.test.ts` — created by Plan 01 Task 1 (buildFolderTree TDD)
- [x] `frontend/src/__tests__/components/FolderTree.test.tsx` — created by Plan 02 Task 2 (FolderTree component TDD)
- [x] `frontend/src/__tests__/components/FolderNode.test.tsx` — created by Plan 02 Task 2 (FolderNode component TDD, covers create/rename/delete actions)
- [x] `frontend/src/__tests__/components/IngestionPage.test.tsx` — created by Plan 03 Task 1 (integration test)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Folder tree updates in real time without page reload | UI-04 | Supabase Realtime subscription cannot be unit-tested end-to-end | 1. Open ingestion page in browser. 2. In a second tab/Supabase Studio, create a folder. 3. Verify tree updates without refresh. |
| Upload targets correct folder and document appears under it | UI-04 | File upload + ingestion pipeline integration | 1. Select a folder in the tree. 2. Upload a file. 3. Confirm document appears under selected folder after ingestion completes. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
