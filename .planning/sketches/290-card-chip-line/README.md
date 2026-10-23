---
sketch: 290
name: card-chip-line
question: "On the shipped library card (sketch 179 C), how should the one new line of step chips read: which words, and how much weight?"
winner: "B"
tags: [phase-290, vis-04, seed-155, real-card-dom]
---

# Sketch 290: The Card Chip Line

## Design Question
Phase 290 D-01..D-05: add ONE line of labelled step chips under line 2 of the shipped card.
It shows the first 3 steps in run order, then `+N more`, which names the rest in words with no hover.
Which words go in the chips, and how much visual weight should the line carry?

## Why this sketch is a real acceptance bar (SEED-155's rule)
It renders **the real card component's output**, not a redrawing. The 7 cards are `WorkflowCard`
`outerHTML` captured from the running app on 2026-10-21 (local DB). They are styled by the app's own
compiled stylesheet (`app.css`, Vite dev output of `src/index.css`). The step titles come from
`nodeTitle()` in `phaseVocabulary.ts`, called in the live app, and the glyphs come from the same
fluent-emoji set `phaseGlyph.tsx` bundles. **Only the step line is new markup.**
`data.js` is generated; re-capture it rather than hand-editing.

## How to View
Serve `.planning/sketches` (`python -m http.server 8765`), then open
`http://127.0.0.1:8765/290-card-chip-line/index.html`. The bottom-right toolbar switches dark mode
and phone width (375 px).

## Variants
- **A: Pills · step names.** Bordered pills with a glyph and the step's face (`nodeTitle`: the
  author's name when set, else the type sentence), joined by `→`. This is sketch 163's style.
- **B: Pills · step-type words.** The same pills, but the words are always the type sentence
  (`PHASE_TYPE_SENTENCES`, e.g. "Work out how to do it"), so author names are ignored.
- **C: Quiet numbered line.** No boxes: `1 🧭 Gather… · 2 📝 Write…` in muted text. The lowest
  weight, closest to 179 C's calm.

## Measured on the real data (local DB, 140 cards)
- Every local card has steps: 12 have 1, 94 have 2, 25 have 3, and 9 have 4-6.
- **67% of steps (213 of 317) have no author name**, so they show the type sentence in every
  variant. Named steps run up to 54 characters (the 90th percentile is 35), which is why A truncates
  hard on the DMT and QBR cards.
- Production: 7 of 29 definitions have steps, all with 2-3.

## Winner (operator, 2026-10-21)
**B: pills with step-type words.** The chip words are always the type sentence (`PHASE_TYPE_SENTENCES`), never the author's step name, so every card stays short and consistent. Bordered pills, glyph + words, joined by `→`, first 3 then `+N more` (expands in place, names the rest in words). This is the SC#1 screenshot bar for Phase 290.

## What to Look For
1. Does the line keep 179 C's calm, or does it start to dominate the card again?
2. On DMT / QBR (long author names), is a truncated name (A) better or worse than a short type word (B)?
3. Does `+N more` → the expanded list read as "named in words", on phone width too?
4. A 1-step card shows one chip. Does that read as honest or as broken?
