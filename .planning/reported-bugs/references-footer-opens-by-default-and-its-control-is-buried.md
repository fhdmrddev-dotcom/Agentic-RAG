---
id: BUG-260902-07
title: The References footer opens by default and its fold control is buried in the prose
reported: 2026-09-02
surface: Agentic-RAG
severity: minor
status: open
affected_areas: [frontend/chat, citations, reasoning, readability]
folded_into: null
verified_closed_by: null
related_seeds: [SEED-240, SEED-128]
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 4ee84e96d
  date: 2026-09-02
---

# BUG-260902-07: The References footer opens by default and its fold control is buried

## What the operator observed

> "the sources should be by default folded while now it is unfolded — this is very bad user
> experience. It should be all the time folded unless the user wanted to open it. And the folded
> menu should be more clear; it is buried within the text and it is not highlighted as it should be."

Two complaints, one component. They are related but independently fixable.

## Measured cause

**① Open-by-default is conditional, and the condition is the common case.**

`MessageItem.tsx:619`:

```tsx
defaultOpen={hasInRangeMarker(dedupParagraphs(message.content), message.citations.length)}
```

`CitationList`'s own prop default is `false` (`CitationList.tsx:25`) — the footer is collapsed
whenever the answer carries no inline marker. But a grounded RAG answer normally *does* carry
markers, so in ordinary use the footer is **open every time**, and the collapsed state is only ever
seen on the degraded path.

⚠ **This reverses a deliberate shipped decision, and that should be conscious rather than
accidental.** The docblock at `CitationList.tsx:9-14` records it as the *"canonical open-by-default
contract (D-06/D-07)"* from Phase 153, whose sketch 075-A paired numbered markers with an
open-by-default References footer so the two read as one bidirectional object. The operator's
direction supersedes it; the rationale is preserved here so a future phase does not "restore" the
old behaviour believing it was an oversight.

**② The trigger is styled as prose, not as a control.**

`CitationList.tsx:32-44` — the `CollapsibleTrigger` is:

```
className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
```

with a 12 px `ChevronRight` / `ChevronDown` and the label `References · N sources`.

No border, no background, no surface, no weight change, no separator from the answer body. It is
`text-xs` at `--muted-foreground`, which is the **lowest-contrast text in the message**, sitting
directly beneath body copy at a larger size and higher contrast. It reads as a trailing sentence
rather than as something you can press — which is exactly the report: *buried within the text and
not highlighted as it should be.*

## Why the two halves compound

While the footer is open by default, the trigger's weakness is invisible — nobody needs to find a
control they never have to use. **Folding it by default makes the buried trigger the only way back
in**, so ① without ② would take a surface that is merely noisy and make it feel broken. They ship
together or not at all.

## What "fixed" looks like

- A settled answer's References footer is **collapsed**, every time, regardless of markers.
- Opening it is a deliberate act, and its state is not remembered across messages (each answer
  starts folded).
- The control reads as a control: it is separated from the answer body, and it is legible without
  hunting. ⚠ It must remain **calm** — this is the Aether "chrome stays out of the way until it has
  something to say" direction, so the fix is *legibility*, not loudness. A full-width button bar
  would over-correct.
- ⚠ **The count keeps its honesty.** `References · N sources` names how many there are while closed;
  a fold that hides the count would trade one readability problem for a worse one.

## Not in scope

- The inline marker chips themselves (`CitationCard` / `CitationPeek`, Phase 153) — the markers are
  not the complaint and are working.
- `SEED-119`'s cited-vs-retrieved superset footer.

## Routing

Chat-surface readability, same component family and the same "the chat column reads cluttered"
complaint as `SEED-240`. Belongs with **Phase 224**, behind its G-2 sketch — the second half is a
visual-affordance question and must be drawn, not specified in prose.

---

## ⭐ MEASURED 2026-09-02 — THE SECOND HALF IS NOT ONE COMPONENT, IT IS TWO

The buried-trigger complaint reproduces **identically** on the reasoning block:

| component | trigger styling |
|---|---|
| `CitationList.tsx:32-44` | `text-xs text-muted-foreground` + 12px chevron |
| `RunCard.tsx:481-484` (the "Thinking" fold, Phase 076.2 D-01) | `text-xs text-muted-foreground/80` + 12px chevron |

Same size, same token, same absent border, same absent surface — and the reasoning one is **dimmer
still** (`/80`). Both sit directly beneath content at higher contrast, so both read as trailing prose
rather than as controls.

⭐ **So the affordance half of this bug is a SHARED fix across two components, not a one-off.** Whatever
shape the fold control takes, it should be one thing used twice — the `connectionMark` / `TOOL_PHRASES`
lesson: a second copy is how two surfaces drift.

⚠ **Only the AFFORDANCE generalises. The default-state half does NOT.** The References footer opens by
default and must be folded (`MessageItem.tsx:619`); the Thinking block is **already** `useState(false)`
and is correct as-is. **Do not "fix" the thinking default — it is not broken**, and flipping it would
be a regression dressed as consistency.

