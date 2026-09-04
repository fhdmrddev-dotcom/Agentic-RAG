---
phase: 214-a-step-names-its-service-and-its-action
plan: 10
subsystem: publish gauntlet / the argument-gap refusal surface
tags: [STEP-03, D-214-09, D-214-12, D-214-13, sketch-215, BUG-260815-06, publish-refusal]
requires:
  - frontend/src/components/workflows/publishRefusalVocabulary.ts::REFUSAL_FOR_KIND
  - frontend/src/components/workflows/publishRefusalVocabulary.ts::REFUSAL_NEXT_FOR_KIND
  - frontend/src/components/workflows/publishRefusalVocabulary.ts::ArgumentGapKind
  - frontend/src/lib/api/knowledge.ts::PublishNamedFailure
  - backend/app/services/harness/publish_service.py (the six-key named_failures entry)
provides:
  - frontend/src/components/workflows/PublishRefusalList.tsx::PublishRefusalList
  - frontend/src/components/workflows/publishRefusalEntry.ts::isArgumentRefusal
  - frontend/src/components/workflows/publishRefusalEntry.ts::ArgumentRefusal
  - frontend/src/components/workflows/publishRefusalEntry.ts::REFUSAL_CODES
  - "the spine's data-stage-state attribute (Checked / Stopped here / Not reached)"
affects:
  - "214-15 — MUST pin PublishRefusalList.test.tsx (22) and re-baseline PublishGauntlet.test.tsx (68 → 78)"
  - "214-15 — owes publishRefusalEntry.ts nothing yet (1 phase), and PublishGauntlet.tsx a re-derived ledger row"
  - "214-14 S-4 — the TypeScript side of the five-kind union is imported here, never re-typed"
tech-stack:
  added: []
  patterns:
    - "a Record keyed by the union instead of a switch with a default — a sixth kind is a compile error, not a generic sentence"
    - "the detection set READ BACK OFF the pairing map (Object.keys(REFUSAL_FOR_KIND)), so it cannot drift from the vocabulary"
    - "a pure .ts module beside the component, because react-refresh/only-export-components is an ACTIVE error here"
    - "an honest state word emitted ONLY when the state was actually computed — silence where the shipped colour is aspirational"
key-files:
  created:
    - frontend/src/components/workflows/PublishRefusalList.tsx
    - frontend/src/components/workflows/PublishRefusalList.test.tsx
    - frontend/src/components/workflows/publishRefusalEntry.ts
  modified:
    - frontend/src/components/workflows/PublishGauntlet.tsx
    - frontend/src/components/workflows/PublishGauntlet.test.tsx
decisions:
  - "The predicate lives in its own pure module: react-refresh/only-export-components is an ACTIVE ERROR in this repo, measured rather than assumed."
  - "An entry can be one of the five and still be UNPHRASABLE; it is declined to the generic renderer rather than rendered with empty curly quotes."
  - "The claimed entries are SUBTRACTED from the generic named_failures list — saying one failure twice, once honestly and once in machine words, is the BUG-260815-06 shape."
  - "GOLDEN_NO_SEND is gated on the golden-run ROW PASSING, not on golden_run_id != null: a timed-out run did not finish its own check."
  - "data-stage-state is emitted ONLY once a block is PLACED — at rest every node reads isPassed, so a state word there would claim ten checks that never ran."
metrics:
  tasks: 2
  commits: 2
  new-tests: 32
  duration: ~1h
  completed: 2026-08-28
---

# Phase 214 Plan 10: The Publish Refusal, Rendered as a Cause Summary

Publish now refuses in five distinct sentences composed client-side from
`publishRefusalVocabulary.ts` — each naming the step in the author's own words with its own
next action — placed ABOVE the stage spine, with the spine underneath it saying in words
which stage stopped and that the later ones were not reached.

## What shipped

| Task | Commit | What |
|---|---|---|
| 1 | `0af16b150` | `PublishRefusalList.tsx` + 22 cases — five headlines, two next actions, the count line, the not-retroactive note |
| 2 | `3d508f28f` | the gauntlet wiring (cause above spine), `data-stage-state`, `GOLDEN_NO_SEND`, +10 cases, and the `publishRefusalEntry.ts` split |

## The three things the plan asked this summary to record

### 1 · The `BASELINE` figures — and why they are per-file rather than the gate's own print

