---
phase: 235-the-source-says-what-it-did
plan: 03
subsystem: testing
tags: [vitest, testing-library, sketch-contract, composition-fence, react, jsdom, raw-import]

# Dependency graph
requires:
  - phase: 233-the-preview-see-it-before-it-lands
    provides: "sketch 233 (`index.html` + `drive.cjs`) — the operator-approved variant-B surface this plan makes machine-readable"
  - phase: 217.1-the-library-exactly-as-sketched
    provides: "`sketchComposition.test.tsx` — the shipped precedent for a red-first composition fence, its `hook()` helper, its partial-barrel mock idiom, and its `data-block` prohibition"
  - phase: 234-the-watch-loop-the-library-reads-by-itself
    provides: "`WatchedFoldersSection.tsx` + `lib/api/sources.ts` — the surface the fence measures and the module it mocks separately"
provides:
  - "`drive.cjs --emit-json` — a REGION-SCOPED emitter arm, the first in this sketch to use its own `region()` helper"
  - "`frontend/src/components/sources/__generated__/sourceComposition.json` — 20 distinct block kinds across three regions, 8 named controls, the counts-that-must-hold as data, and all 28 COPY keys with cause sentences parameterised on `{connection}`"
  - "`sourceComposition.test.tsx` — a six-section composition fence, 49 cases, landing RED (37 failed / 12 passed)"
  - "`235-BASELINE.md` — the verbatim red run, every failure mapped to its owning plan"
affects: [235-08, 235-09, 235-10, 235-11, 235-12]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "region-scoped sketch emitter — every count taken through `region()`/`railRegion()`, never a bare `blocks(h)`/`actions(h)`"
    - "generated-contract import: in-package `__generated__/*.json`, never a `?raw` reach into `.planning/sketches/`"
    - "red-first fence with green positive controls, so the red is provably composition and not a broken harness"
    - "COPY parameterisation at EMIT time — the fixture's connection name never reaches the build"

key-files:
  created:
    - frontend/src/components/sources/__generated__/sourceComposition.json
    - frontend/src/components/sources/sourceComposition.test.tsx
    - .planning/phases/235-the-source-says-what-it-did/235-BASELINE.md
  modified:
    - .planning/sketches/233-the-source-says-what-it-did/drive.cjs

key-decisions:
  - "D-235-03A: the fence uses `data-testid`, NOT the BUILD-CONTRACT's `data-block` — the contract's block NAMES bind, its attribute spelling does not (RESEARCH C-9)"
  - "D-235-03B: the `sources` screen is TWO concatenated regions (`instance-statement` + `body-ingestion`), because the instance statement and both tab triggers sit between the rail and the ingestion body and belong to the sources screen"
  - "D-235-03C: the rail needs its own `railRegion()` helper — `region()` walks to the next `data-block=\"body-\"`, which is the wrong edge for a block rendered BEFORE the page head"
  - "D-235-03D: 'Counts that must hold' is emitted as DATA (`counts`), so §5 asserts the sketch's numbers rather than numbers a test author remembered"
  - "D-235-03E: cause sentences are parameterised on `{connection}` at emit time, derived from the fixture rather than hardcoded twice"
  - "D-235-03F: `listSyncRuns` and `getSourceHealth` are declared in the `@/lib/api/sources` mock factory BEFORE they exist, so the mount does not start throwing about a missing export the day plan 10 adds them"

patterns-established:
  - "Scoped emitter arm: `--emit-json` beside `--emit`, taking every count through `region()`; the variable is named `scoped`, never `h`, so a reader greping for the defect does not find it"
  - "Six-section composition fence: non-vacuity floor → positive controls → every block → every control → the counts → source fences over `?raw` live files"
  - "Every `?raw` fence carries its own non-vacuity assertion first — an import that resolved empty satisfies every `not.toContain` while looking green"

requirements-completed: [SURF-02, LIB-10, SURF-03]

# Metrics
duration: 18min
completed: 2026-09-06
---

# Phase 235 Plan 03: The Source Says What It Did — Composition Fence Summary

**A region-scoped `--emit-json` arm, a 20-block in-package contract with all 28 COPY keys, and a six-section fence that lands RED at 37 failed / 12 passed — with §1 and §2 green so the red is provably missing composition, not a broken harness.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-09-06T06:34Z (worktree bootstrap + base reset)
- **Completed:** 2026-09-06T06:52Z (baseline committed)
- **Tasks:** 3
- **Files modified:** 4 (1 modified, 3 created)

