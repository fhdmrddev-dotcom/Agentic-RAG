---
phase: 192-workflow-library-ia
plan: 07
subsystem: workflow-library-frontend
tags: [frontend, toolbar, presentational, D-02, D-03, D-05, D-06, D-14, D-17, LIB-01, LIB-02, LIB-04]
requires:
  - "library/libraryVocabulary — CHIP_WORDS / CHIP_ORDER / SEARCH_* / PROJECT_* / CLEAR_FILTERS_LABEL (192-05)"
  - "library/libraryRow — ChipId (192-05)"
  - "library/libraryFilter — UNBOUND, and chipCounts as the counts prop's producer (192-05)"
  - "components/ui/input — shipped, no new dependency"
provides:
  - "library/LibraryToolbar.tsx — create · always-on search · six counted chips · updating marker · project select + D-17 note · clear-all"
  - "LibraryToolbarProps — the flat, total prop contract 192-10 composes against"
  - "library/LibraryToolbar.test.tsx — DOM-order, count-honesty, D-17-text, a11y and absence coverage"
affects:
  - "192-10 the page composition (mounts this toolbar and feeds it chipCounts)"
  - "192-11 the page-level DOM-order assertion (addresses data-testid=\"library-create\")"
  - "192-12 the pinning sweep (this suite is discovered and RUN but NOT pinned)"
tech-stack:
  added: []
  patterns:
    - "presentational leaf with a flat total prop contract (GovernanceSection.tsx precedent)"
    - "aria-pressed toggle contract (WorkflowsPage.tsx FilterItem, re-homed)"
    - "native <select> + note-line beneath it (DescribeKbPicker.tsx:169-191)"
    - "aria-describedby round trip resolved through document.getElementById (GovernanceSection.test.tsx:109-118)"
    - "hidden machine-readable data-state marker (DescribeKbPicker.tsx:162-164)"
    - "absence assertion paired with a self-planted positive control (the Phase 187 lesson)"
key-files:
  created:
    - frontend/src/components/workflows/library/LibraryToolbar.tsx
    - frontend/src/components/workflows/library/LibraryToolbar.test.tsx
  modified: []
decisions:
  - "UNBOUND is IMPORTED from libraryFilter, not re-declared — 192-05 already re-homed it out of the page, so the subtree has exactly one home to reach for"
  - "The D-17 note renders under the UNBOUND sentinel too, not only under a real folder — starters are held out either way, so silence there would be the same defect"
  - "Four strings are declared module-privately in the toolbar rather than in libraryVocabulary.ts, because this plan's own git-diff gate admits exactly two files; the re-home is OWED"
  - "The forbidden tooltip attribute and the forbidden package are deliberately NOT spelled in this file's prose, so their own zero-greps stay truthful"
metrics:
  duration: ~65 min
  completed: 2026-08-11
  tasks: 3
  commits: 3
---

# Phase 192 Plan 07: The Library Toolbar Summary

The persistent toolbar 157-B replaces three shelves with now exists: **create leads**, then an
always-on search field, then six independently-toggled chips each showing a count it did not
compute, then a quiet machine-readable in-flight marker, then the one project select with the
honest line D-17 requires, then the way out of an over-filtered list. It fetches nothing and
owns no list state, and every headline claim it makes was driven RED against a real plant.

## What shipped

**Task 1 — the shell: create, search, chips** (`2dd9b748`).

D-02's fix for SC#4 is **structural, not a promotion**. The create affordance is today the
first cell of the *third* grid (`WorkflowsPage.tsx:613`, re-measured at this commit — the line
number is unmoved). Moving it up one shelf would leave it a grid cell that can drift again;
leading a persistent toolbar is a property of the composition. So the assertion is the
document's, not the source's: `compareDocumentPosition` says create precedes the search field,
the chip row and the project select — **and, the stronger claim, that create is index 0 of
EVERY focusable node inside the toolbar**, so "first" cannot be satisfied by a control that
merely precedes the three things the test happened to name.

Search renders unconditionally. There is no toggle, no disclosure, no collapsed state — the
suite asserts `[aria-expanded]` and `[aria-controls]` are both **absent from the whole
toolbar**, which is the machine-readable form of the operator's recorded reasoning (*"a control
you always open should always be open"*). D-08's honest one-liner ships as real DOM text wired
by `aria-describedby`, so the promise reaches a screen reader rather than sitting in a caption.

Six chips render in `FilterItem`'s shipped `aria-pressed` contract, typed through `ChipId`
(a seventh chip is a typecheck error). **Five carry no mark at all** and the sixth reads its
mark from `TIERS.STRICT.glyph` through the vocabulary module, so `grep -c "🔒"` on the file is
**0** and the chip is provably the same mark as the card's tier atom.

**Task 2 — the project select, D-17's note, the marker, clear-all** (`7b86de48`).

