---
sketch: 175
name: what-the-eye-lands-on
question: "What is the density language for the workflow library — what does a card lead with, what defers behind a click, and what does colour carry?"
winner: null
tags: [density, progressive-disclosure, library, workflow-card, colour, icons, seed-184]
seeds: [SEED-184]
built: 2026-08-18
---

# Sketch 175: What the eye lands on

## Design Question

The operator, twice, and recorded verbatim because they said they could not name the quality they wanted:

> "the information is too much. It contains too much text… it should be expandable, not only text; it should be
> coloured according to the theme of this application. And if the user wants information he can click and see, instead
> of just reflecting everything as a long text… we are just throwing everything in one go without considering colours,
> the buttons, the icons."

So: **what does a library row lead with, what defers behind a click, and what does colour carry that text currently
carries?**

## How to View

```
open .planning/sketches/175-what-the-eye-lands-on/index.html
```

Chrome MCP cannot open `file://`. To drive it in a browser session:
`cd .planning/sketches && python -m http.server 8899 --bind 127.0.0.1`
then `http://127.0.0.1:8899/175-what-the-eye-lands-on/index.html`.

## ⚠ The measurement that reframed the question before anything was drawn

Read from the **live local database** on 2026-08-18, not from the fixture:

```
workflow_definitions:  285 rows  ·  39 distinct names  ·  93% of rows carry a repeated name
  84 x Global WF        (test data)
  84 x Preview WF       (test data)
  43 x Compliance Gap Report
  11 x Risk Register
   9 x Weekly Status Report
```

⚠ **`Global WF` and `Preview WF` are automated-test rows and are named as such rather than quietly included.** Excluding
them, 117 rows remain and `Compliance Gap Report` alone is **37%** of them. The 2026-08-12 measurement behind
`themes/library-fixture-192-1.js` recorded 41% under one name; it has got **worse**, not better.

**Why this changes the brief.** The field the eye naturally lands on — the name — is the *least* distinguishing field in
the dataset. Compressing text alone produces a tidier library that is exactly as unscannable. So every variant here is
judged on *does this tell two rows of one family apart*, not on looking calmer.

## Variants

Each pane measures itself from the DOM — height, words, and rows-visible-in-800px are computed live, so the argument is
on screen rather than asserted in this file.

| | Lead | At rest | Words | Rows in 800px |
|---|---|---|---|---|
| **Today** (shipped, reference) | the name | **257 px** | 49 | **2** |
| **A · The scan line** | project · when · version | **39 px** | 10 | **15** |
| **B · Colour carries it** | project + tier as a left edge | 98 px | 15 | 7 |
| **C · Icon-led** | a glyph row, then project | 61 px | 13 | 10 |

**Today** is included as a dashed reference tab, not as a strawman: it is the shipped card, rendering the real atom
vocabulary (purpose · needs · spine · governance · produces · updated · fork consequence) at one visual weight. Seeing
**2 rows per screen against 15** is the whole argument, and it is measured rather than claimed.

### A — The scan line
One line per row. The name is demoted to context; everything else is one click away.

### B — Colour carries the state
The left edge encodes the governance tier from the theme's own tokens (no new hue), tags carry deliverable and tier, and
the purpose defers. **The tag still says the word** — colour that a reader has not learned yet is decoration, and this
has to survive a colour-blind reader.

### C — Icon-led compression
The atoms become a glyph row — deliverable, governance, step count — with words only where a word is irreplaceable.
Hover names each glyph. Leans hardest on the shared `PHASE_GLYPHS` vocabulary in the icon convention.

## ⚠ FINDING — variant A's premise was measured and only half holds, and it is LEFT STANDING

A leads with `project` as the differentiator. Computed live from the 24 rows on screen (the sketch prints this itself,
so it cannot go stale):

```
1 distinct name  ·  5 distinct projects  ·  17 of 24 unbound
```

**So for most rows the headline reads "Unbound", and the line differentiates no better than the name it replaced.**
A is the densest variant and, as drawn, not the most scannable — those are different properties and this sketch
separates them.

It is shown as a warning inside the pane rather than quietly patched, because the choice belongs to the operator and
the failure is the useful part. What the data says actually separates two rows inside one family, in order of strength:

**updated · version · owner · lineage (forked from …)**

Project earns the lead only once a library is genuinely spread across projects, which this one is not. A build of this
direction should lead with **when + version**, with project as a chip.

## What this sketch deliberately does NOT answer

- **The card's action row** (Run / Open / Tweak / delete) is out of scope here; it is chrome, not density.
- **The governance corner mark** — Phase 185 established the card's top-right is claimed and that governance spends no
  extra colour. Variant B's left edge is chosen so it cannot collide with that mark, but the composition of the two has
  not been drawn.
- **Empty and 1-row states.**

## Constraints honoured

- Theme tokens only, from `themes/default.css` (Aether Deep Midnight). No new hex anywhere.
- Real data: `themes/library-fixture-192-1.js`, generated by the app's actual fork rules — the same dataset sketches
  160–163 argue over, so this sketch is comparable with them rather than a fresh invention.
- The atom vocabulary rendered in **Today** is the shipped one, per the SEED-155 rule: do not draw an atom the card
  structurally cannot render.
- `node --check` clean; loaded and driven in a real browser — all four panes render 24 rows, expansion works, and the
  page reports **0** `undefined`/`NaN` leaks.

## ⚠ Owed to the build phase — the G-5 obligation

`frontend/src/components/workflows/library/WorkflowCard.tsx` is **G-5 FIRING (8 commits / 3 phases / 818 lines) with an
UNDISCHARGED obligation**: the next phase touching it owes a refactor recommendation FIRST. The operator chose to sketch
now and carry the recommendation into the build phase rather than delay the drawing.

**The recommendation, from the outside and to be confirmed against the file:** whichever variant wins, the card's
density decision should NOT land as more conditional JSX inside `WorkflowCard.tsx`. The natural seam this sketch
exposes is a **presentation layer** — one module that decides *what a row leads with and what defers*, given a row —
leaving `WorkflowCard` to render a resolved shape. That would also give the three surfaces in SEED-182/183/184 one
place to share the language instead of three copies.

## Open questions for the operator

1. Which direction — and is **scannability** or **calm** the thing you are optimising for? They are not the same, and
   A vs B is exactly that trade.
2. Does colour-as-meaning need to be **learnable without a legend**? If yes, B's palette has to narrow to 2 states.
3. Is the list shape (A) acceptable for a *library*, or does it need to keep the card feel?
