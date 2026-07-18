---
phase: 149-model-registry-discovery
plan: 10
subsystem: ui
tags: [react, vitest, admin, model-registry, discovery, provenance, inline-edit, keyboard-affordance]

# Dependency graph
requires:
  - phase: 149-model-registry-discovery (plan 07)
    provides: "ModelDiscoveryPanel (071-A) + ModelRegistryTab (070-A) operator surfaces this gap-plan corrects in place"
provides:
  - "Truthful discovery per-model provenance suffix derived from real per-field returned-vs-unknown counts (three-way: full / IDs only / partial) — never contradicts the provider run card (SC#3 / Test 9)"
  - "Deprecated-reason input with full InlineNumberCell commit parity: Enter-commit (preventDefault) + Escape-cancel (revert, no write) + one-shot settled guard against Enter/Escape→blur double-write (D-149-04 / Test 10)"
  - "vitest coverage of both reproduced failure modes (3 provenance-state tests + 3 reason-commit tests)"
affects: [149-verify-work, 149-secure-phase, model-registry, model-discovery]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-field provenance counting (returnedCount/totalCount) instead of an all-or-nothing !anyUnknown flag for honesty labels"
    - "Inline-edit commit parity: Enter(preventDefault)+Escape(revert)+one-shot settled ref (reset on remount & keystroke) — reused from InlineNumberCell"

key-files:
  created: []
  modified:
    - frontend/src/components/admin/ModelDiscoveryPanel.tsx
    - frontend/src/components/admin/__tests__/ModelDiscoveryPanel.test.tsx
    - frontend/src/components/admin/ModelRegistryTab.tsx
    - frontend/src/components/admin/__tests__/ModelRegistryTab.test.tsx

key-decisions:
  - "Discovery suffix derived from per-field counts (three-way full/IDs-only/partial) — chose an explicit 'returned some capabilities' partial label over dropping the suffix, keeping symmetry with the two edge labels"
  - "Reason blur-commit made unconditional (a blank blur writes deprecated_reason: null = an intentional clear) — desired per plan checker info #3, not a regression"
  - "MODEL-01/MODEL-02 NOT marked complete — false-green avoidance (mirrors the 148/149 convention); the phase G-4/SC#10 live UAT + secure-phase close them at verify-work"

patterns-established:
  - "Honesty labels count actual per-field provenance rather than collapsing to a binary — a partial-provenance card can never claim 'IDs only' nor 'full ✓'"
  - "The one-shot settled guard resets on both editor remount AND fresh keystroke so genuine re-edits still commit while a single logical edit writes at most once"

requirements-completed: []  # MODEL-01/MODEL-02 stay open — closed at phase verify-work (false-green avoidance); this plan closes 2 UAT cosmetic gaps only

# Metrics
duration: ~11min
completed: 2026-07-12
---

# Phase 149 Plan 10: Discovery/Registry UI Honesty Gap-Closure Summary

**Truthful discovery per-model provenance labels (per-field counts, not `!anyUnknown`) + full inline-edit commit parity on the deprecated-reason input (Enter/Escape/one-shot guard) — the two remaining low-severity live-UAT UI-honesty gaps closed, UI-only and additive**

## Performance

- **Duration:** ~11 min
- **Started:** 2026-07-12T16:33Z (approx)
- **Completed:** 2026-07-12T16:44Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 4 (2 components + 2 test files)

## Accomplishments

- **SC#3 / Test 9 closed:** the discovery `NewModelRow` provenance suffix no longer lies for partial-provenance models. A Google new model whose token limits are provider-returned (green) but whose `native_tools` is "unknown — you set it" previously read "returned IDs only" while its provider run card correctly read "capabilities ✓". The suffix is now derived from real per-field counts and reads a truthful three-way label.
- **D-149-04 / Test 10 closed:** the `DeprecatedControl` reason input now has full commit parity with `InlineNumberCell` — Enter commits (with `preventDefault`), Escape cancels (reverts to the stored reason, never writes), and a one-shot `settled` guard stops the trailing blur from double-writing after Enter/Escape. A typed reason is never silently lost.
- Both reproduced failure modes locked by vitest (3 provenance-state tests + 3 reason-commit tests); zero new tsc errors; `vite build` green.

## Task Commits

Each task was committed atomically:

