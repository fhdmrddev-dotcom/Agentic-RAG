---
phase: 167-invitations-roles-greenlists-jit-per-user-prefs
plan: 06
subsystem: ui
tags: [invitations, accept-landing, jit, onboarding, react, no-router, idempotent, org-switcher, tdd]

# Dependency graph
requires:
  - phase: 167-05
    provides: "api.ts acceptInvitation(token) -> {org_id, role, joined} (getAuthHeaders auto-injects X-Org-Id; ApiError on non-OK)"
  - phase: 167-02
    provides: "POST /org/invitations/accept — token-gated (get_current_user only), idempotent, join-additive; status mapping unknown→404 / expired|revoked→409 / valid|already-accepted→200"
  - phase: 166-org-shell
    provides: "OrgProvider re-probe on fresh mount + org switcher (renders at 2+ orgs) — the additive multi-org landing an accepted invitee arrives in (D-167-01)"
provides:
  - "frontend/src/pages/AcceptInvitePage.tsx — the /invite accept-invite landing: AuthPage-cloned brand shell + SignIn/SignUp toggle + first-authed-session idempotent acceptInvitation(token) + honest joined/already/missing/expired/invalid states + redirect-home so OrgProvider re-probes"
  - "App.tsx /invite routing branch — a guarded window.location.pathname check (no url router), placed BEFORE the !user AuthPage return, mirroring the shipped /setup precedent"
affects: [168 SSO reuses the accept landing seam]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "No-router path routing: a guarded `window.location.pathname === '/invite'` branch in App.tsx mirroring the shipped /setup precedent — additive, non-/invite path byte-identical"
    - "First-authed-session accept: a `firedRef` guards acceptInvitation to fire ONCE per authed session (server-idempotent regardless — T-167-21) so a re-render / StrictMode double-invoke is safe"
    - "Token survival across an email-confirm round-trip: raw token captured from URLSearchParams and mirrored into sessionStorage (RESEARCH OQ1) so a confirm reload that drops the query string still accepts"
    - "Redirect-to-root re-probe: window.location.assign('/') remounts OrgProvider (which the /invite landing sits OUTSIDE of) so the 166 switcher renders both orgs with no new switcher code (D-167-01)"

key-files:
  created:
    - frontend/src/pages/AcceptInvitePage.tsx
    - frontend/src/pages/AcceptInvitePage.test.tsx
  modified:
    - frontend/src/App.tsx

key-decisions:
  - "AcceptInvitePage receives user/onSignIn/onSignUp as PROPS from App's already-resolved useAuth (mirrors AuthPage's onSignIn/onSignUp) rather than calling useAuth internally — self-contained, no double auth subscription, and testable without mocking supabase. The plan's 'reuses the useAuth signIn/signUp/user' contract is honored via prop threading."
  - "Post-accept refresh = window.location.assign('/') (the plan's specified mechanism, mirroring FinalizedLockout onGoToApp). AcceptInvitePage renders OUTSIDE OrgProvider (before the authed OrgProvider-wrapped return), so it cannot call an in-context refetch seam; a fresh mount at '/' re-probes OrgProvider and surfaces the switcher — the correct 'org context refreshes post-accept' path."
  - "Honest status mapping: 404→invalid-link, 409→expired-or-revoked, joined=false→already-a-member, no token→missing-token — each a plain user-facing message, never a raw error (D-167-08 honesty)."

patterns-established:
  - "Accept landing brand shell = verbatim AuthPage clone (org-indigo primary + violet orbs; the reserved operator warning tint is never used — grep amber == 0)"
  - "State-machine card body (auth | accepting | joined | already | missing | error) inside one shared shell — the body switches while the brand header stays constant"

requirements-completed: [INV-01, INV-02]

# Metrics
duration: ~25min
completed: 2026-07-22
---

# Phase 167 Plan 06: /invite Accept-Invite Landing Summary

**The `/invite?token=…` accept landing is LIVE: an invitee arrives, signs in (existing account → additive 2nd org, D-167-01) or signs up (fresh → joins that org), and on their FIRST authenticated session the page idempotently calls `acceptInvitation(token)` — then redirects home so the shipped 166 OrgProvider re-probes and the org switcher shows both orgs, with NO new switcher code. The raw token is captured from the URL + mirrored into sessionStorage so it survives an email-confirm reload (RESEARCH OQ1); expired / revoked / invalid / already-a-member outcomes surface honest messages. Routing is a guarded `window.location.pathname === "/invite"` branch mirroring the shipped `/setup` precedent — no url router, non-/invite path byte-identical.**

