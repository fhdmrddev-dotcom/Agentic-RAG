---
phase: 159
plan: 06
subsystem: frontend / model-registry operator surface
tags: [model-registry, curation, discovery-filter, control-room, 071-A, source-labeled-defaults, app_settings-flag]
requires:
  - "159-04: api.ts DiscoveredNewModel.utility (display-only tag) + FullAppSettings.model_discovery_filter_enabled + setFlag FlagKey union; model-defaults.ts familyDefaults(idOrProvider)"
  - "159-05: ControlRoomPage handleAddModel wiring (the fetchRegistry + pulseRecording shell this builds on)"
  - "149-07: the shipped 071-A ModelDiscoveryPanel pure leaf (run/isComplete/coerce/buildChanges + NewModelRow amber 'unknown — you set it' + enableNow gating) and the model-registry shell (fetchSettings + setFlag path)"
provides:
  - "ModelDiscoveryPanel: filterEnabled + onSetFilter props; default-on suitability filter that hides utility `new` models with an honest 'N utility models hidden' count + a non-destructive ephemeral 'Show all' (D-159-04)"
  - "ModelDiscoveryPanel: familyDefaults pre-fill on the discovery hand-fill — un-returned capabilities seed from the model family, styled amber 'default — confirm', visually distinct from blank 'unknown — you set it' and green provider-confirmed (D-159-03)"
  - "ControlRoomPage: handleSetDiscoveryFilter (setFlag('model_discovery_filter_enabled') → fetchSettings) + filterEnabled/onSetFilter passed to ModelDiscoveryPanel (default-on while settings load)"
affects:
  - "SC#1 delivered end-to-end (live discovery filters to chat/tool models by default, persisted, with a 'show all' opt-in + honest hidden-count)"
  - "phase verify (/gsd:verify-work 159): live Chrome-MCP UAT — run discovery → confirm utility models hidden by default → 'Show all' reveals → toggle off persists across reload → un-returned cap pre-fills 'default — confirm' + still lands disabled unless 'Enable now' ticked"
  - "MODEL-03 (STRETCH) closes at verify-work — this is the last of the 6 plans; all three SCs now have shipped code"
tech-stack:
  added: []
  patterns:
    - "display-only filter: visibleNew/hiddenNewCount are derived from result.new for RENDER only; accepted/enableNow/drafts/buildChanges keep reading the FULL result.new so a hidden utility model stays in the confirmable payload (T-159-13 / SC#3)"
    - "draft-seeding pre-fill: seedDraftsFromDefaults(res.new) on run makes isComplete/buildChanges work UNCHANGED — the family default becomes a real editable draft; enableNow stays default-off so buildChanges still yields enabled:false (T-159-12)"
    - "three-source honesty keyed on a STATIC family property: 'default — confirm' iff familyDefaults(id)[field] != null (no operator-overwrite tracking) — distinct from blank 'unknown — you set it' and green provider-confirmed"
    - "native_tools tri-state seeding: true→'native', null→unseeded (never 'none') — familyDefaults().tools is only ever true|null, so a pre-fill can never DISABLE tools (SC#3 by construction)"
    - "reuse the shared setFlag (PUT /admin/flags → 204, no body) verbatim — handleSetDiscoveryFilter mirrors handleToggle/handleSetMaintenance; no new endpoint"
key-files:
  created: []
  modified:
    - "frontend/src/components/admin/ModelDiscoveryPanel.tsx"
    - "frontend/src/components/admin/__tests__/ModelDiscoveryPanel.test.tsx"
    - "frontend/src/components/admin/__tests__/ModelDiscoveryPanel.a11y.test.tsx"
    - "frontend/src/components/admin/ControlRoomPage.tsx"
key-decisions:
  - "The filter is DISPLAY-only by construction: visibleNew/hiddenNewCount feed only the render; buildChanges/accepted/enableNow read the FULL result.new. A test asserts the confirm payload includes the hidden utility ids (T-159-13) — the filter can never silently confirm nor drop a model."
  - "Pre-fill via draft SEEDING on run (seedDraftsFromDefaults), NOT a display-only fallback — so the SC#3 gating (isComplete + `enabled = enableNow.has(id) && isComplete`) needed ZERO edits. The family value is a real draft the operator can overwrite; enableNow stays default-off → buildChanges yields enabled:false for an un-ticked pre-filled model (T-159-12)."
  - "'default — confirm' styling keyed on the STATIC family property familyDefaults(id)[field] != null (not on whether the operator has typed) — deterministic three-way distinction without tracking overwrite state."
  - "native_tools maps true→'native' / null→unseeded, NEVER 'none'. familyDefaults().tools only ever yields true|null (never false), so a pre-fill cannot silently disable tools — SC#3 holds by construction."
  - "filterEnabled/onSetFilter made REQUIRED props (plan-faithful — the shell always supplies them). Consequently updated the a11y test's 5 render sites + the main-test helpers to pass them (Rule 3 blocking fix so tsc -b compiles); the a11y contract assertions are byte-unchanged."
  - "Repointed the existing 'disabled enable-now tick' test to a no-family-default model (acme/opaque-1). Task 2's seeding legitimately makes gpt-5.6-nova (openai family) complete, superseding the old toBeDisabled() assertion; the SC#3 'never auto-enabled' spirit is preserved (tick stays unchecked) AND the disabled-path is retested with a genuinely-incomplete model."
  - "MODEL-03 NOT marked complete — phase-spanning STRETCH requirement; closes at /gsd:verify-work 159 (per the plan-05 / 148–156 false-green-avoidance convention). This plan ships the CODE for SC#1; verify-work flips the requirement."
