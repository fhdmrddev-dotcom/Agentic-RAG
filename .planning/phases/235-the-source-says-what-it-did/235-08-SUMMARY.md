---
phase: 235-the-source-says-what-it-did
plan: 08
subsystem: ui
tags: [react, useReducer, navigation, library, health-tab, boundary-composition]

requires:
  - phase: 217.1
    provides: "`librarySelection.ts` (the six-action reducer leaf + the five-member `LibraryTab` union) and the Library's five-tab shell"
  - phase: 137
    provides: "the `studioSkillId` / `studioTab` App→ChatLayout threading precedent this plan copies verbatim"
provides:
  - "`LibraryPage` accepts an optional `initialTab`, so a caller OUTSIDE the Library can open any tab — the Health tab included"
  - "`App.handleOpenLibraryHealth`: ONE navigator that sets the tab payload and `setActiveView(\"documents\")` together"
  - "`ChatLayout` forwards `initialTab={libraryTab}` and accepts (but does not yet consume) `onOpenLibraryHealth`"
  - "`LibraryPage.handleGoToSource(watchId)` — the Health→Ingestion hop (D-235-17)"
affects: [235-09 (rail badge popover consumes onOpenLibraryHealth), 235-10 (owes the #watch-card-<id> anchor), 235-11 (declares HealthTab.onGoToSource and deletes HealthTabSlot), 235-12 (count-gate adoption)]

tech-stack:
  added: []
  patterns:
    - "Boundary composition via `useReducer`'s LAZY INITIALIZER running the leaf's own `SELECT_TAB` — a page-level need met without a seventh reducer action"
    - "A temporary typed SLOT component rather than a cast, when a prop's real consumer lands in a later wave"

key-files:
  created:
    - frontend/src/pages/__tests__/LibraryPage.initialTab.test.tsx
    - .planning/phases/235-the-source-says-what-it-did/deferred-items.md
  modified:
    - frontend/src/pages/LibraryPage.tsx
    - frontend/src/App.tsx
    - frontend/src/components/layout/ChatLayout.tsx
    - frontend/src/pages/__tests__/librarySelection.test.ts
    - frontend/src/__tests__/library/renameFence.test.ts

key-decisions:
  - "The initial tab is seeded by running the leaf's OWN `SELECT_TAB` in a lazy initializer, not by hand-building a `LibrarySelection` arm — `selectionForTab` is module-private and hand-building `{ tab, folderId: null }` does not typecheck against the `?: never` arms"
  - "`HealthTabSlot` (a typed no-op wrapper) over `HealthTab as unknown as …` — a false type is worse than a stated no-op"
  - "`libraryTab` / `onOpenLibraryHealth` are OPTIONAL on `ChatLayout.Props`; a required prop would have reddened four shipped suites this plan does not own"
  - "`renameFence.test.ts` relaxed at exactly one character sequence (the trailing ` />`) — it pinned a CLOSED prop list, not the key link it is about"

patterns-established:
  - "A guard that pins a component's full prop list will redden on every legitimate prop addition; pin the LINK (branch → mount, with its proximity window) and stop there"

requirements-completed: [SURF-03]

duration: 42min
completed: 2026-09-06
---

# Phase 235 Plan 08: The Library opens on a tab a CALLER chose — Summary

**`LibraryPage` gained an optional `initialTab`, composed at the reducer boundary through the leaf's own `SELECT_TAB` transition, and `App` gained one navigator that sets the Library view and its tab together — so the Health tab has an external door for the first time, without a seventh reducer action, a twelfth `ActiveView` member or a URL.**

## Performance

- **Duration:** ~42 min
- **Tasks:** 2 of 2 (plus one Rule-1 auto-fix)
- **Files modified:** 5 (+2 created)
- **Commits:** `f839f17a8`, `c98f3938b`, `3f922344b`

## Accomplishments

### Task 1 — `LibraryPage` accepts an initial tab (`f839f17a8`, TDD)

**RED first, and it was read rather than assumed:** `4 failed | 26 passed (30)` — the four `initialTab` cases failed, the control (`no prop → Documents`) passed, and `librarySelection.test.ts`'s 25 were already green. **GREEN:** `30 passed`.

The seam actually taken is *narrower* than the plan's sketch, and for a measured reason:

```ts
const [lib, dispatch] = useReducer(pageReducer, initialLibraryState, (opening) =>
  initialTab ? pageReducer(opening, { type: "SELECT_TAB", tab: initialTab }) : opening,
)
```

The plan proposed `{ ...initialLibraryState, selection: { tab: initialTab, folderId: null } }`. **That does not typecheck**, and the reason is the leaf working correctly: `LibrarySelection`'s arms carry `folderId?: never` on `ingestion` / `indexing` / `health`, so `folderId: null` is only legal on the `documents` arm. The leaf's own `selectionForTab` helper resolves this — but it is module-private, and exporting it would be an edit to a file this plan must leave byte-unchanged. **Running the leaf's own transition in the lazy initializer is strictly better than either**: the seeded state is one the reducer could genuinely have reached, and no arm shape is re-derived at the boundary at all.

- ⛔ **`librarySelection.ts` is byte-unchanged** — `git diff` on it is EMPTY, and `grep -c '| { type: "'` still reads **6**.
- `handleGoToSource(watchId)` added beside the existing dispatch sites, copying `ReembedSearchPointer`'s `onViewProgress` idiom (dispatch, then `scrollIntoView` after 100 ms) rather than inventing a second scroll shape.

### Task 2 — App holds the tab, one navigator; ChatLayout forwards it (`c98f3938b`)

- `App.tsx`: `const [libraryTab, setLibraryTab] = useState<LibraryTab | undefined>(undefined)` beside `activeView`, plus `handleOpenLibraryHealth` setting **both** payload and view in one function — the `handleOpenStudio` shape.
- `ChatLayout.tsx`: both props declared, `initialTab={libraryTab}` forwarded at the `activeView === "documents"` branch.
- **`ActiveView` still has exactly 11 members**; `grep -c '"documents"' App.tsx` reads **2** (the union member and `setActiveView("documents")` in the new navigator).
- **No `window.location` was added.** ⚠ My first draft of the navigator's comment *named* that API in prose, which made `git diff | grep -c window.location` read `1` against a criterion that forbids it. The comment was reworded to describe the API without spelling it — the 187-24 lesson (prose that repeats a literal makes a code measurement satisfiable by a comment), which `App.tsx:91-101` already records once for `ActiveView`.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 1 — Bug] `renameFence.test.ts` pinned a CLOSED prop list, not the key link (`3f922344b`)**

- **Found during:** the plan-level `vitest-count-gate.cjs` verification, from the gate's **own persisted JSON report**, before any re-run.
- **Issue:** the fence required the mount spelled exactly `<LibraryPage onNavigate={onNavigate} />`. Adding `initialTab={libraryTab}` turned it red — for a reason with nothing to do with the Documents→Library rename the fence is about.
- **Fix:** relaxed **only** the trailing ` />`. The branch→mount link and its 120-character proximity window are preserved verbatim. The `<IngestionPage` negative assertion is untouched. Case count unchanged at **15**.
- ⭐ **The relaxed pattern was driven RED against two planted defects** before being accepted — mount swapped to `<IngestionPage` → `false`; 200 characters inserted into the gap → `false`; live file → `true`. A relaxed guard nobody has seen fire is not a guard.
- **Second half of the fix:** my ChatLayout comment was sitting *between* the branch and the mount, inside the 120-char window. It moved **above** the branch, with a note saying why nothing may go there.
- **Files:** `frontend/src/__tests__/library/renameFence.test.ts`, `frontend/src/components/layout/ChatLayout.tsx`.
- ⚠ `renameFence.test.ts` is **not** in this plan's `files_modified`. It is edited anyway because the plan's own change is what reddened it — in scope by causation, and recorded here rather than left as a surprise for plan 12.

### Decisions the plan asked me to make and report

**2. `HealthTab.onGoToSource` does not exist yet — which option was taken.**

The plan offered two. I took the **typed wrapper**, as a real component rather than a cast:

```tsx
function HealthTabSlot(_props: { onGoToSource: (watchId: string) => void }) {
  return <HealthTab />
}
```

- **Why not "wait for plan 11":** `tsconfig.app.json` sets `noUnusedLocals: true`, so an unconsumed `handleGoToSource` fails `tsc` outright.
- **Why not a cast** (`HealthTab as unknown as (p: {onGoToSource?: …}) => …`): it would **claim** the prop is accepted while it is silently dropped. A stated no-op is honest; a false type is not.
- ⛔ **PLAN 11 MUST DELETE `HealthTabSlot`** and pass `onGoToSource` straight to `HealthTab`. It is marked as such in the source.

**3. `onOpenLibraryHealth` reaches nothing in this plan — deliberately.**

It is declared on `ChatLayout.Props` and **not destructured**, so `noUnusedParameters` stays quiet and plan 09 adds exactly one name to the parameter list plus one prop on the `<NavPanel>` mount. `NavPanel.tsx` was **not** touched — it is plan 09's file and a sibling executor is live.

**4. Both new `ChatLayout` props are OPTIONAL, against the plan's required-prop sketch.**

Four shipped suites mount `<ChatLayout {...baseProps} />` from their own prop objects (`ChatLayout.launch.test.tsx:267-284` and three others). A **required** prop would have raised `tsc --noEmit` above its measured baseline in files this plan does not own. Optional costs nothing — `App` always passes both.

**5. The `librarySelection.test.ts` case count did NOT grow, contrary to the plan's acceptance criterion.**

The criterion said *"a case count strictly greater than 25 (the `TABS` widening adds cases)"*. **It does not:** `TABS` is looped **inside** cases (`:239`, `:509`), so widening it adds loop iterations and one ACTION, never a case. Measured **25 before and 25 after**. What did change is `expect(ACTIONS.length).toBe(12)` → `13`, which had to be updated in the same edit. The action-TYPE assertion at `:197` still reads **6** and was not touched.

⚠ **`"health"` had been missing from `TABS` since 217.1-12** — five union members, four driven. The fifth arm, the one this whole phase makes externally reachable, was the untested one.

## Measured figures — for plan 12's pinning

⛔ `scripts/vitest-count-gate.cjs` was **NOT modified** by this plan. Suites were run directly.

| Suite | Before | After |
|---|---|---|
| `src/pages/__tests__/librarySelection.test.ts` | **25** passed | **25** passed (unchanged — see deviation 5) |
| `src/pages/__tests__/LibraryPage.initialTab.test.tsx` | — (did not exist) | **5** passed ⭐ NEW, unpinned |
| `src/pages/__tests__/LibraryPage.test.tsx` | 17 passed | **17** passed |
| `src/__tests__/library/renameFence.test.ts` | 15 passed | **15** passed |
| `src/components/library/__tests__/sketchComposition.test.tsx` | 47 passed | **47** passed |
| `src/components/layout` (10 files) | — | **111** passed, 0 failed |
| `npx tsc -p tsconfig.app.json --noEmit` | **66** errors | **66** errors (unchanged) |

**Plan 12 should pin `LibraryPage.initialTab.test.tsx` at the gate's own printed `— N new` figure, not at the `5` above.**

⚠ Every row above was measured **per file, alone**. My first draft of this table carried two figures I had inferred from a combined `2 files / 64 tests` run (`LibraryPage.test.tsx: 55`, `sketchComposition: 9`) and **both were wrong** — the real split is `17` / `47`. Corrected before this summary was committed, and recorded rather than quietly overwritten, because a hand-derived count in a table plan 12 will pin from is exactly the kind of figure that rots.

## The composition fence — ZERO cases turned green

Measured after this plan's three commits, against `235-BASELINE.md`'s recorded RED run:

```
Test Files  1 failed (1)
     Tests  37 failed | 12 passed (49)
```

**Byte-identical to the baseline: 37 failed | 12 passed | 49 total.** Not one case moved.

That is the expected result and the reason is worth stating: `sourceComposition.test.tsx:443-448` reaches the Health tab by **clicking its trigger** (`user.click(screen.getByRole("tab", { name: "Health" }))`), never through `initialTab`. This plan built the *external* door; the fence was already inside the room.

⛔ **I tagged NO `data-testid` hooks in this plan.** `sources-tab-ingestion`, `sources-tab-health` and `sources-instance-statement` are all exactly as plan 03 left them. `235-BASELINE.md`'s caveat — that a **missing hook** and a **missing surface** fail this fence identically — therefore has nothing to disambiguate here: no surface was built and no hook was added. The fence was neither fixed nor pinned.

## Known stubs

| Stub | File | Why, and who resolves it |
|---|---|---|
| `HealthTabSlot` accepts `onGoToSource` and **ignores** it | `frontend/src/pages/LibraryPage.tsx` | `HealthTab` does not declare the prop until **plan 11** (Wave 4), which deletes this slot. |
| `handleGoToSource`'s `scrollIntoView` is a **no-op** | `frontend/src/pages/LibraryPage.tsx` | `WatchedFoldersSection.tsx:219` emits `data-testid={\`watch-card-${watch.id}\`}` but **no matching `id` attribute** — `getElementById` finds nothing. **Plan 10** owes that anchor. The tab switch half works today. |
| `onOpenLibraryHealth` forwarded to nothing | `frontend/src/components/layout/ChatLayout.tsx` | Its consumer is `NavPanel`'s badge popover, built by **plan 09**. |

None of the three blocks this plan's goal: an external caller **can** open the Library Health tab today, which is what SURF-03 was missing.

## Deferred / out-of-scope

**`src/pages/__tests__/SettingsPage.a11y.test.tsx` — 4 failing, INHERITED.** Logged to `deferred-items.md` with the argument, not the assertion: `git diff 86da3f703 HEAD --name-only` is exactly this plan's five files, and `grep "LibraryPage\|ChatLayout\|@/App\|librarySelection" frontend/src/pages/SettingsPage.tsx` returns nothing — the failing suite's module graph cannot reach any file this plan edited. **Not fixed** (executor scope boundary).

## The count gate — one red, and it is SEED-171's fifth suite

Final run: `total 7544 · failed 1 · pinned total 6814` (grand total and pinned total both match `235-BASELINE.md` exactly).

The one failure, taken from the gate's **own persisted JSON before any re-run**, per the CLAUDE.md triage procedure:

```
frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx
  :: POSITIVE CONTROL — with the flag ON the very same read finds the key
  AssertionError: expected 0 to be greater than 0
```

- **It is `SEED-171`'s fifth named cap-independent flaky suite**, failing with the *exact* assertion CLAUDE.md quotes verbatim for it (*"failed a suite's own POSITIVE CONTROL with `AssertionError: expected 0 to be greater than 0`"*).
- `git diff --numstat 86da3f703 HEAD -- frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx frontend/src/pages/WorkflowBuilderPage.tsx` is **EMPTY** — both files are **provably unmodified** by this plan.
- ⛔ **The cap was NOT adjusted** (held at `GSD_VITEST_MAX_WORKERS=2` throughout) and the gate was **not re-run to chase green**. Recorded as an observation. ⚠ *Provably unmodified*, not *fine* — one sample says nothing about the suite's health.
- ⚠ The **first** gate run of this plan also read `failed 1`, and that one was **real and mine** (`renameFence.test.ts`). The procedure — read the filename from the JSON, date it against the diff — is what separated the two, not the colour.

## Self-Check

Files claimed created — verified present:

- `frontend/src/pages/__tests__/LibraryPage.initialTab.test.tsx` — FOUND
- `.planning/phases/235-the-source-says-what-it-did/deferred-items.md` — FOUND

Commits claimed — verified in `git log`:

- `f839f17a8` feat(235-08): LibraryPage accepts an initial tab, composed at the boundary — FOUND
- `c98f3938b` feat(235-08): App holds the Library tab, one navigator; ChatLayout forwards it — FOUND
- `3f922344b` fix(235-08): renameFence pinned a CLOSED prop list, not the key link — FOUND

Plan-forbidden writes — verified NOT modified (`git diff 86da3f703 HEAD --name-only`):

- `.planning/STATE.md` — not in the diff
- `.planning/ROADMAP.md` — not in the diff
- `scripts/vitest-count-gate.cjs` — not in the diff
- `frontend/src/pages/librarySelection.ts` — not in the diff (the leaf is byte-unchanged)

## Self-Check: PASSED
