---
phase: 194-stop-a-running-workflow
plan: 04
subsystem: workflow-run-vocabulary
tags: [run-01, panel-spine, canvas-vocabulary, union-widening, a11y-announcer]
requires:
  - "migration 119 (194-02) — the workflow_phases_status_check literal `cancelled`, AUTHORED not applied"
  - "lib/phaseState.ts — the ONE derivation (188-05)"
  - "the exhaustive Record<> tables shipped by 188 and 189"
provides:
  - "Phase[\"status\"] gains a 9th ADDITIVE member: `cancelled`"
  - "CanvasReading gains a 9th member and an EXPLICIT canvasReading arm"
  - "DB_PHASE_STATUS maps migration 119's 7th CHECK literal"
  - "the panel word `Stopped` + the ■ mark (STATUS_META row 9)"
  - "the panel announcer arm — the consumer tsc cannot ask for"
  - "the canvas sentence `Stopped by you — you ended the run while this step was still working`"
  - "the ring cut exactly in half — the only spec whose dash equals its gap"
  - "V-18 and V-19 client-half fences, each driven RED"
affects:
  - "every surface reading Phase[\"status\"] or CanvasReading — panel spine, canvas card, run line, announcer"
tech-stack:
  added: []
  patterns:
    - "additive union widening AS THE MECHANISM — the compiler enumerates the consumers"
    - "the written consumer list for the switch with a fall-through arm, which tsc is silent about"
    - "fences scoped over composed VALUES, never module source (193.2 F-3)"
key-files:
  created: []
  modified:
    - frontend/src/types/index.ts
    - frontend/src/lib/phaseState.ts
    - frontend/src/lib/phaseState.test.ts
    - frontend/src/components/panel/phaseStatusMeta.ts
    - frontend/src/components/panel/PhaseTimeline.tsx
    - frontend/src/components/panel/__tests__/PhaseTimeline.test.tsx
    - frontend/src/components/workflows/runVocabulary.ts
    - frontend/src/components/workflows/runVocabulary.test.ts
    - frontend/src/components/workflows/NodeRunOverlay.tsx
    - frontend/src/components/workflows/PhaseNode.test.tsx
    - frontend/src/components/workflows/PhaseNodeCard.test.tsx
decisions:
  - "The mark is ■, chosen by MEASUREMENT: 1 render in frontend/src, carrying no second meaning. ⊘ rejected — it renders for TWO concepts. ⏹ refused outright — net-new."
  - "RUN_READING_BORDER gets NO row — a stated decision, pinned, not an omission."
  - "The stopped reading carries a CLAUSE, against this table's default, because the word alone leaves D-13's honesty question open."
  - "The panel says `Stopped` (the STEP); the run-level word stays `cancelled` (the RUN). Two subjects, two words."
metrics:
  duration: "~50 min"
  completed: 2026-08-16
---

# Phase 194 Plan 04: The Client Says Stopped — Summary

Widened `Phase["status"]` and `CanvasReading` with a ninth additive member so a stopped
run's interrupted phase reads **Stopped** on the panel spine instead of **Unknown**, and
stated the new state at every one of the eleven consumers the compiler named plus the one
it structurally could not.

---

## The gap, recorded rather than just closed

**Neither `194-RESEARCH.md` nor `194-PATTERNS.md` mapped this surface.** Both documents
traced the stopped-state vocabulary to `RunCard.statusGlyph` / `statusWord` — the RUN-level
chat receipt — and neither names `Phase["status"]` anywhere. The panel spine's status
vocabulary is a **second, independent closed union**, and it was found by reading the union
rather than by reading the research.

**The consequence was measured, not reasoned.** A probe was driven against the base module
extracted verbatim from `725b2140` (`git show 725b2140:frontend/src/lib/phaseState.ts`),
importing it alongside the shipped `Phase` type:

```
phaseStatusFromDb("cancelled") === "unknown"     PASSED
canvasReading({status:"cancelled"}) === "unknown" PASSED
phaseStatusFromDb("recorded_not_sent") === "recorded-not-sent"  (positive control) PASSED
```

So before this plan a stopped run's interrupted phase rendered **"Unknown"** on the spine —
fail-CLOSED and therefore not a lie, but not D-13's *"the interrupted phase reads stopped,
not failed"* either, and a fail on G-4 lived-experience row 1. Both probe files were deleted
in the same task and never committed.

