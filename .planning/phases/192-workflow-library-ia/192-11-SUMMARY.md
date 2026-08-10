---
phase: 192-workflow-library-ia
plan: 11
subsystem: workflow-library-frontend
tags: [frontend, tests, scale-200, LIB-01, LIB-02, LIB-03, LIB-04, D-03, D-04, D-07, D-08, D-10, D-11, D-17, D-18, F2, F3, T-192-03, T-192-19, T-192-23, T-192-27, T-192-29]

# Dependency graph
requires:
  - phase: 192-02
    provides: "`PublishedWorkflow.is_mine` on both feeds — the bit this plan finally cross-checks against feed origin"
  - phase: 192-05
    provides: "`mergeLibrary` / `filterLibrary` / `chipCounts` / `CHIP_PREDICATES` — the arithmetic this plan audits through the DOM"
  - phase: 192-07
    provides: "`LibraryToolbar` — the create control, the six counted chips, the `data-state` marker, and D-17's note"
  - phase: 192-09
    provides: "`WorkflowCard` and the nine shipped testids every assertion here reaches through"
  - phase: 192-10
    provides: "the composed page, the six page-level hooks (`library-list`, `library-empty`, `library-filtered-empty`, `library-source-failed-*`), and the `allSettled` CORRECTION this plan builds on rather than repeats"
provides:
  - "frontend/src/pages/WorkflowsPage.test.tsx — the LIB-01…04 behaviour suite at 200 rows"
  - "the two DOM fences F2 + F3, each with a positive control"
  - "the `is_mine === (provenance !== \"starter\")` cross-check OWED since 192-02 — discharged"
affects: [192-12]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "an in-file 200-row generator partitioned across three feeds (no fixtures module, no MSW)"
    - "chip-count auditing where the EXPECTED value is read from the DOM, never from the fixture array"
    - "a DOM absence fence paired with a positive control planted into the same rendered surface"
    - "asserting a GAP by name, with a positive control, rather than asserting a green that would be false"
    - "`configure({ asyncUtilTimeout })` as flake hardening that changes patience and no assertion"

key-files:
  created: []
  modified:
    - frontend/src/pages/WorkflowsPage.test.tsx

key-decisions:
  - "D-07's SECOND HALF — 'with the hit highlighted' — is NOT SHIPPED, measured rather than assumed, and is asserted as a GAP with a positive control instead of being quietly skipped"
  - "The carve-out was NOT duplicated: 192-10 proves the property at four rows, so this plan proves it is ARITHMETICALLY EXACT at 200 and adds the half nothing covered — the counts under a failed source"
  - "SC#4 is proved as DOM ORDER only; the visual half is UAT's (U2/U3/U7) and is explicitly not claimed"
  - "The cascade pair was added to the mock factory so 'never called' could be an ASSERTION rather than an absence nobody can observe"
  - "The `waitFor` flake was HARDENED, not tolerated — a test that fails one run in six is worse than no test"

requirements-completed: []

# Metrics
duration: ~2h35m
completed: 2026-08-11
---

# Phase 192 Plan 11: Where the Requirements Acquire Evidence — Summary

