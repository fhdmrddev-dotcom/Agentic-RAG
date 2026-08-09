---
phase: 168-sso-saml-2-0-core
plan: 05
subsystem: auth
tags: [sso, saml, supabase-auth, react, typescript, org-context, jit-provisioning]

# Dependency graph
requires:
  - phase: 168-04
    provides: "/org/me can_manage_sso; /org/sso/providers CRUD; /org/sso/route public lookup; /org/sso/provision domain-gated JIT"
  - phase: 166
    provides: "OrgProvider + useOrgPermissionsProbe + canManage/canAuditView render-flag pattern; X-Org-Id header seam"
  - phase: 167
    provides: "getOrgMembers/invitation client-fn shape; join-additive membership model"
provides:
  - "api.ts SSO client fns (getSsoRoute, listSsoConfigs, createSsoProvider, updateSsoProvider, deleteSsoProvider, provisionSso) + SsoConfig type"
  - "OrgPermissions.can_manage_sso contract (defensive fail-closed unwrap)"
  - "canManageSso fail-closed render flag threaded through useOrgPermissionsProbe + OrgProvider (lockstep with canManage)"
  - "useAuth.signInWithSSO — supabase-js signInWithSSO({domain}) + manual redirect"
  - "OrgProvider SSO-callback JIT wiring — provisionSso() on SIGNED_IN SSO session then /org/me re-probe"
