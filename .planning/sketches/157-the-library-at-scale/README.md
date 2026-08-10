---
sketch: 157
name: the-library-at-scale
question: "What organizes 50-200 workflows, and where do *find* and *create* live in the frame?"
winner: null
tags: [phase-192, lib-01, lib-04, workflows-page, information-architecture, scale, shelves, taxonomy]
---

# Sketch 157: The library at scale

## Design Question

The Workflows page shows three shelves — **Starters**, **Published**, **Drafts & seeds** — that are not
one taxonomy, no search, and a create affordance buried as the first cell of the third grid. At the
operator-chosen design scale (**50-200 workflows**, org-scale B2B) none of that survives. So:

> What organizes the library, and where do *find* and *create* live in the page frame?

This is the **high-risk** sketch of the three — it sets page structure, and 158 (the find instrument)
and 159 (the card) are both built inside whatever frame wins here.

## How to View

```
open .planning/sketches/157-the-library-at-scale/index.html
```

Use the bottom-right **scale** selector to move between **12 / 54 / 200** workflows. That control is the
whole point — every variant looks fine at 12. (The 045 real-scale lesson: sketch density at the org's
REAL scale, not at demo scale.)

## Variants

- **A: Taxonomy shelves** — the shelf metaphor survives, but the shelves become a question a user can
  actually answer about themselves: **Yours · From your team · Starters** (ownership), with *state*
  (ready to run / still building) demoted to a filter chip. Sticky header carries search + count;
  create is a primary button in the page header, top-right, always visible. Shelves collapse.
- **B: One list, shelves are filters** — a single flat result grid. "Starters", "Published" and "Drafts"
  become chips in a persistent toolbar alongside genuinely useful ones (*Makes a file*, *🔒 Strict*,
  *Yours*). The claim: **a shelf is a filter, not a place you have to scroll past.** Create leads the
  toolbar — "start something" sits left of "find something".
- **C: Facet rail + dense list** — the shipped 200px project rail grows into a real facet rail
  (Project · State · Owner, each with live counts), and the right side becomes a **dense row list**
  with a user-chosen *Group by*. Create is a full-width button at the top of the rail.
- **Today (shipped)** — not a variant, a reference frame: the real page, three shelves, no search,
  build-card as the first cell of the third grid. Flip to it to feel the delta.

## What to Look For

1. **Set scale to 200 first.** Which frame still lets you find a specific workflow? Which becomes a
   wall of cards? A only helps if its groups mean something; B depends entirely on the chips being the
   right chips; C is the only one that stays legible by default — at the cost of the card.
2. **Where does your eye go for "make a new one"?** SC#4 says the create affordance must be reachable
   without scrolling past the existing shelves. All three pass that literally — but they don't feel
   the same. A treats create as a page-level action; B treats it as the first thing in the workbench;
   C treats it as a navigation item.
3. **Do A's shelf names actually answer the SEED-136 complaint?** The operator could not say what
   "Starters / Published / Drafts" are *for*. A's bet is that **ownership** is the axis a person can
   answer ("is this mine?"). If that still doesn't read, the shelf metaphor itself is the problem and
   B is the honest conclusion.
4. **C's row list drops the purpose sentence to a column.** LIB-02 wants a card readable at a glance.
   Watch whether the row's glyph-spine + name + project is enough, or whether losing the purpose hero
   costs more than the density buys.
5. **The empty/zero-results state** in each — type nonsense in the search box.

## Grounding (measured, not assumed)

Read from `frontend/src/pages/WorkflowsPage.tsx` at HEAD, not from sketch-era notes:

| Fact | Where |
|---|---|
| Header has no create button, no search, no sort, no view toggle | `:479-486` |
| Body is ONE scroll container, `grid-cols-[200px_1fr]` | `:518` |
| Shelf order Starters → Published → Drafts | `:544` / `:568` / `:604` |
| Build-card is the FIRST cell of the THIRD grid | `:613` |
| Published shelf chip renders the literal string `GET /workflows/published` | `:577` |
| No search exists — the file's only two `placeholder` hits are the RunModal kickoff textarea and a comment | `:1286`, `:776` |

The 7 phase glyphs are the **shipped** `PHASE_GLYPHS` map (`soulData.ts`): `gear` · `memo` · `compass` ·
`handshake` · `raised-hand` · `package` · `outbox-tray`. ⚠ Note this **differs from the older prose** in
the findings skill, which still describes the flat `⚙✎🤖⛓☺◆` set — the shipped map is the source of truth.
Tiers are `STRICT 🔒 / MIDDLE ◐ / LOOSE ○` from `deriveTier.ts` (`TierId`), always derived, never stored.

Dataset is 34 hand-written org-realistic workflows (Legal / People Ops / Finance / Risk & Compliance /
Customer Success) expanded by region and quarter to reach 200 — the way a real tenant's library actually
grows. Not four seed demos.

## ⚠ G-5 fires on this surface

Measured 2026-08-10 during this sketch:
`frontend/src/pages/WorkflowsPage.tsx` = **21 commits across 10 phases** (103 / 124 / 143 / 152 / 155 /
165 / 184 / 184.1 / 186 / 188), **1407 lines** — and it was **absent from the CLAUDE.md hot-file ledger**,
so ten phases touched it without ever producing the refactor recommendation G-5 requires. The row has been
added. Phase 192 is a *structural* rewrite of this file's library view, so **discuss-phase 192 must put the
refactor question first.** Concerns currently stacked in the one file: library view, builder host, project
rail, three card components, `RunModal`, and the WFIN-03 delete Sheet.

## Verification

`node --check` on the extracted inline script, plus a headless JSDOM drive: **0 errors**; all three
variants render 54 items; search, filter chips, facets, group-by, collapse and the 12/54/200 scale
switch all drive clean.
