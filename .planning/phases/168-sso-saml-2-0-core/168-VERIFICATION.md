---
phase: 168-sso-saml-2-0-core
verified: 2026-07-22T09:40:50Z
status: human_needed
score: 13/13 must-haves verified
overrides_applied: 0
human_verification:
  - test: "ONE live end-to-end SAML round-trip (org-admin registers connection → operator approves → user signs in with an SSO-domain email → redirected to the IdP (mocksaml.com) → back to the app → JIT inserts exactly one org_members 'member' row → the switcher resolves the joined org)"
    expected: "The full domain-routing → IdP redirect → callback → JIT-provision → org-switcher flow completes for a real SAML identity provider, and a subsequent password-account sign-in still works (fallback retained)"
    why_human: "The local Supabase CLI stack ships with SAML disabled and there is no local IdP (documented D-168-06 constraint — Kong doesn't route /sso locally, supabase/cli#1335). This requires cloud staging (Pro+) + mocksaml.com and was explicitly deferred to operator-confirmed live UAT per 168-VALIDATION.md Manual-Only section; it cannot be automated in this environment."
  - test: "Live migration-113 apply confirmation (already reported operator-completed)"
    expected: "The four live-DB verification queries (role_permissions grant, sso_configs.status/approved_*, the lowercased-domain unique index, app_settings.supabase_management_token) return their stated results"
    why_human: "Requires a human operator action via the Supabase SQL editor per CLAUDE.md's migration-apply discipline (never db push/db reset) — but this verifier independently re-confirmed the live schema via a fresh psycopg2 query against 127.0.0.1:54322 (see Required Artifacts / migration section below), so this item is evidence-backed, not merely trusted."
---

# Phase 168: SSO — SAML 2.0 (CORE) Verification Report