---

## The mechanism fired: the eleven armed errors

After Task 1(a)–(d) and **before** any downstream table was filled,
`npx tsc -p tsconfig.app.json --noEmit` moved **33 → 44**. All eleven new errors are
`TS2741: Property 'cancelled' is missing`:

| # | File:line | Table |
|---|---|---|
| 1 | `components/panel/phaseStatusMeta.ts(50,7)` | `STATUS_META` |
| 2 | `components/workflows/runVocabulary.ts(79,14)` | `RUN_READING_WORD` |
| 3 | `components/workflows/runVocabulary.ts(189,7)` | `STATIC_CLAUSE` |
| 4 | `components/workflows/runVocabulary.ts(389,14)` | `RING_GEOMETRY` |
| 5 | `components/workflows/NodeRunOverlay.tsx(134,7)` | `RING_STROKE` |
| 6 | `lib/phaseState.test.ts(71,7)` | `PAINTABLE_TABLE` |
| 7 | `lib/phaseState.test.ts(93,7)` | `ALL_PHASE_STATUSES` |
| 8 | `lib/phaseState.test.ts(106,7)` | `EXPECTED_READING` |
| 9 | `components/workflows/PhaseNode.test.tsx(382,7)` | `ALL_READINGS` |
| 10 | `components/workflows/PhaseNodeCard.test.tsx(182,7)` | `ALL_READINGS_TABLE` |
| 11 | `components/workflows/PhaseNodeCard.test.tsx(2859,7)` | `CARD_READING_SHAPES` |

That list names all six files the plan's acceptance required. The arc back: **44 → 40**
(Task 2) **→ 33** (Task 3), i.e. exactly `194-BASELINE.md`, with **zero** `@ts-ignore`,
`@ts-expect-error` or `any` anywhere in the base→HEAD diff.

**⚠ NOT ONE of the eleven was the announcer.** `milestoneFor` carries a fall-through arm, so
tsc is silent about it — the arm came off the plan's written consumer list, exactly as 189's
did, and was driven RED first (below).

---

## The mark, chosen by measurement

Measured across `frontend/src`, excluding `__tests__` / `*.test.*`:

| Candidate | Renders | Concept each occurrence carries | Verdict |
|---|---|---|---|
| `■` | **1** — `chat/RunCard.tsx:534` `statusGlyph` (+ 1 prose mention in `WorkspacePanel.tsx:296`, a 194-03 docblock) | **the cancelled state, and nothing else** | **CHOSEN** |
| `⊘` | **2** — `pages/WorkflowRunPage.tsx:299` `"⊘ Cancelled"`; `admin/ModelDiscoveryPanel.tsx:504` `glyph="⊘"` "No longer offered" (+2 prose) | **TWO concepts** | rejected |
| `⏹` | **0** | none — net-new, absent from `icon-convention.md` §4 | **refused outright** |
| lucide `<Square/>` | 3 — composer, active-runs tray, and 194-03's panel Stop | the Stop **CONTROL**, not a state | n/a (different thing) |

**⚠ RESEARCH's three-mark table is corrected: there is a FOURTH and it ships.**
`WorkflowRunPage.tsx:299` renders `"⊘ Cancelled"` as the run band's cancelled sentence, and
RESEARCH's table does not list it. That correction is what turns `⊘` from a plausible pick
into a two-meaning collision.

**The choice spends zero net-new glyphs**, which is §4's actual requirement. And 194-03 drew
the complementary half of the same line hours earlier: it refused `■` for its Stop *button*
because *"that is RunCard's cancelled-STATE glyph, a state and not a control"*. This plan
adds a **state**, so the two decisions agree by construction rather than by luck.

**The count-based evidence check (step 5) came back clean, measured rather than assumed.**
`phaseStatusMeta.ts`'s header rests a shipped claim on the *rejected* mark's occurrence
count **in that file**. That mark is `⊘`; its count there is **0 before this plan and 0
after**, because `■` was chosen and because this plan's new comment deliberately does not
spell `⊘` either. **So the shipped claim is UNDISTURBED and no `SUPERSEDED` rewrite was
owed.** `PhaseTimeline.test.tsx:348`'s `expect(glyph).not.toBe("⊘")` is scoped to the
`recorded-not-sent` row and stayed **GREEN — proved by running it, not by reading it** — and
`git diff -U0` on that file reports **zero deleted lines**, so it is unedited.

