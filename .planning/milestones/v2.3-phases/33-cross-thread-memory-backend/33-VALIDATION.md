---
phase: 33
slug: cross-thread-memory-backend
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-16
---

# Phase 33 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest + pytest-asyncio |
| **Config file** | `backend/pytest.ini` (or `pyproject.toml`) |
| **Quick run command** | `cd backend && python -m pytest tests/unit/test_memory_tools.py -x -q` |
| **Full suite command** | `cd backend && python -m pytest tests/ -x -q` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && python -m pytest tests/unit/test_memory_tools.py -x -q`
- **After every plan wave:** Run `cd backend && python -m pytest tests/ -x -q`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 33-01-01 | 01 | 0 | MEM-01 | unit stub | `pytest tests/unit/test_memory_tools.py -x -q` | ❌ W0 | ⬜ pending |
| 33-xx-01 | xx | 1 | MEM-01 | unit | `pytest tests/unit/test_memory_tools.py::test_remember_upsert -x` | ❌ W0 | ⬜ pending |
| 33-xx-02 | xx | 1 | MEM-01 | unit | `pytest tests/unit/test_memory_tools.py::test_remember_key_normalization -x` | ❌ W0 | ⬜ pending |
| 33-xx-03 | xx | 1 | MEM-01 | unit | `pytest tests/unit/test_memory_tools.py::test_remember_empty_key -x` | ❌ W0 | ⬜ pending |
| 33-xx-04 | xx | 1 | MEM-01 | unit | `pytest tests/unit/test_memory_tools.py::test_recall_specific_key -x` | ❌ W0 | ⬜ pending |
| 33-xx-05 | xx | 1 | MEM-01 | unit | `pytest tests/unit/test_memory_tools.py::test_recall_all -x` | ❌ W0 | ⬜ pending |
| 33-xx-06 | xx | 1 | MEM-03 | unit | `pytest tests/unit/test_memory_tools.py::test_memory_injection_general_mode -x` | ❌ W0 | ⬜ pending |
| 33-xx-07 | xx | 1 | MEM-03 | unit | `pytest tests/unit/test_memory_tools.py::test_memory_injection_explorer_mode -x` | ❌ W0 | ⬜ pending |
| 33-xx-08 | xx | 1 | MEM-03 | unit | `pytest tests/unit/test_memory_tools.py::test_memory_injection_empty -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/unit/test_memory_tools.py` — stubs for MEM-01 and MEM-03 behaviors (upsert, key normalization, empty key guard, recall specific, recall all, injection in General Mode, injection absent in Explorer Mode, injection omitted when zero entries)

*Existing infrastructure (pytest) is already present — only the test file needs creating.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Memory write is non-blocking — chat response arrives before DB write confirms | MEM-01 (D-16) | Timing/async behavior hard to unit test without race conditions | Start a chat, say "remember that I prefer dark mode", observe streaming response arrives immediately; check Supabase logs show DB write completing shortly after |
| Memory injection visible in chat system prompt (General Mode, live) | MEM-03 | End-to-end SSE + system prompt composition | Add a memory entry directly in Supabase; start new General Mode conversation; open network tab — confirm system prompt contains `## User Memory` block |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
