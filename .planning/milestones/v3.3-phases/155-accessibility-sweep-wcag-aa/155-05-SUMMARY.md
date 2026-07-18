---
phase: 155-accessibility-sweep-wcag-aa
plan: 05
subsystem: ui
tags: [a11y, wcag, vitest-axe, react, admin, control-room, governance, model-registry]

# Dependency graph
requires:
  - phase: 155-03
    provides: the jsx-a11y fix-to-zero + icon-button aria-label sweep this suite locks as a regression gate
provides:
  - "Five Governance/Registry `*.a11y.test.tsx` vitest-axe suites (AuditTab, UsersAndAccess, FeatureVisibility, ModelRegistryTab, ModelDiscoveryPanel) asserting zero STRUCTURAL axe violations across each leaf's honest states"
  - "D-05 role/name regression proof for the audit chip-filters, the users-roster action controls, and the model-registry row controls (icon-only controls named)"
  - "One D-14 documented per-rule exclusion (empty-table-header on the ModelRegistryTab actions column) — encoded per-rule/per-selector + mirrored in 155-VALIDATION.md + SEED-092-remainder"
affects: [155-verify-work, future-wcag-aa-sweep]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "settle-then-scan a11y leaf: render honest state → await a settle node → expect(await axe(container)).toHaveNoViolations() (STRUCTURAL only; jsdom can't compute contrast)"
    - "Radix portal (Sheet/dialog) OPEN state is NOT axe-scanned — the roles/names are asserted separately (matches the 155-04 ActiveRunsSection convention)"
    - "D-14 per-rule exclusion scoped to the exact states that render the flagged node, with the node's accessible name asserted positively so the exclusion can never hide a real barrier"
    - "decorative-or-labeled icon assertion: no SVG carries an image-semantics role without an accessible name (the @lobehub marks ship a <title> — labeled, not merely decorative)"

key-files:
  created:
    - frontend/src/components/admin/__tests__/AuditTab.a11y.test.tsx
    - frontend/src/components/admin/__tests__/UsersAndAccess.a11y.test.tsx
    - frontend/src/components/admin/__tests__/FeatureVisibility.a11y.test.tsx
    - frontend/src/components/admin/__tests__/ModelRegistryTab.a11y.test.tsx
    - frontend/src/components/admin/__tests__/ModelDiscoveryPanel.a11y.test.tsx
  modified:
    - .planning/phases/155-accessibility-sweep-wcag-aa/155-VALIDATION.md
    - .planning/seeds/SEED-092-remainder.md

key-decisions:
  - "D-14 exclusion: empty-table-header (an axe BEST-PRACTICE rule, not WCAG A/AA) on ModelRegistryTab's `th[aria-label=\"Row actions\"]` is a confirmed false-positive — the header IS accessibly named via aria-label; excluded per-rule/per-selector, never globally, with the name asserted positively"
  - "Assert REALITY not the plan's assumed contract: no component source was modified (test-only plan). The plan-assumed additive-fix path (D-13) was NOT needed — the sole finding was a false-positive handled by D-14"
  - "The @lobehub provider marks are LABELED (they ship a <title>), not merely decorative — the icon assertions and text queries account for the title node"

patterns-established:
  - "Governance/Registry admin leaves: scan the non-portal honest states; assert Radix confirm dialogs by role+name separately"

requirements-completed: []

# Metrics
duration: 12min
completed: 2026-07-15
---

# Phase 155 Plan 05: Governance + Model-Registry a11y suites Summary

**Five vitest-axe `*.a11y.test.tsx` suites lock the D-01 zero-STRUCTURAL-violations bar and the D-05 role/name contract across the Control Room's highest-density opacity-offender surfaces (audit browser, users roster, feature-visibility map, model registry, model discovery) — test-only, no component source touched, with one honest D-14 documented exclusion.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-15T22:16:22Z
- **Completed:** 2026-07-15T22:27:59Z
- **Tasks:** 2
- **Files created:** 5 (test suites) · **Files modified:** 2 (planning docs)

## Accomplishments

