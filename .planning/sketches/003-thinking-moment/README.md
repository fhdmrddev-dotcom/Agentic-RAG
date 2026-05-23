---
sketch: 003
name: thinking-moment
question: "At 30+ seconds deep into a multi-tool run, what stays visible under stress so the user can read what happened, what's happening, and trust it's still on track?"
winner: "B"
tags: [synthesis, long-run, composition, stress-test]
---

# Sketch 003 — Thinking Moment (Synthesis)

## Design Question

The acceptance bar of the whole sketch set: **at 30+ seconds into a long multi-tool run**, what stays visible so the user instantly understands:

1. What's done
2. What's running
3. What's next
4. How long it's been
5. Whether anything went sideways

This synthesis sketch uses the winning **Run-Card** from 001 + the winning **Editor Inset** tool shape from 002 as the foundation. The variants explore the still-unresolved question: **what extra surface (if any) helps the user navigate a tall run**?

All three variants share:
- Pinned sticky run-card header (timer + counter + bot avatar)
- Animated progress shimmer while active
- Inline narration text between tools
- Collapsible thinking block (💭) at the top
- Same tool-call editor-inset shape from 002

They differ on **one knob: navigation/orientation under scroll stress.**

## Variants

- **A: Agenda Strip** — pinned horizontal chip row of all steps under the header (`●●●●○○`). Each chip is colored by status; click to jump to that tool card. Always one glance to see the whole plan.
- **B: Focus Mode** — past steps automatically collapse to compact rows with their result-summary (`→ yoy_q3 = 30.87%`). Only the active step shows the full editor. Explicit "Next: write summary (queued)" footer. Less to scan, more attention on what's happening now.
- **C: Minimap Rail** — a thin vertical step rail inside the run-card (40px wide) with nodes connected by a thread line. Hover a node for the tool name + duration tooltip. Visual, low-data orientation aid.

## How to View

```
open .planning/sketches/003-thinking-moment/index.html
```

## What to Look For

1. **Glance test:** Cover everything except the header + your variant's navigation aid. Can you still tell what's happening?
2. **Scroll test:** Scroll within the run-card body. The header should stay pinned in all three — but does the agenda strip / focus header / minimap rail also help orient you when half the body is off-screen?
3. **Failure scenario in your head:** Imagine step 3 was an error — which variant surfaces that fastest? (Hint: chips in A turn red; B's focus shifts; C's minimap node goes red.)
4. **Cross-provider sanity:** Imagine this same run on OpenAI vs Anthropic vs Google. Does the variant still hold up if a provider has 22 iterations instead of 6? (G-5 / lived-experience UAT-gap concern.)
5. **The "expand to view" cost:** Variant B requires a click to see code; A and C show code by default for the active step. Which is the right default for a debugging-the-agent moment?
