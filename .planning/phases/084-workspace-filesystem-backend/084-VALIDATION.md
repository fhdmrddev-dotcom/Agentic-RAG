---
phase: 084
slug: workspace-filesystem-backend
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-28
---

# Phase 084 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.x + pytest-asyncio |
| **Config file** | `backend/pytest.ini` |
| **Quick run command** | `cd backend && python -m pytest tests/unit/test_workspace_service.py -x` |
| **Full suite command** | `cd backend && python -m pytest tests/ -x --timeout=30` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && python -m pytest tests/unit/test_workspace_service.py -x`
- **After every plan wave:** Run `cd backend && python -m pytest tests/ -x --timeout=30`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 084-01-01 | 01 | 1 | WS-01, WS-05, WS-06 | T-084-01 (path traversal), T-084-02 (cross-user access) | Path validation rejects `..`; FK-chain RLS blocks cross-user reads; UNIQUE constraint prevents duplicate paths | integration | `pytest tests/unit/test_workspace_service.py::test_write_and_read -x` | ❌ W0 | ⬜ pending |
| 084-01-02 | 01 | 1 | WS-04, WS-05 | — | N/A | unit | `pytest tests/unit/test_workspace_service.py::test_versioning_and_diff -x` | ❌ W0 | ⬜ pending |
| 084-02-01 | 02 | 1 | WS-02 | T-084-03 (context leak) | workspace_read content capped at 8K chars; binary files return metadata only | unit | `pytest tests/unit/test_workspace_service.py::test_read_truncation -x` | ❌ W0 | ⬜ pending |
| 084-02-02 | 02 | 1 | WS-03 | — | N/A | unit | `pytest tests/unit/test_workspace_service.py::test_list_and_delete -x` | ❌ W0 | ⬜ pending |
| 084-03-01 | 03 | 2 | WS-01, WS-02, WS-03, WS-04, WS-07 | T-084-04 (DoS via large writes) | 10MB per-file cap enforced; 100-file soft limit returns warning | unit | `pytest tests/unit/test_workspace_tools.py -x` | ❌ W0 | ⬜ pending |
| 084-04-01 | 04 | 2 | WS-07, WS-08 | — | N/A | unit | `pytest tests/unit/test_workspace_service.py::test_sse_events -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/test_workspace_service.py` — stubs for WS-01 through WS-05, WS-07
- [ ] `tests/unit/test_workspace_tools.py` — stubs for tool handler dispatch for all 5 workspace tools
- [ ] `tests/integration/test_workspace_rls.py` — stubs for WS-06 (FK-chain RLS)
- [ ] Fixtures for mock asyncpg pool and supabase storage client

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Storage bucket upload for files > 256KB | WS-05 | Requires live Supabase Storage bucket | Write a 300KB file via workspace_write tool in agent chat; verify file accessible via REST endpoint |
| FK-chain RLS cross-user isolation | WS-06 | Requires two distinct authenticated users | Login as User A, create workspace file; login as User B in same thread (should fail RLS); verify 403 |
| SSE event delivery to frontend | WS-07 | Requires running frontend + backend | Write a workspace file; verify `workspace_file_written` event appears in browser DevTools EventSource |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
