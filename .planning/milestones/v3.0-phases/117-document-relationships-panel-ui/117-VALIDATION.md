---
phase: 117
slug: document-relationships-panel-ui
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-20
reconciled: 2026-06-21
---

# Phase 117 — Validation Strategy

> Per-phase validation contract. **Reconciled 2026-06-21 (State A audit):** the plan-time
> draft below (all rows ⬜ pending / "File Exists ❌ W0") has been reconciled to executed
> reality — every Wave-0 test file now exists and runs GREEN on the live stack. Anchored by
> a fresh re-run during this validate-phase (backend 6 passed / 7 xpassed / 0 failed on
> :54322; frontend 4 files / 32 tests passed). No auditor spawn — zero coverage gaps
> (the 113/115/116 reconcile precedent). The "static would false-green" discipline
> (D-102/D-110-5): the leak-safety rows are proven by the LIVE two-user route test, not a
> label, and were independently re-confirmed live in verify-work (117-UAT.md 6/6).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Backend framework** | pytest + pytest-asyncio + psycopg2/supabase (live :54322); config `backend/pytest.ini` |
| **Frontend framework** | vitest@^4.1.0 + @testing-library/react@^16.3.2 + vitest-axe@^0.1.0; config `frontend/vitest.config.ts` |
| **Backend quick run** | `cd backend && venv/Scripts/python -m pytest tests/integration/test_117_*.py tests/unit/test_117_*.py -x` |
| **Backend regression (116 preservation)** | `cd backend && venv/Scripts/python -m pytest tests/ -k "116 or 117"` |
| **Frontend quick run** | `cd frontend && npm run test -- RelationshipsSection CreateLinkDialog DocumentDetailPanel.a11y --run` |
| **Estimated runtime** | backend ~8s (live), frontend ~6s |

---

## Sampling Rate

- **After every task commit:** the relevant `test_117_*` file(s), `-x`.
- **After every plan wave:** full `test_117_*` set + the 116 regression set + `npm run test` for touched frontend files.
- **Before `/gsd:verify-work`:** full backend + frontend green; LIVE two-user route leak + create/remove/re-fetch confirmed non-vacuous (run against :54322, not mocked).
- **Max feedback latency:** < 90s (backend live suite).

---

## Per-Task Verification Map (reconciled — all GREEN)

| Req / SC | Behavior | Test Type | Automated Command | File | Status |
|----------|----------|-----------|-------------------|------|--------|
| SC#1 / D-117-8 | Two-user ROUTE leak: masked target shows "linked document (no access)", never id/title — LIVE | integration (live) | `pytest tests/integration/test_117_route_leak.py -x` | test_117_route_leak.py (6) | ✅ green |
| SC#1 (regression) | The extraction preserves the agent tool's masking | integration (live) | `pytest tests/ -k "116_tool_leak or 116_tool_read"` | test_116_tool_* | ✅ green (116 preserved) |
| SC#1 | GET returns outgoing+incoming with direction+label+relationship_id over the full version set (follow-to-latest) | integration (live) | `pytest tests/integration/test_117_get_read.py -x` | test_117_get_read.py (4) | ✅ green |
| SC#1 | Shared `get_related_documents` called by BOTH route + agent handler (no fork) — grep guard | unit | `pytest tests/unit/test_117_no_fork.py -x` | test_117_no_fork.py (3) | ✅ green |
| SC#1 (oracle) | Uniform 404 on unreadable/unknown/**malformed** subject (no existence oracle; WR-01 regression) | integration (live) | `pytest tests/integration/test_117_route_leak.py -x` | test_117_route_leak.py | ✅ green |
| SC#2 | Create via POST (visible-both) → 201 → re-fetch reflects the new link live | integration (live) | `pytest tests/integration/test_117_get_read.py -x` | test_117_get_read.py | ✅ green |
| SC#2 | Remove via DELETE (either direction) → re-fetch reflects removal live | integration (live) | `pytest tests/integration/test_117_get_read.py -x` | test_117_get_read.py | ✅ green |
| SC#2 | RelationshipsSection re-fetches after create/remove (not optimistic; no Undo) | frontend unit | `npm run test -- RelationshipsSection` | RelationshipsSection.test.tsx (11) | ✅ green |
| SC#2 | Typeahead excludes self + already-linked-with-chosen-type; re-derives on rel-type change | frontend unit | `npm run test -- CreateLinkDialog` | CreateLinkDialog.test.tsx (8) | ✅ green |
| SC#3 | No aXe AA violations across populated/empty/loading/error/masked states | frontend a11y | `npm run test -- RelationshipsSection.a11y` | RelationshipsSection.a11y.test.tsx (6) | ✅ green |
| SC#3 | Combobox roles (combobox/listbox/option + activedescendant); remove ✕ keyboard + coarse-pointer reachable | frontend a11y | `npm run test -- RelationshipsSection.a11y` | RelationshipsSection.a11y.test.tsx | ✅ green |
| SC#3 / D-117-10 | Honest-states matrix: empty ≠ error ≠ loading; masked row is not error/empty | frontend unit | `npm run test -- RelationshipsSection` | RelationshipsSection.test.tsx | ✅ green |
| (panel shell) | DocumentDetailPanel mounts the Relationships section without a11y regression | frontend a11y | `npm run test -- DocumentDetailPanel.a11y` | DocumentDetailPanel.a11y.test.tsx (7) | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky. Totals: backend 13 (6+4+3) · frontend 32 (11+6+8+7) — all GREEN.*

