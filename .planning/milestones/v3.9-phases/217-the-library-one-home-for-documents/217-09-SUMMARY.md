---
phase: 217-the-library-one-home-for-documents
plan: 09
subsystem: frontend-library-shell
tags: [tab-shell, reducer, composition, reachability, SC#5, LIB-01, LIB-02, LIB-03, hot-file-seam]
requires:
  - "217-04 — LibraryPage.tsx (the renamed page) + LibraryPage.test.tsx and its supabase-mock fix"
  - "217-05 — librarySelection.ts: the union, libraryReducer, initialLibraryState, activeFolderId, activeViewId"
  - "217-06 — the --tab-active token, which is why the selected trigger is visible on Deep Midnight"
  - "217-07 — DocumentUpload as a full-width band with a COMPUTED accept attribute"
  - "217-08 — IngestionStrip + ingestionStages.ts (shipped with NO consumer; this plan is their mount)"
provides:
  - "frontend/src/pages/LibraryPage.tsx — the four-tab shell driven by ONE reducer; each tab owns its body"
  - "frontend/src/components/library/ViewsTab.tsx — the saved-view picker, composing the shipped ViewsGroup"
  - "frontend/src/components/library/IngestionTab.tsx — the stage aggregate + the queue + the failure list; the FIRST MOUNT of IngestionStrip"
  - "frontend/src/components/library/IndexingTab.tsx — ReembedStatusCard composed UNCHANGED + model + coverage as N of M"
  - "frontend/src/pages/__tests__/LibraryPage.test.tsx — 12 cases (was 6), SC#5 asserted through the DOM from BOTH mounts"
affects:
  - "217-12 (the closing plan) — owes the count-gate pins for this suite and the ledger row update recorded below"
  - "Phase 218 — the Health tab, the KnowledgeHealthPage merge and the nav retirement land in the fifth slot this plan deliberately left empty"
tech-stack:
  added: []
  patterns:
    - "a PAGE-LEVEL wrapper reducer that delegates every domain transition to a pure leaf and adds only the one action the leaf structurally cannot express — the state stays ONE object"
    - "a shared `documentSurface(lead)` element factory: two tabs mount the same list/panel surface and differ only in their lead, so the tab bar never becomes another conditional branch"
    - "a class-based selection assertion always paired with a NON-VACUITY control row (NavRow marks selection with a class, not aria-current)"
    - "PARTIAL vi.mock of a re-export barrel via importOriginal, so a symbol the mock forgot cannot throw at mount"
key-files:
  created:
    - frontend/src/components/library/ViewsTab.tsx
    - frontend/src/components/library/IngestionTab.tsx
    - frontend/src/components/library/IndexingTab.tsx
  modified:
    - frontend/src/pages/LibraryPage.tsx
    - frontend/src/pages/__tests__/LibraryPage.test.tsx
decisions: [D-217-01, D-217-12, D-217-13, D-217-14, D-217-15, D-217-16, D-217-17, D-217-19, D-217-20, D-217-22]
requirements: [LIB-01, LIB-02, LIB-03]
metrics:
  duration: "~55 min"
  tasks: 3
  commits: 3
  files: 5
  completed: 2026-08-29
---

# Phase 217 Plan 09: the four-tab Library shell Summary

**The Library is one home with four tabs, driven by one reducer — and `IngestionStrip`, which plan
08 shipped with no consumer anywhere in the product, now has a mount a user can reach.**

## Task commits

| | Task | Commit |
|---|---|---|
| 2 | the three tab bodies (committed FIRST — see deviation 1) | `3930ca94f` |
| 1 | the four-tab shell + the reducer | `4f435c751` |
| 3 | the shell suite, 6 → 12 cases | `cec4880df` |

## ⭐ The reachability gap is CLOSED, and the mount site is named

`217-08-SUMMARY.md` recorded it plainly: *"`IngestionStrip` has no mount in the product… imported by
its own suite and by nothing else."* That is the `RunTranscript.tsx` shape the hot-file ledger warns
about — a component with a triple, a suite and no user.

**Mount site: `frontend/src/components/library/IngestionTab.tsx`**, one `<IngestionStrip>` per
in-flight document in the queue, plus one per failed document in *Needs attention*. Verified two
ways rather than asserted:

```
grep -rn "IngestionStrip" frontend/src --include=*.tsx   → the component, its suite, AND IngestionTab
```

and by the suite case *"the Ingestion tab MOUNTS the stage strip for an in-flight document"*, which
drives a `processing` document through the real page and reads `data-testid="ingestion-strip"` with
`data-status="processing"` out of the DOM. **If a later plan removes that mount, this case reds** —
which is the only mechanism that stops plan 08's 25 cases becoming invisible again.

`ViewsGroup` and `ReembedStatusCard` are **composed, never reimplemented**:
`git status --short frontend/src/components/settings/ReembedStatusCard.tsx` is **empty**, and
`ViewsTab.tsx` contains no `.map` over a views array — the shipped group does the rendering.

## The numbers the plan asked to be recorded

| Measurement | Before | After |
|---|---|---|
| `grep -c "useState" LibraryPage.tsx` | **15** | **10** (−5) |
| `useState` CALL SITES (excludes the import line) | **14** | **9** (−5) |
| `LibraryPage.test.tsx` cases | **6** | **12** (+6) |
| `LibraryPage.tsx` lines | 603 | 724 |
| `tsc -p tsconfig.app.json` errors | 33 (re-derived at base) | **33 — zero new** |

⚠ **The raw grep count needed one honest correction to mean what it measures.** My first draft of
the reducer comment contained the literal word `useState` in prose, so `grep -c` read **11** while
only **9** call sites remained. The comment was reworded to *"five React state hooks"* — **the
metric was not gamed, the prose was stopped from being counted as code.** Both figures are published
above so the derivation is checkable.

The five removed hooks: `selectedFolderId` · `selectedViewId` · `editingView` · `filter` ·
`folderSheetOpen`. The five handlers are now one `dispatch` each (plus, where the shipped handler
also kicked an async resolve, that resolve). ⛔ `filteredDocs`, `matchCount` and `filterReqId` stay
exactly as they were — async results and a stale-resolve guard, not selection.

## ⭐ The ternary is DELETED, not moved

`grep -n "selectedViewId === null ? selectedFolderId : null" frontend/src/pages/LibraryPage.tsx`
**returns nothing** (exit 1). The `FolderTree`'s `selectedFolderId` prop now reads
`activeFolderId(lib)`. That ternary was the second encoding of the mutual exclusion; had it survived
in any form the union would have removed nothing.

## ⚠ MEASURED AT THE WIRING STEP: `LibraryState.folderSheetOpen` HAS NO OPENER

This is the plan's one structural surprise, and it was found by trying to do exactly what the plan
asked (*"replace … and `folderSheetOpen` with a single `useReducer`"*).

`librarySelection.ts` declares `folderSheetOpen`, `initialLibraryState` sets it `false`, and
`SELECT_FOLDER` / `SELECT_VIEW` **clear** it. **No action in `LibraryAction` ever sets it `true`.**
So it is a one-way CLOSE signal: a page dispatching only leaf actions can close the mobile folder
sheet and can never open it. The field is unreachable-true.

**Resolution — a page-level wrapper reducer, and `librarySelection.ts` was NOT edited:**

```ts
type PageAction =
  | LibraryAction<ViewFilter, SavedView>
  | { type: "SET_FOLDER_SHEET"; open: boolean }

function pageReducer(state: LibState, action: PageAction): LibState {
  if (action.type === "SET_FOLDER_SHEET") return { ...state, folderSheetOpen: action.open }
  return libraryReducer<ViewFilter, SavedView>(state, action)
}
```

**Why not fix the leaf:** its suite asserts the action set is **exactly six**
(`expect(new Set(ACTIONS.map(a => a.type)).size).toBe(6)` at `librarySelection.test.ts:197`, plus
`expect(ACTIONS.length).toBe(12)` at `:234`). A seventh action reds a file outside this plan's
`files_modified` while a sibling agent is executing in the same wave. **The state is still ONE
object and every selection transition is still decided by the leaf** — the wrapper touches one
boolean the leaf declared and could not set.

⚠ **Re-open trigger for a future plan:** if `librarySelection.ts` is opened for any other reason,
fold `SET_FOLDER_SHEET` (or an `OPEN_FOLDER_SHEET`) into `LibraryAction` and delete the wrapper —
and update the suite's two arity assertions in the same commit.

## The composition, and why the sidebar sits outside the tabs

Radix `TabsContent` **unmounts** inactive content. If the Folders+Views sidebar lived inside the
Documents tab body, then the moment a view selection moved the tab to `views` the sidebar would
vanish — and "the two renderings can never disagree" would be unobservable, because there would
only ever be one rendering.

So the sidebar is a sibling of the `TabsContent`s, rendered while the tab is `documents` or `views`
(`showSidebar`). Both `ViewsGroup` mounts are therefore alive at the same moment and are handed the
same `activeViewId(lib)`.

The Documents tab and the Views tab share **one** `documentSurface(lead)` element factory — the
430px push/split grid, the shedding wrapper, the `FilterBar` and `DocumentList`, and the detail
panel. Only the `lead` differs (dropzone + folder header vs. picker + view header). ⭐ **The Views
tab keeps the FilterBar and the detail panel deliberately**: `EDIT_VIEW` puts the selection on the
`views` arm, so a Views tab without the bar would have broken the shipped *"Edit filter"* affordance
(Phase 114 D-114-3) — a silent regression, not a scope cut.

## The three verbatim invariants

| Invariant | Check | Result |
|---|---|---|
| the shedding rule | `grep -n "nth-child(n+3):nth-child(-n+5)"` | present, the class LITERAL byte-identical |
| the pin key | `grep -n "documents.sidebar.pinnedExpanded"` | `const SIDEBAR_PIN_KEY = "documents.sidebar.pinnedExpanded"` unchanged |
| the panel track | `grep -n "430px"` | `"minmax(0,1fr) 430px"` unchanged |

⚠ **One honest divergence on the first of those.** The plan asked for the shedding LINE to be
byte-identical. The **quoted class string is byte-identical**, but it was hoisted to a module
constant `SHED_COLUMNS_3_TO_5`, so its indentation changed (module level, not 18 spaces inside
JSX). **Reason:** two tabs now mount the list, and the alternative was two copies of a positional
selector whose correctness depends on a column order fixed in a file this one does not import. One
copy under a loud comment is strictly safer than two. The sketch fence `A2`
(`PAGE.includes("th:nth-child(n+3):nth-child(-n+5)]:hidden")`) still passes, and the drive is
`199 passed · 0 failed`.

## The four triggers, and the grep that does not read cleanly

`grep -c "<TabsTrigger" frontend/src/pages/LibraryPage.tsx` → **4**. The plan's criterion says
`grep -c "TabsTrigger"` should be `4`; the measured value is **5**, because the import line
(`import { Tabs, TabsContent, TabsList, TabsTrigger } …`) also contains the token. **Four triggers
is the property; five is the arithmetic.** They are written out one per line rather than mapped from
an array, so the set is countable by eye.

`grep -in "health" frontend/src/pages/LibraryPage.tsx` returns **4 lines, all comments, zero JSX** —
the block recording *why* there is no Health tab, and the inline note beside the trigger list.
**Left in deliberately.** The plan's criterion says "returns nothing in the tab bar", and the tab bar
has no Health trigger (asserted negatively in the suite). Deleting the comment to make a grep read
clean would delete the record of the decision, which is this project's recurring anti-pattern.

## ⭐ The observed RED — TWO plants, both driven, both restored byte-identical

**Plant A — the plan's own: make the folder click leave the tab on `Views`.**
One added line in `handleSelectFolder`: `dispatch({ type: "SELECT_TAB", tab: "views" })`.

```
 × LibraryPage > ⭐ SC#5 — the sidebar mount and the Views tab mount can never disagree
 × LibraryPage > LIB-02 — the dropzone is on the Documents tab, full width, naming its target
 Tests  2 failed | 10 passed (12)
```

⭐ **TWO cases fired, not one, and the second is the finding.** When the tab does not follow the
folder selection, the Documents tab body is unmounted — so **the upload band disappears the moment a
user picks a folder.** The defect D-217-14 names is not merely a wrong tab label; it removes the
front door. That consequence was not predicted by the plan and is recorded here rather than
smoothed over.

**Plant B — the "both mounts" half, driven separately** because plant A could in principle have
passed case 1 for the wrong reason: `<ViewsTab selectedViewId={null} …>`.

```
 × LibraryPage > ⭐ SC#5 — the sidebar mount and the Views tab mount can never disagree
 AssertionError: expected 'flex items-center gap-2 py-1.5 px-2 r…' to contain 'bg-primary/10'
 Tests  1 failed | 11 passed (12)
```

So case 1 genuinely reads **both** renderings, not one twice.

After each plant: `git checkout -- frontend/src/pages/LibraryPage.tsx`, then
`git diff --stat HEAD -- frontend/src/pages/LibraryPage.tsx` → **empty**, and the suite back to
**12 passed**.

## ⚠ The gate knobs: this suite is in NEITHER, and the gate cannot see any of this plan's work

Derived by grepping the gate itself, not by eye:

| Path | in `TARGETS` (runs)? | in `BASELINE` (guarded)? |
|---|---|---|
| `src/pages/__tests__/LibraryPage.test.tsx` | ❌ **no** | ❌ **no** |
| `src/components/library/` (the three new tab bodies) | ❌ **no** | ❌ **no** |

`grep -c "LibraryPage.test" scripts/vitest-count-gate.cjs` → **0**. The script says so about itself
at `:3643`: *"`src/pages/__tests__/` is reached by NOTHING AT ALL"*, and `src/components` is reached
only via `workflows | panel | settings | files | chat | metadata | admin`. **`scripts/vitest-count-gate.cjs`
was deliberately NOT edited** — it is outside `files_modified`, it is a hot shared file, and
**plan 12 owns the pins**. The number plan 12 needs: **`src/pages/__tests__/LibraryPage.test.tsx` — 12
cases**, needing BOTH knobs (a `TARGETS` entry and a `BASELINE` pin).

**The gate was run anyway, to prove no collateral damage:**

```
  total                                      5746    6480    +734
  total 6480  ·  failed 0  ·  pinned total 5746
count gate OK — 139/139 pinned files present, no per-file decrease, 0 failing.
```

Identical to the baseline inherited from waves 1-3. It moved by nothing, which is exactly what a
blind spot looks like.

## G-5 statement — `frontend/src/pages/LibraryPage.tsx` (D-217-01)

Triple **re-derived in this worktree** with `--follow` (the rename hides the history otherwise —
217-04's warning holds):

```
git log --follow --oneline    → 28 commits
phase buckets                 → 03 08 29 47 111.1 112 114 153 165 217   (260328/260405 are dated
                                 quick tasks and are subtracted)        = 10 phases
wc -l                         → 724
```

**28 / 10 / 724 — G-5 ⚠ FIRES.**

⭐ **THE NAMED SEAM IS TAKEN.** The ledger's cell for this file says the seam is *still OWED* and
that *217-09 takes it*. Verbatim, the seam is:

> *"the sidebar, the filter bar and the grid are three independent concerns in one component. **With
> a tab shell arriving, extract the shell first and let each tab own its body — otherwise the tab
> bar becomes the tenth conditional branch.**"*

Discharged as written: three tab bodies live in `frontend/src/components/library/`, the sidebar is
its own element hoisted out of the tab bodies, the list surface is one shared factory, and **the tab
bar added zero conditional branches to the render tree** — it added a `<Tabs>` with four
`<TabsContent>` children, each of which delegates.

⚠ **OWED — the same-commit ledger sync could not be honoured, and that is a decision, not an
oversight.** `CLAUDE.md` and `docs/HOT-FILE-LEDGER.md` are outside this plan's `files_modified`, and
a parallel agent editing `CLAUDE.md` from a worktree is the shared-file collision worktrees do not
protect against. **Plan 12 should write this row:**

> `| frontend/src/pages/LibraryPage.tsx | 28 / 10 / 724 | ⚠ FIRES | ✅ the named seam is TAKEN (217-09) — the shell extracted, three tab bodies own their own content, the tab bar added ZERO branches. Re-derive with git log --follow |`

…and the matching detail section, in the same commit as the row.

## Deviations from Plan

**1. [Sequencing] Task 2 was committed BEFORE task 1.**
- **Found during:** planning the commits. Task 1's shell IMPORTS the three tab bodies task 2
  creates, so a task-1-first commit could not typecheck at its own acceptance gate.
- **Resolution:** the bodies landed first (`3930ca94f`), then the shell (`4f435c751`). No content
  change; commit order only. Each commit typechecks on its own.

**2. [Rule 3 — Blocking] The wrapper reducer.** Full derivation above. `librarySelection.ts` is
untouched; `git status` never showed it modified.

**3. [Design necessity] The shedding rule was hoisted to a module constant.** Full reasoning above.
The class literal is byte-identical; only its indentation moved. Recorded because the plan asked for
the LINE, and a line includes its indentation.

**4. [Rule 1 — the test measured the mock, not the band] The LIB-02 re-target assertion.**
- **Found during:** task 3's first run. `Unable to find role="button" and name "Upload to Research"`.
- **Issue:** `@/lib/supabase` is mocked with `session: null`, so `useAuth` yields **no user** and
  `canUploadToFolder` (`selectedFolder.user_id === user?.id`) is **false for every folder**. The band
  correctly renders its READ-ONLY arm, whose accessible name is `Read-only folder Research`.
- **Fix:** the assertion accepts either arm via an **anchored** pattern
  `/^(Upload to|Read-only folder) Research$/` (anchored so it cannot also match the sidebar's own
  `Research` row) and then asserts the band's text names the folder. **That is the LIB-02 property** —
  the band names its target — and it now holds on both arms rather than only the writable one. It
  also incidentally exercises plan 07's decision to render the refusal IN the band rather than in a
  `title` a blocked user would never hover.
- **Commit:** `cec4880df`.

**5. [Judgement, stated] The Views tab body mounts the FULL document surface, not just the picker.**
The plan describes `ViewsTab` as the picker, and it is — the component owns nothing else. But the
Views TAB (the page's `TabsContent`) also mounts the shared list surface, because `SELECT_VIEW` and
`EDIT_VIEW` both land on the `views` arm: a Views tab carrying only a picker would have shown the
user the view they selected and **not what it matched**, and would have stranded the shipped
*"Edit filter"* action with no `FilterBar` to open into. Stated rather than left implicit.

**6. [Scope] Neither `scripts/vitest-count-gate.cjs`, `CLAUDE.md` nor `docs/HOT-FILE-LEDGER.md` was
edited.** Both obligations are named above with the exact text plan 12 needs.

No package was installed. No file outside `files_modified` was touched
(`git status --short` clean after each commit). `git diff --diff-filter=D` across all three commits
is **empty** — no deletions.

## Verification

| Check | Result |
|---|---|
| `vitest run src/pages/__tests__/LibraryPage.test.tsx --maxWorkers=2` | ✅ **12 passed / 12** (was 6) |
| adjacent suites (renameFence · librarySelection · IngestionStrip · acceptFormats · tabsContrast · useDocuments) | ✅ **105 passed / 105** |
| `npx tsc --noEmit -p tsconfig.app.json` | ✅ **33** — identical to the re-derived base; **0 new** |
| `node scripts/vitest-count-gate.cjs` (cap 2) | ✅ `count gate OK` — 139/139, total **6480**, pinned **5746**, **failed 0** |
| `node .planning/sketches/218-the-library-and-its-tabs/drive.cjs` | ✅ **199 passed · 0 failed · 199 assertions** |
| `git status --short frontend/src/components/settings/ReembedStatusCard.tsx` | ✅ **empty** — composed unchanged (D-217-16) |
| `grep -n "%\|ETA\|remaining" IngestionTab.tsx` | ✅ nothing (exit 1) — D-217-19 |
| `grep -n "useState\|useReducer" ViewsTab.tsx` | ✅ nothing — it owns no state |
| plant A / plant B RED, then restored | ✅ both driven; `git diff --stat HEAD` empty after each |
| `GSD_VITEST_MAX_WORKERS=2` | honoured on every run; **the cap was never adjusted and nothing red appeared that was not planted** |

⚠ **Note on the sketch drive:** plan 08 recorded `196 passed · 2 failed` (`D2`/`D3`, plan 07's
fences). At this plan's base they read **199 passed · 0 failed · 199 assertions** — someone repaired
them between wave 3 and wave 4. `drive.cjs` is byte-unchanged by this plan.

## Known Stubs

**None.** Every branch in the three new components is driven by a real value:

- `ViewsTab` renders the shipped `ViewsGroup`, whose empty arm is the shipped one.
- `IngestionTab` derives its aggregate and its queue from the documents the page already holds; the
  two empty arms say what they mean (*"Nothing is being read right now."* / *"Nothing needs
  attention."*) rather than rendering an empty list.
- `IndexingTab`'s unknown arm is explicit (`"Not known yet"`) and is reached when the server has not
  answered — it is **never** a zero and never a green tick. A failed read says so in its own line.

## Manual rows that stay OWED (G-4)

Unchanged by this plan's 12 cases, and named rather than left silent:

- **G4-1** — start an upload without hunting. jsdom proves the band is on tab 1; only an eye proves
  it is the first thing found.
- **G4-6** — view then folder, **no disagreement even for one frame**. jsdom cannot see a frame; the
  suite proves the settled state on both sides of the transition and nothing about the interval.
- **G4-9 / M-2** — side by side with the sketch's `index.html`, **driven BY LOOKING**. In particular:
  the sketch draws the Indexing tab as a two-card grid with a folder table; this plan ships the
  shipped re-embed card plus two facts. That is a deliberate narrowing to what is real (a folder
  table would need per-folder vector counts nothing computes today) and it has not been seen.
- **NEW, from this plan:** the sidebar is hidden on the Ingestion and Indexing tabs. That reads as
  correct on paper and has not been seen; a person may expect the folder tree to persist.

## Threat Model Verification

| Threat ID | Disposition | How it is discharged |
|---|---|---|
| T-217-32 | mitigate | The reducer parameterises; it never authorizes. Every list is still resolved by the shipped owner-scoped `resolveView` / `resolveAdHoc` / `GET /documents`. No client-side filtering was added. |
| T-217-33 | mitigate | Made unrepresentable by the union AND asserted through the DOM from both mounts, with a non-vacuity control row and **two** driven RED plants (one of which proved the case reads both mounts rather than one twice). |
| T-217-34 | accept | `getReembedProgress` is the shipped owner-scoped endpoint Settings already calls. `IndexingTab` adds no new data path and no new endpoint. |
| T-217-35 | mitigate | The class literal is byte-identical and asserted by grep AND by sketch fence `A2`. It was hoisted to ONE named constant with the cross-file dependency on `DocumentList.tsx`'s column order written into the comment — two copies would have been the real tampering risk. |
| T-217-36 | mitigate | `ViewsTab` adds NO eager count pass; `ViewsGroup`'s lazy cached `resolveView(id,{count_only:true})` is untouched. `IngestionTab` fetches nothing at all. `IndexingTab` makes exactly ONE request at mount and delegates polling to the card. |
| T-217-SC | mitigate | No package installed by this plan. |

**No new threat surface:** no network endpoint, no auth path, no file access, no schema change. No
user-authored string is rendered as anything but text.

## Threat Flags

None.

## Self-Check: PASSED

- `frontend/src/components/library/ViewsTab.tsx` — FOUND
- `frontend/src/components/library/IngestionTab.tsx` — FOUND
- `frontend/src/components/library/IndexingTab.tsx` — FOUND
- `frontend/src/pages/LibraryPage.tsx` — FOUND
- `frontend/src/pages/__tests__/LibraryPage.test.tsx` — FOUND
- commit `3930ca94f` — FOUND
- commit `4f435c751` — FOUND
- commit `cec4880df` — FOUND
