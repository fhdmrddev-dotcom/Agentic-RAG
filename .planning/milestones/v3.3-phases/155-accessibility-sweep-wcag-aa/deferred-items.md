# Phase 155 — Deferred / Out-of-Scope Items

Discoveries logged during execution that are NOT fixed in the plan that found them
(per the executor SCOPE BOUNDARY rule). Surface these at plan-boundary / phase verification.

---

## D-155-01-A — CI `npm run lint` will gate on 160 pre-existing NON-a11y ESLint errors

**Found during:** Plan 155-01, Task 1 (capturing `155-lint-inventory.txt`).

**Finding:** `npm run lint` = `eslint .` runs the WHOLE ESLint config, not just jsx-a11y.
The captured inventory (`155-lint-inventory.txt`) shows **215 problems (201 errors, 14 warnings)**:

| Category | Count | In Plan-03 scope? |
|----------|-------|-------------------|
| `jsx-a11y/*` errors | **41** | YES — Plan 03 fix-sweep target (D-06 lint-drawn scope) |
| Non-a11y errors (`@typescript-eslint/no-explicit-any` ×30, `no-unused-vars` ×22, `react-refresh/only-export-components` ×49, `import/first` ×9, `react-hooks/*` ×7, etc.) | **160** | NO — pre-existing baseline, general code-quality lint |
| Warnings (incl. unused `eslint-disable` directives) | 14 | NO |

These 160 non-a11y errors were **already errors** in `frontend/eslint.config.js`
(`js.configs.recommended` + `tseslint.configs.recommended` were extended before this
phase) — CI simply never invoked ESLint (`frontend-tests.yml` ran `npm test` + `npm run build`
= `tsc -b && vite build`, never `eslint`). Adding the `npm run lint` CI step (Task 2) now
surfaces them.

**Consequence for the phase:** Even after Plan 03 fixes all 41 jsx-a11y errors, the new CI
lint step will STILL be red because of the 160 non-a11y errors. The Plan 155-01 verification
note ("`npm run lint` intentionally FAILS at this plan's end… the whole phase lands as a unit")
assumes the remaining failures are jsx-a11y-only — that assumption does not hold for the
non-a11y half.

**NOT fixed here because:** out of scope (SCOPE BOUNDARY — pre-existing, unrelated to the
a11y sweep; D-06 draws the scope line at jsx-a11y + the two named categories + net-new
surfaces). Fixing 160 general code-quality lint errors is not this phase's mandate.

**Options for the phase to reckon with before CI can go green (decide at plan-phase / verify):**
1. Scope the CI lint invocation to jsx-a11y only (e.g. a dedicated `lint:a11y` script) so the
   gate enforces exactly what Phase 155 owns, leaving the general lint-debt to a future phase.
2. Fix/suppress the 160 non-a11y errors as a separate lint-debt clean-up (large, off-theme).
3. Accept CI red on `frontend-tests` until a broader lint-debt phase lands (weakens the gate).

Recommendation: option 1 (a11y-scoped lint gate) preserves D-02's "regressions cannot merge"
promise for a11y without dragging unrelated lint-debt into Phase 155. Raise with the operator
at `/gsd:plan-phase` review of Plan 03 or at phase verification.
