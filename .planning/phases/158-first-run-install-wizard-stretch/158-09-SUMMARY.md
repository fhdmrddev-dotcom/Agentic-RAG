---
phase: 158-first-run-install-wizard-stretch
plan: 09
subsystem: ui
tags: [setup-wizard, react, deploy, first-run, a11y, radiogroup, masked-input, deep-midnight, shadcn]

# Dependency graph
requires:
  - phase: 158-08
    provides: "lib/setupApi.ts (postDetect / postValidate / postSchemaBootstrap + SetupApiError + typed BindBody/DetectResult/ValidateResult/SchemaBootstrapResult)"
provides:
  - "SetupTokenGate — AuthPage-shell centered card; autofocus masked (type=password + Eye/EyeOff) token input; postDetect() single-probe validation (doubles as first env-detect, D-08); bad(401)=destructive / rate-limited(429)=amber+brief-disable; never echoes the token in full (masked last-4); copyable logs command"
  - "EnvironmentDetectCard — read-only HealthSignals-style tiles (in Docker / config found / DB / Redis); unknown/false = NEUTRAL never red (D-08); aria-live status region"
  - "PresetPickerStep — real role=radiogroup with roving tabindex + arrow-key selection; one-box Recommended-default (D-09); Managed/On-prem secondary pre-fill cards linking OPERATOR.md variants (D-18)"
  - "ConnectionBindStep — masked Supabase(URL+4 keys+DSN)/Redis form; OPERATOR.md A4 Session-pooler :5432 DSN hint; per-group Test-connection -> postValidate() HealthSignals dot vocab; Continue gated until both green incl. schema sub-check (D-10)"
  - "SchemaGuidancePanel — amber (not error) OPERATOR.md Step-3 copy-to-clipboard SQL guide; optional SHOULD 'run it for me' -> postSchemaBootstrap with copy-guide fallback (D-18)"
affects: [158-10-wizard-steps, 158-11-SetupWizard-host, OperatorBootstrapStep, ProviderKeyStep, SmokeChecklist, FinalizedLockout]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Compose-not-fork the shipped Deep Midnight primitives: AuthPage shell (token gate), HealthSignals dot vocab (detect tiles + probe lines), ProviderPicker Eye/EyeOff (masked secrets), LifecycleStepper amber tone (schema guide) — G-2 satisfied by reuse (D-17)"
  - "Single-probe token validation: the light postDetect() is the cheapest token-gated write; a 2xx proves the token AND its DetectResult doubles as the first env-detect, so the host gets both from one call (no redundant probe)"
    - "Controlled leaf + host-owned form state: ConnectionBindStep/PresetPickerStep take value+onChange; only transient test/reveal state is local — matching the codebase's pure-presentational-leaf discipline (HealthSignals/CapabilityGrid/FeatureVisibility)"
    - "Editing a field invalidates that group's last test result so Continue can never stay green against edited-but-untested values"

key-files:
  created:
    - frontend/src/components/setup/SetupTokenGate.tsx
    - frontend/src/components/setup/EnvironmentDetectCard.tsx
    - frontend/src/components/setup/PresetPickerStep.tsx
    - frontend/src/components/setup/ConnectionBindStep.tsx
    - frontend/src/components/setup/SchemaGuidancePanel.tsx
    - frontend/src/components/setup/__tests__/SetupTokenGate.test.tsx
    - frontend/src/components/setup/__tests__/EnvironmentDetectCard.test.tsx
    - frontend/src/components/setup/__tests__/PresetPickerStep.test.tsx
    - frontend/src/components/setup/__tests__/ConnectionBindStep.test.tsx
    - frontend/src/components/setup/__tests__/SchemaGuidancePanel.test.tsx
  modified: []

key-decisions:
  - "SetupTokenGate validates by calling the light token-gated postDetect() — the DetectResult is emitted up alongside the token (onTokenAccepted(token, detect)) so the host feeds it straight to EnvironmentDetectCard with no second round-trip"
  - "EnvironmentDetectCard is a PURE presentational leaf (detect: DetectResult | null prop), not a self-fetching component — consistent with the shipped HealthSignals/CapabilityGrid leaf discipline; the host owns the fetch"
  - "The masked-secret reveal aria-label is the UI-SPEC-mandated 'Show/Hide value' (also avoids a getByLabelText collision with the field label)"
  - "Per-group Test connection calls postValidate() with only that group's fields and reads its slice of ValidateResult — clean per-group results off the single validate endpoint"
  - "OPERATOR.md variant links use /docs/OPERATOR.md#<anchor> with the section named in-band; secondary presets pre-fill + link, they do NOT launch a multi-preset engine (D-18)"

patterns-established:
  - "Deep Midnight status vocabulary inlined per-component (up=bg-success / down=bg-destructive / neutral=bg-muted-foreground/40) — dot + WORD, never colour-alone (WCAG AA, Phase 155 bar)"
  - "Amber = guidance (schema-missing, secondary-preset banner); destructive = a real connection failure — the two are never confused"