patterns-established:
  - "Suitability filter as pure display metadata: a backend `utility` tag + a client-side default-on hide + honest hidden-count + ephemeral 'Show all' — never a mutation of the confirmable diff (149 red line)."
  - "Reviewed-not-authoritative pre-fill: seed the draft from a family default, style it distinctly, keep the explicit-enable gate — friction removed, SC#3 honesty preserved."
requirements-completed: []  # MODEL-03 deferred to /gsd:verify-work 159 (phase-spanning STRETCH — false-green-avoidance convention)

# Metrics
duration: 12min
completed: 2026-07-18
---

# Phase 159 Plan 06: Discovery Suitability Filter + Family-Default Hand-Fill Pre-fill Summary

**The discovery-curation vertical: a default-on, persisted suitability filter in `ModelDiscoveryPanel` (hides utility `new` models behind an honest "N utility models hidden" count + a non-destructive "Show all"), source-labeled family-default pre-fills on the discovery hand-fill (amber "default — confirm", distinct from blank "unknown — you set it" and green provider-confirmed), and the `ControlRoomPage.handleSetDiscoveryFilter` wiring — delivering SC#1 end-to-end while holding the 149 propose-not-auto-enable red line (SC#3).**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-18T02:32:14Z
- **Completed:** 2026-07-18T02:44Z
- **Tasks:** 3
- **Files modified:** 4 (all pure-frontend; no backend, no migration, no new package)

## Accomplishments

