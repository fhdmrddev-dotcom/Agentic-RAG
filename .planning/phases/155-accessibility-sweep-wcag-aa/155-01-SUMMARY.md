---
phase: 155-accessibility-sweep-wcag-aa
plan: 01
subsystem: infra
tags: [eslint, jsx-a11y, accessibility, wcag, ci, github-actions, lint-gate]

# Dependency graph
requires:
  - phase: 154-plain-language-layer
    provides: the net-new v3.3 surfaces (relabels, toggle) that Phase 155 audits
provides:
  - eslint-plugin-jsx-a11y@6.10.2 installed as a pinned dev dependency (the ONE new dep)
  - jsx-a11y recommended rule-set wired into the ESLint 9 flat config at error severity
  - a `npm run lint` CI step in frontend-tests.yml (the vitest job) enforcing the gate
  - 155-lint-inventory.txt — the full current violation list (41 jsx-a11y errors) Plan 03 consumes
affects: [155-02, 155-03, 155-04, 155-05, 155-06, 155-07]

# Tech tracking
tech-stack:
  added: [eslint-plugin-jsx-a11y@6.10.2]
  patterns:
    - "jsx-a11y recommended (not strict) as errors app-wide — recommended already sets error severity; strict would balloon past the D-06 scope line"
    - "CI a11y gate: additive `npm run lint` step reusing installed node_modules, no new secrets/actions"

key-files:
  created:
    - .planning/phases/155-accessibility-sweep-wcag-aa/155-lint-inventory.txt
    - .planning/phases/155-accessibility-sweep-wcag-aa/deferred-items.md
  modified:
    - frontend/package.json
    - frontend/package-lock.json
    - frontend/eslint.config.js
    - .github/workflows/frontend-tests.yml

key-decisions:
  - "Pinned eslint-plugin-jsx-a11y EXACTLY to 6.10.2 (npm default caret rewritten to a bare version) per the T-155-01-SC package-legitimacy mitigation"
  - "Used flatConfigs.recommended, NOT strict — recommended lands 31 rules at error, 0 at warn; strict would exceed the D-06 lint-drawn scope"
  - "Left the 3 rules that recommended turns OFF (anchor-ambiguous-text, control-has-associated-label, label-has-for) off — forcing them to error is a strict-level escalation the phase deliberately avoids"
  - "CI lint step is purely additive (reuses the vitest job's node_modules); playwright job byte-identical, no new secrets or third-party actions (T-155-01-CI mitigation)"

patterns-established:
  - "A11Y lint gate: import jsxA11y from 'eslint-plugin-jsx-a11y' + spread jsxA11y.flatConfigs.recommended before the files block"
  - "CI enforces the gate via `npm run lint` (= eslint .) so an a11y regression cannot silently merge"

requirements-completed: []  # A11Y-01 stays OPEN at the requirement level (Plan 1 of 7; closes at phase verify per the 148-154 false-green-avoidance convention)

# Metrics
duration: ~16min
completed: 2026-07-15
---

# Phase 155 Plan 01: jsx-a11y Regression Gate Summary

**Installed eslint-plugin-jsx-a11y@6.10.2, wired its recommended rule-set as app-wide ERRORS in the ESLint 9 flat config, added a `npm run lint` CI step to the vitest job, and captured the full 41-jsx-a11y-error inventory that Plan 03's fix sweep consumes — with @axe-core/playwright deliberately not added (D-01a).**

## Performance

- **Duration:** ~16 min
- **Started:** 2026-07-15T19:34Z (after the phase-plan commit)
- **Completed:** 2026-07-15T19:50Z
- **Tasks:** 2
- **Files modified:** 4 (+ 2 planning artifacts created)

## Accomplishments
- Installed the ONE new dev dependency `eslint-plugin-jsx-a11y@6.10.2`, exact-pinned (D-02, T-155-01-SC).
- Wired `jsxA11y.flatConfigs.recommended` into `frontend/eslint.config.js` — verified via `eslint --print-config`: **31 jsx-a11y rules at error (2), 0 at warn (1)**, 3 off by recommended's own defaults. No manual escalation needed.
- Added an additive `npm run lint` step ("Lint (jsx-a11y as errors)") to the `vitest` job in `frontend-tests.yml`, closing the RESEARCH "CRITICAL CI gap" so a jsx-a11y regression cannot silently merge (D-02 enforcement half).
- Captured `155-lint-inventory.txt` — the full current ESLint output: **215 problems (201 errors, 14 warnings)**, of which **41 are jsx-a11y errors (the Plan 03 fix-sweep target)**.
- @axe-core/playwright confirmed ABSENT in both `package.json` and `package-lock.json` (D-01a / SEED-049 — the rotted Playwright harness stays untouched).

## Task Commits

Each task was committed atomically:

1. **Task 1: Install jsx-a11y, wire recommended-as-errors, capture inventory** — `5d216725` (chore)
2. **Task 2: Add the `npm run lint` CI step to the vitest job** — `5056f007` (ci)

**Plan metadata:** _(follows this SUMMARY — docs commit)_

## Files Created/Modified
- `frontend/package.json` — added `"eslint-plugin-jsx-a11y": "6.10.2"` (exact pin) to devDependencies.
- `frontend/package-lock.json` — resolved jsx-a11y@6.10.2 + its transitive tree (136 packages), synced to the exact spec.
- `frontend/eslint.config.js` — `import jsxA11y` + `jsxA11y.flatConfigs.recommended` spread before the `files: ['**/*.{ts,tsx}']` block.
- `.github/workflows/frontend-tests.yml` — additive "Lint (jsx-a11y as errors)" step in the vitest job (playwright job byte-identical).
- `.planning/phases/155-accessibility-sweep-wcag-aa/155-lint-inventory.txt` — captured violation list (created).
- `.planning/phases/155-accessibility-sweep-wcag-aa/deferred-items.md` — logged the out-of-scope non-a11y-lint finding (created).

