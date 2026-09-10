---
sketch: 234
name: the-thinking-block
question: "What does a model's reasoning look like at rest, mid-stream, and expanded?"
winner: null
tags: [chat, streaming, reasoning, phase-243, chat-01, chat-02]
phase: 243
requirements: [CHAT-01, CHAT-02]
---

# Sketch 234: The Thinking Block

## Design Question

**What does a model's reasoning look like at rest, mid-stream, and expanded?**

The shipped surface (`RunCard.tsx:501`) renders reasoning as a `whitespace-pre-wrap font-mono`
block inside a `max-h-64` scroller — a nested scrollbar inside a scrolling conversation, monospace
at body length, no structure, no way to skim. It is fed by `StreamsProvider.tsx:421-425`, which
fires a full `setMessages` **per token**, unthrottled.

Sketch **003** listed *"collapsible thinking block (💭) at the top"* as a shared element across all
three of its variants — it was scenery, never the design question. **Nobody has ever drawn what is
inside it when you open it.** This sketch does.

## How to View

```
open .planning/sketches/234-the-thinking-block/index.html
```

## Variants

- **Today (shipped)** — the current render, for comparison. Not a variant; the thing being replaced.
- **A: Prose** — the calm line opens into readable prose in the body font on a quiet left rule.
  Long reasoning clamps with a fade + "Show all of it", reusing the sketch-050 long-prompt pattern.
- **B: Timeline** — the calm line opens into beats on a spine (the 008-D / 052-A grammar), with
  **pivots** — the model changing its mind — marked amber.
- **C: Always inline** — no fold at all. Reasoning renders in a dimmer register above the answer.

## The grounding — real data, measured not assumed

Every number in the sketch's header bar was queried from this machine's local Supabase on
2026-09-11, and the reasoning text in all variants is **verbatim from `messages.reasoning_content`**,
not written for the sketch.

| | |
|---|---|
| Messages carrying reasoning | **340** |
| …that called **zero** tools (invisible today) | **105** — 31% |
| Median reasoning length | **198 chars** |
| Mean | **1,053 chars** |
| Max | **33,713 chars** |

⭐ **The 170× spread between median and max is the whole design tension.** The median is one short
paragraph — any structure imposed on it is scaffolding around a sentence. The tail is a wall that
only structure makes skimmable. **A variant that is calm at 198 chars and usable at 33,713 is the
one that wins**, and the toolbar's **Scale** control exists to make you check both before deciding.

## What to Look For

1. **Switch Scale to `max 33,713` on every variant.** This is the 045 real-scale lesson. A and B
   degrade differently; C degrades worst (the answer leaves the screen). Do not pick at the median.
2. **Press ▶ Replay the stream.** Watch the **resting line**, not the text. It shows drifting dots
   and does not churn — that is CHAT-02's coalesced cadence made visible. The shipped bug is that
   every token repaints the message *and* fires a scroll; if the line flickers, the fix failed.
3. **Variant B's honesty note.** The beats are a **client-side heuristic** over a plain string — no
   provider emits structured reasoning steps. Decide whether invented structure is worth it, knowing
   a mis-split is a surface that lies about how the model thought.
4. **Variant A at the median.** The clamp control disappears entirely below ~700 chars rather than
   sitting inert. Check that a short reasoning block looks finished, not truncated.
5. **The answer's prominence in C.** Reasoning is dimmer than the answer by design. Is the contrast
   enough at a glance, or does the eye land on the thinking first?

## Notes for whoever builds the winner

- `RunCard.tsx` measures **27 commits / 13 phases** (re-derived from git 2026-09-11) and **newly
  crosses the G-5 threshold** — the ledger cell reading `26/12/728` is stale. Whichever variant
  wins, say which component it lives in, so planning starts from a seam rather than discovering one.
- The real text sample happens to be a model reasoning its way through a **trimmed context** —
  which is `BUG-260906-01`, a second open bug visible inside the first one's surface. Left in
  deliberately; it is what the corpus actually contains.
- `lib/throttle.ts` already exists and is wired only to the cache writer. CHAT-02 is a wiring
  change, not a new mechanism.
