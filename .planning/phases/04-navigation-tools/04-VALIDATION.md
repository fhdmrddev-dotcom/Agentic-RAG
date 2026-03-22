---
phase: 4
slug: navigation-tools
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-21
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.x + pytest-asyncio 0.24.0 |
| **Config file** | `backend/pytest.ini` |
| **Quick run command** | `cd backend && python -m pytest tests/integration/test_kb.py -x -q` |
| **Full suite command** | `cd backend && python -m pytest tests/ -q` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && python -m pytest tests/integration/test_kb.py -x -q`
- **After every plan wave:** Run `cd backend && python -m pytest tests/ -q`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 4-01-01 | 01 | 0 | TOOL-01 | integration | `pytest tests/integration/test_kb.py -x` | ❌ W0 | ⬜ pending |
| 4-01-02 | 01 | 0 | TOOL-02 | integration | `pytest tests/integration/test_kb.py -x` | ❌ W0 | ⬜ pending |
| 4-02-01 | 02 | 1 | TOOL-01 | integration | `pytest tests/integration/test_kb.py::TestLs -x -q` | ❌ W0 | ⬜ pending |
| 4-02-02 | 02 | 1 | TOOL-01 | integration | `pytest tests/integration/test_kb.py::TestLs::test_ls_root -x` | ❌ W0 | ⬜ pending |
| 4-02-03 | 02 | 1 | TOOL-01 | integration | `pytest tests/integration/test_kb.py::TestLs::test_ls_rls -x` | ❌ W0 | ⬜ pending |
| 4-03-01 | 03 | 1 | TOOL-02 | integration | `pytest tests/integration/test_kb.py::TestTree -x -q` | ❌ W0 | ⬜ pending |
| 4-03-02 | 03 | 1 | TOOL-02 | integration | `pytest tests/integration/test_kb.py::TestTree::test_tree_depth_truncation -x` | ❌ W0 | ⬜ pending |
| 4-03-03 | 03 | 1 | TOOL-02 | integration | `pytest tests/integration/test_kb.py::TestTree::test_tree_rls -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/integration/test_kb.py` — test stubs for all TOOL-01 and TOOL-02 cases (9 tests)
- [ ] `backend/app/api/kb.py` — router skeleton (empty implementations)
- [ ] `backend/app/models/kb.py` — LsResponse, TreeNode, TreeResponse Pydantic models

*Existing `backend/tests/conftest.py` covers all fixtures needed (`client`, `auth_headers`, `mock_builder`, `mock_execute_result`).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| RLS correctly hides other users' private folders | TOOL-01, TOOL-02 | Requires two real Supabase user sessions | Create two users; upload folders for each; verify ls/tree for user A does not return user B's private folders |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
