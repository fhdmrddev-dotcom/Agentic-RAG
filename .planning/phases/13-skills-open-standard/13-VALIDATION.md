---
phase: 13
slug: skills-open-standard
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-02
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x |
| **Config file** | `backend/pytest.ini` or `backend/pyproject.toml` |
| **Quick run command** | `cd backend && python -m pytest tests/test_skills_export_import.py -x -q` |
| **Full suite command** | `cd backend && python -m pytest -x -q` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && python -m pytest tests/test_skills_export_import.py -x -q`
- **After every plan wave:** Run `cd backend && python -m pytest -x -q`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 13-01-01 | 01 | 0 | OPEN-01 | unit | `cd backend && python -m pytest tests/test_skills_export_import.py::test_export_stub -x -q` | ❌ W0 | ⬜ pending |
| 13-01-02 | 01 | 0 | OPEN-02 | unit | `cd backend && python -m pytest tests/test_skills_export_import.py::test_import_stub -x -q` | ❌ W0 | ⬜ pending |
| 13-02-01 | 02 | 1 | OPEN-01 | integration | `cd backend && python -m pytest tests/test_skills_export_import.py::test_export_zip_structure -x -q` | ❌ W0 | ⬜ pending |
| 13-02-02 | 02 | 1 | OPEN-03 | integration | `cd backend && python -m pytest tests/test_skills_export_import.py::test_export_attached_files -x -q` | ❌ W0 | ⬜ pending |
| 13-03-01 | 03 | 1 | OPEN-02 | integration | `cd backend && python -m pytest tests/test_skills_export_import.py::test_import_single_skill -x -q` | ❌ W0 | ⬜ pending |
| 13-03-02 | 03 | 1 | OPEN-04 | integration | `cd backend && python -m pytest tests/test_skills_export_import.py::test_import_path_traversal_rejected -x -q` | ❌ W0 | ⬜ pending |
| 13-04-01 | 04 | 1 | OPEN-05 | integration | `cd backend && python -m pytest tests/test_skills_export_import.py::test_bulk_import_partial_failure -x -q` | ❌ W0 | ⬜ pending |
| 13-05-01 | 05 | 2 | OPEN-06 | e2e | manual — browser UI | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/test_skills_export_import.py` — stubs for OPEN-01 through OPEN-06
- [ ] `backend/tests/conftest.py` — add `storage_download` mock fixture (gap identified in research)

*Existing pytest infrastructure covers the rest. Only the test file and conftest patch are needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Export button in Skills UI triggers ZIP download | OPEN-06 | Requires browser blob URL download flow | Open Skills page, click Export on a skill, verify ZIP downloads with correct filename |
| Import UI accepts ZIP file, shows success toast | OPEN-06 | Requires browser FormData upload interaction | Open Skills page, click Import, select a valid ZIP, verify skill appears in list |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