**LIB-01…04 are now mechanically true at 200 workflows, through the real merge, the real filter and the real DOM. Every new claim was driven RED against a real defect planted in production source — twelve plants across four files, each restored md5-identical — and the one claim the plan asked for that is NOT shipped (D-07's search highlight) is asserted as a gap with a positive control rather than skipped or faked. The `is_mine === (provenance !== "starter")` cross-check owed since 192-02 through five waves is discharged, in both the present and the absent case.**

## Performance

- **Duration:** ~2 h 35 · **Tasks:** 3 · **Commits:** 3 (plus this SUMMARY)
- **Files:** 0 created, **1 modified** · **756 insertions / 1 deletion** across `9e77b9c7..HEAD`
- `git diff --name-only 9e77b9c7..HEAD` → exactly `frontend/src/pages/WorkflowsPage.test.tsx`. **This plan changed no source**, as its own verification requires.
- `git diff --diff-filter=D` → empty. Nothing deleted.

| Commit | Task |
|---|---|
| `63230e42` | the 200-row fixture + search (SC#1, D-07, D-08) + chip honesty (SC#2, D-03) |
| `bf7f986f` | the carve-out at scale + D-17's project semantics + the D-04 cross-check |
| `f8d11258` | the DOM fences F2/F3 + create-first at 200 (SC#4) + the two delete grades (D-18) |

## The measured suite

| | before | after |
|---|---|---|
| tests | **22** | **39** (+17) |
| `wc -l` | 685 | **1439** |
| runtime, this file alone | 5.0 s | **26.9 s** |

**The 60-second acceptance bar is met with 33 s of headroom, so N stayed at 200 and nothing was quietly reduced.** The 200-row cases dominate: the chip audit alone re-renders two hundred cards twenty-four times.

## THE SCALE IS REAL, AND WHICH PART IS SIMULATED IS STATED

**Nothing about the 200 rows is mocked except the wire.** The fixtures go through `listPublishedWorkflows` / `listStarterWorkflows` / `listDraftWorkflows` exactly as the server would answer, and from there through the shipped `mergeLibrary` → `filterLibrary` → `chipCounts` and into two hundred real `WorkflowCard` mounts in jsdom. Every count in every assertion is read back out of the rendered DOM.

**The one simulation, named:** in the D-17 case `listPublishedWorkflows` is given a `mockImplementation` that FILTERS by the project argument — because `?project_folder_id=` narrowing is the SERVER's job and there is no server here. That is the contract being simulated, not the behaviour under test: what is under test is that the page re-queries with the right argument, that drafts narrow client-side, and that starters do not narrow at all.

**The composition, and why it is spread that way:** 120 published + 20 starters + 60 drafts, partitioned out of ONE `Array.from({ length: 200 })`. `citation_policy`, `phase_type`, `business_requirement` and `project_folder_id` all vary, so the six chips land on 140 / 180 / 60 / 20 / 100 / 50 rather than on a uniform block any predicate would satisfy. A fixture where every row answers every chip proves nothing about any chip.

## ⚠ THE MEASURED CORRECTION: D-07's SEARCH HIGHLIGHT IS NOT SHIPPED

Task 1 asks for *"a `<mark>` wraps the matched slice"*. **Measured at this commit, no `<mark>` renders anywhere on the library surface, and the reason is structural rather than a bug:**

- `grep -rn "HighlightTitle"` over `frontend/src` returns **zero consumers** under `components/workflows/library/` — the three live call sites are all in `components/layout/` (the thread column, the mobile list, the command palette).
- `WorkflowCard` renders `row.name` as plain text and **takes no `query` prop at all**, so there is nothing for a highlight to key off even if it wanted one.
- `192-09-SUMMARY.md` records the same fact from the other side, in its own threat table: *"The highlight is not re-implemented here — this card renders no highlight at all."*
- `librarySubtree.fences.test.ts:355` asserts in prose that *"192 IMPORTS it and edits nothing"*. The byte-identity half of that fence holds; **the "imports it" half does not, and is corrected here.** Nothing in this phase imports `HighlightTitle`.

**What was done about it, and why.** Wiring the highlight is a SOURCE change across two files (`WorkflowsPage.tsx` must pass `query` down; `WorkflowCard.tsx` must render `HighlightTitle` on the name and the purpose atom) — neither is in this plan's `files_modified`, and this plan's own verification gate requires `git diff --name-only` to list exactly one file. Asserting it green was impossible; asserting nothing would have let the gap disappear. So the test asserts the LIMITATION, by name:

> *"⚠ MEASURED, NOT ASSUMED: the search hit is NOT highlighted today — D-07's second half is unshipped"*

with a **positive control** rendering `HighlightTitle` inline and showing the same `querySelector("mark")` finds a real highlight immediately — so the null result is a fact about the surface, not about the query. The control also pins the shipped behaviour any future wiring must match: **the FIRST match only** (`title="risk risk"`, `query="risk"` → exactly one `<mark>`).

**It does NOT block LIB-01.** REQUIREMENTS.md's own wording is *"A user can search the Workflows page by name and filter the list"* — the highlight belongs to decision D-07, not to the requirement. **It IS owed**, and it is the single largest item this plan hands forward (see *What 192-12 inherits*).

## What each requirement now rests on

| | Claim | Evidence | Scale |
|---|---|---|---|
| **LIB-01 / SC#1** | three characters of ONE name narrow the list to that row, and the other 199 are asserted ABSENT | `SC#1 — three characters of ONE workflow's name…` | 200 |
| **LIB-01 / D-07** | a word living ONLY in a purpose sentence finds its row; the word is asserted absent from the name and present in the rendered `soul-purpose` | `D-07 — a word that appears ONLY in the purpose sentence…` | 200 |
| **LIB-01 / D-07** | ⚠ the hit is **not** highlighted — a stated gap with a positive control | `⚠ MEASURED, NOT ASSUMED…` | 200 |
| **LIB-01 / D-08** | the paraphrase returns ZERO, `library-filtered-empty` (not `library-empty`) appears, and *Clear search & filters* really restores all 200 | `D-08 — the paraphrase … returns ZERO rows` | 200 |
| **LIB-02 / SC#2** | `chipCount(c) === renderedRows.filter(pred(c)).length`, six chips × two live queries, expected read from the DOM | `at 200 rows, and under TWO different live searches…` | 200 |
| **LIB-02 / D-03** | a zero-count chip still renders, and its zero is real | `a chip whose count is ZERO still renders…` | 200 |
| **LIB-02 / D-11 (F2)** | no user-visible node renders a `GET /workflows/…` string | `no user-visible node renders a GET /workflows/… string` | 4 |
| **LIB-03 / D-10 (F3)** | no `Publish…` on any row FACE, **and** none inside any of the three menus | two cases | 4 |
| **LIB-03 / D-18** | draft delete arms, then hits the single-row endpoint and NEVER the cascade pair; the published grade takes the Sheet + the cascade | two cases | 4 |
| **LIB-04 / SC#4** | create precedes every one of 200 rows by `compareDocumentPosition`, and is the first interactive element | `the create affordance precedes EVERY one of 200 rendered rows` | 200 |
| **D-16 / T-192-03** | a refused `/drafts` subtracts EXACTLY itself, and the counts say so | `a refused /workflows/drafts subtracts EXACTLY itself out of 200 rows` | 200 |
| **D-17 / T-192-27** | published narrow server-side, drafts client-side, EVERY starter stays, the note's TEXT is present — and absent under "All projects" | `selecting a project narrows published (server) and drafts (client)…` | 200 |
| **D-17 / T-192-19** | a pending re-query zeroes no count; the marker appears **and then disappears** | `D-17's companion rule — a PENDING project re-query…` | 200 |
| **D-04** | `is_mine === (provenance !== "starter")` over the merged list, plus the same agreement through the *Yours* chip | `over the merged list, is_mine === (provenance !== "starter")…` | 200 |
| **D-04 degraded** | with `is_mine` ABSENT the chip is still CORRECT, not merely non-fatal | `with is_mine ABSENT from the wire…` | 200 |

## THE OWED CROSS-CHECK, DISCHARGED — five waves late, and in two halves

`192-02-SUMMARY.md` handed forward: *"an integration task asserting `is_mine === (provenance !== "starter")` over the merged list is still owed by the joining plan."* `192-10` wired the bit through `mergeLibrary` unchanged and asserted nothing about it. **It is discharged here, and deliberately in two halves rather than one, because either half alone is weak:**

1. **The wire half** — over all 140 rows the two published-shaped feeds supply, the server-computed bit and the feed origin AGREE. On its own this is a statement about the fixture, so it carries a **positive control**: a starter the backend called ours (`is_mine: true`, `provenance: "starter"`) is shown to FAIL the same check.
2. **The surface half** — the *Yours* chip promises, and then delivers, exactly the non-starter rows of the rendered list, read from each card's own `data-provenance`. This is the half a user would notice, and it is the one a fixture-only assertion cannot reach.

The degraded case is the one that matters most and is the easiest to get wrong: with `is_mine` **deleted from the payload** (not set to `undefined` — a frontend deployed ahead of its backend never had the key), the chip still produces all 180 non-starter rows. Reading a missing bit as `false` would render an empty *Yours* chip, which is the failure shape that looks like lost data. **Driven RED against exactly that defect** (`row.isMine ?? false`).

## THE PLANTS — twelve, all in production source, all restored md5-identical

Every restore was verified against md5s captured before the first plant: `libraryFilter.ts` **f0b62d2e** · `LibraryToolbar.tsx` **1347222a** · `WorkflowCard.tsx` **3fe7cb9c** · `WorkflowsPage.tsx` **09f46b84**. All four match at the end. Restores were `git checkout -- <one file>` — never a blanket reset, never `git clean`.

| # | Plant (real defect, in production source) | What reddened |
|---|---|---|
| 1 | `matchesQuery` narrowed to the name only | D-07 purpose search |
| 2 | `chipCounts` blind to the live query | BOTH chip cases |
| 3 | the toolbar filtering out zero-count chips | the honest-empty-state case |
| 4 | `matchesProject` narrowing starters like drafts | D-17 + its companion |
| 5 | D-17's note rendered as an empty string | D-17 — **a present-but-BLANK node fails**, which is the requirement |
| 6 | `setPublished([])` at the top of a re-query | the in-flight count rule |
| 7 | `CHIP_PREDICATES.yours` → `row.isMine ?? false` | BOTH D-04 cases |
| 8 | the list gated on `failedSources.length > 0` | the carve-out at scale **and** 192-10's own carve-out case |
| 9 | a `Publish…` button back on the draft FACE | F3 face |
| 10 | a `Publish…` item hiding in the draft MENU | F3 menus — **and NOT the face case** |
| 11 | the route literal rendered as page text | F2 |
| 12a | the toolbar rendered BELOW the list | SC#4 (row precedence) |
| 12b | create demoted below the search field | SC#4 (**first-interactive**, NOT row precedence) |

**Two of these are worth keeping, because they show the assertions are not redundant with each other:**

- **Plant 10 reddened the menu fence and left the FACE fence green.** An absence proved only on the card face is satisfied by a control that merely moved behind the `⋯` — which is precisely how `Publish…` could come back.
- **Plant 12b reddened the first-interactive assertion and left the row-precedence assertion green**, because a control demoted *inside the toolbar* still precedes every row. The two halves of SC#4 therefore cover different regressions and neither is decoration.

**One plant shape was deliberately NOT used, and the reason is this phase's own finding.** `192-07` measured that a CSS `row-reverse` leaves every `compareDocumentPosition` assertion green while visually inverting the order. A CSS plant would therefore have been a plant that *cannot fire* — the worst kind. It is recorded as the known limit of the SC#4 evidence instead: **this suite proves ORDER, and order only.**

## Deviations from Plan

### 1. [Rule 1 — Bug in the plan's premise] Task 1's `<mark>` bullet asserts a thing that does not exist

Covered in full above. The bullet and its acceptance grep were satisfied by asserting the gap with a positive control rather than by asserting a false green. **No `must_haves.truths` entry mentions the highlight**, so nothing this plan promised was dropped — but D-07 is now only half shipped, and the SUMMARY says so where a reader will find it.

### 2. [Rule 3 — Blocking] A `waitFor` flake, HARDENED rather than tolerated

- **Found during:** Task 3's verification sweep.
- **Issue:** the FIRST wide run of `src/pages src/components/workflows/library` (22 files) reported **1 failed / 645 passed**; four consecutive re-runs reported **646 / 0**. A later count-gate run **without** `GSD_VITEST_MAX_WORKERS` reported `failed 1`; three runs **with** the cap reported `failed 0` and exit 0. This is the CLAUDE.md rule-2 phenomenon one layer up — oversubscription surfacing as a bare timeout — and this file is now the heaviest renderer in the tree.
- **Fix:** `configure({ asyncUtilTimeout: 15000 })` at the top of the file, and the ad-hoc `{ timeout: 8000 }` overrides removed so one patience applies uniformly. **This changes no assertion**: a genuinely broken expectation still fails, it merely reports after 15 s instead of 1 s, and a passing run is not slowed because `waitFor` returns the moment its callback succeeds.
- **⚠ Stated honestly:** the flake was observed ONCE in seven capped runs before the change and zero times in the four capped runs after, plus once in the single uncapped run. That is consistent with both explanations and proves neither — the cap is mandated by CLAUDE.md regardless, and the raised patience is insurance whose only cost is a slower failure report.
- **Committed in:** `f8d11258`

### 3. The carve-out test was NOT duplicated, and the plan asked for it verbatim

Task 2 says *"Add the carve-out test. Stub `listDraftWorkflows` to reject…"* — **that test already exists**, added by `192-10`, and it is green. Writing it again would have added a row that proves nothing new while inflating the count. What was added instead is strictly more: the same property at **200 rows, arithmetically exact** (the refusal removes exactly the 60 drafts), plus the half no case covered — **the chip counts under a failed source**, which is the one thing a partial library could fabricate invisibly, because a number describing rows nobody can reach looks exactly like a number describing rows they can. Both new and old case were driven RED by plant 8.

### 4. The cascade pair had to JOIN the mock factory for an absence to be assertable

`vi.mock("@/lib/api", …)` replaces the whole module, and a symbol that was never registered cannot be checked with `not.toHaveBeenCalled` — it can only throw somewhere else, at some other time. So `getWorkflowDeletePreview` and `deleteWorkflowCascade` were added, and the published row's heavier grade genuinely reaches both. That is what makes "the two grades are distinct" a **measurement from one card** rather than a description.

### 5. `findByText(/Vendor-risk review/)` was ambiguous, and the fix made the assertion stronger

The Sheet names its victim, and the card behind it carries the same name — so a page-wide text query matched two nodes and threw. Scoped to `role="dialog"`, which is what the assertion meant all along: a page-wide query would have passed on a Sheet that named nothing. The scoped version also now asserts the two server counts (`2 versions`, `3 run records`), which the ambiguous one did not.

### 6. `stripIsMine` was moved out of Task 1's commit

Declared for Task 2 but written during Task 1, it was an unused symbol — and `noUnusedLocals` makes that a **type error** here, not a lint warning (`tsc` read 35 against a baseline of 33). Read out of `tsc` rather than predicted, removed, and re-added in `bf7f986f` where it is used. Its `Record<string, unknown>` spread also needed an explicit cast (`TS2322`).

### 7. The worktree came up on a `master` merge commit again

`git merge-base HEAD 9e77b9c7` returned `3781a3fe`, the startup assertion fired, and the worktree was reset to `9e77b9c7` before anything was read. **Nine of nine worktrees in this phase**, exactly as the dispatch brief predicted. All three commits sit directly on `9e77b9c7`.

---

**Total deviations:** 1 plan-premise correction, 1 auto-fixed blocking issue, 5 judgement calls recorded. **Impact on scope:** none. No source change, no new capability, no new dependency, zero packages installed.

## Gates

| Gate | Result |
|---|---|
| `vitest run src/pages/WorkflowsPage.test.tsx` | **39 passed / 0 failed**, 26.9 s |
| `vitest run src/pages src/components/workflows/library` | **646 passed / 0 failed** (22 files) — **four consecutive capped runs after the hardening; six of seven before it** |
| `GSD_VITEST_MAX_WORKERS=4 node scripts/vitest-count-gate.cjs` | **exit 0, THREE runs** — `total 3158 · failed 0`, `56/56 pinned present`, no per-file decrease |
| `tsc -p tsconfig.app.json --noEmit` | **33** — the recorded baseline, unmoved, at four separate measurements |
| `eslint src/pages/WorkflowsPage.tsx src/pages/WorkflowsPage.test.tsx` | **0** |
| `git diff --name-only 9e77b9c7..HEAD` | exactly `frontend/src/pages/WorkflowsPage.test.tsx` — **no source changed** |
| `git diff --diff-filter=D` | empty |
| md5 of all four production files touched by plants | **unchanged** — f0b62d2e / 1347222a / 3fe7cb9c / 09f46b84 |

Every vitest invocation carried `GSD_VITEST_MAX_WORKERS=4` **and** `--maxWorkers=4`, except the ONE deliberate uncapped gate run recorded in deviation 2.

### Acceptance greps, all measured on the shipped file

| Check | Required | Measured |
|---|---|---|
| `length: 200` | ≥ 1 | **1** |
| `makePublishedRow` | ≥ 2 | **2** |
| `makeDraftRow` | ≥ 2 | **2** |
| `the thing that checks vendors` | ≥ 1 | **2** |
| `querySelector("mark")` / `querySelectorAll("mark")` | ≥ 1 | **3** |
| chip-count assertions, one per `ChipId` | ≥ 6 | **12** (six chips × two live queries; each named in its own failure message) |
| `mockRejectedValue` | ≥ 1 | **2** |
| `carve-out` / `carve out` (case-insensitive) | ≥ 1 | **7** |
| `is_mine` | ≥ 2 | **16** |
| `data-state` | ≥ 1 | **1** |
| `compareDocumentPosition` | ≥ 1 | **3** |
| `positive control` (case-insensitive) | ≥ 1 | **7** |
| `GET /workflows/` | ≥ 1 | **5** |
| `deleteWorkflowCascade` in a `not.toHaveBeenCalled` | ≥ 1 | **1** (`:1381`) |

⚠ **One acceptance criterion is met by structure rather than by a raw count, and it is stated rather than glossed:** *"at least six chip-count assertions exist — one per `ChipId`"*. `grep -c "library-chip-count-"` reads **1**, because the id is built once inside the `chipCount` helper. The six literals live in the file's own `CHIPS` array, the loop asserts each of them, and the number of RENDERED chips is pinned to that array's length — so a seventh chip fails here rather than going silently unaudited.

## Threat Model Status

| Threat ID | Disposition | Outcome |
|---|---|---|
| T-192-03 | mitigate | **Mitigated and PROVED AT SCALE.** A rejected `/drafts` renders all 140 carve-out rows, degrades to exactly zero drafts, names the refusal and never shows "you have none". Driven RED against the single-shared-error-path plant, which reddened this case and 192-10's together. |
| T-192-29 | mitigate | **Mitigated.** F3 carries a positive control on the FACE fence, and a second case proves the menus separately — driven RED by two different plants, one of which the face fence could not see. F2 carries both a non-vacuity check and its own positive control. |
| T-192-23 | mitigate | **Mitigated and PROVED DISTINCT.** The draft path arms first, then calls the single-row endpoint with the draft's id, and neither cascade client is called. The published path fetches server counts, names its victim and calls the cascade — from the same one card. Driven RED by routing the draft delete to the cascade. |
| T-192-27 | mitigate | **Mitigated.** D-17's note asserted by its literal TEXT and by its `aria-describedby` wiring, with the negative case. A present-but-blank node was driven RED, which is exactly the failure mode the plan called out. |
| T-192-19 | mitigate | **Mitigated.** With a re-query held open, all previously-committed rows stay rendered, no count is zero, the two partition chips sum to the rendered list, and the `data-state` marker is proved present-then-ABSENT. Driven RED by blanking a settled source. |
| T-192-SC | accept | **Held.** Zero packages installed. |

**Threat flags:** none. No source changed, so no new network surface, auth path, file access or schema.

## Known Stubs

**One, and it is a gap in shipped behaviour rather than in this suite: D-07's search highlight does not exist** (see the correction section). It is asserted as a limitation, with a positive control, and owed forward below. No other stub: every assertion in this file reaches real shipped code through the real seams.

## What 192-12 inherits

- **THE PIN RAISE, read from the gate's own `actual` column across three agreeing runs:**

  | file | pinned | actual | delta |
  |---|---|---|---|
  | **`WorkflowsPage.test.tsx`** | 22 | **39** | **+17** |
  | `WorkflowCard.test.tsx` | — | **35** | new |
  | `LibraryToolbar.test.tsx` | — | **36** | new |
  | `libraryFilter.test.ts` | — | **36** | new |
  | `librarySubtree.fences.test.ts` | — | **47** | new |
  | `PublishedCardDelete.test.tsx` | 7 | **32** | +25 |
  | `RunModal.test.tsx` | 11 | **32** | +21 |
  | `RunModal.a11y.test.tsx` | 8 | **16** | +8 |

  `192-10` reported its own pin *"settled at 22 and needs nothing further"* — **that is now stale: it is 39.** `total 3158 · failed 0`, `BASELINE_TOTAL` pinned at 2909. Read the final numbers from one gate run over the settled tree; do not carry these forward as arithmetic.

- **D-07's highlight, OWED, with the exact wiring named so it is a small change rather than an investigation:** `WorkflowsPage.tsx` passes `query` to `WorkflowCard`; `WorkflowCard.tsx` renders `<HighlightTitle title={row.name} query={query} />` and the same on the purpose atom, importing from `@/lib/threadGroups` (never re-implementing — T-192-04, and `librarySubtree.fences.test.ts` pins that file byte-for-byte). The limitation test in this suite is what must be INVERTED when it lands, and its positive control already proves the selector.
- **`librarySubtree.fences.test.ts:355` contains a prose claim that is now false** — *"192 IMPORTS it and edits nothing."* Nothing in this phase imports `HighlightTitle`. The fence's mechanical half is unaffected; the sentence should be corrected in the same commit that wires the highlight, or amended if it does not land.
- **The suite is the tree's heaviest renderer.** 200 cards per case, 26.9 s alone. `configure({ asyncUtilTimeout: 15000 })` is deliberate — do not lower it without re-measuring under a loaded box.
- **The RED-plant obligation on `WorkflowDeleteSheet.tsx`** (inherited from `192-08`) is still open; this plan reaches the Sheet but does not plant in it.
- **The string re-homes** `192-07` (four) and `192-09` (five) owe into `libraryVocabulary.ts` are untouched. This plan added no user-facing string.

## User Setup Required

None — no external service configuration, no dependency, no migration, no env var.

## Requirements

`LIB-01`…`LIB-04` are in this plan's frontmatter and this is the plan that gives them mechanical evidence. They were nonetheless deliberately **NOT** marked complete: no `state.*`, `requirements.mark-complete` or `roadmap.update-plan-progress` verb was called, and `.planning/STATE.md` / `.planning/ROADMAP.md` are untouched. **Marking them is the orchestrator's job at phase end, after verification — and one half of D-07 is unshipped, which the verifier should see before anything is ticked.**

## Self-Check: PASSED

- `frontend/src/pages/WorkflowsPage.test.tsx` — **FOUND** (1439 L · 39 tests · 0 failures)
- `.planning/phases/192-workflow-library-ia/192-11-SUMMARY.md` — **FOUND**
- Commit `63230e42` — **FOUND** in `git log`
- Commit `bf7f986f` — **FOUND** in `git log`
- Commit `f8d11258` — **FOUND** in `git log`
- `git diff --name-only 9e77b9c7..HEAD` — exactly one file, the test suite
- `git diff --diff-filter=D 9e77b9c7..HEAD` — empty
- `git status --short` — clean apart from this SUMMARY; all twelve plants reverted, all four md5s match their pre-plant values
- `.planning/STATE.md` / `.planning/ROADMAP.md` / `.planning/REQUIREMENTS.md` — **unmodified**
- `scripts/vitest-count-gate.cjs` — **unmodified** (the raise is `192-12`'s)

---
*Phase: 192-workflow-library-ia*
*Completed: 2026-08-11*
