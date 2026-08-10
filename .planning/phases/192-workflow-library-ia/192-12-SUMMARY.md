---
phase: 192-workflow-library-ia
plan: 12
subsystem: workflow-library-frontend
tags: [frontend, fences, count-gate, measurement, G-5, D-01, D-07, D-08, D-14, T-192-06, T-192-30, T-192-31, T-192-32, F1, F2, F3, F4, F5]

# Dependency graph
requires:
  - phase: 192-05
    provides: "F1 / F4 / F5 / TG as written before four of the seven modules existed — the fences this plan proves fire"
  - phase: 192-11
    provides: "F2 / F3 in `WorkflowsPage.test.tsx`, and the measured D-07 finding this plan had to decide"
  - phase: 192-01
    provides: "the count gate's four adopted suites, and the two-knob rule this plan did NOT have to re-apply"
  - phase: 192-10
    provides: "the composed page whose one-direction edge is asserted here"
provides:
  - "six fences proved to fire against real plants in production source, all files restored md5-identical"
  - "the OD block — the one-direction cut asserted with its no-shim clause"
  - "the MEASURED subtree delta, against a VALIDATED classifier, contradicting RESEARCH's estimate"
  - "every suite this phase created or grew, pinned from a read number"
  - "the CLAUDE.md hot-file ledger row for WorkflowsPage.tsx, G-5 satisfied"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "a line classifier VALIDATED against a prior phase's published known-good before any new number is trusted"
    - "a self-referential measurement resolved to a fixed point: measure → write → re-measure → correct digits only"
    - "an import/element-shaped detector where a raw substring check reds on the prose that documents the rule"
    - "a deferral recorded as a mechanical pin with a positive control, rather than as prose"

key-files:
  created: []
  modified:
    - frontend/src/components/workflows/library/librarySubtree.fences.test.ts
    - frontend/src/components/workflows/library/WorkflowCard.tsx
    - scripts/vitest-count-gate.cjs
    - CLAUDE.md

key-decisions:
  - "D-07's search highlight is DEFERRED, not owed as small wiring — because wiring it reds F1 BY CONSTRUCTION (HighlightTitle's prop is spelled `title`), measured with a real plant rather than reasoned"
  - "The `librarySubtree.fences.test.ts:355` prose claiming '192 IMPORTS it' is CORRECTED — a guard that only passes by making a comment lie is a broken guard"
  - "RESEARCH assumption A2 (+5%…+16%) is FALSIFIED at +126.2% and stated plainly, with both reasons it missed named"
  - "The four pre-existing drifted pins (+24 cases) are RECORDED as owed, never absorbed into a commit that did not cause them"
  - "Task 3's operator-facing copy was corrected before the checkpoint — it claimed a highlight that does not exist"

requirements-completed: []

# Metrics
duration: ~1h35m
completed: 2026-08-11
---

# Phase 192 Plan 12: The Phase-Close Record — Summary

**⚠ THIS PLAN IS INCOMPLETE BY DESIGN. Tasks 1 and 2 are executed and committed; Task 3 — the
eleven-row G-4 operator UAT — is a `checkpoint:human-verify` with `gate="blocking"` and is
OUTSTANDING. It was not attempted and was not self-approved.**

Every fence this phase wrote is now proved to fire against a real defect in production source, the
restructure's real cost is measured against a validated classifier and is **eight times** the
estimate, every suite the phase created or grew is pinned from a number read out of the gate, and
G-5 on `WorkflowsPage.tsx` is recorded as satisfied with commands a later reader can re-run. The
one decision the wave briefed as open — D-07's unshipped search highlight — is decided, and the
reason is a structural conflict that was **measured with a plant, not argued**.

## Performance

- **Duration:** ~1 h 35 · **Tasks:** 2 of 3 · **Commits:** 2 (plus this SUMMARY)
- **Files:** 0 created, **4 modified** · `git diff --diff-filter=D 23ebf229..HEAD` → **empty**

| Commit | Task |
|---|---|
| `e2cff33e` | Task 1 — six fences driven RED against real plants; the OD one-direction block; the D-07 correction |
| `4ca5acf6` | Task 2 — the measured delta, eight pins, the CLAUDE.md ledger row |

## THE PLANTS — nine, all in production source, all restored md5-identical

