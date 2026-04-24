---
phase: 31
slug: audit-log-settings-ui
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-14
---

# Phase 31 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x (backend) / vitest (frontend) |
| **Config file** | `backend/pytest.ini` / `frontend/vite.config.ts` |
| **Quick run command** | `cd backend && python -m pytest tests/test_audit.py -x -q` |
| **Full suite command** | `cd backend && python -m pytest -x -q && cd ../frontend && npm run test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && python -m pytest tests/test_audit.py -x -q`
- **After every plan wave:** Run `cd backend && python -m pytest -x -q && cd ../frontend && npm run test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 31-01-01 | 01 | 0 | AUDIT-04 | unit | `cd backend && python -m pytest tests/test_audit.py -x -q` | ❌ W0 | ⬜ pending |
| 31-01-02 | 01 | 1 | AUDIT-04 | integration | `cd backend && python -m pytest tests/test_audit.py::test_list_audit_log -x -q` | ❌ W0 | ⬜ pending |
| 31-01-03 | 01 | 1 | AUDIT-05 | integration | `cd backend && python -m pytest tests/test_audit.py::test_export_audit_log_csv -x -q` | ❌ W0 | ⬜ pending |
| 31-02-01 | 02 | 2 | AUDIT-04 | manual | browser smoke test | n/a | ⬜ pending |
| 31-02-02 | 02 | 2 | AUDIT-04 | manual | browser filter test | n/a | ⬜ pending |
| 31-02-03 | 02 | 2 | AUDIT-05 | manual | browser CSV download | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/test_audit.py` — test stubs for AUDIT-04 and AUDIT-05 routes
- [ ] `backend/tests/conftest.py` — add `.gte()` and `.range()` mock wiring to shared Supabase builder mock (currently missing, will cause AttributeError)

*Existing backend pytest infrastructure covers all other phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Paginated table renders audit entries | AUDIT-04 | Requires seeded DB data + browser | Open Settings, scroll to Audit Log section, verify table shows entries |
| Date-range filter pill changes displayed rows | AUDIT-04 | DOM interaction required | Click "7d" pill, verify only last-7-days entries shown |
| Action type dropdown filters rows | AUDIT-04 | DOM interaction required | Select "document.upload" from dropdown, verify only that type shown |
| Export CSV downloads file with correct data | AUDIT-05 | File download requires browser | Click Export CSV, verify file downloaded with correct headers and rows |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
