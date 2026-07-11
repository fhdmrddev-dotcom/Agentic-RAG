---
sketch: 065
name: system-controls-and-maintenance
question: "How do the 4 fail-closed capability switches + platform-wide maintenance mode read together — with the right weight ('off for everyone' ≠ casual preference) and a clear 'one capability off' vs 'whole platform read-only' distinction — inheriting 062-A?"
winner: "A"
tags: [phase-147, admin-shell, operator, kill-switches, feature-flags, fail-closed, maintenance-mode, read-only, weight, distinction, flag-01, ad-02]
---

# Sketch 065: System Controls — Kill-Switches & Maintenance

## Design Question

Phase 147's FLAG-01 half. The operator can flip four **fail-closed capability
kill-switches** (web search, code sandbox, self-improvement, workflows) — off means off for
*everyone*, instantly — and can put the whole platform into **maintenance / read-only
mode**. 062-A already locked the *receipt* vocabulary (switch component, ✎ ledger row,
consequence banner). What's still open is **weight & distinction**:

- **Weight:** turning a capability off for every user is not a personal preference toggle.
  How does OFF *look serious* — armed, consequential — without becoming alarmist?
- **Distinction:** "one capability off" and "whole platform read-only" are different kinds
  of power. How do we keep the operator from confusing a feature switch with the platform
  state switch?

Whatever wins here also sets how every future capability switch reads.

## How to View

open .planning/sketches/065-system-controls-and-maintenance/index.html

## Variants

- **A: Card grid + separated maintenance** — four capability cards (2×2); OFF tints the card
  red + adds an "off for everyone" tag + reveals the concrete impact. Maintenance sits apart
  in its own amber-framed "Platform state" panel — distinction by *location*.
- **B: Weighted list** — one clean list; weight comes from what OFF does *to the row* (red
  tint, "off for all users" tag, impact line). Maintenance is the last, tallest, amber-topped
  row — heaviest by position + size, not a separate zone.
- **C: Two-tier split** — explicit headered sections: "Capabilities" (calm, reversible) vs
  "Platform state" (amber-framed maintenance). Two *different kinds of power*, kept visibly
  apart — the strongest conceptual distinction.

**Winner: A — Card grid + separated maintenance** (operator, 2026-07-11). The 2×2 capability
grid + the spatially-set-apart amber "Platform state" panel reads the distinction fastest
without the heavier framing of C. Maintenance keeps the arm-to-confirm guard; capabilities
flip directly. This is the **Controls** section inside the 063-B Control Plane scroll; the
assembled surface is **sketch 066**.

## What to Look For

1. **Does OFF feel consequential?** Turn off Code sandbox in each variant. The card/row goes
   red, tags "off for everyone," and an honest impact line appears ("2 runs using code will
   error on their next call"). Does that land as *"this affects real people right now"* — or
   is it too loud / too quiet?
2. **The two-kinds-of-power test** — glance at each variant cold. Is it instantly obvious
   that maintenance mode is a *different animal* from a feature switch? Which separation
   reads fastest (A's panel, B's heaviest-last row, C's explicit tiers)?
3. **The heavy-action guard** — maintenance mode uses **arm-to-confirm** ("Put the whole
   platform in read-only mode? · Confirm / Cancel") — the same guard as 064's Kill, for
   cross-sketch consistency. Capability switches flip *directly* (fast for an emergency).
   Does that graded friction feel right — heavy guard on the platform-wide one, quick flip
   on the reversible ones?
4. **Consequence vs receipt (062-A)** — flip maintenance ON. The ledger gets a ✎ "Turned ON
   maintenance mode" receipt AND a persistent amber banner stays up ("the whole platform is
   read-only right now"). Two truths: *recorded* (past) vs *still in effect* (present). Do
   they read as two things?
5. **Repeated actions stay calm** — flip several switches in a row. The band flashes "every
   action recorded" each time and rows land in the ledger. Does it stay a calm instrument or
   start to nag?

## Grounding (real, not invented)

- All controls ride the existing **`app_settings` TTL-cached substrate** (no new flag
  infrastructure, per SC#4). `web_search_enabled` + `sandbox_enabled` already exist
  (`main.py:103`); self-improve / workflows / maintenance are net-new keys on the same
  substrate; a change takes effect on the next request via the existing TTL cache.
- **Fail-closed** = OFF refuses the capability for all users immediately — the OFF state is
  styled as *armed*, not neutral.
- The **switch** component, the **✎ write mark**, the **"every action recorded"** band
  flash, and the **consequence banner** are all the locked **062-A** vocabulary — 065 only
  decides composition + weight, it does not reinvent the receipt.
- Every toggle writes to `operator_audit_log` (net-new 146) with a plain-language label.
- Lives inside the **Control Plane** tab of the locked 061-B shell; final composition comes
  from **sketch 063**. The arm-to-confirm guard is shared with **064** (heavy actions =
  arm-to-confirm inline).
