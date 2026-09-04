---
phase: 217-the-library-one-home-for-documents
plan: 05
subsystem: frontend-library-selection
tags: [state-machine, discriminated-union, reducer, pure-leaf, SC#5]
requires: []
provides:
  - "frontend/src/pages/librarySelection.ts — the LibrarySelection union, LibraryState, libraryReducer, initialLibraryState, activeFolderId, activeViewId"
affects:
  - "frontend/src/pages/LibraryPage.tsx (plan 09 — replaces six useState calls and five handlers)"
tech-stack:
  added: []
  patterns:
    - "strict leaf with zero imports (the argumentModel.ts shape, Phase 214-07)"
    - "discriminated union with `?: never` members to defeat union excess-property widening"
    - "structural type parameters instead of imports, so the concrete @/types flow through uncast"
    - "@ts-expect-error as a compiler fence, driven RED to prove non-vacuity"
key-files:
  created:
    - frontend/src/pages/librarySelection.ts
    - frontend/src/pages/__tests__/librarySelection.test.ts
  modified: []
decisions: [D-217-12, D-217-14]
requirements: [LIB-01]
metrics:
  duration: ~17 min
  tasks: 2
  files: 2
  lines: 901
  tests: 25
  completed: 2026-08-29
---

# Phase 217 Plan 05: The Library Selection Leaf Summary

A four-arm discriminated union plus a total pure reducer make the folder/view mutual exclusion
unrepresentable rather than merely avoided — replacing the two encodings that ship today
(`IngestionPage.tsx:241-242`/`:251-252`'s paired `setState`, and the render-time ternary at `:307`).

## The exported surface (plan 09 wires against exactly this)

```ts
// frontend/src/pages/librarySelection.ts — ZERO imports

export interface LibraryFilterLike { op: "and"; conditions: readonly unknown[] }
export interface LibraryViewLike<F extends LibraryFilterLike = LibraryFilterLike> {
  id: string
  filter_expr: F
}

export type LibraryTab = "documents" | "views" | "ingestion" | "indexing"

export type LibrarySelection =
  | { tab: "documents"; folderId: string | null; viewId?: never }
  | { tab: "views";     viewId: string | null;   folderId?: never }
  | { tab: "ingestion"; folderId?: never; viewId?: never }
  | { tab: "indexing";  folderId?: never; viewId?: never }

export interface LibraryState<F extends LibraryFilterLike = ..., V extends LibraryViewLike<F> = ...> {
  readonly selection: LibrarySelection
  readonly editingView: V | null
  readonly filter: F | null          // null == EMPTY_FILTER (see deviation 1)
  readonly folderSheetOpen: boolean
  readonly parkedFolderId: string | null   // ⚠ ARM MEMO, not the selection
  readonly parkedViewId: string | null     // ⚠ ARM MEMO, not the selection
}

export const initialLibraryState: LibraryState<never, never>

export type LibraryAction<F, V> =
  | { type: "SELECT_FOLDER"; folderId: string | null }
  | { type: "SELECT_VIEW";   view: V }
  | { type: "EDIT_VIEW";     view: V }
  | { type: "CHANGE_FILTER"; filter: F }
  | { type: "DELETE_VIEW";   viewId: string }
  | { type: "SELECT_TAB";    tab: LibraryTab }

export type LibraryReducer<F, V> = (s: LibraryState<F, V>, a: LibraryAction<F, V>) => LibraryState<F, V>
export function libraryReducer<F, V>(state: LibraryState<F, V>, action: LibraryAction<F, V>): LibraryState<F, V>

export function activeFolderId(state: { selection: LibrarySelection }): string | null
export function activeViewId(state: { selection: LibrarySelection }): string | null
```

**The wiring line plan 09 needs — nothing else to explore:**

```ts
const [lib, dispatch] = useReducer(libraryReducer<ViewFilter, SavedView>, initialLibraryState)
```

Instantiation expressions require TS ≥ 4.7; this tree is on **5.9.3**, and the seam was proven by
driving the whole suite at `<ViewFilter, SavedView>` — a real `SavedView` satisfies
`LibraryViewLike<ViewFilter>` structurally, so **nothing is cast at the boundary**.

Handler mapping for plan 09:

| shipped handler | action |
|---|---|
| `handleSelectFolder` (`:240`) | `SELECT_FOLDER` |
| `handleSelectView` (`:249`) | `SELECT_VIEW` |
| `handleEditView` (`:259`) | `EDIT_VIEW` |
| `handleFilterChange` (`:273`) | `CHANGE_FILTER` |
| `handleDeletedView` (`:290`) | `DELETE_VIEW` |
| — new in 217 — | `SELECT_TAB` |

And `IngestionPage.tsx:307`'s `selectedViewId === null ? selectedFolderId : null` becomes
`activeFolderId(lib)`. `filteredDocs` / `matchCount` / `filterReqId` stay as they are — they are
NOT in this state, by decision (see below).

## Task-by-task

| Task | Name | Commit | Files |
|---|---|---|---|
| 1 | The strict leaf | `83ee0a4fc` | `frontend/src/pages/librarySelection.ts` (309 L) |
| 2 | Exhaustive transition suite | `f4b6d8cc9` | `frontend/src/pages/__tests__/librarySelection.test.ts` (592 L, 25 cases) |

## What was OBSERVED, not assumed

Both RED drives the plan asks for were actually run, and both are recorded with the observation
rather than the intention.

**1. D-217-14 went RED against a deliberately wrong reducer.** `SELECT_FOLDER` was temporarily
changed to preserve the previous tab when the state was on the `views` arm. Measured:

```
× D-217-14: SELECT_FOLDER from the views arm yields the documents arm
AssertionError: expected { tab: 'views', viewId: 'v1' } to deeply equal { tab: 'documents', folderId: 'f9' }
Tests  1 failed | 24 passed (25)
```

⚠ **The finding is the `24 passed`.** The property test — the mutual-exclusion invariant quantified
over every reachable state — **stayed GREEN against the defect**, because a state parked on the
views arm with a null folder still satisfies `activeFolderId === null || activeViewId === null`. The
property proves the union cannot hold both ids; it **cannot** prove the tab follows the selection.
Only the named case carries D-217-14. The defect was then reverted and
`git diff --stat HEAD -- librarySelection.ts` was **empty** — the module is byte-identical to its
own commit.

**2. The compiler fence's non-vacuity was driven too.** Removing the defect from the first
`@ts-expect-error` line (`{ tab: "ingestion", folderId: "f1" }` -> `{ tab: "ingestion" }`) produced:

```
src/pages/__tests__/librarySelection.test.ts(525,5): error TS2578: Unused '@ts-expect-error' directive.
```

so the three union fences are checked by `tsc`, not decorative. Restored.

⚠ **The `?: never` members on every arm are load-bearing and were added because of a measured
TypeScript behaviour, not as style.** Excess-property checking against a *union* accepts any
property declared by ANY constituent, so a plain four-arm union would have accepted
`{ tab: "ingestion", folderId: "f1" }`. The plan's acceptance criterion ("a `{tab:"ingestion",
folderId}` value does not typecheck") is only true with them.

## Verification

| Check | Result |
|---|---|
| `npx vitest run src/pages/__tests__/librarySelection.test.ts --maxWorkers=2` | **25 passed / 25**, 938 ms |
| `npx tsc --noEmit -p tsconfig.app.json` | **34 errors — identical to the re-derived baseline** |
| baseline re-derivation | the module was moved out of the tree and tsc re-run: **34**. Same figure with it present, and `grep librarySelection` over the output is EMPTY. No new errors. |
| `grep -c "^import" librarySelection.ts` | `0` |
| `grep -n "fetch\|useState\|useEffect\|localStorage" librarySelection.ts` | nothing (exit 1) |
| `grep -n "render\|vi.mock\|@testing-library"` on the test | nothing (exit 1) |
| five required exports present | yes — lines 103 / 140 / 179 / 300 / 305 |
| `GSD_VITEST_MAX_WORKERS=2` | honoured on every run; no red, cap never adjusted |

## Deviations from Plan

**1. [Design necessity] `filter` is `F | null`, not a re-declared `EMPTY_FILTER`.**
- **Found during:** Task 1.
- **The conflict:** the plan requires BOTH `grep -c "^import" == 0` AND "resets `filter` to EMPTY".
  A zero-import module cannot reach `EMPTY_FILTER` (`types/index.ts:331`), and **declaring a second
  copy of it would be exactly the duplicate encoding this module exists to delete** — the same
  failure one level down from the one SC#5 names.
- **Resolution:** `filter: F | null`, where `null` *is* "no filter composed". The consumer resolves
  `lib.filter ?? EMPTY_FILTER`. The equivalence is **fenced**: the suite imports the real
  `EMPTY_FILTER` and asserts it is still `{op:"and", conditions:[]}` and that a cleared reducer
  filter equals it, so the two cannot drift silently. Documented under its own docblock heading.
- **Commit:** `83ee0a4fc`.

**2. [Rule 2 — required for the plan's own acceptance] Two arm memos were added to `LibraryState`.**
- **Found during:** Task 1, from the plan's own `SELECT_TAB` requirement ("`documents` keeps its
  `folderId`") plus the Task 2 round-trip case (`documents -> ingestion -> documents` preserves
  `folderId`). The union holds ONE id at a time by construction, so a tab round-trip through
  `ingestion` structurally cannot restore the folder without a memo.
- **Resolution:** `parkedFolderId` / `parkedViewId`, INERT. `activeFolderId` and `activeViewId` read
  the selection arm and nothing else, and a dedicated case asserts a parked id never leaks into
  either accessor. They are also mutually exclusive themselves — `SELECT_FOLDER` clears
  `parkedViewId`, `SELECT_VIEW`/`EDIT_VIEW` clear `parkedFolderId` — so a tab switch can never
  resurrect a view the user abandoned (its own case).
- **Commit:** `83ee0a4fc`.

**3. [Fidelity to shipped behaviour] `CHANGE_FILTER` only leaves the views arm.**
- The plan says `CHANGE_FILTER` yields `{tab:"documents", folderId:null}`. The **shipped** handler
  (`:275`) calls `setSelectedViewId(null)` and **never touches `selectedFolderId`**. So the reducer
  moves the selection only from the `views` arm; on the `documents` arm the folder selection
  survives, and on `ingestion`/`indexing` the selection is untouched. The plan's named case (from the
  views arm) is satisfied exactly, and the shipped folder behaviour is preserved rather than
  silently changed. Both arms have their own case.

**4. [Fidelity] `EDIT_VIEW` leaves `folderSheetOpen` alone.** The shipped `handleEditView` (`:259`)
does not close the sheet, unlike `handleSelectFolder`/`handleSelectView`. Preserved and commented.

No package was installed. No file outside this plan's `files_modified` was touched:
`git status --short` showed only the two new files, and `git diff --diff-filter=D HEAD~2 HEAD` is
empty (no deletions).

## Known Gaps

⚠ **This suite is in NEITHER knob of `scripts/vitest-count-gate.cjs`, and that is a deliberate
scope decision, not an oversight.** Measured: the gate reaches `src/pages` **by NAMED FILES ONLY** —
there is no `src/pages` directory entry, and `src/pages/__tests__` is reached by nothing at all
(the script says so itself at `:1855` and `:2896`). So `librarySelection.test.ts` neither RUNS in
the gate nor is guarded by a BASELINE pin: its 25 cases are invisible to the count gate.

Not fixed here because `scripts/vitest-count-gate.cjs` is a hot shared file (128 commits / 28
phases) that is **not** in this plan's `files_modified`, and a sibling agent is executing in the
same wave — a concurrent edit there is exactly the kind of shared-file collision worktrees do not
protect against. **The pin belongs in this phase's closing plan**, alongside whatever other new
suites the wave produced, and needs BOTH knobs (a `TARGETS` entry and a `BASELINE` pin), per the
Phase 214-15 finding that `TARGETS` decides what runs and `BASELINE` decides what is guarded.

## Threat Model Verification

| Threat ID | Disposition | How it is discharged |
|---|---|---|
| T-217-18 | mitigate | The module selects an id and authorizes nothing. Asserted by construction: `grep -c "^import"` is `0` and the no-I/O grep is empty — both are **also asserted at runtime** by the suite's strict-leaf cases, which read the module source via `?raw` with a length non-vacuity control. |
| T-217-19 | mitigate | Unrepresentable at the type level (three `@ts-expect-error` fences, the first observed firing `TS2578`), and asserted as a property over every state reachable in 3 steps with a non-vacuity control (`count > 1` AND `count > 10`) plus a driver control that all six action types are exercised. A second case checks the raw object keys, so the property does not rest on the accessors alone. |
| T-217-SC | mitigate | No package installed by this plan. |

No new threat surface: no network endpoint, no auth path, no file access, no schema change.

## Self-Check: PASSED

- `frontend/src/pages/librarySelection.ts` — FOUND
- `frontend/src/pages/__tests__/librarySelection.test.ts` — FOUND
- commit `83ee0a4fc` — FOUND
- commit `f4b6d8cc9` — FOUND

## Known Stubs

None. Both files are complete and exercised; nothing is placeholder, empty-defaulted or
unwired-by-design. The module has no consumer yet **by plan** — plan 09 is its wiring step, and the
`key_links` entry above records that seam.