## Accomplishments

- **The emitter now scopes.** `drive.cjs --emit-json` takes every count through the file's own
  `region()` helper — the helper `--emit` has ignored since it was written, which is why §2's four
  A-variant per-screen lists in `BUILD-CONTRACT.generated.md` are byte-identical 104-entry artifacts
  including twelve `source-card`s inside a "Health tab" that draws none (RESEARCH C-8). The rail
  needed a second helper (`railRegion()`) because its edge is `</aside>`, not the next `body-` block.
- **The contract is a file the build can import.** 20 distinct block kinds — rail 5 / sources 12 /
  health 3 — 8 named controls, the counts-that-must-hold as data, and all **28** COPY keys (the
  markdown contract's §1 table lists only 18; RESEARCH C-11). Idempotent: two consecutive emits
  produce md5 `595d8356a29f2c742d58838c45de410b` both times.
- **The fixture's connection name never ships.** `cause.token_revoked.says` reads
  *"Access to **{connection}** was withdrawn — …"* in the emitted artifact, parameterised at emit
  time from the fixture's own `SOURCES` array rather than hardcoded a second time.
- **The fence lands RED and its red is READABLE.** 49 cases: **37 failed, 12 passed**, exit 1. The
  first failure message is
  `TestingLibraryElementError: Unable to find an element by: [data-testid="sources-instance-statement"]`
  — the sentence sketch 218's 200 green assertions could not produce.
- **It found a real shipped violation on its first run.** `WatchedFoldersSection.tsx:274-275` applies
  `bg-destructive/15 text-destructive` to `last_status === "failed"` — the danger token on a source
  state, which sketch 233 §9 forbids in favour of `--color-warning`. That case is red for a defect,
  not for an unbuilt surface.

## Task Commits

Each task was committed atomically:

1. **Task 1: region-scoped `--emit-json` arm + the generated contract** — `b0cc375cf` (feat)
2. **Task 2: `sourceComposition.test.tsx`, six sections, landing RED** — `bba894059` (test)
3. **Task 3: the verbatim RED run in `235-BASELINE.md`** — `31023a173` (docs)

## Files Created/Modified

- `.planning/sketches/233-the-source-says-what-it-did/drive.cjs` — **+130 L.** A `railRegion()`
  helper beside `region()`, and an `--emit-json` arm that writes the region-scoped contract. `--emit`
  is untouched; the driver still reads `86 passed, 0 failed`.
- `frontend/src/components/sources/__generated__/sourceComposition.json` — the generated contract.
  ⛔ Never hand-edited: if it is wrong, the emitter is wrong.
- `frontend/src/components/sources/sourceComposition.test.tsx` — 671 L, 49 cases, six sections.
- `.planning/phases/235-the-source-says-what-it-did/235-BASELINE.md` — 255 L. The command, the exit
  code, the 37 failing case names pasted rather than paraphrased, what was green and why, every red
  mapped to its owning plan, the adoption contract, and both measured gate baselines.

## Decisions Made

- **`data-testid`, not `data-block`** — see the deviation below. Recorded in the suite's docblock,
  in `235-BASELINE.md` §6, and here.
- **The `sources` screen is two concatenated regions.** `instance-statement` + `body-ingestion`.
  Concatenating two scoped slices is still scoped; widening `region()` to swallow the tab bar would
  not be, and would hand the rail screen twelve blocks that are not its own.
- **`counts` is emitted as data.** §5 reads `CONTRACT.counts.sourceLine` rather than the literal 9.
  The one case that DOES carry literals asserts the contract's own numbers against the design's
  (`9 + 3 = 12`, `2`, `3`, `17`, `1`) — so a wrong emit is caught, and a wrong transcription cannot
  happen.
- **The mock factory declares two functions that do not exist yet** (`listSyncRuns`,
  `getSourceHealth`). A full factory replacement of `@/lib/api/sources` throws at MOUNT about a
  missing export the moment a child imports one — the Phase-196-08 failure mode, and the one thing
  that would make this suite's red unreadable.
- **`@/lib/api` is mocked PARTIALLY via `importOriginal`**, `@/lib/api/sources` FULLY and separately.
  The latter is not in the barrel (measured, P-10).

## Deviations from Plan

### 1. [Recorded deviation — convention] `data-block` → `data-testid`

- **Found during:** Task 2 (writing the fence), anticipated by the plan and by RESEARCH C-9.
- **Issue:** `BUILD-CONTRACT.generated.md` §2 says *"Every entry is a `data-block` the React build
  must emit under the same name."* The shipped house convention says the opposite:
  `sketchComposition.test.tsx:34-38` records `data-testid` at ~1500 occurrences and states that
  **`data-block` is the SKETCH's marker and must never appear in the build**.
- **Resolution:** Follow the SHIPPED convention. **The contract's block NAMES bind; its attribute
  spelling does not.** Contradicting a 1500-occurrence house convention on the strength of one
  generated sentence would be the wrong trade.
- **Where it is recorded, so it is not silent:** the suite's docblock section (c), `235-BASELINE.md`
  §6, and this section.
- **Verification:** `grep -n "data-block" frontend/src/components/sources/sourceComposition.test.tsx`
  returns **three** hits, all inside the docblock that states the prohibition — none inside a
  `getByTestId` call.
- **Committed in:** `bba894059`

### 2. [Rule 3 — Blocking] `IngestionTab` positive control failed to typecheck

- **Found during:** Task 2.
- **Issue:** The 217.1 precedent mounts `<IngestionTab documents={sampleDocuments} />`, but
  `IngestionTabProps` now requires `upload` and `uploading` — `tsc -p tsconfig.app.json --noEmit`
  reported `TS2739` on the positive control. The case still PASSED at runtime, which is exactly why
  it needed catching: a green positive control that does not typecheck is a control nobody trusts.
- **Fix:** Pass `upload`, `uploading` and `uploadingCount` at the mount site.
- **Verification:** frontend `tsc` error count went **104 → 103**, and `grep sourceComposition` over
  the tsc output is now empty. ⚠ The remaining **103** are PRE-EXISTING in unrelated test files
  (`useMessages.test.ts`, `ChatAreaMode.test.tsx`, `vercelRouting.test.ts`, …) and are out of scope
  under the scope-boundary rule.
- **Committed in:** `bba894059`

### 3. [Improvement over the plan's letter] `counts` shipped in the artifact

- **Found during:** Task 1.
- **Issue:** The plan's `<interfaces>` block fixes the JSON shape as `{ <screen>: {blocks, buttons} }`
  plus `copy`. §5's numbers would then have to be transcribed into the suite — the exact staleness
  the emitter exists to prevent.
- **Fix:** A top-level `counts` object emitted from the sketch's own render. It is additive: the
  plan's own verify script iterates `Object.values(c)` and skips anything without `.blocks`, so
  `counts` and `copy` are both invisible to it.
- **Verification:** the plan's Task-1 verify command passes unchanged —
  `contract OK — 20 kinds, 28 copy keys`.
- **Committed in:** `b0cc375cf`

---

**Total deviations:** 3 (1 recorded convention deviation the plan anticipated, 1 Rule-3 blocking
typecheck fix, 1 additive improvement).
**Impact on plan:** None negative. The convention deviation is the plan's own instruction; the
typecheck fix restores the pre-existing tsc baseline exactly; the `counts` addition removes a
transcription the plan would otherwise have required.

## Issues Encountered

- **The worktree forked from the wrong base and was corrected.** `git merge-base HEAD 635a3e719…`
  returned `a403e0a27…` — HEAD was on a `master` merge commit, not the dispatched base. Corrected
  with `git reset --hard 635a3e7191ec6b064beced009b3cb829e575f077` per the `<worktree_branch_check>`
  step. **Recorded rather than silently fixed**, because this project has measured the same fork
  repeatedly and a silent correction is indistinguishable from it never having happened.
- **Nothing else.** No package was installed, no architectural decision was reached, no checkpoint
  was hit.

## Verification

| Check | Result |
|---|---|
| `node …/drive.cjs --emit-json` | exit 0 · `86 passed, 0 failed` · `20 block kinds across 3 regions, 28 copy keys` |
| Idempotent re-emit | md5 `595d8356…` twice, byte-identical |
| Plan Task-1 verify script | `contract OK — 20 kinds, 28 copy keys` |
| `npx vitest run …/sourceComposition.test.tsx --maxWorkers=2` | **exit 1** · `37 failed \| 12 passed (49)` — the intended result |
| §1 non-vacuity floor | **5/5 GREEN** |
| §2 positive controls | **3/3 GREEN** |
| §3 block cases red | **20** (12 sources + 3 health + 5 rail), each naming its exact `data-testid` |
| Plan Task-3 verify script | `baseline record OK — 15027 chars` |
| `frontend` tsc | 103 errors, **none in this plan's files** (pre-existing baseline restored from 104) |
| `scripts/vitest-count-gate.cjs` modified? | **No** — `git diff --name-only` across all three commits names it nowhere |
| `STATE.md` / `ROADMAP.md` modified? | **No** |
| `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` (repo root) | **exit 0** · `count gate OK — 227/227 pinned files present, no per-file decrease, 0 failing.` |

The gate's own verdict line, verbatim, run on this worktree AFTER all three commits:

```
  total                                      6814    7544    +730
  total 7544  ·  failed 0  ·  pinned total 6814
count gate OK — 227/227 pinned files present, no per-file decrease, 0 failing.
```

⭐ **Identical to `235-VALIDATION.md`'s measured baseline** (`total 7544 · failed 0 · pinned total
6814` · `227/227`). A deliberately-red 37-failure suite landed in the tree and the shared gate did
not move by one case — which is the property the whole no-knobs-while-red rule exists to produce.

⚠ **The shared count gate is structurally unaffected, and that was measured rather than assumed.**
`src/components/sources` is **not** a TARGETS *directory* entry — its suites are pinned one file at
a time (`SourceFolderPicker.test.tsx`, `previewVocabulary.test.ts`, `SourcePreviewPanel.test.tsx`,
`WatchedFoldersSection.test.tsx`), and `sourceComposition.test.tsx` is in none of them. The gate's
own printed command line for this tree confirms it: the new file does not appear in the 130-file
argv. **So the suite does not even RUN in the gate until plan 12 pins it**, and this plan's red run
cannot leak into any sibling plan's verification.

## Known Stubs

**None.** No hardcoded empty value, placeholder string or unwired data source was introduced. The
JSON artifact is generated from a running sketch; every value in it is computed.

⚠ **The fence itself is deliberately red, and that is not a stub** — it is the plan's deliverable.
The blocks it names do not exist yet; plans 08–11 build them, and `235-BASELINE.md` §3 maps each red
case to its owning plan so a later green run proves the fence was wired rather than never fired.

## Next Phase Readiness

**Ready.** The three consuming waves have a machine-readable acceptance bar and a named hook per
block:

- **Plan 08** owes `sources-tab-ingestion`, `sources-tab-health`, and the removal of `"scheduled"`
  from `backend/app/api/sources.py`.
- **Plan 09** owes the five rail hooks (`rail-rail-item`, `rail-rail-item-library`, `rail-badge`,
  `rail-popover`, `rail-pop-item`) and the `rail-badge` / `rail-open-health` controls.
- **Plan 10** owes the ten sources blocks, the five sources controls, the six §5 counts, the removal
  of `"scheduled"` from `WatchedFoldersSection.tsx:78`, and the `--color-danger` → `--color-warning`
  fix at `:274-275`.
- **Plan 11** owes `health-body-health`, `health-attention-list`, `health-attention-row` and
  `health-go-to-source`.
- **Plan 12** adopts BOTH gate knobs in ONE commit, at the gate's own printed `— N new` figure, and
  never while any case is red.

⚠ **Two concerns for the waves that follow, neither of them blocking:**

1. **A missing hook and a missing surface fail identically.** `tab-ingestion` and `tab-health` exist
   in `LibraryPage` today and merely carry no contract hook; `instance-statement` does not exist at
   all. The plan that turns each green must say WHICH it was, or a hook-tagging pass will read as a
   feature.
2. **`railRegion()` is a second scoping rule and nothing enforces its correctness.** It slices at
   `</aside>`; if the sketch's rail ever stops being an `<aside>` the region silently becomes the
   whole page and the rail screen's block set silently grows. Worth a fence in the sketch driver if
   the rail markup is ever restructured.

## Self-Check: PASSED

- All four claimed artifacts exist on disk: `drive.cjs`, `sourceComposition.json`,
  `sourceComposition.test.tsx`, `235-BASELINE.md`.
- All three claimed commits exist: `b0cc375cf`, `bba894059`, `31023a173`.
- `git diff --name-only 635a3e719 HEAD` names **exactly four files** — the plan's
  `files_modified` list and nothing else. `scripts/vitest-count-gate.cjs`, `STATE.md` and
  `ROADMAP.md` are absent, as required.

---
*Phase: 235-the-source-says-what-it-did*
*Plan: 03*
*Completed: 2026-09-06*
