---
phase: 286-seams-before-features
plan: 04
subsystem: frontend / workflows library card
tags: [g5-extraction, pure-move, pin-first, frontend, library-card]
requires: []
provides:
  - "frontend/src/components/workflows/library/WorkflowCardMenu.tsx (useDraftDelete, WorkflowCardMenu, DraftDeletePrompt)"
  - "characterization pin WorkflowCard.seam286.pin.test.tsx (21 cases, 13 snapshots)"
affects:
  - "Phase 290 (card re-skin): WorkflowCard.tsx is now drawing-only; it holds no state of its own"
tech-stack:
  added: []
  patterns:
    - "pin-first pure move: characterization pin committed before the move, numstat empty after"
    - "span-compare proof: every moved span checked byte-for-byte against the base blob"
key-files:
  created:
    - frontend/src/components/workflows/library/WorkflowCardMenu.tsx
    - frontend/src/components/workflows/library/__tests__/WorkflowCard.seam286.pin.test.tsx
    - frontend/src/components/workflows/library/__tests__/__snapshots__/WorkflowCard.seam286.pin.test.tsx.snap
    - .planning/phases/286-seams-before-features/286-04-BASE.md
  modified:
    - frontend/src/components/workflows/library/WorkflowCard.tsx
    - frontend/src/components/workflows/library/librarySubtree.fences.test.ts
    - frontend/src/pages/__tests__/PublishedCardDelete.test.tsx
decisions:
  - "WorkflowCardMenu.tsx exports three things (hook, menu, prompt) because the menu and the armed prompt render in different DOM positions; the card calls the hook and mounts both"
  - "consequenceId moved into the menu: nothing else in the card read it"
  - "The moved JSX keeps the indentation it had in the card, so a byte compare against the base proves the move"
  - "react-hooks/purity on `now = Date.now()` was masked at base by the try/finally (React Compiler lint bailed on the whole card); the move unmasked it; suppressed with a written reason rather than changing the documented real-clock default"
metrics:
  duration: "about 20 minutes"
  completed: 2026-10-18
  tasks: 2
  files: 7
---

# Phase 286 Plan 04: The card's overflow menu moves into WorkflowCardMenu.tsx

The `⋯` menu, the draft's arm-to-confirm delete and its prompt now live in `WorkflowCardMenu.tsx`. All 350 moved lines are byte-identical to the base card. The rendered DOM, the menu's item roles and the delete grades are unchanged, and a characterization pin committed before the move proves it with an empty numstat.

## Commits

| Task | Commit | What |
|---|---|---|
| 1 | `19edbd5fc` | `test(286-04)`: the characterization pin (21 cases, 13 snapshots) plus `286-04-BASE.md` |
| 2 (move) | `01c87b9ff` | `refactor(286-04)`: the move, plus the one fence edit librarySubtree requires |
| 2 (retarget) | `78a66448e` | `test(286-04)`: the published-delete trigger fence follows the trigger into the menu |

## Line counts

| File | Before | After |
|---|---|---|
| `WorkflowCard.tsx` | 1661 | 1354 |
| `WorkflowCardMenu.tsx` | none | 473 |

The card dropped 307 lines. The menu file is 473 lines: 350 moved verbatim, plus its docblock, its imports, the three prop interfaces and the wrappers. The card's `useState` count is now **0**. It has one `<WorkflowCardMenu` and one `<DraftDeletePrompt`, and `WorkflowDeleteSheet` still appears 8 times (import, ref type, props type, mount).

## The move is verbatim, proven by comparing spans

A script compared each moved span of the base blob (`git show d45bef9e2:…/WorkflowCard.tsx`) with the new file, ignoring line endings:

```
285-294 (10 lines): VERBATIM      DropdownMenu import with its WR-03 comment
296-296 (1 lines): VERBATIM       deleteWorkflowDraft from "@/lib/api" (same specifier)
336-377 (42 lines): VERBATIM      menu + prompt words
423-431 (9 lines): VERBATIM       MENU_NOTE_CLASSES
551-556 (6 lines): VERBATIM       DESTRUCTIVE_ITEM_CLASSES
911-918 (8 lines): VERBATIM       D-18 state docblock + three state hooks
938-944 (7 lines): VERBATIM       consequenceId
946-971 (26 lines): VERBATIM      confirmDeleteDraft + its D-18 docblock
1372-1572 (201 lines): VERBATIM   the <DropdownMenu> JSX, every comment
1608-1647 (40 lines): VERBATIM    the {armed && (...)} prompt
ALL SPANS VERBATIM
```