---

## Honest-states matrix (D-117-10) — covered by RelationshipsSection.test.tsx + .a11y

| State | Render | Asserted |
|-------|--------|----------|
| populated | grouped Outgoing/Incoming + chips | ✅ |
| empty | "No relationships yet" + `+ Add link` (NOT an error) | ✅ |
| loading | `role="status"` skeleton/`↻`, no error text | ✅ |
| error | `role="alert"` "couldn't load", distinct from empty | ✅ |
| no-access (masked) | "linked document (no access)", `document_id:null`, still removable | ✅ |

---

## Manual-Only Verifications (G-4 lived-experience — COMPLETED in verify-work)

> All five executed Claude-driven (Chrome DevTools MCP + psycopg2 DB verification) and PASSED
> — see `117-UAT.md` (6/6). The two-user leak is ALSO automated (`test_117_route_leak.py`),
> so it is promoted to dual-covered; the remaining four are inherently manual (visual /
> cross-user browser / mobile coarse-pointer) and are now verified-complete.

| Behavior | Requirement | Coverage | Result |
|----------|-------------|----------|--------|
| Grouped sections + chips/inverse labels + masked row | SC#1 / REL-02 | manual (UAT #2) + component test | ✅ pass (DOM leak-check clean) |
| Create via typeahead | SC#2 | manual (UAT #3) + CreateLinkDialog test | ✅ pass (DB-confirmed re-fetch) |
| Remove (either direction + masked) | SC#2 | manual (UAT #4) + get_read test | ✅ pass (DB truth) |
| Mobile bottom-sheet + coarse-pointer ✕ | SC#3 / UX-01 | manual (UAT #5) | ✅ pass (computed opacity=1 on touch) |
| Two-user LIVE leak proof | SC#1 / D-117-8 | **automated** (test_117_route_leak) + manual (UAT #6) | ✅ pass (B→total 0, zero trace; A→real) |

---

## Validation Audit 2026-06-21

| Metric | Count |
|--------|-------|
| Requirements / SC rows | 13 |
| COVERED (automated, green) | 13 |
| PARTIAL | 0 |
| MISSING | 0 |
| Gaps resolved this audit | 0 (reconcile-only; tests already shipped + green) |
| Auditor spawned | no (zero gaps) |

---

## Validation Sign-Off

- [x] All tasks have automated verify or Wave-0 coverage
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all references (all files exist + green)
- [x] No watch-mode flags
- [x] Feedback latency < 90s
- [x] `nyquist_compliant: true` (all SC requirements have automated verification; manual-only items are the lived-experience layer, all completed in 117-UAT.md)

**Approval:** ✅ NYQUIST-COMPLIANT (reconciled 2026-06-21)