A native `<select>` in `DescribeKbPicker`'s shape: "All projects", one option per folder, and
the shipped `UNBOUND` option — **four options, asserted by value in order**. No command-palette
package was added; `grep` for its name on this file is 0.

D-17's sentence renders beneath the select whenever a project is selected, wired to the select
by `aria-describedby`. The marker for an in-flight re-query is a `data-state` span adjacent to
the chip row, present only while `updating` is true.

**Task 3 — the suite** (`9b48dfda`). 36 tests, 0 failures.

## The three RED plants — none of these assertions has ever been vacuous

The plan deferred the real-plant obligation for the four late-arriving modules to `192-12`; it
was performed here for this module anyway, because a fence that has never failed is a fence
nobody has tested. **This does not discharge `192-12`'s obligation** for `WorkflowCard.tsx` and
`WorkflowDeleteSheet.tsx`.

| Plant (real, in production source) | Result | Restore |
|---|---|---|
| **F1** — a tooltip attribute on the create button | **RED**, naming `./LibraryToolbar.tsx paints no hover-only explanation` — 46/47 | md5 `c371c8b9…` → `c371c8b9…` |
| **D-02 drift** — the create block moved below the chip row in the JSX | **RED ×2** — the pairwise order case *and* the index-0 case | `git checkout`, EOL-normalized md5 `06c55141…` → `06c55141…` |
| **D-17 silence** — the note kept as a node but emptied of its text | **RED ×3** — the exact-text case, the UNBOUND case and the describedby round trip | same, md5 restored |

The F1 plant is also the proof `192-05` predicted: `LibraryToolbar.tsx` was one of the four
paths its fence NAMED BEFORE THEY EXISTED, and the fence bound to it the moment the file
appeared, **with no edit to the fence**.

The D-17 plant is the one worth keeping. It emptied the note **without removing it** — the
"blank node" the plan explicitly warned a presence-only check would accept. Three assertions
fired, because all three compare against the imported constant rather than checking for a node.

## Fixtures chosen so a green cannot be accidental

`COUNTS` is deliberately **non-uniform** and contains a **zero**. A fixture where every chip
shows the same number cannot distinguish *"the chip renders its own count"* from *"the chip
renders the first count it was handed"*, and a fixture with no zero cannot exercise the
honest-empty rule at all. `makes-a-file` is 0, still renders, and the test asserts the fixture
really is 0 before trusting what it proves.

## Measured line counts (these feed 192-12's subtree delta)

| Module | Lines |
|---|---|
| `LibraryToolbar.tsx` | **358** |
| `LibraryToolbar.test.tsx` | **365** |
| *this plan's subtotal* | **723** |
| `192-05`'s five modules (unchanged) | 1332 |
| **subtree total after this plan** | **2055** |

The source module is 358 L against the plan's `min_lines: 180`. It is prose-heavy by the
house convention — the docblock carries the four reasons a later reader would otherwise have to
re-derive (why create is first, why counts are props, why two names are not spelled out, why
four strings live here).

## Test counts, and the pin that is OWED not waived

| Suite | Tests | Failures |
|---|---|---|
| `LibraryToolbar.test.tsx` | **36** | 0 |
| `libraryFilter.test.ts` (192-05) | 36 | 0 |
| `librarySubtree.fences.test.ts` (192-05) | 47 | 0 |
| **library/ total** | **119** | **0** |

`LibraryToolbar.test.tsx` is discovered and RUN by the count gate through its existing
`src/components/workflows` directory entry, and prints as `new`. **It is not in `BASELINE`, and
an unpinned suite is an unguarded one.** `192-12` owes the pin, from the gate's own printed
`actual` across two agreeing runs. No `TARGETS` entry was added — the directory entry already
reaches the path, and a `TARGETS` path that does not resolve makes the gate ERROR (exit 2).

## The `UNBOUND` question the plan asked to be recorded

**IMPORTED, not re-declared** — `import { UNBOUND } from "./libraryFilter"`.

The plan's acceptance text offers either ("imported or re-declared identically to
`WorkflowsPage.tsx:67` — record which, and why"). Importing is correct here and re-declaring
would be wrong, because `192-05` **already** re-homed the sentinel into `libraryFilter.ts` with
a byte-identical value precisely so the subtree would never reach back to the page (F4). A
third declaration inside the toolbar would recreate the drift the re-home existed to end.
Re-measured at this commit: `WorkflowsPage.tsx:67` still holds its own `const UNBOUND =
"__unbound__"`, so **two identical declarations exist right now** — a deliberate transient that
`192-10` closes when it rewrites the page and deletes the page's copy in the same commit.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 1 — Bug] Three acceptance greps red on the prose that documents the rule they enforce**