These stay in the card: the `WorkflowDeleteSheet` import, ref and mount (PublishedCardDelete pins the import edge in the card's source), `owned` (the card's one read of `CHIP_PREDICATES.yours`), `runnable` (from `cardFace`), and the top-right wrapper with its `showOverflow` guard. The same applies to `GUTTER_TONE`, `RUN_TONE`, `identityParts`, the `row-*` testids, `CalendarClock` (still used by the automation glyph) and every other face line.

## The two test edits (D-13), each with its reason

1. **`librarySubtree.fences.test.ts`, in the move commit (+3/−1).** `"./WorkflowCardMenu.tsx"` is appended to `LIBRARY_SUBTREE_PATHS` with a dated 286-04 comment, and the length pin goes from 14 to 15. The reason is the fence's own rule, stated in its header and at the array: *"a module joins the list in the same commit that creates it"*. Without the edit the moved menu would escape the F1, T-192-04, F4, F5, F6 and F7 sweeps while each of them stayed green. The five `it.each` sweeps over the path list add 5 cases (1303 → 1308 in the consumer run below), which matches the "+5 per module" forecast recorded in that file. A constraint was checked before the move: F6's and F7's scoping controls assert an EXACT list of modules that mention the opaque draft field or a creator-column identifier. The new file mentions neither (`grep -c` = 0), so the card stays the only one of the two in F6's list.
2. **`PublishedCardDelete.test.tsx`, its own test-only commit (+13/−2).** Line 774 asserted `data-testid="published-delete"` in the CARD source, and that trigger is a menu item, so it moved. The test now also loads `WorkflowCardMenu?raw`, guarded by `length > 2000` and by containing `"WorkflowCardMenu"`. The trigger-testid assertion points at the menu source. A new hop assertion checks that the card source contains `<WorkflowCardMenu`. The card's Sheet-import regex and every page-side negative are unchanged.

No other test file was edited.

## Empty numstat (the pin and the baseline, unedited by the move)

```
$ git diff --numstat 19edbd5fc HEAD -- frontend/src/components/workflows/library/WorkflowCard.baseline.test.tsx frontend/src/components/workflows/library/__tests__/
(empty)
$ git diff --numstat d45bef9e2 HEAD -- frontend/src/components/workflows/library/WorkflowCard.baseline.test.tsx
(empty)
```

The pin's range starts at its own commit (`19edbd5fc`), because the pin did not exist at the phase base. Measured from `d45bef9e2`, the pin would show its own creation and nothing else.

## Verification

- **Pin at base:** 21/21 green, and baseline + pin = 50 passed. A non-vacuity drive planted the Schedules payload as `row.slug`. Exactly one case went red (`Schedules hands up { id, name } — the row ID, never the slug`), and the card was restored md5-identical.
- **Consumer set, base vs after the move:** the library directory, runLogTone.mirror, PublishedCardDelete, WorkflowsPage and 18 `/src/**` glob sweeps. Base: 35 files, 1303 passed. After the move, before the retarget: **1 failed | 1307 passed (1308)**. The one failure was exactly the predicted `PublishedCardDelete` trigger assertion (`expected '…' to contain 'data-testid="published-delete"'`), with no other red.
- **Plan verify set after the retarget** (library dir + runLogTone.mirror + PublishedCardDelete + WorkflowsPage, `--maxWorkers=2`, `CI=true`): **17 files, 836 passed, 0 failed**. That includes WorkflowCard.test.tsx with the WR-03 five-role sweep and the axe case, unedited.
- **tsc** (`npx tsc -p tsconfig.app.json --noEmit`): 63 errors at base, 63 after the move and 63 after the retarget. The **set diff is empty** each time.
- **hooks rules:** `check-react-hooks-rules OK — no NEW react-hooks/rules-of-hooks violation.` (2 inherited, `ToolCallPanel.tsx`.)
- **eslint:** card and menu are clean (exit 0). See the deviation below for the two disables, each with a reason.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 3 — blocking a gate] A `react-hooks/purity` finding was masked at base and the move unmasked it**
- **Found during:** Task 2, eslint on the moved card.
- **Issue:** `WorkflowCard.tsx`'s `now = Date.now()` prop default now reports `react-hooks/purity` ("Cannot call impure function during render"). At base, eslint on the card printed nothing. **Cause, measured:** the React Compiler lint bails on a component holding a `try/finally`, and D-18's `confirmDeleteDraft` had one. Linting the base card with only that `finally` block removed (via `--stdin`) reports this exact error at the same line. So the defect is pre-existing. The move took the `try/finally` out of the card, the compiler lint now covers the whole card, and the finding surfaced.
- **Fix:** `// eslint-disable-next-line react-hooks/purity -- documented real-clock default, masked at base`, with a dated 286-04 comment above it giving the measurement. The default itself was not changed: the `now` prop's docblock documents it as the real-clock fallback, the page hoists and passes `now`, and changing it would alter behaviour in a pure move.
- **Files modified:** `WorkflowCard.tsx`. **Commit:** `01c87b9ff`.
- **Note for later phases:** the compiler lint now sees the whole card, which it did not before. Phase 290's re-skin will be linted more strictly than every earlier phase on this file.

