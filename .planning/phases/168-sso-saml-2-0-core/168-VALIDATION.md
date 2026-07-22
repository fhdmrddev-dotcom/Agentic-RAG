---
phase: 168
slug: sso-saml-2-0-core
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-22
---

# Phase 168 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `168-RESEARCH.md` → `## Validation Architecture`. The planner filled
> the Per-Task Verification Map from the PLAN.md tasks; execute-phase samples against it.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x + pytest-asyncio (backend) / vitest + Testing Library (frontend) |
| **Config file** | `backend/pytest.ini` / `frontend/vitest.config.ts` |
| **Quick run command** | `cd backend && venv/Scripts/python -m pytest tests/ -q -k sso` |
| **Full suite command** | `cd backend && venv/Scripts/python -m pytest tests/ -q` ; `cd frontend && npx vitest run` |
| **Estimated runtime** | ~30-45 s backend `-k sso` ; ~15-20 s frontend auth vitest |

---

## Sampling Rate

- **After every task commit:** Run the quick run command (`-k sso`) — sub-45s
- **After every plan wave:** Run the full backend suite + `npx tsc -b` (frontend) — guards the shared org.py / OrgProvider surface against RLS/authz/type regressions
- **Before `/gsd:verify-work`:** Full suite green **plus** the ONE live mocksaml round-trip on cloud staging
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

