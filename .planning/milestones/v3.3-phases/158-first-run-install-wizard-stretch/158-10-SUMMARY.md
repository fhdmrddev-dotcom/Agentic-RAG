---
phase: 158-first-run-install-wizard-stretch
plan: 10
subsystem: ui
tags: [react, setup-wizard, provider-picker, health-signals, publish-gauntlet, lobehub, wcag-aa, deep-midnight]

# Dependency graph
requires:
  - phase: 158-08
    provides: "setupApi.ts token-gated client (postOperator/postProviderKey/postSmoke/postFinalize) + SetupApiError"
  - phase: 158-09
    provides: "setup/ leaf-component shell + props style (SetupTokenGate, ConnectionBindStep, PresetPickerStep)"
  - phase: 111.1
    provides: "settings/ProviderPicker.tsx (reused whole) + EXTRACTION_PRESETS"
  - phase: 146-147
    provides: "admin/HealthSignals.tsx status-dot vocabulary"
  - phase: 124-127
    provides: "workflows/PublishGauntlet.tsx gated-verdict + PublishingNotice elapsed clock"
  - phase: 128
    provides: "lib/providerLogo (@lobehub) Icon Convention §1"
provides:
  - "OperatorBootstrapStep — gated first-admin bootstrap form (email+password+confirm, strength bar, verbatim GoTrue error, idempotent duplicate)"
  - "ProviderKeyStep — ProviderPicker-reusing one-required-masked-key step + @lobehub optional-provider rows"
  - "SmokeChecklist — 5-row server-truth finalize gate (all-green unlocks Finalize; red blocks + Back-to-fix; irreversible-lock confirm)"
  - "FinalizedLockout — SC#2 already-configured lock-out (no re-entry, Go-to-the-app CTA, D-07 restart note)"
affects: [158-11, setup-wizard-host]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Host-owned value + onChange leaf steps (ConnectionBindStep style) — the wizard host owns the step machine + persisted state; each leaf is props-in/DOM-out"
    - "Client all-green gate is UX-only — the server re-smokes and is the wall (T-158-02)"
    - "Reduced-motion-gated elapsed clock via motion-safe:animate-* Tailwind variants"

key-files:
  created:
    - frontend/src/components/setup/OperatorBootstrapStep.tsx
    - frontend/src/components/setup/ProviderKeyStep.tsx
    - frontend/src/components/setup/SmokeChecklist.tsx
    - frontend/src/components/setup/FinalizedLockout.tsx
    - frontend/src/components/setup/__tests__/OperatorBootstrapStep.test.tsx
    - frontend/src/components/setup/__tests__/ProviderKeyStep.test.tsx
    - frontend/src/components/setup/__tests__/SmokeChecklist.test.tsx
    - frontend/src/components/setup/__tests__/FinalizedLockout.test.tsx
  modified: []

key-decisions:
  - "ProviderKeyStep surfaces a PROMINENT required masked key ABOVE the reused ProviderPicker (bound to the same value.api_key) so the required key is never buried in ProviderPicker's collapsed Advanced overrides — reuse-whole mandate honoured, UX kept honest"
  - "Other-provider optional rows are informational (@lobehub logo + neutral 'Not configured' + add-later-in-Settings note) — the MVP persists exactly one provider key (postProviderKey is single-provider); the rest are a Settings/Admin concern, never red"
  - "OperatorBootstrapStep owns password+confirm as LOCAL transient secrets; only email is host-owned (finalize needs operator_emails, password does not travel)"
  - "MIN_PASSWORD_LENGTH=8 is the sole hard strength gate; a weak-but-≥8 password is an amber advisory (D-11), a GoTrue policy 400 renders verbatim as the server-enforced authority"

patterns-established:
  - "Server-truth checklist row: green ONLY on probe.state==='up'; absent probe = neutral 'Not checked yet' (never optimistically green)"
  - "Finalize = the ONLY gate (disabled unless result.all_green) mirroring PublishGauntlet canPublish; a refused 409 finalize clears the stale local pass so the operator must re-run"

requirements-completed: [DEPLOY-02]

# Metrics
duration: 18min
completed: 2026-07-17
---

# Phase 158 Plan 10: Wizard UI Components pt.2 Summary

**The last four install-wizard leaves — gated operator bootstrap, ProviderPicker-reusing provider-key step, the 5-row server-truth smoke checklist that IS the finalize gate, and the SC#2 finalized lock-out — all composed from shipped Deep-Midnight primitives, build-clean, WCAG-AA, no XSS sink.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-07-17T04:00Z (approx)
- **Completed:** 2026-07-17T04:13Z
- **Tasks:** 2
- **Files modified:** 8 created (4 components + 4 vitest suites)