- **AuditTab.a11y.test.tsx** (11 tests) — zero-structural scans across operator-populated / operator-empty / platform-loading / platform-populated / ⌥-technical; asserts the named `role="tablist"` source switch (two `role="tab"` with `aria-selected`), the chip-filter triggers by role+name, the icon-only clear ✕ by `aria-label`, the export + ⌥ toggle by role+name, the sr-only "Change:" ledger-row structure, the cross-user notice as visible words, and the over-cap export refusal as `role="alert"`.
- **UsersAndAccess.a11y.test.tsx** (10 tests) — scans loading (`aria-busy`) / empty / populated; asserts the search `role="searchbox"`, the disable/enable/grant/revoke controls by role+name, the self-row guards as DISABLED buttons with a courtesy reason, status/role as visible WORDS, and the 064-B victim-naming `role="dialog"` with a named confirm button.
- **FeatureVisibility.a11y.test.tsx** (6 tests) — scans all-Everyone / an Operators-only card / ⌥-technical; asserts the audience control is a named `role="radiogroup"` with two `role="radio"` options whose `aria-checked` reflects the SEED-115 ENUM (never a boolean), plus the API-enforced consequence as visible words.
- **ModelRegistryTab.a11y.test.tsx** (13 tests) — scans loading (`role="status"`) / empty / populated / ⌥-technical; asserts the numeric-cell edit buttons + capability switches + Reset + the opened `role="spinbutton"` editor by accessible name, the icon-only lock control's `aria-label` (+ gated `aria-disabled` on a hidden row), the coupling word, and decorative-or-labeled brand icons.
- **ModelDiscoveryPanel.a11y.test.tsx** (9 tests) — scans idle / running / done; asserts running=`role="status"`, run-failure=`role="alert"`, the accept/enable-now checkboxes + amber "unknown — you set it" inputs (spinbutton/combobox) + vanished decision buttons by role+name, and decorative-or-labeled provider marks.
- **All 51 new tests green** (and the full `admin/__tests__` directory: 18 files / 141 tests green). No component source modified.

## Task Commits

1. **Task 1: governance a11y suites (AuditTab, UsersAndAccess, FeatureVisibility)** — `cd8660a8` (test)
2. **Task 2: model-registry a11y suites (ModelRegistryTab, ModelDiscoveryPanel) + D-14 docs** — `58fbc816` (test)

**Plan metadata:** the final docs commit (SUMMARY + STATE + ROADMAP).

## Files Created/Modified

- `frontend/src/components/admin/__tests__/AuditTab.a11y.test.tsx` (created)
- `frontend/src/components/admin/__tests__/UsersAndAccess.a11y.test.tsx` (created)
- `frontend/src/components/admin/__tests__/FeatureVisibility.a11y.test.tsx` (created)
- `frontend/src/components/admin/__tests__/ModelRegistryTab.a11y.test.tsx` (created)
- `frontend/src/components/admin/__tests__/ModelDiscoveryPanel.a11y.test.tsx` (created)
- `.planning/phases/155-accessibility-sweep-wcag-aa/155-VALIDATION.md` (D-14 register row appended)
- `.planning/seeds/SEED-092-remainder.md` (D-14 note updated: one exclusion + additive real-fix follow-up)

## Decisions Made

- **Assert reality, not the plan's assumed contract (test-only).** The plan provisioned an optional D-13 additive aria fix "if axe surfaces a real violation." Only ONE finding surfaced and it was a confirmed **false-positive** (best-practice rule on an already-named header), so no component source was touched — resolved via D-14 instead of D-13.
- **D-14 exclusion is honest and narrow.** `empty-table-header` (an axe best-practice rule, NOT WCAG A/AA) fires on `ModelRegistryTab`'s intentionally text-less `<th aria-label="Row actions">`. The header IS accessibly named, so no real barrier exists. Encoded as a per-rule exclusion scoped to ONLY the two table-rendering scans, with the header name asserted positively, and mirrored in 155-VALIDATION.md's D-14 register + SEED-092-remainder (with the additive `sr-only`-header real-fix logged as a future follow-up).
- **The @lobehub provider marks are LABELED, not merely decorative.** They ship a `<title>` (e.g. "OpenAI") and carry no `img` role, so axe correctly ignores them for `svg-img-alt`; the icon assertions and the run-card text queries account for the `<title>` node (exact lowercase match on the visible span).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test authoring] ModelDiscoveryPanel provider-name query matched the icon's `<title>`**
- **Found during:** Task 2 (first run)
- **Issue:** `within(openaiCard).getByText(/openai/i)` matched BOTH the visible `<span>openai</span>` and the @lobehub mark's `<title>OpenAI</title>`, throwing "Found multiple elements."
- **Fix:** Scoped to an exact case-sensitive `getByText("openai")` (the lowercase visible span; the title is "OpenAI"). Test-file only — no component change.
- **Files modified:** `ModelDiscoveryPanel.a11y.test.tsx`
- **Committed in:** `58fbc816`