requirements-completed: [DEPLOY-02]

# Metrics
duration: 20min
completed: 2026-07-17
---

# Phase 158 Plan 09: Wizard UI Components (pt.1) Summary

**Five install-wizard leaf components composed from the shipped Deep Midnight primitives — the masked/last-4 setup-token gate, read-only env-detect tiles, the one-box-default arrow-key radiogroup preset picker, the masked Supabase/Redis bind form with per-group live validation gated to green, and the amber schema-missing OPERATOR.md Step-3 copy-guide.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-17T03:37:00Z
- **Completed:** 2026-07-17T03:56:00Z
- **Tasks:** 3 (all `type="auto"`)
- **Files created:** 10 (5 components + 5 vitest suites)

## Accomplishments
- **SetupTokenGate** (D-15): the first screen — AuthPage-shell centered card, autofocus MASKED (`type=password` + Eye/EyeOff) token input, copyable `docker compose logs backend` chip; validates via the light token-gated `postDetect()` (a 2xx proves the token AND its DetectResult doubles as the first env-detect, D-08); honest states idle / "Checking…" / bad(401)=destructive / rate-limited(429)=amber+brief-disable / success; **never echoes the token in full** — the only echo is masked to last-4 (T-158-10).
- **EnvironmentDetectCard** (D-08): read-only, LIGHT orienting tiles cloning the HealthSignals markup + dot vocabulary; a `false` signal reads NEUTRAL ("No" / "Not yet"), a null detect an em-dash — **never red** (Pitfall 6); aria-live status region + the honest "nothing is changed yet" caption.
- **PresetPickerStep** (D-09): a real `role="radiogroup"` with roving tabindex + arrow-key selection (Phase 155 AA bar); one-box is the primary-tinted **Recommended** card selected by default; Managed/On-prem are secondary pre-fill cards that surface an amber honesty banner linking the matching `OPERATOR.md` variant section (pre-fill + link, not a multi-preset engine — D-18); selected card carries an explicit ✓ + `aria-checked`.
- **ConnectionBindStep** (D-10): two grouped forms — Supabase (URL plain + 4 masked keys + masked `POSTGRES_DSN`) and Redis (masked `REDIS_URL`) via the ProviderPicker Eye/EyeOff pattern, env-var names as mono hints; the always-visible OPERATOR.md **A4 Session-pooler `:5432`** DSN hint; per-group **Test connection** → `postValidate()` rendering the HealthSignals dot vocab (green "Connected" / red "Couldn't connect — {sanitized reason}"); **Continue gated until BOTH groups test green**, schema sub-check included; renders `<SchemaGuidancePanel/>` on reachable-but-empty.
- **SchemaGuidancePanel** (D-10): AMBER guidance (not an error) rendering the exact OPERATOR.md Step-3 sequence (`full-schema.sql` + the 9 ordered seed migrations by filename + `INSERT INTO app_settings (id) VALUES ('global')`) in a copy-to-clipboard mono block; optional SHOULD "Set up the database for me" → `postSchemaBootstrap` with the copy-guide as the always-present fallback (D-18).
- **23/23 vitest** across all five components; `tsc -b` 0 net-new (29 SEED-056/049 baseline); `vite build` exit 0.

## Task Commits

Each task committed atomically:

1. **Task 1: SetupTokenGate + EnvironmentDetectCard** — `52db3e63` (feat)
2. **Task 2: PresetPickerStep (one-box default radiogroup)** — `69b63d22` (feat)
3. **Task 3: ConnectionBindStep + SchemaGuidancePanel** — `257d63b1` (feat)

**Plan metadata:** committed separately (docs — this SUMMARY).

## Files Created/Modified
- `frontend/src/components/setup/SetupTokenGate.tsx` — the masked-last-4 setup-token gate (postDetect single-probe validation).
- `frontend/src/components/setup/EnvironmentDetectCard.tsx` — read-only HealthSignals-style env-detect tiles (neutral-never-red).
- `frontend/src/components/setup/PresetPickerStep.tsx` — one-box-default arrow-key radiogroup preset picker.
- `frontend/src/components/setup/ConnectionBindStep.tsx` — masked Supabase/Redis bind form + per-group live validation + schema sub-check gate.
- `frontend/src/components/setup/SchemaGuidancePanel.tsx` — amber OPERATOR.md Step-3 copy-to-clipboard SQL guide + optional auto-runner.
- `frontend/src/components/setup/__tests__/*.test.tsx` — one vitest suite per component (5 files, 23 tests).