The plan's `<verification>` asks for `scripts/vitest-count-gate.cjs`'s printed `— N new`
figures verbatim. **The orchestrator's parallel-execution directive supersedes that**: this
is one of four worktree agents in wave 3, and it states *"Do NOT run the full
`scripts/vitest-count-gate.cjs` — the orchestrator owns it post-merge."* Running it here
would have measured a tree three siblings are concurrently changing, so the number would have
been wrong in a way nobody could later attribute.

What `214-15` needs is therefore given as **measured per-file counts**, which are
deterministic and are what a `BASELINE` key actually holds:

| file | before | after | delta |
|---|---|---|---|
| `frontend/src/components/workflows/PublishGauntlet.test.tsx` | **68** | **78** | `+10` |
| `frontend/src/components/workflows/PublishRefusalList.test.tsx` | *(did not exist)* | **22** | `+22` |

Both measured on this worktree at `GSD_VITEST_MAX_WORKERS=2`, from `frontend/`, on the two
files alone: `Test Files 2 passed (2) · Tests 100 passed (100) · Duration 42.79s`. The `68`
is the count on the untouched base commit `5e1c7ddc4`, measured before Task 2's test edit,
not inferred by subtraction.

⚠ **`PublishRefusalList.test.tsx` is a NEW pinned file `214-15` must ADD**, and
`PublishGauntlet.test.tsx`'s pin must be re-baselined upward. There is no third file: the new
pure module `publishRefusalEntry.ts` is exercised by `PublishRefusalList.test.tsx` and has no
suite of its own.

### 2 · The co-located `stage="…"`-literal assertion stayed GREEN — `214-05` added no stage

F18 (`PublishGauntlet — F18: the spine names every stage the server can emit`) reads the
`stage="([a-z_]+)"` literals **out of `publish_service.py` itself** and drives one render per
stage. It passed unchanged, along with its two non-vacuity guards
(`EMITTED_STAGES.size >= 11`, and `NOT_ON_THE_SPINE` being exactly `["already_published"]`).

**That is the mechanical confirmation of `214-05`'s decision to EXTEND stage 2 rather than add
a sibling stage.** The plan named the alternative outcome explicitly — *"if the co-located
`stage="…"` literal assertion goes red, that is the signal that `214-05` added a stage after
all — report it, do not paper over it by adding a row"* — and it did not fire. `STAGES` gained
no row, asserted three ways:

- `git diff -- PublishGauntlet.tsx | grep -c "^+ *{ label:"` → **0**
- the only added line mentioning `STAGES` is `const GOLDEN_RUN_CODES = STAGES[RUNNING_STAGE_INDEX]?.codes ?? []`
- a new case asserts **10 `spine-node` and 9 `spine-conn`** in the argument-refusal state

Sketch 215 invariant #8 therefore stays trivially true, exactly as `214-05` intended.

### 3 · Net-new marks — NONE DRAWN, and the one judgement call is flagged

`icon-convention.md` §4 was read before anything was rendered. **No glyph literal was added to
either component**, the shipped 3D fluent-emoji stage glyphs are reused unchanged, and nothing
was placed at a node's top-right — which D-185 claimed for the governance seal.

⚠ **One thing is flagged rather than passed off as existing vocabulary: `data-stage-state`.**
It is **not a mark** — it carries no glyph, no hue and no shape; it is the vocabulary's own
`STAGE_PASSED` / `STAGE_BLOCKED` / `STAGE_NOT_REACHED` **word**, emitted as a data attribute and
appended to the node's existing `title`. §4's table governs marks, and a word is not one. It is
recorded here anyway because it is a NEW carrier on a surface whose state has been colour-only
since 127-02, and the next person re-skinning the spine should know the state is now readable
as well as visible.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `react-refresh/only-export-components` is an ACTIVE ERROR, so the predicate needed its own module**

- **Found during:** Task 2, at the lint check after the gauntlet wiring.
- **Issue:** The plan's `files_modified` lists four files, and the natural home for
  `isArgumentRefusal` was beside the component it serves. `npx eslint` reported, at **error**
  severity: `Fast refresh only works when a file only exports components. Use a new file to
  share constants or functions between components`. This is not a style note here — twenty
  files across `components/workflows/` and `components/settings/` record the same measurement
  in their own headers (`argumentVocabulary.ts`, `externalShapeVocabulary.ts`,
  `canvasGround.ts`, `phaseStatusMeta.ts`, `doorVocabulary.ts`), and the repo's answer is
  uniformly **a separate pure module, never a disable comment**.