- **Found during:** Task 1 and Task 2, at the grep gates.
- **Issue:** `grep -c "title=" ` returned **1**, `grep -Ec "aria-expanded|useState"` returned
  **1**, and `grep -c "cmdk"` returned **1** — every hit was in my own docblock, explaining why
  the thing is absent. This is `192-05`'s named trap (*"F1 must be PARSED, not grepped —
  `libraryVocabulary.ts` explains the D-14 rule in prose, so a raw grep reds on the file that
  documents the fence"*) in its inverted form, arriving in a file whose plan states the checks
  as **raw greps equal to 0**.
- **Fix:** the prose was re-worded so no forbidden token appears contiguously — the tooltip
  attribute is named without its equals sign, the disclosure attribute is described as
  "expand/collapse state", and the package is referred to as "a command-palette package". The
  meaning is unchanged and each omission is **stated in the docblock with its reason**, so a
  later reader does not read the gap as carelessness. The parsed F1 fence remains the authority
  either way; this only makes the cheap raw check truthful as well, so nobody has to adjudicate
  a red that is really a green.
- **Files modified:** `LibraryToolbar.tsx` · **Commits:** `2dd9b748`, `7b86de48`

### Design decisions the plan left to execution

**2. Four strings are declared module-privately here rather than in `libraryVocabulary.ts`.**
The house rule is one vocabulary home and `192-05`'s summary states it explicitly. But this
plan's `files_modified` names exactly two files and its own verification gate is
`git diff --name-only` **listing only those two** — the vocabulary module is not one of them.
The four words `192-05` did not ship (`CREATE_LABEL`, `CREATE_SUBLABEL`, `PROJECT_ALL_LABEL`,
`UPDATING_LABEL`) therefore sit in one clearly-marked block with the boundary explained, and
their re-home is **OWED**. They are **not** outside the honesty guarantee while they wait:
`LibraryToolbar.tsx` is one of the seven paths F5 sweeps BY NAME, so an overstating word would
red here exactly as it would in the vocabulary module — which the F1 plant demonstrated
empirically rather than argued.

**3. The D-17 note renders under the `UNBOUND` sentinel too, not only under a real folder.**
The plan says "whenever a specific project is selected". Measured in
`libraryFilter.matchesProject:218-219`, a starter returns `true` for **every** non-null
selection including `UNBOUND` — so under "Unbound (no project)" starters also stay on screen,
and silence there is the same defect for the same reason. Asserted as its own case.

**4. Both `aria-describedby` wirings are asserted as ROUND TRIPS, and both carry a control for
the un-described state.** An attribute-presence check passes on a dangling id, so each is
resolved through `document.getElementById` and compared to the imported constant; and the
project select is asserted to carry **no** `aria-describedby` under "All projects", without
which the round trip could pass on a component that always describes.

### Known limit, stated rather than discovered later

**5. A DOM-order assertion cannot see a CSS re-ordering.** While preparing the D-02 plant I
first tried `flex-direction: row-reverse` on the toolbar, and it would have left every
`compareDocumentPosition` assertion **green** while visually putting create last. The plant was
replaced with a real JSX reorder, which is the drift D-02 actually guards against. What the
suite proves is therefore precise and worth stating plainly: **create leads in the order tab
focus and screen readers follow**. The visual half belongs to UAT rows U2/U7 and to `192-11`'s
page-level check — it is not claimed here.

## Corrected inherited claims

**6. `192-05-SUMMARY.md`'s "what the next plans inherit" maps the plan numbers wrongly.** It
reads *"192-06 RunModal move · **192-07 delete-Sheet move** · 192-08 WorkflowCard · **192-09
LibraryToolbar**"*. Measured from the plan files at this commit: `192-07` is the **LibraryToolbar**
(this plan), `192-08` is `WorkflowDeleteSheet.tsx`, `192-09` is `WorkflowCard.tsx`. The same
summary's `affects:` frontmatter carries the same off-by-one. It matters because `192-12`'s
owed obligations are addressed to plan numbers; the modules named are all correct, only the
plan they are attributed to is not.

**7. The worktree came up at `fda79214` again** — a `master` merge commit — rather than the
dispatched base `d5a601cd`. The startup assertion fired and reset. This is now the pattern the
dispatch brief predicted rather than an anomaly; all three commits sit directly on `d5a601cd`.

## Gates

| Gate | Result |
|---|---|
| `vitest run src/components/workflows/library/` | **119 passed / 0 failed** (`GSD_VITEST_MAX_WORKERS=4 --maxWorkers=4`) |
| `tsc -p tsconfig.app.json --noEmit` | **33** — the measured baseline, unmoved (measured at 33 *before* writing a line, too) |
| `eslint src/components/workflows/library` | **0** |
| `eslint src/components/workflows/library -c eslint.a11y.config.js` | **0** |
| `node scripts/vitest-count-gate.cjs` | **exit 0**, twice — `total 3096 · failed 0` on **both** runs |
| `git diff --name-only d5a601cd..HEAD` | exactly the two files under `library/` |

