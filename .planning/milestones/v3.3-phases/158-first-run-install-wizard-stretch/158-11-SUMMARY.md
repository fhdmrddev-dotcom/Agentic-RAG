---
phase: 158-first-run-install-wizard-stretch
plan: 11
subsystem: ui
tags: [setup-wizard, react, deploy, first-run, pre-auth, step-machine, runtime-config, lifecyclestepper, a11y]

# Dependency graph
requires:
  - phase: 158-08
    provides: "lib/api getSetupStatus() + SetupStatus type; lib/supabase hydrateSupabaseFromRuntime; lib/setupApi.ts (SmokeBody/FinalizeBody/DetectResult/SmokeCheckId types)"
  - phase: 158-09
    provides: "SetupTokenGate, EnvironmentDetectCard, PresetPickerStep (+ SetupPreset), ConnectionBindStep leaves"
  - phase: 158-10
    provides: "OperatorBootstrapStep, ProviderKeyStep, SmokeChecklist, FinalizedLockout leaves"
  - phase: 137
    provides: "skills/studio/LifecycleStepper.tsx — the NODE_TONE + glyph + connector + click-to-revisit rail pattern (ported to the wizard's 6 steps)"
  - phase: 111.1
    provides: "settings/ProviderPicker EXTRACTION_PRESETS + ProviderPickerValue (the provider-step seed)"
provides:
  - "SetupWizard.tsx — the full-page, pre-auth, no-router 6-step install-wizard host: composes the 8 setup leaves on a currentStep state machine, owns the token/detect/preset/bind/operator/provider session state + step nav + finalize→lock-out transition"
  - "WizardStepper — a 6-node progress rail ported from LifecycleStepper (full ≥ sm / strip < sm), completed nodes click-to-revisit (D-14 idempotency)"
  - "App.tsx pre-auth branch — a startup GET /setup/status probe + hydrateSupabaseFromRuntime bootstrap that renders <SetupWizard/> on needs_setup (or a literal /setup path of an un-finalized box) and <FinalizedLockout/> for a finalized /setup visit (SC#2); the configured non-/setup AuthPage/ChatLayout path is byte-identical"
affects: [158-12-drift-check, 158-verify-work, 158-secure-phase, operator-uat]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pre-auth SPA step-machine host (ControlRoomPage shell analog): a full-page currentStep useState, no url router — a window.location.pathname check honours the literal /setup path (D-06)"
    - "Ported-not-imported rail: the shipped LifecycleStepper is bound to the skill PublishGate, so its NODE_TONE/glyph/connector/click-to-revisit-button pattern is generalized to 6 wizard steps (per PATTERNS.md), not reused whole"
    - "Bootstrap runtime-config + fail-safe probe BEFORE the auth check: hydrate Supabase creds from /public-config then probe /setup/status (needs_setup:false on any failure) so a blip never bounces configured users into the wizard"

key-files:
  created:
    - frontend/src/pages/SetupWizard.tsx
  modified:
    - frontend/src/App.tsx
    - frontend/src/pages/__tests__/SetupWizard.test.tsx

key-decisions:
  - "LifecycleStepper is PORTED, not imported: the actual component takes publishGate/caseCount/skillVersion and renders 4 hardcoded skill-studio stages — unusable for 6 arbitrary wizard steps. Per PATTERNS.md ('generalize the 4 domain stages → 6 wizard steps; copy the tone map + glyph + connector'), a local WizardStepper reproduces the NODE_TONE + numbered/✓ glyph + connector + click-to-revisit <button aria-label='Go to {step}'> pattern. The file cites LifecycleStepper in its header (grep contract satisfied) — reuse-by-composition, the phase-wide discipline."
  - "SetupWizard exposes an optional onExitToApp prop (defaults to window.location.assign('/')) so the post-finalize 'Go to the app' does a real navigation+reload — dropping the /setup path AND re-probing status (now finalized) + re-hydrating Supabase. The plan's <SetupWizard/> (no props) call site works unchanged; the prop is additive/injectable."
  - "No auto-prefill of ConnectionBindStep from the chosen preset: every bind field is a secret or an environment-specific URL the operator must supply; a hardcoded localhost/onebox value would be WRONG for a real one-box pointing at cloud Supabase. The preset is captured in state (drives PresetPickerStep's honesty banner); the built happy-path stays one-box (D-09/D-18). Not a stub — deliberate honest-MVP scope."
  - "SmokeBody uses service_role_key; FinalizeBody uses supabase_service_role_key — the host assembles both from the same bind.supabase_service_role_key, honouring the 158-06/08 field-name split (flagged in 158-10 SUMMARY)."
  - "App gates the existing spinner on (loading || setupStatus === null) so a fresh box shows the wizard with no AuthPage flash and a configured box falls straight through once the probe resolves — the returned AuthPage/ChatLayout JSX is byte-identical (only an added async gate precedes it)."

