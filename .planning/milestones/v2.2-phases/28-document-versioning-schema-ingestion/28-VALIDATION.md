---
phase: 28
slug: document-versioning-schema-ingestion
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-12
---

# Phase 28 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x |
| **Config file** | backend/pytest.ini or pyproject.toml |
| **Quick run command** | `cd backend && python -m pytest tests/ -x -q` |
| **Full suite command** | `cd backend && python -m pytest tests/ -v` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && python -m pytest tests/ -x -q`
- **After every plan wave:** Run `cd backend && python -m pytest tests/ -v`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 28-01-01 | 01 | 1 | VER-01 | migration | `supabase db push && echo OK` | ❌ W0 | ⬜ pending |
| 28-01-02 | 01 | 1 | VER-01 | unit | `cd backend && python -m pytest tests/test_versioning.py -x -q` | ❌ W0 | ⬜ pending |
| 28-01-03 | 01 | 2 | VER-02 | unit | `cd backend && python -m pytest tests/test_versioning.py::test_old_chunks_excluded -x -q` | ❌ W0 | ⬜ pending |
| 28-01-04 | 01 | 2 | VER-06 | unit | `cd backend && python -m pytest tests/test_versioning.py::test_citation_version -x -q` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/test_versioning.py` — stubs for VER-01, VER-02, VER-06
- [ ] `backend/tests/conftest.py` — shared fixtures (if not already present)

*Wave 0 installs test stubs before implementation tasks begin.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Re-upload same filename creates new version in UI | VER-01 | Requires browser + file upload | Upload file, re-upload same name, check documents list shows v2 |
| Citation card shows "(v2)" suffix | VER-06 | Requires browser + chat | Ask question answered by versioned doc, verify citation badge shows version |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