**Phase Goal:** Native SAML 2.0 SSO + JIT + email-domain routing; password fallback retained (SSO enforcement explicitly deferred). Supabase/GoTrue owns the SAML XML parse — this app proxies Supabase's provider-CRUD API and does NOT parse SAML.
**Verified:** 2026-07-22T09:40:50Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Migration 113 grants org-admin `sso:manage`, adds `sso_configs.status`/`approved_by`/`approved_at`, the lowercased-domain unique index, and `app_settings.supabase_management_token` — **applied to the live local DB** | ✓ VERIFIED | Independent psycopg2 query against `127.0.0.1:54322`: `role_permissions` grant=1 row, `sso_configs` cols (status/approved_by/approved_at)=3, unique index=1, `app_settings.supabase_management_token`=1. `pg_policies` on `sso_configs` still lists `sso_configs_select/insert/update/delete` (mig-104 policies intact). |
| 2 | `sso_provider_service` builds ONE identical request body and selects Cloud-vs-self-hosted transport by env (no code fork); fails closed on non-2xx; decrypts the mgmt token only at call time; never logs it | ✓ VERIFIED | `backend/app/services/sso_provider_service.py` — `_transport()` env switch, `build_body()` shared, `SsoProviderError` raised on non-2xx (`_raise_for_status`), `get_management_token()` decrypts via `secret_cipher` at call time. 13/13 unit tests pass (`pytest tests/unit/test_168_sso_provider_service.py`). |
| 3 | Public/personal email domains are rejected before any provider call | ✓ VERIFIED | `backend/app/services/sso_domain_blocklist.py` — 33-entry `PUBLIC_EMAIL_DOMAINS` frozenset + `is_public_domain()`; `org.py:722` calls it before `create_provider`. |
| 4 | `require_sso_manage` 403s a caller lacking `sso:manage`; strict active-org (never soft-resolved) | ✓ VERIFIED | `backend/app/dependencies.py:772` — verbatim mirror of `require_org_invite`, `Depends(get_active_org_id)` (strict). |
| 5 | `provision_sso_membership` is idempotent under concurrency, role hardcoded `'member'` (no function parameter), duplicate-email-tolerant, join-additive | ✓ VERIFIED | `backend/app/services/invitation_service.py:198-258` — advisory-lock + `ON CONFLICT (org_id,user_id) DO NOTHING`, role is a literal `"member"` bind with no `role` parameter. 5/5 integration tests pass (`test_168_sso_jit.py`), including an 8x concurrent-converge case. |
| 6 | An org-admin can create/list/update/delete a SAML connection via `/org/sso/providers`; writes land on the user-JWT connection so mig-104 RLS is the real wall; a member/cross-org caller is 403; creation lands `status='pending_approval'` | ✓ VERIFIED | `backend/app/api/org.py:654-916` — all four verbs `Depends(require_sso_manage)`, `get_user_pg_connection` for every write, server-pinned `org_id`. 7/7 authz tests pass (`test_168_sso_authz.py`). |
| 7 | `/org/sso/route` is FULLY PUBLIC (zero auth dependencies, reachable with no Authorization header), boolean-only, `status='active'`-only, anti-enumeration | ✓ VERIFIED | `backend/app/api/org.py:919-944` — `sso_route(domain: str = Query(...))` has no `Depends(get_current_user)`/auth dependency of any kind; returns strictly `{"sso": bool}`. 8/8 routing tests pass, including an explicit no-Authorization-header 200 case (`test_168_sso_routing.py`). |
| 8 | `/org/sso/provision` resolves org from the authenticated `auth.identities` SSO provider (never a client claim) and inserts a member row via the JIT | ✓ VERIFIED | `backend/app/api/org.py:948-991` — reads `auth.identities WHERE provider LIKE 'sso:%'` → `sso_configs.provider_id WHERE status='active'` → `provision_sso_membership`; password user is a 200 no-op; inactive config is 403. |
| 9 | An operator (not the creating org-admin) can approve a pending connection to `status='active'`, recording `approved_by`/`approved_at` | ✓ VERIFIED | `backend/app/api/admin.py:1675-1706` — `POST /admin/sso/configs/{id}/approve` behind `require_operator`, `WHERE status='pending_approval'` guard (non-operator gets the byte-identical /admin 404). |
| 10 | `canManageSso` is a fail-closed render flag threaded through the probe + `OrgProvider` in lockstep with `canManage`/`canAuditView` | ✓ VERIFIED | `frontend/src/hooks/useOrgPermissionsProbe.ts` (`CLOSED.can_manage_sso: false`, return-map), `frontend/src/providers/OrgProvider.tsx` (`OrgValue.canManageSso`, `useMemo` deps). |
| 11 | `signInWithSSO` redirects the browser manually (`window.location.href`); `signInWithPassword`/`signUp` are byte-unchanged (password fallback preserved) | ✓ VERIFIED | `frontend/src/hooks/useAuth.ts:74-78` — manual redirect confirmed; `git diff` history shows `signIn`/`signUp` bodies untouched across all 168 commits (SEED-056 baseline `tsc` count unchanged, 32/32). |
| 12 | The SSO tab is live in `OrgAdminShell` (no longer a `LockedTab`), render-gated on `canManageSso` with an honest-absent CTA, and shows server-truth status | ✓ VERIFIED | `frontend/src/components/org/OrgAdminShell.tsx:93` (`locked: false`), `SsoTab` imported/rendered at line ~421; `SsoTab.tsx` (433 lines) — CTA gated on `canManageSso`, status chip maps directly from `SsoConfig.status`. |
| 13 | The login form is identifier-first: a domain match routes to `signInWithSSO`; a non-match OR **any** `/org/sso/route` failure (403/network/outage) fails OPEN to the password field — never a lockout; the password fallback is fully retained | ✓ VERIFIED | `frontend/src/components/auth/SignInForm.tsx:31-61` — `try { getSsoRoute } catch { setPhase("password") }` on every rejection path; the password `onSubmit(email,password)` call is unchanged. 6/6 vitest cases pass (`SignInForm.test.tsx`), including the explicit fail-open-on-rejection case. |