## Performance
- **Duration:** ~25 min
- **Completed:** 2026-07-22
- **Tasks:** 2 (Task 2 was tdd="true" — see TDD Gate Compliance)
- **Files created:** 2 | **Files modified:** 1

## Accomplishments
- **AcceptInvitePage (INV-01 / INV-02 / D-167-01):** clones AuthPage's centered `Card` brand shell (org-indigo `primary` + violet gradient orbs) framed "You've been invited". Reads the raw token via `new URLSearchParams(window.location.search).get("token")` and mirrors it into `sessionStorage` so it survives an email-confirm reload that drops the query string (RESEARCH OQ1). An unauthenticated invitee gets the shipped `SignInForm`/`SignUpForm` toggle (sign in → additive 2nd org; sign up → the mig-105 trigger mints their personal org, then the accept additively joins the inviting org). When the `user` prop resolves non-null, a `firedRef`-guarded effect calls `acceptInvitation(token)` **once** on the first authed session (the server accept is idempotent + re-runnable regardless — T-167-21). On success it shows a brief "You've joined the organization" (or "already a member" on an idempotent `joined=false`) confirmation, then `window.location.assign("/")` so OrgProvider re-probes on a fresh mount and the 166 switcher renders both orgs. Honest failure states: **missing token** (no `?token=`), **invalid link** (404), **expired or revoked** (409) — each a plain message, never a raw error.
- **App.tsx /invite routing (no url router):** added `const atInvitePath = window.location.pathname === "/invite"` and an `if (atInvitePath) return <AcceptInvitePage user={user} onSignIn={signIn} onSignUp={signUp} />` branch, placed BEFORE the `if (!user) return <AuthPage .../>` line (mirroring the `/setup` pre-auth branch placement). An unauthenticated invitee gets the invite-branded auth; an already-authenticated visitor on `/invite` still lands on the accept flow (not straight into ChatLayout). The non-/invite path is byte-identical — the branch only fires on the literal `/invite` path.
- **Behavioral-lock test (6 cases):** `AcceptInvitePage.test.tsx` mocks `@/lib/api` (so no supabase client loads) and stubs `window.location` per-test to thread `?token=…`. It locks: unauthed → invite-branded auth + no accept; authed → `acceptInvitation("tok-abc")` called exactly once + join confirmation; idempotent `joined=false` → already-a-member; missing token → honest message + no accept; 409 → expired/revoked message; 404 → invalid-link message.

## Task Commits
1. **Task 1: AcceptInvitePage — invite-branded auth + first-session idempotent accept** — `cc127660` (feat)
2. **Task 2 (tdd): App.tsx /invite routing branch + behavioral-lock test** — `08eb1915` (feat) — see TDD Gate Compliance

_Plan metadata commit (this SUMMARY) follows._

## Files Created/Modified
- `frontend/src/pages/AcceptInvitePage.tsx` (new) — the accept-invite landing: brand shell + SignIn/SignUp toggle + first-authed-session idempotent accept + honest state machine + redirect-home.
- `frontend/src/pages/AcceptInvitePage.test.tsx` (new) — 6 cases locking the auth-forms / accept-wiring / honest-failure contract.
- `frontend/src/App.tsx` — the guarded `atInvitePath` routing branch (import + branch), placed before the `!user` AuthPage return.