## Violation Inventory (Plan 03 target)

`155-lint-inventory.txt` — total **215 problems (201 errors, 14 warnings)**.

**jsx-a11y errors: 41** (Plan 03 fix-sweep target), by rule:

| Rule | Count |
|------|-------|
| jsx-a11y/no-static-element-interactions | 9 |
| jsx-a11y/click-events-have-key-events | 9 |
| jsx-a11y/no-autofocus | 7 |
| jsx-a11y/label-has-associated-control | 7 |
| jsx-a11y/no-redundant-roles | 4 |
| jsx-a11y/no-noninteractive-tabindex | 2 |
| jsx-a11y/no-noninteractive-element-to-interactive-role | 2 |
| jsx-a11y/no-noninteractive-element-interactions | 1 |

The remaining **160 errors** are pre-existing NON-a11y lint findings (`@typescript-eslint/no-explicit-any` ×30, `no-unused-vars` ×22, `react-refresh/only-export-components` ×49, `import/first` ×9, `react-hooks/*` ×7, etc.) — captured for completeness but OUT of Plan 03's scope. See "Deferred Issues" below.

## Decisions Made
- **Exact pin over caret:** npm recorded `^6.10.2` on install; rewrote to a bare `6.10.2` and re-synced the lockfile to honor the T-155-01-SC "pin exact" mitigation.
- **recommended, not strict:** matches D-02's "recommended rule-set" and keeps the sweep inside the D-06 scope line.
- **Off-by-recommended rules left off:** `anchor-ambiguous-text`, `control-has-associated-label`, `label-has-for` are OFF in recommended by design; forcing them to error would be a strict-level escalation the phase deliberately avoids. The gate requirement ("none at warn") is fully met.

## Deviations from Plan

None — plan executed exactly as written. No source-code fixes, no `eslint-disable` comments added (D-02 spirit / G-6 #5 respected).

## Deferred Issues

**[Out of scope — SCOPE BOUNDARY] CI `npm run lint` will also gate on 160 pre-existing NON-a11y ESLint errors.**
- **Found during:** Task 1 (inventory capture).
- **Detail:** `npm run lint` = `eslint .` runs the whole config. 160 of the 201 errors are non-a11y code-quality findings that predate this phase (the ESLint config already extended `js`/`tseslint` recommended; CI simply never invoked ESLint). Adding the Task-2 CI step now surfaces them.
- **Consequence:** Even after Plan 03 fixes all 41 jsx-a11y errors, the new CI lint step stays red because of these 160. The plan's "npm run lint intentionally fails until Plan 03… phase lands as a unit" note assumes a11y-only failures — which does not hold for the non-a11y half.
- **NOT fixed here because:** pre-existing, unrelated to the a11y sweep; D-06 draws the scope line at jsx-a11y + the two named categories + net-new surfaces.
- **Logged to:** `.planning/phases/155-accessibility-sweep-wcag-aa/deferred-items.md` (item D-155-01-A) with three options; recommendation = an a11y-scoped lint gate (`lint:a11y`) so D-02's promise holds without dragging general lint-debt into Phase 155. Raise at Plan 03 plan-review / phase verification.

## Issues Encountered
- None during planned work. (One Windows/Git-Bash quirk: a Windows `python` couldn't read the `/tmp`-mapped print-config file — re-ran the severity check with `node` piping directly from `eslint --print-config`; no impact on deliverables.)

## Verification

- `cd frontend && grep "eslint-plugin-jsx-a11y" package.json` → present, exact pin `6.10.2`.
- `cd frontend && npx eslint --print-config src/main.tsx | grep "jsx-a11y/"` → 31 rules at error, 0 at warn.
- `grep "@axe-core/playwright" frontend/package.json frontend/package-lock.json` → ABSENT (D-01a).
- `155-lint-inventory.txt` → exists, 1051 lines, 41 jsx-a11y errors.
- `grep "npm run lint" .github/workflows/frontend-tests.yml` → present (vitest job); playwright job byte-identical; no new secrets/actions.
- `cd frontend && npx tsc -b` → exactly **30** SEED-056/049 baseline errors, **0 net-new**.
- `cd frontend && npx vite build` → exit **0**.
- Note: `cd frontend && npm run lint` intentionally FAILS at this plan's end (violations unfixed until Plan 03) — expected; the whole phase lands as a unit before any deploy.

## User Setup Required

None — no external service configuration required. (Frontend dev-toolchain + CI only; no migration, no backend, no cloud parity.)

## Next Phase Readiness
- The jsx-a11y gate is installed, wired at error severity, and enforced in CI — the foundation the rest of Phase 155 depends on.
- `155-lint-inventory.txt` gives Plan 03 an exact target: **41 jsx-a11y errors across 8 rules**.
- **Concern for the phase:** the CI lint step also surfaces 160 pre-existing non-a11y errors (see Deferred Issues / deferred-items.md) — Plan 03 alone will not make `frontend-tests` CI green. Decide the lint-gate scope (a11y-only script vs broader clean-up) at Plan 03 review / verification.

---
*Phase: 155-accessibility-sweep-wcag-aa*
*Completed: 2026-07-15*
