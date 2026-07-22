---
phase: 168-sso-saml-2-0-core
plan: 06
subsystem: auth
tags: [sso, saml, react, typescript, org-admin, identifier-first-login, ui, aether-deep-midnight]

# Dependency graph
requires:
  - phase: 168-05
    provides: "api.getSsoRoute/listSsoConfigs/createSsoProvider/deleteSsoProvider + SsoConfig type; useAuth.signInWithSSO; useOrg().canManageSso (fail-closed)"
  - phase: 166
    provides: "OrgAdminShell shell-owns-fetch / tabs-are-pure-leaves split; InvitationsTab + OrgSettingsTab sibling-tab pattern; LockedTab→live flip precedent; CHIP_TONE vocabulary"
  - phase: 168-UI-SPEC
    provides: "approved 6/6 design contract — SSO tab + identifier-first login interaction/copy/color/typography/spacing contracts"
provides:
  - "SsoTab.tsx — live org SSO home (metadata-URL + domain create form, server-truth status chip, victim-naming remove confirm, copyable SP-metadata well)"
  - "OrgAdminShell SSO LockedTab → live SsoTab flip (shell-owned fetchSsoConfigs guarded on canManageSso + create/remove mutations, re-fetch-not-optimistic)"
  - "identifier-first SignInForm — email→getSsoRoute→signInWithSSO | password reveal, fail-open-to-password on any route failure, retained password onSubmit fallback"