## Decisions Made
- **Props over internal useAuth.** AcceptInvitePage takes `user` / `onSignIn` / `onSignUp` as props from App's already-loading-gated useAuth (exactly how AuthPage receives `onSignIn`/`onSignUp`). This avoids a second supabase auth subscription, dodges a loading-flash of the auth form for an already-authed visitor, and makes the component testable with a plain fake `user` prop (no supabase mock). The plan's interface note ("useAuth hook: signIn / signUp / user — the auth actions AcceptInvitePage reuses") is satisfied by prop threading.
- **Post-accept refresh = redirect to `/`.** The `/invite` landing renders OUTSIDE `<OrgProvider>` (it sits before the authed, OrgProvider-wrapped return in App.tsx), so it has no in-context refetch seam to call. The plan's specified `window.location.assign("/")` (mirroring the shipped `FinalizedLockout` onGoToApp) is the correct mechanism: a fresh mount at `/` re-probes OrgProvider, which surfaces the switcher at 2+ orgs. This IS the "org context refreshes post-accept" path — the new membership + switcher appear via the OrgProvider mount-probe, no manual switcher work (D-167-01).
- **Fire-once guard = `firedRef`, not an `alive` cleanup flag.** Under React 19 StrictMode the accept effect double-invokes; a `firedRef` (persisted across the double-invoke) fires the accept exactly once and lets the resolved setState land on the mounted instance. An `alive`-flag cleanup would have swallowed the first run's result under StrictMode. The server accept is idempotent anyway (T-167-21), so a stray double-fire would still be safe.

## Deviations from Plan
None — the plan executed as written. Both artifacts (`AcceptInvitePage.tsx` with `acceptInvitation`, `App.tsx` with the `/invite` branch) and both key-links (page → acceptInvitation via the URL token; App → page via the `window.location.pathname === "/invite"` branch before the `!user` return) match the plan's must_haves. The two design choices above (props threading, redirect-home refresh) are within Claude's implementation latitude and honor the plan's stated interfaces — not scope changes.

## TDD Gate Compliance
Task 2 carries `tdd="true"`, but the plan sequences Task 1 to build `AcceptInvitePage.tsx` FIRST and Task 2 to add the App.tsx routing + a test. Because the component already existed after Task 1 (by plan design), the Task-2 test is **green-on-arrival** — a genuine RED (failing) phase was not achievable for the component behaviors, so there is no separate `test(...)` RED commit followed by a `feat(...)` GREEN commit. The test is committed as a behavioral/characterization lock alongside the routing change in a single `feat` commit (`08eb1915`). This is honest: the accept-landing contract (auth-forms, accept-once wiring, honest failure states) is locked by 6 passing assertions, and the net-new Task-2 behavior (the App.tsx `/invite` branch) is verified by the acceptance greps + tsc. No RED/GREEN split was fabricated.

## Verification
- `npx vitest run src/pages/AcceptInvitePage.test.tsx` → **6 passed** (1 file).
- `npx tsc --noEmit` (whole frontend) → **exit 0**.
- Acceptance greps: `grep -c acceptInvitation src/pages/AcceptInvitePage.tsx` = 3 (token from `URLSearchParams`); `grep -ci amber src/pages/AcceptInvitePage.tsx` = **0** (org-indigo shell); `grep -n "atInvitePath\|AcceptInvitePage" src/App.tsx` matches with the branch (line 219-220) sitting BEFORE the `!user` AuthPage return (line ~223).

## Known Stubs
None. The landing consumes the live Plan-05 `acceptInvitation` client (→ the Plan-02 `POST /org/invitations/accept` endpoint) and the real Supabase auth actions; every state (joined / already / missing / invalid / expired) maps to an actual server outcome. No placeholder data, no mock-only paths.

## Threat Flags
None. The only new surface is a client page that carries the raw token from the URL to the existing server accept — fully covered by the plan's threat register (T-167-20/21/22/SC): the token is a server-validated bearer capability (join without a valid token is impossible — the server is the wall), the accept is idempotent (double-fire safe), the token lives only in the URL + transient sessionStorage for the round-trip, and NO new package or url router was added (window.location precedent, AuthPage/auth-form clones).

## Next Phase Readiness
- **Phase 168 (SSO)** reuses this accept landing as the shared onboarding surface — the token-gated accept + the redirect-home re-probe are the seam SSO's JIT flow lands in.
- No migration authored; no new dependency. The 166 OrgProvider + switcher handle the 2-org result unchanged (D-167-01).

## Self-Check: PASSED
- Created files present: `frontend/src/pages/AcceptInvitePage.tsx`, `frontend/src/pages/AcceptInvitePage.test.tsx`.
- Modified file present: `frontend/src/App.tsx` (import + `atInvitePath` branch).
- Commits present in history: `cc127660` (Task 1 feat), `08eb1915` (Task 2 feat).
- Tests: 6/6 passed; `tsc --noEmit` exit 0.

---
*Phase: 167-invitations-roles-greenlists-jit-per-user-prefs*
*Completed: 2026-07-22*
