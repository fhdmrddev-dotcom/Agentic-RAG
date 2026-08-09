---
phase: 177-v3-4-org-surface-polish
plan: 05
subsystem: ui
tags: [react, tailwind, shadcn, lucide-react, vitest, auth, invite, sso, notice, card-shell]

# Dependency graph
requires:
  - phase: 177-01
    provides: HonestNotice severity-keyed auth callout (calm/progress/success/error) — the D-11/D-12 primitive this plan wires
  - phase: 167-invites-roles
    provides: AcceptInvitePage /invite 6-state landing + acceptInvitation flow (the surface being reskinned)
  - phase: 168-sso
    provides: SignInForm identifier-first + fail-open (T-168-07 / SC#3) — the byte-frozen logic this plan makes legible
provides:
  - "frontend/src/components/auth/AuthCardShell.tsx — ONE shared branded auth card shell (orbs + Card + sparkle header) consumed by AuthPage + AcceptInvitePage (D-14)"
  - "AcceptInvitePage 6 states routed through HonestNotice; recoverable dead-ends recolored to calm (D-11/D-12)"
  - "SignInForm error line via HonestNotice + a legible fail-open calm note on the outage-degrade path (D-11/D-13)"
affects: []  # Wave 2 tail — this is the last plan of phase 177

# Tech tracking
tech-stack:
  added: []  # RED LINE held — no new npm package (D-01); frontend/package.json unchanged
  patterns:
    - "shared brand-shell extraction: AuthCardShell({title, subhead, children}) — verbatim-token lift, zero visual change"
    - "severity-keyed HonestNotice wiring: recoverable ≠ error (D-12); danger weight earned by genuine system failure only"
    - "display-only degrade flag (`degraded`) gates a reassurance note, never any reveal behavior (D-13 fail-open frozen)"

key-files:
  created:
    - frontend/src/components/auth/AuthCardShell.tsx
  modified:
    - frontend/src/pages/AuthPage.tsx
    - frontend/src/pages/AcceptInvitePage.tsx
    - frontend/src/components/auth/SignInForm.tsx

key-decisions:
  - "AuthCardShell markup lifted verbatim from AuthPage.tsx:15-44 (the byte-identical clone AcceptInvitePage held) — no visual change, single source now"
  - "All three recoverable invite `error` messages (404 invalid / 409 expired-or-revoked / generic 'ask for a fresh link') render severity=calm — none is a genuine non-recoverable system failure, so none earns error weight (D-12)"
  - "SignInForm `degraded` is set true ONLY in the handleContinue getSsoRoute catch (the outage path); the normal non-SSO reveal (sso===false) carries NO note — it is not a degrade"
  - "Reworded my own code comments to describe glyphs by colour/shape (not the lucide symbol names) so the D-12 acceptance grep `AlertTriangle → 0` stays literally true"

requirements-completed: []  # ORGUX-02 closes across the Wave-2 tail; orchestrator owns REQUIREMENTS.md marking

# Metrics
duration: ~18min
completed: 2026-07-23
---

# Phase 177 Plan 05: Entry / Failure-Honesty Polish Summary

**Made "coming into an org" read as ONE calm, error-honest product surface: extracted the duplicated brand-card into a shared `AuthCardShell` (D-14), routed the `/invite` landing's six states + the sign-in error line through the shared `HonestNotice` (D-11), recolored every recoverable invite dead-end to CALM instead of alarming red (D-12), and made the sign-in fail-open a legible reassurance instead of a silent degrade (D-13) — all auth/route/accept logic byte-frozen.**

## Performance

- **Duration:** ~18 min
- **Completed:** 2026-07-23
- **Tasks:** 3 (auto; no TDD — copy/notice/shell polish over shipped 166/167/168 surfaces)
- **Files:** 1 created (AuthCardShell) + 3 modified (AuthPage, AcceptInvitePage, SignInForm)

## Accomplishments

- **AuthCardShell (D-14)** — the full-screen centered container + two org-indigo orbs (`bg-primary/10` + `bg-violet-500/10 blur-3xl`) + `ghost-border bg-card/80 backdrop-blur-sm` Card + `gradient-primary` Sparkles header tile is now ONE component. `AuthPage` and `AcceptInvitePage` both render `<AuthCardShell title=… subhead=…>{body}</AuthCardShell>`; `blur-3xl` is gone from both pages (single-sourced). Titles ("Agentic RAG" / "You've been invited") and every flow preserved — markup lifted verbatim, zero visual change.
- **AcceptInvitePage 6 states → HonestNotice (D-11/D-12)** — `accepting`→`progress` (indigo spinner) · `joined`/`already`→`success` (green check) · `missing`→`calm` · `error`→`calm`. The alarming red `AlertTriangle` is GONE from every recoverable dead-end (missing token / 404 invalid / 409 expired-or-revoked / generic). The honest copy ("ask whoever invited you … for a fresh link", the 404/409 messages) is byte-identical; the accept `useEffect` + `ACTIVE_ORG_STORAGE_KEY` seed + redirect + the Go-to-app button are untouched.
- **SignInForm error + legible fail-open (D-11/D-13)** — the bare `text-destructive` error `<p>` is now `<HonestNotice severity="error">` (earned weight, `role="alert"`). A new display-only `degraded` flag is set true ONLY inside the `handleContinue` route-outage catch (the fail-open path), and `phase === "password" && degraded` renders a calm reassurance: *"Nothing's wrong with your account — sign-in routing is temporarily unavailable, so you can sign in with your password."* The non-SSO reveal (a normal reveal, not a degrade) carries no note. `handleContinue` / `handleSubmit` / `handleSsoEscape` / `getSsoRoute` / `signInWithSSO` and the `phase` machine are byte-frozen.
- **All RED LINES held** — `StreamsProvider.tsx` UNTOUCHED (empty diff), `frontend/package.json` unchanged (no new package), no server contract / authz / migration touched. Touched files are exactly the plan's four.

## Task Commits

Each task committed atomically:

1. **Task 1: AuthCardShell (D-14)** — `dbeea5e1` (refactor) — new shell + AuthPage + AcceptInvitePage consume it; `blur-3xl` → 0 in both pages.
2. **Task 2: AcceptInvitePage states → HonestNotice (D-11/D-12)** — `63cd3204` (feat) — 6 states routed; recoverable → calm; `AlertTriangle` → 0; honest copy verbatim.
3. **Task 3: SignInForm error + fail-open note (D-11/D-13)** — `a199c6e6` (feat) — error via HonestNotice; `degraded` note on the outage path only; 6/6 beats green.

## Files Created/Modified

- `frontend/src/components/auth/AuthCardShell.tsx` — the shared branded auth card shell (created).
- `frontend/src/pages/AuthPage.tsx` — renders AuthCardShell; inline orb/card markup removed.
- `frontend/src/pages/AcceptInvitePage.tsx` — AuthCardShell + 6-state HonestNotice; recoverable → calm.
- `frontend/src/components/auth/SignInForm.tsx` — HonestNotice error + D-13 fail-open calm note.

## Verification Results

- **Task 3 gate — SignInForm 6-beat suite:** `npx vitest run src/components/auth/SignInForm.test.tsx` → **6/6 PASS** (resting state · SSO redirect · non-SSO reveal · fail-open reveal · redirect-failed copy · escape hatch). The fail-open logic is byte-identical — only additive display state; the calm note (a `role="status"` div) never interferes with the tests' `getByLabelText(/password/i)` / `getByRole("button", {name:/^sign in$/i})` queries.
- **Differential (SEED-056):** `npx vitest run src/components/auth --reporter=dot` → **2 files / 16 tests PASS, 0 failures** (SignInForm 6 · HonestNotice 10). **0 net-new** vs baseline `6d145860` (these suites are green at baseline). AuthCardShell is a pure presentational shell with no co-located test (not TDD — the plan did not require one).
- **tsc:** `npx tsc -b` — my four files compile clean; **zero** type errors reference them. The 33 pre-existing errors are unrelated repo rot (chat/hooks/panel/skills — SEED-056 baseline), out of scope.
- **Acceptance greps (all pass):** `blur-3xl` → 0 in both pages · titles preserved · `AlertTriangle` → 0 in AcceptInvitePage · "ask whoever invited you" + the 404/409 copy present · severities `success`×2 / `progress`×1 / `calm`×2 · SignInForm `text-destructive` → 0, `HonestNotice severity="error"` present, `setDegraded(true)` exactly once (in the catch), calm note gated `phase === "password" && degraded`, `getSsoRoute` + `signInWithSSO` intact.
- **RED LINE (D-02):** `git diff` for `frontend/src/providers/StreamsProvider.tsx` is EMPTY — UNTOUCHED.
- **RED LINE (D-01):** `frontend/package.json` diff is EMPTY — no new package.
- **RED LINE (D-13 fail-open frozen):** the fail-open / redirect-failed / non-SSO-reveal beats stay green — logic byte-identical, only additive display state.

## Decisions Made

None beyond the plan. One nuance worth recording: I reworded my own explanatory code comments in AcceptInvitePage to describe glyphs by colour/shape ("the indigo spinner", "the green check", "the alarming red warning glyph") rather than naming the lucide symbols (`Loader2`/`CheckCircle2`/`AlertTriangle`), so the D-12 acceptance grep `grep -c "AlertTriangle" → 0` stays literally true while the intent stays legible.

## Deviations from Plan

None — plan executed exactly as written. All auth/route/accept logic byte-frozen; only copy + notice container + card shell changed.

## Known Stubs

None. AuthCardShell is a complete presentational shell (title / subhead / children, all supplied by real call sites). The invite + sign-in states render real flow data (accept result, error messages, degrade state) through HonestNotice — no hardcoded empty values, no placeholder/"coming soon"/TODO copy. The invite "error" copy is intentional honest failure messaging, not a stub.

## Threat Flags

None. D-01/D-03 — polish over the already-secured 166–168 pre-auth surfaces (`threats_open: 0`). No new network endpoint, auth path, file-access pattern, or schema surface. The fail-open safety property (T-168-07 / SC#3) is PRESERVED, not changed; no server contract (`getSsoRoute`, `acceptInvitation`, `signInWithSSO`) touched.

## Issues Encountered

None. The three lucide glyph names surviving in comments after the JSX swap were caught by the acceptance grep and reworded (see Decisions Made) — a labeling detail, not a code issue.

## Self-Check: PASSED

- All 4 files verified on disk (FOUND ×4).
- All 3 task commits verified in `git log` (FOUND ×3): `dbeea5e1`, `63cd3204`, `a199c6e6`.
- SignInForm 6/6 beats green; auth-dir 16/16 green (0 net-new vs `6d145860`); StreamsProvider + package.json diffs empty.

---
*Phase: 177-v3-4-org-surface-polish*
*Completed: 2026-07-23*
