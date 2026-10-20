---
phase: 288-drafts-that-survive-pauses-that-publish
plan: 01
subsystem: frontend/workflows-builder
tags: [AUTH-03, draft-settings, DraftArrivalCard, G-5]
requirements: [AUTH-03]
key-files:
  modified:
    - frontend/src/components/workflows/DraftArrivalCard.tsx
    - frontend/src/components/workflows/decisionsVocabulary.ts
    - frontend/src/pages/WorkflowBuilderPage.tsx
    - frontend/src/components/workflows/DraftArrivalCard.test.tsx
    - frontend/src/components/workflows/decisionsVocabulary.test.ts
    - frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx
    - frontend/src/pages/__tests__/__snapshots__/WorkflowBuilderPage.seam286.pin.test.tsx.snap
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
  created:
    - frontend/src/pages/__tests__/WorkflowBuilderPage.draftSettings.test.tsx
commits: [2eba79def, ed75dc149, 7573a6222]
---

# Phase 288 Plan 01: Draft settings row Summary

A re-opened draft now keeps a collapsed "Draft settings" row (decisions rows plus the working-name input) where the arrival card used to be, via ONE optional `settingsRow` prop on `DraftArrivalCard`; the receipt stays arrival-only and `builderStore.ts` is untouched.

## What was built
- `DraftArrivalCard`: optional `settingsRow` (default false). Closed branch returns `draft-settings-row` (toggle `draft-settings-toggle`, body `draft-settings-body` rendering the existing `DecisionsList`) instead of null when the prop is true. Local `settingsOpen` state, collapsed on mount. Open branch byte-identical.
- `decisionsVocabulary`: `DRAFT_SETTINGS_HEADING` ("Draft settings"), `_OPEN_ACTION` ("Show"), `_CLOSE_ACTION` ("Hide"). Present tense, none narrates the AI's past choices.
- `WorkflowBuilderPage`: one prop (`settingsRow`) at the single card call. No new hook/state; `showReceipt` and its single setter unchanged. D-04: no published-gate code (the Builder only holds draft rows; publish returns to the library), noted in a code comment and pinned by one test.

## Retired pin (deliberate)
`canvas.test.tsx` "dismissing takes the column down to TWO children" is rewritten to "keeps the column at THREE children" (slot now holds `draft-settings-row`, graph still last). Reason is written in the test body (D-02/A-02). The invariant (never a fourth child) is unchanged. The seam286 builder snapshot: only the `grid-flag-on` entry changed (1 line); `grid-flag-off` and `header-*` byte-identical.

## A-01: no store change
`git diff --ignore-space-at-eol --numstat` for `builderStore.ts` over the plan's commits is empty. The A-B-A test (draft A, B, A: A never shows B's name/step) passes and is a code-path pin only, NOT SC#2 evidence; the S2 browser drive (plan 04) is. The `canvasNudge` module-level bucket is cosmetic and out of scope.

## Verification
- DraftArrivalCard + decisionsVocabulary + DecisionsList suites: 3 files, 158 passed (RED driven first for card/vocabulary: 6 failed before implementation).
- canvas, seam286 pin, header, useTemplateFirstDraft: 4 files, 305 tests; after the one snapshot re-baseline all green.
- new `WorkflowBuilderPage.draftSettings.test.tsx`: 6 passed (re-open shows row not card; expand shows name input; rename reaches the autosave PATCH body; flag off: no row; three children; A-B-A).
- `npx tsc -p tsconfig.app.json --noEmit`: pre-existing errors only in unrelated test files; none in files touched here.
- `node scripts/check-claude-md-size.cjs`: OK (95,810 chars). `node scripts/check-hot-file-ledger.cjs --files <3 source files>`: OK.
- Count gate NOT run (plan 04 runs it once). Test counts only rose: DraftArrivalCard.test.tsx 35 to 40, decisionsVocabulary.test.ts 22 to 24 (existing pins in `vitest-count-gate.cjs` are floors and were not edited), canvas.test.tsx unchanged count (rewrite in place).

## Deviations from Plan
- **Page-prop ordering:** Task 2 asked for page tests RED before the prop; the prop was added before the new page test file was run, so that file was never observed red (the card-level RED was driven). Minor process deviation; the tests assert the prop's effect (row present, arrival card absent).
- **Ledger in a separate commit:** the ledger/CLAUDE.md edits are in their own commit (`7573a6222`, plan Task 3) rather than the same commit as the code touches.
- **Bootstrap/base:** the worktree started on `be7f4177a` (master), so it was reset to the develop tip `266e344c9` as instructed, then bootstrapped.
- **Extra ledger rows:** `DraftArrivalCard.tsx` and `decisionsVocabulary.ts` crossed the threshold (3 phases) so FIRING-table rows were added beside the Builder's; their scan-list rows were updated in place. The Builder's previous verdict cell was moved verbatim into its ledger section.

## Known Stubs
None.

## Threat Flags
None. T-288-01 (setName single write path, React text), T-288-02 (per-mount store, A-B-A pin), T-288-03 (receipt arrival-only) hold as planned.

## Self-Check: PASSED
Commits 2eba79def, ed75dc149, 7573a6222 exist; created test file present.
