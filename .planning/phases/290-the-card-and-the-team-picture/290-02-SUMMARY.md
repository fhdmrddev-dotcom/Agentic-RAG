---
phase: 290-the-card-and-the-team-picture
plan: 02
subsystem: frontend / workflows library card
tags: [library-card, chip-line, vocabulary, tdd, sketch-parity, VIS-04]
requires: []
provides:
  - "library/stepLine.ts: resolveStepLine(def) -> StepLine | null, STEP_LINE_VISIBLE, StepChip, StepLine"
  - "library/StepChipLine.tsx: the row-steps block with its own expand state"
  - "libraryVocabulary.ts: STEP_LINE_LABEL, STEP_LINE_JOINER, stepLineMore, stepLineMoreLabel, STEP_LINE_LESS, STEP_LINE_UNTYPED"
affects:
  - "frontend/src/components/workflows/library/WorkflowCard.tsx (one value + one gated mount)"
tech-stack:
  added: []
  patterns:
    - "pure leaf resolver + small stateful render component (FieldGuidance pattern), so the G-5 card gains no state and no prop"
    - "glyph rendered via createElement (ArtifactBlock precedent) to satisfy react-hooks/static-components"
key-files:
  created:
    - frontend/src/components/workflows/library/stepLine.ts
    - frontend/src/components/workflows/library/StepChipLine.tsx
    - frontend/src/components/workflows/library/stepLine.test.ts
    - frontend/src/components/workflows/library/StepChipLine.test.tsx
  modified:
    - frontend/src/components/workflows/library/libraryVocabulary.ts
    - frontend/src/components/workflows/library/librarySubtree.fences.test.ts
    - frontend/src/components/workflows/library/WorkflowCard.tsx
    - frontend/src/components/workflows/library/WorkflowCard.test.tsx
    - frontend/src/components/workflows/library/__tests__/__snapshots__/WorkflowCard.seam286.pin.test.tsx.snap
decisions:
  - "290-02: card chip words are PHASE_TYPE_SENTENCES via own(), never the step name, slug or PHASE_TYPE_LABELS; an unknown type echoes its raw string with no glyph; a step with no type reads STEP_LINE_UNTYPED"
  - "290-02: no JSX title on chips (library F1 fence wins over UI-SPEC 1.2); stable phase_index sort, ties keep array order"
  - "290-02: the phase glyph renders through createElement, not JSX, because react-hooks/static-components rejects a component variable resolved during render"
metrics:
  duration: "~45 min"
  completed: 2026-10-21
  tasks: 3
  files: 9
---

# Phase 290 Plan 02: The Card Chip Line Summary

The library card now shows one labelled line of step chips (sketch 290-card-chip-line winner B). Each chip is a bordered pill with the phase glyph and the step's type sentence ("Work out how to do it" → "Produce the deliverable"). The line shows the first 3 steps in `phase_index` order, then `+N more`, which expands in place to name every step. It is built from a pure resolver (`stepLine.ts`) and a small component that holds the expand state (`StepChipLine.tsx`). It is mounted in `WorkflowCard.tsx` with one derived value and one gated block: +7/-0 lines, 0 `useState`, no new prop.

**Plan base:** `1f9673d25c49f1fa1b4a759052023339a322a039` (develop). The worktree started on `17a064f2e`, so it was reset to the expected base as the branch check instructs, before any work.

## Commits

| Task | Commit | Message |
|---|---|---|
| 1 RED | `b663394ab` | test(290-02): add failing tests for the card chip line |
| 2 GREEN | `2d32103a5` | feat(290-02): resolve and render the card chip line |
| 3 mount | `c30ac9f73` | feat(290-02): one chip line on the library card |

## TDD Gate Compliance