**One inherited fact recorded, not fixed here:** `■` and the lucide `Square` are the same
shape serving a state and a control. If a later phase decides those may not share a shape,
that is a convention change across all five sites at once — not a thing to settle in one
table. Re-open trigger: any phase that revises `icon-convention.md` §4's canvas glyph table.

---

## The announcer, driven RED first

With the row in `STATUS_META` but **no arm** in `milestoneFor`, the new case failed:

```
× announces `stopped` for the new terminal, and never `complete` or `failed`
  AssertionError: expected '' to be 'Phase 2 of 2, notify, stopped'
  Tests  1 failed | 27 passed (28)
```

The **empty string** — the silence the file's own docblock predicts, and exactly the state a
screen-reader user was being left in. Exactly one case failed, which is what proves the
announcer is an independent gap rather than a consequence of the vocabulary row.

The fall-through arm **STAYS**: `grep -c "default:" PhaseTimeline.tsx` reads **3 → 3**.

---

## Fences driven RED — seven plants, each clause independently

Every plant was made in **production source**, observed, reverted, and the file confirmed
**md5-identical**. Pre-plant md5s: `phaseState.ts` `17d91acd…`, `phaseStatusMeta.ts`
`7f4ceee4…`, `runVocabulary.ts` `741d3bcc…` — all three matched exactly after every revert.