md5s captured BEFORE the first plant and re-verified after the last. **All five match.**

| File | before | after |
|---|---|---|
| `library/WorkflowCard.tsx` | `3fe7cb9cb3efbb53213b7084c29011fe` | **identical** |
| `library/LibraryToolbar.tsx` | `1347222a8cccac53be58e57d6023a0ab` | **identical** |
| `library/RunModal.tsx` | `81ded820887424fb8c8cd3de3e149522` | **identical** |
| `lib/threadGroups.tsx` | `ad16353449d7e06316112c4c628c91ce` | **identical** |
| `pages/WorkflowsPage.tsx` | `09f46b840c9fbe5fc217e37ef4c9202a` | **identical** |

Every restore was `git checkout -- <one file>` — never a blanket reset, never `git clean`.

| # | Fence | Plant (real defect, production source) | Observed failure |
|---|---|---|---|
| 1 | **F1** | `title="x"` on the `draft-open` button, `WorkflowCard.tsx` | `expected [ 'data-testid', 'data-card', …(72) ] to not include 'title'` |
| 2 | **F1** (D-07 probe) | `<HighlightTitle title={row.name} query="" />` + its import, `WorkflowCard.tsx` | `…(73) ] to not include 'title'` — **the decisive measurement, see below** |
| 3 | **F2** | `<span>GET /workflows/published</span>` in the toolbar's chip row | `expected [ 'GET /workflows/published' ] to deeply equal []` |
| 4 | **F3** | a `Publish…` button on the draft branch, `WorkflowCard.tsx` | `expected [ 'Publish…' ] to deeply equal []` — **face case only; the MENU case stayed green** |
| 5 | **F4** | `import { WorkflowsPage } from "@/pages/WorkflowsPage"` in `RunModal.tsx` | `not to match /from\s+["'][^"']*WorkflowsPage(\.[jt]…/` |
| 6 | **F4** | the same, suffixed `…/WorkflowsPage.tsx` | same regex — **the `(\.[jt]sx?)?` group earning its place** |
| 7 | **F4** | `const m = await import("@/pages/WorkflowsPage")` | `not to match /import\s*\(\s*["'][^"']*WorkflowsPage…/` — **the OTHER regex** |
| 8 | **F5** | `placeholder="Search by meaning…"` **in the toolbar**, not the vocabulary module | `expected [ './LibraryToolbar.tsx' ] to deeply equal []` |
| 9 | **TG** | one added char, then a SAME-LENGTH edit, `lib/threadGroups.tsx` | length `7145 ≠ 7144`; then digest `'3c92b0680a3897ea' ≠ '4723f9885190e84a'` |

**Three of these are worth keeping, because they show the fences are not redundant with each other:**

- **Plant 4 reddened F3's FACE case and left the MENU case green** — independently reproducing
  `192-11`'s plant-9/plant-10 finding. An absence proved only on the face is satisfied by a control
  that merely moved behind the `⋯`.
- **Plant 8 named `./LibraryToolbar.tsx`**, which is PATTERNS correction C-3 discharged
  mechanically: a fence scoped to `libraryVocabulary.ts` alone would have been evaded by exactly
  this plant, and the subtree-wide scope is why it was not.
- **Plant 9 was run twice on purpose.** The first (a longer file) reds the LENGTH pin and proves
  nothing about the digest. The same-length edit is what proves the digest half, and it is the one
  that closes 158-B's re-open trigger #3 as a fact.

### ⚠ F4's plant TYPECHECKS AND LINTS CLEAN — measured, and one correction to the plan

| Gate, on the PLANTED tree | Result |
|---|---|
| `npx tsc -p tsconfig.app.json --noEmit \| grep -c "error TS"` | **33** — the recorded baseline, unmoved |
| `npx eslint src/components/workflows/library` | **0** |

That is the entire justification for F4 existing, and it now rests on a measurement.

**⚠ THE PLAN'S LITERAL PLANT DOES NOT SATISFY ITS OWN CLAIM, and the correction is stated rather
than smoothed.** A BARE `import { WorkflowsPage } …` reads **34**, not 33 — `TS6133: 'WorkflowsPage'
is declared but its value is never read`, because `noUnusedLocals` is on (the same trap `192-11`
recorded as its deviation 6). So the plant was made *realistic* rather than merely present: the
symbol is USED at module scope (`data-library-page={typeof WorkflowsPage === "function"}`), which is
also the only shape that builds a REAL runtime cycle — an unused import is erased. With the value
used, the tree reads 33 and lints 0, and F4 still reds. **An unused-import plant would have proved
the weaker claim.**