affects: [168-06, "SsoTab", "SignInForm", "OrgAdminShell SSO tab"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fail-closed render flag repeated in lockstep across probe CLOSED default + interface + return map + OrgValue + useMemo (T-168-06)"
    - "Pre-auth bare-fetch exception for a public boolean-only endpoint (getSsoRoute — no X-Org-Id, callable from the login page)"
    - "Server {detail} passthrough onto ApiError so backend create/update copy renders verbatim in the UI"
    - "Opaque reprobeKey param on a permissions probe to force a fresh /org/me without a user/org switch"
    - "SSO-session detection via supabase session app_metadata/identities sso: provider prefix inside a provider effect"

key-files:
  created: []
  modified:
    - "frontend/src/lib/api.ts — SsoConfig type + 6 SSO client fns + can_manage_sso on OrgPermissions"
    - "frontend/src/hooks/useOrgPermissionsProbe.ts — canManageSso field/return/CLOSED + reprobeKey param"
    - "frontend/src/providers/OrgProvider.tsx — canManageSso in OrgValue/useMemo + SSO-JIT provision-then-reprobe effect"
    - "frontend/src/hooks/useAuth.ts — signInWithSSO sibling (manual redirect)"

key-decisions:
  - "canManageSso is fail-CLOSED render-only — a probe blip never flashes the SSO tab; require_sso_manage is the wall (T-168-06)"
  - "signInWithSSO redirects the browser MANUALLY (window.location.href = data.url) — supabase-js does not auto-navigate (D-168-02)"
  - "SSO-callback JIT: on a SIGNED_IN SSO session provisionSso() fires once (keyed on userId) then a reprobeNonce bump re-probes /org/me so the joined org resolves (D-168-04)"
  - "getSsoRoute is a pre-auth BARE fetch (no X-Org-Id) — the login page calls it before any session exists"
  - "signInWithPassword/signUp left byte-unchanged — the password fallback is preserved (SC#3)"

patterns-established:
  - "Pattern: reprobeKey (opaque bump) as the generic 'refresh /org/me without a switch' trigger, defaulted so pre-168 callers are unchanged"
  - "Pattern: additive-only auth-hook siblings — new sign-in method added between signUp and signOut, existing method bodies untouched"

requirements-completed: []  # SSO-01 is phase-spanning (plans 02-06); it stays Pending until Plan 06 lands the surfaces.

# Metrics
duration: 14min
completed: 2026-07-22
---

# Phase 168 Plan 05: SSO Frontend Data + Auth Layer Summary

**The frontend contracts the Plan-06 SSO surfaces render on: six api.ts SSO client fns + the fail-closed `can_manage_sso` render flag threaded through the probe and OrgProvider in lockstep, `useAuth.signInWithSSO` with a manual IdP redirect, and the SIGNED_IN → silent JIT-provision → `/org/me` re-probe wiring so a first-time SSO user lands in the org switcher.**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-07-22T08:41Z (approx)
- **Completed:** 2026-07-22T08:55Z
- **Tasks:** 2
- **Files modified:** 7 (4 plan files + 3 test-mock fixes)

## Accomplishments
- `api.ts` SSO surface: `SsoConfig` type + `getSsoRoute` (pre-auth bare fetch), `listSsoConfigs`, `createSsoProvider`, `updateSsoProvider`, `deleteSsoProvider`, `provisionSso` — all mirroring the `getOrgMembers` shape; create/update surface the server `{detail}` so the UI-SPEC create-error copy renders verbatim. No secret ever crosses the wire.
- `OrgPermissions.can_manage_sso` contract + defensive `?? false` unwrap in `getOrgPermissions`.
- `canManageSso` fail-closed render flag threaded end-to-end: probe `CLOSED` default + interface + return map → `OrgValue` + `useMemo` value/deps (exact lockstep with `canManage`).
- `useAuth.signInWithSSO(domain)` — calls `supabase.auth.signInWithSSO({ domain })` and redirects the browser MANUALLY; `signInWithPassword`/`signUp` byte-unchanged (SC#3).
- OrgProvider SSO-callback JIT: on a SIGNED_IN SSO session (detected via `app_metadata`/`identities` `sso:` provider) `provisionSso()` fires exactly once, then a `reprobeNonce` bump re-probes `/org/me` so the newly-joined org's memberships resolve (the WR-01 self-heal then adopts it into the switcher). No-op + non-fatal for password sessions.

## Task Commits

Each task was committed atomically:

1. **Task 1: api.ts SSO client fns + OrgPermissions.can_manage_sso** — `3bb62976` (feat)
2. **Task 2: canManageSso through probe + OrgProvider, signInWithSSO, SSO-JIT wiring** — `acb8a034` (feat)

**Plan metadata:** (this commit) (docs: complete plan)

## Files Created/Modified
- `frontend/src/lib/api.ts` — `SsoConfig` type, 6 SSO client fns, `can_manage_sso` on `OrgPermissions` + its defensive unwrap, `ssoErrorDetail` helper
- `frontend/src/hooks/useOrgPermissionsProbe.ts` — `canManageSso` interface field + return map + `CLOSED` fail-closed default; optional `reprobeKey` third param (defaults to pre-168 re-key behavior)
- `frontend/src/providers/OrgProvider.tsx` — `canManageSso` in `OrgValue` + probe destructure + `useMemo` value/deps; `reprobeNonce` state; SSO-session JIT provision-then-reprobe effect
- `frontend/src/hooks/useAuth.ts` — `signInWithSSO` sibling + `UseAuth` interface field + return (password path untouched)
- `frontend/src/components/layout/NavPanel.test.tsx` — added `canManageSso` to the local `OrgValue` mock factory
- `frontend/src/components/layout/ProfileMenu.test.tsx` — added `canManageSso` to the local `OrgValue` mock factory
- `frontend/src/components/org/OrgAdminShell.test.tsx` — added `canManageSso` to the local `useOrg` mock

## Decisions Made
- **`canManageSso` fail-closed render-only.** The flag decides SSO-tab RENDERING only; `require_sso_manage` (Plan 04) over mig-104 RLS is the wall (T-168-06). Repeated the `canManage` polarity verbatim at every site, including the `CLOSED` default.
- **Manual SSO redirect.** `signInWithSSO` does `window.location.href = data.url` — supabase-js does not auto-navigate (D-168-02).
- **JIT via a reprobe nonce.** Rather than change the probe's user/org keys, added an opaque `reprobeKey` param; OrgProvider bumps it after `provisionSso()` so `/org/me` re-resolves the joined org. Idempotent and safe on every SIGNED_IN; the SSO-session guard is a network-call optimization, not a security boundary (the server hardcodes role `member`, D-168-03).
- **Pre-auth `getSsoRoute`.** A bare fetch with no `Authorization`/`X-Org-Id` — the identifier-first login page calls it before any session exists; the endpoint is public + boolean-only (anti-enumeration, T-168-10).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Pulled the probe `CLOSED` `can_manage_sso: false` default into the Task 1 commit**
- **Found during:** Task 1 (api.ts type contract)
- **Issue:** Adding the required `can_manage_sso` field to the shared `OrgPermissions` type immediately broke the `CLOSED` literal in `useOrgPermissionsProbe.ts` (TS2741), so Task 1's own `tsc` gate could not pass standalone. The plan assigned the `CLOSED` edit to Task 2.
- **Fix:** Added the single `can_manage_sso: false` line to `CLOSED` as part of the Task 1 commit so the type-contract commit compiles green; Task 2 then added the remaining probe plumbing (interface field, return map, reprobeKey).
- **Files modified:** frontend/src/hooks/useOrgPermissionsProbe.ts
- **Verification:** `tsc -b` plan-file errors dropped from 1 → 0 after the fix.
- **Committed in:** `3bb62976` (Task 1 commit)

**2. [Rule 3 - Blocking] Added `canManageSso` to 3 `OrgValue` test mocks**
- **Found during:** Task 2 (OrgValue type change)
- **Issue:** Making `canManageSso` a required `OrgValue` field broke 3 local test-mock factories that construct an `OrgValue`/`useOrg` return (NavPanel, ProfileMenu, OrgAdminShell tests) — 3 net-new `tsc` errors directly caused by the type change.
- **Fix:** Added `canManageSso: false`/`true` to each local mock (matching each mock's existing manager polarity).
- **Files modified:** frontend/src/components/layout/NavPanel.test.tsx, frontend/src/components/layout/ProfileMenu.test.tsx, frontend/src/components/org/OrgAdminShell.test.tsx
- **Verification:** `tsc -b` total returned to the pre-existing baseline (32); net-new errors from this plan = 0.
- **Committed in:** `acb8a034` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 - blocking type consequences of adding a required field to a shared type).
**Impact on plan:** Both are minimal, in-scope (directly caused by the plan's own type changes), and necessary to keep each commit compiling. No scope creep.

## Issues Encountered
- **Pre-existing `tsc -b` rot (SEED-056 / SEED-049).** The repo's `tsconfig.app.json` includes all of `src` (tests included), so `tsc -b --noEmit` carries ~32 pre-existing errors in unrelated test/mock files (`MessageSkeleton`, `MemorySection`, `SkillFormDialog`, various `__tests__`). These are out of scope. Verification was performed as "zero errors in the plan's touched files AND zero net-new errors vs. the baseline" — both confirmed. One baseline error in `NavPanel.test.tsx` shifted line 86→87 due to a one-line mock insertion (same error, not new).
- `App.tsx` mounts `<OrgProvider userId={...}>` with no session prop and is out of this plan's scope, so SSO-session detection was done inside OrgProvider by reading the live supabase session — no out-of-scope file edits needed.

## User Setup Required
None - no external service configuration required. (Live SSO round-trip verification of the callback/JIT depends on a configured IdP and is exercised at Plan 06 / phase UAT.)

## Next Phase Readiness
- Plan 06 (the presentational plan) can now build `SsoTab`, the identifier-first `SignInForm`, and flip the `OrgAdminShell` SSO `LockedTab` → live, consuming: `useOrg().canManageSso`, the six api.ts SSO fns, and `useAuth().signInWithSSO`. All contracts + async plumbing are landed here so Plan 06 stays pure.
- SSO-01 remains Pending (phase-spanning, plans 02-06) — closes when Plan 06 lands the surfaces.
- No migration; no cloud-parity delta from this plan. (Standing owed: migs 099→113 + `SECRETS_ENCRYPTION_KEY` at next operator-gated push, from prior plans.)

---
*Phase: 168-sso-saml-2-0-core*
*Completed: 2026-07-22*

## Self-Check: PASSED
- FOUND: `.planning/phases/168-sso-saml-2-0-core/168-05-SUMMARY.md`
- FOUND: commit `3bb62976` (Task 1)
- FOUND: commit `acb8a034` (Task 2)
