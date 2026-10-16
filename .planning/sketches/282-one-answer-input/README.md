---
sketch: 282
name: one-answer-input
question: "Where does the ONE ask_user answer input live in each panel state, so a pause is always reachable and never answerable twice?"
winner: "A — Input follows the open panel (chosen autonomously 2026-10-15 under the operator's 'take best decisions' instruction; operator confirmation OWED at G-4)"
tags: [ask_user, pending-question, panel, chat, a11y, phase-282, fix-07, BUG-260918-01, BUG-260828-07]
phase: 282
requirements: [FIX-07]
extends: 006-pending-question
---

# Sketch 282: One Answer Input

## Design Question

Sketch 006 chose **C, dual-surface**: the panel holds the real input and the chat shows a **pointer**.
244-12 then mounted a second **full** `PendingAskStack` at chat-list level, because a workflow pause has
no message row and, with the panel closed, it had no reachable control (BUG-260828-07). The result was two
full inputs whose drafts disagree (BUG-260918-01).

This sketch decides where the single input sits in each panel state. Two constraints are fixed:
the chat-column **mount stays unconditional** (only its presentation may vary), and the panel card is kept.

## How to View

```
open .planning/sketches/282-one-answer-input/index.html
```

Switch variants and panel states. Pick an option, then toggle the panel: the selection must survive.
Switch threads: each thread keeps its own draft.

## Variants

- **A: Input follows the open panel ★.** Panel open → the panel card is the input, and the chat-column
  mount renders a one-line **pointer** (question, current draft, `Answer in panel →` that moves focus to
  the card). Panel on the rail → the same chat-column mount renders the full card, and the rail shows the
  pulsing dot. Workflow pause with the panel on the rail → full card in chat (the BUG-260828-07 case).
- **B: Chat always holds the input.** The panel shows a pointer back to chat. Reachable everywhere, but it
  reverses 006 and pushes the question into the transcript.
- **C: A pause opens the panel.** This is 006's rejected takeover, and on mobile it covers the chat with a
  sheet on every routine question.

## Why A

- It is 006 C as approved: the panel is the calm home, and the chat shows a pointer.
- It keeps 244-12's reachability: whenever the panel is not showing the card, the chat-column mount
  renders the full input.
- It needs **no mount-condition change**, only a presentation switch inside the one chat-column mount.
- The draft lives in one store keyed by `tool_call_id`. Every rendering, including the workflow run page's
  direct card mount, reads it. Nothing copies it.

Driven in Chrome (2026-10-15) before handoff. Exactly one input showed in every state of every variant:
`open 1/1ptr · rail 1/0 · wfrail 1/0 · wfopen 1/1`. The selection survived a panel toggle. The pointer
showed the draft, and its button moved focus to the card's first option.

## How we'd know this failed (G-6)

- Two inputs show for one pause in any panel state.
- A workflow pause with the panel on the rail has no reachable input.
- Toggling the panel or switching threads loses or changes the draft.
- `Answer in panel →` does nothing, or focus lands outside the card.
- The selected option can only be told apart by colour.
