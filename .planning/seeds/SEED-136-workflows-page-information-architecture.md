---
id: SEED-136
title: The Workflows page needs an information architecture, not a card restyle — three shelves that are not a taxonomy, no search, and the create affordance buried in section three
status: open
planted: 2026-07-31
planted_by: Phase 185 operator UAT (2026-07-30/31) — operator used the page for real work and could not name what its own categories mean
surface: Agentic-RAG
severity: warning
category: product / workflow library IA + authoring entry
priority: high
scope: Medium-Large (one page + its card family; no engine change)
affected_areas: [workflows-page, workflow-library, information-architecture, navigation, terminology]
related_seeds: [SEED-123, SEED-084, SEED-085, SEED-045, SEED-111]
re_open_trigger: >
  Re-open when ANY of these is true: (1) the v3.6 canvas track reaches the Workflows library
  surface — the canvas (Phase 184) makes authoring visual, and the library is the door the
  author walks through to reach it, so shipping a canvas behind an unbrowsable library wastes
  the canvas; (2) a business user (not the operator, not a developer) is asked to find and run
  a workflow they did not author; (3) any phase proposes touching `WorkflowsPage.tsx` shelves,
  cards, or headings — do the IA question FIRST, do not restyle underneath it; (4) the workflow
  count on one account passes the point where the "Build a workflow" card leaves the first
  viewport (already true for the operator on 2026-07-31).
---

# SEED-136 — the Workflows page taxonomy is the root issue; the card design is downstream of it

## The observation (operator, 2026-07-31, after using the page for real)

> "the cards of the workflow are not that good, it is not filtered or searched properly, and I
> have to scroll all the way down just to find the place where I can create a new workflow. We
> should organise this in a nice way, in the soul of what we authored in the canvas. And I don't
> know what is this starter and this published and all those categories, how we are using it."

The last sentence is the one that matters. The page's **own operator** — who commissioned every
one of its shelves — cannot say what the three categories are for. That is not a styling
complaint dressed up as an IA complaint; it is the reverse.

## What is actually on the page today (read from source at HEAD, branch `develop`)

All citations are `frontend/src/pages/WorkflowsPage.tsx` unless noted.

**Vertical order of the library view (`pageView === "library"`, from line 440):**

| # | Band | Lines | What it contains |
|---|---|---|---|
| 1 | Header | 443-450 | `<h1>Workflows</h1>` + a one-line subtitle. **No create button. No search input. No sort. No view toggle.** |
| 2 | Honesty banner | 453-457 | A violet "net-new" strip explaining `GET /workflows/published` to the reader |
| 3 | Post-publish Run CTA | 460-480 | Conditional; only after a gauntlet PASS |
| 4 | Two-column body | 482 | `grid-cols-[200px_1fr] … overflow-y-auto` — the whole body is ONE scroll container |
| 4a | Project filter rail | 484-502 | `All projects` / one row per folder / `Unbound (no project)` |
| 4b | **Starters** shelf | 508-529 | heading `Starters · {n}` + a `curated` chip; `StarterCard` grid, `md:grid-cols-2` |
| 4c | **Published** shelf | 532-565 | heading `Published · {n}` + a chip reading literally `GET /workflows/published` (541); `PublishedCard` grid |
| 4d | **Drafts & seeds** shelf | 568-596 | heading `Drafts & seeds · {n}` + a `net-new list` flag; **the dashed "Build a workflow" card is the first cell of this third grid** (577-590) |

**Search: there is none.** A `grep -niE "search|filter"` over the file returns 20 hits and every
one is either the project rail, the file's own prose, or an `Array.prototype.filter`. No text
input, no fuzzy match, no tag filter, no owner filter, no "recently run" — nothing but the
folder rail.

**The create affordance is the first cell of the third grid.** DOM order is
Starters grid → Published grid → *then* the `＋ Build a workflow` button (577). Two
unbounded-length two-column grids sit above it inside a single scroll container. The operator's
"scroll all the way down" is the literal, structural consequence — not a perception.

## The three groupings are not one taxonomy — they are two axes flattened into one column

Each shelf is fed by a **different endpoint with a different scope**:

| Shelf | Fetch | Scope it actually queries |
|---|---|---|
| Starters | `refetchStarters` (172-177) → `listStarterWorkflows()` (`frontend/src/lib/api.ts:1363-1368`) | global curated: `is_system_global AND definition->>'category'='starter'` (`backend/app/api/workflows.py:212`) |
| Published | `refetchPublished` (149-167) → `listPublishedWorkflows(projectArg, …, {scope:"mine"})` (`api.ts:1328`) | lifecycle=published **AND** owner=me |
| Drafts & seeds | `refetchDrafts` (179-185) → `listDraftWorkflows()` (`api.ts:3331-3336`) | lifecycle=draft, owner=me |

So the headings mix **two orthogonal axes**:

- **lifecycle** — draft vs published
- **provenance/ownership** — curated-global vs mine

A Starter *is* published. "Starter" is therefore not a peer of "Published"; it is a different
question about the same row. Ask a business user "where did my workflow go?" and the honest
answer is "it depends which of two axes it moved on, and the page only shows you one heading per
row." Nobody can hold that model — which is exactly the operator's report, and it is a property
of the taxonomy, not of the card CSS.

Three more measured tells that the taxonomy has drifted rather than been designed:

1. **"seeds" denotes nothing.** The heading at line 571 reads `Drafts & seeds`. [[SEED-084]]
   records that Phase 103 *reserved* the word "seeds" for pre-built fork-able starters and
   shipped none; Phase 143 then shipped exactly that content as its **own** Starters shelf
   (508-529). The word stayed behind in a heading whose referent moved out. (Inference from the
   two sources, high confidence — not live-verified against a rendered page.)
