---
phase: 14
slug: code-execution-sandbox
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-03
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x |
| **Config file** | `backend/pytest.ini` or `pyproject.toml` |
| **Quick run command** | `cd backend && python -m pytest tests/test_sandbox.py -x -q` |
| **Full suite command** | `cd backend && python -m pytest tests/ -q` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && python -m pytest tests/test_sandbox.py -x -q`
- **After every plan wave:** Run `cd backend && python -m pytest tests/ -q`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 14-01-01 | 01 | 0 | SAND-01 | unit | `cd backend && python -m pytest tests/test_sandbox.py::test_sandbox_imports -x -q` | ❌ W0 | ⬜ pending |
| 14-01-02 | 01 | 0 | SAND-13 | unit | `cd backend && python -m pytest tests/test_sandbox.py::test_sandbox_disabled -x -q` | ❌ W0 | ⬜ pending |
| 14-02-01 | 02 | 1 | SAND-01, SAND-02 | integration | `cd backend && python -m pytest tests/test_sandbox.py::test_session_lifecycle -x -q` | ❌ W0 | ⬜ pending |
| 14-02-02 | 02 | 1 | SAND-03 | integration | `cd backend && python -m pytest tests/test_sandbox.py::test_session_persistence -x -q` | ❌ W0 | ⬜ pending |
| 14-03-01 | 03 | 2 | SAND-04, SAND-05 | integration | `cd backend && python -m pytest tests/test_sandbox.py::test_execute_code_streaming -x -q` | ❌ W0 | ⬜ pending |
| 14-04-01 | 04 | 2 | SAND-06, SAND-07 | integration | `cd backend && python -m pytest tests/test_sandbox.py::test_file_output_upload -x -q` | ❌ W0 | ⬜ pending |
| 14-05-01 | 05 | 3 | SAND-08, SAND-09 | integration | `cd backend && python -m pytest tests/test_sandbox.py::test_execute_code_tool -x -q` | ❌ W0 | ⬜ pending |
| 14-05-01 | 05 | 3 | SAND-10 | integration | `cd backend && python -m pytest tests/test_sandbox.py::test_thread_deletion_cleanup -x -q` | ❌ W0 | ⬜ pending |
| 14-05-02 | 05 | 3 | SAND-11 | integration | `cd backend && python -m pytest tests/test_sandbox.py::test_lifespan_close_all -x -q` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/test_sandbox.py` — test stubs for all SAND requirements
- [ ] `backend/tests/conftest.py` — update with sandbox fixtures (mock_session, mock_docker)
- [ ] `llm-sandbox[docker]>=0.3.37` — add to `backend/requirements.txt` and install

*Wave 0 creates all test stubs before any implementation begins.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real-time stdout streaming to frontend | SAND-05 | Requires live SSE browser observation | Open chat, send code prompt, watch stream in DevTools Network tab |
| Docker container resource limits enforced | SAND-09 | Requires Docker inspect | Run `docker inspect <container_id>` and verify memory/CPU limits |
| 30-minute TTL session eviction | SAND-02 | Requires waiting 30 min | Set TTL to 5s in test env, wait, verify session closed |
| Files downloadable via storage links | SAND-07 | Requires browser download | Click returned link, verify file downloads correctly |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
