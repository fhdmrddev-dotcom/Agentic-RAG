---
phase: 146
slug: operator-foundation
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-10
---

# Phase 146 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (backend, in venv) + vitest (frontend) |
| **Config file** | backend/pytest.ini (existing) |
| **Quick run command** | `cd backend && venv/Scripts/python -m pytest tests/test_146_operator_gate.py tests/test_146_operator_seed.py -q` |
| **Full suite command** | `cd backend && venv/Scripts/python -m pytest -q` (backend) · `cd frontend && npx vitest run && npm run build` (frontend) |
| **Estimated runtime** | ~30 seconds (quick) / ~3 min (full) |

---

## Sampling Rate

- **After every task commit:** Run the quick run command
- **After every plan wave:** Run the full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

*Filled by the planner from RESEARCH.md `## Validation Architecture` + the final 6-plan task set.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-T1 | 146-01 | 1 | ADMIN-01 (D-05, D-06) | T-146-04, T-146-09, T-146-07 | operator_users has NO org_id (org-agnostic principal); audit actor PLAIN uuid NO FK; RLS enabled, ZERO policies (deny-all) | source assertion (grep gates) | plan 01 Task 1 `<automated>` grep chain on `supabase/migrations/095_operator_foundation.sql` | ❌ created in-task | ⬜ |
| 01-T2 | 146-01 | 1 | ADMIN-01 (D-05) | T-146-04 | org_id stub on documents/folders/threads/skills only; NO index/FK/backfill | source assertion (grep gates) | plan 01 Task 2 `<automated>` grep chain on `supabase/migrations/096_org_id_stub_sweep.sql` | ❌ created in-task | ⬜ |
| 01-T3 | 146-01 | 1 | ADMIN-01 | — | migrations LIVE in local DB before any code that reads the tables is verified | **[BLOCKING] checkpoint:human-action** + grep | operator pastes SQL in Supabase SQL editor → `bash scripts/regenerate-full-schema.sh` → `grep -q operator_audit_log supabase/full-schema.sql` | ❌ regenerated in-task | ⬜ |
| 02-T1 | 146-02 | 1 | ADMIN-01 (D-03) | T-146-07, T-146-05 | audit write swallows-never-raises; seed SQL parameterized + ON CONFLICT; Wave-0 gate tests scaffolded RED | unit scaffold (Wave 0) | `cd backend && venv/Scripts/python -m pytest tests/test_146_operator_gate.py --collect-only -q` | ❌ Wave 0 (this task creates it) | ⬜ |
| 02-T2 | 146-02 | 1 | ADMIN-01 (D-02, D-03) | T-146-02, T-146-07 | 404 raised as literal `{"detail":"Not Found"}`; floor is yield-teardown, early-returns when gate 404'd; old config field deleted | source assertion + import check | plan 02 Task 2 `<automated>` grep chain + `python -c "import app.dependencies"` | n/a | ⬜ |
| 02-T3 | 146-02 | 1 | ADMIN-01 (D-02, D-03, D-09 #1) | T-146-01, T-146-02, T-146-06 | route-enumeration 404 for non-operator on EVERY /admin route; byte-identity vs unknown-route 404 (pins RESEARCH A1); operator reaches backpressure; floor writes once, probe exempt | unit (the ADMIN-01 regression suite) | `cd backend && venv/Scripts/python -m pytest tests/test_146_operator_gate.py -x -q` | ❌ Wave 0 (02-T1) | ⬜ |
| 03-T1 | 146-03 | 2 | ADMIN-01 (D-01) | T-146-08 | seed called in lifespan best-effort (logs + continues, never blocks startup), after pool init | source assertion + ast parse | `grep -q seed_operators_from_env app/main.py && python -c "import ast; ast.parse(open('app/main.py').read())"` | n/a | ⬜ |
| 03-T2 | 146-03 | 2 | ADMIN-01 (D-01) | T-146-05, T-146-08 | INSERT ... ON CONFLICT (user_id) DO NOTHING; `$1::text[]` parameterized resolve; second run idempotent; unmatched email warned-not-inserted | unit | `cd backend && venv/Scripts/python -m pytest tests/test_146_operator_seed.py -x -q` | ❌ created in-task | ⬜ |
| 04-T1 | 146-04 | 2 | ADMIN-01 (D-07) | T-146-02 | getOperatorProbe returns null on 404 (non-operator = render nothing, no error-shape leak) | source assertion + typecheck | plan 04 Task 1 `<automated>` grep + `npx tsc --noEmit` | n/a | ⬜ |
| 04-T2 | 146-04 | 2 | ADMIN-01 (D-07) | T-146-06 | probe hook is render-only (documented); 200→isOperator true / 404→false | unit (vitest) | `cd frontend && npx vitest run src/hooks/useOperatorProbe.test.ts` | ❌ created in-task | ⬜ |
| 05-T1 | 146-05 | 3 | ADMIN-01 (D-07) | T-146-10 | OperatorBand zone identity (Shield not ShieldCheck, OPERATOR chip, recording marker); LockedTab has NO phase-number token | source assertion + typecheck | plan 05 Task 1 `<automated>` grep chain (incl. `phase 1xx` absence gate) + tsc | n/a | ⬜ |
| 05-T2 | 146-05 | 3 | ADMIN-01 (D-07) | — | four plain labels (Server capacity · Agents working · Database connections · Work spread) + raw-name reveal only when showTechnical | source assertion + typecheck | plan 05 Task 2 `<automated>` grep chain + tsc | n/a | ⬜ |
| 05-T3 | 146-05 | 3 | ADMIN-01 (D-08) | — | ledger-is-receipt card: plain label shown (not action code), ✎ only when is_write, no toast/counter | source assertion + typecheck | plan 05 Task 3 `<automated>` grep chain + tsc | n/a | ⬜ |
| 06-T1 | 146-06 | 4 | ADMIN-01 (D-04, D-07, D-08) | T-146-10, T-146-11 | manual-refresh-only (no setInterval); ↻ Refresh re-fetches health THEN audit so the floor row visibly prepends; six tabs (2 live + 4 locked); no phase numbers | source assertion + typecheck | plan 06 Task 1 `<automated>` grep chain (incl. setInterval absence) + tsc | n/a | ⬜ |
| 06-T2 | 146-06 | 4 | ADMIN-01 (D-07) | T-146-06, T-146-02 | reachability triad complete; shield probe-gated OUTSIDE NAV_ITEMS; nav-items.ts untouched (git-diff gate) | source assertion + typecheck | plan 06 Task 2 `<automated>` grep chain + `git diff --name-only -- src/lib/nav-items.ts` empty | n/a | ⬜ |
| 06-T3 | 146-06 | 4 | ADMIN-01 (D-07) | T-146-02 | NAV_ITEMS carries no control-room entry (byte-identity regression-locked); frontend builds | unit (vitest) + build | `cd frontend && npx vitest run src/lib/nav-items.test.ts src/hooks/useOperatorProbe.test.ts && npm run build` | ❌ created in-task | ⬜ |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Wave-0 assertion test pinning the 404 byte-shape (gated `/admin` 404 == genuine unknown-route 404) per RESEARCH Assumption A1 — authored in Plan 02 Task 1 (`tests/test_146_operator_gate.py::test_admin_404_matches_unknown_route_404`), turned green in Plan 02 Task 3
- [ ] `tests/test_146_operator_gate.py` scaffolded RED before the gate lands (Plan 02 Task 1: route-enumeration + byte-identity + operator-present; floor-write/probe-exempt added in 02-T3)
- [ ] `conftest.py` `require_operator` override helper + `mock_execute_result.data=[]` non-operator branch (Plan 02 Task 1)
- [ ] `tests/test_146_operator_seed.py` (Plan 03 Task 2 — recorder-pool idiom)
- [ ] Frontend: `useOperatorProbe.test.ts` (Plan 04 Task 2) + `nav-items.test.ts` shield-absent regression (Plan 06 Task 3)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| D-09 scenario 1 — the invisible door | ADMIN-01 | Lived-experience UAT (G-4) | Fresh normal user: app byte-identical to today (no shield, no admin hints); any direct `/admin` API hit (correct method) returns a plain 404 indistinguishable from a nonexistent route. Fail = any visible trace, a 403, or a branded/differently-shaped error. |
| D-09 scenario 2 — the control room feels like a zone | ADMIN-01 | Lived-experience UAT (G-4) | Seeded operator: shield appears at rail bottom; band shows shield + "Control Room" + OPERATOR chip + identity + recording marker; 4 plain-labeled health signals; locked tabs say "coming soon" with NO phase numbers; ⌥ toggle reveals raw names. Fail = missing zone identity, jargon-first copy, or phase numbers leaking. |
| D-09 scenario 3 — the ledger is the receipt | ADMIN-01 | Lived-experience UAT (G-4) | ↻ Refresh slides "Viewed system health" into Recent operator actions + marker flash; the row persists across a page reload (it lives in `operator_audit_log`, not client state). Fail = no row, a toast instead, code-y labels, or the row vanishing on reload. |

All three driven live (Chrome MCP or operator-clicks) at phase verification. This phase is NOT SC#10 (no streaming / agent-loop / provider-routing surface) — the D-09 trio is the G-4 gate. Known accepted residual: the 405 method-mismatch fingerprint (T-146-03, RESEARCH A2) — scenario 1 tests correct-method hits.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (gate suite + seed suite + probe/nav vitest — each created by its owning task or earlier)
- [x] No watch-mode flags (all vitest invocations use `run`)
- [x] Feedback latency < 60s (quick command runs only the two 146 backend files)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending (execution flips per-task Status; D-09 rows flip at phase verification)
