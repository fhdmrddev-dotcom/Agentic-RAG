---
phase: 10
slug: agent-skills-core
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-29
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.x + httpx |
| **Config file** | `backend/pytest.ini` |
| **Quick run command** | `cd backend && python -m pytest tests/integration/test_skills.py -x -q` |
| **Full suite command** | `cd backend && python -m pytest -x -q` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && python -m pytest tests/integration/test_skills.py -x -q`
- **After every plan wave:** Run `cd backend && python -m pytest -x -q`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 0 | SKIL-01..06, FILE-01..03, FILE-06 | unit stubs | `pytest tests/integration/test_skills.py -x -q` | ❌ W0 | ⬜ pending |
| 10-02-01 | 02 | 1 | SKIL-01 | integration | `pytest tests/integration/test_skills.py::TestCreateSkill -x` | ❌ W0 | ⬜ pending |
| 10-02-02 | 02 | 1 | SKIL-02 | integration | `pytest tests/integration/test_skills.py::TestUpdateSkill -x` | ❌ W0 | ⬜ pending |
| 10-02-03 | 02 | 1 | SKIL-03 | integration | `pytest tests/integration/test_skills.py::TestDeleteSkill -x` | ❌ W0 | ⬜ pending |
| 10-02-04 | 02 | 1 | SKIL-04 | integration | `pytest tests/integration/test_skills.py::TestToggleEnabled -x` | ❌ W0 | ⬜ pending |
| 10-02-05 | 02 | 1 | SKIL-05, SKIL-06 | integration | `pytest tests/integration/test_skills.py::TestToggleGlobal -x` | ❌ W0 | ⬜ pending |
| 10-03-01 | 03 | 2 | FILE-01, FILE-03 | integration | `pytest tests/integration/test_skills.py::TestUploadFile -x` | ❌ W0 | ⬜ pending |
| 10-03-02 | 03 | 2 | FILE-02, FILE-06 | integration | `pytest tests/integration/test_skills.py::TestDeleteFile -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/integration/test_skills.py` — stubs for all 10 requirements (SKIL-01..06, FILE-01, FILE-02, FILE-03, FILE-06)
- [ ] No framework install needed — pytest + httpx already in requirements.txt
- [ ] `conftest.py` fixtures (`client`, `auth_headers`) already exist; file upload tests need `storage_bucket` mock via `_supabase.storage.from_.return_value`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Storage RLS blocks direct client access to other users' files | FILE-06 | Requires real Supabase instance with anon key | Log in as user A, upload file; log in as user B, attempt direct storage URL access — expect 403 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
