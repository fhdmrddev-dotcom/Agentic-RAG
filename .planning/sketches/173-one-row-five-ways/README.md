---
sketch: 173
name: one-row-five-ways
question: "What does ONE row of the decisions card look like — ask-first, quiet-when-answered, or answer-first — across all five D-07 rows and every state each can actually be in?"
winner: null
tags: [phase-197, auth-02, guided-authoring, decisions-surface, row-anatomy, d-07, d-09, d-16, g2-sketch-gate, drawing-not-render]
---

# Sketch 173: One row, five ways

> **Part of the G-2 gate for Phase 197** (AUTH-02), with sketch **172**.
> 172 asks *where* the five decisions live. 173 asks what **one row** looks like.

## How to view

```
start .planning/sketches/173-one-row-five-ways/index.html
```

Five tabs: **A · Ask first** · **B · Quiet when answered** · **C · Answer first** ·
**⚠ The five are not alike** · **The D-03 limit line**.

Verified at 1440×900: no horizontal scroll on any tab, all five panels switch, eleven cards render
five rows each, and the card-height readout recomputes per tab. No console errors.

## ⚠ Read this page as a DRAWING, unlike 172

172's central surfaces ship, so it **renders** them. Here the decisions card exists in no component,
so almost every node is a proposal — **27 per card**, each tagged `data-s173="NEW"`. What keeps it
honest:

- every sentence the product already owns is **parsed out of sketch 172's dump** of the real rendered
  `WorkflowBuilderPage`, never re-typed;
- row 3 wears the **shipped** `AI-proposed` mark markup **lifted whole** — the one node on the page
  that is not a proposal;
- `build.cjs` **asserts** that ratio (25 assertions, 0 failing) rather than asking you to trust it.

**D-16 is the floor on every string.** The mark means *a model wrote this*. It never means *this is
good* or *this is durable* — measured: `gpt-5.5` named one-run parameters in **5 of 5** QBR
requirements and all 20 were still correctly stamped, because the stamp's question is the anti-echo
one. The build asserts the shipped explanation carries no quality word.

## The variants, and what each measured

| | Approach | Card height (mixed · answered · empty) |
|---|---|---|
| **A** | **Ask first, uniform.** The question leads on every row in every state. Closest to `SeedReceipt`'s own grammar; the least clever thing that could work. | **368 · 368 · 368 px** |
| **B** | **Quiet when answered.** An answered row collapses to a stated fact; an empty row keeps the full question. | **313 · 292 · 368 px** |
| **C** | **Answer first.** The decision leads at 13 px; the question becomes an 11.5 px caption. | **357 · 357 · 357 px** |

**Height is not decoration here.** Sketch 172 measured **662 px of chrome** above the graph with a
370 px card, and that the graph gets nothing until the column exceeds ~715 px. B's **76 px** saving
on a fully-answered card is the only thing on either page that buys the canvas room back.

## ⚠ The line variant B must not cross

D-07 rejected *"only rows needing attention"* and *"all rows, weak ones flagged"* because **both need
a per-row "did the AI get this right?" predicate and no such predicate exists.** B is legitimate only
because *answered* means **the field is non-empty** — a server-side fact — and never *the AI got this
right*.

That is why the `AI-proposed` mark **survives into B's quiet state** instead of disappearing like a
resolved warning. It is asserted in `build.cjs`, because that is the exact place this variant would
rot into the thing D-07 refused.

## ⚠ The five rows are not alike — and two of them break a uniform treatment

| row | what backs it | empty state |
|---|---|---|
| 1 · KB scope | stored field | **shipped sentence** (`UNBOUND_KB_INVITATION`) |
| 2 · Template | stored, control on **another surface** | proposed |
| 3 · Requirement | stored field | **shipped sentence** (`REQUIREMENT_INVITATION`) |
| 4 · Name | stored, **no control anywhere** | proposed |
| 5 · Deliverable | **no field at all** | proposed |

**Row 5 has no field.** `soulDeliverable()` derives the answer from whether a terminal `llm_emit` step
exists, so "answering" row 5 means *editing a step* — which D-03's write path (`builderStore`, one
`set()`) does not express as a row edit. All three variants therefore give row 5 a **stated fact
instead of a control**. If a build wants row 5 answerable, that is a larger change than the other
four, and it should be **priced before planning rather than discovered inside it**.

**Row 4 adds the first display, not a second control.** Sketch 172 measured that the drafted header
renders the **slug**, so the workflow's *name* appears nowhere. D-15 leaves the slug untouched — so
after this phase the header would still show `vendor-risk-review` while this row edits
`Vendor-risk review`. Two strings, one invisible. Worth deciding deliberately rather than inheriting.

## The D-03 limit line — a discretion call, drawn both ways

`197-CONTEXT.md` leaves open *"whether the surface states D-03's limit — and if so, in one line or per
affected row."* The limit is real: answering a row writes into the draft, but the rest of the draft
was built around the old answer.

- **One line at the foot:** 368 px.
- **No line at all:** 338 px. Costs **30 px** to say it.

Defensible either way — the limit really only bites on rows 1 and 2 (scope and template shape the
retrieval steps), and a caveat nobody can act on is noise. ⚠ **But `SEED-157`'s whole finding was a
draft built blind to its template**, so a silent version of exactly that is the failure this phase
exists to stop repeating.

## What to look for

1. **Judge the MIXED board first on every tab**, not the all-answered or all-empty ones. Mixed is what
   a real fresh generation looks like: KB set pre-draft, requirement proposed by the model, name
   AI-chosen, deliverable derived, **no template**. The other two boards are diagnostics.
2. **Does C still satisfy SC#1?** The criterion is that the author is *"asked the decisions that change
   the result."* A card whose questions are 11.5 px captions may read as a better receipt rather than
   as being asked anything.
3. **In B, watch rows 4 and 5 in the quiet state.** They are quiet because they have a value — not
   because anyone checked the value. If the quiet row makes you *stop looking*, B has crossed D-07's
   line no matter what the code does.
4. **The two shipped empty-state sentences set the register.** `"No knowledge base · searches
   everything"` and `"What must this workflow deliver? · required to publish"` both state a fact and
   name a consequence. The three proposed sentences have to sound like they came from the same product.

## Reproduce

```bash
# 173 reads sketch 172's dump — run 172's emitter first if dom.generated.json is absent.
node .planning/sketches/173-one-row-five-ways/build.cjs
# tailwind: -c a copy of frontend/tailwind.config.js whose `content` is body.generated.html,
#           -i frontend/src/index.css -o tw.generated.css --minify
node .planning/sketches/173-one-row-five-ways/assemble.cjs
```

⚠ **The dependency on 172's dump is deliberate and asserted.** Re-emitting a second 156 KB copy would
create two dumps that can disagree about the shipped copy; reading 172's cannot. `build.cjs` fails
loudly if it is missing rather than quietly drawing invented sentences.