| # | Plant (production source) | Fence that fired | Observed failure |
|---|---|---|---|
| 1 | `phaseState.ts` — `case "cancelled": return "done"` | **V-18** | `expected [ 'done', 'done', 'not-started' ] to deeply equal [ 'done', 'cancelled', 'not-started' ]` (+3 others) |
| 2 | `phaseStatusMeta.ts` — `text: "Failed"` | **V-19** (panel) | `the stopped word must not be Failed: expected 'Failed' not to be 'Failed'` |
| 3 | `phaseStatusMeta.ts` — `text: "Skipped"` (**separate** plant) | **V-19** (panel) | `the stopped word must not be Skipped: expected 'Skipped' not to be 'Skipped'` |
| 4 | `runVocabulary.ts` — canvas word `"Failed"` | V-19 (canvas word) | `expected 'Failed' not to be 'Failed'` |
| 5 | `runVocabulary.ts` — canvas word `"Stopped"` (the **panel's** word) | two-vocabularies (D-188-02) | `expected 'Stopped' not to be 'Stopped'` |
| 6 | `runVocabulary.ts` — clause → `"— no deliverable produced · partial work discarded"` | **D-13 no-discard** | `the stopped sentence must not claim work was discard: expected 'stopped by you — no deliverable produ…' not to contain 'discard'` |
| 7 | `runVocabulary.ts` — ring spec ← a copy of `failed`'s | ring + dash-equals-gap | `expected { …(3) } to not deeply equal { …(3) }` **and** `expected [] to deeply equal [ 'cancelled' ]` |

**Two results are worth more than the RED itself.**

1. **Plant 6 was the sketch's own operator-approved copy, verbatim** —
   `workflow-run-surface.md:25`'s *"partial work discarded"* — and the D-13 fence caught it.
   Exactly **one** case failed, so that clause is live and is not redundant with any other.
2. **Plant 5 proves non-redundancy directly, which is what the brief's lesson 1 demands.**
   It reds the two-vocabularies clause while the failed/skipped clause stays **GREEN**
   (re-run in isolation: `1 passed | 31 skipped`). A single plant reding both would have
   left one of them potentially inert; separating them proves neither is.

Plants 2 and 3 are deliberately separate for the same reason — the 193.2 *"two arms, one
assertion"* lesson.

---

## The ninth CARD_READING_SHAPES entry — a NEW capture, not a re-capture

`git diff` on that literal is a **pure addition**: not one of the eight 188.2-03 baselines
was re-read, re-run or re-written, so all eight stay exactly as load-bearing as before.

Every value was read out of the rendered DOM by running `cardShapeOf({ status: "cancelled" })`,
never typed from source. The capture was **observed twice and the two dumps compared before
either was written**: both `d235a365378bc540b2a6ab88c5e94f64`, `diff -q` clean.

The arc row: `strokeDasharray "106.814 106.814"`, `strokeDashoffset "53.407"`,
`stroke "hsl(var(--muted-foreground))"` — the only capture in the matrix whose two dash
numbers are equal.

**⚠ One process error, caught by the suite and recorded rather than smoothed:** the block
first landed at the end of `CARD_BORDER_SHAPES`, not `CARD_READING_SHAPES`. It typechecked
silently because `CARD_BORDER_SHAPES` is a `Record<string, …>` — an untyped key space
accepts anything. It was caught by three failing cases (`expected [ 'done', 'failed', …(6) ]
to deeply equal [ 'cancelled', 'done', …(6) ]`) and moved by line-exact splice with boundary
assertions. *A literal with a `Record<string, …>` key type gives no compiler help about
where its keys belong.*

---

## Decisions

**`RUN_READING_BORDER` gets NO row — a STATED decision.** Two reasons pointing the same way:
a stopped step is a *quiet* terminal (nothing broke, nothing is owed), and it is the one
state on this surface the person already knows about before the canvas tells them — they
pressed Stop. Spending the accent to announce a fact the user just caused would dim the two
readings that genuinely need to pull the eye. Because the table is a `Partial<>` this absence
is invisible to the compiler, so it is **pinned** (`hasOwnProperty` false, plus the whole
claimant set asserted as `["failed","running","waiting-for-you"]`) as well as commented.

**The stopped reading carries a CLAUSE, against this table's own default.** The rule is that
a clause is carried by readings a person cannot act on from the word alone; here the word
says what happened and who did it, and leaves open the one thing that matters for honesty —
did this step finish? It did not. That is precisely D-13's requirement.

**Two words, two subjects.** The panel says **`Stopped`** (the STEP); the run-level word
stays **`cancelled`** everywhere it already ships (`RunCard.tsx`, `WorkflowRunPage.tsx`, both
untouched). A run is cancelled; the step that was mid-flight was stopped.

**The colour budget did not move.** The new ring stroke reuses the muted token, so
`new Set(strokes).size` is **UNMOVED at 5** for a second consecutive widening while the
reading set grew to 9. That twice-unmoved number is the evidence that the shape channel
carries both new readings alone.

**Widening `CanvasReading` rather than collapsing to `unknown`.** The collapse was the
tempting option and nothing would have gone red — no compiler error, no failing test. But
`unknown` means *"a row that EXISTS and carries a status this client does not recognise"*,
and we recognise this one. A fallback that claims **less** than its input supports is the
mirror image of the fail-open this module exists to refuse.

---

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 1 — Bug] My own prose falsified the `default:` acceptance grep**
- **Found during:** Task 1 acceptance check
- **Issue:** Two new comments in `phaseState.ts` spelled `` `default:` ``, moving
  `grep -c "default:"` from **1 to 3** with no code change at all — the exact needle the
  acceptance criterion measures, and the exact trap the brief flagged.
- **Fix:** Reworded both to "the fall-through arm" / "arm 4", matching the file's own
  existing habit (the shipped docblock already writes `` `default` `` without the colon).
  Count restored to **1 → 1**. The measurement is recorded **in the code comment**, so the
  next editor learns it from the file rather than from this summary.
- **Files modified:** `frontend/src/lib/phaseState.ts`
- **Commit:** `b29d2963`

**2. [Rule 3 — Blocking] `TS6133: 'glyph' is declared but its value is never read`**
- **Found during:** Task 2 typecheck
- **Issue:** The collision case destructured `[glyph, text]` and used only `text`.
- **Fix:** Used it, and used it *better* than a re-typed literal would have —
  `expect(shippedGlyphs).not.toContain(glyph)` compares against the mark the row **actually
  rendered**, so the assertion tests the table rather than the author's ability to copy a
  character.
- **Files modified:** `frontend/src/components/panel/__tests__/PhaseTimeline.test.tsx`
- **Commit:** `3a7e87e4`

