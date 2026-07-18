---
sketch: 076
name: collapsed-nav-rail
question: "When the nav collapses to the 64px rail, what stays reachable — and how does it feel?"
winner: "B"
tags: [phase-156, nav, layout, collapse, rail, polish-01, seed-045]
phase: 156
---

# Sketch 076: Collapsed Nav Rail

## Design Question
Today (`NavPanel.tsx`) the panel renders at `w-64` and is *masked* to `w-16` when collapsed, so the
entire Chats region — **New Chat included** — is `opacity-0 pointer-events-none`. You must expand the
panel to start a chat (the confirmed SEED-045 Anchor 1 bug). The top nav items already collapse
correctly (icon-only + tooltip). **What should live in the 64px rail so the most common actions stay
one click away?**

## How to View
open .planning/sketches/156-collapsed-nav-rail/index.html

Each variant **starts collapsed** (so the fix is visible immediately). Use the per-frame
**"Proposed rail ⇄ Today (broken)"** toggle to feel the before/after, and the `›` toggle to expand.

## Variants
- **A: New Chat only** — the rail keeps the nav icons + a pinned **New Chat (+)**, mirroring the existing
  nav-item icon+tooltip pattern and the 087-08 workspace-panel precedent. Minimal, ships the confirmed fix.
- **B: + Search** — adds a **Search (⌕)** rail icon; clicking it expands the panel and focuses the search
  box. One extra affordance for the 280+-thread reality.
- **C: + Recents peek** — adds a **Recents (⏱)** rail icon whose hover opens a floating flyout of recent
  chats — jump to a recent thread *without* fully expanding. Richest, but more surface to build/test.

## What to Look For
- **Rail density** — does A feel too sparse, or is C's third icon one too many for a 64px column?
- **The before/after** — flip "Today (broken)" on any variant: the rail loses New Chat entirely. Is the
  proposed rail an obviously better everyday experience?
- **Discoverability** — are icon-only affordances + tooltips enough, or does Search/Recents need a label?
- **On-system feel** — tooltips, active states, motion should read as the real Deep Midnight app, not a new thing.
- **Reachability of the primary action** — New Chat is the acceptance bar (POLISH-01 SC#1). Does it stay obvious?
