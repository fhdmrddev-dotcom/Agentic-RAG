---
sketch: 307
name: connected-apps
question: "Where do a member's connected apps live, what does a row say, and how does an org admin disconnect all of them?"
winner: "A — own section above Keys in the existing API keys tab (self-picked under the operator's autonomous mandate, 2026-11-03; operator approval owed at G-4)"
tags: [phase-307, oauth-07, connected-apps, revoke, org-admin, graded-guard, g2-sketch-gate]
phase: 307
requirements: [OAUTH-07]
extends: [304 ApiKeysTab, OrgApiKeysTab, 064/068 victim-naming sheet, 062-A ledger receipt]
---

# Sketch 307: Connected Apps

## Design Question
A member must see every app signed in as them and disconnect each; an org admin must disconnect all in the
org — without touching keys, and without a new Settings tab.

## How to View
Serve `.planning/sketches` and open `307-connected-apps/index.html`.

## Variants
- **A: Own section above Keys** in Settings → API keys.
- **B: One list with keys**, a "Connected app" kind chip.
- **C: Tiles.**

## Views
Member with apps · member with none (empty state names where apps come from) · org admin (Disconnect all
behind a victim-naming sheet: app count, member names, "keys not touched", "other orgs not touched";
receipt = a ledger row).

## Fixed in every variant
Row = mark · name ("calls itself" when DCR) · host chip · org · access summary · connected / last used ·
Disconnect. Disconnect opens a sheet naming the app, org and access; the row leaves; "recorded" receipt.
The word is **Disconnect** (an app is connected, not keyed).

## Winner
**A.** B mixes two things with different fields (no secret, label or expiry on a grant) and contradicts
CONTEXT D-25; C wastes width for 1–5 rows and hides the host.
