---
phase: 114
slug: virtual-folders-range-date-filters-view-builder-sidebar
status: draft
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
| TBD | TBD | TBD | VIEW-03 | T-114-* | field whitelist + bound literals (SC#4 injection test stays green) | unit | `pytest tests/unit/test_114_view_filter_compiler.py -q` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/unit/test_114_view_filter_compiler.py` — operator→fragment compilation for `gte`/`lte`/`one_of`/`contains`/`is_empty` + the four relative-date forms; case-insensitive matching; the rewritten 113 containment-dict tests; SC#4 injection test (must stay green)
- [ ] `backend/tests/unit/test_114_typed_columns.py` (or integration) — GENERATED-column auto-backfill + deliberately-bad-date row against the full dataset; `document_type_norm` lower() correctness
- [ ] `backend/tests/integration/test_114_resolve_range_date.py` — relative-date boundary correctness across month/day boundaries; count-only path vs full-resolve parity incl. the own+global double-count dedupe pitfall; `EXPLAIN` index-use at ~10k docs
- [ ] Frontend: filter-bar builder + Views sidebar group + NavRow primitive coverage (vitest)

*Reconcile against RESEARCH.md §"Validation Architecture" during planning.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Aether Deep Midnight theme + mobile-responsive + WCAG 2.1 AA (SC#4 / UX-01) | VIEW-03 / UX-01 | Visual/interaction quality not assertable from wire format | Chrome MCP: build a view, save it, open from sidebar, collapse sidebar→rail on panel open, both themes, mobile viewport, keyboard/touch reach the row actions |
| SC#3 `EXPLAIN` index-use at ~10k docs | VIEW-03 | Requires a ~10k seed (dev DB is ~19 docs) | Seed ~10k docs, run the documented `EXPLAIN` query, assert btree index scan not seq scan |

*Reconcile/expand during planning and `/gsd:validate-phase`.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