**3. [Rule 2 — Missing coverage] `cancelled` added to `SHARED_SPELLINGS`**
- **Found during:** Task 3
- **Issue:** Migration 119's slug is spelled identically to the ninth `CanvasReading` member,
  which makes it a **third** shared spelling — a category `PhaseNode.test.tsx` already
  models. Left out, the render fence would not have swept it.
- **Fix:** Added. The consequence is the point: the DB word is now swept out of the adapter's
  code **and out of the rendered card face at every reading**, so the canvas's business
  sentence can never quietly become the database's word for it. Green.
- **Files modified:** `frontend/src/components/workflows/PhaseNode.test.tsx`
- **Commit:** `76d1e87c`

### Count assertions moved (not "shipped rows changed")

Six inventory counts had to move; each carries an in-place `8 → 9`-style note in the 189
habit. None is a shipped row's value: `PAINTABLE.size` 8→9, `RECONCILABLE.size` 7→8,
`PHASE_STATUSES` 8→9, `EXPECTED_READING` distinct 7→8, `ALL_READINGS.length` 8→9,
`RUN_READING_WORD` keys 8→9. **`git diff -U0` on `runVocabulary.ts`, `NodeRunOverlay.tsx`
and `phaseStatusMeta.ts` reports ZERO deleted lines** — all three are pure additions, so no
shipped row's glyph, text, class, clause, ring or stroke moved.

---

## Verification

| Gate | Result |
|---|---|
| `tsc -p tsconfig.app.json --noEmit` | **33** — exactly `194-BASELINE.md` (33 → 44 armed → 40 → 33) |
| Suppressions in base→HEAD diff | **0** `@ts-ignore` / `@ts-expect-error` |
| Five touched suites | **271 passed, 0 failed** |
| `vitest-count-gate.cjs` (`GSD_VITEST_MAX_WORKERS=2`) | **count gate OK** — 75/75 pinned present, no per-file decrease, **failed 0**, total **3954** (baseline 3930, pinned 3868) |
| `git diff --name-only 725b2140` | exactly the **11** files in `files_modified` |
| Files deleted | **none**, at every commit |
| `STATE.md` / `ROADMAP.md` / `REQUIREMENTS.md` | **untouched** — no `gsd-sdk state.*`, `roadmap.*` or `requirements.*` verb was called |

`PhaseTimeline.test.tsx` 17 → 28 cases (+11). The count gate ran once, first time, `failed 0`,
so no failing-filename capture was owed.

**G-5:** none of the eleven files is a row on the hot-file ledger (`PhaseNodeCard.tsx` is,
but this plan touches only `PhaseNodeCard.test.tsx`). No refactor recommendation is owed and
no guardrail override was taken.

---

## What the next plan inherits

- The DB slug now reaches the client. **Migration 119 is still AUTHORED, NOT APPLIED** — the
  live apply is plan 194-12 (Wave 7), so no real run can produce this status yet.
- **Plan 194-05 owes the sketch amendment.** `workflow-run-surface.md:25`'s *"partial work
  discarded"* is the clause D-13 forbids, it is now proved catchable (plant 6), and the
  amendment must be recorded **beside** the operator-approved original.
- `stopThread`'s silent no-op window (`StreamsProvider.tsx:2408`) is untouched and remains
  out of scope; `StreamsProvider.tsx` belongs to plan 194-08.
- The ninth reading's **assertable unique property** is *the only ring whose dash equals its
  gap*. A tenth reading must pick a property no row already owns: no-arc, spin, solid, 2
  arcs, 4 arcs, dash-equals-gap, and the two `length` textures are all taken.
- `gapCentre` values now claimed: `null`, `0.125`, `0.375`, `0.5`, `0.75`.

## Self-Check: PASSED

- `frontend/src/types/index.ts` — FOUND, contains `cancelled`
- `frontend/src/lib/phaseState.ts` — FOUND, contains `cancelled`
- `frontend/src/components/panel/phaseStatusMeta.ts` — FOUND, contains `cancelled`
- `frontend/src/components/panel/PhaseTimeline.tsx` — FOUND, contains `cancelled`
- `frontend/src/components/workflows/runVocabulary.ts` — FOUND, contains `cancelled`
- `frontend/src/components/workflows/NodeRunOverlay.tsx` — FOUND, contains `cancelled`
- Commits `b29d2963`, `3a7e87e4`, `76d1e87c` — all FOUND in `git log`