- **RED** (`b663394ab`): `stepLine.test.ts` + `StepChipLine.test.tsx` gave **21 failed / 15 passed (36)**. Every failure was an assertion failure against the contract stubs (`resolveStepLine` returning `null`, `StepChipLine` returning `null`), not an import failure. `librarySubtree.fences.test.ts` passed with the stubs listed: **143/143** (133 before, plus 2 modules × 5 `it.each` sweeps).
- **GREEN** (`2d32103a5`): **179/179** across the three suites. `git diff --numstat b663394ab 2d32103a5 -- <the two test files>` prints nothing, so no test was edited to get to green.
- The `test(...)` commit comes before the `feat(...)` commit in git log, as required.

## What was built

- **`stepLine.ts`** (a pure leaf: no React, no `@/lib/api`, no clock). If `def.phases` is not an array it returns `null`. Entries that are not objects are skipped, and if none are left it returns `null` (D-01). Steps are sorted stably by `phase_index`; a non-number or non-finite index counts as 0. Words come from `own(PHASE_TYPE_SENTENCES, type) ?? type`. The no-type floor is `STEP_LINE_UNTYPED` (D-04, T-290-07). The result is `{ chips, shown: first 3, more }`.
- **`StepChipLine.tsx`**. It holds one `useState(false)` for `expanded`. The root is `row-steps`; inside is an `<ol aria-label="Steps, in run order">` that does not wrap and clips when collapsed. The `→ +N more` group is `flex-none` and sits outside the `ol`. The toggle carries `aria-expanded` and the accessible name "Show N more steps", and reads "Show less" when expanded. Glyphs are `aria-hidden`; an unknown type gets no mark. There is no `title` attribute anywhere.
- **Vocabulary**: six `STEP_LINE_*` entries. No `PHASE_TYPE_SENTENCES` value is copied into the file (the acceptance grep prints 0).
- **Fence**: `./stepLine.ts` and `./StepChipLine.tsx` were added to `LIBRARY_SUBTREE_PATHS` in the RED commit. The length pin moved 15 → 17; that value came from the observed failing diff (`expected […] to have a length of 15 but got 17`).

## Tests edited (deliberate fence edits)

**Child-order pins moved in `WorkflowCard.test.tsx`.** `DEF`-built cards now have `row-steps` at child index 2, so `row-identity` and the siblings after it shift down by one. Each moved pin has a `// 290-02:` comment.

1. `on a %s row the line is child index 2` (×3, published/starter/draft): length 4 → 5. It now asserts `children[2]` is `row-steps`, identity is at 3 and the folder chip at 4.
2. `with no folder chip the line is STILL child index 2`: length 3 → 4, identity at index 3.
3. `the mark does not disturb the provenance node's DOM position (D-08)`: length 4 → 5, `row-steps` at 2, identity at 3, folder at 4.
4. `one identity line per card, at DOM position 3, on every one of them` (106-row scale): when a card has `row-steps`, the test asserts it is at index 2 and identity is at 3. Otherwise identity stays at 2.
5. `the resting card's column child count is UNCHANGED by this prop`: 4 → 5. The test's own subject is still unchanged: the match-reason prop adds no child.
6. `the line is the column's LAST child`: length 5 → 6, with `row-steps` at 2.
7. `with no folder chip it is STILL last`: length 4 → 5, match-reason at index 4.

(The test titles are unchanged. Only the indices and the comments moved.)

**Three content cases added** (`describe("290-02 — the card's chip line (row-steps)")`):
- A `DEF` card's chip words equal `[PHASE_TYPE_SENTENCES.llm_agent, .llm_emit]`.
- A `NO_EMIT_DEF` card shows one chip and no `row-steps-toggle`.
- An `EMPTY_PHASES_DEF` card has no `row-steps` node, and its column has the pre-290 shape (4 children, identity at index 2).

**Card seam286 snapshot** (`library/__tests__/__snapshots__/WorkflowCard.seam286.pin.test.tsx.snap`): all 5 resting snapshots were updated. `git diff --ignore-cr-at-eol --numstat` reads **5 / 5 lines**, because each snapshot is a single outerHTML line. A scripted check removed every balanced `<div data-testid="row-steps" …>…</div>` block from the new file. Exactly **5 blocks** came out, and what remained was **byte-identical** to the pre-change snapshot. The change is therefore only the inserted one-chip `row-steps` block. The PAGES snapshots under `frontend/src/pages/__tests__/__snapshots__/` were not touched or staged, and `git diff --name-only <base> HEAD` lists no file under `frontend/src/pages/`.

