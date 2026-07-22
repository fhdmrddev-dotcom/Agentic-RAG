---
phase: 166-org-admin-shell-org-switcher-profile-menu-anchor
plan: 01
subsystem: api
tags: [fastapi, authz, rls, multi-tenancy, asyncpg, supabase, org-admin, audit]

# Dependency graph
requires:
  - phase: 161-org-schema
    provides: org_members / organizations / role_permissions tables + membership RLS
  - phase: 163-atomic-crux
    provides: get_user_pg_connection (per-request RLS user-JWT asyncpg seam) + X-Org-Id hybrid decision
  - phase: 164-isolation
    provides: current_user_has_permission SECDEF helper wired as the caller-scoped permission gate
provides:
  - get_active_org_id dependency — server-validated X-Org-Id → active-org resolution (403 on spoof)
  - require_org_manage dependency — org:manage router/endpoint gate
  - _has_org_permission seam — the single swappable org-permission boundary (mig 104 helper as the caller)
  - GET /org/me — org-permissions probe + memberships[] for the frontend probe + switcher
  - GET /org/members — manager-only read-only org roster
  - GET /org/audit — manager-only org-scoped audit with org:audit_view honest degrade
affects: [166-02-orgprovider, 166-03-org-admin-shell, 166-04-members-audit-tabs, 166-05-profile-menu, 167-invitations]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "X-Org-Id server-validation: never trust the client's active org; validate against org_members on a user-JWT/RLS connection (auth.uid())"
    - "Single org-permission seam (_has_org_permission) mirroring is_operator — one swappable boundary over mig 104's SECDEF helper, run AS THE CALLER"
    - "Router-level default-deny (Depends(get_active_org_id)) + per-endpoint manager gate (require_org_manage)"
    - "Service-role + app-code authz over audit_log (NO authenticated SELECT policy) with an org:audit_view scope flag — RLS-honest degrade, never a silent empty list"

key-files:
  created:
    - backend/app/api/org.py
    - backend/tests/test_166_org_gate.py
  modified:
    - backend/app/dependencies.py
    - backend/app/main.py

key-decisions:
  - "get_active_org_id validates X-Org-Id against org_members on a user-JWT connection; malformed uuid → non-member 403 (never a 500)"
  - "org:manage gate returns 403 (a legitimate product feature) — NOT the /admin byte-identical 404"
  - "/org/members reads via the singleton pool (postgres/BYPASSRLS) scoped to the validated active_org — the auth.users email join needs the postgres role (list_users_roster precedent), gated by require_org_manage"
  - "/org/audit is service-role supabase-py + app-code authz over public.audit_log ONLY; org:audit_view → all org rows, else own-only + scope='own'"
  - "No new migration, no new package — pure app code over the shipped mig-104 substrate (D-166-09)"

patterns-established:
  - "Org authz mirrors operator authz: require_operator/is_operator → require_org_manage/_has_org_permission(current_user_has_permission)"
  - "Every blocking supabase-py .execute() wrapped in run_in_threadpool (D-v2.5-01)"

requirements-completed: [ADMIN-01, ADMIN-02, ADMIN-04]

# Metrics
duration: 13min
completed: 2026-07-21
---

# Phase 166 Plan 01: Org-Admin Backend Authz + Read Layer Summary

**Net-new org enforcement layer: server-validated X-Org-Id active-org resolution, an org:manage router/endpoint gate over mig 104's current_user_has_permission SECDEF helper, and three member/manager reads (/org/me, /org/members, /org/audit) with an RLS-honest audit degrade — the first routes to ever call the permission helper (D-166-09).**

## Performance

- **Duration:** ~13 min
- **Started:** 2026-07-21T19:12Z (approx)
- **Completed:** 2026-07-21T19:25:35Z
- **Tasks:** 3
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments
- `get_active_org_id`: reads the `X-Org-Id` header and validates it against the caller's `org_members` on a user-JWT/RLS connection (`auth.uid()`) — a spoofed/non-member org is a 403, never trusted (D-166-06 / T-166-01). Header-absent path resolves the caller's default org (0 → 403, 2+ → 400).
- `require_org_manage` + `_has_org_permission`: the manager gate runs mig 104's `current_user_has_permission(active_org,'org:manage')` AS THE CALLER (never the BYPASSRLS pool — T-166-04). D-166-09: no route called this helper before this plan.
- `GET /org/me`: membership-reachable probe returning `{org_id, role, can_manage, can_audit_view, memberships[]}` — feeds the frontend probe + the org switcher (ADMIN-02); floor-exempt.
- `GET /org/members`: manager-only read-only roster (org_members JOIN auth.users) scoped to the validated active org (ADMIN-01 default-deny).
- `GET /org/audit`: manager-only org-scoped audit over `public.audit_log` only (excludes the workflow-internal + operator-only audit tables); `org:audit_view` → all org rows (`scope="all"`), else own-only `.eq("user_id", caller)` (`scope="own"`) — RLS-honest, never a silent empty list (ADMIN-04 / LANDMINE 1).
- 5-test regression suite locking the spoof-rejection, default-deny, and audit-degrade paths (green).