1. **Task 1: Truthful discovery per-model provenance suffix (SC#3 / Test 9)** - `85ebf452` (fix)
2. **Task 2: Deprecated-reason Enter-commit + Escape-cancel + one-shot guard (Test 10)** - `33a90f26` (fix)

**Plan metadata:** _(this commit)_ (docs: complete plan)

_Note: this was a TDD plan; each task's test + implementation were committed together (single fix commit per task), matching the prior 149 per-plan commit model._

## Files Created/Modified

- `frontend/src/components/admin/ModelDiscoveryPanel.tsx` - `NewModelRow` suffix derived from `returnedCount`/`totalCount` (three-way: "returned full capabilities ✓" / "returned IDs only" / "returned some capabilities"); `anyUnknown` retained for the unchanged amber "set the unknown fields" warning.
- `frontend/src/components/admin/__tests__/ModelDiscoveryPanel.test.tsx` - Added a `runWith(result)` helper + 3 provenance-state tests (`test_partial_provenance_not_ids_only`, `test_full_provenance_reads_full`, `test_zero_provenance_reads_ids_only`).
- `frontend/src/components/admin/ModelRegistryTab.tsx` - `DeprecatedControl` gains a `settled` `useRef` (reset via `useEffect` on `row.deprecated` remount + on each keystroke) and a `commitReason()` chokepoint; reason `<input>` onKeyDown Enter→`preventDefault()`+`commitReason()`, Escape→revert+no-write, onBlur→`commitReason()`.
- `frontend/src/components/admin/__tests__/ModelRegistryTab.test.tsx` - Imported `fireEvent`; added 3 reason-commit tests (`test_reason_enter_commits_once`, `test_reason_escape_cancels`, `test_reason_enter_then_blur_no_double_write`).

## Decisions Made

- **Partial label wording:** chose an explicit "returned some capabilities" for the partial case (vs dropping the suffix), keeping label symmetry with the full/zero edges. The plan permitted either; the test asserts the absence of the false "returned IDs only" string, which holds under this choice.
- **Unconditional blur-commit:** the reason blur now commits unconditionally, so a blank blur writes `deprecated_reason: null` (an intentional clear). This is the desired behavior per plan checker info #3, not a regression.
- **MODEL-01/MODEL-02 left open:** requirements are NOT marked complete here (false-green avoidance, mirroring the documented 148/149 convention) — they close at phase verify-work after the G-4/SC#10 live UAT + secure-phase.

## Deviations from Plan

None - plan executed exactly as written.

Both fixes are label/keyboard-affordance corrections inside existing components; no capability-write contract, API shape, enable/disable behavior, schema, or package changes. The threat register's `mitigate` dispositions (T-149-29 misleading provenance, T-149-30 silently-lost input) are exactly what the two tasks implement.

## Issues Encountered

- **Test-file structural mis-placement (self-corrected, no source impact):** the first insert of the three reason-commit tests landed a premature describe-closing `})` mid-block (the IN-02 test was not the last test in the describe), producing an oxc parse error. Removed the stray closer so the new tests live inside the describe; ModelRegistryTab suite then passed 12/12. No production code affected.
- **gsd-sdk state verbs errored on this STATE.md format** (`phase/plan/duration required`, "No session fields found", "Progress field not found" — the v1.42.3 SDK expects a different STATE shape). Applied the documented hand-edit fallback for the position note + decisions and the ROADMAP checkbox/row; the SDK's partial write had already bumped `last_updated` and `completed_plans` 32→33.

## User Setup Required

None - no external service configuration required (pure frontend label/keyboard change).

## Next Phase Readiness

- The two remaining Phase-149 live-UAT UI-honesty gaps (Test 9 cosmetic, Test 10 minor) are closed in code and test-locked. Phase 149 remains held for `/gsd:verify-work 149` (11 SC#10 live cross-provider UAT rows pending by design in `149-HUMAN-UAT.md`) + `/gsd:secure-phase 149`.
- Prior-wave work (149-08 admin route converters, 149-09 fallback-notice path) untouched — this plan modified only the two admin frontend components + their tests.
- No blockers introduced.

## Self-Check: PASSED

**Files (all FOUND):**
- `frontend/src/components/admin/ModelDiscoveryPanel.tsx`
- `frontend/src/components/admin/__tests__/ModelDiscoveryPanel.test.tsx`
- `frontend/src/components/admin/ModelRegistryTab.tsx`
- `frontend/src/components/admin/__tests__/ModelRegistryTab.test.tsx`

**Commits (all FOUND in git log):**
- `85ebf452` — fix(149-10): truthful discovery per-model provenance suffix (SC#3 / Test 9)
- `33a90f26` — fix(149-10): deprecated-reason Enter-commit + Escape-cancel + one-shot guard (Test 10)

**Gates:** ModelDiscoveryPanel 8/8 + ModelRegistryTab 12/12 vitest green; `npx vite build` exit 0; `tsc -b` = 30 (known baseline, 0 NEW errors in touched files).

---
*Phase: 149-model-registry-discovery*
*Completed: 2026-07-12*