- **Fix:** `frontend/src/components/workflows/publishRefusalEntry.ts` — `ArgumentRefusal`,
  `REFUSAL_CODES` and `isArgumentRefusal`. Both consumers import from there.
- **Files modified:** `publishRefusalEntry.ts` (new), `PublishRefusalList.tsx`,
  `PublishRefusalList.test.tsx`, `PublishGauntlet.tsx`.
- **Commit:** `3d508f28f`
- ⚠ **This is a fifth file the plan did not declare.** It has no suite of its own and needs no
  `BASELINE` pin; it is listed under `provides` above so `214-15` and `214-14` can find it.

**2. [Rule 2 - Missing critical functionality] the spine could not say what it claimed, in any form a test or a screen-reader could read**

- **Found during:** Task 2, writing invariant #8's assertion.
- **Issue:** Sketch 215 #8 requires *"exactly one blocked stage, and every later stage reads
  **not reached**"*. The shipped spine carries its state in **colour and a ✓ badge alone** —
  there is no state text, no state attribute and no accessible name anywhere on a node. So the
  invariant could only have been asserted against tone class strings, i.e. against the paint
  rather than against the claim, and a reader who cannot separate the greens from the reds gets
  no state at all.
- **Fix:** each `spine-stage` column now carries `data-stage-state`, valued from the
  vocabulary's own `STAGE_PASSED` / `STAGE_BLOCKED` / `STAGE_NOT_REACHED`, and the node's
  `title` gains the same word.
- ⚠ **The restraint is the load-bearing half, and it was found by measurement.** At rest
  `blockedIndex` is `-1` and `isPassed` is `!running`, i.e. **TRUE for all ten nodes** — the
  ladder is drawn hopefully before anything has run. Emitting `Checked` there would have turned
  a visual convention into an **explicit claim that ten checks passed when none had been
  attempted**, which is the exact honesty failure #8 exists to prevent, committed while closing
  it. The attribute is therefore emitted **only when a block was PLACED**; the F7 fail-closed
  unknown-stage case (`blockedIndex === -1` with a non-null stage) likewise says nothing. Both
  restraints have their own case.
- **Commit:** `3d508f28f`

**3. [Rule 2 - Missing critical functionality] the claimed entries would otherwise have been said twice**

- **Found during:** Task 2, wiring the cause block in.
- **Issue:** The plan mounts `PublishRefusalList` above the spine but does not say what happens
  to the same entries in the shipped `named_failures` region below. Left alone, an
  `ask_undeclared` gap would render **once as a plain sentence and again as a raw `LintRow`**
  carrying its lowercase code, its phase **slug** and the backend **diagnostic** — every one of
  the three things T-214-10-01 says must never reach the author's screen.
- **Fix:** the generic list renders `named_failures.filter((e) => !isArgumentRefusal(e))`. The
  subtraction is proved by **inversion, not by deletion**: the fixture carries an ordinary
  `no_terminal` lint beside the two argument gaps, and the case asserts `no_terminal` and
  `wrap-up-77` are still on screen while `ask_undeclared`, `notify-abc123xyz` and *"declares no
  matching input"* are not.
- ⚠ The **verbatim** contract is untouched — `VerdictRow name="named_failures"` still reports
  `verdict.named_failures.length`, the server's own count.
- **Commit:** `3d508f28f`

## The measured surprise

⚠ **An entry can be one of the five kinds and still be UNPHRASABLE.** `REFUSE_UPSTREAM_UNREACHABLE`
interpolates three names; `REFUSE_NO_SOURCE` two. An `upstream_unreachable` entry arriving with
`upstream: null` — or any kind but `shape_unknown` with `argument: null` — would render a pair of
**curly quotes around nothing**: a fact nothing computed, printed as though it had been, on the one
surface in the product whose entire argument is that it does not do that.

The vocabulary module cannot prevent it (its `ArgumentGapFacts` fields are all required *precisely
so* a caller must hand over what it has), and the type cannot either (`argument` is legitimately
nullable). So `isArgumentRefusal` answers **two** questions rather than one: *is this ours?* and
*can we say it honestly?* An entry that fails the second **declines to the generic renderer**, where
the server's own diagnostic is at least true. Three cases drive it, including the positive control
that `shape_unknown` with `argument: null` is still claimed.

## Sketch 215's thirteen invariants — where each is asserted

