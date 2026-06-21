---
phase: 119
slug: document-governance-health
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-21
updated: 2026-06-21
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
| 119-01-01 | 01 | 1 | DGOV-01 | T-119-01-01/02/03 | Wave-0 leak harness + signal scaffolds; two-user non-vacuity; masked-not-broken; A3 jsonb-path live-pin | integration + unit | `cd backend && source venv/Scripts/activate && python -m pytest tests/test_119_governance.py tests/unit/test_119_low_conf_scan.py -q` | ✅ | ✅ green |
| 119-01-02 | 01 | 1 | DGOV-01 | T-119-01-01/02/03/04/05 | 3 owner-scoped routes; broken=`_resolve_readable_latest` None + `_latest_exists_anywhere` masking-vs-deletion (D-119-3); unclassified=`status=="suggested"` (D-119-4); low-conf=any populated `_confidence<0.5` (D-119-5); `.eq(user_id,_uid)` sole gate; run_in_threadpool; no write path | integration (live :54322) + unit | `cd backend && source venv/Scripts/activate && python -m pytest tests/integration/test_119_*.py tests/test_119_governance.py tests/unit/test_119_low_conf_scan.py -q` | ✅ | ✅ green |
| 119-02-01 | 02 | 2 | DGOV-01, DGOV-02, UX-01 | T-119-02-02/03/04 | GovernanceRow link-out-only (no write import, D-119-6); GovernancePage init-guard (D-119-9) + own DocumentDetailPanel mount (DGOV-02) + positive empty state + WR-03 unresolvable-doc honest feedback; ConfidenceChip honest score | typecheck + vitest | `cd frontend && npx tsc --noEmit` | ✅ | ✅ green |
| 119-02-02 | 02 | 2 | DGOV-01, UX-01 | T-119-02-01 | Navigation triad (D-119-2): App.tsx union + nav-items entry + ChatLayout branch — ALL THREE in one task; reachable, not built-but-unreachable | typecheck | `cd frontend && npx tsc --noEmit` | ✅ | ✅ green |
| 119-02-03 | 02 | 2 | DGOV-01, DGOV-02 | T-119-02-01/02/03 | Vitest: reachability (renders GovernancePage not KnowledgeHealthPage); no-refetch-loop (one call per endpoint on empty); link-out (panel mounts, no write call); Refresh re-fires; WR-03 unresolvable-doc feedback | frontend (vitest) | `cd frontend && npx vitest run GovernancePage` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Executed-reality reconciliation (2026-06-21):** all 5 tasks shipped + GREEN live. Authoritative final run — **backend 27 passed** (`test_119_broken` / `test_119_unclassified` / `test_119_low_conf` / `test_119_leak` / `test_119_governance` / `test_119_low_conf_scan`, live :54322, non-vacuous two-user leak proof), **frontend GovernancePage 7 passed**, **tsc 0**. Coverage was STRENGTHENED post-code-review beyond the plan-time draft: the BUG-260620 fix added low-conf empty-field / user-confirmed / `_`-prefix exclusion regressions (unit + live `test_empty_field_low_confidence_does_not_surface`), and the WR-01/02/03 fixes added the broken-edge resolved-latest-id test + the WR-03 unresolvable-doc Vitest cases.

---

## Wave 0 Requirements

Authored in Plan 119-01 Task 1 (the 6 backend scaffolds) + Plan 119-02 Task 3 (the frontend test):

