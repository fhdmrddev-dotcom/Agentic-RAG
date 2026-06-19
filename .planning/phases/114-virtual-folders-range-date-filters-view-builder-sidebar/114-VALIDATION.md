---
phase: 114
slug: virtual-folders-range-date-filters-view-builder-sidebar
status: planned
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-19
---

# Phase 114 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Architecture derived from `114-RESEARCH.md` §"Validation Architecture" (line 472).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x (backend) · vitest + Testing Library (frontend) |
| **Config file** | `backend/pytest.ini` · `frontend/vitest.config.ts` |
| **Quick run command** | `cd backend && venv/Scripts/python -m pytest tests/unit/test_114_*.py -q` |
| **Full suite command** | `cd backend && venv/Scripts/python -m pytest tests/ -q` · `cd frontend && npm run test` |
| **Estimated runtime** | ~30–60 seconds (backend unit) |

---

## Sampling Rate

- **After every task commit:** Run quick command for the touched layer
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green + the SC#3 `EXPLAIN` index-use proof run against a ~10k seed
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

> Filled by the planner (per-task `<automated>` blocks) and reconciled by `/gsd:validate-phase`.
> Source criteria: ROADMAP SC#1–4 + VIEW-03 + the R-114-A/B contract in RESEARCH.md.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| P01-T1 | 114-01 | 1 | VIEW-03 / SC#1 | T-114-01-01..03 | additive AST widening; pre-114 rows parse | unit | `pytest tests/unit/test_114_view_filter_compiler.py -q` | ❌ W0 | ⬜ pending |
| P01-T2 | 114-01 | 1 | VIEW-03 / SC#1 | T-114-01-01/03 | Fragment output; bound literals; fail-closed KeyError | unit | `pytest tests/unit/test_114_view_filter_compiler.py -q` | ❌ W0 | ⬜ pending |
| P01-T3 | 114-01 | 1 | SC#4 / R-114-B | T-114-01-01/04 | injection test stays green; migration file ISO-regex date guard | unit | `pytest tests/unit/test_113_view_filter_compiler.py -q` | ✅ rewrite | ⬜ pending |
| P02-T1 | 114-02 | 2 | VIEW-03 / SC#1 / VIEW-06 | T-114-02-01/03/04 | two-leg caller-scoped resolve; server-clock relative-date | integration | `pytest tests/integration/test_114_resolve_range_date.py -q` | ❌ W0 | ⬜ pending |
| P02-T2 | 114-02 | 2 | VIEW-03 / D-114-15 / VIEW-06 | T-114-02-02 | count-only own+global DISTINCT dedupe | integration | `pytest tests/integration/test_114_count_only.py -q` | ❌ W0 | ⬜ pending |
| P03-T2 | 114-03 | 3 | VIEW-03 / SC#3 / R-114-B | T-114-03-01/03 | bad-date NULL; EXPLAIN index-use ~10k; full-schema regen | integration (live) | `pytest tests/integration/test_114_typed_columns.py tests/integration/test_114_explain_index.py -q` | ❌ W0 | ⬜ pending |
| P04-T1/2 | 114-04 | 1 | UX-01 / D-114-13 | T-114-04-01 | shared NavRow; folder refactor no-regression | frontend unit | `npm run test -- NavRow FolderNode FolderTree` | ❌ W0 (exists: FolderNode/Tree) | ⬜ pending |
| P04-T3 | 114-04 | 1 | UX-01 / D-114-14 | T-114-04-01 | Move-to-folder reuse; no drag-drop | frontend unit | `npm run test -- DocumentList` | ❌ W0 | ⬜ pending |
| P05-T2/3 | 114-05 | 4 | VIEW-03 / SC#2 / UX-01 | T-114-05-01/02 | type-aware operators; amber-at-zero count; Save-as-view | frontend unit | `npm run test -- FilterBar ConditionPopover RelativeDateControl` | ❌ W0 | ⬜ pending |
| P06-T1 | 114-06 | 5 | SC#2 / SC#3 / VIEW-06 | T-114-06-01/02 | Views group from NavRow; lazy/cached count; leak-safe | frontend unit | `npm run test -- ViewsGroup` | ❌ W0 | ⬜ pending |
| P06-T2 | 114-06 | 5 | SC#2 / D-114-17 / UX-01 | T-114-06-03 | view↔filter loading; sidebar→rail; state-based nav | frontend unit | `npm run test -- IngestionPage` | ❌ W0 (exists) | ⬜ pending |
| P06-T3 | 114-06 | 5 | SC#4 / UX-01 | — | G-4 lived-experience Chrome-MCP UAT (Aether/mobile/WCAG AA) | manual | Chrome MCP (manual-only) | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/unit/test_114_view_filter_compiler.py` — per-operator fragment compilation (gte/lte/one_of/contains/is_empty + the four relative-date forms); case-insensitive matching; SC#4 injection test (must stay green) — **Plan 01 Task 1**
- [ ] Rewrite `backend/tests/unit/test_113_view_filter_compiler.py` 3 containment tests → fragment shape (keep injection test byte-for-byte green) — **Plan 01 Task 3**
- [ ] `backend/tests/integration/test_114_resolve_range_date.py` — relative-date boundary correctness across month/day boundaries; widened-operator resolve; VIEW-06 leak-safety (typed-column assertions xfail until Plan 03 applies migration) — **Plan 02 Task 1**
- [ ] `backend/tests/integration/test_114_count_only.py` — count-only path vs full-resolve parity incl. own+global double-count dedupe — **Plan 02 Task 2**
- [ ] `backend/tests/integration/test_114_typed_columns.py` — GENERATED-column auto-backfill + deliberately-bad-date row against the full dataset; `document_type_norm` lower() correctness — **Plan 03 Task 2**
- [ ] `backend/tests/integration/test_114_explain_index.py` — ~10k-row seed + EXPLAIN index-use assertion (SC#3) — **Plan 03 Task 2**
- [ ] Frontend: `NavRow.test.tsx` — **Plan 04 Task 1**; `FilterBar.test.tsx`/`ConditionPopover.test.tsx`/`RelativeDateControl.test.tsx` — **Plan 05**; `ViewsGroup.test.tsx` — **Plan 06 Task 1**
- [ ] Framework: already installed (pytest, vitest) — no install needed.

*Reconcile against RESEARCH.md §"Validation Architecture" during planning.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Aether Deep Midnight theme + mobile-responsive + WCAG 2.1 AA (SC#4 / UX-01) | VIEW-03 / UX-01 | Visual/interaction quality not assertable from wire format | Chrome MCP (Plan 06 Task 3): build a view, save it, open from sidebar, collapse sidebar→rail on panel open, both themes, mobile viewport, keyboard/touch reach the row actions |
| SC#3 `EXPLAIN` index-use at ~10k docs | VIEW-03 | Requires a ~10k seed (dev DB is ~19 docs) | Plan 03 Task 2 seeds ~10k docs, runs the documented `EXPLAIN` query, asserts btree index scan not seq scan (automatable once seeded) |

*Reconcile/expand during planning and `/gsd:validate-phase`.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending (Wave 0 scaffolds authored during execution; reconcile at /gsd:validate-phase)
