---
phase: 077
slug: multi-worker-validation-harness
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-26
---

# Phase 077 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 9.0.2 + pytest-asyncio 1.3.0 |
| **Config file** | `backend/pytest.ini` (asyncio_mode=auto) |
| **Quick run command** | `cd backend && venv/Scripts/pytest tests/integration/test_077_multi_worker.py -x -v` |
| **Full suite command** | `cd backend && venv/Scripts/pytest tests/integration/test_077*.py -v` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && venv/Scripts/pytest tests/integration/test_077_multi_worker.py -x -v`
- **After every plan wave:** Run `cd backend && venv/Scripts/pytest tests/integration/test_077*.py -v`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 077-01-01 | 01 | 1 | WORKER-LIFT-01a | T-077-01 | MOCK_LLM_MODE refuses start if ENVIRONMENT=production | integration | `pytest tests/integration/test_077_multi_worker.py::test_50_run_load -x` | ❌ W0 | ⬜ pending |
| 077-01-02 | 01 | 1 | WORKER-LIFT-01b | — | N/A | integration | `pytest tests/integration/test_077_multi_worker.py::test_concur01_multi_worker -x` | ❌ W0 | ⬜ pending |
| 077-01-03 | 01 | 1 | WORKER-LIFT-01e | — | N/A | integration | `pytest tests/integration/test_077_multi_worker.py::test_singleton_no_crosstalk -x` | ❌ W0 | ⬜ pending |
| 077-02-01 | 02 | 1 | WORKER-LIFT-01c | — | N/A | integration | `pytest tests/integration/test_077_cross_cancel.py -x` | ❌ W0 | ⬜ pending |
| 077-03-01 | 03 | 2 | WORKER-LIFT-01d | — | N/A | integration | `pytest tests/integration/test_077_sandbox_reattach.py -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/integration/test_077_multi_worker.py` — covers WORKER-LIFT-01a, 01b, 01e
- [ ] `tests/integration/test_077_cross_cancel.py` — covers WORKER-LIFT-01c
- [ ] `tests/integration/test_077_sandbox_reattach.py` — covers WORKER-LIFT-01d
- [ ] `app/_test_mock_llm.py` — env-var-gated mock LLM for subprocess injection
- [ ] Sandbox service modification for Docker container re-attach

*All test files are Wave 0 (created by this phase).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| None | — | — | — |

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
