---
sketch: 161
name: where-identity-lives
question: "Where does identity go on a card whose one sentence is already spent?"
winner: null
tags: [phase-192.1, lib-05, workflows-page, card, atom-budget, sentence-slot, lineage, a11y]
---

# Sketch 161: Where identity lives on the card

## Design Question

160 asks *what* identifies a row. This asks the harder, cheaper question:

> Where does that identity go, on a card that is already full?

The constraint is a **shipped rule, not a preference**. 159-C's decision was *one always-visible
sentence, spent once* — and Phase 192's gap-closure round already spent it on what the fork will do.
The card renders 13 atoms and **not one of them is an identity**.

## How to View

```
open .planning/sketches/161-where-identity-lives/index.html
```

Use the two toolbar buttons: **mark the sentence slot** (shows the contested node) and **mark new
atoms** (outlines anything a variant *adds* to the card).

## Variants

- **A: Second line** — a dedicated row under the name carrying owner · lineage · when-changed. Most
  legible, and the only one with room for all three signals. **Cost: a 14th atom on all 107 rows.**
- **B: Pill group** — the existing top-right state pill becomes a group of two or three. **No new
  row** on desktop; pills are short, so lineage compresses and wraps on a phone.
- **C: The sentence slot** — spend the node the card already owns. Its content is *already*
  state-selected in shipped code (`hasExistingFork ? EXISTING : DEFAULT`, `WorkflowCard.tsx:486`);
  C adds one more state to that selector. **Zero new atoms.**
- **Today (shipped)** — the reference frame: four genuinely different row states, distinguishable
  only by a small pill and a version number, two of them rendering the identical sentence.

## What to Look For

1. **The budget strip at the top changes per tab.** It is the argument in four numbers: atoms,
   sentence nodes, identity signals, net-new wire.
2. **Switch to the 375px viewport on B.** Three pills in a 170px column wrap into a stack — and a
   wrapped pill group *is* a second line, which is A without A's typography. B's central promise
   holds on desktop and quietly breaks on a phone.
3. **On A, hit "mark new atoms."** Decide whether a 14th atom is affordable. Note the original
   density complaint (`U5-b`, *"13 atoms per row"*) was **retracted as the wrong diagnosis** — so
   "the card is too dense" is no longer evidence against A. It may well be affordable now.
4. **On C, read the ⚠ box.** C is cheapest by construction but has a real cost — see below.
5. **The four row states are drawn from the real fixture**, not invented: a shared starter, your own
   original, your copy of a starter, your next version of a live row.

## ⚠ The free slot nobody is using

The sentence renders only when `runnable` is true (`WorkflowCard.tsx:484`). **Every draft has an
empty sentence slot today** — and drafts are precisely the rows most likely to be your own
half-finished forks, i.e. the rows that most need to say what they came from. Whatever wins, that
slot is already paid for.

## ⚠ The real cost of C, which decides whether C is even viable

On a forked row, C spends the slot on identity — so that row **no longer states the fork
consequence**.

- *An argument that this is fine:* the fork verb on a row you have already forked opens your existing
  copy, and 192-13 **already** swaps the sentence for exactly that case. C is the same move, once more.
- *An argument that it is not:* a published fork of your own can still be forked again, and its
  consequence sentence would then be missing.

**So C is only safe if the selector keys on "can this be forked into something new", not on "is this
a fork."** That distinction is the thing to settle in this sketch — it is a design decision with a
correctness consequence, and it should not be discovered during planning.

## ⚠ What B costs that the budget table cannot show

Top-right is a **claimed region** elsewhere in this product. Phase 185's governance corner seal owns
the top-right of the canvas node card, and the badge budget there is a max-2 tuple where a third is a
typecheck error.

That rule is scoped to the **canvas node**, not to this library card — stated precisely so it is not
mis-cited as a blocker. But B grows exactly the region the house style treats as scarce, so it is
worth saying deliberately rather than discovering in review.

## What A must not do

The soul's five atoms are consumed unchanged (`WorkflowSoul scale="card"`, `WorkflowCard.tsx:467`)
and any new line sits *around* them, never inside. If a new line pushes an atom off the card, A has
traded **LIB-02 for LIB-05** — and both are success criteria.

## Grounding (measured at HEAD)

| Fact | Where |
|---|---|
| One sentence node, `data-testid="fork-consequence"` | `WorkflowCard.tsx:484-488` |
| Its content is already state-selected | `WorkflowCard.tsx:486` — `hasExistingFork ? … : …` |
| It renders **only** on runnable rows — drafts have none | `WorkflowCard.tsx:484` |
| Reasons are real DOM text wired by `aria-describedby`, never a hover-only tooltip | `WorkflowCard.tsx:412`, `:420` (the `GovernanceSection.tsx:284` rule) |
| The soul is consumed unchanged — five atoms, not up for redesign | `WorkflowCard.tsx:467` |
| Top-right currently holds `⋯` + one state pill | `WorkflowCard.tsx:390-463` |

## Verification

`node --check` on the extracted inline script plus a headless JSDOM drive: **all checks pass**
(68/68 across this sketch and 162). Driven, not asserted — all four tabs render 13 cards with the
soul atoms intact and four genuinely distinct row states; *Today* and *A* carry exactly one sentence
node per runnable card and **zero** on drafts; **C carries exactly one per card including drafts**,
adds no `.identline`/`.pillrow`, and its selector is proven to branch (identity slots > 0 **and**
plain fork-consequence slots > 0 — a variant that only ever rendered one kind would fail this);
B emits a 3-pill group so the 375px wrap argument is testable rather than claimed.

The `[title]`-attribute count is 0 **with a positive control** proving the selector can find a
planted one. jsdom's unimplemented `window.scrollTo` is excluded by name, never by silencing the
error channel.
