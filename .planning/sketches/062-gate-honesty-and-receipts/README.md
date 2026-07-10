---
sketch: 062
name: gate-honesty-and-receipts
question: "How loud is the 'every action is recorded' story — where does the receipt land after an operator acts, and where does the ledger live?"
winner: "A"
tags: [phase-146, admin-shell, operator, audit-receipt, recording, honesty, ledger, toast]
---

# Sketch 062: Gate Honesty & Audit Receipts

## Design Question

ADMIN-01's second promise: **every operator action writes to `operator_audit_log`**. 061-B
locked the shell; this sketch locks the *receipt vocabulary* — the moment after an operator
does something, how does the UI prove it was recorded? Whatever wins here is inherited by
every admin write that follows: Kill run + kill-switches + maintenance mode (147), user
disable/enable (148), model capability edits (149), key saves (150).

146 itself is read-mostly (sign in, view health, view audit), so the sketch includes two
**clearly-flagged preview writes** (maintenance mode + a web-search kill-switch, violet
"preview — arrives with System Controls" flag) purely to make the receipt beat feel real
on a mutation. They are NOT 146 scope.

All three variants sit inside the locked 061-B shell (operator band + tabs, plain language).

## How to View

open .planning/sketches/062-gate-honesty-and-receipts/index.html

## Variants

- **A: Always-on ledger** — the "Recent operator actions" card lives permanently on the
  Overview; every action lands as a new top row where you can see it happen. The ledger IS
  the receipt; no toasts. (This is what 061-B showed.)
- **B: Receipt toasts** — the Overview stays free of the ledger; each action confirms with
  a quiet bottom-right "🛡 Recorded — Turned ON maintenance mode" toast that names exactly
  what was written, then fades. The full ledger lives only in the Audit tab.
- **C: Counting marker** — the band's recording marker becomes a live "● recorded · N today"
  counter that pulses +1 on every action. Ambient, zero layout shift; clicking it opens the
  Audit tab (the only ledger home).

## What to Look For

1. **Flip the maintenance switch** in each variant. Do you *know* it was recorded — with
   your name on it — without hunting? Which proof feels trustworthy vs decorative?
2. **Click around a lot** (refresh + both switches a few times). Which treatment stays calm
   under repeated actions, and which starts to nag? (Calm instrument, not a notification
   machine.)
3. **The write distinction** — write actions carry a ✎ mark in the feed; reads don't. Does
   the ledger read scannable: "what did I *change* vs what did I *look at*"?
4. **The tomorrow story** — you come back tomorrow to check what happened. In each variant,
   is it obvious where the history lives?
5. **Consequence honesty** — turning maintenance ON raises a persistent amber banner
   ("users currently see the platform read-only"). The receipt says *recorded*; the banner
   says *still in effect*. Two different truths — do they read as two things?
6. **147-fit** — imagine "Kill run" instead of a toggle: an action with a victim. Which
   receipt treatment carries that weight?

## Grounding (real, not invented)

- Feed shape = `operator_audit_log` (who / what / when — net-new in 146).
- Plain-language-first per the locked 061-B revision; receipts use plain sentences
  ("Turned ON maintenance mode"), never action codes.
- Maintenance mode + kill-switches are real Phase 147 scope (FLAG-01, `app_settings`
  TTL-cache substrate) — previewed here only for the receipt vocabulary, flagged violet.
- The "🛡 Saved · audit logged" receipt precedent: Phase 112's metadata-edit receipt
  (Running Design Decision 21).
