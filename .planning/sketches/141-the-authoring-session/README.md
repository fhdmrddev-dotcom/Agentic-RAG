---
sketch: 141
name: the-authoring-session
question: "Do 138 + 139 + 140 compose into a session a person can sit inside — empty draft → first step → a mistake → undo → autosave → publish?"
winner: null
tags: [phase-184, composition, consistency, undo-redo, zundo, autosave-honesty, saved-not-published, publish-handoff, empty-state, viewport, g2-sketch-gate]
---

# Sketch 141: The authoring session

## Design Question

Sketches 138, 139 and 140 each answer one question well. This one asks the different question:
**do they compose?** Where do undo/redo, save state, and the way out (publish) live, so the whole thing
reads as one session rather than three surfaces that happen to share a canvas?

## How to View

```
open .planning/sketches/141-the-authoring-session/index.html
```

Start from **Empty draft** and actually build something: add a step, add another, delete one, press
`⌘Z` / `Ctrl+Z`. Watch the save dot and the right-hand history. Then switch variants and do it again.
**Width → 900px** checks it holds when the window is not generous.

## Variants

- **A: One session strip.** Step count, save state, undo/redo, publish and the reason it is blocked — all
  on one line under the canvas. One place to look; the canvas stays completely clean. Risk: the strip
  becomes a junk drawer as later phases add to it.
- **B: Canvas toolbar + page header.** Editing controls float on the canvas where editing happens;
  publishing sits in the header where leaving happens. Each control near what it acts on — two places to
  look, and a floating bar sitting on the flow.
- **C: Status where it happens.** No standing chrome: "Saved" appears next to the step you just changed
  and fades, undo is keyboard-plus-confirmation, and publish is a card at the **end of the flow** — you
  reach it by finishing. Calmest at rest; most dependent on noticing something that has already gone.

## The three honesty beats it is really testing

These outlive the layout question, so they matter more than which variant wins.

1. **Saved ≠ published.** Autosave updates the draft row **in place**. It does not mint a definition
   version and it does not re-arm the publish gauntlet. (The mechanism is Phase 186 / CONCUR-01 — but the
   *words* are chosen here, and a word that implies "shipped" is a lie shown a hundred times a session.)
   The wording on test is **"Saved · still a draft."**
2. **A cosmetic move is not a change to what runs.** If 138 lands on the spine, there are no cosmetic
   moves — every move renumbers, and every history entry is real. If 138 lands on free placement, the
   history has to *distinguish* them (the sketch carries a `· only the picture` marker for exactly this),
   or an undo will silently revert something the person never thought they changed. **This is a direct
   dependency on 138's outcome.**
3. **Publish is the test.** Per the v2.9 navigation contract adopted 2026-06-14, a draft cannot be run
   directly — the gauntlet's golden run on your own knowledge base *is* the trial run, and a judge failure
   is a hard wall. So the end of an authoring session is a **handoff**, not a "run it and see." The
   publish control is disabled while `ok: false`, and it names the first reason rather than just greying.

## What to Look For

1. **The empty draft.** 40 of 95 real definitions are empty. Does the first move read as an invitation or
   as a broken screen?
2. **Delete a step, then undo.** In A the affordance is right there; in B it is on the canvas; in C you
   have to know `⌘Z` exists. Watch the history rail mark the undone entry.
3. **The save dot through a full cycle** — dirty → saving → saved. In C, watch where the confirmation
   appears and how fast it goes.
4. **The blocked publish in each variant.** A states the reason inline; B has room for it in the header;
   C only shows it if you scroll to the end of the flow. Is "you reach it by finishing" elegant or is it
   hiding the exit?
5. **900px.** A's strip compresses; B's floating bar starts competing with the flow; C is unaffected —
   because C has no chrome to compress.
6. **The note at the foot of the history rail.** Nothing here has published anything, and a second person
   editing the same org-shared workflow is Phase 186's problem — not something this list can imply it has
   handled.

## Grounding

Node visuals are the locked 137-D language via `themes/canvas-184.css`; icons from
`themes/phase-icons-3d.js`. The undo stack is `zundo`'s shape — snapshots of the definition slice, which
is why a cosmetic-only change has to be tagged or it becomes indistinguishable from a structural one. The
seed workflow is the real `risk-register` starter. The verdicts that gate publish are the same
`incomplete` codes sketch 139 renders (`business_requirement`, `interactive_phase`, `input_unsatisfied`).

## Verification

Driven in Chrome DevTools at 1440×900 and at the 900px constraint across all three variants: empty →
first step → second step → delete → undo → redo, autosave dirty/saving/saved transitions, the history
rail's undone marking and "now" pointer, the disabled publish with its named reason, C's terminal publish
card, and the keyboard `⌘Z` / `⇧⌘Z` path. No console errors; inline JS passes `node --check`.
