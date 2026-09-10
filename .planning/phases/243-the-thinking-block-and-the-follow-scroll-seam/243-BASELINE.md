---
phase: 243
kind: baseline
measured_at: 2026-09-11
base_commit: 96adfd668
tree: "main working tree, quiet, no sibling agent, run from the repo root"
---

# Phase 243 — the gate baseline, measured BEFORE the first edit

⚠ **Read this before writing any acceptance criterion.** The frontend count gate is **RED at the
base commit**, and it is red for reasons this phase did not cause and does not own.

## The verdict line, read verbatim rather than summarised

```
  total                                      7170    7940    +770
  total 7940  ·  failed 2  ·  pinned total 7170
  FAIL  [failing-tests] 2 test(s) failed — the gate requires 0.
```

Command: `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs`, from the **repo root**.

| | measured 2026-09-11 | CLAUDE.md's last published correction (2026-09-07, Phase 238) |
|---|---|---|
| grand total | **7940** | 7816 |
| pinned total | **7170** | 7020 |
| failed | **2** | 0 |

⭐ **A growing total is the gate WORKING** — its contract is *no per-file DECREASE* and *zero
failing*, never a fixed grand total. The `+124 / +150` since Phase 238 is Phases 238-241 landing.
**The `failed 2` is the part that matters.**

## The failing SET, captured from the gate's own persisted JSON BEFORE anything was re-run

This is `SEED-171`'s procedure and it was followed, not paraphrased. The set — not a count:

| # | File | Test | Signature |
|---|---|---|---|
| 1 | `src/components/library/__tests__/sketchComposition.test.tsx` | *§2 positive controls › the page renders its heading — the mount harness works* | `Error: STACK_TRACE_ERROR` at `sketchComposition.test.tsx:317` |
| 2 | `src/components/library/__tests__/sketchComposition.test.tsx` | *§2 positive controls › the four shipped tab triggers render — the tab bar is already built* | `TestingLibraryElementError: Found multiple elements with the role "tab" and name "Documents"` |

## It is INHERITED, and that is a measurement rather than an assumption

- `git diff --numstat HEAD -- frontend` → **EMPTY**
- `git status --porcelain -- frontend` → **EMPTY**

Nothing in `frontend/` differs from the base commit, so **no edit of this phase's can be the
cause.** The suite last moved at `69a185f49` *"feat(health): composition donuts, full-width trend,
no format left out"*, three commits after the Phase 217.1 work that created it.

⚠ **Only ONE of the two carries the flake signature.** #1 is `STACK_TRACE_ERROR` — the
oversubscription/timeout tell. #2 is a plain `TestingLibraryElementError` about **duplicate
`role="tab"` nodes named "Documents"**, which is a *deterministic DOM assertion*, not a clock.
CLAUDE.md's own correction of 2026-08-17 (§(b)) is explicit that **`STACK_TRACE_ERROR` is NOT a
reliable tell for "not a real defect"**, and here the second failure is not even wearing it.
**Say "provably unmodified by this phase", never "fine".**

~~⛔ **It is NOT one of `SEED-171`'s five named cap-independent flaky suites** — those are
`WorkflowsPage.test.tsx`, `library/WorkflowCard.test.tsx`, `WorkflowBuilderPage.session.test.tsx`,
`WorkflowRunPage.test.tsx`, `WorkflowBuilderPage.canvas.test.tsx`. This is a sixth file, in the
**Library** surface, and it is being recorded here rather than absorbed.~~

⚠⚠ **THAT PARAGRAPH IS WRONG AND IS STRUCK THROUGH RATHER THAN DELETED, BECAUSE *WHY* IT IS WRONG
IS THE USEFUL PART.** It was written from **CLAUDE.md's** list, which says *"`SEED-171`'s five
cap-independent flaky suites"*. **The seed itself says SEVEN**, and
`library/__tests__/sketchComposition.test.tsx` has been in it since **2026-09-06**, where it is
recorded with **this exact failing pair, verbatim** — including the duplicate-`role="tab"`-named-
"Documents" error — and reproduced again at **2026-09-10** (Phase 241, plan `241-03`).

⭐ **So this is the THIRD reproduction of a known fingerprint, not a new suite.** And the register
drift is itself a finding of the kind this project keeps paying for: **CLAUDE.md's summary is
stale by two suites against the seed it summarises**, so an agent that trusts the index instead of
the register mis-classifies a known flake as a new one. That is what happened here, in the space of
one file. `SEED-171` gains a sighting; CLAUDE.md's "five" is flagged, not silently fixed inside a
phase that does not own it.

⚠ **It is also NOT the standing red CLAUDE.md already names.** That one is
`src/components/sources/sourceComposition.test.tsx` (~18 failed / 31 passed), which sits in
**neither** gate knob by a Phase 235 decision and is therefore invisible to the verdict line.
`library/__tests__/sketchComposition.test.tsx` **is** in `TARGETS` and **does** turn the shared
gate red. Two different files, similar names, opposite gate visibility.