## Verification

- `src/components/workflows/library` (whole directory): **17 files, 777/777 passed**. This includes `WorkflowCard.baseline.test.tsx` (the six cut atoms are still absent) and `librarySubtree.fences.test.ts`.
- eslint on `stepLine.ts`, `StepChipLine.tsx`, `WorkflowCard.tsx`, `WorkflowCard.test.tsx`: exit 0.
- `WorkflowCard.tsx`: `resolveStepLine(row.def)` ×1, `<StepChipLine` ×1, `useState` 0 (it was 0 at base). Diff +7 / −0.
- Acceptance grep on both new modules (`title=|dangerouslySetInnerHTML|PHASE_TYPE_LABELS|\.name\b`, with comment lines filtered out): 0 and 0.
- **Typecheck** (`npx tsc -p tsconfig.app.json --noEmit`): the base set and the HEAD set are both **63** `error TS` lines, and the set diff is **empty**.
- **Hot-file ledger gate** (`check-hot-file-ledger.cjs` on the phase dir): `ledger gate OK`.
- **Count gate** (one run for the wave, from the worktree root, `GSD_VITEST_MAX_WORKERS=2`). Its verdict line read `count gate OK — 486/486 pinned files present, no per-file decrease, 0 failing.` It reported `total 11064 · failed 0 · pinned total 10247`. The pinned files this plan touched moved as follows: `librarySubtree.fences.test.ts 133 → 143 (+10)`, `WorkflowCard.test.tsx 128 → 133 (+5)`, `WorkflowCard.baseline.test.tsx 29 → 29`, `WorkflowCard.seam286.pin.test.tsx 21 → 21`. The two new suites, `stepLine.test.ts` (25 tests) and `StepChipLine.test.tsx` (11 tests), are not in the gate's pinned list yet, because this plan's `files_modified` did not name the gate script. Adding their pins is left to the orchestrator.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Glyph rendered with `createElement` instead of JSX**
- **Found during:** Task 2 (eslint step)
- **Issue:** The plan's `<Glyph className=… aria-hidden />` failed `react-hooks/static-components` ("Cannot create components during render"). `PhaseCard.tsx` carries the same error today.
- **Fix:** `createElement(Glyph, { className: "h-4 w-4 flex-none", "aria-hidden": true })`, following the `ArtifactBlock.tsx` precedent, with a comment saying why. The rendered DOM is the same.
- **Files modified:** `frontend/src/components/workflows/library/StepChipLine.tsx`
- **Commit:** `2d32103a5`

**2. [Rule 3 - Blocking] Worktree base correction**
- The worktree started at `17a064f2e` (master merge), not the expected base. It was reset to `1f9673d25` per `<worktree_branch_check>` before any work. No work was lost.

Other small choices within the plan: the glyph carries `flex-none` so it cannot shrink beside truncated words. The `→` joiner before the toggle stays in the expanded state too, so the toggle keeps the same position in the line.

## Known Stubs

None. The RED-commit contract stubs were replaced in GREEN.

## Threat Flags

None. No new endpoint, request or field was added. The chip words come only from the fixed sentence table or the raw type string. Both are rendered as JSX text, and both new modules are swept by the library raw-HTML and F1 fences (T-290-06/07/08 mitigated as planned).

## Self-Check: PASSED

- FOUND: stepLine.ts, StepChipLine.tsx, stepLine.test.ts, StepChipLine.test.tsx
- FOUND: b663394ab, 2d32103a5, c30ac9f73 in `git log`

## Owed

- G-4 rows S1 (chips show only type sentences, and `+N more` is visible at 375 px) and SC#1 (a screenshot against sketch 290-card-chip-line B, plus the rendered chip text). These are driven in Chrome at verify-work, on a real 2-3 step card and on the 7-step stress card.