2. **The "Project" rail narrows exactly one of the three shelves.** `refetchPublished` takes the
   selected folder (153-159); `refetchStarters` and `refetchDrafts` take no argument at all
   (172-185, and the API functions accept no filter — `api.ts:1363`, `api.ts:3331`). Pick a
   project and two of the three shelves silently ignore you. The rail *looks* page-global and is
   not.
3. **The page speaks API to the user.** A chip on the Published heading renders the string
   `GET /workflows/published` (541); the banner (453-457) and two flags (573, 80-90) explain
   which endpoints are "net-new". These were honest developer scaffolding in Phase 103; on a
   business surface in 2026-07 they are noise ([[SEED-085]]).

## The cards are downstream — but not innocent

The three card components already share the one thing worth sharing: `<WorkflowSoul scale="card">`
(rendered identically at 681, 813, 999). What differs between them is **chrome and verbs**, and
the verbs have no common grammar:

- `StarterCard` (978-1016): `Use this →`
- `PublishedCard` (709-970): `⑂ Tweak` + `▶ Run`, plus a `⋯` menu whose only item is
  `Delete workflow…` (784-809)
- `DraftCard` (657-703): `✎ Open` + `Publish…`

And `Publish…` on the draft card is wired to **the same handler as `Open`** — `onClick={onOpen}`
at both 688 and 697. Two buttons, one behaviour. That is a real card-level defect, and it is
also evidence for the argument: card work done without an IA produced two affordances that
promise different things and do the same thing.

## The load-bearing argument

**Fix the taxonomy first; the card design is a consequence of it.** If the page's own author
cannot say what "Starter" vs "Published" vs "Draft & seed" are *for*, then no amount of card
restyling fixes the page — a prettier card still leaves the user unable to predict which shelf
their workflow is on, still unable to search, and still scrolling past two grids to create.

**The seed's first question is therefore not "how should the cards look" but:**

> What do these three categories MEAN to a business user, and should any of them survive?

Candidate reframings to put in front of the operator (none endorsed here — this is a sketch
question, not a decision):

- **Mine vs Library** — one axis (ownership), with lifecycle demoted to a per-card state chip.
  "Starters" becomes "Library / from Superrag", drafts become a state, not a place.
- **By what it does** — group by business outcome (the `business_requirement` the soul already
  renders as its hero) rather than by lifecycle at all; lifecycle becomes a filter.
- **One list + real controls** — a single result list with search, an owner/state filter set, and
  a sort. The three headings disappear entirely and become filter chips.

Whatever wins, the create affordance belongs in the header band (443-450), not in the third grid,
and a text search belongs beside it.

## Guardrail: this fires G-2 — sketch BEFORE plan

CLAUDE.md guardrail **G-2** fires on scope that "mentions live UI, panel render, badge, label,
… visual, or gold-standard comparison". This seed is nothing but that, plus the operator's own
"feels like" framing ("organise this in a nice way, in the soul of what we authored in the
canvas"). So when this is promoted:

1. `/gsd:sketch` FIRST — an operator-approved mockup is the acceptance bar; do **not** go
   straight to `/gsd:spec-phase` or `/gsd:discuss-phase`.
2. The sketch must answer the taxonomy question above **on the mockup**, in business words, before
   any card geometry is drawn.
3. **The canvas is the visual language to inherit from.** Phase 184's editable canvas is the most
   recently operator-approved workflow surface, and the operator named it explicitly ("in the
   soul of what we authored in the canvas"). Inherit its vocabulary and weight; do not invent a
   third dialect for the library.
4. Load `Skill("sketch-findings-agentic-rag")` before sketching — it already carries validated
   findings for the built Workflows page library+launch (sketches 021-A / 023-A), the Phase 124
   workflow soul + two-door model, and the Phase 127 energized Studio re-skin. The library has
   not been re-sketched since Phase 103, while Starters (143), the soul (124), the delete
   lifecycle (152) and the canvas (184) all landed on top of it. That accretion IS the drift.

Also worth carrying into the sketch: G-6 (`## How we'd know this failed`) has an obvious concrete
form here — a business user who did not author the workflow is asked to find it and run it, and
either can or cannot, in one screen, without scrolling.

## Confidence / what was NOT verified

- Everything cited above is **read from source** at HEAD on `develop` on 2026-07-31 — file, line,
  fetch scope, DOM order, absence of a search control. Those are measured.
- I did **not** open the page in a browser in this pass. Rendered row counts, actual scroll depth
  in pixels, and the exact viewport height at which `Build a workflow` falls below the fold are
  **not** measured — the operator's lived report is the evidence for those.
- The "seeds"-has-no-referent claim is an **inference** from [[SEED-084]] plus the shipped Phase
  143 shelf. High confidence, not live-verified.
- Note for whoever plans this: per [[project_workflow_rows_are_test_data]], all existing
  `workflow_definitions` rows are fixtures — there is no production content to grandfather, so a
  taxonomy change is free of migration/backfill design.

## Related

[[SEED-123]] (the v3.6 visual/no-code authoring milestone this belongs under — the canvas is the
authoring half, this is the *finding-and-launching* half, and a canvas behind an unbrowsable
library is a canvas nobody reaches) · [[SEED-084]] (the starter library, and the origin of the
orphaned word "seeds") · [[SEED-085]] (user-friendly vs admin terminology — the `GET
/workflows/published` chip and the "net-new" flags) · [[SEED-045]] (UI/UX polish pass — adjacent,
but this is IA, not polish; do not fold it in as a restyle) · [[SEED-111]] (workflow delete +
cascade lifecycle — the `⋯` menu this page grew).