## Accomplishments
- **OperatorBootstrapStep** (D-11): plain "admin login" framing; masked email+password+confirm with a RunBar-style determinate strength bar (advisory only); Continue gated on valid email + matching passwords + min length; confirm-mismatch = inline destructive block, weak-but-long-enough = amber advisory (non-blocking); posts token-gated `postOperator`; a GoTrue 400 renders verbatim; a duplicate resolves to an honest "already exists" (idempotent re-entry).
- **ProviderKeyStep** (D-12): REUSES `<ProviderPicker>` whole (default-LLM select + always-on 🔒 endpoint footer); one prominent required masked key (Eye/EyeOff) above it; other providers as @lobehub `providerLogo` rows with neutral "Not configured" chips (never red); "We'll verify this key in the next step." note; persists via `postProviderKey` then advances.
- **SmokeChecklist** (D-13/D-14): five HealthSignals-style server-truth rows (neutral until run, "checking…" while running, green/red on server truth only); live reduced-motion-gated elapsed clock; all-green unlocks the single `Finalize setup` CTA (PublishGauntlet gated-verdict discipline); any red blocks it with the row's plain fix + verbatim reason + a "Back to fix" jump to the owning step; Finalize → irreversible-lock confirmation ("This locks first-run setup…") → `postFinalize`; a refused 409 clears the stale pass.
- **FinalizedLockout** (SC#2): centered success card "Setup is already complete." with NO config fields and NO re-entry; single "Go to the app" CTA; the quiet D-07 `docker compose restart` login-fallback note as a secondary line.

## Task Commits

Each task was committed atomically:

1. **Task 1: OperatorBootstrapStep + ProviderKeyStep** - `3fc682aa` (feat)
2. **Task 2: SmokeChecklist + FinalizedLockout** - `2149ab78` (feat)

_(No STATE/ROADMAP writes — the orchestrator owns those per the execution contract.)_

## Files Created/Modified
- `frontend/src/components/setup/OperatorBootstrapStep.tsx` - gated first-admin bootstrap form
- `frontend/src/components/setup/ProviderKeyStep.tsx` - ProviderPicker-reusing provider-key step
- `frontend/src/components/setup/SmokeChecklist.tsx` - 5-row server-truth finalize gate
- `frontend/src/components/setup/FinalizedLockout.tsx` - SC#2 already-configured lock-out
- `frontend/src/components/setup/__tests__/*.test.tsx` - 17 vitest cases across the 4 components

## Verification Gate Results
- **`npx tsc -b`** → 0 net-new errors in the 4 new files (pre-existing SEED-056/049 rot in FilePreview.test / MemorySection / SkillFormDialog / api.test / SettingsPage / StreamsProvider / streamsStore is untouched baseline).
- **`npx vite build`** → exit 0 (built in ~3.9s; only pre-existing chunk-size / dynamic-import / plugin-timings warnings, none from these files).
- **`npx vitest run` (4 suites)** → 17/17 passed.
- **`grep dangerouslySetInnerHTML setup/*.tsx`** → 0 across all setup components (T-158-10).
- **Acceptance greps:** ProviderPicker reused (8) + providerLogo (5) in ProviderKeyStep; confirm|password (39) + strength bar in OperatorBootstrapStep; Finalize (29) + Back-to-fix (8) + canFinalize disabled-gate (3) in SmokeChecklist; already|Go-to-the-app (3) + `input`==0 in FinalizedLockout.

## Decisions Made
See `key-decisions` frontmatter. The two load-bearing calls: (1) a prominent required key ABOVE the reused ProviderPicker (so the key isn't buried in its collapsed Advanced overrides — reuse mandate kept, UX honest); (2) the other-provider rows are informational-only because the MVP persists exactly one provider key (postProviderKey is single-provider) and the rest are a Settings/Admin concern.

## Deviations from Plan

None - plan executed exactly as written. (One reword: the security-header comments in OperatorBootstrapStep/ProviderKeyStep initially contained the literal token `dangerouslySetInnerHTML`, which tripped the `== 0` grep gate; reworded to "raw-HTML injection sink" to satisfy the verification, matching the ConnectionBindStep sibling's wording. Not a behavior change.)

## Issues Encountered
None. The reused primitives (ProviderPicker, HealthSignals dot vocabulary, PublishGauntlet gated verdict + PublishingNotice clock, providerLogo) composed cleanly; the `@lobehub` provider marks render under jsdom without mocking.

## Threat Surface
No new surface. The four components consume the existing 158-06 endpoints via the 158-08 `setupApi` client (postOperator/postProviderKey/postSmoke/postFinalize) — all in the plan's `<threat_model>`. Registered mitigations applied: masked secret inputs + zero raw-HTML sink (T-158-10); the client all-green gate is UX-only, the server re-smokes and is the wall (T-158-02); a GoTrue password-policy 400 renders verbatim, never a client bypass (T-158-06); zero new packages (T-158-SC).

## User Setup Required
None - no external service configuration required (these are leaf UI components consumed by the SetupWizard host in 158-11).

## Next Phase Readiness
- All six wizard-step leaves now exist (158-09 pt.1 + 158-10 pt.2) with host-owned value/onChange contracts ready for the **158-11 SetupWizard host** to wire into the step machine (SetupTokenGate → EnvironmentDetectCard → PresetPickerStep → ConnectionBindStep → OperatorBootstrapStep → ProviderKeyStep → SmokeChecklist → FinalizedLockout).
- The host must assemble the `SmokeBody` (note `service_role_key`) vs `FinalizeBody` (note `supabase_service_role_key`) field-name split, and route `onBackToFix(SmokeCheckId)` → the owning step + `onFinalized`/`onGoToApp` → the post-finalize transition.
- No blockers. The deferred live end-to-end operator UAT (D-18) remains operator-gated.

## Self-Check: PASSED

---
*Phase: 158-first-run-install-wizard-stretch*
*Completed: 2026-07-17*
