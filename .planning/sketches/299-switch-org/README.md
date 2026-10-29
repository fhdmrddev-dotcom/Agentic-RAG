---
sketch: 299
name: switch-org
question: "Where does 'This is in <org> — switch?' appear, and how does it make clear that declining changes nothing, including a chat that is answering?"
winner: "A — prompt replaces the main area (operator, 2026-10-28)"
tags: [phase-299, link-05, org-switch, live-stream, four-axis, g2-sketch-gate]
phase: 299
requirements: [LINK-05]
extends: [079-identity-anchor-and-org-switcher, 298-ElsewhereLine]
---

# Sketch 299-2: Switch Org Prompt

## Design Question
A link to an item in another org the user belongs to must ask before switching. Declining must leave
the active org AND any live stream untouched; accepting switches and opens the item; a re-run or fork
from that page saves under the ITEM's org.

## How to View
open .planning/sketches/299-switch-org/index.html

## Variants
- **A: Prompt replaces the main area** — the question sits where the item would open; a bottom chip says the Northwind chat is still answering, with "Back to it".
- **B: Dialog over where you are** — the live chat stays visible behind the scrim, visibly still streaming.
- **C: Banner above where you are** — lightest touch; you are not moved until you choose.

## Controls
MOMENT: link opened · stayed · switching · switched (run open) · re-run from that page. The truth strip
shows the active org, the Northwind stream's word count (it keeps climbing in every state) and whether
the item opened.

## Fixed in every variant
Words reuse 298's vocabulary ("Switch to Acme Legal"). Re-run / fork buttons carry "saves in Acme
Legal". After switching, a line says the Northwind chat is still answering, with "Switch back".

## What to Look For
- After "Stay", is it obvious nothing happened and why the link didn't open?
- The prompt shows the item's title (the user is a member of that org). Confirm at discuss-phase.
- Is the org you're about to enter unmistakable (name + colour square), so the switch is never a surprise?
