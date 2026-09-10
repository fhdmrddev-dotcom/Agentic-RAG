---
phase: 228
slug: v3.9-closeout-the-debt-gets-a-number
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-09-04
updated: 2026-09-04
---

# Phase 228 — Validation Strategy & Evidence

> Validation contract and verification results for Milestone v3.9 Closeout (`DEBT-01` through `DEBT-05`).

---

## 1. Requirement Validation Matrix

| Requirement | Behavior / Truth to Prove | Validation Method | Automated Command / Test File | Status |
|---|---|---|---|---|
| **DEBT-01** | Full database schema artifact regenerated cleanly against live DB | Live database dump via script | `bash scripts/regenerate-full-schema.sh` | ✅ **PASS** (6582 lines, 0 git diff) |
| **DEBT-01** | Owed v3.9 verification rows accounted for | Exhaustive audit trail with explicit verdicts | `.planning/phases/228-v3.9-closeout-the-debt-gets-a-number/228-VERIFICATION.md` | ✅ **PASS** (100% rows accounted for) |
| **DEBT-02** | Failed/timed-out run shows "Retry turn" and deduplicates prompt | Unit component tests | `npx vitest run src/components/chat/__tests__/MessageItem.retry.test.tsx` | ✅ **PASS** (4/4 passed) |
| **DEBT-02** | Retry turn persists and forwards selected model and provider | Provider integration test | `npx vitest run src/components/chat/__tests__/MessageItem.retry.test.tsx` | ✅ **PASS** (model & provider asserted) |
| **DEBT-02** | Thread mount reconciles `cap_paused` run and restores Continue button | Component test + Backend serializer test | `npx vitest run src/components/chat/__tests__/MessageItem.capPaused.test.tsx` & `pytest backend/tests/test_228_cap_paused_reconcile.py` | ✅ **PASS** (5/5 FE, 1/1 BE passed) |
| **DEBT-02** | Historical tool cards suppress entrance animation | Component regression test | `npx vitest run src/components/chat/__tests__/RunCard.characterization.test.tsx` | ✅ **PASS** (`isStreaming={false}`) |
| **DEBT-03** | OAuth callback gracefully handles Redis outage with redirect | Backend integration test | `pytest backend/tests/test_228_oauth_redis_resilience.py` | ✅ **PASS** (10/10 passed) |
| **DEBT-03** | Multi-agent cloud security review (`/code-review ultra`) | Operator-triggered review | Documented as blocked on operator | ⛔ **BLOCKED ON OPERATOR** |
| **DEBT-04** | Subdomain routing (`app.<domain>`), rewrites, and 308 redirects | Unit routing tests | `npx vitest run src/__tests__/routing/vercelRouting.test.ts` | ✅ **PASS** (6/6 passed) |
| **DEBT-04** | Backend CORS origin selection prefers `://app.` | Unit configuration tests | `pytest backend/tests/test_228_oauth_redis_resilience.py` | ✅ **PASS** (4 config tests passed) |
| **DEBT-04** | Cloud configuration and preview gating runbook | Documentation audit | `docs/OPERATOR.md` & `docs/DEPLOYMENT-WORKFLOW.md` | ✅ **PASS** (Runbook complete) |
| **DEBT-05** | Backend unit test failure count strictly capped at 71 | Mechanical gate script | `node scripts/check-backend-unit-baseline.cjs` | ✅ **PASS** (71 failed <= 71, 0 errors) |

---

## 2. Test Infrastructure & Gate Sampling

| Gate | Command | Baseline Limit | Measured at Close | Verdict |
|---|---|---|---|---|
| **Backend Unit Gate** | `node scripts/check-backend-unit-baseline.cjs` | `failed <= 71`, `errors == 0` | 71 failed, 3497 passed, 0 errors | ✅ **PASS** |
| **Frontend Count Gate**| `$env:GSD_VITEST_MAX_WORKERS="2"; node scripts/vitest-count-gate.cjs` | 0 failures, all pinned present | 0 failures, 219/219 pinned present | ✅ **PASS** |
| **Frontend Typecheck** | `cd frontend && npx tsc --noEmit -p tsconfig.app.json` | errors <= 66 | 66 errors (0 new) | ✅ **PASS** |
| **CLAUDE.md Size** | `node scripts/check-claude-md-size.cjs` | < 120,000 chars | 107,418 chars | ✅ **PASS** |
| **Deploy Drift** | `bash scripts/check-deploy-drift.sh` | 0 drift | 0 drift | ✅ **PASS** |

---

## 3. G-1 through G-9 Preflight Resolutions

- **G-1 & G-2:** G-2 resolved that `cap_paused` already had a primary source of truth in `runs.status` and was mapped via `workflowLock.capPaused`. The mount reconcile fix in `ChatArea.tsx` and `StreamsProvider.tsx` fixed the issue directly, rendering G-1 (enum widening) obsolete and preventing a redundant second source of truth.
- **G-3:** Explicit re-deferral entries and triggers added for `BUG-260823-03` and `BUG-260823-04`.
- **G-4:** DEBT-03 `/code-review ultra` recorded as operator-blocked with explicit credit trigger. Redis outage handling verified.
- **G-5:** Vitest count gate edits sequenced cleanly in Wave 2 and Wave 3 with `maxWorkers=2`.
- **G-6:** Frontend typecheck re-derived at 66 errors; in-scope suites tested deterministically.
- **G-7:** `docker-compose.prod.yml` and `frontend/Dockerfile` updated with `VITE_APP_URL` and `VITE_DEMO_URL`. Deploy drift check passes clean.
- **G-8:** `CONN-10` and `CONN-11` Phase 210 criteria recorded as structurally blocked on this install with explicit reasoning.
- **G-9:** Unmocked serializer integration test shipped in `backend/tests/test_228_cap_paused_reconcile.py`.
