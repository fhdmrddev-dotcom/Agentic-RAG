---
phase: 29
slug: document-versioning-ui
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-13
---

# Phase 29 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (backend) |
| **Config file** | `backend/pytest.ini` or `pyproject.toml` (existing) |
| **Quick run command** | `cd backend && python -m pytest tests/unit/test_document_versioning.py -x -q` |
| **Full suite command** | `cd backend && python -m pytest tests/ -x -q` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && python -m pytest tests/unit/test_document_versioning.py -x -q`
- **After every plan wave:** Run `cd backend && python -m pytest tests/ -x -q`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 29-01-01 | 01 | 1 | VER-03 | unit | `pytest tests/unit/test_document_versioning.py -x -q -k "list"` | ❌ W0 | ⬜ pending |
| 29-01-02 | 01 | 1 | VER-04 | unit | `pytest tests/unit/test_document_versioning.py -x -q -k "versions"` | ❌ W0 | ⬜ pending |
| 29-01-03 | 01 | 1 | VER-05 | unit | `pytest tests/unit/test_document_versioning.py -x -q -k "restore"` | ❌ W0 | ⬜ pending |
| 29-01-04 | 01 | 1 | VER-05 | unit | `pytest tests/unit/test_document_versioning.py -x -q -k "restore_null_folder"` | ❌ W0 | ⬜ pending |
| 29-01-05 | 01 | 1 | VER-05 | unit | `pytest tests/unit/test_document_versioning.py -x -q -k "restore_unauthorized"` | ❌ W0 | ⬜ pending |
| 29-02-01 | 02 | 2 | VER-03 | manual | manual — visual in browser | N/A | ⬜ pending |
| 29-02-02 | 02 | 2 | VER-04 | manual | manual — visual in browser | N/A | ⬜ pending |
| 29-02-03 | 02 | 2 | VER-05 | manual | manual — visual in browser | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/unit/test_document_versioning.py` — add stubs for:
  - `test_list_documents_filters_is_latest` — GET /documents returns only is_latest=True rows
  - `test_list_document_versions_returns_all` — GET /{id}/versions returns all versions ordered desc
  - `test_restore_promotes_target` — POST /{id}/restore sets is_latest=True on target
  - `test_restore_retires_siblings` — POST /{id}/restore sets is_latest=False on siblings
  - `test_restore_null_folder_uses_is_null` — sibling query uses IS NULL not = NULL for root docs
  - `test_restore_unauthorized_returns_404` — non-owner gets 404

*File exists from Phase 28 — append new test class or methods to existing file.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Version badge renders for docs with version_number > 1 | VER-03 | Visual UI component — no jsdom test setup | Upload a doc twice, verify badge shows "v2" in library |
| Version history panel expands with correct list | VER-04 | Visual UI interaction | Click expand on versioned doc, verify each row shows version, date, size |
| Restore action makes selected version active | VER-05 | End-to-end UI + DB flow | Click restore on v1, verify badge updates to reflect new latest |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
