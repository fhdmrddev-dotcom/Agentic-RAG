---
sketch: 001
name: stream-framing
question: "What does the live agent run *occupy* in the conversation stream — inline-folded, dedicated rail, or bracketed run-card?"
winner: "C"
tags: [layout, structure, chat, stream-framing]
---

# Sketch 001 — Stream Framing

## Design Question

When the agent is mid-execution (multiple tool calls + streamed text + thinking), **where in the page does that live work live**? Three structural answers:

- **A: Inline-Folded** — the live work appears INSIDE the assistant turn, in stream order. Tool calls are cards interleaved with text. One unified column. Like Claude.ai's analysis tool.
- **B: Dedicated Rail** — the conversation stays clean prose; a right-side execution rail shows the structured timeline (steps, durations, status, output preview). Like Linear's right sidebar.
- **C: Bracketed Run-Card** — each multi-tool turn is wrapped in a labeled card with header (timer, counter, run status). Lives in conversation flow but is structurally separate. Collapses to a one-line summary once done.

## How to View

```
open .planning/sketches/001-stream-framing/index.html
```

(or paste the absolute path into a browser)

## Variants

- **A: Inline-Folded** — live work + final text share one column; chronological, easy to read top-to-bottom
- **B: Dedicated Rail** — two columns; conversation is clean, execution is auditable
- **C: Run-Card** — turn-level container with header + counter; folds to summary after completion

## What to Look For

When comparing variants, focus on the **long-execution moment** (currently shown as turn 1, 12.4 seconds in, 2/3 tools done):

1. **Trust:** Without scrolling, can you tell the agent is still working AND what it's done so far?
2. **Density:** Does the live work feel oppressive next to a long conversation history, or does it sit comfortably?
3. **Reading flow:** Where does your eye go first? Does the final answer feel buried, or is it findable?
4. **Cross-thread:** Imagine 5 prior turns above. Does the page architecture hold up, or does it become a wall of expanded tool cards?
5. **Done-state:** Click "↻ State" in the bottom-right toolbar to see what each variant looks like AFTER the run finishes — which collapse pattern feels best?

## Interactivity

- **Tabs at top** swap variants
- **Tool card headers** are click-to-expand (where applicable)
- **Run-card summary row** (Variant C) is click-to-expand
- **Sketch toolbar** (bottom-right): theme switcher, replay stream, cycle to done-state
