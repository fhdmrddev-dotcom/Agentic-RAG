---
sketch: 235
name: thinking-with-no-run
question: "Where does reasoning live on a reply that called no tools — when there is no RunCard to put it in?"
winner: "B — bare line in the message body (operator, 2026-09-11)"
tags: [chat, reasoning, placement, phase-243, chat-04]
phase: 243
requirements: [CHAT-04]
---

# Sketch 235: Thinking With No Run

## Design Question

**Where does reasoning live on a reply that called no tools?**

`CHAT-04` is written as though a gate needs flipping. It doesn't. Measured at HEAD on 2026-09-11:

- `MessageItem.tsx:425` mounts the run path only when `(message.tool_calls?.length ?? 0) > 0`.
- **`RunCard.tsx:478-502` is the only place in the entire codebase that renders `reasoningContent`.**

So a pure-text reply does not *hide* its reasoning — **it has nowhere to put it.** Removing a gate
reveals nothing, because the component that would do the revealing is never mounted. This is a
placement question, and the answer determines a component boundary.

**105 of 340 reasoning-bearing messages in the local database — 31% — are exactly this shape.**
Their reasoning is stored and has never been drawn.

## How to View

```
open .planning/sketches/235-thinking-with-no-run/index.html
```

## Variants

- **Today** — both message shapes side by side, so you can see the asymmetry: one has a home, one
  has 1,180 characters of reasoning and no control that would show it.
- **A: Minimal frame** — the run frame, minus the run. Reasoning gets the same bordered container it
  has today, without step rows or a timer. The two shapes read as siblings.
- **B: Bare line** — no container. The calm line sits directly in the message body, and on a
  tool-bearing message it sits **above** the run frame, because thinking precedes doing.
- **C: In the footer** — the answer comes first; reasoning folds into the message footer beside the
  model name, as a provenance affordance.

## What to Look For

1. **The toolbar's "Show both message shapes" toggle.** Each variant draws both a zero-tool and a
   tool-bearing message. The question is not "does this look good on the no-tools case" — it is
   **"do the two shapes still read as one product."** Toggle it off to judge each alone, back on to
   judge the pair.
2. **Variant C against sketch 234's ▶ Replay the stream.** C's deciding cost is that a footer under
   an unwritten answer has nowhere to sit — **it cannot show live streaming**, so it needs a second
   surface for the live case. The Phase 095 build-once inventory rule exists to forbid exactly that.
3. **Variant A's empty box.** A container holding one line is chrome around nothing, and it draws on
   31% of reasoning messages. Compare the two rows: the frame earns itself on one and not the other.
4. **Variant B's relocation cost.** It moves the thinking control on tool-bearing messages — a change
   to a surface that isn't broken. Weigh one relearned thing against one component instead of two.

## Build consequence — this is the real output of this sketch

Each variant ends somewhere different, and the winner sets Phase 243's component seam:

| Variant | What ships | Renderers afterwards |
|---|---|---|
| **A** | `ThinkingBlock` extracted from `RunCard`; a shared frame wrapper both paths mount | one |
| **B** | `ThinkingBlock` extracted and mounted in `MessageItem` for both shapes | **one, and the tool-conditionality disappears by construction** rather than by a second branch |
| **C** | a new footer slot in `MessageItem`, plus a retained in-run surface for the live case | **two** |

⚠ **A is also the only variant whose seam serves CHAT-01 and CHAT-05 from the same extraction** —
worth weighing, because `RunCard.tsx` newly fires G-5 (**27 commits / 13 phases**, re-derived from
git 2026-09-11 against a stale ledger cell of `26/12/728`) and a phase that opens it should not
open it twice.

## Notes

- The reasoning text is verbatim from `messages.reasoning_content` on this machine's local
  Supabase — a real zero-tool sample, chosen because it is the shape this sketch is about.
- Whatever wins here must agree with sketch **234**'s winner: 234 decides what the expanded surface
  contains, 235 decides where it hangs. They are one component in two questions.

---

## ✅ WINNER — B, "bare line in the message body" (operator, 2026-09-11)

**Confirmed without a comparison round**, because sketch **234** answered this question on its way
past. 234's winning V1 mounts the thinking fold **directly in the message body** — no container, no
run frame — which is exactly variant B. Running a separate compare on three placements to re-derive
an answer already on screen would have been ceremony.

The three variants **are** built and viewable in `index.html` (all four tabs, both message shapes,
the compare toggle). They were not walked through one by one; B was recognised from 234.

### What B binds

| | |
|---|---|
| **Placement** | the fold sits in the message body for BOTH message shapes — tool-bearing and tool-free |
| **Renderers afterwards** | **one.** `ThinkingBlock` comes out of `RunCard` and mounts in `MessageItem` |
| **Tool-conditionality** | **disappears by construction**, not via a second branch. Today `MessageItem.tsx:425` gates the run path on `tool_calls.length > 0` and `RunCard.tsx:478-502` is the only renderer of `reasoningContent` — so 31% of reasoning-bearing messages (105 of 340, measured) have nowhere to draw it |
| **Order on screen** | thinking sits **above** the tool rows and the answer, matching the order in time |

### The cost, accepted

It relocates the thinking control on tool-bearing messages — a change to a surface that is not
broken. One relearned position, in exchange for one component instead of two.

### Rejected

- **A (minimal frame)** — a bordered container holding one line is chrome around nothing, drawn on
  31% of reasoning messages.
- **C (in the footer)** — a footer under an unwritten answer has nowhere to sit, so it **cannot show
  live streaming** and needs a second surface. The Phase 095 build-once inventory rule forbids that,
  and 234's replay makes the live case non-negotiable.

⚠ **Sketch 234's `index.html` is the G-2 acceptance bar for Phase 243**, not this one. This sketch's
file stands as the record of the placement question and the rejected foils — open it to re-feel A and
C if the seam is ever reopened.