## ⚠ THE DECISION THE WAVE ASKED FOR: D-07's HIGHLIGHT IS **DEFERRED**, AND THE REASON IS MEASURED

`192-11` handed forward that D-07's highlight is unshipped, and named the wiring as small:
*"`WorkflowCard.tsx` renders `<HighlightTitle title={row.name} query={query} />`"*. **Both files were
in this plan's scope, so the wiring was attempted — and it is NOT small. It reds F1 by
construction.**

- `HighlightTitle`'s signature is `({ title, query })` (`threadGroups.tsx:137`). Rendering it inside
  the swept subtree spells a **JSX attribute named `title`**.
- F1 walks JSX attribute NAMES. **Planted and observed:** F1 failed with
  `expected [ 'data-testid', 'data-card', …(73) ] to not include 'title'` — the identical failure the
  deliberate `title="x"` plant produces.
- **F1's existing SCOPING CONTROL does not cover it.** That control is about an object PROPERTY
  (`{ title: "…" }`), a different node kind. This was checked, not assumed.

**So the two rules collide, and neither is wrong.** F1 is D-14 ("touch has no hover") and is
deliberately blunt; `HighlightTitle` merely happens to spell its prop with the forbidden word.
Wiring the highlight therefore requires **F1 to become element-aware** — a DOM tooltip on an
intrinsic element versus a React prop on a capitalised component. That is a change to the very
fence this plan exists to prove fires, in the closing plan of the phase, adding a user-facing
capability: precisely the shape G-7 forbids.

**Recorded, not left implicit:**

1. **`librarySubtree.fences.test.ts`'s prose is CORRECTED in two places.** The claim *"192 IMPORTS it
   and edits nothing"* was half false and never true. The byte-identity half stands; the import half
   is removed and the correction is stated inline with the measurement behind it.
2. **A new case pins the gap mechanically** — `subtreeSource` contains no `HighlightTitle` import and
   no `<HighlightTitle` element, `threadGroupsSource` contains `HighlightTitle({ title, query }`,
   `FORBIDDEN_ATTRIBUTE === "title"`, and a **positive control** runs F1's own detector over the exact
   wiring `192-11` handed forward and shows it caught. A future author inherits a measurement.
3. **RE-OPEN TRIGGER, concrete:** the next phase that touches `WorkflowCard.tsx` or the library search
   wires the highlight **and** narrows F1 to intrinsic elements **in the same commit**, driving the
   narrowed F1 RED against a real `<button title="…">` plant so the loosening is proved not to have
   blinded it. `WorkflowsPage.test.tsx`'s *"⚠ MEASURED, NOT ASSUMED"* case is what must be INVERTED.
4. **LIB-01 is unaffected.** REQUIREMENTS.md says *"search the Workflows page by name and filter the
   list"* — the highlight is decision D-07, not the requirement.
5. **Task 3's operator copy was corrected before the checkpoint.** The plan's `<what-built>` said the
   search shows *"the hit highlighted"*. It does not, and the operator is not asked to verify it.

### ⚠ A detector was written raw first, and observed RED against this repo's own prose

