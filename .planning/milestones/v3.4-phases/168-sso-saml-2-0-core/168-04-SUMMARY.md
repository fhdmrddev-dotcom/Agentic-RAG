---
phase: 168-sso-saml-2-0-core
plan: 04
subsystem: auth
tags: [sso, saml, rls, org-multi-tenancy, fastapi, asyncpg, jit-provisioning]

# Dependency graph
requires:
  - phase: 168-02
    provides: sso_provider_service (async provider-CRUD proxy) + sso_domain_blocklist.is_public_domain
  - phase: 168-03
    provides: require_sso_manage guard + invitation_service.provision_sso_membership (domain-gated JIT)
  - phase: 168-01
    provides: migration 113 (org-admin sso:manage grant + sso_configs status/approved_by/approved_at + lowered-domain unique index)
  - phase: 166
    provides: get_active_org_id (strict server-pinned active org) + _has_org_permission + /org/me shape
  - phase: 163
    provides: get_user_pg_connection (per-request user-JWT RLS connection) — the mig-104 RLS wall
provides:
  - "/org/sso/providers CRUD (POST/GET/PUT/DELETE) — sso:manage-gated, RLS-walled, blocklist-guarded, pending_approval by default"
  - "/org/sso/route — fully-public (no-auth) boolean-only active-only pre-login domain lookup"
  - "/org/sso/provision — domain-gated JIT resolving org from the authenticated auth.identities SSO provider"
  - "/org/me can_manage_sso"
  - "POST /admin/sso/configs/{id}/approve — operator approval flip pending_approval -> active"
affects: [168-05, 168-06, sso-login-page, org-admin-sso-tab]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fully-public FastAPI route (zero auth Depends) for the pre-login identifier-first lookup — the ONLY unauthenticated read on the org surface"
    - "Provider-CRUD-first / row-second ordering both ways (create: provider then row on success; delete: provider then row) so a GoTrue provider is never orphaned and no row is written for a connection that was not created"
    - "Org resolved from the authenticated auth.identities SSO provider identity (never a client claim)"

key-files:
  created:
    - backend/tests/integration/test_168_sso_authz.py
    - backend/tests/integration/test_168_sso_routing.py
  modified:
    - backend/app/api/org.py
    - backend/app/api/admin.py

key-decisions:
  - "The public-domain blocklist check runs in the handler BEFORE create_provider (source order) — a public/free domain is 422 with NO provider call and NO row"
  - "create_sso_provider is fail-closed: the GoTrue provider is created first; a SsoProviderError maps to 422 and writes NO sso_configs row"
  - "delete_sso_provider calls sso_provider_service.delete_provider BEFORE the row delete (T-168-09); an upstream failure is 502 and the row is KEPT"
  - "/org/sso/route declares NO auth dependency of any kind — reachable with no Authorization header, returns a bare {sso: bool} keyed only on domain->active-config presence (anti-enumeration, never provider_id/org_id/account existence)"
  - "/org/sso/provision resolves the org from auth.identities.provider ('sso:<uuid>') -> sso_configs.provider_id WHERE status='active'; a password user (no SSO identity) is a 200 no-op; a non-active config is a fail-closed 403"
  - "The SSO audit rows reuse action_type 'settings.update' (the audit_log CHECK admits it; no migration) with the real event in metadata.event and an EXPLICIT server-pinned org_id (T-167-23)"
  - "Operator approval lives in admin.py behind the router-level require_operator (byte-identical 404 to non-operators); guarded WHERE status='pending_approval' so an already-active/unknown id is 404"

patterns-established:
  - "ASGITransport + httpx.AsyncClient integration test that mounts ONLY the target router in a minimal FastAPI app, overrides get_current_user per-test to a REAL seeded user, and lets the REAL require_sso_manage/get_active_org_id + mig-104 RLS run against the live local Postgres (the two-org authz wall is a MEASURED property)"

requirements-completed: []  # SSO-01 is phase-spanning (plans 02-06) — stays Pending until Plan 06 lands the login page

# Metrics
duration: 32min
completed: 2026-07-22
---

# Phase 168 Plan 04: SSO Endpoint Wiring Summary

**Wired the three `/org/sso/*` endpoint families plus the operator approval endpoint over the Plan-02 service + Plan-03 primitives — the request-layer assembly where the org-admin self-service CRUD is RLS-walled and blocklist-guarded, the identifier-first domain lookup is fully public, and the domain-gated JIT resolves the org from the authenticated SAML provider identity.**

## Performance

- **Duration:** ~32 min
- **Started:** 2026-07-22T08:34Z (approx — first commit)
- **Completed:** 2026-07-22T08:41Z
- **Tasks:** 2/2
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments

### Task 1 — `/org/sso/providers` CRUD + blocklist + `/org/me can_manage_sso`
- Added a `POST/GET/PUT/DELETE /org/sso/providers` family to the org router, all `Depends(require_sso_manage)`, mirroring `send_org_invitation`. Every write lands on `get_user_pg_connection` so the mig-104 `sso_configs_insert/update/delete` RLS (`sso:manage AND org_id ∈ current_user_org_ids`) is the real wall; `org_id` is always server-pinned to `request.state.active_org`.
- **Control 1 (T-168-02):** `is_public_domain` rejects a public/free domain with 422 **before** any provider call — no call, no row.
- **Fail-closed create (T-168-05a):** the GoTrue provider is created first via `sso_provider_service.create_provider`; a `SsoProviderError` maps to 422 and writes no row. The row lands `status='pending_approval'` (never active).
- **Delete-provider-first (T-168-09):** `delete_provider` is called before the row delete; an upstream failure is 502 and the row is kept.
- `/org/me` now returns `can_manage_sso` (true for org-admin via the mig-113 grant, false for a member).

### Task 2 — public route + JIT provision + operator approval
- **`GET /org/sso/route`** — a fully-public, anonymous, pre-login read with **zero auth dependencies** (reachable with no Authorization header). Returns a bare `{"sso": bool}` keyed strictly on `lower(email_domain)` → active-config presence — never a provider_id/org_id, never account existence (T-168-10). Only `status='active'` routes (T-168-01).
- **`POST /org/sso/provision`** — `Depends(get_current_user)` only. Reads the caller's `auth.identities` SSO row (`provider LIKE 'sso:%'`), strips the `sso:` prefix, matches `sso_configs.provider_id WHERE status='active'` → org, then delegates to `provision_sso_membership` (role hardcoded in the service). A password user (no SSO identity) is a 200 no-op; a non-active config is a 403 (D-168-04).
- **`POST /admin/sso/configs/{id}/approve`** (admin.py, `require_operator`) — flips `pending_approval → active` recording `approved_by`/`approved_at`; guarded `WHERE status='pending_approval'` so an already-active/unknown id is the byte-identical /admin 404 (D-168-05 Control 2).

## Testing

- `tests/integration/test_168_sso_authz.py` — 7 tests (org-admin through / member 403 `-k sso_permission`, pending-default + domain lowercasing, cross-org 403, public-domain 422 with no call/no row, provider-error 422 no row, list-scoped + delete-provider-before-row, `/org/me can_manage_sso`).
- `tests/integration/test_168_sso_routing.py` — 8 tests (public no-auth 200, active-only + case-insensitive, boolean-only anti-enumeration, provision-from-provider-id idempotent, password-user no-op, inactive-config 403, operator approve flip, non-operator 404).
- Both suites drive the **real local Postgres** via `httpx.ASGITransport` + a minimal per-test app with `get_current_user` pinned to a real seeded user, so `require_sso_manage` + `get_active_org_id` + mig-104 RLS + the mig-113 grant are exercised for real (the provider-CRUD HTTP calls are mocked).
- **15/15 new tests pass.** Regression sweep `-k "168 or 167 or org_isolation"` = **109 passed, 0 failed** (the v3.4 two-org exit gate + the 167 JIT suite unaffected). App imports clean; all 7 SSO routes registered.

## Deviations from Plan

### Auto-fixed / added (no user permission needed)

**1. [Rule 2 - Missing critical functionality] DELETE upstream-failure path returns 502, keeps the row**
- **Found during:** Task 1 (delete handler)
- **Issue:** the plan specifies "delete_provider FIRST, then delete the row" but did not name the behavior when the upstream provider delete fails.
- **Fix:** on `SsoProviderError` from `delete_provider`, return 502 and KEEP the sso_configs row (fail-closed — never delete a row while the GoTrue provider still routes the domain, the exact T-168-09 orphan-avoidance intent applied to the failure branch).
- **Files:** `backend/app/api/org.py`
- **Commit:** `2eee27d9`

**2. [Rule 2 - Missing critical functionality] PUT re-runs the public-domain blocklist on a domain change**
- **Found during:** Task 1 (update handler)
- **Issue:** Control 1 was specified for create; an edit that changes the domain to a public one would otherwise bypass it.
- **Fix:** `update_sso_provider` re-runs `is_public_domain` and 422s before touching the provider or row — Control 1 stays enforced on edit.
- **Files:** `backend/app/api/org.py`
- **Commit:** `2eee27d9`

## Known Stubs

None — both endpoint families are wired to live data (real provider-CRUD service + real DB + the mig-113 grant + real `auth.identities` resolution). No hardcoded/placeholder values flow to a response.

## Threat Flags

None — no security surface beyond the plan's `<threat_model>` was introduced. `/org/sso/route` is the one new unauthenticated read and it is a deliberate, boolean-only, anti-enumeration lookup (T-168-10, in the register).

## Notes for Downstream Plans

- **Plan 06 (login page)** consumes `/org/sso/route` (identifier-first) then calls `/org/sso/provision` on `SIGNED_IN` before re-probing `/org/me`. A 403 from `/org/sso/route` would lock out ALL login — it is intentionally auth-free; keep it that way.
- **Flag A2 (still owed on the live round-trip):** the exact `auth.identities.provider` string is assumed to be `sso:<uuid>`; the provision parser is tolerant of that shape but the real format should be confirmed on the first live SAML login.
- **SSO-01 stays Pending** — phase-spanning across plans 02–06; this plan delivers the request layer only.

## Self-Check: PASSED

- SUMMARY.md present.
- All 4 task commits found in git (82b798a8, 609e6f04, dc0d0712, 2eee27d9).
- Both created test files present.