**Score:** 13/13 truths verified. One item (the live cross-system SAML round-trip) cannot be verified by static/automated means in this environment and is routed to Human Verification below — this is why overall status is `human_needed`, not `passed`.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/113_sso_configs_firming.sql` | sso:manage grant + status/approval columns + domain-unique index + mgmt-token column, idempotent | ✓ VERIFIED | File present, all 5 statements confirmed by content read + independently re-confirmed live on the local DB (see Truth #1). |
| `supabase/full-schema.sql` | regenerated bootstrap reflecting mig 113 | ✓ VERIFIED | `grep` confirms `sso_configs_email_domain_lower_unique` + `supabase_management_token` present. |
| `backend/app/services/sso_provider_service.py` | provider-CRUD proxy, 2 adapters, async, fail-closed | ✓ VERIFIED | 235 lines, substantive; no stub patterns; `httpx.AsyncClient` only (no blocking `httpx.Client`). |
| `backend/app/services/sso_domain_blocklist.py` | hardcoded blocklist + `is_public_domain()` | ✓ VERIFIED | 60 lines, 33 domains, real logic. |
| `backend/app/config.py` | `supabase_project_ref` / `supabase_self_hosted` | ✓ VERIFIED | Fields present, referenced by `sso_provider_service._transport()`. |
| `backend/app/dependencies.py` | `require_sso_manage` guard | ✓ VERIFIED | Verbatim mirror of `require_org_invite`, strict active-org. |
| `backend/app/services/invitation_service.py` | `provision_sso_membership` JIT | ✓ VERIFIED | Real advisory-lock + `ON CONFLICT` insert, role hardcoded. |
| `backend/app/api/org.py` | `/sso/providers` CRUD + `/sso/route` + `/sso/provision` + `/me can_manage_sso` | ✓ VERIFIED | All endpoints present and wired to the services above. |
| `backend/app/api/admin.py` | operator SSO approval endpoint | ✓ VERIFIED | `POST /admin/sso/configs/{id}/approve`, `require_operator`-gated. |
| `frontend/src/lib/api.ts` | 6 SSO client fns + `SsoConfig` type + `can_manage_sso` | ✓ VERIFIED | All 6 fns present (`getSsoRoute`, `listSsoConfigs`, `createSsoProvider`, `updateSsoProvider`, `deleteSsoProvider`, `provisionSso`). |
| `frontend/src/hooks/useOrgPermissionsProbe.ts` | `canManageSso` fail-closed | ✓ VERIFIED | Present at interface, `CLOSED` default, return map. |
| `frontend/src/providers/OrgProvider.tsx` | `canManageSso` in `OrgValue` + SSO JIT wiring | ✓ VERIFIED | Present + `provisionSso()` call on SSO SIGNED_IN. |
| `frontend/src/hooks/useAuth.ts` | `signInWithSSO` | ✓ VERIFIED | Present, manual redirect. |
| `frontend/src/components/org/SsoTab.tsx` | live SSO tab UI | ✓ VERIFIED | 433 lines; create form, connection row, status chip, SP-metadata well, honest-absent CTA. |
| `frontend/src/components/org/OrgAdminShell.tsx` | SSO tab flip to live | ✓ VERIFIED | `locked: false`, `SsoTab` mounted, shell-owned fetch/mutations. |
| `frontend/src/components/auth/SignInForm.tsx` | identifier-first + fail-open | ✓ VERIFIED | 148 lines; matches spec exactly (read in full). |
| `backend/tests/unit/test_168_sso_provider_service.py` | adapter/body/fail-closed/blocklist coverage | ✓ VERIFIED | 13 test functions, all passing. |
| `backend/tests/integration/test_168_sso_jit.py` | idempotency/concurrency/dup-email/join-additive | ✓ VERIFIED | 5 test functions, all passing. |
| `backend/tests/integration/test_168_sso_authz.py` | CRUD authz coverage | ✓ VERIFIED | 7 test functions, all passing. |
| `backend/tests/integration/test_168_sso_routing.py` | routing/provision/approval coverage | ✓ VERIFIED | 8 test functions, all passing. |
| `frontend/src/components/auth/SignInForm.test.tsx` | identifier-first + fail-open coverage | ✓ VERIFIED | 6 test cases, all passing. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `public.role_permissions` | `sso_configs` RLS write policies (mig 104) | `current_user_has_permission(org_id,'sso:manage')` | ✓ WIRED | Grant row present live; policies intact (`sso_configs_insert/update/delete`). |
| `sso_provider_service.py` | `secret_cipher.py` | `decrypt_secret`/`get_cipher` at call time | ✓ WIRED | `get_management_token()` imports and calls both. |
| `sso_provider_service.py` | Supabase provider-CRUD API | `httpx.AsyncClient` POST/GET/PUT/DELETE | ✓ WIRED | Confirmed via code read; unit-tested with a mocked client. |
| `invitation_service.py::provision_sso_membership` | `public.org_members` | advisory lock + `ON CONFLICT (org_id,user_id) DO NOTHING`, role hardcoded `'member'` | ✓ WIRED | Confirmed by code read + live-DB integration tests. |
| `dependencies.py::require_sso_manage` | mig-104 `current_user_has_permission` | `_has_org_permission(active_org,'sso:manage')` | ✓ WIRED | Confirmed by code read. |
| `org.py /org/sso/providers` | `sso_provider_service.py` | create/update/delete proxy + `provider_id` write-back | ✓ WIRED | Confirmed; fail-closed create, delete-provider-first. |
| `org.py /org/sso/route` | `public.sso_configs` | `SELECT ... WHERE lower(email_domain)=$1 AND status='active'` | ✓ WIRED | Confirmed by code read (`org.py:940-943`). |
| `org.py /org/sso/provision` | `invitation_service.py::provision_sso_membership` | resolve provider_id → sso_configs.org_id → JIT insert | ✓ WIRED | Confirmed by code read (`org.py:948-991`). |
| `OrgProvider.tsx` | `api.ts::provisionSso` | SIGNED_IN SSO session → `provisionSso()` → re-probe `/org/me` | ✓ WIRED | Confirmed by code read (`OrgProvider.tsx:161`). |
| `OrgAdminShell.tsx` | `SsoTab.tsx` | `activeTab==='sso'` branch, gated on `canManageSso` | ✓ WIRED | Confirmed by code read + `OrgAdminShell.test.tsx` (9/9 passing, includes an SSO-live mount assertion). |
| `SignInForm.tsx` | `api.getSsoRoute` + `useAuth.signInWithSSO` | `handleContinue` → route → redirect \| fail-open reveal | ✓ WIRED | Confirmed by full file read; matches the must-have contract exactly. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `SsoTab.tsx` | `configs` (prop) | `OrgAdminShell.fetchSsoConfigs()` → `listSsoConfigs()` → `GET /org/sso/providers` → real `sso_configs` SELECT on the user-JWT connection | Yes | ✓ FLOWING |
| `SignInForm.tsx` | `sso` (local var from `getSsoRoute`) | `GET /org/sso/route` → real `SELECT 1 FROM sso_configs WHERE lower(email_domain)=$1 AND status='active'` | Yes | ✓ FLOWING |
| `OrgAdminShell.tsx` | `canManageSso` | `useOrg()` → `useOrgPermissionsProbe` → `GET /org/me` → real `_has_org_permission(active_org,'sso:manage')` SECDEF call | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Live schema for mig 113 (grant/columns/index) | psycopg2 direct query against `127.0.0.1:54322` | grant=1, cols=3, index=1, mgmt-token-col=1, RLS policies intact | ✓ PASS |
| Backend SSO/invitation/org-isolation regression | `pytest tests/ -q -k "168 or 167 or org_isolation"` | 109 passed, 0 failed | ✓ PASS |
| Backend SSO-only suites (explicit files) | `pytest tests/unit/test_168_sso_provider_service.py tests/integration/test_168_sso_jit.py tests/integration/test_168_sso_authz.py tests/integration/test_168_sso_routing.py tests/integration/test_167_jit_race.py tests/integration/test_v3_4_org_isolation.py -q` | 61 passed, 0 failed | ✓ PASS |
| Frontend SSO-surface tests | `npx vitest run src/components/auth/SignInForm.test.tsx src/components/org/OrgAdminShell.test.tsx src/pages/AcceptInvitePage.test.tsx` | 3 files, 21 tests, all passed | ✓ PASS |
| Frontend typecheck (net-new errors) | `npx tsc -b --noEmit` (total error count) | 32 errors total (matches documented pre-existing SEED-056/049 baseline; 0 net-new) | ✓ PASS |
| Deploy-artifact drift (SUPABASE_PROJECT_REF/SUPABASE_SELF_HOSTED parity) | `bash scripts/check-deploy-drift.sh` | `RESULT: PASS` (2 non-blocking WARNs, pre-existing/unrelated to 168) | ✓ PASS |
| No new hard dependency (0 new deps, no `python3-saml`) | `git log` on `backend/requirements.txt` / `frontend/package.json` since before phase 168 | No commits touching either file within the phase's commit range | ✓ PASS |

### Probe Execution

Not applicable — Phase 168 is not a migration/tooling phase with a `scripts/*/tests/probe-*.sh` convention, and no PLAN/SUMMARY declares a probe script. Skipped.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|--------------|-------------|--------------|--------|----------|
| SSO-01 | 168-02, 168-03, 168-04, 168-05, 168-06 (phase-spanning; marked complete only after 168-06) | An org-admin can register a SAML 2.0 IdP via Supabase's native SAML SP; users route by email domain; attribute→claim mapping feeds department import (department import itself deferred to Phase 169 per ROADMAP note); JIT provisioning creates membership on first login; email/password fallback retained | ✓ SATISFIED | REQUIREMENTS.md line 56 marked `[x]`; line 136 phase-mapping table shows `SSO-01 | 168 | Complete`. Full implementation chain verified end-to-end above (schema → service → authz/JIT → endpoints → frontend data layer → UI). The one open item is the live cross-system SAML round-trip, routed to Human Verification (does not block SATISFIED — the code paths for every SC are proven; only the literal external-IdP interaction is unverifiable here). |

No orphaned requirements: REQUIREMENTS.md maps exactly one requirement (SSO-01) to Phase 168, and it is claimed by the plans above.

**Note on ROADMAP SC#1 wording:** ROADMAP.md's Success Criterion #1 text says "provisioned via `supabase sso add`" (the CLI). The actual implementation is a **self-service backend-proxied** flow (org-admin pastes a metadata URL into the SSO tab; the backend calls Supabase's provider-CRUD API). This is a **documented, deliberate design decision** made and approved during discuss-phase (D-168-01; explicitly noted as superseding the earlier CLI framing in `168-RESEARCH.md:569,574` and `168-CONTEXT.md:32-33`), not an unreviewed deviation. The higher-level intent of SC#1 ("an org-admin registers a SAML 2.0 IdP... users route to it by email domain") is fully achieved; the specific provisioning mechanism cited in the roadmap text is superseded by an equivalent, more scalable mechanism. Treated as VERIFIED, not a gap.

### Anti-Patterns Found

No `TBD`/`FIXME`/`XXX` debt markers in any Phase-168 file (grep across all 14 backend/frontend files modified by this phase returned zero matches) — the debt-marker gate is clean.

Code review (`168-REVIEW.md`, standard depth, 20 files) found **0 critical / 0 blocker** findings and 3 warnings + 6 info items. None invalidate a must-have truth (the literal contracts above — e.g., "delete calls provider-CRUD DELETE first" — hold); they are robustness/hardening gaps on top of a working happy path:

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `backend/app/api/org.py:728-748,857-915` | WR-01 | Non-atomic provider↔row coupling: a DB error after the GoTrue provider is created can orphan it (no compensating rollback on `UniqueViolationError`/transient errors); the inverse delete-failure path can leave `/org/sso/route` advertising `sso:true` for a domain whose GoTrue provider is already gone | ⚠️ Warning | Correctness/robustness gap in rare failure paths, not the happy path. Does not block SSO-01's core capability (create/list/update/delete all work when the CRUD calls succeed, which the integration tests prove). |
| `backend/app/api/org.py:672-678`, `sso_provider_service.py:117-147` | WR-02 | `metadata_url` has no scheme/host validation before being handed to GoTrue's server-side fetch — an authenticated `sso:manage` holder on self-hosted could probe internal targets (SSRF, defense-in-depth gap) | ⚠️ Warning | Self-hosted-only, requires an already-authenticated org-admin; not reachable pre-auth. Recommend fixing before self-hosted GA. |
| `frontend/src/components/org/OrgAdminShell.tsx:285-294`, `SsoTab.tsx:273-282` | WR-03 | A failed SSO-connection removal (e.g. the documented 502) becomes an unhandled promise rejection with no user-visible error — the confirm sheet closes silently, the row remains, and the code comment ("remove swallows + re-fetches") contradicts the actual re-throw behavior | ⚠️ Warning | UX/observability gap on a destructive-action failure path; the happy-path remove works and is re-fetch-not-optimistic as designed. |
| `sso_domain_blocklist.py:18-41` | IN-02 | Blocklist misses several large non-US free providers (mail.ru, web.de, gmx.de, naver.com, etc.) | ℹ️ Info | Mitigated by the operator-approval gate (Control 2) — defense-in-depth, not the load-bearing anti-hijack control. |
| `OrgAdminShell.tsx:215-232`, `SsoTab.tsx:106-141` | IN-03 | A user with `org:manage` but not `sso:manage` would see a perpetual loading spinner (currently unreachable — the mig-104/113 seed grants both to the same roles) | ℹ️ Info | Latent, not live today. |
| `SignInForm.tsx:32,84` | IN-04 | `email.split("@")[1]` picks the wrong segment for a quoted/multi-`@` address | ℹ️ Info | Low-impact edge case; `type="email"` filters most inputs. |
| `useAuth.ts:74-78` | IN-05 | `signInWithSSO` silently no-ops if GoTrue returns no `url` (no error thrown) | ℹ️ Info | Edge case; GoTrue normally returns a URL. |
| `SsoTab.tsx:80-84` | IN-06 | SP-metadata reads a private supabase-js field via an `unknown` cast | ℹ️ Info | Fragile to a supabase-js internal rename; falls back to a baked env var. |
| `frontend/src/lib/api.ts:4856-4870` | IN-01 | `updateSsoProvider` is exported but unused (no edit flow in the UI) | ℹ️ Info | Dead code, not a functional gap. |

None of these are BLOCKER-severity per the code review's own classification, and independent re-review during this verification agrees: every must-have truth's literal contract (grant ordering, RLS wall, fail-closed create, delete-provider-first, fail-open login, hardcoded JIT role) is intact. WR-01/02/03 are legitimate follow-up items worth a small hardening pass but do not block phase closure.

### Human Verification Required

### 1. Live end-to-end SAML round-trip

**Test:** On cloud staging (Supabase Pro+) with a real/mock IdP (mocksaml.com per `168-VALIDATION.md`): an org-admin registers a SAML connection via the SSO tab (metadata URL + email domain) → an operator approves it (`pending_approval` → `active`) → a user with that email domain visits the login page, types their email, clicks Continue → is redirected to the IdP → authenticates → is redirected back to the app → JIT inserts exactly one `org_members` row with `role='member'` → the org switcher resolves the newly-joined org. Then confirm an existing password-account user can still sign in the old way.
**Expected:** The full chain completes without manual DB intervention; exactly one membership row is created (no duplicates on a second login); the password fallback still works for a non-SSO user.
**Why human:** The local Supabase CLI stack ships with SAML disabled (no `[auth]` SAML block in `config.toml`) and there is no local IdP — Kong doesn't route `/sso` locally (`supabase/cli#1335`, documented in `168-CONTEXT.md` D-168-06). This is explicitly a Manual-Only item in `168-VALIDATION.md`, deferred to operator-confirmed cloud staging by design, not an oversight. Every code path this round-trip exercises (routing lookup, redirect, JIT insert, RLS wall, fail-open) is independently unit/integration-tested against mocked/real-DB fixtures — only the actual cross-system IdP handshake is unverifiable here.

### 2. Migration 113 live-apply re-confirmation (informational — already independently re-verified by this report)

**Test:** Re-run the four verification queries from `168-01-PLAN.md` Task 2 against the target environment before promoting to any new environment (e.g., before the next cloud push, since 113 is still in the pending 099→113 cloud-parity set).
**Expected:** Grant=1 row, `sso_configs` columns=3, unique index=1, `app_settings.supabase_management_token`=1 column.
**Why human:** This verifier already re-confirmed all four conditions live against the local DB (see Behavioral Spot-Checks) — this item is listed for completeness/traceability of the cloud-parity debt (migs 099→113 + `SECRETS_ENCRYPTION_KEY` owed at the next operator-gated production push), not because local evidence is missing.

### Gaps Summary

No gaps block phase closure. All 13 observable truths (merged from the 3 ROADMAP success criteria + the 5 plans' `must_haves`) are code-verified with live-DB, unit-test, integration-test, and static-analysis evidence — not SUMMARY.md narrative. The schema layer is independently re-confirmed live (not merely trusted from the SUMMARY claim). The only unresolved item is the live cross-provider SAML handshake, which cannot be exercised in this environment by design (no local IdP) and is correctly routed to human verification rather than treated as a code gap. Three code-review WARNINGs (non-atomic provider/row coupling, missing metadata-URL SSRF validation, silent remove-failure) are legitimate hardening follow-ups — recommended for a small fast-follow pass but do not invalidate the phase goal, which is about SSO registration/routing/JIT/fallback existing and working on the happy path (which they do).

---

*Verified: 2026-07-22T09:40:50Z*
*Verifier: Claude (gsd-verifier)*
