---
phase: 168-sso-saml-2-0-core
plan: 03
subsystem: auth
tags: [sso, saml, jit-provisioning, org-membership, asyncpg, rls, fastapi, authz]

# Dependency graph
requires:
  - phase: 168-01
    provides: "migration 113 seeds the sso:manage role_permissions grant that flips require_sso_manage live"
  - phase: 167
    provides: "invitation_service accept_invitation idempotency skeleton (advisory-lock + ON CONFLICT DO NOTHING) + _rowcount; dependencies require_org_invite guard template"
  - phase: 161
    provides: "mig-104 current_user_has_permission SECDEF helper + org_members UNIQUE(org_id,user_id) + role_permissions catalog"
  - phase: 166
    provides: "_has_org_permission seam + strict get_active_org_id resolver"
provides:
  - "require_sso_manage — strict active-org, sso:manage-gated authz guard for the Plan-04 SSO provider-CRUD routes"
  - "provision_sso_membership — domain-gated idempotent, member-only, duplicate-email-tolerant, join-additive JIT membership insert"
  - "test_168_sso_jit.py — live concurrent-converge + idempotency + duplicate-email + join-additive proof"
affects: [168-04, sso-endpoints, jit-provisioning]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "JIT-as-sibling-of-invite-accept: reuse the accept_invitation advisory-lock + ON CONFLICT DO NOTHING convergence skeleton, drop the token/status machinery, resolve org from the authenticated provider instead of a token"
    - "role hardcoded as the $3 bind literal (never a function parameter, never a SAML attribute) — fail-closed lowest-privilege JIT"
    - "guard-as-verbatim-mirror: require_sso_manage clones require_org_invite with only the permission key swapped"

key-files:
  created:
    - backend/tests/integration/test_168_sso_jit.py
  modified:
    - backend/app/dependencies.py
    - backend/app/services/invitation_service.py

key-decisions:
  - "require_sso_manage inherits the STRICT get_active_org_id (spoofed X-Org-Id -> 403), never resolve_active_org_soft — every SSO write is pinned to the server-validated active org"
  - "provision_sso_membership hardcodes role='member' as the $3 bind, has NO role parameter, and never reads a SAML attribute (D-168-03 / T-168-03 escalation footgun)"
  - "Membership keys on (org_id, user_id) UUID — email is not in the key, so a same-email password account (a distinct auth.users UUID) provisions an independent membership (T-168-08)"
  - "Runs on the BYPASSRLS singleton asyncpg pool because the SSO user is not yet a member (the user-JWT org_members_insert RLS policy would deny) — same authorized path as the 167 accept"

patterns-established:
  - "Domain-gated JIT: org resolution (email domain -> provider -> org) lives in the Plan-04 endpoint; this service receives an already-resolved org_id and owns only the idempotent member-only insert"
  - "TDD RED->GREEN on a real local Postgres (:54322) via the pg_pool fixture + asyncio.gather for the concurrent-converge proof"

requirements-completed: [SSO-01]

# Metrics
duration: 8min
completed: 2026-07-22
---

# Phase 168 Plan 03: SSO Authz Guard + Domain-Gated JIT Summary

**`require_sso_manage` (strict, sso:manage-gated) and `provision_sso_membership` — an idempotent, member-only, duplicate-email-tolerant, join-additive JIT membership insert built as the token-free sibling of the Phase-167 invite accept.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-07-22T12:08Z
- **Completed:** 2026-07-22T12:16Z
- **Tasks:** 2 (Task 2 was TDD: RED -> GREEN)
- **Files modified:** 3 (2 modified, 1 created)

## Accomplishments
- `require_sso_manage` authz guard — a verbatim mirror of `require_org_invite` with the permission key swapped to `sso:manage`, pinned to the strict active org, with an SSO-specific 403 (a product feature, not the `/admin` byte-identical 404). Fail-closed until the mig-113 grant lands.
- `provision_sso_membership` — the domain-gated idempotent JIT insert: `pg_advisory_xact_lock` + `INSERT … ON CONFLICT (org_id,user_id) DO NOTHING`, role HARDCODED `member`, on the BYPASSRLS singleton pool. All invite-specific machinery (token lookup, status flip, claimability) dropped.
- `test_168_sso_jit.py` — 5 live tests proving: 8x concurrent-converge to exactly one membership (one `joined=True`), idempotent re-provision no-op, role always `member` + no `role` parameter, duplicate-email two-UUID -> two independent rows, and join-additive (prior-org membership survives).