## Decisions Made
- **Single-probe token validation.** The gate validates by calling the cheapest token-gated write, `postDetect()`; on 2xx it emits `onTokenAccepted(token, detect)` so the host stores both and hands `detect` straight to `EnvironmentDetectCard` — no redundant second probe. (Within "Claude's Discretion — wizard component decomposition".)
- **Pure-leaf decomposition.** `EnvironmentDetectCard`, `PresetPickerStep`, and `ConnectionBindStep` are controlled leaves (data via props; only transient test/reveal state is local), matching the shipped HealthSignals/CapabilityGrid/FeatureVisibility discipline — the host (158-11) owns fetch + step-machine state.
- **Reveal aria-label = "Show/Hide value"** (the UI-SPEC-mandated masked-toggle label) rather than a token-specific label — also disambiguates it from the field's `<Label>` for assistive tech + tests.
- **OPERATOR.md variant links** point at `/docs/OPERATOR.md#<anchor>` with the section named in-band; the secondary presets are pre-fill + link only (D-18 — one-box is the built happy path).

## Deviations from Plan

Plan executed essentially as written — no Rule 1/2/4 (bug / missing-critical / architectural) deviations. One non-functional gate-hygiene fix:

### Auto-fixed Issues

**1. [Rule 3 - Gate hygiene / non-functional] Reworded a comment so the literal `dangerouslySetInnerHTML` token didn't trip the `== 0` grep gate**
- **Found during:** Task 3 acceptance greps.
- **Issue:** The ConnectionBindStep security comment named the `dangerouslySetInnerHTML` token to state it is NOT used; the plan's verification is a literal `grep -c "dangerouslySetInnerHTML" setup/*.tsx == 0`, which the comment tripped (count 1).
- **Fix:** Reworded to "there is NO raw-HTML injection sink anywhere (the copied SQL renders as plain React text)" — same meaning, no literal token. Comment-only; no type/build/test impact (there is genuinely no such sink in any of the five files).
- **Files modified:** frontend/src/components/setup/ConnectionBindStep.tsx
- **Verification:** `grep -c dangerouslySetInnerHTML setup/*.tsx` → 0 across all five; 23/23 tests still green.
- **Committed in:** `257d63b1` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 non-functional gate-hygiene).
**Impact on plan:** None on behavior — comment-only. No scope creep; the five components, their props, and the setupApi contract match the plan + 158-08 exactly.

## Threat Flags

None — the components stay within the plan's `<threat_model>`: every secret (setup token last-4, the 4 Supabase keys, `POSTGRES_DSN`, `REDIS_URL`) uses the ProviderPicker masked input (`type=password` + Eye/EyeOff, T-158-10 mitigate); probe failures render only the backend's sanitized `type(exc).__name__` reason verbatim (T-158-03 mitigate); zero new packages (T-158-SC accept); no `dangerouslySetInnerHTML` sink (verified 0).

## Known Stubs
None. All five are wired leaves — data flows via props (`detect`, `value`) or the `setupApi` transport; input `placeholder=` attributes are legitimate HTML hints, not stubbed data. No `TODO`/`FIXME`/"coming soon"/empty-array-to-UI patterns.

## Issues Encountered
- **`getByLabelText` collision + `navigator.clipboard` getter** (test authoring): the reveal toggle's original "Show setup token" aria-label matched the token field's label in `getByLabelText`; resolved by using the spec's "Show/Hide value". `navigator.clipboard` is a read-only getter in jsdom + `userEvent.setup()` installs its own stub — resolved with `Object.defineProperty(navigator, "clipboard", …)` AFTER `setup()`. Both are test-harness quirks, not component issues.

## User Setup Required
None — no external service configuration in this plan. These are leaf UI components; the App-bootstrap wiring + the live end-to-end operator run land in 158-11 and the operator-gated UAT (deferred, D-18).

## Next Phase Readiness
- **158-10 (wizard steps pt.2):** OperatorBootstrapStep · ProviderKeyStep (reuse ProviderPicker) · SmokeChecklist (HealthSignals rows + PublishGauntlet gated verdict) · FinalizedLockout — same setupApi transport + the same Deep Midnight vocabulary established here.
- **158-11 (SetupWizard host):** import these five leaves; own `currentStep` + the token/detect/bind/preset session state; wire `SetupTokenGate.onTokenAccepted(token, detect)` → store both, feed `detect` to `EnvironmentDetectCard`, the chosen `SetupPreset` pre-fills `ConnectionBindStep.value`. The existing `SetupWizard.test.tsx` it.todo scaffold (Wave 0) is realized there.
- No blockers. `SetupPreset` type is exported from `PresetPickerStep` for the host + the ConnectionBindStep pre-fill.

## Self-Check: PASSED

- Files: all 5 components + 5 vitest suites + this SUMMARY — FOUND.
- Commits: `52db3e63` (Task 1), `69b63d22` (Task 2), `257d63b1` (Task 3) — all FOUND.
- Gates: 23/23 vitest green · `tsc -b` 29 baseline / 0 net-new in `setup/` · `vite build` exit 0 · acceptance greps all pass (`dangerouslySetInnerHTML`==0 · `radiogroup`≥1 · `clipboard`≥1 · `EyeOff`≥1 · `:5432`≥1 · `autoFocus`≥1).

---
*Phase: 158-first-run-install-wizard-stretch*
*Completed: 2026-07-17*