- [x] `backend/tests/integration/test_119_broken.py` — broken-edge detection + `test_masked_not_broken` + the A1 live deletion-semantics pin + WR-02 resolved-latest-id test (DGOV-01)
- [x] `backend/tests/integration/test_119_unclassified.py` — `status=="suggested"` surfaces, accepted/dismissed don't; A3 PostgREST jsonb-path live-pin (DGOV-01)
- [x] `backend/tests/integration/test_119_low_conf.py` — any populated `_confidence[field] < 0.5` surfaces; all-≥0.5 doesn't; `test_empty_field_low_confidence_does_not_surface` (BUG-260620 regression, non-vacuity twin) (DGOV-01)
- [x] `backend/tests/unit/test_119_low_conf_scan.py` — Python-scan edge cases (`0.0` counts, missing `_confidence` no error, non-numeric/None/bool guarded) + BUG-260620 empty-valued / user-confirmed / `_`-prefix exclusion cases
- [x] `backend/tests/integration/test_119_leak.py` — two-user own-scoping (clone `test_117_route_leak.py`); non-vacuous seeded true-positive per signal per user (low-conf seed populates `document_type` so the BUG-260620-guarded scan still surfaces it)
- [x] `backend/tests/test_119_governance.py` — empty-shape MagicMock unit tests (`{items:[], total:0}` per `_fetch_*`)
- [x] `frontend/src/pages/__tests__/GovernancePage.test.tsx` — nav reachability, link-out, no-refetch-loop, positive empty state, WR-03 unresolvable-doc feedback
- [x] Framework install: **none** — pytest + Vitest already present (no new package).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Status |
|----------|-------------|------------|--------|
| Mobile-responsive 3-stacked-cards layout | UX-01 | Visual / live-UI across viewports | ✅ VERIFIED LIVE 2026-06-21 (Chrome MCP @ 390px): 3 cards single-column, no horizontal overflow; detail panel = full-width bottom-sheet (`role=dialog`), not an overflowing side-split. Screenshot `screenshots/119-governance-mobile-*.png` |
| WCAG 2.1 AA (page tokens, contrast, keyboard, screen-reader) | UX-01 | Contrast + keyboard + SR are visual/interactive | ⏳ PENDING (operator hardware). Partial signals captured live: GovernanceRow is a real `<button>` with `aria-label "Open <filename>"` + `focus-visible` ring; loading uses `role=status`; the mobile panel is `role=dialog`. Full Tab/Enter-Space + NVDA/VoiceOver pass deferred to operator (119-HUMAN-UAT #4/#5) |
| Link-out correctness (DGOV-02 click-through) | DGOV-02 | The actual click-through into the correct DocumentDetailPanel is a lived-experience check | ✅ VERIFIED LIVE 2026-06-21 (Chrome MCP, seeded temp low-conf doc): row click opened the CORRECT doc's DocumentDetailPanel (push/split); panel AUTHOR "LOW · 0.30" matched the card chip; no inline write controls. Screenshot `screenshots/119-governance-clickthrough.png` |
| Empty → populated → empty transitions (honest counts, no loop) | DGOV-01 / D-119-9 | Steady-state behavior in a real library | ✅ VERIFIED LIVE 2026-06-21 (Chrome MCP): seeded → card showed 1 doc; deleted + Refresh → returned to 0 "Metadata looks solid"; Refresh-clears-init-guard re-fired the fetches (no re-fetch storm) |

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

**Approval:** ✅ NYQUIST-COMPLIANT — wave_0_complete: true. All DGOV-01/DGOV-02 behaviors have automated verification (backend 27 + frontend 7 green live 2026-06-21); UX-01 visual/a11y items are legitimately Manual-Only (3/4 verified live this session via Chrome MCP; keyboard + screen-reader deferred to operator). No MISSING automated gaps → no auditor/test-generation needed.

---

## Validation Audit 2026-06-21 (State A reconciliation)

| Metric | Count |
|--------|-------|
| Gaps found | 0 (no MISSING/PARTIAL automated coverage) |
| Resolved | 0 (none required) |
| Escalated | 0 |
| Automated tests green | backend 27 + frontend 7 (+ tsc 0), live :54322 |
| Manual-only items | 4 — 3 verified live (mobile, link-out, empty↔populated), 1 pending operator (WCAG keyboard/SR) |

Reconciled the plan-time draft (status:draft, all-pending) to executed reality: flipped all 5 Per-Task rows to ✅ green, wave_0_complete → true, status → validated. Coverage was strengthened post-code-review (BUG-260620 low-conf exclusion regressions + WR-01/02/03 fix tests). No `gsd-nyquist-auditor` spawn — there were no MISSING gaps to fill. SC#10 4-axis UAT remains N/A (read-only UI + REST router; no streaming/agent-loop/provider/thread-state surface).
