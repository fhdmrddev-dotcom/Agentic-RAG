---
phase: 119
slug: document-governance-health
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-21
---

# Phase 119 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x (backend, `backend/tests/`) / vitest (frontend, `*.test.tsx`) |
| **Config file** | `backend/pytest.ini` (backend); `frontend/vitest.config.ts` (frontend) |
| **Quick run command (backend)** | `cd backend && source venv/Scripts/activate && python -m pytest tests/test_119_governance.py tests/unit/test_119_low_conf_scan.py -q` |
| **Quick run command (frontend)** | `cd frontend && npx vitest run GovernancePage` |
| **Full suite command** | `cd backend && source venv/Scripts/activate && python -m pytest -q` + `cd frontend && npx vitest run` |
| **Live-DB tests** | `cd backend && source venv/Scripts/activate && python -m pytest tests/integration/test_119_*.py -q` (requires Supabase :54322) |
| **Estimated runtime** | backend unit ~5s, integration (live :54322) ~30-60s, frontend ~10s |

**Live-DB convention (the 113-118 standard):** integration tests live in `backend/tests/integration/`
and drive the REAL service-role supabase + a `TestClient` with `get_current_user`/`get_supabase`
dependency overrides against local Postgres `:54322` (asyncpg seed/teardown). Template:
`test_117_route_leak.py`. Unit tests with MagicMock builders live in `backend/tests/unit/` /
`backend/tests/` (template: `test_knowledge_health.py`).

---

## Sampling Rate

- **After every task commit:** Run the quick run command(s) for the touched side (backend/frontend)
- **After every plan wave:** Run the live integration suite (`test_119_*.py`) + `npx tsc --noEmit`
- **Before `/gsd:verify-work`:** Full suite green (backend + frontend); two-user leak proof non-vacuous
- **Max feedback latency:** ~60s (live integration)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 119-01-01 | 01 | 1 | DGOV-01 | T-119-01-01/02/03 | Wave-0 leak harness + signal scaffolds (RED-tolerant); two-user non-vacuity; masked-not-broken; A3 jsonb-path live-pin | integration + unit (scaffolds) | `cd backend && source venv/Scripts/activate && python -m pytest tests/test_119_governance.py tests/unit/test_119_low_conf_scan.py -q` | ❌ W0 (this task creates) | ⬜ pending |
| 119-01-02 | 01 | 1 | DGOV-01 | T-119-01-01/02/03/04/05 | 3 owner-scoped routes; broken=`_resolve_readable_latest` None (D-119-3); unclassified=`status=="suggested"` (D-119-4); low-conf=any `_confidence<0.5` (D-119-5); `.eq(user_id,_uid)` sole gate; run_in_threadpool; no write path | integration (live :54322) + unit | `cd backend && source venv/Scripts/activate && python -m pytest tests/integration/test_119_*.py tests/test_119_governance.py tests/unit/test_119_low_conf_scan.py -q` | ❌ W0 | ⬜ pending |
| 119-02-01 | 02 | 2 | DGOV-01, DGOV-02, UX-01 | T-119-02-02/03/04 | GovernanceRow link-out-only (no write import, D-119-6); GovernancePage init-guard (D-119-9) + own DocumentDetailPanel mount (DGOV-02) + positive empty state; ConfidenceChip honest score | typecheck (TDD via Task 3) | `cd frontend && npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 119-02-02 | 02 | 2 | DGOV-01, UX-01 | T-119-02-01 | Navigation triad (D-119-2): App.tsx union + nav-items entry + ChatLayout branch — ALL THREE in one task; reachable, not built-but-unreachable | typecheck | `cd frontend && npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 119-02-03 | 02 | 2 | DGOV-01, DGOV-02 | T-119-02-01/02/03 | Vitest: reachability (renders GovernancePage not KnowledgeHealthPage); no-refetch-loop (one call per endpoint on empty); link-out (panel mounts, no write call); Refresh re-fires | frontend (vitest) | `cd frontend && npx vitest run GovernancePage` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Authored in Plan 119-01 Task 1 (the 6 backend scaffolds) + Plan 119-02 Task 3 (the frontend test):

- [ ] `backend/tests/integration/test_119_broken.py` — broken-edge detection + `test_masked_not_broken` + the A1 live deletion-semantics pin (DGOV-01)
- [ ] `backend/tests/integration/test_119_unclassified.py` — `status=="suggested"` surfaces, accepted/dismissed don't; A3 PostgREST jsonb-path live-pin (DGOV-01)
- [ ] `backend/tests/integration/test_119_low_conf.py` — any `_confidence[field] < 0.5` surfaces; all-≥0.5 doesn't (DGOV-01)
- [ ] `backend/tests/unit/test_119_low_conf_scan.py` — Python-scan edge cases (`0.0` counts, missing `_confidence` no error, non-numeric/None/bool guarded)
- [ ] `backend/tests/integration/test_119_leak.py` — two-user own-scoping (clone `test_117_route_leak.py`); non-vacuous seeded true-positive per signal per user
- [ ] `backend/tests/test_119_governance.py` — empty-shape MagicMock unit tests (`{items:[], total:0}` per `_fetch_*`)
- [ ] `frontend/src/pages/__tests__/GovernancePage.test.tsx` — nav reachability, link-out, no-refetch-loop, positive empty state
- [ ] Framework install: **none** — pytest + Vitest already present (no new package).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Mobile-responsive 3-stacked-cards layout | UX-01 | Visual / live-UI across viewports | Chrome MCP: open Governance at 390px + desktop; confirm 3 cards stack single-column on mobile, no horizontal scroll |
| WCAG 2.1 AA (page tokens, contrast, keyboard) | UX-01 | Contrast + keyboard-reachability are visual/interactive | Chrome MCP / axe: tab to each row (focus-visible), confirm AA contrast on the Deep Midnight tokens |
| Link-out correctness into the right detail section | DGOV-02 | The actual click-through into the correct DocumentDetailPanel section is a lived-experience check | Click a broken / unclassified / low-conf row → confirm the doc's panel opens (Relationships / Classification / Metadata is the relevant section); v1 opens the panel by doc id (no openSection prop — A7) |
| Empty → populated → empty transitions (honest counts, no loop) | DGOV-01 / D-119-9 | Steady-state behavior in a real library | Seed then clear a signal; confirm counts update + no network re-fetch storm (DevTools Network) |

**SC#10 4-axis UAT — N/A (documented):** This phase is a read-only UI + a new REST router. It does
NOT touch streaming, the agent loop, provider routing, shared UI streaming state, or `threads.py`
(G-5 clean). The mandatory cross-provider × multi-tool × parallel-thread × long-message matrix is
**structurally inapplicable** (no provider path, no agent tool, no thread state). The relevant
lived-experience axes are the four manual rows above (mobile, AA, link-out, empty↔populated). Per the
UAT scoreboard recipe: noted as N/A with reason rather than padded.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (6 backend + 1 frontend test file, authored in 119-01 T1 + 119-02 T3)
- [x] No watch-mode flags (all `pytest`/`vitest run`/`tsc --noEmit` are one-shot)
- [x] Feedback latency < 60s (live integration)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready (wave_0_complete flips true once 119-01 T1 + 119-02 T3 land the scaffolds)
