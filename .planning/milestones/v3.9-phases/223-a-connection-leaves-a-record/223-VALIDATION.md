---
phase: 223
slug: a-connection-leaves-a-record
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-09-02
---

# Phase 223 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.x (backend) / vitest (frontend) |
| **Config file** | `backend/pyproject.toml` / `frontend/vite.config.ts` |
| **Quick run command** | `pytest backend/tests/test_110_boot_guard.py && npm run test:unit -- MessageInput.connectors` |
| **Full suite command** | `pytest backend/tests/test_110_boot_guard.py backend/tests/test_223_dispatcher_audit.py backend/tests/test_223_grant_audit.py && node scripts/vitest-count-gate.cjs` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick run command
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green + live integration test executed
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 223-01-01 | 01 | 1 | SC#1, SC#5 | T-223-01 | Action types locked in sync between code and DB check constraint | unit | `pytest backend/tests/test_110_boot_guard.py` | ✅ | ⬜ pending |
| 223-02-01 | 02 | 1 | SC#1, SC#3 | T-223-02 | All 5 exit points write audit records with `arg_keys` only; truthful recovery copy emitted | unit | `pytest backend/tests/test_223_dispatcher_audit.py` | ❌ W0 | ⬜ pending |
| 223-03-01 | 03 | 1 | SC#1a | T-223-03 | "Always allow" on card and settings grant updates log receipts with actor attribution | unit | `pytest backend/tests/test_223_grant_audit.py` | ❌ W0 | ⬜ pending |
| 223-04-01 | 04 | 2 | SC#2 | T-223-04 | Armed connectors persist; restore keyed on Map.has() from last user message; explicit off stays off | unit | `npm run test:unit -- MessageInput.connectors` | ✅ | ⬜ pending |
| 223-05-01 | 05 | 2 | SC#4, SC#5 | T-223-05 | Live DB integration proves audit rows land in `public.audit_log` without swallowing | integration | `pytest backend/tests/integration/test_223_audit_live.py` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/test_223_dispatcher_audit.py` — unit tests for connector chat tool audit writes and timeout copy
- [ ] `backend/tests/test_223_grant_audit.py` — unit tests for `connector.grant` audit writes from both card and settings
- [ ] `backend/tests/integration/test_223_audit_live.py` — live un-mocked DB assertion for audit row persistence

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Browser reload in chat preserves armed connector chips | SC#2 | End-to-end browser session reload verification | Arm connector in chat, send message, reload browser (F5), verify connector chip remains armed |
| Explicit disarm stays off after reload | SC#2 | End-to-end browser disarm persistence | Click 'X' to disarm all connectors, send message, reload browser (F5), verify composer starts empty |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 20s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** 2026-09-02 (Gemini Builder)
