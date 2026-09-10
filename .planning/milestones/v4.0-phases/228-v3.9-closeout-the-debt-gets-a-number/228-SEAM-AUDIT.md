# Phase 228 — Cross-Plan Seam Audit

Every file on the path between what one plan writes and another reads is named below, with its direction, readers, and verification mechanism.

---

## Seam 1: Plan 228-01 (Wave 1) → Plans 228-02, 228-03, 228-04

| Component | Detail |
|---|---|
| **What 228-01 writes** | `scripts/check-backend-unit-baseline.cjs` (enforces `failed <= 71`), `CLAUDE.md` (documents canonical command), `backend/app/api/connectors.py` (OAuth callback Redis outage handling), `backend/tests/test_228_oauth_redis_resilience.py`. |
| **What 228-02..04 read** | `scripts/check-backend-unit-baseline.cjs` gates all backend modifications to ensure no test count regressions occur. |
| **Files on the path in between** | 1. `scripts/check-backend-unit-baseline.cjs` (spawns pytest child process).<br>2. `backend/app/api/connectors.py` (consumed by FastAPI router).<br>3. `backend/tests/test_228_oauth_redis_resilience.py` (unit test suite). |
| **Failure mode guarded against** | Undetected regression in backend unit tests; unhandled 500 error when Redis is unavailable during OAuth callback. |
| **Verification mechanism** | `node scripts/check-backend-unit-baseline.cjs` and `backend/venv/Scripts/pytest.exe backend/tests/test_228_oauth_redis_resilience.py -v`. Exit code 0 required. |

---

## Seam 2: Plan 228-02 (Wave 2) → Plan 228-04 (Wave 4)

| Component | Detail |
|---|---|
| **What 228-02 writes** | `frontend/src/providers/StreamsProvider.tsx` (`retryTurn` forwarding model/provider), `frontend/src/components/chat/MessageItem.tsx` ("Retry turn" copy, `cap_paused` gating), `backend/app/api/threads.py` / `runs.py` (persisted `cap_paused`), `MessageItem.retry.test.tsx`, `MessageItem.capPaused.test.tsx`, `scripts/vitest-count-gate.cjs`. |
| **What 228-04 reads** | `scripts/vitest-count-gate.cjs` executes adopted suites; `228-VERIFICATION.md` verifies DEBT-02 criteria. |
| **Files on the path in between** | 1. `frontend/src/providers/StreamsProvider.tsx` (state store action).<br>2. `frontend/src/components/chat/MessageItem.tsx` (renders retry button and Continue card).<br>3. `backend/app/api/runs.py` (handles `continueRun` endpoint).<br>4. `scripts/vitest-count-gate.cjs` (vitest count gate). |
| **Failure mode guarded against** | Disconnect between frontend Continue card and backend `continueRun` endpoint across page reloads; prompt duplication or silent model drop on retry. |
| **Verification mechanism** | `npx vitest run src/components/chat/__tests__/MessageItem.retry.test.tsx src/components/chat/__tests__/MessageItem.capPaused.test.tsx` and full count gate run. |

---

## Seam 3: Plan 228-03 (Wave 3) → Plan 228-04 (Wave 4)

| Component | Detail |
|---|---|
| **What 228-03 writes** | `frontend/vercel.json` (host-scoped rewrites and 308 redirects), `backend/app/config.py` (CORS support for `app.<domain>`), `deploy/onebox.env.example`, `docs/OPERATOR.md`, `docs/DEPLOYMENT-WORKFLOW.md`, `frontend/src/__tests__/routing/vercelRouting.test.ts`. |
| **What 228-04 reads** | `scripts/check-deploy-drift.sh` verifies zero deploy drift; `228-VERIFICATION.md` records preview deploy verification requirements. |
| **Files on the path in between** | 1. `frontend/vercel.json` (Vercel deployment engine config).<br>2. `backend/app/config.py` (FastAPI CORS middleware).<br>3. `deploy/onebox.env.example` (deploy drift comparison target). |
| **Failure mode guarded against** | Deploy drift between `vercel.json` / env examples and documentation; broken redirects on root domain; CORS refusal on `app` subdomain. |
| **Verification mechanism** | `bash scripts/check-deploy-drift.sh` and `npx vitest run src/__tests__/routing/vercelRouting.test.ts`. |

---

## Seam 4: Plan 228-04 (Wave 4) → Milestone v4.0 Active Tree

| Component | Detail |
|---|---|
| **What 228-04 writes** | `supabase/full-schema.sql` (regenerated clean schema artifact), `228-VERIFICATION.md` (verdicts for all v3.9 owed rows), `228-VALIDATION.md` (matrix of DEBT requirements). |
| **What reviewers / downstream agents read** | Downstream phases (Phase 229 onwards) rely on zero unaddressed v3.9 debt, a truthful full-schema file for bootstrap testing, and green gate baselines. |
| **Files on the path in between** | 1. `supabase/full-schema.sql` (live DB schema dump).<br>2. `scripts/regenerate-full-schema.sh` (dump runner).<br>3. `scripts/vitest-count-gate.cjs` and `scripts/check-backend-unit-baseline.cjs`. |
| **Failure mode guarded against** | Out-of-sync full-schema artifact; unrecorded or silently dropped owed verification rows; false-positive test gating. |
| **Verification mechanism** | `git diff supabase/full-schema.sql`, all 4 mechanical gates (`vitest-count-gate`, `check-backend-unit-baseline`, `tsc`, `check-claude-md-size`). |

---
*Authored: 2026-09-04 | Builder: Gemini | Reviewer: Claude*
