---
sketch: 299
name: sign-in-return-and-boot
question: "Does sign-in say where you'll land after following a link, how does the boot screen give up instead of hanging, and what does the mobile chat list show while loading?"
winner: "A — quiet line under the form (operator, 2026-10-28)"
tags: [phase-299, link-06, fix-02, sign-in, boot, open-redirect, g2-sketch-gate]
phase: 299
requirements: [LINK-06, FIX-02]
---

# Sketch 299-4: Sign-in Return and Boot

## Design Question
Signed out, a person opens a link, signs in (password, SSO or sign-up) and must land on it. Should the
sign-in page say so? Separately: the boot screen must give up with words and a retry, and the chat list
must never say "No recent chats" while it is still loading.

## How to View
open .planning/sketches/299-sign-in-return-and-boot/index.html

## Variants (sign-in)
- **A: Quiet line under the form** — "After you sign in, you'll go to a workflow run."
- **B: The card names where you're going** — a highlighted row: "Signing in to open a workflow run".
- **C: Silent return** — today's form; you just land there (comparison).

## Also on the page
- **Boot screen, three stages on one clock:** 0–8s the Iris · 8–20s "Still connecting…" · after 20s "Can't reach Syrel" + Try again (the link is kept). Play throttled, or play "answers at 4s" — then no message is ever shown.
- **Mobile chat list (FIX-02):** desktop already shows "Loading your chats…" (`ChatHistoryColumn.tsx:470`); mobile (`ChatLayout.tsx:711`) does not. Shown: today · Iris + words · skeleton alternative · truly empty.

## Fixed in every variant
Only the KIND is named, from the path — never the title (a signed-out visitor may not learn it). An
off-site or non-relative return target is dropped: no line, land on Chat (try "a link pointing
off-site"). Same landing for password, SSO and sign-up.

## What to Look For
- A vs B for someone arriving from the waiting-run email (Phase 300 rides this journey).
- Are 8s / 20s the right thresholds?
- Mobile loading: words + Iris, or skeleton rows?

## Carried into the build (not yet decided by the operator)
- Boot thresholds 8s / 20s and the mobile loading treatment (Iris + "Loading your chats…" vs skeleton rows) stay as sketched proposals; settle at `/gsd:discuss-phase 299`.