| # | invariant | where |
|---|---|---|
| 1 | the step in the author's words; the slug absent | `PublishRefusalList.test.tsx` — occurrence COUNT, both halves, over a fixture carrying the slug |
| 2 | `shape_unknown` invents no argument | `PublishRefusalList.test.tsx` — the fixture DOES carry `recipient_list`; the headline does not |
| 3 | one headline, ≥ 1 next action per item | `PublishRefusalList.test.tsx` ×2 (count, and the rediscovery label) |
| 4 | no headline names a stage — **all ten** | `PublishGauntlet.test.tsx`, with a non-vacuity guard on both loops |
| 5 | no exclamation, no severity word | `PublishRefusalList.test.tsx`, needle driven RED first |
| 6 | the count agrees with the list | `PublishRefusalList.test.tsx`, `it.each([1, 2, 5])` |
| 7 | the spine sits BELOW the cause | `PublishGauntlet.test.tsx`, `compareDocumentPosition` |
| 8 | exactly one blocked stage; later stages not reached | `PublishGauntlet.test.tsx` ×3 (the block, at rest, and the unplaceable block) |
| 9 | no destructive colour | `PublishRefusalList.test.tsx`, whole subtree, with a subtree-size non-vacuity check |
| 10 | the blocked mark is an edge lane, never the corner | honoured by **drawing no mark at all** — see §3 above |
| 11 | the golden run says nothing was sent | `PublishGauntlet.test.tsx` ×2, both polarities |
| 12 | the gate is not retroactive | `PublishRefusalList.test.tsx` + `PublishGauntlet.test.tsx` |
| 13 | no wire id reaches the DOM | `PublishRefusalList.test.tsx`, over `innerHTML`, with a fixture that plants all four in the diagnostic |

## Threat register outcomes

| Threat ID | Outcome |
|---|---|
| T-214-10-01 | **mitigated** — `grep -c "\.message"` = 0 and `grep -c "blocked_stage"` = 0 on BOTH new modules; the slug and the diagnostic are absent from the read TYPE, so neither is in scope to render; asserted by occurrence count at the leaf and over the whole modal at the gauntlet |
| T-214-10-02 | **mitigated** — exactly one `STAGE_BLOCKED`, every later column `STAGE_NOT_REACHED`, and `not.toBe(STAGE_PASSED)` asserted at both polarities; plus the two silence cases |
| T-214-10-03 | **mitigated** — `dangerouslySetInnerHTML` occurs 0× in the source (read via `?raw`, with a non-vacuity check that the source loaded), and a step name of `<img src=x onerror=alert(1)>` renders as text with `container.querySelector("img")` null |
| T-214-10-04 | **mitigated** — a bare string, `null`, `undefined`, `42`, a judge criterion and a foreign lint code all render without throwing; the mixed-shape case asserts the split |
| T-214-10-05 | **mitigated** — `ALREADY_PUBLISHED_NOTE` lives INSIDE `PublishRefusalList`, so "renders with every refusal" is structural rather than remembered |
| T-214-10-SC | **mitigated** — nothing installed; no glyph added; `package.json` untouched |

## G-5 disposition — re-derived from git at execute time

| File | ledger cell | **measured 2026-08-28 (post-change)** | verdict |
|---|---|---|---|
| `frontend/src/components/workflows/PublishGauntlet.tsx` | 14 / 7 / 1025 | **16 / 8 / 1245** | ⚠ **FIRES** — the cell was stale by 2 commits, 1 phase and 220 lines before this plan touched it |
| `frontend/src/lib/api/workflows.ts` | *(inside the 207 split)* | **not modified by this plan** | n/a — read only, as the plan required |

**Honoured by construction, and the seam is named rather than taken.** This plan's whole diff on
the 1,245-line file is: **two imports, one derived constant, one mounted child, one filter, two
conditional nodes, one attribute and one `title` interpolation** — `118` insertions against `5`
deletions. All five refusal sentences, both next actions, the count line and the not-retroactive
note live in the new leaf and in `publishRefusalVocabulary.ts`. **That is the point**: this file's
growth pattern has been to render each new refusal shape inline, and this plan breaks it.

⚠ **The seam a future extraction should take is the BLOCK REGION AS A WHOLE** — the verdict
headline + the cause + the spine composition, currently ~180 lines of JSX split across two
non-adjacent places in the render. `PublishRefusalList.tsx` is the first component out through it.
`214-15` should record that seam in this file's `docs/HOT-FILE-LEDGER.md` section, and **update the
row to `16 / 8 / 1245`** — a row that is present and WRONG answers an auditor with `satisfied` and
stops the audit.

## Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit -p tsconfig.app.json` | **34 errors** — the wave-3 baseline, held across all three measurements |
| `npx vitest run PublishGauntlet.test.tsx PublishRefusalList.test.tsx` (`GSD_VITEST_MAX_WORKERS=2`) | **2 files passed · 100 tests passed · 42.79s** |
| `npx eslint` over all five touched files | **clean** (0 problems) |
| `grep -c "\.message"` on `PublishRefusalList.tsx` / `publishRefusalEntry.ts` | **0 / 0** |
| `grep -c "blocked_stage"` on the same two | **0 / 0** |
| `git diff -- PublishGauntlet.tsx \| grep -c "^+ *{ label:"` | **0** — no `STAGES` row added |
| F18 co-located `stage="…"`-literal assertion | **green, unchanged** |
| post-commit deletion check | **no files deleted** |

### ⚠ One red run, named before it was re-run, and it was NOT this plan's

The first paired invocation reported `Tests 2 failed | 98 passed` in **247.66s** — against
**42.79s** for the identical command twice afterwards, both `100 passed`. Following the SEED-171
procedure rather than reaching for the cap:

- **The failing case was captured from the trace BEFORE any re-run**: `named_failures
  key-detection: a MIXED list (lint dict + bare string) renders the lint row (lowercase code) AND
  the bare string as a block`, failing inside the shared `doPublish()` helper on
  `getByRole("button", { name: /run the checks/i })`.
- **It is provably unmodified by this plan.** `git diff --numstat` on the suite reads
  `241  0` — **241 insertions, ZERO deletions**. No shipped case was edited, and the failing one
  sits ~1,240 lines above the appended block.
- **This file documents the exact symptom in its own header**, from four prior investigations:
  *"46/46 green when this file runs ALONE, and 1-2 red when it runs inside the count gate's whole
  blast radius … it tracks LOAD, not any one phase's edit."* The 6× duration is that load.
- **The cap was not touched.** It was `GSD_VITEST_MAX_WORKERS=2` on all three runs.

⚠ Recorded as an observation, not as proof of innocence: two subsequent green samples do not make
a load-dependent suite deterministic. The claim made here is only *provably unmodified*.

## What this plan deliberately did NOT do

- **`BUG-260815-06` was honoured, not fixed.** Its trigger fired at this phase and was declined a
  second time (D-214-13). The other five stages' refusal copy is **byte-unchanged**; only the new
  refusal is written correctly. ⚠ Two declines is a signal the next phase must weigh.
- **`frontend/src/lib/api/workflows.ts` and `knowledge.ts` were READ, not edited.** `214-02` owns
  them in wave 1; `PublishNamedFailure` was consumed as documentation of the wire shape.
- **`publishRefusalVocabulary.ts` was not touched.** Its zero-imports claim and its
  character-identity contract against the generated build contract are `214-03`'s.
- **`STAGES` gained no row, and no `TARGETS`/`BASELINE` edit was made** — `214-15` owns every pin
  for this phase, in one commit, once every new file exists.

## Known Stubs

None. `onGoToStep` is an optional prop the gauntlet does not supply — the control renders
**disabled with an honest `title` naming where the fix lives**, which is the shipped `RunLink`
precedent (a disabled control with a stated reason, never a dead affordance). It is a declared
absence with its own case, not a stub: no future plan is required for the surface to be truthful,
and a call site that can navigate need only pass the handler.

## Threat Flags

None. This plan adds no network endpoint, no auth path, no file access and no schema change; it
renders data the gauntlet already received.

## Self-Check: PASSED

All five source/test artifacts and this summary exist on disk; both commits resolve in
`git log --oneline --all`.

| Claim | Verified |
|---|---|
| `frontend/src/components/workflows/PublishRefusalList.tsx` | FOUND |
| `frontend/src/components/workflows/PublishRefusalList.test.tsx` | FOUND |
| `frontend/src/components/workflows/publishRefusalEntry.ts` | FOUND |
| `frontend/src/components/workflows/PublishGauntlet.tsx` | FOUND |
| `frontend/src/components/workflows/PublishGauntlet.test.tsx` | FOUND |
| `214-10-SUMMARY.md` | FOUND |
| commit `0af16b150` | FOUND |
| commit `3d508f28f` | FOUND |