### Documented Exclusion (D-14)

**2. [D-14 - Confirmed false-positive] `empty-table-header` on the ModelRegistryTab actions column**
- **Found during:** Task 2 (populated + ⌥-technical axe scans)
- **Finding:** `th[aria-label="Row actions"]` → axe `empty-table-header`. This is an axe **best-practice** rule (not WCAG A/AA); the `<th>` is an intentionally text-less actions column that IS accessibly named via `aria-label`, so the barrier the rule guards (an unnamed column header) does not exist for AT users.
- **Resolution:** Per-rule exclusion `axe(container, { rules: { "empty-table-header": { enabled: false } } })` scoped to ONLY the two table-rendering scans; every other WCAG-AA structural rule stays ON; the header's accessible name is asserted positively (`getByRole("columnheader", { name: /row actions/i })`). NOT a global disable. Mirrored in 155-VALIDATION.md D-14 register + SEED-092-remainder (additive `sr-only`-header real-fix logged for a future Control-Room refactor).
- **Files:** `ModelRegistryTab.a11y.test.tsx`, `155-VALIDATION.md`, `SEED-092-remainder.md`
- **Committed in:** `58fbc816`

**Total deviations:** 1 test-authoring auto-fix + 1 documented D-14 exclusion. No component source modified; no D-13 shared-primitive fix was required.

## Issues Encountered

- **jsdom `HTMLCanvasElement.getContext` warnings** during runs — pre-existing environment noise (a charting dependency in a co-loaded module); not from these suites, no effect on results.
- **Contrast is NOT covered here (by design).** jsdom cannot compute color-contrast — the contrast half of D-01 is the LIVE Chrome scan at `/gsd:verify-work` (G-6 #1). No suite asserts contrast.

## Verification Results

- `cd frontend && npx vitest run src/components/admin/__tests__/{AuditTab,UsersAndAccess,FeatureVisibility,ModelRegistryTab,ModelDiscoveryPanel}.a11y.test.tsx` → **5 files / 51 tests green**
- `cd frontend && npx vitest run src/components/admin/__tests__` → **18 files / 141 tests green** (targeted admin suites, no regressions)
- `git diff --name-only cd8660a8^..HEAD` → only the 5 test files + 2 planning docs (NO component source touched)
- Each suite calls `toHaveNoViolations()`; STRUCTURAL rules only; no contrast assertion; the single D-14 exclusion is per-rule/per-selector with a WHY comment + VALIDATION.md mirror.

## Known Stubs

None — these are net-new test suites that render real components with representative props; no stubbed data flows to a shipped UI.

## User Setup Required

None — frontend test-only, no external service configuration, no migration, no backend.

## Next Phase Readiness

- The D-01/D-12 zero-violations regression gate now covers the Control Room Governance + Model-Registry cluster; a regression on these surfaces fails the targeted vitest run (and CI).
- **A11Y-01 remains phase-open** — Plan 06 (Run modal + citation UI + 154 relabels) is the remaining wave-3 suite work, and the LIVE Chrome DevTools scan (D-03 contrast + button-name) + the D-08/D-09 keyboard walkthrough run at `/gsd:verify-work 155`. This plan did NOT close A11Y-01 (it is satisfied at phase completion, not by any single plan).
- One additive real-fix is logged for a future Control-Room refactor: give the ModelRegistryTab actions `<th>` an `sr-only` header so the `empty-table-header` best-practice rule passes without the D-14 exclusion.

## Self-Check: PASSED

- Created files verified on disk: all five `*.a11y.test.tsx` suites + this SUMMARY (see below)
- Task commits verified in git: `cd8660a8`, `58fbc816`

---
*Phase: 155-accessibility-sweep-wcag-aa*
*Completed: 2026-07-15*