- **Default-on suitability filter (D-159-04):** with `filterEnabled=true`, utility `new` rows (`utility === true`, the Plan-04 backend tag) are not rendered; the panel shows an honest "{N} utility models hidden" line + a "Show all" control (ephemeral per-view reveal that never touches the persisted default). Toggling "Filter to chat/tool models" persists via `onSetFilter` → the shell's `setFlag` → `app_settings` → settings re-fetch.
- **Display-only integrity (SC#3 / T-159-13):** the filter derives `visibleNew`/`hiddenNewCount` for the RENDER only; `accepted`/`enableNow`/`drafts`/`buildChanges` still read the full `result.new`. A test asserts the confirm payload contains the hidden utility ids — a hidden model can never be silently confirmed nor dropped.
- **Source-honest family-default pre-fill (D-159-03):** un-returned capabilities seed from `familyDefaults(model_id)` on run, rendering the amber input pre-filled + labeled "default — confirm" — visually distinct from a blank "unknown — you set it" (null default) and from a green provider-confirmed value.
- **Never-auto-enable held (SC#3 / T-159-12):** pre-fill makes `isComplete` true so the operator CAN opt in, but `enableNow` stays default-off and the `enabled = enableNow.has(id) && isComplete` gating is unchanged — `buildChanges` yields `enabled:false` for an accepted-but-un-ticked pre-filled model. The warning copy switches to "review the suggested defaults — it will NOT be auto-enabled".
- **Shell wiring (Task 3):** `ControlRoomPage.handleSetDiscoveryFilter` (mirror of `handleToggle`) + `filterEnabled={settings?.model_discovery_filter_enabled ?? true}` (default-on while settings load) + `onSetFilter` passed to `<ModelDiscoveryPanel>`; the Plan-05 `onAddModel`/`onRunDiscovery`/`onConfirm` props preserved.

## Task Commits

Each task was committed atomically:

1. **Task 1: Filter toggle + show-all + honest hidden-count** — `0783faf2` (feat)
2. **Task 2: Family-default pre-fill on the discovery hand-fill (three-way source honesty)** — `cea5bbd2` (feat)
3. **Task 3: ControlRoomPage filter wiring (handleSetDiscoveryFilter → setFlag)** — `c01a7e14` (feat)

## Files Created/Modified

- `frontend/src/components/admin/ModelDiscoveryPanel.tsx` — `filterEnabled`/`onSetFilter` props; `showAllThisView` state; `seedDraftsFromDefaults` + `defaultDraftForField` module helpers; `visibleNew`/`hiddenNewCount` derivation; the filter toggle + hidden-count + "Show all" render; `NewModelRow` "default — confirm" styling + warning-copy switch.
- `frontend/src/components/admin/__tests__/ModelDiscoveryPanel.test.tsx` — helpers pass the new props; +6 D-159-04 filter tests; +6 D-159-03 pre-fill tests; repointed the "disabled tick" test to a no-family-default model.
- `frontend/src/components/admin/__tests__/ModelDiscoveryPanel.a11y.test.tsx` — 5 render sites updated to pass the required props (contract update; assertions byte-unchanged).
- `frontend/src/components/admin/ControlRoomPage.tsx` — `handleSetDiscoveryFilter` + the two new props on `<ModelDiscoveryPanel>`.

## Verification

- `npx vitest run ModelDiscoveryPanel.test.tsx ModelDiscoveryPanel.a11y.test.tsx ControlRoomPage.test.tsx` → **36/36 passed** (23 pre-existing 149/155 + 12 new 159 + a11y suite, all green).
- `npx tsc -b` → **0 net-new errors in the changed files** (my files clean; the 29 pre-existing errors are SEED-056/049 rot in untouched files — logged to `deferred-items.md`, do NOT fix).
- `npx vite build` (the deploy path, skips tsc — as Vercel does) → **✓ built in 4.33s** with my changes.

## Decisions Made

See `key-decisions` frontmatter. Headlines: the filter is display-only by construction; pre-fill via draft-seeding so the SC#3 gating needed zero edits; "default — confirm" keyed on a static family property; native_tools can only ever seed `native`/unseeded (never `none`); reused the shared `setFlag` (204, no body) verbatim; MODEL-03 flip deferred to verify-work.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated the a11y test render sites for the now-required props**
- **Found during:** Task 1 (making `filterEnabled`/`onSetFilter` required per the plan)
- **Issue:** `filterEnabled: boolean` + `onSetFilter` are required props (plan-faithful; the shell always supplies them), so the 5 `ModelDiscoveryPanel.a11y.test.tsx` render sites failed `tsc -b`.
- **Fix:** Added `filterEnabled={false}` + `onSetFilter={vi.fn()...}` to each render call; all a11y assertions are byte-unchanged (RESULT has no `utility:true` models, so nothing is hidden).
- **Files modified:** `frontend/src/components/admin/__tests__/ModelDiscoveryPanel.a11y.test.tsx`
- **Verification:** the a11y suite passes green (axe-clean across idle/running/done, including the new toggle DOM).
- **Committed in:** `0783faf2` (Task 1 commit)

**2. [Rule 1 - Bug] Repointed the "disabled enable-now tick" test to a no-family-default model**
- **Found during:** Task 2 (draft-seeding from family defaults)
- **Issue:** Task 2's seeding legitimately makes `gpt-5.6-nova` (openai family) `isComplete` → its tick is now enable-able, so the shipped `expect(tick).toBeDisabled()` assertion no longer held.
- **Fix:** Repointed the test to `acme/opaque-1` (no family match → no pre-fill → genuinely incomplete → tick disabled), preserving the SC#3 "never auto-enabled" intent; the pre-filled/enable-able-but-unchecked path is covered by the new D-159-03 suite.
- **Files modified:** `frontend/src/components/admin/__tests__/ModelDiscoveryPanel.test.tsx`
- **Verification:** both the disabled-path (no-default) and the enable-able-but-unchecked-path (pre-filled) are asserted; suite green.
- **Committed in:** `cea5bbd2` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 test-truth correction)
**Impact on plan:** Both are the mechanical consequence of the plan's own required-prop contract + intended pre-fill behavior. No scope creep; SC#3 invariants preserved and re-locked with tests.

## Issues Encountered

- **Hidden-count text split (pre-commit iteration, Task 1):** the initial hidden-count rendered "2" in a nested `<span>`, splitting the text node so `getByText(/2 utility models hidden/i)` couldn't match. Flattened the count into a single text node (kept `font-medium text-foreground` emphasis on the whole phrase). Caught + fixed before the Task 1 commit.

## User Setup Required

None — no external service configuration. The persisted toggle rides the existing `app_settings.model_discovery_filter_enabled` column (migration 103, authored + operator-applied in Plan 03; cloud parity tracked with the standing migs-099-103 + `SECRETS_ENCRYPTION_KEY` push).

## Next Phase Readiness

- All 6 plans of Phase 159 have shipped code. **NEXT: `/gsd:verify-work 159`** — the live Chrome-MCP UAT closes MODEL-03 (SC#1 discovery filter, SC#2 add-by-ID, SC#3 propose-not-auto-enable honesty), then `/gsd:secure-phase` + `/gsd:complete-milestone` v3.3.
- No blockers. The pre-existing frontend tsc rot (29 errors, 0 net-new) is logged to `deferred-items.md` for the standing SEED-056 hygiene pass — out of scope here.

## Self-Check: PASSED

- Commits verified present: `0783faf2` (Task 1), `cea5bbd2` (Task 2), `c01a7e14` (Task 3).
- Files verified on disk: `ModelDiscoveryPanel.tsx`, `ControlRoomPage.tsx`, `__tests__/ModelDiscoveryPanel.test.tsx`, `__tests__/ModelDiscoveryPanel.a11y.test.tsx`.
- Tests: 36/36 green; vite build ✓; 0 net-new tsc errors.

---
*Phase: 159-model-registry-curation*
*Completed: 2026-07-18*
