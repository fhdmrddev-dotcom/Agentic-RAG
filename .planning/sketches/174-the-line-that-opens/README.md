---
sketch: 174
name: the-line-that-opens
question: "What does the decisions surface actually LOOK like on the screen — and which shape leaves the workflow visible?"
winner: null
tags: [phase-197, auth-02, guided-authoring, decisions-surface, recommendation, user-facing-mockup, g2-sketch-gate]
---

# Sketch 174: The line that opens

**This is the picture.** Sketches 172 and 173 work out *which shape is right and how we know*;
this page shows only what you'd see. It exists because the operator said 172/173 carried a lot of
information but did not show what the thing looks like — a fair read, and this is the fix.

## How to view

```
start .planning/sketches/174-the-line-that-opens/index.html
```

Three tabs: **1 · The draft just landed** · **2 · You opened it** · **3 · If it were a full card
instead**. The line really opens, and pressing *Change* on a row really lights up the control in
the header. The screen is resizable from its bottom edge.

Verified at 1440×900: no horizontal scroll, all three screens render the real 5-step spine, the
disclosure opens and closes, and the jump focuses `business-requirement-input`. One console message,
benign and inherited: the `file:` unique-origin notice (sketch 165 recorded the same).

## The shape

The draft arrives exactly as it does today. Under the receipt there is **one line** — *"I made 5
decisions for you"* — that opens into the five when you want it. Each row shows the decision, the
answer the AI chose, and takes you to the control **already on the screen**.

- **Nothing is duplicated.** Three of the five decisions already have a control (the knowledge base
  and the requirement in the header, the template in the step panel). The line points at them
  instead of growing a second copy — the page's own rule is *"a second, different answer to one
  question is drift."*
- **Nothing new blocks you.** It is closed when it arrives and it never gates anything, so the fast
  door stays exactly as fast (the D-05 red line).
- **The workflow stays visible.** That is the measured part, below.

## Why this shape and not a card — measured on this page

| | the decisions element takes | the workflow graph gets |
|---|---|---|
| **1 · just landed** (one line) | **41 px** | **363 px** |
| **2 · you opened it** | 237 px | 167 px |
| **3 · a full card instead** | 276 px | **128 px** |

In a 780 px screen. Sketch 172 measured the same thing harder: with a full always-open card the
graph gets **25 px at a 700 px column** and is not workable below ~900 px — so on a laptop, a second
card doesn't shrink your workflow, it hides it. The collapsed line costs **41 px** instead of ~370,
and the tall state only happens **because you asked for it**.

## What is real here

Everything except the decisions line: the header (with its knowledge-base picker, requirement input
and the shipped `AI-proposed` mark), the receipt, the view toggle, and **the whole step graph** are
the real rendered DOM from the running code, dumped by sketch 172's emitter. That is what makes this
look like the product rather than a drawing of it. The decisions line is the only proposal.

Every product sentence is parsed out of that dump, never re-typed. `build.cjs` asserts it — 14
assertions, 0 failing.

## Two things it does not settle

1. **Row 4 (name)** — the header shows the workflow's *slug*, so its **name appears nowhere** today.
   This row would be the first place it shows at all, which is a small scope addition worth agreeing
   deliberately.
2. **Row 5 (deliverable)** has no field — it is derived from the last step, so it reads as a fact
   with no *Change* link. Making it editable is a bigger change than the other four.

## Reproduce

```bash
# reads sketch 172's dump — run 172's emitter first if dom.generated.json is absent
node .planning/sketches/174-the-line-that-opens/build.cjs
# tailwind over body.generated.html, then:
node .planning/sketches/174-the-line-that-opens/assemble.cjs
```
