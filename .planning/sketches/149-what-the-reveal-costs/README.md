---
sketch: 149
name: what-the-reveal-costs
question: "When ⌥ Technical-names is ON, what should the canvas card show?"
winner: "C"
winner_note: "Swap the SUBTITLE, not the title. Keeps 148-C's now-meaningful plain title, spends no slot, leaves technicalLine to Phase 188."
tags: [canvas, vocabulary, technical-names, phase-187, VOCAB-01]
phase: 187
depends_on: 148
---

# Sketch 149: What the reveal costs

## The question is narrower than the roadmap implies

Phase 187 SC#1 asks for plain-language names "with a Technical-names reveal." Audited on
2026-08-01, **the reveal is already fully shipped on the canvas**:

| Piece | Where |
|---|---|
| One app-wide boolean, localStorage, default off | `TechnicalNamesProvider.tsx` (Phase 154 / LANG-01) |
| The toggle, already in the canvas toolbar | `WorkflowCanvas.tsx:1285` |
| `technical` merged onto every node's data | `WorkflowCanvas.tsx:945` |
| The title swap | `PhaseNode.tsx:144` |
| The **same** swap on the vertical spine | `PhaseSpineGraph.tsx:125` |

Both graph views already agree, which is exactly what `phaseVocabulary.ts` exists to guarantee.
So "wire a reveal onto the canvas" is **not** work this phase needs to do.

**What is open, and newly urgent because of sketch 148.** The shipped reveal is a *swap*:
`title = technical ? technicalTitle : title`. The plain title is destroyed. That was a cheap trade
when the plain title was the generic "Work out how to do it" — losing it lost nothing. **148-C makes
the plain title specific** ("Search Supplier Contracts"), so the same swap now destroys real meaning.

## How to View

```
open .planning/sketches/149-what-the-reveal-costs/index.html
```

Default tab shows all three treatments × both toggle states **co-present** — the lesson from 148,
applied from the start rather than after a failed review. Flip **⌥ Technical names** in the bar.

## Variants

- **A: Swap the title** *(what ships today)* — `technicalTitle` replaces the title outright.
- **B: Add a third line** — plain title stays; technical detail fills the declared `technicalLine`
  slot beneath the subtitle.
- **C: Swap the subtitle** — plain title stays as the title; technical detail replaces the
  **subtitle**, which 148-C already made near-redundant.

## What to Look For

**1. The slot is the real trade.** `technicalLine` is rendered by the shipped card
(`PhaseNodeCard.tsx:325`) but deliberately never passed — `PhaseNode.tsx:183` reserves it for
**Phase 188**, alongside `status` and `stepNumber`. B spends that slot. C reaches the same
comprehension by giving up the type subtitle instead. Choosing B is a decision to hand Phase 188 a
card with one fewer line, and it should be made deliberately rather than by default.

**2. A truncates the very thing it exists to show.** Unplanned finding, visible in the ON column:
`technicalTitle` renders as `AI agent step · find-renewal-t…` — the title is `truncate` at 14px in
a 248px card, so **the slug clips**. The slug is the only genuinely technical token on the card and
the main reason to turn the reveal on at all. B and C both render it in full, because the mono 10px
line fits where the headline title does not. This is a measured argument against A independent of
the meaning-loss argument.

**3. Judge density on the second tab.** One card is a poor test of a fourth line. The *Live canvas
strip* tab shows five real steps in the chosen treatment — B's extra line reads very differently
across five nodes than it does on one.

**4. Ask whether the subtitle earns its place.** C's cost is the type subtitle. With the title
already saying *Search Supplier Contracts*, "Reads only the Supplier Contracts folder" is close to
a restatement. If that holds across all six phase types, C is nearly free; if some types have
subtitles that genuinely add information, C's cost is real and worth naming per type.

## Constraint Inherited

Governance owns the card's top-right corner and spends no badge slot; both badge slots are
committed to 188/189; a third badge is a typecheck error. None of the three treatments touches any
of that — the whole question lives in the card's text block.

## Lineage — what this inherits and what it feeds

**Inherits.** Phase 154 / LANG-01 built `TechnicalNamesProvider` as ONE app-wide boolean precisely
so two toggles can never disagree — the canvas must ride it, never add a second. #51/#59 established
the **⌥ Technical-names two-audience reveal** as an operator-surface pattern; this is that same
pattern on the canvas. D-183-08 named `technicalTitle` the reveal vocabulary, NOT the default face.
148-C is the direct cause of the question.

**Feeds.** **Phase 188** owns `technicalLine`, `status` and `stepNumber` (`PhaseNode.tsx:183`) —
variant B spends one of them, so this pick is a 188 scope decision, not only a 187 one. **Phase 189**
holds the second badge slot.

**Icon convention (#43).** No new glyph. The seal is the shipped `⛨`; the reveal is type only.