patterns-established:
  - "6-step wizard host: token gate (own shell) → shell{banner + 🔒-session header + rail + step body} → finalize → FinalizedLockout (own shell)"
  - "Token narrowed once past the gate; every leaf write is token-gated; no secret rendered in full; no raw-HTML sink"

requirements-completed: [DEPLOY-02]

# Metrics
duration: 7min
completed: 2026-07-17
---

# Phase 158 Plan 11: SetupWizard Host + App Pre-Auth Branch Summary

**The install wizard is assembled: a full-page, no-router `SetupWizard.tsx` that composes the 8 shipped setup leaves on a 6-step state machine with a LifecycleStepper-ported click-to-revisit rail, plus the `App.tsx` pre-auth branch that probes `GET /setup/status`, hydrates runtime Supabase creds, renders the wizard on `needs_setup`/`/setup`, the lock-out on a finalized `/setup` visit (SC#2), and leaves the configured-box path byte-identical.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-07-17T13:35:19Z
- **Completed:** 2026-07-17T13:42:33Z
- **Tasks:** 2 (Task 1 auto; Task 2 TDD RED → GREEN)
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- **SetupWizard.tsx** (NEW, 345 lines): a `flex min-h-screen flex-col` full-page host mirroring the ControlRoomPage shell — NO url router, a `currentStep` state machine. First screen is `<SetupTokenGate/>`; on accept it mints the header `🔒 setup session` chip (token masked to last-4) and holds the token in state, threaded to every leaf write. The 6-node `WizardStepper` rail (Detect · Preset · Connect · Operator · Provider · Smoke) narrates only the current step (quiet-idle); completed nodes are click-to-revisit (`<button aria-label="Go to {step}">`, D-14). Below `sm` the rail swaps to the strip variant ("Step N of 6 · {name}"). The body renders the step leaf; each Continue advances; the Smoke step's Finalize → `<FinalizedLockout/>`. A slim `role="status"` setup-state banner (MaintenanceBanner shape, primary tint) tops the page.
- **App.tsx** pre-auth branch: a one-shot startup `useEffect` awaits `hydrateSupabaseFromRuntime(API_BASE)` then `getSetupStatus()` (BEFORE the auth check). A branch BEFORE `if (!user)` renders `<SetupWizard/>` when `needs_setup` (or a literal `/setup` visit of an un-finalized box), `<FinalizedLockout/>` for a finalized `/setup` visit (SC#2), and otherwise falls through to the **byte-identical** `if (!user) → AuthPage` / `ChatLayout` render. No react-router — a `window.location.pathname === "/setup"` check honours the path.
- **SetupWizard.test.tsx**: the 5 Wave-0 `it.todo`s realized as live App-render tests (partial-mock `getSetupStatus` + `hydrateSupabaseFromRuntime`, mock `useAuth`) — **5/5 green**, no todos remain.

## Task Commits

Each task committed atomically (Task 2 as TDD RED → GREEN):

1. **Task 1: SetupWizard.tsx — full-page 6-step host** — `091b700c` (feat)
2. **Task 2 (RED): realize App pre-auth /setup branch tests** — `a361fd21` (test)
3. **Task 2 (GREEN): App pre-auth needs_setup branch + runtime hydrate** — `3b029449` (feat)

**Plan metadata:** committed separately (docs — this SUMMARY).

## Files Created/Modified
- `frontend/src/pages/SetupWizard.tsx` (NEW) — the full-page 6-step wizard host + WizardStepper rail + finalize/lock-out flow.
- `frontend/src/App.tsx` — startup setup probe + runtime hydrate; the pre-auth `needs_setup`/`/setup` branch before `!user`; the configured path unchanged.
- `frontend/src/pages/__tests__/SetupWizard.test.tsx` — 5 live App-branch render tests (was the Wave-0 `it.todo` scaffold).

## Decisions Made
See `key-decisions` frontmatter. The load-bearing calls: (1) **LifecycleStepper ported, not imported** — the shipped component is `PublishGate`-bound and 4-stage-hardcoded, so its tone/glyph/connector/click-to-revisit pattern is generalized to the 6 wizard steps (exactly what PATTERNS.md prescribed), with the file citing LifecycleStepper in its header; (2) **an optional `onExitToApp` prop** (default `window.location.assign("/")`) so "Go to the app" is a real navigation+reload that re-reads the finalized status + re-hydrates Supabase — the plan's `<SetupWizard/>` call site is unchanged; (3) **no auto-prefill of bind fields from the preset** (they are secrets / env-specific URLs the operator must supply — a wrong prefill would be a bug), the preset is still captured to drive its honesty banner.

## Deviations from Plan

None — plan executed exactly as written. The three design calls above are within the plan's explicit "Claude's Discretion — the wizard component decomposition" and PATTERNS.md's "generalize LifecycleStepper" instruction; no deviation rule (bug / missing-critical / blocking / architectural) fired.

## TDD Gate Compliance

Task 2 is `tdd="true"` and followed the RED → GREEN cycle with the mandated gate commits present in `git log`:
- **RED:** `a361fd21` `test(158-11): realize App pre-auth /setup branch tests` — 4 new-behavior tests failed, the configured-box guard passed (a correct pre-existing guard, not an unexpected pass).
- **GREEN:** `3b029449` `feat(158-11): App pre-auth needs_setup branch + runtime hydrate` — flipped the suite to 5/5.
- No REFACTOR commit needed (the branch is minimal and clean).

## Verification Gate Results
- **`npx vitest run src/pages/__tests__/SetupWizard.test.tsx`** → **5/5 passed** (RED confirmed first: 4 failed / 1 passed).
- **`npx tsc -b`** → **29 pre-existing errors (SEED-056/049 baseline), 0 in SetupWizard.tsx or App.tsx** → 0 net-new.
- **`npx vite build`** → **exit 0** (`✓ built in 3.80s`; only pre-existing chunk-size / plugin-timings warnings).
- **Broader suites** (`src/components/setup` + supabase) → **50/50 passed** across 11 files — no collateral breakage.
- **Acceptance greps** — SetupWizard.tsx: `LifecycleStepper`=5 (≥1) · `SetupTokenGate|SmokeChecklist|FinalizedLockout`=6 (≥3) · `react-router|BrowserRouter|useNavigate`=0 · `dangerouslySetInnerHTML`=0 · 345 lines (≥120). App.tsx: `getSetupStatus|hydrateSupabaseFromRuntime`=5 (≥2) · `window.location.pathname`=2 (≥1) · `react-router|BrowserRouter`=0.
- **Byte-identical proof:** the `if (!user) return <AuthPage .../>` line and the `ChatLayout` render are unchanged (test C asserts the configured non-/setup path still renders AuthPage).

## Known Stubs
None. `bind` (`{}`) and `providerValue.api_key` (`""`) are legitimate initial controlled-form state the operator fills — not data-flow stubs. No `TODO`/`FIXME`/"coming soon"/placeholder-data patterns. The preset-not-prefilled decision is documented above as deliberate (honest MVP), not a stub.

## Threat Flags
None. The changes add only a client-side render branch (T-158-11 in the plan's threat model, disposition `mitigate` — the branch is UX-only; the SetupMiddleware gate + `require_setup_token` are the wall). No new endpoints, auth paths, file access, or schema surface. `getSetupStatus` fail-safes to `needs_setup:false` (T-158-05); the finalized `/setup` visit renders the no-re-entry lock-out (SC#2). Zero new packages (T-158-SC).

## Issues Encountered
None. App imports its full subtree at module-load, but partial-mocking `@/lib/api` (override only `getSetupStatus`, keep every real export) + `@/lib/supabase` (override only `hydrateSupabaseFromRuntime`) + mocking `useAuth` kept the render tests hermetic — the operator/feature probes no-op on a null user id, so no real network fires. ProviderPicker (reused via ProviderKeyStep) needs no TooltipProvider, so the wizard renders standalone outside the app's provider tree.

## User Setup Required
None — no external service configuration in this plan. The **live end-to-end operator run** (a human running the wizard from a fresh `docker compose up` against a real/local Supabase, finalizing, logging in) stays **operator-gated / deferred** (D-18, the analog of Phase 157's D-09 smoke) — code-complete + verify-work + secure-phase are autonomous; the lived-experience proof needs a human at a browser.

## Next Phase Readiness
- The wizard is fully assembled and reachable (App branch + all 8 leaves + the runtime-hydrate seam). SC#1 (the 6-step browser flow), SC#2 (idempotent + lock-out after finalize), and the byte-identical-configured-box invariant are code-complete and test-backed.
- **158-12** (the last plan) is the deployment-artifact drift-check (`scripts/check-deploy-drift.sh` + the CLAUDE.md same-commit sync rule, D-16) — independent of this wizard code.
- No blockers. `tsc -b` baseline stays 29 pre-existing (SEED-056/049) with 0 net-new.

## Self-Check: PASSED

---
*Phase: 158-first-run-install-wizard-stretch*
*Completed: 2026-07-17*
