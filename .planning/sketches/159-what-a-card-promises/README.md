---
sketch: 159
name: what-a-card-promises
question: "At scale, what does a card show — and what do its actions promise before you click?"
winner: null
tags: [phase-192, lib-02, lib-03, workflows-page, card, actions, tweak, consequence, a11y]
---

# Sketch 159: What a card promises

## Design Question

LIB-03: *a user can predict what each card action does before clicking — in particular, "Tweak" must not
silently open a full edit surface.* The audit says the problem is bigger than one button:

> At scale, what does a card show, and what do its actions promise before you click?

## How to View

```
open .planning/sketches/159-what-a-card-promises/index.html
```

**Open the "Today (shipped)" tab first.** It is the diagnosis, and it is built from the real code.

## Variants

- **A: Rich card, worded actions** — every verb keeps its place but says what it does, in a
  **consequence line that is real DOM text under the buttons**. `⑂ Tweak` becomes *Make a new version*,
  and clicking it opens a small confirm naming exactly what stays live and what you get.
- **B: Dense row, one primary + menu** — at 200 items the card is the wrong unit. One row per workflow,
  exactly one primary verb (**Run**), everything else in a menu whose items carry a sub-line spelling out
  the consequence.
- **C: Hybrid — one verb, consequence inline** — a card with a single obvious verb; the rest quiet
  behind ⋯; one always-visible sentence for the action whose result isn't obvious from its name.
- **Today (shipped)** — the three real card types side by side, with the defects annotated in red on the
  cards themselves.

## What the diagnosis found (all read from `WorkflowsPage.tsx`)

| Finding | Evidence |
|---|---|
| **Seven verbs across three card types** — `Use this →` · `⑂ Tweak` · `▶ Run` · `⋯ Delete workflow…` · `✎ Open` · `Publish…` | three card components, one page |
| **Tweak's only explanation is a `title=` tooltip** | `:857` — `title="Fork a new version into the Builder (the published row stays frozen)"` |
| **"Use this →" has the same problem** | `:155` region — `title="Fork a fresh personal copy of this starter into the Builder"` |
| **Two verbs are the same action in different words** — both fork a draft into the Builder | `onTweak` `:220` and `onUseStarter` `:259`; the shipped comment at `:250` literally calls the latter *"a sibling of onTweak"* |
| **A draft card's two buttons call the same handler** | `✎ Open` `:723` and `Publish…` `:731` both `onClick={onOpen}` |

The `title=` problem is not a nitpick: **touch has no hover**, and this project's own graded-governance
rule (Phase 185) already says a reason must be real DOM text wired via `aria-describedby`, *never* a
`title`. The shipped page breaks a rule the codebase already holds elsewhere.

## What to Look For

1. **Toggle "simulate touch (no hover)" in the toolbar, then read the Today tab.** Every tooltip
   explanation vanishes. That is the actual experience for a large share of users, today.
2. **Is renaming `⑂ Tweak` → *Make a new version* enough**, or does the action also need the confirm
   sheet A and C attach to it? The sheet names what stays live (v4) and what you get (v5, private) —
   more honest, one more click on a non-destructive action.
3. **A's consequence line costs two lines on every card.** At 200 cards that is a lot of repeated prose.
   C's bet is that only *one* sentence is needed, because Run is self-evident. Compare them at length.
4. **B's row drops the purpose sentence to a clipped column.** Density versus LIB-02's at-a-glance bar —
   the same trade 157-C makes. **If you pick B here you have effectively picked C in 157**; note that
   coupling deliberately rather than discovering it later.
5. **Does the shipped soul survive?** Purpose / needs / spine / tier / produces are rendered by
   `WorkflowSoul scale="card"` and are **not** up for redesign in this phase. Check that each variant
   still shows all five atoms — B shows three.

## Measured claim about these variants

Counted in JSDOM across the rendered tabs:

- Variants **A, B and C carry `0` action-level `title=` attributes** — every consequence is real DOM text.
- The **Today** tab carries **4** (the two shipped tooltips, rendered twice each).
- ⚠ **Honest caveat:** all four tabs still put the phase-type word in a `title` on each glyph in the
  chain (12 / 24 / 12 / 17 occurrences). That is the *shipped* glyph vocabulary's own hover-only problem,
  inherited, not introduced here — and it is a genuine finding worth carrying into planning rather than
  quietly leaving in a sketch.

## Verification

`node --check` on the extracted inline script plus a headless JSDOM drive: **0 errors**; all four tabs
render; the confirm sheet opens and closes; the ⋯ menus open; the `title=` counts above were measured,
not asserted.
