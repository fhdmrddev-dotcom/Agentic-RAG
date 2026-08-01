---
sketch: 148
name: the-step-that-says-what-it-does
question: "Can a node face say what THIS step does, not what its TYPE does?"
winner: "C"
winner_note: "C is the display ladder; A is folded in as a SEEDING behaviour that fills C's top tier. Not rivals — they compose."
tags: [canvas, vocabulary, node-face, phase-187, VOCAB-01, VOCAB-02]
phase: 187
---

# Sketch 148: The step that says what it does

## Design Question

Phase 187 SC#5 sets the acceptance bar as *"no jargon leak, no over-simplification — not a toy
demo."* This sketch tests whether the shipped node face can clear it.

**The problem, measured not assumed.** The shipped `nodeTitle()`
(`frontend/src/components/workflows/phaseVocabulary.ts:169`) resolves in three tiers: a real
`phase.name` wins, else a plain-language sentence for the *phase type*, else the raw type. But:

- Only **10 of 119** live phases carry a real `phase.name` (`phaseVocabulary.ts:123`).
- The NL generator authors a **definition-level** `name` only (`workflow_authoring.py:88`) — it
  never writes a per-step name.

So the dominant node face is the type sentence, and there are only six of them. **Every AI-seeded
workflow — VOCAB-02's headline feature — renders the same six lines.** In the scenario here, steps
2 and 3 are letter-for-letter identical (`"Work out how to do it"`) though one finds renewal terms
and the other applies a pricing policy. The seed problem and the vocabulary problem are one problem.

## How to View

```
open .planning/sketches/148-the-step-that-says-what-it-does/index.html
```

Scenario: a **supplier contract renewal review** — 5 steps, procurement. Every field the strategies
read (`phase_type`, `available_tools`, folder, bound skill, template) is a field that exists today.

## Variants

- **◫ Compare all four** *(default tab — added after the first review)* — all four strategies as
  rows over the same five steps, plus a three-column scorecard computed from the cells. See
  *Review note* below for why this exists.
- **Today (shipped)** — the baseline, so the failure is visible rather than argued. Steps 2 and 3
  render identically. Flagged in red by the *Flag identical faces* button.
- **A: AI-authored names** — the generator writes a per-step name at seed time, stored in
  `phase.name`. Maximally specific; can say things no config knows ("due this quarter").
- **B: Config-derived** — the face is a pure function of the step's real config (folder → bound
  skill → template), computed at render, never stored. Same shape as the shipped
  `groundingCauseOf` derivation.
- **C: Layered** — author name → config-derived → type sentence. One tier inserted into the
  shipped ladder; additive rather than a replacement.

## What to Look For

**1. Press ✎ Re-bind step 3's skill.** This is the deciding test. It changes the bound skill from
`pricing-policy-check` to `contract-risk-flags` and asks each strategy what the face says now:

| | Step 3 after the re-bind | |
|---|---|---|
| Today | "Work out how to do it" | never specific enough to be wrong |
| **A** | "Check each one against the pricing policy" | **stale — the face now lies** |
| B | "Run the contract risk flags" | tracked |
| C | "Run the contract risk flags" | tracked |

A stored name has no invalidation story. It needs one (re-generate on every config edit, or mark
it "written before this change") or it silently misdescribes the step.

**2. Look at step 5 across B and C.** Step 5 is the one step an author named by hand
("Board-ready renewal pack") — the 10-of-119 case. **B discards it** in favour of the template
filename. Config-only doesn't just add a tier, it *removes* the one we already ship. This is the
argument for C, and the sketch demonstrates it rather than asserting it.

**3. The generic floor is honest, not a bug.** Step 1 (`programmatic`, nothing bound) falls back to
"Prepare the inputs" under B and C. A derived face can only ever be as specific as the config. The
question is whether that floor is acceptable or whether A's tier is needed on top.

## Constraints Respected

Drawn from the **shipped 137-B** card (`PhaseNodeCard.tsx`, read 2026-08-01), *not* from
`themes/canvas-184.css`, which is the superseded 137-D language — 185-01 rebuilt the card, so the
sketch-era CSS would draw a card that no longer exists. Geometry: 260×104 node box, 248px card,
radius 22, padding 42/20/20, mark 62×62 at `left-1/2 top-[-26px]`, seal at `top 11 / right 17`.

- Title is `truncate` at 14px in a 248px card — **long derived titles clip**. Watch step 5 under B.
- At most **two** badges (a third is a typecheck error); only the armed step spends one here.
- Top-right corner is the governance seal's and is not touched.

## Review note — why the compare tab exists

The operator's first review reported **"no difference between the three variants."** Verified in
Chrome: the variants rendered correctly and *did* differ. The sketch was at fault twice, and both
faults are worth recording because they generalise:

1. **The deciding card was off-screen.** The flow scrolls horizontally; step 5 — the *only* step
   where B and C disagree — sat past the right edge at 1036px. The evidence for the winning
   variant was not visible.
2. **Tab-switching outsources the comparison to memory.** Asking a reader to hold five sentences
   in their head across a tab switch is not a comparison, it is a memory test. Differences that
   are semantic rather than positional need to be *co-present*.

A variant sketch whose variants differ *semantically in the same position* needs a side-by-side
view, not just tabs. The tabs are still there for the lived feel of a real canvas; the grid is
where the decision is actually made.

## Open Question Carried Forward

If C wins, the staleness question does not disappear — it moves. C keeps author names on top, and
an author name can go stale exactly as A's does. Decide deliberately: does a hand-written name that
predates a config edit stay on the face, or get marked?
