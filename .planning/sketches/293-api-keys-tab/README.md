---
sketch: 293
name: api-keys-tab
question: "How does the API keys tab lay out create, the show-once secret with ready curl lines, the list with last-used and activity, revoke, and the admin's org-wide list?"
winner: "C — a card per key (operator, 2026-10-24)"
tags: [phase-293, start-02, seed-195, settings, api-keys, org-admin]
phase: 293
requirements: [START-02]
extends: [062-gate-honesty-and-receipts, 064-active-runs-and-kill, 080-org-admin-shell]
---

# Sketch 293: API Keys Tab

## Design Question
Phase 293 adds the app's first non-login credential. The new **API keys** tab in Settings must let a
member create a key (label, published workflows, expiry), copy its secret once with ready `curl`
lines, see each key's last use and recent calls, and revoke it; an org admin sees and revokes every
member's keys. This sketch is the G-2 acceptance bar (293-CONTEXT D-21).

## How to View
open .planning/sketches/293-api-keys-tab/index.html

## Variants
- **A: One card, rows open in place** — the shipped Settings SectionCard; the form and the secret appear inside the card; a row expands to its activity.
- **B: List + side panel, create in a dialog** — short list; a 400px push/split side panel holds facts, activity and revoke; create is a two-step dialog.
- **C: A card per key** — each key a card with its workflows and a strip of its last calls; the draft card becomes the key card and shows the secret in place.

## State buttons
No keys yet · Has keys · New key from a workflow's ⋯ menu (pre-picked) · Just created (shown once) · Revoke · Org admin.

## Fixed in every variant (293-CONTEXT)
Runs as you (D-01) · picks published workflows only, file-upload workflows disabled with a reason
(D-02, D-11) · expiry 30/90/365/never, default 90 (D-04) · an unpublished workflow on a key reads as
refused (D-05) · activity lists starts, reads and refusals with reasons (D-16, D-17) · per-key limits
shown read-only (D-14) · the secret shown once with `curl` for start and status (D-19) · revoke is a
victim-naming sheet (graded-guard rule, 066) with a recorded receipt (062-A) · admin view in the
org-indigo shell, owner column, revoke names the owner (D-03, D-18, 080-A).

## What to Look For
- At the show-once moment, is it obvious the secret will not come back, and is the `curl` ready to paste?
- Can you tell at a glance which key is working, which is refused for one workflow, and which is dead?
- Where would you look to answer "why did n8n's call fail at 10:12"?
- Does the admin view read as someone else's keys, not yours?