**2. [Rule 3, anticipated by the plan] `react-refresh/only-export-components` on the `useDraftDelete` export**
- Disabled on the hook's line with a reason, following the `threadNavigation.tsx` precedent the plan names. **Commit:** `01c87b9ff`.

**3. [Correction] Commit message line count.** The move commit was first written claiming 1360 lines. It was amended before anything else was built on it to the measured 1354 (`wc -l` and `git show HEAD:… | wc -l` agree).

## Deferred / out of scope

- **`PublishedCardDelete.test.tsx:958` `no-useless-escape`.** This is INHERITED: the base copy linted via `--stdin` reports the same error at `:947`, and the retarget added 11 lines above it. It is outside this plan's edits and was left alone.
- **Hot-file ledger.** `node scripts/check-hot-file-ledger.cjs .planning/phases/286-seams-before-features` reports `[no-row] frontend/src/components/workflows/library/WorkflowCardMenu.tsx` (along with five rows from plans 01-03). Under D-15/D-16, ledger rows belong to the phase's last gates/ledger wave (plan 05), not to this extraction plan. The row needs the triple `1 commit / 1 phase / 473 lines` at this plan's HEAD, plus an "honoured by construction" sentence.
- **Stale prose kept unchanged on purpose:** `WorkflowCard.tsx`'s `MARK_ICON` docblock still says *"This file already draws `MoreHorizontal`, `Trash2` and `Loader2`"*, and the lucide import's `CalendarClock` comment refers to `History` "beside it". Both were true at 192.2/204 and are now historical, because those icons moved to the menu. They were not edited, to keep every face line byte-unchanged. Phase 290's re-skin touches both blocks anyway.

## Threat model check

- **T-286-16 (draft delete endpoint):** `confirmDeleteDraft` moved byte-identical. The pin asserts `deleteWorkflowDraft(DRAFT.id)` was called once, and that the cascade and preview mocks were never called, on arm, confirm, resolve and reject. The subtree path list now includes the menu.
- **T-286-17 (published-delete visibility):** `runnable && owned` moved verbatim inside the menu JSX. `owned` is still derived in the card from `CHIP_PREDICATES.yours`. The pin snapshots the open menu for published-owned (4 menuitems + group) against published-shared (3 + group), and asserts `published-delete` is absent on the shared row.
- **T-286-18 (arm-to-confirm grade):** the pin drives these steps: the first click arms and calls nothing; Cancel disarms; Confirm while pending shows the spinner and disables both buttons; resolve calls `onDeleted` once and closes the prompt; reject shows `draft-delete-error` and does not call `onDeleted`.
- **T-286-19 (`?raw` fences):** the consumer inventory in BASE.md was taken before the move, and its predictions held exactly. The trigger fence was retargeted with a new card-to-menu hop assertion, and the page negatives are unchanged.

No new network endpoint, auth path, file access or schema surface was added.

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: `frontend/src/components/workflows/library/WorkflowCardMenu.tsx`
- FOUND: `frontend/src/components/workflows/library/__tests__/WorkflowCard.seam286.pin.test.tsx`
- FOUND: `frontend/src/components/workflows/library/__tests__/__snapshots__/WorkflowCard.seam286.pin.test.tsx.snap`
- FOUND: `.planning/phases/286-seams-before-features/286-04-BASE.md`
- FOUND commits: `19edbd5fc`, `01c87b9ff`, `78a66448e`