The gap pin began as `expect(subtreeSource).not.toContain("HighlightTitle")`. It **failed on a clean
tree** — `libraryFilter.ts:182` names the component in a comment (*"highlighting is `HighlightTitle`'s
job"*). That is the 187-24 trap, which this file already documents for F1 and F5, recurring in a
third form. Replaced with import-shaped and element-shaped regexes, each with a positive control and
a scoping control proving the prose form is not caught — plus a **non-vacuity** assertion that the
corpus really does mention it in prose, so the negatives are narrower than a substring check rather
than merely luckier than one.

## The OD block — the cut has ONE DIRECTION, all three clauses driven RED

F4 proves nothing under `library/` reaches UP. It does **not** prove the edge exists or that no shim
preserves the coupling — the `WorkflowCanvas.test.tsx:756-765` gap, closed here.

| Clause | Plant | Observed |
|---|---|---|
| the page IMPORTS each library module | `RunModal` specifier repointed outside the subtree | `to match /from\s+["']@\/components\/…/` |
| the page DECLARES none of the six | `function StarterCard()` re-added to the page | `not to contain 'function StarterCard('` |
| **no re-export shim** | `export { WorkflowCard } from "…/library/WorkflowCard"` | `not to match /export\s+\{[^}]*\}\s+from…/` |

**⚠ One assertion was CORRECTED for being a fence that reds on correct code.** The import clause was
first written without `(\.[jt]sx?)?` and reddened on a legal `…/RunModal.tsx` specifier —
`allowImportingTsExtensions` makes that legal, and it is still a one-direction edge. A fence that
reds on correct code trains its reader to edit the fence. Widened to F4's own idiom ten lines above,
then re-driven RED against the regression it actually guards: the module going unimported.

**The six imported paths are MEASURED, not assumed** (`grep -n "workflows/library"` on the page
returns exactly six). `WorkflowDeleteSheet` is deliberately **not** among them — the page never mounts
the Sheet; the CARD does. Listing it would assert a coupling that does not exist.

## ⚠ THE SUBTREE DELTA — MEASURED, AND **EIGHT TIMES** THE ESTIMATE

**The classifier was validated before any Phase-192 number was trusted.** Re-implementing 188.2's
blank/comment/code classifier, it reproduced 188.2's published known-good — the pre-cut
`PhaseNodeCard.tsx` at `95a4c915` — **exactly: `797 / 518 / 249 / 30`.**

| | total | comment | code | blank |
|---|---|---|---|---|
| **BEFORE** `WorkflowsPage.tsx` (`6bdc4684`) | **1407** | 334 | 1021 | 52 |
| **AFTER** `WorkflowsPage.tsx` | **1007** | 484 | 479 | 44 |
| `library/RunModal.tsx` | 430 | 149 | 271 | 10 |
| `library/LibraryToolbar.tsx` | 358 | 172 | 164 | 22 |
| `library/WorkflowDeleteSheet.tsx` | 296 | 118 | 169 | 9 |
| `library/libraryFilter.ts` | 284 | 162 | 105 | 17 |
| `library/libraryVocabulary.ts` | 162 | 94 | 47 | 21 |
| `library/libraryRow.ts` | 100 | 77 | 20 | 3 |
| `library/WorkflowCard.tsx` | 545 | 267 | 244 | 34 |
| **MODULES ONLY (7)** | **2175** | 1039 | 1020 | 116 |
| **SUBTREE (page + 7)** | **3182** | 1523 | 1499 | 160 |

- **PAGE `1407 → 1007` (−28.4 %)** · CODE `1021 → 479` (**−53.1 %**)
- **SUBTREE `1407 → 3182` (+126.2 %)** · CODE `1021 → 1499` (+46.8 %)

**RESEARCH assumption A2 estimated a ~1480–1630 subtree, +5 % to +16 %. The measured figure is
+126.2 % — roughly EIGHT TIMES the top of that range, and nearly DOUBLE 188.2's +67.1 %.** A2 was
labelled an estimate precisely so the measurement could contradict it without anyone smoothing the
record. **The two reasons it missed, named rather than glossed:**

1. **It predicted the PAGE at 250–400 L. Measured 1007** — a 2.5–4× miss on the single largest row.
   D-01 moved the library view; it never moved the Builder host, the gauntlet mount, the door switch,
   the fork/create handlers or the fetch orchestration, all of which still live there.
2. **It listed FIVE destination modules; SEVEN shipped** (`libraryRow.ts` and `libraryVocabulary.ts`
   appear nowhere in its table), and **every module landed above its own estimate** — RunModal
   ~380→430, the Sheet ~200→296, the Toolbar ~250→358, the filter ~150→284, and this card ~250→**545**.

**WHERE the growth went, so the number is attributable rather than merely admitted: COMMENT is the
dominant term, `334 → 1523` (+355.9 %) — 1039 of the 2175 new module lines, 48 %, are prose.** CODE
grew +46.8 %, against a subtree that replaced three card components with one *and* added a filter
engine, a vocabulary module, six counted chips and a merge that did not exist before. Same shape as
188.2's finding that prose was 65 % of the file it cut.

**⚠ THE MEASUREMENT IS SELF-REFERENTIAL AND WAS RESOLVED TO A FIXED POINT, not fudged.** Writing the
figure into `WorkflowCard.tsx`'s docblock changes the figure. It was measured (3149), written,
re-measured (3181), corrected, re-measured again (3182) — and the final pass corrected **only the
digits**, so the line count could not move a fourth time. The docblock and the measurement now agree
exactly. Re-derive: `git show 6bdc4684:frontend/src/pages/WorkflowsPage.tsx | wc -l` → 1407;
`wc -l` on the page and on this directory's seven SOURCE modules (test files excluded, as 188.2
excluded them).