## ⭐ The two failures are ONE failure, and it is a flake — driven, not reasoned

Run in ISOLATION at the same base commit, immediately after the red gate run:

```
npx vitest run src/components/library/__tests__/sketchComposition.test.tsx --maxWorkers=2
 Test Files  1 passed (1)
      Tests  46 passed | 1 skipped (47)
   Duration  6.36s
```

**46 passed. Both gate failures are green in isolation.**

⚠ **And the two are causally ONE.** Failure #1 times out at `sketchComposition.test.tsx:317`, so
its cleanup never runs and its render tree stays mounted; failure #2 then finds **two**
`role="tab"` nodes named "Documents" because it is looking at two mounted copies of the page.
Verified structurally rather than guessed: `grep -rn "TabsTrigger" pages/LibraryPage.tsx
components/library/*.tsx` shows the Library's five tabs declared **once**, and the only other
`TabsTrigger` block is `IngestionTab.tsx`'s four **sub**-tabs (`Add files`, `In progress`,
`Needs attention`, `History`) — none named "Documents". **There is no duplicate-tab defect in the
product.** #2 is a cascade artefact of #1, which is why "2 failed" overstates the finding.

⛔ **This is a KNOWN suite in `SEED-171` (set size: seven), on its THIRD recorded reproduction** —
2026-09-06 (Phase 237 baseline), 2026-09-10 (`241-03`), and now 2026-09-11. It sits **outside**
this phase's blast radius (Library, not chat), and this sighting is appended to the seed rather
than absorbed here.

⭐ **The third reproduction is worth more than the first two**, because the seed's strongest lead
is that the duplicate accessible name is *DOM left over from a sibling test in the same worker*.
This run adds the causal step the earlier sightings inferred: **failure #1 times out and never
cleans up, and failure #2 is what the next test sees.** Same worker, same pair, same order,
three times.

⚠ **ONE GREEN SAMPLE OF A FLAKY SUITE IS NOT PROOF OF INNOCENCE.** The honest statement is
*"provably unmodified by this phase, and green on one isolated run"* — never *"fine"*. The cap was
`2` on both invocations and was neither adjusted nor needed.

## ⛔ The consequence for every plan in this phase

**`count gate OK` is NOT a reachable acceptance criterion at this base**, and a plan that writes
one has written a criterion that cannot pass — for reasons no plan in this phase controls. That is
the ROADMAP's own warning about criterion-writing, now concrete.

**Write acceptance criteria as a SET DIFF against this file instead:**

1. The failing set is **exactly these two, and no others**. A third failure is this phase's, until
   proven otherwise by the same JSON-first procedure.
2. **No per-file DECREASE** on any pinned file (that is the gate's real contract).
3. The **explicitly-run in-scope suites** are green — those are deterministic and are what a plan
   actually owns. For this phase that means, at minimum:
   `src/components/chat/RunCard.test.tsx` · `RunCard.timer.test.tsx` ·
   `__tests__/RunCard.characterization.test.tsx` · `src/__tests__/components/MessageItem*.test.tsx` ·
   `src/__tests__/components/chat/MessageList*.test.tsx` · `src/__tests__/hooks/useFollowScroll.test.ts`

⚠ **If the gate reds with a THIRD failure: capture the filenames from the persisted JSON FIRST,
check each against `git diff --numstat 96adfd668 HEAD`, and do NOT reach for the worker cap.**
The cap held at 2 and produced this result on the first invocation; adjusting it is measured not
to fix failures of this shape (CLAUDE.md correction 2026-08-17 §(b)).

## The typecheck baseline

⚠ `npx tsc --noEmit` in `frontend/` checks **ZERO files** — `tsconfig.json` is solution-style.
Use `npx tsc -p tsconfig.app.json --noEmit` and measure a **set diff** against the base's **67
errors**; "zero errors" is not reachable here either.

## What this baseline does NOT excuse

The two failures above are **not this phase's to fix**, and equally **not this phase's to hide**.
They are recorded so that:

- a later reader can tell *"checked, inherited"* from *"nobody checked"*, and
- the phase's VERIFICATION.md can state the gate's colour honestly instead of claiming a green it
  never had.

~~⭐ Whether `sketchComposition.test.tsx`'s duplicate-`role="tab"` failure is a **real Library
regression** is an open question this phase deliberately does not answer.~~

⚠ **ANSWERED, in the same sitting, and the original is struck through rather than deleted —
because the question being ANSWERABLE for the price of one 6-second run is the finding.** It is
**not** a Library regression: the suite passes 46/46 in isolation, the product declares its five
Library tabs exactly once, and failure #2 is a cascade off failure #1's timeout. See the section
above. **No reported-bug is owed; `SEED-171` gains a sixth suite.**
