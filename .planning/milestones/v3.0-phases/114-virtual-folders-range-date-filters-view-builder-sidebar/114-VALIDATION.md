---
phase: 114
slug: virtual-folders-range-date-filters-view-builder-sidebar
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-19
validated: 2026-06-20
---

# Phase 114 — Validation Strategy

> Per-phase validation contract. Reconciled from the plan-time draft to executed
> reality by `/gsd:validate-phase` (2026-06-20): every task's tests RUN GREEN LIVE
> (not assumed — the "static would false-green" discipline). One stale assertion
> (`IngestionPage.test.tsx`) was reconciled to the Plan-06 dual-"Folders" composition.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x (backend) · vitest 4.x + Testing Library (frontend) |
| **Config file** | `backend/pytest.ini` · `frontend/vitest.config.ts` |
| **Backend unit run** | `cd backend && venv/Scripts/python -m pytest tests/unit/test_114_*.py tests/unit/test_113_view_filter_compiler.py -q` |
| **Backend integration run** | `cd backend && venv/Scripts/python -m pytest tests/integration/test_114_*.py -q` (live DB :54322) |
| **Frontend run** | `cd frontend && npx vitest run src/components/ingestion/{ConditionPopover,RelativeDateControl,FilterBar,ViewsGroup}.test.tsx src/__tests__/components/{NavRow,FolderNode,FolderTree,DocumentList,IngestionPage}.test.tsx` |
| **Measured runtime** | backend ~16s (unit 0.5s + integration 10s + 10k-EXPLAIN 5.5s) · frontend ~3.5s |

---

## Validation Result (live run 2026-06-20)