affects: [phase-168-verify, "org-admin SSO surface", "login page"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure-leaf tab (props in, DOM out) styled as an OrgSettingsTab/InvitationsTab sibling; shell owns fetch + create/remove + re-fetch (148-PATTERNS split)"
    - "Two-phase identifier-first form: a `phase: email|password` state drives the animate-fadeSlideUp password reveal (mirrors SignUpForm's two-render pattern)"
    - "Fail-open UX: any getSsoRoute rejection degrades to the password field (never a blank/locked form) — a DoS mitigation rendered as an interaction contract (T-168-07)"
    - "Inline two-step victim-naming destructive confirm (names the domain) instead of a modal Dialog"
    - "UI-SPEC gate-required intentional deviations: chips/micro-labels drop font-medium(500)→400+uppercase+tracking-wide; spacing snaps to the 4px grid"

key-files:
  created:
    - "frontend/src/components/org/SsoTab.tsx — the live SSO tab pure leaf"
    - "frontend/src/components/auth/SignInForm.test.tsx — identifier-first routing + fail-open test suite (6 cases)"
  modified:
    - "frontend/src/components/org/OrgAdminShell.tsx — SSO LockedTab→live flip; ssoConfigs state + fetchSsoConfigs + create/remove handlers; sso branch in the lazy fetch effect + body switch"
    - "frontend/src/components/auth/SignInForm.tsx — identifier-first rework (Continue→route→password reveal; fail-open; SSO escape hatch)"
    - "frontend/src/components/org/OrgAdminShell.test.tsx — SSO leaves LOCKED_TABS; new SSO-live assertion + SSO api mocks (deviation)"
    - "frontend/src/pages/AcceptInvitePage.test.tsx — resting-CTA assertion Sign In→Continue (deviation)"

key-decisions:
  - "SsoTab is a pure leaf render-gated on canManageSso; the Add-SSO CTA is honest-ABSENT (never disabled) for a non-manager — server require_sso_manage is the wall (T-166-09 / T-168-06)"
  - "The status chip renders server-truth SsoConfig.status — pending_approval reads as the indigo/primary waiting chip (NEVER the reserved operator amber), active=success, disabled=muted (D-168-05)"
  - "SignInForm fails OPEN to the password field on ANY getSsoRoute failure (403/network/outage) — a route outage degrades to password login, never a lockout (T-168-07 / SC#3 / D-168-02)"
  - "getSsoRoute imported directly + signInWithSSO via useAuth() — the Props contract (onSubmit/onSwitch) stays byte-compatible so AuthPage/AcceptInvitePage/SetupTokenGate callers are untouched"
  - "SP-metadata (Entity ID/ACS/NameID) read from the resolved Supabase URL (live client, VITE fallback) — static per deployment, NO API call"

patterns-established:
  - "Pattern: fail-open-to-password as an explicit interaction contract — the DoS-mitigation for a routing seam is a tested UX beat, not a silent catch"
  - "Pattern: honest-absent destructive/create affordances gated on a render-only flag, with the server gate as the true wall (repeats the 166/167 posture for SSO)"

requirements-completed: [SSO-01]

# Metrics
duration: 11min
completed: 2026-07-22
---

# Phase 168 Plan 06: SSO User-Facing Surfaces Summary

**The SSO-01 payoff surfaces on the Plan-05 data layer: the Phase-166 SSO LockedTab flips LIVE as `SsoTab` (create form + server-truth status chip + victim-naming remove + copyable SP-metadata, render-gated on `canManageSso` with an honest-absent CTA), and `SignInForm` reworks to identifier-first — email → domain route → IdP redirect or password reveal, failing OPEN to the password field on any route-lookup failure so no user is ever locked out.**

## Performance

- **Duration:** ~11 min
- **Started:** 2026-07-22T09:04Z
- **Completed:** 2026-07-22T09:15Z
- **Tasks:** 2 (Task 2 TDD)
- **Files touched:** 6 (2 created, 4 modified — incl. 2 sibling-test deviation fixes)

## Accomplishments
- **`SsoTab.tsx` (new pure leaf)** — sibling of `OrgSettingsTab`/`InvitationsTab` in the indigo org zone: a Metadata-URL (`font-mono`) + Email-domain create form (NO XML upload — D-168-01) whose "Add SSO connection" CTA is honest-absent for a non-manager; connection row(s) with domain + opaque `provider_id` mono chip + a server-truth status chip (Pending approval→primary / Active→success / Disabled→muted; the reserved operator amber never appears); a two-step victim-naming remove confirm ("Remove SSO for {domain}?") that is re-fetch-not-optimistic; a static SP-metadata well (Entity ID / ACS URL / NameID) with per-value Copy/Copied. Server `{detail}` create-errors surface verbatim.
- **`OrgAdminShell` SSO flip** — the SSO `LockedTab` → live `<SsoTab/>`: shell-owned `ssoConfigs` state + guarded `fetchSsoConfigs` (honest-degrade `.catch`) + `handleSsoCreate`/`handleSsoRemove` (write then re-fetch), the `sso` branch added to the lazy per-tab fetch effect (gated on `canManageSso`) and the body switch. Mirrors the Phase-167 Invitations flip verbatim.
- **Identifier-first `SignInForm`** — a `phase: "email" | "password"` state drives the flow: resting = one email field + **Continue**; on Continue the domain routes via `getSsoRoute` → `signInWithSSO` (IdP redirect) for an SSO org, else the password field reveals (`animate-fadeSlideUp`) and the CTA relabels to **Sign In** (the byte-preserved `onSubmit(email,password)` fallback). ANY `getSsoRoute` failure fails OPEN to the password field; a redirect failure surfaces the "couldn't start SSO sign-in" copy without blanking. A secondary **Sign in with SSO** escape-hatch link is present.

## Task Commits

Each task was committed atomically:

1. **Task 1: SsoTab.tsx (new) + OrgAdminShell SSO LockedTab→live flip** — `6bf3645e` (feat)
2. **Task 2 (TDD RED): failing identifier-first SignInForm routing tests** — `34c8e63e` (test)
3. **Task 2 (TDD GREEN): identifier-first SignInForm with fail-open password** — `1db7a5d4` (feat)
4. **Deviation: AcceptInvitePage resting-CTA assertion → Continue** — `8526d843` (test)

**Plan metadata:** (this commit) (docs: complete plan)

## Files Created/Modified
- `frontend/src/components/org/SsoTab.tsx` *(created)* — the live SSO tab pure leaf (create form + connection row + status chip + remove confirm + SP-metadata well)
- `frontend/src/components/org/OrgAdminShell.tsx` — SSO TABS entry `locked:false`; `canManageSso` destructure; `ssoConfigs` state + `fetchSsoConfigs` + `handleSsoCreate`/`handleSsoRemove`; sso in the lazy fetch effect + body switch
- `frontend/src/components/auth/SignInForm.tsx` — identifier-first rework (phase state, `handleContinue` fail-open, `handleSsoEscape`, animate-fadeSlideUp password reveal)
- `frontend/src/components/auth/SignInForm.test.tsx` *(created)* — 6 cases: resting email-only; SSO→signInWithSSO; non-SSO→password+onSubmit; route-failure→fail-open; redirect-failed copy; escape-hatch present
- `frontend/src/components/org/OrgAdminShell.test.tsx` — SSO removed from `LOCKED_TABS`; SSO-live mount assertion; `listSsoConfigs`/`createSsoProvider`/`deleteSsoProvider` mocks (deviation)
- `frontend/src/pages/AcceptInvitePage.test.tsx` — unauthenticated-invitee resting-CTA assertion `Sign In` → `Continue` (deviation)

## Decisions Made
- **Honest-absent, render-gated SSO tab.** `SsoTab` render-gates every write affordance on `canManageSso`; the shell only mounts it when `canManageSso`, and the fetch is server-gated on `sso:manage` (T-168-06). The CTA is absent — never a disabled lying button — for a non-manager (T-166-09).
- **Server-truth status chip.** The chip maps `SsoConfig.status` directly (pending_approval→primary indigo waiting chip, active→success, disabled→muted). No client guess, and the reserved operator amber never enters this indigo surface (D-168-05).
- **Fail-open login.** `SignInForm`'s Continue wraps `getSsoRoute` in a try/catch that, on ANY rejection (403 / network / outage), sets `phase="password"` and reveals the field — a route outage degrades to password login, the form is never blanked or locked (T-168-07 / SC#3 / D-168-02). A no-domain email also reveals the password field.
- **Props contract preserved.** `getSsoRoute` is imported directly and `signInWithSSO` comes from `useAuth()`, so the `{ onSubmit, onSwitch }` Props stay byte-compatible — the three call sites (AuthPage, AcceptInvitePage, SetupTokenGate) needed no edits.
- **SP-metadata from the resolved Supabase URL.** Prefer the live client's URL (correct on the D-07 no-rebuild overlay path), fall back to baked `VITE_SUPABASE_URL`; static per deployment, no API call.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated `OrgAdminShell.test.tsx` for the SSO flip**
- **Found during:** Task 1
- **Issue:** Flipping the SSO tab to live directly broke the sibling `OrgAdminShell.test.tsx`, which listed "SSO" in `LOCKED_TABS` and asserted it renders a `LockedTab`; the shell also now imports three SSO api fns the test's `vi.mock("@/lib/api")` factory did not provide.
- **Fix:** Removed SSO from `LOCKED_TABS`, added a positive "SSO is LIVE — mounts SsoTab" assertion, and added `listSsoConfigs`/`createSsoProvider`/`deleteSsoProvider` to the api mock + a `listSsoConfigs` resolved value.
- **Files modified:** frontend/src/components/org/OrgAdminShell.test.tsx
- **Verification:** the suite passes 9/9 (was 8, +1 SSO-live).
- **Committed in:** `6bf3645e` (Task 1 commit)

**2. [Rule 1 - Bug] Updated `AcceptInvitePage.test.tsx` resting-CTA assertion**
- **Found during:** post-Task-2 regression sweep
- **Issue:** The identifier-first rework changed `SignInForm`'s resting CTA from "Sign In" to "Continue"; `AcceptInvitePage.test.tsx` (unauthenticated invitee) asserted the resting "Sign In" button and failed.
- **Fix:** Updated the assertion to the new resting "Continue" CTA (its presence still proves the auth form rendered) with a Phase-168 note.
- **Files modified:** frontend/src/pages/AcceptInvitePage.test.tsx
- **Verification:** the suite passes 6/6.
- **Committed in:** `8526d843`

---

**Total deviations:** 2 auto-fixed (both blocking test consequences directly caused by the plan's own SSO-flip / identifier-first rework). Swept all other `SignInForm` consumers (SetupWizard, SetupTokenGate) — both already green (Props contract unchanged). No scope creep.

## TDD Gate Compliance
Task 2 followed the RED → GREEN cycle: `34c8e63e` (test — 6/6 failing against the old form) → `1db7a5d4` (feat — 6/6 passing). No refactor commit was needed (implementation was clean on first green). Task 1 is `type="auto"` (non-TDD) and its sibling test was updated in the same commit.

## Issues Encountered
- **Pre-existing `tsc -b` rot (SEED-056 / SEED-049).** `tsconfig.app.json` includes all of `src` (tests included), carrying ~32 pre-existing errors in unrelated files (`MessageSkeleton`, `MemorySection`, `SkillFormDialog`, various `__tests__`, plus one Plan-05 baseline error in `OrgProvider.test.tsx`). Out of scope. Verification = "zero errors in the plan's touched files AND zero net-new vs. the 32-error baseline" — both confirmed (total stayed 32).

## User Setup Required
None — no new dependency, no config. The one live mocksaml SSO round-trip is authored in `168-VALIDATION.md` (Manual-Only) and runs at verify-work against operator-confirmed cloud-staging (D-168-06); the phase is not blocked on local infra.

## Next Phase Readiness
- **SSO-01 is COMPLETE** — the phase-spanning requirement (plans 02–06) closes here: org-admins register/remove a connection and see its honest server-truth status + SP metadata; users route by domain with an unconditional password fallback.
- Phase 168 is ready for `/gsd:verify-work` (both build gates green: `tsc` = 0 net-new; `SignInForm.test.tsx` = 6/6; `OrgAdminShell.test.tsx` = 9/9).
- **Cloud parity owed** (standing, from prior plans): migs 099→**113** + `SECRETS_ENCRYPTION_KEY`, in order, at the next operator-gated push. No new cloud-parity delta from this UI-only plan.

---
*Phase: 168-sso-saml-2-0-core*
*Completed: 2026-07-22*

## Self-Check: PASSED
- FOUND: `.planning/phases/168-sso-saml-2-0-core/168-06-SUMMARY.md`
- FOUND: `frontend/src/components/org/SsoTab.tsx`
- FOUND: `frontend/src/components/auth/SignInForm.tsx` + `SignInForm.test.tsx`
- FOUND: commit `6bf3645e` (Task 1) · `34c8e63e` (Task 2 RED) · `1db7a5d4` (Task 2 GREEN) · `8526d843` (deviation)
