---
sketch: 002
name: tool-call-panel
question: "What is the shape of a single tool call — unified card, stacked step rows, or editor inset?"
winner: "C"
tags: [panel, tool, G-5, ToolCallPanel]
---

# Sketch 002 — Tool Call Panel

## Design Question

What's the right **shape** for a single tool invocation (e.g. `execute_code`, `search_documents`) as it runs, finishes, or fails? This is the G-5 hot-file decision: `ToolCallPanel.tsx` has 5+ phases of patches — the shape decision drives the refactor.

Each variant shows **four states** so you can feel them next to each other:
- ▶ Running (active)
- ✓ Done (collapsed default + a same-shape `search_documents`)
- ✗ Error

## Variants

- **A: Unified Card** — one container does everything. Args inline in head, body for stream/output, status pill. Refinement of current pattern. Familiar, low surprise.
- **B: Stacked Step Rows** — the tool call decomposes into observable phases (args → sandbox → run → capture). Active phase pulses; each step has its own duration. Like a CI step view.
- **C: Editor Inset** — code becomes a real editor pane (line gutter, syntax highlighting, lang chip). stdout/stderr live in their own labeled region. File outputs land as preview cards (chart, file). Non-code tools get a different inner shape.

## How to View

```
open .planning/sketches/002-tool-call-panel/index.html
```

## What to Look For

1. **Running state — does it feel alive?** Brand-pulse marker (B), live stream caret in body (A & C), STDOUT streaming divider (C). Which one gives you the strongest "the agent is working" signal?
2. **Done state — does it earn the scroll?** Each variant collapses differently. A folds to a 1-line head; B keeps the full pipeline; C shows code + preview card.
3. **Failure mode — can you SEE what broke?** Try the error specimen at the bottom of each variant. Which is fastest to diagnose?
4. **Search vs code** — different tools have different result shapes (text snippets, ranked hits, file outputs). Which variant scales best across tool types without each tool needing a one-off design?
5. **Stacked next to other panels** — imagine 4-5 of these in a row in a run-card (sketch 001). Which keeps the run-card readable? Which becomes a wall of detail?
