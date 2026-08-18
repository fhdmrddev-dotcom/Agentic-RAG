---
sketch: 172
name: where-the-five-decisions-live
question: "Should the decisions surface OWN controls for the five decisions, or POINT at the ones that already ship — given that three of the five already have a control on the drafted view?"
winner: null
tags: [phase-197, auth-02, guided-authoring, decisions-surface, seed-163, generated-from-build, g2-sketch-gate, d-02, d-07]
---

# Sketch 172: Where the five decisions live

> **This sketch is part of the G-2 gate for Phase 197** (AUTH-02). `ROADMAP.md:677` flags G-2 on
> this phase; `STATE.md` records the sketch as owed **before** `/gsd:plan-phase 197`.
>
> `197-CONTEXT.md` D-02 names the composition problem it expects the sketch to solve:
> *"Two receipts stacked on one screen is a composition problem, and it is the sketch's problem."*
> Rendering the real screen showed the problem is **a different and larger one**, which is what
> these three variants are actually about.

## How to view

```
start .planning/sketches/172-where-the-five-decisions-live/index.html
```

Five tabs: **A · Sibling card** · **B · One home** · **C · The index** · **⚠ The three homes** ·
**The contract**.

Verified at 1440×900: no horizontal scroll on any tab, all five panels switch, the four decision
cards each render five rows, variant C's five jump controls all respond, and both measurement
readouts and the height sweep compute live. One console message, benign and inherited: a devtools
*"form field should have an id or name"* issue coming from the **shipped** KB `<select>` and
requirement `<input>` (both carry `aria-label`, so they are labelled — the notice is about autofill).
Sketch 165 recorded the identical message from the same shipped controls.

## ⚠ The finding that reshaped this sketch

**Three of D-07's five rows already have a control on the drafted view.** Measured by rendering
`WorkflowBuilderPage` with `visual_workflow_canvas` ON, not by reading about it:

| D-07 row | Home on the drafted view **today** | Scale |
|---|---|---|
| 1 · Knowledge-base scope | `project-folder-picker` `<select>` in the header identity strip (D-186-15) | **11 px chip** |
| 2 · The bound template | `TemplateAttachSection`, mounted inside `PhaseFormPanel` (the per-step side panel) | rail scale |
| 3 · The business requirement | `business-requirement-input` + the shipped `AI-proposed` mark (193.2-09) | **11 px chip** |
| 4 · The workflow name | **nothing — and no display either** | — |
| 5 · The deliverable | **derived, not stored** — `soulDeliverable()` reads a terminal `llm_emit` | — |

So D-02's "two receipts stacked" understates it. The real problem is **a second home for two shipped
controls**, on a page whose own source states the rule verbatim — `kbAffordance`'s docblock reads
*"A second, different answer to one question is drift."*

⚠ **Row 4 is sharper than "static text".** The emitter handed the page a definition whose `name` is
`Vendor-risk review` and whose `slug` is `vendor-risk-review`. **The header renders the slug.** The
workflow's *name* appears nowhere on the drafted view at all — which is asserted in `build.cjs`, not
claimed here. D-15 (edit the name, leave the slug alone) therefore lands on a screen that has never
shown the name, and after this phase the header would still show the slug while the card edits the
name: two strings, one of them invisible.

## The variants

| | Approach | What it costs |
|---|---|---|
| **A** | **The sibling card.** Literal D-02 — a second card beside `SeedReceipt`, above the graph, carrying its own five controls. | **A second home for rows 1 and 3**, plus a measured height cost (below). |
| **B** | **One home.** The two header affordances are *deleted* and their controls move into the card. | ⚠ **The card is dismissible (D-04)** — so dismissing it removes the only way to re-bind a KB or edit the requirement. That is `BUG-260731-03` re-created by design. Also re-captures the byte-pinned flag-off header (band 3). |
| **C** | **The index.** The card owns **no** control. It names each decision, shows the AI's answer, and focuses the shipped control in place. Rows 4 and 5 say plainly that they have nowhere to point. | Only complete if this phase **also gives row 4 a home** — a scope consequence, stated here rather than discovered at plan time. |

## ⚠ The measured cost of stacking two cards — the number to decide on

The graph column ships as `grid-rows-[auto_auto_minmax(0,1fr)]` with the graph pinned by
`[&>*:last-child]:row-start-3`. Two things were measured, and the second is the one that matters:

1. **With the shipped 3-row template, a fourth child STRANDS the graph.** The card auto-places into
   an implicit fourth row sized to its content, `minmax(0,1fr)` has nothing left to distribute, and
   the graph — nailed to row 3 by `last-child` — **collapses to 0 px** and renders only its overflow.
   `requirementAffordance`'s own docblock predicted *"a control in `graphColumn` would steal a third
   `auto` row … and permanently shorten the flow."* Measured, it does not shorten it; it removes it.

