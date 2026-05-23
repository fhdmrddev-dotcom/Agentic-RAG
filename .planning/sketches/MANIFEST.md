# Sketch Manifest

## Design Direction

**Calm instrument with selective signal-density at the live moment.** The agent feels like a confident specialist — restrained palette (Aether Deep Midnight), purposeful motion (no decorative spin), generous space at rest, and a controlled spike of status / counters / pulses only when work is actively in flight. The chrome stays out of the way until it has something to say.

The acceptance bar for every variant is the **long execution in progress** moment: 30+ seconds into a multi-tool run, can the user instantly read what the agent did, what it's doing, and trust it's still on track? This directly answers the documented UAT-gap pattern (regressions hiding in slow streams).

## Reference Points

| Reference | What we borrow |
|-----------|----------------|
| **Claude.ai analysis tool** | Inline tool-result-in-conversation pattern — the runner appears mid-message with status, output, and re-run controls. |
| **Cursor / Windsurf agent mode** | Multi-step agent loop — collapsible tool calls, status pills, streaming code output. Closest peer product. |
| **Linear (status & motion)** | Calm-but-expressive motion language. Status pills that pulse meaningfully; fades on state transitions. |
| **Raycast (command surfaces)** | Instrument feel — monospace touches, dense-but-quiet, keyboard-forward affordances. |

## Theme

`themes/default.css` — Aether Deep Midnight, sourced from the live `frontend/src/index.css :.dark` tokens so sketches feel like the real product.

## Running Design Decisions

| # | Decision | Source |
|---|----------|--------|
| 1 | **Live run = bracketed run-card** in conversation flow, with status header (timer + counter + bot avatar), progress shimmer while active, fold-to-summary on completion. | Sketch 001 winner C |

## Sketches

| # | Name | Design Question | Winner | Tags |
|---|------|----------------|--------|------|
| 001 | stream-framing | What does the live run **occupy** in the conversation stream? | **C — Run-Card** ★ | layout, structure, chat |
| 002 | tool-call-panel | What is the **shape** of a single tool call as it runs and finishes? | _pending_ | panel, tool, G-5 |
| 003 | thinking-moment | When the agent is **30+ seconds deep**, how do panels + status + thinking + text compose? | _pending_ | synthesis, long-run |