## The pins — eight, every number READ from the gate's `actual` column across two agreeing runs

| file | pinned before | pinned now | delta | note |
|---|---|---|---|---|
| `librarySubtree.fences.test.ts` | — | **64** | new | **not the 47 `192-11` handed forward** — Task 1 added 17 |
| `libraryFilter.test.ts` | — | **36** | new | |
| `LibraryToolbar.test.tsx` | — | **36** | new | |
| `WorkflowCard.test.tsx` | — | **35** | new | |
| `WorkflowsPage.test.tsx` | 22 | **39** | +17 | `192-10` called this "settled at 22" — it was stale |
| `PublishedCardDelete.test.tsx` | 7 | **32** | +25 | **not the 26 in `192-04`'s summary** |
| `RunModal.test.tsx` | 11 | **32** | +21 | **not the 27 in the wave brief** |
| `RunModal.a11y.test.tsx` | 8 | **16** | +8 | |

**Pinned files 56 → 60. Pinned total 2909 → 3151, READ from the gate's own printed `pinned total`.**

- **⚠ No `TARGETS` line was needed for the four new suites, and that is MEASURED rather than assumed.**
  All four live under `src/components/workflows/library/`, already reached by the
  `src/components/workflows` DIRECTORY entry: the gate printed each of them as `— NN new`, and a file
  the gate never runs cannot report a number at all. **A printed `actual` IS the proof that TARGETS
  covers it.** (Contrast `192-01`'s four, which printed nothing until their TARGETS lines landed.)
- **⚠ The `BASELINE_TOTAL` marker was stale a TENTH time, by the smallest margin yet and the most
  instructive:** it read `2910 (192-01)` while the gate printed `pinned total 2909` on an unmodified
  tree — a drift of **one**. `192-01` had written 2910 as an expectation (2887 + 23) and recorded that
  *"an expectation that survives a measurement is still only worth the measurement"*. The measurement
  was 2909. A drift of 1 is invisible to every reader and to every check, which is the argument, not
  a counterexample to it.
- **The four pre-existing drifts are RECORDED as owed, never absorbed** — `ExternalActionSection.test.tsx`
  (25/34, +9) and `PhaseTimeline.test.tsx` (17/21, +4), owed since 190-12; `WorkflowBuilderPage.canvas.test.tsx`
  (128/133, +5) and `builderStore.test.ts` (52/58, +6), first seen at 192-01. **24 cases are deletable
  with the gate green today.** Folding an unrelated drift into a commit that did not cause it is the
  thing the script's own header argues against.
- **⚠ The `failed` line varied and is not smoothed.** Three consecutive gate runs on the SAME tree
  printed `failed 0`, `failed 1`, `failed 0` with **identical per-file count columns on all three**.
  That is D-188.2-DEF-01 recurring; `192-01`'s standing instruction covers it, and the suite it names
  (`WorkflowBuilderPage.session.test.tsx`, the "pane click" case) was re-run standalone here and
  reported **23 passed / 0 failed**. The COUNT columns are the regression backstop; the `failed` line,
  on this machine, is not.

## The CLAUDE.md ledger row — G-5 satisfied, with re-derivable figures

`frontend/src/pages/WorkflowsPage.tsx` goes from **G-5 FIRES — extraction due** to **satisfied
(192 — 2026-08-11)**. Corrections on measurement, in the 188.1/188.2 row shape:

- touch count **21 → 26 commits**, phases **10 → 11** (192 contributed 5 commits across 192-06 /
  192-08 / 192-10) — `git log --oneline -- <file> | wc -l`
- line count **1407 → 1007** — `wc -l`, with `6bdc4684` named as the last pre-192 commit so the
  "before" is re-derivable rather than quoted
- the subtree growth stated **in the same cell as the win**, as 188.2's row does
- the constraints that now bind (F4 in three forms, the OD no-shim clause, F1 with its two INHERITED
  `title=` exceptions named, F5's subtree scope)
- **⚠ what is still unextracted is named rather than implied:** at 1007 L the page still hosts the
  Builder, the gauntlet mount, `WorkflowDoorSwitch`, the post-publish Run CTA banner, the fork/create
  handlers and the three-feed fetch orchestration. Per G-5, a phase adding a SECOND concern here
  produces a refactor recommendation first.

`grep -c "G-5 FIRES" CLAUDE.md` → **1**, and it is `phase_types.py` at `:266`, not this row.

## Deviations from Plan

### 1. [Rule 1 — Bug in the plan's premise] F4's literal plant does not typecheck clean

Covered above. The plan's acceptance criterion required tsc **33** and eslint **0** on the planted
tree; the bare import reads **34** (`TS6133`). The plant was made realistic — the symbol used at
module scope, which is also the only shape that builds a real runtime cycle — and both figures then
hold. **The criterion is met; the plan's stated plant would not have met it.**

### 2. [Rule 1 — Bug] The gap-pin detector reddened on this repo's own prose

Covered above (`libraryFilter.ts:182`). Replaced with import/element-shaped detectors plus positive,
scoping and non-vacuity controls.

### 3. [Rule 1 — Bug] An assertion this plan wrote would have reddened on correct code

The OD import clause, first written without `(\.[jt]sx?)?`. Widened to the house idiom and re-driven
RED against a real regression instead.

### 4. The plan's estimate of what "restore md5-identical" would cost was right; its estimate of the delta was not

Recorded as a finding rather than a complaint: A2's range was labelled an estimate and this plan is
where it was tested. It failed by ~8×, and the record says so in three places (SUMMARY, the card's
docblock, the CLAUDE.md row).

### 5. The worktree came up on a `master` merge commit again

`git merge-base HEAD 23ebf229` returned `3781a3fe`; the startup assertion fired and the worktree was
reset to `23ebf229` before anything was read. **Ten of ten worktrees in this phase.** Both commits
sit directly on `23ebf229`.

---

**Total deviations:** 3 auto-fixed bugs (2 in this plan's own new assertions, 1 in the plan's premise),
2 findings recorded. **Impact on scope:** none. Zero packages installed. No new capability.

## Gates

| Gate | Result |
|---|---|
| `vitest run src/pages src/components/workflows/library` | **663 passed / 0 failed** (22 files), after all restores — up from a 646 baseline |
| `node scripts/vitest-count-gate.cjs` | **exit 0, TWO agreeing runs** — `total 3175 · failed 0 · pinned total 3151`, `60/60 pinned files present`, no per-file decrease |
| every `library/` suite printing `new` | **none** — all four now pinned |
| `tsc -p tsconfig.app.json --noEmit` | **33** at four separate measurements, including on the F4-planted tree |
| `eslint src/components/workflows/library` | **0** · a11y config → **0** |
| `git status --porcelain` after every restore | clean apart from the file under edit |
| five plant-target md5s | **all unchanged** |
| `git diff --diff-filter=D 23ebf229..HEAD` | **empty** |

Every vitest and gate invocation carried `GSD_VITEST_MAX_WORKERS=4`.

## Threat Model Status

| Threat ID | Disposition | Outcome |
|---|---|---|
| T-192-06 | mitigate | **Mitigated.** All five fences plus the hash fence driven RED against nine real plants in production source, every file restored md5-identical, failure messages recorded. F4 additionally proved to typecheck at 33 and lint at 0 on the planted tree — with the plan's own weaker plant corrected. |
| T-192-30 | mitigate | **Mitigated, and the estimate is REFUTED.** Measured with a classifier validated against 188.2's known-good, recorded in the SUMMARY, the card's docblock and the CLAUDE.md row, and stated plainly at +126.2 % against an estimated +5 %…+16 %. |
| T-192-31 | mitigate | **Mitigated.** Eight pins, every number read from the printed `actual` across two agreeing runs; the 188-12 growing-suite exemption expires in this commit; the four unrelated drifts named and left owed. |
| T-192-21 | mitigate | ⛔ **OUTSTANDING** — U4 and U10 are Task 3 rows and Task 3 has not run. F1's SOURCE half is proved (nine plants); the RENDERED half at 200 rows is the operator's. |
| T-192-32 | mitigate | ⛔ **OUTSTANDING** — the UAT record does not exist yet. This SUMMARY records zero rows rather than claiming any. |
| T-192-SC | accept | **Held.** Zero packages installed. |

**Threat flags:** none. No network surface, auth path, file access or schema touched; the only source
change is a docblock.

## Known Stubs

**One, and it is a gap in shipped behaviour rather than in this plan: D-07's search highlight does
not exist** — deferred with the concrete re-open trigger above, pinned mechanically with a positive
control, and removed from the operator-facing checkpoint copy so nobody is asked to verify it.
No other stub.

## ⛔ WHAT IS OUTSTANDING — Task 3, and it is a DECISION, not an omission

**The eleven-row G-4 UAT at 200 workflows has NOT been driven.** It is a `checkpoint:human-verify`
with `gate="blocking"`, it requires a human driving Chrome against a locally running app with ~200
seeded workflows, and in this project the operator drives browser UAT. It was not attempted and was
not self-approved.

**The row to run first is U6** — *"pick a project → what happens to starters is explained, not
silent; SILENCE IS A FAIL"*. It exists because of a measured IA defect, it is the row most likely to
fail, and no structural test can catch it. Its outcome must quote the **exact rendered text**.

**Second is U4**, because it is the row this phase's own correction changed: the `[title]` sweep
**excludes the `workflow-soul` subtree**. The two remaining `title=`s are inherited
(`WorkflowSoul.tsx:99`, `PhaseSpine.tsx:77`), out of scope by D-01, and recorded in CONTEXT.md.
Left unstated, U4 would fail the phase for a defect two prior phases shipped.

⚠ **The checkpoint copy shipped in `192-12-PLAN.md` claims the search shows "the hit highlighted".
It does not.** The corrected wording is in the checkpoint returned to the orchestrator.

**Also owed, inherited and untouched by this plan:** the RED-plant obligation on
`WorkflowDeleteSheet.tsx` (from `192-08`), the nine string re-homes into `libraryVocabulary.ts`
(`192-07`'s four, `192-09`'s five), and the four drifted pins above.

## Requirements

`LIB-01`…`LIB-04` are in this plan's frontmatter and are **deliberately NOT marked complete.** No
`state.*`, `requirements.mark-complete` or `roadmap.update-plan-progress` verb was called;
`.planning/STATE.md`, `.planning/ROADMAP.md` and `.planning/REQUIREMENTS.md` are untouched. **They are
user-observable now, which is exactly what makes an early tick plausible and still premature: the
phase is not verified until the operator's eleven rows are driven, and one half of D-07 is
deliberately unshipped.** Marking them is the orchestrator's job, after Task 3.

## User Setup Required

For Task 3 only: a locally running app (backend + frontend) and ~200 seeded workflows. No external
service configuration, no dependency, no migration, no env var.

## Self-Check: PASSED

- `frontend/src/components/workflows/library/librarySubtree.fences.test.ts` — **FOUND** (64 tests, 0 failures)
- `frontend/src/components/workflows/library/WorkflowCard.tsx` — **FOUND** (545 L)
- `scripts/vitest-count-gate.cjs` — **FOUND** (60/60 pinned, exit 0 twice)
- `CLAUDE.md` — **FOUND** (`WorkflowsPage.tsx` row reads *satisfied (192 — 2026-08-11)*)
- `.planning/phases/192-workflow-library-ia/192-12-SUMMARY.md` — **FOUND**
- Commit `e2cff33e` — **FOUND** in `git log`
- Commit `4ca5acf6` — **FOUND** in `git log`
- `git diff --diff-filter=D 23ebf229..HEAD` — empty
- All five plant-target md5s match their pre-plant values
- `.planning/STATE.md` / `ROADMAP.md` / `REQUIREMENTS.md` — **unmodified**

---
*Phase: 192-workflow-library-ia*
*Completed: Tasks 1–2 on 2026-08-11. **Task 3 OUTSTANDING — blocking operator checkpoint.***