> One row per PLAN.md task; every SSO-01 behavior traces to an automated command OR a Manual-Only row.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 168-01-01 | 01 | 1 | SSO-01 | T-168-01/06 | mig 113 grants org-admin `sso:manage` + status/uniqueness/mgmt-token column | grep gate | `grep -v '^--' supabase/migrations/113_sso_configs_firming.sql \| grep sso:manage` | ❌ W0 | ⬜ pending |
| 168-01-02 | 01 | 1 | SSO-01 | T-168-01 | mig 113 applied to the LIVE DB (4 verification queries) | manual (checkpoint) | live `pg_policies`/`information_schema.columns` queries | n/a | ⬜ pending |
| 168-01-03 | 01 | 1 | SSO-01 | — | full-schema.sql regenerated from the live DB | grep gate | `grep sso_configs_email_domain_lower_unique supabase/full-schema.sql` | n/a | ⬜ pending |
| 168-02-01 | 02 | 2 | SSO-01 | T-168-04 | config adapter fields + `SECRET_COLUMNS` mgmt token + deploy-artifact parity | cli | `bash scripts/check-deploy-drift.sh` | ❌ W0 | ⬜ pending |
| 168-02-02 | 02 | 2 | SSO-01 | T-168-02/04/09 | provider-CRUD two adapters, fail-closed on 4xx, public-domain blocklist, no-token-in-logs, delete-via-API | unit (mock HTTP) | `pytest tests/unit/test_168_sso_provider_service.py -x` | ❌ W0 | ⬜ pending |
| 168-03-01 | 03 | 2 | SSO-01 | T-168-06 | `require_sso_manage` strict-active-org gate (mirrors require_org_invite) | import + grep | `python -c "from app.dependencies import require_sso_manage"` | ❌ W0 | ⬜ pending |
| 168-03-02 | 03 | 2 | SSO-01 | T-168-03/05/08 | JIT one membership under concurrency, role always `member`, duplicate-email two-UUID, join-additive | integration (real DB) | `pytest tests/integration/test_168_sso_jit.py -x` | ❌ W0 | ⬜ pending |
| 168-04-01 | 04 | 3 | SSO-01 | T-168-02/06/09 | CRUD authz (org-admin 200 / member 403 / cross-org 403), public-domain 422, pending default, delete-provider-first, `/org/me` can_manage_sso | integration | `pytest tests/integration/test_168_sso_authz.py -x` | ❌ W0 | ⬜ pending |
| 168-04-02 | 04 | 3 | SSO-01 | T-168-01/10/03 | `/org/sso/route` active-only boolean, `/org/sso/provision` provider-id resolution + password-user no-op, operator approval flip / non-operator 404 | integration | `pytest tests/integration/test_168_sso_routing.py -x` | ❌ W0 | ⬜ pending |
| 168-05-01 | 05 | 4 | SSO-01 | T-168-04 | api-client SSO fns + `OrgPermissions.can_manage_sso` (pre-auth `getSsoRoute`) | type | `cd frontend && npx tsc -b` | ❌ W0 | ⬜ pending |
| 168-05-02 | 05 | 4 | SSO-01 | T-168-06/07/03 | `canManageSso` fail-closed render-only; `signInWithSSO` manual redirect; SSO-session provision-then-reprobe; password path untouched | type + grep | `cd frontend && npx tsc -b` | ❌ W0 | ⬜ pending |
| 168-06-01 | 06 | 5 | SSO-01 | T-168-01/04/06 | SSO LockedTab → live SsoTab; honest-absent CTA; server-truth status chip; SP-metadata display (no secret) | type + grep | `cd frontend && npx tsc -b` | ❌ W0 | ⬜ pending |
| 168-06-02 | 06 | 5 | SSO-01 | T-168-07 | identifier-first routing (match→signInWithSSO / no-match→password reveal); password fallback retained | frontend unit | `npx vitest run src/components/auth/SignInForm.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

The following test files are created inside their owning tasks (TDD where marked) — they do NOT pre-exist and are authored WITH the code they cover:

- [ ] `backend/tests/unit/test_168_sso_provider_service.py` — adapter selection + body shape + provider_id write-back + fail-closed 4xx + blocklist + no-token-in-logs (Plan 02 Task 2)
- [ ] `backend/tests/integration/test_168_sso_jit.py` — idempotent single membership, concurrent converge, duplicate-email two-UUID, role=member, join-additive (Plan 03 Task 2)
- [ ] `backend/tests/integration/test_168_sso_authz.py` — `sso:manage` grant enforced; member/cross-org denied; public-domain rejected; pending default; `/org/me` flag (Plan 04 Task 1)
- [ ] `backend/tests/integration/test_168_sso_routing.py` — domain routing + status gate + provision provider-id resolution + operator approval (Plan 04 Task 2)
- [ ] `frontend/src/components/auth/SignInForm.test.tsx` — identifier-first routing + password-reveal fallback (Plan 06 Task 2)
- [ ] Shared fixtures: extend the `test_v3_4_org_isolation` two-org fixtures with a seeded active/pending/disabled `sso_configs` + a mocked SSO `auth.identities` row

*Framework already present — no install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| ONE live end-to-end SAML round-trip | SSO-01 (SC#1) | Local Supabase CLI stack cannot run SAML (Kong doesn't route `/sso` — supabase/cli#1335); no local IdP | Cloud staging (Pro+) + mocksaml.com per RESEARCH.md D-168-06 §resolution: register provider via the SSO tab → approve → sign in with an SSO-domain email → redirected to mocksaml → back to app → JIT inserts exactly one `member` row → then sign in with a password account to confirm the fallback. Operator confirms the environment at execution; do NOT block the phase on local infra. |
| Migration 113 live apply | SSO-01 (SC#1) | The project applies migrations by hand via the Supabase SQL editor (never `db push`/`db reset`) | Plan 01 Task 2 checkpoint — the 4 live verification queries (role_permissions grant, sso_configs.status/approved_*, the lowercased-domain unique index, app_settings.supabase_management_token) |

*Everything else (provider-CRUD call, routing decision, JIT insert, authz, password fallback) is mocked/automated.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or a Wave 0 / Manual-Only dependency
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (the one checkpoint 168-01-02 sits between two automated tasks; the live round-trip is the terminal Manual-Only)
- [x] Wave 0 covers all MISSING test references
- [x] No watch-mode flags (all commands are `run`/`-x`, non-interactive)
- [ ] Feedback latency < ~60s (confirmed at first wave run)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
