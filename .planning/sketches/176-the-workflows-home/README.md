---
sketch: 176
name: the-workflows-home
question: "What does the Workflows home look like when it is CALM — and what should colour actually encode, when the operator cannot tell built from draft from starter from someone else's?"
winner: null
tags: [workflows-home, colour-semantics, lifecycle, calm, header-alignment, progressive-disclosure, seed-184, seed-155, bug-260815-08, g2-sketch-gate]
seeds: [SEED-184, SEED-155]
bugs: [BUG-260815-08]
built: 2026-08-18
---

# Sketch 176: The Workflows home

## Design Question

Sketch 175 settled the *language* — calm, colour on the card, purpose behind a click. The operator's response opened a
bigger question:

> "the cards seem to me all similar. There's no way to distinguish which one is best, which one is built, which one is
> draft, which one belongs to something else. We should also colour code the categories… even the home page of the
> workflows is not aligned well — the header for the cards, and for the filter triggers and search. I reported this
> before. And even the new button to create a new workflow is not good. **Honestly I'm still not convinced with this
> home page.**"

So this sketch is the whole page, and its one real variable is: **what does colour MEAN?**

## How to View

```
cd .planning/sketches && python -m http.server 8899 --bind 127.0.0.1
# → http://127.0.0.1:8899/176-the-workflows-home/index.html
```

## ⚠ What is NOT a variant — the three defects, fixed identically in all three panes

`BUG-260815-08` (reported 2026-08-15, **status: open**) is a defect list, not a taste question, so it is fixed the same
way everywhere rather than offered as a choice:

| # | The report | The fix |
|---|---|---|
| 1 | *"the Build Workflow button is not coloured"* | a filled primary action in `--color-primary`, so the page's main verb reads as the main verb |
| 2 | *"not all the items aligned perfectly… the project dropdown is below the other"* | one flex row, `align-items:stretch`, one shared `--ctrl-h` — the search flexes, the selects do not |
| 3 | *"the search bar… deceiving the user that it is just a placeholder for text, not a search box"* | a real bordered field with a search icon and a focus ring, `type="search"` |

### ⚠ Fix 2 was CAUGHT BY MEASUREMENT, and my own first draft had the very defect it claims to fix

The first build used `align-items:center`. Measured tops: **395, 397, 397** — the search sat **2px** above the two
selects, because an `<input>` and a `<select>` do not resolve the same intrinsic height from identical padding.

**2px is invisible in a screenshot and is exactly what "not all the items aligned perfectly" describes.** It is now one
shared control height set in a single place, re-measured at both wide and 980px: `tops [414,414,414] · heights
[38,38,38] · no wrap`. Recorded because it is the argument for measuring a mockup rather than looking at it — and
because the same class of 2px drift is what put this bug on the board in the first place.

## Variants — the variable is colour semantics

All three keep 175's verdict: calm, colour on the card, purpose deferred behind a click, and a **worded state badge**
so colour is never the only carrier (a colour-blind reader loses nothing).

### A — Lifecycle is the colour
The left edge and the filter chips share ONE three-colour vocabulary: **Ready to run** (success) · **Still building**
(warning) · **Starter** (violet). Project drops to a subtitle.
- **The bet:** colour answers the question actually asked — *built, draft, or starter* — and because the chips carry the
  same three colours, filtering and scanning teach each other. This is the operator's *"also for filtration it is doing
  good"* made structural.
- **The risk:** *"which belongs to something else"* is then only a word, not a colour.

### B — Belonging is the colour
Colour encodes the project (Finance / Legal / People Ops / Risk); lifecycle stays a worded badge.
- **The bet:** answers *whose is this, what is it for*.
- **⚠ The risk, and it is measured, not guessed:** most rows are **Unbound** — in the fixture's first 18, eleven. So most
  cards get the neutral edge and colour says nothing about the majority of the library. **Colour only earns its place
  here once workflows are actually bound to projects**, which today they mostly are not.

### C — Grouped, colour is quiet
Lifecycle becomes **structure**: three sections — Ready to run / Still building / Starters — each with a 3px marker.
The grid itself stays neutral.
- **The bet:** the calmest of the three. You cannot confuse a draft with a published workflow because they are not in
  the same place, and colour shrinks to a section marker instead of tinting every card.
- **The risk:** recency sorting across the whole library is lost inside groups, and with 107 drafts one section becomes
  enormous.

## What carried forward from 175

Calm over density (**A of 175 was rejected as too dense**) · colour on the card · purpose behind a click · and the
measured finding that **the name cannot be the differentiator**, because 93% of rows share one. Every card here leads
with the name anyway — but now with lifecycle, project and recency beside it, which is what actually separates two rows
of one family.

## What this sketch does NOT yet answer

- **"Which one is best."** The operator listed this alongside built/draft/belonging, and it is a genuinely different
  question — there is no quality signal on a workflow today. It would need something real behind it (last run outcome,
  run count, a pass rate) and inventing a badge for it would be exactly the fabricated-signal trap this project keeps
  recording. **Named here so it is not silently dropped.**
- The card's action row (Run / Open / Tweak / delete) and the ⋯ menu.
- Empty, 1-row, and 1000-row states.
- The governance corner mark's composition with a coloured left edge (Phase 185 claimed the top-right corner).

## Constraints honoured

- Theme tokens only — no new hex. The lifecycle palette reuses `--color-success` / `--color-warning` /
  `--color-accent-violet`.
- Real data from `themes/library-fixture-192-1.js` (the app's real fork rules), so this is comparable with sketches
  160–163 and 175.
- Colour is **never the only carrier** — every state also says its word.
- `node --check` clean; driven in a real browser: 18 cards per pane, 3 sections in C, 0 `undefined`/`NaN` leaks, and the
  three header fixes verified as geometry rather than intent.

## Open questions for the operator

1. **A, B or C** — i.e. should colour mean *lifecycle*, *belonging*, or should lifecycle become *structure* and colour
   go quiet?
2. If you want both lifecycle AND belonging visible: which one gets colour, and does the other get shape, position or a
   word? (Both on colour at once is how a palette becomes noise.)
3. **"Which one is best"** — is there a real signal we could show, or should the page stay honest and silent about
   quality until there is one?