## Task Commits

Each task was committed atomically:

1. **Task 1: Org authz dependencies (X-Org-Id validation + org:manage gate)** - `68de6c6c` (feat)
2. **Task 2: Org router (me/members/audit) + register in main.py** - `57290591` (feat)
3. **Task 3: Authz regression suite** - `628c57ef` (test)

_Note: Task 3 is `tdd="true"`; the security suite was authored to lock the behavior built in Tasks 1-2 and passes green (5/5). It is committed as a single `test(...)` commit since the implementation is the subject-under-test from the prior tasks._

## Files Created/Modified
- `backend/app/dependencies.py` - Added `get_active_org_id`, `require_org_manage`, `_has_org_permission`, `_to_uuid`; added `import uuid`.
- `backend/app/api/org.py` - New org router: `/org/me`, `/org/members`, `/org/audit` with the router-level membership gate + per-endpoint manager gate + audit degrade.
- `backend/app/main.py` - Import + `app.include_router(org.router)`.
- `backend/tests/test_166_org_gate.py` - 5 security-critical regression tests.

## Decisions Made
- **Members roster connection:** the plan gave latitude ("MAY use a user-JWT connection; confirm the email join surface"). The `auth.users` email join requires the postgres role (the `authenticated` RLS role has no SELECT on `auth.users`), so `/org/members` reads via the singleton pool (BYPASSRLS) explicitly scoped to the server-validated `active_org` and gated by `require_org_manage` — the exact `list_users_roster` precedent. asyncpg reads are async (no `run_in_threadpool` needed).
- **Audit read connection:** `/org/audit` uses `get_service_role_supabase(active_org)` (supabase-py) per the plan/LANDMINE 1, with both `.execute()` calls wrapped in `run_in_threadpool` (D-v2.5-01). App-code authz (`org:audit_view` branch) is the only gate since `audit_log` has no authenticated SELECT policy.
- **Refusal polarity:** org gates return 403 (a legitimate product feature, mirroring `require_visible:471-474`), NOT the `/admin` byte-identical 404.
- **Untrusted-header hardening:** a malformed `X-Org-Id` is parsed to `None` and treated as a non-member 403 (never a 22P02 → 500).

## Deviations from Plan

None - plan executed exactly as written. No new migration authored (mig 104 substrate is sufficient, D-166-09) and no new package installed.

## Issues Encountered
- The Task 2 acceptance grep `grep -v '^#' … | grep -c "harness_audit\|operator_audit_log" == 0` counts docstring/indented-comment lines (only column-0 `#` lines are filtered). Resolved by phrasing the excluded-table note as "the workflow-internal or operator-only audit tables" — the literal table names appear nowhere in `org.py`. Verified: count == 0.

## User Setup Required
None - no external service configuration required (mig 104 is already applied live per prior phases; no env vars, no packages).

## Known Stubs
None. All three endpoints are wired end-to-end to real DB reads (mig 104 tables + audit_log). The 4 locked shell tabs referenced in phase context are a frontend concern (Plans 02-05), not this backend plan.

## Self-Check: PASSED
- `backend/app/api/org.py` — FOUND (created)
- `backend/tests/test_166_org_gate.py` — FOUND (created)
- `backend/app/dependencies.py` / `backend/app/main.py` — FOUND (modified)
- Commit `68de6c6c` (Task 1) — FOUND
- Commit `57290591` (Task 2) — FOUND
- Commit `628c57ef` (Task 3) — FOUND
- Routes `/org/me`, `/org/members`, `/org/audit` — registered (verified via app.routes)
- `pytest tests/test_166_org_gate.py` — 5 passed
- No writes to STATE.md / ROADMAP.md — confirmed

## Next Phase Readiness
- Backend contract ready for the frontend plans: `GET /org/me` feeds `useOrgPermissionsProbe` + the org switcher; `/org/members` + `/org/audit` back the shell's live tabs.
- Plans 02-05 (OrgProvider, OrgAdminShell, Members/Audit tabs, ProfileMenu) consume `{org_id, role, can_manage, can_audit_view, memberships[]}` and the `scope` flag on audit.
- No blockers. Note for the frontend: `X-Org-Id` is a hint only — the server re-validates every request (localStorage persistence per OrgProvider is safe by construction).

---
*Phase: 166-org-admin-shell-org-switcher-profile-menu-anchor*
*Completed: 2026-07-21*
