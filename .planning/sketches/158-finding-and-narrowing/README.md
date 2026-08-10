---
sketch: 158
name: finding-and-narrowing
question: "What is the find instrument, and does it live on the page, in ⌘K, or both?"
winner: null
tags: [phase-192, lib-01, lib-02, search, filter, command-palette, workflows-page]
---

# Sketch 158: Finding and narrowing

## Design Question

SC#1 says *a user can find a named workflow by typing part of its name*; SC#2 says *a user can narrow
the list without reading every card*. Neither exists today. But the app **already shipped a ⌘K finder**
in Phase 156, so the honest question is not "add a search box" — it's:

> Where does finding live, and what does the instrument actually match?

## How to View

```
open .planning/sketches/158-finding-and-narrowing/index.html
```

Bottom-right: **▶ demo typing** types a real query into whichever variant is showing. Scale selector
moves between 12 / 54 / 200.

## Variants

- **A: Always-on page search** — a search field that is simply always there, beside state filter chips
  with live counts, above a highlighted result grid. The path of least resistance for the target stack
  (`ui/input.tsx` exists; no new dependency).
- **B: ⌘K finds workflows** — no page search at all. The shipped global palette learns to index
  workflows alongside chats; the page keeps only filter chips. Press **⌘K** (or the header button) to
  open it; ↑↓ move, ↵ opens, Esc closes.
- **C: Calm collapsed toolbar** — the shipped 021-D8 intent, honoured: the page reads clean at rest and
  search hides behind a **🔎 Search & filter** tap. Held to the org-scale bar to see whether "calm
  default" is still the right trade at 200 items.

## What to Look For

1. **In B, read the amber note before judging it.** The reuse is *not* free, and the sketch says so with
   citations: `ThreadCommandPalette.tsx` (Phase 156) takes `threads: Thread[]` and matches with
   `matchesTitle` — it indexes **threads only** — and it is **hand-rolled on Radix Dialog, not `cmdk`**
   (no `cmdk` dependency exists in `frontend/package.json`). Teaching it workflows changes a *global*
   component and its one shared engine. Weigh that against a page-local input.
2. **In C, count your own taps.** If you open the toolbar every single visit, the calm-at-rest saving is
   imaginary and the tap is pure cost. Conversely if you mostly arrive to run one known workflow, C may
   genuinely be calmer.
3. **What should search match?** Variant A searches **name + purpose sentence** and highlights the hit —
   so `clause`, `assessments` and `sign-off` all find workflows whose *titles* don't contain them
   (measured: 2, 2 and 2 results respectively). **But it is substring matching, not meaning:** the
   paraphrase *"the thing that checks vendors"* returns **0**. The sketch states this on-screen rather
   than implying semantic search. Decide deliberately whether purpose-text search is in scope for 192 —
   SC#1's literal bar is only "part of its name".
4. **Zero-results states.** Every variant offers a one-click *Clear search & filters* rather than
   leaving you stuck.
5. **Do the filter chips carry honest counts?** They recount against the current search, so a chip never
   promises results it can't deliver.

## Open question this sketch deliberately does not settle

A and B are **not necessarily rivals.** ⌘K is a *jump-anywhere* instrument; an on-page field is a
*narrow-what-I'm-looking-at* instrument — exactly the split Phase 156 already settled for chat
(sketch 078-D: "the column filters what you see; ⌘K jumps anywhere"). If that precedent holds, the
answer is **both**, and the real decision is only whether 192 pays for the global-palette change now or
defers it. Say so explicitly at pick-time rather than letting a winner imply the other is rejected.

## Verification

`node --check` on the extracted inline script — this caught a **real syntax error** (a stray `;` inside
an object literal) that would have left the whole sketch dead in the browser. Fixed, re-checked, then
driven headlessly in JSDOM: **0 errors**; search filters live in all three variants; the palette opens,
groups Workflows + Chats, and highlights matches; C's toolbar collapses and expands.
