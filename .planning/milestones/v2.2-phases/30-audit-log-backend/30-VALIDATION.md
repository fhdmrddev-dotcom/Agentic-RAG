---
phase: 30
slug: audit-log-backend
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-13
---

# Phase 30 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x |
| **Config file** | backend/pytest.ini or backend/pyproject.toml |
| **Quick run command** | `cd backend && python -m pytest tests/unit/test_audit_service.py -x -q` |
| **Full suite command** | `cd backend && python -m pytest tests/ -x -q` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && python -m pytest tests/unit/test_audit_service.py -x -q`
- **After every plan wave:** Run `cd backend && python -m pytest tests/ -x -q`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 30-01-01 | 01 | 1 | AUDIT-01/03 | migration | `supabase db diff` / manual SQL inspect | ✅ | ⬜ pending |
| 30-01-02 | 01 | 1 | AUDIT-03 | RLS | manual Supabase policy check | ✅ | ⬜ pending |
| 30-02-01 | 02 | 1 | AUDIT-06 | unit | `pytest tests/unit/test_audit_service.py -x -q` | ❌ W0 | ⬜ pending |
| 30-02-02 | 02 | 2 | AUDIT-01 | integration | `pytest tests/integration/test_audit_log.py -x -q` | ❌ W0 | ⬜ pending |
| 30-02-03 | 02 | 2 | AUDIT-02 | integration | `pytest tests/integration/test_audit_log.py -x -q` | ❌ W0 | ⬜ pending |
| 30-02-04 | 02 | 2 | AUDIT-06 | integration | `pytest tests/integration/test_audit_log.py -x -q` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/unit/test_audit_service.py` — stubs for audit_service write_audit_entry unit tests
- [ ] `backend/tests/integration/test_audit_log.py` — stubs for per-action-type integration tests (AUDIT-01, AUDIT-02, AUDIT-06)

*Existing infrastructure (pytest, conftest.py) covers test runner needs — only new test files needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| RLS blocks DELETE/UPDATE on audit_log | AUDIT-03 | Requires live Supabase session with user-role JWT | Log in as test user, attempt `DELETE FROM audit_log WHERE user_id = auth.uid()` via Supabase client — expect RLS error |
| Audit write never delays SSE stream | AUDIT-06 | Latency is subjective / requires real-time measurement | Send a chat message, measure SSE first-token latency before and after instrumentation — must be within noise |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
