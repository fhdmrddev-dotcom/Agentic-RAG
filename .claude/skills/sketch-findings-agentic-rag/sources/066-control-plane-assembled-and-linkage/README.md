---
sketch: 066
name: control-plane-assembled-and-linkage
question: "Do the three Phase-147 winners compose into one coherent Control Plane surface, and where does every button and link go — the whole-product navigation contract so implementation builds one spec, not three?"
winner: "reference"
tags: [phase-147, admin-shell, operator, control-plane, assembled, navigation-contract, linkage, ia, button-destination, reference, consistency, ad-02, flag-01]
---

# Sketch 066: Control Plane — Assembled & Linkage Contract

## Design Question

A **reference sketch** (single composed view, not A/B/C) created in direct response to the
operator's concern: *"think about the linkages and where each button and link direct to —
maintain consistency, consider the product as a whole and this menu as a whole, not
individually where we can make mistakes once we implement."*

The three Phase-147 winners were sketched as separate surfaces:
- **063-B** — pinned-health-header composition (the frame)
- **064-B** — confirm-sheet run cards (Active runs)
- **065-A** — card-grid controls + separated maintenance (Controls)

This sketch **assembles them into the single real Control Plane surface** they'll actually
be built as, and pins down **where every button and link goes** — so implementation follows
one navigation contract instead of making per-surface choices that drift.

## How to View

open .planning/sketches/066-control-plane-assembled-and-linkage/index.html

## What It Contains

1. **The assembled surface** — the 063-B pinned vitals + a scroll of Health → Active runs
   (064-B cards) → Controls (065-A grid) → Activity (062-A ledger). Fully interactive:
   Kill a run (confirm sheet → Cancelling… → Cancelled), flip capability switches,
   arm-confirm maintenance, ⌥ technical-names, ↻ refresh, and tab between Control Plane /
   Audit log / the honest locked-tab refusals.
2. **🔗 Show link map** — toggle (top of page, or the 🔗 toolbar button). Highlights every
   interactive control with a numbered violet chip that maps to…
3. **The navigation & linkage contract** (always visible below the frame):
   - **Band-tab IA table** — every tab, its live/locked state, its destination.
   - **Button → destination table** — all 15 numbered controls, their action, effect, and
     whether the action is recorded (read vs ✎ write).
   - **7 consistency rules** — the whole-surface guards (one receipt vocabulary; graded
     action guards by shape; consequence≠receipt; plain-language default; honest locks;
     non-discoverable; read-only monitoring not surveillance).
   - **The open IA decision (D-147-IA)** — does "Overview" survive or become "Control
     Plane"? (Recommendation: promote Overview → Control Plane; one landing, no duplicated
     health.)

## What to Look For

1. **Do the winners actually compose?** Scroll the surface — does 063-B's pinned header +
   064-B's cards + 065-A's grid read as *one instrument*, or as three bolted-together
   sketches? This is the whole point.
2. **Turn on the link map** and walk every numbered control against the table. Anything
   whose destination feels wrong or missing is a linkage bug to fix *now*, not at
   implementation.
3. **The two confirm shapes** — Kill uses a victim-naming sheet (#12); Maintenance uses
   inline arm-to-confirm (#14); capability switches flip directly (#13). Is that graded
   friction coherent as a *rule* (target-specific → sheet; global toggle → arm; reversible
   per-user → direct)?
4. **The seams** — "View all ›" and the recording marker both land on Audit log; locked
   tabs refuse honestly; Back to app exits the room. Do the cross-surface links feel
   consistent?
5. **Ratify the open IA decision** — should the 146 "Overview" tab become "Control Plane"
   (recommended, designed here), or stay a separate thin home? This is the one thing to
   decide before `/gsd:discuss-phase 147`.

## Grounding (real, not invented)

- Composition = the locked **063-B**; run cards = **064-B**; controls = **065-A**; shell =
  **061-B**; receipts = **062-A**. Nothing new is invented here — it only *wires* the
  winners together.
- Data shapes, `cancel_run` zombie-heal, `app_settings` TTL flags, `operator_audit_log`,
  `/admin/backpressure`, and the 404/non-discoverable red line are all as grounded in
  063/064/065.
- The contract is the authoritative spec; it is mirrored into `MANIFEST.md` → Running Design
  Decisions (Phase 147 session) so it survives past this sketch.