The two gate runs **agreed exactly**, which is what CLAUDE.md's cap predicts at *two* concurrent
agents (`192-05` measured it non-deterministic at three: `failed 6 → 0 → 1 → 3`). This wave ran
two agents and the cap held.

**Movements in the gate table that are NOT this plan's**, logged so a later reader does not
attribute them here — `git diff --name-only` above shows this plan touched two files and none of
these: `PhaseTimeline.test.tsx` 17 → 21 (+4, already logged by `192-05`), `RunModal.test.tsx`
11 → 27 (+16), `RunModal.a11y.test.tsx` 8 → 16 (+8), `PublishedCardDelete.test.tsx` 7 → 26
(+19). All four are present in the dispatched base from waves 1–2.

## Threat Model Status

| Threat ID | Disposition | Outcome |
|---|---|---|
| T-192-14 | mitigate | **Mitigated and proved.** Every search string is imported from `libraryVocabulary`; F5 sweeps this file by name, and the F1 plant proved empirically that the pre-named path list binds to this module the instant it exists. |
| T-192-19 | mitigate | **Mitigated and proved.** The component computes no count — `counts` is a prop, and the suite asserts every chip still shows its correct number *while* `updating` is true, so counts are never zeroed to signal motion. The `data-state` marker makes "these counts describe stale rows" machine-checkable, and its absence when settled is asserted as its own case. |
| T-192-20 | accept | **Held.** Options come from the `folders` prop, already supplied and already rendered by the shipped rail. No new data reaches the client. |
| T-192-21 | mitigate | **Mitigated and proved, both halves.** Zero tooltip attributes in the rendered DOM — swept over the FULLEST toolbar state (query + chip + project + updating), with a positive control planting one so the selector is proved able to find it; and F1 driven RED against a real plant in this file. |
| T-192-SC | accept | **Held.** Zero packages installed. No command-palette dependency; its raw count in this file is 0. |

**Threat flags:** none. No network surface, no auth path, no file access, no schema change — one
presentational component and its suite.

## Known Stubs

None. Every prop is wired to real behaviour and asserted, including the two the page has not
composed yet (`updating`, `onClearAll`), which are exercised in both states by the suite.

## What the next plans inherit

- **`192-10`** — mount as `<LibraryToolbar {...} />`. `counts` MUST come from
  `libraryFilter.chipCounts(rows, query, projectId)` over the rows actually rendered; the
  toolbar computes none and a second copy of the predicates is the drift D-03 forbids. **The
  merge trap still applies to you, not to me:** compose the three feeds with `allSettled`, since
  `/drafts` is gated while `/published` and `/starters` are the RUN CARVE-OUT. Import `UNBOUND`
  from `libraryFilter` and delete `WorkflowsPage.tsx:67`'s copy in the same commit.
- **`192-11`** — the create control is addressable as `data-testid="library-create"`; the chips
  as `library-chip-{id}` with counts at `library-chip-count-{id}`; the note as
  `library-project-note`; the marker as `library-updating`.
- **`192-12`** — pin `LibraryToolbar.test.tsx` at the gate's own printed `actual` across two
  agreeing runs (it read **36** on both of this plan's runs — do not pin from this figure, pin
  from the gate). Its RED-plant obligation for this module is **partly discharged above** (F1 on
  a real plant here); `WorkflowCard.tsx` and `WorkflowDeleteSheet.tsx` remain entirely owed.
- **Whoever re-homes the four strings** — `CREATE_LABEL`, `CREATE_SUBLABEL`,
  `PROJECT_ALL_LABEL`, `UPDATING_LABEL` into `libraryVocabulary.ts`, deleting the block here in
  the same commit.

## Requirements

`LIB-01`, `LIB-02` and `LIB-04` sit in this plan's frontmatter and **none becomes
user-observable here** — this plan ships a component, not a surface; nothing mounts it until
`192-10`. They were deliberately **not** marked complete: no `state.*`,
`requirements.mark-complete` or `roadmap.update-plan-progress` verb was called, and `STATE.md` /
`ROADMAP.md` are untouched (verified by `git diff --name-only`, which lists two files).

## Self-Check: PASSED

- `frontend/src/components/workflows/library/LibraryToolbar.tsx` — FOUND (358 L · 0 tooltip attrs · 0 `🔒` literals · 0 command-palette refs)
- `frontend/src/components/workflows/library/LibraryToolbar.test.tsx` — FOUND (365 L · 36 tests · 0 failures)
- Commit `2dd9b748` — FOUND
- Commit `7b86de48` — FOUND
- Commit `9b48dfda` — FOUND
- `git diff --name-only d5a601cd..HEAD` — exactly the two files above
- `STATE.md` / `ROADMAP.md` — unmodified