2. **Adding the fourth row fixes the stranding and does not fix the height.** The page sweeps it
   automatically:

   | graph column height | graph plane gets | |
   |---|---|---|
   | 620 px | **25 px** | unusable |
   | 700 px | **25 px** | unusable |
   | 760 px | **46 px** | a sliver |
   | 820 px | **106 px** | a sliver |
   | 900 px | **186 px** | workable |
   | 1000 px | **286 px** | workable |

   The chrome above the graph measures **662 px** (48 px toggle + 243 px receipt + 370 px card). On a
   900 px-tall laptop, after app chrome and the Builder's own header bar, the column is comfortably
   inside the unusable band. **Variant A does not make the canvas smaller — at laptop size it makes
   the canvas absent until you scroll**, on the screen whose whole job is showing the workflow that
   was just built.

## What to look for

1. **Tab A first, and judge the stranding before the prose.** Does a second card above the graph read
   as *"here is what I decided"* or as *"the canvas has been pushed off the screen"*?
2. **Tab B's dismissal trap.** Press the card's ✕ in your head: on B, the KB and the requirement have
   no other door. Is a dismissible card an acceptable home for a **publish requirement**?
3. **Tab C's two honest failures.** Rows 4 and 5 say *"no control anywhere today"* and *"derived from
   the last step"*. Is honesty here better than a control the card invents — and does C's answer
   still satisfy SC#1 (*"asked the decisions that change the result"*) if two of five rows can only
   be read?
4. **The 11 px strip on the ⚠ tab.** Measured live: the requirement input is 240 px wide at 11 px
   holding a 76-character sentence, so **about 66% of it is visible**. Three of five decisions
   currently live at that scale. Whatever variant wins, decide whether that strip is where a
   publish-blocking decision should live at all.

## ⚠ What this page deliberately does NOT resolve

1. **The row's own anatomy** — ask-first vs answer-first, and what a row looks like when it is already
   right. That is **sketch 173**. Every row here uses one treatment so the *placement* question is not
   contaminated by a *wording* question.
2. **The server-derived readiness verdict (D-13).** No row shows a per-row verdict, because the field
   does not exist yet and inventing its rendering would be the client-side derivation D-13 refuses.
3. **Hover, focus rings, pixel spacing** — a human comparison at UAT, driven by looking.

## ⚠ A correction this sketch carries upstream

`197-CONTEXT.md`'s `<deferred>` lists **BUG-260809-02** as *"(blocking) — a canvas-built workflow can
never be published … NOT closed by this phase."* Its frontmatter reads `status: closed`,
`folded_into: quick-260809-klo`, `verified_closed_by: live-uat-2026-08-10-local-chrome-devtools-mcp`.
**That quick task is what shipped the very requirement input rendered on this page.** D-06's recorded
consequence therefore does not exist — and the control it shipped is half of why variant A installs a
second home. Absorbed here rather than re-opening discuss-phase, at the operator's direction.

## The mechanism — generated FROM the build

Same inverted arrow as 164–167 (`SEED-155`: *if it depicts a surface consuming an existing component,
it must RENDER it, not redraw it*). The drafted `<header>`, the `SeedReceipt` and the graph column's
grid classes are the **real rendered DOM**, dumped under jsdom. Only the decisions card is composed by
hand, and every one of its nodes carries `data-s172="NEW"`. Rows 1 and 3's *answers*, the
`AI-proposed` label and its explanation, and both shipped invitations are **parsed out of the dump**,
so the card cannot show words the product does not say or disagree with the header on the same page.

`build.cjs` asserts **41** structural properties — every anchor present and unique, both shipped
affordances located and wholly removed for variant B, each variant genuinely different from the
shipped baseline and from each other — and exits non-zero otherwise. A splice into a missing anchor
fails silently and yields a variant that quietly equals the baseline; that is what the audit prevents.

⚠ **Two build bugs were caught by those assertions rather than shipping**, and are recorded because
both were the *silent* kind: a regex extractor stopped one nesting level early on
`builder-business-requirement` (three nested spans) and matched the wrong close tag on
`builder-view-toggle` (which closes on `</button></div>`). Both now use a depth-counting extractor.

Reproduce the whole chain from a clean checkout:

```bash
cp .planning/sketches/172-where-the-five-decisions-live/emit.test.tsx.src \
   frontend/src/pages/__emit172.test.tsx
cd frontend && GSD_VITEST_MAX_WORKERS=2 npx vitest run src/pages/__emit172.test.tsx && cd ..
rm frontend/src/pages/__emit172.test.tsx      # keep the app tree clean
node .planning/sketches/172-where-the-five-decisions-live/build.cjs
# tailwind: -c a copy of frontend/tailwind.config.js whose `content` is body.generated.html,
#           -i frontend/src/index.css -o tw.generated.css --minify
node .planning/sketches/172-where-the-five-decisions-live/assemble.cjs
```

⚠ **The emitter lives in `frontend/src/pages/`, which is THREE levels below the repo root — not
four.** 165's emitter sat one directory deeper, and copying its `../../../../` wrote the dump
outside the repository. The path is now correct in the source and commented there.
