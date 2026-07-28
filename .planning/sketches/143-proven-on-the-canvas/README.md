---
sketch: 143
name: proven-on-the-canvas
question: "How do you mark a proven step on the canvas when colour and badges are both already spent?"
winner: null
tags: [phase-185, govern-02, canvas-mark, non-colour-channel, badge-budget, colour-budget, phase-188-collision, greyscale-proof, g2-sketch-gate]
---

# Sketch 143: Seeing which steps are proven

## The question, in one line

You should be able to look at a workflow and tell **which steps are backed by your documents and which
are the AI thinking out loud** — in about three seconds, without reading anything.

## The constraint, and it is severe

- **No colour.** Sketch 137-B deliberately spends zero colour on the card so Phase 188 gets the whole
  budget for run status (running / needs you / failed). Governance may not spend any of it.
- **No third badge.** The face allows at most two word-badges and both are committed.

So the mark has to be made of **shape**, not hue. Operator settled this at intake on 2026-07-28.

Both variants also **delete** the `⛨ Must prove it` word-badge that ships today. That is the test: if the
channel works, the badge is redundant, and both badge slots go back to being free for Phases 188 and 189.

## How to View

```
open .planning/sketches/143-proven-on-the-canvas/index.html
```

Three things to do, written on the screen.

## The two variants

- **A: A sealed edge.** The card itself is drawn heavier — a double-struck border with a small seal in
  the corner, like a stamped document. Nothing is added beside the card; the card *is* the signal.
- **B: A proven rail.** A short stitched bar down the card's leading edge, sitting outside the border
  entirely. Less like a stamp, more like a marked file.

## What the comparison actually decides

The interesting result is not which looks nicer. It is **what happens when Phase 188 lands on top.**

Run status will be painted on the border with an outer glow — that is how the run surface already reads
elsewhere in the app. Set **Run state → Running** and watch the active step:

| | Proven still readable mid-run? |
|---|---|
| **A — sealed edge** | **Partly.** The status colour overwrites the border, so the double-struck edge is gone. The corner seal survives — which is the finding: *the corner mark, not the edge, is the part doing the real work* |
| **B — proven rail** | **Yes.** The rail is outside the border, so both readings sit on the card at once through all four run states |

**A's cost is paid at exactly the wrong moment** — a step's governance becomes hardest to read precisely
when that step is the one running or the one that just failed.

**B's cost is smaller but real:** a busier left edge on a 248px card, and the step number had to move to
the other side to make room. Less elegant. More honest under load.

## The greyscale proof

Switch to **No colour at all**. Both variants survive completely, because neither is made of colour —
that is the constraint doing its job.

**Note what does *not* survive.** With colour off during a run, the run status disappears entirely. That
is Phase 188's problem rather than this sketch's, but it is a finding worth carrying: **188 will need a
shape of its own too**, not just four colours.

## Grounding

Same realistic business workflow as sketch 142 (a monthly supplier risk report), for the same reason the
operator gave on 2026-07-28 — the shipped database rows are engineering fixtures whose names make a
readability question harder to judge, not easier. Real: the phase types, and which steps land in the
proven state under the rule sketch 142 settled (a step that reads your documents is proven; a judgement
step is not; a question-to-a-human has nothing to prove).

The flow sits at a fit-zoom so all five steps are on one screen — a scan you have to scroll is not a
scan, and a real `@xyflow/react` canvas does `fitView` on open anyway.

## What to Look For

1. **Look away, look back. Which steps are proven?** Under three seconds, no reading. If it takes longer,
   the channel is too quiet.
2. **Run state → Running, then Failed.** Can you read *both* things at once — what is happening now, and
   whether that step is proven? This is where A and B separate.
3. **No colour at all.** Does the proven mark survive?

## Verification

Driven in Chrome DevTools at 1440×900 across both variants × all four run states × both colour modes.
All five nodes fit on one screen with no horizontal scroll (measured, not assumed). Confirmed
mechanically that in A the active step's border colour is replaced by the run status while in B the 4px
rail persists underneath it. No console errors; inline JS passes `node --check`; zero inline `on*`
handlers.
