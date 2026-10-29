---
sketch: 299
name: cant-be-opened
question: "What does the one page for a link that is missing OR not allowed look like, with the same words, status and timing for both?"
winner: "B — in place, over its own area (operator, 2026-10-28)"
tags: [phase-299, link-04, security, not-found, g2-sketch-gate]
phase: 299
requirements: [LINK-04]
extends: [297-AddressNotFound]
---

# Sketch 299-1: Can't Be Opened

## Design Question
A link to a chat, workflow, run or Expert that was deleted, never existed, or is not the visitor's to
open must show ONE page — identical words, identical 404, identical timing — so the page never leaks
that an item exists. 297 already ships `AddressNotFound` for unparseable addresses; should this be the
same page?

## How to View
open .planning/sketches/299-cant-be-opened/index.html

## Variants
- **A: 297's page, new words** — the centred `AddressNotFound` gains the item noun ("This workflow run can't be opened"); a mistyped address reads "This address doesn't open anything". One component.
- **B: In place** — the card opens over the area the link points at (chat history, workflow library, Experts catalog), dimmed, with the address shown and a Copy address button.
- **C: Full page with next steps** — worded page + three moves: ask the sender, check which account you're signed in as, search for it yourself.

## Controls
LINK TO (chat / workflow / run / Expert / mistyped address) · WHY (deleted vs not allowed). Flip WHY and
nothing on screen changes — proven in Chrome: the rendered HTML is identical for both reasons, for every
kind, in every variant.

## What to Look For
- Does any variant hint which of the two reasons applies? (It must not.)
- Is naming the KIND ("This chat…") acceptable? The kind is already in the address, so it leaks nothing.
- B shows the area behind: does that read as "it's somewhere here, keep looking" — a false hint?
- C names the signed-in account: helpful for wrong-account visits, or noise?

## Carried into the build (from the B pick)
- The area behind the card is the GENERIC area for that kind (chat history, workflow library, Experts catalog) — identical for missing and not-allowed, never filtered or scrolled toward the item. Otherwise B leaks.
- The mistyped-address case (297's `AddressNotFound`) moves into the same in-place card, so the app still has one page.
- Below 820px the history column is hidden; the card sits over the main area alone.