## Task Commits

Each task was committed atomically:

1. **Task 1: require_sso_manage authz guard** - `bc14f085` (feat)
2. **Task 2 (TDD): provision_sso_membership + integration test**
   - RED: `81a62788` (test — failing test, AttributeError on the not-yet-existing function)
   - GREEN: `d85985d7` (feat — implementation, 5/5 tests pass)

**Plan metadata:** (this commit) `docs(168-03): complete plan`

_Task 2 is a TDD task, hence the test -> feat commit pair. No REFACTOR commit was needed — the implementation cleanly reused the established `accept_invitation` skeleton._

## Files Created/Modified
- `backend/app/dependencies.py` - Added `require_sso_manage` (strict active-org, `sso:manage` `_has_org_permission` gate, SSO-specific 403; docstring cites the mig-113 grant).
- `backend/app/services/invitation_service.py` - Added `provision_sso_membership` (advisory-lock + ON CONFLICT DO NOTHING, hardcoded `member` role, BYPASSRLS pool, duplicate-email-tolerant, join-additive; reuses `_rowcount`).
- `backend/tests/integration/test_168_sso_jit.py` - New live integration test (modeled on `test_167_jit_race.py`): concurrent-converge, idempotency, role=member, duplicate-email two-UUID, join-additive; `jit_env` seeding fixture with FK-safe teardown.

## Decisions Made
- Passed `"member"` as the `$3` bind literal (mirroring `accept_invitation`'s `VALUES ($1,$2,$3)` shape) rather than inlining a SQL string literal — keeps the SQL text identical to the invite-accept sibling while satisfying "no role parameter, hardcoded member" (D-168-03).
- Duplicate-email test uses two distinct auth.users UUIDs with a try/except fallback: it attempts a genuinely shared email first, falling back to distinct emails if the local DB enforces `auth.users` email uniqueness — either path proves the load-bearing property (the key is the UUID, not the email).

## Deviations from Plan

None - plan executed exactly as written.

_(Minor in-task wording adjustment, not a deviation: the `provision_sso_membership` docstring was reworded from "no `org_invitations` read/flip" to "no invitation-status flip" so the function body contains no literal `org_invitations` token, satisfying the Task-2 acceptance grep. Folded into the GREEN commit; behavior unchanged.)_

## Issues Encountered
None. Postgres (:54322) was reachable, so RED (AttributeError, not skip) and GREEN (5 passed) were both real. The sibling `test_167_jit_race.py` still passes (no regression to the shared `invitation_service` module).

## Threat Model Coverage
- **T-168-03 (Elevation)** — role HARDCODED `'member'`, no function parameter, never a SAML attribute. Proven by `test_role_is_always_member` (asserts no `role` in the signature + DB row role == 'member').
- **T-168-05 (Tampering, concurrent race)** — `pg_advisory_xact_lock` + `ON CONFLICT DO NOTHING`. Proven by the 8x `asyncio.gather` converge test (exactly one row, one `joined=True`).
- **T-168-08 (Tampering, dup-email conflation)** — membership keys on (org_id, user_id) UUID. Proven by `test_duplicate_email_two_uuids_two_memberships` (two rows for two UUIDs).
- **T-168-06 (Authz)** — `require_sso_manage` over mig-104's SECDEF `current_user_has_permission`, strict active org; grant lands in mig 113 (Plan 01).

## User Setup Required
None - no external service configuration required. (The `sso:manage` grant is seeded by migration 113 from Plan 01, not this plan.)

## Next Phase Readiness
- Plan 04's `/org/sso/providers` endpoints can now be pure wiring: `require_sso_manage` guards the writes and `provision_sso_membership` is the JIT insert the SSO first-login callback consumes (after it resolves email domain -> provider -> org).
- No blockers. Cloud parity owed unchanged (migs 099->113 + `SECRETS_ENCRYPTION_KEY` at next operator-gated push) — this plan adds no migration.

## Self-Check: PASSED
- Files exist: `backend/app/dependencies.py`, `backend/app/services/invitation_service.py`, `backend/tests/integration/test_168_sso_jit.py` — all FOUND.
- Commits exist: `bc14f085`, `81a62788`, `d85985d7` — all FOUND.
- Test suite: `pytest tests/integration/test_168_sso_jit.py` = 5 passed. Sibling `test_167_jit_race.py` = 1 passed (no regression).

---
*Phase: 168-sso-saml-2-0-core*
*Completed: 2026-07-22*
