# Phase 228 Plan 03 Summary: Cloud Subdomain Routing & Deployment Gating (Wave 3)

## Delivered Objectives
1. **Host-Scoped Vercel Routing Configuration (`DEBT-04` / `SEED-242`):**
   - In `frontend/vercel.json`:
     - Added host-scoped rewrites for `app.<domain>` (host pattern `app.*`) to `/app.html` for all paths `/(.*)`.
     - Added permanent (HTTP 308) redirects for `/app`, `/app/(.*)`, `/setup`, `/setup/(.*)`, `/invite`, and `/invite/(.*)` on root domains targeting `https://app.:host/...`.
     - Included negative lookahead `(?<host>^(?!app\\.).*)` in redirect host conditions to strictly prevent redirect loops on the app subdomain.
     - Preserved unconditioned fallback rewrites for `/app` and `/app/(.*)` to `/app.html` for single-domain and local fallback environments.
     - Preserved default filesystem serving of `/` to deliver `index.html` (public landing page) on the root domain.

2. **Routing Unit Test Suite:**
   - Authored `frontend/src/__tests__/routing/vercelRouting.test.ts` (6 tests, all passing), asserting valid schema, host-scoped rewrites, 308 redirects, loop prevention, and root landing preservation.
   - Pinned `vercelRouting.test.ts: 6` in `scripts/vitest-count-gate.cjs` `BASELINE` and added to `TARGETS`.

3. **Backend Origin & CORS Parity:**
   - In `backend/app/config.py`: Updated `primary_frontend_origin()` to prefer `://app.` origins when configured in `FRONTEND_URL` comma-separated list, seamlessly falling back to first-entry order.
   - Added unit test in `backend/tests/test_228_oauth_redis_resilience.py` verifying priority order and fallback behavior across multiple comma list permutations (10/10 passing).

4. **Deployment Artifact Parity & Operator Documentation:**
   - In `docker-compose.prod.yml` and `frontend/Dockerfile`: Added `VITE_DEMO_URL` and `VITE_APP_URL` build args and env mappings (satisfies preflight G-7).
   - In `docs/OPERATOR.md`: Authored full 7-step cutover guide for `app.<domain>` production routing and pre-promotion preview checklist.
   - In `docs/DEPLOYMENT-WORKFLOW.md`: Added subdomain routing row to cloud parity table and preview verification step to pre-promotion checklist.
   - Verified `bash scripts/check-deploy-drift.sh` passes cleanly with 0 drift.

## Verification Evidence
- `npx vitest run src/__tests__/routing/vercelRouting.test.ts`: 6/6 passed in 3ms
- `backend/venv/Scripts/pytest.exe backend/tests/test_228_oauth_redis_resilience.py -v`: 10/10 passed in 0.24s
- `bash scripts/check-deploy-drift.sh`: PASS (0 drift across preset keys, seeds, sandbox tag, and compose parse)

## Next Steps
Proceed to Wave 4 (Plan 228-04): Schema regeneration (`supabase/full-schema.sql`), verification debt closeout audit across Phases 210, 211, 214, 217, authoring `228-VERIFICATION.md` and `228-VALIDATION.md`, mechanical gate execution, and agent bus `BUS-104` answer.
