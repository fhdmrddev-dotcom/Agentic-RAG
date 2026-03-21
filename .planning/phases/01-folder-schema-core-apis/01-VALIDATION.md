---
phase: "01"
slug: folder-schema-core-apis
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-21
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.0.0 + pytest-asyncio 0.24.0 + httpx 0.27.0 (all in requirements.txt) |
| **Config file** | None detected — needs `pytest.ini` or `[tool.pytest.ini_options]` in `pyproject.toml` (Wave 0) |
| **Quick run command** | `pytest backend/tests/integration/test_folders.py -x` |
| **Full suite command** | `pytest backend/tests/ -x` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pytest backend/tests/integration/test_folders.py -x`
- **After every plan wave:** Run `pytest backend/tests/ -x`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01-01 | 1 | FOLDER-01, 02, 03, 05 | integration (httpx) | `pytest backend/tests/integration/test_folders.py -x` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01-01 | 1 | FOLDER-01, 02, 03, 05 | integration (httpx) | `pytest backend/tests/integration/test_folders.py -x` | ❌ W0 | ⬜ pending |
| 1-02-01 | 01-02 | 2 | FOLDER-01, 02, 03, 05 | integration (httpx) | `pytest backend/tests/integration/test_folders.py -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/integration/test_folders.py` — folder CRUD integration tests (created by Plan 01-02)

*Note: `backend/tests/__init__.py`, `backend/tests/integration/__init__.py`, and `backend/tests/conftest.py` already exist from prior module work.*

---

## Requirement → Test Map

| Req ID | Behavior | Test Name |
|--------|----------|-----------|
| FOLDER-01 | Create root folder (parent_id=null) returns 201 with correct fields | `test_create_root_folder` |
| FOLDER-01 | Create nested folder (valid parent_id) returns 201 with parent_id set | `test_create_nested_folder` |
| FOLDER-02 | PATCH /folders/{id} updates name, does not change parent_id or children | `test_rename_folder` |
| FOLDER-03 | DELETE /folders/{id} cascades to nested subfolders | `test_delete_cascades` |
| FOLDER-05 | Global folder visible in other user's GET /folders response | `test_global_folder_visibility` |
| FOLDER-05 | Per-user folder NOT visible to other user | `test_private_folder_isolation` |

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Migration 013 applies cleanly | FOLDER-01–05 | Requires live Supabase instance | Run `013_folders.sql` in Supabase SQL editor, confirm `folders` table created with correct columns and RLS policies |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