| Layer | Files | Result |
|-------|-------|--------|
| Backend unit | `test_114_view_filter_compiler.py`, `test_113_view_filter_compiler.py` | **33 passed, 1 xfailed** |
| Backend integration | `test_114_resolve_range_date.py`, `test_114_count_only.py`, `test_114_typed_columns.py`, `test_114_resolve_adhoc.py` | **31 passed** |
| Backend integration (SC#3) | `test_114_explain_index.py` (10k seed + EXPLAIN) | **2 passed** |
| Frontend | 9 vitest files (88 cases) | **88 passed** |
| **Total** | | **154 passed, 1 xfailed, 0 failed** |

*The 1 xfail is a documented deferred unit case (number-range custom-field exempt — WR-01: rejected 422, not lexically compared).*

---

## Per-Task Verification Map

> Source criteria: ROADMAP SC#1–4 + VIEW-03 + VIEW-06 + the R-114-A/B contract in RESEARCH.md.

| Task ID | Plan | Requirement | Threat Ref | Secure Behavior | Test File | Status |
|---------|------|-------------|------------|-----------------|-----------|--------|
| P01-T1 | 114-01 | VIEW-03 / SC#1 | T-114-01-01..03 | additive AST widening; pre-114 rows parse | `unit/test_114_view_filter_compiler.py` | ✅ green |
| P01-T2 | 114-01 | VIEW-03 / SC#1 | T-114-01-01/03 | Fragment output; bound literals; fail-closed KeyError | `unit/test_114_view_filter_compiler.py` | ✅ green |
| P01-T3 | 114-01 | SC#4 / R-114-B | T-114-01-01/04 | injection test stays green; migration ISO-regex date guard | `unit/test_113_view_filter_compiler.py` | ✅ green |
| P02-T1 | 114-02 | VIEW-03 / SC#1 / VIEW-06 | T-114-02-01/03/04 | two-leg caller-scoped resolve; server-clock relative-date | `integration/test_114_resolve_range_date.py` | ✅ green |
| P02-T2 | 114-02 | VIEW-03 / D-114-15 / VIEW-06 | T-114-02-02 | count-only own+global DISTINCT dedupe | `integration/test_114_count_only.py` | ✅ green |
| P03-T2a | 114-03 | VIEW-03 / R-114-B | T-114-03-01/03 | bad-date→NULL full-dataset; auto-backfill; IMMUTABLE helper | `integration/test_114_typed_columns.py` | ✅ green |
| P03-T2b | 114-03 | VIEW-03 / **SC#3** | T-114-03-03 | 10k-seed EXPLAIN btree index-use (not seq scan) | `integration/test_114_explain_index.py` | ✅ green (promoted manual→automated) |
| P04-T1/2 | 114-04 | UX-01 / D-114-13 | T-114-04-01 | shared NavRow; folder refactor no-regression | `__tests__/components/{NavRow,FolderNode,FolderTree}.test.tsx` | ✅ green |
| P04-T3 | 114-04 | UX-01 / D-114-14 | T-114-04-01 | Move-to-folder reuse; no drag-drop | `__tests__/components/DocumentList.test.tsx` | ✅ green |
| P05-T2/3 | 114-05 | VIEW-03 / SC#2 / UX-01 | T-114-05-01/02 | type-aware operators; amber-at-zero count; Save-as-view | `ingestion/{FilterBar,ConditionPopover,RelativeDateControl}.test.tsx` | ✅ green |
| P06-T1 | 114-06 | SC#2 / SC#3 / VIEW-06 | T-114-06-01/02 | Views group from NavRow; lazy/cached count; leak-safe | `ingestion/ViewsGroup.test.tsx` | ✅ green |
| P06-T2 | 114-06 | SC#2 / D-114-17 / UX-01 | T-114-06-03 | view↔filter loading; sidebar→rail; state-based nav | `__tests__/components/IngestionPage.test.tsx` | ✅ green (assertion reconciled this run) |
| CR-01 | 114-02/review | SC#4 / VIEW-06 / D-114 | T-114-02-01/02/03 | stateless `POST /document-views/resolve`; caller-scoped; NO persist/NO audit; live injection | `integration/test_114_resolve_adhoc.py` | ✅ green (new endpoint from code review) |
| P06-T3 | 114-06 | SC#4 / UX-01 | — | G-4 lived-experience Chrome-MCP UAT (Aether/mobile/WCAG AA) | manual (see below) | ✅ performed PASSED |

*Status: ✅ green · ❌ red · ⚠️ flaky · manual-only listed below.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Status |
|----------|-------------|------------|--------|
| Aether Deep Midnight theme + mobile-responsive + keyboard/touch reach + WCAG 2.1 AA *visual quality* (SC#4 / UX-01) | VIEW-03 / UX-01 | Visual/interaction quality is not assertable from wire format or jsdom | **Performed PASSED** — Plan 06 Task 3 Chrome MCP G-4 UAT (114-06-SUMMARY: built a view, saved it, opened from sidebar, collapsed sidebar→rail on panel open, both themes, mobile viewport, row actions reachable) |

> **Promoted this audit (manual → automated):** the draft's "SC#3 `EXPLAIN` index-use at ~10k docs" manual-only item is now the automated `test_114_explain_index.py` (seeds ~10k docs, runs the EXPLAIN, asserts btree index scan) — mirrors the Phase-113 SC#3/VIEW-06 promotion.

> **App-wide follow-up (not a 114 gap):** exhaustive numeric WCAG 2.1 AA measurement (verify-work measured a11y 87) was routed to **SEED-092** as an app-wide accessibility pass — it is a cross-cutting completeness item, not a Phase-114 validation gap.

---

## Validation Sign-Off

- [x] All behavioral requirements have automated verification (run green live)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 scaffolds reconciled to executed reality; all green
- [x] No watch-mode flags
- [x] Feedback latency < 60s (full backend+frontend < 25s)
- [x] One inherently-visual item (G-4 UAT) documented manual-only — performed PASSED
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** VALIDATED 2026-06-20 — nyquist-compliant. 154 tests green live (66 backend + 88 frontend), 1 xfail (documented), 0 failed. One stale assertion reconciled (`IngestionPage.test.tsx` — Plan-06 dual-"Folders" composition).

---

## Validation Audit 2026-06-20

| Metric | Count |
|--------|-------|
| Requirements audited | 13 (12 task rows + 1 CR-01 endpoint) |
| COVERED (automated, green live) | 12 |
| Reconciled this run (stale assertion fixed) | 1 (`IngestionPage.test.tsx`) |
| Promoted manual → automated | 1 (SC#3 EXPLAIN index-use) |
| Manual-only (inherently visual, performed PASSED) | 1 (G-4 Chrome-MCP UAT) |
| MISSING | 0 |
| Auditor spawned | No — gaps were trivial test-staleness; orchestrator reconciled directly (Phase-113 precedent) |
