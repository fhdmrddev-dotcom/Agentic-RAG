---
sketch: 301
name: waiting-on-you
question: "Where does the 'waiting on you' badge live so it is reachable from every view, how does a row name its org, and is there a mark-read?"
winner: "A — its own rail control (self-picked under the operator's autonomous mandate, 2026-10-29; operator approval owed at G-4 / SC#4)"
tags: [phase-301, note-01, note-05, attention, rail, org, g2-sketch-gate]
phase: 301
requirements: [NOTE-01, NOTE-05]
extends: [078-chat-history-home, 079-identity-anchor-and-org-switcher, 299-switch-org, 235-attention-popover]
---

# Sketch 301: Waiting on You

## Design Question
A workflow run waiting on its owner (question or approval, any org, scheduled or API-key) must be visible
from anywhere in the app, name its org, open the run (other org → 299's switch prompt), and leave once the
wait ends — without a second attention surface growing beside the Library's.

## How to View
Serve the folder (`python -m http.server` in `.planning/sketches`) and open `301-waiting-on-you/index.html`.

## Variants
- **A: Its own rail control** under New chat / Search — always present, amber count only when > 0, on every view.
- **B: On the avatar** — no new rail slot; the list sits at the top of the profile menu, one click deeper.
- **C: On the Workflows item** — reuses a slot; a schedule owner may never open Workflows, and the click navigates.

## Controls
MOMENT: nothing waiting · 1 waiting (this org) · 3 waiting across 2 orgs · answered in another tab (row
leaves, count drops) · open the other-org item (switch prompt replaces the main area) · mobile (hamburger
dot + "Waiting on you (N)" drawer row). Truth strip: active org, server count, badge, Library badge (a
stopped source — never merged), chat stream still writing.

## Fixed in every variant
Row = workflow name · org square + org name · "needs your answer/approval" · "waiting N min" (· scheduled).
Waited-longest first, one flat list, every row names its org. The whole row is one button. No mark-read,
no dismiss. Empty: "Nothing is waiting on you." The Library badge keeps counting only its own condition.

## Winner
**A.** B hides the list behind the menu (the "nothing in the shell points at it" failure) and competes with
the org switcher's mark; C fails the scheduled-run owner and conflicts a navigate click with an open-list
click. A costs one rail slot (BUG-260923-01 noted, left to SEED-166/196).
