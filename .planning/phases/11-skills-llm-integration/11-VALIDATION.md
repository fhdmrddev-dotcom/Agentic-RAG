---
phase: 11
slug: skills-llm-integration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-31
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (already installed) |
| **Config file** | `backend/pytest.ini` (or run via `pytest` from `backend/`) |
| **Quick run command** | `cd backend && python -m pytest tests/integration/test_threads_skills.py -x -q` |
| **Full suite command** | `cd backend && python -m pytest tests/ -q` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && python -m pytest tests/integration/test_threads_skills.py -x -q`
- **After every plan wave:** Run `cd backend && python -m pytest tests/ -q`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 0 | SKIL-09, SKIL-10, SKIL-11, SKIL-12, SKIL-13, FILE-04, FILE-05 | unit/integration | `cd backend && python -m pytest tests/integration/test_threads_skills.py -x -q` | ❌ W0 | ⬜ pending |
| 11-02-01 | 02 | 1 | SKIL-09 | unit | `pytest tests/integration/test_threads_skills.py::TestCatalogInjection -x` | ❌ W0 | ⬜ pending |
| 11-02-02 | 02 | 1 | SKIL-13 | unit | `pytest tests/integration/test_threads_skills.py::TestExplorerModeNoSkills -x` | ❌ W0 | ⬜ pending |
| 11-03-01 | 03 | 2 | SKIL-10, FILE-04 | integration | `pytest tests/integration/test_threads_skills.py::TestLoadSkill -x` | ❌ W0 | ⬜ pending |
| 11-03-02 | 03 | 2 | SKIL-11 | integration | `pytest tests/integration/test_threads_skills.py::TestSaveSkill -x` | ❌ W0 | ⬜ pending |
| 11-03-03 | 03 | 2 | FILE-05 | integration | `pytest tests/integration/test_threads_skills.py::TestReadSkillFile -x` | ❌ W0 | ⬜ pending |
| 11-03-04 | 03 | 2 | SKIL-12 | integration | `pytest tests/integration/test_threads_skills.py::TestSkillActivatedEvent -x` | ❌ W0 | ⬜ pending |
| 11-04-01 | 04 | 3 | SKIL-12 | manual | Open chat, trigger load_skill, observe skill_activated SSE event in browser DevTools | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/integration/test_threads_skills.py` — stubs for SKIL-09, SKIL-10, SKIL-11, SKIL-12, SKIL-13, FILE-04, FILE-05
- [ ] `conftest.py` already has all needed fixtures (`client`, `auth_headers`, `mock_builder`, `mock_execute_result`) — no new fixtures needed

*Existing test infrastructure in `backend/tests/conftest.py` fully covers the new test file's requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `skill_activated` SSE event received in frontend | SKIL-12 | SSE event flow requires live browser + streaming connection | 1. Open chat. 2. Ensure at least one skill is enabled. 3. Ask something that matches a skill. 4. Open DevTools Network tab, inspect SSE stream, verify `{"type":"skill_activated","skill_name":"..."}` event appears before `tool_end`. |
| Explorer Mode has no skill tools in LLM request | SKIL-13 | Tool list inspection requires live OpenAI API call | 1. Switch to Explorer Mode. 2. Send a message. 3. Verify no `load_skill`, `save_skill`, or `read_skill_file` in the OpenAI request payload (check LangSmith trace). |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
