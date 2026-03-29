---
phase: 02
slug: document-folder-integration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-21
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x |
| **Config file** | backend/pytest.ini (or pyproject.toml) |
| **Quick run command** | `cd backend && python -m pytest tests/integration/test_documents.py tests/integration/test_folders.py -x -q` |
| **Full suite command** | `cd backend && python -m pytest tests/ -x -q` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && python -m pytest tests/integration/test_documents.py tests/integration/test_folders.py -x -q`
- **After every plan wave:** Run `cd backend && python -m pytest tests/ -x -q`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | DOC-01, DOC-02 | integration | `cd backend && python -m pytest tests/integration/test_documents.py -x -q` | ✅ | ⬜ pending |
| 02-01-02 | 01 | 1 | FOLDER-04 | integration | `cd backend && python -m pytest tests/integration/test_folders.py -x -q` | ✅ | ⬜ pending |
| 02-01-03 | 01 | 1 | DOC-03 | integration | `cd backend && python -m pytest tests/integration/test_documents.py -x -q` | ✅ | ⬜ pending |
| 02-02-01 | 02 | 2 | DOC-01, DOC-02, DOC-03, FOLDER-04 | integration | `cd backend && python -m pytest tests/integration/test_documents.py tests/integration/test_folders.py -v` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements — `tests/integration/test_documents.py` and `tests/integration/test_folders.py` already exist. New test cases will be added to these files.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Migration 014 applied to Supabase | DOC-01, DOC-02 | Cannot verify remote DB from test env | Run migration in Supabase Studio SQL Editor, then verify columns exist: `SELECT column_name FROM information_schema.columns WHERE table_name = 'documents' AND column_name IN ('folder_id', 'full_markdown');` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
