---
sketch: 299
name: copy-link
question: "Where does copy link sit on a chat, a workflow, a run and an Expert, and what confirms it worked?"
winner: "C — share popover with who can open it (operator, 2026-10-28)"
tags: [phase-299, link-02, link-03, copy-link, share, g2-sketch-gate]
phase: 299
requirements: [LINK-02, LINK-03]
extends: [179-what-the-eye-lands-on-honestly]
---

# Sketch 299-3: Copy Link

## Design Question
Each of the four items gets its own address. Where does the control live on each surface (chat
header, workflow library card, run page header, Expert detail), and what is the one receipt?

## How to View
open .planning/sketches/299-copy-link/index.html

## Variants
- **A: "Copy link" in each ⋯ menu** — first item of the menu the item already has; nothing new in headers.
- **B: A link icon in each header** — one click; the icon flips to ✓ with a "Link copied" tooltip.
- **C: Share popover** — the address, Copy, and "Opens for members of Northwind who can see this…".

## Fixed in every variant
One "✓ Link copied" receipt at the bottom showing the address. The address is the item's own `/app/...`
path on the app origin, never a token. Clicking really writes to the clipboard.

## What to Look For
- Which do you reach for without thinking, on all four surfaces?
- Does C's "who can open it" line earn its extra click, given 299-1 already handles the refused case?
- Proposed address shapes (`/app/chat/<id>`, `/app/workflows/<id>`, `/app/runs/<id>`, `/app/experts/<id>`) — sanity-check before planning.
