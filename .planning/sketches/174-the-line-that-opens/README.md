---
sketch: 174
name: the-line-that-opens
question: "What does the arrival moment LOOK like — and should 'here's what I built' and 'here's what I decided' be one card or two?"
winner: null
tags: [phase-197, auth-02, guided-authoring, decisions-surface, recommendation, one-card, user-facing-mockup, g2-sketch-gate]
---

# Sketch 174: One card, not two

**This is the picture.** Sketches 172 and 173 work out *which shape is right and how we know*; this
page shows only what you would see. It exists because the operator said 172/173 carried a lot of
information but did not show what the thing looks like — a fair read.

## How to view

```
start .planning/sketches/174-the-line-that-opens/index.html
```

Four tabs: **1 · One card, just landed** · **2 · Opened the decisions** · **3 · Two cards (what I
drew first)** · **4 · Two cards, opened**. Every fold really opens; pressing *Change* on a row really
lights up the control in the header. The screen is resizable from its bottom edge.

Verified at 1440×900: no horizontal scroll, all four screens render the real 5-step spine, both folds
open and close, the jump focuses `project-folder-picker` and `business-requirement-input`, and the
measurement recomputes on every fold. One console message, benign and inherited: the `file:`
unique-origin notice.

## ⚠ The operator caught the real defect, and it changed the recommendation

The first cut of this page drew **two cards**: the shipped receipt (*"Here's what I built — 5
steps"*) and a new one (*"I made 5 decisions for you"*). Recorded verbatim, because it is correct:

> *"you produce two cards … this means the spine [gets] a limited area … the area is very tight,
> with exception of the one version where I can collapse … we always have to think about not
> over-complicating the information … information should not be dense but be enough for the user to
> know what is happening."*

**Both cards say the same kind of thing — here is what the AI just did.** Splitting one thought
across two frames spends the graph's space on chrome, and collapsing the second one only hides that.

So the shape is now **one card** with the receipt's own heading, two openable lines, and the
receipt's own closing sentence:

```
Here's what I built — 5 steps                                    ✕
  ▸ 3 steps must prove their sources                          why
  ▸ 5 decisions I made for you                             review
Everything else is yours to change. Nothing is saved or published yet.
```

Four lines. Open either one when you want it. Each decision hands you to the control **already on
the screen** — nothing is duplicated.

## Measured on this page, in a 780 px screen

| | arrival chrome | your workflow gets |
|---|---|---|
| **1 · one card, just landed** | **149 px** | **507 px — 65%** |
| 2 · one card, decisions opened | 334 px | 321 px — 41% |
| 3 · two cards, just landed | 284 px | 363 px — 47% |
| 4 · two cards, opened | 478 px | 169 px — **22%** |

**Merging halves the arrival chrome** (284 → 149 px) and hands the workflow **65% of the screen
instead of 47%**. The tall state only ever happens because you asked for it.

Sketch 172 measured the same thing harder from the other end: a full always-open card leaves the
graph **25 px at a 700 px column**, unworkable below ~900 px.

## ⚠ This is a COMPOSITION change, not a charter change — it does not violate D-02

`197-CONTEXT.md` D-02 refuses to widen `SeedReceipt`, and correctly: its docblock is fenced
(*"authors no sentence of its own"*, *"declares no predicate of its own"*, *"imports nothing from the
API client"*) and widening its charter would cost exactly the guarantees that make it checkable.

**Nothing here widens it.** `SeedReceipt` stays the leaf it is; a **parent** composes its output and
the decisions list into one visual card. **One card in the UI, two components underneath** — which is
what D-02 asked for and what the operator is asking for at the same time.

## What is real here

The header (knowledge-base picker, requirement input, the shipped `AI-proposed` mark), the view
toggle, the whole 5-step spine graph, and **the receipt's heading, its two sentences, its three
sealed-step rows and its closing line** are the real rendered DOM from the running code. The receipt
is **re-framed, not rewritten** — each fragment is extracted by its own `data-testid` and the
extraction is asserted piece by piece, so a lost fragment fails the build instead of quietly
vanishing from the card. `build.cjs`: **26 assertions, 0 failing**, including that the recommended
screen contains **exactly one** arrival card.

The only proposals are the two fold summary lines and the five decision rows.

## Two things it does not settle

1. **Row 4 (name)** — the header shows the workflow's *slug*, so its **name appears nowhere** today.
   This row would be the first place it shows at all. A small scope addition worth agreeing
   deliberately rather than inheriting.
2. **Row 5 (deliverable)** has no field — it is derived from the last step, so it reads as a fact with
   no *Change* link. Making it editable is a bigger change than the other four.

## Reproduce

```bash
# reads sketch 172's dump — run 172's emitter first if dom.generated.json is absent
node .planning/sketches/174-the-line-that-opens/build.cjs
# tailwind over body.generated.html, then:
node .planning/sketches/174-the-line-that-opens/assemble.cjs
```

## ⚠ Two defects found by LOOKING, after every measurement had passed

Both were invisible to geometry assertions, and one of them is why the operator said the states
*"look the same"*. Recorded because the lesson is the point: **three pages of green numbers did not
notice that the pages did not look like the product.**

1. **Every sketch page rendered in LIGHT mode.** The Deep Midnight tokens live in a base-layer
   `.dark` rule, and Tailwind purges it unless the string `dark` appears in a **scanned** file. The
   only scanned file is `body.generated.html`; the `class="dark"` on `<html>`/`<body>` lives in
   `assemble.cjs`, which Tailwind never reads. Fixed by putting the token on the page root in all
   three builds — and commented there as load-bearing, because it looks exactly like decoration.
2. **The header contradicted the card.** React sets a `<select>`'s value as a DOM **property**, so
   serialising the real header lost the selection and the picker re-rendered as *"No knowledge base ·
   searches everything"* while the card beside it said *"Vendor contracts"* — one screen, two
   answers to one question, on the sketch whose entire subject is that a decision has one answer.
   Repaired by marking the bound option `selected`, asserted in both directions.

## ⚠ And the fixed screens showed something about the SHIPPED receipt

With the theme correct, tab 3 makes it plain: **today's receipt is always fully open.** It renders
both grounding paragraphs and all three sealed rows unconditionally, every time a draft lands.

So the one-card shape is not only a merge — **it makes that content foldable, which it is not
today.** Tab 3 versus tab 1 is therefore an honest before/after of the current screen, not just a
comparison of two proposals. Worth carrying into planning: the fold improves the arrival moment
even setting the five decisions aside.
